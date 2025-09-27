import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     TravelAgentRates:
 *       type: object
 *       required:
 *         - travelAgentId
 *         - roomTypeId
 *         - specialRate
 *         - validFrom
 *         - validTo
 *       properties:
 *         _id:
 *           type: string
 *           description: Travel agent rate ID
 *         travelAgentId:
 *           type: string
 *           description: Reference to TravelAgent model
 *         roomTypeId:
 *           type: string
 *           description: Reference to RoomType model
 *         hotelId:
 *           type: string
 *           description: Reference to Hotel model
 *         rateType:
 *           type: string
 *           enum: [special_rate, discount_percentage, commission_bonus]
 *           description: Type of special pricing
 *         specialRate:
 *           type: number
 *           description: Special rate amount
 *         discountPercentage:
 *           type: number
 *           description: Discount percentage from regular rate
 *         minimumNights:
 *           type: number
 *           description: Minimum nights required for this rate
 *         maximumNights:
 *           type: number
 *           description: Maximum nights allowed for this rate
 *         seasonalRates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               season:
 *                 type: string
 *                 enum: [peak, high, low, off]
 *               rate:
 *                 type: number
 *               discountPercentage:
 *                 type: number
 *         dayOfWeekRates:
 *           type: object
 *           properties:
 *             monday:
 *               type: number
 *             tuesday:
 *               type: number
 *             wednesday:
 *               type: number
 *             thursday:
 *               type: number
 *             friday:
 *               type: number
 *             saturday:
 *               type: number
 *             sunday:
 *               type: number
 *         validFrom:
 *           type: string
 *           format: date
 *           description: Rate validity start date
 *         validTo:
 *           type: string
 *           format: date
 *           description: Rate validity end date
 *         blackoutDates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               from:
 *                 type: string
 *                 format: date
 *               to:
 *                 type: string
 *                 format: date
 *               reason:
 *                 type: string
 *         conditions:
 *           type: object
 *           properties:
 *             advanceBookingDays:
 *               type: number
 *             cancellationPolicy:
 *               type: string
 *             paymentTerms:
 *               type: string
 *             groupSizeMin:
 *               type: number
 *             groupSizeMax:
 *               type: number
 *         isActive:
 *           type: boolean
 *           default: true
 *         createdBy:
 *           type: string
 *           description: User who created this rate
 *         lastModifiedBy:
 *           type: string
 *           description: User who last modified this rate
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const travelAgentRatesSchema = new mongoose.Schema({
  travelAgentId: {
    type: mongoose.Schema.ObjectId,
    ref: 'TravelAgent',
    required: [true, 'Travel agent ID is required']
  },
  roomTypeId: {
    type: mongoose.Schema.ObjectId,
    ref: 'RoomType',
    required: [true, 'Room type ID is required']
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  rateType: {
    type: String,
    enum: ['special_rate', 'discount_percentage', 'commission_bonus'],
    required: [true, 'Rate type is required'],
    default: 'special_rate'
  },
  specialRate: {
    type: Number,
    required: function() {
      return this.rateType === 'special_rate';
    },
    min: [0, 'Special rate cannot be negative']
  },
  discountPercentage: {
    type: Number,
    required: function() {
      return this.rateType === 'discount_percentage';
    },
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100%']
  },
  commissionBonus: {
    type: Number,
    required: function() {
      return this.rateType === 'commission_bonus';
    },
    min: [0, 'Commission bonus cannot be negative'],
    max: [50, 'Commission bonus cannot exceed 50%']
  },
  minimumNights: {
    type: Number,
    default: 1,
    min: [1, 'Minimum nights must be at least 1']
  },
  maximumNights: {
    type: Number,
    default: 30,
    min: [1, 'Maximum nights must be at least 1']
  },
  seasonalRates: [{
    season: {
      type: String,
      enum: ['peak', 'high', 'low', 'off'],
      required: true
    },
    rate: {
      type: Number,
      min: 0
    },
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  dayOfWeekRates: {
    monday: {
      type: Number,
      min: 0
    },
    tuesday: {
      type: Number,
      min: 0
    },
    wednesday: {
      type: Number,
      min: 0
    },
    thursday: {
      type: Number,
      min: 0
    },
    friday: {
      type: Number,
      min: 0
    },
    saturday: {
      type: Number,
      min: 0
    },
    sunday: {
      type: Number,
      min: 0
    }
  },
  validFrom: {
    type: Date,
    required: [true, 'Valid from date is required']
  },
  validTo: {
    type: Date,
    required: [true, 'Valid to date is required'],
    validate: {
      validator: function(value) {
        return value > this.validFrom;
      },
      message: 'Valid to date must be after valid from date'
    }
  },
  blackoutDates: [{
    from: {
      type: Date,
      required: true
    },
    to: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [200, 'Blackout reason cannot exceed 200 characters']
    }
  }],
  conditions: {
    advanceBookingDays: {
      type: Number,
      default: 0,
      min: [0, 'Advance booking days cannot be negative']
    },
    cancellationPolicy: {
      type: String,
      enum: ['flexible', 'moderate', 'strict', 'non_refundable'],
      default: 'moderate'
    },
    paymentTerms: {
      type: String,
      enum: ['pay_now', 'pay_at_hotel', 'credit_allowed'],
      default: 'pay_now'
    },
    groupSizeMin: {
      type: Number,
      default: 1,
      min: [1, 'Minimum group size must be at least 1']
    },
    groupSizeMax: {
      type: Number,
      default: 10,
      min: [1, 'Maximum group size must be at least 1']
    }
  },
  priority: {
    type: Number,
    default: 1,
    min: [1, 'Priority must be at least 1'],
    max: [10, 'Priority cannot exceed 10']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },
  lastModifiedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
travelAgentRatesSchema.index({ travelAgentId: 1, roomTypeId: 1 });
travelAgentRatesSchema.index({ hotelId: 1 });
travelAgentRatesSchema.index({ validFrom: 1, validTo: 1 });
travelAgentRatesSchema.index({ isActive: 1 });
travelAgentRatesSchema.index({ priority: -1 });

// Compound index for efficient rate lookups
travelAgentRatesSchema.index({
  travelAgentId: 1,
  roomTypeId: 1,
  validFrom: 1,
  validTo: 1,
  isActive: 1
});

// Virtual fields
travelAgentRatesSchema.virtual('travelAgent', {
  ref: 'TravelAgent',
  localField: 'travelAgentId',
  foreignField: '_id',
  justOne: true
});

travelAgentRatesSchema.virtual('roomType', {
  ref: 'RoomType',
  localField: 'roomTypeId',
  foreignField: '_id',
  justOne: true
});

travelAgentRatesSchema.virtual('hotel', {
  ref: 'Hotel',
  localField: 'hotelId',
  foreignField: '_id',
  justOne: true
});

// Instance methods
travelAgentRatesSchema.methods.isValidForDate = function(checkDate) {
  const date = new Date(checkDate);

  // Check if date falls within validity period
  if (date < this.validFrom || date > this.validTo) {
    return false;
  }

  // Check blackout dates
  for (const blackout of this.blackoutDates) {
    if (date >= blackout.from && date <= blackout.to) {
      return false;
    }
  }

  return true;
};

travelAgentRatesSchema.methods.getRateForDate = function(checkDate, season) {
  if (!this.isValidForDate(checkDate)) {
    return null;
  }

  const date = new Date(checkDate);
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];

  // Check for day of week specific rate
  if (this.dayOfWeekRates && this.dayOfWeekRates[dayOfWeek]) {
    return this.dayOfWeekRates[dayOfWeek];
  }

  // Check for seasonal rate
  if (season && this.seasonalRates.length > 0) {
    const seasonalRate = this.seasonalRates.find(rate => rate.season === season);
    if (seasonalRate) {
      return seasonalRate.rate || seasonalRate.discountPercentage;
    }
  }

  // Return base special rate or discount percentage
  return this.specialRate || this.discountPercentage || this.commissionBonus;
};

travelAgentRatesSchema.methods.calculateFinalRate = function(baseRate, checkDate, season) {
  const rate = this.getRateForDate(checkDate, season);
  if (!rate) return baseRate;

  switch (this.rateType) {
    case 'special_rate':
      return rate;
    case 'discount_percentage':
      return baseRate * (1 - rate / 100);
    case 'commission_bonus':
      // Commission bonus doesn't affect guest rate, only agent commission
      return baseRate;
    default:
      return baseRate;
  }
};

// Static methods
travelAgentRatesSchema.statics.findValidRatesForAgent = function(travelAgentId, roomTypeId, checkDate) {
  const date = new Date(checkDate);
  return this.find({
    travelAgentId,
    roomTypeId,
    validFrom: { $lte: date },
    validTo: { $gte: date },
    isActive: true
  }).sort({ priority: -1 });
};

travelAgentRatesSchema.statics.getBestRateForAgent = function(travelAgentId, roomTypeId, checkDate, baseRate) {
  return this.findValidRatesForAgent(travelAgentId, roomTypeId, checkDate)
    .then(rates => {
      if (!rates.length) return baseRate;

      // Find the rate that gives the best price for the guest
      let bestRate = baseRate;
      for (const rate of rates) {
        const calculatedRate = rate.calculateFinalRate(baseRate, checkDate);
        if (calculatedRate < bestRate) {
          bestRate = calculatedRate;
        }
      }
      return bestRate;
    });
};

// Pre-save middleware
travelAgentRatesSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastModifiedBy = this.modifiedBy || this.createdBy;
  }
  next();
});

// Pre-validate middleware
travelAgentRatesSchema.pre('validate', function(next) {
  // Ensure at least one rate field is provided based on rate type
  if (this.rateType === 'special_rate' && !this.specialRate) {
    return next(new Error('Special rate is required for special_rate type'));
  }
  if (this.rateType === 'discount_percentage' && !this.discountPercentage) {
    return next(new Error('Discount percentage is required for discount_percentage type'));
  }
  if (this.rateType === 'commission_bonus' && !this.commissionBonus) {
    return next(new Error('Commission bonus is required for commission_bonus type'));
  }

  // Validate maximum nights is greater than minimum nights
  if (this.maximumNights <= this.minimumNights) {
    return next(new Error('Maximum nights must be greater than minimum nights'));
  }

  next();
});

const TravelAgentRates = mongoose.model('TravelAgentRates', travelAgentRatesSchema);

export default TravelAgentRates;