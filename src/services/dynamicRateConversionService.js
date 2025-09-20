import { RatePlan, RateOverride } from '../models/RateManagement.js';
import Currency from '../models/Currency.js';
import exchangeRateService from './exchangeRateService.js';
import logger from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';

/**
 * Dynamic Rate Conversion Service
 * 
 * Handles real-time currency conversion for rates and pricing
 * Works with existing rate management system to provide multi-currency support
 */
class DynamicRateConversionService {
  constructor() {
    this.redis = null;
    this.cacheKeyPrefix = 'converted_rates:';
    this.defaultCacheTTL = 1800; // 30 minutes cache for converted rates
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      this.redis = getRedisClient();
      logger.info('Dynamic rate conversion service initialized');
    } catch (error) {
      logger.warn('Redis not available for rate conversion caching', { error: error.message });
    }
  }

  /**
   * Convert rate plan to target currency with real-time exchange rates
   * @param {string} ratePlanId - Rate plan ID
   * @param {string} targetCurrency - Target currency code
   * @param {Date} date - Date for conversion (optional, defaults to today)
   * @returns {Promise<Object>} Converted rate plan data
   */
  async convertRatePlan(ratePlanId, targetCurrency, date = new Date()) {
    try {
      const ratePlan = await RatePlan.findOne({ planId: ratePlanId, isActive: true });
      if (!ratePlan) {
        throw new Error('Rate plan not found');
      }

      // Check cache first
      const cacheKey = `${this.cacheKeyPrefix}${ratePlanId}:${targetCurrency}:${date.toDateString()}`;
      const cached = await this.getCachedConversion(cacheKey);
      if (cached) {
        logger.debug('Using cached rate conversion', { ratePlanId, targetCurrency });
        return cached;
      }

      // If target currency is same as base currency, return original rates
      if (targetCurrency === ratePlan.baseCurrency) {
        return {
          ...ratePlan.toObject(),
          convertedCurrency: targetCurrency,
          conversionRate: 1.0,
          convertedAt: new Date(),
          source: 'base_currency'
        };
      }

      // Get current exchange rate
      const conversionResult = await exchangeRateService.convertCurrency(
        1, 
        ratePlan.baseCurrency, 
        targetCurrency
      );

      const conversionRate = conversionResult.rate;

      // Convert all base rates
      const convertedBaseRates = ratePlan.baseRates.map(baseRate => {
        // Check if we already have a manually set rate for this currency
        const existingCurrencyRate = baseRate.currencyRates.find(
          cr => cr.currency === targetCurrency && cr.source === 'manual'
        );

        if (existingCurrencyRate) {
          return {
            ...baseRate.toObject(),
            convertedRate: existingCurrencyRate.rate,
            originalRate: baseRate.rate,
            conversionRate: existingCurrencyRate.rate / baseRate.rate,
            source: 'manual'
          };
        }

        // Use real-time conversion
        const convertedRate = baseRate.rate * conversionRate;
        return {
          ...baseRate.toObject(),
          convertedRate: Math.round(convertedRate * 100) / 100, // Round to 2 decimal places
          originalRate: baseRate.rate,
          conversionRate,
          source: 'real_time_conversion'
        };
      });

      const result = {
        ...ratePlan.toObject(),
        baseRates: convertedBaseRates,
        convertedCurrency: targetCurrency,
        baseCurrency: ratePlan.baseCurrency,
        conversionRate,
        convertedAt: new Date(),
        exchangeRateProvider: conversionResult.timestamp ? 'live' : 'cached'
      };

      // Cache the result
      await this.cacheConversion(cacheKey, result);

      logger.info('Rate plan converted to currency', {
        ratePlanId,
        fromCurrency: ratePlan.baseCurrency,
        toCurrency: targetCurrency,
        conversionRate
      });

      return result;

    } catch (error) {
      logger.error('Failed to convert rate plan', {
        ratePlanId,
        targetCurrency,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Convert multiple rate plans to target currency
   * @param {Array<string>} ratePlanIds - Array of rate plan IDs
   * @param {string} targetCurrency - Target currency code
   * @param {Date} date - Date for conversion
   * @returns {Promise<Array>} Array of converted rate plans
   */
  async convertMultipleRatePlans(ratePlanIds, targetCurrency, date = new Date()) {
    try {
      const conversions = await Promise.all(
        ratePlanIds.map(async (ratePlanId) => {
          try {
            return await this.convertRatePlan(ratePlanId, targetCurrency, date);
          } catch (error) {
            logger.error('Failed to convert rate plan in bulk operation', {
              ratePlanId,
              error: error.message
            });
            return null;
          }
        })
      );

      // Filter out failed conversions
      return conversions.filter(conversion => conversion !== null);

    } catch (error) {
      logger.error('Failed to convert multiple rate plans', {
        ratePlanIds: ratePlanIds.length,
        targetCurrency,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get available rate plans for a hotel in target currency
   * @param {string} hotelId - Hotel ID
   * @param {string} targetCurrency - Target currency code
   * @param {Date} date - Check-in date
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Available rate plans with converted rates
   */
  async getAvailableRatesInCurrency(hotelId, targetCurrency, date = new Date(), options = {}) {
    try {
      const {
        roomType = null,
        includePackages = true,
        includePromotional = true
      } = options;

      // Build query for active rate plans
      const query = {
        isActive: true,
        $or: [
          { 'validity.startDate': { $lte: date }, 'validity.endDate': { $gte: date } },
          { 'validity.startDate': { $exists: false }, 'validity.endDate': { $exists: false } }
        ]
      };

      // Filter by room type if specified
      if (roomType) {
        query['baseRates.roomType'] = roomType;
      }

      // Filter by type if specified
      const typeFilters = [];
      if (!includePackages) typeFilters.push({ type: { $ne: 'Package' } });
      if (!includePromotional) typeFilters.push({ type: { $ne: 'Promotional' } });
      if (typeFilters.length > 0) {
        query.$and = typeFilters;
      }

      const ratePlans = await RatePlan.find(query).sort({ priority: -1, name: 1 });

      // Convert each rate plan to target currency
      const convertedPlans = await Promise.all(
        ratePlans.map(async (ratePlan) => {
          try {
            return await this.convertRatePlan(ratePlan.planId, targetCurrency, date);
          } catch (conversionError) {
            logger.warn('Failed to convert rate plan', {
              planId: ratePlan.planId,
              targetCurrency,
              error: conversionError.message
            });
            return null;
          }
        })
      );

      // Filter out failed conversions and apply date-specific overrides
      const validPlans = convertedPlans.filter(plan => plan !== null);

      // Apply rate overrides if any
      const plansWithOverrides = await this.applyRateOverrides(validPlans, targetCurrency, date);

      return plansWithOverrides;

    } catch (error) {
      logger.error('Failed to get available rates in currency', {
        hotelId,
        targetCurrency,
        date,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Apply rate overrides for specific dates
   * @param {Array} ratePlans - Converted rate plans
   * @param {string} targetCurrency - Target currency
   * @param {Date} date - Date to check for overrides
   * @returns {Promise<Array>} Rate plans with overrides applied
   */
  async applyRateOverrides(ratePlans, targetCurrency, date) {
    try {
      // Get active rate overrides for the date
      const overrides = await RateOverride.find({
        date,
        isActive: true,
        $or: [
          { expiresAt: { $gte: new Date() } },
          { expiresAt: { $exists: false } }
        ]
      });

      if (overrides.length === 0) {
        return ratePlans;
      }

      // Apply overrides to matching rate plans
      const plansWithOverrides = ratePlans.map(ratePlan => {
        const planOverrides = overrides.filter(override => 
          !override.ratePlanId || override.ratePlanId === ratePlan.planId
        );

        if (planOverrides.length === 0) {
          return ratePlan;
        }

        // Apply overrides to base rates
        const updatedBaseRates = ratePlan.baseRates.map(baseRate => {
          const override = planOverrides.find(o => o.roomType === baseRate.roomType);
          if (!override) {
            return baseRate;
          }

          // Convert override rate to target currency if needed
          let convertedOverrideRate;
          
          // Check if override has pre-converted rate for target currency
          const currencyOverride = override.currencyRates.find(cr => cr.currency === targetCurrency);
          if (currencyOverride) {
            convertedOverrideRate = currencyOverride.rate;
          } else if (override.baseCurrency === targetCurrency) {
            convertedOverrideRate = override.overrideRate;
          } else {
            // Convert from override base currency to target currency
            const conversionRate = ratePlan.conversionRate || 1;
            convertedOverrideRate = override.overrideRate * conversionRate;
          }

          return {
            ...baseRate,
            convertedRate: convertedOverrideRate,
            originalRate: baseRate.originalRate,
            isOverridden: true,
            overrideReason: override.reason,
            overrideSource: override.source || 'manual'
          };
        });

        return {
          ...ratePlan,
          baseRates: updatedBaseRates,
          hasOverrides: true,
          overrideCount: planOverrides.length
        };
      });

      return plansWithOverrides;

    } catch (error) {
      logger.error('Failed to apply rate overrides', {
        targetCurrency,
        date,
        error: error.message
      });
      return ratePlans; // Return original plans if override application fails
    }
  }

  /**
   * Update currency rates for existing rate plan
   * @param {string} ratePlanId - Rate plan ID
   * @param {string} targetCurrency - Currency to update
   * @param {boolean} forceUpdate - Force update even if recently updated
   * @returns {Promise<Object>} Update result
   */
  async updateRatePlanCurrency(ratePlanId, targetCurrency, forceUpdate = false) {
    try {
      const ratePlan = await RatePlan.findOne({ planId: ratePlanId, isActive: true });
      if (!ratePlan) {
        throw new Error('Rate plan not found');
      }

      // Get latest exchange rate
      const conversionResult = await exchangeRateService.convertCurrency(
        1,
        ratePlan.baseCurrency,
        targetCurrency
      );

      const conversionRate = conversionResult.rate;
      const updateTime = new Date();

      // Update currency rates for each base rate
      let updatedCount = 0;
      
      for (const baseRate of ratePlan.baseRates) {
        // Find existing currency rate
        const existingRateIndex = baseRate.currencyRates.findIndex(
          cr => cr.currency === targetCurrency
        );

        const convertedRate = Math.round(baseRate.rate * conversionRate * 100) / 100;

        if (existingRateIndex >= 0) {
          // Update existing rate if forced or if it's old
          const existingRate = baseRate.currencyRates[existingRateIndex];
          const hoursSinceUpdate = (updateTime - existingRate.lastUpdated) / (1000 * 60 * 60);

          if (forceUpdate || hoursSinceUpdate > 1 || existingRate.source === 'auto_conversion') {
            baseRate.currencyRates[existingRateIndex] = {
              ...existingRate,
              rate: convertedRate,
              lastUpdated: updateTime,
              source: 'auto_conversion'
            };
            updatedCount++;
          }
        } else {
          // Add new currency rate
          baseRate.currencyRates.push({
            currency: targetCurrency,
            rate: convertedRate,
            lastUpdated: updateTime,
            source: 'auto_conversion'
          });
          updatedCount++;
        }
      }

      // Save the updated rate plan
      await ratePlan.save();

      // Clear cached conversions for this rate plan
      await this.clearCachedConversions(ratePlanId, targetCurrency);

      logger.info('Rate plan currency updated', {
        ratePlanId,
        targetCurrency,
        conversionRate,
        updatedCount
      });

      return {
        success: true,
        ratePlanId,
        targetCurrency,
        conversionRate,
        updatedRates: updatedCount,
        updatedAt: updateTime
      };

    } catch (error) {
      logger.error('Failed to update rate plan currency', {
        ratePlanId,
        targetCurrency,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Batch update multiple rate plans with latest exchange rates
   * @param {Array<string>} ratePlanIds - Rate plan IDs to update
   * @param {Array<string>} targetCurrencies - Target currencies
   * @param {boolean} forceUpdate - Force update even if recently updated
   * @returns {Promise<Object>} Batch update result
   */
  async batchUpdateCurrencyRates(ratePlanIds, targetCurrencies, forceUpdate = false) {
    try {
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const ratePlanId of ratePlanIds) {
        for (const currency of targetCurrencies) {
          try {
            const result = await this.updateRatePlanCurrency(ratePlanId, currency, forceUpdate);
            results.push(result);
            successCount++;
          } catch (error) {
            results.push({
              success: false,
              ratePlanId,
              currency,
              error: error.message
            });
            errorCount++;
          }
        }
      }

      return {
        success: errorCount === 0,
        totalUpdates: results.length,
        successCount,
        errorCount,
        results
      };

    } catch (error) {
      logger.error('Failed to batch update currency rates', {
        ratePlanCount: ratePlanIds.length,
        currencyCount: targetCurrencies.length,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get conversion rates for display purposes
   * @param {string} baseCurrency - Base currency
   * @param {Array<string>} targetCurrencies - Target currencies
   * @returns {Promise<Object>} Conversion rates with metadata
   */
  async getDisplayConversionRates(baseCurrency, targetCurrencies) {
    try {
      const rates = {};
      const metadata = {
        baseCurrency,
        lastUpdated: new Date(),
        provider: 'exchangeRateService'
      };

      for (const targetCurrency of targetCurrencies) {
        if (targetCurrency === baseCurrency) {
          rates[targetCurrency] = {
            rate: 1.0,
            symbol: await this.getCurrencySymbol(targetCurrency),
            lastUpdated: new Date(),
            source: 'base_currency'
          };
          continue;
        }

        try {
          const conversion = await exchangeRateService.convertCurrency(1, baseCurrency, targetCurrency);
          rates[targetCurrency] = {
            rate: conversion.rate,
            symbol: await this.getCurrencySymbol(targetCurrency),
            lastUpdated: conversion.timestamp || new Date(),
            source: 'exchange_service'
          };
        } catch (conversionError) {
          logger.warn('Failed to get conversion rate', {
            baseCurrency,
            targetCurrency,
            error: conversionError.message
          });
          rates[targetCurrency] = {
            rate: null,
            symbol: await this.getCurrencySymbol(targetCurrency),
            error: conversionError.message,
            source: 'error'
          };
        }
      }

      return { rates, metadata };

    } catch (error) {
      logger.error('Failed to get display conversion rates', {
        baseCurrency,
        targetCurrencies,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Helper method to get currency symbol
   */
  async getCurrencySymbol(currencyCode) {
    try {
      const currency = await Currency.getCurrencyByCode(currencyCode);
      return currency?.symbol || currencyCode;
    } catch (error) {
      return currencyCode;
    }
  }

  /**
   * Cache management methods
   */
  async getCachedConversion(cacheKey) {
    if (!this.redis) return null;

    try {
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Failed to get cached conversion', { error: error.message });
      return null;
    }
  }

  async cacheConversion(cacheKey, data) {
    if (!this.redis) return;

    try {
      await this.redis.setex(cacheKey, this.defaultCacheTTL, JSON.stringify(data));
    } catch (error) {
      logger.warn('Failed to cache conversion', { error: error.message });
    }
  }

  async clearCachedConversions(ratePlanId, currency) {
    if (!this.redis) return;

    try {
      const pattern = `${this.cacheKeyPrefix}${ratePlanId}:${currency}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.debug('Cleared cached conversions', { ratePlanId, currency, keysCleared: keys.length });
      }
    } catch (error) {
      logger.warn('Failed to clear cached conversions', { error: error.message });
    }
  }
}

// Create singleton instance
const dynamicRateConversionService = new DynamicRateConversionService();

export default dynamicRateConversionService;