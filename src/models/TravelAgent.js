import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     TravelAgent:
 *       type: object
 *       required:
 *         - userId
 *         - agentCode
 *         - companyName
 *         - contactPerson
 *       properties:
 *         _id:
 *           type: string
 *           description: Travel agent ID
 *         userId:
 *           type: string
 *           description: Reference to User model
 *         agentCode:
 *           type: string
 *           description: Unique travel agent code
 *         companyName:
 *           type: string
 *           description: Travel agency company name
 *         contactPerson:
 *           type: string
 *           description: Primary contact person name
 *         phone:
 *           type: string
 *           description: Agency phone number
 *         email:
 *           type: string
 *           description: Agency email address
 *         address:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *             city:
 *               type: string
 *             state:
 *               type: string
 *             country:
 *               type: string
 *             zipCode:
 *               type: string
 *         businessDetails:
 *           type: object
 *           properties:
 *             licenseNumber:
 *               type: string
 *             gstNumber:
 *               type: string
 *             establishedYear:
 *               type: number
 *             businessType:
 *               type: string
 *               enum: [domestic, international, both]
 *         commissionStructure:
 *           type: object
 *           properties:
 *             defaultRate:
 *               type: number
 *               description: Default commission percentage
 *             roomTypeRates:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   roomTypeId:
 *                     type: string
 *                   commissionRate:
 *                     type: number
 *             seasonalRates:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   season:
 *                     type: string
 *                   commissionRate:
 *                     type: number
 *                   validFrom:
 *                     type: string
 *                     format: date
 *                   validTo:
 *                     type: string
 *                     format: date
 *         bookingLimits:
 *           type: object
 *           properties:
 *             maxBookingsPerDay:
 *               type: number
 *               default: 50
 *             maxRoomsPerBooking:
 *               type: number
 *               default: 10
 *             maxAdvanceBookingDays:
 *               type: number
 *               default: 365
 *         paymentTerms:
 *           type: object
 *           properties:
 *             creditLimit:
 *               type: number
 *               default: 0
 *             paymentDueDays:
 *               type: number
 *               default: 30
 *             preferredPaymentMethod:
 *               type: string
 *               enum: [bank_transfer, cheque, online, cash]
 *         status:
 *           type: string
 *           enum: [active, inactive, suspended, pending_approval]
 *           default: pending_approval
 *         performanceMetrics:
 *           type: object
 *           properties:
 *             totalBookings:
 *               type: number
 *               default: 0
 *             totalRevenue:
 *               type: number
 *               default: 0
 *             totalCommissionEarned:
 *               type: number
 *               default: 0
 *             averageBookingValue:
 *               type: number
 *               default: 0
 *             lastBookingDate:
 *               type: string
 *               format: date-time
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

const travelAgentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  agentCode: {
    type: String,
    required: [true, 'Agent code is required'],
    uppercase: true,
    trim: true,
    minlength: [3, 'Agent code must be at least 3 characters'],
    maxlength: [10, 'Agent code cannot exceed 10 characters']
  },
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [200, 'Company name cannot exceed 200 characters']
  },
  contactPerson: {
    type: String,
    required: [true, 'Contact person is required'],
    trim: true,
    maxlength: [100, 'Contact person name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  address: {
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true
    },
    zipCode: {
      type: String,
      trim: true
    }
  },
  businessDetails: {
    licenseNumber: {
      type: String,
      trim: true
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true
    },
    establishedYear: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear()
    },
    businessType: {
      type: String,
      enum: ['domestic', 'international', 'both'],
      default: 'domestic'
    }
  },
  commissionStructure: {
    defaultRate: {
      type: Number,
      required: [true, 'Default commission rate is required'],
      min: [0, 'Commission rate cannot be negative'],
      max: [50, 'Commission rate cannot exceed 50%'],
      default: 10
    },
    roomTypeRates: [{
      roomTypeId: {
        type: mongoose.Schema.ObjectId,
        ref: 'RoomType'
      },
      commissionRate: {
        type: Number,
        min: 0,
        max: 50
      }
    }],
    seasonalRates: [{
      season: {
        type: String,
        enum: ['peak', 'high', 'low', 'off']
      },
      commissionRate: {
        type: Number,
        min: 0,
        max: 50
      },
      validFrom: {
        type: Date
      },
      validTo: {
        type: Date
      }
    }]
  },
  bookingLimits: {
    maxBookingsPerDay: {
      type: Number,
      default: 50,
      min: [1, 'Minimum 1 booking per day allowed']
    },
    maxRoomsPerBooking: {
      type: Number,
      default: 10,
      min: [1, 'Minimum 1 room per booking allowed']
    },
    maxAdvanceBookingDays: {
      type: Number,
      default: 365,
      min: [1, 'Minimum 1 day advance booking allowed']
    }
  },
  paymentTerms: {
    creditLimit: {
      type: Number,
      default: 0,
      min: [0, 'Credit limit cannot be negative']
    },
    paymentDueDays: {
      type: Number,
      default: 30,
      min: [1, 'Payment due days must be at least 1']
    },
    preferredPaymentMethod: {
      type: String,
      enum: ['bank_transfer', 'cheque', 'online', 'cash'],
      default: 'bank_transfer'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending_approval'],
    default: 'pending_approval'
  },
  performanceMetrics: {
    totalBookings: {
      type: Number,
      default: 0,
      min: 0
    },
    totalRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    totalCommissionEarned: {
      type: Number,
      default: 0,
      min: 0
    },
    averageBookingValue: {
      type: Number,
      default: 0,
      min: 0
    },
    lastBookingDate: {
      type: Date
    }
  },
  specialRatesAccess: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
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
travelAgentSchema.index({ agentCode: 1 }, { unique: true });
travelAgentSchema.index({ userId: 1 }, { unique: true });
travelAgentSchema.index({ status: 1 });
travelAgentSchema.index({ hotelId: 1 });
travelAgentSchema.index({ isActive: 1 });

// Virtual fields
travelAgentSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

travelAgentSchema.virtual('hotel', {
  ref: 'Hotel',
  localField: 'hotelId',
  foreignField: '_id',
  justOne: true
});

// Instance methods
travelAgentSchema.methods.updatePerformanceMetrics = function(bookingData) {
  this.performanceMetrics.totalBookings += 1;
  this.performanceMetrics.totalRevenue += bookingData.totalAmount;
  this.performanceMetrics.totalCommissionEarned += bookingData.commissionAmount;
  this.performanceMetrics.averageBookingValue = this.performanceMetrics.totalRevenue / this.performanceMetrics.totalBookings;
  this.performanceMetrics.lastBookingDate = new Date();
  return this.save();
};

travelAgentSchema.methods.getCommissionRate = function(roomTypeId, season) {
  // Check for room type specific rate
  const roomTypeRate = this.commissionStructure.roomTypeRates.find(
    rate => rate.roomTypeId.toString() === roomTypeId.toString()
  );
  if (roomTypeRate) {
    return roomTypeRate.commissionRate;
  }

  // Check for seasonal rate
  const now = new Date();
  const seasonalRate = this.commissionStructure.seasonalRates.find(
    rate => rate.season === season &&
    rate.validFrom <= now &&
    rate.validTo >= now
  );
  if (seasonalRate) {
    return seasonalRate.commissionRate;
  }

  // Return default rate
  return this.commissionStructure.defaultRate;
};

travelAgentSchema.methods.canMakeBooking = function() {
  if (!this.isActive || this.status !== 'active') {
    return { allowed: false, reason: 'Agent account is not active' };
  }

  // Check daily booking limit (would need to query recent bookings)
  // This is a simplified check - in practice, you'd query TravelAgentBooking model
  return { allowed: true };
};

// Static methods
travelAgentSchema.statics.findByAgentCode = function(agentCode) {
  return this.findOne({ agentCode: agentCode.toUpperCase(), isActive: true });
};

travelAgentSchema.statics.getActiveAgents = function(hotelId) {
  const query = { status: 'active', isActive: true };
  if (hotelId) {
    query.hotelId = hotelId;
  }
  return this.find(query).populate('userId', 'name email').sort({ companyName: 1 });
};

// Pre-save middleware
travelAgentSchema.pre('save', function(next) {
  // Generate agent code if not provided
  if (!this.agentCode && this.companyName) {
    const companyCode = this.companyName.substring(0, 3).toUpperCase();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.agentCode = `${companyCode}${randomNum}`;
  }
  next();
});

const TravelAgent = mongoose.model('TravelAgent', travelAgentSchema);

export default TravelAgent;