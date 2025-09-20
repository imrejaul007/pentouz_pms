import mongoose from 'mongoose';

/**
 * POS Item Variant Model
 * 
 * Manages item variants created from combinations of attributes including:
 * - Variant generation from attribute combinations
 * - Variant-specific pricing and availability
 * - Inventory tracking per variant
 * - Variant analytics and performance
 */

const variantAttributeSchema = new mongoose.Schema({
  attributeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POSAttribute',
    required: true
  },
  attributeValueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POSAttributeValue',
    required: true
  },
  attributeName: {
    type: String,
    required: true
  },
  attributeValue: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  displayName: {
    type: String,
    required: true
  }
}, { _id: false });

const variantPricingSchema = new mongoose.Schema({
  outletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POSOutlet'
  },
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  priceModifiers: [{
    attributeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSAttribute'
    },
    modifier: {
      type: Number,
      required: true
    },
    modifierType: {
      type: String,
      enum: ['FIXED', 'PERCENTAGE'],
      required: true
    }
  }],
  finalPrice: {
    type: Number,
    required: true,
    min: 0
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

const variantInventorySchema = new mongoose.Schema({
  outletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POSOutlet',
    required: true
  },
  currentStock: {
    type: Number,
    default: 0
  },
  reservedStock: {
    type: Number,
    default: 0
  },
  minStock: {
    type: Number,
    default: 0
  },
  maxStock: {
    type: Number,
    default: -1 // -1 means unlimited
  },
  reorderPoint: {
    type: Number,
    default: 0
  },
  lastRestocked: Date,
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const posItemVariantSchema = new mongoose.Schema({
  // Standard fields
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POSMenu',
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

  // Variant identification
  variantId: {
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

  // Variant attributes
  attributes: [variantAttributeSchema],

  // Variant configuration
  configuration: {
    isDefault: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isSystemGenerated: {
      type: Boolean,
      default: false
    },
    requiresSpecialHandling: {
      type: Boolean,
      default: false
    },
    preparationTime: {
      type: Number,
      default: 0 // in minutes
    },
    complexity: {
      type: String,
      enum: ['SIMPLE', 'MODERATE', 'COMPLEX'],
      default: 'SIMPLE'
    }
  },

  // Pricing configuration
  pricing: {
    basePrice: {
      type: Number,
      required: true,
      min: 0
    },
    outletSpecificPricing: [variantPricingSchema],
    priceCalculationMethod: {
      type: String,
      enum: ['ADDITIVE', 'MULTIPLICATIVE', 'CUSTOM'],
      default: 'ADDITIVE'
    },
    allowPriceOverride: {
      type: Boolean,
      default: false
    }
  },

  // Inventory configuration
  inventory: {
    trackInventory: {
      type: Boolean,
      default: false
    },
    outletInventory: [variantInventorySchema],
    allowNegativeStock: {
      type: Boolean,
      default: false
    },
    autoReorder: {
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
    outletAvailability: [{
      outletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'POSOutlet',
        required: true
      },
      isAvailable: {
        type: Boolean,
        default: true
      },
      availableFrom: Date,
      availableTo: Date,
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    }],
    timeBasedAvailability: {
      enabled: {
        type: Boolean,
        default: false
      },
      timeSlots: [{
        dayOfWeek: {
          type: Number,
          min: 0,
          max: 6 // 0 = Sunday, 6 = Saturday
        },
        startTime: String, // HH:MM format
        endTime: String,   // HH:MM format
        isAvailable: {
          type: Boolean,
          default: true
        }
      }]
    }
  },

  // Usage tracking and analytics
  analytics: {
    totalOrders: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    averageOrderValue: {
      type: Number,
      default: 0
    },
    popularityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    lastOrdered: Date,
    conversionRate: {
      type: Number,
      default: 0
    }
  },

  // Display and presentation
  display: {
    image: String,
    thumbnail: String,
    color: String,
    icon: String,
    cssClass: String,
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
    },
    displayOrder: {
      type: Number,
      default: 0
    }
  },

  // Metadata
  metadata: {
    tags: [String],
    notes: String,
    customFields: mongoose.Schema.Types.Mixed,
    version: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
posItemVariantSchema.index({ hotelId: 1, menuItemId: 1, 'configuration.isActive': 1 });
posItemVariantSchema.index({ hotelId: 1, variantId: 1 });
posItemVariantSchema.index({ menuItemId: 1, 'configuration.isDefault': 1 });
posItemVariantSchema.index({ 'analytics.popularityScore': -1 });
posItemVariantSchema.index({ 'attributes.attributeId': 1, 'attributes.attributeValueId': 1 });

// Virtual for formatted display
posItemVariantSchema.virtual('formattedDisplay').get(function() {
  const attributeNames = this.attributes.map(attr => attr.displayName).join(', ');
  return `${this.displayName} (${attributeNames})`;
});

// Virtual for current price
posItemVariantSchema.virtual('currentPrice').get(function() {
  const now = new Date();
  const activePricing = this.pricing.outletSpecificPricing.find(pricing => 
    pricing.validFrom <= now && (!pricing.validTo || pricing.validTo >= now)
  );
  
  return activePricing ? activePricing.finalPrice : this.pricing.basePrice;
});

// Virtual for availability status
posItemVariantSchema.virtual('isCurrentlyAvailable').get(function() {
  return this.configuration.isActive && this.availability.isGloballyAvailable;
});

// Virtual for total stock across all outlets
posItemVariantSchema.virtual('totalStock').get(function() {
  if (!this.inventory.trackInventory) return -1; // Unlimited
  
  return this.inventory.outletInventory.reduce((total, outlet) => {
    return total + (outlet.currentStock - outlet.reservedStock);
  }, 0);
});

// Pre-save middleware to generate variantId if not provided
posItemVariantSchema.pre('save', async function(next) {
  if (!this.variantId) {
    const menuItem = await this.constructor.db.model('POSMenu').findById(this.menuItemId);
    if (menuItem) {
      const prefix = menuItem.menuId.substring(0, 6).toUpperCase();
      const count = await this.constructor.countDocuments({
        variantId: new RegExp(`^${prefix}`)
      });
      this.variantId = `${prefix}_VAR${(count + 1).toString().padStart(3, '0')}`;
    }
  }
  next();
});

// Static method to get variants by menu item
posItemVariantSchema.statics.getVariantsByMenuItem = function(hotelId, menuItemId, options = {}) {
  const query = {
    hotelId,
    menuItemId,
    'configuration.isActive': true
  };

  if (options.outletId) {
    query.$or = [
      { 'availability.isGloballyAvailable': true },
      { 'availability.outletAvailability.outletId': options.outletId }
    ];
  }

  return this.find(query)
    .sort({ 'configuration.isDefault': -1, 'display.displayOrder': 1, 'analytics.popularityScore': -1 })
    .populate('menuItemId', 'name displayName')
    .populate('attributes.attributeId', 'name displayName attributeType')
    .populate('attributes.attributeValueId', 'name displayName value');
};

// Static method to get popular variants
posItemVariantSchema.statics.getPopularVariants = function(hotelId, limit = 10) {
  return this.find({
    hotelId,
    'configuration.isActive': true
  })
    .sort({ 'analytics.popularityScore': -1, 'analytics.totalOrders': -1 })
    .limit(limit)
    .populate('menuItemId', 'name displayName')
    .populate('attributes.attributeId', 'name displayName')
    .populate('attributes.attributeValueId', 'name displayName');
};

// Static method to find variant by attributes
posItemVariantSchema.statics.findVariantByAttributes = function(hotelId, menuItemId, attributes) {
  const attributeConditions = attributes.map(attr => ({
    'attributes.attributeId': attr.attributeId,
    'attributes.attributeValueId': attr.attributeValueId
  }));

  return this.findOne({
    hotelId,
    menuItemId,
    'configuration.isActive': true,
    $and: attributeConditions
  });
};

// Instance method to calculate final price for outlet
posItemVariantSchema.methods.calculatePriceForOutlet = function(outletId, basePrice) {
  const outletPricing = this.pricing.outletSpecificPricing.find(
    pricing => pricing.outletId.toString() === outletId.toString()
  );

  if (outletPricing) {
    return outletPricing.finalPrice;
  }

  let finalPrice = this.pricing.basePrice;

  // Apply attribute modifiers
  for (const attribute of this.attributes) {
    // This would need to fetch the actual attribute value to get its price modifier
    // For now, we'll use the base price
  }

  return finalPrice;
};

// Instance method to check availability for outlet
posItemVariantSchema.methods.isAvailableForOutlet = function(outletId) {
  if (!this.configuration.isActive || !this.availability.isGloballyAvailable) {
    return false;
  }

  const outletAvailability = this.availability.outletAvailability.find(
    avail => avail.outletId.toString() === outletId.toString()
  );

  if (outletAvailability) {
    const now = new Date();
    if (outletAvailability.availableFrom && outletAvailability.availableFrom > now) {
      return false;
    }
    if (outletAvailability.availableTo && outletAvailability.availableTo < now) {
      return false;
    }
    return outletAvailability.isAvailable;
  }

  return true; // Available by default if no specific outlet configuration
};

// Instance method to get stock for outlet
posItemVariantSchema.methods.getStockForOutlet = function(outletId) {
  if (!this.inventory.trackInventory) {
    return { currentStock: -1, availableStock: -1, reservedStock: 0 }; // Unlimited
  }

  const outletInventory = this.inventory.outletInventory.find(
    inv => inv.outletId.toString() === outletId.toString()
  );

  if (outletInventory) {
    return {
      currentStock: outletInventory.currentStock,
      availableStock: outletInventory.currentStock - outletInventory.reservedStock,
      reservedStock: outletInventory.reservedStock,
      minStock: outletInventory.minStock,
      maxStock: outletInventory.maxStock
    };
  }

  return { currentStock: 0, availableStock: 0, reservedStock: 0 };
};

// Instance method to update stock
posItemVariantSchema.methods.updateStock = function(outletId, quantity, operation = 'SET') {
  if (!this.inventory.trackInventory) {
    return { success: false, error: 'Inventory tracking not enabled for this variant' };
  }

  const outletInventory = this.inventory.outletInventory.find(
    inv => inv.outletId.toString() === outletId.toString()
  );

  if (!outletInventory) {
    return { success: false, error: 'Outlet inventory not configured' };
  }

  let newStock;
  switch (operation) {
    case 'SET':
      newStock = quantity;
      break;
    case 'ADD':
      newStock = outletInventory.currentStock + quantity;
      break;
    case 'SUBTRACT':
      newStock = outletInventory.currentStock - quantity;
      break;
    default:
      return { success: false, error: 'Invalid operation' };
  }

  if (newStock < 0 && !this.inventory.allowNegativeStock) {
    return { success: false, error: 'Insufficient stock' };
  }

  outletInventory.currentStock = newStock;
  outletInventory.lastUpdated = new Date();

  return { success: true, newStock };
};

// Instance method to reserve stock
posItemVariantSchema.methods.reserveStock = function(outletId, quantity) {
  if (!this.inventory.trackInventory) {
    return { success: true, reserved: quantity };
  }

  const outletInventory = this.inventory.outletInventory.find(
    inv => inv.outletId.toString() === outletId.toString()
  );

  if (!outletInventory) {
    return { success: false, error: 'Outlet inventory not configured' };
  }

  const availableStock = outletInventory.currentStock - outletInventory.reservedStock;

  if (availableStock >= quantity) {
    outletInventory.reservedStock += quantity;
    outletInventory.lastUpdated = new Date();
    return { success: true, reserved: quantity };
  }

  return { success: false, error: 'Insufficient stock', available: availableStock };
};

// Instance method to release reserved stock
posItemVariantSchema.methods.releaseStock = function(outletId, quantity) {
  if (!this.inventory.trackInventory) {
    return { success: true };
  }

  const outletInventory = this.inventory.outletInventory.find(
    inv => inv.outletId.toString() === outletId.toString()
  );

  if (outletInventory) {
    outletInventory.reservedStock = Math.max(0, outletInventory.reservedStock - quantity);
    outletInventory.lastUpdated = new Date();
    return { success: true };
  }

  return { success: false, error: 'Outlet inventory not configured' };
};

// Instance method to update analytics
posItemVariantSchema.methods.updateAnalytics = function(orderValue) {
  this.analytics.totalOrders += 1;
  this.analytics.totalRevenue += orderValue;
  this.analytics.averageOrderValue = this.analytics.totalRevenue / this.analytics.totalOrders;
  this.analytics.lastOrdered = new Date();
  
  // Update popularity score (simplified algorithm)
  this.analytics.popularityScore = Math.min(100, this.analytics.popularityScore + 1);
  
  return this.save();
};

// Instance method to generate variant name
posItemVariantSchema.methods.generateVariantName = function() {
  const attributeNames = this.attributes.map(attr => attr.displayName).join(' ');
  return `${this.displayName} - ${attributeNames}`.trim();
};

// Instance method to validate variant
posItemVariantSchema.methods.validateVariant = function() {
  const errors = [];

  if (!this.attributes || this.attributes.length === 0) {
    errors.push('Variant must have at least one attribute');
  }

  if (this.pricing.basePrice < 0) {
    errors.push('Base price cannot be negative');
  }

  if (this.inventory.trackInventory) {
    for (const outletInv of this.inventory.outletInventory) {
      if (outletInv.minStock > outletInv.maxStock && outletInv.maxStock !== -1) {
        errors.push(`Min stock cannot be greater than max stock for outlet ${outletInv.outletId}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

export default mongoose.model('POSItemVariant', posItemVariantSchema);
