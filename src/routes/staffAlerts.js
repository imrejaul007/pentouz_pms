import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import StaffAlert from '../models/StaffAlert.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import logger from '../utils/logger.js';
import websocketService from '../services/websocketService.js';

const router = express.Router();

// @desc    Get staff alerts summary
// @route   GET /api/v1/staff/alerts/summary
// @access  Private (staff, admin, manager)
router.get('/summary', authenticate, authorize('staff', 'admin', 'manager'), asyncHandler(async (req, res) => {
  const { hotelId } = req.user;

  // Get alert counts by status and priority
  const [
    totalAlerts,
    unacknowledgedAlerts,
    criticalAlerts,
    urgentAlerts,
    alertsByCategory
  ] = await Promise.all([
    StaffAlert.countDocuments({ hotelId }),
    StaffAlert.countDocuments({ hotelId, status: 'active' }),
    StaffAlert.countDocuments({ hotelId, priority: 'critical', status: { $in: ['active', 'acknowledged', 'in_progress'] } }),
    StaffAlert.countDocuments({ hotelId, priority: 'urgent', status: { $in: ['active', 'acknowledged', 'in_progress'] } }),
    StaffAlert.aggregate([
      { $match: { hotelId } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ])
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      totalAlerts,
      unacknowledgedAlerts,
      criticalAlerts,
      urgentAlerts,
      alertsByCategory: alertsByCategory.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    }
  });
}));

// @desc    Get all staff alerts
// @route   GET /api/v1/staff/alerts
// @access  Private (staff, admin, manager)
router.get('/', authenticate, authorize('staff', 'admin', 'manager'), asyncHandler(async (req, res) => {
  const { hotelId } = req.user;
  const {
    status = 'all',
    priority = 'all',
    category = 'all',
    limit = 50,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build filter
  const filter = { hotelId };

  if (status !== 'all') {
    filter.status = status;
  }

  if (priority !== 'all') {
    filter.priority = priority;
  }

  if (category !== 'all') {
    filter.category = category;
  }

  // Build sort
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const alerts = await StaffAlert.find(filter)
    .sort(sort)
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email role');

  const totalCount = await StaffAlert.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    results: alerts.length,
    total: totalCount,
    data: {
      alerts
    }
  });
}));

// @desc    Create new staff alert
// @route   POST /api/v1/staff/alerts
// @access  Private (staff, admin, manager)
router.post('/', authenticate, authorize('staff', 'admin', 'manager'), asyncHandler(async (req, res) => {
  const { hotelId, _id: createdBy } = req.user;

  const alertData = {
    ...req.body,
    hotelId,
    createdBy,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const alert = await StaffAlert.create(alertData);
  await alert.populate('assignedTo', 'name email role');
  await alert.populate('createdBy', 'name email role');

  // Emit real-time notification
  try {
    await websocketService.broadcastToHotel(hotelId, 'staff-alert:created', alert);

    // Send to specific assigned user if specified
    if (alert.assignedTo) {
      await websocketService.sendToUser(alert.assignedTo._id, 'staff-alert:assigned', alert);
    }

    // Send to all staff/admin/managers
    await websocketService.broadcastToRole('staff', 'staff-alert:created', alert);
    await websocketService.broadcastToRole('admin', 'staff-alert:created', alert);
    await websocketService.broadcastToRole('manager', 'staff-alert:created', alert);
  } catch (wsError) {
    logger.warn('Failed to broadcast staff alert creation', { error: wsError.message, alertId: alert._id });
  }

  res.status(201).json({
    status: 'success',
    data: {
      alert
    }
  });
}));

// @desc    Update staff alert
// @route   PUT /api/v1/staff/alerts/:id
// @access  Private (staff, admin, manager)
router.put('/:id', authenticate, authorize('staff', 'admin', 'manager'), asyncHandler(async (req, res) => {
  const { hotelId, _id: userId } = req.user;

  let alert = await StaffAlert.findOne({
    _id: req.params.id,
    hotelId
  });

  if (!alert) {
    return res.status(404).json({
      status: 'error',
      message: 'Staff alert not found'
    });
  }

  // Update alert
  const updateData = {
    ...req.body,
    updatedAt: new Date(),
    lastUpdatedBy: userId
  };

  alert = await StaffAlert.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  )
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email role')
    .populate('lastUpdatedBy', 'name email role');

  // Emit real-time notification
  try {
    await websocketService.broadcastToHotel(hotelId, 'staff-alert:updated', alert);

    // Send to assigned user if specified
    if (alert.assignedTo) {
      await websocketService.sendToUser(alert.assignedTo._id, 'staff-alert:updated', alert);
    }

    // Send to all staff/admin/managers
    await websocketService.broadcastToRole('staff', 'staff-alert:updated', alert);
    await websocketService.broadcastToRole('admin', 'staff-alert:updated', alert);
    await websocketService.broadcastToRole('manager', 'staff-alert:updated', alert);
  } catch (wsError) {
    logger.warn('Failed to broadcast staff alert update', { error: wsError.message, alertId: alert._id });
  }

  res.status(200).json({
    status: 'success',
    data: {
      alert
    }
  });
}));

// @desc    Acknowledge staff alert
// @route   PATCH /api/v1/staff/alerts/:id/acknowledge
// @access  Private (staff, admin, manager)
router.patch('/:id/acknowledge', authenticate, authorize('staff', 'admin', 'manager'), asyncHandler(async (req, res) => {
  const { hotelId, _id: userId } = req.user;

  let alert = await StaffAlert.findOne({
    _id: req.params.id,
    hotelId
  });

  if (!alert) {
    return res.status(404).json({
      status: 'error',
      message: 'Staff alert not found'
    });
  }

  // Update alert status
  alert = await StaffAlert.findByIdAndUpdate(
    req.params.id,
    {
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
      updatedAt: new Date()
    },
    { new: true, runValidators: true }
  )
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email role')
    .populate('acknowledgedBy', 'name email role');

  // Emit real-time notification
  try {
    await websocketService.broadcastToHotel(hotelId, 'staff-alert:acknowledged', alert);

    // Send to all staff/admin/managers
    await websocketService.broadcastToRole('staff', 'staff-alert:acknowledged', alert);
    await websocketService.broadcastToRole('admin', 'staff-alert:acknowledged', alert);
    await websocketService.broadcastToRole('manager', 'staff-alert:acknowledged', alert);
  } catch (wsError) {
    logger.warn('Failed to broadcast staff alert acknowledgment', { error: wsError.message, alertId: alert._id });
  }

  res.status(200).json({
    status: 'success',
    data: {
      alert
    }
  });
}));

// @desc    Delete staff alert
// @route   DELETE /api/v1/staff/alerts/:id
// @access  Private (admin, manager)
router.delete('/:id', authenticate, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { hotelId } = req.user;

  const alert = await StaffAlert.findOne({
    _id: req.params.id,
    hotelId
  });

  if (!alert) {
    return res.status(404).json({
      status: 'error',
      message: 'Staff alert not found'
    });
  }

  await StaffAlert.findByIdAndDelete(req.params.id);

  // Emit real-time notification
  try {
    await websocketService.broadcastToHotel(hotelId, 'staff-alert:deleted', { alertId: req.params.id });

    // Send to all staff/admin/managers
    await websocketService.broadcastToRole('staff', 'staff-alert:deleted', { alertId: req.params.id });
    await websocketService.broadcastToRole('admin', 'staff-alert:deleted', { alertId: req.params.id });
    await websocketService.broadcastToRole('manager', 'staff-alert:deleted', { alertId: req.params.id });
  } catch (wsError) {
    logger.warn('Failed to broadcast staff alert deletion', { error: wsError.message, alertId: req.params.id });
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
}));

export default router;