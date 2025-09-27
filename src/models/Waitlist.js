import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Waitlist:
 *       type: object
 *       required:
 *         - hotelId
 *         - guestId
 *         - requestedRoomType
 *         - checkInDate
 *         - checkOutDate
 *         - partySize
 *       properties:
 *         _id:
 *           type: string
 *           description: Waitlist entry ID
 *         hotelId:
 *           type: string
 *           description: Reference to Hotel model
 *         guestId:
 *           type: string
 *           description: Reference to User model (guest)
 *         guestInfo:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             email:
 *               type: string
 *             phone:
 *               type: string
 *             tier:
 *               type: string
 *               enum: [regular, vip, svip, corporate, diamond]
 *         requestedRoomType:
 *           type: string
 *           description: Type of room requested
 *         checkInDate:
 *           type: string
 *           format: date
 *         checkOutDate:
 *           type: string
 *           format: date
 *         partySize:
 *           type: number
 *           description: Number of guests
 *         maxPrice:
 *           type: number
 *           description: Maximum price per night
 *         urgency:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         preferences:
 *           type: array
 *           items:
 *             type: string
 *         specialRequests:
 *           type: array
 *           items:
 *             type: string
 *         status:
 *           type: string
 *           enum: [waiting, matched, contacted, confirmed, declined, expired, cancelled]
 *         matchResults:
 *           type: array
 *           items:
 *             type: object
 *         contactHistory:
 *           type: array
 *           items:
 *             type: object
 *         autoNotify:
 *           type: boolean
 *         notes:
 *           type: array
 *           items:
 *             type: string
 *         isActive:
 *           type: boolean
 */

const waitlistSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  guestId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Guest ID is required']
  },
  guestInfo: {
    name: {
      type: String,
      required: [true, 'Guest name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Guest email is required'],
      lowercase: true
    },
    phone: {
      type: String,
      required: [true, 'Guest phone is required']
    },
    tier: {
      type: String,
      enum: ['regular', 'vip', 'svip', 'corporate', 'diamond'],
      default: 'regular'
    }
  },
  requestedRoomType: {
    type: String,
    required: [true, 'Requested room type is required'],
    trim: true
  },
  checkInDate: {
    type: Date,
    required: [true, 'Check-in date is required']
  },
  checkOutDate: {
    type: Date,
    required: [true, 'Check-out date is required']
  },
  partySize: {
    type: Number,
    required: [true, 'Party size is required'],
    min: [1, 'Party size must be at least 1']
  },
  maxPrice: {
    type: Number,
    required: [true, 'Maximum price is required'],
    min: [0, 'Maximum price cannot be negative']
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  preferences: [{
    type: String,
    trim: true
  }],
  specialRequests: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['waiting', 'matched', 'contacted', 'confirmed', 'declined', 'expired', 'cancelled'],
    default: 'waiting'
  },
  matchResults: [{
    roomId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Room'
    },
    roomNumber: String,
    roomType: String,
    matchScore: {
      type: Number,
      min: 0,
      max: 100
    },
    matchReasons: [String],
    priceMatch: Boolean,
    dateMatch: Boolean,
    typeMatch: Boolean,
    availabilityConfirmed: Boolean,
    recommendedAction: {
      type: String,
      enum: ['auto_confirm', 'manual_review', 'contact_guest']
    },
    matchedAt: {
      type: Date,
      default: Date.now
    },
    processed: {
      type: Boolean,
      default: false
    }
  }],
  contactHistory: [{
    contactDate: {
      type: Date,
      default: Date.now
    },
    method: {
      type: String,
      enum: ['email', 'phone', 'sms', 'in_person']
    },
    status: {
      type: String,
      enum: ['attempted', 'successful', 'failed', 'no_response']
    },
    notes: String,
    contactedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  }],
  autoNotify: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0 // Higher number = higher priority
  },
  expiryDate: {
    type: Date
  },
  lastProcessedAt: {
    type: Date
  },
  assignedTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'User' // Staff member assigned to handle this
  },
  notes: [{
    note: {
      type: String,
      required: true
    },
    addedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    source: {
      type: String,
      enum: ['web', 'phone', 'email', 'walk_in', 'api'],
      default: 'web'
    },
    referenceNumber: String,
    corporateAccount: String,
    eventType: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
waitlistSchema.index({ hotelId: 1, status: 1 });
waitlistSchema.index({ guestId: 1 });
waitlistSchema.index({ checkInDate: 1, checkOutDate: 1 });
waitlistSchema.index({ requestedRoomType: 1 });
waitlistSchema.index({ 'guestInfo.tier': 1, urgency: 1 });
waitlistSchema.index({ status: 1, priority: -1, createdAt: 1 });
waitlistSchema.index({ lastProcessedAt: 1 });
waitlistSchema.index({ expiryDate: 1 });

// Compound indexes
waitlistSchema.index({
  hotelId: 1,
  status: 1,
  'guestInfo.tier': 1,
  urgency: 1,
  priority: -1
});

// Virtual fields
waitlistSchema.virtual('guest', {
  ref: 'User',
  localField: 'guestId',
  foreignField: '_id',
  justOne: true
});

waitlistSchema.virtual('hotel', {
  ref: 'Hotel',
  localField: 'hotelId',
  foreignField: '_id',
  justOne: true
});

waitlistSchema.virtual('waitingDays').get(function() {
  return Math.ceil((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});

waitlistSchema.virtual('waitingHours').get(function() {
  return Math.ceil((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60));
});

waitlistSchema.virtual('isExpired').get(function() {
  return this.expiryDate && new Date() > this.expiryDate;
});

waitlistSchema.virtual('hasActiveMatches').get(function() {
  return this.matchResults.some(match => !match.processed);
});

waitlistSchema.virtual('bestMatch').get(function() {
  if (this.matchResults.length === 0) return null;
  return this.matchResults.reduce((best, current) =>
    current.matchScore > best.matchScore ? current : best
  );
});

// Pre-save middleware
waitlistSchema.pre('save', function(next) {
  // Calculate priority based on tier and urgency
  const tierWeights = { diamond: 50, svip: 40, vip: 30, corporate: 20, regular: 10 };
  const urgencyWeights = { urgent: 40, high: 30, medium: 20, low: 10 };

  this.priority = (tierWeights[this.guestInfo.tier] || 10) +
                  (urgencyWeights[this.urgency] || 10);

  // Set expiry date if not set (default 30 days)
  if (!this.expiryDate) {
    this.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  // Update status to expired if past expiry date
  if (this.isExpired && this.status === 'waiting') {
    this.status = 'expired';
  }

  next();
});

// Instance methods
waitlistSchema.methods.addContactHistory = function(method, status, notes, contactedBy) {
  this.contactHistory.push({
    method,
    status,
    notes,
    contactedBy
  });
  return this.save();
};

waitlistSchema.methods.addNote = function(note, addedBy) {
  this.notes.push({
    note,
    addedBy
  });
  return this.save();
};

waitlistSchema.methods.addMatch = function(roomId, roomNumber, roomType, matchScore, matchReasons, options = {}) {
  const match = {
    roomId,
    roomNumber,
    roomType,
    matchScore,
    matchReasons,
    priceMatch: options.priceMatch || false,
    dateMatch: options.dateMatch || false,
    typeMatch: options.typeMatch || false,
    availabilityConfirmed: options.availabilityConfirmed || false,
    recommendedAction: options.recommendedAction || 'manual_review'
  };

  this.matchResults.push(match);

  if (this.status === 'waiting') {
    this.status = 'matched';
  }

  return this.save();
};

waitlistSchema.methods.processMatch = function(matchId, action) {
  const match = this.matchResults.id(matchId);
  if (match) {
    match.processed = true;

    switch (action) {
      case 'confirm':
        this.status = 'confirmed';
        break;
      case 'decline':
        this.status = 'waiting';
        // Remove processed match
        this.matchResults.pull(matchId);
        break;
      case 'contact':
        this.status = 'contacted';
        break;
    }
  }

  return this.save();
};

waitlistSchema.methods.markContacted = function(method, notes, contactedBy) {
  this.status = 'contacted';
  return this.addContactHistory(method, 'attempted', notes, contactedBy);
};

waitlistSchema.methods.confirm = function(confirmedBy, notes) {
  this.status = 'confirmed';
  if (notes) {
    this.addNote(`Confirmed: ${notes}`, confirmedBy);
  }
  return this.save();
};

waitlistSchema.methods.decline = function(declinedBy, reason) {
  this.status = 'declined';
  if (reason) {
    this.addNote(`Declined: ${reason}`, declinedBy);
  }
  return this.save();
};

waitlistSchema.methods.cancel = function(cancelledBy, reason) {
  this.status = 'cancelled';
  this.isActive = false;
  if (reason) {
    this.addNote(`Cancelled: ${reason}`, cancelledBy);
  }
  return this.save();
};

// Static methods
waitlistSchema.statics.getActiveWaitlist = function(hotelId, filters = {}) {
  const query = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isActive: true,
    status: { $in: ['waiting', 'matched', 'contacted'] }
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.tier) {
    query['guestInfo.tier'] = filters.tier;
  }

  if (filters.urgency) {
    query.urgency = filters.urgency;
  }

  if (filters.roomType) {
    query.requestedRoomType = new RegExp(filters.roomType, 'i');
  }

  return this.find(query)
    .populate('guestId', 'name email phone')
    .sort({ priority: -1, createdAt: 1 });
};

waitlistSchema.statics.getWaitlistStats = function(hotelId, period = 'month') {
  const now = new Date();
  let startDate;

  switch (period) {
    case 'day':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const matchCondition = { hotelId: new mongoose.Types.ObjectId(hotelId) };

  return this.aggregate([
    { $match: matchCondition },
    {
      $facet: {
        totalStats: [
          {
            $group: {
              _id: null,
              totalWaiting: {
                $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] }
              },
              totalMatched: {
                $sum: { $cond: [{ $eq: ['$status', 'matched'] }, 1, 0] }
              },
              totalContacted: {
                $sum: { $cond: [{ $eq: ['$status', 'contacted'] }, 1, 0] }
              },
              totalConfirmed: {
                $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
              },
              priorityQueue: {
                $sum: { $cond: [{ $gte: ['$priority', 60] }, 1, 0] }
              },
              averageWaitTime: { $avg: '$waitingHours' }
            }
          }
        ],
        periodStats: [
          { $match: { createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: null,
              processedToday: { $sum: 1 },
              successfulMatches: {
                $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
              }
            }
          }
        ]
      }
    }
  ]);
};

waitlistSchema.statics.findMatchCandidates = function(hotelId, criteria = {}) {
  const {
    roomType,
    checkInDate,
    checkOutDate,
    maxPrice,
    partySize,
    minimumMatchScore = 50
  } = criteria;

  const query = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    status: 'waiting',
    isActive: true
  };

  if (roomType) {
    query.requestedRoomType = new RegExp(roomType, 'i');
  }

  if (checkInDate && checkOutDate) {
    query.$and = [
      { checkInDate: { $lte: new Date(checkOutDate) } },
      { checkOutDate: { $gte: new Date(checkInDate) } }
    ];
  }

  if (maxPrice) {
    query.maxPrice = { $gte: maxPrice };
  }

  if (partySize) {
    query.partySize = { $lte: partySize };
  }

  return this.find(query)
    .populate('guestId', 'name email phone')
    .sort({ priority: -1, createdAt: 1 });
};

waitlistSchema.statics.processExpiredEntries = function(hotelId) {
  return this.updateMany(
    {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'waiting',
      expiryDate: { $lt: new Date() }
    },
    {
      $set: {
        status: 'expired',
        lastProcessedAt: new Date()
      }
    }
  );
};

const Waitlist = mongoose.model('Waitlist', waitlistSchema);

export default Waitlist;