import express from 'express';
import purchaseOrderService from '../services/purchaseOrderService.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const createPOValidation = [
  body('vendorId').isMongoId().withMessage('Valid vendor ID is required'),
  body('department').isIn([
    'housekeeping', 'maintenance', 'kitchen', 'front_office', 'admin', 'laundry', 'security', 'other'
  ]).withMessage('Invalid department'),
  body('category').isIn([
    'linens', 'toiletries', 'cleaning_supplies', 'maintenance_supplies',
    'food_beverage', 'electronics', 'furniture', 'hvac', 'plumbing',
    'electrical', 'safety_equipment', 'office_supplies', 'laundry_supplies',
    'guest_amenities', 'kitchen_equipment', 'other'
  ]).withMessage('Invalid category'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.inventoryItemId').isMongoId().withMessage('Valid inventory item ID is required'),
  body('items.*.quantityOrdered').isFloat({ min: 0.01 }).withMessage('Quantity must be greater than 0'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be non-negative'),
  body('requiredDate').isISO8601().withMessage('Valid required date is required'),
  body('expectedDeliveryDate').isISO8601().withMessage('Valid expected delivery date is required')
];

const updatePOValidation = [
  param('id').isMongoId().withMessage('Invalid purchase order ID'),
  body('items').optional().isArray().withMessage('Items must be an array'),
  body('expectedDeliveryDate').optional().isISO8601().withMessage('Valid expected delivery date required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
];

const receivePOValidation = [
  param('id').isMongoId().withMessage('Invalid purchase order ID'),
  body('receivedItems').isArray({ min: 1 }).withMessage('At least one received item is required'),
  body('receivedItems.*.itemId').isMongoId().withMessage('Valid item ID is required'),
  body('receivedItems.*.quantity').isFloat({ min: 0.01 }).withMessage('Received quantity must be greater than 0'),
  body('qualityCheck.approved').optional().isBoolean().withMessage('Quality check approval must be boolean'),
  body('qualityCheck.notes').optional().trim().isLength({ max: 1000 }).withMessage('Quality check notes too long')
];

/**
 * @swagger
 * /api/v1/purchase-orders:
 *   get:
 *     summary: Get purchase order list with filters and pagination
 *     tags: [Purchase Orders]
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
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending_approval, approved, sent_to_vendor, confirmed_by_vendor, in_transit, partially_received, fully_received, completed, cancelled, on_hold]
 *         description: Filter by status
 *       - in: query
 *         name: vendorId
 *         schema:
 *           type: string
 *         description: Filter by vendor
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by priority
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in PO number or vendor name
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by order date range start
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by order date range end
 *     responses:
 *       200:
 *         description: Purchase order list retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/',
  authorize(['admin', 'manager', 'staff']),
  async (req, res) => {
    try {
      const { hotelId } = req.user;
      const filters = {
        status: req.query.status,
        vendorId: req.query.vendorId,
        department: req.query.department,
        category: req.query.category,
        priority: req.query.priority,
        search: req.query.search,
        dateRange: req.query.startDate && req.query.endDate ? {
          start: req.query.startDate,
          end: req.query.endDate
        } : undefined
      };

      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sortBy: req.query.sortBy || 'orderDate',
        sortOrder: req.query.sortOrder || 'desc',
        populate: req.query.populate !== 'false'
      };

      const result = await purchaseOrderService.getPurchaseOrderHistory(hotelId, filters, options);

      res.json({
        success: true,
        data: result.orders,
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/purchase-orders:
 *   post:
 *     summary: Create a new purchase order
 *     tags: [Purchase Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vendorId
 *               - department
 *               - category
 *               - items
 *               - requiredDate
 *               - expectedDeliveryDate
 *             properties:
 *               vendorId:
 *                 type: string
 *               department:
 *                 type: string
 *                 enum: [housekeeping, maintenance, kitchen, front_office, admin, laundry, security, other]
 *               category:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     inventoryItemId:
 *                       type: string
 *                     quantityOrdered:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *               requiredDate:
 *                 type: string
 *                 format: date-time
 *               expectedDeliveryDate:
 *                 type: string
 *                 format: date-time
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Purchase order created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/',
  authorize(['admin', 'manager', 'staff']),
  createPOValidation,
  validateRequest,
  async (req, res) => {
    try {
      const { hotelId, _id: userId } = req.user;
      const orderData = {
        ...req.body,
        hotelId
      };

      const purchaseOrder = await purchaseOrderService.createPurchaseOrder(orderData, userId);

      res.status(201).json({
        success: true,
        data: purchaseOrder,
        message: 'Purchase order created successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/purchase-orders/{id}:
 *   get:
 *     summary: Get purchase order details
 *     tags: [Purchase Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Purchase order ID
 *     responses:
 *       200:
 *         description: Purchase order details retrieved successfully
 *       404:
 *         description: Purchase order not found
 */
router.get('/:id',
  authorize(['admin', 'manager', 'staff']),
  [param('id').isMongoId().withMessage('Invalid purchase order ID')],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;

      const purchaseOrder = await purchaseOrderService.getPurchaseOrderDetails(id);

      if (!purchaseOrder) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        });
      }

      res.json({
        success: true,
        data: purchaseOrder
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/purchase-orders/{id}:
 *   patch:
 *     summary: Update purchase order
 *     tags: [Purchase Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Purchase order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *               expectedDeliveryDate:
 *                 type: string
 *                 format: date-time
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Purchase order updated successfully
 *       404:
 *         description: Purchase order not found
 */
router.patch('/:id',
  authorize(['admin', 'manager']),
  updatePOValidation,
  validateRequest,
  async (req, res) => {
    try {
      const { _id: userId } = req.user;
      const { id } = req.params;

      const purchaseOrder = await purchaseOrderService.updatePurchaseOrder(id, req.body, userId);

      res.json({
        success: true,
        data: purchaseOrder,
        message: 'Purchase order updated successfully'
      });
    } catch (error) {
      if (error.message === 'Purchase order not found') {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: error.message
        });
      }
    }
  }
);

/**
 * @swagger
 * /api/v1/purchase-orders/{id}/send:
 *   post:
 *     summary: Send purchase order to vendor
 *     tags: [Purchase Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Purchase order ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailOptions:
 *                 type: object
 *                 properties:
 *                   attachments:
 *                     type: array
 *     responses:
 *       200:
 *         description: Purchase order sent successfully
 *       404:
 *         description: Purchase order not found
 */
router.post('/:id/send',
  authorize(['admin', 'manager']),
  [param('id').isMongoId().withMessage('Invalid purchase order ID')],
  validateRequest,
  async (req, res) => {
    try {
      const { _id: userId } = req.user;
      const { id } = req.params;
      const { emailOptions = {} } = req.body;

      const purchaseOrder = await purchaseOrderService.sendPurchaseOrder(id, userId, emailOptions);

      res.json({
        success: true,
        data: purchaseOrder,
        message: 'Purchase order sent to vendor successfully'
      });
    } catch (error) {
      if (error.message === 'Purchase order not found') {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: error.message
        });
      }
    }
  }
);

/**
 * @swagger
 * /api/v1/purchase-orders/{id}/confirm:
 *   post:
 *     summary: Confirm purchase order by vendor
 *     tags: [Purchase Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Purchase order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vendorOrderNumber:
 *                 type: string
 *               expectedDeliveryDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Purchase order confirmed successfully
 *       404:
 *         description: Purchase order not found
 */
router.post('/:id/confirm',
  authorize(['admin', 'manager']),
  [
    param('id').isMongoId().withMessage('Invalid purchase order ID'),
    body('vendorOrderNumber').optional().trim().isLength({ min: 1 }).withMessage('Vendor order number required'),
    body('expectedDeliveryDate').optional().isISO8601().withMessage('Valid expected delivery date required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const confirmationData = req.body;

      const purchaseOrder = await purchaseOrderService.confirmPurchaseOrder(id, confirmationData);

      res.json({
        success: true,
        data: purchaseOrder,
        message: 'Purchase order confirmed successfully'
      });
    } catch (error) {
      if (error.message === 'Purchase order not found') {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: error.message
        });
      }
    }
  }
);

/**
 * @swagger
 * /api/v1/purchase-orders/{id}/receive:
 *   post:
 *     summary: Receive items for purchase order
 *     tags: [Purchase Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Purchase order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receivedItems
 *             properties:
 *               receivedItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *               qualityCheck:
 *                 type: object
 *                 properties:
 *                   approved:
 *                     type: boolean
 *                   notes:
 *                     type: string
 *                   defectsFound:
 *                     type: array
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Items received successfully
 *       404:
 *         description: Purchase order not found
 */
router.post('/:id/receive',
  authorize(['admin', 'manager', 'staff']),
  receivePOValidation,
  validateRequest,
  async (req, res) => {
    try {
      const { _id: userId } = req.user;
      const { id } = req.params;
      const receivingData = req.body;

      const purchaseOrder = await purchaseOrderService.receivePurchaseOrder(id, receivingData, userId);

      res.json({
        success: true,
        data: purchaseOrder,
        message: 'Items received successfully'
      });
    } catch (error) {
      if (error.message === 'Purchase order not found') {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: error.message
        });
      }
    }
  }
);

/**
 * @swagger
 * /api/v1/purchase-orders/{id}/cancel:
 *   post:
 *     summary: Cancel purchase order
 *     tags: [Purchase Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Purchase order ID
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
 *                 minLength: 1
 *     responses:
 *       200:
 *         description: Purchase order cancelled successfully
 *       404:
 *         description: Purchase order not found
 */
router.post('/:id/cancel',
  authorize(['admin', 'manager']),
  [
    param('id').isMongoId().withMessage('Invalid purchase order ID'),
    body('reason').trim().isLength({ min: 1 }).withMessage('Cancellation reason is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { _id: userId } = req.user;
      const { id } = req.params;
      const { reason } = req.body;

      const purchaseOrder = await purchaseOrderService.cancelPurchaseOrder(id, userId, reason);

      res.json({
        success: true,
        data: purchaseOrder,
        message: 'Purchase order cancelled successfully'
      });
    } catch (error) {
      if (error.message === 'Purchase order not found') {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: error.message
        });
      }
    }
  }
);

/**
 * @swagger
 * /api/v1/purchase-orders/pending:
 *   get:
 *     summary: Get pending purchase orders
 *     tags: [Purchase Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending purchase orders retrieved successfully
 */
router.get('/pending',
  authorize(['admin', 'manager', 'staff']),
  async (req, res) => {
    try {
      const { hotelId } = req.user;

      const pendingOrders = await purchaseOrderService.trackPendingOrders(hotelId);

      res.json({
        success: true,
        data: pendingOrders
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/purchase-orders/analytics:
 *   get:
 *     summary: Get purchase order analytics
 *     tags: [Purchase Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *         description: Analytics period
 *       - in: query
 *         name: vendorId
 *         schema:
 *           type: string
 *         description: Filter by vendor
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: Purchase order analytics retrieved successfully
 */
router.get('/analytics',
  authorize(['admin', 'manager']),
  async (req, res) => {
    try {
      const { hotelId } = req.user;
      const options = {
        period: req.query.period || 'month',
        vendorId: req.query.vendorId,
        department: req.query.department,
        category: req.query.category
      };

      const analytics = await purchaseOrderService.generatePOReport(hotelId, options);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/purchase-orders/metrics:
 *   get:
 *     summary: Get purchase order metrics
 *     tags: [Purchase Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *         description: Metrics period
 *     responses:
 *       200:
 *         description: Purchase order metrics retrieved successfully
 */
router.get('/metrics',
  authorize(['admin', 'manager']),
  async (req, res) => {
    try {
      const { hotelId } = req.user;
      const period = req.query.period || 'month';

      const metrics = await purchaseOrderService.calculatePOMetrics(hotelId, period);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

export default router;