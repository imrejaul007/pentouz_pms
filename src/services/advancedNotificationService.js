import emailService from './emailService.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

class AdvancedNotificationService {
  constructor() {
    this.templates = new Map();
    this.providers = new Map();
    this.notificationQueue = [];
    this.deliveryLog = new Map();
    this.subscriptions = new Map(); // User preferences
    this.channels = {
      EMAIL: 'email',
      SMS: 'sms',
      PUSH: 'push',
      IN_APP: 'in_app',
      WEBHOOK: 'webhook',
      SLACK: 'slack'
    };
    
    this.initializeTemplates();
    this.initializeProviders();
    this.startQueueProcessor();
  }

  /**
   * Initialize notification templates
   */
  initializeTemplates() {
    // Booking templates
    this.addTemplate('booking_confirmation', {
      channels: ['email', 'sms', 'push', 'in_app'],
      priority: 'high',
      templates: {
        email: {
          subject: 'Booking Confirmed - {hotelName}',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2c5aa0;">Booking Confirmed!</h2>
              <p>Dear {guestName},</p>
              <p>Your booking at <strong>{hotelName}</strong> has been confirmed.</p>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Booking Details:</h3>
                <p><strong>Booking ID:</strong> {bookingId}</p>
                <p><strong>Check-in:</strong> {checkIn}</p>
                <p><strong>Check-out:</strong> {checkOut}</p>
                <p><strong>Room Type:</strong> {roomType}</p>
                <p><strong>Total Amount:</strong> {currency} {totalAmount}</p>
              </div>
              <p>We look forward to welcoming you!</p>
            </div>
          `
        },
        sms: {
          text: 'Booking confirmed at {hotelName}! Check-in: {checkIn}, Booking ID: {bookingId}. See you soon!'
        },
        push: {
          title: 'Booking Confirmed',
          body: 'Your stay at {hotelName} is confirmed for {checkIn}',
          data: { bookingId: '{bookingId}', type: 'booking_confirmation' }
        },
        in_app: {
          title: 'Booking Confirmed',
          message: 'Your booking at {hotelName} has been confirmed',
          actionUrl: '/bookings/{bookingId}'
        }
      }
    });

    this.addTemplate('booking_reminder', {
      channels: ['email', 'sms', 'push'],
      priority: 'medium',
      templates: {
        email: {
          subject: 'Reminder: Your stay at {hotelName} starts tomorrow',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2c5aa0;">Your Stay Begins Tomorrow!</h2>
              <p>Dear {guestName},</p>
              <p>Just a friendly reminder that your stay at <strong>{hotelName}</strong> begins tomorrow.</p>
              <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Quick Details:</h3>
                <p><strong>Check-in:</strong> {checkIn} at 3:00 PM</p>
                <p><strong>Address:</strong> {hotelAddress}</p>
                <p><strong>Contact:</strong> {hotelPhone}</p>
              </div>
              <p>Have a wonderful stay!</p>
            </div>
          `
        },
        sms: {
          text: 'Reminder: Your stay at {hotelName} starts tomorrow! Check-in: 3:00 PM. Contact: {hotelPhone}'
        },
        push: {
          title: 'Stay Reminder',
          body: 'Your stay at {hotelName} begins tomorrow',
          data: { bookingId: '{bookingId}', type: 'check_in_reminder' }
        }
      }
    });

    this.addTemplate('payment_success', {
      channels: ['email', 'sms', 'push', 'in_app'],
      priority: 'high',
      templates: {
        email: {
          subject: 'Payment Confirmed - {hotelName}',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #28a745;">Payment Successful!</h2>
              <p>Dear {guestName},</p>
              <p>Your payment for booking at <strong>{hotelName}</strong> has been processed successfully.</p>
              <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Payment Details:</h3>
                <p><strong>Amount Paid:</strong> {currency} {amount}</p>
                <p><strong>Payment Method:</strong> {paymentMethod}</p>
                <p><strong>Transaction ID:</strong> {transactionId}</p>
                <p><strong>Date:</strong> {paymentDate}</p>
              </div>
              <p>Receipt has been attached to this email.</p>
            </div>
          `
        },
        sms: {
          text: 'Payment of {currency} {amount} confirmed for {hotelName}. Transaction ID: {transactionId}'
        }
      }
    });

    this.addTemplate('system_alert', {
      channels: ['email', 'slack', 'webhook'],
      priority: 'critical',
      templates: {
        email: {
          subject: 'System Alert: {alertType}',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc3545;">System Alert</h2>
              <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px;">
                <h3>{alertType}</h3>
                <p><strong>Severity:</strong> {severity}</p>
                <p><strong>Description:</strong> {description}</p>
                <p><strong>Time:</strong> {timestamp}</p>
                {details}
              </div>
            </div>
          `
        },
        slack: {
          text: 'System Alert: {alertType} - {description}',
          attachments: [{
            color: 'danger',
            fields: [
              { title: 'Severity', value: '{severity}', short: true },
              { title: 'Time', value: '{timestamp}', short: true }
            ]
          }]
        }
      }
    });
  }

  /**
   * Initialize notification providers
   */
  initializeProviders() {
    // Email provider (already implemented)
    this.addProvider('email', {
      send: async (to, content, options = {}) => {
        return await emailService.sendEmail({
          to,
          subject: content.subject,
          html: content.html,
          text: content.text,
          ...options
        });
      },
      validate: (to) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)
    });

    // SMS provider (mock implementation - would integrate with Twilio, AWS SNS, etc.)
    this.addProvider('sms', {
      send: async (to, content, options = {}) => {
        // Mock SMS sending
        logger.info('SMS sent (mock)', {
          to,
          text: content.text,
          provider: 'mock_sms'
        });
        
        return {
          success: true,
          messageId: `sms_${Date.now()}`,
          provider: 'mock_sms'
        };
      },
      validate: (to) => /^\+?[1-9]\d{1,14}$/.test(to)
    });

    // Push notification provider (mock implementation)
    this.addProvider('push', {
      send: async (to, content, options = {}) => {
        // Mock push notification
        logger.info('Push notification sent (mock)', {
          to,
          title: content.title,
          body: content.body,
          data: content.data
        });

        return {
          success: true,
          messageId: `push_${Date.now()}`,
          provider: 'mock_push'
        };
      },
      validate: (to) => typeof to === 'string' && to.length > 10 // Device token
    });

    // In-app notification provider
    this.addProvider('in_app', {
      send: async (userId, content, options = {}) => {
        // Store in database for in-app display
        const notification = {
          id: uuidv4(),
          userId,
          title: content.title,
          message: content.message,
          actionUrl: content.actionUrl,
          read: false,
          createdAt: new Date().toISOString()
        };

        // In production, this would save to database
        logger.info('In-app notification created', notification);

        return {
          success: true,
          notificationId: notification.id
        };
      },
      validate: (userId) => typeof userId === 'string' && userId.length > 0
    });

    // Webhook provider
    this.addProvider('webhook', {
      send: async (url, content, options = {}) => {
        try {
          // Mock webhook call
          logger.info('Webhook called (mock)', {
            url,
            payload: content,
            headers: options.headers
          });

          return {
            success: true,
            statusCode: 200,
            response: 'OK'
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      },
      validate: (url) => /^https?:\/\/.+/.test(url)
    });

    // Slack provider (mock implementation)
    this.addProvider('slack', {
      send: async (webhook, content, options = {}) => {
        // Mock Slack notification
        logger.info('Slack message sent (mock)', {
          webhook,
          text: content.text,
          attachments: content.attachments
        });

        return {
          success: true,
          timestamp: Date.now()
        };
      },
      validate: (webhook) => webhook && webhook.includes('hooks.slack.com')
    });
  }

  /**
   * Add notification template
   */
  addTemplate(name, template) {
    this.templates.set(name, {
      ...template,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Add notification provider
   */
  addProvider(name, provider) {
    this.providers.set(name, provider);
  }

  /**
   * Send notification using template
   */
  async sendNotification(templateName, data, options = {}) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const {
      channels = template.channels,
      priority = template.priority,
      delay = 0,
      retryAttempts = 3,
      userId = null,
      metadata = {}
    } = options;

    const notificationId = uuidv4();
    const notification = {
      id: notificationId,
      templateName,
      data,
      channels,
      priority,
      status: 'queued',
      attempts: 0,
      maxAttempts: retryAttempts,
      scheduledFor: new Date(Date.now() + delay).toISOString(),
      createdAt: new Date().toISOString(),
      userId,
      metadata
    };

    // Add to queue
    this.notificationQueue.push(notification);
    
    // Sort queue by priority and scheduled time
    this.sortQueue();

    logger.info('Notification queued', {
      notificationId,
      templateName,
      channels,
      priority
    });

    return notificationId;
  }

  /**
   * Send immediate notification
   */
  async sendImmediate(templateName, data, options = {}) {
    const notificationId = await this.sendNotification(templateName, data, {
      ...options,
      delay: 0
    });

    // Process immediately
    return await this.processNotification(notificationId);
  }

  /**
   * Process a specific notification
   */
  async processNotification(notificationId) {
    const notification = this.notificationQueue.find(n => n.id === notificationId);
    if (!notification) {
      throw new Error(`Notification '${notificationId}' not found`);
    }

    const template = this.templates.get(notification.templateName);
    const results = {};

    notification.status = 'processing';
    notification.attempts++;

    for (const channelName of notification.channels) {
      try {
        const channelTemplate = template.templates[channelName];
        if (!channelTemplate) {
          continue;
        }

        const provider = this.providers.get(channelName);
        if (!provider) {
          results[channelName] = {
            success: false,
            error: 'Provider not available'
          };
          continue;
        }

        // Render template with data
        const content = this.renderTemplate(channelTemplate, notification.data);
        
        // Get recipient for this channel
        const recipient = this.getRecipient(channelName, notification.data, notification.userId);
        
        if (!recipient) {
          results[channelName] = {
            success: false,
            error: 'No recipient available'
          };
          continue;
        }

        // Validate recipient
        if (!provider.validate(recipient)) {
          results[channelName] = {
            success: false,
            error: 'Invalid recipient format'
          };
          continue;
        }

        // Check user preferences
        if (notification.userId && !this.isChannelAllowed(notification.userId, channelName)) {
          results[channelName] = {
            success: false,
            error: 'Channel disabled by user preferences'
          };
          continue;
        }

        // Send notification
        const result = await provider.send(recipient, content, {
          notificationId: notification.id,
          templateName: notification.templateName,
          priority: notification.priority
        });

        results[channelName] = result;

        // Log delivery
        this.logDelivery(notification.id, channelName, recipient, result);

      } catch (error) {
        results[channelName] = {
          success: false,
          error: error.message
        };

        logger.error('Notification delivery failed', {
          notificationId: notification.id,
          channel: channelName,
          error: error.message
        });
      }
    }

    // Update notification status
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalChannels = notification.channels.length;

    if (successCount === totalChannels) {
      notification.status = 'delivered';
    } else if (successCount > 0) {
      notification.status = 'partially_delivered';
    } else {
      notification.status = 'failed';
    }

    notification.completedAt = new Date().toISOString();
    notification.results = results;

    // Remove from queue if completed or max attempts reached
    if (notification.status !== 'failed' || notification.attempts >= notification.maxAttempts) {
      this.notificationQueue = this.notificationQueue.filter(n => n.id !== notification.id);
    }

    return {
      notificationId: notification.id,
      status: notification.status,
      results,
      successCount,
      totalChannels
    };
  }

  /**
   * Render template with data
   */
  renderTemplate(template, data) {
    const rendered = {};

    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'string') {
        rendered[key] = this.interpolateString(value, data);
      } else if (Array.isArray(value)) {
        rendered[key] = value.map(item => 
          typeof item === 'string' ? this.interpolateString(item, data) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        rendered[key] = this.renderTemplate(value, data);
      } else {
        rendered[key] = value;
      }
    }

    return rendered;
  }

  /**
   * Interpolate string with data
   */
  interpolateString(template, data) {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      const keys = key.split('.');
      let value = data;

      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) break;
      }

      return value !== undefined ? value : match;
    });
  }

  /**
   * Get recipient for channel
   */
  getRecipient(channelName, data, userId) {
    switch (channelName) {
      case 'email':
        return data.email || data.guestEmail;
      case 'sms':
        return data.phone || data.guestPhone;
      case 'push':
        return data.deviceToken || userId; // Would get device token from user
      case 'in_app':
        return userId || data.userId;
      case 'webhook':
        return data.webhookUrl;
      case 'slack':
        return data.slackWebhook || process.env.SLACK_WEBHOOK;
      default:
        return null;
    }
  }

  /**
   * Check if channel is allowed for user
   */
  isChannelAllowed(userId, channelName) {
    const preferences = this.subscriptions.get(userId);
    if (!preferences) return true; // Default allow

    return preferences[channelName]?.enabled !== false;
  }

  /**
   * Log delivery attempt
   */
  logDelivery(notificationId, channel, recipient, result) {
    const deliveryRecord = {
      notificationId,
      channel,
      recipient: this.maskRecipient(recipient, channel),
      success: result.success,
      timestamp: new Date().toISOString(),
      result
    };

    if (!this.deliveryLog.has(notificationId)) {
      this.deliveryLog.set(notificationId, []);
    }

    this.deliveryLog.get(notificationId).push(deliveryRecord);

    // Keep only last 1000 delivery logs
    if (this.deliveryLog.size > 1000) {
      const oldestKey = this.deliveryLog.keys().next().value;
      this.deliveryLog.delete(oldestKey);
    }
  }

  /**
   * Mask recipient for privacy
   */
  maskRecipient(recipient, channel) {
    if (channel === 'email') {
      const [local, domain] = recipient.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    } else if (channel === 'sms') {
      return `***${recipient.slice(-4)}`;
    }
    return '***masked***';
  }

  /**
   * Start queue processor
   */
  startQueueProcessor() {
    setInterval(async () => {
      const now = new Date();
      const readyNotifications = this.notificationQueue.filter(n => 
        n.status === 'queued' && new Date(n.scheduledFor) <= now
      );

      for (const notification of readyNotifications) {
        try {
          await this.processNotification(notification.id);
        } catch (error) {
          logger.error('Queue processing error', {
            notificationId: notification.id,
            error: error.message
          });
        }
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Sort queue by priority and scheduled time
   */
  sortQueue() {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    this.notificationQueue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return new Date(a.scheduledFor) - new Date(b.scheduledFor);
    });
  }

  /**
   * Set user notification preferences
   */
  setUserPreferences(userId, preferences) {
    this.subscriptions.set(userId, {
      ...this.subscriptions.get(userId),
      ...preferences,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Get notification statistics
   */
  getStats(timeframe = '24h') {
    const now = Date.now();
    const timeframes = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };

    const cutoff = now - (timeframes[timeframe] || timeframes['24h']);
    
    // Count notifications by status, channel, template
    const stats = {
      queue: {
        pending: this.notificationQueue.filter(n => n.status === 'queued').length,
        processing: this.notificationQueue.filter(n => n.status === 'processing').length,
        total: this.notificationQueue.length
      },
      delivery: {
        total: 0,
        successful: 0,
        failed: 0,
        byChannel: {},
        byTemplate: {}
      }
    };

    // Analyze delivery logs
    for (const [notificationId, logs] of this.deliveryLog.entries()) {
      const recentLogs = logs.filter(log => 
        new Date(log.timestamp).getTime() > cutoff
      );

      for (const log of recentLogs) {
        stats.delivery.total++;
        
        if (log.success) {
          stats.delivery.successful++;
        } else {
          stats.delivery.failed++;
        }

        // By channel
        if (!stats.delivery.byChannel[log.channel]) {
          stats.delivery.byChannel[log.channel] = { total: 0, successful: 0, failed: 0 };
        }
        stats.delivery.byChannel[log.channel].total++;
        if (log.success) {
          stats.delivery.byChannel[log.channel].successful++;
        } else {
          stats.delivery.byChannel[log.channel].failed++;
        }
      }
    }

    stats.delivery.successRate = stats.delivery.total > 0 
      ? Math.round((stats.delivery.successful / stats.delivery.total) * 100)
      : 0;

    return stats;
  }

  /**
   * Get notification history for user
   */
  getUserNotifications(userId, limit = 50) {
    const userNotifications = [];
    
    for (const [notificationId, logs] of this.deliveryLog.entries()) {
      const userLogs = logs.filter(log => 
        log.channel === 'in_app' && log.recipient === userId
      );
      
      if (userLogs.length > 0) {
        userNotifications.push({
          notificationId,
          logs: userLogs,
          lastDelivery: userLogs[userLogs.length - 1].timestamp
        });
      }
    }

    return userNotifications
      .sort((a, b) => new Date(b.lastDelivery) - new Date(a.lastDelivery))
      .slice(0, limit);
  }

  /**
   * Retry failed notification
   */
  async retryNotification(notificationId) {
    const notification = this.notificationQueue.find(n => n.id === notificationId);
    if (!notification) {
      throw new Error(`Notification '${notificationId}' not found`);
    }

    if (notification.attempts >= notification.maxAttempts) {
      throw new Error('Maximum retry attempts exceeded');
    }

    notification.status = 'queued';
    notification.scheduledFor = new Date().toISOString();
    
    this.sortQueue();
    
    return await this.processNotification(notificationId);
  }

  /**
   * Cancel pending notification
   */
  cancelNotification(notificationId) {
    const index = this.notificationQueue.findIndex(n => n.id === notificationId);
    if (index === -1) {
      throw new Error(`Notification '${notificationId}' not found`);
    }

    const notification = this.notificationQueue[index];
    if (notification.status === 'processing') {
      throw new Error('Cannot cancel notification that is currently processing');
    }

    this.notificationQueue.splice(index, 1);
    return true;
  }
}

// Create singleton instance
const advancedNotificationService = new AdvancedNotificationService();

export default advancedNotificationService;