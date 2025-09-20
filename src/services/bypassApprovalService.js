import BypassApprovalWorkflow from '../models/BypassApprovalWorkflow.js';
import AdminBypassAudit from '../models/AdminBypassAudit.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import bypassFinancialService from './bypassFinancialService.js';
import workflowAutomationService from './workflowAutomationService.js';
import {
    sendNotification
} from './notificationService.js';

class BypassApprovalService {
    constructor() {
        this.approvalRules = this.initializeApprovalRules();
    }

    /**
     * Initialize approval rules configuration
     */
    initializeApprovalRules() {
        return {
            // Risk score thresholds
            riskScore: {
                high: {
                    threshold: 60,
                    requiredApprovals: 1,
                    roles: ['manager']
                },
                critical: {
                    threshold: 80,
                    requiredApprovals: 2,
                    roles: ['manager', 'director']
                }
            },

            // Financial impact thresholds
            financialImpact: {
                medium: {
                    threshold: 1000,
                    requiredApprovals: 1,
                    roles: ['manager']
                },
                high: {
                    threshold: 5000,
                    requiredApprovals: 2,
                    roles: ['manager', 'director']
                },
                critical: {
                    threshold: 10000,
                    requiredApprovals: 3,
                    roles: ['manager', 'director', 'owner']
                }
            },

            // Reason category requirements
            reasonCategory: {
                'management_override': {
                    requiredApprovals: 2,
                    roles: ['manager', 'director']
                },
                'compliance_requirement': {
                    requiredApprovals: 1,
                    roles: ['manager']
                },
                'other': {
                    requiredApprovals: 2,
                    roles: ['manager', 'supervisor']
                }
            },

            // Time-based rules
            timing: {
                afterHours: {
                    requiredApprovals: 1,
                    roles: ['manager']
                },
                weekend: {
                    requiredApprovals: 1,
                    roles: ['manager']
                },
                night: {
                    requiredApprovals: 2,
                    roles: ['manager', 'director']
                }
            },

            // Security flag rules
            securityFlags: {
                critical: {
                    requiredApprovals: 2,
                    roles: ['manager', 'director']
                },
                multiple_warnings: {
                    requiredApprovals: 1,
                    roles: ['manager']
                }
            },

            // Default timeout settings
            timeouts: {
                default: 60, // minutes
                urgent: 30,
                critical: 15,
                emergency: 5
            }
        };
    }

    /**
     * Determine if approval is required and create workflow
     */
    async evaluateApprovalRequirement(bypassAuditId) {
        const auditRecord = await AdminBypassAudit.findById(bypassAuditId)
            .populate('adminId', 'name email role')
            .populate('hotelId', 'name');

        if (!auditRecord) {
            throw new Error('Bypass audit record not found');
        }

        // Analyze approval requirements
        const approvalAnalysis = this.analyzeApprovalRequirements(auditRecord);

        // If no approval required, return null
        if (!approvalAnalysis.required) {
            return null;
        }

        // Create approval workflow
        const workflow = await this.createApprovalWorkflow(auditRecord, approvalAnalysis);

        // Send initial notifications
        await this.sendApprovalNotifications(workflow, 'approval_request');

        return workflow;
    }

    /**
     * Analyze what approvals are required based on bypass audit data
     */
    analyzeApprovalRequirements(auditRecord) {
        const analysis = {
            required: false,
            reasons: [],
            approvalLevels: [],
            timeoutMinutes: this.approvalRules.timeouts.default,
            urgencyLevel: 'normal',
            rules: []
        };

        const riskScore = auditRecord.securityMetadata.riskScore || 0;
        const financialImpact = auditRecord.financialImpact.estimatedLoss || 0;
        const reasonCategory = auditRecord.reason.category;
        const urgencyLevel = auditRecord.reason.urgencyLevel;
        const securityFlags = auditRecord.securityMetadata.securityFlags || [];
        const isAfterHours = !auditRecord.analytics.businessHours;
        const isWeekend = ['Saturday', 'Sunday'].includes(auditRecord.analytics.weekday);

        // Rule 1: High risk score
        if (riskScore >= this.approvalRules.riskScore.critical.threshold) {
            analysis.required = true;
            analysis.reasons.push('Critical risk score');
            analysis.rules.push({
                rule: 'high_risk_score',
                threshold: this.approvalRules.riskScore.critical.threshold,
                actualValue: riskScore,
                priority: 1
            });

            // Add multiple approval levels for critical risk
            this.approvalRules.riskScore.critical.roles.forEach((role, index) => {
                analysis.approvalLevels.push({
                    level: index + 1,
                    requiredRole: role,
                    timeoutMinutes: urgencyLevel === 'critical' ? 15 : 30
                });
            });
        } else if (riskScore >= this.approvalRules.riskScore.high.threshold) {
            analysis.required = true;
            analysis.reasons.push('High risk score');
            analysis.rules.push({
                rule: 'high_risk_score',
                threshold: this.approvalRules.riskScore.high.threshold,
                actualValue: riskScore,
                priority: 2
            });

            analysis.approvalLevels.push({
                level: 1,
                requiredRole: 'manager',
                timeoutMinutes: urgencyLevel === 'critical' ? 15 : 60
            });
        }

        // Rule 2: Financial impact
        if (financialImpact >= this.approvalRules.financialImpact.critical.threshold) {
            analysis.required = true;
            analysis.reasons.push('Critical financial impact');
            analysis.rules.push({
                rule: 'high_financial_impact',
                threshold: this.approvalRules.financialImpact.critical.threshold,
                actualValue: financialImpact,
                priority: 1
            });

            // Ensure we have enough approval levels for critical financial impact
            const criticalRoles = this.approvalRules.financialImpact.critical.roles;
            criticalRoles.forEach((role, index) => {
                if (!analysis.approvalLevels.find(level => level.requiredRole === role)) {
                    analysis.approvalLevels.push({
                        level: analysis.approvalLevels.length + 1,
                        requiredRole: role,
                        timeoutMinutes: 30
                    });
                }
            });
        } else if (financialImpact >= this.approvalRules.financialImpact.high.threshold) {
            analysis.required = true;
            analysis.reasons.push('High financial impact');
            analysis.rules.push({
                rule: 'high_financial_impact',
                threshold: this.approvalRules.financialImpact.high.threshold,
                actualValue: financialImpact,
                priority: 2
            });

            if (!analysis.approvalLevels.find(level => level.requiredRole === 'manager')) {
                analysis.approvalLevels.push({
                    level: analysis.approvalLevels.length + 1,
                    requiredRole: 'manager',
                    timeoutMinutes: 60
                });
            }
        } else if (financialImpact >= this.approvalRules.financialImpact.medium.threshold) {
            analysis.required = true;
            analysis.reasons.push('Moderate financial impact');
            analysis.rules.push({
                rule: 'high_financial_impact',
                threshold: this.approvalRules.financialImpact.medium.threshold,
                actualValue: financialImpact,
                priority: 3
            });

            if (!analysis.approvalLevels.find(level => level.requiredRole === 'manager')) {
                analysis.approvalLevels.push({
                    level: analysis.approvalLevels.length + 1,
                    requiredRole: 'manager',
                    timeoutMinutes: 90
                });
            }
        }

        // Rule 3: Reason category requirements
        if (this.approvalRules.reasonCategory[reasonCategory]) {
            analysis.required = true;
            analysis.reasons.push(`Reason category: ${reasonCategory}`);
            analysis.rules.push({
                rule: 'reason_category_requirement',
                threshold: reasonCategory,
                actualValue: reasonCategory,
                priority: 2
            });

            const categoryRule = this.approvalRules.reasonCategory[reasonCategory];
            categoryRule.roles.forEach((role, index) => {
                if (!analysis.approvalLevels.find(level => level.requiredRole === role)) {
                    analysis.approvalLevels.push({
                        level: analysis.approvalLevels.length + 1,
                        requiredRole: role,
                        timeoutMinutes: 60
                    });
                }
            });
        }

        // Rule 4: After hours operations
        if (isAfterHours || isWeekend) {
            analysis.required = true;
            analysis.reasons.push('After hours operation');
            analysis.rules.push({
                rule: 'after_hours_operation',
                threshold: 'business_hours',
                actualValue: isAfterHours ? 'after_hours' : 'weekend',
                priority: 3
            });

            if (!analysis.approvalLevels.find(level => level.requiredRole === 'manager')) {
                analysis.approvalLevels.push({
                    level: analysis.approvalLevels.length + 1,
                    requiredRole: 'manager',
                    timeoutMinutes: 120 // Longer timeout for after hours
                });
            }
        }

        // Rule 5: Critical security flags
        const criticalFlags = securityFlags.filter(flag => flag.severity === 'critical');
        if (criticalFlags.length > 0) {
            analysis.required = true;
            analysis.reasons.push('Critical security flags detected');
            analysis.rules.push({
                rule: 'critical_security_flags',
                threshold: 1,
                actualValue: criticalFlags.length,
                priority: 1
            });

            if (!analysis.approvalLevels.find(level => level.requiredRole === 'manager')) {
                analysis.approvalLevels.push({
                    level: analysis.approvalLevels.length + 1,
                    requiredRole: 'manager',
                    timeoutMinutes: 30
                });
            }
        }

        // Rule 6: Multiple warning flags
        const warningFlags = securityFlags.filter(flag => flag.severity === 'warning');
        if (warningFlags.length >= 3) {
            analysis.required = true;
            analysis.reasons.push('Multiple security warnings');
            analysis.rules.push({
                rule: 'multiple_security_warnings',
                threshold: 3,
                actualValue: warningFlags.length,
                priority: 2
            });

            if (!analysis.approvalLevels.find(level => level.requiredRole === 'manager')) {
                analysis.approvalLevels.push({
                    level: analysis.approvalLevels.length + 1,
                    requiredRole: 'manager',
                    timeoutMinutes: 60
                });
            }
        }

        // Set urgency and timeout based on analysis
        if (urgencyLevel === 'critical' || analysis.rules.some(r => r.priority === 1)) {
            analysis.urgencyLevel = 'critical';
            analysis.timeoutMinutes = this.approvalRules.timeouts.critical;
        } else if (urgencyLevel === 'high' || analysis.rules.some(r => r.priority === 2)) {
            analysis.urgencyLevel = 'urgent';
            analysis.timeoutMinutes = this.approvalRules.timeouts.urgent;
        }

        // Sort approval levels by required role hierarchy
        analysis.approvalLevels.sort((a, b) => {
            const roleHierarchy = {
                'manager': 1,
                'supervisor': 2,
                'director': 3,
                'owner': 4
            };
            return (roleHierarchy[a.requiredRole] || 0) - (roleHierarchy[b.requiredRole] || 0);
        });

        // Re-number levels after sorting
        analysis.approvalLevels.forEach((level, index) => {
            level.level = index + 1;
        });

        return analysis;
    }

    /**
     * Create approval workflow
     */
    async createApprovalWorkflow(auditRecord, approvalAnalysis) {
        const workflowData = {
            hotelId: auditRecord.hotelId,
            bypassAuditId: auditRecord._id,
            initiatedBy: auditRecord.adminId,
            approvalRules: {
                triggeredBy: approvalAnalysis.rules,
                requiredApprovals: approvalAnalysis.approvalLevels.length,
                timeoutMinutes: approvalAnalysis.timeoutMinutes,
                escalationEnabled: true
            },
            approvalLevels: approvalAnalysis.approvalLevels,
            escalation: {
                enabled: true,
                timeoutMinutes: approvalAnalysis.timeoutMinutes,
                maxEscalationLevel: 3,
                finalEscalationAction: 'manual_review'
            }
        };

        const workflow = await BypassApprovalWorkflow.createWorkflow(workflowData);

        // Assign approvers to each level
        for (const level of approvalAnalysis.approvalLevels) {
            const approver = await this.findApprover(auditRecord.hotelId, level.requiredRole);
            if (approver) {
                workflow.assignApprover(level.level, approver._id);
            }
        }

        await workflow.save();

        // Update the bypass audit record to link to workflow
        auditRecord.operationStatus.status = 'pending_approval';
        await auditRecord.save();

        // Log workflow creation
        await AuditLog.logChange({
            hotelId: auditRecord.hotelId,
            tableName: 'BypassApprovalWorkflow',
            recordId: workflow._id,
            changeType: 'workflow_created',
            userId: auditRecord.adminId,
            source: 'bypass_approval_service',
            newValues: {
                workflowId: workflow.workflowId,
                requiredApprovals: approvalAnalysis.approvalLevels.length,
                reasons: approvalAnalysis.reasons
            },
            metadata: {
                urgencyLevel: approvalAnalysis.urgencyLevel,
                timeoutMinutes: approvalAnalysis.timeoutMinutes,
                tags: ['approval_workflow', 'bypass_operation']
            }
        });

        return workflow;
    }

    /**
     * Find an appropriate approver for a given role
     */
    async findApprover(hotelId, requiredRole) {
        // Find users with the required role in the hotel
        const approvers = await User.find({
            hotelId,
            role: {
                $in: [requiredRole, 'admin']
            }, // Admin can approve any level
            status: 'active'
        }).sort({
            lastLogin: -1
        }); // Prefer recently active users

        if (approvers.length === 0) {
            // Fallback to admin role if no specific role found
            const adminApprovers = await User.find({
                hotelId,
                role: 'admin',
                status: 'active'
            }).sort({
                lastLogin: -1
            });

            return adminApprovers[0] || null;
        }

        // Return the most recently active approver
        return approvers[0];
    }

    /**
     * Process an approval response
     */
    async processApproval(workflowId, approverId, action, notes, ipAddress, userAgent) {
        const workflow = await BypassApprovalWorkflow.findOne({
                workflowId
            })
            .populate('bypassAuditId')
            .populate('initiatedBy', 'name email');

        if (!workflow) {
            throw new Error('Approval workflow not found');
        }

        // Verify approver is authorized for current level
        const currentApproval = workflow.approvalChain.find(a => a.level === workflow.currentLevel);
        if (!currentApproval || currentApproval.assignedTo.toString() !== approverId.toString()) {
            throw new Error('Unauthorized to approve this request');
        }

        // Process the approval
        workflow.processApproval(
            workflow.currentLevel,
            approverId,
            action, // 'approved' or 'rejected'
            notes,
            'web',
            ipAddress,
            userAgent
        );

        await workflow.save();

        // Update bypass audit status
        const auditRecord = workflow.bypassAuditId;
        if (workflow.workflowStatus === 'approved') {
            auditRecord.operationStatus.status = 'approved';

            // Create financial impact tracking for approved bypasses
            try {
                await bypassFinancialService.createFinancialImpact(auditRecord._id, {
                    approvalWorkflowId: workflow._id
                });
                console.log(`Financial impact tracking created for approved bypass: ${auditRecord.bypassId}`);
            } catch (error) {
                console.error('Failed to create financial impact tracking:', error);
                // Don't fail the approval process if financial tracking fails
            }

            // Trigger workflow automation for post-approval processing
            try {
                const automationResult = await workflowAutomationService.processAutomatedBypass(auditRecord._id);
                if (automationResult.automated) {
                    console.log(`Post-approval automation completed for bypass: ${auditRecord.bypassId}`);
                }
            } catch (error) {
                console.error('Post-approval automation failed:', error);
                // Don't fail the approval process if automation fails
            }
        } else if (workflow.workflowStatus === 'rejected') {
            auditRecord.operationStatus.status = 'failed';
        }
        await auditRecord.save();

        // Send notifications based on workflow status
        if (workflow.workflowStatus === 'approved') {
            await this.sendApprovalNotifications(workflow, 'approval_completed');
        } else if (workflow.workflowStatus === 'rejected') {
            await this.sendApprovalNotifications(workflow, 'approval_rejected');
        } else {
            // Workflow continues, notify next approver
            await this.sendApprovalNotifications(workflow, 'approval_request');
        }

        return workflow;
    }

    /**
     * Handle workflow timeouts and escalations
     */
    async processTimeouts() {
        const expiredWorkflows = await BypassApprovalWorkflow.getExpiredWorkflows();

        for (const workflow of expiredWorkflows) {
            if (workflow.canEscalate()) {
                await this.escalateWorkflow(workflow._id, 'timeout');
            } else {
                // Mark as expired
                workflow.workflowStatus = 'expired';
                workflow.timing.completedAt = new Date();

                // Update current approval to expired
                const currentApproval = workflow.approvalChain.find(a => a.level === workflow.currentLevel);
                if (currentApproval) {
                    currentApproval.status = 'expired';
                }

                await workflow.save();

                // Update bypass audit
                const auditRecord = await AdminBypassAudit.findById(workflow.bypassAuditId);
                if (auditRecord) {
                    auditRecord.operationStatus.status = 'failed';
                    auditRecord.operationStatus.errorDetails = {
                        code: 'APPROVAL_TIMEOUT',
                        message: 'Approval workflow expired due to timeout',
                        recoverable: true
                    };
                    await auditRecord.save();
                }

                // Send timeout notifications
                await this.sendApprovalNotifications(workflow, 'approval_timeout');
            }
        }
    }

    /**
     * Escalate a workflow
     */
    async escalateWorkflow(workflowId, reason = 'manual') {
        const workflow = await BypassApprovalWorkflow.findById(workflowId);
        if (!workflow) {
            throw new Error('Workflow not found');
        }

        workflow.escalateWorkflow(reason);

        // Find escalation approver
        const escalationLevel = workflow.escalation.currentEscalationLevel;
        const escalationConfig = workflow.escalation.escalationChain[escalationLevel - 1];

        if (escalationConfig) {
            let escalationApprover;

            if (escalationConfig.escalateTo) {
                escalationApprover = await User.findById(escalationConfig.escalateTo);
            } else if (escalationConfig.escalateToRole) {
                escalationApprover = await this.findApprover(workflow.hotelId, escalationConfig.escalateToRole);
            }

            if (escalationApprover) {
                // Assign escalation approver to current level
                workflow.assignApprover(workflow.currentLevel, escalationApprover._id);

                // Reset timeout for escalation
                const timeoutMinutes = escalationConfig.timeoutMinutes || 30;
                workflow.timing.timeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);
            }
        }

        await workflow.save();

        // Send escalation notifications
        await this.sendApprovalNotifications(workflow, 'approval_escalated');

        return workflow;
    }

    /**
     * Delegate an approval to another user
     */
    async delegateApproval(workflowId, fromApproverId, toApproverId, delegationReason) {
        const workflow = await BypassApprovalWorkflow.findById(workflowId);
        if (!workflow) {
            throw new Error('Workflow not found');
        }

        // Verify the delegator is the current approver
        const currentApproval = workflow.approvalChain.find(a => a.level === workflow.currentLevel);
        if (!currentApproval || currentApproval.assignedTo.toString() !== fromApproverId.toString()) {
            throw new Error('Unauthorized to delegate this approval');
        }

        // Verify the delegate exists and is active
        const delegate = await User.findById(toApproverId);
        if (!delegate || delegate.status !== 'active') {
            throw new Error('Invalid delegate user');
        }

        workflow.delegateApproval(workflow.currentLevel, toApproverId, delegationReason);
        await workflow.save();

        // Send delegation notifications
        await this.sendApprovalNotifications(workflow, 'approval_delegated');

        return workflow;
    }

    /**
     * Send approval notifications
     */
    async sendApprovalNotifications(workflow, notificationType) {
        try {
            const auditRecord = await AdminBypassAudit.findById(workflow.bypassAuditId)
                .populate('adminId', 'name email');

            let recipients = [];
            let message = '';
            let subject = '';

            switch (notificationType) {
                case 'approval_request':
                    const currentApproval = workflow.approvalChain.find(a => a.level === workflow.currentLevel);
                    if (currentApproval && currentApproval.assignedTo) {
                        recipients = [currentApproval.assignedTo];
                        subject = 'Bypass Approval Required';
                        message = `A bypass checkout operation requires your approval. 
                      Initiated by: ${auditRecord.adminId.name}
                      Reason: ${auditRecord.reason.description}
                      Risk Score: ${auditRecord.securityMetadata.riskScore}
                      Workflow ID: ${workflow.workflowId}`;
                    }
                    break;

                case 'approval_completed':
                    recipients = [workflow.initiatedBy];
                    subject = 'Bypass Approval Completed';
                    message = `Your bypass checkout request has been approved.
                    Workflow ID: ${workflow.workflowId}`;
                    break;

                case 'approval_rejected':
                    recipients = [workflow.initiatedBy];
                    subject = 'Bypass Approval Rejected';
                    message = `Your bypass checkout request has been rejected.
                    Workflow ID: ${workflow.workflowId}`;
                    break;

                case 'approval_escalated':
                    const escalatedApproval = workflow.approvalChain.find(a => a.level === workflow.currentLevel);
                    if (escalatedApproval && escalatedApproval.assignedTo) {
                        recipients = [escalatedApproval.assignedTo];
                        subject = 'Escalated Bypass Approval Required';
                        message = `An escalated bypass approval requires your immediate attention.
                      Workflow ID: ${workflow.workflowId}
                      Escalation Level: ${workflow.escalation.currentEscalationLevel}`;
                    }
                    break;

                case 'approval_timeout':
                    recipients = [workflow.initiatedBy];
                    subject = 'Bypass Approval Timeout';
                    message = `Your bypass checkout approval request has timed out.
                    Workflow ID: ${workflow.workflowId}`;
                    break;

                case 'approval_delegated':
                    const delegatedApproval = workflow.approvalChain.find(a => a.level === workflow.currentLevel);
                    if (delegatedApproval && delegatedApproval.assignedTo) {
                        recipients = [delegatedApproval.assignedTo];
                        subject = 'Delegated Bypass Approval';
                        message = `A bypass approval has been delegated to you.
                      Workflow ID: ${workflow.workflowId}`;
                    }
                    break;
            }

            // Send notifications to recipients
            for (const recipientId of recipients) {
                const recipient = await User.findById(recipientId);
                if (recipient && recipient.email) {
                    // Record notification in workflow
                    workflow.addNotification(notificationType, 'email', recipientId, `email_${Date.now()}`);

                    // Send actual notification (implement based on your notification system)
                    await sendNotification({
                        type: 'email',
                        recipient: recipient.email,
                        subject,
                        message,
                        metadata: {
                            workflowId: workflow.workflowId,
                            notificationType,
                            urgency: workflow.analytics.urgencyLevel || 'normal'
                        }
                    });
                }
            }

            await workflow.save();
        } catch (error) {
            console.error('Failed to send approval notifications:', error);
        }
    }

    /**
     * Get pending approvals for a user
     */
    async getPendingApprovalsForUser(userId, hotelId) {
        return await BypassApprovalWorkflow.getPendingApprovals(userId, hotelId);
    }

    /**
     * Get workflow statistics
     */
    async getWorkflowStatistics(hotelId, timeRange = 30) {
        return await BypassApprovalWorkflow.getWorkflowStatistics(hotelId, timeRange);
    }

    /**
     * Auto-approve low-risk bypasses (if configured)
     */
    async checkAutoApproval(auditRecord) {
        const riskScore = auditRecord.securityMetadata.riskScore || 0;
        const financialImpact = auditRecord.financialImpact.estimatedLoss || 0;
        const criticalFlags = auditRecord.securityMetadata.securityFlags.filter(f => f.severity === 'critical');

        // Auto-approve only very low risk operations
        if (riskScore < 20 && financialImpact < 100 && criticalFlags.length === 0) {
            auditRecord.operationStatus.status = 'approved';
            auditRecord.approvalChain = [{
                approvalLevel: 1,
                status: 'approved',
                autoApproved: true,
                autoApprovalReason: 'Low risk automatic approval',
                requestedAt: new Date(),
                respondedAt: new Date()
            }];

            await auditRecord.save();
            return true;
        }

        return false;
    }
}

export default new BypassApprovalService();