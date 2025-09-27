import Notification from '../models/Notification.js';
import User from '../models/User.js';
import notificationCache from './notificationCache.js';
import rateLimiter from './rateLimiter.js';
import { notificationEmitter } from './notificationEmitter.js';
import notificationRouter from './notificationRouting.js';

// Batch processing configuration
const BATCH_CONFIG = {
  SIZE: 50, // Process notifications in batches of 50
  TIMEOUT: 5000, // Process batch every 5 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000 // 1 second delay between retries
};

class OptimizedNotificationService {
  constructor() {
    this.notificationQueue = [];
    this.processingBatch = false;
    this.batchTimer = null;
    this.statistics = {
      sent: 0,
      failed: 0,
      rateLimited: 0,
      cached: 0,
      batchesProcessed: 0
    };
  }

  /**
   * Send notification with optimization and caching
   */
  async sendNotification({
    templateId,
    templateType,
    userId,
    hotelId,
    variables = {},
    channels = ['in_app'],
    priority = 'medium',
    metadata = {},
    skipRateLimit = false
  }) {
    try {
      // Get or create user profile from cache
      let user = await notificationCache.getUserProfile(userId);
      if (!user) {
        user = await User.findById(userId);
        if (!user) {
          throw new Error('User not found');
        }
        await notificationCache.getUserProfile(userId); // Cache it
      }

      // Get template from cache
      let template = null;
      if (templateId) {
        template = await notificationCache.getTemplate(hotelId, templateId);
      } else if (templateType) {
        template = await notificationCache.getTemplateByType(hotelId, templateType);
      }

      if (!template) {
        throw new Error('Template not found');
      }

      // Check rate limits (unless skipped for urgent notifications)
      if (!skipRateLimit) {
        const rateLimitCheck = await rateLimiter.canSendNotification({
          hotelId,
          userId,
          templateId: template._id,
          category: template.category,
          channels,
          priority
        });

        if (!rateLimitCheck.allowed) {
          this.statistics.rateLimited++;
          console.warn('Notification blocked by rate limit:', rateLimitCheck.reason);
          return {
            success: false,
            reason: 'rate_limited',
            details: rateLimitCheck
          };
        }
      }

      // Get user preferences from cache
      const preferences = await notificationCache.getUserPreferences(userId);

      // Use notification router to determine if notification should be sent
      const routingDecision = await notificationRouter.shouldSendNotification({
        template,
        user,
        preferences,
        channels,
        priority,
        metadata
      });

      if (!routingDecision.shouldSend) {
        return {
          success: false,
          reason: 'filtered_by_routing',
          details: routingDecision.reason
        };
      }

      // Populate template with variables
      const populatedContent = template.populateTemplate(variables);

      // Create notification object
      const notificationData = {
        userId,
        hotelId,
        templateId: template._id,
        type: template.type,
        category: template.category,
        title: populatedContent.title,
        message: populatedContent.message,
        subject: populatedContent.subject,
        htmlContent: populatedContent.htmlContent,
        channels: routingDecision.channels || channels,
        priority,
        metadata: {
          ...metadata,
          templateName: template.name,
          variables,
          originalChannels: channels
        },
        status: 'queued'
      };

      // Add to batch queue for processing
      this.addToBatch(notificationData);

      // Record rate limit usage
      if (!skipRateLimit) {
        await rateLimiter.recordNotificationSent({
          hotelId,
          userId,
          templateId: template._id,
          category: template.category,
          channels: notificationData.channels
        });
      }

      // Update template usage statistics
      if (template.incrementUsage) {
        template.incrementUsage();
      }

      this.statistics.sent++;

      return {
        success: true,
        notificationId: null, // Will be set after batch processing
        queued: true
      };

    } catch (error) {
      this.statistics.failed++;
      console.error('Error sending notification:', error);
      return {
        success: false,
        reason: 'error',
        error: error.message
      };
    }
  }

  /**
   * Send bulk notifications with optimization
   */
  async sendBulkNotifications(notifications) {
    const results = [];
    const batchSize = 10; // Process bulk in smaller chunks

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const batchPromises = batch.map(notification => this.sendNotification(notification));
      const batchResults = await Promise.allSettled(batchPromises);

      results.push(...batchResults.map(result =>
        result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
      ));

      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < notifications.length) {
        await this.delay(100);
      }
    }

    return {
      total: notifications.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Add notification to batch processing queue
   */
  addToBatch(notificationData) {
    this.notificationQueue.push(notificationData);

    // Start batch timer if not already running
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, BATCH_CONFIG.TIMEOUT);
    }

    // Process immediately if batch size is reached
    if (this.notificationQueue.length >= BATCH_CONFIG.SIZE) {
      this.processBatch();
    }
  }

  /**
   * Process batched notifications
   */
  async processBatch() {
    if (this.processingBatch || this.notificationQueue.length === 0) {
      return;
    }

    this.processingBatch = true;

    // Clear the timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Take current batch and clear queue
    const batch = [...this.notificationQueue];
    this.notificationQueue = [];

    try {
      // Insert all notifications in a single database operation
      const insertedNotifications = await Notification.insertMany(batch);

      // Group notifications by user for efficient real-time delivery
      const notificationsByUser = {};
      insertedNotifications.forEach(notification => {
        const userId = notification.userId.toString();
        if (!notificationsByUser[userId]) {
          notificationsByUser[userId] = [];
        }
        notificationsByUser[userId].push(notification);
      });

      // Send real-time notifications
      const realTimePromises = Object.entries(notificationsByUser).map(([userId, notifications]) => {
        return this.sendRealTimeNotifications(userId, notifications);
      });

      await Promise.allSettled(realTimePromises);

      // Update notification counts in cache
      const countPromises = Object.keys(notificationsByUser).map(userId => {
        return notificationCache.incrementNotificationCount(userId);
      });

      await Promise.allSettled(countPromises);

      this.statistics.batchesProcessed++;
      console.log(`Processed batch of ${batch.length} notifications`);

    } catch (error) {
      console.error('Error processing notification batch:', error);

      // Retry logic
      if (batch.length > 0 && batch[0].retryCount < BATCH_CONFIG.MAX_RETRIES) {
        batch.forEach(notification => {
          notification.retryCount = (notification.retryCount || 0) + 1;
        });

        // Re-queue after delay
        setTimeout(() => {
          this.notificationQueue.unshift(...batch);
          this.processBatch();
        }, BATCH_CONFIG.RETRY_DELAY);
      }
    } finally {
      this.processingBatch = false;

      // Check if there are more notifications to process
      if (this.notificationQueue.length > 0) {
        this.processBatch();
      }
    }
  }

  /**
   * Send real-time notifications via SSE
   */
  async sendRealTimeNotifications(userId, notifications) {
    try {
      notifications.forEach(notification => {
        notificationEmitter.emit(`user:${userId}`, {
          type: 'notification',
          data: notification
        });
      });
    } catch (error) {
      console.error('Error sending real-time notifications:', error);
    }
  }

  /**
   * Get optimized notification count for user
   */
  async getNotificationCount(userId, useCache = true) {
    if (useCache) {
      const cachedCount = await notificationCache.getNotificationCount(userId);
      if (cachedCount !== null) {
        this.statistics.cached++;
        return cachedCount;
      }
    }

    const count = await Notification.countDocuments({
      userId,
      status: { $in: ['sent', 'delivered'] },
      readAt: { $exists: false }
    });

    // Cache the count
    await notificationCache.setNotificationCount(userId, count);

    return count;
  }

  /**
   * Get paginated notifications with caching
   */
  async getNotifications(userId, { page = 1, limit = 20, status, type, unreadOnly = false }) {
    const skip = (page - 1) * limit;
    const query = { userId };

    if (status) query.status = status;
    if (type) query.type = type;
    if (unreadOnly) {
      query.status = { $in: ['sent', 'delivered'] };
      query.readAt = { $exists: false };
    }

    // Use database aggregation for better performance
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('metadata.bookingId', 'bookingNumber')
        .lean(), // Use lean() for better performance
      Notification.countDocuments(query)
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Mark notifications as read with cache invalidation
   */
  async markAsRead(userId, notificationIds) {
    const result = await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        userId,
        readAt: { $exists: false }
      },
      {
        $set: { readAt: new Date(), status: 'read' }
      }
    );

    // Invalidate notification count cache
    await notificationCache.invalidateNotificationCount(userId);

    return result;
  }

  /**
   * Get notification statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      queueSize: this.notificationQueue.length,
      processingBatch: this.processingBatch
    };
  }

  /**
   * Flush pending notifications (force process current batch)
   */
  async flushQueue() {
    if (this.notificationQueue.length > 0) {
      await this.processBatch();
    }
  }

  /**
   * Preload frequently used templates
   */
  async preloadTemplates(hotelId) {
    try {
      const commonTypes = [
        'booking_confirmation',
        'payment_success',
        'guest_welcome',
        'maintenance_request'
      ];

      const preloadPromises = commonTypes.map(type =>
        notificationCache.getTemplateByType(hotelId, type)
      );

      await Promise.all(preloadPromises);
      console.log(`Preloaded ${commonTypes.length} templates for hotel ${hotelId}`);
    } catch (error) {
      console.error('Error preloading templates:', error);
    }
  }

  /**
   * Warm up user data cache
   */
  async warmupUserCache(userIds) {
    try {
      const batchSize = 20;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const promises = batch.map(userId =>
          Promise.all([
            notificationCache.getUserProfile(userId),
            notificationCache.getUserPreferences(userId)
          ])
        );

        await Promise.all(promises);

        // Small delay between batches
        if (i + batchSize < userIds.length) {
          await this.delay(100);
        }
      }

      console.log(`Warmed up cache for ${userIds.length} users`);
    } catch (error) {
      console.error('Error warming up user cache:', error);
    }
  }

  /**
   * Clean up old notifications and optimize database
   */
  async cleanup() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Delete old read notifications
      const deleteResult = await Notification.deleteMany({
        readAt: { $exists: true, $lt: thirtyDaysAgo },
        status: 'read'
      });

      // Archive old unread notifications (mark as archived instead of deleting)
      const archiveResult = await Notification.updateMany(
        {
          createdAt: { $lt: thirtyDaysAgo },
          readAt: { $exists: false }
        },
        {
          $set: { status: 'archived' }
        }
      );

      console.log(`Cleanup completed: deleted ${deleteResult.deletedCount}, archived ${archiveResult.modifiedCount}`);

      return {
        deleted: deleteResult.deletedCount,
        archived: archiveResult.modifiedCount
      };
    } catch (error) {
      console.error('Error during cleanup:', error);
      return { deleted: 0, archived: 0 };
    }
  }

  /**
   * Utility function for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check
   */
  async getHealthStatus() {
    return {
      service: 'OptimizedNotificationService',
      status: 'healthy',
      statistics: this.getStatistics(),
      queue: {
        size: this.notificationQueue.length,
        processing: this.processingBatch
      },
      cache: await notificationCache.getHealthStatus(),
      rateLimiter: await rateLimiter.getMetrics()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down notification service...');

    // Process remaining notifications
    await this.flushQueue();

    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    console.log('Notification service shutdown completed');
  }
}

// Create singleton instance
const optimizedNotificationService = new OptimizedNotificationService();

// Graceful shutdown
process.on('SIGINT', () => {
  optimizedNotificationService.shutdown();
});

process.on('SIGTERM', () => {
  optimizedNotificationService.shutdown();
});

export default optimizedNotificationService;