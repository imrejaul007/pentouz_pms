import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     AdvancedReservation:
 *       type: object
 *       required:
 *         - hotelId
 *         - bookingId
 *         - reservationType
 *         - priority
 *       properties:
 *         _id:
 *           type: string
 *           description: Advanced reservation ID
 *         reservationId:
 *           type: string
 *           description: Unique reservation identifier
 *         bookingId:
 *           type: string
 *           description: Reference to main booking
 *         hotelId:
 *           type: string
 *           description: Hotel reference
 *         reservationType:
 *           type: string
 *           enum: [standard, corporate, vip, group, loyalty]
 *           description: Type of reservation
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent, vip]
 *           description: Reservation priority level
 *         roomPreferences:
 *           type: object
 *           properties:
 *             preferredRooms:
 *               type: array
 *               items:
 *                 type: string
 *               description: Specific room numbers preferred
 *             floor:
 *               type: number
 *               description: Preferred floor
 *             adjacentRooms:
 *               type: boolean
 *               description: Request for adjacent rooms
 *             connectingRooms:
 *               type: boolean
 *               description: Request for connecting rooms
 *             accessibility:
 *               type: boolean
 *               description: Accessibility requirements
 *             roomView:
 *               type: string
 *               enum: [ocean, mountain, city, garden, pool]
 *               description: Preferred room view
 *             smokingPreference:
 *               type: string
 *               enum: [non-smoking, smoking, either]
 *               description: Smoking preference
 *         guestProfile:
 *           type: object
 *           properties:
 *             vipStatus:
 *               type: boolean
 *               description: VIP guest status
 *             loyaltyTier:
 *               type: string
 *               enum: [member, silver, gold, platinum, diamond]
 *               description: Loyalty program tier
 *             preferences:
 *               type: object
 *               properties:
 *                 temperature:
 *                   type: number
 *                   description: Preferred room temperature
 *                 pillow:
 *                   type: string
 *                   enum: [soft, medium, firm, extra-firm]
 *                   description: Pillow preference
 *                 newspaper:
 *                   type: string
 *                   description: Preferred newspaper
 *                 wakeupCall:
 *                   type: boolean
 *                   description: Wakeup call preference
 *             allergies:
 *               type: array
 *               items:
 *                 type: string
 *               description: Guest allergies
 *             specialNeeds:
 *               type: array
 *               items:
 *                 type: string
 *               description: Special accommodation needs
 *             dietaryRestrictions:
 *               type: array
 *               items:
 *                 type: string
 *               description: Dietary restrictions
 *         specialRequests:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [amenity, service, room_setup, dining, transportation, celebration]
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, in_progress, completed, unavailable]
 *               estimatedCost:
 *                 type: number
 *               assignedTo:
 *                 type: string
 *               completedAt:
 *                 type: string
 *                 format: date-time
 *         upgrades:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               fromRoomType:
 *                 type: string
 *               toRoomType:
 *                 type: string
 *               upgradeType:
 *                 type: string
 *                 enum: [complimentary, paid, loyalty_benefit, vip_courtesy]
 *               charges:
 *                 type: number
 *               approval:
 *                 type: string
 *                 enum: [pending, approved, declined]
 *               approvedBy:
 *                 type: string
 *               reason:
 *                 type: string
 *         roomAssignments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               roomId:
 *                 type: string
 *               roomNumber:
 *                 type: string
 *               roomType:
 *                 type: string
 *               assignedAt:
 *                 type: string
 *                 format: date-time
 *               assignedBy:
 *                 type: string
 *               isUpgrade:
 *                 type: boolean
 *               status:
 *                 type: string
 *                 enum: [assigned, blocked, released]
 *         reservationFlags:
 *           type: object
 *           properties:
 *             isVIP:
 *               type: boolean
 *             requiresApproval:
 *               type: boolean
 *             hasUpgrade:
 *               type: boolean
 *             hasSpecialRequests:
 *               type: boolean
 *             isGroupBooking:
 *               type: boolean
 *             hasDietaryRestrictions:
 *               type: boolean
 *             hasAccessibilityNeeds:
 *               type: boolean
 *         waitlistInfo:
 *           type: object
 *           properties:
 *             isOnWaitlist:
 *               type: boolean
 *             waitlistId:
 *               type: string
 *             convertedFromWaitlist:
 *               type: boolean
 *             waitlistPriority:
 *               type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         createdBy:
 *           type: string
 *           description: User who created the reservation
 */

const advancedReservationSchema = new mongoose.Schema({
  reservationId: {
    type: String,
    unique: true,
    required: true
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking ID is required'],
    unique: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },

  // Reservation classification
  reservationType: {
    type: String,
    required: [true, 'Reservation type is required'],
    enum: {
      values: ['standard', 'corporate', 'vip', 'group', 'loyalty'],
      message: 'Invalid reservation type'
    }
  },
  priority: {
    type: String,
    required: [true, 'Priority is required'],
    enum: {
      values: ['low', 'medium', 'high', 'urgent', 'vip'],
      message: 'Invalid priority level'
    },
    default: 'medium'
  },

  // Room preferences and requirements
  roomPreferences: {
    preferredRooms: [{
      type: String,
      trim: true
    }],
    floor: {
      type: Number,
      min: 1,
      max: 50
    },
    adjacentRooms: {
      type: Boolean,
      default: false
    },
    connectingRooms: {
      type: Boolean,
      default: false
    },
    accessibility: {
      type: Boolean,
      default: false
    },
    roomView: {
      type: String,
      enum: ['ocean', 'mountain', 'city', 'garden', 'pool', 'any'],
      default: 'any'
    },
    smokingPreference: {
      type: String,
      enum: ['non-smoking', 'smoking', 'either'],
      default: 'non-smoking'
    },
    bedType: {
      type: String,
      enum: ['king', 'queen', 'twin', 'sofa_bed', 'any'],
      default: 'any'
    },
    quietRoom: {
      type: Boolean,
      default: false
    }
  },

  // Guest profile and preferences
  guestProfile: {
    vipStatus: {
      type: Boolean,
      default: false
    },
    loyaltyTier: {
      type: String,
      enum: ['member', 'silver', 'gold', 'platinum', 'diamond'],
      default: 'member'
    },
    preferences: {
      temperature: {
        type: Number,
        min: 16,
        max: 30
      },
      pillow: {
        type: String,
        enum: ['soft', 'medium', 'firm', 'extra-firm'],
        default: 'medium'
      },
      newspaper: {
        type: String,
        trim: true
      },
      wakeupCall: {
        type: Boolean,
        default: false
      },
      turndownService: {
        type: Boolean,
        default: false
      },
      miniBarStocking: [{
        type: String,
        trim: true
      }]
    },
    allergies: [{
      type: String,
      trim: true
    }],
    specialNeeds: [{
      type: String,
      trim: true
    }],
    dietaryRestrictions: [{
      type: String,
      trim: true
    }],
    medicalConditions: [{
      type: String,
      trim: true
    }],
    communicationPreferences: {
      language: {
        type: String,
        default: 'en'
      },
      contactMethod: {
        type: String,
        enum: ['email', 'phone', 'sms', 'whatsapp'],
        default: 'email'
      }
    }
  },

  // Special requests management
  specialRequests: [{
    requestId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    type: {
      type: String,
      enum: ['amenity', 'service', 'room_setup', 'dining', 'transportation', 'celebration', 'business', 'medical'],
      required: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 500
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'unavailable', 'cancelled'],
      default: 'pending'
    },
    estimatedCost: {
      type: Number,
      min: 0,
      default: 0
    },
    actualCost: {
      type: Number,
      min: 0
    },
    assignedTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    assignedDepartment: {
      type: String,
      enum: ['housekeeping', 'concierge', 'f&b', 'maintenance', 'front_desk', 'spa', 'business_center']
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: Date,
    notes: [{
      content: String,
      createdAt: {
        type: Date,
        default: Date.now
      },
      createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    }]
  }],

  // Room upgrade tracking
  upgrades: [{
    upgradeId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    fromRoomType: {
      type: String,
      required: true
    },
    toRoomType: {
      type: String,
      required: true
    },
    upgradeType: {
      type: String,
      enum: ['complimentary', 'paid', 'loyalty_benefit', 'vip_courtesy', 'oversold_compensation'],
      required: true
    },
    charges: {
      type: Number,
      min: 0,
      default: 0
    },
    approval: {
      type: String,
      enum: ['pending', 'approved', 'declined', 'auto_approved'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    reason: {
      type: String,
      maxlength: 200
    },
    eligibilityScore: {
      type: Number,
      min: 0,
      max: 100
    },
    availabilityConfirmed: {
      type: Boolean,
      default: false
    }
  }],

  // Room assignment tracking
  roomAssignments: [{
    assignmentId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    roomId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Room',
      required: true
    },
    roomNumber: {
      type: String,
      required: true
    },
    roomType: {
      type: String,
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    isUpgrade: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['assigned', 'blocked', 'released', 'confirmed'],
      default: 'assigned'
    },
    automaticAssignment: {
      type: Boolean,
      default: false
    },
    assignmentReason: {
      type: String,
      maxlength: 200
    }
  }],

  // Reservation flags for quick filtering
  reservationFlags: {
    isVIP: {
      type: Boolean,
      default: false
    },
    requiresApproval: {
      type: Boolean,
      default: false
    },
    hasUpgrade: {
      type: Boolean,
      default: false
    },
    hasSpecialRequests: {
      type: Boolean,
      default: false
    },
    isGroupBooking: {
      type: Boolean,
      default: false
    },
    hasDietaryRestrictions: {
      type: Boolean,
      default: false
    },
    hasAccessibilityNeeds: {
      type: Boolean,
      default: false
    },
    hasAllergies: {
      type: Boolean,
      default: false
    },
    requiresConcierge: {
      type: Boolean,
      default: false
    },
    isRepeatGuest: {
      type: Boolean,
      default: false
    }
  },

  // Waitlist integration
  waitlistInfo: {
    isOnWaitlist: {
      type: Boolean,
      default: false
    },
    waitlistId: {
      type: mongoose.Schema.ObjectId,
      ref: 'WaitingList'
    },
    convertedFromWaitlist: {
      type: Boolean,
      default: false
    },
    waitlistPriority: {
      type: Number,
      min: 1
    },
    waitlistConversionDate: Date
  },

  // Analytics and scoring
  analytics: {
    priorityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    complexityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    revenueImpact: {
      type: Number,
      default: 0
    },
    serviceLevel: {
      type: String,
      enum: ['standard', 'premium', 'luxury', 'ultra_luxury'],
      default: 'standard'
    }
  },

  // Approval workflow
  approvalWorkflow: {
    requiresApproval: {
      type: Boolean,
      default: false
    },
    approvalStage: {
      type: String,
      enum: ['none', 'pending_supervisor', 'pending_manager', 'pending_gm', 'approved', 'rejected'],
      default: 'none'
    },
    approvalHistory: [{
      stage: String,
      approvedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      decision: {
        type: String,
        enum: ['approved', 'rejected', 'escalated']
      },
      comments: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Integration and sync
  integrationData: {
    syncedToTapeChart: {
      type: Boolean,
      default: false
    },
    syncedToPMS: {
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
      }
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

  // Status and timestamps
  status: {
    type: String,
    enum: ['draft', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'],
    default: 'pending'
  },

  // Cancellation tracking
  cancellation: {
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    cancellationReason: String,
    refundAmount: {
      type: Number,
      min: 0
    },
    cancellationFee: {
      type: Number,
      min: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance optimization (remove duplicates to avoid conflicts)
advancedReservationSchema.index({ hotelId: 1, status: 1 });
advancedReservationSchema.index({ bookingId: 1 }); // Remove unique: true (already defined in schema)
advancedReservationSchema.index({ reservationId: 1 }); // Remove unique: true (already defined in schema)
advancedReservationSchema.index({ hotelId: 1, reservationType: 1 });
advancedReservationSchema.index({ hotelId: 1, priority: 1 });
advancedReservationSchema.index({ 'guestProfile.vipStatus': 1, 'guestProfile.loyaltyTier': 1 });
advancedReservationSchema.index({ 'reservationFlags.isVIP': 1 });
advancedReservationSchema.index({ 'reservationFlags.requiresApproval': 1 });
advancedReservationSchema.index({ 'waitlistInfo.isOnWaitlist': 1 });
advancedReservationSchema.index({ 'analytics.priorityScore': -1 });
advancedReservationSchema.index({ createdAt: -1 });

// Pre-save middleware to generate reservation ID and calculate scores
advancedReservationSchema.pre('save', function(next) {
  try {
    // Generate reservation ID if not exists
    if (!this.reservationId) {
      const timestamp = Date.now().toString();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      this.reservationId = `ADV${timestamp.slice(-8)}${random}`;
    }

    // Calculate priority score safely
    if (typeof this.calculatePriorityScore === 'function') {
      this.calculatePriorityScore();
    }

    // Calculate complexity score safely
    if (typeof this.calculateComplexityScore === 'function') {
      this.calculateComplexityScore();
    }

    // Update reservation flags safely
    if (typeof this.updateReservationFlags === 'function') {
      this.updateReservationFlags();
    }

    // Set approval requirements safely
    if (typeof this.setApprovalRequirements === 'function') {
      this.setApprovalRequirements();
    }

    next();
  } catch (error) {
    console.error('Error in AdvancedReservation pre-save middleware:', error);
    next(error);
  }
});

// Calculate priority score based on various factors
advancedReservationSchema.methods.calculatePriorityScore = function() {
  let score = 0;

  // Initialize analytics object if not exists
  if (!this.analytics) {
    this.analytics = {};
  }

  // Initialize guestProfile if not exists
  if (!this.guestProfile) {
    this.guestProfile = {};
  }

  // Base priority score
  const priorityScores = {
    'vip': 100,
    'urgent': 80,
    'high': 60,
    'medium': 40,
    'low': 20
  };
  score += priorityScores[this.priority] || 0;

  // VIP status bonus
  if (this.guestProfile.vipStatus) {
    score += 50;
  }

  // Loyalty tier bonus
  const loyaltyScores = {
    'diamond': 40,
    'platinum': 30,
    'gold': 20,
    'silver': 10,
    'member': 5
  };
  score += loyaltyScores[this.guestProfile.loyaltyTier] || 0;

  // Reservation type bonus
  const typeScores = {
    'vip': 30,
    'corporate': 20,
    'group': 15,
    'loyalty': 10,
    'standard': 5
  };
  score += typeScores[this.reservationType] || 0;

  // Special requirements impact
  if (this.specialRequests && this.specialRequests.length > 0) {
    score += Math.min(this.specialRequests.length * 5, 25);
  }

  // Upgrade requests impact
  if (this.upgrades && this.upgrades.length > 0) {
    score += 15;
  }

  this.analytics.priorityScore = Math.min(score, 100);
};

// Calculate complexity score
advancedReservationSchema.methods.calculateComplexityScore = function() {
  let score = 0;

  // Initialize objects if not exists
  if (!this.analytics) {
    this.analytics = {};
  }
  if (!this.roomPreferences) {
    this.roomPreferences = {};
  }
  if (!this.guestProfile) {
    this.guestProfile = {};
  }

  // Special requests complexity
  if (this.specialRequests) {
    score += this.specialRequests.length * 10;
  }

  // Room preferences complexity
  if (this.roomPreferences.adjacentRooms || this.roomPreferences.connectingRooms) {
    score += 20;
  }
  if (this.roomPreferences.accessibility) {
    score += 15;
  }
  if (this.roomPreferences.preferredRooms && this.roomPreferences.preferredRooms.length > 0) {
    score += 10;
  }

  // Guest profile complexity
  if (this.guestProfile.allergies && this.guestProfile.allergies.length > 0) {
    score += this.guestProfile.allergies.length * 5;
  }
  if (this.guestProfile.dietaryRestrictions && this.guestProfile.dietaryRestrictions.length > 0) {
    score += this.guestProfile.dietaryRestrictions.length * 5;
  }
  if (this.guestProfile.specialNeeds && this.guestProfile.specialNeeds.length > 0) {
    score += this.guestProfile.specialNeeds.length * 10;
  }

  // Upgrade complexity
  if (this.upgrades && this.upgrades.length > 0) {
    score += this.upgrades.length * 15;
  }

  this.analytics.complexityScore = Math.min(score, 100);
};

// Update reservation flags
advancedReservationSchema.methods.updateReservationFlags = function() {
  // Initialize objects if not exists
  if (!this.reservationFlags) {
    this.reservationFlags = {};
  }
  if (!this.guestProfile) {
    this.guestProfile = {};
  }
  if (!this.roomPreferences) {
    this.roomPreferences = {};
  }
  if (!this.analytics) {
    this.analytics = {};
  }

  this.reservationFlags.isVIP = this.guestProfile.vipStatus || false;
  this.reservationFlags.hasUpgrade = this.upgrades && this.upgrades.length > 0;
  this.reservationFlags.hasSpecialRequests = this.specialRequests && this.specialRequests.length > 0;
  this.reservationFlags.hasDietaryRestrictions = this.guestProfile.dietaryRestrictions && this.guestProfile.dietaryRestrictions.length > 0;
  this.reservationFlags.hasAccessibilityNeeds = this.roomPreferences.accessibility || (this.guestProfile.specialNeeds && this.guestProfile.specialNeeds.some(need => need.toLowerCase().includes('accessibility')));
  this.reservationFlags.hasAllergies = this.guestProfile.allergies && this.guestProfile.allergies.length > 0;
  this.reservationFlags.requiresConcierge = this.guestProfile.vipStatus || (this.specialRequests && this.specialRequests.some(req => req.type === 'concierge')) || (this.analytics.priorityScore || 0) > 70;
};

// Set approval requirements
advancedReservationSchema.methods.setApprovalRequirements = function() {
  // Initialize objects if not exists
  if (!this.reservationFlags) {
    this.reservationFlags = {};
  }
  if (!this.approvalWorkflow) {
    this.approvalWorkflow = {};
  }
  if (!this.guestProfile) {
    this.guestProfile = {};
  }
  if (!this.analytics) {
    this.analytics = {};
  }

  let requiresApproval = false;

  // VIP reservations require approval
  if (this.guestProfile.vipStatus) {
    requiresApproval = true;
  }

  // High complexity reservations require approval
  if ((this.analytics.complexityScore || 0) > 50) {
    requiresApproval = true;
  }

  // Upgrades require approval
  if (this.upgrades && this.upgrades.some(upgrade => upgrade.upgradeType === 'complimentary' || (upgrade.charges || 0) > 1000)) {
    requiresApproval = true;
  }

  // Special requests with high costs require approval
  if (this.specialRequests && this.specialRequests.some(req => (req.estimatedCost || 0) > 500)) {
    requiresApproval = true;
  }

  this.reservationFlags.requiresApproval = requiresApproval;
  this.approvalWorkflow.requiresApproval = requiresApproval;

  if (requiresApproval && (this.approvalWorkflow.approvalStage === 'none' || !this.approvalWorkflow.approvalStage)) {
    this.approvalWorkflow.approvalStage = 'pending_supervisor';
  }
};

// Instance method to add special request
advancedReservationSchema.methods.addSpecialRequest = function(requestData) {
  if (!this.specialRequests) {
    this.specialRequests = [];
  }

  const request = {
    requestId: new mongoose.Types.ObjectId().toString(),
    type: requestData.type,
    description: requestData.description,
    priority: requestData.priority || 'medium',
    estimatedCost: requestData.estimatedCost || 0,
    assignedDepartment: requestData.assignedDepartment
  };

  this.specialRequests.push(request);
  this.updateReservationFlags();
  return this.save();
};

// Instance method to add upgrade
advancedReservationSchema.methods.addUpgrade = function(upgradeData) {
  if (!this.upgrades) {
    this.upgrades = [];
  }

  const upgrade = {
    upgradeId: new mongoose.Types.ObjectId().toString(),
    fromRoomType: upgradeData.fromRoomType,
    toRoomType: upgradeData.toRoomType,
    upgradeType: upgradeData.upgradeType,
    charges: upgradeData.charges || 0,
    reason: upgradeData.reason,
    eligibilityScore: upgradeData.eligibilityScore || 0
  };

  this.upgrades.push(upgrade);
  this.updateReservationFlags();
  return this.save();
};

// Static method to get reservation statistics
advancedReservationSchema.statics.getReservationStats = async function(hotelId, dateRange = {}) {
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
        totalReservations: { $sum: 1 },
        vipReservations: {
          $sum: { $cond: [{ $eq: ['$reservationFlags.isVIP', true] }, 1, 0] }
        },
        upgradeRequests: {
          $sum: { $cond: [{ $eq: ['$reservationFlags.hasUpgrade', true] }, 1, 0] }
        },
        specialRequests: {
          $sum: { $cond: [{ $eq: ['$reservationFlags.hasSpecialRequests', true] }, 1, 0] }
        },
        pendingApprovals: {
          $sum: { $cond: [{ $eq: ['$reservationFlags.requiresApproval', true] }, 1, 0] }
        },
        avgPriorityScore: { $avg: '$analytics.priorityScore' },
        avgComplexityScore: { $avg: '$analytics.complexityScore' },
        byType: {
          $push: '$reservationType'
        },
        byPriority: {
          $push: '$priority'
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalReservations: 0,
      vipReservations: 0,
      upgradeRequests: 0,
      specialRequests: 0,
      pendingApprovals: 0,
      avgPriorityScore: 0,
      avgComplexityScore: 0,
      byType: {},
      byPriority: {}
    };
  }

  const result = stats[0];

  // Calculate type distribution
  const typeDistribution = {};
  result.byType.forEach(type => {
    typeDistribution[type] = (typeDistribution[type] || 0) + 1;
  });

  // Calculate priority distribution
  const priorityDistribution = {};
  result.byPriority.forEach(priority => {
    priorityDistribution[priority] = (priorityDistribution[priority] || 0) + 1;
  });

  return {
    totalReservations: result.totalReservations,
    vipReservations: result.vipReservations,
    upgradeRequests: result.upgradeRequests,
    specialRequests: result.specialRequests,
    pendingApprovals: result.pendingApprovals,
    avgPriorityScore: Math.round(result.avgPriorityScore || 0),
    avgComplexityScore: Math.round(result.avgComplexityScore || 0),
    byType: typeDistribution,
    byPriority: priorityDistribution
  };
};

// Static method to get pending approvals
advancedReservationSchema.statics.getPendingApprovals = async function(hotelId, stage = null) {
  const query = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    'reservationFlags.requiresApproval': true,
    'approvalWorkflow.approvalStage': { $nin: ['approved', 'rejected'] }
  };

  if (stage) {
    query['approvalWorkflow.approvalStage'] = stage;
  }

  return await this.find(query)
    .populate('bookingId', 'bookingNumber checkIn checkOut guestDetails')
    .populate('createdBy', 'name email')
    .sort({ 'analytics.priorityScore': -1, createdAt: 1 });
};

export default mongoose.model('AdvancedReservation', advancedReservationSchema);