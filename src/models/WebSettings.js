import mongoose from 'mongoose';

const webSettingsSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    required: true,
    index: true
  },

  // General Settings
  general: {
    hotelName: {
      type: String,
      required: false, // Changed from required: true to allow partial updates
      maxlength: 200,
      default: 'My Hotel'
    },
    description: {
      type: String,
      maxlength: 1000
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    },
    contact: {
      phone: String,
      email: {
        type: String,
        lowercase: true
      },
      website: String,
      socialMedia: {
        facebook: String,
        instagram: String,
        twitter: String,
        linkedin: String
      }
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    currency: {
      code: {
        type: String,
        default: 'USD',
        uppercase: true,
        maxlength: 3
      },
      symbol: {
        type: String,
        default: '$'
      },
      position: {
        type: String,
        enum: ['before', 'after'],
        default: 'before'
      }
    },
    languages: [{
      code: {
        type: String,
        required: true,
        maxlength: 5
      },
      name: {
        type: String,
        required: true
      },
      isDefault: {
        type: Boolean,
        default: false
      }
    }]
  },

  // Booking Settings
  booking: {
    minimumStay: {
      type: Number,
      default: 1,
      min: 1,
      max: 365
    },
    maximumStay: {
      type: Number,
      default: 30,
      min: 1,
      max: 365
    },
    advanceBookingLimit: {
      type: Number,
      default: 365,
      min: 1,
      max: 1095
    },
    cutoffTime: {
      hours: {
        type: Number,
        default: 18,
        min: 0,
        max: 23
      },
      minutes: {
        type: Number,
        default: 0,
        min: 0,
        max: 59
      }
    },
    cancellationPolicy: {
      type: {
        type: String,
        enum: ['flexible', 'moderate', 'strict', 'custom'],
        default: 'moderate'
      },
      hoursBeforeCheckin: {
        type: Number,
        default: 24
      },
      penaltyPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      customTerms: String
    },
    checkInTime: {
      type: String,
      default: '15:00'
    },
    checkOutTime: {
      type: String,
      default: '11:00'
    },
    instantConfirmation: {
      type: Boolean,
      default: true
    },
    requiresApproval: {
      type: Boolean,
      default: false
    },
    guestDataRequired: [{
      type: String,
      enum: [
        'full_name', 'email', 'phone', 'address', 'nationality', 
        'passport', 'id_number', 'emergency_contact', 'special_requests',
        'arrival_time', 'departure_time', 'company_details'
      ]
    }]
  },

  // Payment Settings
  payment: {
    gateways: [{
      name: {
        type: String,
        required: true,
        enum: ['stripe', 'paypal', 'razorpay', 'square', 'authorize_net', 'braintree']
      },
      isActive: {
        type: Boolean,
        default: false
      },
      configuration: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      },
      fees: {
        percentage: {
          type: Number,
          default: 0,
          min: 0,
          max: 10
        },
        fixed: {
          type: Number,
          default: 0,
          min: 0
        }
      }
    }],
    acceptedCurrencies: [{
      code: String,
      symbol: String,
      exchangeRate: Number
    }],
    paymentMethods: [{
      type: String,
      enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash', 'cryptocurrency'],
      isActive: Boolean
    }],
    depositRequired: {
      type: Boolean,
      default: false
    },
    depositAmount: {
      type: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
      },
      value: {
        type: Number,
        default: 0
      }
    },
    taxInclusive: {
      type: Boolean,
      default: false
    }
  },

  // SEO Settings
  seo: {
    metaTags: {
      title: String,
      description: String,
      keywords: [String]
    },
    structuredData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    googleBusinessProfile: {
      placeId: String,
      isConnected: {
        type: Boolean,
        default: false
      }
    },
    robots: {
      index: {
        type: Boolean,
        default: true
      },
      follow: {
        type: Boolean,
        default: true
      }
    },
    sitemap: {
      autoGenerate: {
        type: Boolean,
        default: true
      },
      lastGenerated: Date
    }
  },

  // Integration Settings
  integrations: {
    googleAnalytics: {
      isActive: {
        type: Boolean,
        default: false
      },
      trackingId: String,
      measurementId: String
    },
    googleTagManager: {
      isActive: {
        type: Boolean,
        default: false
      },
      containerId: String
    },
    facebookPixel: {
      isActive: {
        type: Boolean,
        default: false
      },
      pixelId: String
    },
    emailMarketing: {
      provider: {
        type: String,
        enum: ['mailchimp', 'sendgrid', 'constant_contact', 'campaign_monitor', 'none'],
        default: 'none'
      },
      apiKey: String,
      listId: String,
      isActive: {
        type: Boolean,
        default: false
      }
    },
    chatWidget: {
      provider: {
        type: String,
        enum: ['intercom', 'zendesk', 'tawk_to', 'crisp', 'none'],
        default: 'none'
      },
      widgetId: String,
      isActive: {
        type: Boolean,
        default: false
      }
    },
    reviewPlatforms: [{
      name: {
        type: String,
        enum: ['google', 'tripadvisor', 'booking_com', 'expedia', 'yelp']
      },
      widgetCode: String,
      isActive: Boolean
    }]
  },

  // Theme Settings
  theme: {
    colorScheme: {
      primary: {
        type: String,
        default: '#2563eb'
      },
      secondary: {
        type: String,
        default: '#64748b'
      },
      accent: {
        type: String,
        default: '#f59e0b'
      },
      background: {
        type: String,
        default: '#ffffff'
      },
      text: {
        type: String,
        default: '#1f2937'
      },
      success: {
        type: String,
        default: '#10b981'
      },
      error: {
        type: String,
        default: '#ef4444'
      },
      warning: {
        type: String,
        default: '#f59e0b'
      }
    },
    typography: {
      primaryFont: {
        type: String,
        default: 'Inter'
      },
      secondaryFont: {
        type: String,
        default: 'Inter'
      },
      fontSize: {
        base: {
          type: String,
          default: '16px'
        },
        scale: {
          type: Number,
          default: 1.125
        }
      }
    },
    layout: {
      maxWidth: {
        type: String,
        default: '1200px'
      },
      borderRadius: {
        type: String,
        default: '8px'
      },
      spacing: {
        type: String,
        default: '1rem'
      }
    },
    customCSS: {
      type: String,
      maxlength: 10000
    }
  },

  // Advanced Settings
  advanced: {
    caching: {
      enabled: {
        type: Boolean,
        default: true
      },
      ttl: {
        type: Number,
        default: 300
      }
    },
    compression: {
      enabled: {
        type: Boolean,
        default: true
      }
    },
    cdn: {
      enabled: {
        type: Boolean,
        default: false
      },
      provider: String,
      endpoint: String
    },
    security: {
      csrfProtection: {
        type: Boolean,
        default: true
      },
      rateLimiting: {
        enabled: {
          type: Boolean,
          default: true
        },
        maxRequests: {
          type: Number,
          default: 100
        },
        windowMinutes: {
          type: Number,
          default: 15
        }
      },
      encryption: {
        algorithm: {
          type: String,
          default: 'AES-256-GCM'
        }
      }
    }
  },

  // Maintenance and Backups
  maintenance: {
    isMaintenanceMode: {
      type: Boolean,
      default: false
    },
    maintenanceMessage: {
      type: String,
      default: 'We are currently performing maintenance. Please check back soon.'
    },
    allowedIPs: [String],
    autoBackup: {
      enabled: {
        type: Boolean,
        default: true
      },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'weekly'
      },
      retention: {
        type: Number,
        default: 30
      }
    }
  },

  // Settings metadata
  version: {
    type: String,
    default: '1.0.0'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastBackup: Date,

  // Audit fields
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: false // Changed from required: true to handle cases where user is not authenticated
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
webSettingsSchema.index({ hotelId: 1 });
webSettingsSchema.index({ 'general.hotelName': 1 });
webSettingsSchema.index({ isActive: 1 });
webSettingsSchema.index({ updatedAt: -1 });

// Ensure only one active settings per hotel
webSettingsSchema.index({ hotelId: 1, isActive: 1 }, { 
  unique: true, 
  partialFilterExpression: { isActive: true } 
});

// Virtual for full hotel address
webSettingsSchema.virtual('general.fullAddress').get(function() {
  if (!this.general.address) return '';
  
  const { street, city, state, country, postalCode } = this.general.address;
  const parts = [street, city, state, country, postalCode].filter(Boolean);
  return parts.join(', ');
});

// Virtual for supported languages count
webSettingsSchema.virtual('general.languagesCount').get(function() {
  return this.general.languages ? this.general.languages.length : 0;
});

// Virtual for active payment gateways
webSettingsSchema.virtual('payment.activeGateways').get(function() {
  if (!this.payment.gateways) return [];
  return this.payment.gateways.filter(gateway => gateway.isActive);
});

// Virtual for active integrations count
webSettingsSchema.virtual('integrations.activeCount').get(function() {
  let count = 0;
  if (this.integrations.googleAnalytics?.isActive) count++;
  if (this.integrations.googleTagManager?.isActive) count++;
  if (this.integrations.facebookPixel?.isActive) count++;
  if (this.integrations.emailMarketing?.isActive) count++;
  if (this.integrations.chatWidget?.isActive) count++;
  return count;
});

// Instance methods
webSettingsSchema.methods.getDefaultLanguage = function() {
  if (!this.general.languages) return null;
  return this.general.languages.find(lang => lang.isDefault) || this.general.languages[0];
};

webSettingsSchema.methods.isPaymentGatewayActive = function(gatewayName) {
  if (!this.payment.gateways) return false;
  const gateway = this.payment.gateways.find(g => g.name === gatewayName);
  return gateway ? gateway.isActive : false;
};

webSettingsSchema.methods.createBackup = function() {
  const backup = {
    settingsId: this._id,
    hotelId: this.hotelId,
    data: this.toObject(),
    createdAt: new Date()
  };
  
  // Remove sensitive information from backup
  if (backup.data.payment) {
    backup.data.payment.gateways = backup.data.payment.gateways.map(gateway => ({
      ...gateway,
      configuration: {} // Remove sensitive config data
    }));
  }
  
  if (backup.data.integrations) {
    const sensitiveFields = ['apiKey', 'trackingId', 'measurementId', 'pixelId'];
    sensitiveFields.forEach(field => {
      Object.keys(backup.data.integrations).forEach(key => {
        if (backup.data.integrations[key] && backup.data.integrations[key][field]) {
          backup.data.integrations[key][field] = '***REDACTED***';
        }
      });
    });
  }
  
  return backup;
};

// Static methods
webSettingsSchema.statics.getActiveSettings = function(hotelId) {
  return this.findOne({ hotelId, isActive: true }).populate('createdBy updatedBy', 'name email');
};

webSettingsSchema.statics.createDefaultSettings = function(hotelId, userId) {
  const defaultSettings = new this({
    hotelId,
    createdBy: userId,
    general: {
      hotelName: 'My Hotel',
      languages: [{
        code: 'en',
        name: 'English',
        isDefault: true
      }]
    }
  });
  
  return defaultSettings.save();
};

webSettingsSchema.statics.importSettings = function(hotelId, settingsData, userId) {
  return this.findOneAndUpdate(
    { hotelId },
    {
      ...settingsData,
      hotelId,
      updatedBy: userId,
      updatedAt: new Date()
    },
    {
      upsert: true,
      new: true,
      runValidators: true
    }
  );
};

// Pre-save middleware
webSettingsSchema.pre('save', function(next) {
  // Ensure only one default language
  if (this.general.languages && this.general.languages.length > 0) {
    const defaultLanguages = this.general.languages.filter(lang => lang.isDefault);
    if (defaultLanguages.length === 0) {
      this.general.languages[0].isDefault = true;
    } else if (defaultLanguages.length > 1) {
      // Set first default language and remove default from others
      let foundFirst = false;
      this.general.languages.forEach(lang => {
        if (lang.isDefault && !foundFirst) {
          foundFirst = true;
        } else {
          lang.isDefault = false;
        }
      });
    }
  }

  // Validate minimum/maximum stay
  if (this.booking.minimumStay > this.booking.maximumStay) {
    return next(new Error('Minimum stay cannot be greater than maximum stay'));
  }

  // Validate deposit amount
  if (this.payment.depositRequired && this.payment.depositAmount.value <= 0) {
    return next(new Error('Deposit amount must be greater than 0 when deposit is required'));
  }

  next();
});

// Post-save middleware
webSettingsSchema.post('save', function() {
  // Update lastBackup timestamp
  if (this.maintenance.autoBackup.enabled) {
    this.lastBackup = new Date();
  }
});

const WebSettings = mongoose.model('WebSettings', webSettingsSchema);

export default WebSettings;
