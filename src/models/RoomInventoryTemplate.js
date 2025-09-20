import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     RoomInventoryTemplate:
 *       type: object
 *       required:
 *         - hotelId
 *         - name
 *         - roomTypes
 *         - items
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID this template belongs to
 *         name:
 *           type: string
 *           description: Name of the template
 *         description:
 *           type: string
 *           description: Description of the template
 *         roomTypes:
 *           type: array
 *           items:
 *             type: string
 *           description: Room types this template applies to
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *               defaultQuantity:
 *                 type: number
 *               minQuantity:
 *                 type: number
 *               maxComplimentary:
 *                 type: number
 *               isRequired:
 *                 type: boolean
 *               checkFrequency:
 *                 type: string
 *               location:
 *                 type: string
 *         isDefault:
 *           type: boolean
 *           description: Whether this is the default template
 *         isActive:
 *           type: boolean
 *           description: Whether template is currently active
 */

const roomInventoryTemplateSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Template name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  roomTypes: [{
    type: String,
    required: true,
    enum: {
      values: ['standard', 'deluxe', 'suite', 'presidential', 'family', 'accessible'],
      message: 'Invalid room type'
    }
  }],
  items: [{
    itemId: {
      type: mongoose.Schema.ObjectId,
      ref: 'InventoryItem',
      required: [true, 'Item ID is required']
    },
    defaultQuantity: {
      type: Number,
      required: [true, 'Default quantity is required'],
      min: [0, 'Default quantity must be non-negative']
    },
    minQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Minimum quantity must be non-negative'],
      description: 'Minimum quantity that must always be present'
    },
    maxComplimentary: {
      type: Number,
      default: function() { return this.defaultQuantity; },
      min: [0, 'Max complimentary must be non-negative'],
      description: 'Maximum complimentary quantity before charging'
    },
    isRequired: {
      type: Boolean,
      default: true,
      description: 'Whether this item is required for room readiness'
    },
    checkFrequency: {
      type: String,
      enum: {
        values: ['daily', 'weekly', 'checkout', 'checkin', 'maintenance'],
        message: 'Invalid check frequency'
      },
      default: 'daily'
    },
    location: {
      type: String,
      trim: true,
      maxlength: [100, 'Location cannot exceed 100 characters'],
      description: 'Specific location in room where item should be placed'
    },
    notes: {
      type: String,
      maxlength: [200, 'Notes cannot exceed 200 characters']
    }
  }],
  checklistItems: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: ['electronics', 'plumbing', 'furniture', 'amenities', 'cleanliness']
    },
    description: {
      type: String,
      maxlength: [200, 'Description cannot exceed 200 characters']
    },
    checkPoints: [{
      item: String,
      expectedCondition: String,
      checkInstructions: String
    }],
    isRequired: {
      type: Boolean,
      default: true
    },
    checkFrequency: {
      type: String,
      enum: ['daily', 'checkout', 'checkin', 'maintenance'],
      default: 'checkout'
    }
  }],
  isDefault: {
    type: Boolean,
    default: false,
    description: 'Whether this is the default template for the hotel'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  version: {
    type: Number,
    default: 1,
    description: 'Template version for change tracking'
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
roomInventoryTemplateSchema.index({ hotelId: 1, isActive: 1 });
roomInventoryTemplateSchema.index({ hotelId: 1, isDefault: 1 });
roomInventoryTemplateSchema.index({ hotelId: 1, roomTypes: 1 });

// Virtual for total items count
roomInventoryTemplateSchema.virtual('totalItems').get(function() {
  return this.items.length;
});

// Virtual for estimated setup cost
roomInventoryTemplateSchema.virtual('estimatedCost').get(function() {
  return this.items.reduce((total, item) => {
    if (item.itemId && item.itemId.unitPrice) {
      return total + (item.itemId.unitPrice * item.defaultQuantity);
    }
    return total;
  }, 0);
});

// Pre-save middleware
roomInventoryTemplateSchema.pre('save', async function(next) {
  // Only one default template per hotel
  if (this.isDefault) {
    await this.constructor.updateMany(
      { 
        hotelId: this.hotelId, 
        _id: { $ne: this._id },
        isDefault: true 
      },
      { isDefault: false }
    );
  }
  
  // Increment version on update
  if (!this.isNew) {
    this.version += 1;
  }
  
  next();
});

// Instance method to clone template
roomInventoryTemplateSchema.methods.cloneTemplate = function(newName, roomTypes) {
  const clonedTemplate = new this.constructor({
    hotelId: this.hotelId,
    name: newName || `${this.name} (Copy)`,
    description: `Cloned from ${this.name}`,
    roomTypes: roomTypes || this.roomTypes,
    items: this.items.map(item => ({
      itemId: item.itemId,
      defaultQuantity: item.defaultQuantity,
      minQuantity: item.minQuantity,
      maxComplimentary: item.maxComplimentary,
      isRequired: item.isRequired,
      checkFrequency: item.checkFrequency,
      location: item.location,
      notes: item.notes
    })),
    checklistItems: this.checklistItems.map(checklist => ({
      name: checklist.name,
      category: checklist.category,
      description: checklist.description,
      checkPoints: checklist.checkPoints,
      isRequired: checklist.isRequired,
      checkFrequency: checklist.checkFrequency
    })),
    isDefault: false,
    isActive: true,
    version: 1
  });
  
  return clonedTemplate.save();
};

// Static method to get default template
roomInventoryTemplateSchema.statics.getDefaultTemplate = function(hotelId) {
  return this.findOne({ 
    hotelId, 
    isDefault: true, 
    isActive: true 
  }).populate('items.itemId');
};

// Static method to get template by room type
roomInventoryTemplateSchema.statics.getByRoomType = function(hotelId, roomType) {
  return this.find({
    hotelId,
    roomTypes: roomType,
    isActive: true
  }).populate('items.itemId');
};

// Static method to get active templates
roomInventoryTemplateSchema.statics.getActiveTemplates = function(hotelId) {
  return this.find({
    hotelId,
    isActive: true
  }).populate('items.itemId');
};

// Instance method to calculate total cost for room setup
roomInventoryTemplateSchema.methods.calculateSetupCost = async function() {
  await this.populate('items.itemId');
  
  return this.items.reduce((total, item) => {
    if (item.itemId && item.itemId.unitPrice) {
      return total + (item.itemId.unitPrice * item.defaultQuantity);
    }
    return total;
  }, 0);
};

// Instance method to validate template completeness
roomInventoryTemplateSchema.methods.validateTemplate = async function() {
  const errors = [];
  
  // Check if all items exist and are active
  await this.populate('items.itemId');
  
  this.items.forEach((item, index) => {
    if (!item.itemId) {
      errors.push(`Item at index ${index} does not exist`);
    } else if (!item.itemId.isActive) {
      errors.push(`Item "${item.itemId.name}" is not active`);
    }
  });
  
  // Check for required categories
  const requiredCategories = ['bedding', 'toiletries', 'electronics'];
  const presentCategories = new Set(
    this.items
      .filter(item => item.itemId)
      .map(item => item.itemId.category)
  );
  
  requiredCategories.forEach(category => {
    if (!presentCategories.has(category)) {
      errors.push(`Missing required category: ${category}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export default mongoose.model('RoomInventoryTemplate', roomInventoryTemplateSchema);
