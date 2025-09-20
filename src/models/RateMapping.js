import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     RateMapping:
 *       type: object
 *       required:
 *         - pmsRatePlanId
 *         - roomMappingId
 *         - channelRatePlanId
 *       properties:
 *         _id:
 *           type: string
 *         pmsRatePlanId:
 *           type: string
 *           description: Internal PMS Rate Plan ID
 *         roomMappingId:
 *           type: string
 *           description: Associated Room Mapping ID
 *         channelRatePlanId:
 *           type: string
 *           description: External channel rate plan ID
 *         channelRatePlanName:
 *           type: string
 *           description: Rate plan name as displayed on channel
 *         isActive:
 *           type: boolean
 *           default: true
 */

const rateMappingSchema = new mongoose.Schema({
  // Internal PMS Rate Plan identification
  pmsRatePlanId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Associated room mapping (room type + channel combination)
  roomMappingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomMapping',
    required: true,
    index: true
  },
  
  // External channel rate plan identification
  channelRatePlanId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  channelRatePlanName: {
    type: String,
    required: true,
    trim: true
  },
  
  channelRatePlanDescription: {
    type: String,
    trim: true
  },
  
  // Rate plan status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Rate plan configuration
  ratePlanConfig: {
    // Rate modification rules
    baseRateModifier: {
      type: {
        type: String,
        enum: ['percentage', 'fixed', 'multiplier'],
        default: 'percentage'
      },
      value: {
        type: Number,
        default: 0
      }
    },
    
    // Meal plan inclusions
    mealPlan: {
      type: String,
      enum: ['room_only', 'breakfast', 'half_board', 'full_board', 'all_inclusive'],
      default: 'room_only'
    },
    
    // Cancellation policy
    cancellationPolicy: {
      type: String,
      enum: ['free', 'non_refundable', 'custom'],
      default: 'free'
    },
    
    // Free cancellation hours before check-in
    freeCancellationHours: {
      type: Number,
      default: 24,
      min: 0
    },
    
    // Advance booking requirements
    minAdvanceBooking: {
      type: Number,
      default: 0,
      min: 0
    },
    
    maxAdvanceBooking: {
      type: Number,
      default: 365,
      min: 1
    },
    
    // Length of stay restrictions
    minLengthOfStay: {
      type: Number,
      default: 1,
      min: 1
    },
    
    maxLengthOfStay: {
      type: Number,
      default: 30,
      min: 1
    },
    
    // Occupancy restrictions
    minOccupancy: {
      type: Number,
      default: 1,
      min: 1
    },
    
    maxOccupancy: {
      type: Number,
      default: 4,
      min: 1
    },
    
    // Channel-specific rate rules
    channelSpecificRules: {
      // Booking.com specific
      genius_discount: {
        type: Number,
        min: 0,
        max: 50,
        default: 0
      },
      
      // Expedia specific
      expedia_special_rate: Boolean,
      
      // Custom pricing rules
      seasonalRules: [{
        name: String,
        startDate: Date,
        endDate: Date,
        modifier: {
          type: {
            type: String,
            enum: ['percentage', 'fixed']
          },
          value: Number
        }
      }],
      
      // Day of week pricing
      dowPricing: [{
        dayOfWeek: {
          type: Number,
          min: 0,
          max: 6 // 0 = Sunday, 6 = Saturday
        },
        modifier: {
          type: {
            type: String,
            enum: ['percentage', 'fixed']
          },
          value: Number
        }
      }]
    }
  },
  
  // Sync tracking
  lastSync: {
    success: Date,
    attempt: Date,
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'pending'
    },
    error: String
  },
  
  // Performance metrics
  metrics: {
    totalBookings: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    averageRate: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    }
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
rateMappingSchema.index({ pmsRatePlanId: 1, roomMappingId: 1 });
rateMappingSchema.index({ roomMappingId: 1, channelRatePlanId: 1 }, { unique: true });
rateMappingSchema.index({ pmsRatePlanId: 1, isActive: 1 });
rateMappingSchema.index({ roomMappingId: 1, isActive: 1 });

// Virtual for room mapping details
rateMappingSchema.virtual('roomMappingDetails', {
  ref: 'RoomMapping',
  localField: 'roomMappingId',
  foreignField: '_id',
  justOne: true
});

// Virtual for channel info (derived from room mapping)
rateMappingSchema.virtual('channelInfo', {
  ref: 'RoomMapping',
  localField: 'roomMappingId',
  foreignField: '_id',
  justOne: true,
  select: 'channel channelRoomId channelRoomName'
});

// Static method to find rate mappings by PMS rate plan
rateMappingSchema.statics.findByRatePlan = function(pmsRatePlanId, activeOnly = true) {
  const query = { pmsRatePlanId };
  if (activeOnly) query.isActive = true;
  return this.find(query).populate('roomMappingDetails channelInfo');
};

// Static method to find rate mappings by room mapping
rateMappingSchema.statics.findByRoomMapping = function(roomMappingId, activeOnly = true) {
  const query = { roomMappingId };
  if (activeOnly) query.isActive = true;
  return this.find(query).populate('roomMappingDetails');
};

// Static method to find rate mapping by channel rate plan ID
rateMappingSchema.statics.findByChannelRatePlan = function(roomMappingId, channelRatePlanId) {
  return this.findOne({ 
    roomMappingId,
    channelRatePlanId, 
    isActive: true 
  }).populate('roomMappingDetails channelInfo');
};

// Instance method to calculate channel rate
rateMappingSchema.methods.calculateChannelRate = function(baseRate, checkIn = null, dayOfWeek = null) {
  let finalRate = baseRate;
  const config = this.ratePlanConfig;
  
  // Apply base rate modifier
  if (config?.baseRateModifier) {
    const { type, value } = config.baseRateModifier;
    
    switch (type) {
      case 'percentage':
        finalRate = baseRate * (1 + value / 100);
        break;
      case 'fixed':
        finalRate = baseRate + value;
        break;
      case 'multiplier':
        finalRate = baseRate * value;
        break;
    }
  }
  
  // Apply seasonal rules if check-in date provided
  if (checkIn && config?.channelSpecificRules?.seasonalRules) {
    const checkInDate = new Date(checkIn);
    const applicableRule = config.channelSpecificRules.seasonalRules.find(rule => {
      const start = new Date(rule.startDate);
      const end = new Date(rule.endDate);
      return checkInDate >= start && checkInDate <= end;
    });
    
    if (applicableRule) {
      const { type, value } = applicableRule.modifier;
      if (type === 'percentage') {
        finalRate = finalRate * (1 + value / 100);
      } else if (type === 'fixed') {
        finalRate = finalRate + value;
      }
    }
  }
  
  // Apply day of week pricing if day provided
  if (dayOfWeek !== null && config?.channelSpecificRules?.dowPricing) {
    const dowRule = config.channelSpecificRules.dowPricing.find(rule => 
      rule.dayOfWeek === dayOfWeek
    );
    
    if (dowRule) {
      const { type, value } = dowRule.modifier;
      if (type === 'percentage') {
        finalRate = finalRate * (1 + value / 100);
      } else if (type === 'fixed') {
        finalRate = finalRate + value;
      }
    }
  }
  
  return Math.round(finalRate * 100) / 100; // Round to 2 decimal places
};

// Instance method to update metrics
rateMappingSchema.methods.updateMetrics = function(bookingAmount) {
  this.metrics.totalBookings += 1;
  this.metrics.totalRevenue += bookingAmount;
  this.metrics.averageRate = this.metrics.totalRevenue / this.metrics.totalBookings;
  
  return this.save();
};

// Instance method to update sync status
rateMappingSchema.methods.updateSyncStatus = function(status, error = null) {
  this.lastSync.attempt = new Date();
  this.lastSync.status = status;
  
  if (status === 'success') {
    this.lastSync.success = new Date();
    this.lastSync.error = undefined;
  } else if (status === 'failed' && error) {
    this.lastSync.error = error;
  }
  
  return this.save();
};

// Pre-save validation
rateMappingSchema.pre('save', function(next) {
  // Validate length of stay constraints
  if (this.ratePlanConfig?.minLengthOfStay && this.ratePlanConfig?.maxLengthOfStay) {
    if (this.ratePlanConfig.minLengthOfStay > this.ratePlanConfig.maxLengthOfStay) {
      return next(new Error('Minimum length of stay cannot be greater than maximum'));
    }
  }
  
  // Validate occupancy constraints
  if (this.ratePlanConfig?.minOccupancy && this.ratePlanConfig?.maxOccupancy) {
    if (this.ratePlanConfig.minOccupancy > this.ratePlanConfig.maxOccupancy) {
      return next(new Error('Minimum occupancy cannot be greater than maximum'));
    }
  }
  
  next();
});

export default mongoose.model('RateMapping', rateMappingSchema);
