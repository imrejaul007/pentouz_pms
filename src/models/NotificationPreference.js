import mongoose from 'mongoose';

const notificationPreferenceSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.ObjectId, 
    ref: 'User', 
    required: [true, 'User ID is required'], 
    unique: true,
    index: true 
  },
  hotelId: { 
    type: mongoose.Schema.ObjectId, 
    ref: 'Hotel', 
    required: false, // Made optional to support guests without hotelId
    index: true 
  },
  email: {
    enabled: { type: Boolean, default: true },
    address: { 
      type: String, 
      lowercase: true,
      trim: true,
      validate: {
        validator: function(value) {
          return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        message: 'Please provide a valid email address'
      }
    },
    types: {
      booking_confirmation: { type: Boolean, default: true },
      booking_reminder: { type: Boolean, default: true },
      booking_cancellation: { type: Boolean, default: true },
      payment_success: { type: Boolean, default: true },
      payment_failed: { type: Boolean, default: true },
      loyalty_points: { type: Boolean, default: true },
      service_booking: { type: Boolean, default: true },
      service_reminder: { type: Boolean, default: true },
      promotional: { type: Boolean, default: true },
      system_alert: { type: Boolean, default: true },
      welcome: { type: Boolean, default: true },
      check_in: { type: Boolean, default: true },
      check_out: { type: Boolean, default: true },
      review_request: { type: Boolean, default: true },
      special_offer: { type: Boolean, default: true }
    },
    frequency: { 
      type: String, 
      enum: ['immediate', 'hourly', 'daily', 'weekly'], 
      default: 'immediate' 
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { 
        type: String, 
        default: '22:00',
        validate: {
          validator: function(value) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
          },
          message: 'Start time must be in HH:MM format'
        }
      },
      end: { 
        type: String, 
        default: '08:00',
        validate: {
          validator: function(value) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
          },
          message: 'End time must be in HH:MM format'
        }
      }
    }
  },
  sms: {
    enabled: { type: Boolean, default: false },
    number: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(value) {
          return !value || /^\+?[1-9]\d{1,14}$/.test(value.replace(/\s/g, ''));
        },
        message: 'Please provide a valid phone number'
      }
    },
    types: {
      booking_confirmation: { type: Boolean, default: true },
      booking_reminder: { type: Boolean, default: true },
      booking_cancellation: { type: Boolean, default: true },
      payment_success: { type: Boolean, default: true },
      payment_failed: { type: Boolean, default: true },
      loyalty_points: { type: Boolean, default: false },
      service_booking: { type: Boolean, default: true },
      service_reminder: { type: Boolean, default: true },
      promotional: { type: Boolean, default: false },
      system_alert: { type: Boolean, default: true },
      welcome: { type: Boolean, default: true },
      check_in: { type: Boolean, default: true },
      check_out: { type: Boolean, default: true },
      review_request: { type: Boolean, default: false },
      special_offer: { type: Boolean, default: false }
    },
    frequency: { 
      type: String, 
      enum: ['immediate', 'hourly', 'daily'], 
      default: 'immediate' 
    },
    quietHours: {
      enabled: { type: Boolean, default: true },
      start: { 
        type: String, 
        default: '22:00',
        validate: {
          validator: function(value) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
          },
          message: 'Start time must be in HH:MM format'
        }
      },
      end: { 
        type: String, 
        default: '08:00',
        validate: {
          validator: function(value) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
          },
          message: 'End time must be in HH:MM format'
        }
      }
    }
  },
  push: {
    enabled: { type: Boolean, default: true },
    token: { type: String, trim: true },
    deviceInfo: {
      platform: { type: String, enum: ['web', 'ios', 'android'] },
      version: { type: String },
      model: { type: String }
    },
    types: {
      booking_confirmation: { type: Boolean, default: true },
      booking_reminder: { type: Boolean, default: true },
      booking_cancellation: { type: Boolean, default: true },
      payment_success: { type: Boolean, default: true },
      payment_failed: { type: Boolean, default: true },
      loyalty_points: { type: Boolean, default: true },
      service_booking: { type: Boolean, default: true },
      service_reminder: { type: Boolean, default: true },
      promotional: { type: Boolean, default: true },
      system_alert: { type: Boolean, default: true },
      welcome: { type: Boolean, default: true },
      check_in: { type: Boolean, default: true },
      check_out: { type: Boolean, default: true },
      review_request: { type: Boolean, default: true },
      special_offer: { type: Boolean, default: true }
    },
    frequency: { 
      type: String, 
      enum: ['immediate', 'hourly', 'daily'], 
      default: 'immediate' 
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { 
        type: String, 
        default: '22:00',
        validate: {
          validator: function(value) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
          },
          message: 'Start time must be in HH:MM format'
        }
      },
      end: { 
        type: String, 
        default: '08:00',
        validate: {
          validator: function(value) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
          },
          message: 'End time must be in HH:MM format'
        }
      }
    }
  },
  inApp: {
    enabled: { type: Boolean, default: true },
    types: {
      booking_confirmation: { type: Boolean, default: true },
      booking_reminder: { type: Boolean, default: true },
      booking_cancellation: { type: Boolean, default: true },
      payment_success: { type: Boolean, default: true },
      payment_failed: { type: Boolean, default: true },
      loyalty_points: { type: Boolean, default: true },
      service_booking: { type: Boolean, default: true },
      service_reminder: { type: Boolean, default: true },
      promotional: { type: Boolean, default: true },
      system_alert: { type: Boolean, default: true },
      welcome: { type: Boolean, default: true },
      check_in: { type: Boolean, default: true },
      check_out: { type: Boolean, default: true },
      review_request: { type: Boolean, default: true },
      special_offer: { type: Boolean, default: true }
    },
    sound: { type: Boolean, default: true },
    vibration: { type: Boolean, default: true },
    showBadge: { type: Boolean, default: true }
  },
  global: {
    enabled: { type: Boolean, default: true },
    language: { type: String, default: 'en', enum: ['en', 'es', 'fr', 'de', 'hi', 'zh'] },
    timezone: { type: String, default: 'UTC' },
    digest: {
      enabled: { type: Boolean, default: false },
      frequency: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
      time: { type: String, default: '09:00' }
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
notificationPreferenceSchema.index({ userId: 1, hotelId: 1 });

// Virtual for checking if any channel is enabled
notificationPreferenceSchema.virtual('hasEnabledChannels').get(function() {
  return this.email.enabled || this.sms.enabled || this.push.enabled || this.inApp.enabled;
});

// Virtual for getting all enabled channels
notificationPreferenceSchema.virtual('enabledChannels').get(function() {
  const channels = [];
  if (this.email.enabled) channels.push('email');
  if (this.sms.enabled) channels.push('sms');
  if (this.push.enabled) channels.push('push');
  if (this.inApp.enabled) channels.push('in_app');
  return channels;
});

// Static method to get or create preferences for a user
notificationPreferenceSchema.statics.getOrCreate = function(userId, hotelId) {
  const updateData = { userId };
  
  // Only set hotelId if it's provided
  if (hotelId) {
    updateData.hotelId = hotelId;
  }
  
  return this.findOneAndUpdate(
    { userId },
    { 
      ...updateData,
      $setOnInsert: {
        'email.address': '', // Will be populated from user profile
        'sms.number': '', // Will be populated from user profile
        'push.token': '',
        'global.timezone': 'UTC'
      }
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true 
    }
  );
};

// Static method to update channel settings
notificationPreferenceSchema.statics.updateChannelSettings = function(userId, channel, settings) {
  const updatePath = {};
  Object.keys(settings).forEach(key => {
    updatePath[`${channel}.${key}`] = settings[key];
  });
  
  return this.findOneAndUpdate(
    { userId },
    { $set: updatePath },
    { new: true }
  );
};

// Static method to update notification type settings
notificationPreferenceSchema.statics.updateTypeSettings = function(userId, channel, type, enabled) {
  return this.findOneAndUpdate(
    { userId },
    { $set: { [`${channel}.types.${type}`]: enabled } },
    { new: true }
  );
};

// Instance method to check if a notification type is enabled for a channel
notificationPreferenceSchema.methods.isTypeEnabled = function(channel, type) {
  if (!this[channel] || !this[channel].enabled) {
    return false;
  }
  
  return this[channel].types && this[channel].types[type] !== false;
};

// Instance method to check if quiet hours are active
notificationPreferenceSchema.methods.isInQuietHours = function(channel) {
  const channelSettings = this[channel];
  if (!channelSettings || !channelSettings.quietHours || !channelSettings.quietHours.enabled) {
    return false;
  }
  
  const now = new Date();
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const start = channelSettings.quietHours.start;
  const end = channelSettings.quietHours.end;
  
  if (start <= end) {
    return currentTime >= start && currentTime <= end;
  } else {
    // Handles overnight quiet hours (e.g., 22:00 to 08:00)
    return currentTime >= start || currentTime <= end;
  }
};

// Instance method to get allowed channels for a notification type
notificationPreferenceSchema.methods.getAllowedChannels = function(type) {
  const allowedChannels = [];
  
  if (this.email.enabled && this.isTypeEnabled('email', type) && !this.isInQuietHours('email')) {
    allowedChannels.push('email');
  }
  
  if (this.sms.enabled && this.isTypeEnabled('sms', type) && !this.isInQuietHours('sms')) {
    allowedChannels.push('sms');
  }
  
  if (this.push.enabled && this.isTypeEnabled('push', type) && !this.isInQuietHours('push')) {
    allowedChannels.push('push');
  }
  
  if (this.inApp.enabled && this.isTypeEnabled('inApp', type)) {
    allowedChannels.push('in_app');
  }
  
  return allowedChannels;
};

// Pre-save middleware to validate quiet hours
notificationPreferenceSchema.pre('save', function(next) {
  const channels = ['email', 'sms', 'push'];
  
  for (const channel of channels) {
    if (this[channel] && this[channel].quietHours && this[channel].quietHours.enabled) {
      const start = this[channel].quietHours.start;
      const end = this[channel].quietHours.end;
      
      if (!start || !end) {
        return next(new Error(`${channel} quiet hours must have both start and end times`));
      }
    }
  }
  
  next();
});

export default mongoose.model('NotificationPreference', notificationPreferenceSchema);
