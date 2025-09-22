import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     VIPGuest:
 *       type: object
 *       required:
 *         - guestId
 *         - vipLevel
 *         - status
 *       properties:
 *         _id:
 *           type: string
 *           description: VIP guest entry ID
 *         guestId:
 *           type: string
 *           description: Reference to guest user
 *         vipLevel:
 *           type: string
 *           enum: [bronze, silver, gold, platinum, diamond]
 *           description: VIP level tier
 *         status:
 *           type: string
 *           enum: [active, inactive, suspended, pending]
 *           description: VIP status
 *         benefits:
 *           type: object
 *           properties:
 *             roomUpgrade:
 *               type: boolean
 *               description: Room upgrade eligibility
 *             lateCheckout:
 *               type: boolean
 *               description: Late checkout privilege
 *             earlyCheckin:
 *               type: boolean
 *               description: Early check-in privilege
 *             complimentaryBreakfast:
 *               type: boolean
 *               description: Complimentary breakfast
 *             spaAccess:
 *               type: boolean
 *               description: Spa access privilege
 *             conciergeService:
 *               type: boolean
 *               description: Dedicated concierge service
 *             priorityReservation:
 *               type: boolean
 *               description: Priority reservation handling
 *             welcomeAmenities:
 *               type: boolean
 *               description: Welcome amenities
 *             airportTransfer:
 *               type: boolean
 *               description: Airport transfer service
 *             diningDiscount:
 *               type: number
 *               description: Dining discount percentage
 *             spaDiscount:
 *               type: number
 *               description: Spa discount percentage
 *         qualificationCriteria:
 *           type: object
 *           properties:
 *             totalStays:
 *               type: number
 *               description: Total number of stays
 *             totalNights:
 *               type: number
 *               description: Total nights stayed
 *             totalSpent:
 *               type: number
 *               description: Total amount spent
 *             averageRating:
 *               type: number
 *               description: Average guest rating
 *             lastStayDate:
 *               type: string
 *               format: date
 *               description: Date of last stay
 *         assignedConcierge:
 *           type: string
 *           description: Assigned concierge staff member
 *         specialRequests:
 *           type: array
 *           items:
 *             type: string
 *           description: Special service requests
 *         notes:
 *           type: string
 *           description: VIP guest notes
 *         anniversaryDate:
 *           type: string
 *           format: date
 *           description: VIP anniversary date
 *         expiryDate:
 *           type: string
 *           format: date
 *           description: VIP status expiry date
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         createdBy:
 *           type: string
 *           description: User who created VIP status
 *         updatedBy:
 *           type: string
 *           description: User who last updated VIP status
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const vipGuestSchema = new mongoose.Schema({
  guestId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Guest ID is required']
    // Remove unique: true here since we have compound unique index below
  },
  vipLevel: {
    type: String,
    required: [true, 'VIP level is required'],
    enum: {
      values: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
      message: 'Invalid VIP level'
    }
  },
  status: {
    type: String,
    required: [true, 'VIP status is required'],
    enum: {
      values: ['active', 'inactive', 'suspended', 'pending'],
      message: 'Invalid VIP status'
    },
    default: 'active'
  },
  benefits: {
    roomUpgrade: {
      type: Boolean,
      default: false
    },
    lateCheckout: {
      type: Boolean,
      default: false
    },
    earlyCheckin: {
      type: Boolean,
      default: false
    },
    complimentaryBreakfast: {
      type: Boolean,
      default: false
    },
    spaAccess: {
      type: Boolean,
      default: false
    },
    conciergeService: {
      type: Boolean,
      default: false
    },
    priorityReservation: {
      type: Boolean,
      default: false
    },
    welcomeAmenities: {
      type: Boolean,
      default: false
    },
    airportTransfer: {
      type: Boolean,
      default: false
    },
    diningDiscount: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    spaDiscount: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  qualificationCriteria: {
    totalStays: {
      type: Number,
      default: 0,
      min: 0
    },
    totalNights: {
      type: Number,
      default: 0,
      min: 0
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    lastStayDate: {
      type: Date
    }
  },
  assignedConcierge: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  specialRequests: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot be more than 1000 characters']
  },
  anniversaryDate: {
    type: Date
  },
  expiryDate: {
    type: Date,
    validate: {
      validator: function(value) {
        if (value && this.anniversaryDate && value <= this.anniversaryDate) {
          return false;
        }
        return true;
      },
      message: 'Expiry date must be after anniversary date'
    }
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Enhanced loyalty management
  loyaltyProgram: {
    currentTier: {
      type: String,
      enum: ['member', 'silver', 'gold', 'platinum', 'diamond'],
      default: 'member'
    },
    previousTier: String,
    tierUpgradeDate: Date,
    tierDowngradeDate: Date,
    nextTierRequirements: {
      staysNeeded: Number,
      nightsNeeded: Number,
      spendingNeeded: Number
    },
    pointsBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    pointsEarned: {
      type: Number,
      default: 0,
      min: 0
    },
    pointsRedeemed: {
      type: Number,
      default: 0,
      min: 0
    },
    membershipStartDate: {
      type: Date,
      default: Date.now
    },
    renewalDate: Date,
    tierBenefitsActivated: {
      type: Boolean,
      default: true
    }
  },

  // Enhanced benefits with tier-specific configuration
  tierBenefits: {
    member: {
      roomUpgradeEligibility: {
        type: Boolean,
        default: false
      },
      pointsMultiplier: {
        type: Number,
        default: 1
      },
      complimentaryServices: [String]
    },
    silver: {
      roomUpgradeEligibility: {
        type: Boolean,
        default: true
      },
      pointsMultiplier: {
        type: Number,
        default: 1.25
      },
      complimentaryServices: [String],
      priorityCheckIn: {
        type: Boolean,
        default: true
      }
    },
    gold: {
      roomUpgradeEligibility: {
        type: Boolean,
        default: true
      },
      pointsMultiplier: {
        type: Number,
        default: 1.5
      },
      complimentaryServices: [String],
      priorityCheckIn: {
        type: Boolean,
        default: true
      },
      lateCheckoutHours: {
        type: Number,
        default: 2
      }
    },
    platinum: {
      roomUpgradeEligibility: {
        type: Boolean,
        default: true
      },
      pointsMultiplier: {
        type: Number,
        default: 1.75
      },
      complimentaryServices: [String],
      priorityCheckIn: {
        type: Boolean,
        default: true
      },
      lateCheckoutHours: {
        type: Number,
        default: 4
      },
      conciergeAccess: {
        type: Boolean,
        default: true
      }
    },
    diamond: {
      roomUpgradeEligibility: {
        type: Boolean,
        default: true
      },
      pointsMultiplier: {
        type: Number,
        default: 2
      },
      complimentaryServices: [String],
      priorityCheckIn: {
        type: Boolean,
        default: true
      },
      lateCheckoutHours: {
        type: Number,
        default: 6
      },
      conciergeAccess: {
        type: Boolean,
        default: true
      },
      executiveFloorAccess: {
        type: Boolean,
        default: true
      },
      guaranteedRoomUpgrade: {
        type: Boolean,
        default: true
      }
    }
  },

  // Spending and activity tracking
  activityTracking: {
    currentYearSpending: {
      type: Number,
      default: 0,
      min: 0
    },
    currentYearStays: {
      type: Number,
      default: 0,
      min: 0
    },
    currentYearNights: {
      type: Number,
      default: 0,
      min: 0
    },
    lastActivityDate: Date,
    spendingHistory: [{
      year: Number,
      totalSpent: Number,
      totalStays: Number,
      totalNights: Number,
      tierAchieved: String
    }],
    milestoneAchievements: [{
      milestone: String,
      achievedDate: Date,
      value: Number,
      description: String
    }]
  },

  // Preference management
  enhancedPreferences: {
    roomPreferences: {
      preferredFloor: String,
      preferredRoomType: String,
      preferredView: String,
      smokingPreference: {
        type: String,
        enum: ['non-smoking', 'smoking', 'no-preference'],
        default: 'non-smoking'
      },
      bedType: {
        type: String,
        enum: ['king', 'queen', 'twin', 'sofa-bed', 'no-preference'],
        default: 'no-preference'
      }
    },
    servicePreferences: {
      preferredCheckInTime: String,
      preferredCheckOutTime: String,
      housekeepingPreference: {
        type: String,
        enum: ['morning', 'afternoon', 'evening', 'do-not-disturb'],
        default: 'afternoon'
      },
      turndownService: {
        type: Boolean,
        default: false
      },
      wakeUpCall: {
        type: Boolean,
        default: false
      }
    },
    diningPreferences: {
      cuisinePreferences: [String],
      diningRestrictions: [String],
      preferredRestaurants: [String],
      allergies: [String]
    },
    communicationPreferences: {
      preferredLanguage: {
        type: String,
        default: 'en'
      },
      contactMethod: {
        type: String,
        enum: ['email', 'phone', 'sms', 'whatsapp', 'mobile-app'],
        default: 'email'
      },
      marketingOptIn: {
        type: Boolean,
        default: true
      },
      promotionalOffers: {
        type: Boolean,
        default: true
      }
    }
  },

  // Recognition and rewards
  recognition: {
    recognitionLevel: {
      type: String,
      enum: ['standard', 'valued', 'preferred', 'distinguished', 'exceptional'],
      default: 'standard'
    },
    recognitionScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    lifetimeValue: {
      type: Number,
      default: 0,
      min: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    feedbackCount: {
      type: Number,
      default: 0,
      min: 0
    },
    complaintCount: {
      type: Number,
      default: 0,
      min: 0
    },
    complimentCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Personalization
  personalTouch: {
    personalizedGreeting: String,
    specialOccasions: [{
      type: {
        type: String,
        enum: ['birthday', 'anniversary', 'wedding', 'business', 'personal']
      },
      date: Date,
      description: String,
      acknowledged: {
        type: Boolean,
        default: false
      }
    }],
    guestHistory: [{
      stayDate: Date,
      roomNumber: String,
      roomType: String,
      purpose: String,
      satisfaction: Number,
      specialServices: [String],
      notes: String
    }],
    relationshipManager: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
vipGuestSchema.index({ guestId: 1, hotelId: 1 }, { unique: true });
vipGuestSchema.index({ vipLevel: 1, status: 1 });
vipGuestSchema.index({ hotelId: 1, status: 1 });
vipGuestSchema.index({ assignedConcierge: 1 });
vipGuestSchema.index({ anniversaryDate: 1 });
vipGuestSchema.index({ expiryDate: 1 });

// Enhanced pre-save middleware
vipGuestSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedBy = this.createdBy; // This will be updated by controller
  }

  // Auto-update tier based on qualifications
  this.updateTierStatus();

  // Calculate recognition score
  this.calculateRecognitionScore();

  // Update next tier requirements
  this.calculateNextTierRequirements();

  next();
});

// Virtual for guest details
vipGuestSchema.virtual('guest', {
  ref: 'User',
  localField: 'guestId',
  foreignField: '_id',
  justOne: true
});

// Virtual for creator details
vipGuestSchema.virtual('creator', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true
});

// Virtual for updater details
vipGuestSchema.virtual('updater', {
  ref: 'User',
  localField: 'updatedBy',
  foreignField: '_id',
  justOne: true
});

// Virtual for concierge details
vipGuestSchema.virtual('concierge', {
  ref: 'User',
  localField: 'assignedConcierge',
  foreignField: '_id',
  justOne: true
});

// Static method to get VIP statistics
vipGuestSchema.statics.getVIPStatistics = async function(hotelId) {
  const stats = await this.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
        suspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        byLevel: {
          $push: {
            level: '$vipLevel',
            status: '$status'
          }
        },
        totalSpent: { $sum: '$qualificationCriteria.totalSpent' },
        totalStays: { $sum: '$qualificationCriteria.totalStays' },
        totalNights: { $sum: '$qualificationCriteria.totalNights' }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      total: 0,
      active: 0,
      inactive: 0,
      suspended: 0,
      pending: 0,
      byLevel: {},
      totalSpent: 0,
      totalStays: 0,
      totalNights: 0
    };
  }

  const result = stats[0];
  
  // Calculate level breakdown
  const levelStats = {};
  result.byLevel.forEach(item => {
    if (!levelStats[item.level]) {
      levelStats[item.level] = { total: 0, active: 0, inactive: 0, suspended: 0, pending: 0 };
    }
    levelStats[item.level].total++;
    levelStats[item.level][item.status]++;
  });

  return {
    total: result.total,
    active: result.active,
    inactive: result.inactive,
    suspended: result.suspended,
    pending: result.pending,
    byLevel: levelStats,
    totalSpent: result.totalSpent,
    totalStays: result.totalStays,
    totalNights: result.totalNights
  };
};

// Static method to get expiring VIPs
vipGuestSchema.statics.getExpiringVIPs = async function(hotelId, days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return await this.find({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    status: 'active',
    expiryDate: { $lte: futureDate, $gte: new Date() }
  }).populate('guestId', 'name email phone');
};

// Static method to auto-expire VIPs
vipGuestSchema.statics.autoExpireVIPs = async function(hotelId) {
  const currentDate = new Date();
  
  const result = await this.updateMany(
    {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'active',
      expiryDate: { $lte: currentDate }
    },
    {
      $set: {
        status: 'inactive',
        updatedBy: null // System update
      }
    }
  );

  return result.modifiedCount;
};

// Instance method to calculate VIP level based on criteria
vipGuestSchema.methods.calculateVIPLevel = function() {
  const { totalStays, totalNights, totalSpent, averageRating } = this.qualificationCriteria;
  
  // VIP Level calculation logic
  if (totalSpent >= 50000 && totalStays >= 20 && averageRating >= 4.5) {
    return 'diamond';
  } else if (totalSpent >= 25000 && totalStays >= 15 && averageRating >= 4.0) {
    return 'platinum';
  } else if (totalSpent >= 10000 && totalStays >= 10 && averageRating >= 3.5) {
    return 'gold';
  } else if (totalSpent >= 5000 && totalStays >= 5 && averageRating >= 3.0) {
    return 'silver';
  } else if (totalSpent >= 2000 && totalStays >= 2) {
    return 'bronze';
  }
  
  return null; // Not qualified for VIP
};

// Instance method to update qualification criteria
vipGuestSchema.methods.updateQualificationCriteria = function(stayData) {
  this.qualificationCriteria.totalStays += 1;
  this.qualificationCriteria.totalNights += stayData.nights || 1;
  this.qualificationCriteria.totalSpent += stayData.amount || 0;
  this.qualificationCriteria.lastStayDate = new Date();
  
  // Update average rating if provided
  if (stayData.rating) {
    const currentRating = this.qualificationCriteria.averageRating;
    const totalStays = this.qualificationCriteria.totalStays;
    this.qualificationCriteria.averageRating = 
      ((currentRating * (totalStays - 1)) + stayData.rating) / totalStays;
  }
  
  return this.save();
};

// Method to update tier status automatically
vipGuestSchema.methods.updateTierStatus = function() {
  const newTier = this.calculateVIPLevel();

  if (newTier && newTier !== this.loyaltyProgram.currentTier) {
    this.loyaltyProgram.previousTier = this.loyaltyProgram.currentTier;
    this.loyaltyProgram.currentTier = newTier;
    this.vipLevel = newTier; // Keep backward compatibility

    if (newTier > this.loyaltyProgram.previousTier) {
      this.loyaltyProgram.tierUpgradeDate = new Date();
    } else {
      this.loyaltyProgram.tierDowngradeDate = new Date();
    }
  }
};

// Calculate recognition score
vipGuestSchema.methods.calculateRecognitionScore = function() {
  let score = 0;

  // Base scoring from qualifications
  const { totalStays, totalSpent, averageRating } = this.qualificationCriteria;

  // Spending component (30%)
  if (totalSpent > 100000) score += 30;
  else if (totalSpent > 50000) score += 25;
  else if (totalSpent > 25000) score += 20;
  else if (totalSpent > 10000) score += 15;
  else score += Math.min(totalSpent / 1000, 10);

  // Frequency component (25%)
  if (totalStays > 20) score += 25;
  else if (totalStays > 15) score += 20;
  else if (totalStays > 10) score += 15;
  else if (totalStays > 5) score += 10;
  else score += totalStays * 2;

  // Satisfaction component (25%)
  if (averageRating > 4.5) score += 25;
  else if (averageRating > 4.0) score += 20;
  else if (averageRating > 3.5) score += 15;
  else if (averageRating > 3.0) score += 10;
  else score += averageRating * 3;

  // Feedback and engagement component (20%)
  const feedbackRatio = this.recognition.feedbackCount > 0 ?
    (this.recognition.complimentCount / this.recognition.feedbackCount) : 0;
  score += feedbackRatio * 10;

  // Penalty for complaints
  score -= this.recognition.complaintCount * 3;

  // Current year activity bonus
  if (this.activityTracking.currentYearStays > 5) score += 10;
  if (this.activityTracking.currentYearSpending > 25000) score += 10;

  this.recognition.recognitionScore = Math.max(0, Math.min(score, 100));
};

// Calculate next tier requirements
vipGuestSchema.methods.calculateNextTierRequirements = function() {
  const currentTier = this.loyaltyProgram.currentTier;
  const requirements = {
    staysNeeded: 0,
    nightsNeeded: 0,
    spendingNeeded: 0
  };

  const tierRequirements = {
    member: { stays: 2, nights: 5, spending: 2000 },
    silver: { stays: 5, nights: 10, spending: 5000 },
    gold: { stays: 10, nights: 25, spending: 10000 },
    platinum: { stays: 15, nights: 50, spending: 25000 },
    diamond: { stays: 20, nights: 75, spending: 50000 }
  };

  const tiers = ['member', 'silver', 'gold', 'platinum', 'diamond'];
  const currentIndex = tiers.indexOf(currentTier);

  if (currentIndex < tiers.length - 1) {
    const nextTier = tiers[currentIndex + 1];
    const nextReqs = tierRequirements[nextTier];

    requirements.staysNeeded = Math.max(0, nextReqs.stays - this.qualificationCriteria.totalStays);
    requirements.nightsNeeded = Math.max(0, nextReqs.nights - this.qualificationCriteria.totalNights);
    requirements.spendingNeeded = Math.max(0, nextReqs.spending - this.qualificationCriteria.totalSpent);
  }

  this.loyaltyProgram.nextTierRequirements = requirements;
};

// Method to add points
vipGuestSchema.methods.addLoyaltyPoints = function(points, source = 'stay') {
  const multiplier = this.tierBenefits[this.loyaltyProgram.currentTier]?.pointsMultiplier || 1;
  const finalPoints = Math.round(points * multiplier);

  this.loyaltyProgram.pointsBalance += finalPoints;
  this.loyaltyProgram.pointsEarned += finalPoints;

  // Record milestone if significant
  if (finalPoints >= 1000) {
    this.activityTracking.milestoneAchievements.push({
      milestone: 'points_earned',
      achievedDate: new Date(),
      value: finalPoints,
      description: `Earned ${finalPoints} points from ${source}`
    });
  }

  return this.save();
};

// Method to redeem points
vipGuestSchema.methods.redeemPoints = function(points, description = '') {
  if (this.loyaltyProgram.pointsBalance < points) {
    throw new Error('Insufficient points balance');
  }

  this.loyaltyProgram.pointsBalance -= points;
  this.loyaltyProgram.pointsRedeemed += points;

  // Record redemption
  this.activityTracking.milestoneAchievements.push({
    milestone: 'points_redeemed',
    achievedDate: new Date(),
    value: points,
    description: description || `Redeemed ${points} points`
  });

  return this.save();
};

// Method to add special occasion
vipGuestSchema.methods.addSpecialOccasion = function(occasionData) {
  if (!this.personalTouch.specialOccasions) {
    this.personalTouch.specialOccasions = [];
  }

  this.personalTouch.specialOccasions.push({
    type: occasionData.type,
    date: occasionData.date,
    description: occasionData.description,
    acknowledged: false
  });

  return this.save();
};

// Method to get tier benefits
vipGuestSchema.methods.getCurrentTierBenefits = function() {
  const currentTier = this.loyaltyProgram.currentTier;
  const benefits = this.tierBenefits[currentTier] || {};

  // Combine with general benefits
  return {
    ...benefits,
    generalBenefits: this.getBenefitSummary()
  };
};

// Instance method to get benefit summary
vipGuestSchema.methods.getBenefitSummary = function() {
  const benefits = [];
  
  if (this.benefits.roomUpgrade) benefits.push('Room Upgrade');
  if (this.benefits.lateCheckout) benefits.push('Late Checkout');
  if (this.benefits.earlyCheckin) benefits.push('Early Check-in');
  if (this.benefits.complimentaryBreakfast) benefits.push('Complimentary Breakfast');
  if (this.benefits.spaAccess) benefits.push('Spa Access');
  if (this.benefits.conciergeService) benefits.push('Concierge Service');
  if (this.benefits.priorityReservation) benefits.push('Priority Reservation');
  if (this.benefits.welcomeAmenities) benefits.push('Welcome Amenities');
  if (this.benefits.airportTransfer) benefits.push('Airport Transfer');
  
  if (this.benefits.diningDiscount > 0) {
    benefits.push(`${this.benefits.diningDiscount}% Dining Discount`);
  }
  if (this.benefits.spaDiscount > 0) {
    benefits.push(`${this.benefits.spaDiscount}% Spa Discount`);
  }
  
  return benefits;
};

export default mongoose.model('VIPGuest', vipGuestSchema);
