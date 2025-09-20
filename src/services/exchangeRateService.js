import Currency from '../models/Currency.js';
import logger from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';

/**
 * Exchange Rate Service
 * 
 * Handles real-time currency exchange rate fetching and management
 * Supports multiple providers with fallback mechanisms
 */
class ExchangeRateService {
  constructor() {
    this.providers = {
      exchangerate_api: {
        name: 'ExchangeRate API',
        url: 'https://api.exchangerate-api.com/v4/latest/',
        apiKey: process.env.EXCHANGERATE_API_KEY,
        rateLimit: 1500, // requests per month for free tier
        priority: 1
      },
      fixer: {
        name: 'Fixer.io',
        url: 'https://api.fixer.io/latest',
        apiKey: process.env.FIXER_API_KEY,
        rateLimit: 1000, // requests per month for free tier
        priority: 2
      },
      currencylayer: {
        name: 'CurrencyLayer',
        url: 'https://api.currencylayer.com/live',
        apiKey: process.env.CURRENCYLAYER_API_KEY,
        rateLimit: 1000, // requests per month for free tier
        priority: 3
      }
    };
    
    this.redis = null;
    this.cacheKeyPrefix = 'exchange_rates:';
    this.defaultCacheTTL = 3600; // 1 hour cache
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      this.redis = getRedisClient();
      logger.info('Exchange rate service initialized');
    } catch (error) {
      logger.warn('Redis not available for exchange rate caching', { error: error.message });
    }
  }

  /**
   * Fetch exchange rates for a specific base currency
   * @param {string} baseCurrency - Base currency code (default: USD)
   * @param {Array} targetCurrencies - Target currency codes
   * @param {string} preferredProvider - Preferred provider
   * @returns {Promise<Object>} Exchange rates object
   */
  async fetchExchangeRates(baseCurrency = 'USD', targetCurrencies = [], preferredProvider = 'exchangerate_api') {
    try {
      // Check cache first
      const cacheKey = `${this.cacheKeyPrefix}${baseCurrency}`;
      const cachedRates = await this.getCachedRates(cacheKey);
      
      if (cachedRates && this.isRatesFresh(cachedRates)) {
        logger.debug('Using cached exchange rates', { baseCurrency });
        return this.filterRates(cachedRates, targetCurrencies);
      }

      // Try preferred provider first
      let rates = await this.fetchFromProvider(preferredProvider, baseCurrency);
      
      // Fallback to other providers if preferred fails
      if (!rates) {
        const providers = Object.keys(this.providers)
          .filter(p => p !== preferredProvider)
          .sort((a, b) => this.providers[a].priority - this.providers[b].priority);
        
        for (const provider of providers) {
          try {
            rates = await this.fetchFromProvider(provider, baseCurrency);
            if (rates) {
              logger.info('Used fallback provider for exchange rates', { provider, baseCurrency });
              break;
            }
          } catch (error) {
            logger.warn('Provider failed', { provider, error: error.message });
            continue;
          }
        }
      }

      if (!rates) {
        throw new Error('All exchange rate providers failed');
      }

      // Cache the results
      await this.cacheRates(cacheKey, rates);

      return this.filterRates(rates, targetCurrencies);

    } catch (error) {
      logger.error('Failed to fetch exchange rates', { 
        baseCurrency, 
        targetCurrencies,
        error: error.message 
      });
      
      // Return cached rates even if stale as fallback
      const cacheKey = `${this.cacheKeyPrefix}${baseCurrency}`;
      const staleRates = await this.getCachedRates(cacheKey);
      if (staleRates) {
        logger.warn('Using stale cached rates as fallback', { baseCurrency });
        return this.filterRates(staleRates, targetCurrencies);
      }
      
      throw error;
    }
  }

  /**
   * Fetch rates from a specific provider
   * @param {string} provider - Provider name
   * @param {string} baseCurrency - Base currency
   * @returns {Promise<Object>} Exchange rates
   */
  async fetchFromProvider(provider, baseCurrency) {
    const config = this.providers[provider];
    if (!config) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    try {
      let url, headers = {};
      
      switch (provider) {
        case 'exchangerate_api':
          url = `${config.url}${baseCurrency}`;
          break;
          
        case 'fixer':
          url = `${config.url}?base=${baseCurrency}`;
          if (config.apiKey) {
            headers['X-API-Key'] = config.apiKey;
          }
          break;
          
        case 'currencylayer':
          url = `${config.url}?source=${baseCurrency}`;
          if (config.apiKey) {
            url += `&access_key=${config.apiKey}`;
          }
          break;
          
        default:
          throw new Error(`Provider ${provider} not implemented`);
      }

      logger.debug('Fetching exchange rates from provider', { provider, baseCurrency, url: url.replace(/access_key=[^&]+/, 'access_key=***') });

      const response = await fetch(url, {
        headers,
        timeout: 10000 // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Parse response based on provider format
      let rates;
      switch (provider) {
        case 'exchangerate_api':
          if (!data.rates) {
            throw new Error('Invalid response format');
          }
          rates = {
            base: data.base,
            rates: data.rates,
            timestamp: Date.now(),
            provider
          };
          break;
          
        case 'fixer':
          if (!data.rates) {
            throw new Error('Invalid response format');
          }
          rates = {
            base: data.base,
            rates: data.rates,
            timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
            provider
          };
          break;
          
        case 'currencylayer':
          if (!data.quotes) {
            throw new Error('Invalid response format');
          }
          // Convert CurrencyLayer format (USDEUR: 0.85) to standard format (EUR: 0.85)
          const convertedRates = {};
          Object.keys(data.quotes).forEach(key => {
            const currency = key.substring(baseCurrency.length);
            convertedRates[currency] = data.quotes[key];
          });
          rates = {
            base: baseCurrency,
            rates: convertedRates,
            timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
            provider
          };
          break;
      }

      logger.info('Successfully fetched exchange rates', { 
        provider, 
        baseCurrency, 
        ratesCount: Object.keys(rates.rates).length 
      });

      return rates;

    } catch (error) {
      logger.error('Provider request failed', { 
        provider, 
        baseCurrency, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Update all active currencies with latest exchange rates
   * @param {string} source - Update source identifier
   * @returns {Promise<Object>} Update results
   */
  async updateAllCurrencyRates(source = 'scheduled_update') {
    try {
      logger.info('Starting bulk currency rate update', { source });

      // Get base currency and all active currencies
      const [baseCurrency, activeCurrencies] = await Promise.all([
        Currency.getBaseCurrency(),
        Currency.getActiveCurrencies()
      ]);

      if (!baseCurrency) {
        throw new Error('No base currency configured');
      }

      const targetCurrencies = activeCurrencies
        .filter(c => !c.isBaseCurrency)
        .map(c => c.code);

      // Fetch latest rates
      const ratesData = await this.fetchExchangeRates(
        baseCurrency.code,
        targetCurrencies
      );

      const results = {
        updated: 0,
        failed: 0,
        errors: [],
        baseCurrency: baseCurrency.code,
        provider: ratesData.provider,
        timestamp: new Date()
      };

      // Update each currency
      for (const currency of activeCurrencies) {
        if (currency.isBaseCurrency) {
          continue; // Skip base currency
        }

        try {
          const newRate = ratesData.rates[currency.code];
          
          if (!newRate || newRate <= 0) {
            results.failed++;
            results.errors.push({
              currency: currency.code,
              error: 'Rate not available or invalid'
            });
            continue;
          }

          // Update currency rate
          await currency.updateExchangeRate(newRate, source);
          results.updated++;
          
          logger.debug('Updated currency rate', {
            currency: currency.code,
            oldRate: currency.exchangeRate,
            newRate,
            source
          });

        } catch (error) {
          results.failed++;
          results.errors.push({
            currency: currency.code,
            error: error.message
          });
          
          logger.error('Failed to update currency rate', {
            currency: currency.code,
            error: error.message
          });
        }
      }

      logger.info('Bulk currency rate update completed', {
        updated: results.updated,
        failed: results.failed,
        provider: results.provider,
        source
      });

      return results;

    } catch (error) {
      logger.error('Bulk currency rate update failed', { 
        source,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Update specific currency rate
   * @param {string} currencyCode - Currency code to update
   * @param {string} source - Update source
   * @returns {Promise<Object>} Update result
   */
  async updateCurrencyRate(currencyCode, source = 'manual') {
    try {
      const [currency, baseCurrency] = await Promise.all([
        Currency.getCurrencyByCode(currencyCode),
        Currency.getBaseCurrency()
      ]);

      if (!currency) {
        throw new Error(`Currency ${currencyCode} not found`);
      }

      if (!baseCurrency) {
        throw new Error('No base currency configured');
      }

      if (currency.isBaseCurrency) {
        throw new Error('Cannot update base currency rate');
      }

      // Fetch rate for specific currency
      const ratesData = await this.fetchExchangeRates(
        baseCurrency.code,
        [currencyCode]
      );

      const newRate = ratesData.rates[currencyCode];
      if (!newRate || newRate <= 0) {
        throw new Error(`Rate not available for ${currencyCode}`);
      }

      const oldRate = currency.exchangeRate;
      await currency.updateExchangeRate(newRate, source);

      logger.info('Currency rate updated', {
        currency: currencyCode,
        oldRate,
        newRate,
        change: ((newRate - oldRate) / oldRate * 100).toFixed(2) + '%',
        provider: ratesData.provider,
        source
      });

      return {
        currency: currencyCode,
        oldRate,
        newRate,
        provider: ratesData.provider,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Failed to update currency rate', {
        currency: currencyCode,
        source,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Convert amount between currencies
   * @param {number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code
   * @returns {Promise<Object>} Conversion result
   */
  async convertCurrency(amount, fromCurrency, toCurrency) {
    try {
      if (fromCurrency === toCurrency) {
        return {
          amount,
          convertedAmount: amount,
          fromCurrency,
          toCurrency,
          rate: 1.0,
          timestamp: new Date()
        };
      }

      const [fromCurrencyData, toCurrencyData] = await Promise.all([
        Currency.getCurrencyByCode(fromCurrency),
        Currency.getCurrencyByCode(toCurrency)
      ]);

      if (!fromCurrencyData) {
        throw new Error(`Currency ${fromCurrency} not found`);
      }
      if (!toCurrencyData) {
        throw new Error(`Currency ${toCurrency} not found`);
      }

      const convertedAmount = fromCurrencyData.convertTo(toCurrencyData, amount);
      const rate = toCurrencyData.exchangeRate / fromCurrencyData.exchangeRate;

      return {
        amount,
        convertedAmount,
        fromCurrency,
        toCurrency,
        rate: Number(rate.toFixed(6)),
        timestamp: new Date(),
        formattedAmount: toCurrencyData.formatAmount(convertedAmount)
      };

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
   * Get exchange rate between two currencies
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code
   * @returns {Promise<number>} Exchange rate
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    try {
      if (fromCurrency === toCurrency) {
        return 1.0;
      }

      const [fromCurrencyData, toCurrencyData] = await Promise.all([
        Currency.getCurrencyByCode(fromCurrency),
        Currency.getCurrencyByCode(toCurrency)
      ]);

      if (!fromCurrencyData) {
        throw new Error(`Currency ${fromCurrency} not found`);
      }

      if (!toCurrencyData) {
        throw new Error(`Currency ${toCurrency} not found`);
      }

      // Calculate rate using stored exchange rates (both relative to base currency)
      const rate = toCurrencyData.exchangeRate / fromCurrencyData.exchangeRate;
      return Number(rate.toFixed(6));

    } catch (error) {
      logger.error('Failed to get exchange rate', {
        fromCurrency,
        toCurrency,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get cached exchange rates
   * @param {string} cacheKey - Cache key
   * @returns {Promise<Object|null>} Cached rates or null
   */
  async getCachedRates(cacheKey) {
    if (!this.redis) return null;

    try {
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Failed to get cached rates', { error: error.message });
      return null;
    }
  }

  /**
   * Cache exchange rates
   * @param {string} cacheKey - Cache key
   * @param {Object} rates - Rates to cache
   */
  async cacheRates(cacheKey, rates) {
    if (!this.redis) return;

    try {
      await this.redis.setex(
        cacheKey,
        this.defaultCacheTTL,
        JSON.stringify(rates)
      );
    } catch (error) {
      logger.warn('Failed to cache rates', { error: error.message });
    }
  }

  /**
   * Check if cached rates are still fresh
   * @param {Object} rates - Cached rates object
   * @returns {boolean} True if fresh
   */
  isRatesFresh(rates) {
    if (!rates.timestamp) return false;
    
    const age = Date.now() - rates.timestamp;
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    return age < maxAge;
  }

  /**
   * Filter rates to only include target currencies
   * @param {Object} rates - All rates
   * @param {Array} targetCurrencies - Target currencies
   * @returns {Object} Filtered rates
   */
  filterRates(rates, targetCurrencies) {
    if (!targetCurrencies.length) return rates;

    const filteredRates = {};
    targetCurrencies.forEach(currency => {
      if (rates.rates[currency]) {
        filteredRates[currency] = rates.rates[currency];
      }
    });

    return {
      ...rates,
      rates: filteredRates
    };
  }

  /**
   * Get provider health status
   * @returns {Promise<Object>} Provider status
   */
  async getProviderHealthStatus() {
    const results = {};

    for (const [providerName, config] of Object.entries(this.providers)) {
      try {
        const startTime = Date.now();
        await this.fetchFromProvider(providerName, 'USD');
        const responseTime = Date.now() - startTime;

        results[providerName] = {
          status: 'healthy',
          responseTime,
          lastCheck: new Date()
        };
      } catch (error) {
        results[providerName] = {
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date()
        };
      }
    }

    return results;
  }
}

// Create singleton instance
const exchangeRateService = new ExchangeRateService();

export default exchangeRateService;