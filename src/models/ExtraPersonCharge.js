import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     ExtraPersonCharge:
 *       type: object
 *       required:
 *         - hotelId
 *         - name
 *         - chargeType
 *         - amount
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         name:
 *           type: string
 *           description: Name of the charge rule
 *         description:
 *           type: string
 *           description: Description of the charge
 *         chargeType:
 *           type: string
 *           enum: [fixed, percentage_of_room_rate, per_night]
 *           description: Type of charge calculation
 *         amount:
 *           type: number
 *           description: Charge amount or percentage
 *         currency:
 *           type: string
 *           default: INR
 *         applicableRoomTypes:
 *           type: array
 *           items:
 *             type: string
 *           description: Room types this charge applies to
 *         guestType:
 *           type: string
 *           enum: [adult, child]
 *           description: Type of guest this charge applies to
 *         ageRange:
 *           type: object
 *           properties:
 *             min:
 *               type: number
 *             max:
 *               type: number
 *         seasonalRates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               seasonName:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               multiplier:
 *                 type: number
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

const extraPersonChargeSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Charge name is required'],
    trim: true,
    maxLength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  chargeType: {
    type: String,
    enum: {
      values: ['fixed', 'percentage_of_room_rate', 'per_night'],
      message: 'Invalid charge type'
    },
    required: [true, 'Charge type is required']
  },
  amount: {
    type: Number,
    required: [true, 'Charge amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
    trim: true
  },
  // Room types this charge applies to (empty array means applies to all)
  applicableRoomTypes: [{
    type: String,
    enum: ['single', 'double', 'suite', 'deluxe', 'family', 'presidential'],
    trim: true
  }],
  guestType: {
    type: String,
    enum: {
      values: ['adult', 'child'],
      message: 'Guest type must be adult or child'
    },
    required: [true, 'Guest type is required']
  },
  // Age range for child charges
  ageRange: {
    min: {
      type: Number,
      min: 0,
      max: 17,
      default: 0
    },
    max: {
      type: Number,
      min: 0,
      max: 17,
      default: 17
    }
  },
  // Maximum number of extra persons allowed
  maxExtraPersons: {
    type: Number,
    min: 1,
    default: 4,
    required: [true, 'Maximum extra persons limit is required']
  },
  // Seasonal rate variations
  seasonalRates: [{
    seasonName: {
      type: String,
      required: true,
      trim: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    multiplier: {
      type: Number,
      required: true,
      min: 0.1,
      max: 10,
      default: 1
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  // Day of week variations
  dayOfWeekRates: {
    monday: { type: Number, default: 1, min: 0.1, max: 10 },
    tuesday: { type: Number, default: 1, min: 0.1, max: 10 },
    wednesday: { type: Number, default: 1, min: 0.1, max: 10 },
    thursday: { type: Number, default: 1, min: 0.1, max: 10 },
    friday: { type: Number, default: 1.2, min: 0.1, max: 10 },
    saturday: { type: Number, default: 1.5, min: 0.1, max: 10 },
    sunday: { type: Number, default: 1.3, min: 0.1, max: 10 }
  },
  // Minimum nights requirement for this charge to apply
  minimumNights: {
    type: Number,
    min: 1,
    default: 1
  },
  // Advanced pricing tiers based on number of extra persons
  pricingTiers: [{
    fromPersonCount: {
      type: Number,
      required: true,
      min: 1
    },
    toPersonCount: {
      type: Number,
      required: true,
      min: 1
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    chargeType: {
      type: String,
      enum: ['fixed', 'percentage_of_room_rate', 'per_night'],
      required: true
    }
  }],
  // Tax configuration for extra person charges
  taxSettings: {
    isTaxable: {
      type: Boolean,
      default: true
    },
    taxRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 18 // GST rate
    },
    taxType: {
      type: String,
      enum: ['inclusive', 'exclusive'],
      default: 'exclusive'
    }
  },
  // Booking source specific rates
  sourceSpecificRates: [{
    source: {
      type: String,
      enum: ['direct', 'booking_com', 'expedia', 'airbnb', 'travel_agent', 'corporate'],
      required: true
    },
    multiplier: {
      type: Number,
      min: 0.1,
      max: 10,
      default: 1
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 100,
    description: 'Priority for applying multiple matching rules (higher number = higher priority)'
  },
  // Effective date range
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveTo: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value > this.effectiveFrom;
      },
      message: 'Effective to date must be after effective from date'
    }
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
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

// Compound indexes for efficient queries
extraPersonChargeSchema.index({ hotelId: 1, isActive: 1, priority: -1 });
extraPersonChargeSchema.index({ hotelId: 1, guestType: 1, applicableRoomTypes: 1 });
extraPersonChargeSchema.index({ effectiveFrom: 1, effectiveTo: 1 });

// Validation for age range
extraPersonChargeSchema.pre('validate', function(next) {
  if (this.guestType === 'child' && this.ageRange) {
    if (this.ageRange.min > this.ageRange.max) {
      this.invalidate('ageRange.min', 'Minimum age cannot be greater than maximum age');
    }
  }

  // Validate pricing tiers don't overlap
  if (this.pricingTiers && this.pricingTiers.length > 1) {
    const sortedTiers = this.pricingTiers.sort((a, b) => a.fromPersonCount - b.fromPersonCount);
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      if (sortedTiers[i].toPersonCount >= sortedTiers[i + 1].fromPersonCount) {
        this.invalidate('pricingTiers', 'Pricing tiers cannot overlap');
        break;
      }
    }
  }

  next();
});

// Static method to calculate extra person charge
extraPersonChargeSchema.statics.calculateExtraPersonCharge = async function(hotelId, bookingData) {
  const {
    roomType,
    baseRoomRate,
    extraPersons,
    checkIn,
    checkOut,
    bookingSource,
    nights
  } = bookingData;

  // Find applicable charge rules
  const query = {
    hotelId,
    isActive: true,
    $and: [
      {
        $or: [
          { applicableRoomTypes: { $in: [roomType] } },
          { applicableRoomTypes: { $size: 0 } } // Apply to all room types
        ]
      },
      {
        effectiveFrom: { $lte: new Date(checkIn) }
      },
      {
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: { $gte: new Date(checkOut) } }
        ]
      }
    ]
  };

  // Extract unique guest types from extra persons
  const guestTypes = [...new Set(extraPersons.map(p => p.type))];

  const chargeRules = await this.find(query).sort({ priority: -1 });

  if (chargeRules.length === 0) {
    throw new Error('No extra person charge rules found for this room type');
  }

  let totalExtraCharge = 0;
  const chargeBreakdown = [];
  const checkInDate = new Date(checkIn);

  // Process each extra person
  for (const person of extraPersons) {
    // Find the best matching rule
    const applicableRule = chargeRules.find(rule => {
      if (rule.guestType !== person.type) return false;

      // Check age range for children
      if (person.type === 'child' && rule.ageRange) {
        if (person.age < rule.ageRange.min || person.age > rule.ageRange.max) {
          return false;
        }
      }

      return true;
    });

    if (!applicableRule) continue;

    // Calculate base charge
    let baseCharge = 0;
    const applicablePricingTier = applicableRule.pricingTiers.find(tier =>
      extraPersons.length >= tier.fromPersonCount && extraPersons.length <= tier.toPersonCount
    );

    if (applicablePricingTier) {
      // Use pricing tier
      baseCharge = this.calculateChargeAmount(
        applicablePricingTier.chargeType,
        applicablePricingTier.amount,
        baseRoomRate,
        nights
      );
    } else {
      // Use base rule
      baseCharge = this.calculateChargeAmount(
        applicableRule.chargeType,
        applicableRule.amount,
        baseRoomRate,
        nights
      );
    }

    // Apply seasonal multiplier
    const seasonMultiplier = this.getSeasonalMultiplier(applicableRule.seasonalRates, checkInDate);

    // Apply day of week multiplier
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[checkInDate.getDay()];
    const dayMultiplier = applicableRule.dayOfWeekRates[dayOfWeek] || 1;

    // Apply source-specific multiplier
    const sourceMultiplier = this.getSourceMultiplier(applicableRule.sourceSpecificRates, bookingSource);

    const finalCharge = baseCharge * seasonMultiplier * dayMultiplier * sourceMultiplier;

    // Apply tax if applicable
    let taxAmount = 0;
    if (applicableRule.taxSettings.isTaxable) {
      if (applicableRule.taxSettings.taxType === 'exclusive') {
        taxAmount = (finalCharge * applicableRule.taxSettings.taxRate) / 100;
      } else {
        // Inclusive tax - extract tax from total
        taxAmount = (finalCharge * applicableRule.taxSettings.taxRate) / (100 + applicableRule.taxSettings.taxRate);
      }
    }

    const personCharge = {
      personId: person.id,
      personName: person.name,
      personType: person.type,
      age: person.age,
      ruleApplied: applicableRule._id,
      baseCharge,
      seasonMultiplier,
      dayMultiplier,
      sourceMultiplier,
      chargeBeforeTax: finalCharge,
      taxAmount,
      totalCharge: finalCharge + taxAmount,
      currency: applicableRule.currency
    };

    chargeBreakdown.push(personCharge);
    totalExtraCharge += personCharge.totalCharge;
  }

  return {
    totalExtraCharge,
    chargeBreakdown,
    currency: chargeRules[0].currency
  };
};

// Helper method to calculate charge amount based on type
extraPersonChargeSchema.statics.calculateChargeAmount = function(chargeType, amount, baseRoomRate, nights) {
  switch (chargeType) {
    case 'fixed':
      return amount;
    case 'percentage_of_room_rate':
      return (baseRoomRate * amount) / 100;
    case 'per_night':
      return amount * nights;
    default:
      return amount;
  }
};

// Helper method to get seasonal multiplier
extraPersonChargeSchema.statics.getSeasonalMultiplier = function(seasonalRates, checkInDate) {
  const currentSeason = seasonalRates.find(season => {
    const seasonStart = new Date(season.startDate);
    const seasonEnd = new Date(season.endDate);
    return checkInDate >= seasonStart && checkInDate <= seasonEnd && season.isActive;
  });

  return currentSeason ? currentSeason.multiplier : 1;
};

// Helper method to get source-specific multiplier
extraPersonChargeSchema.statics.getSourceMultiplier = function(sourceSpecificRates, bookingSource) {
  const sourceRate = sourceSpecificRates.find(rate =>
    rate.source === bookingSource && rate.isActive
  );

  return sourceRate ? sourceRate.multiplier : 1;
};

// Instance method to validate if rule applies to booking
extraPersonChargeSchema.methods.appliesTo = function(bookingData) {
  const { roomType, checkIn, checkOut } = bookingData;

  // Check if active
  if (!this.isActive) return false;

  // Check room type
  if (this.applicableRoomTypes.length > 0 && !this.applicableRoomTypes.includes(roomType)) {
    return false;
  }

  // Check effective dates
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (checkInDate < this.effectiveFrom) return false;
  if (this.effectiveTo && checkOutDate > this.effectiveTo) return false;

  return true;
};

export default mongoose.model('ExtraPersonCharge', extraPersonChargeSchema);