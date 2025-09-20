import webpush from 'web-push';
import logger from '../utils/logger.js';
import NotificationPreference from '../models/NotificationPreference.js';

// Configure web-push with VAPID keys
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'your-vapid-public-key',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'your-vapid-private-key'
};

webpush.setVapidDetails(
  'mailto:admin@pentouz.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

class PushNotificationDeliveryService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Send push notification to a user
   * @param {string} userId - User ID
   * @param {Object} notification - Notification object
   * @returns {Promise<Object>} Delivery result
   */
  async sendPushNotification(userId, notification) {
    try {
      // Get user's push preferences
      const preferences = await NotificationPreference.findOne({ userId });
      if (!preferences || !preferences.push.enabled) {
        return {
          success: false,
          reason: 'Push notifications disabled for user',
          channel: 'push'
        };
      }

      // Check if notification type is enabled
      if (!preferences.push.types[notification.type]) {
        return {
          success: false,
          reason: `Push notifications disabled for type: ${notification.type}`,
          channel: 'push'
        };
      }

      // Check quiet hours
      if (preferences.isInQuietHours('push')) {
        return {
          success: false,
          reason: 'User is in quiet hours',
          channel: 'push'
        };
      }

      // Get push subscription
      const pushToken = preferences.push.token;
      if (!pushToken) {
        return {
          success: false,
          reason: 'No push token found for user',
          channel: 'push'
        };
      }

      let subscription;
      try {
        subscription = JSON.parse(pushToken);
      } catch (error) {
        return {
          success: false,
          reason: 'Invalid push token format',
          channel: 'push'
        };
      }

      // Prepare notification payload
      const payload = {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        actionUrl: notification.metadata?.actionUrl,
        imageUrl: notification.metadata?.imageUrl,
        metadata: notification.metadata
      };

      // Send push notification with retry logic
      const result = await this.sendWithRetry(subscription, payload);
      
      if (result.success) {
        logger.info('Push notification sent successfully', {
          userId,
          notificationId: notification._id,
          type: notification.type
        });
      } else {
        logger.error('Failed to send push notification', {
          userId,
          notificationId: notification._id,
          error: result.error
        });
      }

      return result;

    } catch (error) {
      logger.error('Error in push notification service', {
        userId,
        notificationId: notification._id,
        error: error.message
      });

      return {
        success: false,
        reason: 'Internal error',
        error: error.message,
        channel: 'push'
      };
    }
  }

  /**
   * Send push notification with retry logic
   * @param {Object} subscription - Push subscription
   * @param {Object} payload - Notification payload
   * @returns {Promise<Object>} Send result
   */
  async sendWithRetry(subscription, payload) {
    let attempt = 0;
    let lastError;

    while (attempt < this.maxRetries) {
      try {
        const options = {
          TTL: 86400, // 24 hours
          urgency: this.getUrgency(payload.priority),
          headers: {}
        };

        const result = await webpush.sendNotification(
          subscription,
          JSON.stringify(payload),
          options
        );

        return {
          success: true,
          statusCode: result.statusCode,
          headers: result.headers,
          body: result.body,
          channel: 'push'
        };

      } catch (error) {
        lastError = error;
        attempt++;

        // Handle specific error cases
        if (error.statusCode === 410 || error.statusCode === 404) {
          // Subscription is no longer valid
          await this.handleInvalidSubscription(subscription, error);
          return {
            success: false,
            reason: 'Invalid subscription',
            error: error.message,
            channel: 'push'
          };
        }

        if (error.statusCode === 413) {
          // Payload too large
          return {
            success: false,
            reason: 'Payload too large',
            error: error.message,
            channel: 'push'
          };
        }

        if (attempt < this.maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }

    return {
      success: false,
      reason: 'Max retries exceeded',
      error: lastError?.message,
      statusCode: lastError?.statusCode,
      channel: 'push'
    };
  }

  /**
   * Get urgency level based on priority
   * @param {string} priority - Notification priority
   * @returns {string} Urgency level
   */
  getUrgency(priority) {
    switch (priority) {
      case 'urgent':
        return 'high';
      case 'high':
        return 'high';
      case 'medium':
        return 'normal';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }

  /**
   * Handle invalid push subscription
   * @param {Object} subscription - Invalid subscription
   * @param {Error} error - Error details
   */
  async handleInvalidSubscription(subscription, error) {
    try {
      // Find user with this subscription and clear it
      const preferences = await NotificationPreference.findOne({
        'push.token': JSON.stringify(subscription)
      });

      if (preferences) {
        preferences.push.token = '';
        preferences.push.enabled = false;
        await preferences.save();

        logger.info('Cleared invalid push subscription', {
          userId: preferences.userId,
          error: error.message
        });
      }
    } catch (cleanupError) {
      logger.error('Error cleaning up invalid subscription', {
        error: cleanupError.message
      });
    }
  }

  /**
   * Send bulk push notifications
   * @param {Array} notifications - Array of {userId, notification} objects
   * @returns {Promise<Array>} Array of results
   */
  async sendBulkPushNotifications(notifications) {
    const results = [];
    const batchSize = 10; // Process in batches to avoid overwhelming the service

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const batchPromises = batch.map(({ userId, notification }) =>
        this.sendPushNotification(userId, notification)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map((result, index) => ({
        userId: batch[index].userId,
        notificationId: batch[index].notification._id,
        result: result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
      })));

      // Small delay between batches
      if (i + batchSize < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info('Bulk push notifications completed', {
      total: notifications.length,
      successful: results.filter(r => r.result.success).length,
      failed: results.filter(r => !r.result.success).length
    });

    return results;
  }

  /**
   * Test push notification functionality
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Test result
   */
  async testPushNotification(userId) {
    const testNotification = {
      _id: 'test-' + Date.now(),
      type: 'system_alert',
      title: 'Test Notification',
      message: 'This is a test push notification from PENTOUZ Hotel.',
      priority: 'medium',
      metadata: {
        category: 'system',
        tags: ['test']
      }
    };

    return await this.sendPushNotification(userId, testNotification);
  }

  /**
   * Get push notification statistics
   * @param {string} hotelId - Hotel ID (optional)
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics(hotelId = null) {
    try {
      const query = hotelId ? { hotelId } : {};
      
      const totalUsers = await NotificationPreference.countDocuments(query);
      const pushEnabledUsers = await NotificationPreference.countDocuments({
        ...query,
        'push.enabled': true
      });
      const usersWithTokens = await NotificationPreference.countDocuments({
        ...query,
        'push.enabled': true,
        'push.token': { $ne: '' }
      });

      return {
        totalUsers,
        pushEnabledUsers,
        usersWithTokens,
        enabledPercentage: totalUsers > 0 ? (pushEnabledUsers / totalUsers * 100).toFixed(2) : 0,
        tokensPercentage: pushEnabledUsers > 0 ? (usersWithTokens / pushEnabledUsers * 100).toFixed(2) : 0
      };
    } catch (error) {
      logger.error('Error getting push notification statistics', { error: error.message });
      throw error;
    }
  }
}

export default new PushNotificationDeliveryService();