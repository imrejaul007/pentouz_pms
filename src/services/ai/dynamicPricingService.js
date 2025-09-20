import enhancedPredictiveAnalytics from './enhancedPredictiveAnalytics.js';
import Room from '../../models/Room.js';
import RoomType from '../../models/RoomType.js';
import Booking from '../../models/Booking.js';
import PricingRule from '../../models/PricingRule.js';
import { addDays, format, isWeekend, startOfDay, endOfDay } from 'date-fns';

class DynamicPricingService {
  constructor() {
    this.pricingStrategies = {
      DEMAND_BASED: 'demand_based',
      COMPETITIVE: 'competitive',
      TIME_BASED: 'time_based',
      REVENUE_OPTIMIZATION: 'revenue_optimization',
      SEASONAL: 'seasonal',
      EVENT_BASED: 'event_based'
    };
    
    this.priceElasticityFactors = {
      ROOM_TYPE: {
        'standard': 1.2,
        'deluxe': 1.0,
        'suite': 0.8,
        'presidential': 0.6
      },
      ADVANCE_BOOKING: {
        'same_day': 0.7,
        'week_ahead': 1.0,
        'month_ahead': 1.3,
        'quarter_ahead': 1.5
      },
      CUSTOMER_SEGMENT: {
        'corporate': 0.8,
        'leisure': 1.2,
        'group': 0.9,
        'loyalty': 0.7
      }
    };
    
    this.pricingConstraints = {
      MAX_INCREASE: 0.5, // 50% maximum price increase
      MAX_DECREASE: 0.3, // 30% maximum price decrease
      MIN_MARGIN: 0.25, // 25% minimum profit margin
      COMPETITOR_THRESHOLD: 0.15 // 15% maximum deviation from competitors
    };
  }

  /**
   * Calculate dynamic pricing for all room types
   */
  async calculateDynamicPricing(hotelId, days = 30) {
    try {
      const roomTypes = await RoomType.find({ hotelId });
      const pricingResults = [];

      for (const roomType of roomTypes) {
        const pricing = await this.calculateRoomTypePricing(hotelId, roomType._id, days);
        pricingResults.push({
          roomTypeId: roomType._id,
          roomTypeName: roomType.name,
          ...pricing
        });
      }

      const summary = this.generatePricingSummary(pricingResults);
      const recommendations = this.generatePricingRecommendations(pricingResults);
      const alerts = this.generatePricingAlerts(pricingResults);

      return {
        hotelId,
        timeframe: days,
        pricingResults,
        summary,
        recommendations,
        alerts,
        lastUpdated: new Date().toISOString(),
        nextUpdate: addDays(new Date(), 1).toISOString()
      };
    } catch (error) {
      console.error('Error calculating dynamic pricing:', error);
      throw error;
    }
  }

  /**
   * Calculate pricing for specific room type
   */
  async calculateRoomTypePricing(hotelId, roomTypeId, days) {
    try {
      // Get base pricing data
      const roomType = await RoomType.findById(roomTypeId);
      const basePrice = roomType.basePrice || 200;
      const pricingRules = await PricingRule.find({ hotelId, roomTypeId });
      
      // Get AI predictions
      const demandForecast = await enhancedPredictiveAnalytics.generateDemandForecast(hotelId, days);
      const pricingRecommendations = await enhancedPredictiveAnalytics.generatePricingRecommendations(hotelId, roomTypeId, days);
      
      // Get market data
      const competitorPricing = await this.getCompetitorPricing(hotelId, roomTypeId, days);
      const historicalPerformance = await this.getHistoricalPerformance(hotelId, roomTypeId, 90);
      const marketConditions = await this.getMarketConditions(hotelId);

      const dailyPricing = [];

      for (let i = 0; i < days; i++) {
        const date = addDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');
        
        const demandData = demandForecast.forecasts[i];
        const pricingData = pricingRecommendations.recommendations[i];
        const competitorData = competitorPricing[i];

        // Calculate price using multiple strategies
        const strategies = await this.calculateAllStrategies(
          basePrice,
          demandData,
          competitorData,
          date,
          roomType,
          historicalPerformance,
          marketConditions
        );

        // Apply pricing rules and constraints
        const finalPrice = this.applyPricingRulesAndConstraints(
          basePrice,
          strategies,
          pricingRules,
          date,
          demandData
        );

        // Calculate revenue impact and metrics
        const metrics = this.calculatePricingMetrics(
          basePrice,
          finalPrice,
          demandData,
          competitorData,
          roomType
        );

        dailyPricing.push({
          date: dateStr,
          dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
          basePrice,
          dynamicPrice: finalPrice,
          priceChange: finalPrice - basePrice,
          priceChangePercent: Math.round(((finalPrice - basePrice) / basePrice) * 100),
          demand: demandData,
          strategies,
          competitor: competitorData,
          metrics,
          confidence: this.calculatePricingConfidence(strategies, demandData),
          riskLevel: this.assessPricingRisk(finalPrice, basePrice, demandData, competitorData),
          recommendations: this.generateDailyRecommendations(finalPrice, basePrice, demandData, strategies)
        });
      }

      return {
        dailyPricing,
        summary: this.generateRoomTypePricingSummary(dailyPricing, basePrice),
        optimization: this.calculateOptimizationOpportunities(dailyPricing),
        performance: this.projectPerformanceMetrics(dailyPricing, roomType)
      };
    } catch (error) {
      console.error('Error calculating room type pricing:', error);
      throw error;
    }
  }

  /**
   * Calculate pricing using all available strategies
   */
  async calculateAllStrategies(basePrice, demandData, competitorData, date, roomType, historical, market) {
    const strategies = {};

    // 1. Demand-based pricing
    strategies[this.pricingStrategies.DEMAND_BASED] = this.calculateDemandBasedPrice(
      basePrice,
      demandData.demandScore,
      demandData.expectedOccupancy
    );

    // 2. Competitive pricing
    strategies[this.pricingStrategies.COMPETITIVE] = this.calculateCompetitivePrice(
      basePrice,
      competitorData.averagePrice,
      competitorData.position,
      market.competitionLevel
    );

    // 3. Time-based pricing (advance booking discount/premium)
    strategies[this.pricingStrategies.TIME_BASED] = this.calculateTimeBasedPrice(
      basePrice,
      date,
      historical.averageAdvanceBooking
    );

    // 4. Revenue optimization
    strategies[this.pricingStrategies.REVENUE_OPTIMIZATION] = this.calculateRevenueOptimizedPrice(
      basePrice,
      demandData,
      historical.priceElasticity,
      roomType
    );

    // 5. Seasonal pricing
    strategies[this.pricingStrategies.SEASONAL] = this.calculateSeasonalPrice(
      basePrice,
      date,
      historical.seasonalMultipliers,
      market.seasonalTrend
    );

    // 6. Event-based pricing
    strategies[this.pricingStrategies.EVENT_BASED] = this.calculateEventBasedPrice(
      basePrice,
      demandData.factors.events,
      market.localEvents
    );

    // Calculate weighted average with confidence scores
    const weightedPrice = this.calculateWeightedPrice(strategies, demandData, market);
    strategies.weighted = weightedPrice;

    return strategies;
  }

  /**
   * Demand-based pricing calculation
   */
  calculateDemandBasedPrice(basePrice, demandScore, occupancy) {
    const demandMultiplier = 0.8 + (demandScore * 0.6); // 0.8 to 1.4 range
    const occupancyMultiplier = 0.9 + (occupancy / 100 * 0.3); // 0.9 to 1.2 range
    
    const combinedMultiplier = (demandMultiplier + occupancyMultiplier) / 2;
    const price = Math.round(basePrice * combinedMultiplier);

    return {
      price,
      multiplier: combinedMultiplier,
      confidence: demandScore > 0.7 ? 0.9 : demandScore > 0.4 ? 0.7 : 0.5,
      factors: {
        demandScore,
        occupancy,
        demandMultiplier,
        occupancyMultiplier
      }
    };
  }

  /**
   * Competitive pricing calculation
   */
  calculateCompetitivePrice(basePrice, competitorAverage, position, competitionLevel) {
    let targetPosition;
    
    switch (position) {
      case 'premium':
        targetPosition = competitorAverage * 1.1; // 10% above average
        break;
      case 'budget':
        targetPosition = competitorAverage * 0.9; // 10% below average
        break;
      default:
        targetPosition = competitorAverage; // Match average
    }

    const competitiveAdjustment = competitionLevel * 0.1; // Reduce price if high competition
    const adjustedPrice = targetPosition * (1 - competitiveAdjustment);
    const price = Math.round(Math.max(basePrice * 0.8, adjustedPrice)); // Don't go below 80% of base

    return {
      price,
      competitorAverage,
      targetPosition,
      confidence: competitionLevel > 0.7 ? 0.8 : 0.6,
      factors: {
        position,
        competitionLevel,
        adjustment: competitiveAdjustment
      }
    };
  }

  /**
   * Time-based pricing (advance booking considerations)
   */
  calculateTimeBasedPrice(basePrice, date, averageAdvanceBooking) {
    const daysUntilArrival = Math.max(0, Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24)));
    
    let timeMultiplier = 1.0;
    
    if (daysUntilArrival === 0) {
      // Same day - premium for urgency
      timeMultiplier = 1.15;
    } else if (daysUntilArrival <= 3) {
      // Short notice - slight premium
      timeMultiplier = 1.05;
    } else if (daysUntilArrival <= 7) {
      // Week ahead - normal pricing
      timeMultiplier = 1.0;
    } else if (daysUntilArrival <= 30) {
      // Month ahead - slight discount for early booking
      timeMultiplier = 0.95;
    } else {
      // Far advance - early bird discount
      timeMultiplier = 0.9;
    }

    const price = Math.round(basePrice * timeMultiplier);

    return {
      price,
      multiplier: timeMultiplier,
      daysUntilArrival,
      confidence: 0.7,
      factors: {
        bookingWindow: this.getBookingWindow(daysUntilArrival),
        averageAdvanceBooking
      }
    };
  }

  /**
   * Revenue optimization pricing
   */
  calculateRevenueOptimizedPrice(basePrice, demandData, priceElasticity, roomType) {
    const elasticity = priceElasticity || this.priceElasticityFactors.ROOM_TYPE[roomType.category] || 1.0;
    
    // Calculate optimal price using elasticity
    const demandSensitivity = demandData.demandScore;
    const optimalMultiplier = 1 + (demandSensitivity - 0.5) / elasticity;
    
    // Constrain the multiplier
    const constrainedMultiplier = Math.max(0.7, Math.min(1.5, optimalMultiplier));
    const price = Math.round(basePrice * constrainedMultiplier);

    // Calculate projected revenue
    const projectedOccupancy = Math.max(0, demandData.expectedOccupancy * (2 - constrainedMultiplier));
    const projectedRevenue = price * (projectedOccupancy / 100);
    const baseRevenue = basePrice * (demandData.expectedOccupancy / 100);

    return {
      price,
      multiplier: constrainedMultiplier,
      projectedRevenue,
      revenueIncrease: projectedRevenue - baseRevenue,
      confidence: 0.8,
      factors: {
        elasticity,
        demandSensitivity,
        projectedOccupancy
      }
    };
  }

  /**
   * Seasonal pricing calculation
   */
  calculateSeasonalPrice(basePrice, date, seasonalMultipliers, seasonalTrend) {
    const month = date.getMonth();
    const isWeekendDay = isWeekend(date);
    
    // Monthly seasonal adjustment
    const monthlyMultiplier = seasonalMultipliers?.monthly?.[month] || 1.0;
    
    // Weekend premium
    const weekendMultiplier = isWeekendDay ? 1.1 : 0.95;
    
    // Seasonal trend adjustment
    const trendMultiplier = 1 + (seasonalTrend * 0.1);
    
    const combinedMultiplier = monthlyMultiplier * weekendMultiplier * trendMultiplier;
    const price = Math.round(basePrice * combinedMultiplier);

    return {
      price,
      multiplier: combinedMultiplier,
      confidence: 0.75,
      factors: {
        monthlyMultiplier,
        weekendMultiplier,
        trendMultiplier,
        isWeekend: isWeekendDay,
        month: date.toLocaleDateString('en-US', { month: 'long' })
      }
    };
  }

  /**
   * Event-based pricing calculation
   */
  calculateEventBasedPrice(basePrice, demandEvents, localEvents) {
    let eventMultiplier = 1.0;
    let eventImpact = 'none';
    let impactingEvents = [];

    // Check demand events from forecast
    if (demandEvents && demandEvents.length > 0) {
      const maxEventImpact = Math.max(...demandEvents.map(e => e.impact));
      eventMultiplier *= (1 + maxEventImpact);
      eventImpact = maxEventImpact > 0.3 ? 'high' : maxEventImpact > 0.1 ? 'medium' : 'low';
      impactingEvents = demandEvents;
    }

    // Check local events
    if (localEvents && localEvents.length > 0) {
      const localEventImpact = localEvents.reduce((sum, e) => sum + e.impact, 0) / localEvents.length;
      eventMultiplier *= (1 + localEventImpact * 0.5);
      impactingEvents = [...impactingEvents, ...localEvents];
    }

    // Cap the event multiplier
    eventMultiplier = Math.min(1.6, eventMultiplier);
    const price = Math.round(basePrice * eventMultiplier);

    return {
      price,
      multiplier: eventMultiplier,
      eventImpact,
      impactingEvents,
      confidence: impactingEvents.length > 0 ? 0.85 : 0.5,
      factors: {
        eventCount: impactingEvents.length,
        maxImpact: impactingEvents.length > 0 ? Math.max(...impactingEvents.map(e => e.impact)) : 0
      }
    };
  }

  /**
   * Calculate weighted price from all strategies
   */
  calculateWeightedPrice(strategies, demandData, market) {
    const weights = {
      [this.pricingStrategies.DEMAND_BASED]: 0.25,
      [this.pricingStrategies.COMPETITIVE]: 0.20,
      [this.pricingStrategies.TIME_BASED]: 0.10,
      [this.pricingStrategies.REVENUE_OPTIMIZATION]: 0.25,
      [this.pricingStrategies.SEASONAL]: 0.15,
      [this.pricingStrategies.EVENT_BASED]: 0.05
    };

    // Adjust weights based on confidence and market conditions
    if (market.competitionLevel > 0.7) {
      weights[this.pricingStrategies.COMPETITIVE] += 0.1;
      weights[this.pricingStrategies.DEMAND_BASED] -= 0.1;
    }

    if (demandData.confidence > 0.8) {
      weights[this.pricingStrategies.DEMAND_BASED] += 0.1;
      weights[this.pricingStrategies.SEASONAL] -= 0.1;
    }

    let weightedPrice = 0;
    let totalWeight = 0;
    let confidenceSum = 0;

    Object.entries(weights).forEach(([strategy, weight]) => {
      if (strategies[strategy]) {
        const strategyData = strategies[strategy];
        const adjustedWeight = weight * strategyData.confidence;
        weightedPrice += strategyData.price * adjustedWeight;
        totalWeight += adjustedWeight;
        confidenceSum += strategyData.confidence * weight;
      }
    });

    const finalPrice = totalWeight > 0 ? Math.round(weightedPrice / totalWeight) : strategies[this.pricingStrategies.DEMAND_BASED].price;

    return {
      price: finalPrice,
      confidence: confidenceSum,
      weights,
      contributionAnalysis: this.analyzeStrategyContributions(strategies, weights)
    };
  }

  /**
   * Apply pricing rules and constraints
   */
  applyPricingRulesAndConstraints(basePrice, strategies, pricingRules, date, demandData) {
    let finalPrice = strategies.weighted.price;

    // Apply business rules
    for (const rule of pricingRules) {
      if (this.evaluateRule(rule, date, demandData)) {
        finalPrice = this.applyRule(finalPrice, rule);
      }
    }

    // Apply constraints
    const maxPrice = basePrice * (1 + this.pricingConstraints.MAX_INCREASE);
    const minPrice = basePrice * (1 - this.pricingConstraints.MAX_DECREASE);
    
    finalPrice = Math.max(minPrice, Math.min(maxPrice, finalPrice));

    // Ensure minimum margin
    const costPrice = basePrice * (1 - this.pricingConstraints.MIN_MARGIN);
    finalPrice = Math.max(costPrice, finalPrice);

    return Math.round(finalPrice);
  }

  /**
   * Calculate pricing metrics
   */
  calculatePricingMetrics(basePrice, finalPrice, demandData, competitorData, roomType) {
    const priceChange = finalPrice - basePrice;
    const priceChangePercent = (priceChange / basePrice) * 100;
    
    const projectedOccupancy = this.projectOccupancy(finalPrice, basePrice, demandData);
    const projectedRevenue = finalPrice * (projectedOccupancy / 100);
    const baseRevenue = basePrice * (demandData.expectedOccupancy / 100);
    
    const competitorDifference = finalPrice - competitorData.averagePrice;
    const competitorDifferencePercent = (competitorDifference / competitorData.averagePrice) * 100;

    return {
      priceChange,
      priceChangePercent: Math.round(priceChangePercent),
      projectedOccupancy: Math.round(projectedOccupancy),
      projectedRevenue: Math.round(projectedRevenue),
      baseRevenue: Math.round(baseRevenue),
      revenueIncrease: Math.round(projectedRevenue - baseRevenue),
      revenueIncreasePercent: Math.round(((projectedRevenue - baseRevenue) / baseRevenue) * 100),
      competitorDifference,
      competitorDifferencePercent: Math.round(competitorDifferencePercent),
      marketPosition: this.determineMarketPosition(finalPrice, competitorData),
      demandFulfillment: Math.round((projectedOccupancy / demandData.expectedOccupancy) * 100)
    };
  }

  /**
   * Generate pricing recommendations and alerts
   */
  generatePricingRecommendations(pricingResults) {
    const recommendations = [];

    pricingResults.forEach(roomType => {
      // High revenue opportunities
      const highRevenueOpportunities = roomType.dailyPricing.filter(
        day => day.metrics.revenueIncreasePercent > 15
      );

      if (highRevenueOpportunities.length > 0) {
        recommendations.push({
          type: 'opportunity',
          priority: 'high',
          roomType: roomType.roomTypeName,
          message: `${highRevenueOpportunities.length} high revenue opportunity days identified`,
          action: 'implement_dynamic_pricing',
          potentialIncrease: Math.round(
            highRevenueOpportunities.reduce((sum, day) => sum + day.metrics.revenueIncrease, 0)
          ),
          dates: highRevenueOpportunities.map(day => day.date).slice(0, 5)
        });
      }

      // Competitive pricing alerts
      const competitiveThreats = roomType.dailyPricing.filter(
        day => day.competitor.position === 'underpriced' && day.metrics.competitorDifferencePercent > 10
      );

      if (competitiveThreats.length > 0) {
        recommendations.push({
          type: 'alert',
          priority: 'medium',
          roomType: roomType.roomTypeName,
          message: `Pricing significantly above competitors on ${competitiveThreats.length} days`,
          action: 'review_competitive_position',
          riskDays: competitiveThreats.length,
          dates: competitiveThreats.map(day => day.date).slice(0, 3)
        });
      }

      // Low demand periods
      const lowDemandDays = roomType.dailyPricing.filter(
        day => day.demand.demandScore < 0.3
      );

      if (lowDemandDays.length > 0) {
        recommendations.push({
          type: 'strategy',
          priority: 'medium',
          roomType: roomType.roomTypeName,
          message: `${lowDemandDays.length} low demand days could benefit from promotional pricing`,
          action: 'implement_promotional_pricing',
          affectedDays: lowDemandDays.length,
          averageDemand: Math.round(
            lowDemandDays.reduce((sum, day) => sum + day.demand.demandScore, 0) / lowDemandDays.length * 100
          )
        });
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Helper methods
   */

  async getCompetitorPricing(hotelId, roomTypeId, days) {
    // Simulate competitor pricing - in production, integrate with competitor analysis APIs
    const pricing = [];
    for (let i = 0; i < days; i++) {
      const baseCompetitorPrice = 180 + (Math.random() - 0.5) * 60;
      pricing.push({
        averagePrice: Math.round(baseCompetitorPrice),
        medianPrice: Math.round(baseCompetitorPrice * 0.95),
        priceRange: {
          min: Math.round(baseCompetitorPrice * 0.7),
          max: Math.round(baseCompetitorPrice * 1.4)
        },
        position: ['budget', 'mid-range', 'premium'][Math.floor(Math.random() * 3)],
        competitorCount: Math.floor(Math.random() * 10) + 5,
        marketShare: Math.random() * 0.3 + 0.1
      });
    }
    return pricing;
  }

  async getHistoricalPerformance(hotelId, roomTypeId, days) {
    // Get historical performance data
    return {
      averageRate: 200,
      occupancyRate: 0.75,
      revPAR: 150,
      priceElasticity: 1.2,
      seasonalMultipliers: {
        monthly: Array(12).fill(1).map(() => 0.8 + Math.random() * 0.4)
      },
      averageAdvanceBooking: 14,
      cancellationRate: 0.1
    };
  }

  async getMarketConditions(hotelId) {
    return {
      competitionLevel: 0.6,
      seasonalTrend: 0.05,
      economicIndex: 1.02,
      demandTrend: 0.03,
      marketGrowth: 0.02,
      localEvents: []
    };
  }

  getBookingWindow(days) {
    if (days === 0) return 'same_day';
    if (days <= 7) return 'week_ahead';
    if (days <= 30) return 'month_ahead';
    return 'quarter_ahead';
  }

  calculatePricingConfidence(strategies, demandData) {
    const strategyConfidences = Object.values(strategies).map(s => s.confidence || 0.5);
    const avgStrategyConfidence = strategyConfidences.reduce((sum, c) => sum + c, 0) / strategyConfidences.length;
    const demandConfidence = demandData.confidence / 100;
    
    return Math.round((avgStrategyConfidence * 0.7 + demandConfidence * 0.3) * 100);
  }

  assessPricingRisk(finalPrice, basePrice, demandData, competitorData) {
    let riskScore = 0;
    
    // Price change risk
    const priceChangePercent = Math.abs((finalPrice - basePrice) / basePrice);
    if (priceChangePercent > 0.2) riskScore += 0.3;
    
    // Competitive risk
    const competitorDiff = Math.abs((finalPrice - competitorData.averagePrice) / competitorData.averagePrice);
    if (competitorDiff > 0.15) riskScore += 0.3;
    
    // Demand uncertainty risk
    if (demandData.confidence < 0.6) riskScore += 0.4;
    
    if (riskScore > 0.6) return 'high';
    if (riskScore > 0.3) return 'medium';
    return 'low';
  }

  generateDailyRecommendations(finalPrice, basePrice, demandData, strategies) {
    const recommendations = [];
    
    const priceChange = (finalPrice - basePrice) / basePrice;
    
    if (priceChange > 0.15) {
      recommendations.push({
        type: 'pricing',
        message: 'High price increase recommended due to strong demand',
        action: 'monitor_booking_pace'
      });
    } else if (priceChange < -0.15) {
      recommendations.push({
        type: 'pricing',
        message: 'Price reduction recommended to stimulate demand',
        action: 'enhance_marketing'
      });
    }
    
    if (demandData.demandScore > 0.8) {
      recommendations.push({
        type: 'inventory',
        message: 'High demand expected - ensure room availability',
        action: 'manage_inventory'
      });
    }
    
    return recommendations;
  }

  projectOccupancy(newPrice, basePrice, demandData) {
    const priceElasticity = 1.2; // Default elasticity
    const priceChange = (newPrice - basePrice) / basePrice;
    const demandChange = -priceElasticity * priceChange;
    
    const adjustedOccupancy = demandData.expectedOccupancy * (1 + demandChange);
    return Math.max(0, Math.min(100, adjustedOccupancy));
  }

  determineMarketPosition(price, competitorData) {
    const avgPrice = competitorData.averagePrice;
    const diff = (price - avgPrice) / avgPrice;
    
    if (diff > 0.1) return 'premium';
    if (diff < -0.1) return 'budget';
    return 'competitive';
  }

  evaluateRule(rule, date, demandData) {
    // Implement business rule evaluation logic
    return true; // Placeholder
  }

  applyRule(price, rule) {
    // Implement business rule application logic
    return price; // Placeholder
  }

  analyzeStrategyContributions(strategies, weights) {
    const contributions = {};
    
    Object.entries(strategies).forEach(([strategy, data]) => {
      if (strategy !== 'weighted' && weights[strategy]) {
        contributions[strategy] = {
          price: data.price,
          weight: weights[strategy],
          confidence: data.confidence,
          contribution: (data.price * weights[strategy] * data.confidence)
        };
      }
    });
    
    return contributions;
  }

  generatePricingSummary(pricingResults) {
    const totalDays = pricingResults[0]?.dailyPricing?.length || 0;
    const avgPriceIncrease = pricingResults.reduce((sum, rt) => {
      const avg = rt.dailyPricing.reduce((daySum, day) => daySum + day.priceChangePercent, 0) / rt.dailyPricing.length;
      return sum + avg;
    }, 0) / pricingResults.length;

    const totalRevenueIncrease = pricingResults.reduce((sum, rt) => 
      sum + rt.summary?.totalRevenueIncrease || 0, 0
    );

    return {
      totalRoomTypes: pricingResults.length,
      forecastDays: totalDays,
      avgPriceIncrease: Math.round(avgPriceIncrease),
      totalRevenueIncrease: Math.round(totalRevenueIncrease),
      highOpportunityDays: pricingResults.reduce((sum, rt) => 
        sum + rt.dailyPricing.filter(day => day.metrics.revenueIncreasePercent > 15).length, 0
      ),
      optimalPricingDays: pricingResults.reduce((sum, rt) => 
        sum + rt.dailyPricing.filter(day => day.confidence > 80).length, 0
      )
    };
  }

  generatePricingAlerts(pricingResults) {
    const alerts = [];
    
    pricingResults.forEach(roomType => {
      const highRiskDays = roomType.dailyPricing.filter(day => day.riskLevel === 'high').length;
      if (highRiskDays > 0) {
        alerts.push({
          severity: 'warning',
          roomType: roomType.roomTypeName,
          message: `${highRiskDays} high-risk pricing days identified`,
          recommendation: 'Review pricing strategy and market conditions'
        });
      }
      
      const extremePriceChanges = roomType.dailyPricing.filter(day => 
        Math.abs(day.priceChangePercent) > 30
      ).length;
      
      if (extremePriceChanges > 0) {
        alerts.push({
          severity: 'info',
          roomType: roomType.roomTypeName,
          message: `${extremePriceChanges} days with significant price changes (>30%)`,
          recommendation: 'Monitor booking response and adjust if needed'
        });
      }
    });
    
    return alerts;
  }

  generateRoomTypePricingSummary(dailyPricing, basePrice) {
    const avgPrice = dailyPricing.reduce((sum, day) => sum + day.dynamicPrice, 0) / dailyPricing.length;
    const totalRevenueIncrease = dailyPricing.reduce((sum, day) => sum + day.metrics.revenueIncrease, 0);
    const avgOccupancy = dailyPricing.reduce((sum, day) => sum + day.metrics.projectedOccupancy, 0) / dailyPricing.length;
    
    return {
      basePrice,
      avgDynamicPrice: Math.round(avgPrice),
      priceIncrease: Math.round(avgPrice - basePrice),
      priceIncreasePercent: Math.round(((avgPrice - basePrice) / basePrice) * 100),
      totalRevenueIncrease: Math.round(totalRevenueIncrease),
      avgProjectedOccupancy: Math.round(avgOccupancy),
      optimalDays: dailyPricing.filter(day => day.confidence > 80).length,
      highRevenueDays: dailyPricing.filter(day => day.metrics.revenueIncreasePercent > 15).length
    };
  }

  calculateOptimizationOpportunities(dailyPricing) {
    return {
      highestRevenueDay: dailyPricing.reduce((max, day) => 
        day.metrics.revenueIncrease > max.metrics.revenueIncrease ? day : max
      ),
      bestDemandMatch: dailyPricing.reduce((best, day) => 
        day.metrics.demandFulfillment > best.metrics.demandFulfillment ? day : best
      ),
      mostCompetitive: dailyPricing.reduce((best, day) => 
        Math.abs(day.metrics.competitorDifferencePercent) < Math.abs(best.metrics.competitorDifferencePercent) ? day : best
      )
    };
  }

  projectPerformanceMetrics(dailyPricing, roomType) {
    const totalRevenue = dailyPricing.reduce((sum, day) => sum + day.metrics.projectedRevenue, 0);
    const avgOccupancy = dailyPricing.reduce((sum, day) => sum + day.metrics.projectedOccupancy, 0) / dailyPricing.length;
    const totalRooms = roomType.roomCount || 10; // Assume 10 rooms if not specified
    
    return {
      projectedRevenue: Math.round(totalRevenue * totalRooms),
      avgOccupancy: Math.round(avgOccupancy),
      revPAR: Math.round((totalRevenue * avgOccupancy / 100) / dailyPricing.length),
      totalRoomNights: Math.round(dailyPricing.length * totalRooms * avgOccupancy / 100),
      revenueGrowth: Math.round(
        dailyPricing.reduce((sum, day) => sum + day.metrics.revenueIncreasePercent, 0) / dailyPricing.length
      )
    };
  }
}

export default new DynamicPricingService();