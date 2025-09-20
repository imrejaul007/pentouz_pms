import express from 'express';
import { body, param, query } from 'express-validator';
import {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  getDepartmentHierarchy,
  assignStaff,
  updateAnalytics,
  getDepartmentMetrics,
  bulkUpdateDepartments,
  searchDepartments,
  exportDepartments,
  getDepartmentSummary,
  getDepartmentAuditLog,
  updateDepartmentKPIs,
  updateDepartmentBudget,
  getDepartmentStaff,
  updateDepartmentStatus,
  cloneDepartment
} from '../controllers/departmentController.js';
import { authenticate } from '../middleware/auth.js';
import authorize from '../middleware/authorize.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation rules
const createDepartmentValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Department name is required and must be between 1 and 100 characters'),
  body('code')
    .trim()
    .isLength({ min: 1, max: 10 })
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Department code must contain only uppercase letters, numbers, and underscores'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('departmentType')
    .isIn([
      'front_office', 'housekeeping', 'food_beverage', 'maintenance', 
      'security', 'finance', 'hr', 'marketing', 'management', 
      'spa_wellness', 'concierge', 'business_center', 'other'
    ])
    .withMessage('Invalid department type'),
  body('parentDepartment')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent department ID')
];

const updateDepartmentValidation = [
  param('id').isMongoId().withMessage('Invalid department ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Department name must be between 1 and 100 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 1, max: 10 })
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Department code must contain only uppercase letters, numbers, and underscores'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('departmentType')
    .optional()
    .isIn([
      'front_office', 'housekeeping', 'food_beverage', 'maintenance', 
      'security', 'finance', 'hr', 'marketing', 'management', 
      'spa_wellness', 'concierge', 'business_center', 'other'
    ])
    .withMessage('Invalid department type'),
  body('parentDepartment')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent department ID')
];

const departmentIdValidation = [
  param('id').isMongoId().withMessage('Invalid department ID')
];

const bulkUpdateValidation = [
  body('updates')
    .isArray({ min: 1 })
    .withMessage('Updates array is required'),
  body('updates.*.departmentId')
    .isMongoId()
    .withMessage('Each update must have a valid department ID'),
  body('updates.*.data')
    .isObject()
    .withMessage('Each update must have data object')
];

// Routes

/**
 * @swagger
 * /api/v1/departments:
 *   post:
 *     summary: Create a new department
 *     tags: [Departments]
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
 *               - departmentType
 *             properties:
 *               name:
 *                 type: string
 *                 description: Department name
 *               code:
 *                 type: string
 *                 description: Department code (uppercase)
 *               description:
 *                 type: string
 *                 description: Department description
 *               departmentType:
 *                 type: string
 *                 enum: [front_office, housekeeping, food_beverage, maintenance, security, finance, hr, marketing, management, spa_wellness, concierge, business_center, other]
 *               parentDepartment:
 *                 type: string
 *                 description: Parent department ID
 *     responses:
 *       201:
 *         description: Department created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', 
  authorize(['admin', 'manager']),
  createDepartmentValidation,
  createDepartment
);

/**
 * @swagger
 * /api/v1/departments:
 *   get:
 *     summary: Get all departments
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended, archived]
 *         description: Filter by status
 *       - in: query
 *         name: departmentType
 *         schema:
 *           type: string
 *         description: Filter by department type
 *       - in: query
 *         name: includeHierarchy
 *         schema:
 *           type: boolean
 *         description: Include hierarchy structure
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
 *     responses:
 *       200:
 *         description: Departments retrieved successfully
 */
router.get('/', 
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'archived']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  getDepartments
);

/**
 * @swagger
 * /api/v1/departments/hierarchy:
 *   get:
 *     summary: Get department hierarchy
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department hierarchy retrieved successfully
 */
router.get('/hierarchy', getDepartmentHierarchy);

/**
 * @swagger
 * /api/v1/departments/search:
 *   get:
 *     summary: Search departments
 *     tags: [Departments]
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
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
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
  searchDepartments
);

/**
 * @swagger
 * /api/v1/departments/export:
 *   get:
 *     summary: Export departments
 *     tags: [Departments]
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
 *         description: Departments exported successfully
 */
router.get('/export',
  authorize(['admin', 'manager']),
  query('format').optional().isIn(['json', 'csv']),
  exportDepartments
);

/**
 * @swagger
 * /api/v1/departments/summary:
 *   get:
 *     summary: Get departments summary
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department summary retrieved successfully
 */
router.get('/summary', getDepartmentSummary);

/**
 * @swagger
 * /api/v1/departments/bulk-update:
 *   put:
 *     summary: Bulk update departments
 *     tags: [Departments]
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
 *                     departmentId:
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
  bulkUpdateDepartments
);

/**
 * @swagger
 * /api/v1/departments/{id}:
 *   get:
 *     summary: Get department by ID
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID
 *       - in: query
 *         name: populate
 *         schema:
 *           type: boolean
 *         description: Populate related fields
 *       - in: query
 *         name: includeStats
 *         schema:
 *           type: boolean
 *         description: Include statistics
 *     responses:
 *       200:
 *         description: Department retrieved successfully
 *       404:
 *         description: Department not found
 */
router.get('/:id',
  departmentIdValidation,
  getDepartmentById
);

/**
 * @swagger
 * /api/v1/departments/{id}:
 *   put:
 *     summary: Update department
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID
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
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended, archived]
 *     responses:
 *       200:
 *         description: Department updated successfully
 *       404:
 *         description: Department not found
 */
router.put('/:id',
  authorize(['admin', 'manager']),
  updateDepartmentValidation,
  updateDepartment
);

/**
 * @swagger
 * /api/v1/departments/{id}:
 *   delete:
 *     summary: Delete department
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID
 *     responses:
 *       200:
 *         description: Department deleted successfully
 *       400:
 *         description: Cannot delete department with subdepartments or staff
 *       404:
 *         description: Department not found
 */
router.delete('/:id',
  authorize(['admin']),
  departmentIdValidation,
  deleteDepartment
);

// Department specific operations
router.post('/:id/assign-staff',
  authorize(['admin', 'manager']),
  departmentIdValidation,
  body('staffIds').isArray().withMessage('Staff IDs array is required'),
  assignStaff
);

router.put('/:id/analytics',
  authorize(['admin', 'manager']),
  departmentIdValidation,
  updateAnalytics
);

router.get('/:id/metrics',
  departmentIdValidation,
  query('period').optional().isIn(['7d', '30d', '90d', '1y']),
  getDepartmentMetrics
);

router.get('/:id/audit-log',
  departmentIdValidation,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  getDepartmentAuditLog
);

router.put('/:id/kpis',
  authorize(['admin', 'manager']),
  departmentIdValidation,
  body('kpis').isArray().withMessage('KPIs array is required'),
  updateDepartmentKPIs
);

router.put('/:id/budget',
  authorize(['admin', 'manager']),
  departmentIdValidation,
  body('budget').isObject().withMessage('Budget object is required'),
  updateDepartmentBudget
);

router.get('/:id/staff',
  departmentIdValidation,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  getDepartmentStaff
);

router.patch('/:id/status',
  authorize(['admin', 'manager']),
  departmentIdValidation,
  body('status').isIn(['active', 'inactive', 'suspended', 'archived']).withMessage('Invalid status'),
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  updateDepartmentStatus
);

router.post('/:id/clone',
  authorize(['admin', 'manager']),
  departmentIdValidation,
  body('newName').trim().isLength({ min: 1, max: 100 }).withMessage('New name is required'),
  body('newCode').trim().isLength({ min: 1, max: 10 }).matches(/^[A-Z0-9_]+$/).withMessage('New code is required and must be uppercase'),
  cloneDepartment
);

export default router;
