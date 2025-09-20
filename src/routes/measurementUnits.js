import express from 'express';
import measurementUnitController from '../controllers/measurementUnitController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const createUnitSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  symbol: Joi.string().min(1).max(10).required(),
  displayName: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  unitType: Joi.string().valid(
    'WEIGHT', 'VOLUME', 'QUANTITY', 'LENGTH', 'AREA', 'TIME', 'TEMPERATURE', 'CUSTOM'
  ).required(),
  unitSystem: Joi.string().valid(
    'METRIC', 'IMPERIAL', 'US_CUSTOMARY', 'CUSTOM'
  ).required(),
  isBaseUnit: Joi.boolean().optional(),
  baseUnit: Joi.string().optional(),
  decimalPlaces: Joi.number().min(0).max(6).optional(),
  precision: Joi.number().min(0.000001).optional(),
  displayFormat: Joi.object({
    showSymbol: Joi.boolean().optional(),
    symbolPosition: Joi.string().valid('before', 'after').optional(),
    thousandsSeparator: Joi.string().optional(),
    decimalSeparator: Joi.string().optional()
  }).optional(),
  category: Joi.string().valid(
    'COMMON', 'STANDARD', 'SPECIALIZED', 'LEGACY'
  ).optional(),
  sortOrder: Joi.number().min(0).optional(),
  minValue: Joi.number().optional(),
  maxValue: Joi.number().optional(),
  allowNegative: Joi.boolean().optional(),
  posIntegration: Joi.object({
    isDefaultForType: Joi.boolean().optional(),
    applicableCategories: Joi.array().items(
      Joi.string().valid('FOOD', 'BEVERAGE', 'SERVICE', 'PRODUCT', 'ALCOHOL', 'TOBACCO', 'LUXURY', 'GENERAL')
    ).optional(),
    inventoryTracking: Joi.boolean().optional()
  }).optional()
});

const updateUnitSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  symbol: Joi.string().min(1).max(10).optional(),
  displayName: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).optional(),
  unitType: Joi.string().valid(
    'WEIGHT', 'VOLUME', 'QUANTITY', 'LENGTH', 'AREA', 'TIME', 'TEMPERATURE', 'CUSTOM'
  ).optional(),
  unitSystem: Joi.string().valid(
    'METRIC', 'IMPERIAL', 'US_CUSTOMARY', 'CUSTOM'
  ).optional(),
  isBaseUnit: Joi.boolean().optional(),
  baseUnit: Joi.string().optional(),
  decimalPlaces: Joi.number().min(0).max(6).optional(),
  precision: Joi.number().min(0.000001).optional(),
  displayFormat: Joi.object({
    showSymbol: Joi.boolean().optional(),
    symbolPosition: Joi.string().valid('before', 'after').optional(),
    thousandsSeparator: Joi.string().optional(),
    decimalSeparator: Joi.string().optional()
  }).optional(),
  category: Joi.string().valid(
    'COMMON', 'STANDARD', 'SPECIALIZED', 'LEGACY'
  ).optional(),
  sortOrder: Joi.number().min(0).optional(),
  minValue: Joi.number().optional(),
  maxValue: Joi.number().optional(),
  allowNegative: Joi.boolean().optional(),
  posIntegration: Joi.object({
    isDefaultForType: Joi.boolean().optional(),
    applicableCategories: Joi.array().items(
      Joi.string().valid('FOOD', 'BEVERAGE', 'SERVICE', 'PRODUCT', 'ALCOHOL', 'TOBACCO', 'LUXURY', 'GENERAL')
    ).optional(),
    inventoryTracking: Joi.boolean().optional()
  }).optional(),
  isActive: Joi.boolean().optional()
});

const convertUnitsSchema = Joi.object({
  fromUnitId: Joi.string().required(),
  toUnitId: Joi.string().required(),
  value: Joi.number().required(),
  precision: Joi.number().min(0).max(10).optional(),
  validateInput: Joi.boolean().optional(),
  useCache: Joi.boolean().optional()
});

const convertBatchSchema = Joi.object({
  conversions: Joi.array().items(
    Joi.object({
      fromUnitId: Joi.string().required(),
      toUnitId: Joi.string().required(),
      value: Joi.number().required(),
      options: Joi.object({
        precision: Joi.number().min(0).max(10).optional(),
        validateInput: Joi.boolean().optional(),
        useCache: Joi.boolean().optional()
      }).optional()
    })
  ).min(1).required(),
  parallel: Joi.boolean().optional(),
  maxConcurrency: Joi.number().min(1).max(50).optional()
});

const addConversionFactorSchema = Joi.object({
  targetUnitId: Joi.string().required(),
  factor: Joi.number().min(0.000001).required(),
  offset: Joi.number().optional()
});

const formatValueSchema = Joi.object({
  value: Joi.number().required()
});

// Authentication required for all routes
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     MeasurementUnit:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         unitId:
 *           type: string
 *         name:
 *           type: string
 *         symbol:
 *           type: string
 *         displayName:
 *           type: string
 *         description:
 *           type: string
 *         unitType:
 *           type: string
 *           enum: [WEIGHT, VOLUME, QUANTITY, LENGTH, AREA, TIME, TEMPERATURE, CUSTOM]
 *         unitSystem:
 *           type: string
 *           enum: [METRIC, IMPERIAL, US_CUSTOMARY, CUSTOM]
 *         isBaseUnit:
 *           type: boolean
 *         isActive:
 *           type: boolean
 *         formattedDisplay:
 *           type: string
 *         usageCount:
 *           type: number
 */

// Unit CRUD operations
/**
 * @swagger
 * /pos/measurement-units:
 *   post:
 *     summary: Create a new measurement unit
 *     description: Create a new measurement unit for the hotel
 *     tags: [POS Measurement Units]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MeasurementUnit'
 *     responses:
 *       201:
 *         description: Unit created successfully
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Unit with this name or symbol already exists
 */
router.post('/', 
  authorize(['admin', 'manager']), 
  validate(createUnitSchema), 
  measurementUnitController.createUnit
);

/**
 * @swagger
 * /pos/measurement-units:
 *   get:
 *     summary: Get all measurement units
 *     description: Retrieve all measurement units for the hotel with optional filtering
 *     tags: [POS Measurement Units]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unitType
 *         schema:
 *           type: string
 *           enum: [WEIGHT, VOLUME, QUANTITY, LENGTH, AREA, TIME, TEMPERATURE, CUSTOM]
 *       - in: query
 *         name: unitSystem
 *         schema:
 *           type: string
 *           enum: [METRIC, IMPERIAL, US_CUSTOMARY, CUSTOM]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [COMMON, STANDARD, SPECIALIZED, LEGACY]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isBaseUnit
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Units retrieved successfully
 */
router.get('/', measurementUnitController.getUnits);

/**
 * @swagger
 * /pos/measurement-units/{id}:
 *   get:
 *     summary: Get a specific measurement unit
 *     description: Retrieve a specific measurement unit by ID
 *     tags: [POS Measurement Units]
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
 *         description: Unit retrieved successfully
 *       404:
 *         description: Unit not found
 */
router.get('/:id', measurementUnitController.getUnit);

/**
 * @swagger
 * /pos/measurement-units/{id}:
 *   put:
 *     summary: Update a measurement unit
 *     description: Update an existing measurement unit
 *     tags: [POS Measurement Units]
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
 *             $ref: '#/components/schemas/MeasurementUnit'
 *     responses:
 *       200:
 *         description: Unit updated successfully
 *       404:
 *         description: Unit not found
 *       409:
 *         description: Unit with this name or symbol already exists
 */
router.put('/:id', 
  authorize(['admin', 'manager']), 
  validate(updateUnitSchema), 
  measurementUnitController.updateUnit
);

/**
 * @swagger
 * /pos/measurement-units/{id}:
 *   delete:
 *     summary: Delete a measurement unit
 *     description: Delete or deactivate a measurement unit (deactivated if used)
 *     tags: [POS Measurement Units]
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
 *         description: Unit deleted/deactivated successfully
 *       404:
 *         description: Unit not found
 */
router.delete('/:id', 
  authorize(['admin', 'manager']), 
  measurementUnitController.deleteUnit
);

// Unit conversion endpoints
/**
 * @swagger
 * /pos/measurement-units/convert:
 *   post:
 *     summary: Convert between units
 *     description: Convert a value from one unit to another
 *     tags: [POS Unit Conversions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromUnitId
 *               - toUnitId
 *               - value
 *             properties:
 *               fromUnitId:
 *                 type: string
 *               toUnitId:
 *                 type: string
 *               value:
 *                 type: number
 *               precision:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 10
 *               validateInput:
 *                 type: boolean
 *               useCache:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Conversion completed successfully
 *       400:
 *         description: Invalid input data or conversion not possible
 */
router.post('/convert', 
  validate(convertUnitsSchema), 
  measurementUnitController.convertUnits
);

/**
 * @swagger
 * /pos/measurement-units/convert/batch:
 *   post:
 *     summary: Convert multiple units in batch
 *     description: Convert multiple values between units in a single request
 *     tags: [POS Unit Conversions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversions
 *             properties:
 *               conversions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     fromUnitId:
 *                       type: string
 *                     toUnitId:
 *                       type: string
 *                     value:
 *                       type: number
 *                     options:
 *                       type: object
 *               parallel:
 *                 type: boolean
 *               maxConcurrency:
 *                 type: number
 *     responses:
 *       200:
 *         description: Batch conversion completed successfully
 *       400:
 *         description: Invalid input data
 */
router.post('/convert/batch', 
  validate(convertBatchSchema), 
  measurementUnitController.convertBatch
);

/**
 * @swagger
 * /pos/measurement-units/{unitId}/conversions:
 *   get:
 *     summary: Get available conversions for a unit
 *     description: Get all units that can be converted from the specified unit
 *     tags: [POS Unit Conversions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Available conversions retrieved successfully
 *       404:
 *         description: Unit not found
 */
router.get('/:unitId/conversions', measurementUnitController.getAvailableConversions);

// Unit management endpoints
/**
 * @swagger
 * /pos/measurement-units/types:
 *   get:
 *     summary: Get unit types
 *     description: Get all available unit types for the hotel
 *     tags: [POS Unit Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unit types retrieved successfully
 */
router.get('/types', measurementUnitController.getUnitTypes);

/**
 * @swagger
 * /pos/measurement-units/systems:
 *   get:
 *     summary: Get unit systems
 *     description: Get all available unit systems for the hotel
 *     tags: [POS Unit Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unit systems retrieved successfully
 */
router.get('/systems', measurementUnitController.getUnitSystems);

/**
 * @swagger
 * /pos/measurement-units/types/{unitType}:
 *   get:
 *     summary: Get units by type
 *     description: Get all units of a specific type
 *     tags: [POS Unit Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unitType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [WEIGHT, VOLUME, QUANTITY, LENGTH, AREA, TIME, TEMPERATURE, CUSTOM]
 *       - in: query
 *         name: includeSystemUnits
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Units retrieved successfully
 */
router.get('/types/:unitType', measurementUnitController.getUnitsByType);

/**
 * @swagger
 * /pos/measurement-units/base:
 *   get:
 *     summary: Get base units
 *     description: Get all base units for the hotel
 *     tags: [POS Unit Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Base units retrieved successfully
 */
router.get('/base', measurementUnitController.getBaseUnits);

// Conversion factor management
/**
 * @swagger
 * /pos/measurement-units/{unitId}/conversion-factors:
 *   post:
 *     summary: Add conversion factor
 *     description: Add a conversion factor to a measurement unit
 *     tags: [POS Unit Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unitId
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
 *               - targetUnitId
 *               - factor
 *             properties:
 *               targetUnitId:
 *                 type: string
 *               factor:
 *                 type: number
 *                 minimum: 0.000001
 *               offset:
 *                 type: number
 *     responses:
 *       201:
 *         description: Conversion factor added successfully
 *       404:
 *         description: Unit not found
 */
router.post('/:unitId/conversion-factors', 
  authorize(['admin', 'manager']), 
  validate(addConversionFactorSchema), 
  measurementUnitController.addConversionFactor
);

// Reporting and validation
/**
 * @swagger
 * /pos/measurement-units/report:
 *   get:
 *     summary: Get conversion report
 *     description: Generate unit conversion and usage report
 *     tags: [POS Unit Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: unitType
 *         schema:
 *           type: string
 *       - in: query
 *         name: unitSystem
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversion report generated successfully
 */
router.get('/report', 
  authorize(['admin', 'manager']), 
  measurementUnitController.getConversionReport
);

/**
 * @swagger
 * /pos/measurement-units/validate:
 *   get:
 *     summary: Validate unit configuration
 *     description: Validate the hotel's unit configuration for issues and warnings
 *     tags: [POS Unit Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unit configuration validated successfully
 */
router.get('/validate', 
  authorize(['admin', 'manager']), 
  measurementUnitController.validateUnitConfiguration
);

// Cache management
/**
 * @swagger
 * /pos/measurement-units/cache/clear:
 *   post:
 *     summary: Clear conversion cache
 *     description: Clear the unit conversion cache
 *     tags: [POS Unit Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversion cache cleared successfully
 */
router.post('/cache/clear', 
  authorize(['admin', 'manager']), 
  measurementUnitController.clearConversionCache
);

/**
 * @swagger
 * /pos/measurement-units/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     description: Get statistics about the unit conversion cache
 *     tags: [POS Unit Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache statistics retrieved successfully
 */
router.get('/cache/stats', measurementUnitController.getCacheStats);

// Value formatting
/**
 * @swagger
 * /pos/measurement-units/{unitId}/format:
 *   post:
 *     summary: Format value for display
 *     description: Format a numeric value according to the unit's display format
 *     tags: [POS Unit Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unitId
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
 *               - value
 *             properties:
 *               value:
 *                 type: number
 *     responses:
 *       200:
 *         description: Value formatted successfully
 *       404:
 *         description: Unit not found
 */
router.post('/:unitId/format', 
  validate(formatValueSchema), 
  measurementUnitController.formatValue
);

export default router;
