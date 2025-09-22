import mongoose from 'mongoose';

const WaitingListSchema = new mongoose.Schema({
  waitlistId: {
    type: String
  },
  guestName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  roomType: {
    type: String,
    required: true,
    enum: ['Standard Room', 'Deluxe Room', 'Executive Room', 'Deluxe Suite', 'Presidential Suite']
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  preferredDates: {
    checkIn: {
      type: Date,
      required: true
    },
    checkOut: {
      type: Date,
      required: true
    }
  },
  alternativeDates: [{
    checkIn: {
      type: Date,
      required: true
    },
    checkOut: {
      type: Date,
      required: true
    }
  }],
  guests: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  vipStatus: {
    type: Boolean,
    default: false
  },
  loyaltyTier: {
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']
  },
  specialRequests: {
    type: String
  },
  contactPreference: {
    type: String,
    enum: ['email', 'phone', 'sms'],
    default: 'email'
  },
  maxRate: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'contacted', 'confirmed', 'expired', 'cancelled'],
    default: 'active'
  },
  addedDate: {
    type: Date,
    default: Date.now
  },
  lastContact: {
    type: Date
  },
  contactHistory: [{
    contactDate: {
      type: Date,
      default: Date.now
    },
    method: {
      type: String,
      enum: ['email', 'phone', 'sms', 'in_person']
    },
    message: String,
    contactedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  notes: [{
    content: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isInternal: {
      type: Boolean,
      default: true
    }
  }],
  source: {
    type: String,
    enum: ['direct', 'booking.com', 'expedia', 'agoda', 'website', 'phone', 'walk_in'],
    default: 'direct'
  },
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    },
    phone: {
      type: Boolean,
      default: false
    }
  },
  roomAvailabilityAlerts: {
    type: Boolean,
    default: true
  },
  autoConfirm: {
    type: Boolean,
    default: false
  },
  expiryDate: {
    type: Date
  },
  // Integration with existing booking if waitlist converts to booking
  convertedToBooking: {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    convertedDate: Date,
    convertedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  // Enhanced priority management
  priorityManagement: {
    automaticPriority: {
      type: Boolean,
      default: true
    },
    manualPriorityOverride: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent', 'vip']
    },
    overrideReason: String,
    overrideBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    overrideDate: Date
  },

  // VIP and loyalty integration
  vipIntegration: {
    vipGuestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VIPGuest'
    },
    loyaltyPoints: {
      type: Number,
      default: 0
    },
    memberSince: Date,
    lastStayDate: Date,
    totalStays: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    }
  },

  // Room matching algorithms
  roomMatching: {
    autoMatchEnabled: {
      type: Boolean,
      default: true
    },
    matchCriteria: {
      exactRoomType: {
        type: Boolean,
        default: false
      },
      allowUpgrade: {
        type: Boolean,
        default: true
      },
      allowDowngrade: {
        type: Boolean,
        default: false
      },
      flexibleDates: {
        type: Number,
        default: 3 // days flexibility
      }
    },
    matchHistory: [{
      availableRoom: {
        roomId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Room'
        },
        roomType: String,
        roomNumber: String
      },
      matchDate: {
        type: Date,
        default: Date.now
      },
      matchScore: {
        type: Number,
        min: 0,
        max: 100
      },
      declined: {
        type: Boolean,
        default: false
      },
      declineReason: String,
      offeredRate: Number,
      responseDeadline: Date
    }]
  },

  // Enhanced status tracking
  statusTracking: {
    waitingSince: {
      type: Date,
      default: Date.now
    },
    estimatedWaitTime: {
      type: Number, // in days
      default: null
    },
    statusHistory: [{
      previousStatus: String,
      newStatus: String,
      changedAt: {
        type: Date,
        default: Date.now
      },
      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reason: String,
      automaticChange: {
        type: Boolean,
        default: false
      }
    }],
    lastActivityDate: {
      type: Date,
      default: Date.now
    }
  },

  // Automated matching preferences
  automationSettings: {
    autoBook: {
      type: Boolean,
      default: false
    },
    autoBookConditions: {
      maxRate: Number,
      preferredDates: {
        type: Boolean,
        default: true
      },
      roomTypeFlexibility: {
        type: String,
        enum: ['strict', 'upgrade_only', 'flexible'],
        default: 'upgrade_only'
      }
    },
    notificationSettings: {
      immediate: {
        type: Boolean,
        default: true
      },
      daily: {
        type: Boolean,
        default: false
      },
      weekly: {
        type: Boolean,
        default: false
      }
    }
  },

  // Tracking and analytics
  priority_score: {
    type: Number,
    default: 0
  },
  engagement_score: {
    type: Number,
    default: 0
  },

  // Advanced analytics
  analytics: {
    conversionProbability: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    revenueValue: {
      type: Number,
      default: 0
    },
    waitTimeToleranceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    competitorRisk: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
WaitingListSchema.index({ hotelId: 1, status: 1 });
WaitingListSchema.index({ hotelId: 1, roomType: 1, status: 1 });
WaitingListSchema.index({ hotelId: 1, 'preferredDates.checkIn': 1, 'preferredDates.checkOut': 1 });
WaitingListSchema.index({ email: 1 });
WaitingListSchema.index({ priority: 1, addedDate: 1 });
WaitingListSchema.index({ status: 1, vipStatus: -1, priority: 1 });
WaitingListSchema.index({ 'vipIntegration.vipGuestId': 1 });
WaitingListSchema.index({ 'priorityManagement.manualPriorityOverride': 1 });
WaitingListSchema.index({ 'analytics.conversionProbability': -1 });
WaitingListSchema.index({ 'statusTracking.waitingSince': 1 });
WaitingListSchema.index({ priority_score: -1, 'analytics.conversionProbability': -1 });

// Pre-save middleware to generate waitlistId
WaitingListSchema.pre('save', function(next) {
  if (!this.waitlistId) {
    this.waitlistId = `WL${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  // Calculate enhanced priority score
  this.calculatePriorityScore();

  // Calculate analytics scores
  this.calculateAnalyticsScores();

  // Update status tracking
  this.updateStatusTracking();

  next();
});

// Instance methods
WaitingListSchema.methods.addNote = function(content, createdBy, isInternal = true) {
  this.notes.push({
    content,
    createdBy,
    isInternal,
    createdAt: new Date()
  });
  return this.save();
};

WaitingListSchema.methods.addContact = function(method, message, contactedBy) {
  this.contactHistory.push({
    method,
    message,
    contactedBy,
    contactDate: new Date()
  });
  this.lastContact = new Date();
  return this.save();
};

WaitingListSchema.methods.updateStatus = function(newStatus, updatedBy) {
  const oldStatus = this.status;
  this.status = newStatus;

  // Add automatic note for status change
  this.notes.push({
    content: `Status changed from ${oldStatus} to ${newStatus}`,
    createdBy: updatedBy,
    isInternal: true,
    createdAt: new Date()
  });

  if (newStatus === 'contacted') {
    this.lastContact = new Date();
  }

  return this.save();
};

WaitingListSchema.methods.convertToBooking = function(bookingId, convertedBy) {
  this.convertedToBooking = {
    bookingId,
    convertedDate: new Date(),
    convertedBy
  };
  this.status = 'confirmed';
  return this.save();
};

// Enhanced priority score calculation
WaitingListSchema.methods.calculatePriorityScore = function() {
  let score = 0;

  // Use manual override if set
  if (this.priorityManagement.manualPriorityOverride) {
    const overrideScores = {
      'vip': 100,
      'urgent': 80,
      'high': 60,
      'medium': 40,
      'low': 20
    };
    score = overrideScores[this.priorityManagement.manualPriorityOverride] || 40;
  } else {
    // VIP status adds 50 points
    if (this.vipStatus) score += 50;

    // Enhanced loyalty tier scoring
    const loyaltyScores = {
      'Diamond': 45,
      'Platinum': 35,
      'Gold': 25,
      'Silver': 15,
      'Bronze': 8
    };
    if (this.loyaltyTier) {
      score += loyaltyScores[this.loyaltyTier] || 0;
    }

    // VIP integration scoring
    if (this.vipIntegration.vipGuestId) {
      score += 40;
    }
    if (this.vipIntegration.totalStays > 10) {
      score += Math.min(this.vipIntegration.totalStays * 2, 30);
    }
    if (this.vipIntegration.totalSpent > 10000) {
      score += Math.min(Math.floor(this.vipIntegration.totalSpent / 5000) * 5, 25);
    }

    // Priority level scoring
    const priorityScores = {
      'high': 35,
      'medium': 20,
      'low': 10
    };
    score += priorityScores[this.priority] || 0;

    // Time-based scoring with exponential curve
    const daysWaiting = Math.floor((Date.now() - this.statusTracking.waitingSince.getTime()) / (1000 * 60 * 60 * 24));
    if (daysWaiting > 7) {
      score += Math.min(daysWaiting * 3, 40); // Escalating priority for long waits
    } else {
      score += daysWaiting * 1.5;
    }

    // Engagement scoring
    const engagementBonus = Math.min(this.engagement_score * 0.2, 15);
    score += engagementBonus;

    // Room type demand scoring (higher demand = higher priority)
    const demandScores = {
      'Presidential Suite': 20,
      'Deluxe Suite': 15,
      'Executive Room': 10,
      'Deluxe Room': 8,
      'Standard Room': 5
    };
    score += demandScores[this.roomType] || 0;

    // Flexible criteria bonus
    if (this.roomMatching.matchCriteria.allowUpgrade) score += 5;
    if (this.roomMatching.matchCriteria.flexibleDates > 3) score += 10;
  }

  this.priority_score = Math.min(Math.round(score), 100);
  return this.priority_score;
};

// Calculate analytics scores
WaitingListSchema.methods.calculateAnalyticsScores = function() {
  // Conversion probability based on guest profile and behavior
  let conversionProb = 50; // Base probability

  // VIP guests have higher conversion
  if (this.vipStatus) conversionProb += 30;
  if (this.vipIntegration.vipGuestId) conversionProb += 25;

  // Loyalty impact
  const loyaltyImpact = {
    'Diamond': 35,
    'Platinum': 25,
    'Gold': 15,
    'Silver': 8,
    'Bronze': 3
  };
  conversionProb += loyaltyImpact[this.loyaltyTier] || 0;

  // Past behavior impact
  if (this.vipIntegration.totalStays > 5) {
    conversionProb += Math.min(this.vipIntegration.totalStays * 2, 20);
  }

  // Engagement impact
  conversionProb += Math.min(this.engagement_score * 0.3, 15);

  // Flexibility impact (more flexible = higher conversion)
  if (this.roomMatching.matchCriteria.allowUpgrade) conversionProb += 10;
  if (this.roomMatching.matchCriteria.flexibleDates > 5) conversionProb += 15;

  // Contact responsiveness
  const recentContacts = this.contactHistory.filter(
    contact => (Date.now() - contact.contactDate.getTime()) < (7 * 24 * 60 * 60 * 1000)
  );
  if (recentContacts.length > 0) conversionProb += 10;

  // Time decay (longer wait = lower conversion)
  const daysWaiting = Math.floor((Date.now() - this.statusTracking.waitingSince.getTime()) / (1000 * 60 * 60 * 24));
  if (daysWaiting > 14) {
    conversionProb -= Math.min((daysWaiting - 14) * 2, 25);
  }

  this.analytics.conversionProbability = Math.max(Math.min(Math.round(conversionProb), 100), 5);

  // Calculate revenue value
  const baseRate = this.maxRate || 5000; // Default rate if not specified
  const nights = Math.ceil((this.preferredDates.checkOut - this.preferredDates.checkIn) / (1000 * 60 * 60 * 24));
  this.analytics.revenueValue = baseRate * nights * (this.analytics.conversionProbability / 100);

  // Wait time tolerance (VIP and loyal guests have higher tolerance)
  let tolerance = 50;
  if (this.vipStatus) tolerance += 30;
  if (this.loyaltyTier === 'Diamond' || this.loyaltyTier === 'Platinum') tolerance += 20;
  if (this.vipIntegration.totalStays > 10) tolerance += 15;

  this.analytics.waitTimeToleranceScore = Math.min(tolerance, 100);

  // Competitor risk assessment
  const highValueGuest = this.vipStatus || ['Diamond', 'Platinum', 'Gold'].includes(this.loyaltyTier);
  const longWait = daysWaiting > 10;
  const lowEngagement = this.engagement_score < 30;

  if (highValueGuest && longWait) {
    this.analytics.competitorRisk = 'high';
  } else if (longWait || (highValueGuest && lowEngagement)) {
    this.analytics.competitorRisk = 'medium';
  } else {
    this.analytics.competitorRisk = 'low';
  }
};

// Update status tracking
WaitingListSchema.methods.updateStatusTracking = function() {
  // Update last activity if status changed or new contact
  if (this.isModified('status') || this.isModified('contactHistory')) {
    this.statusTracking.lastActivityDate = new Date();
  }

  // Calculate estimated wait time based on room type and historical data
  const demandFactors = {
    'Presidential Suite': 21,
    'Deluxe Suite': 14,
    'Executive Room': 7,
    'Deluxe Room': 5,
    'Standard Room': 3
  };

  let estimatedDays = demandFactors[this.roomType] || 7;

  // Adjust based on priority
  if (this.priority_score > 80) estimatedDays = Math.ceil(estimatedDays * 0.3);
  else if (this.priority_score > 60) estimatedDays = Math.ceil(estimatedDays * 0.5);
  else if (this.priority_score > 40) estimatedDays = Math.ceil(estimatedDays * 0.7);

  this.statusTracking.estimatedWaitTime = estimatedDays;
};

// Add match to history
WaitingListSchema.methods.addMatchHistory = function(roomDetails, matchScore, offeredRate) {
  if (!this.roomMatching.matchHistory) {
    this.roomMatching.matchHistory = [];
  }

  this.roomMatching.matchHistory.push({
    availableRoom: {
      roomId: roomDetails.roomId,
      roomType: roomDetails.roomType,
      roomNumber: roomDetails.roomNumber
    },
    matchScore,
    offeredRate,
    responseDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  });

  return this.save();
};

// Set manual priority override
WaitingListSchema.methods.setPriorityOverride = function(priority, reason, userId) {
  this.priorityManagement.manualPriorityOverride = priority;
  this.priorityManagement.overrideReason = reason;
  this.priorityManagement.overrideBy = userId;
  this.priorityManagement.overrideDate = new Date();
  this.priorityManagement.automaticPriority = false;

  return this.save();
};

// Remove priority override
WaitingListSchema.methods.removePriorityOverride = function() {
  this.priorityManagement.manualPriorityOverride = undefined;
  this.priorityManagement.overrideReason = undefined;
  this.priorityManagement.overrideBy = undefined;
  this.priorityManagement.overrideDate = undefined;
  this.priorityManagement.automaticPriority = true;

  return this.save();
};

// Static methods
WaitingListSchema.statics.getActiveWaitlist = function(hotelId, filters = {}) {
  const query = {
    hotelId,
    status: { $in: ['active', 'contacted'] },
    ...filters
  };

  return this.find(query)
    .populate('convertedToBooking.bookingId', 'bookingNumber')
    .populate('convertedToBooking.convertedBy', 'name email')
    .populate('notes.createdBy', 'name email')
    .populate('contactHistory.contactedBy', 'name email')
    .sort({ priority_score: -1, addedDate: 1 });
};

WaitingListSchema.statics.getWaitlistStats = function(hotelId) {
  return this.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgWaitTime: {
          $avg: {
            $divide: [
              { $subtract: ['$$NOW', '$addedDate'] },
              1000 * 60 * 60 * 24 // Convert to days
            ]
          }
        }
      }
    }
  ]);
};

WaitingListSchema.statics.findMatchingAvailability = function(hotelId, roomType, checkIn, checkOut) {
  // This would integrate with room availability logic
  // For now, return entries that match the criteria
  return this.find({
    hotelId,
    roomType,
    status: { $in: ['active', 'contacted'] },
    $or: [
      {
        'preferredDates.checkIn': { $lte: checkOut },
        'preferredDates.checkOut': { $gte: checkIn }
      },
      {
        'alternativeDates': {
          $elemMatch: {
            'checkIn': { $lte: checkOut },
            'checkOut': { $gte: checkIn }
          }
        }
      }
    ]
  }).sort({ priority_score: -1, addedDate: 1 });
};

const WaitingList = mongoose.model('WaitingList', WaitingListSchema);

export default WaitingList;
