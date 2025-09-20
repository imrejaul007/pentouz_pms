import mongoose from 'mongoose';

/**
 * POS Attribute Value Model
 * 
 * Manages individual values for POS attributes including:
 * - Attribute value definitions
 * - Price modifiers for attribute values
 * - Availability by outlet
 * - Usage tracking and analytics
 */

const availabilitySchema = new mongoose.Schema({
  outletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POSOutlet',
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  availableQuantity: {
    type: Number,
    default: -1 // -1 means unlimited
  },
  reservedQuantity: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const priceModifierSchema = new mongoose.Schema({
  outletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POSOutlet'
  },
  modifier: {
    type: Number,
    required: true
  },
  modifierType: {
    type: String,
    enum: ['FIXED', 'PERCENTAGE'],
    required: true,
    default: 'FIXED'
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validTo: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value > this.validFrom;
      },
      message: 'Valid to date must be after valid from date'
    }
  }
}, { _id: true });

const posAttributeValueSchema = new mongoose.Schema({
  // Standard fields
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  attributeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POSAttribute',
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

  // Value identification
  valueId: {
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
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: String,

  // Value data
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  valueType: {
    type: String,
    enum: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'COLOR', 'CUSTOM'],
    required: true,
    default: 'STRING'
  },

  // Display configuration
  displayConfig: {
    icon: String,
    color: String,
    image: String,
    cssClass: String,
    tooltip: String,
    showInMenu: {
      type: Boolean,
      default: true
    },
    showInCart: {
      type: Boolean,
      default: true
    },
    showInReceipt: {
      type: Boolean,
      default: true
    }
  },

  // Pricing configuration
  pricing: {
    basePriceModifier: {
      type: Number,
      default: 0
    },
    basePriceModifierType: {
      type: String,
      enum: ['FIXED', 'PERCENTAGE'],
      default: 'FIXED'
    },
    outletSpecificModifiers: [priceModifierSchema],
    isDefault: {
      type: Boolean,
      default: false
    }
  },

  // Availability configuration
  availability: {
    isGloballyAvailable: {
      type: Boolean,
      default: true
    },
    outletAvailability: [availabilitySchema],
    inventoryTracking: {
      type: Boolean,
      default: false
    },
    minQuantity: {
      type: Number,
      default: 0
    },
    maxQuantity: {
      type: Number,
      default: -1 // -1 means unlimited
    }
  },

  // Value status and validity
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isSystemValue: {
    type: Boolean,
    default: false // System values cannot be deleted
  },

  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: Date,
  popularityScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Category and sorting
  category: {
    type: String,
    enum: [
      'COMMON',         // Most commonly used values
      'STANDARD',       // Standard values for the attribute
      'SPECIALIZED',    // Specialized values for specific use cases
      'LEGACY'          // Legacy values for backward compatibility
    ],
    default: 'STANDARD'
  },
  sortOrder: {
    type: Number,
    default: 0
  },

  // Metadata
  metadata: {
    tags: [String],
    notes: String,
    customFields: mongoose.Schema.Types.Mixed
  },

  // Integration settings
  posIntegration: {
    applicableCategories: [{
      type: String,
      enum: ['FOOD', 'BEVERAGE', 'SERVICE', 'PRODUCT', 'ALCOHOL', 'TOBACCO', 'LUXURY', 'GENERAL']
    }],
    applicableOutlets: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSOutlet'
    }],
    affectsInventory: {
      type: Boolean,
      default: false
    },
    requiresSpecialHandling: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
posAttributeValueSchema.index({ hotelId: 1, attributeId: 1, isActive: 1 });
posAttributeValueSchema.index({ hotelId: 1, valueId: 1 });
posAttributeValueSchema.index({ attributeId: 1, sortOrder: 1 });
posAttributeValueSchema.index({ 'availability.outletId': 1, 'availability.isAvailable': 1 });

// Virtual for formatted display
posAttributeValueSchema.virtual('formattedDisplay').get(function() {
  return `${this.displayName} (${this.value})`;
});

// Virtual for current price modifier
posAttributeValueSchema.virtual('currentPriceModifier').get(function() {
  const now = new Date();
  const activeModifier = this.pricing.outletSpecificModifiers.find(modifier => 
    modifier.validFrom <= now && (!modifier.validTo || modifier.validTo >= now)
  );
  
  return activeModifier || {
    modifier: this.pricing.basePriceModifier,
    modifierType: this.pricing.basePriceModifierType
  };
});

// Virtual for availability status
posAttributeValueSchema.virtual('isCurrentlyAvailable').get(function() {
  return this.isActive && this.availability.isGloballyAvailable;
});

// Pre-save middleware to generate valueId if not provided
posAttributeValueSchema.pre('save', async function(next) {
  if (!this.valueId) {
    const attribute = await this.constructor.db.model('POSAttribute').findById(this.attributeId);
    if (attribute) {
      const prefix = attribute.attributeId;
      const count = await this.constructor.countDocuments({
        valueId: new RegExp(`^${prefix}`)
      });
      this.valueId = `${prefix}_${(count + 1).toString().padStart(3, '0')}`;
    }
  }
  next();
});

// Static method to get values by attribute
posAttributeValueSchema.statics.getValuesByAttribute = function(hotelId, attributeId, options = {}) {
  const query = {
    hotelId,
    attributeId,
    isActive: true
  };

  if (options.outletId) {
    query.$or = [
      { 'availability.isGloballyAvailable': true },
      { 'availability.outletAvailability.outletId': options.outletId }
    ];
  }

  return this.find(query)
    .sort({ sortOrder: 1, displayName: 1 })
    .populate('attributeId', 'name displayName attributeType');
};

// Static method to get popular values
posAttributeValueSchema.statics.getPopularValues = function(hotelId, attributeId, limit = 10) {
  return this.find({
    hotelId,
    attributeId,
    isActive: true
  })
    .sort({ popularityScore: -1, usageCount: -1 })
    .limit(limit);
};

// Static method to get values by category
posAttributeValueSchema.statics.getValuesByCategory = function(hotelId, category) {
  return this.find({
    hotelId,
    isActive: true,
    'posIntegration.applicableCategories': { $in: [category, 'GENERAL'] }
  }).sort({ sortOrder: 1, displayName: 1 });
};

// Instance method to update availability for outlet
posAttributeValueSchema.methods.updateAvailability = function(outletId, availabilityData) {
  const existingAvailability = this.availability.outletAvailability.find(
    avail => avail.outletId.toString() === outletId.toString()
  );

  if (existingAvailability) {
    Object.assign(existingAvailability, availabilityData, { lastUpdated: new Date() });
  } else {
    this.availability.outletAvailability.push({
      outletId,
      ...availabilityData,
      lastUpdated: new Date()
    });
  }

  return this.save();
};

// Instance method to get availability for outlet
posAttributeValueSchema.methods.getAvailabilityForOutlet = function(outletId) {
  if (!this.availability.isGloballyAvailable) {
    return { isAvailable: false, availableQuantity: 0 };
  }

  const outletAvailability = this.availability.outletAvailability.find(
    avail => avail.outletId.toString() === outletId.toString()
  );

  if (outletAvailability) {
    return {
      isAvailable: outletAvailability.isAvailable,
      availableQuantity: outletAvailability.availableQuantity,
      reservedQuantity: outletAvailability.reservedQuantity
    };
  }

  return {
    isAvailable: true,
    availableQuantity: -1, // Unlimited
    reservedQuantity: 0
  };
};

// Instance method to calculate price modifier for outlet
posAttributeValueSchema.methods.calculatePriceModifier = function(outletId, basePrice) {
  const modifier = this.currentPriceModifier;
  
  if (modifier.modifierType === 'FIXED') {
    return modifier.modifier;
  } else if (modifier.modifierType === 'PERCENTAGE') {
    return (basePrice * modifier.modifier) / 100;
  }
  
  return 0;
};

// Instance method to update usage statistics
posAttributeValueSchema.methods.updateUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  
  // Update popularity score based on usage
  this.popularityScore = Math.min(100, this.popularityScore + 1);
  
  return this.save();
};

// Instance method to validate value
posAttributeValueSchema.methods.validateValue = function() {
  if (!this.value || this.value === '') {
    return { valid: false, error: 'Value is required' };
  }

  if (this.valueType === 'NUMBER' && isNaN(parseFloat(this.value))) {
    return { valid: false, error: 'Value must be a valid number' };
  }

  if (this.valueType === 'BOOLEAN' && typeof this.value !== 'boolean') {
    return { valid: false, error: 'Value must be a boolean' };
  }

  if (this.valueType === 'DATE' && !Date.parse(this.value)) {
    return { valid: false, error: 'Value must be a valid date' };
  }

  return { valid: true };
};

// Instance method to get display value
posAttributeValueSchema.methods.getDisplayValue = function() {
  if (this.displayConfig.icon) {
    return `${this.displayConfig.icon} ${this.displayName}`;
  }
  
  if (this.displayConfig.color) {
    return `${this.displayName} (${this.displayConfig.color})`;
  }
  
  return this.displayName;
};

// Instance method to check if value is available for outlet
posAttributeValueSchema.methods.isAvailableForOutlet = function(outletId) {
  const availability = this.getAvailabilityForOutlet(outletId);
  return availability.isAvailable;
};

// Instance method to reserve quantity
posAttributeValueSchema.methods.reserveQuantity = function(outletId, quantity) {
  if (!this.availability.inventoryTracking) {
    return { success: true, reserved: quantity };
  }

  const outletAvailability = this.availability.outletAvailability.find(
    avail => avail.outletId.toString() === outletId.toString()
  );

  if (!outletAvailability) {
    return { success: false, error: 'Outlet availability not configured' };
  }

  if (outletAvailability.availableQuantity === -1) {
    // Unlimited availability
    outletAvailability.reservedQuantity += quantity;
    return { success: true, reserved: quantity };
  }

  const availableQuantity = outletAvailability.availableQuantity - outletAvailability.reservedQuantity;
  
  if (availableQuantity >= quantity) {
    outletAvailability.reservedQuantity += quantity;
    return { success: true, reserved: quantity };
  }

  return { success: false, error: 'Insufficient quantity available', available: availableQuantity };
};

// Instance method to release reserved quantity
posAttributeValueSchema.methods.releaseQuantity = function(outletId, quantity) {
  if (!this.availability.inventoryTracking) {
    return { success: true };
  }

  const outletAvailability = this.availability.outletAvailability.find(
    avail => avail.outletId.toString() === outletId.toString()
  );

  if (outletAvailability) {
    outletAvailability.reservedQuantity = Math.max(0, outletAvailability.reservedQuantity - quantity);
    return { success: true };
  }

  return { success: false, error: 'Outlet availability not configured' };
};

export default mongoose.model('POSAttributeValue', posAttributeValueSchema);
