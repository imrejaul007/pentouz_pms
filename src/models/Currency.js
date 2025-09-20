import mongoose from 'mongoose';

/**
 * Currency Model
 * 
 * Manages supported currencies and their exchange rates for multi-currency support
 * Provides foundation for OTA channel currency requirements
 */

const currencySchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 3,
    match: /^[A-Z]{3}$/,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  symbol: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10
  },
  
  // Exchange rate relative to base currency (USD)
  exchangeRate: {
    type: Number,
    required: true,
    min: 0.000001, // Prevent zero or negative rates
    index: true
  },
  
  // Decimal places for this currency (e.g., 2 for USD, 0 for JPY)
  decimalPlaces: {
    type: Number,
    required: true,
    min: 0,
    max: 4,
    default: 2
  },
  
  // Currency status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isBaseCurrency: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // OTA Channel support
  supportedChannels: [{
    channel: {
      type: String,
      enum: ['booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'amadeus', 'sabre', 'direct_web'],
      required: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    // Channel-specific currency formatting rules
    formatting: {
      prefix: String, // Currency symbol position
      suffix: String,
      thousandsSeparator: {
        type: String,
        default: ','
      },
      decimalSeparator: {
        type: String,
        default: '.'
      }
    }
  }],
  
  // Exchange rate history for auditing
  rateHistory: [{
    rate: Number,
    source: {
      type: String,
      enum: ['manual', 'api_fetch', 'scheduled_update'],
      default: 'manual'
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  }],
  
  // Rate update configuration
  autoUpdate: {
    enabled: {
      type: Boolean,
      default: true
    },
    source: {
      type: String,
      enum: ['fixer', 'exchangerate_api', 'currencylayer', 'manual'],
      default: 'exchangerate_api'
    },
    updateFrequency: {
      type: String,
      enum: ['hourly', 'daily', 'weekly'],
      default: 'daily'
    },
    lastUpdated: Date,
    nextUpdate: Date
  },
  
  // Regional and country information
  regions: [{
    country: String,
    countryCode: String, // ISO 3166-1 alpha-2
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // Display preferences
  displayPreferences: {
    showSymbolBefore: {
      type: Boolean,
      default: true
    },
    spaceBetweenSymbolAndAmount: {
      type: Boolean,
      default: false
    },
    groupDigits: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
currencySchema.index({ isActive: 1, code: 1 });
currencySchema.index({ isBaseCurrency: 1, isActive: 1 });
currencySchema.index({ 'supportedChannels.channel': 1, isActive: 1 });
currencySchema.index({ 'autoUpdate.nextUpdate': 1, 'autoUpdate.enabled': 1 });

// Virtual for formatted display name
currencySchema.virtual('displayName').get(function() {
  return `${this.code} - ${this.name}`;
});

// Virtual for rate age (how old is the current exchange rate)
currencySchema.virtual('rateAge').get(function() {
  if (!this.autoUpdate.lastUpdated) return null;
  return Date.now() - this.autoUpdate.lastUpdated.getTime();
});

// Virtual to check if rate is stale
currencySchema.virtual('isRateStale').get(function() {
  if (!this.autoUpdate.lastUpdated || !this.autoUpdate.enabled) return false;
  
  const staleThresholds = {
    hourly: 2 * 60 * 60 * 1000,    // 2 hours
    daily: 2 * 24 * 60 * 60 * 1000, // 2 days
    weekly: 8 * 24 * 60 * 60 * 1000  // 8 days
  };
  
  const threshold = staleThresholds[this.autoUpdate.updateFrequency] || staleThresholds.daily;
  return (Date.now() - this.autoUpdate.lastUpdated.getTime()) > threshold;
});

// Pre-save middleware
currencySchema.pre('save', function(next) {
  // Ensure only one base currency
  if (this.isBaseCurrency && this.isModified('isBaseCurrency')) {
    // This will be handled by a static method to avoid conflicts
    this.constructor.ensureSingleBaseCurrency(this._id);
  }
  
  // Base currency should always have exchange rate of 1.0
  if (this.isBaseCurrency) {
    this.exchangeRate = 1.0;
  }
  
  // Add current rate to history if rate changed
  if (this.isModified('exchangeRate') && !this.isNew) {
    this.rateHistory.push({
      rate: this.exchangeRate,
      source: 'manual', // Will be overridden by service if from API
      updatedAt: new Date()
    });
    
    // Keep only last 100 rate history entries
    if (this.rateHistory.length > 100) {
      this.rateHistory = this.rateHistory.slice(-100);
    }
  }
  
  // Update lastUpdated when rate changes
  if (this.isModified('exchangeRate')) {
    this.autoUpdate.lastUpdated = new Date();
  }
  
  next();
});

// Static methods
currencySchema.statics.getBaseCurrency = async function() {
  return await this.findOne({ isBaseCurrency: true, isActive: true });
};

currencySchema.statics.getActiveCurrencies = async function() {
  return await this.find({ isActive: true }).sort({ code: 1 });
};

currencySchema.statics.getCurrenciesByChannel = async function(channel) {
  return await this.find({ 
    isActive: true,
    'supportedChannels.channel': channel 
  }).sort({ code: 1 });
};

currencySchema.statics.ensureSingleBaseCurrency = async function(excludeId = null) {
  const filter = { isBaseCurrency: true };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  
  await this.updateMany(filter, { 
    $set: { isBaseCurrency: false } 
  });
};

currencySchema.statics.getCurrencyByCode = async function(code) {
  return await this.findOne({ 
    code: code.toUpperCase(), 
    isActive: true 
  });
};

currencySchema.statics.getStaleCurrencies = async function() {
  const now = new Date();
  
  return await this.find({
    isActive: true,
    'autoUpdate.enabled': true,
    $or: [
      { 'autoUpdate.nextUpdate': { $lte: now } },
      { 'autoUpdate.nextUpdate': { $exists: false } }
    ]
  });
};

// Instance methods
currencySchema.methods.updateExchangeRate = function(newRate, source = 'manual', updatedBy = null) {
  this.exchangeRate = newRate;
  this.autoUpdate.lastUpdated = new Date();
  
  // Calculate next update time
  if (this.autoUpdate.enabled) {
    const intervals = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000
    };
    
    const interval = intervals[this.autoUpdate.updateFrequency] || intervals.daily;
    this.autoUpdate.nextUpdate = new Date(Date.now() + interval);
  }
  
  // Add to history
  this.rateHistory.push({
    rate: newRate,
    source,
    updatedAt: new Date(),
    updatedBy
  });
  
  return this.save();
};

currencySchema.methods.formatAmount = function(amount, options = {}) {
  const {
    showSymbol = true,
    useChannelFormatting = null
  } = options;
  
  // Round to appropriate decimal places
  const roundedAmount = Number(amount.toFixed(this.decimalPlaces));
  
  // Get formatting preferences
  let formatting = this.displayPreferences;
  
  // Override with channel-specific formatting if requested
  if (useChannelFormatting) {
    const channelConfig = this.supportedChannels.find(
      ch => ch.channel === useChannelFormatting
    );
    if (channelConfig && channelConfig.formatting) {
      formatting = { ...formatting, ...channelConfig.formatting };
    }
  }
  
  // Format number with thousands separator
  let formattedNumber = roundedAmount.toLocaleString('en-US', {
    minimumFractionDigits: this.decimalPlaces,
    maximumFractionDigits: this.decimalPlaces,
    useGrouping: formatting.groupDigits
  });
  
  // Apply custom separators if specified
  if (formatting.thousandsSeparator !== ',') {
    formattedNumber = formattedNumber.replace(/,/g, formatting.thousandsSeparator);
  }
  if (formatting.decimalSeparator !== '.') {
    formattedNumber = formattedNumber.replace(/\./g, formatting.decimalSeparator);
  }
  
  if (!showSymbol) return formattedNumber;
  
  // Add currency symbol
  const space = formatting.spaceBetweenSymbolAndAmount ? ' ' : '';
  
  if (formatting.showSymbolBefore) {
    return `${this.symbol}${space}${formattedNumber}`;
  } else {
    return `${formattedNumber}${space}${this.symbol}`;
  }
};

currencySchema.methods.convertTo = function(targetCurrency, amount) {
  if (!targetCurrency || !targetCurrency.exchangeRate) {
    throw new Error('Invalid target currency');
  }
  
  // Convert to base currency first, then to target
  const baseAmount = amount / this.exchangeRate;
  const convertedAmount = baseAmount * targetCurrency.exchangeRate;
  
  return Number(convertedAmount.toFixed(targetCurrency.decimalPlaces));
};

currencySchema.methods.addChannelSupport = function(channel, isDefault = false, formatting = {}) {
  // Remove existing channel support
  this.supportedChannels = this.supportedChannels.filter(
    ch => ch.channel !== channel
  );
  
  // Add new channel support
  this.supportedChannels.push({
    channel,
    isDefault,
    formatting
  });
  
  return this.save();
};

export default mongoose.model('Currency', currencySchema);
