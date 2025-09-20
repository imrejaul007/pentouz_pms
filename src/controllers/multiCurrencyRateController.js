import { RatePlan, RateOverride, Package } from '../models/RateManagement.js';
import Currency from '../models/Currency.js';
import dynamicRateConversionService from '../services/dynamicRateConversionService.js';
import exchangeRateService from '../services/exchangeRateService.js';
import logger from '../utils/logger.js';

/**
 * Multi-Currency Rate Controller
 * 
 * Handles rate management with real-time currency conversion
 * Provides endpoints for OTA-ready multi-currency rate display
 */
class MultiCurrencyRateController {
  
  /**
   * Get available rates for a hotel in specific currency
   */
  async getAvailableRatesInCurrency(req, res) {
    try {
      const { hotelId } = req.params;
      const { 
        currency = 'USD',
        date,
        roomType,
        includePackages = 'true',
        includePromotional = 'true'
      } = req.query;

      const checkDate = date ? new Date(date) : new Date();
      
      const options = {
        roomType,
        includePackages: includePackages === 'true',
        includePromotional: includePromotional === 'true'
      };

      const convertedRates = await dynamicRateConversionService.getAvailableRatesInCurrency(
        hotelId,
        currency.toUpperCase(),
        checkDate,
        options
      );

      res.json({
        success: true,
        data: convertedRates,
        meta: {
          currency: currency.toUpperCase(),
          date: checkDate,
          hotelId,
          count: convertedRates.length
        }
      });

    } catch (error) {
      logger.error('Error getting available rates in currency', {
        hotelId: req.params.hotelId,
        currency: req.query.currency,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Convert specific rate plan to target currency
   */
  async convertRatePlan(req, res) {
    try {
      const { ratePlanId } = req.params;
      const { targetCurrency, date } = req.query;

      if (!targetCurrency) {
        return res.status(400).json({
          success: false,
          message: 'Target currency is required'
        });
      }

      const checkDate = date ? new Date(date) : new Date();
      
      const convertedPlan = await dynamicRateConversionService.convertRatePlan(
        ratePlanId,
        targetCurrency.toUpperCase(),
        checkDate
      );

      res.json({
        success: true,
        data: convertedPlan,
        meta: {
          ratePlanId,
          targetCurrency: targetCurrency.toUpperCase(),
          date: checkDate
        }
      });

    } catch (error) {
      logger.error('Error converting rate plan', {
        ratePlanId: req.params.ratePlanId,
        targetCurrency: req.query.targetCurrency,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get conversion rates for multiple currencies
   */
  async getConversionRates(req, res) {
    try {
      const { baseCurrency = 'USD', targetCurrencies } = req.query;

      if (!targetCurrencies) {
        return res.status(400).json({
          success: false,
          message: 'Target currencies parameter is required'
        });
      }

      const currencies = Array.isArray(targetCurrencies) 
        ? targetCurrencies 
        : targetCurrencies.split(',');

      const conversionRates = await dynamicRateConversionService.getDisplayConversionRates(
        baseCurrency.toUpperCase(),
        currencies.map(c => c.toUpperCase())
      );

      res.json({
        success: true,
        data: conversionRates,
        meta: {
          baseCurrency: baseCurrency.toUpperCase(),
          targetCurrencies: currencies.map(c => c.toUpperCase()),
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Error getting conversion rates', {
        baseCurrency: req.query.baseCurrency,
        targetCurrencies: req.query.targetCurrencies,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update currency rates for rate plan
   */
  async updateRatePlanCurrency(req, res) {
    try {
      const { ratePlanId } = req.params;
      const { targetCurrency, forceUpdate = false } = req.body;

      if (!targetCurrency) {
        return res.status(400).json({
          success: false,
          message: 'Target currency is required'
        });
      }

      const result = await dynamicRateConversionService.updateRatePlanCurrency(
        ratePlanId,
        targetCurrency.toUpperCase(),
        forceUpdate
      );

      res.json({
        success: true,
        data: result,
        message: `Updated ${result.updatedRates} rates for currency ${targetCurrency}`
      });

    } catch (error) {
      logger.error('Error updating rate plan currency', {
        ratePlanId: req.params.ratePlanId,
        targetCurrency: req.body.targetCurrency,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Batch update multiple rate plans with currency rates
   */
  async batchUpdateCurrencyRates(req, res) {
    try {
      const { ratePlanIds, targetCurrencies, forceUpdate = false } = req.body;

      if (!ratePlanIds || !Array.isArray(ratePlanIds) || ratePlanIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Rate plan IDs array is required'
        });
      }

      if (!targetCurrencies || !Array.isArray(targetCurrencies) || targetCurrencies.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Target currencies array is required'
        });
      }

      const result = await dynamicRateConversionService.batchUpdateCurrencyRates(
        ratePlanIds,
        targetCurrencies.map(c => c.toUpperCase()),
        forceUpdate
      );

      res.json({
        success: result.success,
        data: result,
        message: `Batch update completed: ${result.successCount} successful, ${result.errorCount} failed`
      });

    } catch (error) {
      logger.error('Error in batch update currency rates', {
        ratePlanIds: req.body.ratePlanIds?.length || 0,
        targetCurrencies: req.body.targetCurrencies?.length || 0,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get rate comparison across multiple currencies
   */
  async getRateComparison(req, res) {
    try {
      const { ratePlanId } = req.params;
      const { currencies, date } = req.query;

      if (!currencies) {
        return res.status(400).json({
          success: false,
          message: 'Currencies parameter is required'
        });
      }

      const currencyList = Array.isArray(currencies) 
        ? currencies 
        : currencies.split(',');

      const checkDate = date ? new Date(date) : new Date();

      const conversions = await dynamicRateConversionService.convertMultipleRatePlans(
        [ratePlanId],
        currencyList.map(c => c.toUpperCase()),
        checkDate
      );

      if (conversions.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Rate plan not found or conversion failed'
        });
      }

      // Extract comparison data
      const basePlan = conversions[0];
      const comparison = {
        ratePlan: {
          planId: basePlan.planId,
          name: basePlan.name,
          type: basePlan.type,
          baseCurrency: basePlan.baseCurrency
        },
        currencies: currencyList.map(currency => {
          const converted = conversions.find(c => c.convertedCurrency === currency.toUpperCase());
          if (!converted) {
            return {
              currency: currency.toUpperCase(),
              available: false,
              error: 'Conversion failed'
            };
          }

          return {
            currency: currency.toUpperCase(),
            available: true,
            conversionRate: converted.conversionRate,
            baseRates: converted.baseRates.map(br => ({
              roomType: br.roomType,
              originalRate: br.originalRate,
              convertedRate: br.convertedRate,
              source: br.source
            })),
            convertedAt: converted.convertedAt
          };
        }),
        comparisonDate: checkDate
      };

      res.json({
        success: true,
        data: comparison,
        meta: {
          ratePlanId,
          currencies: currencyList.map(c => c.toUpperCase()),
          date: checkDate
        }
      });

    } catch (error) {
      logger.error('Error getting rate comparison', {
        ratePlanId: req.params.ratePlanId,
        currencies: req.query.currencies,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get rate history with currency tracking
   */
  async getRateHistory(req, res) {
    try {
      const { ratePlanId } = req.params;
      const { 
        currency = 'USD',
        startDate,
        endDate,
        roomType
      } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Get rate plan
      const ratePlan = await RatePlan.findOne({ planId: ratePlanId, isActive: true });
      if (!ratePlan) {
        return res.status(404).json({
          success: false,
          message: 'Rate plan not found'
        });
      }

      // Get rate overrides in date range
      const query = {
        ratePlanId,
        date: { $gte: start, $lte: end },
        isActive: true
      };

      if (roomType) {
        query.roomType = roomType;
      }

      const overrides = await RateOverride.find(query).sort({ date: 1 });

      // Build history with currency conversion
      const history = [];
      const currentDate = new Date(start);

      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Check for override on this date
        const dayOverrides = overrides.filter(override => 
          override.date.toISOString().split('T')[0] === dateStr
        );

        // Convert base rates or overrides to target currency
        const baseRates = ratePlan.baseRates
          .filter(br => !roomType || br.roomType === roomType)
          .map(br => {
            const override = dayOverrides.find(o => o.roomType === br.roomType);
            let rate = override ? override.overrideRate : br.rate;
            
            // Convert to target currency if different from base
            if (currency.toUpperCase() !== ratePlan.baseCurrency) {
              const currencyRate = override && override.currencyRates.find(cr => cr.currency === currency.toUpperCase());
              if (currencyRate) {
                rate = currencyRate.rate;
              } else {
                // Find existing currency rate in base rate or calculate
                const existingCurrencyRate = br.currencyRates.find(cr => cr.currency === currency.toUpperCase());
                if (existingCurrencyRate) {
                  rate = override ? 
                    (override.overrideRate * existingCurrencyRate.rate / br.rate) : 
                    existingCurrencyRate.rate;
                }
              }
            }

            return {
              roomType: br.roomType,
              baseRate: br.rate,
              displayRate: rate,
              isOverridden: !!override,
              overrideReason: override?.reason
            };
          });

        history.push({
          date: dateStr,
          rates: baseRates
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      res.json({
        success: true,
        data: {
          ratePlan: {
            planId: ratePlan.planId,
            name: ratePlan.name,
            baseCurrency: ratePlan.baseCurrency
          },
          displayCurrency: currency.toUpperCase(),
          dateRange: { start: startDate, end: endDate },
          history
        },
        meta: {
          ratePlanId,
          currency: currency.toUpperCase(),
          totalDays: history.length,
          overrideCount: overrides.length
        }
      });

    } catch (error) {
      logger.error('Error getting rate history', {
        ratePlanId: req.params.ratePlanId,
        currency: req.query.currency,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get channel-specific rates with currency conversion
   */
  async getChannelRates(req, res) {
    try {
      const { hotelId } = req.params;
      const { 
        channel,
        currency = 'USD',
        date,
        roomType
      } = req.query;

      if (!channel) {
        return res.status(400).json({
          success: false,
          message: 'Channel parameter is required'
        });
      }

      const checkDate = date ? new Date(date) : new Date();

      // Get available rates in currency
      const availableRates = await dynamicRateConversionService.getAvailableRatesInCurrency(
        hotelId,
        currency.toUpperCase(),
        checkDate,
        { roomType }
      );

      // Filter or enhance rates based on channel requirements
      const channelRates = availableRates.map(ratePlan => {
        // Apply channel-specific markup or discounts if configured
        const channelCommission = ratePlan.commission?.percentage || 0;
        
        const enhancedBaseRates = ratePlan.baseRates.map(baseRate => ({
          ...baseRate,
          channelRate: Math.round(baseRate.convertedRate * (1 + channelCommission / 100) * 100) / 100,
          commission: channelCommission
        }));

        return {
          ...ratePlan,
          baseRates: enhancedBaseRates,
          channel,
          channelSpecific: true
        };
      });

      res.json({
        success: true,
        data: channelRates,
        meta: {
          hotelId,
          channel,
          currency: currency.toUpperCase(),
          date: checkDate,
          count: channelRates.length
        }
      });

    } catch (error) {
      logger.error('Error getting channel rates', {
        hotelId: req.params.hotelId,
        channel: req.query.channel,
        currency: req.query.currency,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new MultiCurrencyRateController();
