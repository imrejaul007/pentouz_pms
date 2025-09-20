import express from 'express';
import Notification from '../models/Notification.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin', 'staff'));

/**
 * @swagger
 * /dashboard-updates/notifications:
 *   get:
 *     summary: Get real-time notifications for admin dashboard
 *     tags: [Dashboard Updates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *         description: Get notifications since this timestamp
 *       - in: query
 *         name: types
 *         schema:
 *           type: string
 *         description: Comma-separated list of notification types
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Real-time notifications
 */
router.get('/notifications', catchAsync(async (req, res) => {
  const { since, types, limit = 50 } = req.query;
  const hotelId = req.user.hotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required for staff users', 400);
  }

  // Build query
  const query = { hotelId };

  // Filter by timestamp if provided
  if (since) {
    query.createdAt = { $gt: new Date(since) };
  }

  // Filter by notification types if provided
  if (types) {
    const typeArray = types.split(',').map(t => t.trim());
    query.type = { $in: typeArray };
  }

  // Get recent notifications
  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .populate('metadata.guestId', 'name email')
    .populate('metadata.bookingId', 'bookingNumber checkIn checkOut');

  // Get counts by category for summary
  const categoryCounts = await Notification.aggregate([
    { $match: query },
    { $group: { _id: '$metadata.category', count: { $sum: 1 } } }
  ]);

  res.json({
    status: 'success',
    data: {
      notifications,
      counts: {
        total: notifications.length,
        byCategory: categoryCounts.reduce((acc, item) => {
          acc[item._id || 'other'] = item.count;
          return acc;
        }, {})
      },
      timestamp: new Date()
    }
  });
}));

/**
 * @swagger
 * /dashboard-updates/activity-feed:
 *   get:
 *     summary: Get live activity feed for dashboard
 *     tags: [Dashboard Updates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *         description: Get activities since this timestamp
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Activity feed
 */
router.get('/activity-feed', catchAsync(async (req, res) => {
  const { since, limit = 20 } = req.query;
  const hotelId = req.user.hotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required for staff users', 400);
  }

  // Build query for user activity notifications
  const query = { 
    hotelId,
    type: { $in: ['user_activity', 'booking_created', 'payment_update', 'booking_cancelled', 'service_request', 'review_created'] }
  };

  // Filter by timestamp if provided
  if (since) {
    query.createdAt = { $gt: new Date(since) };
  }

  // Get recent activities
  const activities = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .populate('metadata.guestId', 'name email avatar')
    .populate('metadata.bookingId', 'bookingNumber')
    .select('title message type createdAt metadata priority');

  // Format activities for dashboard display
  const formattedActivities = activities.map(activity => ({
    id: activity._id,
    type: activity.type,
    title: activity.title,
    message: activity.message,
    timestamp: activity.createdAt,
    priority: activity.priority,
    user: activity.metadata?.guestId ? {
      name: activity.metadata.guestId.name,
      email: activity.metadata.guestId.email,
      avatar: activity.metadata.guestId.avatar
    } : null,
    booking: activity.metadata?.bookingId ? {
      number: activity.metadata.bookingId.bookingNumber
    } : null,
    amount: activity.metadata?.amount,
    currency: activity.metadata?.currency
  }));

  res.json({
    status: 'success',
    data: {
      activities: formattedActivities,
      count: formattedActivities.length,
      timestamp: new Date()
    }
  });
}));

/**
 * @swagger
 * /dashboard-updates/summary:
 *   get:
 *     summary: Get dashboard summary with recent activity counts
 *     tags: [Dashboard Updates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary
 */
router.get('/summary', catchAsync(async (req, res) => {
  const hotelId = req.user.hotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required for staff users', 400);
  }

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get counts for different time periods
  const [
    todayActivities,
    last24HoursActivities,
    unreadNotifications,
    criticalAlerts
  ] = await Promise.all([
    Notification.countDocuments({
      hotelId,
      createdAt: { $gte: startOfDay },
      type: { $ne: 'data_refresh' }
    }),
    Notification.countDocuments({
      hotelId,
      createdAt: { $gte: last24Hours },
      type: { $ne: 'data_refresh' }
    }),
    Notification.countDocuments({
      hotelId,
      status: { $in: ['sent', 'delivered'] },
      type: { $ne: 'data_refresh' }
    }),
    Notification.countDocuments({
      hotelId,
      priority: 'high',
      status: { $ne: 'read' },
      type: { $ne: 'data_refresh' }
    })
  ]);

  // Get activity breakdown by type
  const activityBreakdown = await Notification.aggregate([
    {
      $match: {
        hotelId,
        createdAt: { $gte: startOfDay },
        type: { $ne: 'data_refresh' }
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    status: 'success',
    data: {
      summary: {
        todayActivities,
        last24HoursActivities,
        unreadNotifications,
        criticalAlerts
      },
      breakdown: activityBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      lastUpdated: new Date()
    }
  });
}));

/**
 * @swagger
 * /dashboard-updates/mark-read:
 *   patch:
 *     summary: Mark notifications as read
 *     tags: [Dashboard Updates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notificationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               markAllRead:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Notifications marked as read
 */
router.patch('/mark-read', catchAsync(async (req, res) => {
  const { notificationIds, markAllRead } = req.body;
  const hotelId = req.user.hotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required for staff users', 400);
  }

  let updateQuery = { hotelId };
  
  if (markAllRead) {
    // Mark all notifications as read
    updateQuery = { hotelId, status: { $in: ['sent', 'delivered'] } };
  } else if (notificationIds && notificationIds.length > 0) {
    // Mark specific notifications as read
    updateQuery._id = { $in: notificationIds };
  } else {
    throw new ApplicationError('Either notificationIds or markAllRead must be provided', 400);
  }

  const result = await Notification.updateMany(
    updateQuery,
    { 
      status: 'read',
      readAt: new Date()
    }
  );

  res.json({
    status: 'success',
    data: {
      markedCount: result.modifiedCount,
      timestamp: new Date()
    }
  });
}));

export default router;