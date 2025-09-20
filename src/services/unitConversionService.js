import MeasurementUnit from '../models/MeasurementUnit.js';
import logger from '../utils/logger.js';

/**
 * Unit Conversion Service
 * 
 * Provides unit conversion algorithms for POS operations including:
 * - Unit conversion between different systems
 * - Conversion between different unit types
 * - Quantity calculations for inventory
 * - Batch conversion operations
 * - Conversion validation and error handling
 */

class UnitConversionService {
  constructor() {
    this.conversionCache = new Map();
    this.cacheExpiry = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Convert value from one unit to another
   * @param {String} fromUnitId - Source unit ID
   * @param {String} toUnitId - Target unit ID
   * @param {Number} value - Value to convert
   * @param {Object} options - Conversion options
   * @returns {Object} Conversion result
   */
  async convert(fromUnitId, toUnitId, value, options = {}) {
    try {
      const {
        precision = 6,
        validateInput = true,
        useCache = true
      } = options;

      // Validate input
      if (validateInput) {
        const validation = this.validateConversionInput(fromUnitId, toUnitId, value);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
      }

      // Check cache first
      const cacheKey = `${fromUnitId}_${toUnitId}_${value}`;
      if (useCache && this.conversionCache.has(cacheKey)) {
        const cached = this.conversionCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          return cached.result;
        }
      }

      // Get units
      const [fromUnit, toUnit] = await Promise.all([
        MeasurementUnit.findById(fromUnitId),
        MeasurementUnit.findById(toUnitId)
      ]);

      if (!fromUnit || !toUnit) {
        throw new Error('Invalid unit IDs provided');
      }

      // Validate units are active
      if (!fromUnit.isActive || !toUnit.isActive) {
        throw new Error('One or more units are inactive');
      }

      // Check if units are of the same type
      if (fromUnit.unitType !== toUnit.unitType) {
        throw new Error(`Cannot convert between different unit types: ${fromUnit.unitType} and ${toUnit.unitType}`);
      }

      // Perform conversion
      let convertedValue;
      const conversionPath = await this.findConversionPath(fromUnit, toUnit);
      
      if (conversionPath.direct) {
        convertedValue = this.performDirectConversion(value, conversionPath.factor, conversionPath.offset);
      } else if (conversionPath.throughBase) {
        convertedValue = await this.performBaseConversion(value, fromUnit, toUnit);
      } else {
        throw new Error(`No conversion path found between ${fromUnit.name} and ${toUnit.name}`);
      }

      // Apply precision
      convertedValue = this.applyPrecision(convertedValue, precision);

      const result = {
        originalValue: value,
        originalUnit: {
          id: fromUnit._id,
          name: fromUnit.name,
          symbol: fromUnit.symbol
        },
        convertedValue,
        targetUnit: {
          id: toUnit._id,
          name: toUnit.name,
          symbol: toUnit.symbol
        },
        conversionFactor: conversionPath.factor || 1,
        conversionOffset: conversionPath.offset || 0,
        conversionPath: conversionPath.path,
        precision,
        convertedAt: new Date()
      };

      // Cache result
      if (useCache) {
        this.conversionCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
      }

      // Update usage statistics
      await Promise.all([
        fromUnit.updateUsage(),
        toUnit.updateUsage()
      ]);

      return result;

    } catch (error) {
      logger.error('Unit conversion error:', error);
      throw new Error(`Conversion failed: ${error.message}`);
    }
  }

  /**
   * Convert multiple values in batch
   * @param {Array} conversions - Array of conversion requests
   * @param {Object} options - Batch conversion options
   * @returns {Array} Array of conversion results
   */
  async convertBatch(conversions, options = {}) {
    try {
      const {
        parallel = true,
        maxConcurrency = 10
      } = options;

      if (parallel) {
        // Process conversions in parallel with concurrency limit
        const results = [];
        for (let i = 0; i < conversions.length; i += maxConcurrency) {
          const batch = conversions.slice(i, i + maxConcurrency);
          const batchResults = await Promise.all(
            batch.map(conv => this.convert(conv.fromUnitId, conv.toUnitId, conv.value, conv.options))
          );
          results.push(...batchResults);
        }
        return results;
      } else {
        // Process conversions sequentially
        const results = [];
        for (const conversion of conversions) {
          const result = await this.convert(
            conversion.fromUnitId,
            conversion.toUnitId,
            conversion.value,
            conversion.options
          );
          results.push(result);
        }
        return results;
      }
    } catch (error) {
      logger.error('Batch conversion error:', error);
      throw new Error(`Batch conversion failed: ${error.message}`);
    }
  }

  /**
   * Get available conversion units for a given unit
   * @param {String} unitId - Unit ID
   * @returns {Array} Array of available conversion units
   */
  async getAvailableConversions(unitId) {
    try {
      const unit = await MeasurementUnit.findById(unitId)
        .populate('conversionFactors.targetUnit', 'name symbol unitType isActive');

      if (!unit) {
        throw new Error('Unit not found');
      }

      const availableUnits = unit.conversionFactors
        .filter(cf => cf.targetUnit.isActive)
        .map(cf => ({
          unitId: cf.targetUnit._id,
          name: cf.targetUnit.name,
          symbol: cf.targetUnit.symbol,
          unitType: cf.targetUnit.unitType,
          conversionFactor: cf.factor,
          conversionOffset: cf.offset
        }));

      return availableUnits;
    } catch (error) {
      logger.error('Error getting available conversions:', error);
      throw new Error(`Failed to get available conversions: ${error.message}`);
    }
  }

  /**
   * Find conversion path between two units
   * @param {Object} fromUnit - Source unit
   * @param {Object} toUnit - Target unit
   * @returns {Object} Conversion path information
   */
  async findConversionPath(fromUnit, toUnit) {
    // Check for direct conversion
    const directFactor = fromUnit.conversionFactors.find(
      cf => cf.targetUnit.toString() === toUnit._id.toString()
    );

    if (directFactor) {
      return {
        direct: true,
        factor: directFactor.factor,
        offset: directFactor.offset,
        path: 'direct'
      };
    }

    // Check for conversion through base unit
    if (fromUnit.baseUnit && toUnit.baseUnit) {
      const fromBaseRate = await this.getBaseConversionRate(fromUnit);
      const toBaseRate = await this.getBaseConversionRate(toUnit);

      if (fromBaseRate && toBaseRate) {
        return {
          direct: false,
          throughBase: true,
          factor: fromBaseRate / toBaseRate,
          offset: 0,
          path: 'through_base'
        };
      }
    }

    return {
      direct: false,
      throughBase: false,
      factor: null,
      offset: null,
      path: 'none'
    };
  }

  /**
   * Get conversion rate to base unit
   * @param {Object} unit - Unit object
   * @returns {Number} Conversion rate to base unit
   */
  async getBaseConversionRate(unit) {
    if (unit.isBaseUnit) return 1;

    if (unit.baseUnit) {
      const baseUnit = await MeasurementUnit.findById(unit.baseUnit);
      if (baseUnit) {
        const conversion = await this.findConversionPath(unit, baseUnit);
        return conversion.factor || 1;
      }
    }

    return null;
  }

  /**
   * Perform direct conversion
   * @param {Number} value - Value to convert
   * @param {Number} factor - Conversion factor
   * @param {Number} offset - Conversion offset
   * @returns {Number} Converted value
   */
  performDirectConversion(value, factor, offset = 0) {
    return (value * factor) + offset;
  }

  /**
   * Perform conversion through base unit
   * @param {Number} value - Value to convert
   * @param {Object} fromUnit - Source unit
   * @param {Object} toUnit - Target unit
   * @returns {Number} Converted value
   */
  async performBaseConversion(value, fromUnit, toUnit) {
    const fromBaseRate = await this.getBaseConversionRate(fromUnit);
    const toBaseRate = await this.getBaseConversionRate(toUnit);

    if (!fromBaseRate || !toBaseRate) {
      throw new Error('Unable to determine base conversion rates');
    }

    // Convert to base unit, then to target unit
    const baseValue = value * fromBaseRate;
    return baseValue / toBaseRate;
  }

  /**
   * Apply precision to converted value
   * @param {Number} value - Value to round
   * @param {Number} precision - Number of decimal places
   * @returns {Number} Rounded value
   */
  applyPrecision(value, precision) {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }

  /**
   * Validate conversion input
   * @param {String} fromUnitId - Source unit ID
   * @param {String} toUnitId - Target unit ID
   * @param {Number} value - Value to convert
   * @returns {Object} Validation result
   */
  validateConversionInput(fromUnitId, toUnitId, value) {
    if (!fromUnitId || !toUnitId) {
      return { valid: false, error: 'Both source and target unit IDs are required' };
    }

    if (fromUnitId === toUnitId) {
      return { valid: false, error: 'Source and target units cannot be the same' };
    }

    if (typeof value !== 'number' || isNaN(value)) {
      return { valid: false, error: 'Value must be a valid number' };
    }

    if (!isFinite(value)) {
      return { valid: false, error: 'Value must be finite' };
    }

    return { valid: true };
  }

  /**
   * Get unit conversion report
   * @param {String} hotelId - Hotel ID
   * @param {Object} dateRange - Date range for report
   * @returns {Object} Conversion report
   */
  async getConversionReport(hotelId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      const matchStage = { hotelId };

      if (startDate && endDate) {
        matchStage.lastUsed = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const report = await MeasurementUnit.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              unitType: '$unitType',
              unitSystem: '$unitSystem'
            },
            totalUnits: { $sum: 1 },
            totalUsage: { $sum: '$usageCount' },
            averageUsage: { $avg: '$usageCount' },
            mostUsedUnit: {
              $first: {
                $cond: [
                  { $eq: ['$usageCount', { $max: '$usageCount' }] },
                  { name: '$name', symbol: '$symbol', usageCount: '$usageCount' },
                  null
                ]
              }
            }
          }
        },
        {
          $sort: { '_id.unitType': 1, '_id.unitSystem': 1 }
        }
      ]);

      return {
        summary: report,
        generatedAt: new Date(),
        dateRange
      };

    } catch (error) {
      logger.error('Error generating conversion report:', error);
      throw new Error(`Conversion report generation failed: ${error.message}`);
    }
  }

  /**
   * Validate unit configuration
   * @param {String} hotelId - Hotel ID
   * @returns {Object} Validation results
   */
  async validateUnitConfiguration(hotelId) {
    try {
      const issues = [];
      const warnings = [];

      // Check for duplicate unit IDs
      const duplicateUnitIds = await MeasurementUnit.aggregate([
        { $match: { hotelId } },
        { $group: { _id: '$unitId', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
      ]);

      if (duplicateUnitIds.length > 0) {
        issues.push({
          type: 'duplicate_unit_id',
          message: 'Duplicate unit IDs found',
          details: duplicateUnitIds
        });
      }

      // Check for missing base units
      const unitTypes = await MeasurementUnit.distinct('unitType', { hotelId, isActive: true });
      const baseUnits = await MeasurementUnit.distinct('unitType', { 
        hotelId, 
        isActive: true, 
        isBaseUnit: true 
      });

      const missingBaseUnits = unitTypes.filter(type => !baseUnits.includes(type));
      if (missingBaseUnits.length > 0) {
        warnings.push({
          type: 'missing_base_units',
          message: 'Missing base units for some unit types',
          missing: missingBaseUnits
        });
      }

      // Check for units without conversion factors
      const unitsWithoutConversions = await MeasurementUnit.countDocuments({
        hotelId,
        isActive: true,
        isBaseUnit: false,
        conversionFactors: { $size: 0 }
      });

      if (unitsWithoutConversions > 0) {
        warnings.push({
          type: 'units_without_conversions',
          message: 'Units without conversion factors found',
          count: unitsWithoutConversions
        });
      }

      return {
        isValid: issues.length === 0,
        issues,
        warnings,
        validatedAt: new Date()
      };

    } catch (error) {
      logger.error('Error validating unit configuration:', error);
      throw new Error(`Unit validation failed: ${error.message}`);
    }
  }

  /**
   * Clear conversion cache
   */
  clearCache() {
    this.conversionCache.clear();
    logger.info('Unit conversion cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.conversionCache.size,
      maxAge: this.cacheExpiry,
      entries: Array.from(this.conversionCache.keys())
    };
  }
}

// Export singleton instance
export default new UnitConversionService();
