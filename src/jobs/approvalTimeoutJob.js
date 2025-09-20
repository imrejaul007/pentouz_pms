import cron from 'node-cron';
import bypassApprovalService from '../services/bypassApprovalService.js';
import BypassApprovalWorkflow from '../models/BypassApprovalWorkflow.js';
import {
    notificationService
} from '../services/notificationService.js';
import User from '../models/User.js';

/**
 * Approval Timeout and Escalation Job
 * Runs every 5 minutes to check for:
 * - Expired approval workflows
 * - Workflows needing reminder notifications
 * - Workflows requiring escalation
 */

class ApprovalTimeoutJob {
    constructor() {
        this.isRunning = false;
        this.lastRun = null;
        this.stats = {
            processedTimeouts: 0,
            sentReminders: 0,
            escalatedWorkflows: 0,
            errors: 0
        };
    }

    /**
     * Start the cron job
     */
    start() {
        console.log('Starting Approval Timeout Job...');

        // Run every 5 minutes
        cron.schedule('*/5 * * * *', async () => {
            if (this.isRunning) {
                console.log('Approval timeout job already running, skipping...');
                return;
            }

            try {
                this.isRunning = true;
                await this.processApprovalTimeouts();
                this.lastRun = new Date();
            } catch (error) {
                console.error('Approval timeout job failed:', error);
                this.stats.errors++;
            } finally {
                this.isRunning = false;
            }
        }, {
            scheduled: true,
            timezone: "UTC"
        });

        console.log('Approval Timeout Job started - runs every 5 minutes');
    }

    /**
     * Process approval timeouts, reminders, and escalations
     */
    async processApprovalTimeouts() {
        console.log('Processing approval timeouts...');
        const startTime = Date.now();

        try {
            // Get all pending workflows
            const pendingWorkflows = await BypassApprovalWorkflow.find({
                    workflowStatus: 'pending'
                })
                .populate('initiatedBy', 'name email')
                .populate('approvalChain.assignedTo', 'name email')
                .populate('bypassAuditId', 'bypassId reason');

            console.log(`Found ${pendingWorkflows.length} pending approval workflows`);

            for (const workflow of pendingWorkflows) {
                await this.processWorkflow(workflow);
            }

            const duration = Date.now() - startTime;
            console.log(`Approval timeout processing completed in ${duration}ms`);
            console.log('Stats:', this.stats);

        } catch (error) {
            console.error('Error processing approval timeouts:', error);
            this.stats.errors++;
        }
    }

    /**
     * Process individual workflow for timeouts and escalations
     */
    async processWorkflow(workflow) {
        try {
            const now = new Date();
            const currentApproval = workflow.approvalChain.find(a => a.level === workflow.currentLevel);

            if (!currentApproval || !currentApproval.assignedTo) {
                return;
            }

            // Check if workflow has expired
            if (workflow.isExpired()) {
                console.log(`Workflow ${workflow.workflowId} has expired`);

                if (workflow.canEscalate()) {
                    await this.escalateWorkflow(workflow);
                } else {
                    await this.expireWorkflow(workflow);
                }
                return;
            }

            // Check for reminder notifications
            await this.checkReminders(workflow, currentApproval);

            // Check for escalation warnings
            await this.checkEscalationWarnings(workflow, currentApproval);

        } catch (error) {
            console.error(`Error processing workflow ${workflow.workflowId}:`, error);
            this.stats.errors++;
        }
    }

    /**
     * Check if reminders need to be sent
     */
    async checkReminders(workflow, currentApproval) {
        const now = new Date();
        const reminderInterval = workflow.notifications.preferences.reminderInterval * 60 * 1000; // Convert to ms
        const maxReminders = workflow.notifications.preferences.maxReminders;

        // Check if enough time has passed since last reminder
        const lastReminder = workflow.notifications.sent
            .filter(n => n.type === 'reminder' && n.recipient.toString() === currentApproval.assignedTo.toString())
            .sort((a, b) => b.sentAt - a.sentAt)[0];

        const shouldSendReminder = !lastReminder ||
            (now - lastReminder.sentAt) >= reminderInterval;

        const reminderCount = workflow.notifications.sent
            .filter(n => n.type === 'reminder' && n.recipient.toString() === currentApproval.assignedTo.toString())
            .length;

        if (shouldSendReminder && reminderCount < maxReminders) {
            await this.sendReminderNotification(workflow, currentApproval);
        }
    }

    /**
     * Check for escalation warnings
     */
    async checkEscalationWarnings(workflow, currentApproval) {
        const now = new Date();
        const timeoutAt = workflow.timing.timeoutAt;

        if (!timeoutAt) return;

        // Send warning if 15 minutes before timeout
        const warningTime = new Date(timeoutAt.getTime() - 15 * 60 * 1000);

        if (now >= warningTime && now < timeoutAt) {
            // Check if warning already sent
            const warningAlreadySent = workflow.notifications.sent.some(n =>
                n.type === 'timeout_warning' &&
                n.recipient.toString() === currentApproval.assignedTo.toString()
            );

            if (!warningAlreadySent) {
                await this.sendTimeoutWarning(workflow, currentApproval);
            }
        }
    }

    /**
     * Escalate a workflow
     */
    async escalateWorkflow(workflow) {
        try {
            console.log(`Escalating workflow ${workflow.workflowId}`);

            await bypassApprovalService.escalateWorkflow(workflow._id, 'timeout');
            this.stats.escalatedWorkflows++;

            console.log(`Workflow ${workflow.workflowId} escalated to level ${workflow.escalation.currentEscalationLevel}`);
        } catch (error) {
            console.error(`Failed to escalate workflow ${workflow.workflowId}:`, error);
            this.stats.errors++;
        }
    }

    /**
     * Expire a workflow
     */
    async expireWorkflow(workflow) {
        try {
            console.log(`Expiring workflow ${workflow.workflowId}`);

            workflow.workflowStatus = 'expired';
            workflow.timing.completedAt = new Date();

            // Update current approval to expired
            const currentApproval = workflow.approvalChain.find(a => a.level === workflow.currentLevel);
            if (currentApproval) {
                currentApproval.status = 'expired';
            }

            await workflow.save();
            this.stats.processedTimeouts++;

            // Send timeout notification
            await this.sendTimeoutNotification(workflow);

            console.log(`Workflow ${workflow.workflowId} expired due to timeout`);
        } catch (error) {
            console.error(`Failed to expire workflow ${workflow.workflowId}:`, error);
            this.stats.errors++;
        }
    }

    /**
     * Send reminder notification
     */
    async sendReminderNotification(workflow, currentApproval) {
        try {
            const approver = await User.findById(currentApproval.assignedTo);
            if (!approver || !approver.email) {
                return;
            }

            const timeRemaining = workflow.timeRemaining;
            const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
            const minutesRemaining = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

            await notificationService.sendReminder({
                workflowId: workflow.workflowId,
                recipient: approver.email,
                reminderType: 'approval_pending',
                metadata: {
                    workflowId: workflow.workflowId,
                    bypassId: workflow.bypassAuditId.bypassId,
                    reason: workflow.bypassAuditId.reason.description,
                    timeRemaining: `${hoursRemaining}h ${minutesRemaining}m`,
                    urgency: workflow.analytics.urgencyLevel || 'normal'
                }
            });

            // Record notification in workflow
            workflow.addNotification('reminder', 'email', currentApproval.assignedTo, `reminder_${Date.now()}`);
            workflow.timing.remindersSent++;
            workflow.timing.lastReminderAt = new Date();
            await workflow.save();

            this.stats.sentReminders++;
            console.log(`Reminder sent to ${approver.email} for workflow ${workflow.workflowId}`);

        } catch (error) {
            console.error(`Failed to send reminder for workflow ${workflow.workflowId}:`, error);
            this.stats.errors++;
        }
    }

    /**
     * Send timeout warning
     */
    async sendTimeoutWarning(workflow, currentApproval) {
        try {
            const approver = await User.findById(currentApproval.assignedTo);
            if (!approver || !approver.email) {
                return;
            }

            await notificationService.sendReminder({
                workflowId: workflow.workflowId,
                recipient: approver.email,
                reminderType: 'timeout_warning',
                metadata: {
                    workflowId: workflow.workflowId,
                    bypassId: workflow.bypassAuditId.bypassId,
                    timeoutAt: workflow.timing.timeoutAt,
                    urgency: 'high'
                }
            });

            // Record notification in workflow
            workflow.addNotification('timeout_warning', 'email', currentApproval.assignedTo, `warning_${Date.now()}`);
            await workflow.save();

            console.log(`Timeout warning sent to ${approver.email} for workflow ${workflow.workflowId}`);

        } catch (error) {
            console.error(`Failed to send timeout warning for workflow ${workflow.workflowId}:`, error);
            this.stats.errors++;
        }
    }

    /**
     * Send timeout notification
     */
    async sendTimeoutNotification(workflow) {
        try {
            const initiator = workflow.initiatedBy;
            if (!initiator || !initiator.email) {
                return;
            }

            await notificationService.sendNotification({
                type: 'email',
                recipient: initiator.email,
                subject: 'Bypass Approval Request Timed Out',
                message: `Your bypass approval request has timed out and been expired.
                  Workflow ID: ${workflow.workflowId}
                  Reason: ${workflow.bypassAuditId.reason.description}
                  
                  Please contact your supervisor if this bypass is still required.`,
                metadata: {
                    workflowId: workflow.workflowId,
                    bypassId: workflow.bypassAuditId.bypassId,
                    status: 'expired'
                }
            });

            // Record notification in workflow
            workflow.addNotification('timeout', 'email', workflow.initiatedBy, `timeout_${Date.now()}`);
            await workflow.save();

            console.log(`Timeout notification sent to ${initiator.email} for workflow ${workflow.workflowId}`);

        } catch (error) {
            console.error(`Failed to send timeout notification for workflow ${workflow.workflowId}:`, error);
            this.stats.errors++;
        }
    }

    /**
     * Get job statistics
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            lastRun: this.lastRun
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            processedTimeouts: 0,
            sentReminders: 0,
            escalatedWorkflows: 0,
            errors: 0
        };
    }

    /**
     * Stop the job
     */
    stop() {
        console.log('Approval Timeout Job stopped');
    }
}

// Create and export singleton instance
const approvalTimeoutJob = new ApprovalTimeoutJob();

export default approvalTimeoutJob;
