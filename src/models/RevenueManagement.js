import mongoose from 'mongoose';

const pricingRuleSchema = new mongoose.Schema({
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
    enum: ['occupancy_based', 'day_of_week', 'seasonal', 'length_of_stay', 'geographic', 'demand_based', 'competitor_based'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 1
  },
  conditions: {
    occupancyThresholds: [{
      minOccupancy: Number,
      maxOccupancy: Number,
      adjustment: Number, // percentage
      adjustmentType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' }
    }],
    daysOfWeek: [{
      day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
      adjustment: Number
    }],
    seasonalPeriods: [{
      name: String,
      startDate: Date,
      endDate: Date,
      adjustment: Number,
      adjustmentType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' }
    }],
    lengthOfStay: [{
      minNights: Number,
      maxNights: Number,
      adjustment: Number
    }],
    geographicRules: [{
      country: String,
      state: String,
      city: String,
      adjustment: Number
    }],
    demandFactors: {
      bookingVelocity: Number, // bookings per day threshold
      advanceBooking: Number, // days in advance
      cancellationRate: Number // percentage
    }
  },
  applicableRoomTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomType'
  }],
  dateRange: {
    startDate: Date,
    endDate: Date
  }
}, {
  timestamps: true
});

const rateShoppingSchema = new mongoose.Schema({
  competitorId: {
    type: String,
    required: true
  },
  competitorName: {
    type: String,
    required: true
  },
  url: String,
  roomType: String,
  checkInDate: Date,
  checkOutDate: Date,
  rates: [{
    date: Date,
    rate: Number,
    currency: String,
    availability: Boolean,
    lastUpdated: Date
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const demandForecastSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  roomType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomType'
  },
  predictedDemand: {
    type: Number,
    required: true
  },
  predictedOccupancy: {
    type: Number,
    required: true
  },
  recommendedRate: {
    type: Number,
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100
  },
  factors: {
    historicalBookings: Number,
    seasonality: Number,
    events: [String],
    weatherForecast: String,
    competitorRates: Number
  }
}, {
  timestamps: true
});

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
    enum: ['room_only', 'bed_breakfast', 'half_board', 'full_board', 'all_inclusive', 'spa', 'golf', 'business'],
    required: true
  },
  baseRate: {
    type: Number,
    required: true
  },
  inclusions: [{
    service: String,
    description: String,
    value: Number
  }],
  roomTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomType'
  }],
  validDates: {
    startDate: Date,
    endDate: Date
  },
  bookingWindow: {
    minAdvance: Number, // days
    maxAdvance: Number
  },
  lengthOfStay: {
    minNights: Number,
    maxNights: Number
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const corporateRateSchema = new mongoose.Schema({
  contractId: {
    type: String,
    required: true,
    unique: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporateCompany',
    required: true
  },
  rateType: {
    type: String,
    enum: ['corporate', 'government', 'group', 'confidential'],
    required: true
  },
  rateDetails: {
    baseRate: Number,
    discount: Number,
    discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' }
  },
  roomTypes: [{
    roomType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomType'
    },
    rate: Number,
    discount: Number
  }],
  validPeriod: {
    startDate: Date,
    endDate: Date
  },
  bookingLimits: {
    maxRoomsPerBooking: Number,
    maxRoomsPerNight: Number,
    totalRoomNights: Number
  },
  paymentTerms: {
    creditLimit: Number,
    paymentDays: Number,
    requiresApproval: Boolean
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const revenueAnalyticsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  roomType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomType'
  },
  metrics: {
    adr: Number, // Average Daily Rate
    revpar: Number, // Revenue Per Available Room
    occupancy: Number,
    revenue: Number,
    roomsSold: Number,
    roomsAvailable: Number
  },
  channels: [{
    channel: String,
    bookings: Number,
    revenue: Number,
    adr: Number
  }],
  segments: [{
    segment: String, // leisure, business, group, etc.
    bookings: Number,
    revenue: Number,
    adr: Number
  }]
}, {
  timestamps: true
});

const PricingRule = mongoose.models.PricingRule || mongoose.model('PricingRule', pricingRuleSchema);
const RateShopping = mongoose.models.RateShopping || mongoose.model('RateShopping', rateShoppingSchema);
const DemandForecast = mongoose.models.DemandForecast || mongoose.model('DemandForecast', demandForecastSchema);
const Package = mongoose.models.Package || mongoose.model('Package', packageSchema);
const CorporateRate = mongoose.models.CorporateRate || mongoose.model('CorporateRate', corporateRateSchema);
const RevenueAnalytics = mongoose.models.RevenueAnalytics || mongoose.model('RevenueAnalytics', revenueAnalyticsSchema);

export {
  PricingRule,
  RateShopping,
  DemandForecast,
  Package,
  CorporateRate,
  RevenueAnalytics
};
