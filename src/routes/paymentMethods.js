import express from 'express';
import { body, param, query } from 'express-validator';
import {
  createPaymentMethod,
  getPaymentMethods,
  getPaymentMethodById,
  updatePaymentMethod,
  deletePaymentMethod,
  getPaymentMethodsByType,
  getAvailablePaymentMethods,
  testGatewayConnection,
  updateAnalytics,
  getPaymentMethodAnalytics,
  searchPaymentMethods,
  bulkUpdatePaymentMethods,
  exportPaymentMethods,
  getPaymentMethodStats,
  calculateFees,
  validatePaymentMethodUsage,
  getPaymentMethodTypes,
  getGatewayProviders,
  clonePaymentMethod,
  updatePaymentMethodStatus,
  updateDisplayOrder
} from '../controllers/paymentMethodController.js';
import { authenticate } from '../middleware/auth.js';
import authorize from '../middleware/authorize.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation rules
const createPaymentMethodValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Payment method name is required and must be between 1 and 100 characters'),
  body('code')
    .trim()
    .isLength({ min: 1, max: 20 })
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('Payment method code must contain only uppercase letters, numbers, underscores and hyphens'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('type')
    .isIn([
      'credit_card', 'debit_card', 'cash', 'check', 'bank_transfer', 
      'digital_wallet', 'cryptocurrency', 'gift_card', 'voucher', 
      'loyalty_points', 'corporate_account', 'invoice', 'other'
    ])
    .withMessage('Invalid payment method type'),
  body('gateway.provider')
    .isIn([
      'stripe', 'paypal', 'square', 'authorize_net', 'braintree', 
      'worldpay', 'adyen', 'checkout', 'razorpay', 'payu', 
      'internal', 'manual', 'other'
    ])
    .withMessage('Invalid gateway provider'),
  body('fees.percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Fee percentage must be between 0 and 100'),
  body('fees.fixed')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Fixed fee must be non-negative'),
  body('limits.perTransaction.minAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum transaction amount must be non-negative'),
  body('limits.perTransaction.maxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum transaction amount must be non-negative')
];

const updatePaymentMethodValidation = [
  param('id').isMongoId().withMessage('Invalid payment method ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Payment method name must be between 1 and 100 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('Payment method code must contain only uppercase letters, numbers, underscores and hyphens'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('type')
    .optional()
    .isIn([
      'credit_card', 'debit_card', 'cash', 'check', 'bank_transfer', 
      'digital_wallet', 'cryptocurrency', 'gift_card', 'voucher', 
      'loyalty_points', 'corporate_account', 'invoice', 'other'
    ])
    .withMessage('Invalid payment method type'),
  body('fees.percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Fee percentage must be between 0 and 100'),
  body('fees.fixed')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Fixed fee must be non-negative')
];

const paymentMethodIdValidation = [
  param('id').isMongoId().withMessage('Invalid payment method ID')
];

const bulkUpdateValidation = [
  body('updates')
    .isArray({ min: 1 })
    .withMessage('Updates array is required'),
  body('updates.*.paymentMethodId')
    .isMongoId()
    .withMessage('Each update must have a valid payment method ID'),
  body('updates.*.data')
    .isObject()
    .withMessage('Each update must have data object')
];

const analyticsUpdateValidation = [
  param('id').isMongoId().withMessage('Invalid payment method ID'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('success')
    .isBoolean()
    .withMessage('Success must be a boolean'),
  body('processingTime')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Processing time must be non-negative'),
  body('refunded')
    .optional()
    .isBoolean()
    .withMessage('Refunded must be a boolean'),
  body('refundAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Refund amount must be non-negative')
];

// Routes

/**
 * @swagger
 * /api/v1/payment-methods:
 *   post:
 *     summary: Create a new payment method
 *     tags: [Payment Methods]
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
 *               - code
 *               - type
 *               - gateway
 *             properties:
 *               name:
 *                 type: string
 *                 description: Payment method name
 *               code:
 *                 type: string
 *                 description: Payment method code (uppercase)
 *               type:
 *                 type: string
 *                 enum: [credit_card, debit_card, cash, check, bank_transfer, digital_wallet, cryptocurrency, gift_card, voucher, loyalty_points, corporate_account, invoice, other]
 *               description:
 *                 type: string
 *                 description: Payment method description
 *               gateway:
 *                 type: object
 *                 properties:
 *                   provider:
 *                     type: string
 *                     enum: [stripe, paypal, square, authorize_net, braintree, worldpay, adyen, checkout, razorpay, payu, internal, manual, other]
 *     responses:
 *       201:
 *         description: Payment method created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', 
  authorize(['admin', 'manager']),
  createPaymentMethodValidation,
  createPaymentMethod
);

/**
 * @swagger
 * /api/v1/payment-methods:
 *   get:
 *     summary: Get all payment methods
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by payment method type
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: userRole
 *         schema:
 *           type: string
 *         description: Filter by user role permissions
 *       - in: query
 *         name: includeOffline
 *         schema:
 *           type: boolean
 *         description: Include offline payment methods
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: display.order
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Payment methods retrieved successfully
 */
router.get('/', 
  query('isActive').optional().isBoolean(),
  query('includeOffline').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  getPaymentMethods
);

/**
 * @swagger
 * /api/v1/payment-methods/types:
 *   get:
 *     summary: Get available payment method types
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment method types retrieved successfully
 */
router.get('/types', getPaymentMethodTypes);

/**
 * @swagger
 * /api/v1/payment-methods/gateway-providers:
 *   get:
 *     summary: Get available gateway providers
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gateway providers retrieved successfully
 */
router.get('/gateway-providers', getGatewayProviders);

/**
 * @swagger
 * /api/v1/payment-methods/available:
 *   get:
 *     summary: Get available payment methods at specific time
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Check availability at specific date/time
 *     responses:
 *       200:
 *         description: Available payment methods retrieved successfully
 */
router.get('/available',
  query('dateTime').optional().isISO8601(),
  getAvailablePaymentMethods
);

/**
 * @swagger
 * /api/v1/payment-methods/search:
 *   get:
 *     summary: Search payment methods
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by payment method type
 *       - in: query
 *         name: userRole
 *         schema:
 *           type: string
 *         description: Filter by user role
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 */
router.get('/search',
  query('q').trim().isLength({ min: 1 }).withMessage('Search query is required'),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  searchPaymentMethods
);

/**
 * @swagger
 * /api/v1/payment-methods/export:
 *   get:
 *     summary: Export payment methods
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format
 *     responses:
 *       200:
 *         description: Payment methods exported successfully
 */
router.get('/export',
  authorize(['admin', 'manager']),
  query('format').optional().isIn(['json', 'csv']),
  exportPaymentMethods
);

/**
 * @swagger
 * /api/v1/payment-methods/stats:
 *   get:
 *     summary: Get payment method statistics
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/stats', getPaymentMethodStats);

/**
 * @swagger
 * /api/v1/payment-methods/type/{type}:
 *   get:
 *     summary: Get payment methods by type
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method type
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Include inactive payment methods
 *     responses:
 *       200:
 *         description: Payment methods retrieved successfully
 */
router.get('/type/:type',
  param('type').isIn([
    'credit_card', 'debit_card', 'cash', 'check', 'bank_transfer', 
    'digital_wallet', 'cryptocurrency', 'gift_card', 'voucher', 
    'loyalty_points', 'corporate_account', 'invoice', 'other'
  ]).withMessage('Invalid payment method type'),
  query('includeInactive').optional().isBoolean(),
  getPaymentMethodsByType
);

/**
 * @swagger
 * /api/v1/payment-methods/bulk-update:
 *   put:
 *     summary: Bulk update payment methods
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updates
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     paymentMethodId:
 *                       type: string
 *                     data:
 *                       type: object
 *     responses:
 *       200:
 *         description: Bulk update completed
 */
router.put('/bulk-update',
  authorize(['admin', 'manager']),
  bulkUpdateValidation,
  bulkUpdatePaymentMethods
);

/**
 * @swagger
 * /api/v1/payment-methods/display-order:
 *   put:
 *     summary: Update display order of payment methods
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updates
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     order:
 *                       type: number
 *     responses:
 *       200:
 *         description: Display order updated successfully
 */
router.put('/display-order',
  authorize(['admin', 'manager']),
  body('updates').isArray({ min: 1 }).withMessage('Updates array is required'),
  body('updates.*.id').isMongoId().withMessage('Each update must have a valid ID'),
  body('updates.*.order').isInt({ min: 0 }).withMessage('Each update must have a valid order number'),
  updateDisplayOrder
);

/**
 * @swagger
 * /api/v1/payment-methods/{id}:
 *   get:
 *     summary: Get payment method by ID
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method ID
 *       - in: query
 *         name: populate
 *         schema:
 *           type: boolean
 *         description: Populate related fields
 *       - in: query
 *         name: includeAnalytics
 *         schema:
 *           type: boolean
 *         description: Include analytics data
 *     responses:
 *       200:
 *         description: Payment method retrieved successfully
 *       404:
 *         description: Payment method not found
 */
router.get('/:id',
  paymentMethodIdValidation,
  query('populate').optional().isBoolean(),
  query('includeAnalytics').optional().isBoolean(),
  getPaymentMethodById
);

/**
 * @swagger
 * /api/v1/payment-methods/{id}:
 *   put:
 *     summary: Update payment method
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Payment method updated successfully
 *       404:
 *         description: Payment method not found
 */
router.put('/:id',
  authorize(['admin', 'manager']),
  updatePaymentMethodValidation,
  updatePaymentMethod
);

/**
 * @swagger
 * /api/v1/payment-methods/{id}:
 *   delete:
 *     summary: Delete payment method
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method ID
 *     responses:
 *       200:
 *         description: Payment method deleted successfully
 *       400:
 *         description: Cannot delete payment method with recent transactions
 *       404:
 *         description: Payment method not found
 */
router.delete('/:id',
  authorize(['admin']),
  paymentMethodIdValidation,
  deletePaymentMethod
);

/**
 * @swagger
 * /api/v1/payment-methods/{id}/test-gateway:
 *   post:
 *     summary: Test gateway connection
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method ID
 *     responses:
 *       200:
 *         description: Gateway test result
 */
router.post('/:id/test-gateway',
  authorize(['admin', 'manager']),
  paymentMethodIdValidation,
  testGatewayConnection
);

/**
 * @swagger
 * /api/v1/payment-methods/{id}/analytics:
 *   put:
 *     summary: Update payment method analytics
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - success
 *             properties:
 *               amount:
 *                 type: number
 *               success:
 *                 type: boolean
 *               processingTime:
 *                 type: number
 *               refunded:
 *                 type: boolean
 *               refundAmount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Analytics updated successfully
 */
router.put('/:id/analytics',
  authorize(['admin', 'manager', 'supervisor']),
  analyticsUpdateValidation,
  updateAnalytics
);

/**
 * @swagger
 * /api/v1/payment-methods/{id}/analytics:
 *   get:
 *     summary: Get payment method analytics
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Analytics period
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 */
router.get('/:id/analytics',
  paymentMethodIdValidation,
  query('period').optional().isIn(['7d', '30d', '90d', '1y']),
  getPaymentMethodAnalytics
);

/**
 * @swagger
 * /api/v1/payment-methods/{id}/calculate-fees:
 *   get:
 *     summary: Calculate fees for payment method
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method ID
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *         description: Transaction amount
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           default: USD
 *         description: Currency code
 *     responses:
 *       200:
 *         description: Fee calculation completed
 */
router.get('/:id/calculate-fees',
  paymentMethodIdValidation,
  query('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  query('currency').optional().isLength({ min: 3, max: 3 }),
  calculateFees
);

/**
 * @swagger
 * /api/v1/payment-methods/{id}/validate:
 *   get:
 *     summary: Validate payment method usage
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method ID
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *         description: Transaction amount
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           default: USD
 *         description: Currency code
 *       - in: query
 *         name: dateTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Transaction date/time
 *     responses:
 *       200:
 *         description: Validation result
 */
router.get('/:id/validate',
  paymentMethodIdValidation,
  query('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  query('currency').optional().isLength({ min: 3, max: 3 }),
  query('dateTime').optional().isISO8601(),
  validatePaymentMethodUsage
);

/**
 * @swagger
 * /api/v1/payment-methods/{id}/clone:
 *   post:
 *     summary: Clone payment method
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newName
 *               - newCode
 *             properties:
 *               newName:
 *                 type: string
 *               newCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment method cloned successfully
 */
router.post('/:id/clone',
  authorize(['admin', 'manager']),
  paymentMethodIdValidation,
  body('newName').trim().isLength({ min: 1, max: 100 }).withMessage('New name is required'),
  body('newCode').trim().isLength({ min: 1, max: 20 }).matches(/^[A-Z0-9_-]+$/).withMessage('New code is required and must be uppercase'),
  clonePaymentMethod
);

/**
 * @swagger
 * /api/v1/payment-methods/{id}/status:
 *   patch:
 *     summary: Update payment method status
 *     tags: [Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *               reason:
 *                 type: string
 *                 description: Reason for status change
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
router.patch('/:id/status',
  authorize(['admin', 'manager']),
  paymentMethodIdValidation,
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  updatePaymentMethodStatus
);

export default router;