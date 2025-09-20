import mongoose from 'mongoose';

const menuItemSchema = new mongoose.Schema({
  itemId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  category: {
    type: String,
    required: true
  },
  subcategory: String,
  price: {
    type: Number,
    required: true,
    min: 0
  },
  costPrice: {
    type: Number,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  preparationTime: {
    type: Number, // in minutes
    default: 15
  },
  allergens: [String],
  dietaryInfo: [{
    type: String,
    enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'halal', 'kosher']
  }],
  ingredients: [String],
  image: String,
  outlets: [{
    outletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSOutlet'
    },
    price: Number, // outlet-specific pricing
    isAvailable: { type: Boolean, default: true }
  }],
  modifiers: [{
    name: String,
    options: [{
      name: String,
      price: Number
    }]
  }],
  // Enhanced tax configuration
  taxGroup: {
    type: String,
    enum: ['FOOD', 'BEVERAGE', 'SERVICE', 'PRODUCT', 'ALCOHOL', 'TOBACCO', 'LUXURY', 'GENERAL'],
    default: 'GENERAL',
    index: true
  },
  taxGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POSTax',
    index: true
  },
  // Measurement unit configuration
  measurementUnit: {
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MeasurementUnit',
      index: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0
    },
    unitDisplay: String // e.g., "250ml", "1kg", "2 pieces"
  },
  // POS attributes configuration
  attributes: [{
    attributeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSAttribute',
      required: true
    },
    isRequired: {
      type: Boolean,
      default: false
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  // Legacy tax fields for backward compatibility
  taxes: {
    taxable: { type: Boolean, default: true },
    taxRate: Number
  }
});

const posMenuSchema = new mongoose.Schema({
  menuId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  outlet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POSOutlet',
    required: true
  },
  type: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'all_day', 'beverages', 'room_service', 'spa', 'retail', 'services'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  availableHours: {
    start: String, // 24-hour format
    end: String
  },
  items: [menuItemSchema],
  categories: [{
    name: String,
    displayOrder: Number,
    isActive: { type: Boolean, default: true }
  }]
}, {
  timestamps: true
});

export default mongoose.model('POSMenu', posMenuSchema);
