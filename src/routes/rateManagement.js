import express from 'express';
import rateManagementController from '../controllers/rateManagementController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     RatePlan:
 *       type: object
 *       required:
 *         - name
 *         - type
 *         - baseRates
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         type:
 *           type: string
 *           enum: [BAR, Corporate, Package, Promotional, Group, Government, Member]
 *         baseRates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               roomType:
 *                 type: string
 *                 enum: [single, double, suite, deluxe]
 *               rate:
 *                 type: number
 *                 minimum: 0
 */

// Rate calculation endpoints
/**
 * @swagger
 * /api/v1/rates/best-rate:
 *   get:
 *     summary: Get the best available rate for a room
 *     tags: [Rate Management]
 *     parameters:
 *       - in: query
 *         name: roomType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *       - in: query
 *         name: checkIn
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: checkOut
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: guestCount
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: promoCode
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Best available rate
 */
router.get('/best-rate', rateManagementController.getBestRate);

/**
 * @swagger
 * /api/v1/rates/all-rates:
 *   get:
 *     summary: Get all available rates for comparison
 *     tags: [Rate Management]
 *     parameters:
 *       - in: query
 *         name: roomType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *       - in: query
 *         name: checkIn
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: checkOut
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: includeDetails
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: All available rates
 */
router.get('/all-rates', rateManagementController.getAllRates);

// Rate Plan Management
/**
 * @swagger
 * /api/v1/rates/plans:
 *   post:
 *     summary: Create a new rate plan
 *     tags: [Rate Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RatePlan'
 *     responses:
 *       201:
 *         description: Rate plan created successfully
 */
router.post('/plans', authenticate, authorize(['admin', 'revenue_manager']), rateManagementController.createRatePlan);

/**
 * @swagger
 * /api/v1/rates/plans:
 *   get:
 *     summary: Get all rate plans
 *     tags: [Rate Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [BAR, Corporate, Package, Promotional, Group, Government, Member]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of rate plans
 */
router.get('/plans', authenticate, authorize(['admin', 'revenue_manager', 'manager']), rateManagementController.getRatePlans);

/**
 * @swagger
 * /api/v1/rates/plans/{id}:
 *   put:
 *     summary: Update a rate plan
 *     tags: [Rate Management]
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
 *             $ref: '#/components/schemas/RatePlan'
 *     responses:
 *       200:
 *         description: Rate plan updated successfully
 */
router.put('/plans/:id', authenticate, authorize(['admin', 'revenue_manager']), rateManagementController.updateRatePlan);

/**
 * @swagger
 * /api/v1/rates/plans/{id}:
 *   delete:
 *     summary: Deactivate a rate plan
 *     tags: [Rate Management]
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
 *         description: Rate plan deactivated successfully
 */
router.delete('/plans/:id', authenticate, authorize(['admin', 'revenue_manager']), rateManagementController.deleteRatePlan);

// Seasonal Rates
/**
 * @swagger
 * /api/v1/rates/seasonal:
 *   post:
 *     summary: Create seasonal rate adjustment
 *     tags: [Rate Management]
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
 *               - startDate
 *               - endDate
 *               - rateAdjustments
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               rateAdjustments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     roomType:
 *                       type: string
 *                       enum: [single, double, suite, deluxe]
 *                     adjustmentType:
 *                       type: string
 *                       enum: [percentage, fixed]
 *                     adjustmentValue:
 *                       type: number
 *     responses:
 *       201:
 *         description: Seasonal rate created successfully
 */
router.post('/seasonal', authenticate, authorize(['admin', 'revenue_manager']), rateManagementController.createSeasonalRate);

/**
 * @swagger
 * /api/v1/rates/seasonal:
 *   get:
 *     summary: Get seasonal rates
 *     tags: [Rate Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of seasonal rates
 */
router.get('/seasonal', authenticate, authorize(['admin', 'revenue_manager', 'manager']), rateManagementController.getSeasonalRates);

/**
 * @swagger
 * /api/v1/rates/seasonal/{id}:
 *   put:
 *     summary: Update seasonal rate
 *     tags: [Rate Management]
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
 *         description: Seasonal rate updated successfully
 */
router.put('/seasonal/:id', authenticate, authorize(['admin', 'revenue_manager']), rateManagementController.updateSeasonalRate);

// Rate Overrides
/**
 * @swagger
 * /api/v1/rates/override:
 *   post:
 *     summary: Override rate for specific date
 *     tags: [Rate Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - roomType
 *               - overrideRate
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               roomType:
 *                 type: string
 *                 enum: [single, double, suite, deluxe]
 *               ratePlanId:
 *                 type: string
 *               overrideRate:
 *                 type: number
 *                 minimum: 0
 *               reason:
 *                 type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Rate override created successfully
 */
router.post('/override', authenticate, authorize(['admin', 'revenue_manager']), rateManagementController.overrideRate);

/**
 * @swagger
 * /api/v1/rates/override:
 *   get:
 *     summary: Get rate overrides
 *     tags: [Rate Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomType
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe]
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
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of rate overrides
 */
router.get('/override', authenticate, authorize(['admin', 'revenue_manager', 'manager']), rateManagementController.getRateOverrides);

/**
 * @swagger
 * /api/v1/rates/override/{id}:
 *   delete:
 *     summary: Remove rate override
 *     tags: [Rate Management]
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
 *         description: Rate override removed successfully
 */
router.delete('/override/:id', authenticate, authorize(['admin', 'revenue_manager']), rateManagementController.deleteRateOverride);

// Dynamic Pricing
/**
 * @swagger
 * /api/v1/rates/dynamic-pricing:
 *   post:
 *     summary: Create dynamic pricing rule
 *     tags: [Rate Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Dynamic pricing rule created successfully
 */
router.post('/dynamic-pricing', authenticate, authorize(['admin', 'revenue_manager']), rateManagementController.createDynamicPricingRule);

/**
 * @swagger
 * /api/v1/rates/dynamic-pricing:
 *   get:
 *     summary: Get dynamic pricing rules
 *     tags: [Rate Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [occupancy_based, demand_based, event_based, competitor_based]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of dynamic pricing rules
 */
router.get('/dynamic-pricing', authenticate, authorize(['admin', 'revenue_manager', 'manager']), rateManagementController.getDynamicPricingRules);

// Yield Management
/**
 * @swagger
 * /api/v1/rates/yield/update:
 *   post:
 *     summary: Update yield management metrics
 *     tags: [Rate Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - roomType
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               roomType:
 *                 type: string
 *                 enum: [single, double, suite, deluxe]
 *     responses:
 *       200:
 *         description: Yield metrics updated successfully
 */
router.post('/yield/update', authenticate, authorize(['admin', 'revenue_manager']), rateManagementController.updateYieldMetrics);

/**
 * @swagger
 * /api/v1/rates/yield:
 *   get:
 *     summary: Get yield management data
 *     tags: [Rate Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: roomType
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *     responses:
 *       200:
 *         description: Yield management data
 */
router.get('/yield', authenticate, authorize(['admin', 'revenue_manager', 'manager']), rateManagementController.getYieldData);

/**
 * @swagger
 * /api/v1/rates/forecast:
 *   get:
 *     summary: Get revenue forecast
 *     tags: [Rate Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: roomType
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *     responses:
 *       200:
 *         description: Revenue forecast data
 */
router.get('/forecast', authenticate, authorize(['admin', 'revenue_manager', 'manager']), rateManagementController.getRevenueForecast);

// Packages
/**
 * @swagger
 * /api/v1/rates/packages:
 *   post:
 *     summary: Create package
 *     tags: [Rate Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Package created successfully
 */
router.post('/packages', authenticate, authorize(['admin', 'revenue_manager']), rateManagementController.createPackage);

/**
 * @swagger
 * /api/v1/rates/packages:
 *   get:
 *     summary: Get packages
 *     tags: [Rate Management]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [romantic, family, business, leisure, wellness, adventure]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of packages
 */
router.get('/packages', rateManagementController.getPackages);

/**
 * @swagger
 * /api/v1/rates/packages/{id}:
 *   put:
 *     summary: Update package
 *     tags: [Rate Management]
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
 *         description: Package updated successfully
 */
router.put('/packages/:id', authenticate, authorize(['admin', 'revenue_manager']), rateManagementController.updatePackage);

// Utility endpoints
/**
 * @swagger
 * /api/v1/rates/comparison:
 *   post:
 *     summary: Get rate comparison across different dates
 *     tags: [Rate Management]
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
 *               - dates
 *             properties:
 *               roomType:
 *                 type: string
 *                 enum: [single, double, suite, deluxe]
 *               dates:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: date
 *     responses:
 *       200:
 *         description: Rate comparison data
 */
router.post('/comparison', authenticate, authorize(['admin', 'revenue_manager', 'manager']), rateManagementController.getRateComparison);

/**
 * @swagger
 * /api/v1/rates/bulk-update:
 *   post:
 *     summary: Bulk update rates
 *     tags: [Rate Management]
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
 *                     date:
 *                       type: string
 *                       format: date
 *                     roomType:
 *                       type: string
 *                       enum: [single, double, suite, deluxe]
 *                     overrideRate:
 *                       type: number
 *                       minimum: 0
 *                     reason:
 *                       type: string
 *     responses:
 *       200:
 *         description: Bulk rate update results
 */
router.post('/bulk-update', authenticate, authorize(['admin', 'revenue_manager']), rateManagementController.bulkUpdateRates);

export default router;