import POSAttribute from '../models/POSAttribute.js';
import POSAttributeValue from '../models/POSAttributeValue.js';
import POSItemVariant from '../models/POSItemVariant.js';
import posVariantService from '../services/posVariantService.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * POS Attribute Controller
 * 
 * Handles POS attribute management operations including:
 * - Attribute CRUD operations
 * - Attribute value management
 * - Variant generation and management
 * - Attribute analytics and reporting
 */

class POSAttributeController {
  /**
   * Create a new POS attribute
   */
  createAttribute = catchAsync(async (req, res, next) => {
    const {
      name,
      displayName,
      description,
      attributeType,
      attributeGroup,
      dataType,
      inputConfig,
      validation,
      displayConfig,
      category,
      sortOrder,
      posIntegration,
      values
    } = req.body;

    // Validate required fields
    if (!name || !displayName || !attributeType || !attributeGroup || !dataType) {
      return next(new ApplicationError('Name, display name, attribute type, attribute group, and data type are required', 400));
    }

    // Check for duplicate attribute name in the same hotel
    const existingAttribute = await POSAttribute.findOne({
      hotelId: req.user.hotelId,
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingAttribute) {
      return next(new ApplicationError('Attribute with this name already exists', 409));
    }

    const attributeData = {
      hotelId: req.user.hotelId,
      name,
      displayName,
      description,
      attributeType,
      attributeGroup,
      dataType,
      inputConfig: inputConfig || {
        isRequired: false,
        isMultiple: false,
        maxSelections: 1,
        allowCustomValues: false,
        sortOrder: 'ALPHABETICAL'
      },
      validation: validation || {},
      displayConfig: displayConfig || {
        showInMenu: true,
        showInCart: true,
        showInReceipt: true,
        displayOrder: 0
      },
      category: category || 'STANDARD',
      sortOrder: sortOrder || 0,
      posIntegration: posIntegration || {
        applicableCategories: [],
        applicableOutlets: [],
        inventoryTracking: false,
        affectsPricing: true,
        affectsAvailability: false
      },
      values: values || [],
      createdBy: req.user._id
    };

    const attribute = await POSAttribute.create(attributeData);

    logger.info('POS attribute created', {
      attributeId: attribute._id,
      attributeName: attribute.name,
      attributeType: attribute.attributeType,
      userId: req.user._id
    });

    res.status(201).json({
      status: 'success',
      data: {
        attribute
      }
    });
  });

  /**
   * Get all POS attributes for a hotel
   */
  getAttributes = catchAsync(async (req, res, next) => {
    const {
      attributeType,
      attributeGroup,
      category,
      isActive,
      dataType,
      page = 1,
      limit = 50,
      sortBy = 'sortOrder',
      sortOrder = 'asc'
    } = req.query;

    const filter = { hotelId: req.user.hotelId };

    if (attributeType) filter.attributeType = attributeType;
    if (attributeGroup) filter.attributeGroup = attributeGroup;
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (dataType) filter.dataType = dataType;

    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const skip = (page - 1) * limit;

    const attributes = await POSAttribute.find(filter)
      .populate('createdBy updatedBy', 'firstName lastName email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await POSAttribute.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: {
        attributes,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  });

  /**
   * Get a specific POS attribute by ID
   */
  getAttribute = catchAsync(async (req, res, next) => {
    const attribute = await POSAttribute.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    })
      .populate('createdBy updatedBy', 'firstName lastName email')
      .populate('values.attributeValueId', 'name displayName value priceModifier');

    if (!attribute) {
      return next(new ApplicationError('POS attribute not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        attribute
      }
    });
  });

  /**
   * Update a POS attribute
   */
  updateAttribute = catchAsync(async (req, res, next) => {
    const attribute = await POSAttribute.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    });

    if (!attribute) {
      return next(new ApplicationError('POS attribute not found', 404));
    }

    // Check for duplicate name if name is being updated
    if (req.body.name && req.body.name !== attribute.name) {
      const existingAttribute = await POSAttribute.findOne({
        hotelId: req.user.hotelId,
        name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (existingAttribute) {
        return next(new ApplicationError('Attribute with this name already exists', 409));
      }
    }

    const updatedAttribute = await POSAttribute.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user._id
      },
      { new: true, runValidators: true }
    )
      .populate('createdBy updatedBy', 'firstName lastName email');

    logger.info('POS attribute updated', {
      attributeId: updatedAttribute._id,
      attributeName: updatedAttribute.name,
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        attribute: updatedAttribute
      }
    });
  });

  /**
   * Delete a POS attribute
   */
  deleteAttribute = catchAsync(async (req, res, next) => {
    const attribute = await POSAttribute.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    });

    if (!attribute) {
      return next(new ApplicationError('POS attribute not found', 404));
    }

    // Check if attribute is being used
    const isUsed = attribute.usageCount > 0;
    
    if (isUsed || attribute.isSystemAttribute) {
      // Soft delete - deactivate instead of removing
      attribute.isActive = false;
      attribute.updatedBy = req.user._id;
      await attribute.save();

      logger.info('POS attribute deactivated', {
        attributeId: attribute._id,
        attributeName: attribute.name,
        userId: req.user._id
      });

      res.status(200).json({
        status: 'success',
        message: 'Attribute deactivated successfully (cannot delete attribute with usage history or system attribute)'
      });
    } else {
      // Hard delete if never used and not system attribute
      await POSAttribute.findByIdAndDelete(req.params.id);

      logger.info('POS attribute deleted', {
        attributeId: attribute._id,
        attributeName: attribute.name,
        userId: req.user._id
      });

      res.status(200).json({
        status: 'success',
        message: 'Attribute deleted successfully'
      });
    }
  });

  /**
   * Get attributes by type
   */
  getAttributesByType = catchAsync(async (req, res, next) => {
    const { attributeType } = req.params;
    const { includeSystemAttributes = true } = req.query;

    try {
      const attributes = await POSAttribute.getAttributesByType(
        req.user.hotelId,
        attributeType,
        { includeSystemAttributes: includeSystemAttributes === 'true' }
      );

      res.status(200).json({
        status: 'success',
        data: {
          attributes
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to get attributes by type: ${error.message}`, 400));
    }
  });

  /**
   * Get attributes by group
   */
  getAttributesByGroup = catchAsync(async (req, res, next) => {
    const { attributeGroup } = req.params;

    try {
      const attributes = await POSAttribute.getAttributesByGroup(
        req.user.hotelId,
        attributeGroup
      );

      res.status(200).json({
        status: 'success',
        data: {
          attributes
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to get attributes by group: ${error.message}`, 400));
    }
  });

  /**
   * Get attributes for category
   */
  getAttributesForCategory = catchAsync(async (req, res, next) => {
    const { category } = req.params;

    try {
      const attributes = await POSAttribute.getAttributesForCategory(
        req.user.hotelId,
        category
      );

      res.status(200).json({
        status: 'success',
        data: {
          attributes
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to get attributes for category: ${error.message}`, 400));
    }
  });

  /**
   * Add attribute value
   */
  addAttributeValue = catchAsync(async (req, res, next) => {
    const { attributeId } = req.params;
    const valueData = req.body;

    if (!valueData.name || !valueData.displayName || valueData.value === undefined) {
      return next(new ApplicationError('Name, display name, and value are required', 400));
    }

    const attribute = await POSAttribute.findOne({
      _id: attributeId,
      hotelId: req.user.hotelId
    });

    if (!attribute) {
      return next(new ApplicationError('POS attribute not found', 404));
    }

    try {
      await attribute.addValue(valueData);

      logger.info('Attribute value added', {
        attributeId: attribute._id,
        valueName: valueData.name,
        userId: req.user._id
      });

      res.status(201).json({
        status: 'success',
        message: 'Attribute value added successfully'
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to add attribute value: ${error.message}`, 400));
    }
  });

  /**
   * Update attribute value
   */
  updateAttributeValue = catchAsync(async (req, res, next) => {
    const { attributeId, valueId } = req.params;
    const updateData = req.body;

    const attribute = await POSAttribute.findOne({
      _id: attributeId,
      hotelId: req.user.hotelId
    });

    if (!attribute) {
      return next(new ApplicationError('POS attribute not found', 404));
    }

    try {
      await attribute.updateValue(valueId, updateData);

      logger.info('Attribute value updated', {
        attributeId: attribute._id,
        valueId,
        userId: req.user._id
      });

      res.status(200).json({
        status: 'success',
        message: 'Attribute value updated successfully'
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to update attribute value: ${error.message}`, 400));
    }
  });

  /**
   * Remove attribute value
   */
  removeAttributeValue = catchAsync(async (req, res, next) => {
    const { attributeId, valueId } = req.params;

    const attribute = await POSAttribute.findOne({
      _id: attributeId,
      hotelId: req.user.hotelId
    });

    if (!attribute) {
      return next(new ApplicationError('POS attribute not found', 404));
    }

    try {
      await attribute.removeValue(valueId);

      logger.info('Attribute value removed', {
        attributeId: attribute._id,
        valueId,
        userId: req.user._id
      });

      res.status(200).json({
        status: 'success',
        message: 'Attribute value removed successfully'
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to remove attribute value: ${error.message}`, 400));
    }
  });

  /**
   * Generate variants for menu item
   */
  generateVariants = catchAsync(async (req, res, next) => {
    const { menuItemId } = req.params;
    const options = req.body;

    try {
      const result = await posVariantService.generateVariants(menuItemId, options);

      logger.info('Variants generated', {
        menuItemId,
        variantsGenerated: result.totalGenerated,
        userId: req.user._id
      });

      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      return next(new ApplicationError(`Variant generation failed: ${error.message}`, 400));
    }
  });

  /**
   * Get variants for menu item
   */
  getVariantsForMenuItem = catchAsync(async (req, res, next) => {
    const { menuItemId } = req.params;
    const filters = req.query;

    try {
      const variants = await posVariantService.getVariantsForMenuItem(menuItemId, filters);

      res.status(200).json({
        status: 'success',
        data: {
          variants
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to get variants: ${error.message}`, 400));
    }
  });

  /**
   * Find variant by attributes
   */
  findVariantByAttributes = catchAsync(async (req, res, next) => {
    const { menuItemId } = req.params;
    const { attributes } = req.body;

    if (!attributes || !Array.isArray(attributes)) {
      return next(new ApplicationError('Attributes array is required', 400));
    }

    try {
      const variant = await posVariantService.findVariantByAttributes(menuItemId, attributes);

      res.status(200).json({
        status: 'success',
        data: {
          variant
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to find variant: ${error.message}`, 400));
    }
  });

  /**
   * Update variant pricing
   */
  updateVariantPricing = catchAsync(async (req, res, next) => {
    const { variantId } = req.params;
    const pricingData = req.body;

    try {
      const variant = await posVariantService.updateVariantPricing(variantId, pricingData);

      logger.info('Variant pricing updated', {
        variantId,
        userId: req.user._id
      });

      res.status(200).json({
        status: 'success',
        data: {
          variant
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to update variant pricing: ${error.message}`, 400));
    }
  });

  /**
   * Update variant availability
   */
  updateVariantAvailability = catchAsync(async (req, res, next) => {
    const { variantId } = req.params;
    const availabilityData = req.body;

    try {
      const variant = await posVariantService.updateVariantAvailability(variantId, availabilityData);

      logger.info('Variant availability updated', {
        variantId,
        userId: req.user._id
      });

      res.status(200).json({
        status: 'success',
        data: {
          variant
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to update variant availability: ${error.message}`, 400));
    }
  });

  /**
   * Get attribute analytics
   */
  getAttributeAnalytics = catchAsync(async (req, res, next) => {
    const { startDate, endDate, attributeType, attributeGroup } = req.query;

    try {
      const matchStage = { hotelId: req.user.hotelId };

      if (startDate && endDate) {
        matchStage.lastUsed = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      if (attributeType) matchStage.attributeType = attributeType;
      if (attributeGroup) matchStage.attributeGroup = attributeGroup;

      const analytics = await POSAttribute.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              attributeType: '$attributeType',
              attributeGroup: '$attributeGroup'
            },
            totalAttributes: { $sum: 1 },
            activeAttributes: { $sum: { $cond: ['$isActive', 1, 0] } },
            totalUsage: { $sum: '$usageCount' },
            averageUsage: { $avg: '$usageCount' },
            mostUsedAttribute: {
              $first: {
                $cond: [
                  { $eq: ['$usageCount', { $max: '$usageCount' }] },
                  { name: '$name', displayName: '$displayName', usageCount: '$usageCount' },
                  null
                ]
              }
            }
          }
        },
        {
          $sort: { '_id.attributeType': 1, '_id.attributeGroup': 1 }
        }
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          summary: analytics,
          generatedAt: new Date(),
          dateRange: { startDate, endDate }
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to get attribute analytics: ${error.message}`, 500));
    }
  });

  /**
   * Get variant analytics
   */
  getVariantAnalytics = catchAsync(async (req, res, next) => {
    const { startDate, endDate } = req.query;

    try {
      const analytics = await posVariantService.getVariantAnalytics(
        req.user.hotelId,
        { startDate, endDate }
      );

      res.status(200).json({
        status: 'success',
        data: analytics
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to get variant analytics: ${error.message}`, 500));
    }
  });

  /**
   * Clear variant cache
   */
  clearVariantCache = catchAsync(async (req, res, next) => {
    posVariantService.clearCache();

    logger.info('Variant cache cleared', {
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      message: 'Variant cache cleared successfully'
    });
  });

  /**
   * Get cache statistics
   */
  getCacheStats = catchAsync(async (req, res, next) => {
    const stats = posVariantService.getCacheStats();

    res.status(200).json({
      status: 'success',
      data: {
        cacheStats: stats
      }
    });
  });
}

export default new POSAttributeController();
