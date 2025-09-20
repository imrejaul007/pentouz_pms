import express from 'express';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import StaffTask from '../models/StaffTask.js';
import Room from '../models/Room.js';
import InventoryItem from '../models/InventoryItem.js';
import inventoryNotificationService from '../services/inventoryNotificationService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * Get staff member's tasks
 */
router.get('/my-tasks', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const {
    status,
    taskType,
    priority,
    dueDate,
    limit = 50,
    skip = 0
  } = req.query;

  const tasks = await StaffTask.getStaffTasks(req.user._id, {
    status,
    taskType,
    priority,
    dueDate,
    limit: parseInt(limit),
    skip: parseInt(skip)
  });

  res.json({
    status: 'success',
    results: tasks.length,
    data: { tasks }
  });
}));

/**
 * Get today's tasks for staff member
 */
router.get('/today', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const tasks = await StaffTask.getTodaysTasks(req.user._id);

  res.json({
    status: 'success',
    results: tasks.length,
    data: { tasks }
  });
}));

/**
 * Get specific task details
 */
router.get('/:taskId', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const task = await StaffTask.findById(req.params.taskId)
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .populate('roomIds', 'roomNumber type floor status')
    .populate('inventoryItems.itemId', 'name category unitPrice stockThreshold')
    .populate('verifiedBy', 'name email');

  if (!task) {
    throw new ApplicationError('Task not found', 404);
  }

  // Staff can only view their own tasks unless they're admin
  if (req.user.role === 'staff' && task.assignedTo._id.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only view your own tasks', 403);
  }

  res.json({
    status: 'success',
    data: { task }
  });
}));

/**
 * Update task status
 */
router.patch('/:taskId/status', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { status, completionNotes, completionData } = req.body;

  const task = await StaffTask.findById(req.params.taskId);
  if (!task) {
    throw new ApplicationError('Task not found', 404);
  }

  // Staff can only update their own tasks
  if (req.user.role === 'staff' && task.assignedTo.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only update your own tasks', 403);
  }

  // Validate status transition
  const validStatuses = ['assigned', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new ApplicationError('Invalid status', 400);
  }

  // Update task
  task.status = status;
  if (completionNotes) task.completionNotes = completionNotes;
  if (completionData) task.completionData = { ...task.completionData, ...completionData };

  // Handle specific status changes
  if (status === 'in_progress' && !task.startedAt) {
    task.startedAt = new Date();
  } else if (status === 'completed') {
    task.completedAt = new Date();
    
    // Calculate actual duration
    if (task.startedAt) {
      const totalMinutes = Math.floor((task.completedAt.getTime() - task.startedAt.getTime()) / (1000 * 60));
      task.actualDuration = totalMinutes - (task.pausedDuration || 0);
    }

    // Create recurring task if applicable
    if (task.isRecurring) {
      await createRecurringTask(task);
    }
  }

  await task.save();

  // Populate for response
  await task.populate([
    { path: 'roomIds', select: 'roomNumber type' },
    { path: 'assignedTo', select: 'name email' }
  ]);

  res.json({
    status: 'success',
    data: { task }
  });
}));

/**
 * Update task progress (for partial completion tracking)
 */
router.patch('/:taskId/progress', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { progressData } = req.body;

  const task = await StaffTask.findById(req.params.taskId);
  if (!task) {
    throw new ApplicationError('Task not found', 404);
  }

  if (req.user.role === 'staff' && task.assignedTo.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only update your own tasks', 403);
  }

  await task.updateProgress(progressData);

  res.json({
    status: 'success',
    data: { task }
  });
}));

/**
 * Add completion photo to task
 */
router.post('/:taskId/photos', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { photoUrl, description } = req.body;

  const task = await StaffTask.findById(req.params.taskId);
  if (!task) {
    throw new ApplicationError('Task not found', 404);
  }

  if (req.user.role === 'staff' && task.assignedTo.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only update your own tasks', 403);
  }

  await task.addCompletionPhoto(photoUrl, description);

  res.json({
    status: 'success',
    data: { task }
  });
}));

/**
 * Create new task (admin only)
 */
router.post('/', authorize('admin'), catchAsync(async (req, res) => {
  const taskData = {
    ...req.body,
    hotelId: req.user.hotelId,
    createdBy: req.user._id
  };

  // Validate room IDs if provided
  if (taskData.roomIds && taskData.roomIds.length > 0) {
    const rooms = await Room.find({
      _id: { $in: taskData.roomIds },
      hotelId: req.user.hotelId
    });
    
    if (rooms.length !== taskData.roomIds.length) {
      throw new ApplicationError('Some rooms not found or don\'t belong to your hotel', 400);
    }
  }

  // Validate inventory items if provided
  if (taskData.inventoryItems && taskData.inventoryItems.length > 0) {
    const itemIds = taskData.inventoryItems.map(item => item.itemId);
    const items = await InventoryItem.find({
      _id: { $in: itemIds },
      hotelId: req.user.hotelId
    });
    
    if (items.length !== itemIds.length) {
      throw new ApplicationError('Some inventory items not found or don\'t belong to your hotel', 400);
    }
  }

  const task = await StaffTask.create(taskData);
  
  await task.populate([
    { path: 'assignedTo', select: 'name email' },
    { path: 'roomIds', select: 'roomNumber type' },
    { path: 'inventoryItems.itemId', select: 'name category' }
  ]);

  // Send notification to assigned staff member
  await inventoryNotificationService.notifyTaskAssignment(task);

  res.status(201).json({
    status: 'success',
    data: { task }
  });
}));

/**
 * Get all tasks for hotel (admin only)
 */
router.get('/', authorize('admin'), catchAsync(async (req, res) => {
  const {
    assignedTo,
    status,
    taskType,
    priority,
    startDate,
    endDate,
    limit = 100,
    skip = 0,
    sortBy = '-createdAt'
  } = req.query;

  let query = { hotelId: req.user.hotelId };

  if (assignedTo) query.assignedTo = assignedTo;
  if (status) query.status = status;
  if (taskType) query.taskType = taskType;
  if (priority) query.priority = priority;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const [tasks, total] = await Promise.all([
    StaffTask.find(query)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('roomIds', 'roomNumber type')
      .sort(sortBy)
      .limit(parseInt(limit))
      .skip(parseInt(skip)),
    StaffTask.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    results: tasks.length,
    totalCount: total,
    data: { tasks }
  });
}));

/**
 * Get overdue tasks for hotel (admin only)
 */
router.get('/overdue', authorize('admin'), catchAsync(async (req, res) => {
  const tasks = await StaffTask.getOverdueTasks(req.user.hotelId);

  res.json({
    status: 'success',
    results: tasks.length,
    data: { tasks }
  });
}));

/**
 * Get task statistics for hotel (admin only)
 */
router.get('/stats', authorize('admin'), catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const stats = await StaffTask.getTaskStats(req.user.hotelId, startDate, endDate);

  res.json({
    status: 'success',
    data: { stats: stats[0] || {} }
  });
}));

/**
 * Delete task (admin only)
 */
router.delete('/:taskId', authorize('admin'), catchAsync(async (req, res) => {
  const task = await StaffTask.findOne({
    _id: req.params.taskId,
    hotelId: req.user.hotelId
  });

  if (!task) {
    throw new ApplicationError('Task not found', 404);
  }

  // Don't allow deletion of completed tasks with important data
  if (task.status === 'completed' && task.completionData) {
    throw new ApplicationError('Cannot delete completed tasks with completion data', 400);
  }

  await StaffTask.findByIdAndDelete(req.params.taskId);

  res.status(204).json({
    status: 'success',
    data: null
  });
}));

/**
 * Create daily inventory check tasks for all rooms
 */
router.post('/create-daily-inventory-checks', authorize('admin'), catchAsync(async (req, res) => {
  const { assignedTo, dueDate = new Date() } = req.body;

  if (!assignedTo) {
    throw new ApplicationError('Staff member must be assigned', 400);
  }

  // Get all active rooms
  const rooms = await Room.find({
    hotelId: req.user.hotelId,
    isActive: true,
    status: { $nin: ['out_of_order', 'maintenance'] }
  });

  if (rooms.length === 0) {
    throw new ApplicationError('No available rooms for inventory checks', 400);
  }

  // Create tasks for each room or batch them
  const tasks = [];
  const roomsPerTask = 5; // Adjust based on workload
  
  for (let i = 0; i < rooms.length; i += roomsPerTask) {
    const roomBatch = rooms.slice(i, i + roomsPerTask);
    
    const task = await StaffTask.create({
      hotelId: req.user.hotelId,
      assignedTo,
      createdBy: req.user._id,
      taskType: 'daily_inventory_check',
      title: `Daily Inventory Check - Rooms ${roomBatch.map(r => r.roomNumber).join(', ')}`,
      description: `Perform daily inventory check for rooms: ${roomBatch.map(r => r.roomNumber).join(', ')}`,
      priority: 'medium',
      dueDate: new Date(dueDate),
      roomIds: roomBatch.map(r => r._id),
      estimatedDuration: roomBatch.length * 15, // 15 minutes per room
      isRecurring: true,
      recurringPattern: 'daily'
    });

    tasks.push(task);
  }

  // Populate tasks for response
  const populatedTasks = await StaffTask.find({
    _id: { $in: tasks.map(t => t._id) }
  })
  .populate('assignedTo', 'name email')
  .populate('roomIds', 'roomNumber type');

  res.status(201).json({
    status: 'success',
    results: tasks.length,
    data: { tasks: populatedTasks }
  });
}));

// Helper function to create recurring tasks
async function createRecurringTask(originalTask) {
  if (!originalTask.isRecurring || !originalTask.recurringPattern) return;

  const nextDue = new Date(originalTask.dueDate);
  
  switch (originalTask.recurringPattern) {
    case 'daily':
      nextDue.setDate(nextDue.getDate() + 1);
      break;
    case 'weekly':
      nextDue.setDate(nextDue.getDate() + 7);
      break;
    case 'monthly':
      nextDue.setMonth(nextDue.getMonth() + 1);
      break;
  }

  const newTask = await StaffTask.create({
    hotelId: originalTask.hotelId,
    assignedTo: originalTask.assignedTo,
    createdBy: originalTask.createdBy,
    taskType: originalTask.taskType,
    title: originalTask.title,
    description: originalTask.description,
    priority: originalTask.priority,
    dueDate: nextDue,
    roomIds: originalTask.roomIds,
    inventoryItems: originalTask.inventoryItems,
    estimatedDuration: originalTask.estimatedDuration,
    isRecurring: originalTask.isRecurring,
    recurringPattern: originalTask.recurringPattern,
    tags: originalTask.tags
  });

  // Update original task's nextOccurrence
  originalTask.nextOccurrence = nextDue;
  await originalTask.save();

  return newTask;
}

export default router;