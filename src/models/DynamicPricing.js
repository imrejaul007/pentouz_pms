import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     DynamicPricing:
 *       type: object
 *       required:
 *         - name
 *         - algorithm
 *         - isActive
 *       properties:
 *         _id:
 *           type: string
 *           description: Dynamic pricing rule ID
 *         name:
 *           type: string
 *           description: Pricing rule name
 *         description:
 *           type: string
 *           description: Pricing rule description
 *         algorithm:
 *           type: string
 *           enum: [demand_based, competitor_based, time_based, event_based, seasonal, occupancy_based, hybrid]
 *           description: Pricing algorithm type
 *         category:
 *           type: string
 *           enum: [room_rate, service_rate, package_rate, addon_rate, other]
 *           description: What this pricing rule applies to
 *         targetRoomTypes:
 *           type: array
 *           items:
 *             type: string
 *           description: Room types this rule applies to
 *         basePrice:
 *           type: number
 *           description: Base price for calculations
 *         minPrice:
 *           type: number
 *           description: Minimum price allowed
 *         maxPrice:
 *           type: number
 *           description: Maximum price allowed
 *         priceAdjustment:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [percentage, fixed_amount, multiplier]
 *             value:
 *               type: number
 *             conditions:
 *               type: array
 *               items:
 *                 type: object
 *         demandFactors:
 *           type: object
 *           properties:
 *             occupancyThreshold:
 *               type: number
 *             bookingVelocity:
 *               type: number
 *             leadTime:
 *               type: number
 *             dayOfWeek:
 *               type: array
 *               items:
 *                 type: string
 *             seasonality:
 *               type: object
 *         competitorFactors:
 *           type: object
 *           properties:
 *             competitorSources:
 *               type: array
 *               items:
 *                 type: string
 *             priceComparison:
 *               type: string
 *               enum: [match, below, above, percentage_below, percentage_above]
 *             updateFrequency:
 *               type: string
 *               enum: [real_time, hourly, daily, weekly]
 *         timeFactors:
 *           type: object
 *           properties:
 *             advanceBookingDays:
 *               type: number
 *             lastMinuteDays:
 *               type: number
 *             peakHours:
 *               type: array
 *               items:
 *                 type: string
 *             offPeakHours:
 *               type: array
 *               items:
 *                 type: string
 *         eventFactors:
 *           type: object
 *           properties:
 *             eventTypes:
 *               type: array
 *               items:
 *                 type: string
 *             eventRadius:
 *               type: number
 *             priceMultiplier:
 *               type: number
 *         seasonalFactors:
 *           type: object
 *           properties:
 *             seasons:
 *               type: array
 *               items:
 *                 type: string
 *             seasonalMultipliers:
 *               type: object
 *         occupancyFactors:
 *           type: object
 *           properties:
 *             lowOccupancyThreshold:
 *               type: number
 *             highOccupancyThreshold:
 *               type: number
 *             lowOccupancyAdjustment:
 *               type: number
 *             highOccupancyAdjustment:
 *               type: number
 *         automation:
 *           type: object
 *           properties:
 *             isAutomated:
 *               type: boolean
 *             updateFrequency:
 *               type: string
 *               enum: [real_time, hourly, daily, weekly, monthly]
 *             requiresApproval:
 *               type: boolean
 *             maxPriceChange:
 *               type: number
 *         performance:
 *           type: object
 *           properties:
 *             totalRevenue:
 *               type: number
 *             totalBookings:
 *               type: number
 *             averagePrice:
 *               type: number
 *             priceVariance:
 *               type: number
 *             conversionRate:
 *               type: number
 *             lastOptimized:
 *               type: string
 *               format: date-time
 *         isActive:
 *           type: boolean
 *           description: Whether the pricing rule is active
 *         priority:
 *           type: number
 *           description: Priority for rule application (higher = applied first)
 *         hotelId:
 *           type: string
 *           description: Hotel ID this rule belongs to
 *         createdBy:
 *           type: string
 *           description: User who created this rule
 *         updatedBy:
 *           type: string
 *           description: User who last updated this rule
 */

const dynamicPricingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Pricing rule name is required'],
    trim: true,
    maxLength: [200, 'Pricing rule name cannot exceed 200 characters'],
    index: true
  },
  description: {
    type: String,
    maxLength: [1000, 'Description cannot exceed 1000 characters']
  },
  algorithm: {
    type: String,
    required: [true, 'Algorithm type is required'],
    enum: [
      'demand_based', 'competitor_based', 'time_based', 'event_based', 
      'seasonal', 'occupancy_based', 'hybrid'
    ],
    index: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['room_rate', 'service_rate', 'package_rate', 'addon_rate', 'other'],
    index: true
  },
  targetRoomTypes: [{
    type: mongoose.Schema.ObjectId,
    ref: 'RoomType'
  }],
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: [0, 'Base price cannot be negative']
  },
  minPrice: {
    type: Number,
    min: [0, 'Minimum price cannot be negative']
  },
  maxPrice: {
    type: Number,
    min: [0, 'Maximum price cannot be negative']
  },
  priceAdjustment: {
    type: {
      type: String,
      enum: ['percentage', 'fixed_amount', 'multiplier'],
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    conditions: [{
      factor: {
        type: String,
        enum: ['occupancy', 'demand', 'competitor', 'time', 'event', 'season']
      },
      operator: {
        type: String,
        enum: ['greater_than', 'less_than', 'equals', 'between']
      },
      threshold: Number,
      threshold2: Number // For 'between' operator
    }]
  },
  demandFactors: {
    occupancyThreshold: {
      type: Number,
      min: [0, 'Occupancy threshold cannot be negative'],
      max: [100, 'Occupancy threshold cannot exceed 100']
    },
    bookingVelocity: {
      type: Number,
      min: [0, 'Booking velocity cannot be negative']
    },
    leadTime: {
      type: Number,
      min: [0, 'Lead time cannot be negative']
    },
    dayOfWeek: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    seasonality: {
      peakSeasonMultiplier: {
        type: Number,
        min: [0.1, 'Peak season multiplier must be at least 0.1'],
        max: [5, 'Peak season multiplier cannot exceed 5']
      },
      offSeasonMultiplier: {
        type: Number,
        min: [0.1, 'Off season multiplier must be at least 0.1'],
        max: [2, 'Off season multiplier cannot exceed 2']
      }
    }
  },
  competitorFactors: {
    competitorSources: [{
      type: String,
      enum: ['booking_com', 'expedia', 'hotels_com', 'agoda', 'tripadvisor', 'direct']
    }],
    priceComparison: {
      type: String,
      enum: ['match', 'below', 'above', 'percentage_below', 'percentage_above']
    },
    updateFrequency: {
      type: String,
      enum: ['real_time', 'hourly', 'daily', 'weekly']
    },
    competitiveMargin: {
      type: Number,
      min: [-50, 'Competitive margin cannot be less than -50%'],
      max: [50, 'Competitive margin cannot exceed 50%']
    }
  },
  timeFactors: {
    advanceBookingDays: {
      type: Number,
      min: [0, 'Advance booking days cannot be negative']
    },
    lastMinuteDays: {
      type: Number,
      min: [0, 'Last minute days cannot be negative']
    },
    peakHours: [{
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    }],
    offPeakHours: [{
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    }],
    timeBasedMultipliers: {
      earlyBird: {
        type: Number,
        min: [0.1, 'Early bird multiplier must be at least 0.1'],
        max: [2, 'Early bird multiplier cannot exceed 2']
      },
      lastMinute: {
        type: Number,
        min: [0.1, 'Last minute multiplier must be at least 0.1'],
        max: [3, 'Last minute multiplier cannot exceed 3']
      }
    }
  },
  eventFactors: {
    eventTypes: [{
      type: String,
      enum: ['conference', 'wedding', 'sports', 'festival', 'holiday', 'corporate', 'other']
    }],
    eventRadius: {
      type: Number,
      min: [1, 'Event radius must be at least 1 km']
    },
    priceMultiplier: {
      type: Number,
      min: [0.1, 'Event price multiplier must be at least 0.1'],
      max: [5, 'Event price multiplier cannot exceed 5']
    },
    eventLeadTime: {
      type: Number,
      min: [0, 'Event lead time cannot be negative']
    }
  },
  seasonalFactors: {
    seasons: [{
      type: String,
      enum: ['spring', 'summer', 'autumn', 'winter', 'holiday', 'off_season']
    }],
    seasonalMultipliers: {
      spring: {
        type: Number,
        min: [0.1, 'Spring multiplier must be at least 0.1'],
        max: [3, 'Spring multiplier cannot exceed 3']
      },
      summer: {
        type: Number,
        min: [0.1, 'Summer multiplier must be at least 0.1'],
        max: [3, 'Summer multiplier cannot exceed 3']
      },
      autumn: {
        type: Number,
        min: [0.1, 'Autumn multiplier must be at least 0.1'],
        max: [3, 'Autumn multiplier cannot exceed 3']
      },
      winter: {
        type: Number,
        min: [0.1, 'Winter multiplier must be at least 0.1'],
        max: [3, 'Winter multiplier cannot exceed 3']
      },
      holiday: {
        type: Number,
        min: [0.1, 'Holiday multiplier must be at least 0.1'],
        max: [5, 'Holiday multiplier cannot exceed 5']
      },
      off_season: {
        type: Number,
        min: [0.1, 'Off season multiplier must be at least 0.1'],
        max: [2, 'Off season multiplier cannot exceed 2']
      }
    }
  },
  occupancyFactors: {
    lowOccupancyThreshold: {
      type: Number,
      min: [0, 'Low occupancy threshold cannot be negative'],
      max: [100, 'Low occupancy threshold cannot exceed 100']
    },
    highOccupancyThreshold: {
      type: Number,
      min: [0, 'High occupancy threshold cannot be negative'],
      max: [100, 'High occupancy threshold cannot exceed 100']
    },
    lowOccupancyAdjustment: {
      type: Number,
      min: [-50, 'Low occupancy adjustment cannot be less than -50%'],
      max: [0, 'Low occupancy adjustment cannot be positive']
    },
    highOccupancyAdjustment: {
      type: Number,
      min: [0, 'High occupancy adjustment cannot be negative'],
      max: [100, 'High occupancy adjustment cannot exceed 100%']
    }
  },
  automation: {
    isAutomated: {
      type: Boolean,
      default: false
    },
    updateFrequency: {
      type: String,
      enum: ['real_time', 'hourly', 'daily', 'weekly', 'monthly'],
      default: 'daily'
    },
    requiresApproval: {
      type: Boolean,
      default: true
    },
    maxPriceChange: {
      type: Number,
      min: [0, 'Maximum price change cannot be negative'],
      max: [100, 'Maximum price change cannot exceed 100%']
    },
    autoOptimization: {
      type: Boolean,
      default: false
    }
  },
  performance: {
    totalRevenue: {
      type: Number,
      default: 0
    },
    totalBookings: {
      type: Number,
      default: 0
    },
    averagePrice: {
      type: Number,
      default: 0
    },
    priceVariance: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0,
      min: [0, 'Conversion rate cannot be negative'],
      max: [100, 'Conversion rate cannot exceed 100']
    },
    lastOptimized: {
      type: Date
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  priority: {
    type: Number,
    default: 0,
    index: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
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
dynamicPricingSchema.index({ hotelId: 1, algorithm: 1 });
dynamicPricingSchema.index({ hotelId: 1, category: 1 });
dynamicPricingSchema.index({ hotelId: 1, isActive: 1 });
dynamicPricingSchema.index({ hotelId: 1, priority: -1 });

// Virtual for price range
dynamicPricingSchema.virtual('priceRange').get(function() {
  const min = this.minPrice || this.basePrice * 0.5;
  const max = this.maxPrice || this.basePrice * 2;
  return { min, max };
});

// Virtual for adjustment summary
dynamicPricingSchema.virtual('adjustmentSummary').get(function() {
  const { type, value } = this.priceAdjustment;
  if (type === 'percentage') {
    return `${value > 0 ? '+' : ''}${value}%`;
  } else if (type === 'fixed_amount') {
    return `${value > 0 ? '+' : ''}$${value}`;
  } else if (type === 'multiplier') {
    return `×${value}`;
  }
  return 'No adjustment';
});

// Instance methods
dynamicPricingSchema.methods.calculatePrice = function(context) {
  let price = this.basePrice;
  
  // Apply base adjustment
  if (this.priceAdjustment.type === 'percentage') {
    price = price * (1 + this.priceAdjustment.value / 100);
  } else if (this.priceAdjustment.type === 'fixed_amount') {
    price = price + this.priceAdjustment.value;
  } else if (this.priceAdjustment.type === 'multiplier') {
    price = price * this.priceAdjustment.value;
  }
  
  // Apply demand factors
  if (this.demandFactors && context.occupancy) {
    if (context.occupancy > this.demandFactors.occupancyThreshold) {
      price = price * 1.1; // 10% increase for high occupancy
    }
  }
  
  // Apply time factors
  if (this.timeFactors && context.advanceBookingDays) {
    if (context.advanceBookingDays > this.timeFactors.advanceBookingDays) {
      price = price * this.timeFactors.timeBasedMultipliers.earlyBird;
    } else if (context.advanceBookingDays < this.timeFactors.lastMinuteDays) {
      price = price * this.timeFactors.timeBasedMultipliers.lastMinute;
    }
  }
  
  // Apply seasonal factors
  if (this.seasonalFactors && context.season) {
    const multiplier = this.seasonalFactors.seasonalMultipliers[context.season];
    if (multiplier) {
      price = price * multiplier;
    }
  }
  
  // Apply occupancy factors
  if (this.occupancyFactors && context.occupancy) {
    if (context.occupancy < this.occupancyFactors.lowOccupancyThreshold) {
      price = price * (1 + this.occupancyFactors.lowOccupancyAdjustment / 100);
    } else if (context.occupancy > this.occupancyFactors.highOccupancyThreshold) {
      price = price * (1 + this.occupancyFactors.highOccupancyAdjustment / 100);
    }
  }
  
  // Apply min/max constraints
  if (this.minPrice) {
    price = Math.max(price, this.minPrice);
  }
  if (this.maxPrice) {
    price = Math.min(price, this.maxPrice);
  }
  
  return Math.round(price * 100) / 100; // Round to 2 decimal places
};

dynamicPricingSchema.methods.isApplicable = function(context) {
  // Check if rule is active
  if (!this.isActive) return false;
  
  // Check room type applicability
  if (this.targetRoomTypes.length > 0) {
    if (!context.roomTypes.some(roomType => 
      this.targetRoomTypes.includes(roomType)
    )) {
      return false;
    }
  }
  
  // Check day of week applicability
  if (this.demandFactors.dayOfWeek.length > 0) {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    if (!this.demandFactors.dayOfWeek.includes(today)) {
      return false;
    }
  }
  
  return true;
};

dynamicPricingSchema.methods.updatePerformance = function(bookingValue, bookingCount) {
  this.performance.totalRevenue += bookingValue;
  this.performance.totalBookings += bookingCount;
  this.performance.averagePrice = this.performance.totalRevenue / this.performance.totalBookings;
  this.performance.lastOptimized = new Date();
  
  return this.save();
};

// Static methods
dynamicPricingSchema.statics.getByAlgorithm = function(hotelId, algorithm) {
  return this.find({ hotelId, algorithm, isActive: true })
    .sort({ priority: -1, createdAt: -1 })
    .populate('createdBy updatedBy', 'name email');
};

dynamicPricingSchema.statics.getActiveRules = function(hotelId) {
  return this.find({ hotelId, isActive: true })
    .sort({ priority: -1, createdAt: -1 });
};

dynamicPricingSchema.statics.getApplicableRules = function(hotelId, context) {
  return this.getActiveRules(hotelId).then(rules => {
    return rules.filter(rule => rule.isApplicable(context));
  });
};

dynamicPricingSchema.statics.getPricingAnalytics = function(hotelId, dateRange) {
  const pipeline = [
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$algorithm',
        totalRules: { $sum: 1 },
        activeRules: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        totalRevenue: { $sum: '$performance.totalRevenue' },
        totalBookings: { $sum: '$performance.totalBookings' },
        avgConversionRate: { $avg: '$performance.conversionRate' },
        avgPriceVariance: { $avg: '$performance.priceVariance' }
      }
    },
    { $sort: { _id: 1 } }
  ];

  return this.aggregate(pipeline);
};

// Pre-save middleware
dynamicPricingSchema.pre('save', function(next) {
  // Validate price constraints
  if (this.minPrice && this.maxPrice && this.minPrice > this.maxPrice) {
    return next(new Error('Minimum price cannot be greater than maximum price'));
  }

  if (this.basePrice < 0) {
    return next(new Error('Base price cannot be negative'));
  }

  // Validate occupancy thresholds
  if (this.occupancyFactors.lowOccupancyThreshold && this.occupancyFactors.highOccupancyThreshold) {
    if (this.occupancyFactors.lowOccupancyThreshold > this.occupancyFactors.highOccupancyThreshold) {
      return next(new Error('Low occupancy threshold cannot be greater than high occupancy threshold'));
    }
  }

  // Validate adjustment value based on type
  if (this.priceAdjustment.type === 'percentage' && Math.abs(this.priceAdjustment.value) > 100) {
    return next(new Error('Percentage adjustment cannot exceed 100%'));
  }

  if (this.priceAdjustment.type === 'multiplier' && this.priceAdjustment.value <= 0) {
    return next(new Error('Multiplier must be greater than 0'));
  }

  next();
});

const DynamicPricing = mongoose.model('DynamicPricing', dynamicPricingSchema);

export default DynamicPricing;
