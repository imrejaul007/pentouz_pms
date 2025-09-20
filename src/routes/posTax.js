import express from 'express';
import posTaxController from '../controllers/posTaxController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const createTaxSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  displayName: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  taxType: Joi.string().valid(
    'VAT', 'GST', 'SERVICE_TAX', 'LOCAL_TAX', 'LUXURY_TAX', 'ENTERTAINMENT_TAX', 'CUSTOM'
  ).required(),
  taxGroup: Joi.string().valid(
    'FOOD', 'BEVERAGE', 'SERVICE', 'PRODUCT', 'ALCOHOL', 'TOBACCO', 'LUXURY', 'GENERAL'
  ).required(),
  rules: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().valid('percentage', 'fixed_amount', 'compound').required(),
      value: Joi.number().min(0).required(),
      appliesToTaxes: Joi.array().items(Joi.string()).optional(),
      minThreshold: Joi.number().min(0).optional(),
      maxThreshold: Joi.number().min(0).optional(),
      rounding: Joi.string().valid('round', 'floor', 'ceil', 'none').optional(),
      decimalPlaces: Joi.number().min(0).max(4).optional()
    })
  ).min(1).required(),
  exemptions: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      description: Joi.string().optional(),
      conditions: Joi.object({
        customerTypes: Joi.array().items(
          Joi.string().valid('individual', 'corporate', 'government', 'diplomatic', 'senior_citizen', 'student')
        ).optional(),
        productCategories: Joi.array().items(Joi.string()).optional(),
        validFrom: Joi.date().optional(),
        validTo: Joi.date().optional(),
        minAmount: Joi.number().min(0).optional(),
        maxAmount: Joi.number().min(0).optional(),
        applicableOutlets: Joi.array().items(Joi.string()).optional()
      }).optional(),
      exemptionPercentage: Joi.number().min(0).max(100).optional(),
      requiresDocumentation: Joi.boolean().optional(),
      requiresApproval: Joi.boolean().optional()
    })
  ).optional(),
  validFrom: Joi.date().optional(),
  validTo: Joi.date().optional(),
  reportingCode: Joi.string().max(20).optional(),
  glAccountCode: Joi.string().max(20).optional(),
  isInclusive: Joi.boolean().optional(),
  displayFormat: Joi.object({
    showOnReceipt: Joi.boolean().optional(),
    showInBreakdown: Joi.boolean().optional(),
    receiptLabel: Joi.string().optional(),
    breakdownLabel: Joi.string().optional()
  }).optional()
});

const updateTaxSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  displayName: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).optional(),
  taxType: Joi.string().valid(
    'VAT', 'GST', 'SERVICE_TAX', 'LOCAL_TAX', 'LUXURY_TAX', 'ENTERTAINMENT_TAX', 'CUSTOM'
  ).optional(),
  taxGroup: Joi.string().valid(
    'FOOD', 'BEVERAGE', 'SERVICE', 'PRODUCT', 'ALCOHOL', 'TOBACCO', 'LUXURY', 'GENERAL'
  ).optional(),
  rules: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().valid('percentage', 'fixed_amount', 'compound').required(),
      value: Joi.number().min(0).required(),
      appliesToTaxes: Joi.array().items(Joi.string()).optional(),
      minThreshold: Joi.number().min(0).optional(),
      maxThreshold: Joi.number().min(0).optional(),
      rounding: Joi.string().valid('round', 'floor', 'ceil', 'none').optional(),
      decimalPlaces: Joi.number().min(0).max(4).optional()
    })
  ).optional(),
  exemptions: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      description: Joi.string().optional(),
      conditions: Joi.object({
        customerTypes: Joi.array().items(
          Joi.string().valid('individual', 'corporate', 'government', 'diplomatic', 'senior_citizen', 'student')
        ).optional(),
        productCategories: Joi.array().items(Joi.string()).optional(),
        validFrom: Joi.date().optional(),
        validTo: Joi.date().optional(),
        minAmount: Joi.number().min(0).optional(),
        maxAmount: Joi.number().min(0).optional(),
        applicableOutlets: Joi.array().items(Joi.string()).optional()
      }).optional(),
      exemptionPercentage: Joi.number().min(0).max(100).optional(),
      requiresDocumentation: Joi.boolean().optional(),
      requiresApproval: Joi.boolean().optional()
    })
  ).optional(),
  validFrom: Joi.date().optional(),
  validTo: Joi.date().optional(),
  reportingCode: Joi.string().max(20).optional(),
  glAccountCode: Joi.string().max(20).optional(),
  isInclusive: Joi.boolean().optional(),
  displayFormat: Joi.object({
    showOnReceipt: Joi.boolean().optional(),
    showInBreakdown: Joi.boolean().optional(),
    receiptLabel: Joi.string().optional(),
    breakdownLabel: Joi.string().optional()
  }).optional(),
  isActive: Joi.boolean().optional()
});

const calculateTaxSchema = Joi.object({
  amount: Joi.number().min(0).required(),
  taxGroup: Joi.string().valid(
    'FOOD', 'BEVERAGE', 'SERVICE', 'PRODUCT', 'ALCOHOL', 'TOBACCO', 'LUXURY', 'GENERAL'
  ).optional(),
  customerType: Joi.string().valid(
    'individual', 'corporate', 'government', 'diplomatic', 'senior_citizen', 'student'
  ).optional(),
  outletId: Joi.string().optional(),
  applyExemptions: Joi.boolean().optional()
});

const calculateOrderTaxesSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      price: Joi.number().min(0).required(),
      quantity: Joi.number().min(1).required(),
      taxGroup: Joi.string().valid(
        'FOOD', 'BEVERAGE', 'SERVICE', 'PRODUCT', 'ALCOHOL', 'TOBACCO', 'LUXURY', 'GENERAL'
      ).optional(),
      modifiers: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          price: Joi.number().min(0).required()
        })
      ).optional()
    })
  ).min(1).required(),
  subtotal: Joi.number().min(0).required(),
  customerType: Joi.string().valid(
    'individual', 'corporate', 'government', 'diplomatic', 'senior_citizen', 'student'
  ).optional(),
  outletId: Joi.string().optional(),
  applyExemptions: Joi.boolean().optional(),
  includeBreakdown: Joi.boolean().optional()
});

const exemptionSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  conditions: Joi.object({
    customerTypes: Joi.array().items(
      Joi.string().valid('individual', 'corporate', 'government', 'diplomatic', 'senior_citizen', 'student')
    ).optional(),
    productCategories: Joi.array().items(Joi.string()).optional(),
    validFrom: Joi.date().optional(),
    validTo: Joi.date().optional(),
    minAmount: Joi.number().min(0).optional(),
    maxAmount: Joi.number().min(0).optional(),
    applicableOutlets: Joi.array().items(Joi.string()).optional()
  }).optional(),
  exemptionPercentage: Joi.number().min(0).max(100).optional(),
  requiresDocumentation: Joi.boolean().optional(),
  requiresApproval: Joi.boolean().optional()
});

// Authentication required for all routes
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     POSTax:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         taxId:
 *           type: string
 *         name:
 *           type: string
 *         displayName:
 *           type: string
 *         description:
 *           type: string
 *         taxType:
 *           type: string
 *           enum: [VAT, GST, SERVICE_TAX, LOCAL_TAX, LUXURY_TAX, ENTERTAINMENT_TAX, CUSTOM]
 *         taxGroup:
 *           type: string
 *           enum: [FOOD, BEVERAGE, SERVICE, PRODUCT, ALCOHOL, TOBACCO, LUXURY, GENERAL]
 *         rules:
 *           type: array
 *           items:
 *             type: object
 *         exemptions:
 *           type: array
 *           items:
 *             type: object
 *         isActive:
 *           type: boolean
 *         validFrom:
 *           type: string
 *           format: date
 *         validTo:
 *           type: string
 *           format: date
 *         effectiveRate:
 *           type: number
 *         isCurrentlyValid:
 *           type: boolean
 */

// Tax CRUD operations
/**
 * @swagger
 * /pos/taxes:
 *   post:
 *     summary: Create a new tax
 *     description: Create a new tax configuration for the hotel
 *     tags: [POS Taxes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/POSTax'
 *     responses:
 *       201:
 *         description: Tax created successfully
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Tax with this name already exists
 */
router.post('/', 
  authorize(['admin', 'manager']), 
  validate(createTaxSchema), 
  posTaxController.createTax
);

/**
 * @swagger
 * /pos/taxes:
 *   get:
 *     summary: Get all taxes
 *     description: Retrieve all taxes for the hotel with optional filtering
 *     tags: [POS Taxes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: taxType
 *         schema:
 *           type: string
 *           enum: [VAT, GST, SERVICE_TAX, LOCAL_TAX, LUXURY_TAX, ENTERTAINMENT_TAX, CUSTOM]
 *       - in: query
 *         name: taxGroup
 *         schema:
 *           type: string
 *           enum: [FOOD, BEVERAGE, SERVICE, PRODUCT, ALCOHOL, TOBACCO, LUXURY, GENERAL]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: outletId
 *         schema:
 *           type: string
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
 *         description: Taxes retrieved successfully
 */
router.get('/', posTaxController.getTaxes);

/**
 * @swagger
 * /pos/taxes/{id}:
 *   get:
 *     summary: Get a specific tax
 *     description: Retrieve a specific tax by ID
 *     tags: [POS Taxes]
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
 *         description: Tax retrieved successfully
 *       404:
 *         description: Tax not found
 */
router.get('/:id', posTaxController.getTax);

/**
 * @swagger
 * /pos/taxes/{id}:
 *   put:
 *     summary: Update a tax
 *     description: Update an existing tax configuration
 *     tags: [POS Taxes]
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
 *             $ref: '#/components/schemas/POSTax'
 *     responses:
 *       200:
 *         description: Tax updated successfully
 *       404:
 *         description: Tax not found
 *       409:
 *         description: Tax with this name already exists
 */
router.put('/:id', 
  authorize(['admin', 'manager']), 
  validate(updateTaxSchema), 
  posTaxController.updateTax
);

/**
 * @swagger
 * /pos/taxes/{id}:
 *   delete:
 *     summary: Delete a tax
 *     description: Delete or deactivate a tax (deactivated if used in calculations)
 *     tags: [POS Taxes]
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
 *         description: Tax deleted/deactivated successfully
 *       404:
 *         description: Tax not found
 */
router.delete('/:id', 
  authorize(['admin', 'manager']), 
  posTaxController.deleteTax
);

// Tax calculation endpoints
/**
 * @swagger
 * /pos/taxes/calculate:
 *   post:
 *     summary: Calculate tax for an amount
 *     description: Calculate tax for a specific amount with given parameters
 *     tags: [POS Tax Calculations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               taxGroup:
 *                 type: string
 *                 enum: [FOOD, BEVERAGE, SERVICE, PRODUCT, ALCOHOL, TOBACCO, LUXURY, GENERAL]
 *               customerType:
 *                 type: string
 *                 enum: [individual, corporate, government, diplomatic, senior_citizen, student]
 *               outletId:
 *                 type: string
 *               applyExemptions:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Tax calculated successfully
 *       400:
 *         description: Invalid input data
 */
router.post('/calculate', 
  validate(calculateTaxSchema), 
  posTaxController.calculateTax
);

/**
 * @swagger
 * /pos/taxes/calculate/order:
 *   post:
 *     summary: Calculate taxes for an order
 *     description: Calculate taxes for a complete POS order with multiple items
 *     tags: [POS Tax Calculations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - subtotal
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     price:
 *                       type: number
 *                     quantity:
 *                       type: number
 *                     taxGroup:
 *                       type: string
 *               subtotal:
 *                 type: number
 *               customerType:
 *                 type: string
 *               outletId:
 *                 type: string
 *               applyExemptions:
 *                 type: boolean
 *               includeBreakdown:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Order taxes calculated successfully
 *       400:
 *         description: Invalid input data
 */
router.post('/calculate/order', 
  validate(calculateOrderTaxesSchema), 
  posTaxController.calculateOrderTaxes
);

// Tax management endpoints
/**
 * @swagger
 * /pos/taxes/groups:
 *   get:
 *     summary: Get tax groups
 *     description: Get all available tax groups for the hotel
 *     tags: [POS Tax Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tax groups retrieved successfully
 */
router.get('/groups', posTaxController.getTaxGroups);

/**
 * @swagger
 * /pos/taxes/types:
 *   get:
 *     summary: Get tax types
 *     description: Get all available tax types for the hotel
 *     tags: [POS Tax Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tax types retrieved successfully
 */
router.get('/types', posTaxController.getTaxTypes);

/**
 * @swagger
 * /pos/taxes/report:
 *   get:
 *     summary: Get tax report
 *     description: Generate tax calculation and collection report
 *     tags: [POS Tax Reports]
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
 *         name: taxType
 *         schema:
 *           type: string
 *       - in: query
 *         name: taxGroup
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tax report generated successfully
 */
router.get('/report', 
  authorize(['admin', 'manager']), 
  posTaxController.getTaxReport
);

/**
 * @swagger
 * /pos/taxes/validate:
 *   get:
 *     summary: Validate tax configuration
 *     description: Validate the hotel's tax configuration for issues and warnings
 *     tags: [POS Tax Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tax configuration validated successfully
 */
router.get('/validate', 
  authorize(['admin', 'manager']), 
  posTaxController.validateTaxConfiguration
);

/**
 * @swagger
 * /pos/taxes/cache/clear:
 *   post:
 *     summary: Clear tax cache
 *     description: Clear the tax calculation cache
 *     tags: [POS Tax Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tax cache cleared successfully
 */
router.post('/cache/clear', 
  authorize(['admin', 'manager']), 
  posTaxController.clearTaxCache
);

// Tax exemption management
/**
 * @swagger
 * /pos/taxes/{taxId}/exemptions:
 *   get:
 *     summary: Get tax exemptions
 *     description: Get all exemptions for a specific tax
 *     tags: [POS Tax Exemptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taxId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tax exemptions retrieved successfully
 *       404:
 *         description: Tax not found
 */
router.get('/:taxId/exemptions', posTaxController.getTaxExemptions);

/**
 * @swagger
 * /pos/taxes/{taxId}/exemptions:
 *   post:
 *     summary: Add tax exemption
 *     description: Add a new exemption to a specific tax
 *     tags: [POS Tax Exemptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taxId
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               conditions:
 *                 type: object
 *               exemptionPercentage:
 *                 type: number
 *     responses:
 *       201:
 *         description: Tax exemption added successfully
 *       404:
 *         description: Tax not found
 */
router.post('/:taxId/exemptions', 
  authorize(['admin', 'manager']), 
  validate(exemptionSchema), 
  posTaxController.addTaxExemption
);

/**
 * @swagger
 * /pos/taxes/{taxId}/exemptions/{exemptionId}:
 *   put:
 *     summary: Update tax exemption
 *     description: Update an existing tax exemption
 *     tags: [POS Tax Exemptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taxId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: exemptionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Tax exemption updated successfully
 *       404:
 *         description: Tax or exemption not found
 */
router.put('/:taxId/exemptions/:exemptionId', 
  authorize(['admin', 'manager']), 
  validate(exemptionSchema), 
  posTaxController.updateTaxExemption
);

/**
 * @swagger
 * /pos/taxes/{taxId}/exemptions/{exemptionId}:
 *   delete:
 *     summary: Delete tax exemption
 *     description: Delete a tax exemption
 *     tags: [POS Tax Exemptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taxId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: exemptionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tax exemption deleted successfully
 *       404:
 *         description: Tax or exemption not found
 */
router.delete('/:taxId/exemptions/:exemptionId', 
  authorize(['admin', 'manager']), 
  posTaxController.deleteTaxExemption
);

export default router;
