import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     TravelAgentBooking:
 *       type: object
 *       required:
 *         - bookingId
 *         - travelAgentId
 *         - agentCode
 *         - totalAmount
 *         - commissionRate
 *         - commissionAmount
 *       properties:
 *         _id:
 *           type: string
 *           description: Travel agent booking ID
 *         bookingId:
 *           type: string
 *           description: Reference to main Booking model
 *         travelAgentId:
 *           type: string
 *           description: Reference to TravelAgent model
 *         agentCode:
 *           type: string
 *           description: Travel agent code for quick reference
 *         hotelId:
 *           type: string
 *           description: Reference to Hotel model
 *         guestDetails:
 *           type: object
 *           properties:
 *             primaryGuest:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *             totalGuests:
 *               type: number
 *             totalRooms:
 *               type: number
 *         bookingDetails:
 *           type: object
 *           properties:
 *             checkIn:
 *               type: string
 *               format: date
 *             checkOut:
 *               type: string
 *               format: date
 *             nights:
 *               type: number
 *             roomTypes:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   roomTypeId:
 *                     type: string
 *                   roomTypeName:
 *                     type: string
 *                   quantity:
 *                     type: number
 *                   ratePerNight:
 *                     type: number
 *                   specialRate:
 *                     type: number
 *                   totalAmount:
 *                     type: number
 *         pricing:
 *           type: object
 *           properties:
 *             subtotal:
 *               type: number
 *             taxes:
 *               type: number
 *             fees:
 *               type: number
 *             discounts:
 *               type: number
 *             totalAmount:
 *               type: number
 *             specialRateDiscount:
 *               type: number
 *               description: Total discount given through special rates
 *         commission:
 *           type: object
 *           properties:
 *             rate:
 *               type: number
 *               description: Commission rate percentage
 *             amount:
 *               type: number
 *               description: Commission amount earned
 *             bonusRate:
 *               type: number
 *               description: Additional bonus commission rate
 *             bonusAmount:
 *               type: number
 *               description: Additional bonus commission amount
 *             totalCommission:
 *               type: number
 *               description: Total commission including bonus
 *             paymentStatus:
 *               type: string
 *               enum: [pending, paid, processing, cancelled]
 *               description: Commission payment status
 *             paymentDate:
 *               type: string
 *               format: date-time
 *               description: Date when commission was paid
 *             paymentReference:
 *               type: string
 *               description: Payment reference number
 *         bookingStatus:
 *           type: string
 *           enum: [confirmed, cancelled, completed, no_show, modified]
 *           description: Current booking status
 *         paymentDetails:
 *           type: object
 *           properties:
 *             method:
 *               type: string
 *               enum: [credit_card, bank_transfer, cash, cheque, agent_credit]
 *             status:
 *               type: string
 *               enum: [pending, paid, partial, failed, refunded]
 *             paidAmount:
 *               type: number
 *             pendingAmount:
 *               type: number
 *             paymentDate:
 *               type: string
 *               format: date-time
 *         specialConditions:
 *           type: object
 *           properties:
 *             earlyCheckin:
 *               type: boolean
 *             lateCheckout:
 *               type: boolean
 *             roomUpgrade:
 *               type: boolean
 *             specialRequests:
 *               type: string
 *         performance:
 *           type: object
 *           properties:
 *             bookingSource:
 *               type: string
 *               enum: [direct, online, phone, email, walk_in]
 *             leadTime:
 *               type: number
 *               description: Days between booking and check-in
 *             seasonality:
 *               type: string
 *               enum: [peak, high, low, off]
 *         notes:
 *           type: string
 *           description: Additional notes about the booking
 *         isActive:
 *           type: boolean
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const travelAgentBookingSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking ID is required'],
    unique: true
  },
  travelAgentId: {
    type: mongoose.Schema.ObjectId,
    ref: 'TravelAgent',
    required: [true, 'Travel agent ID is required']
  },
  agentCode: {
    type: String,
    required: [true, 'Agent code is required'],
    uppercase: true,
    trim: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  guestDetails: {
    primaryGuest: {
      name: {
        type: String,
        required: [true, 'Primary guest name is required'],
        trim: true
      },
      email: {
        type: String,
        required: [true, 'Primary guest email is required'],
        lowercase: true
      },
      phone: {
        type: String,
        required: [true, 'Primary guest phone is required']
      }
    },
    totalGuests: {
      type: Number,
      required: [true, 'Total guests is required'],
      min: [1, 'Total guests must be at least 1']
    },
    totalRooms: {
      type: Number,
      required: [true, 'Total rooms is required'],
      min: [1, 'Total rooms must be at least 1']
    }
  },
  bookingDetails: {
    checkIn: {
      type: Date,
      required: [true, 'Check-in date is required']
    },
    checkOut: {
      type: Date,
      required: [true, 'Check-out date is required']
    },
    nights: {
      type: Number,
      required: [true, 'Number of nights is required'],
      min: [1, 'Number of nights must be at least 1']
    },
    roomTypes: [{
      roomTypeId: {
        type: mongoose.Schema.ObjectId,
        ref: 'RoomType',
        required: true
      },
      roomTypeName: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      ratePerNight: {
        type: Number,
        required: true,
        min: 0
      },
      specialRate: {
        type: Number,
        min: 0
      },
      totalAmount: {
        type: Number,
        required: true,
        min: 0
      }
    }]
  },
  pricing: {
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative']
    },
    taxes: {
      type: Number,
      default: 0,
      min: [0, 'Taxes cannot be negative']
    },
    fees: {
      type: Number,
      default: 0,
      min: [0, 'Fees cannot be negative']
    },
    discounts: {
      type: Number,
      default: 0,
      min: [0, 'Discounts cannot be negative']
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative']
    },
    specialRateDiscount: {
      type: Number,
      default: 0,
      min: [0, 'Special rate discount cannot be negative']
    }
  },
  commission: {
    rate: {
      type: Number,
      required: [true, 'Commission rate is required'],
      min: [0, 'Commission rate cannot be negative'],
      max: [50, 'Commission rate cannot exceed 50%']
    },
    amount: {
      type: Number,
      required: [true, 'Commission amount is required'],
      min: [0, 'Commission amount cannot be negative']
    },
    bonusRate: {
      type: Number,
      default: 0,
      min: [0, 'Bonus rate cannot be negative'],
      max: [25, 'Bonus rate cannot exceed 25%']
    },
    bonusAmount: {
      type: Number,
      default: 0,
      min: [0, 'Bonus amount cannot be negative']
    },
    totalCommission: {
      type: Number,
      min: [0, 'Total commission cannot be negative']
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'processing', 'cancelled'],
      default: 'pending'
    },
    paymentDate: {
      type: Date
    },
    paymentReference: {
      type: String,
      trim: true
    }
  },
  bookingStatus: {
    type: String,
    enum: ['confirmed', 'cancelled', 'completed', 'no_show', 'modified'],
    default: 'confirmed'
  },
  paymentDetails: {
    method: {
      type: String,
      enum: ['credit_card', 'bank_transfer', 'cash', 'cheque', 'agent_credit'],
      required: [true, 'Payment method is required']
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'partial', 'failed', 'refunded'],
      default: 'pending'
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative']
    },
    pendingAmount: {
      type: Number,
      min: [0, 'Pending amount cannot be negative']
    },
    paymentDate: {
      type: Date
    }
  },
  specialConditions: {
    earlyCheckin: {
      type: Boolean,
      default: false
    },
    lateCheckout: {
      type: Boolean,
      default: false
    },
    roomUpgrade: {
      type: Boolean,
      default: false
    },
    specialRequests: {
      type: String,
      trim: true,
      maxlength: [1000, 'Special requests cannot exceed 1000 characters']
    }
  },
  performance: {
    bookingSource: {
      type: String,
      enum: ['direct', 'online', 'phone', 'email', 'walk_in'],
      default: 'direct'
    },
    leadTime: {
      type: Number,
      min: [0, 'Lead time cannot be negative']
    },
    seasonality: {
      type: String,
      enum: ['peak', 'high', 'low', 'off']
    }
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  confirmationNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
travelAgentBookingSchema.index({ bookingId: 1 });
travelAgentBookingSchema.index({ travelAgentId: 1 });
travelAgentBookingSchema.index({ agentCode: 1 });
travelAgentBookingSchema.index({ hotelId: 1 });
travelAgentBookingSchema.index({ bookingStatus: 1 });
travelAgentBookingSchema.index({ 'commission.paymentStatus': 1 });
travelAgentBookingSchema.index({ 'bookingDetails.checkIn': 1 });
travelAgentBookingSchema.index({ 'bookingDetails.checkOut': 1 });
travelAgentBookingSchema.index({ createdAt: -1 });

// Compound indexes for analytics
travelAgentBookingSchema.index({ travelAgentId: 1, bookingStatus: 1, createdAt: -1 });
travelAgentBookingSchema.index({ hotelId: 1, 'bookingDetails.checkIn': 1, bookingStatus: 1 });
travelAgentBookingSchema.index({ 'commission.paymentStatus': 1, createdAt: -1 });

// Virtual fields
travelAgentBookingSchema.virtual('booking', {
  ref: 'Booking',
  localField: 'bookingId',
  foreignField: '_id',
  justOne: true
});

travelAgentBookingSchema.virtual('travelAgent', {
  ref: 'TravelAgent',
  localField: 'travelAgentId',
  foreignField: '_id',
  justOne: true
});

travelAgentBookingSchema.virtual('hotel', {
  ref: 'Hotel',
  localField: 'hotelId',
  foreignField: '_id',
  justOne: true
});

// Virtual for profit calculation
travelAgentBookingSchema.virtual('profit').get(function() {
  return this.pricing.totalAmount - this.commission.totalCommission;
});

// Pre-save middleware to calculate totals
travelAgentBookingSchema.pre('save', function(next) {
  // Calculate total commission
  this.commission.totalCommission = this.commission.amount + (this.commission.bonusAmount || 0);

  // Calculate pending payment amount
  if (this.paymentDetails.status !== 'paid') {
    this.paymentDetails.pendingAmount = this.pricing.totalAmount - (this.paymentDetails.paidAmount || 0);
  }

  // Calculate lead time if check-in date exists
  if (this.bookingDetails.checkIn && this.createdAt) {
    const leadTimeMs = this.bookingDetails.checkIn.getTime() - this.createdAt.getTime();
    this.performance.leadTime = Math.ceil(leadTimeMs / (1000 * 60 * 60 * 24));
  }

  next();
});

// Instance methods
travelAgentBookingSchema.methods.calculateCommission = function(commissionRate, bonusRate = 0) {
  this.commission.rate = commissionRate;
  this.commission.amount = (this.pricing.totalAmount * commissionRate) / 100;

  if (bonusRate > 0) {
    this.commission.bonusRate = bonusRate;
    this.commission.bonusAmount = (this.pricing.totalAmount * bonusRate) / 100;
  }

  this.commission.totalCommission = this.commission.amount + (this.commission.bonusAmount || 0);
  return this.commission.totalCommission;
};

travelAgentBookingSchema.methods.markCommissionPaid = function(paymentReference) {
  this.commission.paymentStatus = 'paid';
  this.commission.paymentDate = new Date();
  this.commission.paymentReference = paymentReference;
  return this.save();
};

travelAgentBookingSchema.methods.updateBookingStatus = function(status) {
  this.bookingStatus = status;

  // If booking is cancelled, mark commission as cancelled too
  if (status === 'cancelled') {
    this.commission.paymentStatus = 'cancelled';
  }

  return this.save();
};

travelAgentBookingSchema.methods.getRevenueSummary = function() {
  return {
    totalAmount: this.pricing.totalAmount,
    commission: this.commission.totalCommission,
    profit: this.pricing.totalAmount - this.commission.totalCommission,
    specialRateDiscount: this.pricing.specialRateDiscount,
    nights: this.bookingDetails.nights,
    rooms: this.guestDetails.totalRooms
  };
};

// Static methods
travelAgentBookingSchema.statics.getAgentPerformance = function(travelAgentId, startDate, endDate) {
  const matchStage = {
    travelAgentId: new mongoose.Types.ObjectId(travelAgentId),
    isActive: true
  };

  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.totalAmount' },
        totalCommission: { $sum: '$commission.totalCommission' },
        averageBookingValue: { $avg: '$pricing.totalAmount' },
        totalNights: { $sum: '$bookingDetails.nights' },
        totalRooms: { $sum: '$guestDetails.totalRooms' },
        confirmedBookings: {
          $sum: { $cond: [{ $eq: ['$bookingStatus', 'confirmed'] }, 1, 0] }
        },
        cancelledBookings: {
          $sum: { $cond: [{ $eq: ['$bookingStatus', 'cancelled'] }, 1, 0] }
        }
      }
    }
  ]);
};

travelAgentBookingSchema.statics.getMonthlyRevenue = function(travelAgentId, year) {
  return this.aggregate([
    {
      $match: {
        travelAgentId: new mongoose.Types.ObjectId(travelAgentId),
        createdAt: {
          $gte: new Date(year, 0, 1),
          $lt: new Date(year + 1, 0, 1)
        },
        bookingStatus: { $ne: 'cancelled' },
        isActive: true
      }
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        revenue: { $sum: '$pricing.totalAmount' },
        commission: { $sum: '$commission.totalCommission' },
        bookings: { $sum: 1 }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
};

travelAgentBookingSchema.statics.getPendingCommissions = function(hotelId) {
  const matchStage = {
    'commission.paymentStatus': 'pending',
    bookingStatus: { $in: ['confirmed', 'completed'] },
    isActive: true
  };

  if (hotelId) {
    matchStage.hotelId = new mongoose.Types.ObjectId(hotelId);
  }

  return this.find(matchStage)
    .populate('travelAgent', 'companyName agentCode')
    .populate('hotel', 'name')
    .sort({ createdAt: -1 });
};

const TravelAgentBooking = mongoose.model('TravelAgentBooking', travelAgentBookingSchema);

export default TravelAgentBooking;