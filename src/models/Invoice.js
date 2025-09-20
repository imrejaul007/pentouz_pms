import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Invoice:
 *       type: object
 *       required:
 *         - hotelId
 *         - bookingId
 *         - items
 *         - totalAmount
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         bookingId:
 *           type: string
 *           description: Associated booking ID
 *         guestId:
 *           type: string
 *           description: Primary guest user ID
 *         invoiceNumber:
 *           type: string
 *           description: Unique invoice number
 *         type:
 *           type: string
 *           enum: [accommodation, service, additional, refund, cancellation]
 *           default: accommodation
 *         status:
 *           type: string
 *           enum: [draft, issued, paid, partially_paid, overdue, cancelled, refunded]
 *           default: draft
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               quantity:
 *                 type: number
 *               unitPrice:
 *                 type: number
 *               totalPrice:
 *                 type: number
 *               taxRate:
 *                 type: number
 *               taxAmount:
 *                 type: number
 *               serviceType:
 *                 type: string
 *               serviceId:
 *                 type: string
 *         subtotal:
 *           type: number
 *         taxAmount:
 *           type: number
 *         totalAmount:
 *           type: number
 *         currency:
 *           type: string
 *           default: USD
 *         issueDate:
 *           type: string
 *           format: date-time
 *         dueDate:
 *           type: string
 *           format: date-time
 *         paidDate:
 *           type: string
 *           format: date-time
 *         payments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               method:
 *                 type: string
 *               transactionId:
 *                 type: string
 *               paidBy:
 *                 type: string
 *               paidAt:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *         splitBilling:
 *           type: object
 *           properties:
 *             isEnabled:
 *               type: boolean
 *               default: false
 *             splits:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   guestId:
 *                     type: string
 *                   guestName:
 *                     type: string
 *                   amount:
 *                     type: number
 *                   percentage:
 *                     type: number
 *                   items:
 *                     type: array
 *                   status:
 *                     type: string
 *                     enum: [pending, paid, overdue]
 *                   paidAt:
 *                     type: string
 *                     format: date-time
 *         discounts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [percentage, fixed_amount, loyalty_points]
 *               value:
 *                 type: number
 *               amount:
 *                 type: number
 *         notes:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const invoiceSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking ID is required']
  },
  guestId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Guest ID is required']
  },
  invoiceNumber: {
    type: String,
    unique: true
  },
  type: {
    type: String,
    enum: {
      values: ['accommodation', 'service', 'additional', 'refund', 'cancellation'],
      message: 'Invalid invoice type'
    },
    default: 'accommodation'
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'issued', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded'],
      message: 'Invalid invoice status'
    },
    default: 'draft'
  },
  items: [{
    description: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true
    },
    category: {
      type: String,
      enum: ['accommodation', 'food_beverage', 'spa', 'laundry', 'minibar', 'parking', 'wifi', 'other'],
      default: 'other'
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: 0
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: 0
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: 0
    },
    taxRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    taxAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    serviceType: String,
    serviceId: {
      type: mongoose.Schema.ObjectId,
      refPath: 'items.serviceType'
    },
    dateProvided: {
      type: Date,
      default: Date.now
    }
  }],
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: 0
  },
  taxAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: 0
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  gstDetails: {
    gstNumber: {
      type: String,
      match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please enter a valid GST number']
    },
    gstRate: {
      type: Number,
      default: 18,
      min: 0,
      max: 100
    },
    cgstRate: {
      type: Number,
      default: 9,
      min: 0,
      max: 100
    },
    sgstRate: {
      type: Number,
      default: 9,
      min: 0,
      max: 100
    },
    igstRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    cgstAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    sgstAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    igstAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalGstAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    placeOfSupply: {
      type: String,
      trim: true
    },
    isGstApplicable: {
      type: Boolean,
      default: true
    }
  },
  corporateDetails: {
    corporateCompanyId: {
      type: mongoose.Schema.ObjectId,
      ref: 'CorporateCompany'
    },
    groupBookingId: {
      type: mongoose.Schema.ObjectId,
      ref: 'GroupBooking'
    },
    billingAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    },
    purchaseOrderNumber: {
      type: String,
      trim: true
    },
    costCenter: {
      type: String,
      trim: true
    },
    paymentTerms: {
      type: Number,
      default: 30
    },
    billingEmail: {
      type: String,
      lowercase: true
    }
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  paidDate: Date,
  payments: [{
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    method: {
      type: String,
      enum: ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'digital_wallet', 'loyalty_points'],
      required: true
    },
    transactionId: String,
    paidBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    paidAt: {
      type: Date,
      default: Date.now
    },
    notes: String,
    receiptUrl: String
  }],
  splitBilling: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    method: {
      type: String,
      enum: ['equal', 'percentage', 'item_based', 'custom_amount'],
      default: 'equal'
    },
    splits: [{
      guestId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      guestName: {
        type: String,
        required: true
      },
      email: String,
      phone: String,
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      percentage: {
        type: Number,
        min: 0,
        max: 100
      },
      items: [{
        itemIndex: Number,
        amount: Number
      }],
      status: {
        type: String,
        enum: ['pending', 'paid', 'overdue', 'cancelled'],
        default: 'pending'
      },
      paidAt: Date,
      paymentMethod: String,
      transactionId: String,
      invoiceUrl: String,
      remindersSent: {
        type: Number,
        default: 0
      },
      lastReminderSent: Date
    }]
  },
  discounts: [{
    description: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed_amount', 'loyalty_points', 'coupon', 'group_discount'],
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: 0
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    appliedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    }
  }],
  adjustments: [{
    description: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['credit', 'charge'],
      required: true
    },
    reason: String,
    appliedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    appliedAt: {
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
  billingAddress: {
    name: String,
    company: String,
    address: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: Date,
  printedCount: {
    type: Number,
    default: 0
  },
  lastPrintedAt: Date,
  remindersSent: {
    type: Number,
    default: 0
  },
  lastReminderSent: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
invoiceSchema.index({ hotelId: 1, status: 1 });
invoiceSchema.index({ bookingId: 1 });
invoiceSchema.index({ guestId: 1, status: 1 });
// Note: invoiceNumber already has unique: true, no need for separate index
invoiceSchema.index({ dueDate: 1, status: 1 });
invoiceSchema.index({ 'splitBilling.splits.guestId': 1 });

// Generate invoice number before saving
invoiceSchema.pre('save', function(next) {
  if (!this.invoiceNumber) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.invoiceNumber = `INV${date}${random}`;
  }
  
  // Calculate totals before saving
  this.calculateTotals();
  
  next();
});

// Virtual for amount paid
invoiceSchema.virtual('amountPaid').get(function() {
  return this.payments.reduce((total, payment) => total + payment.amount, 0);
});

// Virtual for amount remaining
invoiceSchema.virtual('amountRemaining').get(function() {
  return this.totalAmount - this.amountPaid;
});

// Virtual for overdue status
invoiceSchema.virtual('isOverdue').get(function() {
  return this.dueDate < new Date() && ['issued', 'partially_paid'].includes(this.status);
});

// Virtual for days overdue
invoiceSchema.virtual('daysOverdue').get(function() {
  if (!this.isOverdue) return 0;
  const diffTime = Math.abs(new Date() - this.dueDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance method to calculate totals
invoiceSchema.methods.calculateTotals = function() {
  // Calculate item totals
  this.items.forEach(item => {
    item.totalPrice = item.quantity * item.unitPrice;
    item.taxAmount = (item.totalPrice * item.taxRate) / 100;
  });
  
  // Calculate subtotal
  this.subtotal = this.items.reduce((total, item) => total + item.totalPrice, 0);
  
  // Calculate total tax
  this.taxAmount = this.items.reduce((total, item) => total + item.taxAmount, 0);
  
  // Calculate discount amount
  const discountAmount = this.discounts.reduce((total, discount) => total + discount.amount, 0);
  
  // Calculate adjustment amount
  const adjustmentAmount = this.adjustments.reduce((total, adj) => {
    return total + (adj.type === 'credit' ? -adj.amount : adj.amount);
  }, 0);
  
  // Calculate total amount
  this.totalAmount = this.subtotal + this.taxAmount - discountAmount + adjustmentAmount;
  
  // Ensure non-negative total
  this.totalAmount = Math.max(0, this.totalAmount);
  
  // Update split billing amounts if enabled
  if (this.splitBilling.isEnabled) {
    this.recalculateSplits();
  }
};

// Instance method to add payment
invoiceSchema.methods.addPayment = function(amount, method, paidBy, transactionId, notes) {
  this.payments.push({
    amount,
    method,
    paidBy,
    transactionId,
    notes,
    paidAt: new Date()
  });
  
  // Update status based on payment
  const totalPaid = this.amountPaid + amount;
  
  if (totalPaid >= this.totalAmount) {
    this.status = 'paid';
    this.paidDate = new Date();
  } else if (totalPaid > 0) {
    this.status = 'partially_paid';
  }
  
  return this.save();
};

// Instance method to add discount
invoiceSchema.methods.addDiscount = function(description, type, value, appliedBy) {
  let amount;
  
  if (type === 'percentage') {
    amount = (this.subtotal * value) / 100;
  } else if (type === 'fixed_amount') {
    amount = value;
  } else if (type === 'loyalty_points') {
    // Assuming 1 point = 0.01 currency unit
    amount = value * 0.01;
  }
  
  this.discounts.push({
    description,
    type,
    value,
    amount,
    appliedBy
  });
  
  this.calculateTotals();
  return this.save();
};

// Instance method to setup split billing
invoiceSchema.methods.setupSplitBilling = function(method, splits) {
  this.splitBilling.isEnabled = true;
  this.splitBilling.method = method;
  this.splitBilling.splits = splits.map(split => ({
    ...split,
    status: 'pending'
  }));
  
  this.recalculateSplits();
  return this.save();
};

// Instance method to recalculate splits
invoiceSchema.methods.recalculateSplits = function() {
  if (!this.splitBilling.isEnabled || this.splitBilling.splits.length === 0) return;
  
  const method = this.splitBilling.method;
  const splits = this.splitBilling.splits;
  
  if (method === 'equal') {
    const amountPerSplit = this.totalAmount / splits.length;
    splits.forEach(split => {
      split.amount = amountPerSplit;
      split.percentage = (amountPerSplit / this.totalAmount) * 100;
    });
  } else if (method === 'percentage') {
    splits.forEach(split => {
      if (split.percentage) {
        split.amount = (this.totalAmount * split.percentage) / 100;
      }
    });
  }
  // For item_based and custom_amount, amounts should already be set
};

// Instance method to mark split as paid
invoiceSchema.methods.markSplitPaid = function(splitIndex, amount, method, transactionId) {
  if (splitIndex < 0 || splitIndex >= this.splitBilling.splits.length) {
    throw new Error('Invalid split index');
  }
  
  const split = this.splitBilling.splits[splitIndex];
  split.status = 'paid';
  split.paidAt = new Date();
  split.paymentMethod = method;
  split.transactionId = transactionId;
  
  // Add to main payments
  this.addPayment(amount, method, split.guestId, transactionId, `Split payment from ${split.guestName}`);
  
  // Check if all splits are paid
  const allPaid = this.splitBilling.splits.every(s => s.status === 'paid');
  if (allPaid) {
    this.status = 'paid';
    this.paidDate = new Date();
  }
  
  return this.save();
};

// Static method to get revenue statistics
invoiceSchema.statics.getRevenueStats = async function(hotelId, startDate, endDate) {
  const matchQuery = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    status: { $in: ['paid', 'partially_paid'] }
  };
  
  if (startDate && endDate) {
    matchQuery.issueDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$issueDate' } },
          type: '$type'
        },
        revenue: { $sum: '$totalAmount' },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.type',
        dailyRevenue: {
          $push: {
            date: '$_id.date',
            amount: '$revenue',
            count: '$count'
          }
        },
        totalRevenue: { $sum: '$revenue' },
        totalInvoices: { $sum: '$count' }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

// Static method to get overdue invoices
invoiceSchema.statics.getOverdueInvoices = async function(hotelId) {
  return await this.find({
    hotelId,
    dueDate: { $lt: new Date() },
    status: { $in: ['issued', 'partially_paid'] }
  })
  .populate('guestId', 'name email phone')
  .populate('bookingId', 'bookingNumber')
  .sort('dueDate');
};

export default mongoose.model('Invoice', invoiceSchema);
