import GuestCRMProfile from '../models/GuestCRMProfile.js';
import GuestBehavior from '../models/GuestBehavior.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';

class SmartSegmentationService {
  constructor() {
    this.segmentationRules = new Map();
    this.behavioralPatterns = new Map();
    this.initializeSegmentationRules();
  }

  initializeSegmentationRules() {
    // Define advanced segmentation rules beyond basic RFM
    this.segmentationRules.set('high_value_prospects', {
      name: 'High Value Prospects',
      description: 'New customers with high spending potential',
      criteria: {
        recencyScore: { min: 4 },
        frequencyScore: { max: 2 },
        monetaryScore: { min: 3 },
        lifecycleStage: ['prospect', 'new_customer'],
        behaviorPatterns: ['high_engagement', 'premium_interest']
      },
      actions: ['vip_onboarding', 'premium_offers', 'personal_attention']
    });

    this.segmentationRules.set('loyalty_builders', {
      name: 'Loyalty Builders',
      description: 'Active customers ready for loyalty program',
      criteria: {
        frequencyScore: { min: 3 },
        engagementScore: { min: 60 },
        daysSinceFirst: { min: 30, max: 180 },
        totalBookings: { min: 2, max: 5 }
      },
      actions: ['loyalty_invitation', 'reward_programs', 'exclusive_access']
    });

    this.segmentationRules.set('seasonal_bookers', {
      name: 'Seasonal Bookers',
      description: 'Customers with seasonal booking patterns',
      criteria: {
        bookingSeasonality: true,
        frequencyScore: { min: 2 },
        avgDaysBetweenBookings: { min: 60, max: 365 }
      },
      actions: ['seasonal_campaigns', 'early_bird_offers', 'reminder_campaigns']
    });

    this.segmentationRules.set('business_travelers', {
      name: 'Business Travelers',
      description: 'Frequent business travel customers',
      criteria: {
        bookingPatterns: ['weekday_heavy', 'short_stay', 'advance_booking'],
        averageStayDuration: { max: 3 },
        bookingLeadTime: { min: 7 }
      },
      actions: ['corporate_rates', 'business_amenities', 'express_services']
    });

    this.segmentationRules.set('weekend_warriors', {
      name: 'Weekend Warriors',
      description: 'Leisure customers who book weekends',
      criteria: {
        bookingPatterns: ['weekend_heavy', 'leisure_stays'],
        averageStayDuration: { min: 2 },
        bookingDaysOfWeek: [5, 6, 0] // Friday, Saturday, Sunday
      },
      actions: ['weekend_packages', 'leisure_activities', 'extended_stay_offers']
    });

    this.segmentationRules.set('price_sensitive', {
      name: 'Price Sensitive',
      description: 'Customers who respond to discounts',
      criteria: {
        discountResponseRate: { min: 0.7 },
        averageBookingValue: { max: 200 },
        behaviorPatterns: ['deal_seeker', 'comparison_shopper']
      },
      actions: ['discount_campaigns', 'value_packages', 'early_bird_specials']
    });

    this.segmentationRules.set('luxury_seekers', {
      name: 'Luxury Seekers',
      description: 'High-end customers seeking premium experiences',
      criteria: {
        monetaryScore: { min: 4 },
        roomTypePreference: ['suite', 'executive', 'premium'],
        averageBookingValue: { min: 500 }
      },
      actions: ['luxury_offerings', 'concierge_services', 'exclusive_experiences']
    });
  }

  async performAdvancedSegmentation(hotelId, options = {}) {
    try {
      const profiles = await GuestCRMProfile.find({ hotelId })
        .populate('userId', 'firstName lastName email createdAt');

      const segmentResults = new Map();
      const profileAnalytics = await this.calculateProfileAnalytics(profiles);

      for (const profile of profiles) {
        const analytics = profileAnalytics.get(profile._id.toString());
        const segments = await this.classifyProfile(profile, analytics);

        for (const segment of segments) {
          if (!segmentResults.has(segment)) {
            segmentResults.set(segment, []);
          }
          segmentResults.get(segment).push({
            profile,
            analytics,
            confidence: this.calculateSegmentConfidence(profile, analytics, segment)
          });
        }
      }

      // Sort segments by confidence
      for (const [segment, members] of segmentResults) {
        members.sort((a, b) => b.confidence - a.confidence);
      }

      return {
        totalProfiles: profiles.length,
        segments: Object.fromEntries(segmentResults),
        segmentDistribution: this.calculateSegmentDistribution(segmentResults),
        recommendations: this.generateSegmentRecommendations(segmentResults)
      };

    } catch (error) {
      console.error('Error in advanced segmentation:', error);
      throw error;
    }
  }

  async calculateProfileAnalytics(profiles) {
    const analytics = new Map();

    for (const profile of profiles) {
      try {
        // Get booking patterns
        const bookings = await Booking.find({
          userId: profile.userId,
          hotelId: profile.hotelId,
          status: { $in: ['confirmed', 'checked-in', 'checked-out'] }
        }).sort({ createdAt: 1 });

        // Get behavioral data
        const behaviors = await GuestBehavior.find({
          userId: profile.userId,
          hotelId: profile.hotelId
        }).sort({ timestamp: -1 }).limit(100);

        const profileAnalytics = {
          // Booking patterns
          totalBookings: bookings.length,
          averageBookingValue: bookings.length > 0
            ? bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0) / bookings.length
            : 0,
          averageStayDuration: this.calculateAverageStayDuration(bookings),
          bookingFrequency: this.calculateBookingFrequency(bookings),
          seasonalityPattern: this.analyzeSeasonality(bookings),
          dayOfWeekPattern: this.analyzeDayOfWeekPattern(bookings),
          bookingLeadTime: this.calculateAverageLeadTime(bookings),
          roomTypePreferences: this.analyzeRoomTypePreferences(bookings),

          // Behavioral patterns
          engagementScore: profile.engagementMetrics.averageEngagementScore || 0,
          behaviorTypes: this.analyzeBehaviorTypes(behaviors),
          devicePreferences: this.analyzeDeviceUsage(behaviors),
          sourceChannels: this.analyzeSourceChannels(behaviors),
          interactionPatterns: this.analyzeInteractionPatterns(behaviors),

          // Financial patterns
          totalLifetimeValue: profile.engagementMetrics.totalSpending || 0,
          averageOrderValue: profile.engagementMetrics.averageBookingValue || 0,
          discountUsage: this.analyzeDiscountUsage(bookings),

          // Temporal patterns
          daysSinceFirstBooking: this.calculateDaysSinceFirst(bookings),
          daysSinceLastBooking: profile.rfmAnalysis.recency.value,
          bookingVelocity: this.calculateBookingVelocity(bookings)
        };

        analytics.set(profile._id.toString(), profileAnalytics);

      } catch (error) {
        console.error(`Error calculating analytics for profile ${profile._id}:`, error);
        analytics.set(profile._id.toString(), {});
      }
    }

    return analytics;
  }

  async classifyProfile(profile, analytics) {
    const segments = [];

    for (const [ruleId, rule] of this.segmentationRules) {
      if (this.profileMatchesRule(profile, analytics, rule)) {
        segments.push(ruleId);
      }
    }

    // Add dynamic segments based on behavior
    const dynamicSegments = this.identifyDynamicSegments(profile, analytics);
    segments.push(...dynamicSegments);

    return segments;
  }

  profileMatchesRule(profile, analytics, rule) {
    const criteria = rule.criteria;

    // Check RFM scores
    if (criteria.recencyScore) {
      const score = profile.rfmAnalysis.recency.score;
      if (criteria.recencyScore.min && score < criteria.recencyScore.min) return false;
      if (criteria.recencyScore.max && score > criteria.recencyScore.max) return false;
    }

    if (criteria.frequencyScore) {
      const score = profile.rfmAnalysis.frequency.score;
      if (criteria.frequencyScore.min && score < criteria.frequencyScore.min) return false;
      if (criteria.frequencyScore.max && score > criteria.frequencyScore.max) return false;
    }

    if (criteria.monetaryScore) {
      const score = profile.rfmAnalysis.monetary.score;
      if (criteria.monetaryScore.min && score < criteria.monetaryScore.min) return false;
      if (criteria.monetaryScore.max && score > criteria.monetaryScore.max) return false;
    }

    // Check lifecycle stage
    if (criteria.lifecycleStage && !criteria.lifecycleStage.includes(profile.lifecycleStage)) {
      return false;
    }

    // Check engagement score
    if (criteria.engagementScore) {
      const score = analytics.engagementScore;
      if (criteria.engagementScore.min && score < criteria.engagementScore.min) return false;
      if (criteria.engagementScore.max && score > criteria.engagementScore.max) return false;
    }

    // Check booking patterns
    if (criteria.totalBookings) {
      const total = analytics.totalBookings;
      if (criteria.totalBookings.min && total < criteria.totalBookings.min) return false;
      if (criteria.totalBookings.max && total > criteria.totalBookings.max) return false;
    }

    if (criteria.averageBookingValue) {
      const avg = analytics.averageBookingValue;
      if (criteria.averageBookingValue.min && avg < criteria.averageBookingValue.min) return false;
      if (criteria.averageBookingValue.max && avg > criteria.averageBookingValue.max) return false;
    }

    if (criteria.averageStayDuration) {
      const duration = analytics.averageStayDuration;
      if (criteria.averageStayDuration.min && duration < criteria.averageStayDuration.min) return false;
      if (criteria.averageStayDuration.max && duration > criteria.averageStayDuration.max) return false;
    }

    // Check room type preferences
    if (criteria.roomTypePreference) {
      const preferences = analytics.roomTypePreferences || {};
      const hasPreference = criteria.roomTypePreference.some(type =>
        preferences[type] && preferences[type] > 0
      );
      if (!hasPreference) return false;
    }

    return true;
  }

  identifyDynamicSegments(profile, analytics) {
    const segments = [];

    // Identify churning customers
    if (analytics.daysSinceLastBooking > 180 && analytics.totalBookings > 2) {
      segments.push('churn_risk');
    }

    // Identify VIP potential
    if (analytics.averageBookingValue > 300 && analytics.engagementScore > 80) {
      segments.push('vip_potential');
    }

    // Identify mobile-first users
    if (analytics.devicePreferences && analytics.devicePreferences.mobile > 0.7) {
      segments.push('mobile_first');
    }

    // Identify direct bookers
    if (analytics.sourceChannels && analytics.sourceChannels.direct > 0.8) {
      segments.push('direct_booker');
    }

    // Identify repeat bookers
    if (analytics.totalBookings > 5 && analytics.bookingVelocity > 0.5) {
      segments.push('repeat_booker');
    }

    return segments;
  }

  calculateSegmentConfidence(profile, analytics, segment) {
    const rule = this.segmentationRules.get(segment);
    if (!rule) return 0.5; // Default confidence for dynamic segments

    let confidence = 0;
    let criteriaCount = 0;

    // Calculate confidence based on how well the profile matches criteria
    const criteria = rule.criteria;

    if (criteria.recencyScore) {
      criteriaCount++;
      const score = profile.rfmAnalysis.recency.score;
      confidence += this.calculateScoreConfidence(score, criteria.recencyScore);
    }

    if (criteria.frequencyScore) {
      criteriaCount++;
      const score = profile.rfmAnalysis.frequency.score;
      confidence += this.calculateScoreConfidence(score, criteria.frequencyScore);
    }

    if (criteria.monetaryScore) {
      criteriaCount++;
      const score = profile.rfmAnalysis.monetary.score;
      confidence += this.calculateScoreConfidence(score, criteria.monetaryScore);
    }

    if (criteria.engagementScore) {
      criteriaCount++;
      const score = analytics.engagementScore;
      confidence += this.calculateScoreConfidence(score, criteria.engagementScore);
    }

    return criteriaCount > 0 ? confidence / criteriaCount : 0.5;
  }

  calculateScoreConfidence(value, range) {
    if (range.min !== undefined && range.max !== undefined) {
      const mid = (range.min + range.max) / 2;
      const distance = Math.abs(value - mid);
      const maxDistance = (range.max - range.min) / 2;
      return Math.max(0, 1 - (distance / maxDistance));
    } else if (range.min !== undefined) {
      return value >= range.min ? Math.min(1, (value - range.min + 1) / 5) : 0;
    } else if (range.max !== undefined) {
      return value <= range.max ? Math.min(1, (range.max - value + 1) / 5) : 0;
    }
    return 0.5;
  }

  // Helper functions for analytics calculation
  calculateAverageStayDuration(bookings) {
    if (bookings.length === 0) return 0;

    const totalDuration = bookings.reduce((sum, booking) => {
      if (booking.checkInDate && booking.checkOutDate) {
        const duration = (new Date(booking.checkOutDate) - new Date(booking.checkInDate)) / (1000 * 60 * 60 * 24);
        return sum + duration;
      }
      return sum;
    }, 0);

    return totalDuration / bookings.length;
  }

  calculateBookingFrequency(bookings) {
    if (bookings.length <= 1) return 0;

    const firstBooking = bookings[0];
    const lastBooking = bookings[bookings.length - 1];
    const daysBetween = (new Date(lastBooking.createdAt) - new Date(firstBooking.createdAt)) / (1000 * 60 * 60 * 24);

    return daysBetween > 0 ? bookings.length / (daysBetween / 365) : 0; // Bookings per year
  }

  analyzeSeasonality(bookings) {
    const seasonCounts = { spring: 0, summer: 0, fall: 0, winter: 0 };

    bookings.forEach(booking => {
      if (booking.checkInDate) {
        const month = new Date(booking.checkInDate).getMonth();
        if (month >= 2 && month <= 4) seasonCounts.spring++;
        else if (month >= 5 && month <= 7) seasonCounts.summer++;
        else if (month >= 8 && month <= 10) seasonCounts.fall++;
        else seasonCounts.winter++;
      }
    });

    return seasonCounts;
  }

  analyzeDayOfWeekPattern(bookings) {
    const dayPattern = new Array(7).fill(0);

    bookings.forEach(booking => {
      if (booking.checkInDate) {
        const dayOfWeek = new Date(booking.checkInDate).getDay();
        dayPattern[dayOfWeek]++;
      }
    });

    return dayPattern;
  }

  calculateAverageLeadTime(bookings) {
    if (bookings.length === 0) return 0;

    const leadTimes = bookings.filter(booking => booking.checkInDate && booking.createdAt)
      .map(booking => {
        const leadTime = (new Date(booking.checkInDate) - new Date(booking.createdAt)) / (1000 * 60 * 60 * 24);
        return Math.max(0, leadTime);
      });

    return leadTimes.length > 0 ? leadTimes.reduce((sum, time) => sum + time, 0) / leadTimes.length : 0;
  }

  analyzeRoomTypePreferences(bookings) {
    const preferences = {};

    bookings.forEach(booking => {
      if (booking.roomType) {
        preferences[booking.roomType] = (preferences[booking.roomType] || 0) + 1;
      }
    });

    return preferences;
  }

  analyzeBehaviorTypes(behaviors) {
    const types = {};

    behaviors.forEach(behavior => {
      types[behavior.behaviorType] = (types[behavior.behaviorType] || 0) + 1;
    });

    return types;
  }

  analyzeDeviceUsage(behaviors) {
    const devices = {};
    const total = behaviors.length;

    behaviors.forEach(behavior => {
      devices[behavior.deviceType] = (devices[behavior.deviceType] || 0) + 1;
    });

    // Convert to percentages
    Object.keys(devices).forEach(device => {
      devices[device] = devices[device] / total;
    });

    return devices;
  }

  analyzeSourceChannels(behaviors) {
    const sources = {};
    const total = behaviors.length;

    behaviors.forEach(behavior => {
      sources[behavior.source] = (sources[behavior.source] || 0) + 1;
    });

    // Convert to percentages
    Object.keys(sources).forEach(source => {
      sources[source] = sources[source] / total;
    });

    return sources;
  }

  analyzeInteractionPatterns(behaviors) {
    if (behaviors.length === 0) return {};

    const patterns = {
      avgEngagementScore: behaviors.reduce((sum, b) => sum + b.engagementScore, 0) / behaviors.length,
      mostActiveHours: this.findMostActiveHours(behaviors),
      sessionDuration: this.calculateAverageSessionDuration(behaviors),
      bounceRate: this.calculateBounceRate(behaviors)
    };

    return patterns;
  }

  findMostActiveHours(behaviors) {
    const hours = new Array(24).fill(0);

    behaviors.forEach(behavior => {
      const hour = new Date(behavior.timestamp).getHours();
      hours[hour]++;
    });

    const maxCount = Math.max(...hours);
    return hours.map((count, hour) => ({ hour, count }))
      .filter(h => h.count === maxCount)
      .map(h => h.hour);
  }

  calculateAverageSessionDuration(behaviors) {
    const sessions = {};

    behaviors.forEach(behavior => {
      if (!sessions[behavior.sessionId]) {
        sessions[behavior.sessionId] = [];
      }
      sessions[behavior.sessionId].push(behavior.timestamp);
    });

    const durations = Object.values(sessions).map(timestamps => {
      if (timestamps.length <= 1) return 0;
      const sorted = timestamps.sort((a, b) => new Date(a) - new Date(b));
      return (new Date(sorted[sorted.length - 1]) - new Date(sorted[0])) / (1000 * 60); // Minutes
    });

    return durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
  }

  calculateBounceRate(behaviors) {
    const sessions = {};

    behaviors.forEach(behavior => {
      sessions[behavior.sessionId] = (sessions[behavior.sessionId] || 0) + 1;
    });

    const totalSessions = Object.keys(sessions).length;
    const bouncedSessions = Object.values(sessions).filter(count => count === 1).length;

    return totalSessions > 0 ? bouncedSessions / totalSessions : 0;
  }

  analyzeDiscountUsage(bookings) {
    const discountedBookings = bookings.filter(booking =>
      booking.discountAmount && booking.discountAmount > 0
    );

    return {
      usageRate: bookings.length > 0 ? discountedBookings.length / bookings.length : 0,
      averageDiscount: discountedBookings.length > 0
        ? discountedBookings.reduce((sum, b) => sum + b.discountAmount, 0) / discountedBookings.length
        : 0
    };
  }

  calculateDaysSinceFirst(bookings) {
    if (bookings.length === 0) return 0;

    const firstBooking = bookings[0];
    return Math.floor((new Date() - new Date(firstBooking.createdAt)) / (1000 * 60 * 60 * 24));
  }

  calculateBookingVelocity(bookings) {
    if (bookings.length <= 1) return 0;

    const intervals = [];
    for (let i = 1; i < bookings.length; i++) {
      const daysBetween = (new Date(bookings[i].createdAt) - new Date(bookings[i-1].createdAt)) / (1000 * 60 * 60 * 24);
      intervals.push(daysBetween);
    }

    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    return averageInterval > 0 ? 365 / averageInterval : 0; // Bookings per year
  }

  calculateSegmentDistribution(segmentResults) {
    const distribution = {};
    let total = 0;

    for (const [segment, members] of segmentResults) {
      distribution[segment] = members.length;
      total += members.length;
    }

    // Convert to percentages
    Object.keys(distribution).forEach(segment => {
      distribution[segment] = {
        count: distribution[segment],
        percentage: total > 0 ? (distribution[segment] / total) * 100 : 0
      };
    });

    return distribution;
  }

  generateSegmentRecommendations(segmentResults) {
    const recommendations = [];

    for (const [segment, members] of segmentResults) {
      const rule = this.segmentationRules.get(segment);
      if (rule && members.length > 0) {
        recommendations.push({
          segment,
          name: rule.name,
          memberCount: members.length,
          averageConfidence: members.reduce((sum, m) => sum + m.confidence, 0) / members.length,
          recommendedActions: rule.actions,
          priority: this.calculateSegmentPriority(segment, members)
        });
      }
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  calculateSegmentPriority(segment, members) {
    const highValueSegments = ['high_value_prospects', 'luxury_seekers', 'vip_potential'];
    const riskSegments = ['churn_risk'];

    let priority = members.length; // Base priority on segment size

    if (highValueSegments.includes(segment)) {
      priority *= 2; // High value segments get double priority
    }

    if (riskSegments.includes(segment)) {
      priority *= 1.5; // Risk segments get elevated priority
    }

    // Factor in average confidence
    const avgConfidence = members.reduce((sum, m) => sum + m.confidence, 0) / members.length;
    priority *= avgConfidence;

    return priority;
  }

  async getSegmentInsights(hotelId, segmentId) {
    try {
      const segmentation = await this.performAdvancedSegmentation(hotelId);
      const segment = segmentation.segments[segmentId];

      if (!segment) {
        throw new Error(`Segment ${segmentId} not found`);
      }

      const insights = {
        segmentInfo: this.segmentationRules.get(segmentId) || { name: segmentId },
        memberCount: segment.length,
        members: segment.slice(0, 10), // Top 10 members
        analytics: this.calculateSegmentAnalytics(segment),
        recommendations: this.getSegmentSpecificRecommendations(segmentId, segment)
      };

      return insights;
    } catch (error) {
      console.error('Error getting segment insights:', error);
      throw error;
    }
  }

  calculateSegmentAnalytics(segment) {
    if (segment.length === 0) return {};

    const analytics = {
      averageLifetimeValue: 0,
      averageEngagementScore: 0,
      averageRecencyScore: 0,
      averageFrequencyScore: 0,
      averageMonetaryScore: 0,
      commonPreferences: {},
      topSourceChannels: {},
      avgConfidence: 0
    };

    segment.forEach(member => {
      const profile = member.profile;
      const memberAnalytics = member.analytics;

      analytics.averageLifetimeValue += profile.engagementMetrics.totalSpending || 0;
      analytics.averageEngagementScore += memberAnalytics.engagementScore || 0;
      analytics.averageRecencyScore += profile.rfmAnalysis.recency.score;
      analytics.averageFrequencyScore += profile.rfmAnalysis.frequency.score;
      analytics.averageMonetaryScore += profile.rfmAnalysis.monetary.score;
      analytics.avgConfidence += member.confidence;

      // Aggregate preferences
      Object.keys(memberAnalytics.roomTypePreferences || {}).forEach(type => {
        analytics.commonPreferences[type] = (analytics.commonPreferences[type] || 0) + 1;
      });

      // Aggregate source channels
      Object.keys(memberAnalytics.sourceChannels || {}).forEach(source => {
        analytics.topSourceChannels[source] = (analytics.topSourceChannels[source] || 0) + 1;
      });
    });

    // Calculate averages
    Object.keys(analytics).forEach(key => {
      if (typeof analytics[key] === 'number') {
        analytics[key] = analytics[key] / segment.length;
      }
    });

    return analytics;
  }

  getSegmentSpecificRecommendations(segmentId, segment) {
    const rule = this.segmentationRules.get(segmentId);
    const baseRecommendations = rule ? rule.actions : [];

    // Add dynamic recommendations based on segment analytics
    const analytics = this.calculateSegmentAnalytics(segment);
    const dynamicRecommendations = [];

    if (analytics.averageEngagementScore < 50) {
      dynamicRecommendations.push('engagement_campaigns');
    }

    if (analytics.averageRecencyScore < 3) {
      dynamicRecommendations.push('reactivation_campaigns');
    }

    if (analytics.averageLifetimeValue > 1000) {
      dynamicRecommendations.push('vip_treatment');
    }

    return [...baseRecommendations, ...dynamicRecommendations];
  }
}

export default new SmartSegmentationService();