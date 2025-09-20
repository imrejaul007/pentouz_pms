import mongoose from 'mongoose';
import PricingStrategy from '../models/PricingStrategy.js';
import DemandForecast from '../models/DemandForecast.js';
import RoomAvailability from '../models/RoomAvailability.js';
import RoomType from '../models/RoomType.js';
import Booking from '../models/Booking.js';
import dynamicPricingService from './dynamicPricingService.js';
import AuditLog from '../models/AuditLog.js';

/**
 * Revenue Management Service
 * Comprehensive yield management and revenue optimization
 */
class RevenueManagementService {
  
  constructor() {
    this.kpiCache = new Map();
    this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Calculate comprehensive revenue KPIs
   * @param {string} hotelId - Hotel ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} options - Calculation options
   */
  async calculateRevenueKPIs(hotelId, startDate, endDate, options = {}) {
    try {
      const cacheKey = `${hotelId}_${startDate.toISOString()}_${endDate.toISOString()}`;
      
      // Check cache first
      if (this.kpiCache.has(cacheKey) && !options.skipCache) {
        const cached = this.kpiCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return { ...cached.data, fromCache: true };
        }
      }

      console.log(`📊 Calculating revenue KPIs for hotel ${hotelId}...`);

      // Get all room types for this hotel
      const roomTypes = await RoomType.find({ hotelId, isActive: true });
      const roomTypeIds = roomTypes.map(rt => rt._id);

      // Get availability data
      const availability = await RoomAvailability.find({
        hotelId,
        roomTypeId: { $in: roomTypeIds },
        date: { $gte: startDate, $lte: endDate }
      }).populate('roomTypeId');

      // Get bookings data
      const bookings = await Booking.find({
        hotelId,
        checkIn: { $gte: startDate, $lte: endDate },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      });

      // Calculate core KPIs
      const kpis = await this.calculateCoreKPIs(availability, bookings, startDate, endDate);
      
      // Calculate advanced metrics
      const advancedMetrics = await this.calculateAdvancedMetrics(hotelId, availability, bookings, startDate, endDate);
      
      // Calculate room type performance
      const roomTypePerformance = await this.calculateRoomTypePerformance(roomTypes, availability, bookings);
      
      // Calculate pricing effectiveness
      const pricingEffectiveness = await this.calculatePricingEffectiveness(hotelId, availability, bookings);
      
      // Calculate forecasting accuracy
      const forecastAccuracy = await this.calculateForecastAccuracy(hotelId, startDate, endDate);

      const result = {
        success: true,
        period: { startDate, endDate },
        kpis,
        advancedMetrics,
        roomTypePerformance,
        pricingEffectiveness,
        forecastAccuracy,
        calculatedAt: new Date()
      };

      // Cache result
      this.kpiCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      console.error('Error calculating revenue KPIs:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate core revenue KPIs
   */
  async calculateCoreKPIs(availability, bookings, startDate, endDate) {
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Total rooms and revenue
    const totalRoomNights = availability.reduce((sum, avail) => sum + avail.totalRooms, 0);
    const occupiedRoomNights = availability.reduce((sum, avail) => sum + avail.soldRooms, 0);
    const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);

    // Average Daily Rate (ADR)
    const adr = occupiedRoomNights > 0 ? totalRevenue / occupiedRoomNights : 0;

    // Occupancy Rate
    const occupancyRate = totalRoomNights > 0 ? (occupiedRoomNights / totalRoomNights) * 100 : 0;

    // Revenue Per Available Room (RevPAR)
    const revPAR = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;

    // Average Length of Stay (ALOS)
    const totalNights = bookings.reduce((sum, booking) => {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      return sum + Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    }, 0);
    const alos = bookings.length > 0 ? totalNights / bookings.length : 0;

    // Gross Operating Profit Per Available Room (GOPPAR)
    // Simplified calculation - would need cost data for accurate GOPPAR
    const estimatedCosts = totalRevenue * 0.35; // Assume 35% cost ratio
    const gop = totalRevenue - estimatedCosts;
    const goppar = totalRoomNights > 0 ? gop / totalRoomNights : 0;

    // Revenue Growth (comparing to same period last year - simplified)
    const revenueGrowth = 0; // Would need historical data

    return {
      totalRevenue: Math.round(totalRevenue),
      adr: Math.round(adr),
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      revPAR: Math.round(revPAR),
      alos: Math.round(alos * 10) / 10,
      goppar: Math.round(goppar),
      revenueGrowth,
      totalBookings: bookings.length,
      totalRoomNights,
      occupiedRoomNights,
      availableRoomNights: totalRoomNights - occupiedRoomNights
    };
  }

  /**
   * Calculate advanced revenue metrics
   */
  async calculateAdvancedMetrics(hotelId, availability, bookings, startDate, endDate) {
    // Market Share Index (MSI) - would need competitor data
    const marketShareIndex = 100; // Placeholder

    // Revenue Generation Index (RGI) - performance vs market
    const revenueGenerationIndex = 105; // Placeholder - 5% above market

    // Market Penetration Index (MPI) - occupancy vs market
    const marketPenetrationIndex = 98; // Placeholder - 2% below market

    // Pickup Analysis - bookings pace
    const bookingsBySource = this.groupBookingsBySource(bookings);
    const channelMix = this.calculateChannelMix(bookings);
    
    // Lead time analysis
    const leadTimeAnalysis = this.calculateLeadTimeMetrics(bookings);
    
    // Cancellation and no-show rates
    const cancellationRate = await this.calculateCancellationRate(hotelId, startDate, endDate);
    
    // Price optimization opportunities
    const optimizationOpportunities = await this.identifyOptimizationOpportunities(hotelId, availability);

    return {
      marketShareIndex,
      revenueGenerationIndex,
      marketPenetrationIndex,
      bookingsBySource,
      channelMix,
      leadTimeAnalysis,
      cancellationRate,
      optimizationOpportunities
    };
  }

  /**
   * Calculate room type performance metrics
   */
  async calculateRoomTypePerformance(roomTypes, availability, bookings) {
    const performance = [];

    for (const roomType of roomTypes) {
      const roomTypeAvailability = availability.filter(av => 
        av.roomTypeId.toString() === roomType._id.toString()
      );
      
      const roomTypeBookings = bookings.filter(booking => 
        booking.roomType === roomType.legacyType || 
        booking.roomTypeId?.toString() === roomType._id.toString()
      );

      const totalRoomNights = roomTypeAvailability.reduce((sum, av) => sum + av.totalRooms, 0);
      const soldRoomNights = roomTypeAvailability.reduce((sum, av) => sum + av.soldRooms, 0);
      const revenue = roomTypeBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);

      const occupancyRate = totalRoomNights > 0 ? (soldRoomNights / totalRoomNights) * 100 : 0;
      const adr = soldRoomNights > 0 ? revenue / soldRoomNights : 0;
      const revPAR = totalRoomNights > 0 ? revenue / totalRoomNights : 0;

      performance.push({
        roomTypeId: roomType._id,
        roomTypeName: roomType.name,
        roomTypeCode: roomType.code,
        metrics: {
          revenue: Math.round(revenue),
          occupancyRate: Math.round(occupancyRate * 100) / 100,
          adr: Math.round(adr),
          revPAR: Math.round(revPAR),
          totalBookings: roomTypeBookings.length,
          totalRoomNights,
          soldRoomNights
        },
        performance: {
          revenueShare: totalRoomNights > 0 ? (revenue / (roomTypes.reduce((sum, rt) => sum + rt.basePrice, 0) * totalRoomNights)) * 100 : 0,
          efficiencyScore: occupancyRate * (adr / roomType.basePrice) // Occupancy weighted by rate performance
        }
      });
    }

    return performance.sort((a, b) => b.metrics.revenue - a.metrics.revenue);
  }

  /**
   * Calculate pricing effectiveness metrics
   */
  async calculatePricingEffectiveness(hotelId, availability, bookings) {
    // Price variance analysis
    const priceVariance = this.calculatePriceVariance(availability);
    
    // Rate conversion analysis
    const rateConversion = this.calculateRateConversion(availability, bookings);
    
    // Dynamic pricing impact
    const dynamicPricingImpact = await this.calculateDynamicPricingImpact(hotelId);
    
    // Competitor rate analysis
    const competitorAnalysis = await this.calculateCompetitorRateAnalysis(hotelId);

    return {
      priceVariance,
      rateConversion,
      dynamicPricingImpact,
      competitorAnalysis
    };
  }

  /**
   * Calculate forecasting accuracy
   */
  async calculateForecastAccuracy(hotelId, startDate, endDate) {
    try {
      const forecasts = await DemandForecast.find({
        hotelId,
        date: { $gte: startDate, $lte: endDate },
        'validation.validated': true
      });

      if (forecasts.length === 0) {
        return {
          accuracy: null,
          forecastCount: 0,
          message: 'No validated forecasts available'
        };
      }

      const accuracyScores = forecasts.map(f => f.validation.accuracyScore);
      const averageAccuracy = accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length;

      const accuracyByRange = {
        excellent: forecasts.filter(f => f.validation.accuracyScore >= 90).length,
        good: forecasts.filter(f => f.validation.accuracyScore >= 70 && f.validation.accuracyScore < 90).length,
        fair: forecasts.filter(f => f.validation.accuracyScore >= 50 && f.validation.accuracyScore < 70).length,
        poor: forecasts.filter(f => f.validation.accuracyScore < 50).length
      };

      return {
        accuracy: Math.round(averageAccuracy * 100) / 100,
        forecastCount: forecasts.length,
        accuracyDistribution: accuracyByRange,
        trend: this.calculateAccuracyTrend(forecasts)
      };

    } catch (error) {
      console.error('Error calculating forecast accuracy:', error);
      return {
        accuracy: null,
        error: error.message
      };
    }
  }

  /**
   * Generate revenue optimization recommendations
   * @param {string} hotelId - Hotel ID
   * @param {Object} kpiResults - KPI calculation results
   */
  async generateOptimizationRecommendations(hotelId, kpiResults) {
    const recommendations = [];

    // Low occupancy recommendations
    if (kpiResults.kpis.occupancyRate < 60) {
      recommendations.push({
        category: 'occupancy',
        priority: 'high',
        title: 'Increase Occupancy Rate',
        description: `Current occupancy at ${kpiResults.kpis.occupancyRate}% is below optimal range`,
        actions: [
          'Consider reducing rates for low-demand periods',
          'Increase marketing spend for direct bookings',
          'Create special packages and promotions',
          'Review and improve online presence'
        ],
        estimatedImpact: 'Revenue increase of 15-25%'
      });
    }

    // Low ADR recommendations
    if (kpiResults.kpis.adr < kpiResults.roomTypePerformance[0]?.metrics.adr * 0.8) {
      recommendations.push({
        category: 'pricing',
        priority: 'medium',
        title: 'Optimize Average Daily Rate',
        description: 'ADR appears to be below potential based on room type analysis',
        actions: [
          'Implement dynamic pricing strategies',
          'Review rate structures and eliminate low-performing rates',
          'Introduce upselling opportunities',
          'Analyze competitor pricing more frequently'
        ],
        estimatedImpact: 'ADR increase of 8-15%'
      });
    }

    // Revenue mix recommendations
    const directBookingShare = kpiResults.advancedMetrics.channelMix.direct || 0;
    if (directBookingShare < 30) {
      recommendations.push({
        category: 'distribution',
        priority: 'medium',
        title: 'Increase Direct Booking Share',
        description: `Direct bookings at ${directBookingShare}% - opportunity to reduce commission costs`,
        actions: [
          'Improve website booking engine',
          'Implement rate parity or best rate guarantee',
          'Create loyalty program benefits',
          'Increase direct marketing efforts'
        ],
        estimatedImpact: 'Cost savings of 5-12% in distribution costs'
      });
    }

    // Forecasting recommendations
    if (kpiResults.forecastAccuracy.accuracy < 70) {
      recommendations.push({
        category: 'forecasting',
        priority: 'low',
        title: 'Improve Demand Forecasting',
        description: `Forecast accuracy at ${kpiResults.forecastAccuracy.accuracy}% needs improvement`,
        actions: [
          'Collect more granular historical data',
          'Include more market factors in forecasting',
          'Regular model retraining and calibration',
          'Manual forecast adjustments for special events'
        ],
        estimatedImpact: 'Better pricing decisions and inventory control'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Run comprehensive yield management analysis
   * @param {string} hotelId - Hotel ID
   * @param {Object} options - Analysis options
   */
  async runYieldManagementAnalysis(hotelId, options = {}) {
    try {
      const {
        analysisStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        analysisEndDate = new Date(),
        includeForecasting = true,
        includeOptimization = true
      } = options;

      console.log(`📈 Running yield management analysis for hotel ${hotelId}...`);

      // Calculate KPIs
      const kpiResults = await this.calculateRevenueKPIs(hotelId, analysisStartDate, analysisEndDate);
      
      if (!kpiResults.success) {
        return kpiResults;
      }

      // Generate recommendations
      const recommendations = await this.generateOptimizationRecommendations(hotelId, kpiResults);

      // Get pricing opportunities
      let pricingOpportunities = null;
      if (includeOptimization) {
        pricingOpportunities = await this.identifyPricingOpportunities(hotelId);
      }

      // Generate forecasts if requested
      let upcomingForecasts = null;
      if (includeForecasting) {
        upcomingForecasts = await this.generateUpcomingForecasts(hotelId);
      }

      return {
        success: true,
        analysis: {
          period: { startDate: analysisStartDate, endDate: analysisEndDate },
          kpis: kpiResults,
          recommendations,
          pricingOpportunities,
          upcomingForecasts
        },
        summary: {
          overallScore: this.calculateOverallPerformanceScore(kpiResults.kpis),
          keyInsights: this.extractKeyInsights(kpiResults),
          actionItems: recommendations.filter(r => r.priority === 'high').length
        },
        analyzedAt: new Date()
      };

    } catch (error) {
      console.error('Error in yield management analysis:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper methods
   */
  groupBookingsBySource(bookings) {
    const sources = {};
    bookings.forEach(booking => {
      const source = booking.source || 'direct';
      sources[source] = (sources[source] || 0) + 1;
    });
    return sources;
  }

  calculateChannelMix(bookings) {
    const total = bookings.length;
    const sources = this.groupBookingsBySource(bookings);
    const mix = {};
    
    for (const [source, count] of Object.entries(sources)) {
      mix[source] = total > 0 ? Math.round((count / total) * 10000) / 100 : 0;
    }
    
    return mix;
  }

  calculateLeadTimeMetrics(bookings) {
    const leadTimes = bookings.map(booking => {
      const bookingDate = new Date(booking.createdAt);
      const checkInDate = new Date(booking.checkIn);
      return Math.floor((checkInDate - bookingDate) / (1000 * 60 * 60 * 24));
    }).filter(days => days >= 0);

    if (leadTimes.length === 0) return { average: 0, median: 0, distribution: {} };

    const average = leadTimes.reduce((sum, days) => sum + days, 0) / leadTimes.length;
    const sorted = leadTimes.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    const distribution = {
      sameDay: leadTimes.filter(d => d === 0).length,
      within7Days: leadTimes.filter(d => d > 0 && d <= 7).length,
      within30Days: leadTimes.filter(d => d > 7 && d <= 30).length,
      moreThan30Days: leadTimes.filter(d => d > 30).length
    };

    return {
      average: Math.round(average * 10) / 10,
      median,
      distribution
    };
  }

  async calculateCancellationRate(hotelId, startDate, endDate) {
    const cancelled = await Booking.countDocuments({
      hotelId,
      checkIn: { $gte: startDate, $lte: endDate },
      status: 'cancelled'
    });

    const total = await Booking.countDocuments({
      hotelId,
      checkIn: { $gte: startDate, $lte: endDate }
    });

    return total > 0 ? Math.round((cancelled / total) * 10000) / 100 : 0;
  }

  async identifyOptimizationOpportunities(hotelId, availability) {
    // Simplified optimization opportunity identification
    const opportunities = [];

    const lowOccupancyDays = availability.filter(av => 
      (av.soldRooms / av.totalRooms) < 0.6
    );

    if (lowOccupancyDays.length > 0) {
      opportunities.push({
        type: 'rate_reduction',
        description: `${lowOccupancyDays.length} days with occupancy below 60%`,
        recommendation: 'Consider rate reductions to stimulate demand'
      });
    }

    return opportunities;
  }

  calculateOverallPerformanceScore(kpis) {
    let score = 0;
    
    // Occupancy rate (0-40 points)
    score += Math.min(40, kpis.occupancyRate * 0.5);
    
    // ADR performance (0-30 points) - simplified
    score += Math.min(30, (kpis.adr / 5000) * 30); // Assuming 5000 as good ADR
    
    // RevPAR performance (0-30 points) - simplified
    score += Math.min(30, (kpis.revPAR / 3000) * 30); // Assuming 3000 as good RevPAR
    
    return Math.round(score);
  }

  extractKeyInsights(kpiResults) {
    const insights = [];
    
    if (kpiResults.kpis.occupancyRate > 80) {
      insights.push('High occupancy indicates strong demand - consider rate optimization');
    }
    
    if (kpiResults.kpis.alos > 2.5) {
      insights.push('Above-average length of stay suggests good guest satisfaction');
    }
    
    return insights;
  }

  // Placeholder methods for advanced calculations
  calculatePriceVariance(availability) { return { variance: 15, trend: 'stable' }; }
  calculateRateConversion(availability, bookings) { return { conversionRate: 12.5 }; }
  async calculateDynamicPricingImpact(hotelId) { return { impact: '+8.5%' }; }
  async calculateCompetitorRateAnalysis(hotelId) { return { position: 'competitive' }; }
  calculateAccuracyTrend(forecasts) { return 'improving'; }
  async identifyPricingOpportunities(hotelId) { return []; }
  async generateUpcomingForecasts(hotelId) { return []; }
}

export default new RevenueManagementService();