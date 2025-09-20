import express from 'express';
import mongoose from 'mongoose';
import MaintenanceTask from '../models/MaintenanceTask.js';
import Room from '../models/Room.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /maintenance:
 *   post:
 *     summary: Create a new maintenance task
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - type
 *               - priority
 *             properties:
 *               roomId:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [plumbing, electrical, hvac, cleaning, carpentry, painting, appliance, safety, other]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent, emergency]
 *               category:
 *                 type: string
 *                 enum: [preventive, corrective, emergency, inspection]
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               estimatedDuration:
 *                 type: number
 *               estimatedCost:
 *                 type: number
 *               materials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitCost:
 *                       type: number
 *               roomOutOfOrder:
 *                 type: boolean
 *               isRecurring:
 *                 type: boolean
 *               recurringSchedule:
 *                 type: object
 *                 properties:
 *                   frequency:
 *                     type: string
 *                     enum: [daily, weekly, monthly, quarterly, yearly]
 *                   interval:
 *                     type: number
 *     responses:
 *       201:
 *         description: Maintenance task created successfully
 */
router.post('/', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const taskData = {
    ...req.body,
    hotelId: req.user.role === 'staff' ? req.user.hotelId : req.body.hotelId,
    reportedBy: req.user._id
  };

  // Validate hotel access for admin users
  if (req.user.role === 'admin' && !req.body.hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // If roomId provided, verify it belongs to the hotel
  if (taskData.roomId) {
    const room = await Room.findById(taskData.roomId);
    if (!room || room.hotelId.toString() !== taskData.hotelId.toString()) {
      throw new ApplicationError('Invalid room for this hotel', 400);
    }

    // Update room status if out of order
    if (taskData.roomOutOfOrder) {
      room.status = 'maintenance';
      await room.save();
    }
  }

  const task = await MaintenanceTask.create(taskData);
  
  await task.populate([
    { path: 'hotelId', select: 'name' },
    { path: 'roomId', select: 'number type' },
    { path: 'reportedBy', select: 'name' }
  ]);

  res.status(201).json({
    status: 'success',
    data: { task }
  });
}));

/**
 * @swagger
 * /maintenance:
 *   get:
 *     summary: Get maintenance tasks
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of maintenance tasks
 */
router.get('/', catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    priority,
    assignedTo,
    roomId,
    overdue
  } = req.query;

  const query = {};

  // Role-based filtering
  if (req.user.role === 'staff') {
    query.hotelId = req.user.hotelId;
    // Staff users should only see tasks assigned to them
    query.assignedTo = req.user._id;
  } else if (req.user.role === 'admin' && req.query.hotelId) {
    query.hotelId = req.query.hotelId;
  }

  // Apply filters
  if (status) query.status = status;
  if (type) query.type = type;
  if (priority) query.priority = priority;
  if (assignedTo) query.assignedTo = assignedTo;
  if (roomId) query.roomId = roomId;

  // Filter overdue tasks
  if (overdue === 'true') {
    query.dueDate = { $lt: new Date() };
    query.status = { $in: ['pending', 'assigned', 'in_progress'] };
  }

  const skip = (page - 1) * limit;
  
  const [tasks, total] = await Promise.all([
    MaintenanceTask.find(query)
      .populate('hotelId', 'name')
      .populate('roomId', 'number type floor')
      .populate('assignedTo', 'name')
      .populate('reportedBy', 'name')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit)),
    MaintenanceTask.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /maintenance/stats:
 *   get:
 *     summary: Get maintenance statistics
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
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
 *         description: Maintenance statistics
 */
router.get('/stats', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const [stats, overdueTasks, upcomingRecurring] = await Promise.all([
    MaintenanceTask.getMaintenanceStats(hotelId, startDate, endDate),
    MaintenanceTask.getOverdueTasks(hotelId),
    MaintenanceTask.getUpcomingRecurringTasks(hotelId, 30)
  ]);

  // Get overall summary
  const matchQuery = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    ...(startDate && endDate ? {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    } : {})
  };

  const overallStats = await MaintenanceTask.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        avgDuration: {
          $avg: {
            $cond: [
              { $and: [
                { $ne: ['$actualDuration', null] },
                { $gt: ['$actualDuration', 0] }
              ]},
              '$actualDuration',
              null
            ]
          }
        },
        totalCost: { $sum: '$actualCost' },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        assigned: {
          $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] }
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
        },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        emergencyTasks: {
          $sum: { $cond: [{ $eq: ['$priority', 'emergency'] }, 1, 0] }
        }
      }
    }
  ]);

  const statsData = overallStats[0] || {
    total: 0,
    pending: 0,
    assigned: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    avgDuration: 0,
    totalCost: 0
  };

  // Add overdue count to stats
  statsData.overdueCount = overdueTasks.length;

  res.json({
    status: 'success',
    data: {
      ...statsData,
      byType: stats,
      overdueTasks: overdueTasks.length,
      upcomingRecurring: upcomingRecurring.length,
      overdueDetails: overdueTasks.slice(0, 10), // First 10 overdue tasks
      upcomingDetails: upcomingRecurring.slice(0, 10) // First 10 upcoming tasks
    }
  });
}));

/**
 * @swagger
 * /maintenance/available-staff:
 *   get:
 *     summary: Get available staff members for task assignment
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Available staff members
 */
router.get('/available-staff', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Get staff members from the same hotel
  const User = mongoose.model('User');
  const staffMembers = await User.find({
    hotelId: hotelId,
    role: 'staff',
    isActive: true
  }).select('_id name email department');

  res.json({
    status: 'success',
    data: staffMembers
  });
}));

/**
 * @swagger
 * /maintenance/available-rooms:
 *   get:
 *     summary: Get available rooms for maintenance tasks
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Available rooms
 */
router.get('/available-rooms', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Get rooms from the same hotel
  const Room = mongoose.model('Room');
  console.log('Looking for rooms with hotelId:', hotelId);
  const rooms = await Room.find({
    hotelId: hotelId,
    status: { $ne: 'out_of_order' } // Exclude out of order rooms
  }).select('_id roomNumber type floor');
  console.log('Query result - rooms found:', rooms.length);

  console.log('Fetched rooms from backend:', rooms); // Add this line for debugging
  res.json({
    status: 'success',
    data: rooms
  });
}));

/**
 * @swagger
 * /maintenance/{id}:
 *   get:
 *     summary: Get specific maintenance task
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Maintenance task details
 */
router.get('/:id', catchAsync(async (req, res) => {
  const task = await MaintenanceTask.findById(req.params.id)
    .populate('hotelId', 'name contact')
    .populate('roomId', 'number type floor amenities')
    .populate('assignedTo', 'name email phone')
    .populate('reportedBy', 'name email');

  if (!task) {
    throw new ApplicationError('Maintenance task not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && task.hotelId._id.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only view tasks for your hotel', 403);
  }

  res.json({
    status: 'success',
    data: { task }
  });
}));

/**
 * @swagger
 * /maintenance/{id}:
 *   patch:
 *     summary: Update maintenance task
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               assignedTo:
 *                 type: string
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               actualDuration:
 *                 type: number
 *               actualCost:
 *                 type: number
 *               completionNotes:
 *                 type: string
 *               materials:
 *                 type: array
 *               images:
 *                 type: array
 *     responses:
 *       200:
 *         description: Task updated successfully
 */
router.patch('/:id', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { id } = req.params;
  console.log('🔧 PATCH /maintenance/:id - Updating task:', {
    id,
    updates: req.body,
    user: req.user.email,
    userRole: req.user.role,
    userHotelId: req.user.hotelId
  });

  const task = await MaintenanceTask.findById(id);

  if (!task) {
    console.log('❌ Task not found:', id);
    throw new ApplicationError('Maintenance task not found', 404);
  }

  console.log('✅ Task found:', {
    taskId: task._id,
    hotelId: task.hotelId,
    userHotelId: req.user.hotelId,
    currentStatus: task.status,
    title: task.title
  });

  // Check access permissions
  if (req.user.role === 'staff' && task.hotelId.toString() !== req.user.hotelId.toString()) {
    console.log('❌ Permission denied - hotel mismatch:', {
      taskHotelId: task.hotelId.toString(),
      userHotelId: req.user.hotelId.toString(),
      userRole: req.user.role
    });
    throw new ApplicationError('You can only update tasks for your hotel', 403);
  }

  const allowedUpdates = [
    'status', 'assignedTo', 'scheduledDate', 'actualDuration', 'actualCost',
    'completionNotes', 'materials', 'images', 'notes', 'dueDate', 'priority',
    'vendor', 'vendorRequired'
  ];

  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  console.log('🔄 Applying updates:', updates);

  Object.assign(task, updates);

  // Special handling for status updates
  if (updates.status) {
    task.updatedAt = new Date();
    if (updates.status === 'in_progress' && !task.startedAt) {
      task.startedAt = new Date();
      task.assignedTo = task.assignedTo || req.user._id;
    } else if (updates.status === 'completed' && !task.completedAt) {
      task.completedAt = new Date();
    }
    console.log(`🔄 Status changed from "${task.status}" to "${updates.status}"`);
  }

  await task.save();
  console.log('✅ Task saved successfully');

  // Handle room status updates
  if (updates.status === 'completed' && task.roomId && task.roomOutOfOrder) {
    const room = await Room.findById(task.roomId);
    if (room && room.status === 'maintenance') {
      room.status = 'vacant_dirty'; // Room needs cleaning after maintenance
      await room.save();
      console.log('🏠 Room status updated after task completion');
    }
  }

  await task.populate([
    { path: 'hotelId', select: 'name' },
    { path: 'roomId', select: 'number type' },
    { path: 'assignedTo', select: 'name' }
  ]);

  console.log('✅ Task update completed successfully:', {
    taskId: task._id,
    newStatus: task.status,
    assignedTo: task.assignedTo?.name || 'Unassigned'
  });

  res.json({
    status: 'success',
    data: { task }
  });
}));

/**
 * @swagger
 * /maintenance/{id}/assign:
 *   post:
 *     summary: Assign maintenance task to staff member
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - assignedTo
 *             properties:
 *               assignedTo:
 *                 type: string
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Task assigned successfully
 */
router.post('/:id/assign', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { assignedTo, scheduledDate, notes } = req.body;
  
  const task = await MaintenanceTask.findById(req.params.id);
  
  if (!task) {
    throw new ApplicationError('Maintenance task not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && task.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only assign tasks for your hotel', 403);
  }

  await task.assignTask(assignedTo, scheduledDate);
  
  if (notes) {
    task.notes = notes;
    await task.save();
  }

  await task.populate([
    { path: 'assignedTo', select: 'name email' }
  ]);

  res.json({
    status: 'success',
    message: 'Task assigned successfully',
    data: { task }
  });
}));

/**
 * @swagger
 * /maintenance/overdue:
 *   get:
 *     summary: Get overdue maintenance tasks
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Overdue maintenance tasks
 */
router.get('/overdue', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // For staff users, only show overdue tasks assigned to them
  const staffFilter = req.user.role === 'staff' ? { assignedTo: req.user._id } : {};
  const overdueTasks = await MaintenanceTask.getOverdueTasks(hotelId, staffFilter);

  res.json({
    status: 'success',
    data: {
      tasks: overdueTasks,
      count: overdueTasks.length
    }
  });
}));

/**
 * @swagger
 * /maintenance/recurring/upcoming:
 *   get:
 *     summary: Get upcoming recurring maintenance tasks
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Upcoming recurring maintenance tasks
 */
router.get('/recurring/upcoming', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { days = 30 } = req.query;
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // For staff users, only show upcoming tasks assigned to them
  const staffFilter = req.user.role === 'staff' ? { assignedTo: req.user._id } : {};
  const upcomingTasks = await MaintenanceTask.getUpcomingRecurringTasks(hotelId, parseInt(days), staffFilter);

  res.json({
    status: 'success',
    data: {
      tasks: upcomingTasks,
      count: upcomingTasks.length
    }
  });
}));

export default router;
