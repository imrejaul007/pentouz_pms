import express from 'express';
import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate, schemas } from '../middleware/validation.js';

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
      unreadCount
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

// GET /api/v1/notifications/types - Get available notification types
router.get('/types', catchAsync(async (req, res, next) => {
  const notificationTypes = [
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
    data: { notificationTypes }
  });
}));

// GET /api/v1/notifications/channels - Get available notification channels
router.get('/channels', catchAsync(async (req, res, next) => {
  const channels = [
    {
      id: 'email',
      name: 'Email',
      description: 'Receive notifications via email',
      icon: 'mail',
      defaultEnabled: true,
      supportsQuietHours: true,
      supportsFrequency: true
    },
    {
      id: 'sms',
      name: 'SMS',
      description: 'Receive notifications via text message',
      icon: 'message-circle',
      defaultEnabled: false,
      supportsQuietHours: true,
      supportsFrequency: false
    },
    {
      id: 'push',
      name: 'Push Notifications',
      description: 'Receive notifications on your device',
      icon: 'bell',
      defaultEnabled: true,
      supportsQuietHours: true,
      supportsFrequency: false
    },
    {
      id: 'in_app',
      name: 'In-App',
      description: 'Receive notifications within the app',
      icon: 'smartphone',
      defaultEnabled: true,
      supportsQuietHours: false,
      supportsFrequency: false
    }
  ];
  
  res.status(200).json({
    status: 'success',
    data: { channels }
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

export default router;
