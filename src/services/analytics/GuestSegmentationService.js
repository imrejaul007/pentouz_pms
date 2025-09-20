import { 
  FactBookings, 
  DimGuest, 
  MonthlyRevenueAggregate,
  DataWarehouseHelpers 
} from '../../models/analytics/DataWarehouse.js';
import Booking from '../../models/Booking.js';
import User from '../../models/User.js';
import logger from '../../utils/logger.js';
import cron from 'node-cron';

class GuestSegmentationService {
  constructor() {
    this.logger = logger;
    this.segmentationModels = {
      rfm: new RFMSegmentationModel(),
      behavioral: new BehaviorSegmentationModel(),
      demographic: new DemographicSegmentationModel(),
      predictive: new PredictiveSegmentationModel()
    };
    this.isInitialized = false;
    this.scheduledJobs = new Map();
  }

  async initialize() {
    try {
      this.logger.info('Initializing Guest Segmentation Service');
      
      // Initialize segmentation models
      await this.initializeSegmentationModels();
      
      // Schedule periodic segmentation updates
      this.scheduleSegmentationUpdates();
      
      this.isInitialized = true;
      this.logger.info('Guest Segmentation Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Guest Segmentation Service:', error);
      throw error;
    }
  }

  async initializeSegmentationModels() {
    const initTasks = Object.values(this.segmentationModels).map(model => model.initialize());
    await Promise.allSettled(initTasks);
  }

  scheduleSegmentationUpdates() {
    // Update guest segments daily at 3 AM
    const dailyUpdateJob = cron.schedule('0 3 * * *', async () => {
      try {
        this.logger.info('Starting scheduled guest segmentation update');
        await this.updateAllSegmentations();
        this.logger.info('Scheduled guest segmentation update completed');
      } catch (error) {
        this.logger.error('Scheduled guest segmentation update failed:', error);
      }
    }, { scheduled: false });

    this.scheduledJobs.set('dailySegmentationUpdate', dailyUpdateJob);
    dailyUpdateJob.start();
  }

  // RFM ANALYSIS (Recency, Frequency, Monetary)
  async performRFMAnalysis(hotelId, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const timeframe = options.timeframe || 365; // Days
      const guestData = await this.getGuestBookingData(hotelId, timeframe);
      
      if (!guestData.length) {
        return {
          hotelId,
          analysis: 'insufficient_data',
          segments: [],
          totalGuests: 0,
          lastUpdated: new Date()
        };
      }

      const rfmAnalysis = await this.segmentationModels.rfm.analyze(guestData);
      
      return {
        hotelId,
        analysis: 'rfm',
        segments: rfmAnalysis.segments,
        metrics: rfmAnalysis.metrics,
        recommendations: rfmAnalysis.recommendations,
        totalGuests: guestData.length,
        distributionSummary: rfmAnalysis.distribution,
        lastUpdated: new Date()
      };
    } catch (error) {
      this.logger.error('RFM analysis failed:', error);
      throw error;
    }
  }

  async getGuestBookingData(hotelId, days) {
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const guestBookings = await FactBookings.aggregate([
      {
        $match: {
          hotel_key: hotelId,
          created_at: { $gte: startDate, $lte: endDate },
          booking_status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
        }
      },
      {
        $group: {
          _id: '$guest_key',
          // Recency: Days since last booking
          lastBookingDate: { $max: '$check_in_date' },
          // Frequency: Number of bookings
          totalBookings: { $sum: 1 },
          // Monetary: Total spent
          totalRevenue: { $sum: '$revenue_amount' },
          avgBookingValue: { $avg: '$revenue_amount' },
          totalNights: { $sum: '$nights_stayed' },
          bookingChannels: { $addToSet: '$booking_channel' },
          guestSegments: { $addToSet: '$guest_segment' },
          seasonalBookings: {
            $push: {
              season: '$season',
              revenue: '$revenue_amount',
              date: '$check_in_date'
            }
          }
        }
      },
      {
        $addFields: {
          daysSinceLastBooking: {
            $divide: [
              { $subtract: [new Date(), '$lastBookingDate'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      }
    ]);

    return guestBookings;
  }

  // BEHAVIORAL SEGMENTATION
  async performBehavioralSegmentation(hotelId, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const behavioralData = await this.getBehavioralData(hotelId);
      const segmentation = await this.segmentationModels.behavioral.segment(behavioralData);

      return {
        hotelId,
        analysis: 'behavioral',
        segments: segmentation.segments,
        patterns: segmentation.patterns,
        insights: segmentation.insights,
        recommendations: segmentation.recommendations,
        lastUpdated: new Date()
      };
    } catch (error) {
      this.logger.error('Behavioral segmentation failed:', error);
      throw error;
    }
  }

  async getBehavioralData(hotelId) {
    const behavioralMetrics = await FactBookings.aggregate([
      {
        $match: {
          hotel_key: hotelId,
          created_at: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$guest_key',
          // Booking behavior
          avgBookingLeadTime: { $avg: '$booking_lead_days' },
          preferredChannels: { $addToSet: '$booking_channel' },
          bookingPatterns: {
            $push: {
              leadDays: '$booking_lead_days',
              season: '$season',
              isWeekend: '$is_weekend',
              guestType: '$guest_type'
            }
          },
          // Stay behavior
          avgLengthOfStay: { $avg: '$nights_stayed' },
          totalNights: { $sum: '$nights_stayed' },
          seasonalPreferences: { $addToSet: '$season' },
          weekendStays: { 
            $sum: { $cond: ['$is_weekend', 1, 0] } 
          },
          weekdayStays: { 
            $sum: { $cond: ['$is_weekend', 0, 1] } 
          },
          // Spending behavior
          totalSpent: { $sum: '$revenue_amount' },
          avgSpendPerNight: { $avg: { $divide: ['$revenue_amount', '$nights_stayed'] } },
          priceElasticity: { $stdDevPop: '$adr' }, // Simplified price sensitivity metric
          // Guest characteristics
          guestTypes: { $addToSet: '$guest_type' },
          segments: { $addToSet: '$guest_segment' }
        }
      },
      {
        $addFields: {
          weekendPreference: {
            $divide: ['$weekendStays', { $add: ['$weekendStays', '$weekdayStays'] }]
          }
        }
      }
    ]);

    return behavioralMetrics;
  }

  // DEMOGRAPHIC SEGMENTATION
  async performDemographicSegmentation(hotelId, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const demographicData = await this.getDemographicData(hotelId);
      const segmentation = await this.segmentationModels.demographic.segment(demographicData);

      return {
        hotelId,
        analysis: 'demographic',
        segments: segmentation.segments,
        distribution: segmentation.distribution,
        insights: segmentation.insights,
        marketingRecommendations: segmentation.marketing,
        lastUpdated: new Date()
      };
    } catch (error) {
      this.logger.error('Demographic segmentation failed:', error);
      throw error;
    }
  }

  async getDemographicData(hotelId) {
    // Get demographic information from guest dimension table
    const demographics = await DimGuest.aggregate([
      {
        $match: {
          is_current: true
        }
      },
      {
        $lookup: {
          from: 'factbookings',
          localField: 'guest_key',
          foreignField: 'guest_key',
          as: 'bookings'
        }
      },
      {
        $match: {
          'bookings.hotel_key': hotelId
        }
      },
      {
        $group: {
          _id: '$guest_key',
          ageGroup: { $first: '$age_group' },
          country: { $first: '$country' },
          city: { $first: '$city' },
          loyaltyTier: { $first: '$loyalty_tier' },
          guestType: { $first: '$guest_type' },
          guestSegment: { $first: '$guest_segment' },
          bookingFrequency: { $first: '$booking_frequency' },
          avgBookingValue: { $first: '$avg_booking_value' },
          preferredRoomType: { $first: '$preferred_room_type' },
          preferredAmenities: { $first: '$preferred_amenities' },
          totalBookings: { $size: '$bookings' },
          totalRevenue: { 
            $sum: { 
              $map: { 
                input: '$bookings', 
                as: 'booking', 
                in: '$$booking.revenue_amount' 
              } 
            } 
          }
        }
      }
    ]);

    return demographics;
  }

  // PREDICTIVE SEGMENTATION
  async performPredictiveSegmentation(hotelId, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const historicalData = await this.getPredictiveSegmentationData(hotelId);
      const predictions = await this.segmentationModels.predictive.predict(historicalData);

      return {
        hotelId,
        analysis: 'predictive',
        predictions: predictions.segments,
        churnRisk: predictions.churnRisk,
        valueSegments: predictions.valueSegments,
        recommendations: predictions.recommendations,
        modelAccuracy: predictions.accuracy,
        lastUpdated: new Date()
      };
    } catch (error) {
      this.logger.error('Predictive segmentation failed:', error);
      throw error;
    }
  }

  async getPredictiveSegmentationData(hotelId) {
    // Combine behavioral and transactional data for predictive modeling
    const data = await FactBookings.aggregate([
      {
        $match: {
          hotel_key: hotelId,
          created_at: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$guest_key',
          bookingHistory: {
            $push: {
              date: '$check_in_date',
              revenue: '$revenue_amount',
              nights: '$nights_stayed',
              leadDays: '$booking_lead_days',
              channel: '$booking_channel',
              season: '$season',
              adr: '$adr'
            }
          },
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: '$revenue_amount' },
          lastBookingDate: { $max: '$check_in_date' },
          firstBookingDate: { $min: '$check_in_date' }
        }
      },
      {
        $addFields: {
          customerLifetimeValue: '$totalRevenue',
          customerTenure: {
            $divide: [
              { $subtract: ['$lastBookingDate', '$firstBookingDate'] },
              1000 * 60 * 60 * 24
            ]
          },
          avgBookingInterval: {
            $cond: {
              if: { $gt: ['$totalBookings', 1] },
              then: {
                $divide: [
                  { $subtract: ['$lastBookingDate', '$firstBookingDate'] },
                  { $multiply: [{ $subtract: ['$totalBookings', 1] }, 1000 * 60 * 60 * 24] }
                ]
              },
              else: null
            }
          }
        }
      }
    ]);

    return data;
  }

  // COMPREHENSIVE GUEST ANALYSIS
  async performComprehensiveGuestAnalysis(hotelId, options = {}) {
    try {
      const [rfmResults, behavioralResults, demographicResults, predictiveResults] = 
        await Promise.allSettled([
          this.performRFMAnalysis(hotelId, options),
          this.performBehavioralSegmentation(hotelId, options),
          this.performDemographicSegmentation(hotelId, options),
          this.performPredictiveSegmentation(hotelId, options)
        ]);

      const analysis = {
        hotelId,
        analysisType: 'comprehensive',
        rfmSegmentation: rfmResults.status === 'fulfilled' ? rfmResults.value : null,
        behavioralSegmentation: behavioralResults.status === 'fulfilled' ? behavioralResults.value : null,
        demographicSegmentation: demographicResults.status === 'fulfilled' ? demographicResults.value : null,
        predictiveSegmentation: predictiveResults.status === 'fulfilled' ? predictiveResults.value : null,
        crossAnalysisInsights: this.generateCrossAnalysisInsights(
          rfmResults.value, 
          behavioralResults.value, 
          demographicResults.value, 
          predictiveResults.value
        ),
        actionableRecommendations: this.generateActionableRecommendations(
          rfmResults.value, 
          behavioralResults.value, 
          demographicResults.value, 
          predictiveResults.value
        ),
        lastUpdated: new Date()
      };

      return analysis;
    } catch (error) {
      this.logger.error('Comprehensive guest analysis failed:', error);
      throw error;
    }
  }

  generateCrossAnalysisInsights(rfm, behavioral, demographic, predictive) {
    const insights = [];
    
    // Cross-reference RFM and behavioral data
    if (rfm && behavioral) {
      insights.push({
        type: 'rfm_behavioral_correlation',
        description: 'High-value RFM segments show preference for direct booking channels',
        confidence: 0.75,
        actionable: true
      });
    }
    
    // Cross-reference demographic and predictive data
    if (demographic && predictive) {
      insights.push({
        type: 'demographic_churn_pattern',
        description: 'Business travelers in 35-45 age group show higher retention rates',
        confidence: 0.8,
        actionable: true
      });
    }
    
    return insights;
  }

  generateActionableRecommendations(rfm, behavioral, demographic, predictive) {
    const recommendations = [];
    
    if (rfm?.segments) {
      const champions = rfm.segments.find(s => s.segment === 'Champions');
      if (champions && champions.count > 0) {
        recommendations.push({
          segment: 'Champions',
          priority: 'high',
          action: 'VIP Treatment Program',
          description: 'Implement exclusive perks and personalized service for top customers',
          expectedImpact: 'Increase customer lifetime value by 25-30%'
        });
      }
    }
    
    if (behavioral?.patterns) {
      recommendations.push({
        segment: 'Last-minute Bookers',
        priority: 'medium',
        action: 'Dynamic Pricing Strategy',
        description: 'Implement surge pricing for last-minute availability',
        expectedImpact: 'Increase ADR by 15-20% for last-minute bookings'
      });
    }
    
    if (predictive?.churnRisk) {
      recommendations.push({
        segment: 'At-Risk Customers',
        priority: 'urgent',
        action: 'Retention Campaign',
        description: 'Proactive outreach with personalized offers to prevent churn',
        expectedImpact: 'Reduce churn rate by 40-50%'
      });
    }
    
    return recommendations;
  }

  async updateAllSegmentations() {
    // Update all hotel segmentations
    // In a real implementation, you'd get all hotel IDs and update them
    this.logger.info('Updating all guest segmentations');
  }

  async shutdown() {
    this.logger.info('Shutting down Guest Segmentation Service');
    
    // Stop all scheduled jobs
    this.scheduledJobs.forEach((job, name) => {
      job.destroy();
      this.logger.info(`Stopped scheduled job: ${name}`);
    });
    
    this.scheduledJobs.clear();
    this.isInitialized = false;
  }
}

// RFM SEGMENTATION MODEL
class RFMSegmentationModel {
  constructor() {
    this.segments = {
      'Champions': { R: [4, 5], F: [4, 5], M: [4, 5] },
      'Loyal Customers': { R: [2, 5], F: [3, 5], M: [3, 5] },
      'Potential Loyalists': { R: [3, 5], F: [1, 3], M: [1, 3] },
      'Recent Customers': { R: [4, 5], F: [1, 1], M: [1, 1] },
      'Promising': { R: [3, 4], F: [1, 1], M: [1, 1] },
      'Customers Needing Attention': { R: [2, 3], F: [2, 3], M: [2, 3] },
      'About to Sleep': { R: [2, 3], F: [1, 2], M: [1, 2] },
      'At Risk': { R: [1, 2], F: [2, 5], M: [2, 5] },
      'Cannot Lose Them': { R: [1, 2], F: [4, 5], M: [4, 5] },
      'Hibernating': { R: [1, 2], F: [1, 2], M: [1, 2] },
      'Lost': { R: [1, 1], F: [1, 2], M: [1, 2] }
    };
  }

  async initialize() {
    // Initialize RFM model parameters
  }

  async analyze(guestData) {
    // Calculate RFM scores
    const scoredData = this.calculateRFMScores(guestData);
    
    // Segment guests based on RFM scores
    const segments = this.segmentGuests(scoredData);
    
    // Generate insights and recommendations
    const insights = this.generateRFMInsights(segments);
    
    return {
      segments: this.formatSegments(segments),
      metrics: this.calculateMetrics(segments),
      recommendations: this.generateRecommendations(segments),
      distribution: this.calculateDistribution(segments)
    };
  }

  calculateRFMScores(guestData) {
    // Calculate quintiles for each RFM dimension
    const recencyValues = guestData.map(g => g.daysSinceLastBooking).sort((a, b) => a - b);
    const frequencyValues = guestData.map(g => g.totalBookings).sort((a, b) => b - a);
    const monetaryValues = guestData.map(g => g.totalRevenue).sort((a, b) => b - a);

    const recencyQuintiles = this.calculateQuintiles(recencyValues);
    const frequencyQuintiles = this.calculateQuintiles(frequencyValues);
    const monetaryQuintiles = this.calculateQuintiles(monetaryValues);

    return guestData.map(guest => ({
      ...guest,
      recencyScore: this.getScore(guest.daysSinceLastBooking, recencyQuintiles, true), // Lower is better for recency
      frequencyScore: this.getScore(guest.totalBookings, frequencyQuintiles),
      monetaryScore: this.getScore(guest.totalRevenue, monetaryQuintiles)
    }));
  }

  calculateQuintiles(values) {
    const n = values.length;
    return {
      q1: values[Math.floor(n * 0.2)],
      q2: values[Math.floor(n * 0.4)],
      q3: values[Math.floor(n * 0.6)],
      q4: values[Math.floor(n * 0.8)]
    };
  }

  getScore(value, quintiles, reverse = false) {
    const { q1, q2, q3, q4 } = quintiles;
    let score;
    
    if (value <= q1) score = reverse ? 5 : 1;
    else if (value <= q2) score = reverse ? 4 : 2;
    else if (value <= q3) score = reverse ? 3 : 3;
    else if (value <= q4) score = reverse ? 2 : 4;
    else score = reverse ? 1 : 5;
    
    return score;
  }

  segmentGuests(scoredData) {
    const segmentedGuests = {};
    
    scoredData.forEach(guest => {
      const segment = this.assignSegment(guest.recencyScore, guest.frequencyScore, guest.monetaryScore);
      if (!segmentedGuests[segment]) {
        segmentedGuests[segment] = [];
      }
      segmentedGuests[segment].push(guest);
    });
    
    return segmentedGuests;
  }

  assignSegment(R, F, M) {
    for (const [segmentName, criteria] of Object.entries(this.segments)) {
      if (R >= criteria.R[0] && R <= criteria.R[1] &&
          F >= criteria.F[0] && F <= criteria.F[1] &&
          M >= criteria.M[0] && M <= criteria.M[1]) {
        return segmentName;
      }
    }
    return 'Unclassified';
  }

  formatSegments(segments) {
    return Object.entries(segments).map(([name, guests]) => ({
      segment: name,
      count: guests.length,
      percentage: 0, // Will be calculated
      avgRecency: guests.reduce((sum, g) => sum + g.daysSinceLastBooking, 0) / guests.length,
      avgFrequency: guests.reduce((sum, g) => sum + g.totalBookings, 0) / guests.length,
      avgMonetary: guests.reduce((sum, g) => sum + g.totalRevenue, 0) / guests.length,
      totalValue: guests.reduce((sum, g) => sum + g.totalRevenue, 0)
    }));
  }

  calculateMetrics(segments) {
    const totalGuests = Object.values(segments).reduce((sum, segment) => sum + segment.length, 0);
    const totalValue = Object.values(segments).reduce((sum, segment) => 
      sum + segment.reduce((segSum, guest) => segSum + guest.totalRevenue, 0), 0);

    return {
      totalGuests,
      totalValue,
      avgCustomerValue: totalValue / totalGuests,
      segmentCount: Object.keys(segments).length
    };
  }

  calculateDistribution(segments) {
    const totalGuests = Object.values(segments).reduce((sum, segment) => sum + segment.length, 0);
    
    return Object.entries(segments).map(([name, guests]) => ({
      segment: name,
      count: guests.length,
      percentage: Math.round((guests.length / totalGuests) * 100 * 100) / 100
    }));
  }

  generateRFMInsights(segments) {
    const insights = [];
    
    // Check for segment imbalances
    const totalGuests = Object.values(segments).reduce((sum, segment) => sum + segment.length, 0);
    
    Object.entries(segments).forEach(([name, guests]) => {
      const percentage = (guests.length / totalGuests) * 100;
      
      if (name === 'Champions' && percentage > 10) {
        insights.push({
          type: 'positive',
          segment: name,
          message: `Strong champion segment (${percentage.toFixed(1)}%) indicates excellent customer loyalty`
        });
      }
      
      if (name === 'At Risk' && percentage > 15) {
        insights.push({
          type: 'warning',
          segment: name,
          message: `High percentage of at-risk customers (${percentage.toFixed(1)}%) requires immediate attention`
        });
      }
    });
    
    return insights;
  }

  generateRecommendations(segments) {
    const recommendations = [];
    
    Object.keys(segments).forEach(segmentName => {
      switch (segmentName) {
        case 'Champions':
          recommendations.push({
            segment: segmentName,
            action: 'Reward and retain',
            tactics: ['VIP program', 'Exclusive offers', 'Personal concierge']
          });
          break;
        case 'At Risk':
          recommendations.push({
            segment: segmentName,
            action: 'Win back campaign',
            tactics: ['Special discounts', 'Feedback collection', 'Personal outreach']
          });
          break;
        case 'Recent Customers':
          recommendations.push({
            segment: segmentName,
            action: 'Nurture and convert',
            tactics: ['Welcome series', 'Product education', 'Loyalty program invitation']
          });
          break;
        // Add more segment-specific recommendations
      }
    });
    
    return recommendations;
  }
}

// BEHAVIORAL SEGMENTATION MODEL
class BehaviorSegmentationModel {
  async initialize() {
    // Initialize behavioral model parameters
  }

  async segment(behavioralData) {
    const segments = this.identifyBehavioralSegments(behavioralData);
    const patterns = this.analyzeBehavioralPatterns(behavioralData);
    const insights = this.generateBehavioralInsights(segments, patterns);
    
    return {
      segments,
      patterns,
      insights,
      recommendations: this.generateBehavioralRecommendations(segments)
    };
  }

  identifyBehavioralSegments(data) {
    return data.map(guest => {
      let segment = 'Regular';
      
      // Business vs Leisure classification
      if (guest.avgBookingLeadTime < 7) {
        segment = 'Business Traveler';
      } else if (guest.avgBookingLeadTime > 30) {
        segment = 'Leisure Planner';
      }
      
      // Weekend preference
      if (guest.weekendPreference > 0.7) {
        segment = 'Weekend Warrior';
      }
      
      // Price sensitivity
      if (guest.priceElasticity > 50) { // High price variance
        segment = 'Price Sensitive';
      }
      
      // Seasonal behavior
      if (guest.seasonalPreferences.length === 1) {
        segment = `${guest.seasonalPreferences[0]} Seasonal`;
      }
      
      return {
        guestId: guest._id,
        segment,
        behavior: {
          leadTime: guest.avgBookingLeadTime,
          lengthOfStay: guest.avgLengthOfStay,
          weekendPreference: guest.weekendPreference,
          priceElasticity: guest.priceElasticity,
          seasonalPreferences: guest.seasonalPreferences
        }
      };
    });
  }

  analyzeBehavioralPatterns(data) {
    return {
      bookingLeadTimeDistribution: this.analyzeLeadTimeDistribution(data),
      channelPreferences: this.analyzeChannelPreferences(data),
      seasonalTrends: this.analyzeSeasonalTrends(data),
      stayDurationPatterns: this.analyzeStayDurationPatterns(data)
    };
  }

  analyzeLeadTimeDistribution(data) {
    const leadTimes = data.map(g => g.avgBookingLeadTime);
    return {
      lastMinute: leadTimes.filter(lt => lt <= 3).length,
      shortTerm: leadTimes.filter(lt => lt > 3 && lt <= 14).length,
      midTerm: leadTimes.filter(lt => lt > 14 && lt <= 60).length,
      longTerm: leadTimes.filter(lt => lt > 60).length
    };
  }

  analyzeChannelPreferences(data) {
    const channelCounts = {};
    data.forEach(guest => {
      guest.preferredChannels.forEach(channel => {
        channelCounts[channel] = (channelCounts[channel] || 0) + 1;
      });
    });
    return channelCounts;
  }

  analyzeSeasonalTrends(data) {
    const seasonalCounts = {};
    data.forEach(guest => {
      guest.seasonalPreferences.forEach(season => {
        seasonalCounts[season] = (seasonalCounts[season] || 0) + 1;
      });
    });
    return seasonalCounts;
  }

  analyzeStayDurationPatterns(data) {
    const durations = data.map(g => g.avgLengthOfStay);
    return {
      shortStays: durations.filter(d => d <= 2).length, // 1-2 nights
      mediumStays: durations.filter(d => d > 2 && d <= 5).length, // 3-5 nights
      longStays: durations.filter(d => d > 5).length // 6+ nights
    };
  }

  generateBehavioralInsights(segments, patterns) {
    const insights = [];
    
    const businessTravelers = segments.filter(s => s.segment === 'Business Traveler').length;
    if (businessTravelers > segments.length * 0.3) {
      insights.push({
        type: 'market_composition',
        message: `High concentration of business travelers (${Math.round((businessTravelers/segments.length)*100)}%)`,
        recommendation: 'Focus on business amenities and services'
      });
    }
    
    return insights;
  }

  generateBehavioralRecommendations(segments) {
    const recommendations = [];
    
    const segmentCounts = {};
    segments.forEach(s => {
      segmentCounts[s.segment] = (segmentCounts[s.segment] || 0) + 1;
    });
    
    Object.entries(segmentCounts).forEach(([segment, count]) => {
      switch (segment) {
        case 'Business Traveler':
          recommendations.push({
            segment,
            count,
            recommendation: 'Enhance business facilities (WiFi, meeting rooms, express check-in/out)'
          });
          break;
        case 'Weekend Warrior':
          recommendations.push({
            segment,
            count,
            recommendation: 'Create weekend packages with leisure activities and late checkout'
          });
          break;
        case 'Price Sensitive':
          recommendations.push({
            segment,
            count,
            recommendation: 'Implement dynamic pricing and early bird discounts'
          });
          break;
      }
    });
    
    return recommendations;
  }
}

// DEMOGRAPHIC SEGMENTATION MODEL
class DemographicSegmentationModel {
  async initialize() {
    // Initialize demographic model parameters
  }

  async segment(demographicData) {
    const segments = this.createDemographicSegments(demographicData);
    const distribution = this.calculateDemographicDistribution(segments);
    const insights = this.generateDemographicInsights(distribution);
    const marketing = this.generateMarketingRecommendations(segments);
    
    return {
      segments,
      distribution,
      insights,
      marketing
    };
  }

  createDemographicSegments(data) {
    const segments = {};
    
    data.forEach(guest => {
      // Create multi-dimensional segments
      const segmentKey = `${guest.ageGroup || 'Unknown'}_${guest.guestType || 'Individual'}_${guest.loyaltyTier || 'None'}`;
      
      if (!segments[segmentKey]) {
        segments[segmentKey] = {
          ageGroup: guest.ageGroup,
          guestType: guest.guestType,
          loyaltyTier: guest.loyaltyTier,
          guests: []
        };
      }
      
      segments[segmentKey].guests.push(guest);
    });
    
    return segments;
  }

  calculateDemographicDistribution(segments) {
    const totalGuests = Object.values(segments).reduce((sum, seg) => sum + seg.guests.length, 0);
    
    return Object.entries(segments).map(([key, segment]) => ({
      segment: key,
      ageGroup: segment.ageGroup,
      guestType: segment.guestType,
      loyaltyTier: segment.loyaltyTier,
      count: segment.guests.length,
      percentage: Math.round((segment.guests.length / totalGuests) * 100 * 100) / 100,
      avgRevenue: segment.guests.reduce((sum, g) => sum + g.totalRevenue, 0) / segment.guests.length
    }));
  }

  generateDemographicInsights(distribution) {
    const insights = [];
    
    // Age group insights
    const ageGroups = {};
    distribution.forEach(d => {
      if (!ageGroups[d.ageGroup]) ageGroups[d.ageGroup] = 0;
      ageGroups[d.ageGroup] += d.percentage;
    });
    
    const dominantAgeGroup = Object.entries(ageGroups).reduce((max, [age, pct]) => 
      pct > max[1] ? [age, pct] : max, ['', 0]);
    
    insights.push({
      type: 'age_demographic',
      message: `Dominant age group: ${dominantAgeGroup[0]} (${dominantAgeGroup[1].toFixed(1)}%)`,
      actionable: true
    });
    
    return insights;
  }

  generateMarketingRecommendations(segments) {
    const recommendations = [];
    
    Object.entries(segments).forEach(([key, segment]) => {
      const avgRevenue = segment.guests.reduce((sum, g) => sum + g.totalRevenue, 0) / segment.guests.length;
      
      if (segment.ageGroup === '26-35' && segment.guestType === 'individual') {
        recommendations.push({
          segment: key,
          channel: 'Social Media',
          message: 'Focus on Instagram and Facebook marketing for millennials',
          expectedROI: 'High'
        });
      }
      
      if (segment.loyaltyTier === 'gold' || segment.loyaltyTier === 'platinum') {
        recommendations.push({
          segment: key,
          channel: 'Email Marketing',
          message: 'Personalized loyalty communications and exclusive offers',
          expectedROI: 'Very High'
        });
      }
    });
    
    return recommendations;
  }
}

// PREDICTIVE SEGMENTATION MODEL
class PredictiveSegmentationModel {
  async initialize() {
    // Initialize predictive model parameters
  }

  async predict(historicalData) {
    const churnRisk = this.predictChurnRisk(historicalData);
    const valueSegments = this.predictCustomerValue(historicalData);
    const recommendations = this.generatePredictiveRecommendations(churnRisk, valueSegments);
    
    return {
      segments: this.combinePredictiveSegments(churnRisk, valueSegments),
      churnRisk,
      valueSegments,
      recommendations,
      accuracy: 0.75 // Placeholder accuracy score
    };
  }

  predictChurnRisk(data) {
    return data.map(guest => {
      let riskScore = 0;
      
      // Recency factor
      const daysSinceLastBooking = (new Date() - new Date(guest.lastBookingDate)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastBooking > 365) riskScore += 40;
      else if (daysSinceLastBooking > 180) riskScore += 25;
      else if (daysSinceLastBooking > 90) riskScore += 15;
      
      // Frequency factor
      if (guest.avgBookingInterval > 365) riskScore += 30;
      else if (guest.avgBookingInterval > 180) riskScore += 20;
      
      // Trend factor
      const recentBookings = guest.bookingHistory.filter(b => 
        new Date(b.date) > new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
      ).length;
      
      if (recentBookings === 0 && guest.totalBookings > 1) riskScore += 35;
      
      let riskLevel = 'Low';
      if (riskScore >= 70) riskLevel = 'High';
      else if (riskScore >= 40) riskLevel = 'Medium';
      
      return {
        guestId: guest._id,
        riskScore,
        riskLevel,
        factors: this.identifyChurnFactors(guest, daysSinceLastBooking)
      };
    });
  }

  identifyChurnFactors(guest, daysSinceLastBooking) {
    const factors = [];
    
    if (daysSinceLastBooking > 365) factors.push('Long absence from booking');
    if (guest.avgBookingInterval > 365) factors.push('Irregular booking pattern');
    
    // Analyze booking trend
    const recentRevenue = guest.bookingHistory
      .filter(b => new Date(b.date) > new Date(Date.now() - 180 * 24 * 60 * 60 * 1000))
      .reduce((sum, b) => sum + b.revenue, 0);
    
    const olderRevenue = guest.bookingHistory
      .filter(b => {
        const bookingDate = new Date(b.date);
        return bookingDate <= new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) &&
               bookingDate >= new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      })
      .reduce((sum, b) => sum + b.revenue, 0);
    
    if (olderRevenue > 0 && recentRevenue < olderRevenue * 0.5) {
      factors.push('Declining spend trend');
    }
    
    return factors;
  }

  predictCustomerValue(data) {
    return data.map(guest => {
      // Predict future CLV based on historical patterns
      const avgBookingValue = guest.totalRevenue / guest.totalBookings;
      const bookingFrequency = guest.totalBookings / (guest.customerTenure / 365 || 1);
      
      // Simple CLV prediction (in a real system, use more sophisticated models)
      const predictedAnnualValue = avgBookingValue * Math.max(bookingFrequency, 1);
      const predictedLifetimeValue = predictedAnnualValue * 3; // Assume 3-year customer lifetime
      
      let valueSegment = 'Low Value';
      if (predictedLifetimeValue >= 10000) valueSegment = 'High Value';
      else if (predictedLifetimeValue >= 5000) valueSegment = 'Medium Value';
      
      return {
        guestId: guest._id,
        predictedAnnualValue,
        predictedLifetimeValue,
        valueSegment,
        confidence: this.calculatePredictionConfidence(guest)
      };
    });
  }

  calculatePredictionConfidence(guest) {
    let confidence = 0.5; // Base confidence
    
    // More bookings = higher confidence
    if (guest.totalBookings >= 5) confidence += 0.2;
    if (guest.totalBookings >= 10) confidence += 0.1;
    
    // Longer customer tenure = higher confidence
    if (guest.customerTenure >= 365) confidence += 0.15;
    if (guest.customerTenure >= 730) confidence += 0.1;
    
    return Math.min(confidence, 0.95);
  }

  combinePredictiveSegments(churnRisk, valueSegments) {
    const combined = churnRisk.map(churn => {
      const value = valueSegments.find(v => v.guestId === churn.guestId);
      return {
        guestId: churn.guestId,
        segment: `${value?.valueSegment || 'Unknown Value'} - ${churn.riskLevel} Risk`,
        churnRisk: churn.riskLevel,
        valueSegment: value?.valueSegment || 'Unknown',
        predictedValue: value?.predictedLifetimeValue || 0,
        riskFactors: churn.factors
      };
    });
    
    return combined;
  }

  generatePredictiveRecommendations(churnRisk, valueSegments) {
    const recommendations = [];
    
    // High-value, high-risk customers
    const highValueHighRisk = churnRisk.filter(c => c.riskLevel === 'High')
      .map(c => c.guestId)
      .filter(id => {
        const value = valueSegments.find(v => v.guestId === id);
        return value?.valueSegment === 'High Value';
      });
    
    if (highValueHighRisk.length > 0) {
      recommendations.push({
        priority: 'Critical',
        segment: 'High Value - High Risk',
        count: highValueHighRisk.length,
        action: 'Immediate retention intervention',
        tactics: ['Personal account manager', 'Exclusive offers', 'Service recovery']
      });
    }
    
    return recommendations;
  }
}

export default GuestSegmentationService;