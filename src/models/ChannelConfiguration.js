import mongoose from 'mongoose';

const channelConfigurationSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  channelId: {
    type: String,
    required: true,
    enum: [
      'booking_com',
      'expedia',
      'airbnb', 
      'agoda',
      'hotels_com',
      'trivago',
      'kayak',
      'priceline',
      'hostelworld',
      'vrbo'
    ]
  },
  channelName: {
    type: String,
    required: true
  },
  
  // Multi-language configuration
  languageSettings: {
    primaryLanguage: {
      type: String,
      required: true,
      default: 'EN'
    },
    supportedLanguages: [{
      languageCode: {
        type: String,
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
      // Channel-specific language configuration
      channelLanguageCode: {
        type: String, // Some channels use different language codes
        required: false
      },
      translationQuality: {
        type: String,
        enum: ['automatic', 'reviewed', 'professional', 'native'],
        default: 'automatic'
      },
      lastTranslationUpdate: {
        type: Date,
        default: Date.now
      }
    }],
    fallbackLanguage: {
      type: String,
      default: 'EN'
    },
    autoTranslate: {
      type: Boolean,
      default: true
    },
    translationApprovalRequired: {
      type: Boolean,
      default: false
    }
  },

  // Multi-currency configuration  
  currencySettings: {
    baseCurrency: {
      type: String,
      required: true,
      default: 'USD'
    },
    supportedCurrencies: [{
      currencyCode: {
        type: String,
        required: true
      },
      isActive: {
        type: Boolean,
        default: true
      },
      markup: {
        type: Number,
        default: 0, // Percentage markup for this currency
        min: -50,
        max: 100
      },
      rounding: {
        type: String,
        enum: ['none', 'up', 'down', 'nearest'],
        default: 'nearest'
      },
      // Channel-specific currency settings
      channelCurrencyCode: {
        type: String, // Some channels use different currency codes
        required: false
      },
      conversionMethod: {
        type: String,
        enum: ['live_rate', 'fixed_rate', 'daily_rate'],
        default: 'live_rate'
      },
      fixedRate: {
        type: Number,
        required: false
      }
    }],
    autoConvert: {
      type: Boolean,
      default: true
    },
    priceUpdateFrequency: {
      type: String,
      enum: ['real_time', 'hourly', 'daily', 'manual'],
      default: 'hourly'
    }
  },

  // Content localization settings
  contentSettings: {
    hotelDescription: {
      requireTranslation: {
        type: Boolean,
        default: true
      },
      autoTranslate: {
        type: Boolean,
        default: true
      },
      maxLength: {
        type: Number,
        default: 2000
      }
    },
    amenities: {
      requireTranslation: {
        type: Boolean,
        default: true
      },
      autoTranslate: {
        type: Boolean,
        default: true
      },
      customTranslations: {
        type: Map,
        of: String // language -> custom translation
      }
    },
    policies: {
      requireTranslation: {
        type: Boolean,
        default: true
      },
      autoTranslate: {
        type: Boolean,
        default: false // Policies usually need manual review
      }
    },
    roomTypes: {
      requireTranslation: {
        type: Boolean,
        default: true
      },
      autoTranslate: {
        type: Boolean,
        default: true
      },
      includeAmenities: {
        type: Boolean,
        default: true
      }
    }
  },

  // Channel-specific integration settings
  integrationSettings: {
    apiCredentials: {
      username: String,
      password: String,
      apiKey: String,
      hotelCode: String,
      propertyId: String,
      encrypted: {
        type: Boolean,
        default: true
      }
    },
    endpoints: {
      inventory: String,
      rates: String,
      content: String,
      reservations: String,
      availability: String
    },
    syncSchedule: {
      inventory: {
        type: String,
        enum: ['real_time', 'every_5_min', 'hourly', 'daily'],
        default: 'hourly'
      },
      rates: {
        type: String,
        enum: ['real_time', 'every_5_min', 'hourly', 'daily'],
        default: 'hourly'
      },
      content: {
        type: String,
        enum: ['real_time', 'hourly', 'daily', 'weekly'],
        default: 'daily'
      }
    },
    batchSize: {
      type: Number,
      default: 100,
      min: 1,
      max: 1000
    },
    timeout: {
      type: Number,
      default: 30000, // 30 seconds
      min: 5000,
      max: 300000
    },
    retryAttempts: {
      type: Number,
      default: 3,
      min: 0,
      max: 10
    }
  },

  // Status and monitoring
  status: {
    isActive: {
      type: Boolean,
      default: true
    },
    connectionStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'error', 'testing'],
      default: 'disconnected'
    },
    lastSync: {
      inventory: Date,
      rates: Date,
      content: Date,
      reservations: Date
    },
    syncStats: {
      totalSyncs: {
        type: Number,
        default: 0
      },
      successfulSyncs: {
        type: Number,
        default: 0
      },
      failedSyncs: {
        type: Number,
        default: 0
      },
      lastError: {
        message: String,
        timestamp: Date,
        code: String
      }
    }
  },

  // Performance metrics
  performance: {
    averageResponseTime: {
      type: Number,
      default: 0
    },
    uptimePercentage: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    translationAccuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },

  // Validation and quality checks
  validationRules: {
    requiredFields: [{
      field: String,
      languages: [String],
      mandatory: {
        type: Boolean,
        default: true
      }
    }],
    contentValidation: {
      minDescriptionLength: {
        type: Number,
        default: 50
      },
      maxDescriptionLength: {
        type: Number,
        default: 2000
      },
      requireImages: {
        type: Boolean,
        default: true
      },
      minImageCount: {
        type: Number,
        default: 5
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
channelConfigurationSchema.index({ hotelId: 1, channelId: 1 }, { unique: true });
channelConfigurationSchema.index({ 'languageSettings.supportedLanguages.languageCode': 1 });
channelConfigurationSchema.index({ 'currencySettings.supportedCurrencies.currencyCode': 1 });
channelConfigurationSchema.index({ 'status.isActive': 1, 'status.connectionStatus': 1 });

// Virtual for active supported languages
channelConfigurationSchema.virtual('activeSupportedLanguages').get(function() {
  return this.languageSettings.supportedLanguages.filter(lang => lang.isActive);
});

// Virtual for active supported currencies  
channelConfigurationSchema.virtual('activeSupportedCurrencies').get(function() {
  return this.currencySettings.supportedCurrencies.filter(curr => curr.isActive);
});

// Virtual for sync health score
channelConfigurationSchema.virtual('syncHealthScore').get(function() {
  const stats = this.status.syncStats;
  if (stats.totalSyncs === 0) return 0;
  return Math.round((stats.successfulSyncs / stats.totalSyncs) * 100);
});

// Methods
channelConfigurationSchema.methods.isLanguageSupported = function(languageCode) {
  return this.activeSupportedLanguages.some(lang => 
    lang.languageCode === languageCode.toUpperCase()
  );
};

channelConfigurationSchema.methods.isCurrencySupported = function(currencyCode) {
  return this.activeSupportedCurrencies.some(curr => 
    curr.currencyCode === currencyCode.toUpperCase()
  );
};

channelConfigurationSchema.methods.getLanguageConfig = function(languageCode) {
  return this.languageSettings.supportedLanguages.find(lang =>
    lang.languageCode === languageCode.toUpperCase() && lang.isActive
  );
};

channelConfigurationSchema.methods.getCurrencyConfig = function(currencyCode) {
  return this.currencySettings.supportedCurrencies.find(curr =>
    curr.currencyCode === currencyCode.toUpperCase() && curr.isActive
  );
};

channelConfigurationSchema.methods.updateSyncStats = function(success = true, error = null) {
  this.status.syncStats.totalSyncs += 1;
  if (success) {
    this.status.syncStats.successfulSyncs += 1;
    this.status.connectionStatus = 'connected';
  } else {
    this.status.syncStats.failedSyncs += 1;
    this.status.connectionStatus = 'error';
    if (error) {
      this.status.syncStats.lastError = {
        message: error.message,
        timestamp: new Date(),
        code: error.code
      };
    }
  }
  return this.save();
};

// Static methods
channelConfigurationSchema.statics.getByHotelAndChannel = function(hotelId, channelId) {
  return this.findOne({ 
    hotelId: hotelId, 
    channelId: channelId,
    'status.isActive': true 
  });
};

channelConfigurationSchema.statics.getActiveChannelsForHotel = function(hotelId) {
  return this.find({ 
    hotelId: hotelId,
    'status.isActive': true,
    'status.connectionStatus': { $in: ['connected', 'testing'] }
  });
};

channelConfigurationSchema.statics.getChannelsByLanguage = function(languageCode) {
  return this.find({
    'languageSettings.supportedLanguages': {
      $elemMatch: {
        languageCode: languageCode.toUpperCase(),
        isActive: true
      }
    },
    'status.isActive': true
  });
};

channelConfigurationSchema.statics.getChannelsByCurrency = function(currencyCode) {
  return this.find({
    'currencySettings.supportedCurrencies': {
      $elemMatch: {
        currencyCode: currencyCode.toUpperCase(),
        isActive: true
      }
    },
    'status.isActive': true
  });
};

const ChannelConfiguration = mongoose.model('ChannelConfiguration', channelConfigurationSchema);

export default ChannelConfiguration;
