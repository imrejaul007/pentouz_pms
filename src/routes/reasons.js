import express from 'express';
import { body, param, query } from 'express-validator';
import {
  createReason,
  getReasons,
  getReasonById,
  updateReason,
  deleteReason,
  getReasonsByCategory,
  getReasonsByRole,
  getMostUsedReasons,
  logReasonUsage,
  searchReasons,
  bulkUpdateReasons,
  bulkCreateReasons,
  exportReasons,
  getReasonStats,
  getUsageAnalytics,
  validateReasonUsage,
  getReasonCategories,
  getUserRoles,
  cloneReason,
  updateReasonStatus
} from '../controllers/reasonController.js';
import { authenticate } from '../middleware/auth.js';
import authorize from '../middleware/authorize.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation rules
const createReasonValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Reason name is required and must be between 1 and 100 characters'),
  body('code')
    .trim()
    .isLength({ min: 1, max: 20 })
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('Reason code must contain only uppercase letters, numbers, underscores and hyphens'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('category')
    .isIn([
      'cancellation', 'no_show', 'modification', 'discount', 'comp', 'refund',
      'upgrade', 'downgrade', 'early_checkout', 'late_checkout', 'damage',
      'complaint', 'maintenance', 'overbooking', 'group_booking', 'vip',
      'loyalty', 'package', 'seasonal', 'promotional', 'operational', 'other'
    ])
    .withMessage('Invalid reason category'),
  body('subcategory')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Subcategory cannot exceed 50 characters'),
  body('maxRefundPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Max refund percentage must be between 0 and 100'),
  body('maxDiscountPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Max discount percentage must be between 0 and 100'),
  body('allowedRoles')
    .optional()
    .isArray()
    .withMessage('Allowed roles must be an array'),
  body('restrictedRoles')
    .optional()
    .isArray()
    .withMessage('Restricted roles must be an array'),
  body('applicableDepartments')
    .optional()
    .isArray()
    .withMessage('Applicable departments must be an array')
];

const updateReasonValidation = [
  param('id').isMongoId().withMessage('Invalid reason ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Reason name must be between 1 and 100 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('Reason code must contain only uppercase letters, numbers, underscores and hyphens'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('category')
    .optional()
    .isIn([
      'cancellation', 'no_show', 'modification', 'discount', 'comp', 'refund',
      'upgrade', 'downgrade', 'early_checkout', 'late_checkout', 'damage',
      'complaint', 'maintenance', 'overbooking', 'group_booking', 'vip',
      'loyalty', 'package', 'seasonal', 'promotional', 'operational', 'other'
    ])
    .withMessage('Invalid reason category'),
  body('maxRefundPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Max refund percentage must be between 0 and 100'),
  body('maxDiscountPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Max discount percentage must be between 0 and 100')
];

const reasonIdValidation = [
  param('id').isMongoId().withMessage('Invalid reason ID')
];

const bulkUpdateValidation = [
  body('updates')
    .isArray({ min: 1 })
    .withMessage('Updates array is required'),
  body('updates.*.reasonId')
    .isMongoId()
    .withMessage('Each update must have a valid reason ID'),
  body('updates.*.data')
    .isObject()
    .withMessage('Each update must have data object')
];

const bulkCreateValidation = [
  body('reasons')
    .isArray({ min: 1 })
    .withMessage('Reasons array is required'),
  body('reasons.*.name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each reason must have a name between 1 and 100 characters'),
  body('reasons.*.code')
    .trim()
    .isLength({ min: 1, max: 20 })
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('Each reason code must contain only uppercase letters, numbers, underscores and hyphens'),
  body('reasons.*.category')
    .isIn([
      'cancellation', 'no_show', 'modification', 'discount', 'comp', 'refund',
      'upgrade', 'downgrade', 'early_checkout', 'late_checkout', 'damage',
      'complaint', 'maintenance', 'overbooking', 'group_booking', 'vip',
      'loyalty', 'package', 'seasonal', 'promotional', 'operational', 'other'
    ])
    .withMessage('Each reason must have a valid category')
];

const logUsageValidation = [
  param('id').isMongoId().withMessage('Invalid reason ID'),
  body('context')
    .isIn(['booking', 'cancellation', 'modification', 'billing', 'maintenance', 'complaint', 'other'])
    .withMessage('Invalid context'),
  body('entityId')
    .isMongoId()
    .withMessage('Entity ID must be a valid MongoDB ObjectId'),
  body('entityType')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Entity type is required'),
  body('financialImpact.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Financial impact amount must be positive'),
  body('financialImpact.type')
    .optional()
    .isIn(['refund', 'discount', 'comp', 'charge', 'adjustment'])
    .withMessage('Invalid financial impact type'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters')
];

// Routes

/**
 * @swagger
 * /api/v1/reasons:
 *   post:
 *     summary: Create a new reason
 *     tags: [Reasons]
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
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *                 description: Reason name
 *               code:
 *                 type: string
 *                 description: Reason code (uppercase)
 *               category:
 *                 type: string
 *                 enum: [cancellation, no_show, modification, discount, comp, refund, upgrade, downgrade, early_checkout, late_checkout, damage, complaint, maintenance, overbooking, group_booking, vip, loyalty, package, seasonal, promotional, operational, other]
 *               description:
 *                 type: string
 *                 description: Reason description
 *     responses:
 *       201:
 *         description: Reason created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', 
  authorize(['admin', 'manager']),
  createReasonValidation,
  createReason
);

/**
 * @swagger
 * /api/v1/reasons:
 *   get:
 *     summary: Get all reasons
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
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
 *           default: name
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
 *         description: Reasons retrieved successfully
 */
router.get('/', 
  query('isActive').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  getReasons
);

/**
 * @swagger
 * /api/v1/reasons/categories:
 *   get:
 *     summary: Get available reason categories
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get('/categories', getReasonCategories);

/**
 * @swagger
 * /api/v1/reasons/roles:
 *   get:
 *     summary: Get available user roles for permissions
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
 */
router.get('/roles', getUserRoles);

/**
 * @swagger
 * /api/v1/reasons/search:
 *   get:
 *     summary: Search reasons
 *     tags: [Reasons]
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
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
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
  searchReasons
);

/**
 * @swagger
 * /api/v1/reasons/export:
 *   get:
 *     summary: Export reasons
 *     tags: [Reasons]
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
 *         description: Reasons exported successfully
 */
router.get('/export',
  authorize(['admin', 'manager']),
  query('format').optional().isIn(['json', 'csv']),
  exportReasons
);

/**
 * @swagger
 * /api/v1/reasons/stats:
 *   get:
 *     summary: Get reason statistics
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/stats', getReasonStats);

/**
 * @swagger
 * /api/v1/reasons/analytics:
 *   get:
 *     summary: Get usage analytics
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
router.get('/analytics',
  query('period').optional().isIn(['7d', '30d', '90d', '1y']),
  getUsageAnalytics
);

/**
 * @swagger
 * /api/v1/reasons/most-used:
 *   get:
 *     summary: Get most used reasons
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results
 *     responses:
 *       200:
 *         description: Most used reasons retrieved successfully
 */
router.get('/most-used',
  query('limit').optional().isInt({ min: 1, max: 50 }),
  getMostUsedReasons
);

/**
 * @swagger
 * /api/v1/reasons/category/{category}:
 *   get:
 *     summary: Get reasons by category
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *         description: Reason category
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Include inactive reasons
 *     responses:
 *       200:
 *         description: Reasons retrieved successfully
 */
router.get('/category/:category',
  param('category').isIn([
    'cancellation', 'no_show', 'modification', 'discount', 'comp', 'refund',
    'upgrade', 'downgrade', 'early_checkout', 'late_checkout', 'damage',
    'complaint', 'maintenance', 'overbooking', 'group_booking', 'vip',
    'loyalty', 'package', 'seasonal', 'promotional', 'operational', 'other'
  ]).withMessage('Invalid category'),
  query('includeInactive').optional().isBoolean(),
  getReasonsByCategory
);

/**
 * @swagger
 * /api/v1/reasons/role/{role}:
 *   get:
 *     summary: Get reasons by user role
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *         description: User role
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Include inactive reasons
 *     responses:
 *       200:
 *         description: Reasons retrieved successfully
 */
router.get('/role/:role',
  param('role').isIn(['admin', 'manager', 'supervisor', 'front_desk', 'housekeeping', 'maintenance', 'guest_services']).withMessage('Invalid role'),
  query('includeInactive').optional().isBoolean(),
  getReasonsByRole
);

/**
 * @swagger
 * /api/v1/reasons/bulk-update:
 *   put:
 *     summary: Bulk update reasons
 *     tags: [Reasons]
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
 *                     reasonId:
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
  bulkUpdateReasons
);

/**
 * @swagger
 * /api/v1/reasons/bulk-create:
 *   post:
 *     summary: Bulk create reasons
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reasons
 *             properties:
 *               reasons:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - code
 *                     - category
 *     responses:
 *       200:
 *         description: Bulk creation completed
 */
router.post('/bulk-create',
  authorize(['admin', 'manager']),
  bulkCreateValidation,
  bulkCreateReasons
);

/**
 * @swagger
 * /api/v1/reasons/{id}:
 *   get:
 *     summary: Get reason by ID
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Reason ID
 *       - in: query
 *         name: populate
 *         schema:
 *           type: boolean
 *         description: Populate related fields
 *       - in: query
 *         name: includeUsageLog
 *         schema:
 *           type: boolean
 *         description: Include usage log
 *     responses:
 *       200:
 *         description: Reason retrieved successfully
 *       404:
 *         description: Reason not found
 */
router.get('/:id',
  reasonIdValidation,
  query('populate').optional().isBoolean(),
  query('includeUsageLog').optional().isBoolean(),
  getReasonById
);

/**
 * @swagger
 * /api/v1/reasons/{id}:
 *   put:
 *     summary: Update reason
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Reason ID
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
 *         description: Reason updated successfully
 *       404:
 *         description: Reason not found
 */
router.put('/:id',
  authorize(['admin', 'manager']),
  updateReasonValidation,
  updateReason
);

/**
 * @swagger
 * /api/v1/reasons/{id}:
 *   delete:
 *     summary: Delete reason
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Reason ID
 *     responses:
 *       200:
 *         description: Reason deleted successfully
 *       400:
 *         description: Cannot delete reason with recent usage
 *       404:
 *         description: Reason not found
 */
router.delete('/:id',
  authorize(['admin']),
  reasonIdValidation,
  deleteReason
);

/**
 * @swagger
 * /api/v1/reasons/{id}/validate:
 *   get:
 *     summary: Validate reason usage
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Reason ID
 *       - in: query
 *         name: context
 *         required: true
 *         schema:
 *           type: string
 *         description: Usage context
 *       - in: query
 *         name: amount
 *         schema:
 *           type: number
 *         description: Financial amount (optional)
 *     responses:
 *       200:
 *         description: Validation result
 */
router.get('/:id/validate',
  reasonIdValidation,
  query('context').trim().isLength({ min: 1 }).withMessage('Context is required'),
  query('amount').optional().isFloat({ min: 0 }),
  validateReasonUsage
);

/**
 * @swagger
 * /api/v1/reasons/{id}/log-usage:
 *   post:
 *     summary: Log reason usage
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Reason ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - context
 *               - entityId
 *               - entityType
 *             properties:
 *               context:
 *                 type: string
 *                 enum: [booking, cancellation, modification, billing, maintenance, complaint, other]
 *               entityId:
 *                 type: string
 *               entityType:
 *                 type: string
 *               financialImpact:
 *                 type: object
 *                 properties:
 *                   amount:
 *                     type: number
 *                   currency:
 *                     type: string
 *                   type:
 *                     type: string
 *                     enum: [refund, discount, comp, charge, adjustment]
 *               notes:
 *                 type: string
 *               approvedBy:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usage logged successfully
 */
router.post('/:id/log-usage',
  logUsageValidation,
  logReasonUsage
);

/**
 * @swagger
 * /api/v1/reasons/{id}/clone:
 *   post:
 *     summary: Clone reason
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Reason ID
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
 *         description: Reason cloned successfully
 */
router.post('/:id/clone',
  authorize(['admin', 'manager']),
  reasonIdValidation,
  body('newName').trim().isLength({ min: 1, max: 100 }).withMessage('New name is required'),
  body('newCode').trim().isLength({ min: 1, max: 20 }).matches(/^[A-Z0-9_-]+$/).withMessage('New code is required and must be uppercase'),
  cloneReason
);

/**
 * @swagger
 * /api/v1/reasons/{id}/status:
 *   patch:
 *     summary: Update reason status
 *     tags: [Reasons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Reason ID
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
  reasonIdValidation,
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  updateReasonStatus
);

export default router;