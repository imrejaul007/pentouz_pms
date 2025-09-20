import mongoose from 'mongoose';

// Default channel configuration schema for global settings
const defaultChannelConfigSchema = new mongoose.Schema({
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
    default: 50,
    min: 0,
    max: 100
  },
  commission: {
    type: Number,
    default: 15,
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
      default: 10,
      min: -100,
      max: 1000
    },
    holidays: {
      type: Number,
      default: 20,
      min: -100,
      max: 1000
    }
  }
});

// Default allocation rule template schema
const allocationRuleTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed', 'dynamic', 'priority'],
    default: 'percentage'
  },
  isDefault: {
    type: Boolean,
    default: false
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
  conditions: {
    seasonality: {
      type: String,
      enum: ['high', 'medium', 'low', 'all'],
      default: 'all'
    },
    daysOfWeek: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    occupancyThreshold: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  fallbackRule: {
    type: String,
    enum: ['equal_distribution', 'priority_based', 'historical_performance', 'revenue_optimization'],
    default: 'equal_distribution'
  }
});

// Main hotel allotment settings schema
const hotelAllotmentSettingsSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    unique: true,
    index: true
  },

  // Global default settings
  globalDefaults: {
    totalInventory: {
      type: Number,
      default: 10,
      min: 1,
      max: 1000
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
      min: 0,
      max: 50
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
    },
    currency: {
      type: String,
      default: 'INR'
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },

  // Default channel configurations
  defaultChannels: [defaultChannelConfigSchema],

  // Allocation rule templates
  allocationRuleTemplates: [allocationRuleTemplateSchema],

  // Analytics settings
  analyticsSettings: {
    calculationFrequency: {
      type: String,
      enum: ['hourly', 'daily', 'weekly'],
      default: 'daily'
    },
    enableRecommendations: {
      type: Boolean,
      default: true
    },
    alerts: [{
      type: {
        type: String,
        enum: ['low_occupancy', 'high_occupancy', 'channel_underperforming', 'inventory_imbalance', 'overbooking_risk'],
        required: true
      },
      threshold: {
        type: Number,
        required: true
      },
      isActive: {
        type: Boolean,
        default: true
      },
      frequency: {
        type: String,
        enum: ['immediate', 'daily', 'weekly'],
        default: 'daily'
      },
      recipients: [{
        email: String,
        role: String
      }]
    }],
    performanceThresholds: {
      lowUtilization: {
        type: Number,
        default: 60,
        min: 0,
        max: 100
      },
      highUtilization: {
        type: Number,
        default: 90,
        min: 0,
        max: 100
      },
      lowConversion: {
        type: Number,
        default: 20,
        min: 0,
        max: 100
      },
      highConversion: {
        type: Number,
        default: 80,
        min: 0,
        max: 100
      }
    }
  },

  // Integration settings
  integrationSettings: {
    channelManager: {
      provider: {
        type: String,
        enum: ['none', 'siteminder', 'cloudbeds', 'rentals_united', 'channex', 'custom']
      },
      isConnected: {
        type: Boolean,
        default: false
      },
      connectionSettings: {
        apiUrl: String,
        apiKey: String,
        propertyId: String,
        username: String
      },
      syncSettings: {
        syncFrequency: {
          type: Number,
          default: 15 // minutes
        },
        autoSync: {
          type: Boolean,
          default: true
        },
        syncInventory: {
          type: Boolean,
          default: true
        },
        syncRates: {
          type: Boolean,
          default: true
        },
        syncRestrictions: {
          type: Boolean,
          default: true
        }
      },
      lastSync: Date,
      errorLog: [{
        timestamp: {
          type: Date,
          default: Date.now
        },
        channelId: String,
        error: String,
        resolved: {
          type: Boolean,
          default: false
        }
      }]
    },

    pms: {
      provider: {
        type: String,
        enum: ['none', 'opera', 'protel', 'mews', 'cloudbeds', 'custom']
      },
      isConnected: {
        type: Boolean,
        default: false
      },
      connectionSettings: {
        apiUrl: String,
        apiKey: String,
        propertyCode: String
      },
      roomTypeMapping: {
        type: Map,
        of: String // PMS room type ID -> system room type ID
      },
      syncSettings: {
        realTimeSync: {
          type: Boolean,
          default: false
        },
        syncFrequency: {
          type: Number,
          default: 60 // minutes for batch sync
        },
        syncBookings: {
          type: Boolean,
          default: true
        },
        syncInventory: {
          type: Boolean,
          default: true
        }
      },
      lastSync: Date
    },

    // Webhook configurations
    webhooks: [{
      name: String,
      url: String,
      events: [{
        type: String,
        enum: ['inventory_update', 'booking_created', 'booking_cancelled', 'rate_changed']
      }],
      isActive: {
        type: Boolean,
        default: true
      },
      secretKey: String,
      retryPolicy: {
        maxRetries: {
          type: Number,
          default: 3
        },
        retryDelay: {
          type: Number,
          default: 300 // seconds
        }
      }
    }]
  },

  // UI preferences
  uiPreferences: {
    defaultView: {
      type: String,
      enum: ['overview', 'dashboard', 'calendar'],
      default: 'overview'
    },
    calendarView: {
      type: String,
      enum: ['week', 'month'],
      default: 'month'
    },
    showChannelColors: {
      type: Boolean,
      default: true
    },
    compactMode: {
      type: Boolean,
      default: false
    },
    autoRefresh: {
      type: Boolean,
      default: true
    },
    refreshInterval: {
      type: Number,
      default: 300 // seconds
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
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
hotelAllotmentSettingsSchema.index({ hotelId: 1 }, { unique: true });
hotelAllotmentSettingsSchema.index({ createdAt: -1 });
hotelAllotmentSettingsSchema.index({ updatedAt: -1 });

// Virtual for active channels count
hotelAllotmentSettingsSchema.virtual('activeChannelsCount').get(function() {
  return this.defaultChannels ? this.defaultChannels.filter(channel => channel.isActive).length : 0;
});

// Virtual for active alerts count
hotelAllotmentSettingsSchema.virtual('activeAlertsCount').get(function() {
  return this.analyticsSettings?.alerts ? this.analyticsSettings.alerts.filter(alert => alert.isActive).length : 0;
});

// Virtual for integration status
hotelAllotmentSettingsSchema.virtual('integrationStatus').get(function() {
  const channelManager = this.integrationSettings?.channelManager?.isConnected || false;
  const pms = this.integrationSettings?.pms?.isConnected || false;

  if (channelManager && pms) return 'full';
  if (channelManager || pms) return 'partial';
  return 'none';
});

// Instance methods
hotelAllotmentSettingsSchema.methods.getDefaultChannelConfig = function(channelId) {
  return this.defaultChannels.find(channel => channel.channelId === channelId);
};

hotelAllotmentSettingsSchema.methods.getDefaultAllocationRule = function(type = 'percentage') {
  return this.allocationRuleTemplates.find(rule => rule.type === type && rule.isDefault);
};

hotelAllotmentSettingsSchema.methods.addAllocationRuleTemplate = function(templateData) {
  // If this is being set as default, unset other defaults of the same type
  if (templateData.isDefault) {
    this.allocationRuleTemplates.forEach(rule => {
      if (rule.type === templateData.type) {
        rule.isDefault = false;
      }
    });
  }

  this.allocationRuleTemplates.push(templateData);
};

hotelAllotmentSettingsSchema.methods.updateChannelDefaults = function(channelUpdates) {
  channelUpdates.forEach(update => {
    const channel = this.defaultChannels.find(c => c.channelId === update.channelId);
    if (channel) {
      Object.assign(channel, update.settings);
    } else {
      this.defaultChannels.push({
        channelId: update.channelId,
        channelName: update.channelName,
        ...update.settings
      });
    }
  });
};

// Static methods
hotelAllotmentSettingsSchema.statics.findByHotelId = function(hotelId) {
  return this.findOne({ hotelId, isActive: true })
    .populate('createdBy updatedBy', 'name email');
};

hotelAllotmentSettingsSchema.statics.createDefaultSettings = function(hotelId, userId) {
  const defaultSettings = {
    hotelId,
    createdBy: userId,
    defaultChannels: [
      {
        channelId: 'direct',
        channelName: 'Direct Booking',
        priority: 100,
        commission: 0,
        markup: 0
      },
      {
        channelId: 'booking_com',
        channelName: 'Booking.com',
        priority: 90,
        commission: 15,
        markup: 0
      },
      {
        channelId: 'expedia',
        channelName: 'Expedia',
        priority: 80,
        commission: 18,
        markup: 0
      }
    ],
    allocationRuleTemplates: [
      {
        name: 'Balanced Allocation',
        description: 'Equal distribution across active channels',
        type: 'percentage',
        isDefault: true,
        allocation: {
          percentage: new Map([
            ['direct', 40],
            ['booking_com', 35],
            ['expedia', 25]
          ])
        }
      },
      {
        name: 'Direct Focus',
        description: 'Prioritize direct bookings',
        type: 'percentage',
        allocation: {
          percentage: new Map([
            ['direct', 60],
            ['booking_com', 25],
            ['expedia', 15]
          ])
        }
      }
    ],
    analyticsSettings: {
      alerts: [
        {
          type: 'low_occupancy',
          threshold: 60,
          isActive: true,
          frequency: 'daily'
        },
        {
          type: 'high_occupancy',
          threshold: 90,
          isActive: true,
          frequency: 'immediate'
        }
      ]
    }
  };

  return this.create(defaultSettings);
};

// Pre-save middleware
hotelAllotmentSettingsSchema.pre('save', function(next) {
  // Update version on changes
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }

  // Ensure at least one default allocation rule exists
  if (this.allocationRuleTemplates.length === 0) {
    this.allocationRuleTemplates.push({
      name: 'Default Balanced',
      type: 'percentage',
      isDefault: true,
      allocation: {
        percentage: new Map([
          ['direct', 50],
          ['booking_com', 30],
          ['expedia', 20]
        ])
      }
    });
  }

  // Ensure only one default rule per type
  const typeDefaults = {};
  this.allocationRuleTemplates.forEach(rule => {
    if (rule.isDefault) {
      if (typeDefaults[rule.type]) {
        rule.isDefault = false; // Unset duplicate defaults
      } else {
        typeDefaults[rule.type] = true;
      }
    }
  });

  next();
});

const HotelAllotmentSettings = mongoose.model('HotelAllotmentSettings', hotelAllotmentSettingsSchema);

export default HotelAllotmentSettings;
