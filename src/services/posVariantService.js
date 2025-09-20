import POSAttribute from '../models/POSAttribute.js';
import POSAttributeValue from '../models/POSAttributeValue.js';
import POSItemVariant from '../models/POSItemVariant.js';
import POSMenu from '../models/POSMenu.js';
import logger from '../utils/logger.js';

/**
 * POS Variant Service
 * 
 * Provides variant generation and management for POS operations including:
 * - Automatic variant generation from attribute combinations
 * - Variant pricing calculations
 * - Variant availability management
 * - Variant analytics and reporting
 */

class POSVariantService {
  constructor() {
    this.variantCache = new Map();
    this.cacheExpiry = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Generate all possible variants for a menu item
   * @param {String} menuItemId - Menu item ID
   * @param {Object} options - Generation options
   * @returns {Object} Generation result
   */
  async generateVariants(menuItemId, options = {}) {
    try {
      const {
        forceRegenerate = false,
        includeInactive = false,
        maxVariants = 1000
      } = options;

      const menuItem = await POSMenu.findById(menuItemId);
      if (!menuItem) {
        throw new Error('Menu item not found');
      }

      // Check cache first
      const cacheKey = `variants_${menuItemId}`;
      if (!forceRegenerate && this.variantCache.has(cacheKey)) {
        const cached = this.variantCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          return cached.result;
        }
      }

      // Get all attributes for the menu item
      const attributes = await this.getAttributesForMenuItem(menuItemId);
      
      if (attributes.length === 0) {
        return {
          success: true,
          variants: [],
          message: 'No attributes configured for this menu item'
        };
      }

      // Generate all possible combinations
      const combinations = this.generateAttributeCombinations(attributes);
      
      if (combinations.length > maxVariants) {
        throw new Error(`Too many variants would be generated (${combinations.length}). Maximum allowed: ${maxVariants}`);
      }

      const variants = [];
      const existingVariants = await POSItemVariant.find({ menuItemId });

      for (const combination of combinations) {
        const variant = await this.createVariantFromCombination(
          menuItemId,
          combination,
          existingVariants,
          { includeInactive }
        );
        
        if (variant) {
          variants.push(variant);
        }
      }

      const result = {
        success: true,
        variants,
        totalGenerated: variants.length,
        totalCombinations: combinations.length,
        menuItem: {
          id: menuItem._id,
          name: menuItem.name,
          displayName: menuItem.displayName
        }
      };

      // Cache result
      this.variantCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      logger.info('Variants generated successfully', {
        menuItemId,
        variantsGenerated: variants.length,
        totalCombinations: combinations.length
      });

      return result;

    } catch (error) {
      logger.error('Variant generation error:', error);
      throw new Error(`Variant generation failed: ${error.message}`);
    }
  }

  /**
   * Get attributes for a menu item
   * @param {String} menuItemId - Menu item ID
   * @returns {Array} Array of attributes
   */
  async getAttributesForMenuItem(menuItemId) {
    try {
      const menuItem = await POSMenu.findById(menuItemId);
      if (!menuItem) {
        throw new Error('Menu item not found');
      }

      // Get attributes based on menu item category and applicable attributes
      const attributes = await POSAttribute.find({
        hotelId: menuItem.hotelId,
        isActive: true,
        $or: [
          { 'posIntegration.applicableCategories': { $in: [menuItem.category, 'GENERAL'] } },
          { 'posIntegration.applicableCategories': { $size: 0 } }
        ]
      }).sort({ 'displayConfig.displayOrder': 1, displayName: 1 });

      // Populate attribute values
      const attributesWithValues = await Promise.all(
        attributes.map(async (attribute) => {
          const values = await POSAttributeValue.getValuesByAttribute(
            menuItem.hotelId,
            attribute._id
          );
          return {
            ...attribute.toObject(),
            values: values
          };
        })
      );

      return attributesWithValues.filter(attr => attr.values.length > 0);

    } catch (error) {
      logger.error('Error getting attributes for menu item:', error);
      throw new Error(`Failed to get attributes: ${error.message}`);
    }
  }

  /**
   * Generate all possible combinations of attribute values
   * @param {Array} attributes - Array of attributes with values
   * @returns {Array} Array of combinations
   */
  generateAttributeCombinations(attributes) {
    if (attributes.length === 0) return [];

    const combinations = [];
    
    // Use recursive approach to generate all combinations
    const generateCombinations = (currentCombination, remainingAttributes) => {
      if (remainingAttributes.length === 0) {
        combinations.push([...currentCombination]);
        return;
      }

      const currentAttribute = remainingAttributes[0];
      const remaining = remainingAttributes.slice(1);

      for (const value of currentAttribute.values) {
        if (value.isActive) {
          currentCombination.push({
            attributeId: currentAttribute._id,
            attributeValueId: value._id,
            attributeName: currentAttribute.name,
            attributeValue: value.value,
            displayName: value.displayName,
            priceModifier: value.pricing.basePriceModifier,
            priceModifierType: value.pricing.basePriceModifierType
          });
          
          generateCombinations(currentCombination, remaining);
          currentCombination.pop();
        }
      }
    };

    generateCombinations([], attributes);
    return combinations;
  }

  /**
   * Create variant from attribute combination
   * @param {String} menuItemId - Menu item ID
   * @param {Array} combination - Attribute combination
   * @param {Array} existingVariants - Existing variants
   * @param {Object} options - Creation options
   * @returns {Object} Created variant
   */
  async createVariantFromCombination(menuItemId, combination, existingVariants, options = {}) {
    try {
      const { includeInactive = false } = options;

      // Check if variant already exists
      const existingVariant = existingVariants.find(variant => {
        if (variant.attributes.length !== combination.length) return false;
        
        return combination.every(comboAttr => 
          variant.attributes.some(variantAttr => 
            variantAttr.attributeId.toString() === comboAttr.attributeId.toString() &&
            variantAttr.attributeValueId.toString() === comboAttr.attributeValueId.toString()
          )
        );
      });

      if (existingVariant && !includeInactive) {
        return null; // Skip existing variants
      }

      const menuItem = await POSMenu.findById(menuItemId);
      if (!menuItem) {
        throw new Error('Menu item not found');
      }

      // Calculate variant name
      const attributeNames = combination.map(attr => attr.displayName).join(' ');
      const variantName = `${menuItem.displayName} - ${attributeNames}`.trim();

      // Calculate base price with modifiers
      let basePrice = menuItem.price;
      for (const attr of combination) {
        if (attr.priceModifierType === 'FIXED') {
          basePrice += attr.priceModifier;
        } else if (attr.priceModifierType === 'PERCENTAGE') {
          basePrice += (menuItem.price * attr.priceModifier) / 100;
        }
      }

      const variantData = {
        hotelId: menuItem.hotelId,
        menuItemId: menuItemId,
        name: variantName,
        displayName: variantName,
        description: `Variant of ${menuItem.displayName} with ${attributeNames}`,
        attributes: combination,
        configuration: {
          isDefault: false,
          isActive: true,
          isSystemGenerated: true,
          requiresSpecialHandling: false,
          preparationTime: menuItem.preparationTime || 0,
          complexity: this.calculateComplexity(combination)
        },
        pricing: {
          basePrice: Math.max(0, basePrice),
          outletSpecificPricing: [],
          priceCalculationMethod: 'ADDITIVE',
          allowPriceOverride: false
        },
        inventory: {
          trackInventory: false,
          outletInventory: [],
          allowNegativeStock: false,
          autoReorder: false
        },
        availability: {
          isGloballyAvailable: true,
          outletAvailability: [],
          timeBasedAvailability: {
            enabled: false,
            timeSlots: []
          }
        },
        analytics: {
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          popularityScore: 0,
          lastOrdered: null,
          conversionRate: 0
        },
        display: {
          showInMenu: true,
          showInCart: true,
          showInReceipt: true,
          displayOrder: 0
        },
        metadata: {
          tags: ['auto-generated'],
          notes: 'Automatically generated variant',
          version: 1
        }
      };

      if (existingVariant) {
        // Update existing variant
        Object.assign(existingVariant, variantData);
        existingVariant.updatedAt = new Date();
        return await existingVariant.save();
      } else {
        // Create new variant
        const variant = new POSItemVariant(variantData);
        return await variant.save();
      }

    } catch (error) {
      logger.error('Error creating variant from combination:', error);
      throw new Error(`Failed to create variant: ${error.message}`);
    }
  }

  /**
   * Calculate complexity based on attributes
   * @param {Array} combination - Attribute combination
   * @returns {String} Complexity level
   */
  calculateComplexity(combination) {
    if (combination.length <= 2) return 'SIMPLE';
    if (combination.length <= 4) return 'MODERATE';
    return 'COMPLEX';
  }

  /**
   * Get variants for menu item with filtering
   * @param {String} menuItemId - Menu item ID
   * @param {Object} filters - Filter options
   * @returns {Array} Array of variants
   */
  async getVariantsForMenuItem(menuItemId, filters = {}) {
    try {
      const {
        outletId,
        includeInactive = false,
        sortBy = 'popularity',
        limit = 50
      } = filters;

      const query = { menuItemId };
      
      if (!includeInactive) {
        query['configuration.isActive'] = true;
      }

      if (outletId) {
        query.$or = [
          { 'availability.isGloballyAvailable': true },
          { 'availability.outletAvailability.outletId': outletId }
        ];
      }

      let sortOptions = {};
      switch (sortBy) {
        case 'popularity':
          sortOptions = { 'analytics.popularityScore': -1, 'analytics.totalOrders': -1 };
          break;
        case 'price':
          sortOptions = { 'pricing.basePrice': 1 };
          break;
        case 'name':
          sortOptions = { displayName: 1 };
          break;
        case 'default':
          sortOptions = { 'configuration.isDefault': -1, 'display.displayOrder': 1 };
          break;
        default:
          sortOptions = { 'analytics.popularityScore': -1 };
      }

      const variants = await POSItemVariant.find(query)
        .sort(sortOptions)
        .limit(limit)
        .populate('menuItemId', 'name displayName price')
        .populate('attributes.attributeId', 'name displayName attributeType')
        .populate('attributes.attributeValueId', 'name displayName value');

      return variants;

    } catch (error) {
      logger.error('Error getting variants for menu item:', error);
      throw new Error(`Failed to get variants: ${error.message}`);
    }
  }

  /**
   * Find variant by attribute combination
   * @param {String} menuItemId - Menu item ID
   * @param {Array} attributes - Attribute combination
   * @returns {Object} Found variant
   */
  async findVariantByAttributes(menuItemId, attributes) {
    try {
      const attributeConditions = attributes.map(attr => ({
        'attributes.attributeId': attr.attributeId,
        'attributes.attributeValueId': attr.attributeValueId
      }));

      const variant = await POSItemVariant.findOne({
        menuItemId,
        'configuration.isActive': true,
        $and: attributeConditions
      })
        .populate('menuItemId', 'name displayName price')
        .populate('attributes.attributeId', 'name displayName attributeType')
        .populate('attributes.attributeValueId', 'name displayName value');

      return variant;

    } catch (error) {
      logger.error('Error finding variant by attributes:', error);
      throw new Error(`Failed to find variant: ${error.message}`);
    }
  }

  /**
   * Update variant pricing
   * @param {String} variantId - Variant ID
   * @param {Object} pricingData - Pricing data
   * @returns {Object} Updated variant
   */
  async updateVariantPricing(variantId, pricingData) {
    try {
      const variant = await POSItemVariant.findById(variantId);
      if (!variant) {
        throw new Error('Variant not found');
      }

      const { basePrice, outletSpecificPricing, priceCalculationMethod } = pricingData;

      if (basePrice !== undefined) {
        variant.pricing.basePrice = Math.max(0, basePrice);
      }

      if (outletSpecificPricing) {
        variant.pricing.outletSpecificPricing = outletSpecificPricing;
      }

      if (priceCalculationMethod) {
        variant.pricing.priceCalculationMethod = priceCalculationMethod;
      }

      variant.updatedAt = new Date();
      return await variant.save();

    } catch (error) {
      logger.error('Error updating variant pricing:', error);
      throw new Error(`Failed to update variant pricing: ${error.message}`);
    }
  }

  /**
   * Update variant availability
   * @param {String} variantId - Variant ID
   * @param {Object} availabilityData - Availability data
   * @returns {Object} Updated variant
   */
  async updateVariantAvailability(variantId, availabilityData) {
    try {
      const variant = await POSItemVariant.findById(variantId);
      if (!variant) {
        throw new Error('Variant not found');
      }

      const { isGloballyAvailable, outletAvailability, timeBasedAvailability } = availabilityData;

      if (isGloballyAvailable !== undefined) {
        variant.availability.isGloballyAvailable = isGloballyAvailable;
      }

      if (outletAvailability) {
        variant.availability.outletAvailability = outletAvailability;
      }

      if (timeBasedAvailability) {
        variant.availability.timeBasedAvailability = timeBasedAvailability;
      }

      variant.updatedAt = new Date();
      return await variant.save();

    } catch (error) {
      logger.error('Error updating variant availability:', error);
      throw new Error(`Failed to update variant availability: ${error.message}`);
    }
  }

  /**
   * Get variant analytics
   * @param {String} hotelId - Hotel ID
   * @param {Object} dateRange - Date range
   * @returns {Object} Analytics data
   */
  async getVariantAnalytics(hotelId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      const matchStage = { hotelId };

      if (startDate && endDate) {
        matchStage.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const analytics = await POSItemVariant.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalVariants: { $sum: 1 },
            activeVariants: {
              $sum: { $cond: ['$configuration.isActive', 1, 0] }
            },
            totalOrders: { $sum: '$analytics.totalOrders' },
            totalRevenue: { $sum: '$analytics.totalRevenue' },
            averageOrderValue: { $avg: '$analytics.averageOrderValue' },
            averagePopularityScore: { $avg: '$analytics.popularityScore' }
          }
        }
      ]);

      const topVariants = await POSItemVariant.find({
        hotelId,
        'configuration.isActive': true
      })
        .sort({ 'analytics.popularityScore': -1, 'analytics.totalOrders': -1 })
        .limit(10)
        .populate('menuItemId', 'name displayName')
        .select('displayName analytics.popularityScore analytics.totalOrders analytics.totalRevenue');

      return {
        summary: analytics[0] || {
          totalVariants: 0,
          activeVariants: 0,
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          averagePopularityScore: 0
        },
        topVariants,
        generatedAt: new Date(),
        dateRange
      };

    } catch (error) {
      logger.error('Error getting variant analytics:', error);
      throw new Error(`Failed to get variant analytics: ${error.message}`);
    }
  }

  /**
   * Clear variant cache
   */
  clearCache() {
    this.variantCache.clear();
    logger.info('Variant cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.variantCache.size,
      maxAge: this.cacheExpiry,
      entries: Array.from(this.variantCache.keys())
    };
  }
}

// Export singleton instance
export default new POSVariantService();
