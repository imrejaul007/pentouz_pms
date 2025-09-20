import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import LaundryTemplate from '../models/LaundryTemplate.js';
import InventoryItem from '../models/InventoryItem.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Laundry Templates
 *   description: Laundry template management for automated checkout processing
 */

/**
 * @swagger
 * /api/v1/laundry-templates:
 *   get:
 *     summary: Get all laundry templates for hotel
 *     tags: [Laundry Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomType
 *         schema:
 *           type: string
 *         description: Filter by room type
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Laundry templates retrieved successfully
 */
router.get('/', authorize('admin', 'manager', 'staff'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { roomType, isActive } = req.query;

  const filter = { hotelId };
  if (roomType) filter.roomType = roomType;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const templates = await LaundryTemplate.find(filter)
    .populate('items.itemId', 'name category unitPrice')
    .populate('createdBy', 'name email')
    .populate('lastUpdatedBy', 'name email')
    .sort({ roomType: 1, isDefault: -1, createdAt: -1 });

  res.status(200).json({
    status: 'success',
    data: { templates }
  });
}));

/**
 * @swagger
 * /api/v1/laundry-templates/{id}:
 *   get:
 *     summary: Get laundry template by ID
 *     tags: [Laundry Templates]
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
 *         description: Laundry template retrieved successfully
 *       404:
 *         description: Template not found
 */
router.get('/:id', authorize('admin', 'manager', 'staff'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { id } = req.params;

  const template = await LaundryTemplate.findOne({ _id: id, hotelId })
    .populate('items.itemId', 'name category unitPrice')
    .populate('createdBy', 'name email')
    .populate('lastUpdatedBy', 'name email');

  if (!template) {
    throw new ApplicationError('Laundry template not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { template }
  });
}));

/**
 * @swagger
 * /api/v1/laundry-templates:
 *   post:
 *     summary: Create new laundry template
 *     tags: [Laundry Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomType
 *               - templateName
 *               - items
 *             properties:
 *               roomType:
 *                 type: string
 *                 enum: [standard, deluxe, suite, presidential, family, accessible, executive, penthouse]
 *               templateName:
 *                 type: string
 *               description:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     itemName:
 *                       type: string
 *                     category:
 *                       type: string
 *                     baseQuantity:
 *                       type: number
 *                     guestMultiplier:
 *                       type: number
 *                     isRequired:
 *                       type: boolean
 *                     defaultReturnDays:
 *                       type: number
 *                     specialInstructions:
 *                       type: string
 *                     costPerItem:
 *                       type: number
 *                     priority:
 *                       type: string
 *               isDefault:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Laundry template created successfully
 *       400:
 *         description: Invalid input data
 */
router.post('/', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const templateData = req.body;

  // Validate that all item IDs exist
  const itemIds = templateData.items.map(item => item.itemId).filter(Boolean);
  if (itemIds.length > 0) {
    const existingItems = await InventoryItem.find({
      _id: { $in: itemIds },
      hotelId,
      isActive: true
    });
    
    if (existingItems.length !== itemIds.length) {
      throw new ApplicationError('One or more inventory items not found or inactive', 400);
    }
  }

  const template = await LaundryTemplate.create({
    ...templateData,
    hotelId,
    createdBy: userId,
    lastUpdatedBy: userId
  });

  await template.populate([
    { path: 'items.itemId', select: 'name category unitPrice' },
    { path: 'createdBy', select: 'name email' }
  ]);

  res.status(201).json({
    status: 'success',
    message: 'Laundry template created successfully',
    data: { template }
  });
}));

/**
 * @swagger
 * /api/v1/laundry-templates/{id}:
 *   put:
 *     summary: Update laundry template
 *     tags: [Laundry Templates]
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
 *               templateName:
 *                 type: string
 *               description:
 *                 type: string
 *               items:
 *                 type: array
 *               isActive:
 *                 type: boolean
 *               isDefault:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Laundry template updated successfully
 *       404:
 *         description: Template not found
 */
router.put('/:id', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;
  const updateData = req.body;

  const template = await LaundryTemplate.findOne({ _id: id, hotelId });
  if (!template) {
    throw new ApplicationError('Laundry template not found', 404);
  }

  // Validate item IDs if provided
  if (updateData.items) {
    const itemIds = updateData.items.map(item => item.itemId).filter(Boolean);
    if (itemIds.length > 0) {
      const existingItems = await InventoryItem.find({
        _id: { $in: itemIds },
        hotelId,
        isActive: true
      });
      
      if (existingItems.length !== itemIds.length) {
        throw new ApplicationError('One or more inventory items not found or inactive', 400);
      }
    }
  }

  // Update template
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      template[key] = updateData[key];
    }
  });

  template.lastUpdatedBy = userId;
  await template.save();

  await template.populate([
    { path: 'items.itemId', select: 'name category unitPrice' },
    { path: 'lastUpdatedBy', select: 'name email' }
  ]);

  res.status(200).json({
    status: 'success',
    message: 'Laundry template updated successfully',
    data: { template }
  });
}));

/**
 * @swagger
 * /api/v1/laundry-templates/{id}:
 *   delete:
 *     summary: Delete laundry template
 *     tags: [Laundry Templates]
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
 *         description: Laundry template deleted successfully
 *       404:
 *         description: Template not found
 *       400:
 *         description: Cannot delete default template
 */
router.delete('/:id', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { id } = req.params;

  const template = await LaundryTemplate.findOne({ _id: id, hotelId });
  if (!template) {
    throw new ApplicationError('Laundry template not found', 404);
  }

  if (template.isDefault) {
    throw new ApplicationError('Cannot delete default template. Set another template as default first.', 400);
  }

  await LaundryTemplate.findByIdAndDelete(id);

  res.status(200).json({
    status: 'success',
    message: 'Laundry template deleted successfully'
  });
}));

/**
 * @swagger
 * /api/v1/laundry-templates/{id}/set-default:
 *   post:
 *     summary: Set template as default for room type
 *     tags: [Laundry Templates]
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
 *         description: Template set as default successfully
 *       404:
 *         description: Template not found
 */
router.post('/:id/set-default', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;

  const template = await LaundryTemplate.findOne({ _id: id, hotelId });
  if (!template) {
    throw new ApplicationError('Laundry template not found', 404);
  }

  // Set this template as default and unset others for the same room type
  await template.toggleAutomationType('default', true);
  template.lastUpdatedBy = userId;
  await template.save();

  res.status(200).json({
    status: 'success',
    message: 'Template set as default successfully',
    data: { template }
  });
}));

/**
 * @swagger
 * /api/v1/laundry-templates/room-type/{roomType}:
 *   get:
 *     summary: Get default template for room type
 *     tags: [Laundry Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomType
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Default template retrieved successfully
 *       404:
 *         description: No default template found for room type
 */
router.get('/room-type/:roomType', authorize('admin', 'manager', 'staff'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { roomType } = req.params;

  const template = await LaundryTemplate.getForRoomType(hotelId, roomType);
  if (!template) {
    throw new ApplicationError(`No default template found for room type: ${roomType}`, 404);
  }

  res.status(200).json({
    status: 'success',
    data: { template }
  });
}));

/**
 * @swagger
 * /api/v1/laundry-templates/create-defaults:
 *   post:
 *     summary: Create default templates for all room types
 *     tags: [Laundry Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Default templates created successfully
 */
router.post('/create-defaults', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;

  // Check if default templates already exist
  const existingTemplates = await LaundryTemplate.find({ hotelId, isDefault: true });
  if (existingTemplates.length > 0) {
    throw new ApplicationError('Default templates already exist. Delete existing ones first.', 400);
  }

  const templates = await LaundryTemplate.createDefaultTemplates(hotelId, userId);

  res.status(201).json({
    status: 'success',
    message: 'Default templates created successfully',
    data: { templates }
  });
}));

/**
 * @swagger
 * /api/v1/laundry-templates/{id}/test:
 *   post:
 *     summary: Test template with sample data
 *     tags: [Laundry Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               guestCount:
 *                 type: number
 *                 default: 2
 *               season:
 *                 type: string
 *                 enum: [summer, winter, monsoon, normal]
 *                 default: normal
 *               roomCondition:
 *                 type: string
 *                 enum: [normal, dirty, very_dirty, damaged, unused]
 *                 default: normal
 *     responses:
 *       200:
 *         description: Template test completed successfully
 */
router.post('/:id/test', authorize('admin', 'manager', 'staff'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { id } = req.params;
  const { guestCount = 2, season = 'normal', roomCondition = 'normal' } = req.body;

  const template = await LaundryTemplate.findOne({ _id: id, hotelId });
  if (!template) {
    throw new ApplicationError('Laundry template not found', 404);
  }

  const testResults = template.calculateLaundryItems(guestCount, season, roomCondition);

  res.status(200).json({
    status: 'success',
    data: {
      template: template.summary,
      testParameters: { guestCount, season, roomCondition },
      results: testResults,
      summary: {
        totalItems: testResults.length,
        totalQuantity: testResults.reduce((sum, item) => sum + item.quantity, 0),
        totalCost: testResults.reduce((sum, item) => sum + item.estimatedCost, 0),
        categories: [...new Set(testResults.map(item => item.category))]
      }
    }
  });
}));

/**
 * @swagger
 * /api/v1/laundry-templates/statistics:
 *   get:
 *     summary: Get laundry template usage statistics
 *     tags: [Laundry Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/statistics', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  const templates = await LaundryTemplate.find({ hotelId, isActive: true });
  
  const statistics = {
    totalTemplates: templates.length,
    templatesByRoomType: {},
    usageStats: {
      totalUsage: 0,
      averageUsage: 0,
      mostUsedTemplate: null,
      leastUsedTemplate: null
    },
    costAnalysis: {
      totalEstimatedCost: 0,
      averageCostPerTemplate: 0,
      mostExpensiveTemplate: null
    }
  };

  let totalUsage = 0;
  let maxUsage = 0;
  let minUsage = Infinity;
  let totalCost = 0;
  let maxCost = 0;

  templates.forEach(template => {
    const usage = template.usageStats.timesUsed || 0;
    const cost = template.estimatedTotalCost || 0;
    
    totalUsage += usage;
    totalCost += cost;
    
    if (usage > maxUsage) {
      maxUsage = usage;
      statistics.usageStats.mostUsedTemplate = template.templateName;
    }
    
    if (usage < minUsage) {
      minUsage = usage;
      statistics.usageStats.leastUsedTemplate = template.templateName;
    }
    
    if (cost > maxCost) {
      maxCost = cost;
      statistics.costAnalysis.mostExpensiveTemplate = template.templateName;
    }
    
    if (!statistics.templatesByRoomType[template.roomType]) {
      statistics.templatesByRoomType[template.roomType] = 0;
    }
    statistics.templatesByRoomType[template.roomType] += usage;
  });

  statistics.usageStats.totalUsage = totalUsage;
  statistics.usageStats.averageUsage = templates.length > 0 ? totalUsage / templates.length : 0;
  statistics.costAnalysis.totalEstimatedCost = totalCost;
  statistics.costAnalysis.averageCostPerTemplate = templates.length > 0 ? totalCost / templates.length : 0;

  res.status(200).json({
    status: 'success',
    data: { statistics }
  });
}));

export default router;
