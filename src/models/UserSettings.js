import mongoose from 'mongoose';

const userSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['admin', 'staff', 'guest', 'travel_agent'],
    required: true
  },
  // Profile Settings
  profile: {
    name: String,
    email: String,
    phone: String,
    avatar: String,
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en'
    },
    dateOfBirth: Date,
    nationality: String,
    department: String, // For staff
    employeeId: String, // For staff
    // Guest preferences
    preferences: {
      roomType: String,
      floor: String,
      bedType: String,
      smoking: {
        type: Boolean,
        default: false
      },
      dietaryRestrictions: [String]
    }
  },

  // Hotel Settings (Admin only)
  hotel: {
    name: String,
    address: String,
    contact: {
      phone: String,
      email: String,
      website: String
    },
    policies: {
      checkInTime: {
        type: String,
        default: '15:00'
      },
      checkOutTime: {
        type: String,
        default: '11:00'
      },
      cancellationPolicy: String,
      childPolicy: String,
      petPolicy: String
    },
    taxes: {
      gst: {
        type: Number,
        default: 18
      },
      serviceCharge: {
        type: Number,
        default: 10
      },
      localTax: {
        type: Number,
        default: 0
      }
    }
  },

  // Notification Settings
  notifications: {
    channels: {
      inApp: {
        type: Boolean,
        default: true
      },
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    },
    categories: {
      // Admin categories
      bookings: {
        type: Boolean,
        default: true
      },
      payments: {
        type: Boolean,
        default: true
      },
      system: {
        type: Boolean,
        default: true
      },
      maintenance: {
        type: Boolean,
        default: true
      },

      // Staff categories
      workAssignments: {
        type: Boolean,
        default: true
      },
      guestRequests: {
        type: Boolean,
        default: true
      },
      scheduleChanges: {
        type: Boolean,
        default: true
      },
      emergencyAlerts: {
        type: Boolean,
        default: true
      },

      // Guest categories
      bookingUpdates: {
        type: Boolean,
        default: true
      },
      serviceAlerts: {
        type: Boolean,
        default: true
      },
      promotions: {
        type: Boolean,
        default: false
      },
      loyaltyUpdates: {
        type: Boolean,
        default: true
      },
      reviewRequests: {
        type: Boolean,
        default: true
      },

      // Travel Agent categories
      commissionUpdates: {
        type: Boolean,
        default: true
      },
      rateChanges: {
        type: Boolean,
        default: true
      }
    },
    quietHours: {
      enabled: {
        type: Boolean,
        default: false
      },
      start: {
        type: String,
        default: '22:00'
      },
      end: {
        type: String,
        default: '07:00'
      }
    },
    sound: {
      type: Boolean,
      default: true
    },
    desktop: {
      type: Boolean,
      default: true
    },
    vibration: {
      type: Boolean,
      default: true
    }
  },

  // Display Settings
  display: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    sidebarCollapsed: {
      type: Boolean,
      default: false
    },
    compactView: {
      type: Boolean,
      default: false
    },
    language: {
      type: String,
      default: 'en'
    },
    dateFormat: {
      type: String,
      default: 'DD/MM/YYYY'
    },
    timeFormat: {
      type: String,
      enum: ['12h', '24h'],
      default: '24h'
    },
    currency: {
      type: String,
      default: 'USD'
    },
    numberFormat: {
      type: String,
      default: 'en-US'
    },
    quickActions: [String] // Customizable quick action buttons
  },

  // System Settings (Admin only)
  system: {
    twoFactorAuth: {
      type: Boolean,
      default: false
    },
    sessionTimeout: {
      type: Number,
      default: 3600000 // 1 hour in milliseconds
    },
    apiKeys: [{
      name: String,
      key: String,
      permissions: [String],
      createdAt: {
        type: Date,
        default: Date.now
      },
      lastUsed: Date,
      isActive: {
        type: Boolean,
        default: true
      }
    }],
    backupSchedule: {
      type: String,
      default: 'daily'
    },
    dataRetention: {
      type: Number,
      default: 365 // days
    }
  },

  // Integration Settings (Admin only)
  integrations: {
    payment: {
      stripe: {
        enabled: {
          type: Boolean,
          default: false
        },
        publicKey: String,
        secretKey: String
      },
      razorpay: {
        enabled: {
          type: Boolean,
          default: false
        },
        keyId: String,
        keySecret: String
      }
    },
    ota: {
      booking: {
        enabled: {
          type: Boolean,
          default: false
        },
        apiKey: String,
        commission: Number
      },
      expedia: {
        enabled: {
          type: Boolean,
          default: false
        },
        apiKey: String,
        commission: Number
      }
    },
    analytics: {
      googleAnalytics: {
        enabled: {
          type: Boolean,
          default: false
        },
        trackingId: String
      },
      mixpanel: {
        enabled: {
          type: Boolean,
          default: false
        },
        token: String
      }
    }
  },

  // Staff Availability Settings
  availability: {
    status: {
      type: String,
      enum: ['available', 'busy', 'break', 'offline'],
      default: 'available'
    },
    autoStatusChange: {
      type: Boolean,
      default: true
    },
    breakReminder: {
      type: Boolean,
      default: true
    }
  },

  // Communication Settings (Guest/Travel Agent)
  communication: {
    preferredChannel: {
      type: String,
      enum: ['email', 'sms', 'whatsapp', 'in_app'],
      default: 'email'
    },
    marketingConsent: {
      type: Boolean,
      default: false
    }
  },

  // Privacy Settings (Guest)
  privacy: {
    dataSharing: {
      type: Boolean,
      default: false
    },
    locationTracking: {
      type: Boolean,
      default: false
    },
    analyticsTracking: {
      type: Boolean,
      default: true
    }
  },

  // Travel Agent Settings
  travelAgent: {
    bookingPreferences: {
      autoConfirm: {
        type: Boolean,
        default: false
      },
      defaultCommission: {
        type: Number,
        default: 10
      },
      preferredRoomTypes: [String],
      paymentTerms: {
        type: String,
        default: 'immediate'
      }
    },
    businessInfo: {
      companyName: String,
      licenseNumber: String,
      taxId: String,
      address: String
    }
  },

  // Metadata
  lastModified: {
    type: Date,
    default: Date.now
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
  timestamps: true
});

// Indexes
userSettingsSchema.index({ userId: 1 });
userSettingsSchema.index({ role: 1 });
userSettingsSchema.index({ 'profile.email': 1 });

// Instance Methods
userSettingsSchema.methods.getSettingsByCategory = function(category) {
  return this[category] || {};
};

userSettingsSchema.methods.updateCategory = function(category, settings) {
  if (this[category]) {
    Object.assign(this[category], settings);
    this.lastModified = new Date();
    this.version += 1;
  }
  return this;
};

// Static Methods
userSettingsSchema.statics.getDefaultSettings = function(role) {
  const baseSettings = {
    notifications: {
      channels: { inApp: true, email: true, sms: false, push: true },
      quietHours: { enabled: false, start: '22:00', end: '07:00' },
      sound: true,
      desktop: true
    },
    display: {
      theme: 'light',
      language: 'en',
      timeFormat: '24h',
      currency: 'USD'
    }
  };

  const roleSpecificSettings = {
    admin: {
      notifications: {
        categories: {
          bookings: true,
          payments: true,
          system: true,
          maintenance: true
        }
      }
    },
    staff: {
      notifications: {
        categories: {
          workAssignments: true,
          guestRequests: true,
          scheduleChanges: true,
          emergencyAlerts: true
        }
      },
      availability: {
        status: 'available',
        autoStatusChange: true,
        breakReminder: true
      }
    },
    guest: {
      notifications: {
        categories: {
          bookingUpdates: true,
          serviceAlerts: true,
          promotions: false,
          loyaltyUpdates: true
        }
      },
      privacy: {
        dataSharing: false,
        locationTracking: false,
        analyticsTracking: true
      }
    },
    travel_agent: {
      notifications: {
        categories: {
          commissionUpdates: true,
          rateChanges: true,
          bookingUpdates: true
        }
      },
      travelAgent: {
        bookingPreferences: {
          autoConfirm: false,
          defaultCommission: 10
        }
      }
    }
  };

  return {
    ...baseSettings,
    ...roleSpecificSettings[role]
  };
};

userSettingsSchema.statics.createDefaultSettings = async function(userId, role) {
  const defaultSettings = this.getDefaultSettings(role);

  const userSettings = new this({
    userId,
    role,
    ...defaultSettings
  });

  return await userSettings.save();
};

// Pre-save middleware for validation and defaults
userSettingsSchema.pre('save', function(next) {
  this.lastModified = new Date();

  // Role-specific validation
  if (this.role === 'admin' && !this.hotel) {
    this.hotel = {
      policies: {
        checkInTime: '15:00',
        checkOutTime: '11:00'
      },
      taxes: {
        gst: 18,
        serviceCharge: 10,
        localTax: 0
      }
    };
  }

  next();
});

// Settings migration method
userSettingsSchema.methods.migrate = function() {
  // Handle settings structure changes between versions
  const currentVersion = 1;

  if (this.version < currentVersion) {
    // Add migration logic here for future versions
    this.version = currentVersion;
  }

  return this;
};

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);

export default UserSettings;