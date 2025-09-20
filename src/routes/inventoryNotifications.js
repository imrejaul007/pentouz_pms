import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import inventoryNotificationService from '../services/inventoryNotificationService.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

/**
 * Get inventory notifications for admin
 */
router.get('/', catchAsync(async (req, res) => {
  const { _id: userId, hotelId } = req.user;
  const { limit = 50, offset = 0 } = req.query;

  const notifications = await inventoryNotificationService.getInventoryNotifications(
    userId, 
    hotelId,
    parseInt(limit)
  );

  // Get unread count
  const unreadCount = await inventoryNotificationService.getUnreadInventoryCount(userId, hotelId);

  res.status(200).json({
    status: 'success',
    results: notifications.length,
    data: {
      notifications,
      unreadCount,
      hasMore: notifications.length === parseInt(limit)
    }
  });
}));

/**
 * Mark inventory notifications as read
 */
router.patch('/mark-read', catchAsync(async (req, res) => {
  const { _id: userId } = req.user;
  const { notificationIds } = req.body;

  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    return res.status(400).json({
      status: 'fail',
      message: 'notificationIds array is required'
    });
  }

  const result = await inventoryNotificationService.markInventoryNotificationsRead(
    userId, 
    notificationIds
  );

  res.status(200).json({
    status: 'success',
    data: {
      modifiedCount: result.modifiedCount
    }
  });
}));

/**
 * Get unread inventory notification count
 */
router.get('/unread-count', catchAsync(async (req, res) => {
  const { _id: userId, hotelId } = req.user;

  const unreadCount = await inventoryNotificationService.getUnreadInventoryCount(userId, hotelId);

  res.status(200).json({
    status: 'success',
    data: {
      unreadCount
    }
  });
}));

/**
 * Get inventory notification summary for dashboard
 */
router.get('/summary', catchAsync(async (req, res) => {
  const { _id: userId, hotelId } = req.user;

  // Get recent notifications (last 7 days)
  const recent = await inventoryNotificationService.getInventoryNotifications(userId, hotelId, 20);
  const unreadCount = await inventoryNotificationService.getUnreadInventoryCount(userId, hotelId);

  // Categorize notifications
  const summary = {
    total: recent.length,
    unread: unreadCount,
    categories: {
      damage: recent.filter(n => n.type === 'inventory_damage').length,
      missing: recent.filter(n => n.type === 'inventory_missing').length,
      charges: recent.filter(n => n.type === 'inventory_guest_charged').length,
      checkout_issues: recent.filter(n => n.type === 'checkout_inspection_failed').length,
      low_stock: recent.filter(n => n.type === 'inventory_low_stock').length
    },
    recent: recent.slice(0, 5).map(notification => ({
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      createdAt: notification.createdAt,
      isRead: notification.status === 'read',
      metadata: notification.metadata
    }))
  };

  res.status(200).json({
    status: 'success',
    data: summary
  });
}));

export default router;
