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
 *   name: Inventory Automation
 *   description: Automated inventory management during checkout processing
 */

/**
 * @swagger
 * /api/v1/inventory-automation/process-checkout:
 *   post:
 *     summary: Process comprehensive inventory automation for checkout
 *     tags: [Inventory Automation]
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
 *                   isAdminBypass:
 *                     type: boolean
 *                   forceRoutineCheck:
 *                     type: boolean
 *                   roomCondition:
 *                     type: string
 *                     enum: [normal, dirty, very_dirty, damaged, unused]
 *     responses:
 *       200:
 *         description: Inventory automation completed successfully
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

  // Import inventory automation service
  const { default: inventoryAutomationService } = await import('../services/inventoryAutomationService.js');
  
  const result = await inventoryAutomationService.processCheckoutInventory(
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
    message: 'Inventory automation completed successfully',
    data: result
  });
}));

/**
 * @swagger
 * /api/v1/inventory-automation/assess-room/{roomId}:
 *   get:
 *     summary: Assess room inventory condition
 *     tags: [Inventory Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: roomCondition
 *         schema:
 *           type: string
 *           enum: [normal, dirty, very_dirty, damaged, unused]
 *     responses:
 *       200:
 *         description: Room inventory assessment completed
 *       404:
 *         description: Room not found
 */
router.get('/assess-room/:roomId', authorize('admin', 'manager', 'staff'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { roomId } = req.params;
  const { roomCondition } = req.query;

  // Import inventory automation service
  const { default: inventoryAutomationService } = await import('../services/inventoryAutomationService.js');
  
  const assessment = await inventoryAutomationService.assessRoomInventory(roomId, {
    roomCondition
  });

  res.status(200).json({
    status: 'success',
    data: { assessment }
  });
}));

/**
 * @swagger
 * /api/v1/inventory-automation/statistics:
 *   get:
 *     summary: Get inventory automation statistics
 *     tags: [Inventory Automation]
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

  // Import inventory automation service
  const { default: inventoryAutomationService } = await import('../services/inventoryAutomationService.js');
  
  const statistics = await inventoryAutomationService.getInventoryStatistics(hotelId, dateRange);

  res.status(200).json({
    status: 'success',
    data: { statistics }
  });
}));

/**
 * @swagger
 * /api/v1/inventory-automation/rooms-needing-attention:
 *   get:
 *     summary: Get rooms needing inventory attention
 *     tags: [Inventory Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [clean, dirty, maintenance, inspection_required, damaged, out_of_order]
 *     responses:
 *       200:
 *         description: Rooms retrieved successfully
 */
router.get('/rooms-needing-attention', authorize('admin', 'manager', 'staff'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { priority, status } = req.query;

  // Import models
  const RoomInventory = (await import('../models/RoomInventory.js')).default;
  
  const filter = { hotelId, isActive: true };
  if (status) filter.status = status;

  const rooms = await RoomInventory.find(filter)
    .populate('roomId', 'roomNumber type floor')
    .populate('currentBookingId', 'bookingNumber checkIn checkOut')
    .sort({ lastInspectionDate: 1 });

  // Filter by priority if specified
  let filteredRooms = rooms;
  if (priority) {
    filteredRooms = rooms.filter(room => {
      const conditionScore = room.conditionScore || 0;
      switch (priority) {
        case 'urgent':
          return conditionScore < 30 || room.maintenanceRequired;
        case 'high':
          return conditionScore < 50;
        case 'medium':
          return conditionScore < 70;
        case 'low':
          return conditionScore >= 70;
        default:
          return true;
      }
    });
  }

  res.status(200).json({
    status: 'success',
    data: { 
      rooms: filteredRooms,
      totalCount: filteredRooms.length
    }
  });
}));

/**
 * @swagger
 * /api/v1/inventory-automation/replacement-items/{roomId}:
 *   get:
 *     summary: Get items needing replacement for a room
 *     tags: [Inventory Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Replacement items retrieved successfully
 *       404:
 *         description: Room not found
 */
router.get('/replacement-items/:roomId', authorize('admin', 'manager', 'staff'), catchAsync(async (req, res) => {
  const { roomId } = req.params;

  // Import inventory automation service
  const { default: inventoryAutomationService } = await import('../services/inventoryAutomationService.js');
  
  // First assess the room
  const assessment = await inventoryAutomationService.assessRoomInventory(roomId);
  
  // Then identify replacement items
  const replacementItems = await inventoryAutomationService.identifyReplacementItems(
    roomId,
    assessment,
    {}
  );

  res.status(200).json({
    status: 'success',
    data: { 
      assessment: assessment.summary,
      replacementItems
    }
  });
}));

/**
 * @swagger
 * /api/v1/inventory-automation/update-room-status/{roomId}:
 *   put:
 *     summary: Update room inventory status
 *     tags: [Inventory Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
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
 *                 enum: [clean, dirty, maintenance, inspection_required, damaged, out_of_order]
 *               maintenanceNotes:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     condition:
 *                       type: string
 *                     needsReplacement:
 *                       type: boolean
 *                     replacementReason:
 *                       type: string
 *     responses:
 *       200:
 *         description: Room status updated successfully
 *       404:
 *         description: Room not found
 */
router.put('/update-room-status/:roomId', authorize('admin', 'manager', 'staff'), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { roomId } = req.params;
  const { status, maintenanceNotes, items } = req.body;

  // Import models
  const RoomInventory = (await import('../models/RoomInventory.js')).default;
  
  const roomInventory = await RoomInventory.findOne({ roomId, hotelId });
  if (!roomInventory) {
    throw new ApplicationError('Room inventory not found', 404);
  }

  // Update room status
  if (status) {
    roomInventory.status = status;
  }

  if (maintenanceNotes) {
    roomInventory.maintenanceNotes = maintenanceNotes;
    roomInventory.maintenanceRequired = true;
  }

  // Update individual items
  if (items && Array.isArray(items)) {
    for (const itemUpdate of items) {
      const item = roomInventory.items.id(itemUpdate.itemId);
      if (item) {
        if (itemUpdate.condition) item.condition = itemUpdate.condition;
        if (itemUpdate.needsReplacement !== undefined) item.needsReplacement = itemUpdate.needsReplacement;
        if (itemUpdate.replacementReason) item.replacementReason = itemUpdate.replacementReason;
        item.lastCheckedDate = new Date();
        item.checkedBy = userId;
      }
    }
  }

  await roomInventory.save();

  res.status(200).json({
    status: 'success',
    message: 'Room status updated successfully',
    data: { 
      roomId,
      newStatus: roomInventory.status,
      maintenanceRequired: roomInventory.maintenanceRequired
    }
  });
}));

export default router;
