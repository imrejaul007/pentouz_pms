import GuestCRMProfile from '../models/GuestCRMProfile.js';
import GuestBehavior from '../models/GuestBehavior.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import smartSegmentationService from './smartSegmentationService.js';

class PersonalizationEngineService {
  constructor() {
    this.personalizationRules = new Map();
    this.contentTemplates = new Map();
    this.pricingRules = new Map();
    this.initializePersonalizationRules();
  }

  initializePersonalizationRules() {
    // Content personalization rules
    this.personalizationRules.set('high_value_prospects', {
      heroMessage: 'Experience Luxury Like Never Before',
      roomRecommendations: ['suite', 'executive', 'deluxe'],
      offerType: 'premium_experience',
      contentTone: 'luxury',
      callToAction: 'Book Your VIP Experience',
      urgency: 'low',
      socialProof: 'vip_testimonials'
    });

    this.personalizationRules.set('loyalty_builders', {
      heroMessage: 'Welcome Back! Earn Rewards on Every Stay',
      roomRecommendations: ['deluxe', 'standard'],
      offerType: 'loyalty_points',
      contentTone: 'friendly',
      callToAction: 'Earn Points Today',
      urgency: 'medium',
      socialProof: 'member_benefits'
    });

    this.personalizationRules.set('seasonal_bookers', {
      heroMessage: 'Your Perfect Seasonal Getaway Awaits',
      roomRecommendations: ['standard', 'deluxe'],
      offerType: 'seasonal_package',
      contentTone: 'seasonal',
      callToAction: 'Book Your Season',
      urgency: 'high',
      socialProof: 'seasonal_reviews'
    });

    this.personalizationRules.set('business_travelers', {
      heroMessage: 'Productivity Meets Comfort',
      roomRecommendations: ['executive', 'business'],
      offerType: 'business_package',
      contentTone: 'professional',
      callToAction: 'Book Efficiently',
      urgency: 'low',
      socialProof: 'business_testimonials'
    });

    this.personalizationRules.set('weekend_warriors', {
      heroMessage: 'Escape the Week, Embrace the Weekend',
      roomRecommendations: ['deluxe', 'suite'],
      offerType: 'weekend_package',
      contentTone: 'relaxed',
      callToAction: 'Plan Your Escape',
      urgency: 'medium',
      socialProof: 'weekend_experiences'
    });

    this.personalizationRules.set('price_sensitive', {
      heroMessage: 'Great Value, Great Comfort',
      roomRecommendations: ['standard', 'economy'],
      offerType: 'discount',
      contentTone: 'value_focused',
      callToAction: 'Save Today',
      urgency: 'high',
      socialProof: 'value_reviews'
    });

    this.personalizationRules.set('luxury_seekers', {
      heroMessage: 'Indulge in Unparalleled Luxury',
      roomRecommendations: ['presidential_suite', 'luxury_suite', 'penthouse'],
      offerType: 'luxury_experience',
      contentTone: 'exclusive',
      callToAction: 'Reserve Excellence',
      urgency: 'low',
      socialProof: 'luxury_testimonials'
    });

    // Pricing personalization rules
    this.pricingRules.set('high_value_prospects', {
      discountRange: { min: 0, max: 10 },
      premiumUpgrades: true,
      flexibleCancellation: true,
      complimentaryServices: ['airport_pickup', 'welcome_drink']
    });

    this.pricingRules.set('loyalty_builders', {
      discountRange: { min: 5, max: 15 },
      pointsMultiplier: 2,
      memberPerks: true,
      complimentaryServices: ['late_checkout', 'room_upgrade']
    });

    this.pricingRules.set('price_sensitive', {
      discountRange: { min: 10, max: 25 },
      budgetOptions: true,
      earlyBirdSpecials: true,
      complimentaryServices: ['wifi', 'breakfast']
    });

    this.pricingRules.set('luxury_seekers', {
      discountRange: { min: 0, max: 5 },
      luxuryPackages: true,
      conciergeServices: true,
      complimentaryServices: ['spa_access', 'private_dining', 'chauffeur']
    });

    this.pricingRules.set('business_travelers', {
      discountRange: { min: 5, max: 15 },
      corporateRates: true,
      expressServices: true,
      complimentaryServices: ['business_center', 'express_laundry', 'meeting_room']
    });
  }

  async generatePersonalizedExperience(userId, hotelId, context = {}) {
    try {
      // Get user profile and segmentation
      const profile = await GuestCRMProfile.findOne({ userId, hotelId })
        .populate('userId', 'firstName lastName email preferences');

      if (!profile) {
        return this.getDefaultExperience(context);
      }

      // Get user's segments
      const segmentation = await smartSegmentationService.performAdvancedSegmentation(hotelId);
      const userSegments = this.findUserSegments(userId, segmentation.segments);

      // Get recent behavior for additional context
      const recentBehavior = await GuestBehavior.find({
        userId,
        hotelId,
        timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }).sort({ timestamp: -1 }).limit(50);

      // Generate personalized content
      const personalizedContent = await this.generatePersonalizedContent(
        profile,
        userSegments,
        recentBehavior,
        context
      );

      // Generate personalized pricing
      const personalizedPricing = await this.generatePersonalizedPricing(
        profile,
        userSegments,
        context
      );

      // Generate room recommendations
      const roomRecommendations = await this.generateRoomRecommendations(
        profile,
        userSegments,
        hotelId,
        context
      );

      // Generate personalized offers
      const personalizedOffers = await this.generatePersonalizedOffers(
        profile,
        userSegments,
        context
      );

      return {
        userId,
        profileInfo: {
          name: profile.personalInfo.firstName,
          segment: profile.rfmAnalysis.segment,
          loyaltyTier: profile.loyaltyMetrics.tier,
          lifetimeValue: profile.engagementMetrics.totalSpending
        },
        content: personalizedContent,
        pricing: personalizedPricing,
        recommendations: roomRecommendations,
        offers: personalizedOffers,
        personalizationMetadata: {
          segments: userSegments.map(s => s.segment),
          confidence: userSegments.reduce((avg, s) => avg + s.confidence, 0) / userSegments.length,
          lastUpdated: new Date()
        }
      };

    } catch (error) {
      console.error('Error generating personalized experience:', error);
      return this.getDefaultExperience(context);
    }
  }

  findUserSegments(userId, segments) {
    const userSegments = [];

    Object.entries(segments).forEach(([segmentId, members]) => {
      const userInSegment = members.find(member =>
        member.profile.userId.toString() === userId.toString()
      );
      if (userInSegment) {
        userSegments.push({
          segment: segmentId,
          confidence: userInSegment.confidence,
          analytics: userInSegment.analytics
        });
      }
    });

    return userSegments.sort((a, b) => b.confidence - a.confidence);
  }

  async generatePersonalizedContent(profile, userSegments, recentBehavior, context) {
    const primarySegment = userSegments[0]?.segment || 'default';
    const rules = this.personalizationRules.get(primarySegment) || this.getDefaultRules();

    // Analyze recent behavior for content preferences
    const behaviorInsights = this.analyzeBehaviorForContent(recentBehavior);

    const content = {
      heroSection: {
        headline: this.personalizeHeadline(rules.heroMessage, profile, behaviorInsights),
        subheadline: this.generateSubheadline(profile, primarySegment),
        backgroundImage: this.selectBackgroundImage(primarySegment, behaviorInsights),
        callToAction: {
          text: rules.callToAction,
          style: this.getCallToActionStyle(primarySegment),
          urgency: rules.urgency
        }
      },
      navigation: {
        primaryMenuItems: this.getPersonalizedMenuItems(primarySegment),
        quickActions: this.getQuickActions(profile, userSegments)
      },
      recommendations: {
        rooms: rules.roomRecommendations,
        amenities: this.getRecommendedAmenities(profile, userSegments),
        services: this.getRecommendedServices(profile, userSegments)
      },
      socialProof: {
        type: rules.socialProof,
        content: this.getSocialProofContent(rules.socialProof, profile)
      },
      messaging: {
        tone: rules.contentTone,
        personalization: {
          includeFirstName: true,
          includeLoyaltyStatus: profile.loyaltyMetrics.tier !== 'Bronze',
          includeSpecialOffers: true
        }
      }
    };

    return content;
  }

  async generatePersonalizedPricing(profile, userSegments, context) {
    const primarySegment = userSegments[0]?.segment || 'default';
    const pricingRules = this.pricingRules.get(primarySegment) || {};

    const pricing = {
      baseDiscountRange: pricingRules.discountRange || { min: 0, max: 5 },
      loyaltyDiscount: this.calculateLoyaltyDiscount(profile),
      dynamicPricing: {
        enabled: true,
        factors: {
          loyaltyTier: profile.loyaltyMetrics.tier,
          bookingHistory: profile.engagementMetrics.totalBookings,
          segment: primarySegment,
          seasonality: this.getSeasonalFactor(context.checkInDate)
        }
      },
      offers: {
        earlyBird: pricingRules.earlyBirdSpecials || false,
        lastMinute: this.shouldOfferLastMinute(profile, userSegments),
        packageDeals: this.getAvailablePackages(primarySegment),
        upgrades: pricingRules.premiumUpgrades || false
      },
      complimentaryServices: pricingRules.complimentaryServices || [],
      flexibleTerms: {
        cancellation: pricingRules.flexibleCancellation || false,
        modification: this.shouldOfferFlexibleModification(profile),
        paymentOptions: this.getPaymentOptions(primarySegment)
      }
    };

    return pricing;
  }

  async generateRoomRecommendations(profile, userSegments, hotelId, context) {
    const primarySegment = userSegments[0]?.segment || 'default';
    const rules = this.personalizationRules.get(primarySegment) || this.getDefaultRules();

    // Get user's historical preferences
    const bookingHistory = await Booking.find({
      userId: profile.userId,
      hotelId,
      status: { $in: ['confirmed', 'checked-in', 'checked-out'] }
    }).sort({ createdAt: -1 }).limit(10);

    const historicalPreferences = this.analyzeBookingPreferences(bookingHistory);

    // Get available room types
    const availableRoomTypes = await RoomType.find({ hotelId, isActive: true });

    const recommendations = [];

    for (const roomType of availableRoomTypes) {
      const score = this.calculateRoomScore(
        roomType,
        rules.roomRecommendations,
        historicalPreferences,
        profile.preferences,
        context
      );

      if (score > 0.3) { // Minimum relevance threshold
        recommendations.push({
          roomType: roomType,
          score: score,
          reasons: this.generateRecommendationReasons(roomType, profile, primarySegment),
          pricing: await this.calculatePersonalizedRoomPricing(roomType, profile, userSegments),
          availability: await this.checkRoomAvailability(roomType, context),
          highlights: this.getRoomHighlights(roomType, primarySegment)
        });
      }
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 6); // Top 6 recommendations
  }

  async generatePersonalizedOffers(profile, userSegments, context) {
    const primarySegment = userSegments[0]?.segment || 'default';
    const offers = [];

    // Segment-specific offers
    switch (primarySegment) {
      case 'high_value_prospects':
        offers.push({
          type: 'vip_experience',
          title: 'Complimentary VIP Welcome Package',
          description: 'Airport pickup, welcome champagne, and room upgrade',
          value: '$200',
          conditions: 'Minimum 2-night stay',
          expires: this.getOfferExpiration(7)
        });
        break;

      case 'loyalty_builders':
        offers.push({
          type: 'loyalty_boost',
          title: 'Double Points Weekend',
          description: 'Earn 2x loyalty points on your next stay',
          value: 'Double Points',
          conditions: 'Valid for weekend bookings',
          expires: this.getOfferExpiration(14)
        });
        break;

      case 'price_sensitive':
        offers.push({
          type: 'discount',
          title: 'Early Bird Special - 20% Off',
          description: 'Book 30 days in advance and save',
          value: '20% Discount',
          conditions: 'Advance booking required',
          expires: this.getOfferExpiration(3)
        });
        break;

      case 'luxury_seekers':
        offers.push({
          type: 'luxury_package',
          title: 'Presidential Suite Experience',
          description: 'Suite upgrade with spa and fine dining credits',
          value: '$500',
          conditions: 'Subject to availability',
          expires: this.getOfferExpiration(30)
        });
        break;

      case 'business_travelers':
        offers.push({
          type: 'business_package',
          title: 'Business Traveler Package',
          description: 'Express check-in/out, meeting room access, business center',
          value: '$100',
          conditions: 'Valid Monday-Thursday',
          expires: this.getOfferExpiration(30)
        });
        break;
    }

    // Behavior-based offers
    const recentBehavior = await GuestBehavior.find({
      userId: profile.userId,
      hotelId: profile.hotelId,
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    if (this.hasAbandonedBooking(recentBehavior)) {
      offers.push({
        type: 'comeback',
        title: 'Complete Your Booking - 10% Off',
        description: 'Finish your reservation and save',
        value: '10% Discount',
        conditions: 'Valid for 24 hours',
        expires: this.getOfferExpiration(1)
      });
    }

    if (this.isRepeatVisitor(profile)) {
      offers.push({
        type: 'loyalty',
        title: 'Welcome Back Bonus',
        description: 'Thank you for your loyalty - room upgrade included',
        value: 'Free Upgrade',
        conditions: 'Subject to availability',
        expires: this.getOfferExpiration(14)
      });
    }

    return offers;
  }

  // Helper methods
  personalizeHeadline(baseHeadline, profile, behaviorInsights) {
    const firstName = profile.personalInfo.firstName;
    const isReturning = profile.engagementMetrics.totalBookings > 0;

    if (isReturning && firstName) {
      return `Welcome Back, ${firstName}! ${baseHeadline}`;
    } else if (firstName) {
      return `Hello ${firstName}! ${baseHeadline}`;
    }

    return baseHeadline;
  }

  generateSubheadline(profile, segment) {
    const subheadlines = {
      'high_value_prospects': 'Discover exceptional accommodations tailored for distinguished guests',
      'loyalty_builders': 'Earn rewards and unlock exclusive benefits with every stay',
      'seasonal_bookers': 'Perfect timing for your ideal seasonal escape',
      'business_travelers': 'Streamlined comfort for the modern professional',
      'weekend_warriors': 'Recharge and rejuvenate in style',
      'price_sensitive': 'Quality accommodations at unbeatable prices',
      'luxury_seekers': 'Where luxury meets perfection'
    };

    return subheadlines[segment] || 'Your perfect stay awaits';
  }

  selectBackgroundImage(segment, behaviorInsights) {
    const imageMap = {
      'high_value_prospects': 'luxury-lobby.jpg',
      'loyalty_builders': 'member-lounge.jpg',
      'seasonal_bookers': 'seasonal-view.jpg',
      'business_travelers': 'business-center.jpg',
      'weekend_warriors': 'relaxation-suite.jpg',
      'price_sensitive': 'comfortable-room.jpg',
      'luxury_seekers': 'presidential-suite.jpg'
    };

    return imageMap[segment] || 'default-hero.jpg';
  }

  calculateLoyaltyDiscount(profile) {
    const tier = profile.loyaltyMetrics.tier;
    const discounts = {
      'Bronze': 2,
      'Silver': 5,
      'Gold': 8,
      'Platinum': 12
    };

    return discounts[tier] || 0;
  }

  calculateRoomScore(roomType, preferredTypes, historicalPrefs, userPrefs, context) {
    let score = 0;

    // Segment preference match
    if (preferredTypes.includes(roomType.name.toLowerCase())) {
      score += 0.4;
    }

    // Historical preference match
    if (historicalPrefs.roomTypes && historicalPrefs.roomTypes[roomType.name]) {
      score += 0.3 * (historicalPrefs.roomTypes[roomType.name] / Math.max(...Object.values(historicalPrefs.roomTypes)));
    }

    // User explicit preferences
    if (userPrefs.roomType && userPrefs.roomType === roomType.name) {
      score += 0.2;
    }

    // Price range compatibility
    if (context.budget) {
      const priceCompatibility = this.calculatePriceCompatibility(roomType.basePrice, context.budget);
      score += 0.1 * priceCompatibility;
    }

    return Math.min(score, 1.0);
  }

  calculatePriceCompatibility(roomPrice, budget) {
    if (!budget || !roomPrice) return 0.5;

    const ratio = roomPrice / budget;
    if (ratio <= 1) return 1.0;
    if (ratio <= 1.2) return 0.8;
    if (ratio <= 1.5) return 0.5;
    return 0.2;
  }

  getDefaultExperience(context) {
    return {
      content: {
        heroSection: {
          headline: 'Welcome to THE PENTOUZ',
          subheadline: 'Your perfect stay awaits',
          callToAction: { text: 'Book Now', style: 'primary', urgency: 'medium' }
        }
      },
      pricing: {
        baseDiscountRange: { min: 0, max: 5 },
        offers: { earlyBird: false, lastMinute: false }
      },
      recommendations: [],
      offers: []
    };
  }

  getDefaultRules() {
    return {
      heroMessage: 'Welcome to THE PENTOUZ',
      roomRecommendations: ['standard', 'deluxe'],
      offerType: 'standard',
      contentTone: 'friendly',
      callToAction: 'Book Now',
      urgency: 'medium',
      socialProof: 'general_reviews'
    };
  }

  analyzeBehaviorForContent(behaviors) {
    return {
      mostViewedRoomTypes: this.extractMostViewedRooms(behaviors),
      averageSessionDuration: this.calculateAvgSessionDuration(behaviors),
      preferredDevices: this.getDevicePreferences(behaviors),
      engagementPatterns: this.getEngagementPatterns(behaviors)
    };
  }

  extractMostViewedRooms(behaviors) {
    const roomViews = {};
    behaviors.forEach(behavior => {
      if (behavior.behaviorType === 'room_view' && behavior.interactionData.roomType) {
        roomViews[behavior.interactionData.roomType] = (roomViews[behavior.interactionData.roomType] || 0) + 1;
      }
    });
    return roomViews;
  }

  getOfferExpiration(days) {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + days);
    return expiration;
  }

  hasAbandonedBooking(behaviors) {
    return behaviors.some(b => b.behaviorType === 'checkout_start') &&
           !behaviors.some(b => b.behaviorType === 'booking_complete');
  }

  isRepeatVisitor(profile) {
    return profile.engagementMetrics.totalBookings > 1;
  }

  async getPersonalizedDashboard(userId, hotelId) {
    try {
      const personalizedExperience = await this.generatePersonalizedExperience(userId, hotelId);
      const profile = await GuestCRMProfile.findOne({ userId, hotelId });

      const dashboard = {
        welcome: {
          message: `Welcome back, ${profile.personalInfo.firstName}!`,
          loyaltyStatus: {
            tier: profile.loyaltyMetrics.tier,
            points: profile.loyaltyMetrics.points,
            nextTierPoints: this.calculatePointsToNextTier(profile.loyaltyMetrics)
          }
        },
        quickActions: this.getPersonalizedQuickActions(profile),
        recommendations: personalizedExperience.recommendations.slice(0, 3),
        recentActivity: await this.getRecentActivity(userId, hotelId),
        upcomingBookings: await this.getUpcomingBookings(userId, hotelId),
        personalizedOffers: personalizedExperience.offers
      };

      return dashboard;
    } catch (error) {
      console.error('Error generating personalized dashboard:', error);
      throw error;
    }
  }

  getPersonalizedQuickActions(profile) {
    const actions = ['book_room', 'view_bookings'];

    if (profile.loyaltyMetrics.tier !== 'Bronze') {
      actions.push('loyalty_dashboard');
    }

    if (profile.engagementMetrics.totalBookings > 2) {
      actions.push('repeat_booking');
    }

    actions.push('support');

    return actions;
  }

  async getRecentActivity(userId, hotelId) {
    const recentBehaviors = await GuestBehavior.find({
      userId,
      hotelId,
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).sort({ timestamp: -1 }).limit(5);

    return recentBehaviors.map(behavior => ({
      type: behavior.behaviorType,
      timestamp: behavior.timestamp,
      description: this.getBehaviorDescription(behavior)
    }));
  }

  getBehaviorDescription(behavior) {
    const descriptions = {
      'page_view': 'Browsed hotel information',
      'room_search': 'Searched for available rooms',
      'room_view': `Viewed ${behavior.interactionData.roomType || 'room'} details`,
      'email_open': 'Opened marketing email',
      'booking_complete': 'Completed a booking',
      'support_contact': 'Contacted customer support'
    };

    return descriptions[behavior.behaviorType] || 'Interacted with website';
  }

  async getUpcomingBookings(userId, hotelId) {
    return await Booking.find({
      userId,
      hotelId,
      checkInDate: { $gte: new Date() },
      status: { $in: ['confirmed', 'checked-in'] }
    }).sort({ checkInDate: 1 }).limit(3);
  }

  calculatePointsToNextTier(loyaltyMetrics) {
    const tierThresholds = {
      'Bronze': 1000,
      'Silver': 2500,
      'Gold': 5000,
      'Platinum': 10000
    };

    const currentTier = loyaltyMetrics.tier;
    const currentPoints = loyaltyMetrics.points;

    const tiers = Object.keys(tierThresholds);
    const currentIndex = tiers.indexOf(currentTier);

    if (currentIndex < tiers.length - 1) {
      const nextTier = tiers[currentIndex + 1];
      return tierThresholds[nextTier] - currentPoints;
    }

    return 0; // Already at highest tier
  }
}

export default new PersonalizationEngineService();