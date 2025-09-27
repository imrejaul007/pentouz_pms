import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     MultiBooking:
 *       type: object
 *       required:
 *         - groupReferenceId
 *         - travelAgentId
 *         - hotelId
 *         - totalRooms
 *         - totalAmount
 *         - status
 *       properties:
 *         _id:
 *           type: string
 *           description: Multi-booking ID
 *         groupReferenceId:
 *           type: string
 *           description: Unique group booking reference
 *         travelAgentId:
 *           type: string
 *           description: Reference to TravelAgent model
 *         agentCode:
 *           type: string
 *           description: Travel agent code for quick reference
 *         hotelId:
 *           type: string
 *           description: Reference to Hotel model
 *         bookings:
 *           type: array
 *           description: Array of individual booking details
 *           items:
 *             type: object
 *             properties:
 *               bookingId:
 *                 type: string
 *                 description: Reference to individual Booking model
 *               roomTypeId:
 *                 type: string
 *               roomTypeName:
 *                 type: string
 *               quantity:
 *                 type: number
 *               ratePerNight:
 *                 type: number
 *               specialRate:
 *                 type: number
 *               totalAmount:
 *                 type: number
 *               guestDetails:
 *                 type: object
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, failed, cancelled]
 *               failureReason:
 *                 type: string
 *         groupDetails:
 *           type: object
 *           properties:
 *             groupName:
 *               type: string
 *             primaryContact:
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
 *             checkIn:
 *               type: string
 *               format: date
 *             checkOut:
 *               type: string
 *               format: date
 *             nights:
 *               type: number
 *         pricing:
 *           type: object
 *           properties:
 *             subtotal:
 *               type: number
 *             bulkDiscount:
 *               type: number
 *             totalTaxes:
 *               type: number
 *             totalFees:
 *               type: number
 *             totalDiscounts:
 *               type: number
 *             totalAmount:
 *               type: number
 *             currency:
 *               type: string
 *               default: INR
 *         commission:
 *           type: object
 *           properties:
 *             rate:
 *               type: number
 *             bulkBonusRate:
 *               type: number
 *             totalCommission:
 *               type: number
 *             bulkBonus:
 *               type: number
 *             finalCommission:
 *               type: number
 *             paymentStatus:
 *               type: string
 *               enum: [pending, paid, processing, cancelled]
 *         transaction:
 *           type: object
 *           properties:
 *             transactionId:
 *               type: string
 *             status:
 *               type: string
 *               enum: [pending, processing, completed, failed, rolled_back]
 *             steps:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   stepNumber:
 *                     type: number
 *                   action:
 *                     type: string
 *                   status:
 *                     type: string
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   details:
 *                     type: object
 *             rollbackDetails:
 *               type: object
 *               properties:
 *                 reason:
 *                   type: string
 *                 rollbackSteps:
 *                   type: array
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *         status:
 *           type: string
 *           enum: [pending, confirmed, failed, partially_booked, cancelled]
 *           default: pending
 *         failedBookings:
 *           type: array
 *           description: Details of failed individual bookings
 *           items:
 *             type: object
 *             properties:
 *               roomTypeId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               reason:
 *                 type: string
 *               attemptedAt:
 *                 type: string
 *                 format: date-time
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
 *             bulkCheckIn:
 *               type: boolean
 *             groupActivities:
 *               type: array
 *               items:
 *                 type: string
 *             specialRequests:
 *               type: string
 *             priorityHandling:
 *               type: boolean
 *         metadata:
 *           type: object
 *           properties:
 *             source:
 *               type: string
 *               enum: [web, api, phone, email]
 *             bookingChannel:
 *               type: string
 *             corporateAccount:
 *               type: string
 *             eventType:
 *               type: string
 *               enum: [conference, wedding, tour_group, corporate_event, other]
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

const multiBookingSchema = new mongoose.Schema({
  groupReferenceId: {
    type: String,
    required: [true, 'Group reference ID is required'],
    uppercase: true,
    trim: true
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
  bookings: [{
    bookingId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Booking'
    },
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
      min: [1, 'Quantity must be at least 1']
    },
    ratePerNight: {
      type: Number,
      required: true,
      min: [0, 'Rate per night cannot be negative']
    },
    specialRate: {
      type: Number,
      min: [0, 'Special rate cannot be negative']
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative']
    },
    guestDetails: {
      primaryGuest: {
        name: {
          type: String,
          required: true,
          trim: true
        },
        email: {
          type: String,
          required: true,
          lowercase: true
        },
        phone: {
          type: String,
          required: true
        }
      },
      adults: {
        type: Number,
        required: true,
        min: 1
      },
      children: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed', 'cancelled'],
      default: 'pending'
    },
    failureReason: {
      type: String,
      trim: true
    },
    roomAssignments: [{
      roomNumber: String,
      guestName: String,
      guestEmail: String,
      guestPhone: String
    }]
  }],
  groupDetails: {
    groupName: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      maxlength: [200, 'Group name cannot exceed 200 characters']
    },
    primaryContact: {
      name: {
        type: String,
        required: [true, 'Primary contact name is required'],
        trim: true
      },
      email: {
        type: String,
        required: [true, 'Primary contact email is required'],
        lowercase: true
      },
      phone: {
        type: String,
        required: [true, 'Primary contact phone is required']
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
    },
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
    }
  },
  pricing: {
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative']
    },
    bulkDiscount: {
      type: Number,
      default: 0,
      min: [0, 'Bulk discount cannot be negative']
    },
    totalTaxes: {
      type: Number,
      default: 0,
      min: [0, 'Total taxes cannot be negative']
    },
    totalFees: {
      type: Number,
      default: 0,
      min: [0, 'Total fees cannot be negative']
    },
    totalDiscounts: {
      type: Number,
      default: 0,
      min: [0, 'Total discounts cannot be negative']
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true
    }
  },
  commission: {
    rate: {
      type: Number,
      required: [true, 'Commission rate is required'],
      min: [0, 'Commission rate cannot be negative'],
      max: [50, 'Commission rate cannot exceed 50%']
    },
    bulkBonusRate: {
      type: Number,
      default: 0,
      min: [0, 'Bulk bonus rate cannot be negative'],
      max: [25, 'Bulk bonus rate cannot exceed 25%']
    },
    totalCommission: {
      type: Number,
      min: [0, 'Total commission cannot be negative']
    },
    bulkBonus: {
      type: Number,
      default: 0,
      min: [0, 'Bulk bonus cannot be negative']
    },
    finalCommission: {
      type: Number,
      min: [0, 'Final commission cannot be negative']
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
  transaction: {
    transactionId: {
      type: String,
      sparse: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'rolled_back'],
      default: 'pending'
    },
    steps: [{
      stepNumber: {
        type: Number,
        required: true
      },
      action: {
        type: String,
        required: true,
        enum: ['validate_availability', 'reserve_rooms', 'create_bookings', 'process_payment', 'confirm_bookings', 'send_confirmations']
      },
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'failed'],
        default: 'pending'
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      details: {
        type: mongoose.Schema.Types.Mixed
      },
      error: {
        type: String
      }
    }],
    rollbackDetails: {
      reason: {
        type: String
      },
      rollbackSteps: [{
        action: String,
        status: String,
        timestamp: Date,
        details: mongoose.Schema.Types.Mixed
      }],
      timestamp: {
        type: Date
      }
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed', 'partially_booked', 'cancelled'],
    default: 'pending'
  },
  failedBookings: [{
    roomTypeId: {
      type: mongoose.Schema.ObjectId,
      ref: 'RoomType'
    },
    roomTypeName: String,
    quantity: Number,
    reason: String,
    attemptedAt: {
      type: Date,
      default: Date.now
    }
  }],
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
    },
    transactionReference: {
      type: String,
      trim: true
    }
  },
  specialConditions: {
    bulkCheckIn: {
      type: Boolean,
      default: false
    },
    groupActivities: [{
      type: String,
      trim: true
    }],
    specialRequests: {
      type: String,
      trim: true,
      maxlength: [2000, 'Special requests cannot exceed 2000 characters']
    },
    priorityHandling: {
      type: Boolean,
      default: false
    }
  },
  metadata: {
    source: {
      type: String,
      enum: ['web', 'api', 'phone', 'email'],
      default: 'api'
    },
    bookingChannel: {
      type: String,
      trim: true
    },
    corporateAccount: {
      type: String,
      trim: true
    },
    eventType: {
      type: String,
      enum: ['conference', 'wedding', 'tour_group', 'corporate_event', 'other'],
      default: 'other'
    },
    referenceNumber: {
      type: String,
      trim: true
    }
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [3000, 'Notes cannot exceed 3000 characters']
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
multiBookingSchema.index({ groupReferenceId: 1 }, { unique: true });
multiBookingSchema.index({ 'transaction.transactionId': 1 }, { unique: true, sparse: true });
multiBookingSchema.index({ travelAgentId: 1 });
multiBookingSchema.index({ agentCode: 1 });
multiBookingSchema.index({ hotelId: 1 });
multiBookingSchema.index({ status: 1 });
multiBookingSchema.index({ 'groupDetails.checkIn': 1 });
multiBookingSchema.index({ 'groupDetails.checkOut': 1 });
multiBookingSchema.index({ 'transaction.status': 1 });
multiBookingSchema.index({ 'commission.paymentStatus': 1 });
multiBookingSchema.index({ createdAt: -1 });

// Compound indexes for complex queries
multiBookingSchema.index({ travelAgentId: 1, status: 1, createdAt: -1 });
multiBookingSchema.index({ hotelId: 1, 'groupDetails.checkIn': 1, status: 1 });
multiBookingSchema.index({ 'transaction.status': 1, createdAt: -1 });

// Virtual fields
multiBookingSchema.virtual('travelAgent', {
  ref: 'TravelAgent',
  localField: 'travelAgentId',
  foreignField: '_id',
  justOne: true
});

multiBookingSchema.virtual('hotel', {
  ref: 'Hotel',
  localField: 'hotelId',
  foreignField: '_id',
  justOne: true
});

// Virtual for successful bookings count
multiBookingSchema.virtual('successfulBookingsCount').get(function() {
  return this.bookings.filter(booking => booking.status === 'confirmed').length;
});

// Virtual for failed bookings count
multiBookingSchema.virtual('failedBookingsCount').get(function() {
  return this.bookings.filter(booking => booking.status === 'failed').length;
});

// Virtual for completion percentage
multiBookingSchema.virtual('completionPercentage').get(function() {
  if (this.bookings.length === 0) return 0;
  return Math.round((this.successfulBookingsCount / this.bookings.length) * 100);
});

// Pre-save middleware
multiBookingSchema.pre('save', function(next) {
  // Generate group reference ID if not provided
  if (!this.groupReferenceId) {
    const timestamp = Date.now().toString(36);
    const agentCode = this.agentCode ? this.agentCode.substring(0, 3) : 'GRP';
    this.groupReferenceId = `${agentCode}${timestamp}`.toUpperCase();
  }

  // Generate transaction ID if not provided
  if (!this.transaction.transactionId && this.transaction.status !== 'pending') {
    this.transaction.transactionId = `TXN${this.groupReferenceId}${Date.now()}`;
  }

  // Calculate final commission
  this.commission.totalCommission = (this.pricing.totalAmount * this.commission.rate) / 100;
  this.commission.bulkBonus = (this.pricing.totalAmount * this.commission.bulkBonusRate) / 100;
  this.commission.finalCommission = this.commission.totalCommission + this.commission.bulkBonus;

  // Update pending payment amount
  if (this.paymentDetails.status !== 'paid') {
    this.paymentDetails.pendingAmount = this.pricing.totalAmount - (this.paymentDetails.paidAmount || 0);
  }

  // Update overall status based on individual booking statuses
  if (this.bookings.length > 0) {
    const confirmedCount = this.successfulBookingsCount;
    const failedCount = this.failedBookingsCount;
    const totalCount = this.bookings.length;

    if (confirmedCount === totalCount) {
      this.status = 'confirmed';
    } else if (confirmedCount > 0 && failedCount > 0) {
      this.status = 'partially_booked';
    } else if (failedCount === totalCount) {
      this.status = 'failed';
    }
  }

  next();
});

// Instance methods
multiBookingSchema.methods.calculateBulkPricing = function(bulkDiscountRate = 0) {
  let subtotal = 0;

  // Calculate subtotal from all bookings
  this.bookings.forEach(booking => {
    subtotal += booking.totalAmount;
  });

  // Apply bulk discount
  const bulkDiscount = (subtotal * bulkDiscountRate) / 100;

  // Calculate taxes and fees (simplified - 18% tax)
  const taxRate = 18;
  const totalTaxes = ((subtotal - bulkDiscount) * taxRate) / 100;

  this.pricing.subtotal = subtotal;
  this.pricing.bulkDiscount = bulkDiscount;
  this.pricing.totalTaxes = totalTaxes;
  this.pricing.totalAmount = subtotal - bulkDiscount + totalTaxes + this.pricing.totalFees;

  return this.pricing;
};

multiBookingSchema.methods.addTransactionStep = function(stepNumber, action, status = 'pending', details = {}, session = null) {
  this.transaction.steps.push({
    stepNumber,
    action,
    status,
    details,
    timestamp: new Date()
  });

  if (status === 'in_progress') {
    this.transaction.status = 'processing';
  }

  return session ? this.save({ session }) : this.save();
};

multiBookingSchema.methods.updateTransactionStep = function(stepNumber, status, details = {}, error = null) {
  const step = this.transaction.steps.find(s => s.stepNumber === stepNumber);
  if (step) {
    step.status = status;
    step.details = { ...step.details, ...details };
    step.timestamp = new Date();
    if (error) {
      step.error = error;
    }
  }

  // Update overall transaction status
  const allSteps = this.transaction.steps;
  const completedSteps = allSteps.filter(s => s.status === 'completed').length;
  const failedSteps = allSteps.filter(s => s.status === 'failed').length;

  if (failedSteps > 0) {
    this.transaction.status = 'failed';
  } else if (completedSteps === allSteps.length) {
    this.transaction.status = 'completed';
  }

  return this.save();
};

multiBookingSchema.methods.initiateRollback = function(reason) {
  this.transaction.status = 'rolled_back';
  this.transaction.rollbackDetails = {
    reason,
    timestamp: new Date(),
    rollbackSteps: []
  };

  // Update booking statuses
  this.bookings.forEach(booking => {
    if (booking.status === 'confirmed') {
      booking.status = 'cancelled';
    }
  });

  this.status = 'failed';
  return this.save();
};

multiBookingSchema.methods.addRollbackStep = function(action, status, details = {}) {
  this.transaction.rollbackDetails.rollbackSteps.push({
    action,
    status,
    details,
    timestamp: new Date()
  });

  return this.save();
};

multiBookingSchema.methods.markCommissionPaid = function(paymentReference) {
  this.commission.paymentStatus = 'paid';
  this.commission.paymentDate = new Date();
  this.commission.paymentReference = paymentReference;
  return this.save();
};

multiBookingSchema.methods.getBookingSummary = function() {
  return {
    groupReferenceId: this.groupReferenceId,
    status: this.status,
    totalRooms: this.groupDetails.totalRooms,
    totalGuests: this.groupDetails.totalGuests,
    totalAmount: this.pricing.totalAmount,
    commission: this.commission.finalCommission,
    successfulBookings: this.successfulBookingsCount,
    failedBookings: this.failedBookingsCount,
    completionPercentage: this.completionPercentage,
    checkIn: this.groupDetails.checkIn,
    checkOut: this.groupDetails.checkOut,
    nights: this.groupDetails.nights
  };
};

// Static methods
multiBookingSchema.statics.findByGroupReference = function(groupReferenceId) {
  return this.findOne({ groupReferenceId: groupReferenceId.toUpperCase(), isActive: true });
};

multiBookingSchema.statics.getAgentMultiBookings = function(travelAgentId, startDate, endDate) {
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

  return this.find(matchStage)
    .populate('travelAgent', 'companyName agentCode')
    .populate('hotel', 'name')
    .sort({ createdAt: -1 });
};

multiBookingSchema.statics.getMultiBookingAnalytics = function(hotelId, period = 'month') {
  const now = new Date();
  let startDate;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const matchStage = {
    createdAt: { $gte: startDate },
    isActive: true
  };

  if (hotelId) {
    matchStage.hotelId = new mongoose.Types.ObjectId(hotelId);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalMultiBookings: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.totalAmount' },
        totalCommission: { $sum: '$commission.finalCommission' },
        totalRooms: { $sum: '$groupDetails.totalRooms' },
        totalGuests: { $sum: '$groupDetails.totalGuests' },
        averageGroupSize: { $avg: '$groupDetails.totalRooms' },
        confirmedBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
        },
        partiallyBookedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'partially_booked'] }, 1, 0] }
        },
        failedBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        }
      }
    }
  ]);
};

const MultiBooking = mongoose.model('MultiBooking', multiBookingSchema);

export default MultiBooking;