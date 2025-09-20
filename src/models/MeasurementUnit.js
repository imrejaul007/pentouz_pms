import mongoose from 'mongoose';

/**
 * Measurement Unit Model
 * 
 * Manages measurement units for POS operations including:
 * - Unit types: weight, volume, quantity, length, area, time
 * - Base units and conversion factors
 * - Unit categories and display preferences
 * - Multi-system support (metric, imperial, etc.)
 */

const conversionFactorSchema = new mongoose.Schema({
  targetUnit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeasurementUnit',
    required: true
  },
  factor: {
    type: Number,
    required: true,
    min: 0.000001 // Prevent zero or negative factors
  },
  offset: {
    type: Number,
    default: 0 // For temperature conversions (Celsius to Fahrenheit)
  }
}, { _id: true });

const measurementUnitSchema = new mongoose.Schema({
  // Standard fields
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Unit identification
  unitId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  symbol: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: String,

  // Unit classification
  unitType: {
    type: String,
    enum: [
      'WEIGHT',      // kg, g, lbs, oz, ton
      'VOLUME',      // L, ml, gal, fl oz, cup
      'QUANTITY',    // pieces, dozen, pair, set
      'LENGTH',      // m, cm, in, ft, yd
      'AREA',        // sqm, sqft, acre
      'TIME',        // hr, min, day, week
      'TEMPERATURE', // °C, °F, K
      'CUSTOM'       // Custom units
    ],
    required: true,
    index: true
  },

  // Unit system
  unitSystem: {
    type: String,
    enum: ['METRIC', 'IMPERIAL', 'US_CUSTOMARY', 'CUSTOM'],
    required: true,
    default: 'METRIC',
    index: true
  },

  // Base unit information
  isBaseUnit: {
    type: Boolean,
    default: false,
    index: true
  },
  baseUnit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeasurementUnit',
    default: null
  },

  // Conversion factors to other units
  conversionFactors: [conversionFactorSchema],

  // Unit properties
  decimalPlaces: {
    type: Number,
    default: 2,
    min: 0,
    max: 6
  },
  precision: {
    type: Number,
    default: 0.01,
    min: 0.000001
  },

  // Display and formatting
  displayFormat: {
    showSymbol: {
      type: Boolean,
      default: true
    },
    symbolPosition: {
      type: String,
      enum: ['before', 'after'],
      default: 'after'
    },
    thousandsSeparator: {
      type: String,
      default: ','
    },
    decimalSeparator: {
      type: String,
      default: '.'
    }
  },

  // Unit status and validity
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isSystemUnit: {
    type: Boolean,
    default: false // System units cannot be deleted
  },

  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: Date,

  // Category and sorting
  category: {
    type: String,
    enum: [
      'COMMON',      // Most commonly used units
      'STANDARD',    // Standard units for the type
      'SPECIALIZED', // Specialized units for specific use cases
      'LEGACY'       // Legacy units for backward compatibility
    ],
    default: 'STANDARD'
  },
  sortOrder: {
    type: Number,
    default: 0
  },

  // Validation rules
  minValue: {
    type: Number,
    default: 0
  },
  maxValue: {
    type: Number,
    default: null
  },
  allowNegative: {
    type: Boolean,
    default: false
  },

  // Integration settings
  posIntegration: {
    isDefaultForType: {
      type: Boolean,
      default: false
    },
    applicableCategories: [{
      type: String,
      enum: ['FOOD', 'BEVERAGE', 'SERVICE', 'PRODUCT', 'ALCOHOL', 'TOBACCO', 'LUXURY', 'GENERAL']
    }],
    inventoryTracking: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
measurementUnitSchema.index({ hotelId: 1, unitType: 1, isActive: 1 });
measurementUnitSchema.index({ hotelId: 1, unitSystem: 1, isActive: 1 });
measurementUnitSchema.index({ hotelId: 1, isBaseUnit: 1, isActive: 1 });
measurementUnitSchema.index({ unitType: 1, category: 1, sortOrder: 1 });

// Virtual for formatted display
measurementUnitSchema.virtual('formattedDisplay').get(function() {
  if (this.displayFormat.showSymbol) {
    return this.displayFormat.symbolPosition === 'before' 
      ? `${this.symbol} ${this.displayName}`
      : `${this.displayName} (${this.symbol})`;
  }
  return this.displayName;
});

// Virtual for conversion rate to base unit
measurementUnitSchema.virtual('baseConversionRate').get(function() {
  if (this.isBaseUnit) return 1;
  // This would be calculated based on conversion factors
  return 1; // Placeholder - actual calculation would be more complex
});

// Pre-save middleware to generate unitId if not provided
measurementUnitSchema.pre('save', async function(next) {
  if (!this.unitId) {
    const prefix = this.unitType.substring(0, 3).toUpperCase();
    const count = await this.constructor.countDocuments({
      unitId: new RegExp(`^${prefix}`)
    });
    this.unitId = `${prefix}${(count + 1).toString().padStart(3, '0')}`;
  }
  next();
});

// Static method to get units by type
measurementUnitSchema.statics.getUnitsByType = function(hotelId, unitType, options = {}) {
  const query = {
    hotelId,
    unitType,
    isActive: true
  };

  if (options.includeSystemUnits !== false) {
    // Include system units by default
  }

  return this.find(query)
    .sort({ category: 1, sortOrder: 1, name: 1 })
    .populate('baseUnit', 'name symbol');
};

// Static method to get base units
measurementUnitSchema.statics.getBaseUnits = function(hotelId) {
  return this.find({
    hotelId,
    isBaseUnit: true,
    isActive: true
  }).sort({ unitType: 1, name: 1 });
};

// Static method to convert between units
measurementUnitSchema.statics.convert = async function(fromUnitId, toUnitId, value) {
  if (fromUnitId === toUnitId) return value;

  const fromUnit = await this.findById(fromUnitId);
  const toUnit = await this.findById(toUnitId);

  if (!fromUnit || !toUnit) {
    throw new Error('Invalid unit IDs');
  }

  if (fromUnit.unitType !== toUnit.unitType) {
    throw new Error('Cannot convert between different unit types');
  }

  // Find direct conversion factor
  const directFactor = fromUnit.conversionFactors.find(
    cf => cf.targetUnit.toString() === toUnitId.toString()
  );

  if (directFactor) {
    return (value * directFactor.factor) + directFactor.offset;
  }

  // If no direct conversion, try through base unit
  if (fromUnit.baseUnit && toUnit.baseUnit) {
    const fromBaseRate = fromUnit.baseConversionRate;
    const toBaseRate = toUnit.baseConversionRate;
    
    if (fromBaseRate && toBaseRate) {
      return (value * fromBaseRate) / toBaseRate;
    }
  }

  throw new Error(`No conversion path found between ${fromUnit.name} and ${toUnit.name}`);
};

// Instance method to add conversion factor
measurementUnitSchema.methods.addConversionFactor = function(targetUnitId, factor, offset = 0) {
  // Remove existing conversion to the same unit
  this.conversionFactors = this.conversionFactors.filter(
    cf => cf.targetUnit.toString() !== targetUnitId.toString()
  );

  // Add new conversion factor
  this.conversionFactors.push({
    targetUnit: targetUnitId,
    factor,
    offset
  });

  return this.save();
};

// Instance method to update usage statistics
measurementUnitSchema.methods.updateUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

// Instance method to validate value
measurementUnitSchema.methods.validateValue = function(value) {
  if (!this.allowNegative && value < 0) {
    return { valid: false, error: 'Negative values not allowed for this unit' };
  }

  if (value < this.minValue) {
    return { valid: false, error: `Value must be at least ${this.minValue}` };
  }

  if (this.maxValue && value > this.maxValue) {
    return { valid: false, error: `Value must not exceed ${this.maxValue}` };
  }

  return { valid: true };
};

// Instance method to format value for display
measurementUnitSchema.methods.formatValue = function(value) {
  const validation = this.validateValue(value);
  if (!validation.valid) {
    return { formatted: value.toString(), error: validation.error };
  }

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: this.decimalPlaces,
    useGrouping: true
  }).format(value);

  const symbol = this.displayFormat.showSymbol ? this.symbol : '';
  const display = this.displayFormat.symbolPosition === 'before' 
    ? `${symbol} ${formatted}`
    : `${formatted} ${symbol}`;

  return { formatted: display, error: null };
};

export default mongoose.model('MeasurementUnit', measurementUnitSchema);
