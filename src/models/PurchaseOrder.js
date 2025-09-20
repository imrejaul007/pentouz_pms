import mongoose from 'mongoose';

const purchaseOrderItemSchema = new mongoose.Schema({
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  itemCode: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  specification: {
    type: String,
    trim: true
  },
  unit: {
    type: String,
    required: true,
    enum: ['pieces', 'kg', 'liters', 'meters', 'boxes', 'pairs', 'sets', 'rolls', 'bottles', 'packets', 'other']
  },
  quantityOrdered: {
    type: Number,
    required: true,
    min: 0
  },
  quantityReceived: {
    type: Number,
    default: 0,
    min: 0
  },
  quantityPending: {
    type: Number,
    default: function() {
      return this.quantityOrdered - this.quantityReceived;
    }
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  notes: {
    type: String,
    trim: true
  }
}, { _id: true });

const purchaseOrderSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  poNumber: {
    type: String,
    unique: true,
    required: true,
    uppercase: true,
    trim: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  vendorInfo: {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    contactPerson: { type: String, trim: true }
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  department: {
    type: String,
    required: true,
    enum: ['housekeeping', 'maintenance', 'kitchen', 'front_office', 'admin', 'laundry', 'security', 'other']
  },
  category: {
    type: String,
    required: true,
    enum: [
      'linens',
      'toiletries',
      'cleaning_supplies',
      'maintenance_supplies',
      'food_beverage',
      'electronics',
      'furniture',
      'hvac',
      'plumbing',
      'electrical',
      'safety_equipment',
      'office_supplies',
      'laundry_supplies',
      'guest_amenities',
      'kitchen_equipment',
      'other'
    ]
  },
  items: [purchaseOrderItemSchema],
  orderDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  requiredDate: {
    type: Date,
    required: true
  },
  expectedDeliveryDate: {
    type: Date,
    required: true
  },
  actualDeliveryDate: {
    type: Date
  },
  status: {
    type: String,
    enum: [
      'draft',
      'pending_approval',
      'approved',
      'sent_to_vendor',
      'confirmed_by_vendor',
      'in_transit',
      'partially_received',
      'fully_received',
      'completed',
      'cancelled',
      'on_hold'
    ],
    default: 'draft',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  },
  additionalCharges: {
    type: Number,
    default: 0,
    min: 0
  },
  grandTotal: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  paymentTerms: {
    method: {
      type: String,
      enum: ['cash', 'check', 'bank_transfer', 'credit_card', 'digital_payment'],
      default: 'bank_transfer'
    },
    days: {
      type: Number,
      default: 30,
      min: 0
    },
    dueDate: Date
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue'],
    default: 'pending'
  },
  deliveryAddress: {
    name: { type: String, trim: true },
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    instructions: { type: String, trim: true }
  },
  billingAddress: {
    name: { type: String, trim: true },
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    gstNumber: { type: String, trim: true, uppercase: true }
  },
  vendorOrderNumber: {
    type: String,
    trim: true
  },
  vendorInvoiceNumber: {
    type: String,
    trim: true
  },
  trackingNumber: {
    type: String,
    trim: true
  },
  sentToVendorDate: Date,
  confirmedByVendorDate: Date,
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  receivedDate: Date,
  qualityCheck: {
    performed: { type: Boolean, default: false },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedDate: Date,
    notes: { type: String, trim: true },
    approved: { type: Boolean, default: false },
    defectsFound: [{
      item: { type: String, trim: true },
      quantity: { type: Number, min: 0 },
      description: { type: String, trim: true },
      action: {
        type: String,
        enum: ['accept', 'reject', 'return', 'replace'],
        default: 'accept'
      }
    }]
  },
  notes: {
    type: String,
    trim: true
  },
  internalNotes: {
    type: String,
    trim: true
  },
  terms: {
    type: String,
    trim: true
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  cancellationDate: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  attachments: [{
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['purchase_order', 'quote', 'invoice', 'receipt', 'delivery_note', 'other'],
      required: true
    },
    url: { type: String, required: true, trim: true },
    uploadedDate: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    size: Number
  }],
  approvalWorkflow: [{
    level: { type: Number, required: true },
    approverRole: { type: String, required: true },
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    comments: { type: String, trim: true },
    actionDate: Date
  }],
  revisionHistory: [{
    version: { type: Number, required: true },
    modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    modifiedDate: { type: Date, default: Date.now },
    changes: { type: String, trim: true },
    reason: { type: String, trim: true }
  }],
  autoReorder: {
    enabled: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'annually']
    },
    nextOrderDate: Date,
    lastAutoOrderDate: Date
  },
  performance: {
    deliveryTime: { type: Number, min: 0 }, // in days
    deliveredOnTime: { type: Boolean },
    qualityScore: { type: Number, min: 1, max: 5 },
    serviceScore: { type: Number, min: 1, max: 5 },
    overallSatisfaction: { type: Number, min: 1, max: 5 }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
purchaseOrderSchema.index({ hotelId: 1, status: 1 });
purchaseOrderSchema.index({ hotelId: 1, vendorId: 1 });
purchaseOrderSchema.index({ hotelId: 1, orderDate: -1 });
purchaseOrderSchema.index({ hotelId: 1, requiredDate: 1 });
purchaseOrderSchema.index({ hotelId: 1, department: 1 });
purchaseOrderSchema.index({ hotelId: 1, category: 1 });
purchaseOrderSchema.index({ poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ 'items.inventoryItemId': 1 });

// Virtual fields
purchaseOrderSchema.virtual('completionPercentage').get(function() {
  if (!this.items || this.items.length === 0) return 0;

  const totalOrdered = this.items.reduce((sum, item) => sum + item.quantityOrdered, 0);
  const totalReceived = this.items.reduce((sum, item) => sum + item.quantityReceived, 0);

  return totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
});

purchaseOrderSchema.virtual('isOverdue').get(function() {
  if (!this.expectedDeliveryDate || this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }

  const now = new Date();
  return now > this.expectedDeliveryDate;
});

purchaseOrderSchema.virtual('daysOverdue').get(function() {
  if (!this.isOverdue) return 0;

  const now = new Date();
  const diffTime = now - this.expectedDeliveryDate;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

purchaseOrderSchema.virtual('totalItems').get(function() {
  return this.items ? this.items.length : 0;
});

purchaseOrderSchema.virtual('totalQuantity').get(function() {
  return this.items ? this.items.reduce((sum, item) => sum + item.quantityOrdered, 0) : 0;
});

purchaseOrderSchema.virtual('pendingAmount').get(function() {
  if (this.paymentStatus === 'paid') return 0;
  return this.grandTotal;
});

// Pre-save middleware
purchaseOrderSchema.pre('save', async function(next) {
  // Generate PO number if new document
  if (this.isNew && !this.poNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      hotelId: this.hotelId,
      orderDate: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      }
    });
    this.poNumber = `PO${year}${String(count + 1).padStart(6, '0')}`;
  }

  // Calculate item totals
  if (this.items && this.items.length > 0) {
    this.items.forEach(item => {
      // Calculate total price
      item.totalPrice = item.quantityOrdered * item.unitPrice;

      // Calculate discount amount
      if (item.discountPercentage > 0) {
        item.discountAmount = (item.totalPrice * item.discountPercentage) / 100;
      }

      // Calculate tax amount
      const taxableAmount = item.totalPrice - item.discountAmount;
      if (item.taxRate > 0) {
        item.taxAmount = (taxableAmount * item.taxRate) / 100;
      }

      // Calculate final amount
      item.finalAmount = taxableAmount + item.taxAmount;

      // Update pending quantity
      item.quantityPending = item.quantityOrdered - item.quantityReceived;
    });

    // Calculate order totals
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    this.discountAmount = this.items.reduce((sum, item) => sum + item.discountAmount, 0);
    this.taxAmount = this.items.reduce((sum, item) => sum + item.taxAmount, 0);

    this.grandTotal = (this.subtotal - this.discountAmount) + this.taxAmount + this.shippingCost + this.additionalCharges;
  }

  // Set payment due date
  if (this.paymentTerms && this.paymentTerms.days && this.orderDate) {
    const dueDate = new Date(this.orderDate);
    dueDate.setDate(dueDate.getDate() + this.paymentTerms.days);
    this.paymentTerms.dueDate = dueDate;
  }

  // Update status based on completion
  if (this.status !== 'cancelled' && this.status !== 'completed') {
    const completionPercentage = this.completionPercentage;

    if (completionPercentage === 100) {
      this.status = 'fully_received';
    } else if (completionPercentage > 0 && completionPercentage < 100) {
      this.status = 'partially_received';
    }
  }

  next();
});

// Instance methods
purchaseOrderSchema.methods.approve = function(approverId, comments) {
  this.status = 'approved';
  this.approvedBy = approverId;
  this.updatedBy = approverId;

  // Add to approval workflow
  this.approvalWorkflow.push({
    level: 1,
    approverRole: 'manager',
    approver: approverId,
    status: 'approved',
    comments: comments,
    actionDate: new Date()
  });

  return this.save();
};

purchaseOrderSchema.methods.sendToVendor = function(userId) {
  this.status = 'sent_to_vendor';
  this.sentToVendorDate = new Date();
  this.updatedBy = userId;

  return this.save();
};

purchaseOrderSchema.methods.confirmByVendor = function(vendorOrderNumber) {
  this.status = 'confirmed_by_vendor';
  this.confirmedByVendorDate = new Date();
  this.vendorOrderNumber = vendorOrderNumber;

  return this.save();
};

purchaseOrderSchema.methods.receiveItems = function(receivedItems, receivedBy) {
  // Update received quantities
  receivedItems.forEach(received => {
    const item = this.items.id(received.itemId);
    if (item) {
      item.quantityReceived += received.quantity;
      item.quantityPending = Math.max(0, item.quantityOrdered - item.quantityReceived);
    }
  });

  this.receivedBy = receivedBy;
  this.receivedDate = new Date();
  this.updatedBy = receivedBy;

  // Update status based on completion
  const totalOrdered = this.items.reduce((sum, item) => sum + item.quantityOrdered, 0);
  const totalReceived = this.items.reduce((sum, item) => sum + item.quantityReceived, 0);

  if (totalReceived >= totalOrdered) {
    this.status = 'fully_received';
  } else if (totalReceived > 0) {
    this.status = 'partially_received';
  }

  return this.save();
};

purchaseOrderSchema.methods.markCompleted = function(userId, performanceData) {
  this.status = 'completed';
  this.updatedBy = userId;

  if (performanceData) {
    this.performance = {
      ...this.performance,
      ...performanceData
    };
  }

  return this.save();
};

purchaseOrderSchema.methods.cancel = function(userId, reason) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancellationDate = new Date();
  this.cancelledBy = userId;
  this.updatedBy = userId;

  return this.save();
};

purchaseOrderSchema.methods.addRevision = function(userId, changes, reason) {
  const version = this.revisionHistory.length + 1;

  this.revisionHistory.push({
    version,
    modifiedBy: userId,
    changes,
    reason
  });

  this.updatedBy = userId;

  return this.save();
};

// Static methods
purchaseOrderSchema.statics.getPendingOrders = function(hotelId) {
  return this.find({
    hotelId,
    status: { $in: ['approved', 'sent_to_vendor', 'confirmed_by_vendor', 'in_transit', 'partially_received'] }
  }).populate('vendorId', 'name contactInfo')
    .populate('requestedBy', 'name')
    .sort({ requiredDate: 1 });
};

purchaseOrderSchema.statics.getOverdueOrders = function(hotelId) {
  const now = new Date();
  return this.find({
    hotelId,
    expectedDeliveryDate: { $lt: now },
    status: { $nin: ['completed', 'cancelled', 'fully_received'] }
  }).populate('vendorId', 'name contactInfo')
    .sort({ expectedDeliveryDate: 1 });
};

purchaseOrderSchema.statics.getOrdersByVendor = function(hotelId, vendorId) {
  return this.find({
    hotelId,
    vendorId
  }).sort({ orderDate: -1 });
};

purchaseOrderSchema.statics.getOrdersByDateRange = function(hotelId, startDate, endDate) {
  return this.find({
    hotelId,
    orderDate: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('vendorId', 'name')
    .sort({ orderDate: -1 });
};

purchaseOrderSchema.statics.getOrderStatistics = async function(hotelId, period = 'month') {
  const now = new Date();
  let startDate;

  switch (period) {
    case 'week':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const stats = await this.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        orderDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalValue: { $sum: '$grandTotal' },
        avgOrderValue: { $avg: '$grandTotal' },
        pendingOrders: {
          $sum: {
            $cond: [
              { $in: ['$status', ['approved', 'sent_to_vendor', 'confirmed_by_vendor', 'in_transit', 'partially_received']] },
              1,
              0
            ]
          }
        },
        completedOrders: {
          $sum: {
            $cond: [
              { $in: ['$status', ['completed', 'fully_received']] },
              1,
              0
            ]
          }
        },
        cancelledOrders: {
          $sum: {
            $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
          }
        }
      }
    }
  ]);

  const departmentStats = await this.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        orderDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$department',
        orders: { $sum: 1 },
        totalValue: { $sum: '$grandTotal' }
      }
    },
    { $sort: { totalValue: -1 } }
  ]);

  return {
    overall: stats[0] || {
      totalOrders: 0,
      totalValue: 0,
      avgOrderValue: 0,
      pendingOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0
    },
    byDepartment: departmentStats
  };
};

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

export default PurchaseOrder;
