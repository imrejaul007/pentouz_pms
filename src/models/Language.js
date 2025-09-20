import mongoose from 'mongoose';
import logger from '../utils/logger.js';

/**
 * Language Schema
 * 
 * Manages supported languages, locales, and regional preferences for the hotel system.
 * Supports language-specific formatting, translation management, and content localization.
 */
const languageSchema = new mongoose.Schema({
  // Language identification
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 2,
    maxlength: 3,
    index: true,
    validate: {
      validator: function(code) {
        // Validate ISO 639-1 (2-letter) or ISO 639-2 (3-letter) language codes
        return /^[A-Z]{2,3}$/.test(code);
      },
      message: 'Language code must be a valid ISO 639 code (2-3 letters)'
    }
  },

  // Full language name in English
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },

  // Native language name (in its own language)
  nativeName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },

  // Locale information for formatting
  locale: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(locale) {
        // Validate locale format: language-country (e.g., en-us, fr-fr, de-de)
        return /^[a-z]{2,3}-[a-z]{2}$/.test(locale);
      },
      message: 'Locale must be in format: language-country (e.g., en-us, fr-fr)'
    }
  },

  // Writing direction
  direction: {
    type: String,
    enum: ['ltr', 'rtl'],
    default: 'ltr'
  },

  // Regional and formatting preferences
  formatting: {
    // Date format preferences
    dateFormat: {
      short: { type: String, default: 'MM/DD/YYYY' }, // 12/31/2024
      medium: { type: String, default: 'MMM D, YYYY' }, // Dec 31, 2024
      long: { type: String, default: 'MMMM D, YYYY' }, // December 31, 2024
      full: { type: String, default: 'dddd, MMMM D, YYYY' } // Monday, December 31, 2024
    },

    // Time format preferences
    timeFormat: {
      short: { type: String, default: 'HH:mm' }, // 14:30
      medium: { type: String, default: 'HH:mm:ss' }, // 14:30:45
      long: { type: String, default: 'HH:mm:ss z' } // 14:30:45 GMT
    },

    // Number formatting
    numberFormat: {
      decimalSeparator: { type: String, default: '.' },
      thousandsSeparator: { type: String, default: ',' },
      currencyPosition: { type: String, enum: ['before', 'after'], default: 'before' }
    },

    // Address format
    addressFormat: {
      type: String,
      default: '{street}\n{city}, {state} {postalCode}\n{country}'
    }
  },

  // Translation configuration
  translation: {
    // Available translation providers
    providers: [{
      name: {
        type: String,
        enum: ['google', 'deepl', 'azure', 'aws', 'manual'],
        required: true
      },
      apiKey: String,
      priority: {
        type: Number,
        default: 1
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }],

    // Auto-translation settings
    autoTranslate: {
      enabled: { type: Boolean, default: false },
      threshold: { type: Number, default: 0.8 }, // Confidence threshold
      excludeFields: [String] // Fields to exclude from auto-translation
    },

    // Translation quality settings
    quality: {
      requireHumanReview: { type: Boolean, default: true },
      minimumConfidence: { type: Number, default: 0.7 },
      fallbackToEnglish: { type: Boolean, default: true }
    }
  },

  // OTA Channel language mapping
  otaChannels: [{
    channel: {
      type: String,
      enum: ['booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'trivago'],
      required: true
    },
    channelLanguageCode: String, // Channel-specific language code
    isSupported: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    
    // Channel-specific formatting overrides
    formatting: {
      dateFormat: String,
      timeFormat: String,
      addressFormat: String
    }
  }],

  // Content localization preferences
  content: {
    // Default content source language
    sourceLanguage: {
      type: String,
      default: 'EN',
      ref: 'Language'
    },

    // Translation completeness tracking
    completeness: {
      roomTypes: { type: Number, default: 0 }, // Percentage
      amenities: { type: Number, default: 0 },
      policies: { type: Number, default: 0 },
      descriptions: { type: Number, default: 0 },
      emailTemplates: { type: Number, default: 0 },
      uiTexts: { type: Number, default: 0 }
    },

    // Last translation update
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },

  // Language preferences for different contexts
  contexts: [{
    name: {
      type: String,
      enum: ['website', 'booking_engine', 'guest_portal', 'staff_interface', 'email', 'sms'],
      required: true
    },
    isEnabled: { type: Boolean, default: true },
    priority: { type: Number, default: 1 },
    
    // Context-specific overrides
    overrides: {
      dateFormat: String,
      timeFormat: String,
      numberFormat: {
        decimalSeparator: String,
        thousandsSeparator: String
      }
    }
  }],

  // System settings
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  isDefault: {
    type: Boolean,
    default: false
  },

  // Analytics and usage tracking
  usage: {
    totalTranslations: { type: Number, default: 0 },
    totalRequests: { type: Number, default: 0 },
    lastUsed: Date,
    popularityScore: { type: Number, default: 0 }
  },

  // Metadata
  metadata: {
    script: String, // Writing script (Latin, Cyrillic, Arabic, etc.)
    family: String, // Language family (Germanic, Romance, etc.)
    speakers: Number, // Number of speakers worldwide
    regions: [String], // Countries/regions where spoken
    complexity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
languageSchema.index({ code: 1, isActive: 1 });
languageSchema.index({ locale: 1 });
languageSchema.index({ 'otaChannels.channel': 1 });
languageSchema.index({ 'contexts.name': 1 });
languageSchema.index({ isDefault: 1, isActive: 1 });

// Virtual for formatted display name
languageSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.nativeName})`;
});

// Virtual for completion percentage
languageSchema.virtual('overallCompleteness').get(function() {
  const completeness = this.content.completeness;
  const values = Object.values(completeness);
  return values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
});

// Static methods

/**
 * Get active languages with optional filtering
 */
languageSchema.statics.getActiveLanguages = async function(filters = {}) {
  try {
    const query = { isActive: true, ...filters };
    return await this.find(query)
      .sort({ isDefault: -1, name: 1 })
      .select('-translation.providers.apiKey'); // Exclude sensitive data
  } catch (error) {
    logger.error('Failed to get active languages', { error: error.message });
    throw error;
  }
};

/**
 * Get default language
 */
languageSchema.statics.getDefaultLanguage = async function() {
  try {
    const defaultLang = await this.findOne({ isDefault: true, isActive: true });
    if (!defaultLang) {
      // Fallback to English if no default is set
      return await this.findOne({ code: 'EN', isActive: true });
    }
    return defaultLang;
  } catch (error) {
    logger.error('Failed to get default language', { error: error.message });
    throw error;
  }
};

/**
 * Get language by code
 */
languageSchema.statics.getLanguageByCode = async function(code) {
  try {
    return await this.findOne({ 
      code: code.toUpperCase(), 
      isActive: true 
    }).select('-translation.providers.apiKey');
  } catch (error) {
    logger.error('Failed to get language by code', { code, error: error.message });
    throw error;
  }
};

/**
 * Get languages supported by OTA channel
 */
languageSchema.statics.getLanguagesByChannel = async function(channel) {
  try {
    return await this.find({
      isActive: true,
      'otaChannels.channel': channel,
      'otaChannels.isSupported': true
    })
    .sort({ 'otaChannels.isDefault': -1, name: 1 })
    .select('-translation.providers.apiKey');
  } catch (error) {
    logger.error('Failed to get languages by channel', { channel, error: error.message });
    throw error;
  }
};

/**
 * Get languages by context
 */
languageSchema.statics.getLanguagesByContext = async function(context) {
  try {
    return await this.find({
      isActive: true,
      'contexts.name': context,
      'contexts.isEnabled': true
    })
    .sort({ 'contexts.priority': 1, name: 1 })
    .select('-translation.providers.apiKey');
  } catch (error) {
    logger.error('Failed to get languages by context', { context, error: error.message });
    throw error;
  }
};

// Instance methods

/**
 * Format date according to language preferences
 */
languageSchema.methods.formatDate = function(date, format = 'medium') {
  const dateFormat = this.formatting.dateFormat[format] || this.formatting.dateFormat.medium;
  // This would integrate with a date formatting library like moment.js or date-fns
  return date; // Placeholder - implement actual formatting
};

/**
 * Format time according to language preferences
 */
languageSchema.methods.formatTime = function(time, format = 'short') {
  const timeFormat = this.formatting.timeFormat[format] || this.formatting.timeFormat.short;
  // This would integrate with a time formatting library
  return time; // Placeholder - implement actual formatting
};

/**
 * Format number according to language preferences
 */
languageSchema.methods.formatNumber = function(number, options = {}) {
  const { decimalSeparator, thousandsSeparator } = this.formatting.numberFormat;
  // Implement number formatting logic
  return number.toLocaleString(this.locale, options);
};

/**
 * Get channel-specific language code
 */
languageSchema.methods.getChannelCode = function(channel) {
  const channelConfig = this.otaChannels.find(ch => ch.channel === channel);
  return channelConfig?.channelLanguageCode || this.code;
};

/**
 * Update translation completeness
 */
languageSchema.methods.updateCompleteness = async function(type, percentage) {
  try {
    if (this.content.completeness.hasOwnProperty(type)) {
      this.content.completeness[type] = Math.max(0, Math.min(100, percentage));
      this.content.lastUpdated = new Date();
      await this.save();
      
      logger.info('Translation completeness updated', {
        language: this.code,
        type,
        percentage
      });
    }
  } catch (error) {
    logger.error('Failed to update translation completeness', {
      language: this.code,
      type,
      percentage,
      error: error.message
    });
    throw error;
  }
};

/**
 * Add or update OTA channel support
 */
languageSchema.methods.addChannelSupport = async function(channel, options = {}) {
  try {
    const existingIndex = this.otaChannels.findIndex(ch => ch.channel === channel);
    const channelConfig = {
      channel,
      channelLanguageCode: options.channelLanguageCode || this.code,
      isSupported: options.isSupported !== false,
      isDefault: options.isDefault || false,
      formatting: options.formatting || {}
    };

    if (existingIndex >= 0) {
      this.otaChannels[existingIndex] = { ...this.otaChannels[existingIndex], ...channelConfig };
    } else {
      this.otaChannels.push(channelConfig);
    }

    // Ensure only one default per channel across all languages
    if (channelConfig.isDefault) {
      await this.constructor.updateMany(
        { 
          _id: { $ne: this._id },
          'otaChannels.channel': channel 
        },
        { 
          $set: { 'otaChannels.$.isDefault': false } 
        }
      );
    }

    await this.save();

    logger.info('Channel support updated for language', {
      language: this.code,
      channel,
      isDefault: channelConfig.isDefault
    });

  } catch (error) {
    logger.error('Failed to add channel support', {
      language: this.code,
      channel,
      error: error.message
    });
    throw error;
  }
};

/**
 * Ensure single default language
 */
languageSchema.statics.ensureSingleDefault = async function() {
  try {
    const defaultLanguages = await this.find({ isDefault: true });
    
    if (defaultLanguages.length > 1) {
      // Keep the first one as default, remove default from others
      const promises = defaultLanguages.slice(1).map(lang => {
        lang.isDefault = false;
        return lang.save();
      });
      
      await Promise.all(promises);
      
      logger.info('Multiple default languages found, resolved to single default', {
        defaultLanguage: defaultLanguages[0].code
      });
    }
  } catch (error) {
    logger.error('Failed to ensure single default language', { error: error.message });
    throw error;
  }
};

// Pre-save middleware
languageSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Ensure only one default language
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isDefault: true },
      { isDefault: false }
    );
  }
  
  next();
});

// Post-save middleware for audit logging
languageSchema.post('save', function(doc) {
  logger.info('Language document saved', {
    language: doc.code,
    name: doc.name,
    isDefault: doc.isDefault,
    isActive: doc.isActive
  });
});

export default mongoose.models.Language || mongoose.model('Language', languageSchema);
