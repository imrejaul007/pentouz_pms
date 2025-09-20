import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import exchangeRateService from './exchangeRateService.js';
import revenueManagementService from './revenueManagementService.js';
import { getRedisClient } from '../config/redis.js';
import RoomType from '../models/RoomType.js';

class LocalizedPricingService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 15 * 60 * 1000; // 15 minutes
    this.priceAdjustmentFactors = {
      seasonality: { low: 0.8, medium: 1.0, high: 1.3, peak: 1.6 },
      demand: { low: 0.85, medium: 1.0, high: 1.25, veryHigh: 1.5 },
      competition: { below: 1.1, at: 1.0, above: 0.9 },
      occupancy: { low: 0.9, medium: 1.0, high: 1.15, full: 1.3 }
    };
  }

  // Generate localized pricing strategy for specific market
  async generatePricingStrategy(hotelId, options = {}) {
    try {
      const {
        market = 'default',
        currency = 'USD',
        dateRange,
        roomTypeId,
        channelIds = [],
        competitorData = null,
        localEvents = []
      } = options;

      const cacheKey = `pricing_strategy:${hotelId}:${market}:${currency}`;
      const cached = await this.getCachedStrategy(cacheKey);
      
      if (cached && !options.force) {
        return cached;
      }

      // Get base room rates and historical data
      const baseRates = await this.getBaseRates(hotelId, roomTypeId);
      const marketConditions = await this.analyzeMarketConditions(hotelId, market, dateRange);
      const competitorAnalysis = await this.analyzeCompetitors(hotelId, market, competitorData);
      const demandForecast = await this.forecastDemand(hotelId, dateRange, localEvents);

      // Generate currency-specific pricing
      const localizedPrices = await this.calculateLocalizedPrices({
        baseRates,
        marketConditions,
        competitorAnalysis,
        demandForecast,
        currency,
        market,
        channelIds
      });

      const strategy = {
        hotelId,
        market,
        currency,
        generatedAt: new Date(),
        validUntil: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
        pricing: localizedPrices,
        marketInsights: {
          conditions: marketConditions,
          competition: competitorAnalysis,
          demand: demandForecast
        },
        recommendations: await this.generateRecommendations(localizedPrices, marketConditions),
        channelOptimization: await this.optimizeForChannels(localizedPrices, channelIds),
        riskAssessment: this.assessPricingRisk(localizedPrices, marketConditions)
      };

      // Cache the strategy
      await this.cacheStrategy(cacheKey, strategy);
      
      logger.info(`Generated localized pricing strategy for hotel ${hotelId} in ${market} market`);
      return strategy;

    } catch (error) {
      logger.error('Error generating localized pricing strategy:', error);
      throw new Error(`Failed to generate pricing strategy: ${error.message}`);
    }
  }

  // Calculate prices with local market adjustments
  async calculateLocalizedPrices(params) {
    const {
      baseRates,
      marketConditions,
      competitorAnalysis,
      demandForecast,
      currency,
      market,
      channelIds
    } = params;

    const localizedPrices = new Map();

    for (const [roomTypeId, baseRate] of Object.entries(baseRates)) {
      // Apply market-specific adjustments
      let adjustedRate = baseRate;

      // Seasonality adjustment
      if (marketConditions.seasonality) {
        const seasonalFactor = this.priceAdjustmentFactors.seasonality[marketConditions.seasonality.level] || 1.0;
        adjustedRate *= seasonalFactor;
      }

      // Demand adjustment
      if (demandForecast.level) {
        const demandFactor = this.priceAdjustmentFactors.demand[demandForecast.level] || 1.0;
        adjustedRate *= demandFactor;
      }

      // Competition adjustment
      if (competitorAnalysis.position) {
        const compFactor = this.priceAdjustmentFactors.competition[competitorAnalysis.position] || 1.0;
        adjustedRate *= compFactor;
      }

      // Occupancy-based adjustment
      if (marketConditions.occupancyTrend) {
        const occFactor = this.priceAdjustmentFactors.occupancy[marketConditions.occupancyTrend] || 1.0;
        adjustedRate *= occFactor;
      }

      // Local market premium/discount
      if (marketConditions.marketPremium) {
        adjustedRate *= (1 + marketConditions.marketPremium / 100);
      }

      // Currency conversion and local purchasing power adjustment
      const convertedRate = await this.convertWithPurchasingPower(adjustedRate, currency, market);

      // Channel-specific pricing
      const channelPrices = await this.calculateChannelPricing(convertedRate, channelIds, market);

      localizedPrices.set(roomTypeId, {
        baseRate,
        adjustedRate,
        convertedRate,
        channelPrices,
        adjustmentFactors: {
          seasonality: marketConditions.seasonality?.level,
          demand: demandForecast.level,
          competition: competitorAnalysis.position,
          occupancy: marketConditions.occupancyTrend,
          marketPremium: marketConditions.marketPremium
        },
        confidence: this.calculateConfidence(marketConditions, competitorAnalysis, demandForecast)
      });
    }

    return Object.fromEntries(localizedPrices);
  }

  // Convert rates with purchasing power parity adjustment
  async convertWithPurchasingPower(baseRate, targetCurrency, market) {
    try {
      // Get exchange rate
      const exchangeRate = await exchangeRateService.getRate('USD', targetCurrency);
      let convertedRate = baseRate * exchangeRate;

      // Apply purchasing power parity adjustment
      const pppAdjustment = await this.getPurchasingPowerAdjustment(market, targetCurrency);
      convertedRate *= pppAdjustment;

      // Apply local tax considerations
      const taxAdjustment = await this.getLocalTaxAdjustment(market, targetCurrency);
      convertedRate *= taxAdjustment;

      return Math.round(convertedRate * 100) / 100; // Round to 2 decimal places

    } catch (error) {
      logger.error('Error converting rate with purchasing power:', error);
      return baseRate; // Fallback to base rate
    }
  }

  // Get purchasing power adjustment factor for market
  async getPurchasingPowerAdjustment(market, currency) {
    const pppFactors = {
      'US': 1.0,
      'EU': 0.95,
      'UK': 1.1,
      'JP': 1.05,
      'CN': 0.65,
      'IN': 0.45,
      'BR': 0.55,
      'AU': 1.15,
      'CA': 0.92,
      'MX': 0.48
    };

    return pppFactors[market] || 1.0;
  }

  // Get local tax adjustment factor
  async getLocalTaxAdjustment(market, currency) {
    const taxFactors = {
      'US': 1.0,
      'EU': 1.12, // Higher VAT rates
      'UK': 1.10,
      'JP': 1.08,
      'CN': 1.06,
      'IN': 1.18, // Higher GST
      'BR': 1.15,
      'AU': 1.10,
      'CA': 1.08,
      'MX': 1.16
    };

    return taxFactors[market] || 1.0;
  }

  // Calculate channel-specific pricing
  async calculateChannelPricing(baseRate, channelIds, market) {
    const channelPrices = new Map();

    // Default channel markups by market
    const channelMarkups = {
      booking_com: { US: 0.05, EU: 0.08, default: 0.06 },
      expedia: { US: 0.04, EU: 0.07, default: 0.05 },
      agoda: { CN: 0.03, default: 0.06 },
      airbnb: { US: 0.08, EU: 0.10, default: 0.09 },
      direct: { default: 0.0 } // No markup for direct bookings
    };

    for (const channelId of channelIds) {
      const markup = channelMarkups[channelId]?.[market] || channelMarkups[channelId]?.default || 0.05;
      const channelRate = baseRate * (1 + markup);
      
      channelPrices.set(channelId, {
        rate: Math.round(channelRate * 100) / 100,
        markup: markup * 100,
        commission: this.getChannelCommission(channelId, market)
      });
    }

    return Object.fromEntries(channelPrices);
  }

  // Get channel commission rates by market
  getChannelCommission(channelId, market) {
    const commissions = {
      booking_com: { US: 15, EU: 18, default: 16 },
      expedia: { US: 14, EU: 17, default: 15 },
      agoda: { CN: 12, default: 16 },
      airbnb: { US: 3, EU: 3, default: 3 },
      direct: { default: 0 }
    };

    return commissions[channelId]?.[market] || commissions[channelId]?.default || 15;
  }

  // Analyze current market conditions
  async analyzeMarketConditions(hotelId, market, dateRange) {
    try {
      // This would typically query external market data sources
      // For now, returning simulated market conditions
      const conditions = {
        seasonality: await this.getSeasonalityData(market, dateRange),
        occupancyTrend: await this.getOccupancyTrend(hotelId, market),
        marketPremium: await this.getMarketPremium(market),
        economicIndicators: await this.getEconomicIndicators(market),
        localEvents: await this.getLocalEvents(market, dateRange),
        touristSeason: await this.getTouristSeasonInfo(market, dateRange)
      };

      return conditions;

    } catch (error) {
      logger.error('Error analyzing market conditions:', error);
      return this.getDefaultMarketConditions();
    }
  }

  // Forecast demand for specific period
  async forecastDemand(hotelId, dateRange, localEvents = []) {
    try {
      // Get historical booking data
      const historicalData = await revenueManagementService.getHistoricalData(hotelId, {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
        endDate: new Date()
      });

      // Apply time series forecasting (simplified)
      const baselineDemand = this.calculateBaselineDemand(historicalData);
      const eventAdjustment = this.calculateEventImpact(localEvents);
      const seasonalAdjustment = this.calculateSeasonalAdjustment(dateRange);

      const forecast = {
        level: this.categorizeDemandLevel(baselineDemand * eventAdjustment * seasonalAdjustment),
        confidence: this.calculateForecastConfidence(historicalData),
        factors: {
          baseline: baselineDemand,
          events: eventAdjustment,
          seasonal: seasonalAdjustment
        },
        recommendations: this.generateDemandRecommendations(baselineDemand, eventAdjustment)
      };

      return forecast;

    } catch (error) {
      logger.error('Error forecasting demand:', error);
      return { level: 'medium', confidence: 0.5 };
    }
  }

  // Calculate baseline demand from historical data
  calculateBaselineDemand(historicalData) {
    if (!historicalData || historicalData.length === 0) return 1.0;

    const averageOccupancy = historicalData.reduce((sum, data) => 
      sum + (data.occupancyRate || 0), 0) / historicalData.length;
    
    // Convert occupancy percentage to demand multiplier
    return Math.max(0.5, Math.min(1.5, averageOccupancy / 70)); // Normalize around 70% occupancy
  }

  // Calculate impact of local events on demand
  calculateEventImpact(localEvents) {
    if (!localEvents || localEvents.length === 0) return 1.0;

    let impactMultiplier = 1.0;
    
    for (const event of localEvents) {
      switch (event.type) {
        case 'conference':
        case 'convention':
          impactMultiplier *= 1.3;
          break;
        case 'festival':
        case 'concert':
          impactMultiplier *= 1.2;
          break;
        case 'sports_event':
          impactMultiplier *= 1.25;
          break;
        case 'holiday':
          impactMultiplier *= 1.15;
          break;
        default:
          impactMultiplier *= 1.05;
      }
    }

    return Math.min(impactMultiplier, 2.0); // Cap at 2x increase
  }

  // Generate pricing recommendations
  async generateRecommendations(localizedPrices, marketConditions) {
    const recommendations = [];

    for (const [roomTypeId, pricing] of Object.entries(localizedPrices)) {
      if (pricing.confidence < 0.6) {
        recommendations.push({
          type: 'low_confidence',
          roomTypeId,
          message: 'Consider manual review due to low confidence in market data',
          priority: 'medium'
        });
      }

      if (marketConditions.seasonality?.level === 'peak') {
        recommendations.push({
          type: 'seasonal_opportunity',
          roomTypeId,
          message: 'Peak season detected - consider premium pricing strategy',
          priority: 'high',
          suggestedAdjustment: '+15%'
        });
      }

      // Check for significant price differences between channels
      const channelRates = Object.values(pricing.channelPrices || {}).map(cp => cp.rate);
      const maxRate = Math.max(...channelRates);
      const minRate = Math.min(...channelRates);
      
      if (maxRate / minRate > 1.2) {
        recommendations.push({
          type: 'channel_disparity',
          roomTypeId,
          message: 'Large price disparity across channels - review channel strategy',
          priority: 'medium'
        });
      }
    }

    return recommendations;
  }

  // Optimize pricing for specific channels
  async optimizeForChannels(localizedPrices, channelIds) {
    const optimization = {};

    for (const channelId of channelIds) {
      optimization[channelId] = {
        recommendedStrategy: await this.getChannelStrategy(channelId),
        competitivePosition: await this.analyzeChannelPosition(channelId),
        optimizations: await this.generateChannelOptimizations(channelId, localizedPrices)
      };
    }

    return optimization;
  }

  // Get cached pricing strategy
  async getCachedStrategy(cacheKey) {
    try {
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          return cached.data;
        }
        this.cache.delete(cacheKey);
      }

      // Try Redis cache
      const redisClient = getRedisClient();
      if (redisClient && redisClient.isReady) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting cached strategy:', error);
      return null;
    }
  }

  // Cache pricing strategy
  async cacheStrategy(cacheKey, strategy) {
    try {
      // Memory cache
      this.cache.set(cacheKey, {
        data: strategy,
        timestamp: Date.now()
      });

      // Redis cache
      const redisClient = getRedisClient();
      if (redisClient && redisClient.isReady) {
        await redisClient.setex(cacheKey, 900, JSON.stringify(strategy)); // 15 minutes
      }
    } catch (error) {
      logger.error('Error caching strategy:', error);
    }
  }

  // Helper methods for market analysis
  async getSeasonalityData(market, dateRange) {
    // Simplified seasonality detection
    const month = new Date().getMonth();
    const seasons = {
      spring: [2, 3, 4], // Mar-May
      summer: [5, 6, 7], // Jun-Aug
      fall: [8, 9, 10],  // Sep-Nov
      winter: [11, 0, 1] // Dec-Feb
    };

    for (const [season, months] of Object.entries(seasons)) {
      if (months.includes(month)) {
        return {
          season,
          level: this.getSeasonalLevel(season, market),
          trend: 'stable'
        };
      }
    }

    return { season: 'unknown', level: 'medium', trend: 'stable' };
  }

  getSeasonalLevel(season, market) {
    const seasonalLevels = {
      US: { spring: 'medium', summer: 'high', fall: 'medium', winter: 'low' },
      EU: { spring: 'high', summer: 'peak', fall: 'medium', winter: 'low' },
      default: { spring: 'medium', summer: 'high', fall: 'medium', winter: 'low' }
    };

    return seasonalLevels[market]?.[season] || seasonalLevels.default[season];
  }

  async getBaseRates(hotelId, roomTypeId) {
    try {
      // Query real room types and their base rates from database
      const query = { hotelId: new mongoose.Types.ObjectId(hotelId) };

      // If specific room type requested, filter by it
      if (roomTypeId) {
        query._id = new mongoose.Types.ObjectId(roomTypeId);
      }

      const roomTypes = await RoomType.find(query).select('code name baseRate baseCurrency');

      // Build rate map with room type codes as keys
      const rates = {};
      roomTypes.forEach(roomType => {
        const key = roomType.code.toLowerCase() || roomType.name.toLowerCase().replace(/\s+/g, '');
        rates[key] = roomType.baseRate || 0;
      });

      // If specific room type requested, return just that rate
      if (roomTypeId && roomTypes.length > 0) {
        return roomTypes[0].baseRate || 0;
      }

      // Return all rates if no specific room type requested
      if (Object.keys(rates).length === 0) {
        // Fallback to default rates if no room types found
        logger.warn(`No room types found for hotel ${hotelId}, using fallback rates`);
        return {
          'standard': 150.00,
          'deluxe': 200.00,
          'suite': 350.00
        };
      }

      return rates;
    } catch (error) {
      logger.error(`Error fetching base rates for hotel ${hotelId}:`, error);
      // Return fallback rates on error
      return {
        'standard': 150.00,
        'deluxe': 200.00,
        'suite': 350.00
      };
    }
  }

  categorizeDemandLevel(demandScore) {
    if (demandScore > 1.4) return 'veryHigh';
    if (demandScore > 1.1) return 'high';
    if (demandScore > 0.9) return 'medium';
    return 'low';
  }

  calculateConfidence(marketConditions, competitorAnalysis, demandForecast) {
    let confidence = 0.7; // Base confidence

    if (marketConditions.economicIndicators) confidence += 0.1;
    if (competitorAnalysis.dataQuality === 'high') confidence += 0.15;
    if (demandForecast.confidence > 0.8) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }

  // Additional helper methods would be implemented here
  async analyzeCompetitors(hotelId, market, competitorData) {
    return {
      position: 'at',
      dataQuality: 'medium',
      averageRate: 175.00,
      insights: []
    };
  }

  assessPricingRisk(localizedPrices, marketConditions) {
    return {
      level: 'medium',
      factors: ['market_volatility', 'competitor_response'],
      mitigation: ['monitor_closely', 'prepare_fallback_rates']
    };
  }

  getDefaultMarketConditions() {
    return {
      seasonality: { season: 'unknown', level: 'medium' },
      occupancyTrend: 'medium',
      marketPremium: 0
    };
  }
}

export default new LocalizedPricingService();