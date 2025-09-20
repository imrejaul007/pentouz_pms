import Currency from '../models/Currency.js';
import exchangeRateService from '../services/exchangeRateService.js';
import logger from './logger.js';

/**
 * Currency Utilities
 * 
 * Helper functions for currency conversion, formatting, and multi-currency operations
 * Used throughout the application for consistent currency handling
 */

/**
 * Convert amount between currencies
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @returns {Promise<number>} Converted amount
 */
export async function convertCurrency(amount, fromCurrency, toCurrency) {
  try {
    if (fromCurrency === toCurrency) return amount;

    const result = await exchangeRateService.convertCurrency(amount, fromCurrency, toCurrency);
    return result.convertedAmount;
  } catch (error) {
    logger.error('Currency conversion failed', {
      amount,
      fromCurrency,
      toCurrency,
      error: error.message
    });
    throw error;
  }
}

/**
 * Format amount with currency symbol and proper formatting
 * @param {number} amount - Amount to format
 * @param {string} currencyCode - Currency code
 * @param {Object} options - Formatting options
 * @returns {Promise<string>} Formatted amount string
 */
export async function formatCurrency(amount, currencyCode, options = {}) {
  try {
    const currency = await Currency.getCurrencyByCode(currencyCode);
    if (!currency) {
      throw new Error(`Currency ${currencyCode} not found`);
    }

    return currency.formatAmount(amount, options);
  } catch (error) {
    logger.error('Currency formatting failed', {
      amount,
      currencyCode,
      error: error.message
    });
    
    // Fallback formatting
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

/**
 * Get all active currencies with their current exchange rates
 * @returns {Promise<Array>} Array of active currencies
 */
export async function getActiveCurrencies() {
  try {
    return await Currency.getActiveCurrencies();
  } catch (error) {
    logger.error('Failed to get active currencies', { error: error.message });
    throw error;
  }
}

/**
 * Get base currency
 * @returns {Promise<Object>} Base currency object
 */
export async function getBaseCurrency() {
  try {
    const baseCurrency = await Currency.getBaseCurrency();
    if (!baseCurrency) {
      throw new Error('No base currency configured');
    }
    return baseCurrency;
  } catch (error) {
    logger.error('Failed to get base currency', { error: error.message });
    throw error;
  }
}

/**
 * Convert rate object to multiple currencies
 * @param {Object} baseRate - Base rate object with currency
 * @param {Array} targetCurrencies - Target currency codes
 * @returns {Promise<Array>} Array of converted rates
 */
export async function convertRateToMultipleCurrencies(baseRate, targetCurrencies = []) {
  try {
    const { rate, currency: baseCurrency } = baseRate;
    const convertedRates = [];

    for (const targetCurrency of targetCurrencies) {
      if (targetCurrency === baseCurrency) {
        convertedRates.push({
          currency: targetCurrency,
          rate,
          source: 'original'
        });
        continue;
      }

      try {
        const convertedAmount = await convertCurrency(rate, baseCurrency, targetCurrency);
        convertedRates.push({
          currency: targetCurrency,
          rate: convertedAmount,
          source: 'auto_conversion',
          lastUpdated: new Date()
        });
      } catch (conversionError) {
        logger.warn('Failed to convert rate for currency', {
          baseCurrency,
          targetCurrency,
          error: conversionError.message
        });
      }
    }

    return convertedRates;
  } catch (error) {
    logger.error('Failed to convert rate to multiple currencies', { error: error.message });
    throw error;
  }
}

/**
 * Update currency rates in rate plan
 * @param {Object} ratePlan - Rate plan object
 * @param {Array} targetCurrencies - Target currencies to update
 * @returns {Promise<Object>} Updated rate plan
 */
export async function updateRatePlanCurrencyRates(ratePlan, targetCurrencies = []) {
  try {
    const updatedRates = [];

    for (const baseRate of ratePlan.baseRates) {
      const convertedRates = await convertRateToMultipleCurrencies({
        rate: baseRate.rate,
        currency: ratePlan.baseCurrency
      }, targetCurrencies);

      // Update existing currency rates or add new ones
      baseRate.currencyRates = baseRate.currencyRates || [];
      
      for (const convertedRate of convertedRates) {
        const existingRateIndex = baseRate.currencyRates.findIndex(
          cr => cr.currency === convertedRate.currency
        );

        if (existingRateIndex >= 0) {
          // Update existing rate
          baseRate.currencyRates[existingRateIndex] = {
            ...baseRate.currencyRates[existingRateIndex],
            rate: convertedRate.rate,
            source: convertedRate.source,
            lastUpdated: new Date()
          };
        } else {
          // Add new rate
          baseRate.currencyRates.push(convertedRate);
        }
      }

      updatedRates.push(baseRate);
    }

    ratePlan.baseRates = updatedRates;
    return ratePlan;
  } catch (error) {
    logger.error('Failed to update rate plan currency rates', { error: error.message });
    throw error;
  }
}

/**
 * Update currency rates in rate override
 * @param {Object} rateOverride - Rate override object
 * @param {Array} targetCurrencies - Target currencies to update
 * @returns {Promise<Object>} Updated rate override
 */
export async function updateRateOverrideCurrencyRates(rateOverride, targetCurrencies = []) {
  try {
    const convertedRates = await convertRateToMultipleCurrencies({
      rate: rateOverride.overrideRate,
      currency: rateOverride.baseCurrency
    }, targetCurrencies);

    // Update currency rates
    rateOverride.currencyRates = rateOverride.currencyRates || [];
    
    for (const convertedRate of convertedRates) {
      const existingRateIndex = rateOverride.currencyRates.findIndex(
        cr => cr.currency === convertedRate.currency
      );

      if (existingRateIndex >= 0) {
        // Update existing rate
        rateOverride.currencyRates[existingRateIndex] = {
          ...rateOverride.currencyRates[existingRateIndex],
          rate: convertedRate.rate,
          source: convertedRate.source
        };
      } else {
        // Add new rate
        rateOverride.currencyRates.push({
          currency: convertedRate.currency,
          rate: convertedRate.rate,
          source: convertedRate.source
        });
      }
    }

    return rateOverride;
  } catch (error) {
    logger.error('Failed to update rate override currency rates', { error: error.message });
    throw error;
  }
}

/**
 * Get rate in specific currency
 * @param {Object} rateObject - Rate object (plan or override)
 * @param {string} targetCurrency - Target currency code
 * @param {string} roomType - Room type (for rate plans)
 * @returns {Promise<Object>} Rate in target currency
 */
export async function getRateInCurrency(rateObject, targetCurrency, roomType = null) {
  try {
    // For rate plans
    if (rateObject.baseRates && roomType) {
      const baseRate = rateObject.baseRates.find(br => br.roomType === roomType);
      if (!baseRate) {
        throw new Error(`Room type ${roomType} not found in rate plan`);
      }

      // Check if target currency rate exists
      if (baseRate.currencyRates) {
        const currencyRate = baseRate.currencyRates.find(cr => cr.currency === targetCurrency);
        if (currencyRate) {
          return {
            rate: currencyRate.rate,
            currency: targetCurrency,
            source: currencyRate.source,
            lastUpdated: currencyRate.lastUpdated
          };
        }
      }

      // Convert from base currency
      if (rateObject.baseCurrency === targetCurrency) {
        return {
          rate: baseRate.rate,
          currency: targetCurrency,
          source: 'base_currency'
        };
      }

      const convertedRate = await convertCurrency(baseRate.rate, rateObject.baseCurrency, targetCurrency);
      return {
        rate: convertedRate,
        currency: targetCurrency,
        source: 'real_time_conversion'
      };
    }

    // For rate overrides
    if (rateObject.overrideRate) {
      // Check if target currency rate exists
      if (rateObject.currencyRates) {
        const currencyRate = rateObject.currencyRates.find(cr => cr.currency === targetCurrency);
        if (currencyRate) {
          return {
            rate: currencyRate.rate,
            currency: targetCurrency,
            source: currencyRate.source
          };
        }
      }

      // Convert from base currency
      if (rateObject.baseCurrency === targetCurrency) {
        return {
          rate: rateObject.overrideRate,
          currency: targetCurrency,
          source: 'base_currency'
        };
      }

      const convertedRate = await convertCurrency(rateObject.overrideRate, rateObject.baseCurrency, targetCurrency);
      return {
        rate: convertedRate,
        currency: targetCurrency,
        source: 'real_time_conversion'
      };
    }

    throw new Error('Invalid rate object format');

  } catch (error) {
    logger.error('Failed to get rate in currency', {
      targetCurrency,
      roomType,
      error: error.message
    });
    throw error;
  }
}

/**
 * Validate currency code
 * @param {string} currencyCode - Currency code to validate
 * @returns {Promise<boolean>} True if valid and active
 */
export async function validateCurrencyCode(currencyCode) {
  try {
    const currency = await Currency.getCurrencyByCode(currencyCode);
    return !!currency;
  } catch (error) {
    logger.error('Currency validation failed', { currencyCode, error: error.message });
    return false;
  }
}

/**
 * Get currencies supported by specific OTA channel
 * @param {string} channel - Channel name
 * @returns {Promise<Array>} Array of supported currencies
 */
export async function getChannelSupportedCurrencies(channel) {
  try {
    return await Currency.getCurrenciesByChannel(channel);
  } catch (error) {
    logger.error('Failed to get channel supported currencies', {
      channel,
      error: error.message
    });
    throw error;
  }
}

/**
 * Format price range with currency
 * @param {number} minPrice - Minimum price
 * @param {number} maxPrice - Maximum price
 * @param {string} currencyCode - Currency code
 * @param {Object} options - Formatting options
 * @returns {Promise<string>} Formatted price range
 */
export async function formatPriceRange(minPrice, maxPrice, currencyCode, options = {}) {
  try {
    const [formattedMin, formattedMax] = await Promise.all([
      formatCurrency(minPrice, currencyCode, options),
      formatCurrency(maxPrice, currencyCode, options)
    ]);

    if (minPrice === maxPrice) {
      return formattedMin;
    }

    return `${formattedMin} - ${formattedMax}`;
  } catch (error) {
    logger.error('Price range formatting failed', {
      minPrice,
      maxPrice,
      currencyCode,
      error: error.message
    });
    return `${currencyCode} ${minPrice} - ${maxPrice}`;
  }
}

/**
 * Calculate total price with taxes in specific currency
 * @param {number} basePrice - Base price
 * @param {Object} taxes - Tax configuration
 * @param {string} currencyCode - Currency code
 * @returns {Promise<Object>} Price breakdown with totals
 */
export async function calculateTotalPriceInCurrency(basePrice, taxes = {}, currencyCode) {
  try {
    const {
      vatRate = 0,
      cityTaxRate = 0,
      serviceFeeRate = 0
    } = taxes;

    const vatAmount = basePrice * (vatRate / 100);
    const cityTaxAmount = basePrice * (cityTaxRate / 100);
    const serviceFeeAmount = basePrice * (serviceFeeRate / 100);
    const totalTaxes = vatAmount + cityTaxAmount + serviceFeeAmount;
    const totalPrice = basePrice + totalTaxes;

    return {
      basePrice,
      taxes: {
        vat: vatAmount,
        cityTax: cityTaxAmount,
        serviceFee: serviceFeeAmount,
        total: totalTaxes
      },
      totalPrice,
      currency: currencyCode,
      formatted: {
        basePrice: await formatCurrency(basePrice, currencyCode),
        totalTaxes: await formatCurrency(totalTaxes, currencyCode),
        totalPrice: await formatCurrency(totalPrice, currencyCode)
      }
    };
  } catch (error) {
    logger.error('Total price calculation failed', {
      basePrice,
      taxes,
      currencyCode,
      error: error.message
    });
    throw error;
  }
}

/**
 * Batch convert multiple amounts to target currency
 * @param {Array} amounts - Array of {amount, fromCurrency} objects
 * @param {string} toCurrency - Target currency
 * @returns {Promise<Array>} Array of conversion results
 */
export async function batchConvertCurrency(amounts, toCurrency) {
  try {
    const results = [];

    for (const { amount, fromCurrency, identifier } of amounts) {
      try {
        const convertedAmount = await convertCurrency(amount, fromCurrency, toCurrency);
        results.push({
          identifier,
          originalAmount: amount,
          originalCurrency: fromCurrency,
          convertedAmount,
          targetCurrency: toCurrency,
          success: true
        });
      } catch (conversionError) {
        results.push({
          identifier,
          originalAmount: amount,
          originalCurrency: fromCurrency,
          targetCurrency: toCurrency,
          success: false,
          error: conversionError.message
        });
      }
    }

    return results;
  } catch (error) {
    logger.error('Batch currency conversion failed', { error: error.message });
    throw error;
  }
}

export default {
  convertCurrency,
  formatCurrency,
  getActiveCurrencies,
  getBaseCurrency,
  convertRateToMultipleCurrencies,
  updateRatePlanCurrencyRates,
  updateRateOverrideCurrencyRates,
  getRateInCurrency,
  validateCurrencyCode,
  getChannelSupportedCurrencies,
  formatPriceRange,
  calculateTotalPriceInCurrency,
  batchConvertCurrency
};