import mongoose from 'mongoose';

const hotelSettingsSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    unique: true
  },

  // Basic hotel information
  basicInfo: {
    name: {
      type: String,
      required: true
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
      postalCode: String
    },
    contact: {
      phone: { type: String, required: true },
      email: {
        type: String,
        required: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
      },
      website: {
        type: String,
        match: [/^https?:\/\//, 'Website must start with http:// or https://']
      }
    }
  },

  // Operational settings
  operations: {
    checkInTime: {
      type: String,
      required: true,
      default: '15:00'
    },
    checkOutTime: {
      type: String,
      required: true,
      default: '11:00'
    },
    currency: {
      type: String,
      default: 'INR'
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    }
  },

  // Hotel policies
  policies: {
    cancellation: {
      type: String,
      default: '24 hours before check-in'
    },
    child: {
      type: String,
      default: 'Children under 12 stay free with parents'
    },
    pet: {
      type: String,
      default: 'Pets are not allowed'
    },
    smoking: {
      type: String,
      default: 'Smoking is not permitted in rooms'
    },
    extraBed: {
      type: String,
      default: 'Extra beds available on request'
    }
  },

  // Taxes and charges
  taxes: {
    gst: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 12
    },
    serviceCharge: {
      type: Number,
      min: 0,
      max: 100,
      default: 10
    },
    localTax: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    tourismTax: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },

  // Integration settings
  integrations: {
    payment: {
      stripe: {
        enabled: { type: Boolean, default: false },
        publicKey: String,
        secretKey: String, // This should be encrypted in production
        webhookSecret: String
      },
      razorpay: {
        enabled: { type: Boolean, default: false },
        keyId: String,
        keySecret: String // This should be encrypted in production
      }
    },
    ota: {
      booking: {
        enabled: { type: Boolean, default: false },
        apiKey: String, // Encrypted
        hotelId: String
      },
      expedia: {
        enabled: { type: Boolean, default: false },
        apiKey: String, // Encrypted
        hotelId: String
      }
    },
    analytics: {
      googleAnalytics: {
        enabled: { type: Boolean, default: false },
        trackingId: String
      },
      mixpanel: {
        enabled: { type: Boolean, default: false },
        token: String
      }
    },
    communication: {
      email: {
        provider: {
          type: String,
          enum: ['smtp', 'sendgrid', 'mailgun'],
          default: 'smtp'
        },
        settings: mongoose.Schema.Types.Mixed
      },
      sms: {
        provider: {
          type: String,
          enum: ['twilio', 'textlocal', 'msg91']
        },
        settings: mongoose.Schema.Types.Mixed
      }
    }
  },

  // Amenities and features
  amenities: [{
    name: String,
    category: {
      type: String,
      enum: ['room', 'hotel', 'business', 'recreation', 'dining']
    },
    enabled: { type: Boolean, default: true },
    chargeable: { type: Boolean, default: false },
    price: Number
  }],

  // Room configuration defaults
  roomDefaults: {
    maxOccupancy: { type: Number, default: 4 },
    maxChildren: { type: Number, default: 2 },
    maxInfants: { type: Number, default: 1 },
    extraBedCharge: { type: Number, default: 0 },
    childCharge: { type: Number, default: 0 }
  },

  // Notification settings for the hotel
  notifications: {
    bookingThreshold: { type: Number, default: 5 }, // Alert when rooms < threshold
    maintenanceReminders: { type: Boolean, default: true },
    inventoryAlerts: { type: Boolean, default: true },
    lowStockThreshold: { type: Number, default: 10 },
    overdueCheckouts: { type: Boolean, default: true },
    noShowAlerts: { type: Boolean, default: true }
  },

  // Security settings
  security: {
    requireTwoFactor: { type: Boolean, default: false },
    passwordPolicy: {
      minLength: { type: Number, default: 8 },
      requireUppercase: { type: Boolean, default: true },
      requireNumbers: { type: Boolean, default: true },
      requireSymbols: { type: Boolean, default: false },
      expireDays: { type: Number, default: 90 }
    },
    sessionSettings: {
      timeout: { type: Number, default: 60 }, // minutes
      maxConcurrentSessions: { type: Number, default: 5 }
    },
    maxLoginAttempts: { type: Number, default: 5 }, // max failed login attempts before lockout
    ipRestrictions: [String], // Array of allowed IP addresses/ranges
    auditLog: { type: Boolean, default: true }
  },

  // Backup and maintenance
  maintenance: {
    autoBackup: { type: Boolean, default: true },
    backupSchedule: {
      type: String,
      enum: ['hourly', 'daily', 'weekly'],
      default: 'daily'
    },
    backupRetention: { type: Number, default: 30 }, // days
    maintenanceWindow: {
      start: { type: String, default: '02:00' },
      end: { type: String, default: '04:00' },
      timezone: { type: String, default: 'Asia/Kolkata' }
    }
  }
}, {
  timestamps: true
});

// Indexes
hotelSettingsSchema.index({ hotelId: 1 });

// Static methods
hotelSettingsSchema.statics.getOrCreateForHotel = async function(hotelId, defaultSettings = {}) {
  let settings = await this.findOne({ hotelId });

  if (!settings) {
    settings = await this.create({
      hotelId,
      ...defaultSettings
    });
  }

  return settings;
};

hotelSettingsSchema.statics.updateHotelSettings = async function(hotelId, updates) {
  return await this.findOneAndUpdate(
    { hotelId },
    { $set: updates },
    { new: true, upsert: true }
  );
};

// Instance methods
hotelSettingsSchema.methods.updateBasicInfo = function(info) {
  this.basicInfo = { ...this.basicInfo, ...info };
  return this.save();
};

hotelSettingsSchema.methods.updatePolicies = function(policies) {
  this.policies = { ...this.policies, ...policies };
  return this.save();
};

hotelSettingsSchema.methods.updateTaxes = function(taxes) {
  this.taxes = { ...this.taxes, ...taxes };
  return this.save();
};

hotelSettingsSchema.methods.updateIntegrations = function(integrations) {
  this.integrations = { ...this.integrations, ...integrations };
  return this.save();
};

hotelSettingsSchema.methods.enableIntegration = function(type, service, config) {
  if (!this.integrations[type]) {
    this.integrations[type] = {};
  }
  if (!this.integrations[type][service]) {
    this.integrations[type][service] = {};
  }

  this.integrations[type][service] = { ...this.integrations[type][service], ...config, enabled: true };
  return this.save();
};

hotelSettingsSchema.methods.disableIntegration = function(type, service) {
  if (this.integrations[type] && this.integrations[type][service]) {
    this.integrations[type][service].enabled = false;
  }
  return this.save();
};

// Validation for tax percentages
hotelSettingsSchema.pre('save', function(next) {
  if (this.taxes) {
    const taxFields = ['gst', 'serviceCharge', 'localTax', 'tourismTax'];
    for (const field of taxFields) {
      if (this.taxes[field] && (this.taxes[field] < 0 || this.taxes[field] > 100)) {
        return next(new Error(`${field} must be between 0 and 100`));
      }
    }
  }
  next();
});

const HotelSettings = mongoose.model('HotelSettings', hotelSettingsSchema);

export default HotelSettings;