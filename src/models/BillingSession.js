import mongoose from 'mongoose';

const billingSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  guestName: {
    type: String,
    required: true
  },
  roomNumber: {
    type: String,
    required: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  bookingNumber: {
    type: String,
    description: 'Human-readable booking number (e.g., BK-2024-001)'
  },
  items: [{
    itemId: String,
    name: String,
    category: String,
    price: Number,
    outlet: String,
    quantity: Number,
    discount: Number,
    tax: Number,
    timestamp: Date
  }],
  subtotal: {
    type: Number,
    default: 0
  },
  totalDiscount: {
    type: Number,
    default: 0
  },
  totalTax: {
    type: Number,
    default: 0
  },
  grandTotal: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'room_charge', 'corporate', 'split'],
    default: 'room_charge'
  },
  status: {
    type: String,
    enum: ['draft', 'paid', 'room_charged', 'void'],
    default: 'draft'
  },
  splitPayments: [{
    method: String,
    amount: Number
  }],
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  paidAt: Date,
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Settlement integration fields
  settlementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Settlement'
  },
  settlementStatus: {
    type: String,
    enum: ['pending', 'integrated', 'settled'],
    default: 'pending'
  },
  integratedAt: Date,
  settledAt: Date
}, {
  timestamps: true
});

// Indexes for performance
billingSessionSchema.index({ hotelId: 1, status: 1 });
billingSessionSchema.index({ roomNumber: 1, status: 1 });
billingSessionSchema.index({ bookingId: 1 });
billingSessionSchema.index({ sessionId: 1 });

// Pre-save middleware to update updatedAt
billingSessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to calculate totals
billingSessionSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);
  
  this.totalTax = this.items.reduce((sum, item) => {
    return sum + ((item.tax || 0) * item.quantity);
  }, 0);
  
  this.grandTotal = this.subtotal + this.totalTax - this.totalDiscount;
  
  return {
    subtotal: this.subtotal,
    totalTax: this.totalTax,
    totalDiscount: this.totalDiscount,
    grandTotal: this.grandTotal
  };
};

// Method to add item
billingSessionSchema.methods.addItem = function(item) {
  const newItem = {
    itemId: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    outlet: item.outlet,
    quantity: 1,
    tax: item.price * 0.18, // 18% GST
    timestamp: new Date()
  };
  
  this.items.push(newItem);
  this.calculateTotals();
  return this;
};

// Method to update item quantity
billingSessionSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.find(item => item.itemId === itemId);
  if (item) {
    item.quantity = Math.max(1, quantity);
    this.calculateTotals();
  }
  return this;
};

// Method to remove item
billingSessionSchema.methods.removeItem = function(itemId) {
  this.items = this.items.filter(item => item.itemId !== itemId);
  this.calculateTotals();
  return this;
};

// Method to apply discount
billingSessionSchema.methods.applyDiscount = function(amount, isPercentage = true) {
  if (isPercentage) {
    this.totalDiscount = (this.subtotal * amount) / 100;
  } else {
    this.totalDiscount = amount;
  }
  this.calculateTotals();
  return this;
};

// Method to process payment
billingSessionSchema.methods.processPayment = function(paymentMethod) {
  this.paymentMethod = paymentMethod;
  this.status = paymentMethod === 'room_charge' ? 'room_charged' : 'paid';
  this.paidAt = new Date();
  return this;
};

// Method to void session
billingSessionSchema.methods.voidSession = function() {
  this.status = 'void';
  return this;
};

// Settlement integration methods

// Method to check if session is ready for settlement integration
billingSessionSchema.methods.isReadyForSettlement = function() {
  return this.status === 'room_charged' || this.status === 'paid';
};

// Method to mark session as integrated with settlement
billingSessionSchema.methods.markAsIntegrated = function(settlementId) {
  this.settlementId = settlementId;
  this.settlementStatus = 'integrated';
  this.integratedAt = new Date();
  return this;
};

// Method to mark session as settled
billingSessionSchema.methods.markAsSettled = function() {
  this.settlementStatus = 'settled';
  this.settledAt = new Date();
  return this;
};

// Method to get settlement summary
billingSessionSchema.methods.getSettlementSummary = function() {
  return {
    sessionId: this.sessionId,
    guestName: this.guestName,
    roomNumber: this.roomNumber,
    bookingId: this.bookingId,
    bookingNumber: this.bookingNumber,
    totalAmount: this.grandTotal,
    itemsCount: this.items.length,
    status: this.status,
    settlementStatus: this.settlementStatus,
    settlementId: this.settlementId,
    integratedAt: this.integratedAt,
    settledAt: this.settledAt,
    createdAt: this.createdAt,
    paidAt: this.paidAt
  };
};

// Method to get POS items formatted for settlement adjustments
billingSessionSchema.methods.getPOSItemsForSettlement = function() {
  return this.items.map(item => ({
    name: item.name,
    category: item.category,
    outlet: item.outlet,
    quantity: item.quantity,
    unitPrice: item.price,
    totalPrice: item.price * item.quantity,
    tax: item.tax * item.quantity,
    discount: item.discount || 0,
    timestamp: item.timestamp
  }));
};

// Static method to find sessions ready for settlement integration
billingSessionSchema.statics.findReadyForSettlement = async function(hotelId, bookingId = null) {
  const query = {
    hotelId,
    status: { $in: ['room_charged', 'paid'] },
    settlementStatus: 'pending'
  };

  if (bookingId) {
    query.bookingId = bookingId;
  }

  return await this.find(query)
    .populate('bookingId', 'bookingNumber')
    .sort({ createdAt: -1 });
};

// Static method to get settlement integration statistics
billingSessionSchema.statics.getSettlementIntegrationStats = async function(hotelId, dateRange = {}) {
  const matchStage = { hotelId };

  if (dateRange.start || dateRange.end) {
    matchStage.createdAt = {};
    if (dateRange.start) matchStage.createdAt.$gte = new Date(dateRange.start);
    if (dateRange.end) matchStage.createdAt.$lte = new Date(dateRange.end);
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$settlementStatus',
        count: { $sum: 1 },
        totalAmount: { $sum: '$grandTotal' },
        avgAmount: { $avg: '$grandTotal' }
      }
    },
    {
      $group: {
        _id: null,
        byStatus: {
          $push: {
            status: '$_id',
            count: '$count',
            totalAmount: '$totalAmount',
            avgAmount: '$avgAmount'
          }
        },
        totalSessions: { $sum: '$count' },
        totalValue: { $sum: '$totalAmount' }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

export default mongoose.model('BillingSession', billingSessionSchema);
