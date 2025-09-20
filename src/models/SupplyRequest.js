import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     SupplyRequest:
 *       type: object
 *       required:
 *         - hotelId
 *         - requestedBy
 *         - items
 *         - priority
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         requestNumber:
 *           type: string
 *           description: Unique request number
 *         requestedBy:
 *           type: string
 *           description: Staff member who requested
 *         department:
 *           type: string
 *           enum: [housekeeping, maintenance, front_desk, food_beverage, spa, laundry, kitchen, bar, other]
 *           description: Requesting department
 *         title:
 *           type: string
 *           description: Request title
 *         description:
 *           type: string
 *           description: Request description
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent, emergency]
 *           default: medium
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected, ordered, partial_received, received, cancelled]
 *           default: pending
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               quantity:
 *                 type: number
 *               unit:
 *                 type: string
 *               estimatedCost:
 *                 type: number
 *               actualCost:
 *                 type: number
 *               supplier:
 *                 type: string
 *               receivedQuantity:
 *                 type: number
 *               isReceived:
 *                 type: boolean
 *               receivedDate:
 *                 type: string
 *                 format: date-time
 *         totalEstimatedCost:
 *           type: number
 *         totalActualCost:
 *           type: number
 *         approvedBy:
 *           type: string
 *           description: Who approved the request
 *         approvedAt:
 *           type: string
 *           format: date-time
 *         rejectedReason:
 *           type: string
 *         neededBy:
 *           type: string
 *           format: date-time
 *         orderedDate:
 *           type: string
 *           format: date-time
 *         expectedDelivery:
 *           type: string
 *           format: date-time
 *         actualDelivery:
 *           type: string
 *           format: date-time
 *         supplier:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             contact:
 *               type: string
 *             email:
 *               type: string
 *             phone:
 *               type: string
 *         purchaseOrder:
 *           type: object
 *           properties:
 *             number:
 *               type: string
 *             date:
 *               type: string
 *               format: date-time
 *             url:
 *               type: string
 *         notes:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const supplyRequestSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  requestNumber: {
    type: String,
    unique: true
  },
  requestedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Requester is required']
  },
  department: {
    type: String,
    enum: {
      values: ['housekeeping', 'maintenance', 'front_desk', 'food_beverage', 'spa', 'laundry', 'kitchen', 'bar', 'other'],
      message: 'Invalid department'
    },
    required: [true, 'Department is required']
  },
  title: {
    type: String,
    required: [true, 'Request title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent', 'emergency'],
      message: 'Invalid priority level'
    },
    default: 'medium'
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected', 'ordered', 'partial_received', 'received', 'cancelled'],
      message: 'Invalid status'
    },
    default: 'pending'
  },
  items: [{
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      enum: ['cleaning', 'toiletries', 'linens', 'food', 'beverage', 'office', 'maintenance', 'technology', 'furniture', 'other'],
      default: 'other'
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.01, 'Quantity must be positive']
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      trim: true
    },
    estimatedCost: {
      type: Number,
      min: [0, 'Cost cannot be negative'],
      default: 0
    },
    actualCost: {
      type: Number,
      min: [0, 'Cost cannot be negative']
    },
    supplier: {
      type: String,
      trim: true
    },
    brand: {
      type: String,
      trim: true
    },
    model: {
      type: String,
      trim: true
    },
    specifications: {
      type: String,
      maxlength: [500, 'Specifications cannot be more than 500 characters']
    },
    receivedQuantity: {
      type: Number,
      min: [0, 'Received quantity cannot be negative'],
      default: 0
    },
    isReceived: {
      type: Boolean,
      default: false
    },
    receivedDate: Date,
    receivedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    condition: {
      type: String,
      enum: ['excellent', 'good', 'damaged', 'defective'],
      default: 'good'
    },
    invoiceNumber: String,
    warrantyPeriod: String,
    expiryDate: Date
  }],
  totalEstimatedCost: {
    type: Number,
    min: [0, 'Cost cannot be negative'],
    default: 0
  },
  totalActualCost: {
    type: Number,
    min: [0, 'Cost cannot be negative'],
    default: 0
  },
  approvedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectedReason: {
    type: String,
    maxlength: [500, 'Rejection reason cannot be more than 500 characters']
  },
  neededBy: {
    type: Date,
    required: [true, 'Needed by date is required']
  },
  orderedDate: Date,
  expectedDelivery: Date,
  actualDelivery: Date,
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
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
    },
    address: String
  },
  purchaseOrder: {
    number: {
      type: String,
      trim: true
    },
    date: Date,
    url: {
      type: String,
      match: [/^https?:\/\//, 'Purchase order URL must be valid']
    },
    totalAmount: {
      type: Number,
      min: 0
    }
  },
  delivery: {
    method: {
      type: String,
      enum: ['pickup', 'standard', 'express', 'same_day', 'scheduled'],
      default: 'standard'
    },
    address: String,
    instructions: String,
    trackingNumber: String,
    carrier: String
  },
  budget: {
    allocated: {
      type: Number,
      min: 0
    },
    remaining: {
      type: Number,
      min: 0
    },
    exceeded: {
      type: Boolean,
      default: false
    }
  },
  justification: {
    type: String,
    maxlength: [1000, 'Justification cannot be more than 1000 characters']
  },
  attachments: [{
    name: String,
    url: {
      type: String,
      match: [/^https?:\/\//, 'Attachment URL must be valid']
    },
    type: {
      type: String,
      enum: ['quote', 'specification', 'image', 'invoice', 'receipt', 'other'],
      default: 'other'
    },
    uploadedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot be more than 1000 characters']
  },
  internalNotes: {
    type: String,
    maxlength: [1000, 'Internal notes cannot be more than 1000 characters']
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringSchedule: {
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'yearly']
    },
    interval: {
      type: Number,
      min: 1,
      default: 1
    },
    nextRequest: Date,
    endDate: Date
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
supplyRequestSchema.index({ hotelId: 1, status: 1 });
supplyRequestSchema.index({ requestedBy: 1, createdAt: -1 });
supplyRequestSchema.index({ department: 1, priority: 1 });
supplyRequestSchema.index({ status: 1, neededBy: 1 });
supplyRequestSchema.index({ approvedBy: 1, approvedAt: -1 });

// Generate request number before saving
supplyRequestSchema.pre('save', function(next) {
  if (!this.requestNumber) {
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.requestNumber = `SR${timestamp}${random}`;
  }
  
  // Calculate total estimated cost
  this.totalEstimatedCost = this.items.reduce((total, item) => {
    return total + (item.estimatedCost * item.quantity);
  }, 0);
  
  // Calculate total actual cost
  this.totalActualCost = this.items.reduce((total, item) => {
    return total + ((item.actualCost || 0) * item.receivedQuantity);
  }, 0);
  
  next();
});

// Virtual for overdue status
supplyRequestSchema.virtual('isOverdue').get(function() {
  return this.neededBy < new Date() && !['received', 'cancelled'].includes(this.status);
});

// Virtual for days until needed
supplyRequestSchema.virtual('daysUntilNeeded').get(function() {
  const diffTime = this.neededBy - new Date();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for completion percentage
supplyRequestSchema.virtual('completionPercentage').get(function() {
  const totalItems = this.items.length;
  const receivedItems = this.items.filter(item => item.isReceived).length;
  return totalItems > 0 ? Math.round((receivedItems / totalItems) * 100) : 0;
});

// Instance method to approve request
supplyRequestSchema.methods.approve = function(approvedBy, notes = '') {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  if (notes) this.internalNotes = notes;
  return this.save();
};

// Instance method to reject request
supplyRequestSchema.methods.reject = function(rejectedBy, reason) {
  this.status = 'rejected';
  this.rejectedReason = reason;
  this.approvedBy = rejectedBy; // Track who made the decision
  this.approvedAt = new Date();
  return this.save();
};

// Instance method to mark as ordered
supplyRequestSchema.methods.markOrdered = function(purchaseOrderData, supplierData) {
  this.status = 'ordered';
  this.orderedDate = new Date();
  
  if (purchaseOrderData) {
    this.purchaseOrder = purchaseOrderData;
  }
  
  if (supplierData) {
    this.supplier = supplierData;
  }
  
  return this.save();
};

// Instance method to receive items
supplyRequestSchema.methods.receiveItem = function(itemIndex, receivedQuantity, condition, receivedBy, notes = '') {
  if (itemIndex < 0 || itemIndex >= this.items.length) {
    throw new Error('Invalid item index');
  }
  
  const item = this.items[itemIndex];
  item.receivedQuantity = receivedQuantity;
  item.isReceived = receivedQuantity >= item.quantity;
  item.receivedDate = new Date();
  item.receivedBy = receivedBy;
  item.condition = condition || 'good';
  
  // Check if all items are received
  const allReceived = this.items.every(item => item.isReceived);
  const partiallyReceived = this.items.some(item => item.receivedQuantity > 0);
  
  if (allReceived) {
    this.status = 'received';
    this.actualDelivery = new Date();
  } else if (partiallyReceived) {
    this.status = 'partial_received';
  }
  
  if (notes) {
    this.notes = this.notes ? `${this.notes}\n${notes}` : notes;
  }
  
  return this.save();
};

// Instance method to add item
supplyRequestSchema.methods.addItem = function(itemData) {
  this.items.push(itemData);
  return this.save();
};

// Instance method to remove item
supplyRequestSchema.methods.removeItem = function(itemIndex) {
  if (itemIndex < 0 || itemIndex >= this.items.length) {
    throw new Error('Invalid item index');
  }
  
  this.items.splice(itemIndex, 1);
  return this.save();
};

// Static method to get department statistics
supplyRequestSchema.statics.getDepartmentStats = async function(hotelId, startDate, endDate) {
  const matchQuery = { hotelId };
  
  if (startDate && endDate) {
    matchQuery.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: {
          department: '$department',
          status: '$status'
        },
        count: { $sum: 1 },
        totalCost: { $sum: '$totalActualCost' },
        avgCost: { $avg: '$totalActualCost' }
      }
    },
    {
      $group: {
        _id: '$_id.department',
        stats: {
          $push: {
            status: '$_id.status',
            count: '$count',
            totalCost: '$totalCost',
            avgCost: '$avgCost'
          }
        },
        totalRequests: { $sum: '$count' }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

// Static method to get overdue requests
supplyRequestSchema.statics.getOverdueRequests = async function(hotelId) {
  return await this.find({
    hotelId,
    neededBy: { $lt: new Date() },
    status: { $in: ['pending', 'approved', 'ordered', 'partial_received'] }
  })
  .populate('requestedBy', 'name')
  .populate('approvedBy', 'name')
  .sort('neededBy');
};

// Static method to get pending approvals
supplyRequestSchema.statics.getPendingApprovals = async function(hotelId) {
  return await this.find({
    hotelId,
    status: 'pending'
  })
  .populate('requestedBy', 'name department')
  .sort('-priority createdAt');
};

// Static method to get budget utilization
supplyRequestSchema.statics.getBudgetUtilization = async function(hotelId, department, period) {
  const startDate = new Date();
  
  switch (period) {
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(startDate.getMonth() - 1);
  }

  const matchQuery = {
    hotelId,
    createdAt: { $gte: startDate },
    status: { $ne: 'cancelled' }
  };

  if (department) {
    matchQuery.department = department;
  }

  return await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$department',
        totalRequested: { $sum: '$totalEstimatedCost' },
        totalSpent: { $sum: '$totalActualCost' },
        requestCount: { $sum: 1 },
        avgRequestValue: { $avg: '$totalEstimatedCost' }
      }
    },
    { $sort: { totalSpent: -1 } }
  ]);
};

export default mongoose.model('SupplyRequest', supplyRequestSchema);
