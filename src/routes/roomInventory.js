import express from 'express';
import mongoose from 'mongoose';
import InventoryItem from '../models/InventoryItem.js';
import RoomInventoryTemplate from '../models/RoomInventoryTemplate.js';
import RoomInventory from '../models/RoomInventory.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import CheckoutInspection from '../models/CheckoutInspection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/room-inventory/items:
 *   get:
 *     summary: Get all inventory items for hotel
 *     tags: [Room Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by item category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search items by name or description
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of inventory items
 */
router.get('/items', catchAsync(async (req, res) => {
  const { category, search, active = true, page = 1, limit = 50 } = req.query;
  const hotelId = req.user.hotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  let query = { hotelId };
  
  if (active !== undefined) {
    query.isActive = active === 'true';
  }
  
  if (category) {
    query.category = category;
  }

  let itemsQuery = InventoryItem.find(query);

  if (search) {
    itemsQuery = InventoryItem.searchItems(hotelId, search);
    if (category) itemsQuery = itemsQuery.where('category', category);
    if (active !== undefined) itemsQuery = itemsQuery.where('isActive', active === 'true');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const items = await itemsQuery
    .skip(skip)
    .limit(parseInt(limit))
    .sort('name');

  const total = await InventoryItem.countDocuments(query);

  res.json({
    status: 'success',
    data: {
      items,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    }
  });
}));

/**
 * @swagger
 * /api/v1/room-inventory/items:
 *   post:
 *     summary: Create new inventory item
 *     tags: [Room Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - unitPrice
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               unitPrice:
 *                 type: number
 *               replacementPrice:
 *                 type: number
 *               guestPrice:
 *                 type: number
 *               isComplimentary:
 *                 type: boolean
 *               maxComplimentary:
 *                 type: number
 *     responses:
 *       201:
 *         description: Inventory item created successfully
 */
router.post('/items', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const hotelId = req.user.hotelId;
  
  const itemData = {
    ...req.body,
    hotelId,
    createdBy: req.user._id
  };

  const item = await InventoryItem.create(itemData);

  res.status(201).json({
    status: 'success',
    data: {
      item
    }
  });
}));

/**
 * @swagger
 * /api/v1/room-inventory/items/{id}:
 *   put:
 *     summary: Update inventory item
 *     tags: [Room Inventory]
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
 *         description: Item updated successfully
 */
router.put('/items/:id', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const { id } = req.params;
  const hotelId = req.user.hotelId;

  const item = await InventoryItem.findOneAndUpdate(
    { _id: id, hotelId },
    { ...req.body, lastUpdatedBy: req.user._id },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new ApplicationError('Item not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      item
    }
  });
}));

/**
 * @swagger
 * /api/v1/room-inventory/templates:
 *   get:
 *     summary: Get inventory templates
 *     tags: [Room Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of inventory templates
 */
router.get('/templates', catchAsync(async (req, res) => {
  const hotelId = req.user.hotelId;
  const { roomType, active = true } = req.query;

  let query = { hotelId };
  if (active !== undefined) {
    query.isActive = active === 'true';
  }

  let templatesQuery = RoomInventoryTemplate.find(query).populate('items.itemId');

  if (roomType) {
    templatesQuery = templatesQuery.where('roomTypes', roomType);
  }

  const templates = await templatesQuery.sort('name');

  res.json({
    status: 'success',
    data: {
      templates
    }
  });
}));

/**
 * @swagger
 * /api/v1/room-inventory/templates:
 *   post:
 *     summary: Create inventory template
 *     tags: [Room Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Template created successfully
 */
router.post('/templates', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const hotelId = req.user.hotelId;

  const templateData = {
    ...req.body,
    hotelId,
    createdBy: req.user._id
  };

  const template = await RoomInventoryTemplate.create(templateData);
  await template.populate('items.itemId');

  res.status(201).json({
    status: 'success',
    data: {
      template
    }
  });
}));

/**
 * @swagger
 * /api/v1/room-inventory/rooms/{roomId}:
 *   get:
 *     summary: Get room inventory
 *     tags: [Room Inventory]
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
 *         description: Room inventory details
 */
router.get('/rooms/:roomId', catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const hotelId = req.user.hotelId;

  const roomInventory = await RoomInventory.findOne({ 
    roomId, 
    hotelId 
  })
  .populate('items.itemId')
  .populate('templateId')
  .populate('currentBookingId');

  if (!roomInventory) {
    throw new ApplicationError('Room inventory not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      roomInventory
    }
  });
}));

/**
 * @swagger
 * /api/v1/room-inventory/rooms/{roomId}/inspect:
 *   post:
 *     summary: Record room inspection
 *     tags: [Room Inventory]
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
 *         description: Inspection recorded successfully
 */
router.post('/rooms/:roomId/inspect', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const hotelId = req.user.hotelId;

  const roomInventory = await RoomInventory.findOne({ roomId, hotelId });
  if (!roomInventory) {
    throw new ApplicationError('Room inventory not found', 404);
  }

  const inspectionData = {
    ...req.body,
    inspectedBy: req.user._id,
    inspectionDate: new Date()
  };

  await roomInventory.recordInspection(inspectionData);

  // Update item conditions if provided
  if (req.body.itemUpdates && Array.isArray(req.body.itemUpdates)) {
    for (const update of req.body.itemUpdates) {
      await roomInventory.updateItemCondition(update.itemId, {
        condition: update.condition,
        currentQuantity: update.currentQuantity,
        needsReplacement: update.needsReplacement,
        notes: update.notes,
        checkedBy: req.user._id
      });
    }
  }

  res.json({
    status: 'success',
    data: {
      roomInventory
    }
  });
}));

/**
 * @swagger
 * /api/v1/room-inventory/rooms/{roomId}/replace:
 *   post:
 *     summary: Request item replacement
 *     tags: [Room Inventory]
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
 *         description: Replacement requested successfully
 */
router.post('/rooms/:roomId/replace', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const { items, reason, notes } = req.body;
  const hotelId = req.user.hotelId;

  const roomInventory = await RoomInventory.findOne({ roomId, hotelId });
  if (!roomInventory) {
    throw new ApplicationError('Room inventory not found', 404);
  }

  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const transactionItems = [];

      for (const item of items) {
        // Update room inventory
        await roomInventory.requestReplacement(item.itemId, reason, notes);

        // Find item details for transaction
        const inventoryItem = await InventoryItem.findById(item.itemId);
        if (inventoryItem) {
          transactionItems.push({
            itemId: item.itemId,
            name: inventoryItem.name,
            category: inventoryItem.category,
            quantityChanged: -item.quantity, // negative for removed
            unitPrice: inventoryItem.replacementPrice || inventoryItem.unitPrice,
            totalCost: (inventoryItem.replacementPrice || inventoryItem.unitPrice) * item.quantity,
            reason: 'maintenance_replacement',
            isChargeable: false, // maintenance replacements not charged to guest
            condition: item.condition || 'damaged'
          });
        }
      }

      // Create transaction record
      await InventoryTransaction.create([{
        hotelId,
        roomId,
        bookingId: roomInventory.currentBookingId,
        transactionType: 'replacement',
        items: transactionItems,
        chargedToGuest: false,
        processedBy: req.user._id,
        status: 'pending',
        notes: `Replacement requested: ${notes}`
      }], { session });
    });

    res.json({
      status: 'success',
      message: 'Replacement requested successfully'
    });
  } catch (error) {
    throw error;
  } finally {
    await session.endSession();
  }
}));

/**
 * @swagger
 * /api/v1/room-inventory/transactions:
 *   get:
 *     summary: Get inventory transactions
 *     tags: [Room Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of transactions
 */
router.get('/transactions', catchAsync(async (req, res) => {
  const hotelId = req.user.hotelId;
  const { 
    roomId, 
    transactionType, 
    status, 
    startDate, 
    endDate,
    page = 1,
    limit = 20 
  } = req.query;

  let query = { hotelId };

  if (roomId) query.roomId = roomId;
  if (transactionType) query.transactionType = transactionType;
  if (status) query.status = status;

  if (startDate || endDate) {
    query.processedAt = {};
    if (startDate) query.processedAt.$gte = new Date(startDate);
    if (endDate) query.processedAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const transactions = await InventoryTransaction.find(query)
    .populate('roomId', 'roomNumber type')
    .populate('bookingId', 'bookingNumber guestDetails')
    .populate('processedBy', 'name')
    .populate('items.itemId', 'name category')
    .sort({ processedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await InventoryTransaction.countDocuments(query);

  res.json({
    status: 'success',
    data: {
      transactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    }
  });
}));

/**
 * @swagger
 * /api/v1/room-inventory/analytics:
 *   get:
 *     summary: Get inventory analytics
 *     tags: [Room Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inventory analytics data
 */
router.get('/analytics', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const hotelId = req.user.hotelId;
  const { startDate, endDate } = req.query;

  const [
    inventorySummary,
    costAnalytics,
    lowStockItems,
    roomsNeedingInspection
  ] = await Promise.all([
    RoomInventory.getInventorySummary(hotelId),
    InventoryTransaction.getCostAnalytics(hotelId, startDate, endDate),
    InventoryItem.getLowStockItems(hotelId),
    RoomInventory.getRoomsNeedingInspection(hotelId)
  ]);

  res.json({
    status: 'success',
    data: {
      inventorySummary,
      costAnalytics,
      lowStockItems,
      roomsNeedingInspection
    }
  });
}));

/**
 * @swagger
 * /api/v1/room-inventory/checkout-inspection:
 *   post:
 *     summary: Create checkout inspection
 *     tags: [Room Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Checkout inspection created
 */
router.post('/checkout-inspection', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { roomId, bookingId, guestId, checklistItems, inventoryVerification } = req.body;
  const hotelId = req.user.hotelId;
  const inspectedBy = req.user._id;

  // Check if inspection already exists
  const existingInspection = await CheckoutInspection.findOne({ bookingId });
  if (existingInspection) {
    throw new ApplicationError('Checkout inspection already exists for this booking', 409);
  }

  // Create checkout inspection
  const inspection = await CheckoutInspection.create({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    roomId: new mongoose.Types.ObjectId(roomId),
    bookingId: new mongoose.Types.ObjectId(bookingId),
    guestId: guestId ? new mongoose.Types.ObjectId(guestId) : undefined,
    inspectedBy: new mongoose.Types.ObjectId(inspectedBy),
    checklistItems: checklistItems || [
      // Default checklist items based on task.md requirements
      { category: 'electronics', item: 'TV', status: 'working', notes: '' },
      { category: 'electronics', item: 'Remote Control', status: 'working', notes: '' },
      { category: 'plumbing', item: 'Washroom Tap', status: 'working', notes: '' },
      { category: 'furniture', item: 'Bed', status: 'working', notes: '' },
      { category: 'amenities', item: 'Towels', status: 'working', notes: '' },
      { category: 'amenities', item: 'Bed Sheets', status: 'working', notes: '' }
    ],
    inventoryVerification: inventoryVerification || [],
    inspectionStatus: 'completed',
    overallCondition: 'good', // Will be updated based on findings
    totalCharges: 0
  });

  // Also create a final daily inventory check for checkout
  const { default: DailyInventoryCheck } = await import('../models/DailyInventoryCheck.js');
  
  if (inventoryVerification && inventoryVerification.length > 0) {
    const checkoutInventoryCheck = await DailyInventoryCheck.create({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      roomId: new mongoose.Types.ObjectId(roomId),
      bookingId: new mongoose.Types.ObjectId(bookingId),
      guestId: guestId ? new mongoose.Types.ObjectId(guestId) : undefined,
      housekeeperId: new mongoose.Types.ObjectId(inspectedBy),
      checkType: 'post_checkout',
      inventoryItems: inventoryVerification,
      overallStatus: inventoryVerification.some(item => item.needsReplacement) ? 'needs_attention' : 'good',
      notes: 'Final inventory check during checkout inspection'
    });

    // Calculate any additional charges from inventory issues
    let additionalCharges = 0;
    for (const item of inventoryVerification) {
      if (item.chargeGuest && item.replacementCost) {
        additionalCharges += item.replacementCost;
      }
    }

    inspection.totalCharges = additionalCharges;
    await inspection.save();
  }

  await inspection.populate([
    { path: 'inspectedBy', select: 'name' },
    { path: 'guestId', select: 'name email' }
  ]);

  // Send notification to admins if there are charges from checkout inspection
  if (inspection.totalCharges > 0) {
    try {
      const { default: inventoryNotificationService } = await import('../services/inventoryNotificationService.js');
      await inventoryNotificationService.notifyCheckoutInspectionFailed(inspection);
    } catch (error) {
      console.error('Failed to send checkout inspection notifications:', error);
    }
  }

  res.status(201).json({
    status: 'success',
    data: {
      inspection,
      message: inspection.totalCharges > 0 
        ? `Checkout completed. Additional charges: $${inspection.totalCharges}`
        : 'Checkout completed successfully. No additional charges.'
    }
  });
}));

/**
 * @swagger
 * /api/v1/room-inventory/checkout-inspection/{bookingId}:
 *   get:
 *     summary: Get checkout inspection
 *     tags: [Room Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Checkout inspection details
 */
router.get('/checkout-inspection/:bookingId', catchAsync(async (req, res) => {
  const { bookingId } = req.params;
  const hotelId = req.user.hotelId;

  const inspection = await CheckoutInspection.findOne({ 
    bookingId, 
    hotelId 
  })
  .populate('roomId', 'roomNumber type')
  .populate('bookingId')
  .populate('inspectedBy', 'name')
  .populate('inventoryVerification.itemId');

  if (!inspection) {
    throw new ApplicationError('Checkout inspection not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      inspection
    }
  });
}));

/**
 * @swagger
 * /api/v1/room-inventory/checkout-inspection/{bookingId}:
 *   put:
 *     summary: Update checkout inspection
 *     tags: [Room Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inspection updated
 */
router.put('/checkout-inspection/:bookingId', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { bookingId } = req.params;
  const hotelId = req.user.hotelId;

  const inspection = await CheckoutInspection.findOneAndUpdate(
    { bookingId, hotelId },
    req.body,
    { new: true, runValidators: true }
  )
  .populate('roomId', 'roomNumber type')
  .populate('inventoryVerification.itemId');

  if (!inspection) {
    throw new ApplicationError('Checkout inspection not found', 404);
  }

  // If damages are found that should be charged, create transaction
  if (req.body.damagesFound && req.body.damagesFound.some(d => d.chargeGuest)) {
    const chargeableItems = req.body.damagesFound
      .filter(d => d.chargeGuest)
      .map(damage => ({
        itemId: damage.itemId,
        name: damage.itemName,
        category: damage.category,
        quantityChanged: -damage.quantity,
        unitPrice: damage.chargeAmount / damage.quantity,
        totalCost: damage.chargeAmount,
        reason: 'damaged_by_guest',
        isChargeable: true,
        chargeType: 'damage',
        condition: 'damaged',
        notes: damage.description
      }));

    await InventoryTransaction.create({
      hotelId,
      roomId: inspection.roomId,
      bookingId: inspection.bookingId,
      guestId: inspection.guestId,
      transactionType: 'checkout_charge',
      items: chargeableItems,
      chargedToGuest: true,
      processedBy: req.user._id,
      status: 'approved',
      notes: 'Charges from checkout inspection'
    });
  }

  res.json({
    status: 'success',
    data: {
      inspection
    }
  });
}));

export default router;