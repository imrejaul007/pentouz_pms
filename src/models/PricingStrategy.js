import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     PricingStrategy:
 *       type: object
 *       properties:
 *         strategyId:
 *           type: string
 *           description: Unique strategy identifier
 *         name:
 *           type: string
 *         type:
 *           type: string
 *           enum: [dynamic, fixed, seasonal, event_based, competitor_based]
 *         isActive:
 *           type: boolean
 *         priority:
 *           type: number
 */

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
  description: String,
  conditions: {
    // Date-based conditions
    dateRange: {
      startDate: Date,
      endDate: Date
    },
    daysOfWeek: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    leadTime: {
      minDays: Number,
      maxDays: Number
    },
    // Occupancy-based conditions
    occupancyThreshold: {
      min: { type: Number, min: 0, max: 100 },
      max: { type: Number, min: 0, max: 100 }
    },
    // Market conditions
    seasonType: {
      type: String,
      enum: ['low', 'shoulder', 'high', 'peak']
    },
    // Booking patterns
    bookingWindow: {
      minHours: Number,
      maxHours: Number
    }
  },
  adjustments: {
    type: {
      type: String,
      enum: ['percentage', 'fixed_amount', 'set_rate'],
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    minRate: Number, // Minimum rate floor
    maxRate: Number, // Maximum rate ceiling
    roundingRule: {
      type: String,
      enum: ['none', 'round_up', 'round_down', 'round_nearest'],
      default: 'round_nearest'
    }
  },
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

const pricingStrategySchema = new mongoose.Schema({
  strategyId: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['dynamic', 'fixed', 'seasonal', 'event_based', 'competitor_based', 'demand_based'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0
  },
  // Room type assignments
  roomTypes: [{
    roomTypeId: {
      type: mongoose.Schema.ObjectId,
      ref: 'RoomType',
      required: true
    },
    baseRate: {
      type: Number,
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    }
  }],
  // Pricing rules
  rules: [pricingRuleSchema],
  // Dynamic pricing configuration
  dynamicPricing: {
    enabled: {
      type: Boolean,
      default: false
    },
    algorithm: {
      type: String,
      enum: ['occupancy_based', 'demand_based', 'competitor_based', 'hybrid'],
      default: 'occupancy_based'
    },
    updateFrequency: {
      type: Number,
      default: 60 // minutes
    },
    maxVariation: {
      increase: { type: Number, default: 50 }, // max % increase
      decrease: { type: Number, default: 30 }  // max % decrease
    },
    factors: {
      occupancyWeight: { type: Number, default: 0.4 },
      demandWeight: { type: Number, default: 0.3 },
      competitorWeight: { type: Number, default: 0.2 },
      seasonalWeight: { type: Number, default: 0.1 }
    }
  },
  // Competitor monitoring
  competitorTracking: {
    enabled: {
      type: Boolean,
      default: false
    },
    competitors: [{
      name: String,
      url: String,
      priority: { type: Number, default: 1 },
      isActive: { type: Boolean, default: true }
    }],
    adjustmentRules: {
      matchCompetitors: { type: Boolean, default: false },
      undercut: {
        enabled: { type: Boolean, default: false },
        percentage: { type: Number, default: 5 }
      },
      premium: {
        enabled: { type: Boolean, default: false },
        percentage: { type: Number, default: 10 }
      }
    }
  },
  // Performance tracking
  performance: {
    totalRevenue: { type: Number, default: 0 },
    averageRate: { type: Number, default: 0 },
    occupancyRate: { type: Number, default: 0 },
    revPAR: { type: Number, default: 0 },
    lastCalculated: Date
  },
  // Constraints and limits
  constraints: {
    minRate: {
      type: Number,
      required: true
    },
    maxRate: {
      type: Number,
      required: true
    },
    maxDailyChanges: {
      type: Number,
      default: 3
    },
    changeThreshold: {
      type: Number,
      default: 5 // minimum % change to update rates
    }
  },
  // Audit and history
  lastUpdate: {
    timestamp: Date,
    triggeredBy: String,
    previousRate: Number,
    newRate: Number,
    reason: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
pricingStrategySchema.index({ hotelId: 1, isActive: 1 });
pricingStrategySchema.index({ 'roomTypes.roomTypeId': 1 });
pricingStrategySchema.index({ type: 1, isActive: 1 });

// Pre-save hook to generate strategy ID
pricingStrategySchema.pre('save', function(next) {
  if (!this.strategyId) {
    const timestamp = Date.now();
    const hotelCode = this.hotelId.toString().slice(-6).toUpperCase();
    const typeCode = this.type.toUpperCase().substring(0, 3);
    this.strategyId = `PS_${hotelCode}_${typeCode}_${timestamp}`;
  }
  next();
});

// Instance methods
pricingStrategySchema.methods.calculateRate = async function(roomTypeId, date, currentOccupancy = 0) {
  const roomType = this.roomTypes.find(rt => rt.roomTypeId.toString() === roomTypeId.toString());
  if (!roomType || !roomType.enabled) {
    return null;
  }

  let finalRate = roomType.baseRate;

  // Apply pricing rules in priority order
  const applicableRules = this.rules
    .filter(rule => rule.isActive && this.isRuleApplicable(rule, date, currentOccupancy))
    .sort((a, b) => b.priority - a.priority);

  for (const rule of applicableRules) {
    finalRate = this.applyRuleAdjustment(finalRate, rule.adjustments);
  }

  // Apply constraints
  finalRate = Math.max(this.constraints.minRate, Math.min(this.constraints.maxRate, finalRate));

  return Math.round(finalRate);
};

pricingStrategySchema.methods.isRuleApplicable = function(rule, date, occupancy) {
  const conditions = rule.conditions;

  // Check date range
  if (conditions.dateRange) {
    if (date < conditions.dateRange.startDate || date > conditions.dateRange.endDate) {
      return false;
    }
  }

  // Check day of week
  if (conditions.daysOfWeek && conditions.daysOfWeek.length > 0) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[date.getDay()];
    if (!conditions.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }
  }

  // Check occupancy threshold
  if (conditions.occupancyThreshold) {
    if (occupancy < conditions.occupancyThreshold.min || occupancy > conditions.occupancyThreshold.max) {
      return false;
    }
  }

  // Check lead time
  if (conditions.leadTime) {
    const now = new Date();
    const daysDifference = Math.floor((date - now) / (1000 * 60 * 60 * 24));
    if (daysDifference < conditions.leadTime.minDays || daysDifference > conditions.leadTime.maxDays) {
      return false;
    }
  }

  return true;
};

pricingStrategySchema.methods.applyRuleAdjustment = function(currentRate, adjustment) {
  let newRate = currentRate;

  switch (adjustment.type) {
    case 'percentage':
      newRate = currentRate * (1 + adjustment.value / 100);
      break;
    case 'fixed_amount':
      newRate = currentRate + adjustment.value;
      break;
    case 'set_rate':
      newRate = adjustment.value;
      break;
  }

  // Apply min/max for this rule
  if (adjustment.minRate) {
    newRate = Math.max(newRate, adjustment.minRate);
  }
  if (adjustment.maxRate) {
    newRate = Math.min(newRate, adjustment.maxRate);
  }

  // Apply rounding
  switch (adjustment.roundingRule) {
    case 'round_up':
      newRate = Math.ceil(newRate);
      break;
    case 'round_down':
      newRate = Math.floor(newRate);
      break;
    case 'round_nearest':
      newRate = Math.round(newRate);
      break;
  }

  return newRate;
};

// Static methods
pricingStrategySchema.statics.getActiveStrategies = async function(hotelId) {
  return this.find({ hotelId, isActive: true })
    .populate('roomTypes.roomTypeId')
    .sort({ priority: -1 });
};

pricingStrategySchema.statics.calculateOptimalRates = async function(hotelId, date) {
  const strategies = await this.getActiveStrategies(hotelId);
  const RoomAvailability = mongoose.model('RoomAvailability');
  
  const rates = [];

  for (const strategy of strategies) {
    for (const roomTypeConfig of strategy.roomTypes) {
      if (!roomTypeConfig.enabled) continue;

      // Get current occupancy for this room type
      const availability = await RoomAvailability.findOne({
        hotelId,
        roomTypeId: roomTypeConfig.roomTypeId,
        date
      });

      const currentOccupancy = availability ? 
        ((availability.soldRooms / availability.totalRooms) * 100) : 0;

      const calculatedRate = await strategy.calculateRate(
        roomTypeConfig.roomTypeId,
        date,
        currentOccupancy
      );

      if (calculatedRate) {
        rates.push({
          strategyId: strategy.strategyId,
          strategyName: strategy.name,
          roomTypeId: roomTypeConfig.roomTypeId,
          date,
          calculatedRate,
          currentOccupancy
        });
      }
    }
  }

  return rates;
};

export default mongoose.model('PricingStrategy', pricingStrategySchema);
