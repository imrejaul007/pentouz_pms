import mongoose from 'mongoose';

const userPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: false // Guests may not have a specific hotel
  },

  // Profile preferences (common to all roles)
  profile: {
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },
    language: {
      type: String,
      default: 'en'
    },
    avatar: String
  },

  // Notification preferences
  notifications: {
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    categories: {
      systemAlerts: { type: Boolean, default: true },
      bookingUpdates: { type: Boolean, default: true },
      paymentNotifications: { type: Boolean, default: true },
      guestRequests: { type: Boolean, default: true },
      inventoryAlerts: { type: Boolean, default: true },
      staffNotifications: { type: Boolean, default: true },
      maintenanceAlerts: { type: Boolean, default: true },
      securityNotifications: { type: Boolean, default: true },
      workAssignments: { type: Boolean, default: true },
      scheduleChanges: { type: Boolean, default: true },
      emergencyAlerts: { type: Boolean, default: true },
      serviceAlerts: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
      loyaltyUpdates: { type: Boolean, default: true },
      reviewRequests: { type: Boolean, default: true }
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: '22:00' },
      end: { type: String, default: '08:00' }
    },
    sound: { type: Boolean, default: true },
    desktop: { type: Boolean, default: true },
    vibration: { type: Boolean, default: true },
    frequency: {
      type: String,
      enum: ['instant', 'hourly', 'daily'],
      default: 'instant'
    }
  },

  // Display preferences
  display: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    sidebarCollapsed: { type: Boolean, default: false },
    compactView: { type: Boolean, default: false },
    highContrast: { type: Boolean, default: false },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    timeFormat: {
      type: String,
      enum: ['12h', '24h'],
      default: '24h'
    },
    currency: { type: String, default: 'INR' },
    numberFormat: { type: String, default: 'en-IN' }
  },

  // Staff-specific preferences
  staff: {
    department: String,
    employeeId: String,
    availability: {
      status: {
        type: String,
        enum: ['available', 'busy', 'break', 'offline'],
        default: 'available'
      },
      autoStatusChange: { type: Boolean, default: true },
      breakReminder: { type: Boolean, default: true },
      breakDuration: { type: Number, default: 15 }, // minutes
      maxTasksPerHour: { type: Number, default: 8 }
    },
    quickActions: [{
      type: String,
      enum: ['daily-check', 'guest-request', 'maintenance', 'inventory', 'housekeeping']
    }]
  },

  // Guest-specific preferences
  guest: {
    stayPreferences: {
      roomType: {
        type: String,
        enum: ['Standard', 'Deluxe', 'Suite', 'Executive'],
        default: 'Deluxe'
      },
      floor: {
        type: String,
        enum: ['Any', 'High', 'Low'],
        default: 'Any'
      },
      bedType: {
        type: String,
        enum: ['Single', 'Double', 'Twin', 'King'],
        default: 'Double'
      },
      smoking: { type: Boolean, default: false },
      dietaryRestrictions: [{
        type: String,
        enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'halal', 'kosher']
      }]
    },
    communication: {
      preferredChannel: {
        type: String,
        enum: ['email', 'sms', 'whatsapp', 'in_app'],
        default: 'email'
      },
      marketingConsent: { type: Boolean, default: false }
    },
    privacy: {
      dataSharing: { type: Boolean, default: false },
      locationTracking: { type: Boolean, default: true },
      analyticsTracking: { type: Boolean, default: false }
    }
  },

  // System preferences (admin only)
  system: {
    twoFactorAuth: { type: Boolean, default: false },
    sessionTimeout: { type: Number, default: 60 }, // minutes
    autoLogout: { type: Boolean, default: true },
    passwordExpiry: { type: Number, default: 90 }, // days
    loginAttempts: { type: Number, default: 5 },
    backupSchedule: {
      type: String,
      enum: ['hourly', 'daily', 'weekly', 'monthly'],
      default: 'daily'
    },
    dataRetention: { type: Number, default: 365 } // days
  }
}, {
  timestamps: true
});

// Indexes for better performance
userPreferenceSchema.index({ userId: 1 });
userPreferenceSchema.index({ hotelId: 1 });

// Static methods
userPreferenceSchema.statics.getOrCreateForUser = async function(userId, hotelId = null) {
  let preference = await this.findOne({ userId });

  if (!preference) {
    preference = await this.create({
      userId,
      hotelId,
      // Use default values from schema
    });
  }

  return preference;
};

userPreferenceSchema.statics.updatePreferences = async function(userId, updates) {
  return await this.findOneAndUpdate(
    { userId },
    { $set: updates },
    { new: true, upsert: true }
  );
};

// Instance methods
userPreferenceSchema.methods.updateNotificationSettings = function(settings) {
  this.notifications = { ...this.notifications, ...settings };
  return this.save();
};

userPreferenceSchema.methods.updateDisplaySettings = function(settings) {
  this.display = { ...this.display, ...settings };
  return this.save();
};

userPreferenceSchema.methods.updateStaffSettings = function(settings) {
  this.staff = { ...this.staff, ...settings };
  return this.save();
};

userPreferenceSchema.methods.updateGuestSettings = function(settings) {
  this.guest = { ...this.guest, ...settings };
  return this.save();
};

const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

export default UserPreference;