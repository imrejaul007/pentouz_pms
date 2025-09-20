import POSTax from '../models/POSTax.js';
import POSOutlet from '../models/POSOutlet.js';
import logger from '../utils/logger.js';

/**
 * POS Tax Calculation Service
 * 
 * Provides advanced tax calculation algorithms for POS operations including:
 * - Multi-tax handling (tax on tax)
 * - Discount and tax interaction logic
 * - Tax exemption processing
 * - Complex tax rule evaluation
 * - Tax reporting and analytics
 */

class POSTaxCalculationService {
  constructor() {
    this.taxCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Calculate taxes for a POS order
   * @param {Object} orderData - Order data including items, customer info, etc.
   * @param {Object} options - Calculation options
   * @returns {Object} Tax calculation results
   */
  async calculateOrderTaxes(orderData, options = {}) {
    try {
      const {
        hotelId,
        outletId,
        customerType = 'individual',
        applyExemptions = true,
        includeBreakdown = true,
        forceRecalculation = false
      } = options;

      // Get applicable taxes
      const taxes = await this.getApplicableTaxes(hotelId, outletId, forceRecalculation);

      if (!taxes || taxes.length === 0) {
        return {
          totalTax: 0,
          taxBreakdown: [],
          exemptedAmount: 0,
          taxableAmount: orderData.subtotal || 0
        };
      }

      // Group items by tax group for calculation
      const itemsByTaxGroup = this.groupItemsByTaxGroup(orderData.items || []);
      
      let totalTax = 0;
      let totalExemptedAmount = 0;
      const taxBreakdown = [];

      // Calculate taxes for each tax group
      for (const [taxGroup, items] of Object.entries(itemsByTaxGroup)) {
        const groupTaxes = taxes.filter(tax => tax.taxGroup === taxGroup);
        
        if (groupTaxes.length === 0) continue;

        const groupSubtotal = items.reduce((sum, item) => {
          const itemTotal = item.price * item.quantity;
          const modifierTotal = (item.modifiers || []).reduce((modSum, mod) => 
            modSum + (mod.price * item.quantity), 0);
          return sum + itemTotal + modifierTotal;
        }, 0);

        const groupResult = await this.calculateTaxForAmount(
          groupTaxes,
          groupSubtotal,
          {
            customerType,
            productCategory: taxGroup,
            outletId,
            applyExemptions
          }
        );

        totalTax += groupResult.totalTax;
        totalExemptedAmount += groupResult.exemptedAmount;

        if (includeBreakdown) {
          taxBreakdown.push({
            taxGroup,
            items: items.map(item => item.name),
            subtotal: groupSubtotal,
            taxAmount: groupResult.totalTax,
            exemptedAmount: groupResult.exemptedAmount,
            breakdown: groupResult.taxBreakdown
          });
        }
      }

      // Apply discounts and recalculate if needed
      if (orderData.discounts && orderData.discounts.length > 0) {
        const discountResult = this.applyDiscountsToTaxes(
          totalTax,
          orderData.discounts,
          orderData.subtotal
        );
        totalTax = discountResult.adjustedTax;
      }

      // Update tax calculation statistics
      await this.updateTaxStatistics(taxes, totalTax);

      return {
        totalTax: this.roundAmount(totalTax, 2),
        taxBreakdown,
        exemptedAmount: totalExemptedAmount,
        taxableAmount: (orderData.subtotal || 0) - totalExemptedAmount,
        calculationTimestamp: new Date(),
        appliedTaxes: taxes.map(tax => ({
          taxId: tax._id,
          taxName: tax.name,
          taxType: tax.taxType
        }))
      };

    } catch (error) {
      logger.error('Error calculating order taxes:', error);
      throw new Error(`Tax calculation failed: ${error.message}`);
    }
  }

  /**
   * Calculate tax for a specific amount with given taxes
   * @param {Array} taxes - Array of tax objects
   * @param {Number} amount - Amount to calculate tax for
   * @param {Object} options - Calculation options
   * @returns {Object} Tax calculation result
   */
  async calculateTaxForAmount(taxes, amount, options = {}) {
    const {
      customerType = 'individual',
      productCategory = null,
      outletId = null,
      applyExemptions = true
    } = options;

    let totalTax = 0;
    let exemptedAmount = 0;
    const taxBreakdown = [];

    // Sort taxes by calculation order
    const sortedTaxes = taxes.sort((a, b) => a.calculationOrder - b.calculationOrder);

    for (const tax of sortedTaxes) {
      let taxAmount = 0;
      let exemptionApplied = false;
      let exemptionPercentage = 0;

      // Check for exemptions
      if (applyExemptions && tax.exemptions.length > 0) {
        const exemption = this.findApplicableExemption(tax.exemptions, {
          customerType,
          productCategory,
          outletId,
          amount
        });

        if (exemption) {
          exemptionApplied = true;
          exemptionPercentage = exemption.exemptionPercentage;
        }
      }

      if (exemptionApplied && exemptionPercentage === 100) {
        // Full exemption
        exemptedAmount += amount;
        taxBreakdown.push({
          taxId: tax._id,
          taxName: tax.name,
          taxType: tax.taxType,
          amount: 0,
          rate: tax.effectiveRate,
          exemptionApplied: true,
          exemptionPercentage: 100
        });
        continue;
      }

      // Calculate tax based on rules
      const taxableAmount = exemptionApplied ? 
        amount * (1 - exemptionPercentage / 100) : amount;

      for (const rule of tax.rules) {
        let ruleAmount = 0;

        switch (rule.type) {
          case 'percentage':
            ruleAmount = (taxableAmount * rule.value) / 100;
            break;
          case 'fixed_amount':
            ruleAmount = rule.value;
            break;
          case 'compound':
            // Tax on previous taxes + base amount
            const baseAmount = amount + totalTax;
            ruleAmount = (baseAmount * rule.value) / 100;
            break;
        }

        // Apply thresholds
        if (rule.minThreshold && amount < rule.minThreshold) {
          ruleAmount = 0;
        }
        if (rule.maxThreshold && amount > rule.maxThreshold) {
          const maxAmount = rule.type === 'percentage' ? 
            (rule.maxThreshold * rule.value) / 100 : rule.value;
          ruleAmount = Math.min(ruleAmount, maxAmount);
        }

        // Apply rounding
        ruleAmount = this.applyRounding(ruleAmount, rule.rounding, rule.decimalPlaces);

        taxAmount += ruleAmount;
      }

      totalTax += taxAmount;
      taxBreakdown.push({
        taxId: tax._id,
        taxName: tax.name,
        taxType: tax.taxType,
        amount: taxAmount,
        rate: tax.effectiveRate,
        exemptionApplied,
        exemptionPercentage,
        rules: tax.rules.map(rule => ({
          type: rule.type,
          value: rule.value,
          applied: true
        }))
      });
    }

    return {
      totalTax: this.roundAmount(totalTax, 2),
      taxBreakdown,
      exemptedAmount,
      taxableAmount: amount - exemptedAmount
    };
  }

  /**
   * Get applicable taxes for a hotel/outlet
   * @param {String} hotelId - Hotel ID
   * @param {String} outletId - Outlet ID (optional)
   * @param {Boolean} forceRecalculation - Force cache refresh
   * @returns {Array} Array of applicable taxes
   */
  async getApplicableTaxes(hotelId, outletId = null, forceRecalculation = false) {
    const cacheKey = `${hotelId}_${outletId || 'global'}`;
    
    if (!forceRecalculation && this.taxCache.has(cacheKey)) {
      const cached = this.taxCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.taxes;
      }
    }

    try {
      const taxes = await POSTax.getActiveTaxes(hotelId, outletId);
      
      // Cache the result
      this.taxCache.set(cacheKey, {
        taxes,
        timestamp: Date.now()
      });

      return taxes;
    } catch (error) {
      logger.error('Error fetching applicable taxes:', error);
      throw new Error(`Failed to fetch taxes: ${error.message}`);
    }
  }

  /**
   * Group items by their tax group
   * @param {Array} items - Order items
   * @returns {Object} Items grouped by tax group
   */
  groupItemsByTaxGroup(items) {
    const grouped = {};

    for (const item of items) {
      const taxGroup = item.taxGroup || 'GENERAL';
      if (!grouped[taxGroup]) {
        grouped[taxGroup] = [];
      }
      grouped[taxGroup].push(item);
    }

    return grouped;
  }

  /**
   * Find applicable exemption for given context
   * @param {Array} exemptions - Array of exemptions
   * @param {Object} context - Exemption context
   * @returns {Object|null} Applicable exemption or null
   */
  findApplicableExemption(exemptions, context) {
    const { customerType, productCategory, outletId, amount } = context;

    for (const exemption of exemptions) {
      // Check customer type
      if (exemption.conditions.customerTypes.length > 0) {
        if (!exemption.conditions.customerTypes.includes(customerType)) {
          continue;
        }
      }

      // Check product category
      if (exemption.conditions.productCategories.length > 0) {
        if (!productCategory || !exemption.conditions.productCategories.includes(productCategory)) {
          continue;
        }
      }

      // Check amount thresholds
      if (exemption.conditions.minAmount && amount < exemption.conditions.minAmount) {
        continue;
      }
      if (exemption.conditions.maxAmount && amount > exemption.conditions.maxAmount) {
        continue;
      }

      // Check outlet applicability
      if (exemption.conditions.applicableOutlets.length > 0) {
        if (!outletId || !exemption.conditions.applicableOutlets.includes(outletId)) {
          continue;
        }
      }

      // Check time validity
      const now = new Date();
      if (exemption.conditions.validFrom && exemption.conditions.validFrom > now) {
        continue;
      }
      if (exemption.conditions.validTo && exemption.conditions.validTo < now) {
        continue;
      }

      return exemption;
    }

    return null;
  }

  /**
   * Apply discounts to tax calculations
   * @param {Number} totalTax - Current total tax
   * @param {Array} discounts - Array of discounts
   * @param {Number} subtotal - Order subtotal
   * @returns {Object} Adjusted tax amount
   */
  applyDiscountsToTaxes(totalTax, discounts, subtotal) {
    let adjustedTax = totalTax;
    let totalDiscountAmount = 0;

    for (const discount of discounts) {
      let discountAmount = 0;

      if (discount.percentage) {
        discountAmount = (subtotal * discount.percentage) / 100;
      } else if (discount.amount) {
        discountAmount = discount.amount;
      }

      totalDiscountAmount += discountAmount;

      // Reduce tax proportionally to discount
      const discountRatio = discountAmount / subtotal;
      adjustedTax -= (totalTax * discountRatio);
    }

    return {
      adjustedTax: Math.max(0, this.roundAmount(adjustedTax, 2)),
      totalDiscountAmount,
      originalTax: totalTax
    };
  }

  /**
   * Update tax calculation statistics
   * @param {Array} taxes - Taxes used in calculation
   * @param {Number} totalTax - Total tax calculated
   */
  async updateTaxStatistics(taxes, totalTax) {
    try {
      const updatePromises = taxes.map(tax => 
        tax.updateCalculationStats(totalTax)
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      logger.warn('Failed to update tax statistics:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Apply rounding to amount
   * @param {Number} amount - Amount to round
   * @param {String} rounding - Rounding method
   * @param {Number} decimalPlaces - Number of decimal places
   * @returns {Number} Rounded amount
   */
  applyRounding(amount, rounding = 'round', decimalPlaces = 2) {
    const factor = Math.pow(10, decimalPlaces);
    
    switch (rounding) {
      case 'round':
        return Math.round(amount * factor) / factor;
      case 'floor':
        return Math.floor(amount * factor) / factor;
      case 'ceil':
        return Math.ceil(amount * factor) / factor;
      case 'none':
      default:
        return amount;
    }
  }

  /**
   * Round amount to specified decimal places
   * @param {Number} amount - Amount to round
   * @param {Number} decimalPlaces - Number of decimal places
   * @returns {Number} Rounded amount
   */
  roundAmount(amount, decimalPlaces = 2) {
    return this.applyRounding(amount, 'round', decimalPlaces);
  }

  /**
   * Clear tax cache
   */
  clearCache() {
    this.taxCache.clear();
    logger.info('Tax calculation cache cleared');
  }

  /**
   * Get tax calculation report
   * @param {String} hotelId - Hotel ID
   * @param {Object} dateRange - Date range for report
   * @returns {Object} Tax calculation report
   */
  async getTaxReport(hotelId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      const matchStage = { hotelId };

      if (startDate && endDate) {
        matchStage.lastCalculated = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const report = await POSTax.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              taxType: '$taxType',
              taxGroup: '$taxGroup'
            },
            totalCalculations: { $sum: '$calculationCount' },
            totalCollected: { $sum: '$totalCollected' },
            averageAmount: { $avg: '$totalCollected' },
            taxCount: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.taxType': 1, '_id.taxGroup': 1 }
        }
      ]);

      return {
        summary: report,
        generatedAt: new Date(),
        dateRange
      };

    } catch (error) {
      logger.error('Error generating tax report:', error);
      throw new Error(`Tax report generation failed: ${error.message}`);
    }
  }

  /**
   * Validate tax configuration
   * @param {String} hotelId - Hotel ID
   * @returns {Object} Validation results
   */
  async validateTaxConfiguration(hotelId) {
    try {
      const issues = [];
      const warnings = [];

      // Check for duplicate tax IDs
      const duplicateTaxIds = await POSTax.aggregate([
        { $match: { hotelId } },
        { $group: { _id: '$taxId', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
      ]);

      if (duplicateTaxIds.length > 0) {
        issues.push({
          type: 'duplicate_tax_id',
          message: 'Duplicate tax IDs found',
          details: duplicateTaxIds
        });
      }

      // Check for overlapping validity periods
      const overlappingTaxes = await POSTax.find({
        hotelId,
        isActive: true,
        $or: [
          { validTo: { $exists: false } },
          { validTo: null }
        ]
      });

      if (overlappingTaxes.length > 1) {
        warnings.push({
          type: 'overlapping_taxes',
          message: 'Multiple active taxes without end dates',
          count: overlappingTaxes.length
        });
      }

      // Check for missing tax groups
      const requiredTaxGroups = ['FOOD', 'BEVERAGE', 'SERVICE', 'PRODUCT'];
      const existingTaxGroups = await POSTax.distinct('taxGroup', { hotelId, isActive: true });
      
      const missingTaxGroups = requiredTaxGroups.filter(group => 
        !existingTaxGroups.includes(group)
      );

      if (missingTaxGroups.length > 0) {
        warnings.push({
          type: 'missing_tax_groups',
          message: 'Missing recommended tax groups',
          missing: missingTaxGroups
        });
      }

      return {
        isValid: issues.length === 0,
        issues,
        warnings,
        validatedAt: new Date()
      };

    } catch (error) {
      logger.error('Error validating tax configuration:', error);
      throw new Error(`Tax validation failed: ${error.message}`);
    }
  }
}

// Export singleton instance
export default new POSTaxCalculationService();
