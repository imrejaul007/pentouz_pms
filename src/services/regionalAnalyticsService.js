import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import exchangeRateService from './exchangeRateService.js';
import localizedPricingService from './localizedPricingService.js';
import { getRedisClient } from '../config/redis.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';

class RegionalAnalyticsService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    this.supportedRegions = [
      'US', 'CA', 'MX', 'BR', 'AR',      // Americas
      'GB', 'DE', 'FR', 'IT', 'ES', 'NL', // Europe
      'CN', 'JP', 'IN', 'SG', 'AU', 'TH', // Asia-Pacific
      'AE', 'SA', 'EG', 'ZA'              // MENA & Africa
    ];
    this.marketSegments = [
      'corporate', 'leisure', 'group', 'government', 'mice', 'bleisure'
    ];
  }

  // Generate comprehensive regional market analysis
  async generateRegionalAnalysis(hotelId, options = {}) {
    try {
      const {
        regions = this.supportedRegions,
        timeRange = '90d',
        includeForecasting = true,
        includeCompetitorAnalysis = false,
        currency = 'USD'
      } = options;

      const cacheKey = `regional_analysis:${hotelId}:${regions.join(',')}:${timeRange}`;
      const cached = await this.getCachedAnalysis(cacheKey);
      
      if (cached && !options.force) {
        return cached;
      }

      const analysis = {
        hotelId,
        generatedAt: new Date(),
        timeRange,
        baseCurrency: currency,
        summary: await this.generateRegionalSummary(hotelId, regions, timeRange),
        regions: {},
        insights: [],
        recommendations: [],
        marketOpportunities: []
      };

      // Analyze each region individually
      for (const region of regions) {
        try {
          analysis.regions[region] = await this.analyzeRegion(hotelId, region, {
            timeRange,
            currency,
            includeForecasting,
            includeCompetitorAnalysis
          });

          // Generate region-specific insights
          const regionInsights = await this.generateRegionInsights(
            hotelId, 
            region, 
            analysis.regions[region]
          );
          analysis.insights.push(...regionInsights);

        } catch (error) {
          logger.warn(`Failed to analyze region ${region}:`, error);
          analysis.regions[region] = this.getDefaultRegionData(region);
        }
      }

      // Cross-regional analysis
      analysis.crossRegionalInsights = await this.performCrossRegionalAnalysis(analysis.regions);
      analysis.recommendations = await this.generateRegionalRecommendations(analysis);
      analysis.marketOpportunities = await this.identifyMarketOpportunities(analysis.regions);

      // Cache the analysis
      await this.cacheAnalysis(cacheKey, analysis);
      
      logger.info(`Generated regional analysis for hotel ${hotelId} covering ${regions.length} regions`);
      return analysis;

    } catch (error) {
      logger.error('Error generating regional analysis:', error);
      throw new Error(`Failed to generate regional analysis: ${error.message}`);
    }
  }

  // Analyze specific region in detail
  async analyzeRegion(hotelId, region, options = {}) {
    const { timeRange, currency, includeForecasting, includeCompetitorAnalysis } = options;

    const regionData = {
      regionCode: region,
      regionName: this.getRegionName(region),
      currency: this.getRegionCurrency(region),
      timeZone: this.getRegionTimeZone(region),
      analysisDate: new Date(),
      
      // Performance metrics
      performance: await this.getRegionPerformance(hotelId, region, timeRange),
      
      // Market segments breakdown
      segments: await this.analyzeMarketSegments(hotelId, region, timeRange),
      
      // Booking patterns and trends
      bookingPatterns: await this.analyzeBookingPatterns(hotelId, region, timeRange),
      
      // Seasonal analysis
      seasonality: await this.analyzeSeasonality(hotelId, region, timeRange),
      
      // Guest behavior analysis
      guestBehavior: await this.analyzeGuestBehavior(hotelId, region, timeRange),
      
      // Economic indicators
      economicContext: await this.getEconomicContext(region),
      
      // Local market conditions
      marketConditions: await this.getMarketConditions(region),
      
      // Channel performance by region
      channelPerformance: await this.analyzeChannelPerformance(hotelId, region, timeRange)
    };

    // Optional analyses
    if (includeForecasting) {
      regionData.forecast = await this.generateRegionForecast(hotelId, region, regionData);
    }

    if (includeCompetitorAnalysis) {
      regionData.competitors = await this.analyzeCompetitors(hotelId, region);
    }

    // Calculate region score and potential
    regionData.regionScore = this.calculateRegionScore(regionData);
    regionData.growthPotential = this.assessGrowthPotential(regionData);

    return regionData;
  }

  // Get region performance metrics
  async getRegionPerformance(hotelId, region, timeRange) {
    try {
      // This would typically query booking data filtered by guest origin
      // For now, returning simulated performance data
      
      const performance = {
        totalRevenue: await this.calculateRegionRevenue(hotelId, region, timeRange),
        roomNights: await this.calculateRegionRoomNights(hotelId, region, timeRange),
        averageDailyRate: 0,
        revenuePerAvailableRoom: 0,
        occupancyContribution: 0,
        revenueShare: 0,
        guestCount: 0,
        averageStayLength: 0,
        repeatGuestRate: 0,
        cancellationRate: 0,
        noShowRate: 0,
        earlyBookingRate: 0,
        lastMinuteBookingRate: 0,
        averageLeadTime: 0
      };

      // Calculate derived metrics
      if (performance.roomNights > 0) {
        performance.averageDailyRate = performance.totalRevenue / performance.roomNights;
        performance.revenuePerAvailableRoom = performance.totalRevenue / performance.roomNights;
        performance.averageStayLength = performance.roomNights / performance.guestCount;
      }

      return performance;

    } catch (error) {
      logger.error(`Error getting region performance for ${region}:`, error);
      return this.getDefaultPerformanceMetrics();
    }
  }

  // Analyze market segments for region
  async analyzeMarketSegments(hotelId, region, timeRange) {
    const segments = {};

    for (const segment of this.marketSegments) {
      segments[segment] = {
        revenue: await this.getSegmentRevenue(hotelId, region, segment, timeRange),
        bookings: await this.getSegmentBookings(hotelId, region, segment, timeRange),
        averageRate: 0,
        marketShare: 0,
        growthRate: await this.getSegmentGrowthRate(hotelId, region, segment),
        profitability: await this.calculateSegmentProfitability(hotelId, region, segment),
        customerLifetimeValue: await this.calculateCLV(hotelId, region, segment),
        seasonalPattern: await this.getSegmentSeasonality(hotelId, region, segment)
      };

      // Calculate derived metrics
      if (segments[segment].bookings > 0) {
        segments[segment].averageRate = segments[segment].revenue / segments[segment].bookings;
      }
    }

    // Calculate market shares
    const totalRevenue = Object.values(segments).reduce((sum, s) => sum + s.revenue, 0);
    if (totalRevenue > 0) {
      for (const segment of this.marketSegments) {
        segments[segment].marketShare = (segments[segment].revenue / totalRevenue) * 100;
      }
    }

    return segments;
  }

  // Analyze booking patterns for region
  async analyzeBookingPatterns(hotelId, region, timeRange) {
    return {
      peakBookingHours: await this.getRegionPeakBookingHours(region),
      preferredChannels: await this.getRegionPreferredChannels(hotelId, region),
      averageBookingWindow: await this.getRegionBookingWindow(hotelId, region),
      paymentPreferences: await this.getRegionPaymentPreferences(hotelId, region),
      bookingBehavior: {
        directBookingRate: await this.getDirectBookingRate(hotelId, region),
        mobileBookingRate: await this.getMobileBookingRate(hotelId, region),
        groupBookingTendency: await this.getGroupBookingTendency(hotelId, region),
        lastMinuteBookingRate: await this.getLastMinuteRate(hotelId, region)
      },
      communicationPreferences: {
        preferredLanguages: await this.getLanguagePreferences(hotelId, region),
        communicationChannels: await this.getCommunicationChannelPrefs(hotelId, region),
        responseTimeExpectations: await this.getResponseTimeExpectations(region)
      }
    };
  }

  // Analyze guest behavior by region
  async analyzeGuestBehavior(hotelId, region, timeRange) {
    return {
      demographics: await this.getRegionDemographics(hotelId, region),
      preferences: {
        roomTypes: await this.getRoomTypePreferences(hotelId, region),
        amenities: await this.getAmenityPreferences(hotelId, region),
        services: await this.getServicePreferences(hotelId, region),
        dining: await this.getDiningPreferences(hotelId, region)
      },
      spending: {
        averageSpendPerStay: await this.getAverageSpend(hotelId, region),
        spendingCategories: await this.getSpendingBreakdown(hotelId, region),
        upsellConversionRate: await this.getUpsellConversion(hotelId, region),
        ancillaryRevenue: await this.getAncillaryRevenue(hotelId, region)
      },
      satisfaction: {
        averageRating: await this.getAverageRating(hotelId, region),
        reviewFrequency: await this.getReviewFrequency(hotelId, region),
        complaintRate: await this.getComplaintRate(hotelId, region),
        loyaltyEngagement: await this.getLoyaltyEngagement(hotelId, region)
      },
      culturalConsiderations: await this.getCulturalConsiderations(region)
    };
  }

  // Generate cross-regional insights
  async performCrossRegionalAnalysis(regions) {
    const insights = {
      topPerformingRegions: [],
      underperformingRegions: [],
      seasonalPatterns: {},
      channelEffectiveness: {},
      priceSensitivity: {},
      culturalInsights: {}
    };

    // Sort regions by performance
    const sortedRegions = Object.entries(regions).sort((a, b) => 
      (b[1].regionScore || 0) - (a[1].regionScore || 0)
    );

    insights.topPerformingRegions = sortedRegions.slice(0, 5).map(([region, data]) => ({
      region,
      score: data.regionScore,
      keyMetrics: {
        revenue: data.performance?.totalRevenue || 0,
        growthPotential: data.growthPotential
      }
    }));

    insights.underperformingRegions = sortedRegions.slice(-3).map(([region, data]) => ({
      region,
      score: data.regionScore,
      improvementAreas: this.identifyImprovementAreas(data)
    }));

    // Analyze seasonal patterns across regions
    for (const [region, data] of Object.entries(regions)) {
      if (data.seasonality) {
        insights.seasonalPatterns[region] = {
          peak: data.seasonality.peakSeason,
          low: data.seasonality.lowSeason,
          volatility: data.seasonality.volatilityIndex
        };
      }
    }

    return insights;
  }

  // Generate region-specific recommendations
  async generateRegionalRecommendations(analysis) {
    const recommendations = [];

    for (const [region, data] of Object.entries(analysis.regions)) {
      // Revenue optimization recommendations
      if (data.performance?.revenueShare < 5 && data.growthPotential === 'high') {
        recommendations.push({
          type: 'growth_opportunity',
          region,
          priority: 'high',
          title: `High-potential market: ${this.getRegionName(region)}`,
          description: 'Focus marketing efforts and channel optimization',
          expectedImpact: 'revenue_increase',
          estimatedGrowth: '25-40%'
        });
      }

      // Pricing strategy recommendations
      if (data.performance?.averageDailyRate < analysis.summary?.overallADR * 0.8) {
        recommendations.push({
          type: 'pricing_optimization',
          region,
          priority: 'medium',
          title: 'Below-average pricing detected',
          description: 'Consider localized pricing strategy adjustment',
          suggestedAction: 'increase_rates_gradually'
        });
      }

      // Channel optimization recommendations
      if (data.channelPerformance?.directBookingRate < 20) {
        recommendations.push({
          type: 'channel_optimization',
          region,
          priority: 'medium',
          title: 'Low direct booking rate',
          description: 'Implement targeted direct booking campaigns',
          expectedBenefit: 'reduced_commission_costs'
        });
      }

      // Cultural adaptation recommendations
      if (data.guestBehavior?.satisfaction?.averageRating < 4.0) {
        recommendations.push({
          type: 'service_improvement',
          region,
          priority: 'high',
          title: 'Below-average satisfaction scores',
          description: 'Review service delivery for cultural preferences',
          culturalConsiderations: data.guestBehavior?.culturalConsiderations
        });
      }
    }

    // Sort by priority
    return recommendations.sort((a, b) => {
      const priority = { high: 3, medium: 2, low: 1 };
      return priority[b.priority] - priority[a.priority];
    });
  }

  // Identify market opportunities across regions
  async identifyMarketOpportunities(regions) {
    const opportunities = [];

    // Look for expansion opportunities
    for (const [region, data] of Object.entries(regions)) {
      if (data.growthPotential === 'high' && data.performance?.revenueShare < 10) {
        opportunities.push({
          type: 'market_expansion',
          region,
          title: `Market Expansion: ${this.getRegionName(region)}`,
          description: 'High growth potential with low current penetration',
          marketSize: await this.estimateMarketSize(region),
          competitiveIntensity: await this.assessCompetitiveIntensity(region),
          entryBarriers: await this.assessEntryBarriers(region),
          recommendedStrategy: 'gradual_expansion',
          expectedTimeframe: '6-12 months'
        });
      }
    }

    // Look for segment opportunities
    for (const [region, data] of Object.entries(regions)) {
      if (data.segments) {
        for (const [segment, segmentData] of Object.entries(data.segments)) {
          if (segmentData.growthRate > 15 && segmentData.marketShare < 30) {
            opportunities.push({
              type: 'segment_opportunity',
              region,
              segment,
              title: `${segment} segment growth in ${this.getRegionName(region)}`,
              description: `High growth segment with expansion potential`,
              currentShare: segmentData.marketShare,
              growthRate: segmentData.growthRate,
              recommendedActions: this.getSegmentRecommendations(segment, region)
            });
          }
        }
      }
    }

    return opportunities.slice(0, 10); // Return top 10 opportunities
  }

  // Calculate region performance score
  calculateRegionScore(regionData) {
    let score = 0;
    let factors = 0;

    // Revenue performance (30% weight)
    if (regionData.performance?.totalRevenue) {
      score += Math.min(30, regionData.performance.totalRevenue / 10000);
      factors += 30;
    }

    // Growth potential (25% weight)
    const growthScores = { high: 25, medium: 15, low: 5 };
    if (regionData.growthPotential) {
      score += growthScores[regionData.growthPotential] || 10;
      factors += 25;
    }

    // Guest satisfaction (20% weight)
    if (regionData.guestBehavior?.satisfaction?.averageRating) {
      score += (regionData.guestBehavior.satisfaction.averageRating / 5) * 20;
      factors += 20;
    }

    // Market conditions (15% weight)
    if (regionData.economicContext?.stabilityIndex) {
      score += regionData.economicContext.stabilityIndex * 15;
      factors += 15;
    }

    // Operational efficiency (10% weight)
    if (regionData.performance?.cancellationRate !== undefined) {
      score += Math.max(0, (100 - regionData.performance.cancellationRate) / 10);
      factors += 10;
    }

    return factors > 0 ? Math.round((score / factors) * 100) : 50;
  }

  // Helper methods for data retrieval (real data implementations)
  async calculateRegionRevenue(hotelId, region, timeRange) {
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 90);
      }

      // Query bookings for specific region
      // We'll use guest location data from user profiles or booking data
      const bookings = await Booking.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        checkIn: { $gte: startDate, $lte: endDate },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      }).populate('userId', 'profile.location profile.country guestDetails');

      // Filter bookings by region
      const regionBookings = bookings.filter(booking => {
        // Check multiple sources for region information
        const country = booking.userId?.profile?.country ||
                       booking.guestDetails?.nationality ||
                       booking.guestDetails?.country ||
                       this.inferRegionFromBooking(booking);

        return this.isBookingFromRegion(country, region);
      });

      // Calculate total revenue for the region
      const totalRevenue = regionBookings.reduce((sum, booking) => {
        return sum + (booking.totalAmount || 0);
      }, 0);

      return Math.round(totalRevenue * 100) / 100;
    } catch (error) {
      logger.error(`Error calculating region revenue for ${region}:`, error);
      return 0;
    }
  }

  async calculateRegionRoomNights(hotelId, region, timeRange) {
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 90);
      }

      // Query bookings for specific region
      const bookings = await Booking.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        checkIn: { $gte: startDate, $lte: endDate },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      }).populate('userId', 'profile.location profile.country guestDetails');

      // Filter bookings by region and calculate room nights
      const regionRoomNights = bookings.reduce((sum, booking) => {
        const country = booking.userId?.profile?.country ||
                       booking.guestDetails?.nationality ||
                       booking.guestDetails?.country ||
                       this.inferRegionFromBooking(booking);

        if (this.isBookingFromRegion(country, region)) {
          return sum + (booking.nights || 0);
        }
        return sum;
      }, 0);

      return regionRoomNights;
    } catch (error) {
      logger.error(`Error calculating region room nights for ${region}:`, error);
      return 0;
    }
  }

  // Helper method to determine if a booking is from a specific region
  isBookingFromRegion(country, region) {
    if (!country || !region) return false;

    // Convert country to region mapping
    const regionMapping = {
      'US': ['US', 'USA', 'United States'],
      'CA': ['CA', 'Canada'],
      'MX': ['MX', 'Mexico'],
      'BR': ['BR', 'Brazil'],
      'GB': ['GB', 'UK', 'United Kingdom', 'England', 'Scotland', 'Wales'],
      'DE': ['DE', 'Germany'],
      'FR': ['FR', 'France'],
      'IT': ['IT', 'Italy'],
      'CN': ['CN', 'China'],
      'JP': ['JP', 'Japan'],
      'IN': ['IN', 'India'],
      'AU': ['AU', 'Australia']
    };

    const regionCountries = regionMapping[region] || [region];
    return regionCountries.some(c =>
      country.toLowerCase().includes(c.toLowerCase()) ||
      c.toLowerCase().includes(country.toLowerCase())
    );
  }

  // Helper method to infer region from booking data when user data is not available
  inferRegionFromBooking(booking) {
    // For demo purposes, assign regions based on booking patterns
    // In real implementation, this could use IP geolocation, payment method country, etc.
    const patterns = ['US', 'GB', 'DE', 'IN', 'AU', 'CA'];
    const index = Math.abs(booking._id.toString().charCodeAt(0)) % patterns.length;
    return patterns[index];
  }

  getRegionName(regionCode) {
    const names = {
      'US': 'United States', 'CA': 'Canada', 'MX': 'Mexico', 'BR': 'Brazil',
      'GB': 'United Kingdom', 'DE': 'Germany', 'FR': 'France', 'IT': 'Italy',
      'CN': 'China', 'JP': 'Japan', 'IN': 'India', 'AU': 'Australia'
    };
    return names[regionCode] || regionCode;
  }

  getRegionCurrency(regionCode) {
    const currencies = {
      'US': 'USD', 'CA': 'CAD', 'MX': 'MXN', 'BR': 'BRL',
      'GB': 'GBP', 'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR',
      'CN': 'CNY', 'JP': 'JPY', 'IN': 'INR', 'AU': 'AUD'
    };
    return currencies[regionCode] || 'USD';
  }

  getRegionTimeZone(regionCode) {
    const timezones = {
      'US': 'America/New_York', 'CA': 'America/Toronto',
      'GB': 'Europe/London', 'DE': 'Europe/Berlin',
      'CN': 'Asia/Shanghai', 'JP': 'Asia/Tokyo'
    };
    return timezones[regionCode] || 'UTC';
  }

  assessGrowthPotential(regionData) {
    const score = regionData.regionScore || 50;
    const revenue = regionData.performance?.totalRevenue || 0;
    
    if (score > 70 && revenue < 30000) return 'high';
    if (score > 50 && revenue < 50000) return 'medium';
    return 'low';
  }

  // Cache management
  async getCachedAnalysis(cacheKey) {
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
      logger.error('Error getting cached analysis:', error);
      return null;
    }
  }

  async cacheAnalysis(cacheKey, analysis) {
    try {
      this.cache.set(cacheKey, {
        data: analysis,
        timestamp: Date.now()
      });

      const redisClient = getRedisClient();
      if (redisClient && redisClient.isReady) {
        await redisClient.setex(cacheKey, 1800, JSON.stringify(analysis)); // 30 minutes
      }
    } catch (error) {
      logger.error('Error caching analysis:', error);
    }
  }

  // Additional helper methods would be implemented here with actual data queries
  getDefaultRegionData(region) {
    return {
      regionCode: region,
      regionName: this.getRegionName(region),
      error: 'Failed to load region data',
      regionScore: 50,
      growthPotential: 'medium'
    };
  }

  getDefaultPerformanceMetrics() {
    return {
      totalRevenue: 0,
      roomNights: 0,
      averageDailyRate: 0,
      guestCount: 0,
      averageStayLength: 0
    };
  }
}

export default new RegionalAnalyticsService();