import mongoose from 'mongoose';

const guestCRMProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },

  // Basic Information (Enhanced)
  personalInfo: {
    title: String,
    firstName: String,
    lastName: String,
    fullName: String,
    email: String,
    phone: String,
    dateOfBirth: Date,
    anniversary: Date,
    nationality: String,
    language: {
      type: String,
      default: 'en'
    },
    timezone: String,
    profilePictureUrl: String
  },

  // Address Information
  addresses: [{
    type: {
      type: String,
      enum: ['home', 'work', 'billing', 'other'],
      default: 'home'
    },
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],

  // Communication Preferences
  communicationPreferences: {
    email: {
      marketing: { type: Boolean, default: true },
      transactional: { type: Boolean, default: true },
      newsletters: { type: Boolean, default: true },
      offers: { type: Boolean, default: true }
    },
    sms: {
      marketing: { type: Boolean, default: false },
      reminders: { type: Boolean, default: true },
      alerts: { type: Boolean, default: true }
    },
    phone: {
      marketing: { type: Boolean, default: false },
      emergency: { type: Boolean, default: true }
    },
    preferredContactTime: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'anytime'],
      default: 'anytime'
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly'],
      default: 'weekly'
    }
  },

  // Guest Preferences
  preferences: {
    roomType: [String],
    floor: {
      type: String,
      enum: ['low', 'middle', 'high', 'penthouse']
    },
    bedType: {
      type: String,
      enum: ['single', 'double', 'king', 'queen', 'twin']
    },
    smokingPreference: {
      type: String,
      enum: ['non-smoking', 'smoking'],
      default: 'non-smoking'
    },
    specialRequests: [String],
    amenities: [String],
    dietaryRestrictions: [String],
    accessibility: [String]
  },

  // Behavioral Insights
  behaviorProfile: {
    bookingPattern: {
      averageDaysInAdvance: { type: Number, default: 0 },
      preferredBookingTime: String,
      seasonalPreference: [String],
      lengthOfStay: { type: Number, default: 1 }
    },
    spendingPattern: {
      averageRoomRate: { type: Number, default: 0 },
      totalLifetimeValue: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      preferredPaymentMethod: String
    },
    engagementLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low'
    }
  },

  // Segmentation Data
  segments: [{
    name: String,
    category: {
      type: String,
      enum: ['demographic', 'behavioral', 'psychographic', 'geographic', 'transactional']
    },
    value: String,
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    source: {
      type: String,
      enum: ['automatic', 'manual', 'ml_model'],
      default: 'automatic'
    }
  }],

  // RFM Analysis
  rfmAnalysis: {
    recency: {
      value: Number,
      score: { type: Number, min: 1, max: 5 },
      lastCalculated: Date
    },
    frequency: {
      value: Number,
      score: { type: Number, min: 1, max: 5 },
      lastCalculated: Date
    },
    monetary: {
      value: Number,
      score: { type: Number, min: 1, max: 5 },
      lastCalculated: Date
    },
    combinedScore: {
      type: String,
      match: /^[1-5]{3}$/ // e.g., "555" for top customers
    },
    segment: {
      type: String,
      enum: [
        'Champions', 'Loyal Customers', 'Potential Loyalists',
        'New Customers', 'Promising', 'Need Attention',
        'About to Sleep', 'At Risk', 'Cannot Lose Them',
        'Hibernating', 'Lost'
      ]
    },
    lastUpdated: Date
  },

  // Lifecycle Stage
  lifecycleStage: {
    stage: {
      type: String,
      enum: [
        'prospect', 'first_time_guest', 'repeat_guest',
        'loyal_guest', 'vip_guest', 'at_risk', 'lost'
      ],
      default: 'prospect'
    },
    stageHistory: [{
      stage: String,
      changedAt: { type: Date, default: Date.now },
      reason: String
    }],
    nextExpectedAction: String,
    predictedNextBooking: Date
  },

  // Engagement Metrics
  engagementMetrics: {
    totalInteractions: { type: Number, default: 0 },
    lastInteraction: Date,
    totalEngagementScore: { type: Number, default: 0 },
    averageEngagementScore: { type: Number, default: 0 },
    emailEngagement: {
      totalSent: { type: Number, default: 0 },
      totalOpened: { type: Number, default: 0 },
      totalClicked: { type: Number, default: 0 },
      openRate: { type: Number, default: 0 },
      clickRate: { type: Number, default: 0 }
    },
    websiteEngagement: {
      totalSessions: { type: Number, default: 0 },
      totalPageViews: { type: Number, default: 0 },
      averageSessionDuration: { type: Number, default: 0 },
      bounceRate: { type: Number, default: 0 }
    }
  },

  // Booking History Summary
  bookingHistory: {
    totalBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    firstBookingDate: Date,
    lastBookingDate: Date,
    favoriteRoomTypes: [String],
    averageStayDuration: { type: Number, default: 0 },
    cancellationRate: { type: Number, default: 0 },
    noShowRate: { type: Number, default: 0 }
  },

  // Satisfaction & Feedback
  satisfaction: {
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    lastReviewDate: Date,
    sentimentScore: { type: Number, default: 0 }, // -100 to 100
    npsScore: { type: Number, min: -100, max: 100 },
    complaints: { type: Number, default: 0 },
    compliments: { type: Number, default: 0 }
  },

  // Predictive Insights
  predictions: {
    churnProbability: { type: Number, min: 0, max: 100 },
    lifetimeValuePrediction: Number,
    nextBookingProbability: { type: Number, min: 0, max: 100 },
    upsellProbability: { type: Number, min: 0, max: 100 },
    recommendationScore: { type: Number, min: 0, max: 100 },
    lastPredictionUpdate: Date
  },

  // Marketing Attribution
  attribution: {
    firstTouchSource: String,
    firstTouchMedium: String,
    firstTouchCampaign: String,
    lastTouchSource: String,
    lastTouchMedium: String,
    lastTouchCampaign: String,
    totalTouchpoints: { type: Number, default: 0 }
  },

  // Tags and Notes
  tags: [String],
  notes: [{
    content: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['general', 'complaint', 'compliment', 'preference', 'alert'],
      default: 'general'
    }
  }],

  // System Fields
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
guestCRMProfileSchema.index({ userId: 1, hotelId: 1 }, { unique: true });
guestCRMProfileSchema.index({ 'personalInfo.email': 1 });
guestCRMProfileSchema.index({ 'rfmAnalysis.segment': 1 });
guestCRMProfileSchema.index({ 'lifecycleStage.stage': 1 });
guestCRMProfileSchema.index({ 'segments.name': 1 });
guestCRMProfileSchema.index({ 'bookingHistory.totalRevenue': -1 });
guestCRMProfileSchema.index({ 'bookingHistory.lastBookingDate': -1 });
guestCRMProfileSchema.index({ 'predictions.churnProbability': -1 });

// Virtuals
guestCRMProfileSchema.virtual('customerValue').get(function() {
  if (this.bookingHistory.totalRevenue > 10000) return 'high';
  if (this.bookingHistory.totalRevenue > 5000) return 'medium';
  return 'low';
});

guestCRMProfileSchema.virtual('engagementLevel').get(function() {
  if (this.engagementMetrics.averageEngagementScore > 70) return 'high';
  if (this.engagementMetrics.averageEngagementScore > 40) return 'medium';
  return 'low';
});

// Methods
guestCRMProfileSchema.methods.calculateRFM = async function() {
  const GuestBehavior = mongoose.model('GuestBehavior');
  const Booking = mongoose.model('Booking');

  // Get booking history
  const bookings = await Booking.find({
    userId: this.userId,
    hotelId: this.hotelId,
    status: { $in: ['confirmed', 'completed'] }
  }).sort({ createdAt: -1 });

  if (bookings.length === 0) {
    this.rfmAnalysis = {
      recency: { value: 0, score: 1 },
      frequency: { value: 0, score: 1 },
      monetary: { value: 0, score: 1 },
      combinedScore: '111',
      segment: 'New Customers',
      lastUpdated: new Date()
    };
    return this.rfmAnalysis;
  }

  // Calculate Recency (days since last booking)
  const lastBooking = bookings[0];
  const daysSinceLastBooking = Math.floor(
    (new Date() - new Date(lastBooking.createdAt)) / (1000 * 60 * 60 * 24)
  );

  // Calculate Frequency (number of bookings)
  const frequency = bookings.length;

  // Calculate Monetary (total revenue)
  const monetary = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);

  // Scoring logic (1-5 scale)
  let recencyScore = 5;
  if (daysSinceLastBooking > 365) recencyScore = 1;
  else if (daysSinceLastBooking > 180) recencyScore = 2;
  else if (daysSinceLastBooking > 90) recencyScore = 3;
  else if (daysSinceLastBooking > 30) recencyScore = 4;

  let frequencyScore = 1;
  if (frequency >= 10) frequencyScore = 5;
  else if (frequency >= 5) frequencyScore = 4;
  else if (frequency >= 3) frequencyScore = 3;
  else if (frequency >= 2) frequencyScore = 2;

  let monetaryScore = 1;
  if (monetary >= 50000) monetaryScore = 5;
  else if (monetary >= 20000) monetaryScore = 4;
  else if (monetary >= 10000) monetaryScore = 3;
  else if (monetary >= 5000) monetaryScore = 2;

  // Determine segment
  const combinedScore = `${recencyScore}${frequencyScore}${monetaryScore}`;
  let segment = 'Need Attention';

  if (recencyScore >= 4 && frequencyScore >= 4 && monetaryScore >= 4) {
    segment = 'Champions';
  } else if (recencyScore >= 3 && frequencyScore >= 3 && monetaryScore >= 3) {
    segment = 'Loyal Customers';
  } else if (recencyScore >= 4 && frequencyScore <= 2) {
    segment = 'New Customers';
  } else if (recencyScore <= 2 && frequencyScore >= 3) {
    segment = 'At Risk';
  } else if (recencyScore <= 2 && frequencyScore <= 2 && monetaryScore >= 3) {
    segment = 'Cannot Lose Them';
  } else if (recencyScore <= 2 && frequencyScore <= 2) {
    segment = 'Lost';
  } else if (recencyScore >= 3 && frequencyScore <= 2) {
    segment = 'Promising';
  }

  this.rfmAnalysis = {
    recency: { value: daysSinceLastBooking, score: recencyScore, lastCalculated: new Date() },
    frequency: { value: frequency, score: frequencyScore, lastCalculated: new Date() },
    monetary: { value: monetary, score: monetaryScore, lastCalculated: new Date() },
    combinedScore,
    segment,
    lastUpdated: new Date()
  };

  return this.rfmAnalysis;
};

guestCRMProfileSchema.methods.updateLifecycleStage = function() {
  const { totalBookings, lastBookingDate, totalRevenue } = this.bookingHistory;
  const daysSinceLastBooking = lastBookingDate
    ? Math.floor((new Date() - new Date(lastBookingDate)) / (1000 * 60 * 60 * 24))
    : Infinity;

  let newStage = 'prospect';

  if (totalBookings === 0) {
    newStage = 'prospect';
  } else if (totalBookings === 1 && daysSinceLastBooking <= 365) {
    newStage = 'first_time_guest';
  } else if (totalBookings >= 2 && totalBookings < 5 && daysSinceLastBooking <= 365) {
    newStage = 'repeat_guest';
  } else if (totalBookings >= 5 && daysSinceLastBooking <= 180) {
    newStage = 'loyal_guest';
  } else if (totalRevenue >= 20000 && daysSinceLastBooking <= 90) {
    newStage = 'vip_guest';
  } else if (daysSinceLastBooking > 365 && daysSinceLastBooking <= 730) {
    newStage = 'at_risk';
  } else if (daysSinceLastBooking > 730) {
    newStage = 'lost';
  }

  if (this.lifecycleStage.stage !== newStage) {
    this.lifecycleStage.stageHistory.push({
      stage: this.lifecycleStage.stage,
      changedAt: new Date(),
      reason: 'Automatic lifecycle update'
    });
    this.lifecycleStage.stage = newStage;
  }

  return newStage;
};

guestCRMProfileSchema.methods.addNote = function(content, author, type = 'general') {
  this.notes.push({
    content,
    author,
    type,
    createdAt: new Date()
  });
  return this.notes[this.notes.length - 1];
};

guestCRMProfileSchema.methods.addSegment = function(name, category, value, confidence = 50, source = 'automatic') {
  // Remove existing segment with same name
  this.segments = this.segments.filter(s => s.name !== name);

  this.segments.push({
    name,
    category,
    value,
    confidence,
    source,
    assignedAt: new Date()
  });
};

// Static methods
guestCRMProfileSchema.statics.getSegmentAnalytics = async function(hotelId) {
  return await this.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$rfmAnalysis.segment',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$bookingHistory.totalRevenue' },
        avgRevenue: { $avg: '$bookingHistory.totalRevenue' },
        avgBookings: { $avg: '$bookingHistory.totalBookings' }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);
};

guestCRMProfileSchema.statics.getLifecycleAnalytics = async function(hotelId) {
  return await this.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$lifecycleStage.stage',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$bookingHistory.totalRevenue' },
        avgEngagement: { $avg: '$engagementMetrics.averageEngagementScore' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Pre-save middleware
guestCRMProfileSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  this.version += 1;
  next();
});

export default mongoose.models.GuestCRMProfile || mongoose.model('GuestCRMProfile', guestCRMProfileSchema);