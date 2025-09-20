import express from 'express';
import StockMovement from '../models/StockMovement.js';
import TransactionService from '../services/transactionService.js';
import StockInventoryService from '../services/stockInventoryService.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';
import { body, query, param, validationResult } from 'express-validator';

const router = express.Router();

// Express-validator validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Validation schemas
const transactionFilters = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('transactionType').optional().isIn(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'REORDER', 'CONSUMPTION']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('status').optional().isIn(['pending', 'completed', 'cancelled'])
];

const adjustmentValidation = [
  body('inventoryItemId').notEmpty().isMongoId(),
  body('quantity').notEmpty().isNumeric(),
  body('reason').notEmpty().isLength({ min: 3, max: 500 }),
  body('unitCost').optional().isNumeric({ min: 0 })
];

const transferValidation = [
  body('inventoryItemId').notEmpty().isMongoId(),
  body('quantity').notEmpty().isNumeric({ min: 0.01 }),
  body('fromLocation').notEmpty().isObject(),
  body('toLocation').notEmpty().isObject(),
  body('reason').optional().isLength({ max: 500 })
];

const consumptionValidation = [
  body('inventoryItemId').notEmpty().isMongoId(),
  body('quantity').notEmpty().isNumeric({ min: 0.01 }),
  body('reason').notEmpty().isLength({ min: 3, max: 500 }),
  body('reference').optional().isObject()
];

/**
 * @swagger
 * /api/v1/stock-movements:
 *   get:
 *     summary: Get transaction history with filters
 *     tags: [Stock Movements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of records per page
 *       - in: query
 *         name: transactionType
 *         schema:
 *           type: string
 *           enum: [IN, OUT, TRANSFER, ADJUSTMENT, REORDER, CONSUMPTION]
 *         description: Filter by transaction type
 *       - in: query
 *         name: inventoryItemId
 *         schema:
 *           type: string
 *         description: Filter by inventory item ID
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
 *         description: Transaction history retrieved successfully
 */
router.get('/', authenticate, requireRole(['admin', 'staff']), transactionFilters, validateRequest, async (req, res) => {
  try {
    const { hotelId } = req.user;
    const filters = {
      hotelId,
      ...req.query
    };

    const result = await TransactionService.getTransactionHistory(filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction history',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/stock-movements/item/{itemId}:
 *   get:
 *     summary: Get transaction history for specific item
 *     tags: [Stock Movements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *         description: Number of records to retrieve
 *     responses:
 *       200:
 *         description: Item transaction history retrieved successfully
 */
router.get('/item/:itemId', authenticate, requireRole(['admin', 'staff']), [
  param('itemId').isMongoId(),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], validateRequest, async (req, res) => {
  try {
    const { hotelId } = req.user;
    const { itemId } = req.params;
    const options = {
      hotelId,
      ...req.query
    };

    const transactions = await TransactionService.getItemTransactions(itemId, options);

    res.json({
      success: true,
      data: {
        itemId,
        transactions,
        total: transactions.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve item transactions',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/stock-movements/adjustment:
 *   post:
 *     summary: Create manual stock adjustment
 *     tags: [Stock Movements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inventoryItemId
 *               - quantity
 *               - reason
 *             properties:
 *               inventoryItemId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               reason:
 *                 type: string
 *               unitCost:
 *                 type: number
 *     responses:
 *       201:
 *         description: Stock adjustment created successfully
 */
router.post('/adjustment', authenticate, requireRole(['admin', 'staff']), adjustmentValidation, validateRequest, async (req, res) => {
  try {
    const { hotelId, _id: performedBy } = req.user;
    const { inventoryItemId, quantity, reason, unitCost = 0 } = req.body;

    const result = await StockInventoryService.updateStock({
      hotelId,
      inventoryItemId,
      quantity,
      reason,
      performedBy,
      unitCost,
      reference: {
        type: 'manual',
        description: 'Manual stock adjustment via API'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Stock adjustment created successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create stock adjustment',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/stock-movements/transfer:
 *   post:
 *     summary: Transfer item between locations
 *     tags: [Stock Movements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inventoryItemId
 *               - quantity
 *               - fromLocation
 *               - toLocation
 *             properties:
 *               inventoryItemId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               fromLocation:
 *                 type: object
 *               toLocation:
 *                 type: object
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Transfer created successfully
 */
router.post('/transfer', authenticate, requireRole(['admin', 'staff']), transferValidation, validateRequest, async (req, res) => {
  try {
    const { hotelId, _id: performedBy } = req.user;
    const { inventoryItemId, quantity, fromLocation, toLocation, reason } = req.body;

    const result = await StockInventoryService.transferItem({
      hotelId,
      inventoryItemId,
      quantity,
      fromLocation,
      toLocation,
      reason,
      performedBy
    });

    res.status(201).json({
      success: true,
      message: 'Transfer created successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create transfer',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/stock-movements/consumption:
 *   post:
 *     summary: Log consumption transaction
 *     tags: [Stock Movements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inventoryItemId
 *               - quantity
 *               - reason
 *             properties:
 *               inventoryItemId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               reason:
 *                 type: string
 *               reference:
 *                 type: object
 *               location:
 *                 type: object
 *     responses:
 *       201:
 *         description: Consumption logged successfully
 */
router.post('/consumption', authenticate, requireRole(['admin', 'staff']), consumptionValidation, validateRequest, async (req, res) => {
  try {
    const { hotelId, _id: performedBy } = req.user;
    const { inventoryItemId, quantity, reason, reference, location } = req.body;

    const result = await StockInventoryService.consumeItem({
      hotelId,
      inventoryItemId,
      quantity,
      reason,
      reference,
      location,
      performedBy
    });

    res.status(201).json({
      success: true,
      message: 'Consumption logged successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to log consumption',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/stock-movements/summary:
 *   get:
 *     summary: Get transaction analytics summary
 *     tags: [Stock Movements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by item category
 *     responses:
 *       200:
 *         description: Analytics summary retrieved successfully
 */
router.get('/summary', authenticate, requireRole(['admin', 'staff']), [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('category').optional().isString()
], validateRequest, async (req, res) => {
  try {
    const { hotelId } = req.user;
    const filters = req.query;

    const summary = await TransactionService.getTransactionSummary(hotelId, filters);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction summary',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/stock-movements/reconcile:
 *   post:
 *     summary: Reconcile inventory counts
 *     tags: [Stock Movements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemCounts
 *             properties:
 *               itemCounts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     physicalCount:
 *                       type: number
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reconciliation completed successfully
 */
router.post('/reconcile', authenticate, requireRole(['admin', 'staff']), [
  body('itemCounts').isArray({ min: 1 }),
  body('itemCounts.*.itemId').isMongoId(),
  body('itemCounts.*.physicalCount').isNumeric({ min: 0 }),
  body('notes').optional().isLength({ max: 1000 })
], validateRequest, async (req, res) => {
  try {
    const { hotelId, _id: performedBy } = req.user;
    const { itemCounts, notes } = req.body;

    const result = await TransactionService.reconcileInventory({
      hotelId,
      itemCounts,
      performedBy,
      notes
    });

    res.json({
      success: true,
      message: 'Reconciliation completed successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to complete reconciliation',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/stock-movements/export:
 *   get:
 *     summary: Export transaction data to CSV
 *     tags: [Stock Movements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *         description: Export format
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for export
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for export
 *     responses:
 *       200:
 *         description: Export data retrieved successfully
 */
router.get('/export', authenticate, requireRole(['admin']), [
  query('format').optional().isIn(['csv', 'json']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('transactionType').optional().isIn(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'REORDER', 'CONSUMPTION'])
], validateRequest, async (req, res) => {
  try {
    const { hotelId } = req.user;
    const { format = 'json', ...filters } = req.query;

    const reportData = await TransactionService.generateTransactionReport({
      hotelId,
      reportType: 'detailed',
      format,
      ...filters
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=stock-movements.csv');

      // Convert to CSV format
      const transactions = reportData.data.transactions;
      const csvHeader = 'Date,Item Name,Transaction Type,Quantity,Unit Cost,Total Cost,Reason,Performed By\n';
      const csvRows = transactions.map(t => [
        new Date(t.timestamps.created).toISOString().split('T')[0],
        t.inventoryItemId?.name || 'Unknown',
        t.transactionType,
        t.quantity,
        t.unitCost,
        t.totalCost,
        `"${t.reason}"`,
        t.performedBy?.name || 'Unknown'
      ].join(',')).join('\n');

      res.send(csvHeader + csvRows);
    } else {
      res.json({
        success: true,
        data: reportData
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to export transaction data',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/stock-movements/reorder-suggestions:
 *   get:
 *     summary: Get auto-reorder suggestions
 *     tags: [Stock Movements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeScheduled
 *         schema:
 *           type: boolean
 *         description: Include items with scheduled reorders
 *     responses:
 *       200:
 *         description: Reorder suggestions retrieved successfully
 */
router.get('/reorder-suggestions', authenticate, requireRole(['admin', 'staff']), [
  query('includeScheduled').optional().isBoolean()
], validateRequest, async (req, res) => {
  try {
    const { hotelId } = req.user;
    const options = req.query;

    const suggestions = await StockInventoryService.generateAutoReorderSuggestions(hotelId, options);

    res.json({
      success: true,
      data: {
        suggestions,
        totalSuggestions: suggestions.length,
        urgentItems: suggestions.filter(s => s.reasoning.urgency === 'urgent').length,
        estimatedTotalCost: suggestions.reduce((sum, s) => sum + s.estimatedCost, 0)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve reorder suggestions',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/stock-movements/low-stock-alerts:
 *   get:
 *     summary: Get low stock alerts
 *     tags: [Stock Movements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Stock threshold for alerts
 *     responses:
 *       200:
 *         description: Low stock alerts retrieved successfully
 */
router.get('/low-stock-alerts', authenticate, requireRole(['admin', 'staff']), [
  query('threshold').optional().isInt({ min: 0 })
], validateRequest, async (req, res) => {
  try {
    const { hotelId } = req.user;
    const { threshold = 5 } = req.query;

    const alerts = await StockInventoryService.getLowStockAlerts(hotelId, threshold);

    res.json({
      success: true,
      data: {
        alerts,
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.alert.severity === 'critical').length,
        warningAlerts: alerts.filter(a => a.alert.severity === 'warning').length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve low stock alerts',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/stock-movements/item-statistics/{itemId}:
 *   get:
 *     summary: Get comprehensive item statistics
 *     tags: [Stock Movements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ID
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *         description: Number of days to analyze
 *     responses:
 *       200:
 *         description: Item statistics retrieved successfully
 */
router.get('/item-statistics/:itemId', authenticate, requireRole(['admin', 'staff']), [
  param('itemId').isMongoId(),
  query('days').optional().isInt({ min: 1, max: 365 })
], validateRequest, async (req, res) => {
  try {
    const { hotelId } = req.user;
    const { itemId } = req.params;
    const { days = 30 } = req.query;

    const statistics = await StockInventoryService.getItemStatistics(hotelId, itemId, days);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve item statistics',
      error: error.message
    });
  }
});

export default router;