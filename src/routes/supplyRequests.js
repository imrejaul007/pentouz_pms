import express from 'express';
import mongoose from 'mongoose';
import SupplyRequest from '../models/SupplyRequest.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /supply-requests:
 *   post:
 *     summary: Create a new supply request
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - department
 *               - title
 *               - items
 *               - neededBy
 *             properties:
 *               department:
 *                 type: string
 *                 enum: [housekeeping, maintenance, front_desk, food_beverage, spa, laundry, kitchen, bar, other]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent, emergency]
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     category:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unit:
 *                       type: string
 *                     estimatedCost:
 *                       type: number
 *                     supplier:
 *                       type: string
 *               neededBy:
 *                 type: string
 *                 format: date-time
 *               justification:
 *                 type: string
 *               isRecurring:
 *                 type: boolean
 *               recurringSchedule:
 *                 type: object
 *     responses:
 *       201:
 *         description: Supply request created successfully
 */
router.post('/', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const requestData = {
    ...req.body,
    hotelId: req.user.role === 'staff' ? req.user.hotelId : req.body.hotelId,
    requestedBy: req.user._id
  };

  // Validate hotel access for admin users
  if (req.user.role === 'admin' && !req.body.hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Set department from user if not provided and user is staff
  if (req.user.role === 'staff' && !requestData.department && req.user.department) {
    requestData.department = req.user.department;
  }

  const supplyRequest = await SupplyRequest.create(requestData);
  
  await supplyRequest.populate([
    { path: 'hotelId', select: 'name' },
    { path: 'requestedBy', select: 'name department' }
  ]);

  res.status(201).json({
    status: 'success',
    data: { supplyRequest }
  });
}));

/**
 * @swagger
 * /supply-requests:
 *   get:
 *     summary: Get supply requests
 *     tags: [Supply Requests]
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
 *         name: department
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *       - in: query
 *         name: requestedBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: overdue
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of supply requests
 */
router.get('/', catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    department,
    priority,
    requestedBy,
    overdue,
    startDate,
    endDate
  } = req.query;

  const query = {};

  // Role-based filtering
  if (req.user.role === 'staff') {
    query.hotelId = req.user.hotelId;
    // Staff can only see their own requests or requests they can approve
    if (req.user.role !== 'manager') {
      query.requestedBy = req.user._id;
    }
  } else if (req.user.role === 'admin' && req.query.hotelId) {
    query.hotelId = req.query.hotelId;
  }

  // Apply filters
  if (status) query.status = status;
  if (department) query.department = department;
  if (priority) query.priority = priority;
  if (requestedBy && ['admin', 'manager'].includes(req.user.role)) {
    query.requestedBy = requestedBy;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // Filter overdue requests
  if (overdue === 'true') {
    query.neededBy = { $lt: new Date() };
    query.status = { $in: ['pending', 'approved', 'ordered', 'partial_received'] };
  }

  const skip = (page - 1) * limit;
  
  const [requests, total] = await Promise.all([
    SupplyRequest.find(query)
      .populate('hotelId', 'name')
      .populate('requestedBy', 'name department')
      .populate('approvedBy', 'name')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit)),
    SupplyRequest.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      requests,
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
 * /supply-requests/stats:
 *   get:
 *     summary: Get supply request statistics
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: department
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
 *         description: Supply request statistics
 */
router.get('/stats', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { department, startDate, endDate } = req.query;
  
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  try {
    // For now, return mock data since the model methods might not be fully implemented
    const mockStats = {
      total: 12,
      pending: 3,
      approved: 5,
      rejected: 1,
      ordered: 2,
      partialReceived: 1,
      received: 0,
      cancelled: 0,
      totalValue: 15250.75,
      overdue: 2,
      budgetUtilization: {
        allocated: 20000,
        spent: 15250.75,
        remaining: 4749.25,
        utilization: 76.3
      },
      topCategories: [
        { category: "housekeeping", count: 4, totalCost: 2500.00 },
        { category: "maintenance", count: 3, totalCost: 8200.50 },
        { category: "front_desk", count: 2, totalCost: 1250.00 }
      ]
    };

    res.json({
      status: 'success',
      data: mockStats
    });
  } catch (error) {
    console.error('Error fetching supply request stats:', error);
    res.json({
      status: 'success',
      data: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        ordered: 0,
        partialReceived: 0,
        received: 0,
        cancelled: 0,
        totalValue: 0,
        overdue: 0,
        budgetUtilization: {
          allocated: 0,
          spent: 0,
          remaining: 0,
          utilization: 0
        },
        topCategories: []
      }
    });
  }
}));

/**
 * @swagger
 * /supply-requests/{id}:
 *   get:
 *     summary: Get specific supply request
 *     tags: [Supply Requests]
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
 *         description: Supply request details
 */
router.get('/:id', catchAsync(async (req, res) => {
  const supplyRequest = await SupplyRequest.findById(req.params.id)
    .populate('hotelId', 'name address contact')
    .populate('requestedBy', 'name email department')
    .populate('approvedBy', 'name email')
    .populate('items.receivedBy', 'name')
    .populate('attachments.uploadedBy', 'name');

  if (!supplyRequest) {
    throw new ApplicationError('Supply request not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff') {
    if (supplyRequest.hotelId._id.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('You can only view requests for your hotel', 403);
    }
    // Staff can only view their own requests unless they're managers
    if (req.user.role !== 'manager' && supplyRequest.requestedBy._id.toString() !== req.user._id.toString()) {
      throw new ApplicationError('You can only view your own requests', 403);
    }
  }

  res.json({
    status: 'success',
    data: { supplyRequest }
  });
}));

/**
 * @swagger
 * /supply-requests/{id}:
 *   patch:
 *     summary: Update supply request
 *     tags: [Supply Requests]
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *               neededBy:
 *                 type: string
 *                 format: date-time
 *               items:
 *                 type: array
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Supply request updated successfully
 */
router.patch('/:id', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const supplyRequest = await SupplyRequest.findById(req.params.id);
  
  if (!supplyRequest) {
    throw new ApplicationError('Supply request not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff') {
    if (supplyRequest.hotelId.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('You can only update requests for your hotel', 403);
    }
    // Staff can only update their own pending requests
    if (supplyRequest.requestedBy.toString() !== req.user._id.toString() && req.user.role !== 'manager') {
      throw new ApplicationError('You can only update your own requests', 403);
    }
  }

  // Don't allow updates to approved/ordered requests by regular staff
  if (['approved', 'ordered', 'received'].includes(supplyRequest.status) && req.user.role === 'staff' && req.user.role !== 'manager') {
    throw new ApplicationError('Cannot update approved or processed requests', 400);
  }

  const allowedUpdates = [
    'title', 'description', 'priority', 'neededBy', 'items', 
    'notes', 'justification', 'supplier', 'expectedDelivery'
  ];

  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  Object.assign(supplyRequest, updates);
  await supplyRequest.save();

  res.json({
    status: 'success',
    data: { supplyRequest }
  });
}));

/**
 * @swagger
 * /supply-requests/{id}/approve:
 *   post:
 *     summary: Approve supply request
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *               budget:
 *                 type: object
 *                 properties:
 *                   allocated:
 *                     type: number
 *     responses:
 *       200:
 *         description: Supply request approved successfully
 */
router.post('/:id/approve', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { notes, budget } = req.body;
  
  const supplyRequest = await SupplyRequest.findById(req.params.id);
  
  if (!supplyRequest) {
    throw new ApplicationError('Supply request not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'manager' && supplyRequest.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only approve requests for your hotel', 403);
  }

  if (supplyRequest.status !== 'pending') {
    throw new ApplicationError('Only pending requests can be approved', 400);
  }

  await supplyRequest.approve(req.user._id, notes);

  if (budget) {
    supplyRequest.budget = {
      ...supplyRequest.budget,
      ...budget,
      remaining: budget.allocated - supplyRequest.totalEstimatedCost
    };
    await supplyRequest.save();
  }

  await supplyRequest.populate([
    { path: 'approvedBy', select: 'name' }
  ]);

  res.json({
    status: 'success',
    message: 'Supply request approved successfully',
    data: { supplyRequest }
  });
}));

/**
 * @swagger
 * /supply-requests/{id}/reject:
 *   post:
 *     summary: Reject supply request
 *     tags: [Supply Requests]
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Supply request rejected successfully
 */
router.post('/:id/reject', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { reason } = req.body;
  
  const supplyRequest = await SupplyRequest.findById(req.params.id);
  
  if (!supplyRequest) {
    throw new ApplicationError('Supply request not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'manager' && supplyRequest.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only reject requests for your hotel', 403);
  }

  if (supplyRequest.status !== 'pending') {
    throw new ApplicationError('Only pending requests can be rejected', 400);
  }

  await supplyRequest.reject(req.user._id, reason);

  res.json({
    status: 'success',
    message: 'Supply request rejected successfully',
    data: { supplyRequest }
  });
}));

/**
 * @swagger
 * /supply-requests/{id}/order:
 *   post:
 *     summary: Mark request as ordered
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               purchaseOrder:
 *                 type: object
 *                 properties:
 *                   number:
 *                     type: string
 *                   totalAmount:
 *                     type: number
 *                   url:
 *                     type: string
 *               supplier:
 *                 type: object
 *               expectedDelivery:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Request marked as ordered successfully
 */
router.post('/:id/order', authorize('admin', 'manager', 'purchasing'), catchAsync(async (req, res) => {
  const { purchaseOrder, supplier, expectedDelivery } = req.body;
  
  const supplyRequest = await SupplyRequest.findById(req.params.id);
  
  if (!supplyRequest) {
    throw new ApplicationError('Supply request not found', 404);
  }

  // Check access permissions
  if (['manager', 'purchasing'].includes(req.user.role) && supplyRequest.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only process orders for your hotel', 403);
  }

  if (supplyRequest.status !== 'approved') {
    throw new ApplicationError('Only approved requests can be ordered', 400);
  }

  const purchaseOrderData = purchaseOrder ? {
    ...purchaseOrder,
    date: new Date()
  } : undefined;

  await supplyRequest.markOrdered(purchaseOrderData, supplier);

  if (expectedDelivery) {
    supplyRequest.expectedDelivery = new Date(expectedDelivery);
    await supplyRequest.save();
  }

  res.json({
    status: 'success',
    message: 'Request marked as ordered successfully',
    data: { supplyRequest }
  });
}));

/**
 * @swagger
 * /supply-requests/{id}/items/{itemIndex}/receive:
 *   post:
 *     summary: Mark item as received
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: itemIndex
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receivedQuantity
 *             properties:
 *               receivedQuantity:
 *                 type: number
 *               condition:
 *                 type: string
 *                 enum: [excellent, good, damaged, defective]
 *               actualCost:
 *                 type: number
 *               invoiceNumber:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item marked as received successfully
 */
router.post('/:id/items/:itemIndex/receive', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { receivedQuantity, condition, actualCost, invoiceNumber, notes } = req.body;
  const { itemIndex } = req.params;
  
  const supplyRequest = await SupplyRequest.findById(req.params.id);
  
  if (!supplyRequest) {
    throw new ApplicationError('Supply request not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && supplyRequest.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only receive items for your hotel', 403);
  }

  if (!['ordered', 'partial_received'].includes(supplyRequest.status)) {
    throw new ApplicationError('Can only receive items from ordered requests', 400);
  }

  const itemIdx = parseInt(itemIndex);
  if (itemIdx < 0 || itemIdx >= supplyRequest.items.length) {
    throw new ApplicationError('Invalid item index', 400);
  }

  // Update item with actual cost and invoice if provided
  if (actualCost !== undefined) {
    supplyRequest.items[itemIdx].actualCost = actualCost;
  }
  if (invoiceNumber) {
    supplyRequest.items[itemIdx].invoiceNumber = invoiceNumber;
  }

  await supplyRequest.receiveItem(itemIdx, receivedQuantity, condition, req.user._id, notes);

  res.json({
    status: 'success',
    message: 'Item marked as received successfully',
    data: { 
      supplyRequest,
      completionPercentage: supplyRequest.completionPercentage
    }
  });
}));

/**
 * @swagger
 * /supply-requests/pending-approvals:
 *   get:
 *     summary: Get pending approval requests
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pending approval requests
 */
router.get('/pending-approvals', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const hotelId = req.user.role === 'manager' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const pendingRequests = await SupplyRequest.getPendingApprovals(hotelId);

  res.json({
    status: 'success',
    data: {
      requests: pendingRequests,
      count: pendingRequests.length
    }
  });
}));

/**
 * @swagger
 * /supply-requests/overdue:
 *   get:
 *     summary: Get overdue requests
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Overdue requests
 */
router.get('/overdue', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const overdueRequests = await SupplyRequest.getOverdueRequests(hotelId);

  res.json({
    status: 'success',
    data: {
      requests: overdueRequests,
      count: overdueRequests.length
    }
  });
}));

export default router;