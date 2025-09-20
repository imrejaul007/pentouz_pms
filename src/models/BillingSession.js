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
  }
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

export default mongoose.model('BillingSession', billingSessionSchema);
