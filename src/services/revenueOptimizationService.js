import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import localizedPricingService from './localizedPricingService.js';
import regionalAnalyticsService from './regionalAnalyticsService.js';
import multiLanguageMetricsService from './multiLanguageMetricsService.js';
import exchangeRateService from './exchangeRateService.js';
import { getRedisClient } from '../config/redis.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';

class RevenueOptimizationService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 10 * 60 * 1000; // 10 minutes for real-time optimization
    this.optimizationStrategies = [
      'dynamic_pricing', 'channel_mix', 'length_of_stay', 'market_segment',
      'currency_hedging', 'demand_forecasting', 'competitive_positioning'
    ];
    this.mlModels = {
      demandForecast: null,
      priceOptimization: null,
      channelMix: null,
      segmentOptimization: null
    };
  }

  // Generate comprehensive revenue optimization strategy
  async generateOptimizationStrategy(hotelId, options = {}) {
    try {
      const {
        timeHorizon = '30d',
        targetMarkets = [],
        targetLanguages = [],
        optimizationGoals = ['revenue_maximization'],
        riskTolerance = 'medium',
        baseCurrency = 'USD',
        includeForecasting = true,
        includeSensitivityAnalysis = true
      } = options;

      const cacheKey = `revenue_optimization:${hotelId}:${timeHorizon}:${optimizationGoals.join(',')}`;
      const cached = await this.getCachedOptimization(cacheKey);
      
      if (cached && !options.force) {
        return cached;
      }

      // Gather comprehensive data for optimization
      const optimizationData = await this.gatherOptimizationData(hotelId, {
        timeHorizon,
        targetMarkets,
        targetLanguages,
        baseCurrency
      });

      const strategy = {
        hotelId,
        generatedAt: new Date(),
        timeHorizon,
        baseCurrency,
        optimizationGoals,
        riskTolerance,
        
        // Core optimization components
        pricingOptimization: await this.optimizePricing(hotelId, optimizationData, options),
        channelOptimization: await this.optimizeChannelMix(hotelId, optimizationData, options),
        segmentOptimization: await this.optimizeSegments(hotelId, optimizationData, options),
        marketOptimization: await this.optimizeMarkets(hotelId, optimizationData, options),
        languageOptimization: await this.optimizeLanguages(hotelId, optimizationData, options),
        
        // Advanced strategies
        dynamicStrategies: await this.generateDynamicStrategies(hotelId, optimizationData, options),
        riskManagement: await this.generateRiskManagement(hotelId, optimizationData, riskTolerance),
        
        // Performance projections
        projections: includeForecasting ? await this.generateProjections(hotelId, optimizationData, options) : null,
        sensitivity: includeSensitivityAnalysis ? await this.performSensitivityAnalysis(hotelId, optimizationData) : null,
        
        // Implementation roadmap
        implementation: await this.generateImplementationPlan(hotelId, optimizationData, options),
        
        // Monitoring and KPIs
        kpis: await this.defineOptimizationKPIs(optimizationGoals),
        alerts: await this.setupOptimizationAlerts(hotelId, optimizationData)
      };

      // Calculate expected impact
      strategy.expectedImpact = await this.calculateExpectedImpact(strategy, optimizationData);
      
      // Generate recommendations
      strategy.recommendations = await this.generateOptimizationRecommendations(strategy, optimizationData);

      // Cache the strategy
      await this.cacheOptimization(cacheKey, strategy);
      
      logger.info(`Generated revenue optimization strategy for hotel ${hotelId}`);
      return strategy;

    } catch (error) {
      logger.error('Error generating optimization strategy:', error);
      throw new Error(`Failed to generate optimization strategy: ${error.message}`);
    }
  }

  // Gather all necessary data for optimization
  async gatherOptimizationData(hotelId, options) {
    const { timeHorizon, targetMarkets, targetLanguages, baseCurrency } = options;

    try {
      const [
        historicalPerformance,
        regionalAnalysis,
        languageMetrics,
        marketConditions,
        competitorData,
        demandForecast
      ] = await Promise.all([
        this.getHistoricalPerformance(hotelId, timeHorizon),
        targetMarkets.length > 0 ? 
          regionalAnalyticsService.generateRegionalAnalysis(hotelId, { regions: targetMarkets }) : 
          null,
        targetLanguages.length > 0 ? 
          multiLanguageMetricsService.generateLanguageMetrics(hotelId, { languages: targetLanguages }) : 
          null,
        this.getMarketConditions(hotelId, baseCurrency),
        this.getCompetitorData(hotelId),
        this.generateDemandForecast(hotelId, timeHorizon)
      ]);

      return {
        historical: historicalPerformance,
        regional: regionalAnalysis,
        language: languageMetrics,
        market: marketConditions,
        competitors: competitorData,
        demand: demandForecast,
        currentPricing: await this.getCurrentPricing(hotelId),
        channelPerformance: await this.getChannelPerformance(hotelId, timeHorizon),
        segmentPerformance: await this.getSegmentPerformance(hotelId, timeHorizon)
      };

    } catch (error) {
      logger.error('Error gathering optimization data:', error);
      throw error;
    }
  }

  // Optimize pricing strategies
  async optimizePricing(hotelId, data, options) {
    const pricingOptimization = {
      currentStrategy: data.currentPricing?.strategy || 'fixed',
      recommendedStrategy: 'dynamic',
      
      // Dynamic pricing recommendations
      dynamicPricing: {
        enabled: true,
        factors: [
          'demand_forecast',
          'competitor_rates',
          'market_conditions',
          'booking_pace',
          'length_of_stay',
          'advance_booking'
        ],
        adjustmentRules: await this.generatePricingRules(data),
        priceFloors: await this.calculatePriceFloors(hotelId, data),
        priceCeilings: await this.calculatePriceCeilings(hotelId, data),
        optimalPricePoints: await this.calculateOptimalPrices(hotelId, data)
      },
      
      // Currency-specific pricing
      currencyOptimization: await this.optimizeCurrencyPricing(hotelId, data, options),
      
      // Market-specific pricing
      marketSpecificPricing: await this.generateMarketPricing(hotelId, data),
      
      // Seasonal pricing strategy
      seasonalStrategy: await this.optimizeSeasonalPricing(hotelId, data),
      
      // Length of stay optimization
      lengthOfStayPricing: await this.optimizeLengthOfStayPricing(hotelId, data),
      
      // Expected impact
      expectedImpact: {
        revenueIncrease: await this.calculatePricingImpact(data, 'revenue'),
        occupancyImpact: await this.calculatePricingImpact(data, 'occupancy'),
        competitivePosition: await this.calculateCompetitiveImpact(data)
      }
    };

    return pricingOptimization;
  }

  // Optimize channel mix strategy
  async optimizeChannelMix(hotelId, data, options) {
    const channelOptimization = {
      currentMix: data.channelPerformance?.currentDistribution || {},
      recommendedMix: {},
      
      // Channel performance analysis
      channelAnalysis: await this.analyzeChannelPerformance(data.channelPerformance),
      
      // Optimal channel allocation
      optimalAllocation: await this.calculateOptimalChannelAllocation(data),
      
      // Channel-specific strategies
      channelStrategies: {
        direct: await this.optimizeDirectChannel(hotelId, data),
        ota: await this.optimizeOTAChannels(hotelId, data),
        corporate: await this.optimizeCorporateChannel(hotelId, data),
        group: await this.optimizeGroupChannel(hotelId, data)
      },
      
      // Commission optimization
      commissionOptimization: await this.optimizeCommissions(data),
      
      // Channel diversification strategy
      diversificationStrategy: await this.generateDiversificationStrategy(data),
      
      // Expected impact
      expectedImpact: {
        revenueIncrease: await this.calculateChannelImpact(data, 'revenue'),
        profitImprovement: await this.calculateChannelImpact(data, 'profit'),
        riskReduction: await this.calculateChannelRiskReduction(data)
      }
    };

    // Calculate recommended mix based on profitability and risk
    channelOptimization.recommendedMix = await this.calculateRecommendedChannelMix(
      channelOptimization.channelAnalysis,
      options.riskTolerance
    );

    return channelOptimization;
  }

  // Optimize market segments
  async optimizeSegments(hotelId, data, options) {
    const segmentOptimization = {
      currentSegmentation: data.segmentPerformance?.segments || {},
      
      // Segment profitability analysis
      profitabilityAnalysis: await this.analyzeSegmentProfitability(data.segmentPerformance),
      
      // Optimal segment mix
      optimalSegmentMix: await this.calculateOptimalSegmentMix(data),
      
      // Segment-specific strategies
      segmentStrategies: {
        corporate: await this.optimizeCorporateSegment(hotelId, data),
        leisure: await this.optimizeLeisureSegment(hotelId, data),
        group: await this.optimizeGroupSegment(hotelId, data),
        government: await this.optimizeGovernmentSegment(hotelId, data),
        mice: await this.optimizeMICESegment(hotelId, data)
      },
      
      // Customer lifetime value optimization
      clvOptimization: await this.optimizeCustomerLifetimeValue(data),
      
      // Segment pricing strategies
      segmentPricing: await this.optimizeSegmentPricing(data),
      
      // Expected impact
      expectedImpact: {
        revenueIncrease: await this.calculateSegmentImpact(data, 'revenue'),
        profitMarginImprovement: await this.calculateSegmentImpact(data, 'margin'),
        customerRetention: await this.calculateSegmentImpact(data, 'retention')
      }
    };

    return segmentOptimization;
  }

  // Generate dynamic optimization strategies
  async generateDynamicStrategies(hotelId, data, options) {
    return {
      realTimePricing: {
        enabled: true,
        updateFrequency: '15min',
        triggers: [
          'demand_spike',
          'competitor_change',
          'inventory_threshold',
          'booking_pace_change'
        ],
        automationLevel: options.riskTolerance === 'high' ? 'full' : 'semi',
        humanOverride: true
      },
      
      inventoryOptimization: {
        overbookingStrategy: await this.optimizeOverbooking(data),
        allotmentManagement: await this.optimizeAllotments(data),
        roomTypeOptimization: await this.optimizeRoomTypes(data),
        upgradeStrategy: await this.optimizeUpgrades(data)
      },
      
      demandManagement: {
        demandShaping: await this.generateDemandShaping(data),
        capacityOptimization: await this.optimizeCapacity(data),
        cancellationOptimization: await this.optimizeCancellations(data),
        noShowManagement: await this.optimizeNoShows(data)
      },
      
      competitiveStrategy: {
        competitorMonitoring: {
          frequency: 'hourly',
          priceMatchingRules: await this.generatePriceMatchingRules(data),
          competitiveAlerts: await this.setupCompetitiveAlerts(data)
        },
        marketPositioning: await this.optimizeMarketPositioning(data)
      }
    };
  }

  // Generate risk management strategies
  async generateRiskManagement(hotelId, data, riskTolerance) {
    const riskProfiles = {
      low: { maxPriceVariation: 10, maxChannelConcentration: 30 },
      medium: { maxPriceVariation: 20, maxChannelConcentration: 50 },
      high: { maxPriceVariation: 35, maxChannelConcentration: 70 }
    };

    const profile = riskProfiles[riskTolerance] || riskProfiles.medium;

    return {
      riskProfile: profile,
      
      // Price volatility management
      priceRiskManagement: {
        maxDailyVariation: profile.maxPriceVariation,
        gradualAdjustmentRules: await this.generateGradualAdjustmentRules(profile),
        priceFloors: await this.calculateRiskAdjustedFloors(data, riskTolerance),
        volatilityAlerts: await this.setupVolatilityAlerts(data)
      },
      
      // Channel concentration risk
      channelRiskManagement: {
        maxChannelConcentration: profile.maxChannelConcentration,
        diversificationTargets: await this.calculateDiversificationTargets(data, profile),
        channelRiskAlerts: await this.setupChannelRiskAlerts(data)
      },
      
      // Market risk management
      marketRiskManagement: {
        currencyHedging: await this.generateCurrencyHedging(data, riskTolerance),
        marketDiversification: await this.optimizeMarketDiversification(data, profile),
        economicRiskFactors: await this.assessEconomicRisks(data)
      },
      
      // Operational risk management
      operationalRiskManagement: {
        overbookingLimits: await this.calculateSafeOverbookingLimits(data, riskTolerance),
        cancellationBuffers: await this.calculateCancellationBuffers(data, profile),
        staffingOptimization: await this.optimizeStaffingForRisk(data)
      },
      
      // Contingency planning
      contingencyPlans: await this.generateContingencyPlans(data, riskTolerance)
    };
  }

  // Generate revenue projections based on optimization
  async generateProjections(hotelId, data, options) {
    const baselineProjection = await this.calculateBaselineProjection(data);
    const optimizedProjection = await this.calculateOptimizedProjection(data, options);

    return {
      baseline: baselineProjection,
      optimized: optimizedProjection,
      improvement: {
        revenue: optimizedProjection.totalRevenue - baselineProjection.totalRevenue,
        percentage: ((optimizedProjection.totalRevenue - baselineProjection.totalRevenue) / baselineProjection.totalRevenue) * 100,
        profit: optimizedProjection.totalProfit - baselineProjection.totalProfit,
        profitMargin: optimizedProjection.profitMargin - baselineProjection.profitMargin
      },
      
      // Scenario analysis
      scenarios: {
        conservative: await this.calculateConservativeScenario(data),
        mostLikely: optimizedProjection,
        optimistic: await this.calculateOptimisticScenario(data)
      },
      
      // Monthly breakdown
      monthlyProjections: await this.generateMonthlyProjections(data, options),
      
      // Key metrics projections
      kpiProjections: {
        occupancyRate: await this.projectOccupancyRate(data),
        averageDailyRate: await this.projectAverageDailyRate(data),
        revenuePerAvailableRoom: await this.projectRevPAR(data),
        totalRevenue: optimizedProjection.totalRevenue,
        profitMargin: optimizedProjection.profitMargin
      }
    };
  }

  // Calculate expected impact of optimization
  async calculateExpectedImpact(strategy, data) {
    const impacts = {
      revenue: 0,
      profit: 0,
      occupancy: 0,
      adr: 0,
      revpar: 0,
      customerSatisfaction: 0,
      marketShare: 0
    };

    // Pricing optimization impact
    if (strategy.pricingOptimization) {
      impacts.revenue += strategy.pricingOptimization.expectedImpact.revenueIncrease || 0;
      impacts.occupancy += strategy.pricingOptimization.expectedImpact.occupancyImpact || 0;
    }

    // Channel optimization impact
    if (strategy.channelOptimization) {
      impacts.revenue += strategy.channelOptimization.expectedImpact.revenueIncrease || 0;
      impacts.profit += strategy.channelOptimization.expectedImpact.profitImprovement || 0;
    }

    // Segment optimization impact
    if (strategy.segmentOptimization) {
      impacts.revenue += strategy.segmentOptimization.expectedImpact.revenueIncrease || 0;
      impacts.profit += strategy.segmentOptimization.expectedImpact.profitMarginImprovement || 0;
    }

    // Calculate derived metrics
    const currentRevenue = data.historical?.totalRevenue || 100000;
    impacts.revenuePercentage = (impacts.revenue / currentRevenue) * 100;
    impacts.profitPercentage = impacts.profit > 0 ? (impacts.profit / (currentRevenue * 0.3)) * 100 : 0;

    // Risk-adjusted impact
    impacts.riskAdjustedRevenue = impacts.revenue * this.getRiskAdjustmentFactor(strategy.riskTolerance);
    impacts.confidenceLevel = await this.calculateConfidenceLevel(strategy, data);

    return impacts;
  }

  // Generate implementation plan
  async generateImplementationPlan(hotelId, data, options) {
    return {
      phases: [
        {
          phase: 1,
          name: 'Foundation Setup',
          duration: '2-4 weeks',
          tasks: [
            'Setup dynamic pricing system',
            'Configure optimization rules',
            'Establish monitoring dashboards',
            'Train staff on new processes'
          ],
          expectedImpact: '15-20% of total impact',
          prerequisites: ['Management approval', 'System integration']
        },
        {
          phase: 2,
          name: 'Channel Optimization',
          duration: '4-6 weeks',
          tasks: [
            'Optimize channel mix allocation',
            'Implement new pricing strategies',
            'Launch targeted marketing campaigns',
            'Monitor and adjust channel performance'
          ],
          expectedImpact: '40-50% of total impact',
          prerequisites: ['Phase 1 completion', 'Channel partner agreements']
        },
        {
          phase: 3,
          name: 'Market Expansion',
          duration: '6-12 weeks',
          tasks: [
            'Launch new market penetration strategies',
            'Implement localized pricing',
            'Expand language support',
            'Develop region-specific campaigns'
          ],
          expectedImpact: '35-45% of total impact',
          prerequisites: ['Market research', 'Localization resources']
        }
      ],
      
      milestones: [
        { week: 2, milestone: 'Dynamic pricing live', kpi: 'Price changes > 0' },
        { week: 6, milestone: 'Channel mix optimized', kpi: 'Profit margin > baseline + 5%' },
        { week: 12, milestone: 'Full optimization active', kpi: 'Revenue > baseline + target%' }
      ],
      
      resources: {
        technology: await this.calculateTechRequirements(options),
        personnel: await this.calculateStaffRequirements(options),
        budget: await this.estimateImplementationCost(options),
        timeline: '3-6 months for full implementation'
      },
      
      riskMitigation: await this.generateImplementationRisks(options)
    };
  }

  // Helper methods for calculations (real data implementations)
  async getHistoricalPerformance(hotelId, timeHorizon) {
    try {
      // Calculate date range based on time horizon
      const endDate = new Date();
      const startDate = new Date();

      switch (timeHorizon) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Get real booking data for the hotel
      const bookings = await Booking.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        checkIn: { $gte: startDate, $lte: endDate },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      }).populate('userId', 'email createdAt');

      // Calculate total revenue
      const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);

      // Calculate room nights and occupancy
      const totalRoomNights = bookings.reduce((sum, booking) => sum + (booking.nights || 0), 0);
      const totalRooms = await Room.countDocuments({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        isActive: true
      });
      const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const possibleRoomNights = totalRooms * days;
      const occupancyRate = possibleRoomNights > 0 ? (totalRoomNights / possibleRoomNights) * 100 : 0;

      // Calculate average daily rate
      const averageDailyRate = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;

      // Get unique guests
      const uniqueGuests = new Set(bookings.map(b => b.userId?._id?.toString()).filter(Boolean));
      const guestCount = uniqueGuests.size;

      // Calculate repeat guest rate
      const guestBookingCounts = new Map();
      bookings.forEach(booking => {
        if (booking.userId?._id) {
          const guestId = booking.userId._id.toString();
          guestBookingCounts.set(guestId, (guestBookingCounts.get(guestId) || 0) + 1);
        }
      });
      const repeatGuests = Array.from(guestBookingCounts.values()).filter(count => count > 1).length;
      const repeatGuestRate = guestCount > 0 ? (repeatGuests / guestCount) * 100 : 0;

      // Calculate channel mix (simplified - based on source field or default distribution)
      const channelCounts = {};
      const totalBookingsCount = bookings.length;

      bookings.forEach(booking => {
        const source = booking.source || 'direct';
        channelCounts[source] = (channelCounts[source] || 0) + 1;
      });

      const channelMix = {};
      Object.entries(channelCounts).forEach(([channel, count]) => {
        channelMix[channel] = totalBookingsCount > 0 ? Math.round((count / totalBookingsCount) * 100) : 0;
      });

      // Ensure we have the standard channels, fill with defaults if missing
      const standardChannels = ['direct', 'booking_com', 'expedia', 'corporate', 'other'];
      standardChannels.forEach(channel => {
        if (!channelMix[channel]) {
          channelMix[channel] = 0;
        }
      });

      return {
        totalRevenue: Math.round(totalRevenue),
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        averageDailyRate: Math.round(averageDailyRate * 100) / 100,
        roomNights: totalRoomNights,
        guestCount,
        repeatGuestRate: Math.round(repeatGuestRate * 10) / 10,
        channelMix,
        timeHorizon,
        dateRange: { startDate, endDate }
      };
    } catch (error) {
      logger.error('Error calculating historical performance:', error);

      // Graceful fallback with minimal data
      return {
        totalRevenue: 0,
        occupancyRate: 0,
        averageDailyRate: 0,
        roomNights: 0,
        guestCount: 0,
        repeatGuestRate: 0,
        channelMix: {
          direct: 0,
          booking_com: 0,
          expedia: 0,
          corporate: 0,
          other: 0
        },
        timeHorizon,
        error: 'Unable to calculate historical performance'
      };
    }
  }

  getRiskAdjustmentFactor(riskTolerance) {
    const factors = { low: 0.7, medium: 0.85, high: 1.0 };
    return factors[riskTolerance] || 0.85;
  }

  async calculateConfidenceLevel(strategy, data) {
    // Simplified confidence calculation based on data quality
    let confidence = 0.7; // Base confidence
    
    if (data.historical) confidence += 0.1;
    if (data.competitors) confidence += 0.1;
    if (data.demand) confidence += 0.05;
    if (data.market) confidence += 0.05;
    
    return Math.min(confidence, 0.95);
  }

  // Cache management
  async getCachedOptimization(cacheKey) {
    try {
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          return cached.data;
        }
        this.cache.delete(cacheKey);
      }

      const redisClient = getRedisClient();
      if (redisClient && redisClient.isReady) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting cached optimization:', error);
      return null;
    }
  }

  async cacheOptimization(cacheKey, optimization) {
    try {
      this.cache.set(cacheKey, {
        data: optimization,
        timestamp: Date.now()
      });

      const redisClient = getRedisClient();
      if (redisClient && redisClient.isReady) {
        await redisClient.setex(cacheKey, 600, JSON.stringify(optimization)); // 10 minutes
      }
    } catch (error) {
      logger.error('Error caching optimization:', error);
    }
  }
}

export default new RevenueOptimizationService();