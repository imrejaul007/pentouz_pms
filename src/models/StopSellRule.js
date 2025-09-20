import mongoose from 'mongoose';

/**
 * Stop Sell Rules Engine
 * 
 * This model manages dynamic rules for controlling inventory availability,
 * including stop sell flags, minimum length of stay, and closed-to-arrival
 * restrictions based on various conditions.
 */

const stopSellRuleSchema = new mongoose.Schema({
  ruleId: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Rule name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Rule Type and Priority
  ruleType: {
    type: String,
    enum: ['stop_sell', 'min_los', 'closed_to_arrival', 'closed_to_departure', 'rate_restriction'],
    required: true
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Date Range Conditions
  dateRange: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    daysOfWeek: [{
      type: Number,
      min: 0,
      max: 6
    }]
  },
  
  // Room Type Targeting
  roomTypes: [{
    type: mongoose.Schema.ObjectId,
    ref: 'RoomType'
  }],
  allRoomTypes: {
    type: Boolean,
    default: false
  },
  
  // Channel Targeting
  channels: [{
    type: String,
    enum: ['direct', 'booking_com', 'expedia', 'airbnb', 'agoda', 'corporate', 'travel_agent', 'all']
  }],
  allChannels: {
    type: Boolean,
    default: false
  },
  
  // Rule Actions
  actions: {
    stopSell: {
      type: Boolean,
      default: false
    },
    closedToArrival: {
      type: Boolean,
      default: false
    },
    closedToDeparture: {
      type: Boolean,
      default: false
    },
    minLengthOfStay: {
      type: Number,
      min: 1
    },
    maxLengthOfStay: {
      type: Number,
      min: 1
    },
    rateAdjustment: {
      type: Number
    }
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  
  // Audit Trail
  auditTrail: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'activated', 'deactivated', 'evaluated', 'triggered']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    details: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
stopSellRuleSchema.index({ hotelId: 1, isActive: 1, priority: -1 });
stopSellRuleSchema.index({ hotelId: 1, 'dateRange.startDate': 1, 'dateRange.endDate': 1 });

// Pre-save middleware
stopSellRuleSchema.pre('save', function(next) {
  // Generate unique rule ID
  if (!this.ruleId) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.ruleId = `RULE_${timestamp}_${random}`;
  }
  
  // Validate date range
  if (this.dateRange.endDate <= this.dateRange.startDate) {
    return next(new Error('End date must be after start date'));
  }
  
  // Add to audit trail
  if (this.isNew) {
    this.auditTrail.push({
      action: 'created',
      userId: this.createdBy,
      details: { ruleType: this.ruleType, priority: this.priority }
    });
  }
  
  next();
});

// Instance methods
stopSellRuleSchema.methods.evaluateRule = function(context) {
  const {
    date,
    roomTypeId,
    channel,
    occupancy,
    rate
  } = context;
  
  // Check if rule is active
  if (!this.isActive) return { applies: false, reason: 'Rule is inactive' };
  
  // Check date range
  if (date < this.dateRange.startDate || date > this.dateRange.endDate) {
    return { applies: false, reason: 'Date outside rule range' };
  }
  
  // Check days of week
  if (this.dateRange.daysOfWeek.length > 0 && !this.dateRange.daysOfWeek.includes(date.getDay())) {
    return { applies: false, reason: 'Day of week not in rule' };
  }
  
  // Check room type targeting
  if (!this.allRoomTypes && this.roomTypes.length > 0 && 
      !this.roomTypes.some(rt => rt.toString() === roomTypeId.toString())) {
    return { applies: false, reason: 'Room type not targeted' };
  }
  
  // Check channel targeting
  if (!this.allChannels && this.channels.length > 0 && 
      !this.channels.includes(channel) && !this.channels.includes('all')) {
    return { applies: false, reason: 'Channel not targeted' };
  }
  
  // Rule applies
  return { 
    applies: true, 
    actions: this.actions,
    priority: this.priority,
    ruleId: this.ruleId
  };
};

// Static methods
stopSellRuleSchema.statics.evaluateRulesForContext = async function(context) {
  const {
    hotelId,
    date,
    roomTypeId,
    channel = 'direct'
  } = context;
  
  // Get all active rules for the hotel
  const rules = await this.find({
    hotelId,
    isActive: true
  }).sort({ priority: -1, createdAt: 1 });
  
  const results = [];
  
  for (const rule of rules) {
    const evaluation = rule.evaluateRule({
      date,
      roomTypeId,
      channel
    });
    
    if (evaluation.applies) {
      results.push({
        ruleId: rule.ruleId,
        ruleType: rule.ruleType,
        priority: rule.priority,
        actions: evaluation.actions,
        name: rule.name,
        description: rule.description
      });
    }
  }
  
  return results;
};

export default mongoose.model('StopSellRule', stopSellRuleSchema);
