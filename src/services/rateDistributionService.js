import ChannelConfiguration from '../models/ChannelConfiguration.js';
import { RatePlan, DynamicPricing } from '../models/RateManagement.js';
import Currency from '../models/Currency.js';
import exchangeRateService from './exchangeRateService.js';
import logger from '../utils/logger.js';

class RateDistributionService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
    this.exchangeRateCache = new Map();
    this.exchangeRateCacheTimeout = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Distribute rates to all configured channels for a hotel
   */
  async distributeRates(hotelId, rateData) {
    try {
      logger.info(`Starting rate distribution for hotel ${hotelId}`);

      // Get all active channel configurations
      const channelConfigs = await ChannelConfiguration.getActiveChannelsForHotel(hotelId);
      
      if (!channelConfigs.length) {
        logger.warn(`No active channels found for hotel ${hotelId}`);
        return { success: true, channels: [], message: 'No active channels' };
      }

      const distributionResults = [];

      // Process each channel
      for (const config of channelConfigs) {
        try {
          const result = await this.distributeToChannel(config, rateData);
          distributionResults.push({
            channelId: config.channelId,
            channelName: config.channelName,
            success: result.success,
            processedRates: result.processedRates,
            errors: result.errors || []
          });
        } catch (error) {
          logger.error(`Failed to distribute rates to ${config.channelId}:`, error);
          distributionResults.push({
            channelId: config.channelId,
            channelName: config.channelName,
            success: false,
            errors: [error.message]
          });
        }
      }

      const successCount = distributionResults.filter(r => r.success).length;
      
      return {
        success: successCount > 0,
        totalChannels: channelConfigs.length,
        successfulChannels: successCount,
        channels: distributionResults
      };

    } catch (error) {
      logger.error('Rate distribution failed:', error);
      throw error;
    }
  }

  /**
   * Distribute rates to a specific channel with currency conversion
   */
  async distributeToChannel(channelConfig, rateData) {
    try {
      const processedRates = [];
      const errors = [];

      // Get base currency rates
      const baseRates = Array.isArray(rateData) ? rateData : [rateData];

      for (const rate of baseRates) {
        try {
          // Convert rates to all supported currencies for this channel
          const convertedRates = await this.convertRateForChannel(rate, channelConfig);
          processedRates.push(...convertedRates);
        } catch (error) {
          errors.push(`Failed to convert rate ${rate.id}: ${error.message}`);
        }
      }

      // Send rates to channel
      if (processedRates.length > 0) {
        await this.sendRatesToChannel(channelConfig, processedRates);
        
        // Update channel sync stats
        await channelConfig.updateSyncStats(true);
      }

      return {
        success: errors.length === 0,
        processedRates: processedRates.length,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      await channelConfig.updateSyncStats(false, error);
      throw error;
    }
  }

  /**
   * Convert a rate to all supported currencies for a channel
   */
  async convertRateForChannel(rate, channelConfig) {
    const convertedRates = [];
    const baseCurrency = rate.currency || channelConfig.currencySettings.baseCurrency;

    // Process each supported currency
    for (const currencyConfig of channelConfig.activeSupportedCurrencies) {
      try {
        const convertedRate = await this.convertRate(
          rate,
          baseCurrency,
          currencyConfig.currencyCode,
          currencyConfig,
          channelConfig.channelId
        );

        convertedRates.push(convertedRate);
      } catch (error) {
        logger.warn(`Failed to convert rate to ${currencyConfig.currencyCode}:`, error);
      }
    }

    return convertedRates;
  }

  /**
   * Convert a single rate between currencies with channel-specific settings
   */
  async convertRate(rate, fromCurrency, toCurrency, currencyConfig, channelId) {
    if (fromCurrency === toCurrency) {
      return {
        ...rate,
        currency: toCurrency,
        originalCurrency: fromCurrency,
        conversionRate: 1,
        markup: 0,
        channelId
      };
    }

    // Get exchange rate
    const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency, currencyConfig);

    // Apply conversion
    let convertedAmount = rate.baseRate * exchangeRate;

    // Apply channel markup
    if (currencyConfig.markup && currencyConfig.markup !== 0) {
      convertedAmount *= (1 + currencyConfig.markup / 100);
    }

    // Apply rounding
    convertedAmount = this.applyRounding(convertedAmount, currencyConfig.rounding);

    return {
      ...rate,
      baseRate: convertedAmount,
      currency: toCurrency,
      channelCurrency: currencyConfig.channelCurrencyCode || toCurrency,
      originalCurrency: fromCurrency,
      originalAmount: rate.baseRate,
      conversionRate: exchangeRate,
      markup: currencyConfig.markup || 0,
      convertedAt: new Date(),
      channelId
    };
  }

  /**
   * Get exchange rate with caching
   */
  async getExchangeRate(fromCurrency, toCurrency, currencyConfig) {
    const cacheKey = `${fromCurrency}-${toCurrency}`;
    const cached = this.exchangeRateCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.exchangeRateCacheTimeout) {
      return cached.rate;
    }

    let rate;

    switch (currencyConfig.conversionMethod) {
      case 'fixed_rate':
        rate = currencyConfig.fixedRate;
        if (!rate) {
          throw new Error(`Fixed rate not configured for ${toCurrency}`);
        }
        break;

      case 'daily_rate':
        rate = await this.getDailyRate(fromCurrency, toCurrency);
        break;

      case 'live_rate':
      default:
        rate = await exchangeRateService.getExchangeRate(fromCurrency, toCurrency);
        break;
    }

    if (!rate || rate <= 0) {
      throw new Error(`Invalid exchange rate for ${fromCurrency} to ${toCurrency}`);
    }

    // Cache the rate
    this.exchangeRateCache.set(cacheKey, {
      rate,
      timestamp: Date.now()
    });

    return rate;
  }

  /**
   * Get daily cached exchange rate
   */
  async getDailyRate(fromCurrency, toCurrency) {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `daily-${fromCurrency}-${toCurrency}-${today}`;
    
    let rate = this.cache.get(cacheKey);
    
    if (!rate) {
      rate = await exchangeRateService.getExchangeRate(fromCurrency, toCurrency);
      this.cache.set(cacheKey, rate);
    }

    return rate;
  }

  /**
   * Apply rounding rules to converted amounts
   */
  applyRounding(amount, roundingMethod) {
    switch (roundingMethod) {
      case 'up':
        return Math.ceil(amount);
      case 'down':
        return Math.floor(amount);
      case 'nearest':
        return Math.round(amount * 100) / 100;
      case 'none':
      default:
        return Number(amount.toFixed(2));
    }
  }

  /**
   * Send converted rates to channel API
   */
  async sendRatesToChannel(channelConfig, rates) {
    const channelId = channelConfig.channelId;
    
    try {
      switch (channelId) {
        case 'booking_com':
          return await this.sendToBookingCom(channelConfig, rates);
        case 'expedia':
          return await this.sendToExpedia(channelConfig, rates);
        case 'airbnb':
          return await this.sendToAirbnb(channelConfig, rates);
        case 'agoda':
          return await this.sendToAgoda(channelConfig, rates);
        default:
          return await this.sendToGenericChannel(channelConfig, rates);
      }
    } catch (error) {
      logger.error(`Failed to send rates to ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Send rates to Booking.com
   */
  async sendToBookingCom(channelConfig, rates) {
    const endpoint = channelConfig.integrationSettings.endpoints.rates;
    const credentials = channelConfig.integrationSettings.apiCredentials;

    // Group rates by date and room type
    const groupedRates = this.groupRatesByDateAndRoom(rates);

    const payload = {
      hotel_id: credentials.hotelCode,
      rates: Object.entries(groupedRates).map(([key, rateGroup]) => {
        const [date, roomType] = key.split('|');
        return {
          date,
          room_type: roomType,
          rates: rateGroup.map(rate => ({
            rate_plan: rate.ratePlanId,
            currency: rate.channelCurrency || rate.currency,
            amount: rate.baseRate,
            occupancy: rate.occupancy || 2
          }))
        };
      })
    };

    return await this.makeChannelRequest(endpoint, payload, channelConfig);
  }

  /**
   * Send rates to Expedia
   */
  async sendToExpedia(channelConfig, rates) {
    const endpoint = channelConfig.integrationSettings.endpoints.rates;
    
    const payload = {
      propertyId: channelConfig.integrationSettings.apiCredentials.propertyId,
      rateUpdates: rates.map(rate => ({
        date: rate.date,
        roomTypeId: rate.roomTypeId,
        ratePlanId: rate.ratePlanId,
        currency: rate.channelCurrency || rate.currency,
        baseRate: rate.baseRate,
        taxesAndFees: rate.taxesAndFees || 0
      }))
    };

    return await this.makeChannelRequest(endpoint, payload, channelConfig);
  }

  /**
   * Send rates to Airbnb
   */
  async sendToAirbnb(channelConfig, rates) {
    const endpoint = channelConfig.integrationSettings.endpoints.rates;
    
    // Airbnb uses a different rate structure
    const payload = {
      listingId: channelConfig.integrationSettings.apiCredentials.propertyId,
      calendar: rates.map(rate => ({
        date: rate.date,
        available: rate.available !== false,
        price: {
          amount: Math.round(rate.baseRate),
          currency: rate.channelCurrency || rate.currency
        }
      }))
    };

    return await this.makeChannelRequest(endpoint, payload, channelConfig);
  }

  /**
   * Send rates to Agoda
   */
  async sendToAgoda(channelConfig, rates) {
    const endpoint = channelConfig.integrationSettings.endpoints.rates;
    
    const payload = {
      HotelCode: channelConfig.integrationSettings.apiCredentials.hotelCode,
      RateUpdates: rates.map(rate => ({
        Date: rate.date,
        RoomTypeCode: rate.roomTypeId,
        RatePlanCode: rate.ratePlanId,
        Currency: rate.channelCurrency || rate.currency,
        Rate: rate.baseRate,
        ExtraPersonRate: rate.extraPersonRate || 0
      }))
    };

    return await this.makeChannelRequest(endpoint, payload, channelConfig);
  }

  /**
   * Send rates to generic channel
   */
  async sendToGenericChannel(channelConfig, rates) {
    const endpoint = channelConfig.integrationSettings.endpoints.rates;
    
    const payload = {
      hotelId: channelConfig.integrationSettings.apiCredentials.hotelCode,
      rates: rates
    };

    return await this.makeChannelRequest(endpoint, payload, channelConfig);
  }

  /**
   * Make HTTP request to channel API
   */
  async makeChannelRequest(endpoint, payload, channelConfig) {
    if (!endpoint) {
      throw new Error(`No endpoint configured for ${channelConfig.channelId}`);
    }

    const credentials = channelConfig.integrationSettings.apiCredentials;
    const timeout = channelConfig.integrationSettings.timeout;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.buildAuthHeader(credentials, channelConfig.channelId),
          'User-Agent': 'Hotel-Management-System/1.0'
        },
        body: JSON.stringify(payload),
        timeout: timeout
      });

      if (!response.ok) {
        throw new Error(`Channel API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      logger.info(`Successfully sent rates to ${channelConfig.channelId}`, {
        rateCount: Array.isArray(payload.rates) ? payload.rates.length : payload.rateUpdates?.length || 0,
        channelResponse: result
      });

      return result;

    } catch (error) {
      logger.error(`Channel request failed for ${channelConfig.channelId}:`, error);
      throw error;
    }
  }

  /**
   * Build authentication header for channel
   */
  buildAuthHeader(credentials, channelId) {
    switch (channelId) {
      case 'booking_com':
        return `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`;
      case 'expedia':
        return `Bearer ${credentials.apiKey}`;
      case 'airbnb':
        return `Bearer ${credentials.apiKey}`;
      case 'agoda':
        return `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`;
      default:
        return credentials.apiKey ? `Bearer ${credentials.apiKey}` : 
               `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`;
    }
  }

  /**
   * Group rates by date and room type for efficient processing
   */
  groupRatesByDateAndRoom(rates) {
    const grouped = {};
    
    for (const rate of rates) {
      const key = `${rate.date}|${rate.roomTypeId || rate.roomType}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(rate);
    }
    
    return grouped;
  }

  /**
   * Get rate distribution status for a hotel
   */
  async getDistributionStatus(hotelId) {
    try {
      const channelConfigs = await ChannelConfiguration.getActiveChannelsForHotel(hotelId);
      
      const status = {
        totalChannels: channelConfigs.length,
        connectedChannels: 0,
        lastSyncTimes: {},
        syncHealth: {},
        currencySupport: {},
        errors: []
      };

      for (const config of channelConfigs) {
        if (config.status.connectionStatus === 'connected') {
          status.connectedChannels++;
        }

        status.lastSyncTimes[config.channelId] = {
          rates: config.status.lastSync.rates,
          inventory: config.status.lastSync.inventory,
          content: config.status.lastSync.content
        };

        status.syncHealth[config.channelId] = config.syncHealthScore;

        status.currencySupport[config.channelId] = config.activeSupportedCurrencies.map(curr => curr.currencyCode);

        if (config.status.syncStats.lastError) {
          status.errors.push({
            channel: config.channelId,
            error: config.status.syncStats.lastError.message,
            timestamp: config.status.syncStats.lastError.timestamp
          });
        }
      }

      return status;

    } catch (error) {
      logger.error('Failed to get distribution status:', error);
      throw error;
    }
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.cache.clear();
    this.exchangeRateCache.clear();
    logger.info('Rate distribution cache cleared');
  }
}

export default new RateDistributionService();