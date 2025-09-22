import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     RoomUpgrade:
 *       type: object
 *       required:
 *         - hotelId
 *         - bookingId
 *         - fromRoomType
 *         - toRoomType
 *         - upgradeType
 *       properties:
 *         _id:
 *           type: string
 *           description: Room upgrade ID
 *         upgradeId:
 *           type: string
 *           description: Unique upgrade identifier
 *         hotelId:
 *           type: string
 *           description: Hotel reference
 *         bookingId:
 *           type: string
 *           description: Associated booking reference
 *         advancedReservationId:
 *           type: string
 *           description: Associated advanced reservation reference
 *         fromRoomType:
 *           type: string
 *           description: Original room type
 *         toRoomType:
 *           type: string
 *           description: Upgraded room type
 *         fromRoomId:
 *           type: string
 *           description: Original room ID
 *         toRoomId:
 *           type: string
 *           description: Upgraded room ID
 *         upgradeType:
 *           type: string
 *           enum: [complimentary, paid, loyalty_benefit, vip_courtesy, oversold_compensation, operational]
 *           description: Type of upgrade
 *         status:
 *           type: string
 *           enum: [pending, approved, declined, confirmed, applied, cancelled]
 *           description: Upgrade status
 *         eligibilityScore:
 *           type: number
 *           description: Upgrade eligibility score (0-100)
 *         pricing:
 *           type: object
 *           properties:
 *             originalRate:
 *               type: number
 *               description: Original room rate
 *             upgradedRate:
 *               type: number
 *               description: Upgraded room rate
 *             upgradeCharge:
 *               type: number
 *               description: Additional upgrade charge
 *             discountApplied:
 *               type: number
 *               description: Discount applied to upgrade
 *             finalCharge:
 *               type: number
 *               description: Final charge for upgrade
 *         approvalWorkflow:
 *           type: object
 *           properties:
 *             requiresApproval:
 *               type: boolean
 *               description: Whether upgrade requires approval
 *             approvalLevel:
 *               type: string
 *               enum: [none, supervisor, manager, gm, revenue_manager]
 *               description: Required approval level
 *             approvedBy:
 *               type: string
 *               description: User who approved the upgrade
 *             approvedAt:
 *               type: string
 *               format: date-time
 *               description: Approval timestamp
 *             approvalComments:
 *               type: string
 *               description: Approval comments
 *         availability:
 *           type: object
 *           properties:
 *             isAvailable:
 *               type: boolean
 *               description: Room availability status
 *             availabilityCheckedAt:
 *               type: string
 *               format: date-time
 *               description: Last availability check
 *             availabilityWindow:
 *               type: object
 *               properties:
 *                 checkIn:
 *                   type: string
 *                   format: date
 *                 checkOut:
 *                   type: string
 *                   format: date
 *             alternativeOptions:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   roomType:
 *                     type: string
 *                   roomId:
 *                     type: string
 *                   rate:
 *                     type: number
 *                   available:
 *                     type: boolean
 *         analytics:
 *           type: object
 *           properties:
 *             revenueImpact:
 *               type: number
 *               description: Revenue impact of the upgrade
 *             customerSatisfactionScore:
 *               type: number
 *               description: Expected customer satisfaction impact
 *             operationalComplexity:
 *               type: number
 *               description: Operational complexity score
 *             competitiveAdvantage:
 *               type: number
 *               description: Competitive advantage score
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const roomUpgradeSchema = new mongoose.Schema({
  upgradeId: {
    type: String,
    unique: true,
    required: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking ID is required']
  },
  advancedReservationId: {
    type: mongoose.Schema.ObjectId,
    ref: 'AdvancedReservation'
  },

  // Room details
  fromRoomType: {
    type: String,
    required: [true, 'Original room type is required'],
    trim: true
  },
  toRoomType: {
    type: String,
    required: [true, 'Upgraded room type is required'],
    trim: true
  },
  fromRoomId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Room'
  },
  toRoomId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Room'
  },
  fromRoomNumber: {
    type: String,
    trim: true
  },
  toRoomNumber: {
    type: String,
    trim: true
  },

  // Upgrade classification
  upgradeType: {
    type: String,
    required: [true, 'Upgrade type is required'],
    enum: {
      values: [
        'complimentary',          // Free upgrade due to availability/loyalty
        'paid',                   // Guest pays for upgrade
        'loyalty_benefit',        // Loyalty program benefit
        'vip_courtesy',          // VIP guest courtesy upgrade
        'oversold_compensation', // Compensation for overselling
        'operational',           // Operational reasons (maintenance, etc.)
        'promotional',           // Promotional upgrade offer
        'group_benefit',         // Group booking benefit
        'last_minute'            // Last-minute upgrade offer
      ],
      message: 'Invalid upgrade type'
    }
  },

  // Status management
  status: {
    type: String,
    enum: {
      values: [
        'pending',      // Upgrade request pending
        'approved',     // Upgrade approved but not applied
        'declined',     // Upgrade request declined
        'confirmed',    // Guest confirmed upgrade
        'applied',      // Upgrade has been applied
        'cancelled'     // Upgrade cancelled
      ],
      message: 'Invalid upgrade status'
    },
    default: 'pending'
  },

  // Eligibility and scoring
  eligibilityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  eligibilityCriteria: {
    guestProfile: {
      vipStatus: Boolean,
      loyaltyTier: String,
      totalStays: Number,
      totalSpent: Number
    },
    bookingProfile: {
      reservationType: String,
      advanceBooking: Number, // days in advance
      lengthOfStay: Number,
      totalValue: Number
    },
    operationalFactors: {
      availability: Number,        // availability score
      demandLevel: String,        // low, medium, high
      seasonality: String,        // off_peak, peak, high_peak
      dayOfWeek: String
    }
  },

  // Pricing structure
  pricing: {
    originalRate: {
      type: Number,
      required: true,
      min: 0
    },
    upgradedRate: {
      type: Number,
      required: true,
      min: 0
    },
    upgradeCharge: {
      type: Number,
      default: 0,
      min: 0
    },
    discountApplied: {
      type: Number,
      default: 0,
      min: 0
    },
    finalCharge: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR'
    },
    taxIncluded: {
      type: Boolean,
      default: false
    },
    validUntil: {
      type: Date
    }
  },

  // Approval workflow
  approvalWorkflow: {
    requiresApproval: {
      type: Boolean,
      default: false
    },
    approvalLevel: {
      type: String,
      enum: ['none', 'supervisor', 'manager', 'gm', 'revenue_manager'],
      default: 'none'
    },
    autoApprovalRules: {
      maxUpgradeValue: Number,
      allowedUpgradeTypes: [String],
      vipAutoApproval: Boolean,
      loyaltyAutoApproval: Boolean
    },
    approvalHistory: [{
      stage: String,
      approvedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      decision: {
        type: String,
        enum: ['approved', 'declined', 'escalated', 'pending']
      },
      comments: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      automaticDecision: {
        type: Boolean,
        default: false
      }
    }],
    currentStage: {
      type: String,
      enum: ['none', 'pending_supervisor', 'pending_manager', 'pending_gm', 'pending_revenue', 'completed'],
      default: 'none'
    },
    approvedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    approvalComments: {
      type: String,
      maxlength: 500
    }
  },

  // Availability management
  availability: {
    isAvailable: {
      type: Boolean,
      default: false
    },
    availabilityCheckedAt: {
      type: Date
    },
    availabilityWindow: {
      checkIn: Date,
      checkOut: Date
    },
    roomBlocked: {
      type: Boolean,
      default: false
    },
    blockExpiresAt: Date,
    alternativeOptions: [{
      roomType: String,
      roomId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Room'
      },
      roomNumber: String,
      rate: Number,
      available: Boolean,
      upgradeLevel: Number // 1 = one level up, 2 = two levels up, etc.
    }]
  },

  // Guest interaction
  guestInteraction: {
    offerSentAt: Date,
    offerMethod: {
      type: String,
      enum: ['email', 'phone', 'sms', 'whatsapp', 'in_person', 'mobile_app']
    },
    responseDeadline: Date,
    guestResponse: {
      type: String,
      enum: ['accepted', 'declined', 'pending', 'expired']
    },
    responseReceivedAt: Date,
    guestComments: String,
    followUpRequired: {
      type: Boolean,
      default: false
    },
    followUpDate: Date
  },

  // Analytics and reporting
  analytics: {
    revenueImpact: {
      type: Number,
      default: 0
    },
    customerSatisfactionScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    operationalComplexity: {
      type: Number,
      min: 0,
      max: 100,
      default: 20
    },
    competitiveAdvantage: {
      type: Number,
      min: 0,
      max: 100,
      default: 30
    },
    conversionProbability: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    timeToDecision: Number, // hours
    upgradeUtilization: {
      type: Number,
      min: 0,
      max: 100
    }
  },

  // Operational tracking
  operational: {
    assignedTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    department: {
      type: String,
      enum: ['front_desk', 'reservations', 'revenue_management', 'guest_relations', 'housekeeping']
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    notes: [{
      content: String,
      createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      noteType: {
        type: String,
        enum: ['general', 'approval', 'guest_interaction', 'operational']
      }
    }],
    systemNotes: [{
      event: String,
      details: mongoose.Schema.Types.Mixed,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Integration tracking
  integration: {
    syncedToPMS: {
      type: Boolean,
      default: false
    },
    syncedToRevenue: {
      type: Boolean,
      default: false
    },
    lastSyncAt: Date,
    syncErrors: [{
      system: String,
      error: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      resolved: Boolean
    }]
  },

  // Audit trail
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Expiration and cleanup
  expiresAt: {
    type: Date
  },
  reason: {
    type: String,
    maxlength: 200
  },

  // Cancellation tracking
  cancellation: {
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    cancellationReason: String,
    refundRequired: Boolean
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance optimization (remove duplicates to avoid conflicts)
roomUpgradeSchema.index({ hotelId: 1, status: 1 });
roomUpgradeSchema.index({ bookingId: 1 });
roomUpgradeSchema.index({ upgradeId: 1 }); // Remove unique: true (already defined in schema)
roomUpgradeSchema.index({ hotelId: 1, upgradeType: 1 });
roomUpgradeSchema.index({ hotelId: 1, 'approvalWorkflow.currentStage': 1 });
roomUpgradeSchema.index({ 'eligibilityScore': -1 });
roomUpgradeSchema.index({ 'analytics.revenueImpact': -1 });
roomUpgradeSchema.index({ createdAt: -1 });
roomUpgradeSchema.index({ 'guestInteraction.responseDeadline': 1 });
roomUpgradeSchema.index({ expiresAt: 1 });

// TTL index for expired upgrade offers
roomUpgradeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware
roomUpgradeSchema.pre('save', function(next) {
  try {
    // Generate upgrade ID if not exists
    if (!this.upgradeId) {
      const timestamp = Date.now().toString();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      this.upgradeId = `UPG${timestamp.slice(-8)}${random}`;
    }

    // Calculate eligibility score safely
    if (typeof this.calculateEligibilityScore === 'function') {
      this.calculateEligibilityScore();
    }

    // Calculate pricing safely
    if (typeof this.calculatePricing === 'function') {
      this.calculatePricing();
    }

    // Set approval requirements safely
    if (typeof this.setApprovalRequirements === 'function') {
      this.setApprovalRequirements();
    }

    // Calculate analytics safely
    if (typeof this.calculateAnalytics === 'function') {
      this.calculateAnalytics();
    }

    // Set expiration safely
    if (typeof this.setExpiration === 'function') {
      this.setExpiration();
    }

    next();
  } catch (error) {
    console.error('Error in RoomUpgrade pre-save middleware:', error);
    next(error);
  }
});

// Calculate eligibility score based on multiple factors
roomUpgradeSchema.methods.calculateEligibilityScore = function() {
  let score = 0;

  // Guest profile factors (40% weight)
  if (this.eligibilityCriteria.guestProfile) {
    const profile = this.eligibilityCriteria.guestProfile;

    if (profile.vipStatus) score += 40;

    const loyaltyScores = {
      'diamond': 35,
      'platinum': 30,
      'gold': 20,
      'silver': 10,
      'bronze': 5
    };
    score += loyaltyScores[profile.loyaltyTier?.toLowerCase()] || 0;

    if (profile.totalStays > 10) score += Math.min(profile.totalStays, 20);
    if (profile.totalSpent > 50000) score += Math.min(Math.floor(profile.totalSpent / 10000) * 2, 15);
  }

  // Booking profile factors (30% weight)
  if (this.eligibilityCriteria.bookingProfile) {
    const booking = this.eligibilityCriteria.bookingProfile;

    if (booking.reservationType === 'vip') score += 20;
    else if (booking.reservationType === 'corporate') score += 15;
    else if (booking.reservationType === 'loyalty') score += 10;

    if (booking.advanceBooking > 30) score += 10;
    else if (booking.advanceBooking > 14) score += 5;

    if (booking.lengthOfStay > 7) score += 10;
    else if (booking.lengthOfStay > 3) score += 5;

    if (booking.totalValue > 25000) score += 15;
    else if (booking.totalValue > 10000) score += 8;
  }

  // Operational factors (30% weight)
  if (this.eligibilityCriteria.operationalFactors) {
    const operational = this.eligibilityCriteria.operationalFactors;

    score += operational.availability || 0;

    const demandScores = { 'low': 15, 'medium': 10, 'high': 5 };
    score += demandScores[operational.demandLevel] || 0;

    const seasonScores = { 'off_peak': 15, 'peak': 8, 'high_peak': 3 };
    score += seasonScores[operational.seasonality] || 0;

    if (['monday', 'tuesday', 'wednesday', 'thursday'].includes(operational.dayOfWeek)) {
      score += 8; // Higher upgrade eligibility on weekdays
    }
  }

  this.eligibilityScore = Math.min(Math.round(score), 100);
  return this.eligibilityScore;
};

// Calculate pricing for the upgrade
roomUpgradeSchema.methods.calculatePricing = function() {
  // Initialize pricing object if not exists
  if (!this.pricing) {
    this.pricing = {};
  }

  if (!this.pricing.originalRate || !this.pricing.upgradedRate) {
    return;
  }

  const baseUpgradeCharge = this.pricing.upgradedRate - this.pricing.originalRate;
  let finalCharge = baseUpgradeCharge;

  // Apply discounts based on upgrade type
  let discount = 0;
  switch (this.upgradeType) {
    case 'complimentary':
    case 'loyalty_benefit':
    case 'vip_courtesy':
    case 'oversold_compensation':
      discount = 100; // Free upgrade
      break;
    case 'promotional':
      discount = 50; // 50% discount
      break;
    case 'group_benefit':
      discount = 25; // 25% discount
      break;
    case 'last_minute':
      discount = 30; // 30% discount
      break;
  }

  // Additional discounts based on guest profile
  if (this.eligibilityScore > 80) {
    discount = Math.max(discount, 75);
  } else if (this.eligibilityScore > 60) {
    discount = Math.max(discount, 50);
  } else if (this.eligibilityScore > 40) {
    discount = Math.max(discount, 25);
  }

  const discountAmount = (baseUpgradeCharge * discount) / 100;
  finalCharge = Math.max(0, baseUpgradeCharge - discountAmount);

  this.pricing.upgradeCharge = baseUpgradeCharge;
  this.pricing.discountApplied = discountAmount;
  this.pricing.finalCharge = Math.round(finalCharge * 100) / 100; // Round to 2 decimal places
};

// Set approval requirements based on upgrade characteristics
roomUpgradeSchema.methods.setApprovalRequirements = function() {
  let requiresApproval = false;
  let approvalLevel = 'none';

  // High-value upgrades require approval
  if (this.pricing.finalCharge > 5000) {
    requiresApproval = true;
    approvalLevel = 'manager';
  } else if (this.pricing.finalCharge > 2000) {
    requiresApproval = true;
    approvalLevel = 'supervisor';
  }

  // Complimentary upgrades above certain threshold require approval
  if (this.upgradeType === 'complimentary' && this.pricing.upgradeCharge > 1000) {
    requiresApproval = true;
    approvalLevel = this.pricing.upgradeCharge > 3000 ? 'manager' : 'supervisor';
  }

  // VIP upgrades might need GM approval
  if (this.upgradeType === 'vip_courtesy' && this.pricing.upgradeCharge > 5000) {
    requiresApproval = true;
    approvalLevel = 'gm';
  }

  // Oversold compensation might need revenue manager approval
  if (this.upgradeType === 'oversold_compensation') {
    requiresApproval = true;
    approvalLevel = 'revenue_manager';
  }

  this.approvalWorkflow.requiresApproval = requiresApproval;
  this.approvalWorkflow.approvalLevel = approvalLevel;

  if (requiresApproval) {
    this.approvalWorkflow.currentStage = `pending_${approvalLevel}`;
  }
};

// Calculate analytics scores
roomUpgradeSchema.methods.calculateAnalytics = function() {
  // Revenue impact
  this.analytics.revenueImpact = this.pricing.finalCharge;

  // Customer satisfaction score based on upgrade value and guest profile
  let satisfactionScore = 60; // Base score

  if (this.upgradeType === 'complimentary' || this.upgradeType === 'loyalty_benefit') {
    satisfactionScore += 30;
  } else if (this.upgradeType === 'vip_courtesy') {
    satisfactionScore += 25;
  }

  if (this.eligibilityScore > 70) satisfactionScore += 15;
  if (this.pricing.discountApplied > 0) satisfactionScore += 10;

  this.analytics.customerSatisfactionScore = Math.min(satisfactionScore, 100);

  // Operational complexity
  let complexity = 20; // Base complexity

  if (this.approvalWorkflow.requiresApproval) complexity += 20;
  if (this.upgradeType === 'oversold_compensation') complexity += 30;
  if (!this.availability.isAvailable) complexity += 25;

  this.analytics.operationalComplexity = Math.min(complexity, 100);

  // Conversion probability based on guest profile and offer attractiveness
  let conversionProb = 40; // Base probability

  if (this.eligibilityScore > 80) conversionProb += 30;
  else if (this.eligibilityScore > 60) conversionProb += 20;
  else if (this.eligibilityScore > 40) conversionProb += 10;

  if (this.pricing.finalCharge === 0) conversionProb += 25; // Free upgrade
  else if (this.pricing.discountApplied > 50) conversionProb += 15;

  this.analytics.conversionProbability = Math.min(conversionProb, 95);
};

// Set expiration for upgrade offers
roomUpgradeSchema.methods.setExpiration = function() {
  if (!this.expiresAt && this.status === 'pending') {
    const hoursToExpire = this.upgradeType === 'last_minute' ? 2 : 24;
    this.expiresAt = new Date(Date.now() + hoursToExpire * 60 * 60 * 1000);
  }
};

// Instance method to approve upgrade
roomUpgradeSchema.methods.approve = function(approvedBy, comments = '') {
  this.status = 'approved';
  this.approvalWorkflow.approvedBy = approvedBy;
  this.approvalWorkflow.approvedAt = new Date();
  this.approvalWorkflow.approvalComments = comments;
  this.approvalWorkflow.currentStage = 'completed';

  // Add to approval history
  this.approvalWorkflow.approvalHistory.push({
    stage: this.approvalWorkflow.approvalLevel,
    approvedBy,
    decision: 'approved',
    comments,
    timestamp: new Date()
  });

  return this.save();
};

// Instance method to decline upgrade
roomUpgradeSchema.methods.decline = function(declinedBy, reason = '') {
  this.status = 'declined';
  this.approvalWorkflow.currentStage = 'completed';

  // Add to approval history
  this.approvalWorkflow.approvalHistory.push({
    stage: this.approvalWorkflow.approvalLevel,
    approvedBy: declinedBy,
    decision: 'declined',
    comments: reason,
    timestamp: new Date()
  });

  return this.save();
};

// Instance method to check availability
roomUpgradeSchema.methods.checkAvailability = async function() {
  // This would integrate with room availability system
  // For now, simulate availability check
  this.availability.availabilityCheckedAt = new Date();

  // Placeholder logic - in real implementation, this would query room availability
  const availabilityProbability = Math.random();
  this.availability.isAvailable = availabilityProbability > 0.3; // 70% chance of availability

  return this.save();
};

// Static method to get upgrade statistics
roomUpgradeSchema.statics.getUpgradeStats = async function(hotelId, dateRange = {}) {
  const matchStage = { hotelId: new mongoose.Types.ObjectId(hotelId) };

  if (dateRange.start && dateRange.end) {
    matchStage.createdAt = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end)
    };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalUpgrades: { $sum: 1 },
        approvedUpgrades: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        },
        appliedUpgrades: {
          $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] }
        },
        totalRevenue: { $sum: '$analytics.revenueImpact' },
        avgEligibilityScore: { $avg: '$eligibilityScore' },
        avgSatisfactionScore: { $avg: '$analytics.customerSatisfactionScore' },
        byType: { $push: '$upgradeType' },
        byStatus: { $push: '$status' }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalUpgrades: 0,
      approvedUpgrades: 0,
      appliedUpgrades: 0,
      conversionRate: 0,
      totalRevenue: 0,
      avgEligibilityScore: 0,
      avgSatisfactionScore: 0,
      byType: {},
      byStatus: {}
    };
  }

  const result = stats[0];

  // Calculate type distribution
  const typeDistribution = {};
  result.byType.forEach(type => {
    typeDistribution[type] = (typeDistribution[type] || 0) + 1;
  });

  // Calculate status distribution
  const statusDistribution = {};
  result.byStatus.forEach(status => {
    statusDistribution[status] = (statusDistribution[status] || 0) + 1;
  });

  return {
    totalUpgrades: result.totalUpgrades,
    approvedUpgrades: result.approvedUpgrades,
    appliedUpgrades: result.appliedUpgrades,
    conversionRate: result.totalUpgrades > 0 ? Math.round((result.appliedUpgrades / result.totalUpgrades) * 100) : 0,
    totalRevenue: Math.round(result.totalRevenue || 0),
    avgEligibilityScore: Math.round(result.avgEligibilityScore || 0),
    avgSatisfactionScore: Math.round(result.avgSatisfactionScore || 0),
    byType: typeDistribution,
    byStatus: statusDistribution
  };
};

// Static method to get pending approvals
roomUpgradeSchema.statics.getPendingApprovals = async function(hotelId, approvalLevel = null) {
  const query = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    'approvalWorkflow.requiresApproval': true,
    'approvalWorkflow.currentStage': { $nin: ['completed'] }
  };

  if (approvalLevel) {
    query['approvalWorkflow.approvalLevel'] = approvalLevel;
  }

  return await this.find(query)
    .populate('bookingId', 'bookingNumber guestDetails checkIn checkOut')
    .populate('createdBy', 'name email')
    .sort({ 'analytics.revenueImpact': -1, createdAt: 1 });
};

// Static method to get eligible upgrades for a booking
roomUpgradeSchema.statics.getEligibleUpgrades = async function(hotelId, bookingId) {
  return await this.find({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    bookingId: new mongoose.Types.ObjectId(bookingId),
    status: { $in: ['pending', 'approved'] },
    expiresAt: { $gt: new Date() }
  }).sort({ eligibilityScore: -1 });
};

export default mongoose.model('RoomUpgrade', roomUpgradeSchema);