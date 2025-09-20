import advancedNotificationService from '../services/advancedNotificationService.js';
import logger from '../utils/logger.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

export const sendNotification = async (req, res, next) => {
  try {
    const {
      templateName,
      data,
      channels,
      priority = 'medium',
      delay = 0,
      retryAttempts = 3,
      userId,
      metadata = {}
    } = req.body;

    if (!templateName) {
      throw new ValidationError('Template name is required');
    }

    if (!data) {
      throw new ValidationError('Notification data is required');
    }

    const notificationId = await advancedNotificationService.sendNotification(
      templateName,
      data,
      {
        channels,
        priority,
        delay,
        retryAttempts,
        userId,
        metadata
      }
    );

    logger.info('Notification sent via API', {
      notificationId,
      templateName,
      channels,
      priority,
      userId: req.user?.id
    });

    res.status(202).json({
      success: true,
      data: {
        notificationId,
        status: 'queued'
      }
    });
  } catch (error) {
    next(error);
  }
};

export const sendImmediateNotification = async (req, res, next) => {
  try {
    const {
      templateName,
      data,
      channels,
      priority = 'high',
      userId,
      metadata = {}
    } = req.body;

    if (!templateName) {
      throw new ValidationError('Template name is required');
    }

    if (!data) {
      throw new ValidationError('Notification data is required');
    }

    const result = await advancedNotificationService.sendImmediate(
      templateName,
      data,
      {
        channels,
        priority,
        userId,
        metadata
      }
    );

    logger.info('Immediate notification sent via API', {
      notificationId: result.notificationId,
      templateName,
      channels,
      status: result.status,
      userId: req.user?.id
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getNotificationStatus = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    const notification = advancedNotificationService.notificationQueue
      .find(n => n.id === notificationId);

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    res.json({
      success: true,
      data: {
        id: notification.id,
        templateName: notification.templateName,
        status: notification.status,
        channels: notification.channels,
        priority: notification.priority,
        attempts: notification.attempts,
        maxAttempts: notification.maxAttempts,
        scheduledFor: notification.scheduledFor,
        createdAt: notification.createdAt,
        completedAt: notification.completedAt,
        results: notification.results
      }
    });
  } catch (error) {
    next(error);
  }
};

export const retryNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    const result = await advancedNotificationService.retryNotification(notificationId);

    logger.info('Notification retried via API', {
      notificationId,
      userId: req.user?.id
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const cancelNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    await advancedNotificationService.cancelNotification(notificationId);

    logger.info('Notification cancelled via API', {
      notificationId,
      userId: req.user?.id
    });

    res.json({
      success: true,
      message: 'Notification cancelled'
    });
  } catch (error) {
    next(error);
  }
};

export const getNotificationStats = async (req, res, next) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    const stats = advancedNotificationService.getStats(timeframe);

    res.json({
      success: true,
      data: {
        timeframe,
        ...stats
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.params.userId;
    const { limit = 50 } = req.query;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const notifications = advancedNotificationService.getUserNotifications(
      userId,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: {
        userId,
        notifications,
        total: notifications.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const setUserPreferences = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.params.userId;
    const { preferences } = req.body;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!preferences) {
      throw new ValidationError('Preferences are required');
    }

    advancedNotificationService.setUserPreferences(userId, preferences);

    logger.info('User notification preferences updated', {
      userId,
      preferences,
      updatedBy: req.user?.id
    });

    res.json({
      success: true,
      message: 'Preferences updated'
    });
  } catch (error) {
    next(error);
  }
};

export const getUserPreferences = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.params.userId;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const preferences = advancedNotificationService.subscriptions.get(userId) || {
      email: { enabled: true },
      sms: { enabled: true },
      push: { enabled: true },
      in_app: { enabled: true }
    };

    res.json({
      success: true,
      data: {
        userId,
        preferences
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAvailableTemplates = async (req, res, next) => {
  try {
    const templates = Array.from(advancedNotificationService.templates.entries())
      .map(([name, template]) => ({
        name,
        channels: template.channels,
        priority: template.priority,
        createdAt: template.createdAt
      }));

    res.json({
      success: true,
      data: {
        templates,
        total: templates.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const testNotificationTemplate = async (req, res, next) => {
  try {
    const { templateName, testData, channel = 'email' } = req.body;

    if (!templateName) {
      throw new ValidationError('Template name is required');
    }

    const template = advancedNotificationService.templates.get(templateName);
    if (!template) {
      throw new NotFoundError('Template not found');
    }

    const channelTemplate = template.templates[channel];
    if (!channelTemplate) {
      throw new NotFoundError(`Template for channel '${channel}' not found`);
    }

    // Render template with test data
    const rendered = advancedNotificationService.renderTemplate(
      channelTemplate,
      testData || {}
    );

    res.json({
      success: true,
      data: {
        templateName,
        channel,
        testData,
        rendered
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getNotificationQueue = async (req, res, next) => {
  try {
    const { status, priority, limit = 50 } = req.query;

    let queue = [...advancedNotificationService.notificationQueue];

    // Filter by status
    if (status) {
      queue = queue.filter(n => n.status === status);
    }

    // Filter by priority
    if (priority) {
      queue = queue.filter(n => n.priority === priority);
    }

    // Limit results
    queue = queue.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        notifications: queue.map(n => ({
          id: n.id,
          templateName: n.templateName,
          status: n.status,
          priority: n.priority,
          channels: n.channels,
          attempts: n.attempts,
          maxAttempts: n.maxAttempts,
          scheduledFor: n.scheduledFor,
          createdAt: n.createdAt,
          userId: n.userId
        })),
        total: queue.length,
        filters: { status, priority }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const sendTestNotification = async (req, res, next) => {
  try {
    const { channel, recipient, message } = req.body;

    if (!channel || !recipient || !message) {
      throw new ValidationError('Channel, recipient, and message are required');
    }

    const testData = {
      hotelName: 'Test Hotel',
      guestName: 'Test User',
      bookingId: 'TEST123',
      checkIn: '2024-12-25',
      checkOut: '2024-12-27',
      totalAmount: '299.00',
      currency: 'USD',
      email: channel === 'email' ? recipient : 'test@example.com',
      phone: channel === 'sms' ? recipient : '+1234567890'
    };

    const result = await advancedNotificationService.sendImmediate(
      'booking_confirmation',
      testData,
      {
        channels: [channel],
        priority: 'low',
        metadata: { test: true }
      }
    );

    logger.info('Test notification sent', {
      channel,
      recipient,
      result,
      userId: req.user?.id
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const bulkNotification = async (req, res, next) => {
  try {
    const { templateName, recipients, data, channels, priority = 'medium' } = req.body;

    if (!templateName) {
      throw new ValidationError('Template name is required');
    }

    if (!recipients || !Array.isArray(recipients)) {
      throw new ValidationError('Recipients array is required');
    }

    const results = [];

    for (const recipient of recipients) {
      try {
        const recipientData = { ...data, ...recipient };
        const notificationId = await advancedNotificationService.sendNotification(
          templateName,
          recipientData,
          {
            channels,
            priority,
            userId: recipient.userId,
            metadata: { bulk: true }
          }
        );

        results.push({
          recipient: recipient.id || recipient.email || recipient.phone,
          notificationId,
          status: 'queued'
        });
      } catch (error) {
        results.push({
          recipient: recipient.id || recipient.email || recipient.phone,
          status: 'failed',
          error: error.message
        });
      }
    }

    logger.info('Bulk notification sent', {
      templateName,
      totalRecipients: recipients.length,
      successCount: results.filter(r => r.status === 'queued').length,
      failedCount: results.filter(r => r.status === 'failed').length,
      userId: req.user?.id
    });

    res.json({
      success: true,
      data: {
        totalRecipients: recipients.length,
        results,
        successCount: results.filter(r => r.status === 'queued').length,
        failedCount: results.filter(r => r.status === 'failed').length
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  sendNotification,
  sendImmediateNotification,
  getNotificationStatus,
  retryNotification,
  cancelNotification,
  getNotificationStats,
  getUserNotifications,
  setUserPreferences,
  getUserPreferences,
  getAvailableTemplates,
  testNotificationTemplate,
  getNotificationQueue,
  sendTestNotification,
  bulkNotification
};
