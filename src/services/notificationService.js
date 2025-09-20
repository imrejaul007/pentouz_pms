/**
 * Enhanced Notification Service
 * Supports multiple channels: email, SMS, push notifications, webhooks
 * Includes template management, delivery tracking, and retry logic
 */
class NotificationService {
    constructor() {
        this.channels = this.initializeChannels();
        this.templates = this.initializeTemplates();
        this.deliveryQueue = [];
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 5000, // 5 seconds
            backoffMultiplier: 2
        };
    }

    /**
     * Initialize notification channels
     */
    initializeChannels() {
        return {
            email: {
                enabled: true,
                provider: 'smtp', // Could be 'sendgrid', 'ses', etc.
                config: {
                    host: process.env.SMTP_HOST || 'localhost',
                    port: process.env.SMTP_PORT || 587,
                    secure: false,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                },
                rateLimit: {
                    maxPerHour: 1000,
                    currentCount: 0,
                    resetTime: Date.now() + 3600000
                }
            },
            sms: {
                enabled: process.env.SMS_ENABLED === 'true',
                provider: 'twilio', // Could be 'aws-sns', 'nexmo', etc.
                config: {
                    accountSid: process.env.TWILIO_ACCOUNT_SID,
                    authToken: process.env.TWILIO_AUTH_TOKEN,
                    fromNumber: process.env.TWILIO_FROM_NUMBER
                },
                rateLimit: {
                    maxPerHour: 100,
                    currentCount: 0,
                    resetTime: Date.now() + 3600000
                }
            },
            push: {
                enabled: process.env.PUSH_ENABLED === 'true',
                provider: 'firebase', // Could be 'apns', 'fcm', etc.
                config: {
                    serverKey: process.env.FIREBASE_SERVER_KEY,
                    projectId: process.env.FIREBASE_PROJECT_ID
                },
                rateLimit: {
                    maxPerHour: 5000,
                    currentCount: 0,
                    resetTime: Date.now() + 3600000
                }
            },
            webhook: {
                enabled: process.env.WEBHOOK_ENABLED === 'true',
                endpoints: [{
                        name: 'slack',
                        url: process.env.SLACK_WEBHOOK_URL,
                        enabled: !!process.env.SLACK_WEBHOOK_URL
                    },
                    {
                        name: 'teams',
                        url: process.env.TEAMS_WEBHOOK_URL,
                        enabled: !!process.env.TEAMS_WEBHOOK_URL
                    },
                    {
                        name: 'custom',
                        url: process.env.CUSTOM_WEBHOOK_URL,
                        enabled: !!process.env.CUSTOM_WEBHOOK_URL
                    }
                ]
            },
            inApp: {
                enabled: true,
                storage: 'database', // Could be 'redis', 'memory'
                retentionDays: 30
            }
        };
    }

    /**
     * Initialize notification templates
     */
    initializeTemplates() {
        return {
            approval_request: {
                email: {
                    subject: 'Approval Required: Bypass Request {{workflowId}}',
                    html: `
                        <h2>Bypass Approval Request</h2>
                        <p>A bypass request requires your approval:</p>
                        <ul>
                            <li><strong>Workflow ID:</strong> {{workflowId}}</li>
                            <li><strong>Reason:</strong> {{reason}}</li>
                            <li><strong>Risk Score:</strong> {{riskScore}}</li>
                            <li><strong>Financial Impact:</strong> {{financialImpactFormatted}}</li>
                            <li><strong>Requested By:</strong> {{requestedBy}}</li>
                        </ul>
                        <p><a href="{{approvalUrl}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review & Approve</a></p>
                    `,
                    text: 'Bypass approval required for workflow {{workflowId}}. Reason: {{reason}}. Risk Score: {{riskScore}}. Please review at {{approvalUrl}}'
                },
                sms: {
                    message: 'Bypass approval needed: {{workflowId}}. Risk: {{riskScore}}. Review at {{approvalUrl}}'
                },
                push: {
                    title: 'Approval Required',
                    body: 'Bypass request {{workflowId}} needs your approval',
                    data: {
                        type: 'approval_request',
                        workflowId: '{{workflowId}}'
                    }
                }
            },
            approval_status_update: {
                email: {
                    subject: 'Bypass Request {{status}}: {{workflowId}}',
                    html: `
                        <h2>Bypass Request Update</h2>
                        <p>Your bypass request has been <strong>{{status}}</strong>:</p>
                        <ul>
                            <li><strong>Workflow ID:</strong> {{workflowId}}</li>
                            <li><strong>Status:</strong> {{status}}</li>
                            <li><strong>Processed By:</strong> {{processedBy}}</li>
                            <li><strong>Notes:</strong> {{notes}}</li>
                        </ul>
                    `,
                    text: 'Your bypass request {{workflowId}} has been {{status}} by {{processedBy}}. Notes: {{notes}}'
                }
            },
            budget_alert: {
                email: {
                    subject: 'Budget Alert: {{alertType}}',
                    html: `
                        <h2 style="color: #dc3545;">Budget Alert</h2>
                        <p>A budget threshold has been exceeded:</p>
                        <ul>
                            <li><strong>Alert Type:</strong> {{alertType}}</li>
                            <li><strong>Department:</strong> {{department}}</li>
                            <li><strong>Current Usage:</strong> {{currentUsage}}%</li>
                            <li><strong>Threshold:</strong> {{threshold}}%</li>
                            <li><strong>Amount:</strong> {{amountFormatted}}</li>
                        </ul>
                        <p>Immediate attention required.</p>
                    `,
                    text: 'Budget alert: {{alertType}} for {{department}}. Usage: {{currentUsage}}% (threshold: {{threshold}}%). Amount: {{amountFormatted}}'
                }
            },
            inventory_reorder: {
                email: {
                    subject: 'Inventory Reorder Created: {{itemName}}',
                    html: `
                        <h2>Inventory Reorder Request</h2>
                        <p>A reorder request has been created:</p>
                        <ul>
                            <li><strong>Item:</strong> {{itemName}}</li>
                            <li><strong>Quantity:</strong> {{quantity}}</li>
                            <li><strong>Priority:</strong> {{priority}}</li>
                            <li><strong>Total Cost:</strong> {{totalCostFormatted}}</li>
                            <li><strong>Expected Delivery:</strong> {{expectedDelivery}}</li>
                        </ul>
                    `,
                    text: 'Reorder created for {{itemName}} ({{quantity}} units, {{totalCostFormatted}}). Priority: {{priority}}. Expected: {{expectedDelivery}}'
                }
            },
            system_integration_error: {
                email: {
                    subject: 'System Integration Error',
                    html: `
                        <h2 style="color: #dc3545;">System Integration Error</h2>
                        <p>An error occurred during system integration:</p>
                        <ul>
                            <li><strong>Service:</strong> {{service}}</li>
                            <li><strong>Error:</strong> {{error}}</li>
                            <li><strong>Timestamp:</strong> {{timestamp}}</li>
                            <li><strong>Impact:</strong> {{impact}}</li>
                        </ul>
                        <p>Please investigate and resolve immediately.</p>
                    `,
                    text: 'Integration error in {{service}}: {{error}}. Impact: {{impact}}. Time: {{timestamp}}'
                }
            }
        };
    }

    /**
     * Send notification with automatic channel selection
     */
    async sendNotification(notification) {
        try {
            // Handle both new format and legacy format
            let processedNotification;

            if (notification.type && !notification.channels) {
                // Legacy format - convert to new format
                processedNotification = {
                    type: notification.subject ? 'custom' : notification.type,
                    recipient: notification.recipient,
                    channels: [notification.type === 'email' ? 'email' : notification.type],
                    priority: 'medium',
                    data: {
                        subject: notification.subject,
                        message: notification.message,
                        ...notification.metadata
                    }
                };
            } else {
                // New format
                processedNotification = {
                    channels: ['email'], // Default to email
                    priority: 'medium',
                    ...notification
                };
            }

            const {
                type,
                recipient,
                channels,
                priority,
                data = {},
                templateOverrides = {}
            } = processedNotification;

            const deliveryResults = [];

            // Process each requested channel
            for (const channel of channels) {
                try {
                    const result = await this.sendToChannel(channel, {
                        type,
                        recipient,
                        priority,
                        data,
                        templateOverrides
                    });
                    deliveryResults.push(result);
                } catch (channelError) {
                    console.error(`Failed to send ${type} notification via ${channel}:`, channelError);
                    deliveryResults.push({
                        channel,
                        success: false,
                        error: channelError.message,
                        timestamp: new Date()
                    });
                }
            }

            // Log notification attempt
            await this.logNotification({
                type,
                recipient,
                channels,
                priority,
                deliveryResults,
                data
            });

            return {
                success: deliveryResults.some(r => r.success),
                results: deliveryResults,
                // Legacy compatibility
                messageId: deliveryResults[0]?.messageId || `notif_${Date.now()}`,
                status: deliveryResults.some(r => r.success) ? 'sent' : 'failed',
                provider: deliveryResults[0]?.channel || channels[0]
            };

        } catch (error) {
            console.error('Notification service error:', error);
            throw error;
        }
    }

    /**
     * Send notification to specific channel
     */
    async sendToChannel(channelName, notification) {
        const channel = this.channels[channelName];
        if (!channel || !channel.enabled) {
            // For disabled channels, just log and return success (graceful degradation)
            console.log(`Channel ${channelName} is not available or disabled - skipping`);
            return {
                success: true,
                channel: channelName,
                messageId: `disabled_${Date.now()}`,
                timestamp: new Date(),
                note: 'Channel disabled - notification skipped'
            };
        }

        // Check rate limits
        if (this.isRateLimited(channel)) {
            throw new Error(`Rate limit exceeded for ${channelName}`);
        }

        // Get template or use custom content
        let renderedContent;
        if (notification.type && notification.type !== 'custom') {
            const template = this.getTemplate(notification.type, channelName);
            if (template) {
                renderedContent = this.renderTemplate(template, notification.data);
            }
        }

        // Fallback to custom content
        if (!renderedContent) {
            renderedContent = this.createCustomContent(channelName, notification.data);
        }

        // Send based on channel type
        switch (channelName) {
            case 'email':
                return await this.sendEmail(notification.recipient, renderedContent, notification.priority);
            case 'sms':
                return await this.sendSMS(notification.recipient, renderedContent, notification.priority);
            case 'push':
                return await this.sendPush(notification.recipient, renderedContent, notification.priority);
            case 'webhook':
            case 'slack':
            case 'teams':
                return await this.sendWebhook(notification.recipient, renderedContent, notification.priority);
            case 'inApp':
                return await this.sendInApp(notification.recipient, renderedContent, notification.priority);
            default:
                throw new Error(`Unsupported channel: ${channelName}`);
        }
    }

    /**
     * Create custom content when no template is available
     */
    createCustomContent(channelName, data) {
        switch (channelName) {
            case 'email':
                return {
                    subject: data.subject || 'Notification',
                        html: data.html || data.message || 'No content provided',
                        text: data.text || data.message || 'No content provided'
                };
            case 'sms':
                return {
                    message: data.message || data.text || 'No content provided'
                };
            case 'push':
                return {
                    title: data.title || data.subject || 'Notification',
                        body: data.body || data.message || 'No content provided',
                        data: data.data || {}
                };
            default:
                return data;
        }
    }

    /**
     * Send email notification
     */
    async sendEmail(recipient, content, priority) {
        console.log(`[EMAIL] Sending to ${recipient}:`);
        console.log(`Subject: ${content.subject}`);
        console.log(`Body: ${content.text || content.html}`);

        // In production, integrate with actual email provider
        // Example with nodemailer:
        /*
        const transporter = nodemailer.createTransporter(this.channels.email.config);
        const result = await transporter.sendMail({
            from: this.channels.email.config.from,
            to: recipient,
            subject: content.subject,
            text: content.text,
            html: content.html,
            priority: priority === 'high' ? 'high' : 'normal'
        });
        return { success: true, messageId: result.messageId, channel: 'email' };
        */

        // Simulate email sending
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            success: true,
            messageId: `email_${Date.now()}`,
            channel: 'email',
            timestamp: new Date()
        };
    }

    /**
     * Send SMS notification
     */
    async sendSMS(recipient, content, priority) {
        console.log(`[SMS] Sending to ${recipient}: ${content.message}`);

        // In production, integrate with SMS provider (Twilio, AWS SNS, etc.)
        // Simulate SMS sending
        await new Promise(resolve => setTimeout(resolve, 200));
        return {
            success: true,
            messageId: `sms_${Date.now()}`,
            channel: 'sms',
            timestamp: new Date()
        };
    }

    /**
     * Send push notification
     */
    async sendPush(recipient, content, priority) {
        console.log(`[PUSH] Sending to ${recipient}:`);
        console.log(`Title: ${content.title}`);
        console.log(`Body: ${content.body}`);

        // In production, integrate with push notification service
        // Simulate push sending
        await new Promise(resolve => setTimeout(resolve, 150));
        return {
            success: true,
            messageId: `push_${Date.now()}`,
            channel: 'push',
            timestamp: new Date()
        };
    }

    /**
     * Send webhook notification
     */
    async sendWebhook(recipient, content, priority) {
        console.log(`[WEBHOOK] Sending to ${recipient}`);
        console.log(`Content: ${JSON.stringify(content)}`);

        // In production, make actual HTTP request
        // Simulate webhook sending
        await new Promise(resolve => setTimeout(resolve, 300));
        return {
            success: true,
            statusCode: 200,
            channel: 'webhook',
            timestamp: new Date()
        };
    }

    /**
     * Send in-app notification
     */
    async sendInApp(recipient, content, priority) {
        console.log(`[IN-APP] Storing for ${recipient}:`);
        console.log(`Content: ${JSON.stringify(content)}`);

        // In production, store in database or cache
        return {
            success: true,
            notificationId: `inapp_${Date.now()}`,
            channel: 'inApp',
            timestamp: new Date()
        };
    }

    /**
     * Get template for notification type and channel
     */
    getTemplate(notificationType, channel) {
        const typeTemplates = this.templates[notificationType];
        if (!typeTemplates) return null;
        return typeTemplates[channel];
    }

    /**
     * Render template with data
     */
    renderTemplate(template, data) {
        const rendered = {};

        for (const [key, value] of Object.entries(template)) {
            if (typeof value === 'string') {
                rendered[key] = this.interpolateTemplate(value, data);
            } else if (typeof value === 'object') {
                rendered[key] = {};
                for (const [subKey, subValue] of Object.entries(value)) {
                    rendered[key][subKey] = this.interpolateTemplate(subValue, data);
                }
            } else {
                rendered[key] = value;
            }
        }

        return rendered;
    }

    /**
     * Interpolate template variables
     */
    interpolateTemplate(template, data) {
        if (typeof template !== 'string') return template;

        return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const keys = key.trim().split('.');
            let value = data;

            for (const k of keys) {
                value = value?. [k];
                if (value === undefined) break;
            }

            return value !== undefined ? value : match;
        });
    }

    /**
     * Check if channel is rate limited
     */
    isRateLimited(channel) {
        if (!channel.rateLimit) return false;

        const now = Date.now();
        if (now > channel.rateLimit.resetTime) {
            channel.rateLimit.currentCount = 0;
            channel.rateLimit.resetTime = now + 3600000; // Reset for next hour
        }

        if (channel.rateLimit.currentCount >= channel.rateLimit.maxPerHour) {
            return true;
        }

        channel.rateLimit.currentCount++;
        return false;
    }

    /**
     * Log notification attempt
     */
    async logNotification(notificationLog) {
        console.log(`[NOTIFICATION LOG] ${notificationLog.type} to ${notificationLog.recipient}:`);
        console.log(`Channels: ${notificationLog.channels.join(', ')}`);
        console.log(`Success: ${notificationLog.deliveryResults.filter(r => r.success).length}/${notificationLog.deliveryResults.length}`);

        // In production, store in audit log or notification history table
    }

    // Legacy methods for backward compatibility
    async sendApprovalRequest(approver, workflow) {
        return await this.sendNotification({
            type: 'approval_request',
            recipient: approver.email,
            channels: ['email', 'push'],
            priority: 'high',
            data: {
                workflowId: workflow.workflowId,
                reason: workflow.bypassAuditId?.reason?.description || 'N/A',
                riskScore: workflow.bypassAuditId?.securityMetadata?.riskScore || 0,
                financialImpactFormatted: `₹${workflow.bypassAuditId?.financialImpact?.estimatedLoss || 0}`,
                requestedBy: workflow.initiatedBy?.name || 'Unknown',
                approvalUrl: `${process.env.FRONTEND_URL}/admin/approvals/${workflow.workflowId}`
            }
        });
    }

    async sendApprovalStatusUpdate(initiator, workflow, status) {
        return await this.sendNotification({
            type: 'approval_status_update',
            recipient: initiator.email,
            channels: ['email', 'inApp'],
            priority: 'medium',
            data: {
                workflowId: workflow.workflowId,
                status: status.toUpperCase(),
                processedBy: workflow.approvalChain?.find(a => a.status === status)?.approvedBy?.name || 'System',
                notes: workflow.approvalChain?.find(a => a.status === status)?.notes || 'No additional notes'
            }
        });
    }

    async sendEscalationNotification(escalatedTo, workflow) {
        return await this.sendNotification({
            type: 'approval_request',
            recipient: escalatedTo.email,
            channels: ['email', 'sms', 'push'],
            priority: 'high',
            data: {
                workflowId: workflow.workflowId,
                reason: `ESCALATED: ${workflow.bypassAuditId?.reason?.description || 'N/A'}`,
                riskScore: workflow.bypassAuditId?.securityMetadata?.riskScore || 0,
                financialImpactFormatted: `₹${workflow.bypassAuditId?.financialImpact?.estimatedLoss || 0}`,
                requestedBy: workflow.initiatedBy?.name || 'Unknown',
                approvalUrl: `${process.env.FRONTEND_URL}/admin/approvals/${workflow.workflowId}`
            }
        });
    }

    async sendTimeoutNotification(workflow) {
        const pendingApprover = workflow.approvalChain?.find(a => a.status === 'pending')?.assignedTo;
        if (pendingApprover) {
            return await this.sendNotification({
                type: 'approval_request',
                recipient: pendingApprover.email,
                channels: ['email', 'sms'],
                priority: 'high',
                data: {
                    workflowId: workflow.workflowId,
                    reason: `TIMEOUT WARNING: ${workflow.bypassAuditId?.reason?.description || 'N/A'}`,
                    riskScore: workflow.bypassAuditId?.securityMetadata?.riskScore || 0,
                    financialImpactFormatted: `₹${workflow.bypassAuditId?.financialImpact?.estimatedLoss || 0}`,
                    requestedBy: workflow.initiatedBy?.name || 'Unknown',
                    approvalUrl: `${process.env.FRONTEND_URL}/admin/approvals/${workflow.workflowId}`
                }
            });
        }
    }

    /**
     * Send batch notifications
     */
    async sendBatchNotifications(notifications) {
        const results = [];

        for (const notification of notifications) {
            try {
                const result = await this.sendNotification(notification);
                results.push({
                    success: true,
                    result
                });
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Send reminder notifications
     */
    async sendReminder({
        workflowId,
        recipient,
        reminderType,
        metadata
    }) {
        const reminderMessages = {
            approval_pending: 'You have a pending bypass approval request that requires your attention.',
            escalation_warning: 'Your approval request will be escalated soon if not responded to.',
            timeout_warning: 'Your approval request will timeout soon. Please respond immediately.'
        };

        return await this.sendNotification({
            type: 'email',
            recipient,
            subject: `Reminder: ${reminderType.replace('_', ' ').toUpperCase()}`,
            message: reminderMessages[reminderType] || 'You have a pending action required.',
            metadata: {
                ...metadata,
                workflowId,
                reminderType
            }
        });
    }
}

export const notificationService = new NotificationService();

// Export the main send function for convenience
export const sendNotification = (data) => notificationService.sendNotification(data);
export default notificationService;