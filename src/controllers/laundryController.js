import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import laundryService from '../services/laundryService.js';
import LaundryTransaction from '../models/LaundryTransaction.js';
import APIFeatures from '../utils/apiFeatures.js';
import logger from '../utils/logger.js';

/**
 * @swagger
 * tags:
 *   name: Laundry Management
 *   description: Laundry inventory tracking and management
 */

/**
 * @swagger
 * /api/v1/laundry/send-items:
 *   post:
 *     summary: Send items to laundry
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomId
 *               - items
 *               - expectedReturnDate
 *             properties:
 *               roomId:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     notes:
 *                       type: string
 *               expectedReturnDate:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *               specialInstructions:
 *                 type: string
 *               isUrgent:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Items sent to laundry successfully
 *       400:
 *         description: Invalid input data
 */
export const sendItemsToLaundry = catchAsync(async (req, res, next) => {
  const {
    roomId,
    items,
    expectedReturnDate,
    notes,
    specialInstructions,
    isUrgent
  } = req.body;

  if (!roomId || !items || !expectedReturnDate) {
    return next(new ApplicationError('Room ID, items, and expected return date are required', 400));
  }

  if (!Array.isArray(items) || items.length === 0) {
    return next(new ApplicationError('Items array is required and cannot be empty', 400));
  }

  const result = await laundryService.sendItemsToLaundry({
    hotelId: req.user.hotelId,
    roomId,
    items,
    processedBy: req.user.id,
    expectedReturnDate,
    notes,
    specialInstructions,
    isUrgent,
    source: 'manual'
  });

  logger.info('Items sent to laundry', {
    hotelId: req.user.hotelId,
    roomId,
    itemCount: items.length,
    processedBy: req.user.id
  });

  res.status(201).json({
    status: 'success',
    message: 'Items sent to laundry successfully',
    data: result
  });
});

/**
 * @swagger
 * /api/v1/laundry/{id}/mark-in-laundry:
 *   put:
 *     summary: Mark items as in laundry
 *     tags: [Laundry Management]
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
 *         description: Items marked as in laundry
 *       404:
 *         description: Laundry transaction not found
 */
export const markItemsAsInLaundry = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const transaction = await laundryService.markItemsAsInLaundry(id, req.user.id);

  res.json({
    status: 'success',
    message: 'Items marked as in laundry',
    data: transaction
  });
});

/**
 * @swagger
 * /api/v1/laundry/{id}/mark-cleaning:
 *   put:
 *     summary: Mark items as cleaning
 *     tags: [Laundry Management]
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
 *         description: Items marked as cleaning
 *       404:
 *         description: Laundry transaction not found
 */
export const markItemsAsCleaning = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const transaction = await laundryService.markItemsAsCleaning(id, req.user.id);

  res.json({
    status: 'success',
    message: 'Items marked as cleaning',
    data: transaction
  });
});

/**
 * @swagger
 * /api/v1/laundry/{id}/mark-ready:
 *   put:
 *     summary: Mark items as ready for return
 *     tags: [Laundry Management]
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
 *         description: Items marked as ready
 *       404:
 *         description: Laundry transaction not found
 */
export const markItemsAsReady = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const transaction = await laundryService.markItemsAsReady(id, req.user.id);

  res.json({
    status: 'success',
    message: 'Items marked as ready',
    data: transaction
  });
});

/**
 * @swagger
 * /api/v1/laundry/{id}/return-items:
 *   put:
 *     summary: Return items from laundry
 *     tags: [Laundry Management]
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
 *               quality:
 *                 type: string
 *                 enum: [excellent, good, fair, poor, damaged]
 *               issues:
 *                 type: array
 *                 items:
 *                   type: string
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Items returned successfully
 *       404:
 *         description: Laundry transaction not found
 */
export const returnItemsFromLaundry = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { quality, issues, photos } = req.body;

  const transaction = await laundryService.returnItemsFromLaundry(
    id,
    req.user.id,
    quality,
    issues,
    photos
  );

  res.json({
    status: 'success',
    message: 'Items returned from laundry successfully',
    data: transaction
  });
});

/**
 * @swagger
 * /api/v1/laundry/{id}/mark-lost:
 *   put:
 *     summary: Mark items as lost
 *     tags: [Laundry Management]
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
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Items marked as lost
 *       404:
 *         description: Laundry transaction not found
 */
export const markItemsAsLost = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { notes } = req.body;

  const transaction = await laundryService.markItemsAsLost(id, req.user.id, notes);

  res.json({
    status: 'success',
    message: 'Items marked as lost',
    data: transaction
  });
});

/**
 * @swagger
 * /api/v1/laundry/{id}/mark-damaged:
 *   put:
 *     summary: Mark items as damaged
 *     tags: [Laundry Management]
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
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Items marked as damaged
 *       404:
 *         description: Laundry transaction not found
 */
export const markItemsAsDamaged = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { notes } = req.body;

  const transaction = await laundryService.markItemsAsDamaged(id, req.user.id, notes);

  res.json({
    status: 'success',
    message: 'Items marked as damaged',
    data: transaction
  });
});

/**
 * @swagger
 * /api/v1/laundry/dashboard:
 *   get:
 *     summary: Get laundry dashboard data
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: Laundry dashboard data
 */
export const getLaundryDashboard = catchAsync(async (req, res, next) => {
  const { status, startDate, endDate } = req.query;
  
  const filters = {};
  if (status) filters.status = status;
  if (startDate && endDate) {
    filters.dateRange = { start: startDate, end: endDate };
  }

  const dashboardData = await laundryService.getLaundryDashboard(req.user.hotelId, filters);

  res.json({
    status: 'success',
    data: dashboardData
  });
});

/**
 * @swagger
 * /api/v1/laundry/status:
 *   get:
 *     summary: Get laundry status
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *         description: Filter by room ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: itemId
 *         schema:
 *           type: string
 *         description: Filter by item ID
 *     responses:
 *       200:
 *         description: Laundry status data
 */
export const getLaundryStatus = catchAsync(async (req, res, next) => {
  const { roomId, status, itemId } = req.query;
  
  const filters = {};
  if (roomId) filters.roomId = roomId;
  if (status) filters.status = status;
  if (itemId) filters.itemId = itemId;

  const statusData = await laundryService.getLaundryStatus(req.user.hotelId, filters);

  res.json({
    status: 'success',
    data: statusData
  });
});

/**
 * @swagger
 * /api/v1/laundry/overdue:
 *   get:
 *     summary: Get overdue laundry items
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue laundry items
 */
export const getOverdueItems = catchAsync(async (req, res, next) => {
  const overdueItems = await laundryService.getOverdueItems(req.user.hotelId);

  res.json({
    status: 'success',
    data: overdueItems
  });
});

/**
 * @swagger
 * /api/v1/laundry/statistics:
 *   get:
 *     summary: Get laundry statistics
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics
 *     responses:
 *       200:
 *         description: Laundry statistics
 */
export const getLaundryStatistics = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  const dateRange = {};
  if (startDate && endDate) {
    dateRange.start = startDate;
    dateRange.end = endDate;
  }

  const statistics = await laundryService.getLaundryStatistics(req.user.hotelId, dateRange);

  res.json({
    status: 'success',
    data: statistics
  });
});

/**
 * @swagger
 * /api/v1/laundry:
 *   get:
 *     summary: Get all laundry transactions
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *         description: Filter by room ID
 *     responses:
 *       200:
 *         description: List of laundry transactions
 */
export const getAllLaundryTransactions = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(
    LaundryTransaction.find({ hotelId: req.user.hotelId })
      .populate('roomId', 'roomNumber type')
      .populate('itemId', 'name category')
      .populate('processedBy', 'name')
      .populate('returnedBy', 'name'),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const transactions = await features.query;

  res.json({
    status: 'success',
    results: transactions.length,
    data: transactions
  });
});

/**
 * @swagger
 * /api/v1/laundry/{id}:
 *   get:
 *     summary: Get laundry transaction by ID
 *     tags: [Laundry Management]
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
 *         description: Laundry transaction details
 *       404:
 *         description: Laundry transaction not found
 */
export const getLaundryTransaction = catchAsync(async (req, res, next) => {
  const transaction = await LaundryTransaction.findById(req.params.id)
    .populate('roomId', 'roomNumber type')
    .populate('itemId', 'name category')
    .populate('processedBy', 'name')
    .populate('returnedBy', 'name')
    .populate('metadata.createdBy', 'name');

  if (!transaction) {
    return next(new ApplicationError('Laundry transaction not found', 404));
  }

  // Check if user has access to this hotel's data
  if (transaction.hotelId.toString() !== req.user.hotelId.toString()) {
    return next(new ApplicationError('You do not have permission to access this transaction', 403));
  }

  res.json({
    status: 'success',
    data: transaction
  });
});
