import mongoose from 'mongoose';

/**
 * POS Attribute Model
 * 
 * Manages attributes for POS items including:
 * - Attribute types: size, color, flavor, temperature, preparation
 * - Attribute groups and categories
 * - Required vs optional attributes
 * - Attribute validation rules
 * - Display and sorting preferences
 */

const attributeValidationSchema = new mongoose.Schema({
  minLength: {
    type: Number,
    min: 0
  },
  maxLength: {
    type: Number,
    min: 0
  },
  pattern: {
    type: String,
    trim: true
  },
  minValue: {
    type: Number
  },
  maxValue: {
    type: Number
  },
  allowedValues: [{
    type: String,
    trim: true
  }],
  customValidation: {
    type: String,
    trim: true
  }
}, { _id: false });

const posAttributeSchema = new mongoose.Schema({
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

  // Attribute identification
  attributeId: {
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

  // Attribute classification
  attributeType: {
    type: String,
    enum: [
      'SIZE',           // Small, Medium, Large, XL
      'COLOR',          // Red, Blue, Green, etc.
      'FLAVOR',         // Vanilla, Chocolate, Strawberry
      'TEMPERATURE',    // Hot, Cold, Room Temperature
      'PREPARATION',    // Rare, Medium, Well Done
      'MATERIAL',       // Cotton, Silk, Leather
      'STYLE',          // Casual, Formal, Sporty
      'BRAND',          // Nike, Adidas, Apple
      'CUSTOM'          // Custom-defined attributes
    ],
    required: true,
    index: true
  },

  // Attribute group for organization
  attributeGroup: {
    type: String,
    enum: [
      'PHYSICAL',       // Size, Color, Material
      'FUNCTIONAL',     // Temperature, Preparation
      'BRANDING',       // Brand, Style
      'CUSTOM'          // Custom groups
    ],
    required: true,
    default: 'PHYSICAL',
    index: true
  },

  // Data type and input method
  dataType: {
    type: String,
    enum: ['TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'DATE', 'COLOR_PICKER'],
    required: true,
    default: 'SELECT'
  },

  // Input configuration
  inputConfig: {
    placeholder: String,
    helpText: String,
    isRequired: {
      type: Boolean,
      default: false
    },
    isMultiple: {
      type: Boolean,
      default: false
    },
    maxSelections: {
      type: Number,
      min: 1,
      default: 1
    },
    allowCustomValues: {
      type: Boolean,
      default: false
    },
    sortOrder: {
      type: String,
      enum: ['ALPHABETICAL', 'CUSTOM', 'PRICE', 'POPULARITY'],
      default: 'ALPHABETICAL'
    }
  },

  // Validation rules
  validation: attributeValidationSchema,

  // Display preferences
  displayConfig: {
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
    },
    icon: String,
    color: String,
    cssClass: String
  },

  // Attribute status and validity
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isSystemAttribute: {
    type: Boolean,
    default: false // System attributes cannot be deleted
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
      'COMMON',         // Most commonly used attributes
      'STANDARD',       // Standard attributes for the type
      'SPECIALIZED',    // Specialized attributes for specific use cases
      'LEGACY'          // Legacy attributes for backward compatibility
    ],
    default: 'STANDARD'
  },
  sortOrder: {
    type: Number,
    default: 0
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
    inventoryTracking: {
      type: Boolean,
      default: false
    },
    affectsPricing: {
      type: Boolean,
      default: true
    },
    affectsAvailability: {
      type: Boolean,
      default: false
    }
  },

  // Attribute values (embedded for simple attributes)
  values: [{
    valueId: {
      type: String,
      required: true,
      trim: true
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
    priceModifier: {
      type: Number,
      default: 0
    },
    priceModifierType: {
      type: String,
      enum: ['FIXED', 'PERCENTAGE'],
      default: 'FIXED'
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    metadata: {
      color: String,
      icon: String,
      image: String,
      cssClass: String
    }
  }],

  // Advanced configuration
  advancedConfig: {
    allowMultipleValues: {
      type: Boolean,
      default: false
    },
    dependentAttributes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSAttribute'
    }],
    conditionalLogic: {
      conditions: [{
        attribute: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'POSAttribute'
        },
        operator: {
          type: String,
          enum: ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'GREATER_THAN', 'LESS_THAN']
        },
        value: mongoose.Schema.Types.Mixed,
        action: {
          type: String,
          enum: ['SHOW', 'HIDE', 'REQUIRE', 'OPTIONAL', 'DISABLE', 'ENABLE']
        }
      }],
      logicOperator: {
        type: String,
        enum: ['AND', 'OR'],
        default: 'AND'
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
posAttributeSchema.index({ hotelId: 1, attributeType: 1, isActive: 1 });
posAttributeSchema.index({ hotelId: 1, attributeGroup: 1, isActive: 1 });
posAttributeSchema.index({ hotelId: 1, category: 1, sortOrder: 1 });
posAttributeSchema.index({ 'posIntegration.applicableCategories': 1 });

// Virtual for formatted display
posAttributeSchema.virtual('formattedDisplay').get(function() {
  return `${this.displayName} (${this.attributeType})`;
});

// Virtual for active values count
posAttributeSchema.virtual('activeValuesCount').get(function() {
  return this.values.filter(value => value.isActive).length;
});

// Virtual for default value
posAttributeSchema.virtual('defaultValue').get(function() {
  return this.values.find(value => value.isDefault && value.isActive);
});

// Pre-save middleware to generate attributeId if not provided
posAttributeSchema.pre('save', async function(next) {
  if (!this.attributeId) {
    const prefix = this.attributeType.substring(0, 3).toUpperCase();
    const count = await this.constructor.countDocuments({
      attributeId: new RegExp(`^${prefix}`)
    });
    this.attributeId = `${prefix}${(count + 1).toString().padStart(3, '0')}`;
  }
  next();
});

// Static method to get attributes by type
posAttributeSchema.statics.getAttributesByType = function(hotelId, attributeType, options = {}) {
  const query = {
    hotelId,
    attributeType,
    isActive: true
  };

  if (options.includeSystemAttributes !== false) {
    // Include system attributes by default
  }

  return this.find(query)
    .sort({ category: 1, sortOrder: 1, displayName: 1 })
    .populate('createdBy updatedBy', 'firstName lastName email');
};

// Static method to get attributes by group
posAttributeSchema.statics.getAttributesByGroup = function(hotelId, attributeGroup) {
  return this.find({
    hotelId,
    attributeGroup,
    isActive: true
  }).sort({ sortOrder: 1, displayName: 1 });
};

// Static method to get attributes for category
posAttributeSchema.statics.getAttributesForCategory = function(hotelId, category) {
  return this.find({
    hotelId,
    isActive: true,
    $or: [
      { 'posIntegration.applicableCategories': { $in: [category, 'GENERAL'] } },
      { 'posIntegration.applicableCategories': { $size: 0 } }
    ]
  }).sort({ 'displayConfig.displayOrder': 1, displayName: 1 });
};

// Instance method to add attribute value
posAttributeSchema.methods.addValue = function(valueData) {
  const valueId = `${this.attributeId}_${(this.values.length + 1).toString().padStart(3, '0')}`;
  
  const newValue = {
    valueId,
    ...valueData
  };

  this.values.push(newValue);
  return this.save();
};

// Instance method to update attribute value
posAttributeSchema.methods.updateValue = function(valueId, updateData) {
  const value = this.values.id(valueId);
  if (value) {
    Object.assign(value, updateData);
    return this.save();
  }
  throw new Error('Value not found');
};

// Instance method to remove attribute value
posAttributeSchema.methods.removeValue = function(valueId) {
  const value = this.values.id(valueId);
  if (value) {
    value.remove();
    return this.save();
  }
  throw new Error('Value not found');
};

// Instance method to update usage statistics
posAttributeSchema.methods.updateUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

// Instance method to validate attribute value
posAttributeSchema.methods.validateValue = function(value) {
  const validation = this.validation;
  
  if (this.inputConfig.isRequired && (!value || value === '')) {
    return { valid: false, error: 'This attribute is required' };
  }

  if (validation.allowedValues && validation.allowedValues.length > 0) {
    if (!validation.allowedValues.includes(value)) {
      return { valid: false, error: 'Invalid value for this attribute' };
    }
  }

  if (validation.minLength && value && value.length < validation.minLength) {
    return { valid: false, error: `Value must be at least ${validation.minLength} characters` };
  }

  if (validation.maxLength && value && value.length > validation.maxLength) {
    return { valid: false, error: `Value must not exceed ${validation.maxLength} characters` };
  }

  if (validation.minValue && value && parseFloat(value) < validation.minValue) {
    return { valid: false, error: `Value must be at least ${validation.minValue}` };
  }

  if (validation.maxValue && value && parseFloat(value) > validation.maxValue) {
    return { valid: false, error: `Value must not exceed ${validation.maxValue}` };
  }

  return { valid: true };
};

// Instance method to get applicable values for context
posAttributeSchema.methods.getApplicableValues = function(context = {}) {
  let applicableValues = this.values.filter(value => value.isActive);

  // Apply conditional logic if present
  if (this.advancedConfig.conditionalLogic.conditions.length > 0) {
    const conditions = this.advancedConfig.conditionalLogic.conditions;
    const logicOperator = this.advancedConfig.conditionalLogic.logicOperator;
    
    let conditionResult = logicOperator === 'AND';
    
    for (const condition of conditions) {
      const contextValue = context[condition.attribute.toString()];
      let conditionMet = false;
      
      switch (condition.operator) {
        case 'EQUALS':
          conditionMet = contextValue === condition.value;
          break;
        case 'NOT_EQUALS':
          conditionMet = contextValue !== condition.value;
          break;
        case 'CONTAINS':
          conditionMet = contextValue && contextValue.includes(condition.value);
          break;
        case 'NOT_CONTAINS':
          conditionMet = !contextValue || !contextValue.includes(condition.value);
          break;
        case 'GREATER_THAN':
          conditionMet = parseFloat(contextValue) > parseFloat(condition.value);
          break;
        case 'LESS_THAN':
          conditionMet = parseFloat(contextValue) < parseFloat(condition.value);
          break;
      }
      
      if (logicOperator === 'AND') {
        conditionResult = conditionResult && conditionMet;
      } else {
        conditionResult = conditionResult || conditionMet;
      }
    }
    
    if (!conditionResult) {
      return [];
    }
  }

  // Sort values based on configuration
  switch (this.inputConfig.sortOrder) {
    case 'ALPHABETICAL':
      applicableValues.sort((a, b) => a.displayName.localeCompare(b.displayName));
      break;
    case 'CUSTOM':
      applicableValues.sort((a, b) => a.sortOrder - b.sortOrder);
      break;
    case 'PRICE':
      applicableValues.sort((a, b) => a.priceModifier - b.priceModifier);
      break;
    case 'POPULARITY':
      // This would require usage tracking per value
      applicableValues.sort((a, b) => a.sortOrder - b.sortOrder);
      break;
  }

  return applicableValues;
};

export default mongoose.model('POSAttribute', posAttributeSchema);
