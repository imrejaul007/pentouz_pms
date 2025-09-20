import express from 'express';
import posAttributeController from '../controllers/posAttributeController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const createAttributeSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  displayName: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  attributeType: Joi.string().valid(
    'SIZE', 'COLOR', 'FLAVOR', 'TEMPERATURE', 'PREPARATION', 'MATERIAL', 'STYLE', 'BRAND', 'CUSTOM'
  ).required(),
  attributeGroup: Joi.string().valid(
    'PHYSICAL', 'FUNCTIONAL', 'BRANDING', 'CUSTOM'
  ).required(),
  dataType: Joi.string().valid(
    'TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'DATE', 'COLOR_PICKER'
  ).required(),
  inputConfig: Joi.object({
    placeholder: Joi.string().optional(),
    helpText: Joi.string().optional(),
    isRequired: Joi.boolean().optional(),
    isMultiple: Joi.boolean().optional(),
    maxSelections: Joi.number().min(1).optional(),
    allowCustomValues: Joi.boolean().optional(),
    sortOrder: Joi.string().valid('ALPHABETICAL', 'CUSTOM', 'PRICE', 'POPULARITY').optional()
  }).optional(),
  validation: Joi.object({
    minLength: Joi.number().min(0).optional(),
    maxLength: Joi.number().min(0).optional(),
    pattern: Joi.string().optional(),
    minValue: Joi.number().optional(),
    maxValue: Joi.number().optional(),
    allowedValues: Joi.array().items(Joi.string()).optional(),
    customValidation: Joi.string().optional()
  }).optional(),
  displayConfig: Joi.object({
    showInMenu: Joi.boolean().optional(),
    showInCart: Joi.boolean().optional(),
    showInReceipt: Joi.boolean().optional(),
    displayOrder: Joi.number().optional(),
    icon: Joi.string().optional(),
    color: Joi.string().optional(),
    cssClass: Joi.string().optional()
  }).optional(),
  category: Joi.string().valid(
    'COMMON', 'STANDARD', 'SPECIALIZED', 'LEGACY'
  ).optional(),
  sortOrder: Joi.number().min(0).optional(),
  posIntegration: Joi.object({
    applicableCategories: Joi.array().items(
      Joi.string().valid('FOOD', 'BEVERAGE', 'SERVICE', 'PRODUCT', 'ALCOHOL', 'TOBACCO', 'LUXURY', 'GENERAL')
    ).optional(),
    applicableOutlets: Joi.array().items(Joi.string()).optional(),
    inventoryTracking: Joi.boolean().optional(),
    affectsPricing: Joi.boolean().optional(),
    affectsAvailability: Joi.boolean().optional()
  }).optional(),
  values: Joi.array().items(Joi.object({
    valueId: Joi.string().optional(),
    name: Joi.string().required(),
    displayName: Joi.string().required(),
    description: Joi.string().optional(),
    priceModifier: Joi.number().optional(),
    priceModifierType: Joi.string().valid('FIXED', 'PERCENTAGE').optional(),
    isDefault: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
    sortOrder: Joi.number().optional(),
    metadata: Joi.object({
      color: Joi.string().optional(),
      icon: Joi.string().optional(),
      image: Joi.string().optional(),
      cssClass: Joi.string().optional()
    }).optional()
  })).optional()
});

const updateAttributeSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  displayName: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).optional(),
  attributeType: Joi.string().valid(
    'SIZE', 'COLOR', 'FLAVOR', 'TEMPERATURE', 'PREPARATION', 'MATERIAL', 'STYLE', 'BRAND', 'CUSTOM'
  ).optional(),
  attributeGroup: Joi.string().valid(
    'PHYSICAL', 'FUNCTIONAL', 'BRANDING', 'CUSTOM'
  ).optional(),
  dataType: Joi.string().valid(
    'TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'DATE', 'COLOR_PICKER'
  ).optional(),
  inputConfig: Joi.object({
    placeholder: Joi.string().optional(),
    helpText: Joi.string().optional(),
    isRequired: Joi.boolean().optional(),
    isMultiple: Joi.boolean().optional(),
    maxSelections: Joi.number().min(1).optional(),
    allowCustomValues: Joi.boolean().optional(),
    sortOrder: Joi.string().valid('ALPHABETICAL', 'CUSTOM', 'PRICE', 'POPULARITY').optional()
  }).optional(),
  validation: Joi.object({
    minLength: Joi.number().min(0).optional(),
    maxLength: Joi.number().min(0).optional(),
    pattern: Joi.string().optional(),
    minValue: Joi.number().optional(),
    maxValue: Joi.number().optional(),
    allowedValues: Joi.array().items(Joi.string()).optional(),
    customValidation: Joi.string().optional()
  }).optional(),
  displayConfig: Joi.object({
    showInMenu: Joi.boolean().optional(),
    showInCart: Joi.boolean().optional(),
    showInReceipt: Joi.boolean().optional(),
    displayOrder: Joi.number().optional(),
    icon: Joi.string().optional(),
    color: Joi.string().optional(),
    cssClass: Joi.string().optional()
  }).optional(),
  category: Joi.string().valid(
    'COMMON', 'STANDARD', 'SPECIALIZED', 'LEGACY'
  ).optional(),
  sortOrder: Joi.number().min(0).optional(),
  posIntegration: Joi.object({
    applicableCategories: Joi.array().items(
      Joi.string().valid('FOOD', 'BEVERAGE', 'SERVICE', 'PRODUCT', 'ALCOHOL', 'TOBACCO', 'LUXURY', 'GENERAL')
    ).optional(),
    applicableOutlets: Joi.array().items(Joi.string()).optional(),
    inventoryTracking: Joi.boolean().optional(),
    affectsPricing: Joi.boolean().optional(),
    affectsAvailability: Joi.boolean().optional()
  }).optional(),
  isActive: Joi.boolean().optional()
});

const addAttributeValueSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  displayName: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  priceModifier: Joi.number().optional(),
  priceModifierType: Joi.string().valid('FIXED', 'PERCENTAGE').optional(),
  isDefault: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
  sortOrder: Joi.number().optional(),
  metadata: Joi.object({
    color: Joi.string().optional(),
    icon: Joi.string().optional(),
    image: Joi.string().optional(),
    cssClass: Joi.string().optional()
  }).optional()
});

const generateVariantsSchema = Joi.object({
  forceRegenerate: Joi.boolean().optional(),
  includeInactive: Joi.boolean().optional(),
  maxVariants: Joi.number().min(1).max(10000).optional()
});

const findVariantSchema = Joi.object({
  attributes: Joi.array().items(Joi.object({
    attributeId: Joi.string().required(),
    attributeValueId: Joi.string().required()
  })).min(1).required()
});

const updateVariantPricingSchema = Joi.object({
  basePrice: Joi.number().min(0).optional(),
  outletSpecificPricing: Joi.array().items(Joi.object({
    outletId: Joi.string().optional(),
    basePrice: Joi.number().min(0).required(),
    priceModifiers: Joi.array().items(Joi.object({
      attributeId: Joi.string().required(),
      modifier: Joi.number().required(),
      modifierType: Joi.string().valid('FIXED', 'PERCENTAGE').required()
    })).optional(),
    finalPrice: Joi.number().min(0).required(),
    validFrom: Joi.date().optional(),
    validTo: Joi.date().min(Joi.ref('validFrom')).optional()
  })).optional(),
  priceCalculationMethod: Joi.string().valid('ADDITIVE', 'MULTIPLICATIVE', 'CUSTOM').optional()
});

const updateVariantAvailabilitySchema = Joi.object({
  isGloballyAvailable: Joi.boolean().optional(),
  outletAvailability: Joi.array().items(Joi.object({
    outletId: Joi.string().required(),
    isAvailable: Joi.boolean().required(),
    availableFrom: Joi.date().optional(),
    availableTo: Joi.date().min(Joi.ref('availableFrom')).optional()
  })).optional(),
  timeBasedAvailability: Joi.object({
    enabled: Joi.boolean().optional(),
    timeSlots: Joi.array().items(Joi.object({
      dayOfWeek: Joi.number().min(0).max(6).required(),
      startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
      endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
      isAvailable: Joi.boolean().optional()
    })).optional()
  }).optional()
});

// Authentication required for all routes
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     POSAttribute:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         attributeId:
 *           type: string
 *         name:
 *           type: string
 *         displayName:
 *           type: string
 *         description:
 *           type: string
 *         attributeType:
 *           type: string
 *           enum: [SIZE, COLOR, FLAVOR, TEMPERATURE, PREPARATION, MATERIAL, STYLE, BRAND, CUSTOM]
 *         attributeGroup:
 *           type: string
 *           enum: [PHYSICAL, FUNCTIONAL, BRANDING, CUSTOM]
 *         dataType:
 *           type: string
 *           enum: [TEXT, NUMBER, SELECT, MULTI_SELECT, BOOLEAN, DATE, COLOR_PICKER]
 *         isActive:
 *           type: boolean
 *         formattedDisplay:
 *           type: string
 *         activeValuesCount:
 *           type: number
 */

// Attribute CRUD operations
/**
 * @swagger
 * /pos/attributes:
 *   post:
 *     summary: Create a new POS attribute
 *     description: Create a new POS attribute for the hotel
 *     tags: [POS Attributes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/POSAttribute'
 *     responses:
 *       201:
 *         description: Attribute created successfully
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Attribute with this name already exists
 */
router.post('/', 
  authorize(['admin', 'manager']), 
  validate(createAttributeSchema), 
  posAttributeController.createAttribute
);

/**
 * @swagger
 * /pos/attributes:
 *   get:
 *     summary: Get all POS attributes
 *     description: Retrieve all POS attributes for the hotel with optional filtering
 *     tags: [POS Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: attributeType
 *         schema:
 *           type: string
 *           enum: [SIZE, COLOR, FLAVOR, TEMPERATURE, PREPARATION, MATERIAL, STYLE, BRAND, CUSTOM]
 *       - in: query
 *         name: attributeGroup
 *         schema:
 *           type: string
 *           enum: [PHYSICAL, FUNCTIONAL, BRANDING, CUSTOM]
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
 *         name: dataType
 *         schema:
 *           type: string
 *           enum: [TEXT, NUMBER, SELECT, MULTI_SELECT, BOOLEAN, DATE, COLOR_PICKER]
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
 *         description: Attributes retrieved successfully
 */
router.get('/', posAttributeController.getAttributes);

/**
 * @swagger
 * /pos/attributes/{id}:
 *   get:
 *     summary: Get a specific POS attribute
 *     description: Retrieve a specific POS attribute by ID
 *     tags: [POS Attributes]
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
 *         description: Attribute retrieved successfully
 *       404:
 *         description: Attribute not found
 */
router.get('/:id', posAttributeController.getAttribute);

/**
 * @swagger
 * /pos/attributes/{id}:
 *   put:
 *     summary: Update a POS attribute
 *     description: Update an existing POS attribute
 *     tags: [POS Attributes]
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
 *             $ref: '#/components/schemas/POSAttribute'
 *     responses:
 *       200:
 *         description: Attribute updated successfully
 *       404:
 *         description: Attribute not found
 *       409:
 *         description: Attribute with this name already exists
 */
router.put('/:id', 
  authorize(['admin', 'manager']), 
  validate(updateAttributeSchema), 
  posAttributeController.updateAttribute
);

/**
 * @swagger
 * /pos/attributes/{id}:
 *   delete:
 *     summary: Delete a POS attribute
 *     description: Delete or deactivate a POS attribute (deactivated if used)
 *     tags: [POS Attributes]
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
 *         description: Attribute deleted/deactivated successfully
 *       404:
 *         description: Attribute not found
 */
router.delete('/:id', 
  authorize(['admin', 'manager']), 
  posAttributeController.deleteAttribute
);

// Attribute management endpoints
/**
 * @swagger
 * /pos/attributes/types/{attributeType}:
 *   get:
 *     summary: Get attributes by type
 *     description: Get all attributes of a specific type
 *     tags: [POS Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attributeType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [SIZE, COLOR, FLAVOR, TEMPERATURE, PREPARATION, MATERIAL, STYLE, BRAND, CUSTOM]
 *       - in: query
 *         name: includeSystemAttributes
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Attributes retrieved successfully
 */
router.get('/types/:attributeType', posAttributeController.getAttributesByType);

/**
 * @swagger
 * /pos/attributes/groups/{attributeGroup}:
 *   get:
 *     summary: Get attributes by group
 *     description: Get all attributes of a specific group
 *     tags: [POS Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attributeGroup
 *         required: true
 *         schema:
 *           type: string
 *           enum: [PHYSICAL, FUNCTIONAL, BRANDING, CUSTOM]
 *     responses:
 *       200:
 *         description: Attributes retrieved successfully
 */
router.get('/groups/:attributeGroup', posAttributeController.getAttributesByGroup);

/**
 * @swagger
 * /pos/attributes/categories/{category}:
 *   get:
 *     summary: Get attributes for category
 *     description: Get all attributes applicable to a specific POS category
 *     tags: [POS Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [FOOD, BEVERAGE, SERVICE, PRODUCT, ALCOHOL, TOBACCO, LUXURY, GENERAL]
 *     responses:
 *       200:
 *         description: Attributes retrieved successfully
 */
router.get('/categories/:category', posAttributeController.getAttributesForCategory);

// Attribute value management
/**
 * @swagger
 * /pos/attributes/{attributeId}/values:
 *   post:
 *     summary: Add attribute value
 *     description: Add a new value to a POS attribute
 *     tags: [POS Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attributeId
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
 *               - name
 *               - displayName
 *               - value
 *             properties:
 *               name:
 *                 type: string
 *               displayName:
 *                 type: string
 *               description:
 *                 type: string
 *               priceModifier:
 *                 type: number
 *               priceModifierType:
 *                 type: string
 *                 enum: [FIXED, PERCENTAGE]
 *               isDefault:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *               sortOrder:
 *                 type: number
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Attribute value added successfully
 *       404:
 *         description: Attribute not found
 */
router.post('/:attributeId/values', 
  authorize(['admin', 'manager']), 
  validate(addAttributeValueSchema), 
  posAttributeController.addAttributeValue
);

/**
 * @swagger
 * /pos/attributes/{attributeId}/values/{valueId}:
 *   put:
 *     summary: Update attribute value
 *     description: Update an existing attribute value
 *     tags: [POS Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attributeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: valueId
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
 *               displayName:
 *                 type: string
 *               description:
 *                 type: string
 *               priceModifier:
 *                 type: number
 *               priceModifierType:
 *                 type: string
 *                 enum: [FIXED, PERCENTAGE]
 *               isDefault:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *               sortOrder:
 *                 type: number
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Attribute value updated successfully
 *       404:
 *         description: Attribute or value not found
 */
router.put('/:attributeId/values/:valueId', 
  authorize(['admin', 'manager']), 
  posAttributeController.updateAttributeValue
);

/**
 * @swagger
 * /pos/attributes/{attributeId}/values/{valueId}:
 *   delete:
 *     summary: Remove attribute value
 *     description: Remove an attribute value from a POS attribute
 *     tags: [POS Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attributeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: valueId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attribute value removed successfully
 *       404:
 *         description: Attribute or value not found
 */
router.delete('/:attributeId/values/:valueId', 
  authorize(['admin', 'manager']), 
  posAttributeController.removeAttributeValue
);

// Variant management endpoints
/**
 * @swagger
 * /pos/attributes/menu-items/{menuItemId}/variants:
 *   post:
 *     summary: Generate variants for menu item
 *     description: Generate all possible variants for a menu item based on its attributes
 *     tags: [POS Variants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: menuItemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               forceRegenerate:
 *                 type: boolean
 *               includeInactive:
 *                 type: boolean
 *               maxVariants:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 10000
 *     responses:
 *       200:
 *         description: Variants generated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Menu item not found
 */
router.post('/menu-items/:menuItemId/variants', 
  authorize(['admin', 'manager']), 
  validate(generateVariantsSchema), 
  posAttributeController.generateVariants
);

/**
 * @swagger
 * /pos/attributes/menu-items/{menuItemId}/variants:
 *   get:
 *     summary: Get variants for menu item
 *     description: Get all variants for a specific menu item
 *     tags: [POS Variants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: menuItemId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: outletId
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [popularity, price, name, default]
 *           default: popularity
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Variants retrieved successfully
 *       404:
 *         description: Menu item not found
 */
router.get('/menu-items/:menuItemId/variants', posAttributeController.getVariantsForMenuItem);

/**
 * @swagger
 * /pos/attributes/menu-items/{menuItemId}/variants/find:
 *   post:
 *     summary: Find variant by attributes
 *     description: Find a specific variant based on attribute combination
 *     tags: [POS Variants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: menuItemId
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
 *               - attributes
 *             properties:
 *               attributes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     attributeId:
 *                       type: string
 *                     attributeValueId:
 *                       type: string
 *     responses:
 *       200:
 *         description: Variant found successfully
 *       404:
 *         description: Variant not found
 */
router.post('/menu-items/:menuItemId/variants/find', 
  validate(findVariantSchema), 
  posAttributeController.findVariantByAttributes
);

/**
 * @swagger
 * /pos/attributes/variants/{variantId}/pricing:
 *   put:
 *     summary: Update variant pricing
 *     description: Update pricing configuration for a variant
 *     tags: [POS Variants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: variantId
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
 *               basePrice:
 *                 type: number
 *                 minimum: 0
 *               outletSpecificPricing:
 *                 type: array
 *                 items:
 *                   type: object
 *               priceCalculationMethod:
 *                 type: string
 *                 enum: [ADDITIVE, MULTIPLICATIVE, CUSTOM]
 *     responses:
 *       200:
 *         description: Variant pricing updated successfully
 *       404:
 *         description: Variant not found
 */
router.put('/variants/:variantId/pricing', 
  authorize(['admin', 'manager']), 
  validate(updateVariantPricingSchema), 
  posAttributeController.updateVariantPricing
);

/**
 * @swagger
 * /pos/attributes/variants/{variantId}/availability:
 *   put:
 *     summary: Update variant availability
 *     description: Update availability configuration for a variant
 *     tags: [POS Variants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: variantId
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
 *               isGloballyAvailable:
 *                 type: boolean
 *               outletAvailability:
 *                 type: array
 *                 items:
 *                   type: object
 *               timeBasedAvailability:
 *                 type: object
 *     responses:
 *       200:
 *         description: Variant availability updated successfully
 *       404:
 *         description: Variant not found
 */
router.put('/variants/:variantId/availability', 
  authorize(['admin', 'manager']), 
  validate(updateVariantAvailabilitySchema), 
  posAttributeController.updateVariantAvailability
);

// Analytics and reporting
/**
 * @swagger
 * /pos/attributes/analytics:
 *   get:
 *     summary: Get attribute analytics
 *     description: Generate analytics report for POS attributes
 *     tags: [POS Analytics]
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
 *         name: attributeType
 *         schema:
 *           type: string
 *       - in: query
 *         name: attributeGroup
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attribute analytics generated successfully
 */
router.get('/analytics', 
  authorize(['admin', 'manager']), 
  posAttributeController.getAttributeAnalytics
);

/**
 * @swagger
 * /pos/attributes/variants/analytics:
 *   get:
 *     summary: Get variant analytics
 *     description: Generate analytics report for POS variants
 *     tags: [POS Analytics]
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
 *     responses:
 *       200:
 *         description: Variant analytics generated successfully
 */
router.get('/variants/analytics', 
  authorize(['admin', 'manager']), 
  posAttributeController.getVariantAnalytics
);

// Cache management
/**
 * @swagger
 * /pos/attributes/cache/clear:
 *   post:
 *     summary: Clear variant cache
 *     description: Clear the variant generation cache
 *     tags: [POS Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Variant cache cleared successfully
 */
router.post('/cache/clear', 
  authorize(['admin', 'manager']), 
  posAttributeController.clearVariantCache
);

/**
 * @swagger
 * /pos/attributes/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     description: Get statistics about the variant generation cache
 *     tags: [POS Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache statistics retrieved successfully
 */
router.get('/cache/stats', posAttributeController.getCacheStats);

export default router;
