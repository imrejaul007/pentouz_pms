import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { createCacheMiddleware, createCacheInvalidationMiddleware } from '../middleware/cache.js';
import propertyGroupController from '../controllers/propertyGroupController.js';

const router = express.Router();

// Property Group specific cache middlewares
const propertyGroupCacheMiddleware = createCacheMiddleware({
  ttl: 1800, // 30 minutes
  keyGenerator: (req) => `property-group:${req.params.id || 'list'}:${req.user._id}`,
  condition: (req) => req.method === 'GET'
});

const dashboardCacheMiddleware = createCacheMiddleware({
  ttl: 300, // 5 minutes
  keyGenerator: (req) => `property-group-dashboard:${req.params.id}:${req.query.period || '7d'}:${req.user._id}`,
  condition: (req) => req.method === 'GET'
});

const propertyGroupInvalidationMiddleware = createCacheInvalidationMiddleware([
  'property-group:*',
  'property-group-dashboard:*',
  'hotel:*',
  'analytics:*'
]);

// Validation rules
const createPropertyGroupValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and must be between 1 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('groupType')
    .isIn(['chain', 'franchise', 'management_company', 'independent'])
    .withMessage('Invalid group type'),
  body('contact.email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
  body('contact.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid phone number'),
  body('settings.baseCurrency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency code must be 3 characters'),
  body('settings.timezone')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Timezone is required if provided')
];

const updatePropertyGroupValidation = [
  param('id').isMongoId().withMessage('Invalid property group ID'),
  ...createPropertyGroupValidation
];

const propertyIdValidation = [
  param('id').isMongoId().withMessage('Invalid property group ID'),
  body('propertyIds')
    .isArray({ min: 1 })
    .withMessage('Property IDs must be a non-empty array'),
  body('propertyIds.*')
    .isMongoId()
    .withMessage('Each property ID must be valid')
];

const syncSettingsValidation = [
  param('id').isMongoId().withMessage('Invalid property group ID'),
  body('settingsToSync')
    .optional()
    .isObject()
    .withMessage('Settings to sync must be an object')
];

/**
 * @swagger
 * /api/v1/property-groups:
 *   post:
 *     summary: Create a new property group
 *     tags: [Property Groups]
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
 *               - groupType
 *             properties:
 *               name:
 *                 type: string
 *                 description: Property group name
 *               description:
 *                 type: string
 *                 description: Property group description
 *               groupType:
 *                 type: string
 *                 enum: [chain, franchise, management_company, independent]
 *                 description: Type of property group
 *     responses:
 *       201:
 *         description: Property group created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', 
  authenticate, 
  authorize(['admin', 'manager']),
  createPropertyGroupValidation,
  propertyGroupInvalidationMiddleware,
  propertyGroupController.createPropertyGroup
);

/**
 * @swagger
 * /api/v1/property-groups:
 *   get:
 *     summary: Get all property groups for the current user
 *     tags: [Property Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *         description: Filter by status
 *       - in: query
 *         name: groupType
 *         schema:
 *           type: string
 *           enum: [chain, franchise, management_company, independent]
 *         description: Filter by group type
 *     responses:
 *       200:
 *         description: Property groups retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', 
  authenticate, 
  authorize(['admin', 'manager']),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['active', 'inactive', 'suspended']),
  query('groupType').optional().isIn(['chain', 'franchise', 'management_company', 'independent']),
  propertyGroupCacheMiddleware,
  propertyGroupController.getPropertyGroups
);

/**
 * @swagger
 * /api/v1/property-groups/{id}:
 *   get:
 *     summary: Get a specific property group by ID
 *     tags: [Property Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property group ID
 *     responses:
 *       200:
 *         description: Property group retrieved successfully
 *       404:
 *         description: Property group not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/:id', 
  authenticate, 
  authorize(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid property group ID'),
  propertyGroupCacheMiddleware,
  propertyGroupController.getPropertyGroupById
);

/**
 * @swagger
 * /api/v1/property-groups/{id}:
 *   put:
 *     summary: Update a property group
 *     tags: [Property Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property group ID
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
 *                 enum: [active, inactive, suspended]
 *     responses:
 *       200:
 *         description: Property group updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Property group not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put('/:id', 
  authenticate, 
  authorize(['admin', 'manager']),
  updatePropertyGroupValidation,
  propertyGroupInvalidationMiddleware,
  propertyGroupController.updatePropertyGroup
);

/**
 * @swagger
 * /api/v1/property-groups/{id}:
 *   delete:
 *     summary: Delete a property group
 *     tags: [Property Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property group ID
 *     responses:
 *       200:
 *         description: Property group deleted successfully
 *       400:
 *         description: Cannot delete group with associated properties
 *       404:
 *         description: Property group not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete('/:id', 
  authenticate, 
  authorize(['admin']),
  param('id').isMongoId().withMessage('Invalid property group ID'),
  propertyGroupInvalidationMiddleware,
  propertyGroupController.deletePropertyGroup
);

/**
 * @swagger
 * /api/v1/property-groups/{id}/properties:
 *   post:
 *     summary: Add properties to a group
 *     tags: [Property Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property group ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - propertyIds
 *             properties:
 *               propertyIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of property IDs to add to the group
 *     responses:
 *       200:
 *         description: Properties added to group successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Property group not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/:id/properties', 
  authenticate, 
  authorize(['admin', 'manager']),
  propertyIdValidation,
  propertyGroupInvalidationMiddleware,
  propertyGroupController.addPropertiesToGroup
);

/**
 * @swagger
 * /api/v1/property-groups/{id}/properties:
 *   delete:
 *     summary: Remove properties from a group
 *     tags: [Property Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property group ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - propertyIds
 *             properties:
 *               propertyIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of property IDs to remove from the group
 *     responses:
 *       200:
 *         description: Properties removed from group successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Property group not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete('/:id/properties', 
  authenticate, 
  authorize(['admin', 'manager']),
  propertyIdValidation,
  propertyGroupInvalidationMiddleware,
  propertyGroupController.removePropertiesFromGroup
);

/**
 * @swagger
 * /api/v1/property-groups/{id}/sync:
 *   post:
 *     summary: Sync group settings to all properties
 *     tags: [Property Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property group ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settingsToSync:
 *                 type: object
 *                 description: Specific settings to sync to properties
 *     responses:
 *       200:
 *         description: Settings synced successfully
 *       404:
 *         description: Property group not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/:id/sync', 
  authenticate, 
  authorize(['admin', 'manager']),
  syncSettingsValidation,
  propertyGroupInvalidationMiddleware,
  propertyGroupController.syncGroupSettings
);

/**
 * @swagger
 * /api/v1/property-groups/{id}/dashboard:
 *   get:
 *     summary: Get consolidated dashboard for all properties in a group
 *     tags: [Property Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property group ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           default: 7d
 *         description: Time period (e.g., 7d, 30d, 90d)
 *     responses:
 *       200:
 *         description: Consolidated dashboard data retrieved successfully
 *       404:
 *         description: Property group not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/:id/dashboard', 
  authenticate, 
  authorize(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid property group ID'),
  query('period').optional().matches(/^\d+d$/).withMessage('Period must be in format: 7d, 30d, etc.'),
  dashboardCacheMiddleware,
  propertyGroupController.getConsolidatedDashboard
);

/**
 * @swagger
 * /api/v1/property-groups/{id}/audit-log:
 *   get:
 *     summary: Get audit log for a property group
 *     tags: [Property Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property group ID
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
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Audit log retrieved successfully
 *       404:
 *         description: Property group not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/:id/audit-log', 
  authenticate, 
  authorize(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid property group ID'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  propertyGroupController.getPropertyGroupAuditLog
);

export default router;