import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     InventoryTransaction:
 *       type: object
 *       required:
 *         - hotelId
 *         - roomId
 *         - transactionType
 *         - items
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         roomId:
 *           type: string
 *           description: Room ID where transaction occurred
 *         bookingId:
 *           type: string
 *           description: Related booking ID if applicable
 *         transactionType:
 *           type: string
 *           enum: [replacement, extra_request, damage, checkout_charge, maintenance, restocking, setup]
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *               name:
 *                 type: string
 *               quantityChanged:
 *                 type: number
 *               unitPrice:
 *                 type: number
 *               totalCost:
 *                 type: number
 *               reason:
 *                 type: string
 *               isChargeable:
 *                 type: boolean
 *         totalAmount:
 *           type: number
 *         chargedToGuest:
 *           type: boolean
 *         status:
 *           type: string
 *           enum: [pending, approved, completed, cancelled, refunded]
 */

const inventoryTransactionSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  roomId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Room',
    required: [true, 'Room ID is required'],
    index: true
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    index: true,
    description: 'Related booking if applicable'
  },
  guestId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    description: 'Guest involved in transaction if applicable'
  },
  transactionType: {
    type: String,
    required: [true, 'Transaction type is required'],
    enum: {
      values: [
        'replacement',      // Item replacement during maintenance
        'extra_request',    // Guest requested extra items
        'damage',          // Damage found during inspection
        'checkout_charge', // Charges applied at checkout
        'maintenance',     // Maintenance-related transaction
        'restocking',      // Restocking items
        'setup',          // Initial room setup
        'theft',          // Items reported stolen
        'complimentary'   // Complimentary item provision
      ],
      message: 'Invalid transaction type'
    },
    index: true
  },
  items: [{
    itemId: {
      type: mongoose.Schema.ObjectId,
      ref: 'InventoryItem',
      required: [true, 'Item ID is required']
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true
    },
    category: {
      type: String,
      enum: ['bedding', 'toiletries', 'minibar', 'electronics', 'amenities', 'cleaning', 'furniture']
    },
    quantityChanged: {
      type: Number,
      required: [true, 'Quantity changed is required'],
      description: 'Positive for added, negative for removed'
    },
    previousQuantity: {
      type: Number,
      min: 0
    },
    newQuantity: {
      type: Number,
      min: 0
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price must be non-negative']
    },
    totalCost: {
      type: Number,
      required: [true, 'Total cost is required'],
      min: [0, 'Total cost must be non-negative']
    },
    condition: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'worn', 'damaged', 'missing']
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      enum: {
        values: [
          'damaged_by_guest',
          'normal_wear',
          'stolen',
          'missing',
          'guest_request',
          'maintenance_replacement',
          'hygiene_requirement',
          'initial_setup',
          'restock',
          'complimentary_upgrade',
          'quality_issue'
        ],
        message: 'Invalid reason'
      }
    },
    isChargeable: {
      type: Boolean,
      required: [true, 'Chargeable status is required']
    },
    chargeType: {
      type: String,
      enum: ['replacement', 'extra', 'damage', 'theft'],
      description: 'Type of charge applied to guest'
    },
    location: {
      type: String,
      trim: true,
      description: 'Location in room where item was found/placed'
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    photos: [{
      url: String,
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount must be non-negative']
  },
  chargedToGuest: {
    type: Boolean,
    default: false,
    index: true
  },
  guestChargeAmount: {
    type: Number,
    min: 0,
    description: 'Amount actually charged to guest (may differ from cost)'
  },
  processedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Processed by user is required']
  },
  approvedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    description: 'User who approved the transaction'
  },
  processedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  approvedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'completed', 'cancelled', 'refunded'],
      message: 'Invalid transaction status'
    },
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  inspectionId: {
    type: mongoose.Schema.ObjectId,
    description: 'Related inspection ID if from inspection'
  },
  invoiceId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Invoice',
    description: 'Related invoice if charged to guest'
  },
  replacementRequestId: {
    type: mongoose.Schema.ObjectId,
    description: 'Related replacement request ID'
  },
  scheduledDate: {
    type: Date,
    description: 'When transaction is scheduled to occur'
  },
  completedDate: {
    type: Date,
    description: 'When transaction was actually completed'
  },
  cancellationReason: {
    type: String,
    maxlength: [200, 'Cancellation reason cannot exceed 200 characters']
  },
  refundAmount: {
    type: Number,
    min: 0
  },
  refundDate: {
    type: Date
  },
  refundReason: {
    type: String,
    maxlength: [200, 'Refund reason cannot exceed 200 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
inventoryTransactionSchema.index({ hotelId: 1, processedAt: -1 });
inventoryTransactionSchema.index({ hotelId: 1, transactionType: 1 });
inventoryTransactionSchema.index({ hotelId: 1, status: 1 });
inventoryTransactionSchema.index({ bookingId: 1, chargedToGuest: 1 });
inventoryTransactionSchema.index({ guestId: 1, chargedToGuest: 1 });
inventoryTransactionSchema.index({ roomId: 1, processedAt: -1 });

// Virtual for transaction age in hours
inventoryTransactionSchema.virtual('ageInHours').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.processedAt);
  return Math.ceil(diffTime / (1000 * 60 * 60));
});

// Virtual for items count
inventoryTransactionSchema.virtual('itemsCount').get(function() {
  return this.items.length;
});

// Virtual for chargeable items count
inventoryTransactionSchema.virtual('chargeableItemsCount').get(function() {
  return this.items.filter(item => item.isChargeable).length;
});

// Pre-save middleware
inventoryTransactionSchema.pre('save', function(next) {
  // Calculate total amount from items
  this.totalAmount = this.items.reduce((total, item) => total + item.totalCost, 0);
  
  // Calculate guest charge amount
  if (this.chargedToGuest) {
    this.guestChargeAmount = this.items
      .filter(item => item.isChargeable)
      .reduce((total, item) => total + item.totalCost, 0);
  }
  
  // Update completion date when status changes to completed
  if (this.status === 'completed' && !this.completedDate) {
    this.completedDate = new Date();
  }
  
  next();
});

// Instance method to approve transaction
inventoryTransactionSchema.methods.approve = function(approvedBy, notes) {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  if (notes) this.notes = notes;
  
  return this.save();
};

// Instance method to complete transaction
inventoryTransactionSchema.methods.complete = function(completedBy, notes) {
  this.status = 'completed';
  this.completedDate = new Date();
  if (completedBy) this.processedBy = completedBy;
  if (notes) this.notes = notes;
  
  return this.save();
};

// Instance method to cancel transaction
inventoryTransactionSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  
  return this.save();
};

// Instance method to process refund
inventoryTransactionSchema.methods.processRefund = function(amount, reason) {
  this.status = 'refunded';
  this.refundAmount = amount;
  this.refundDate = new Date();
  this.refundReason = reason;
  
  return this.save();
};

// Static method to get pending transactions
inventoryTransactionSchema.statics.getPendingTransactions = function(hotelId, limit = 50) {
  return this.find({
    hotelId,
    status: 'pending'
  })
  .populate('roomId', 'roomNumber type')
  .populate('bookingId', 'bookingNumber guestDetails')
  .populate('processedBy', 'name')
  .sort({ processedAt: -1 })
  .limit(limit);
};

// Static method to get transactions by room
inventoryTransactionSchema.statics.getByRoom = function(roomId, startDate, endDate) {
  const query = { roomId };
  
  if (startDate || endDate) {
    query.processedAt = {};
    if (startDate) query.processedAt.$gte = new Date(startDate);
    if (endDate) query.processedAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .populate('items.itemId', 'name category')
    .populate('processedBy', 'name')
    .sort({ processedAt: -1 });
};

// Static method to get guest charges
inventoryTransactionSchema.statics.getGuestCharges = function(bookingId) {
  return this.find({
    bookingId,
    chargedToGuest: true,
    status: { $in: ['completed', 'approved'] }
  })
  .populate('items.itemId', 'name category')
  .sort({ processedAt: -1 });
};

// Static method to get cost analytics
inventoryTransactionSchema.statics.getCostAnalytics = async function(hotelId, startDate, endDate) {
  const matchQuery = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    status: 'completed'
  };
  
  if (startDate || endDate) {
    matchQuery.processedAt = {};
    if (startDate) matchQuery.processedAt.$gte = new Date(startDate);
    if (endDate) matchQuery.processedAt.$lte = new Date(endDate);
  }
  
  const pipeline = [
    { $match: matchQuery },
    { $unwind: '$items' },
    {
      $group: {
        _id: {
          transactionType: '$transactionType',
          category: '$items.category'
        },
        totalCost: { $sum: '$items.totalCost' },
        totalQuantity: { $sum: { $abs: '$items.quantityChanged' } },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.transactionType',
        categories: {
          $push: {
            category: '$_id.category',
            totalCost: '$totalCost',
            totalQuantity: '$totalQuantity',
            count: '$count'
          }
        },
        totalTransactionCost: { $sum: '$totalCost' },
        totalTransactionQuantity: { $sum: '$totalQuantity' },
        totalTransactionCount: { $sum: '$count' }
      }
    }
  ];
  
  return await this.aggregate(pipeline);
};

// Static method to create damage transaction
inventoryTransactionSchema.statics.createDamageTransaction = async function(data) {
  const {
    hotelId,
    roomId,
    bookingId,
    guestId,
    damagedItems,
    processedBy,
    notes
  } = data;
  
  return await this.create({
    hotelId,
    roomId,
    bookingId,
    guestId,
    transactionType: 'damage',
    items: damagedItems.map(item => ({
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      quantityChanged: -Math.abs(item.quantity), // Negative for damaged
      unitPrice: item.replacementPrice || item.unitPrice,
      totalCost: (item.replacementPrice || item.unitPrice) * item.quantity,
      condition: 'damaged',
      reason: 'damaged_by_guest',
      isChargeable: true,
      chargeType: 'damage',
      notes: item.notes
    })),
    chargedToGuest: true,
    processedBy,
    status: 'approved',
    notes
  });
};

export default mongoose.model('InventoryTransaction', inventoryTransactionSchema);
