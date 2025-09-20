import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     InventoryItem:
 *       type: object
 *       required:
 *         - hotelId
 *         - name
 *         - category
 *         - unitPrice
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID this item belongs to
 *         name:
 *           type: string
 *           description: Name of the inventory item
 *         category:
 *           type: string
 *           enum: [bedding, toiletries, minibar, electronics, amenities, cleaning, furniture]
 *           description: Category of the item
 *         brand:
 *           type: string
 *           description: Brand name of the item
 *         unitPrice:
 *           type: number
 *           description: Cost price of the item
 *         replacementPrice:
 *           type: number
 *           description: Price to replace if damaged
 *         guestPrice:
 *           type: number
 *           description: Price charged to guest for extras
 *         isComplimentary:
 *           type: boolean
 *           description: Whether item is complimentary by default
 *         isChargeable:
 *           type: boolean
 *           description: Whether item can be charged for extras
 *         stockThreshold:
 *           type: number
 *           description: Alert when stock goes below this level
 *         supplier:
 *           type: string
 *           description: Supplier information
 *         imageUrl:
 *           type: string
 *           description: Image URL for the item
 *         description:
 *           type: string
 *           description: Detailed description of the item
 *         specifications:
 *           type: object
 *           description: Technical specifications
 *         isActive:
 *           type: boolean
 *           description: Whether item is currently active
 */

const inventoryItemSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    maxlength: [100, 'Item name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['bedding', 'toiletries', 'minibar', 'electronics', 'amenities', 'cleaning', 'furniture'],
      message: 'Invalid category'
    },
    index: true
  },
  subcategory: {
    type: String,
    trim: true,
    maxlength: [50, 'Subcategory cannot exceed 50 characters']
  },
  brand: {
    type: String,
    trim: true,
    maxlength: [50, 'Brand cannot exceed 50 characters']
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price must be non-negative']
  },
  replacementPrice: {
    type: Number,
    min: [0, 'Replacement price must be non-negative']
  },
  guestPrice: {
    type: Number,
    min: [0, 'Guest price must be non-negative'],
    description: 'Price charged to guest for extra items'
  },
  isComplimentary: {
    type: Boolean,
    default: true,
    description: 'Whether item is provided complimentary by default'
  },
  isChargeable: {
    type: Boolean,
    default: false,
    description: 'Whether item can be charged for extras beyond complimentary'
  },
  maxComplimentary: {
    type: Number,
    default: 1,
    min: [0, 'Max complimentary must be non-negative'],
    description: 'Maximum complimentary quantity per room'
  },
  stockThreshold: {
    type: Number,
    default: 10,
    min: [0, 'Stock threshold must be non-negative']
  },
  currentStock: {
    type: Number,
    default: 0,
    min: [0, 'Current stock must be non-negative']
  },
  supplier: {
    name: {
      type: String,
      trim: true
    },
    contact: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    }
  },
  imageUrl: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  specifications: {
    type: Map,
    of: String,
    default: new Map()
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    weight: Number
  },
  maintenanceInfo: {
    cleaningInstructions: String,
    replacementFrequency: Number, // in days
    lastMaintenanceDate: Date
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  // Automated Reorder System
  reorderSettings: {
    autoReorderEnabled: {
      type: Boolean,
      default: false,
      description: 'Whether automatic reordering is enabled for this item'
    },
    reorderPoint: {
      type: Number,
      min: [0, 'Reorder point must be non-negative'],
      description: 'Stock level that triggers reorder alert'
    },
    reorderQuantity: {
      type: Number,
      min: [1, 'Reorder quantity must be at least 1'],
      description: 'Quantity to reorder when threshold is reached'
    },
    preferredSupplier: {
      name: {
        type: String,
        trim: true,
        description: 'Primary supplier name for reorders'
      },
      contact: {
        type: String,
        trim: true,
        description: 'Supplier contact information'
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        description: 'Supplier email for automated orders'
      },
      leadTime: {
        type: Number,
        min: [0, 'Lead time must be non-negative'],
        description: 'Expected delivery time in days'
      }
    },
    lastReorderDate: {
      type: Date,
      description: 'Date of last reorder'
    },
    reorderHistory: [{
      date: {
        type: Date,
        default: Date.now
      },
      quantity: {
        type: Number,
        required: true
      },
      supplier: {
        type: String,
        required: true
      },
      estimatedCost: {
        type: Number,
        min: [0, 'Cost must be non-negative']
      },
      actualCost: {
        type: Number,
        min: [0, 'Cost must be non-negative']
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'ordered', 'received', 'cancelled', 'rejected'],
        default: 'pending'
      },
      approvedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      orderDate: {
        type: Date
      },
      expectedDeliveryDate: {
        type: Date
      },
      actualDeliveryDate: {
        type: Date
      },
      notes: {
        type: String,
        maxlength: [500, 'Notes cannot exceed 500 characters']
      },
      alertId: {
        type: mongoose.Schema.ObjectId,
        ref: 'ReorderAlert'
      }
    }]
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

// Indexes for efficient queries
inventoryItemSchema.index({ hotelId: 1, category: 1 });
inventoryItemSchema.index({ hotelId: 1, isActive: 1 });
inventoryItemSchema.index({ hotelId: 1, currentStock: 1 });
inventoryItemSchema.index({ hotelId: 1, name: 'text', description: 'text' });

// Virtual for low stock status
inventoryItemSchema.virtual('isLowStock').get(function() {
  return this.currentStock <= this.stockThreshold;
});

// Virtual for guest charge price (with markup)
inventoryItemSchema.virtual('effectiveGuestPrice').get(function() {
  if (this.guestPrice) return this.guestPrice;
  // Default markup of 150% of unit price
  return Math.round(this.unitPrice * 1.5);
});

// Virtual for replacement charge (with markup)
inventoryItemSchema.virtual('effectiveReplacementPrice').get(function() {
  if (this.replacementPrice) return this.replacementPrice;
  // Default markup of 180% of unit price for replacements
  return Math.round(this.unitPrice * 1.8);
});

// Virtual for reorder status
inventoryItemSchema.virtual('needsReorder').get(function() {
  if (!this.reorderSettings?.autoReorderEnabled) return false;
  if (!this.reorderSettings?.reorderPoint) return false;
  return this.currentStock <= this.reorderSettings.reorderPoint;
});

// Virtual for reorder urgency (days until stock out)
inventoryItemSchema.virtual('reorderUrgency').get(function() {
  if (!this.needsReorder) return null;

  // Calculate estimated days until stockout based on usage patterns
  // For now, return a simple calculation based on current stock
  const dailyUsage = 1; // Default assumption - could be calculated from historical data
  return Math.floor(this.currentStock / dailyUsage);
});

// Virtual for estimated reorder cost
inventoryItemSchema.virtual('estimatedReorderCost').get(function() {
  if (!this.reorderSettings?.reorderQuantity) return 0;
  return this.unitPrice * this.reorderSettings.reorderQuantity;
});

// Pre-save middleware
inventoryItemSchema.pre('save', function(next) {
  // Set default replacement price if not provided
  if (!this.replacementPrice) {
    this.replacementPrice = Math.round(this.unitPrice * 1.8);
  }
  
  // Set default guest price if not provided
  if (!this.guestPrice) {
    this.guestPrice = Math.round(this.unitPrice * 1.5);
  }
  
  next();
});

// Instance method to update stock
inventoryItemSchema.methods.updateStock = function(quantity, operation = 'add') {
  if (operation === 'add') {
    this.currentStock += quantity;
  } else if (operation === 'subtract') {
    this.currentStock = Math.max(0, this.currentStock - quantity);
  } else if (operation === 'set') {
    this.currentStock = Math.max(0, quantity);
  }
  
  return this.save();
};

// Static method to get low stock items
inventoryItemSchema.statics.getLowStockItems = function(hotelId) {
  return this.find({
    hotelId,
    isActive: true,
    $expr: { $lte: ['$currentStock', '$stockThreshold'] }
  }).sort('currentStock');
};

// Static method to get items by category
inventoryItemSchema.statics.getByCategory = function(hotelId, category) {
  return this.find({
    hotelId,
    category,
    isActive: true
  }).sort('name');
};

// Static method to search items
inventoryItemSchema.statics.searchItems = function(hotelId, searchTerm) {
  return this.find({
    hotelId,
    isActive: true,
    $or: [
      { name: new RegExp(searchTerm, 'i') },
      { description: new RegExp(searchTerm, 'i') },
      { brand: new RegExp(searchTerm, 'i') }
    ]
  }).sort('name');
};

// Static method to get items that need reordering
inventoryItemSchema.statics.getItemsNeedingReorder = function(hotelId) {
  return this.find({
    hotelId,
    isActive: true,
    'reorderSettings.autoReorderEnabled': true,
    $expr: {
      $and: [
        { $ne: ['$reorderSettings.reorderPoint', null] },
        { $lte: ['$currentStock', '$reorderSettings.reorderPoint'] }
      ]
    }
  }).sort({ currentStock: 1 }); // Sort by most urgent (lowest stock first)
};

// Static method to get reorder-enabled items
inventoryItemSchema.statics.getReorderEnabledItems = function(hotelId) {
  return this.find({
    hotelId,
    isActive: true,
    'reorderSettings.autoReorderEnabled': true
  }).sort('name');
};

// Static method to add reorder history entry
inventoryItemSchema.statics.addReorderHistoryEntry = function(itemId, reorderData) {
  return this.findByIdAndUpdate(
    itemId,
    {
      $push: { 'reorderSettings.reorderHistory': reorderData },
      $set: { 'reorderSettings.lastReorderDate': new Date() }
    },
    { new: true }
  );
};

// Instance method to configure reorder settings
inventoryItemSchema.methods.configureReorder = function(settings) {
  this.reorderSettings = {
    ...this.reorderSettings,
    ...settings
  };
  return this.save();
};

// Instance method to check if item needs immediate reorder
inventoryItemSchema.methods.isUrgentReorder = function() {
  if (!this.needsReorder) return false;

  // Consider urgent if stock is critically low (less than 25% of reorder point)
  const criticalLevel = Math.floor(this.reorderSettings.reorderPoint * 0.25);
  return this.currentStock <= criticalLevel;
};

export default mongoose.model('InventoryItem', inventoryItemSchema);
