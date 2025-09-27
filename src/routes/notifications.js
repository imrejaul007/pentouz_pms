import express from 'express';
import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';
import NotificationTemplate from '../models/NotificationTemplate.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate, schemas } from '../middleware/validation.js';
import { notificationEmitter } from '../services/notificationEmitter.js';
import optimizedNotificationService from '../services/optimizedNotificationService.js';
import rateLimiter from '../services/rateLimiter.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/v1/notifications - Get user notifications with pagination and filters
router.get('/', catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20, status, type, unreadOnly = false } = req.query;
  const userId = req.user._id;
  
  // Build query
  const query = { userId };
  
  if (status) {
    query.status = status;
  }
  
  if (type) {
    query.type = type;
  }
  
  if (unreadOnly === 'true') {
    query.status = { $in: ['sent', 'delivered'] };
    query.readAt = { $exists: false };
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get notifications with populated metadata
  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('metadata.bookingId', 'bookingNumber checkIn checkOut roomNumber')
    .populate('metadata.serviceBookingId', 'bookingDate numberOfPeople serviceId')
    .populate('metadata.paymentId', 'amount currency status')
    .populate('metadata.loyaltyTransactionId', 'points type description');
  
  // Get total count for pagination
  const total = await Notification.countDocuments(query);
  
  // Get unread count
  const unreadCount = await Notification.getUnreadCount(userId);

  // Get total count (all notifications for user)
  const totalCount = await Notification.countDocuments({ userId });

  // Get weekly count (notifications from last 7 days)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weeklyCount = await Notification.countDocuments({
    userId,
    createdAt: { $gte: weekStart }
  });

  // Get high priority count (urgent and high priority notifications)
  const highPriorityCount = await Notification.countDocuments({
    userId,
    priority: { $in: ['high', 'urgent'] },
    status: { $in: ['pending', 'sent', 'delivered'] },
    readAt: { $exists: false }
  });

  res.status(200).json({
    status: 'success',
    data: {
      notifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      },
      unreadCount,
      totalCount,
      weeklyCount,
      highPriorityCount
    }
  });
}));

// GET /api/v1/notifications/unread-count - Get unread notification count
router.get('/unread-count', catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const unreadCount = await Notification.getUnreadCount(userId);

  res.status(200).json({
    status: 'success',
    data: { unreadCount }
  });
}));

// GET /api/v1/notifications/summary - Get notification summary by category
router.get('/summary', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const userRole = req.user.role;

  // Get unread count
  const unreadCount = await Notification.getUnreadCount(userId);

  // Get priority counts
  const priorityCounts = await Notification.aggregate([
    {
      $match: {
        userId,
        readAt: { $exists: false }
      }
    },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    }
  ]);

  const priorityMap = priorityCounts.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, { urgent: 0, high: 0, medium: 0, low: 0 });

  // Get category counts
  const categoryCounts = await Notification.aggregate([
    {
      $match: {
        userId,
        readAt: { $exists: false }
      }
    },
    {
      $group: {
        _id: '$metadata.category',
        count: { $sum: 1 }
      }
    }
  ]);

  const categoryMap = categoryCounts.reduce((acc, item) => {
    if (item._id) {
      acc[item._id] = item.count;
    }
    return acc;
  }, {
    booking: 0,
    payment: 0,
    service: 0,
    system: 0,
    ...(userRole === 'staff' && { maintenance: 0, inventory: 0 })
  });

  // Get recent activity
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [todayCount, weekCount, lastNotification] = await Promise.all([
    Notification.countDocuments({
      userId,
      createdAt: { $gte: todayStart }
    }),
    Notification.countDocuments({
      userId,
      createdAt: { $gte: weekStart }
    }),
    Notification.findOne({
      userId
    }).sort({ createdAt: -1 }).select('createdAt')
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      unreadCount,
      priorityCounts: priorityMap,
      categoryCounts: categoryMap,
      recentActivity: {
        todayCount,
        weekCount,
        lastNotification: lastNotification?.createdAt
      }
    }
  });
}));

// GET /api/v1/notifications/personal-overview - Get personal notification overview
router.get('/personal-overview', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { timeRange = 7 } = req.query;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(timeRange));

  // Get basic stats
  const [totalSent, totalRead, urgentCount] = await Promise.all([
    Notification.countDocuments({
      userId,
      createdAt: { $gte: startDate }
    }),
    Notification.countDocuments({
      userId,
      readAt: { $exists: true },
      createdAt: { $gte: startDate }
    }),
    Notification.countDocuments({
      userId,
      priority: 'urgent',
      createdAt: { $gte: startDate }
    })
  ]);

  // Get today's stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todaySent, todayRead] = await Promise.all([
    Notification.countDocuments({
      userId,
      createdAt: { $gte: todayStart }
    }),
    Notification.countDocuments({
      userId,
      readAt: { $exists: true },
      readAt: { $gte: todayStart }
    })
  ]);

  const todayReadRate = todaySent > 0 ? (todayRead / todaySent * 100) : 0;

  // Get weekly trend (simplified)
  const weeklyTrend = await Notification.aggregate([
    {
      $match: {
        userId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        sent: { $sum: 1 },
        read: {
          $sum: {
            $cond: [{ $ne: ['$readAt', null] }, 1, 0]
          }
        },
        urgent: {
          $sum: {
            $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0]
          }
        }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  // Get top categories
  const topCategories = await Notification.aggregate([
    {
      $match: {
        userId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$metadata.category',
        count: { $sum: 1 },
        readCount: {
          $sum: {
            $cond: [{ $ne: ['$readAt', null] }, 1, 0]
          }
        }
      }
    },
    {
      $addFields: {
        readRate: {
          $cond: [
            { $gt: ['$count', 0] },
            { $multiply: [{ $divide: ['$readCount', '$count'] }, 100] },
            0
          ]
        }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  // Calculate average response time (simplified)
  const responseTimeResult = await Notification.aggregate([
    {
      $match: {
        userId,
        readAt: { $exists: true },
        createdAt: { $gte: startDate }
      }
    },
    {
      $addFields: {
        responseTime: {
          $divide: [
            { $subtract: ['$readAt', '$createdAt'] },
            1000 * 60 // Convert to minutes
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        avgResponseTime: { $avg: '$responseTime' }
      }
    }
  ]);

  const averageResponseTime = responseTimeResult[0]?.avgResponseTime || 0;

  res.status(200).json({
    status: 'success',
    data: {
      totalSent,
      totalRead,
      totalUnread: totalSent - totalRead,
      urgentCount,
      todayStats: {
        sent: todaySent,
        read: todayRead,
        readRate: todayReadRate
      },
      weeklyTrend: weeklyTrend.map(day => ({
        date: day._id,
        sent: day.sent,
        read: day.read,
        urgent: day.urgent
      })),
      topCategories: topCategories.map(cat => ({
        category: cat._id || 'uncategorized',
        count: cat.count,
        readRate: cat.readRate
      })),
      averageResponseTime
    }
  });
}));

// Legacy summary endpoint - keeping for backward compatibility
router.get('/summary-legacy', catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  // Get counts by category
  const [bookingCount, paymentCount, serviceCount, systemCount] = await Promise.all([
    Notification.countDocuments({
      userId,
      'metadata.category': 'booking',
      readAt: { $exists: false }
    }),
    Notification.countDocuments({
      userId,
      'metadata.category': 'payment',
      readAt: { $exists: false }
    }),
    Notification.countDocuments({
      userId,
      'metadata.category': 'service',
      readAt: { $exists: false }
    }),
    Notification.countDocuments({
      userId,
      'metadata.category': 'system',
      readAt: { $exists: false }
    })
  ]);

  // Get recent notifications
  const recentNotifications = await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('type title message createdAt readAt priority');

  res.status(200).json({
    status: 'success',
    data: {
      summary: {
        booking: bookingCount,
        payment: paymentCount,
        service: serviceCount,
        system: systemCount,
        total: bookingCount + paymentCount + serviceCount + systemCount
      },
      recent: recentNotifications
    }
  });
}));

// GET /api/v1/notifications/preferences - Get user notification preferences
router.get('/preferences', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  
  // Get user to access hotelId
  const user = await User.findById(userId);
  if (!user) {
    return next(new ApplicationError('User not found', 404));
  }
  
  // For guests, hotelId is optional, so we'll use a default or null
  const hotelId = user.hotelId || null;
  
  // Get or create preferences
  const preferences = await NotificationPreference.getOrCreate(userId, hotelId);
  
  // Update email and SMS from user profile if not set
  if (!preferences.email.address && user.email) {
    preferences.email.address = user.email;
  }
  
  // Only set SMS number if user has a valid phone number
  if (!preferences.sms.number && user.phone && user.phone.trim()) {
    // Validate phone number format before setting
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (phoneRegex.test(user.phone.replace(/\s/g, ''))) {
      preferences.sms.number = user.phone;
    }
  }
  
  if (preferences.isModified()) {
    await preferences.save();
  }
  
  res.status(200).json({
    status: 'success',
    data: { preferences }
  });
}));

// GET /api/v1/notifications/types - Get available notification types for user's role
router.get('/types', catchAsync(async (req, res, next) => {
  // Import notification categories
  const { getNotificationsForRole, getCategoriesForRole } = await import('../config/notificationCategories.js');

  const userRole = req.user.role;
  const roleNotifications = getNotificationsForRole(userRole);
  const categories = getCategoriesForRole(userRole);

  const notificationTypes = Object.entries(roleNotifications).map(([type, config]) => ({
    type,
    label: config.description,
    description: config.description,
    category: config.category,
    priority: config.priority,
    channels: config.channels,
    defaultEnabled: true
  }));

  // If no role-specific types, fall back to generic types
  if (notificationTypes.length === 0) {
    const fallbackTypes = [
      {
        type: 'booking_confirmation',
        label: 'Booking Confirmation',
        description: 'Notifications when your booking is confirmed',
        category: 'booking',
        defaultEnabled: true
      },
    {
      type: 'booking_reminder',
      label: 'Booking Reminder',
      description: 'Reminders about upcoming bookings',
      category: 'booking',
      defaultEnabled: true
    },
    {
      type: 'booking_cancellation',
      label: 'Booking Cancellation',
      description: 'Notifications when bookings are cancelled',
      category: 'booking',
      defaultEnabled: true
    },
    {
      type: 'payment_success',
      label: 'Payment Success',
      description: 'Confirmations for successful payments',
      category: 'payment',
      defaultEnabled: true
    },
    {
      type: 'payment_failed',
      label: 'Payment Failed',
      description: 'Alerts for failed payment attempts',
      category: 'payment',
      defaultEnabled: true
    },
    {
      type: 'loyalty_points',
      label: 'Loyalty Points',
      description: 'Updates about loyalty points earned or redeemed',
      category: 'loyalty',
      defaultEnabled: true
    },
    {
      type: 'service_booking',
      label: 'Service Booking',
      description: 'Confirmations for hotel service bookings',
      category: 'service',
      defaultEnabled: true
    },
    {
      type: 'service_reminder',
      label: 'Service Reminder',
      description: 'Reminders about scheduled services',
      category: 'service',
      defaultEnabled: true
    },
    {
      type: 'promotional',
      label: 'Promotional',
      description: 'Special offers and promotions',
      category: 'promotional',
      defaultEnabled: true
    },
    {
      type: 'system_alert',
      label: 'System Alert',
      description: 'Important system notifications',
      category: 'system',
      defaultEnabled: true
    },
    {
      type: 'welcome',
      label: 'Welcome',
      description: 'Welcome messages and onboarding',
      category: 'system',
      defaultEnabled: true
    },
    {
      type: 'check_in',
      label: 'Check-in',
      description: 'Check-in related notifications',
      category: 'booking',
      defaultEnabled: true
    },
    {
      type: 'check_out',
      label: 'Check-out',
      description: 'Check-out related notifications',
      category: 'booking',
      defaultEnabled: true
    },
    {
      type: 'review_request',
      label: 'Review Request',
      description: 'Requests to review your stay',
      category: 'system',
      defaultEnabled: true
    },
    {
      type: 'special_offer',
      label: 'Special Offer',
      description: 'Exclusive offers and deals',
      category: 'promotional',
      defaultEnabled: true
    }
    ];

    res.status(200).json({
      status: 'success',
      data: {
        notificationTypes: fallbackTypes,
        categories: []
      }
    });
    return;
  }

  res.status(200).json({
    status: 'success',
    data: {
      notificationTypes,
      categories,
      role: userRole,
      totalTypes: notificationTypes.length
    }
  });
}));

// GET /api/v1/notifications/channels - Get available notification channels with role-based defaults
router.get('/channels', catchAsync(async (req, res, next) => {
  // Import notification categories for priority levels
  const { priorityLevels } = await import('../config/notificationCategories.js');

  const channels = [
    {
      id: 'in_app',
      name: 'In-App',
      description: 'Receive notifications within the application',
      icon: 'smartphone',
      defaultEnabled: true,
      supportsQuietHours: false,
      supportsFrequency: false,
      instantDelivery: true,
      supportedPriorities: ['urgent', 'high', 'medium', 'low']
    },
    {
      id: 'push',
      name: 'Push Notifications',
      description: 'Receive notifications on your device',
      icon: 'bell',
      defaultEnabled: true,
      supportsQuietHours: true,
      supportsFrequency: false,
      instantDelivery: true,
      supportedPriorities: ['urgent', 'high', 'medium']
    },
    {
      id: 'email',
      name: 'Email',
      description: 'Receive notifications via email',
      icon: 'mail',
      defaultEnabled: true,
      supportsQuietHours: true,
      supportsFrequency: true,
      instantDelivery: false,
      supportedPriorities: ['urgent', 'high', 'medium', 'low']
    },
    {
      id: 'sms',
      name: 'SMS',
      description: 'Receive notifications via text message',
      icon: 'message-circle',
      defaultEnabled: false,
      supportsQuietHours: true,
      supportsFrequency: false,
      instantDelivery: true,
      supportedPriorities: ['urgent', 'high'],
      requiresPhoneNumber: true
    }
  ];

  // Add role-specific channel recommendations
  const roleChannelRecommendations = {
    admin: ['in_app', 'email', 'sms'],
    manager: ['in_app', 'email', 'sms'],
    staff: ['in_app', 'push'],
    housekeeping: ['in_app', 'push'],
    maintenance: ['in_app', 'push', 'sms'],
    guest: ['in_app', 'email', 'push']
  };

  const userRole = req.user.role;
  const recommendedChannels = roleChannelRecommendations[userRole] || ['in_app', 'email'];

  // Enhance channels with role-specific recommendations
  const enhancedChannels = channels.map(channel => ({
    ...channel,
    recommended: recommendedChannels.includes(channel.id)
  }));

  res.status(200).json({
    status: 'success',
    data: {
      channels: enhancedChannels,
      priorityLevels,
      roleRecommendations: recommendedChannels,
      role: userRole
    }
  });
}));

// GET /api/v1/notifications/:id - Get specific notification
router.get('/:id', catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;
  
  const notification = await Notification.findOne({ _id: id, userId })
    .populate('metadata.bookingId', 'bookingNumber checkIn checkOut roomNumber')
    .populate('metadata.serviceBookingId', 'bookingDate numberOfPeople serviceId')
    .populate('metadata.paymentId', 'amount currency status')
    .populate('metadata.loyaltyTransactionId', 'points type description');
  
  if (!notification) {
    return next(new ApplicationError('Notification not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: { notification }
  });
}));

// PATCH /api/v1/notifications/:id/read - Mark notification as read
router.patch('/:id/read', catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;
  
  const notification = await Notification.findOne({ _id: id, userId });
  
  if (!notification) {
    return next(new ApplicationError('Notification not found', 404));
  }
  
  await notification.markAsRead();
  
  res.status(200).json({
    status: 'success',
    message: 'Notification marked as read'
  });
}));

// POST /api/v1/notifications/mark-read - Mark multiple notifications as read
router.post('/mark-read', validate(schemas.markNotificationsRead), catchAsync(async (req, res, next) => {
  const { notificationIds } = req.body;
  const userId = req.user._id;
  
  const result = await Notification.markAsRead(userId, notificationIds);
  
  res.status(200).json({
    status: 'success',
    message: `${result.modifiedCount} notifications marked as read`,
    data: { modifiedCount: result.modifiedCount }
  });
}));

// POST /api/v1/notifications/mark-all-read - Mark all notifications as read
router.post('/mark-all-read', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  
  const result = await Notification.markAllAsRead(userId);
  
  res.status(200).json({
    status: 'success',
    message: `${result.modifiedCount} notifications marked as read`,
    data: { modifiedCount: result.modifiedCount }
  });
}));

// DELETE /api/v1/notifications/:id - Delete notification
router.delete('/:id', catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;
  
  const notification = await Notification.findOneAndDelete({ _id: id, userId });
  
  if (!notification) {
    return next(new ApplicationError('Notification not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Notification deleted successfully'
  });
}));

// PATCH /api/v1/notifications/preferences - Update notification preferences
router.patch('/preferences', validate(schemas.updateNotificationPreferences), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { channel, settings } = req.body;
  
  const preferences = await NotificationPreference.updateChannelSettings(userId, channel, settings);
  
  res.status(200).json({
    status: 'success',
    message: 'Notification preferences updated successfully',
    data: { preferences }
  });
}));

// PATCH /api/v1/notifications/preferences/:channel/:type - Update specific notification type setting
router.patch('/preferences/:channel/:type', validate(schemas.updateNotificationType), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { channel, type } = req.params;
  const { enabled } = req.body;
  
  const preferences = await NotificationPreference.updateTypeSettings(userId, channel, type, enabled);
  
  res.status(200).json({
    status: 'success',
    message: 'Notification type setting updated successfully',
    data: { preferences }
  });
}));

// POST /api/v1/notifications/test - Send test notification
router.post('/test', validate(schemas.sendTestNotification), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { channel, type } = req.body;

  // Get user preferences
  const preferences = await NotificationPreference.findOne({ userId });
  if (!preferences) {
    return next(new ApplicationError('Notification preferences not found', 404));
  }

  // Check if channel is enabled
  if (!preferences[channel] || !preferences[channel].enabled) {
    return next(new ApplicationError(`${channel} notifications are not enabled`, 400));
  }

  // Create test notification
  const testNotification = new Notification({
    userId,
    hotelId: preferences.hotelId,
    type: type || 'system_alert',
    title: 'Test Notification',
    message: 'This is a test notification to verify your settings.',
    channels: [channel],
    priority: 'medium',
    metadata: {
      category: 'system',
      tags: ['test']
    }
  });

  await testNotification.save();

  // TODO: Implement actual notification sending logic here
  // For now, just mark as sent
  await testNotification.markAsSent(channel);

  res.status(200).json({
    status: 'success',
    message: 'Test notification sent successfully',
    data: { notification: testNotification }
  });
}));

// POST /api/v1/notifications/subscribe - Subscribe to notification types
router.post('/subscribe', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { subscriptions } = req.body;

  if (!subscriptions || typeof subscriptions !== 'object') {
    throw new ApplicationError('Subscriptions object is required', 400);
  }

  // Get or create preferences
  const preferences = await NotificationPreference.getOrCreate(userId, req.user.hotelId);

  // Update subscription settings
  Object.keys(subscriptions).forEach(channel => {
    if (preferences[channel]) {
      Object.assign(preferences[channel], subscriptions[channel]);
    }
  });

  await preferences.save();

  res.status(200).json({
    status: 'success',
    message: 'Subscriptions updated successfully',
    data: { preferences }
  });
}));

// GET /api/v1/notifications/stream - Enhanced Server-sent events for real-time notifications (PLAN 1)
router.get('/stream', authenticate, (req, res) => {
  const userId = req.user._id.toString();
  const userRole = req.user.role;

  console.log(`[SSE] New connection from user ${userId} (${userRole})`);

  // Set headers for SSE with enhanced configuration
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering
    'X-Content-Type-Options': 'nosniff'
  });

  // Send initial connection event
  res.write(`event: connection\n`);
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    message: `Connected to notification stream`,
    userId,
    role: userRole,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Enhanced heartbeat with timestamp
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat ${Date.now()}\n\n`);
  }, 30000); // Every 30 seconds

  // Connection health check
  let lastPing = Date.now();
  const healthCheck = setInterval(() => {
    const timeSinceLastPing = Date.now() - lastPing;
    if (timeSinceLastPing > 120000) { // 2 minutes without activity
      console.log(`[SSE] Connection timeout for user ${userId}`);
      cleanup();
    }
    lastPing = Date.now();
  }, 60000); // Check every minute

  // Enhanced notification handler with event types
  const notificationHandler = (notification) => {
    try {
      // Determine event type based on notification
      let eventType = 'notification:new';

      if (notification.type === 'notification_read') {
        eventType = 'notification:read';
      } else if (notification.type === 'notification_deleted') {
        eventType = 'notification:deleted';
      }

      // Send as custom event type
      res.write(`event: ${eventType}\n`);
      res.write(`id: ${notification.id || Date.now()}\n`);
      res.write(`data: ${JSON.stringify({
        ...notification,
        timestamp: new Date().toISOString(),
        eventType
      })}\n\n`);

      console.log(`[SSE] Sent ${eventType} to user ${userId}:`, notification.type);
    } catch (error) {
      console.error(`[SSE] Error sending notification to user ${userId}:`, error);
    }
  };

  // Listen for user-specific notifications
  notificationEmitter.on(`user:${userId}`, notificationHandler);

  // Listen for role-specific notifications (if user is admin/manager)
  if (['admin', 'manager'].includes(userRole)) {
    const roleHandler = (notification) => {
      res.write(`event: notification:role\n`);
      res.write(`data: ${JSON.stringify({
        ...notification,
        timestamp: new Date().toISOString(),
        eventType: 'notification:role'
      })}\n\n`);
    };

    notificationEmitter.on(`role:${userRole}`, roleHandler);

    // Store role handler for cleanup
    req.roleHandler = roleHandler;
  }

  // Listen for hotel-wide urgent notifications
  const hotelId = req.user.hotelId?.toString();
  if (hotelId) {
    const urgentHandler = (notification) => {
      if (notification.priority === 'urgent' || notification.priority === 'high') {
        res.write(`event: notification:urgent\n`);
        res.write(`data: ${JSON.stringify({
          ...notification,
          timestamp: new Date().toISOString(),
          eventType: 'notification:urgent'
        })}\n\n`);
      }
    };

    notificationEmitter.on(`hotel:${hotelId}:urgent`, urgentHandler);
    req.urgentHandler = urgentHandler;
  }

  // Connection cleanup function
  const cleanup = () => {
    console.log(`[SSE] Cleaning up connection for user ${userId}`);

    try {
      // Clear intervals
      clearInterval(heartbeat);
      clearInterval(healthCheck);

      // Remove event listeners
      notificationEmitter.removeListener(`user:${userId}`, notificationHandler);

      if (req.roleHandler) {
        notificationEmitter.removeListener(`role:${userRole}`, req.roleHandler);
      }

      if (req.urgentHandler && hotelId) {
        notificationEmitter.removeListener(`hotel:${hotelId}:urgent`, req.urgentHandler);
      }

      // End response safely
      if (!res.headersSent) {
        res.end();
      }
    } catch (error) {
      console.error(`[SSE] Error during cleanup for user ${userId}:`, error);
    }
  };

  // Handle various disconnect scenarios
  req.on('close', cleanup);
  req.on('end', cleanup);
  res.on('close', cleanup);
  res.on('finish', cleanup);

  // Handle connection errors
  req.on('error', (error) => {
    console.error(`[SSE] Request error for user ${userId}:`, error);
    cleanup();
  });

  res.on('error', (error) => {
    console.error(`[SSE] Response error for user ${userId}:`, error);
    cleanup();
  });

  // Send initial status update after 1 second
  setTimeout(() => {
    try {
      res.write(`event: status\n`);
      res.write(`data: ${JSON.stringify({
        type: 'status',
        message: 'SSE connection established and ready',
        connectedUsers: notificationEmitter.listenerCount(`user:${userId}`),
        timestamp: new Date().toISOString()
      })}\n\n`);
    } catch (error) {
      console.error(`[SSE] Error sending initial status:`, error);
    }
  }, 1000);

  console.log(`[SSE] Successfully established connection for user ${userId}`);
});

// DELETE /api/v1/notifications/bulk - Delete multiple notifications
router.delete('/bulk', validate(schemas.deleteNotifications), catchAsync(async (req, res, next) => {
  const { notificationIds } = req.body;
  const userId = req.user._id;

  const result = await Notification.deleteMany({
    _id: { $in: notificationIds },
    userId
  });

  res.status(200).json({
    status: 'success',
    message: `${result.deletedCount} notifications deleted successfully`,
    data: { deletedCount: result.deletedCount }
  });
}));

// TEMPLATE MANAGEMENT ROUTES

// GET /api/v1/notifications/templates - Get all templates for hotel
router.get('/templates', catchAsync(async (req, res, next) => {
  const { category, type, search, limit = 20, page = 1 } = req.query;
  const hotelId = req.user.hotelId;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build query
  const query = {
    hotelId,
    'metadata.isActive': true
  };

  if (category) {
    query.category = category;
  }

  if (type) {
    query.type = type;
  }

  let templates;

  if (search) {
    templates = await NotificationTemplate.search(hotelId, search)
      .skip(skip)
      .limit(parseInt(limit));
  } else {
    templates = await NotificationTemplate.find(query)
      .sort({ 'usage.timesUsed': -1, name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('metadata.createdBy', 'firstName lastName email')
      .populate('metadata.updatedBy', 'firstName lastName email');
  }

  const total = await NotificationTemplate.countDocuments(query);

  res.status(200).json({
    status: 'success',
    data: {
      templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

// GET /api/v1/notifications/templates/:id - Get specific template
router.get('/templates/:id', catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const hotelId = req.user.hotelId;

  const template = await NotificationTemplate.findOne({
    _id: id,
    hotelId,
    'metadata.isActive': true
  })
    .populate('metadata.createdBy', 'firstName lastName email')
    .populate('metadata.updatedBy', 'firstName lastName email');

  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { template }
  });
}));

// POST /api/v1/notifications/templates - Create new template
router.post('/templates', catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const userId = req.user._id;

  // Check if user has admin role for template creation
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to create templates', 403);
  }

  const templateData = {
    ...req.body,
    hotelId,
    metadata: {
      createdBy: userId,
      isSystem: false
    }
  };

  const template = new NotificationTemplate(templateData);
  await template.save();

  await template.populate('metadata.createdBy', 'firstName lastName email');

  res.status(201).json({
    status: 'success',
    message: 'Template created successfully',
    data: { template }
  });
}));

// PATCH /api/v1/notifications/templates/:id - Update template
router.patch('/templates/:id', catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const hotelId = req.user.hotelId;
  const userId = req.user._id;

  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to update templates', 403);
  }

  const template = await NotificationTemplate.findOne({
    _id: id,
    hotelId,
    'metadata.isActive': true
  });

  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  // Don't allow updating system templates
  if (template.metadata.isSystem && req.user.role !== 'admin') {
    throw new ApplicationError('Cannot modify system templates', 403);
  }

  // Update template
  const updateData = {
    ...req.body,
    metadata: {
      ...template.metadata,
      updatedBy: userId,
      version: template.metadata.version + 1
    }
  };

  Object.assign(template, updateData);
  await template.save();

  await template.populate('metadata.updatedBy', 'firstName lastName email');

  res.status(200).json({
    status: 'success',
    message: 'Template updated successfully',
    data: { template }
  });
}));

// DELETE /api/v1/notifications/templates/:id - Delete (deactivate) template
router.delete('/templates/:id', catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const hotelId = req.user.hotelId;

  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to delete templates', 403);
  }

  const template = await NotificationTemplate.findOne({
    _id: id,
    hotelId,
    'metadata.isActive': true
  });

  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  // Don't allow deleting system templates
  if (template.metadata.isSystem && req.user.role !== 'admin') {
    throw new ApplicationError('Cannot delete system templates', 403);
  }

  // Soft delete by marking as inactive
  template.metadata.isActive = false;
  await template.save();

  res.status(200).json({
    status: 'success',
    message: 'Template deleted successfully'
  });
}));

// POST /api/v1/notifications/templates/:id/preview - Preview template with variables
router.post('/templates/:id/preview', catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { variables = {} } = req.body;
  const hotelId = req.user.hotelId;

  const template = await NotificationTemplate.findOne({
    _id: id,
    hotelId,
    'metadata.isActive': true
  });

  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  // Validate variables
  const validationErrors = template.validateVariables(variables);
  if (validationErrors.length > 0) {
    throw new ApplicationError('Variable validation failed', 400, { errors: validationErrors });
  }

  // Generate preview
  const preview = template.populateTemplate(variables);

  res.status(200).json({
    status: 'success',
    data: {
      preview,
      template: {
        name: template.name,
        description: template.description,
        variables: template.variables
      }
    }
  });
}));

// GET /api/v1/notifications/templates/categories/:category - Get templates by category
router.get('/templates/categories/:category', catchAsync(async (req, res, next) => {
  const { category } = req.params;
  const hotelId = req.user.hotelId;

  const templates = await NotificationTemplate.getByCategory(hotelId, category);

  res.status(200).json({
    status: 'success',
    data: { templates }
  });
}));

// GET /api/v1/notifications/templates/types/:type - Get template by type
router.get('/templates/types/:type', catchAsync(async (req, res, next) => {
  const { type } = req.params;
  const hotelId = req.user.hotelId;

  const template = await NotificationTemplate.getByType(hotelId, type);

  if (!template) {
    throw new ApplicationError('No template found for this type', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { template }
  });
}));

// GET /api/v1/notifications/templates/analytics/performance - Get template performance stats
router.get('/templates/analytics/performance', catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;

  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to view analytics', 403);
  }

  const performanceStats = await NotificationTemplate.getPerformanceStats(hotelId);

  // Get most used templates
  const mostUsed = await NotificationTemplate.getMostUsed(hotelId, 10);

  res.status(200).json({
    status: 'success',
    data: {
      performanceStats,
      mostUsed
    }
  });
}));

// POST /api/v1/notifications/templates/initialize - Initialize default templates for hotel
router.post('/templates/initialize', catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const userId = req.user._id;

  // Check permissions - only admin can initialize
  if (req.user.role !== 'admin') {
    throw new ApplicationError('Insufficient permissions to initialize templates', 403);
  }

  // Check if templates already exist
  const existingCount = await NotificationTemplate.countDocuments({
    hotelId,
    'metadata.isActive': true
  });

  if (existingCount > 0) {
    throw new ApplicationError('Templates already initialized for this hotel', 400);
  }

  // Create default templates
  const templates = await NotificationTemplate.createDefaultTemplates(hotelId, userId);

  res.status(201).json({
    status: 'success',
    message: `${templates.length} default templates created successfully`,
    data: { templates }
  });
}));

// MONITORING AND PERFORMANCE ROUTES

// GET /api/v1/notifications/monitoring/health - Get system health status
router.get('/monitoring/health', catchAsync(async (req, res, next) => {
  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to view monitoring data', 403);
  }

  const healthStatus = await optimizedNotificationService.getHealthStatus();

  res.status(200).json({
    status: 'success',
    data: healthStatus
  });
}));

// GET /api/v1/notifications/monitoring/performance - Get performance metrics
router.get('/monitoring/performance', catchAsync(async (req, res, next) => {
  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to view performance data', 403);
  }

  const hotelId = req.user.hotelId;

  // Get various performance metrics
  const [volumeData, successRateData, channelData, recentActivity] = await Promise.all([
    // Volume data - last 24 hours
    Notification.aggregate([
      {
        $match: {
          hotelId,
          createdAt: {
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%H:00',
              date: '$createdAt'
            }
          },
          sent: { $sum: 1 },
          delivered: {
            $sum: {
              $cond: [
                { $in: ['$status', ['delivered', 'read']] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          time: '$_id',
          sent: 1,
          delivered: 1
        }
      },
      { $sort: { time: 1 } }
    ]),

    // Success rate data - last 7 days
    Notification.aggregate([
      {
        $match: {
          hotelId,
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          total: { $sum: 1 },
          successful: {
            $sum: {
              $cond: [
                { $in: ['$status', ['delivered', 'read']] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          time: '$_id',
          rate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$successful', '$total'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { time: 1 } }
    ]),

    // Channel distribution - last 7 days
    Notification.aggregate([
      {
        $match: {
          hotelId,
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $unwind: '$channels'
      },
      {
        $group: {
          _id: '$channels',
          value: { $sum: 1 }
        }
      },
      {
        $project: {
          name: '$_id',
          value: 1,
          _id: 0
        }
      }
    ]),

    // Recent activity - last 50 notifications
    Notification.find({ hotelId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('type status channels metadata.templateName createdAt')
      .lean()
  ]);

  // Format recent activity
  const formattedActivity = recentActivity.map(notification => ({
    type: notification.type,
    status: notification.status,
    template: notification.metadata?.templateName || 'Unknown',
    channel: notification.channels?.[0] || 'unknown',
    timestamp: notification.createdAt
  }));

  res.status(200).json({
    status: 'success',
    data: {
      volumeData,
      successRateData,
      channelData,
      recentActivity: formattedActivity
    }
  });
}));

// GET /api/v1/notifications/monitoring/rate-limits - Get rate limit status
router.get('/monitoring/rate-limits', catchAsync(async (req, res, next) => {
  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to view rate limit data', 403);
  }

  const hotelId = req.user.hotelId;
  const userId = req.user._id;

  const rateLimitStatus = await rateLimiter.getRateLimitStatus(hotelId, userId);

  res.status(200).json({
    status: 'success',
    data: rateLimitStatus
  });
}));

// POST /api/v1/notifications/monitoring/rate-limits/reset - Reset rate limits
router.post('/monitoring/rate-limits/reset', catchAsync(async (req, res, next) => {
  // Check permissions - only admin can reset rate limits
  if (req.user.role !== 'admin') {
    throw new ApplicationError('Insufficient permissions to reset rate limits', 403);
  }

  const { type, identifier } = req.body;

  if (!type || !identifier) {
    throw new ApplicationError('Type and identifier are required', 400);
  }

  const success = await rateLimiter.resetRateLimits(type, identifier);

  if (!success) {
    throw new ApplicationError('Failed to reset rate limits', 500);
  }

  res.status(200).json({
    status: 'success',
    message: 'Rate limits reset successfully'
  });
}));

// GET /api/v1/notifications/monitoring/metrics - Get detailed metrics
router.get('/monitoring/metrics', catchAsync(async (req, res, next) => {
  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to view metrics', 403);
  }

  const hotelId = req.user.hotelId;
  const { timeframe = '24h' } = req.query;

  let startDate;
  switch (timeframe) {
    case '1h':
      startDate = new Date(Date.now() - 60 * 60 * 1000);
      break;
    case '24h':
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  const metrics = await Notification.aggregate([
    {
      $match: {
        hotelId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $facet: {
        // Total counts by status
        statusCounts: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ],

        // Counts by priority
        priorityCounts: [
          {
            $group: {
              _id: '$priority',
              count: { $sum: 1 }
            }
          }
        ],

        // Counts by type
        typeCounts: [
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ],

        // Average response time
        responseTime: [
          {
            $match: {
              readAt: { $exists: true }
            }
          },
          {
            $addFields: {
              responseTime: {
                $divide: [
                  { $subtract: ['$readAt', '$createdAt'] },
                  1000 * 60 // Convert to minutes
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              avgResponseTime: { $avg: '$responseTime' },
              minResponseTime: { $min: '$responseTime' },
              maxResponseTime: { $max: '$responseTime' }
            }
          }
        ]
      }
    }
  ]);

  // Get service statistics
  const serviceStats = optimizedNotificationService.getStatistics();

  // Get rate limiter metrics
  const rateLimiterMetrics = await rateLimiter.getMetrics();

  res.status(200).json({
    status: 'success',
    data: {
      timeframe,
      startDate,
      aggregations: metrics[0] || {},
      service: serviceStats,
      rateLimiter: rateLimiterMetrics
    }
  });
}));

// POST /api/v1/notifications/monitoring/cleanup - Trigger cleanup
router.post('/monitoring/cleanup', catchAsync(async (req, res, next) => {
  // Check permissions - only admin can trigger cleanup
  if (req.user.role !== 'admin') {
    throw new ApplicationError('Insufficient permissions to trigger cleanup', 403);
  }

  const result = await optimizedNotificationService.cleanup();

  res.status(200).json({
    status: 'success',
    message: 'Cleanup completed successfully',
    data: result
  });
}));

// POST /api/v1/notifications/monitoring/flush-queue - Force flush notification queue
router.post('/monitoring/flush-queue', catchAsync(async (req, res, next) => {
  // Check permissions - only admin can flush queue
  if (req.user.role !== 'admin') {
    throw new ApplicationError('Insufficient permissions to flush queue', 403);
  }

  await optimizedNotificationService.flushQueue();

  res.status(200).json({
    status: 'success',
    message: 'Notification queue flushed successfully'
  });
}));

export default router;
