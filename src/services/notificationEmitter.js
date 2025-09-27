import EventEmitter from 'events';
import Notification from '../models/Notification.js';
import logger from '../utils/logger.js';
import notificationRoutingService from './notificationRouting.js';

class NotificationEmitter extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // Track active connections
  }

  // Send notification to specific user
  async sendToUser(userId, notification) {
    try {
      // Emit to SSE connections
      this.emit(`user:${userId}`, {
        type: 'notification',
        data: notification,
        timestamp: new Date().toISOString()
      });

      logger.info(`Notification sent to user ${userId}`, {
        notificationId: notification._id,
        type: notification.type
      });

      return true;
    } catch (error) {
      logger.error('Failed to send notification', {
        userId,
        error: error.message
      });
      return false;
    }
  }

  // Send notification to multiple users
  async sendToUsers(userIds, notification) {
    const results = await Promise.all(
      userIds.map(userId => this.sendToUser(userId, notification))
    );
    return results;
  }

  // Send notification to users by role
  async sendToRole(role, hotelId, notification) {
    try {
      // Get users with specific role in hotel
      const User = (await import('../models/User.js')).default;
      const users = await User.find({
        role,
        hotelId,
        isActive: true
      }).select('_id');

      const userIds = users.map(u => u._id.toString());
      return await this.sendToUsers(userIds, notification);
    } catch (error) {
      logger.error('Failed to send notification to role', {
        role,
        hotelId,
        error: error.message
      });
      return [];
    }
  }

  // Broadcast system-wide notification
  async broadcast(notification) {
    try {
      // Emit to all connected users
      this.emit('broadcast', {
        type: 'broadcast',
        data: notification,
        timestamp: new Date().toISOString()
      });

      logger.info('Broadcast notification sent', {
        notificationId: notification._id,
        type: notification.type
      });

      return true;
    } catch (error) {
      logger.error('Failed to broadcast notification', {
        error: error.message
      });
      return false;
    }
  }

  // Track connection
  addConnection(userId, connectionId) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId).add(connectionId);

    logger.info(`User ${userId} connected to notification stream`, {
      connectionId,
      totalConnections: this.connections.get(userId).size
    });
  }

  // Remove connection
  removeConnection(userId, connectionId) {
    if (this.connections.has(userId)) {
      this.connections.get(userId).delete(connectionId);
      if (this.connections.get(userId).size === 0) {
        this.connections.delete(userId);
      }

      logger.info(`User ${userId} disconnected from notification stream`, {
        connectionId,
        remainingConnections: this.connections.get(userId)?.size || 0
      });
    }
  }

  // Get connection stats
  getStats() {
    const stats = {
      totalUsers: this.connections.size,
      totalConnections: 0,
      userConnections: {}
    };

    for (const [userId, connections] of this.connections) {
      stats.totalConnections += connections.size;
      stats.userConnections[userId] = connections.size;
    }

    return stats;
  }

  // Create and send notification
  async createAndSend(data) {
    try {
      const { userId, type, title, message, priority = 'medium', metadata = {} } = data;

      // Create notification in database
      const notification = new Notification({
        userId,
        hotelId: data.hotelId || metadata.hotelId,
        type,
        title,
        message,
        channels: ['in_app'],
        priority,
        status: 'sent',
        sentAt: new Date(),
        metadata: {
          ...metadata,
          category: this.getCategoryFromType(type)
        }
      });

      await notification.save();

      // Send via SSE
      await this.sendToUser(userId.toString(), notification);

      return notification;
    } catch (error) {
      logger.error('Failed to create and send notification', {
        data,
        error: error.message
      });
      throw error;
    }
  }

  // Create and route smart notification using routing service
  async createAndRoute(notificationData) {
    try {
      const {
        type,
        title,
        message,
        priority = 'medium',
        hotelId,
        metadata = {},
        excludeUsers = []
      } = notificationData;

      logger.info('Creating smart routed notification', {
        type,
        priority,
        hotelId,
        excludeUsersCount: excludeUsers.length
      });

      // Use routing service to determine recipients
      const routingPlan = await notificationRoutingService.routeNotification({
        type,
        priority,
        hotelId,
        metadata,
        excludeUsers
      });

      if (routingPlan.recipients.length === 0) {
        logger.warn('No recipients found for notification', { type, hotelId });
        return { notifications: [], routingPlan };
      }

      // Create notifications for each recipient
      const notifications = [];
      const deliveryResults = { successful: [], failed: [] };

      for (const recipient of routingPlan.recipients) {
        try {
          // Create notification for this recipient
          const notification = new Notification({
            userId: recipient.userId,
            hotelId,
            type,
            title,
            message,
            channels: recipient.channels.map(ch => ch.channel),
            priority,
            status: 'pending',
            scheduledFor: recipient.timing.scheduledFor,
            metadata: {
              ...metadata,
              category: this.getCategoryFromType(type),
              routingPlan: {
                channels: recipient.channels,
                timing: recipient.timing,
                requiresAcknowledgment: recipient.requiresAcknowledgment,
                escalationConfig: recipient.escalationConfig
              }
            }
          });

          await notification.save();
          notifications.push(notification);

          // Send immediately if not scheduled for later
          if (recipient.timing.immediate || new Date(recipient.timing.scheduledFor) <= new Date()) {
            await this.deliverNotification(notification, recipient);
            deliveryResults.successful.push({
              userId: recipient.userId,
              notificationId: notification._id,
              channels: recipient.channels
            });
          } else {
            // Schedule for later delivery
            this.scheduleNotification(notification, recipient);
            logger.info('Notification scheduled for later delivery', {
              notificationId: notification._id,
              scheduledFor: recipient.timing.scheduledFor
            });
          }

        } catch (error) {
          logger.error('Failed to create/send notification for recipient', {
            userId: recipient.userId,
            error: error.message
          });
          deliveryResults.failed.push({
            userId: recipient.userId,
            error: error.message
          });
        }
      }

      // Track routing performance
      await notificationRoutingService.trackRoutingPerformance(
        notifications[0]?._id,
        routingPlan.recipients,
        deliveryResults
      );

      logger.info('Smart routed notification completed', {
        type,
        totalRecipients: routingPlan.recipients.length,
        successful: deliveryResults.successful.length,
        failed: deliveryResults.failed.length
      });

      return {
        notifications,
        routingPlan,
        deliveryResults
      };

    } catch (error) {
      logger.error('Failed to create and route notification', {
        notificationData,
        error: error.message
      });
      throw error;
    }
  }

  // Deliver notification to specific recipient
  async deliverNotification(notification, recipient) {
    try {
      // Update notification status
      notification.status = 'sent';
      notification.sentAt = new Date();
      await notification.save();

      // Send via different channels based on routing plan
      const deliveryPromises = [];

      for (const channelConfig of recipient.channels) {
        const deliveryPromise = this.deliverViaChannel(
          notification,
          recipient,
          channelConfig
        );

        if (channelConfig.delay > 0) {
          // Delay delivery for this channel
          setTimeout(() => deliveryPromise, channelConfig.delay);
        } else {
          deliveryPromises.push(deliveryPromise);
        }
      }

      await Promise.allSettled(deliveryPromises);

      // Set up acknowledgment tracking if required
      if (recipient.requiresAcknowledgment) {
        this.setupAcknowledgmentTracking(notification, recipient);
      }

    } catch (error) {
      logger.error('Failed to deliver notification', {
        notificationId: notification._id,
        recipientId: recipient.userId,
        error: error.message
      });

      // Update notification status to failed
      notification.status = 'failed';
      notification.deliveryAttempts.push({
        channel: 'in_app',
        attemptedAt: new Date(),
        status: 'failed',
        errorMessage: error.message
      });
      await notification.save();
    }
  }

  // Deliver notification via specific channel
  async deliverViaChannel(notification, recipient, channelConfig) {
    const { channel, delay = 0 } = channelConfig;

    try {
      switch (channel) {
        case 'in_app':
          await this.sendToUser(recipient.userId.toString(), notification);
          break;

        case 'push':
        case 'browser':
          // This would integrate with push notification service
          await this.sendPushNotification(notification, recipient);
          break;

        case 'email':
          // This would integrate with email service
          await this.sendEmailNotification(notification, recipient);
          break;

        case 'sms':
          // This would integrate with SMS service
          await this.sendSMSNotification(notification, recipient);
          break;

        default:
          logger.warn('Unknown notification channel', { channel });
      }

      // Record successful delivery
      notification.deliveryAttempts.push({
        channel,
        attemptedAt: new Date(),
        status: 'success'
      });

      logger.info('Notification delivered successfully', {
        notificationId: notification._id,
        channel,
        userId: recipient.userId
      });

    } catch (error) {
      // Record failed delivery
      notification.deliveryAttempts.push({
        channel,
        attemptedAt: new Date(),
        status: 'failed',
        errorMessage: error.message
      });

      logger.error('Failed to deliver via channel', {
        notificationId: notification._id,
        channel,
        error: error.message
      });
    }

    await notification.save();
  }

  // Schedule notification for later delivery
  scheduleNotification(notification, recipient) {
    const deliveryTime = new Date(recipient.timing.scheduledFor);
    const delay = deliveryTime.getTime() - Date.now();

    if (delay > 0) {
      setTimeout(async () => {
        await this.deliverNotification(notification, recipient);
      }, delay);

      logger.info('Notification scheduled', {
        notificationId: notification._id,
        deliveryTime,
        delayMs: delay
      });
    }
  }

  // Setup acknowledgment tracking with escalation
  setupAcknowledgmentTracking(notification, recipient) {
    if (!recipient.escalationConfig?.enabled) {
      return;
    }

    const { delay, maxLevels } = recipient.escalationConfig;
    let escalationLevel = 0;

    const checkAcknowledgment = async () => {
      // Reload notification to check if it's been read
      const currentNotification = await Notification.findById(notification._id);

      if (currentNotification.readAt || escalationLevel >= maxLevels) {
        return; // Stop escalation
      }

      escalationLevel++;
      logger.info('Escalating notification', {
        notificationId: notification._id,
        escalationLevel,
        maxLevels
      });

      // Re-send with higher priority channels
      await this.escalateNotification(currentNotification, recipient, escalationLevel);

      // Schedule next escalation
      if (escalationLevel < maxLevels) {
        setTimeout(checkAcknowledgment, delay);
      }
    };

    // Start escalation timer
    setTimeout(checkAcknowledgment, delay);
  }

  // Escalate notification with additional channels or recipients
  async escalateNotification(notification, recipient, level) {
    try {
      // Add more aggressive channels for escalation
      const escalationChannels = ['sms', 'email'];

      for (const channel of escalationChannels) {
        if (recipient.channels.find(ch => ch.channel === channel)) {
          await this.deliverViaChannel(notification, recipient, { channel });
        }
      }

      // Could also escalate to supervisors/managers here
      // const supervisors = await this.getSupervisors(recipient.userId);

      logger.info('Notification escalated', {
        notificationId: notification._id,
        level,
        userId: recipient.userId
      });

    } catch (error) {
      logger.error('Failed to escalate notification', {
        notificationId: notification._id,
        level,
        error: error.message
      });
    }
  }

  // Placeholder methods for different delivery channels
  async sendPushNotification(notification, recipient) {
    // This would integrate with a push notification service like FCM
    logger.info('Push notification sent (placeholder)', {
      notificationId: notification._id,
      userId: recipient.userId
    });
  }

  async sendEmailNotification(notification, recipient) {
    // This would integrate with an email service
    logger.info('Email notification sent (placeholder)', {
      notificationId: notification._id,
      userId: recipient.userId,
      email: recipient.user.email
    });
  }

  async sendSMSNotification(notification, recipient) {
    // This would integrate with an SMS service
    logger.info('SMS notification sent (placeholder)', {
      notificationId: notification._id,
      userId: recipient.userId,
      phone: recipient.user.phone
    });
  }

  // Helper to determine category from notification type
  getCategoryFromType(type) {
    const typeCategories = {
      'booking_confirmation': 'booking',
      'booking_reminder': 'booking',
      'booking_cancellation': 'booking',
      'booking_created': 'booking',
      'check_in': 'booking',
      'check_out': 'booking',
      'payment_success': 'payment',
      'payment_failed': 'payment',
      'payment_update': 'payment',
      'loyalty_points': 'loyalty',
      'service_booking': 'service',
      'service_reminder': 'service',
      'service_request': 'service',
      'promotional': 'promotional',
      'special_offer': 'promotional',
      'system_alert': 'system',
      'welcome': 'system',
      'review_request': 'system',
      'user_registration': 'system',
      'user_activity': 'system',
      'data_refresh': 'system',
      'inventory_damage': 'inventory',
      'inventory_missing': 'inventory',
      'inventory_replacement_needed': 'inventory',
      'inventory_guest_charged': 'inventory',
      'inventory_low_stock': 'inventory',
      'checkout_inspection_failed': 'inventory',
      'inventory_theft': 'inventory'
    };

    return typeCategories[type] || 'system';
  }
}

// Create singleton instance
const notificationEmitter = new NotificationEmitter();

// Set max listeners to handle multiple connections
notificationEmitter.setMaxListeners(1000);

export { notificationEmitter };
export default notificationEmitter;