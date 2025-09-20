import mongoose from 'mongoose';

// Rate Plan Schema
const ratePlanSchema = new mongoose.Schema({
  planId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['BAR', 'Corporate', 'Package', 'Promotional', 'Group', 'Government', 'Member'],
    required: true
  },
  // Base currency for all rates in this plan
  baseCurrency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'USD',
    ref: 'Currency'
  },
  
  baseRates: [{
    roomType: {
      type: String,
      enum: ['single', 'double', 'suite', 'deluxe'],
      required: true
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    // Multi-currency rates for this room type
    currencyRates: [{
      currency: {
        type: String,
        required: true,
        uppercase: true,
        ref: 'Currency'
      },
      rate: {
        type: Number,
        required: true,
        min: 0
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      },
      source: {
        type: String,
        enum: ['manual', 'auto_conversion', 'channel_specific'],
        default: 'auto_conversion'
      }
    }]
  }],
  validity: {
    startDate: Date,
    endDate: Date
  },
  bookingWindow: {
    minAdvanceBooking: { type: Number, default: 0 }, // hours
    maxAdvanceBooking: { type: Number, default: 365 } // days
  },
  stayRestrictions: {
    minNights: { type: Number, default: 1 },
    maxNights: { type: Number, default: 30 },
    closedToArrival: [Date],
    closedToDeparture: [Date]
  },
  cancellationPolicy: {
    type: {
      type: String,
      enum: ['flexible', 'moderate', 'strict', 'non_refundable'],
      default: 'flexible'
    },
    hoursBeforeCheckIn: { type: Number, default: 24 },
    penaltyPercentage: { type: Number, default: 0 }
  },
  mealPlan: {
    type: String,
    enum: ['RO', 'BB', 'HB', 'FB', 'AI'], // Room Only, Bed & Breakfast, Half Board, Full Board, All Inclusive
    default: 'RO'
  },
  applicableDays: {
    monday: { type: Boolean, default: true },
    tuesday: { type: Boolean, default: true },
    wednesday: { type: Boolean, default: true },
    thursday: { type: Boolean, default: true },
    friday: { type: Boolean, default: true },
    saturday: { type: Boolean, default: true },
    sunday: { type: Boolean, default: true }
  },
  discounts: {
    earlyBird: {
      enabled: Boolean,
      daysInAdvance: Number,
      discountPercentage: Number
    },
    lastMinute: {
      enabled: Boolean,
      hoursBeforeCheckIn: Number,
      discountPercentage: Number
    },
    lengthOfStay: [{
      minNights: Number,
      discountPercentage: Number
    }]
  },
  restrictions: {
    marketSegments: [String],
    geoRestrictions: {
      allowedCountries: [String],
      blockedCountries: [String]
    },
    requirePromoCode: Boolean,
    promoCode: String
  },
  commission: {
    percentage: { type: Number, default: 0 },
    fixed: { type: Number, default: 0 }
  },
  priority: {
    type: Number,
    default: 0 // Higher number = higher priority
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Seasonal Rate Schema
const seasonalRateSchema = new mongoose.Schema({
  seasonId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  rateAdjustments: [{
    roomType: {
      type: String,
      enum: ['single', 'double', 'suite', 'deluxe']
    },
    adjustmentType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    adjustmentValue: {
      type: Number,
      required: true
    }
  }],
  applicableRatePlans: [String], // References to rate plan IDs
  priority: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Dynamic Pricing Rules Schema
const dynamicPricingSchema = new mongoose.Schema({
  ruleId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['occupancy_based', 'demand_based', 'event_based', 'competitor_based'],
    required: true
  },
  triggers: {
    occupancyBased: {
      enabled: Boolean,
      thresholds: [{
        minOccupancy: Number, // percentage
        maxOccupancy: Number,
        priceAdjustment: Number // percentage
      }]
    },
    demandBased: {
      enabled: Boolean,
      searchVolumeThreshold: Number,
      bookingPaceThreshold: Number,
      priceAdjustment: Number
    },
    eventBased: {
      enabled: Boolean,
      events: [{
        eventName: String,
        startDate: Date,
        endDate: Date,
        radius: Number, // km from hotel
        priceAdjustment: Number
      }]
    },
    competitorBased: {
      enabled: Boolean,
      competitors: [{
        hotelId: String,
        weightage: Number
      }],
      pricePosition: String, // 'match', 'undercut', 'premium'
      adjustmentPercentage: Number
    }
  },
  constraints: {
    minRate: Number,
    maxRate: Number,
    maxDailyChange: Number, // percentage
    blackoutDates: [Date]
  },
  applicableRooms: [{
    type: String,
    enum: ['single', 'double', 'suite', 'deluxe', 'all']
  }],
  applicableRatePlans: [String],
  priority: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Rate Override Schema (for specific dates)
const rateOverrideSchema = new mongoose.Schema({
  overrideId: {
    type: String,
    required: true,
    unique: true
  },
  date: {
    type: Date,
    required: true
  },
  roomType: {
    type: String,
    enum: ['single', 'double', 'suite', 'deluxe'],
    required: true
  },
  ratePlanId: String,
  // Base rate in base currency
  overrideRate: {
    type: Number,
    required: true,
    min: 0
  },
  // Multi-currency override rates
  currencyRates: [{
    currency: {
      type: String,
      required: true,
      uppercase: true,
      ref: 'Currency'
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    source: {
      type: String,
      enum: ['manual', 'auto_conversion'],
      default: 'auto_conversion'
    }
  }],
  baseCurrency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'USD',
    ref: 'Currency'
  },
  reason: String,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  expiresAt: Date,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Yield Management Schema
const yieldManagementSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  roomType: {
    type: String,
    enum: ['single', 'double', 'suite', 'deluxe'],
    required: true
  },
  metrics: {
    totalRooms: Number,
    roomsSold: Number,
    occupancyRate: Number,
    averageDailyRate: Number,
    revPAR: Number, // Revenue per Available Room
    leadTime: Number, // Average booking lead time in days
    bookingPace: Number, // Bookings in last 24 hours
    demandScore: Number // 0-100 score
  },
  forecast: {
    expectedOccupancy: Number,
    recommendedRate: Number,
    confidenceScore: Number
  },
  competitors: [{
    hotelName: String,
    rate: Number,
    availability: String
  }],
  calculatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Package Schema
const packageSchema = new mongoose.Schema({
  packageId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['romantic', 'family', 'business', 'leisure', 'wellness', 'adventure'],
    required: true
  },
  inclusions: [{
    item: String,
    quantity: Number,
    value: Number
  }],
  pricing: {
    basePrice: Number,
    additionalGuestPrice: Number,
    childPrice: Number,
    // Multi-currency pricing
    baseCurrency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'USD',
      ref: 'Currency'
    },
    currencyPrices: [{
      currency: {
        type: String,
        required: true,
        uppercase: true,
        ref: 'Currency'
      },
      basePrice: Number,
      additionalGuestPrice: Number,
      childPrice: Number,
      lastUpdated: {
        type: Date,
        default: Date.now
      },
      source: {
        type: String,
        enum: ['manual', 'auto_conversion'],
        default: 'auto_conversion'
      }
    }]
  },
  validity: {
    startDate: Date,
    endDate: Date,
    blackoutDates: [Date]
  },
  terms: [String],
  images: [String],
  minStay: {
    type: Number,
    default: 1
  },
  maxGuests: {
    type: Number,
    default: 2
  },
  bookingWindow: {
    minAdvanceBooking: Number, // hours
    maxAdvanceBooking: Number // days
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Create indexes for better performance
ratePlanSchema.index({ planId: 1, isActive: 1 });
ratePlanSchema.index({ type: 1, isActive: 1 });
ratePlanSchema.index({ 'validity.startDate': 1, 'validity.endDate': 1 });

seasonalRateSchema.index({ startDate: 1, endDate: 1, isActive: 1 });
seasonalRateSchema.index({ seasonId: 1 });

dynamicPricingSchema.index({ type: 1, isActive: 1 });
dynamicPricingSchema.index({ priority: -1 });

rateOverrideSchema.index({ date: 1, roomType: 1, isActive: 1 });
rateOverrideSchema.index({ ratePlanId: 1 });

yieldManagementSchema.index({ date: 1, roomType: 1 });
yieldManagementSchema.index({ calculatedAt: -1 });

packageSchema.index({ packageId: 1, isActive: 1 });
packageSchema.index({ type: 1, isActive: 1 });

// Export models with duplicate check
export const RatePlan = mongoose.models.RatePlan || mongoose.model('RatePlan', ratePlanSchema);
export const SeasonalRate = mongoose.models.SeasonalRate || mongoose.model('SeasonalRate', seasonalRateSchema);
export const DynamicPricing = mongoose.models.DynamicPricing || mongoose.model('DynamicPricing', dynamicPricingSchema);
export const RateOverride = mongoose.models.RateOverride || mongoose.model('RateOverride', rateOverrideSchema);
export const YieldManagement = mongoose.models.YieldManagement || mongoose.model('YieldManagement', yieldManagementSchema);
export const Package = mongoose.models.Package || mongoose.model('Package', packageSchema);
