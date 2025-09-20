import mongoose from 'mongoose';

const guestBehaviorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },

  // Behavioral Data
  behaviorType: {
    type: String,
    enum: [
      'page_view', 'room_search', 'room_view', 'add_to_cart', 'checkout_start',
      'booking_complete', 'email_open', 'email_click', 'support_contact',
      'review_left', 'loyalty_action', 'preferences_update', 'profile_update'
    ],
    required: true
  },

  // Context Data
  pageUrl: String,
  referrerUrl: String,
  userAgent: String,
  ipAddress: String,
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet'],
    default: 'desktop'
  },

  // Interaction Details
  interactionData: {
    roomType: String,
    checkInDate: Date,
    checkOutDate: Date,
    guests: Number,
    priceRange: {
      min: Number,
      max: Number
    },
    amenitiesViewed: [String],
    duration: Number, // time spent in seconds
    scrollDepth: Number, // percentage scrolled
    clickCount: Number,
    searchQuery: String,
    filters: mongoose.Schema.Types.Mixed
  },

  // Transaction Data
  transactionValue: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },

  // Attribution
  source: {
    type: String,
    enum: ['direct', 'organic', 'paid', 'social', 'email', 'referral', 'widget'],
    default: 'direct'
  },
  medium: String,
  campaign: String,
  utmParameters: {
    source: String,
    medium: String,
    campaign: String,
    term: String,
    content: String
  },

  // Timing
  timestamp: {
    type: Date,
    default: Date.now
  },
  localTime: Date,
  timezone: String,

  // Engagement Scoring
  engagementScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Metadata
  metadata: mongoose.Schema.Types.Mixed,
  tags: [String]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
guestBehaviorSchema.index({ userId: 1, timestamp: -1 });
guestBehaviorSchema.index({ hotelId: 1, behaviorType: 1 });
guestBehaviorSchema.index({ sessionId: 1 });
guestBehaviorSchema.index({ timestamp: -1 });
guestBehaviorSchema.index({ source: 1, medium: 1 });
guestBehaviorSchema.index({ behaviorType: 1, timestamp: -1 });

// Virtual for behavior category
guestBehaviorSchema.virtual('category').get(function() {
  const categories = {
    'page_view': 'navigation',
    'room_search': 'search',
    'room_view': 'product_interest',
    'add_to_cart': 'purchase_intent',
    'checkout_start': 'purchase_intent',
    'booking_complete': 'conversion',
    'email_open': 'engagement',
    'email_click': 'engagement',
    'support_contact': 'support',
    'review_left': 'feedback',
    'loyalty_action': 'loyalty',
    'preferences_update': 'profile',
    'profile_update': 'profile'
  };
  return categories[this.behaviorType] || 'other';
});

// Methods
guestBehaviorSchema.methods.calculateEngagementScore = function() {
  let score = 0;

  // Base scoring by behavior type
  const behaviorScores = {
    'page_view': 1,
    'room_search': 3,
    'room_view': 5,
    'add_to_cart': 15,
    'checkout_start': 25,
    'booking_complete': 100,
    'email_open': 5,
    'email_click': 10,
    'support_contact': 8,
    'review_left': 20,
    'loyalty_action': 15,
    'preferences_update': 10,
    'profile_update': 8
  };

  score += behaviorScores[this.behaviorType] || 0;

  // Bonus for high engagement
  if (this.interactionData.duration > 300) score += 5; // 5+ minutes
  if (this.interactionData.scrollDepth > 80) score += 3; // 80%+ scroll
  if (this.interactionData.clickCount > 10) score += 2; // 10+ clicks

  // Transaction value bonus
  if (this.transactionValue > 0) {
    score += Math.min(this.transactionValue / 100, 50); // Max 50 points for value
  }

  this.engagementScore = Math.min(score, 100);
  return this.engagementScore;
};

// Static methods
guestBehaviorSchema.statics.getBehaviorAnalytics = async function(userId, timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const behaviors = await this.find({
    userId,
    timestamp: { $gte: startDate }
  }).sort({ timestamp: -1 });

  const analytics = {
    totalInteractions: behaviors.length,
    uniqueSessions: new Set(behaviors.map(b => b.sessionId)).size,
    totalEngagementScore: behaviors.reduce((sum, b) => sum + b.engagementScore, 0),
    averageEngagementScore: 0,
    conversionEvents: behaviors.filter(b => b.behaviorType === 'booking_complete').length,
    topBehaviors: {},
    deviceBreakdown: {},
    sourceBreakdown: {},
    timelineData: []
  };

  if (behaviors.length > 0) {
    analytics.averageEngagementScore = analytics.totalEngagementScore / behaviors.length;
  }

  // Behavior frequency
  behaviors.forEach(behavior => {
    analytics.topBehaviors[behavior.behaviorType] =
      (analytics.topBehaviors[behavior.behaviorType] || 0) + 1;
    analytics.deviceBreakdown[behavior.deviceType] =
      (analytics.deviceBreakdown[behavior.deviceType] || 0) + 1;
    analytics.sourceBreakdown[behavior.source] =
      (analytics.sourceBreakdown[behavior.source] || 0) + 1;
  });

  // Timeline data (daily aggregation)
  const timeline = {};
  behaviors.forEach(behavior => {
    const day = behavior.timestamp.toISOString().split('T')[0];
    if (!timeline[day]) {
      timeline[day] = { date: day, interactions: 0, engagement: 0 };
    }
    timeline[day].interactions++;
    timeline[day].engagement += behavior.engagementScore;
  });

  analytics.timelineData = Object.values(timeline).sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  return analytics;
};

guestBehaviorSchema.statics.getSegmentationData = async function(hotelId, segmentCriteria = {}) {
  const pipeline = [
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$userId',
        totalInteractions: { $sum: 1 },
        totalEngagement: { $sum: '$engagementScore' },
        lastInteraction: { $max: '$timestamp' },
        firstInteraction: { $min: '$timestamp' },
        conversions: {
          $sum: { $cond: [{ $eq: ['$behaviorType', 'booking_complete'] }, 1, 0] }
        },
        totalValue: { $sum: '$transactionValue' },
        primarySource: { $first: '$source' },
        devices: { $addToSet: '$deviceType' }
      }
    },
    {
      $addFields: {
        avgEngagement: { $divide: ['$totalEngagement', '$totalInteractions'] },
        daysSinceFirst: {
          $divide: [
            { $subtract: [new Date(), '$firstInteraction'] },
            1000 * 60 * 60 * 24
          ]
        },
        daysSinceLast: {
          $divide: [
            { $subtract: [new Date(), '$lastInteraction'] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    }
  ];

  // Apply filters
  if (segmentCriteria.minInteractions) {
    pipeline.push({
      $match: { totalInteractions: { $gte: segmentCriteria.minInteractions } }
    });
  }

  if (segmentCriteria.minEngagement) {
    pipeline.push({
      $match: { avgEngagement: { $gte: segmentCriteria.minEngagement } }
    });
  }

  if (segmentCriteria.recencyDays) {
    pipeline.push({
      $match: { daysSinceLast: { $lte: segmentCriteria.recencyDays } }
    });
  }

  return await this.aggregate(pipeline);
};

// Pre-save middleware
guestBehaviorSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('interactionData') || this.isModified('transactionValue')) {
    this.calculateEngagementScore();
  }
  next();
});

export default mongoose.models.GuestBehavior || mongoose.model('GuestBehavior', guestBehaviorSchema);