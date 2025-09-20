import mongoose from 'mongoose';

// Channel configuration schema
const channelConfigSchema = new mongoose.Schema({
  channelId: {
    type: String,
    required: true,
    enum: ['direct', 'booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'custom']
  },
  channelName: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  commission: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  markup: {
    type: Number,
    default: 0,
    min: -100,
    max: 1000
  },
  maxAdvanceBooking: {
    type: Number,
    default: 365
  },
  minAdvanceBooking: {
    type: Number,
    default: 0
  },
  cutoffTime: {
    type: String,
    default: '18:00'
  },
  restrictions: {
    minimumStay: {
      type: Number,
      default: 1,
      min: 1
    },
    maximumStay: {
      type: Number,
      default: 30,
      min: 1
    },
    closedToArrival: {
      type: Boolean,
      default: false
    },
    closedToDeparture: {
      type: Boolean,
      default: false
    },
    stopSell: {
      type: Boolean,
      default: false
    }
  },
  rateModifiers: {
    weekdays: {
      type: Number,
      default: 0,
      min: -100,
      max: 1000
    },
    weekends: {
      type: Number,
      default: 0,
      min: -100,
      max: 1000
    },
    holidays: {
      type: Number,
      default: 0,
      min: -100,
      max: 1000
    }
  }
});

// Daily allotment schema
const dailyAllotmentSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  totalInventory: {
    type: Number,
    required: true,
    min: 0
  },
  channelAllotments: [{
    channelId: {
      type: String,
      required: true
    },
    allocated: {
      type: Number,
      required: true,
      min: 0
    },
    sold: {
      type: Number,
      default: 0,
      min: 0
    },
    available: {
      type: Number,
      default: 0,
      min: 0
    },
    blocked: {
      type: Number,
      default: 0,
      min: 0
    },
    overbooking: {
      type: Number,
      default: 0,
      min: 0
    },
    rate: {
      type: Number,
      default: 0,
      min: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],
  freeStock: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSold: {
    type: Number,
    default: 0,
    min: 0
  },
  occupancyRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  notes: String,
  isHoliday: {
    type: Boolean,
    default: false
  },
  isBlackout: {
    type: Boolean,
    default: false
  }
});

// Allocation rule schema
const allocationRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed', 'dynamic', 'priority'],
    default: 'percentage'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  conditions: {
    dateRange: {
      startDate: Date,
      endDate: Date
    },
    daysOfWeek: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    seasonality: {
      type: String,
      enum: ['high', 'medium', 'low', 'custom']
    },
    occupancyThreshold: {
      type: Number,
      min: 0,
      max: 100
    },
    advanceBookingDays: {
      min: Number,
      max: Number
    }
  },
  allocation: {
    percentage: {
      type: Map,
      of: Number // channelId -> percentage
    },
    fixed: {
      type: Map,
      of: Number // channelId -> fixed amount
    },
    priority: [{
      channelId: String,
      priority: Number,
      minAllocation: Number,
      maxAllocation: Number
    }]
  },
  fallbackRule: {
    type: String,
    enum: ['equal_distribution', 'priority_based', 'historical_performance', 'revenue_optimization']
  }
});

// Performance tracking schema
const performanceMetricsSchema = new mongoose.Schema({
  period: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  channelMetrics: [{
    channelId: String,
    totalAllocated: {
      type: Number,
      default: 0
    },
    totalSold: {
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
      default: 0,
      min: 0,
      max: 100
    },
    utilizationRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    leadTime: {
      type: Number,
      default: 0
    },
    cancellationRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    noShowRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    revenuePerAvailableRoom: {
      type: Number,
      default: 0
    }
  }],
  overallMetrics: {
    totalInventory: {
      type: Number,
      default: 0
    },
    totalSold: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    averageOccupancyRate: {
      type: Number,
      default: 0
    },
    revenuePerAvailableRoom: {
      type: Number,
      default: 0
    },
    averageDailyRate: {
      type: Number,
      default: 0
    }
  }
});

// Main room type allotment schema
const roomTypeAllotmentSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  roomTypeId: {
    type: mongoose.Schema.ObjectId,
    ref: 'RoomType',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  
  // Channel configuration
  channels: [channelConfigSchema],
  
  // Allocation rules
  allocationRules: [allocationRuleSchema],
  
  // Daily allotments (for performance, consider separate collection for large datasets)
  dailyAllotments: [dailyAllotmentSchema],
  
  // Default settings
  defaultSettings: {
    totalInventory: {
      type: Number,
      required: true,
      min: 0
    },
    defaultAllocationMethod: {
      type: String,
      enum: ['percentage', 'fixed', 'dynamic'],
      default: 'percentage'
    },
    overbookingAllowed: {
      type: Boolean,
      default: false
    },
    overbookingLimit: {
      type: Number,
      default: 0,
      min: 0
    },
    releaseWindow: {
      type: Number,
      default: 24 // hours before check-in
    },
    autoRelease: {
      type: Boolean,
      default: true
    },
    blockPeriod: {
      type: Number,
      default: 0 // days to block after no-show
    }
  },
  
  // Performance tracking
  performanceMetrics: [performanceMetricsSchema],
  
  // Analytics and reporting
  analytics: {
    lastCalculated: Date,
    nextCalculation: Date,
    calculationFrequency: {
      type: String,
      enum: ['hourly', 'daily', 'weekly'],
      default: 'daily'
    },
    alerts: [{
      type: {
        type: String,
        enum: ['low_occupancy', 'high_occupancy', 'channel_underperforming', 'inventory_imbalance', 'overbooking_risk']
      },
      threshold: Number,
      isActive: Boolean,
      lastTriggered: Date,
      frequency: {
        type: String,
        enum: ['immediate', 'daily', 'weekly']
      }
    }],
    recommendations: [{
      type: {
        type: String,
        enum: ['increase_allocation', 'decrease_allocation', 'adjust_rates', 'modify_restrictions', 'update_rules']
      },
      channelId: String,
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      impact: String,
      confidence: {
        type: Number,
        min: 0,
        max: 100
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      appliedAt: Date,
      result: String
    }]
  },
  
  // Integration settings
  integration: {
    channelManager: {
      provider: String,
      isConnected: {
        type: Boolean,
        default: false
      },
      lastSync: Date,
      syncFrequency: {
        type: Number,
        default: 15 // minutes
      },
      autoSync: {
        type: Boolean,
        default: true
      },
      errorLog: [{
        timestamp: Date,
        channelId: String,
        error: String,
        resolved: Boolean
      }]
    },
    pms: {
      provider: String,
      isConnected: {
        type: Boolean,
        default: false
      },
      lastSync: Date,
      mapping: {
        type: Map,
        of: String // PMS room type ID -> system room type ID
      }
    }
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  version: {
    type: Number,
    default: 1
  },
  changeLog: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    action: {
      type: String,
      enum: ['created', 'updated', 'deleted', 'allocated', 'released', 'synced']
    },
    changes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    },
    reason: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
roomTypeAllotmentSchema.index({ hotelId: 1, roomTypeId: 1 });
roomTypeAllotmentSchema.index({ hotelId: 1, status: 1 });
roomTypeAllotmentSchema.index({ 'dailyAllotments.date': 1 });
roomTypeAllotmentSchema.index({ 'channels.channelId': 1 });
roomTypeAllotmentSchema.index({ createdAt: -1 });
roomTypeAllotmentSchema.index({ updatedAt: -1 });

// Compound indexes
roomTypeAllotmentSchema.index({ hotelId: 1, roomTypeId: 1, status: 1 });
roomTypeAllotmentSchema.index({ hotelId: 1, 'dailyAllotments.date': 1 });

// Virtual for total channel allocation
roomTypeAllotmentSchema.virtual('totalChannelAllocation').get(function() {
  if (!this.dailyAllotments || this.dailyAllotments.length === 0) return 0;
  
  const latest = this.dailyAllotments[this.dailyAllotments.length - 1];
  return latest.channelAllotments.reduce((total, channel) => total + channel.allocated, 0);
});

// Virtual for overall occupancy rate
roomTypeAllotmentSchema.virtual('overallOccupancyRate').get(function() {
  if (!this.dailyAllotments || this.dailyAllotments.length === 0) return 0;
  
  const totalOccupancy = this.dailyAllotments.reduce((sum, day) => sum + day.occupancyRate, 0);
  return Math.round((totalOccupancy / this.dailyAllotments.length) * 100) / 100;
});

// Virtual for channel performance summary
roomTypeAllotmentSchema.virtual('channelPerformance').get(function() {
  const channelData = {};
  
  this.channels.forEach(channel => {
    const metrics = this.performanceMetrics
      .flatMap(period => period.channelMetrics)
      .filter(metric => metric.channelId === channel.channelId);
    
    if (metrics.length > 0) {
      const avgConversion = metrics.reduce((sum, m) => sum + m.conversionRate, 0) / metrics.length;
      const avgUtilization = metrics.reduce((sum, m) => sum + m.utilizationRate, 0) / metrics.length;
      const totalRevenue = metrics.reduce((sum, m) => sum + m.totalRevenue, 0);
      
      channelData[channel.channelId] = {
        channelName: channel.channelName,
        averageConversion: Math.round(avgConversion * 100) / 100,
        averageUtilization: Math.round(avgUtilization * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        isActive: channel.isActive
      };
    }
  });
  
  return channelData;
});

// Instance methods
roomTypeAllotmentSchema.methods.getAllotmentForDate = function(date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  return this.dailyAllotments.find(allotment => {
    const allotmentDate = new Date(allotment.date);
    allotmentDate.setHours(0, 0, 0, 0);
    return allotmentDate.getTime() === targetDate.getTime();
  });
};

roomTypeAllotmentSchema.methods.getChannelAllocation = function(channelId, date) {
  const dailyAllotment = this.getAllotmentForDate(date);
  if (!dailyAllotment) return null;
  
  return dailyAllotment.channelAllotments.find(channel => channel.channelId === channelId);
};

roomTypeAllotmentSchema.methods.updateChannelAllocation = function(channelId, date, allocation) {
  let dailyAllotment = this.getAllotmentForDate(date);
  
  if (!dailyAllotment) {
    // Create new daily allotment
    dailyAllotment = {
      date: new Date(date),
      totalInventory: this.defaultSettings.totalInventory,
      channelAllotments: []
    };
    this.dailyAllotments.push(dailyAllotment);
  }
  
  let channelAllotment = dailyAllotment.channelAllotments.find(channel => channel.channelId === channelId);
  
  if (!channelAllotment) {
    channelAllotment = {
      channelId,
      allocated: 0,
      sold: 0,
      available: 0,
      blocked: 0,
      overbooking: 0
    };
    dailyAllotment.channelAllotments.push(channelAllotment);
  }
  
  Object.assign(channelAllotment, allocation, { lastUpdated: new Date() });
  channelAllotment.available = channelAllotment.allocated - channelAllotment.sold - channelAllotment.blocked;
  
  this.updateTotals(dailyAllotment);
};

roomTypeAllotmentSchema.methods.updateTotals = function(dailyAllotment) {
  dailyAllotment.totalSold = dailyAllotment.channelAllotments.reduce((sum, channel) => sum + channel.sold, 0);
  dailyAllotment.freeStock = dailyAllotment.totalInventory - dailyAllotment.channelAllotments.reduce((sum, channel) => sum + channel.allocated, 0);
  dailyAllotment.occupancyRate = Math.round((dailyAllotment.totalSold / dailyAllotment.totalInventory) * 100 * 100) / 100;
};

roomTypeAllotmentSchema.methods.applyAllocationRule = function(ruleId, dateRange) {
  const rule = this.allocationRules.find(r => r._id.toString() === ruleId && r.isActive);
  if (!rule) return false;
  
  const startDate = new Date(dateRange.startDate);
  const endDate = new Date(dateRange.endDate);
  
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    this.applyRuleToDate(rule, new Date(date));
  }
  
  return true;
};

roomTypeAllotmentSchema.methods.applyRuleToDate = function(rule, date) {
  const dailyAllotment = this.getAllotmentForDate(date) || {
    date: new Date(date),
    totalInventory: this.defaultSettings.totalInventory,
    channelAllotments: []
  };
  
  // Apply allocation based on rule type
  switch (rule.type) {
    case 'percentage':
      this.applyPercentageAllocation(rule, dailyAllotment);
      break;
    case 'fixed':
      this.applyFixedAllocation(rule, dailyAllotment);
      break;
    case 'priority':
      this.applyPriorityAllocation(rule, dailyAllotment);
      break;
    case 'dynamic':
      this.applyDynamicAllocation(rule, dailyAllotment);
      break;
  }
  
  this.updateTotals(dailyAllotment);
};

roomTypeAllotmentSchema.methods.applyPercentageAllocation = function(rule, dailyAllotment) {
  const totalInventory = dailyAllotment.totalInventory;
  
  rule.allocation.percentage.forEach((percentage, channelId) => {
    const allocated = Math.floor((totalInventory * percentage) / 100);
    this.updateChannelAllocation(channelId, dailyAllotment.date, { allocated });
  });
};

roomTypeAllotmentSchema.methods.applyFixedAllocation = function(rule, dailyAllotment) {
  rule.allocation.fixed.forEach((amount, channelId) => {
    this.updateChannelAllocation(channelId, dailyAllotment.date, { allocated: amount });
  });
};

roomTypeAllotmentSchema.methods.addPerformanceMetrics = function(metrics) {
  this.performanceMetrics.push(metrics);
  
  // Keep only last 12 months of metrics
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  this.performanceMetrics = this.performanceMetrics.filter(metric => 
    new Date(metric.period.endDate) >= oneYearAgo
  );
};

roomTypeAllotmentSchema.methods.generateRecommendations = function() {
  const recommendations = [];
  
  // Analyze recent performance
  const recentMetrics = this.performanceMetrics
    .sort((a, b) => new Date(b.period.endDate) - new Date(a.period.endDate))
    .slice(0, 3); // Last 3 periods
  
  if (recentMetrics.length > 0) {
    const latestMetrics = recentMetrics[0];
    
    latestMetrics.channelMetrics.forEach(channelMetric => {
      // Low utilization recommendation
      if (channelMetric.utilizationRate < 60) {
        recommendations.push({
          type: 'decrease_allocation',
          channelId: channelMetric.channelId,
          priority: 'medium',
          impact: `Channel utilization is low at ${channelMetric.utilizationRate.toFixed(1)}%`,
          confidence: 75
        });
      }
      
      // High utilization recommendation
      if (channelMetric.utilizationRate > 90) {
        recommendations.push({
          type: 'increase_allocation',
          channelId: channelMetric.channelId,
          priority: 'high',
          impact: `Channel utilization is high at ${channelMetric.utilizationRate.toFixed(1)}%`,
          confidence: 85
        });
      }
      
      // Low conversion recommendation
      if (channelMetric.conversionRate < 20) {
        recommendations.push({
          type: 'adjust_rates',
          channelId: channelMetric.channelId,
          priority: 'medium',
          impact: `Low conversion rate of ${channelMetric.conversionRate.toFixed(1)}%`,
          confidence: 70
        });
      }
    });
  }
  
  this.analytics.recommendations = recommendations;
};

// Static methods
roomTypeAllotmentSchema.statics.findByHotelAndRoomType = function(hotelId, roomTypeId) {
  return this.findOne({ hotelId, roomTypeId, status: 'active' })
    .populate('roomTypeId', 'name code maxOccupancy')
    .populate('createdBy updatedBy', 'name email');
};

roomTypeAllotmentSchema.statics.getActiveAllotments = function(hotelId) {
  return this.find({ hotelId, status: 'active' })
    .populate('roomTypeId', 'name code maxOccupancy')
    .sort({ createdAt: -1 });
};

roomTypeAllotmentSchema.statics.getAllotmentsForDate = function(hotelId, date) {
  const targetDate = new Date(date);
  
  return this.find({
    hotelId,
    status: 'active',
    'dailyAllotments.date': {
      $gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
      $lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1)
    }
  }).populate('roomTypeId', 'name code');
};

// Pre-save middleware
roomTypeAllotmentSchema.pre('save', function(next) {
  // Update version on changes
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }
  
  // Ensure channel allocations don't exceed total inventory
  this.dailyAllotments.forEach(dailyAllotment => {
    const totalAllocated = dailyAllotment.channelAllotments.reduce((sum, channel) => sum + channel.allocated, 0);
    
    if (totalAllocated > dailyAllotment.totalInventory && !this.defaultSettings.overbookingAllowed) {
      const ratio = dailyAllotment.totalInventory / totalAllocated;
      dailyAllotment.channelAllotments.forEach(channel => {
        channel.allocated = Math.floor(channel.allocated * ratio);
      });
    }
    
    this.updateTotals(dailyAllotment);
  });
  
  // Sort daily allotments by date
  this.dailyAllotments.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  next();
});

// Post-save middleware
roomTypeAllotmentSchema.post('save', function() {
  // Schedule next calculation if needed
  if (!this.analytics.nextCalculation) {
    const next = new Date();
    switch (this.analytics.calculationFrequency) {
      case 'hourly':
        next.setHours(next.getHours() + 1);
        break;
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
    }
    this.analytics.nextCalculation = next;
  }
});

const RoomTypeAllotment = mongoose.model('RoomTypeAllotment', roomTypeAllotmentSchema);

export default RoomTypeAllotment;
