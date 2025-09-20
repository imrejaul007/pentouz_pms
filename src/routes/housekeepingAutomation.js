import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Housekeeping Automation
 *   description: Automated housekeeping task management during checkout processing
 */

/**
 * @swagger
 * /api/v1/housekeeping-automation/process-checkout:
 *   post:
 *     summary: Process comprehensive housekeeping automation for checkout
 *     tags: [Housekeeping Automation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - roomId
 *             properties:
 *               bookingId:
 *                 type: string
 *               roomId:
 *                 type: string
 *               options:
 *                 type: object
 *                 properties:
 *                   autoAssignTasks:
 *                     type: boolean
 *                   nextBookingDate:
 *                     type: string
 *                     format: date-time
 *                   roomWasSmoking:
 *                     type: boolean
 *                   requiresDeepClean:
 *                     type: boolean
 *                   requiresMaintenance:
 *                     type: boolean
 *                   requiresSetup:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Housekeeping automation completed successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Booking or room not found
 */
router.post('/process-checkout', authorize('admin', 'manager', 'staff'), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { bookingId, roomId, options = {} } = req.body;

  if (!bookingId || !roomId) {
    throw new ApplicationError('Booking ID and Room ID are required', 400);
  }

  // Import housekeeping automation service
  const { default: housekeepingAutomationService } = await import('../services/housekeepingAutomationService.js');
  
  const result = await housekeepingAutomationService.processCheckoutHousekeeping(
    bookingId,
    roomId,
    userId,
    {
      hotelId,
      ...options
    }
  );

  res.status(200).json({
    status: 'success',
    message: 'Housekeeping automation completed successfully',
    data: result
  });
}));

/**
 * @swagger
 * /api/v1/housekeeping-automation/tasks:
 *   get:
 *     summary: Get housekeeping tasks
 *     tags: [Housekeeping Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, assigned, in_progress, completed, cancelled]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: taskType
 *         schema:
 *           type: string
 *           enum: [cleaning, maintenance, inspection, deep_clean, checkout_clean]
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tasks retrieved successfully
 */
router.get('/tasks', authorize('admin', 'manager', 'staff'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { status, priority, taskType, roomId, assignedTo } = req.query;

  // Import models
  const Housekeeping = (await import('../models/Housekeeping.js')).default;
  
  const filter = { hotelId };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (taskType) filter.taskType = taskType;
  if (roomId) filter.roomId = roomId;
  if (assignedTo) filter.assignedTo = assignedTo;

  const tasks = await Housekeeping.find(filter)
    .populate('roomId', 'roomNumber type floor')
    .populate('assignedTo', 'name email')
    .populate('assignedToUserId', 'name email') // For backward compatibility
    .sort({ priority: 1, createdAt: -1 });

  res.status(200).json({
    status: 'success',
    data: { 
      tasks,
      totalCount: tasks.length
    }
  });
}));

/**
 * @swagger
 * /api/v1/housekeeping-automation/tasks/{taskId}:
 *   get:
 *     summary: Get housekeeping task by ID
 *     tags: [Housekeeping Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task retrieved successfully
 *       404:
 *         description: Task not found
 */
router.get('/tasks/:taskId', authorize('admin', 'manager', 'staff'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { taskId } = req.params;

  // Import models
  const Housekeeping = (await import('../models/Housekeeping.js')).default;
  
  const task = await Housekeeping.findOne({ _id: taskId, hotelId })
    .populate('roomId', 'roomNumber type floor')
    .populate('assignedTo', 'name email')
    .populate('assignedToUserId', 'name email'); // For backward compatibility

  if (!task) {
    throw new ApplicationError('Housekeeping task not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { task }
  });
}));

/**
 * @swagger
 * /api/v1/housekeeping-automation/tasks/{taskId}/assign:
 *   put:
 *     summary: Assign task to staff member
 *     tags: [Housekeeping Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - staffId
 *             properties:
 *               staffId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Task assigned successfully
 *       404:
 *         description: Task or staff member not found
 */
router.put('/tasks/:taskId/assign', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { taskId } = req.params;
  const { staffId } = req.body;

  if (!staffId) {
    throw new ApplicationError('Staff ID is required', 400);
  }

  // Import models and services
  const Housekeeping = (await import('../models/Housekeeping.js')).default;
  const User = (await import('../models/User.js')).default;
  
  const task = await Housekeeping.findOne({ _id: taskId, hotelId });
  if (!task) {
    throw new ApplicationError('Housekeeping task not found', 404);
  }

  const staff = await User.findOne({ _id: staffId, hotelId, isActive: true });
  if (!staff) {
    throw new ApplicationError('Staff member not found or inactive', 404);
  }

  task.assignedTo = staffId;
  task.assignedToUserId = staffId; // For backward compatibility
  task.status = 'assigned';
  await task.save();

  res.status(200).json({
    status: 'success',
    message: 'Task assigned successfully',
    data: { 
      taskId,
      assignedTo: staffId,
      assignedToName: staff.name
    }
  });
}));

/**
 * @swagger
 * /api/v1/housekeeping-automation/tasks/{taskId}/start:
 *   put:
 *     summary: Start housekeeping task
 *     tags: [Housekeeping Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task started successfully
 *       404:
 *         description: Task not found
 */
router.put('/tasks/:taskId/start', authorize('admin', 'manager', 'staff'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { taskId } = req.params;

  // Import models
  const Housekeeping = (await import('../models/Housekeeping.js')).default;
  
  const task = await Housekeeping.findOne({ _id: taskId, hotelId });
  if (!task) {
    throw new ApplicationError('Housekeeping task not found', 404);
  }

  if (task.status !== 'assigned' && task.status !== 'pending') {
    throw new ApplicationError('Task cannot be started in current status', 400);
  }

  task.status = 'in_progress';
  task.startedAt = new Date();
  await task.save();

  res.status(200).json({
    status: 'success',
    message: 'Task started successfully',
    data: { 
      taskId,
      status: task.status,
      startedAt: task.startedAt
    }
  });
}));

/**
 * @swagger
 * /api/v1/housekeeping-automation/tasks/{taskId}/complete:
 *   put:
 *     summary: Complete housekeeping task
 *     tags: [Housekeeping Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               actualDuration:
 *                 type: number
 *                 description: Actual duration in minutes
 *               notes:
 *                 type: string
 *               beforeImages:
 *                 type: array
 *                 items:
 *                   type: string
 *               afterImages:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Task completed successfully
 *       404:
 *         description: Task not found
 */
router.put('/tasks/:taskId/complete', authorize('admin', 'manager', 'staff'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { taskId } = req.params;
  const { actualDuration, notes, beforeImages, afterImages } = req.body;

  // Import models
  const Housekeeping = (await import('../models/Housekeeping.js')).default;
  
  const task = await Housekeeping.findOne({ _id: taskId, hotelId });
  if (!task) {
    throw new ApplicationError('Housekeeping task not found', 404);
  }

  if (task.status !== 'in_progress') {
    throw new ApplicationError('Task must be in progress to complete', 400);
  }

  task.status = 'completed';
  task.completedAt = new Date();
  if (actualDuration) task.actualDuration = actualDuration;
  if (notes) task.notes = notes;
  if (beforeImages) task.beforeImages = beforeImages;
  if (afterImages) task.afterImages = afterImages;

  await task.save();

  res.status(200).json({
    status: 'success',
    message: 'Task completed successfully',
    data: { 
      taskId,
      status: task.status,
      completedAt: task.completedAt,
      actualDuration: task.actualDuration
    }
  });
}));

/**
 * @swagger
 * /api/v1/housekeeping-automation/available-staff:
 *   get:
 *     summary: Get available housekeeping staff
 *     tags: [Housekeeping Automation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available staff retrieved successfully
 */
router.get('/available-staff', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  // Import models
  const User = (await import('../models/User.js')).default;
  
  const staff = await User.find({
    hotelId,
    role: { $in: ['housekeeping', 'staff'] },
    isActive: true
  }).select('_id name email role');

  res.status(200).json({
    status: 'success',
    data: { 
      staff,
      totalCount: staff.length
    }
  });
}));

/**
 * @swagger
 * /api/v1/housekeeping-automation/statistics:
 *   get:
 *     summary: Get housekeeping automation statistics
 *     tags: [Housekeeping Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/statistics', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { startDate, endDate } = req.query;

  const dateRange = {};
  if (startDate) dateRange.startDate = new Date(startDate);
  if (endDate) dateRange.endDate = new Date(endDate);

  // Import housekeeping automation service
  const { default: housekeepingAutomationService } = await import('../services/housekeepingAutomationService.js');
  
  const statistics = await housekeepingAutomationService.getHousekeepingStatistics(hotelId, dateRange);

  res.status(200).json({
    status: 'success',
    data: { statistics }
  });
}));

/**
 * @swagger
 * /api/v1/housekeeping-automation/auto-assign:
 *   post:
 *     summary: Auto-assign pending tasks to available staff
 *     tags: [Housekeeping Automation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               taskIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Specific task IDs to assign (optional)
 *               priority:
 *                 type: string
 *                 enum: [urgent, high, medium, low]
 *                 description: Only assign tasks with this priority or higher
 *     responses:
 *       200:
 *         description: Auto-assignment completed successfully
 */
router.post('/auto-assign', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { taskIds, priority } = req.body;

  // Import models
  const Housekeeping = (await import('../models/Housekeeping.js')).default;
  const User = (await import('../models/User.js')).default;
  
  // Build filter for tasks to assign
  const filter = { 
    hotelId, 
    status: 'pending',
    $or: [
      { assignedTo: { $exists: false } },
      { assignedTo: null }
    ]
  };
  
  if (taskIds && taskIds.length > 0) {
    filter._id = { $in: taskIds };
  }
  
  if (priority) {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const priorities = Object.keys(priorityOrder).filter(p => priorityOrder[p] <= priorityOrder[priority]);
    filter.priority = { $in: priorities };
  }

  const pendingTasks = await Housekeeping.find(filter).sort({ priority: 1, createdAt: 1 });
  const availableStaff = await User.find({
    hotelId,
    role: { $in: ['housekeeping', 'staff'] },
    isActive: true
  }).select('_id name email');

  if (availableStaff.length === 0) {
    throw new ApplicationError('No available staff found for assignment', 400);
  }

  let assignedCount = 0;
  let staffIndex = 0;

  for (const task of pendingTasks) {
    const staff = availableStaff[staffIndex % availableStaff.length];
    
    task.assignedTo = staff._id;
    task.assignedToUserId = staff._id; // For backward compatibility
    task.status = 'assigned';
    await task.save();
    
    assignedCount++;
    staffIndex++;
  }

  res.status(200).json({
    status: 'success',
    message: 'Auto-assignment completed successfully',
    data: { 
      assignedCount,
      totalPendingTasks: pendingTasks.length,
      availableStaff: availableStaff.length
    }
  });
}));

export default router;
