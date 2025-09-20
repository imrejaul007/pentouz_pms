import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     LaundryTransaction:
 *       type: object
 *       required:
 *         - hotelId
 *         - roomId
 *         - itemId
 *         - transactionType
 *         - quantity
 *         - status
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         roomId:
 *           type: string
 *           description: Room ID where item was collected
 *         itemId:
 *           type: string
 *           description: Inventory item ID
 *         transactionType:
 *           type: string
 *           enum: [send_to_laundry, return_from_laundry, lost, damaged]
 *         quantity:
 *           type: number
 *           description: Number of items
 *         status:
 *           type: string
 *           enum: [pending, in_laundry, cleaning, ready, returned, lost, damaged]
 *         sentDate:
 *           type: string
 *           format: date-time
 *         expectedReturnDate:
 *           type: string
 *           format: date-time
 *         actualReturnDate:
 *           type: string
 *           format: date-time
 *         cost:
 *           type: number
 *           description: Laundry cost per item
 *         notes:
 *           type: string
 *         processedBy:
 *           type: string
 *           description: Staff member who processed the transaction
 */

const laundryTransactionSchema = new mongoose.Schema({
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
  itemId: {
    type: mongoose.Schema.ObjectId,
    ref: 'InventoryItem',
    required: [true, 'Item ID is required'],
    index: true
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    index: true,
    description: 'Associated booking if applicable'
  },
  transactionType: {
    type: String,
    enum: {
      values: ['send_to_laundry', 'return_from_laundry', 'lost', 'damaged'],
      message: 'Invalid transaction type'
    },
    required: [true, 'Transaction type is required'],
    index: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'in_laundry', 'cleaning', 'ready', 'returned', 'lost', 'damaged'],
      message: 'Invalid status'
    },
    default: 'pending',
    index: true
  },
  sentDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  expectedReturnDate: {
    type: Date,
    required: [true, 'Expected return date is required'],
    validate: {
      validator: function(value) {
        return value > this.sentDate;
      },
      message: 'Expected return date must be after sent date'
    }
  },
  actualReturnDate: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value >= this.sentDate;
      },
      message: 'Actual return date cannot be before sent date'
    }
  },
  cost: {
    type: Number,
    default: 0,
    min: [0, 'Cost cannot be negative']
  },
  totalCost: {
    type: Number,
    default: 0,
    min: [0, 'Total cost cannot be negative']
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  specialInstructions: {
    type: String,
    maxlength: [300, 'Special instructions cannot exceed 300 characters']
  },
  processedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Processed by is required']
  },
  returnedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  // Laundry service details
  laundryService: {
    name: {
      type: String,
      trim: true
    },
    contact: {
      phone: String,
      email: String
    },
    pickupDate: Date,
    deliveryDate: Date
  },
  // Quality control
  qualityCheck: {
    inspectedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    inspectionDate: Date,
    quality: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'damaged'],
      default: 'good'
    },
    issues: [String],
    photos: [String]
  },
  // Tracking
  trackingNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  isUrgent: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // Metadata
  metadata: {
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    lastModifiedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    source: {
      type: String,
      enum: ['daily_check', 'checkout_inspection', 'guest_request', 'maintenance', 'manual'],
      default: 'daily_check'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
laundryTransactionSchema.index({ hotelId: 1, status: 1 });
laundryTransactionSchema.index({ roomId: 1, status: 1 });
laundryTransactionSchema.index({ itemId: 1, status: 1 });
laundryTransactionSchema.index({ sentDate: 1, expectedReturnDate: 1 });
laundryTransactionSchema.index({ trackingNumber: 1 });
laundryTransactionSchema.index({ 'metadata.createdBy': 1 });

// Virtual for days overdue
laundryTransactionSchema.virtual('daysOverdue').get(function() {
  if (this.status === 'returned' || this.status === 'lost' || this.status === 'damaged') {
    return 0;
  }
  const now = new Date();
  const expected = new Date(this.expectedReturnDate);
  if (now > expected) {
    return Math.ceil((now - expected) / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Virtual for is overdue
laundryTransactionSchema.virtual('isOverdue').get(function() {
  return this.daysOverdue > 0;
});

// Virtual for days in laundry
laundryTransactionSchema.virtual('daysInLaundry').get(function() {
  const now = new Date();
  const sent = new Date(this.sentDate);
  return Math.ceil((now - sent) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to calculate total cost
laundryTransactionSchema.pre('save', function(next) {
  if (this.isModified('cost') || this.isModified('quantity')) {
    this.totalCost = this.cost * this.quantity;
  }
  next();
});

// Pre-save middleware to generate tracking number
laundryTransactionSchema.pre('save', function(next) {
  if (this.isNew && !this.trackingNumber) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.trackingNumber = `LT${timestamp}${random}`.toUpperCase();
  }
  next();
});

// Instance methods
laundryTransactionSchema.methods.markAsInLaundry = function(processedBy) {
  this.status = 'in_laundry';
  this.processedBy = processedBy;
  this.metadata.lastModifiedBy = processedBy;
  return this.save();
};

laundryTransactionSchema.methods.markAsCleaning = function(processedBy) {
  this.status = 'cleaning';
  this.processedBy = processedBy;
  this.metadata.lastModifiedBy = processedBy;
  return this.save();
};

laundryTransactionSchema.methods.markAsReady = function(processedBy) {
  this.status = 'ready';
  this.processedBy = processedBy;
  this.metadata.lastModifiedBy = processedBy;
  return this.save();
};

laundryTransactionSchema.methods.markAsReturned = function(returnedBy, quality = 'good') {
  this.status = 'returned';
  this.actualReturnDate = new Date();
  this.returnedBy = returnedBy;
  this.qualityCheck = {
    ...this.qualityCheck,
    quality,
    inspectionDate: new Date(),
    inspectedBy: returnedBy
  };
  this.metadata.lastModifiedBy = returnedBy;
  return this.save();
};

laundryTransactionSchema.methods.markAsLost = function(processedBy, notes) {
  this.status = 'lost';
  this.notes = notes || this.notes;
  this.processedBy = processedBy;
  this.metadata.lastModifiedBy = processedBy;
  return this.save();
};

laundryTransactionSchema.methods.markAsDamaged = function(processedBy, notes) {
  this.status = 'damaged';
  this.notes = notes || this.notes;
  this.processedBy = processedBy;
  this.metadata.lastModifiedBy = processedBy;
  return this.save();
};

// Static methods
laundryTransactionSchema.statics.getLaundryDashboard = async function(hotelId, filters = {}) {
  const matchQuery = { hotelId };
  
  if (filters.status) {
    matchQuery.status = filters.status;
  }
  
  if (filters.dateRange) {
    matchQuery.sentDate = {
      $gte: new Date(filters.dateRange.start),
      $lte: new Date(filters.dateRange.end)
    };
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalCost: { $sum: '$totalCost' }
      }
    }
  ];

  const statusSummary = await this.aggregate(pipeline);

  // Get overdue items
  const overdueItems = await this.find({
    hotelId,
    status: { $in: ['pending', 'in_laundry', 'cleaning', 'ready'] },
    expectedReturnDate: { $lt: new Date() }
  }).populate('roomId', 'roomNumber').populate('itemId', 'name');

  // Get recent transactions
  const recentTransactions = await this.find({
    hotelId
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('roomId', 'roomNumber')
    .populate('itemId', 'name')
    .populate('processedBy', 'name');

  return {
    statusSummary,
    overdueItems,
    recentTransactions,
    totalOverdue: overdueItems.length
  };
};

laundryTransactionSchema.statics.getLaundryStatus = async function(hotelId, filters = {}) {
  const query = { hotelId };
  
  if (filters.roomId) {
    query.roomId = filters.roomId;
  }
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.itemId) {
    query.itemId = filters.itemId;
  }

  return await this.find(query)
    .populate('roomId', 'roomNumber type')
    .populate('itemId', 'name category')
    .populate('processedBy', 'name')
    .populate('returnedBy', 'name')
    .sort({ sentDate: -1 });
};

export default mongoose.model('LaundryTransaction', laundryTransactionSchema);
