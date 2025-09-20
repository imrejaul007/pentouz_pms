import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
  channelId: {
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
    enum: ['ota', 'gds', 'direct', 'metasearch', 'wholesaler', 'corporate'],
    required: true
  },
  category: {
    type: String,
    enum: ['booking.com', 'expedia', 'airbnb', 'amadeus', 'sabre', 'galileo', 'google', 'tripadvisor', 'agoda', 'hotels.com'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  connectionStatus: {
    type: String,
    enum: ['connected', 'disconnected', 'error', 'pending'],
    default: 'pending'
  },
  credentials: {
    apiKey: String,
    apiSecret: String,
    hotelId: String,
    username: String,
    password: String,
    endpoint: String,
    clientId: String,
    accountId: String
  },
  settings: {
    autoSync: { type: Boolean, default: true },
    syncFrequency: { type: Number, default: 15 }, // minutes
    enableRateSync: { type: Boolean, default: true },
    enableInventorySync: { type: Boolean, default: true },
    enableRestrictionSync: { type: Boolean, default: true },
    commission: { type: Number, default: 15 }, // percentage
    currency: { type: String, default: 'INR' },
    defaultLeadTime: { type: Number, default: 0 }, // days
    maxLeadTime: { type: Number, default: 365 },
    minLengthOfStay: { type: Number, default: 1 },
    maxLengthOfStay: { type: Number, default: 30 }
  },
  roomMappings: [{
    hotelRoomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomType'
    },
    channelRoomTypeId: String,
    channelRoomTypeName: String,
    ratePlanMappings: [{
      hotelRatePlanId: String,
      channelRatePlanId: String,
      channelRatePlanName: String
    }]
  }],
  rateParity: {
    enabled: { type: Boolean, default: false },
    variance: { type: Number, default: 0 }, // percentage allowed variance
    baseChannel: String // channel to use as base for parity
  },
  restrictions: {
    closeToArrival: { type: Boolean, default: false },
    closeToDeparture: { type: Boolean, default: false },
    minAdvanceBooking: { type: Number, default: 0 },
    maxAdvanceBooking: { type: Number, default: 365 }
  },
  lastSync: {
    rates: Date,
    inventory: Date,
    restrictions: Date,
    reservations: Date
  },
  metrics: {
    totalBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    averageRate: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

const inventorySyncSchema = new mongoose.Schema({
  syncId: {
    type: String,
    required: true,
    unique: true
  },
  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: true
  },
  roomType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomType',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  inventory: {
    available: { type: Number, required: true },
    sold: { type: Number, default: 0 },
    blocked: { type: Number, default: 0 },
    overbooking: { type: Number, default: 0 }
  },
  rates: {
    baseRate: { type: Number, required: true },
    sellingRate: { type: Number, required: true },
    currency: { type: String, default: 'INR' }
  },
  restrictions: {
    closed: { type: Boolean, default: false },
    closeToArrival: { type: Boolean, default: false },
    closeToDeparture: { type: Boolean, default: false },
    minLengthOfStay: { type: Number, default: 1 },
    maxLengthOfStay: { type: Number, default: 30 }
  },
  syncStatus: {
    type: String,
    enum: ['pending', 'success', 'failed', 'retry'],
    default: 'pending'
  },
  syncAttempts: {
    type: Number,
    default: 0
  },
  lastSyncAttempt: Date,
  errorMessage: String
}, {
  timestamps: true
});

const reservationMappingSchema = new mongoose.Schema({
  mappingId: {
    type: String,
    required: true,
    unique: true
  },
  hotelReservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  channelReservationId: {
    type: String,
    required: true
  },
  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: true
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled', 'modified', 'no_show'],
    default: 'confirmed'
  },
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'failed'],
    default: 'synced'
  },
  modifications: [{
    type: String,
    timestamp: Date,
    details: String
  }]
}, {
  timestamps: true
});

const ratePurityLogSchema = new mongoose.Schema({
  logId: {
    type: String,
    required: true,
    unique: true
  },
  roomType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomType',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  baseRate: {
    type: Number,
    required: true
  },
  channelRates: [{
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel'
    },
    rate: Number,
    variance: Number, // percentage difference from base
    compliant: Boolean
  }],
  violations: [{
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel'
    },
    violationType: String,
    expectedRate: Number,
    actualRate: Number,
    variance: Number
  }],
  overallCompliance: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const channelPerformanceSchema = new mongoose.Schema({
  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  metrics: {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    bookings: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    netRevenue: { type: Number, default: 0 },
    averageRate: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    clickThroughRate: { type: Number, default: 0 }
  },
  roomTypeBreakdown: [{
    roomType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomType'
    },
    bookings: Number,
    revenue: Number,
    averageRate: Number
  }]
}, {
  timestamps: true
});

const overbookingRuleSchema = new mongoose.Schema({
  ruleId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  roomType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomType',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rules: {
    maxOverbookingPercent: { type: Number, default: 10 },
    seasonalAdjustments: [{
      startDate: Date,
      endDate: Date,
      adjustment: Number
    }],
    dayOfWeekAdjustments: [{
      day: String,
      adjustment: Number
    }],
    leadTimeAdjustments: [{
      minDays: Number,
      maxDays: Number,
      adjustment: Number
    }]
  },
  channels: [{
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel'
    },
    enabled: Boolean,
    maxOverbooking: Number
  }],
  fallbackActions: {
    enableUpsell: { type: Boolean, default: true },
    enableWalkIn: { type: Boolean, default: false },
    notifyManagement: { type: Boolean, default: true },
    autoRelocate: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

const Channel = mongoose.model('Channel', channelSchema);
const InventorySync = mongoose.model('InventorySync', inventorySyncSchema);
const ReservationMapping = mongoose.model('ReservationMapping', reservationMappingSchema);
const RatePurityLog = mongoose.model('RatePurityLog', ratePurityLogSchema);
const ChannelPerformance = mongoose.model('ChannelPerformance', channelPerformanceSchema);
const OverbookingRule = mongoose.model('OverbookingRule', overbookingRuleSchema);

export {
  Channel,
  InventorySync,
  ReservationMapping,
  RatePurityLog,
  ChannelPerformance,
  OverbookingRule
};
