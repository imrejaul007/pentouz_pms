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
    required: [true, 'Guest ID is required'],
    unique: true
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

// Pre-save middleware to set updatedBy
vipGuestSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedBy = this.createdBy; // This will be updated by controller
  }
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
