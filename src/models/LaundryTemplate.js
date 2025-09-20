import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     LaundryTemplate:
 *       type: object
 *       required:
 *         - hotelId
 *         - roomType
 *         - items
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID this template belongs to
 *         roomType:
 *           type: string
 *           description: Room type this template applies to
 *         templateName:
 *           type: string
 *           description: Human-readable name for this template
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *               itemName:
 *                 type: string
 *               category:
 *                 type: string
 *               baseQuantity:
 *                 type: number
 *               isRequired:
 *                 type: boolean
 *               defaultReturnDays:
 *                 type: number
 *               specialInstructions:
 *                 type: string
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const laundryTemplateSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  roomType: {
    type: String,
    required: [true, 'Room type is required'],
    enum: {
      values: ['standard', 'deluxe', 'suite', 'presidential', 'family', 'accessible', 'executive', 'penthouse'],
      message: 'Invalid room type'
    },
    index: true
  },
  templateName: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Template name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  items: [{
    itemId: {
      type: mongoose.Schema.ObjectId,
      ref: 'InventoryItem',
      required: [true, 'Item ID is required']
    },
    itemName: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['bedding', 'towels', 'bathrobes', 'curtains', 'carpets', 'other'],
        message: 'Invalid laundry category'
      }
    },
    baseQuantity: {
      type: Number,
      required: [true, 'Base quantity is required'],
      min: [0, 'Base quantity must be non-negative'],
      default: 1
    },
    guestMultiplier: {
      type: Number,
      default: 1,
      min: [0.1, 'Guest multiplier must be at least 0.1'],
      max: [5, 'Guest multiplier cannot exceed 5'],
      description: 'Multiplier based on number of guests'
    },
    isRequired: {
      type: Boolean,
      default: true,
      description: 'Whether this item is always included in laundry'
    },
    conditionThreshold: {
      type: String,
      enum: ['always', 'if_used', 'if_dirty', 'if_damaged', 'never'],
      default: 'if_used',
      description: 'When to include this item in laundry'
    },
    defaultReturnDays: {
      type: Number,
      default: 1,
      min: [1, 'Return days must be at least 1'],
      max: [7, 'Return days cannot exceed 7']
    },
    specialInstructions: {
      type: String,
      maxlength: [200, 'Special instructions cannot exceed 200 characters']
    },
    costPerItem: {
      type: Number,
      min: [0, 'Cost per item must be non-negative'],
      description: 'Cost for laundering this item'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      description: 'Priority level for this item'
    }
  }],
  guestCountAdjustments: {
    single: {
      type: Number,
      default: 1,
      description: 'Multiplier for single occupancy'
    },
    double: {
      type: Number,
      default: 1.5,
      description: 'Multiplier for double occupancy'
    },
    triple: {
      type: Number,
      default: 2,
      description: 'Multiplier for triple occupancy'
    },
    quadPlus: {
      type: Number,
      default: 2.5,
      description: 'Multiplier for quad or more occupancy'
    }
  },
  seasonalAdjustments: {
    summer: {
      type: Number,
      default: 1.2,
      description: 'Multiplier for summer season (more towels)'
    },
    winter: {
      type: Number,
      default: 1.1,
      description: 'Multiplier for winter season (more bedding)'
    },
    monsoon: {
      type: Number,
      default: 1.3,
      description: 'Multiplier for monsoon season (more frequent changes)'
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isDefault: {
    type: Boolean,
    default: false,
    description: 'Whether this is the default template for this room type'
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Created by is required']
  },
  lastUpdatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  usageStats: {
    timesUsed: {
      type: Number,
      default: 0,
      description: 'Number of times this template has been used'
    },
    lastUsed: {
      type: Date,
      description: 'When this template was last used'
    },
    averageProcessingTime: {
      type: Number,
      description: 'Average processing time in hours'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
laundryTemplateSchema.index({ hotelId: 1, roomType: 1, isActive: 1 });
laundryTemplateSchema.index({ hotelId: 1, isDefault: 1 });
laundryTemplateSchema.index({ hotelId: 1, 'items.category': 1 });

// Virtual for total items count
laundryTemplateSchema.virtual('totalItems').get(function() {
  return this.items.length;
});

// Virtual for estimated total cost
laundryTemplateSchema.virtual('estimatedTotalCost').get(function() {
  return this.items.reduce((total, item) => {
    return total + (item.costPerItem || 0) * item.baseQuantity;
  }, 0);
});

// Virtual for template summary
laundryTemplateSchema.virtual('summary').get(function() {
  return {
    roomType: this.roomType,
    templateName: this.templateName,
    totalItems: this.totalItems,
    estimatedCost: this.estimatedTotalCost,
    isActive: this.isActive,
    isDefault: this.isDefault
  };
});

// Pre-save middleware
laundryTemplateSchema.pre('save', function(next) {
  // Ensure only one default template per room type per hotel
  if (this.isDefault && this.isModified('isDefault')) {
    this.constructor.updateMany(
      { 
        hotelId: this.hotelId, 
        roomType: this.roomType, 
        _id: { $ne: this._id } 
      },
      { isDefault: false }
    ).exec();
  }
  
  next();
});

// Instance method to calculate laundry items for specific guest count
laundryTemplateSchema.methods.calculateLaundryItems = function(guestCount, season = 'normal', roomCondition = 'normal') {
  const items = [];
  
  // Determine guest multiplier
  let guestMultiplier = 1;
  if (guestCount === 1) {
    guestMultiplier = this.guestCountAdjustments.single;
  } else if (guestCount === 2) {
    guestMultiplier = this.guestCountAdjustments.double;
  } else if (guestCount === 3) {
    guestMultiplier = this.guestCountAdjustments.triple;
  } else if (guestCount >= 4) {
    guestMultiplier = this.guestCountAdjustments.quadPlus;
  }
  
  // Apply seasonal adjustment
  let seasonalMultiplier = 1;
  if (this.seasonalAdjustments[season]) {
    seasonalMultiplier = this.seasonalAdjustments[season];
  }
  
  // Calculate final multiplier
  const finalMultiplier = guestMultiplier * seasonalMultiplier;
  
  // Process each item
  for (const item of this.items) {
    // Check if item should be included based on condition
    let shouldInclude = true;
    
    switch (item.conditionThreshold) {
      case 'always':
        shouldInclude = true;
        break;
      case 'if_used':
        shouldInclude = roomCondition !== 'unused';
        break;
      case 'if_dirty':
        shouldInclude = roomCondition === 'dirty' || roomCondition === 'very_dirty';
        break;
      case 'if_damaged':
        shouldInclude = roomCondition === 'damaged';
        break;
      case 'never':
        shouldInclude = false;
        break;
    }
    
    if (shouldInclude) {
      // Calculate quantity
      const baseQuantity = item.baseQuantity;
      const guestAdjustedQuantity = Math.ceil(baseQuantity * item.guestMultiplier * finalMultiplier);
      
      // Ensure minimum quantity for required items
      const finalQuantity = item.isRequired ? Math.max(1, guestAdjustedQuantity) : guestAdjustedQuantity;
      
      items.push({
        itemId: item.itemId,
        itemName: item.itemName,
        category: item.category,
        quantity: finalQuantity,
        baseQuantity: baseQuantity,
        guestMultiplier: item.guestMultiplier,
        finalMultiplier: finalMultiplier,
        isRequired: item.isRequired,
        defaultReturnDays: item.defaultReturnDays,
        specialInstructions: item.specialInstructions,
        costPerItem: item.costPerItem,
        priority: item.priority,
        estimatedCost: (item.costPerItem || 0) * finalQuantity
      });
    }
  }
  
  return items;
};

// Instance method to update usage statistics
laundryTemplateSchema.methods.updateUsageStats = function(processingTimeHours) {
  this.usageStats.timesUsed += 1;
  this.usageStats.lastUsed = new Date();
  
  // Update average processing time
  if (this.usageStats.averageProcessingTime) {
    this.usageStats.averageProcessingTime = 
      (this.usageStats.averageProcessingTime + processingTimeHours) / 2;
  } else {
    this.usageStats.averageProcessingTime = processingTimeHours;
  }
  
  return this.save();
};

// Static method to get template for room type
laundryTemplateSchema.statics.getForRoomType = function(hotelId, roomType) {
  return this.findOne({
    hotelId,
    roomType,
    isActive: true,
    isDefault: true
  }).populate('items.itemId');
};

// Static method to get all templates for hotel
laundryTemplateSchema.statics.getForHotel = function(hotelId) {
  return this.find({
    hotelId,
    isActive: true
  }).populate('items.itemId').sort({ roomType: 1, isDefault: -1 });
};

// Static method to create default templates
laundryTemplateSchema.statics.createDefaultTemplates = function(hotelId, createdBy) {
  const defaultTemplates = [
    {
      hotelId,
      roomType: 'standard',
      templateName: 'Standard Room Laundry Template',
      description: 'Default laundry template for standard rooms',
      items: [
        {
          itemId: null, // Will be populated with actual inventory items
          itemName: 'Bed Sheets',
          category: 'bedding',
          baseQuantity: 2,
          guestMultiplier: 1,
          isRequired: true,
          defaultReturnDays: 1,
          priority: 'high'
        },
        {
          itemId: null,
          itemName: 'Pillowcases',
          category: 'bedding',
          baseQuantity: 2,
          guestMultiplier: 1,
          isRequired: true,
          defaultReturnDays: 1,
          priority: 'high'
        },
        {
          itemId: null,
          itemName: 'Bath Towels',
          category: 'towels',
          baseQuantity: 4,
          guestMultiplier: 1.5,
          isRequired: true,
          defaultReturnDays: 1,
          priority: 'medium'
        },
        {
          itemId: null,
          itemName: 'Hand Towels',
          category: 'towels',
          baseQuantity: 2,
          guestMultiplier: 1,
          isRequired: true,
          defaultReturnDays: 1,
          priority: 'medium'
        }
      ],
      isDefault: true,
      createdBy
    },
    {
      hotelId,
      roomType: 'deluxe',
      templateName: 'Deluxe Room Laundry Template',
      description: 'Default laundry template for deluxe rooms',
      items: [
        {
          itemId: null,
          itemName: 'Bed Sheets',
          category: 'bedding',
          baseQuantity: 3,
          guestMultiplier: 1,
          isRequired: true,
          defaultReturnDays: 1,
          priority: 'high'
        },
        {
          itemId: null,
          itemName: 'Pillowcases',
          category: 'bedding',
          baseQuantity: 4,
          guestMultiplier: 1,
          isRequired: true,
          defaultReturnDays: 1,
          priority: 'high'
        },
        {
          itemId: null,
          itemName: 'Bath Towels',
          category: 'towels',
          baseQuantity: 6,
          guestMultiplier: 1.5,
          isRequired: true,
          defaultReturnDays: 1,
          priority: 'medium'
        },
        {
          itemId: null,
          itemName: 'Hand Towels',
          category: 'towels',
          baseQuantity: 4,
          guestMultiplier: 1,
          isRequired: true,
          defaultReturnDays: 1,
          priority: 'medium'
        },
        {
          itemId: null,
          itemName: 'Bathrobes',
          category: 'bathrobes',
          baseQuantity: 2,
          guestMultiplier: 1,
          isRequired: true,
          defaultReturnDays: 2,
          priority: 'low'
        }
      ],
      isDefault: true,
      createdBy
    }
  ];

  return this.insertMany(defaultTemplates);
};

export default mongoose.model('LaundryTemplate', laundryTemplateSchema);
