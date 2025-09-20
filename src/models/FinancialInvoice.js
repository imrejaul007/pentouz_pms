import mongoose from 'mongoose';

const financialInvoiceSchema = new mongoose.Schema({
  invoiceId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  type: {
    type: String,
    enum: ['guest_folio', 'corporate_billing', 'group_billing', 'vendor_invoice', 'pro_forma'],
    required: true,
    default: 'guest_folio'
  },
  customer: {
    type: {
      type: String,
      enum: ['guest', 'corporate', 'vendor'],
      required: true
    },
    guestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    corporateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Corporate'
    },
    details: {
      name: { type: String, required: true },
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
      },
      taxId: String,
      email: String,
      phone: String
    }
  },
  bookingReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  issueDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    }
  },
  currency: {
    type: String,
    required: true,
    default: 'INR'
  },
  exchangeRate: {
    type: Number,
    required: true,
    default: 1
  },
  lineItems: [{
    description: {
      type: String,
      required: true
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChartOfAccounts'
    },
    quantity: {
      type: Number,
      required: true,
      default: 1
    },
    unitPrice: {
      type: Number,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    taxCode: String,
    taxRate: {
      type: Number,
      default: 0
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    date: Date
  }],
  subtotal: {
    type: Number,
    required: true,
    default: 0
  },
  taxDetails: [{
    taxName: {
      type: String,
      required: true
    },
    taxRate: {
      type: Number,
      required: true
    },
    taxableAmount: {
      type: Number,
      required: true
    },
    taxAmount: {
      type: Number,
      required: true
    }
  }],
  totalTax: {
    type: Number,
    required: true,
    default: 0
  },
  discounts: [{
    description: String,
    amount: Number,
    percentage: Number
  }],
  totalDiscount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  balanceAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded'],
    required: true,
    default: 'draft'
  },
  paymentTerms: {
    type: String,
    default: 'Net 30'
  },
  notes: String,
  internalNotes: String,
  attachments: [String],
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

// Indexes
// Note: invoiceNumber already has unique: true, so compound index covers it
financialInvoiceSchema.index({ hotelId: 1, invoiceNumber: 1 });
financialInvoiceSchema.index({ hotelId: 1, status: 1 });
financialInvoiceSchema.index({ hotelId: 1, dueDate: 1 });
financialInvoiceSchema.index({ 'customer.guestId': 1 });
financialInvoiceSchema.index({ bookingReference: 1 });

// Pre-save middleware to calculate totals
financialInvoiceSchema.pre('save', function(next) {
  // Calculate subtotal
  this.subtotal = this.lineItems.reduce((sum, item) => sum + item.amount, 0);
  
  // Calculate total tax
  this.totalTax = this.taxDetails.reduce((sum, tax) => sum + tax.taxAmount, 0);
  
  // Calculate total discount
  this.totalDiscount = this.discounts.reduce((sum, discount) => {
    if (discount.amount) {
      return sum + discount.amount;
    } else if (discount.percentage) {
      return sum + (this.subtotal * discount.percentage / 100);
    }
    return sum;
  }, 0);
  
  // Calculate total amount
  this.totalAmount = this.subtotal + this.totalTax - this.totalDiscount;
  
  // Calculate balance amount
  this.balanceAmount = this.totalAmount - this.paidAmount;
  
  // Update status based on payment
  if (this.balanceAmount <= 0 && this.totalAmount > 0) {
    this.status = 'paid';
  } else if (this.paidAmount > 0 && this.balanceAmount > 0) {
    this.status = 'partially_paid';
  } else if (this.balanceAmount > 0 && new Date() > this.dueDate) {
    this.status = 'overdue';
  }
  
  next();
});

// Virtual for days overdue
financialInvoiceSchema.virtual('daysOverdue').get(function() {
  if (this.status === 'overdue') {
    return Math.floor((new Date() - this.dueDate) / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Generate invoice number
financialInvoiceSchema.statics.generateInvoiceNumber = async function(hotelId) {
  const year = new Date().getFullYear();
  const count = await this.countDocuments({
    hotelId,
    createdAt: {
      $gte: new Date(year, 0, 1),
      $lt: new Date(year + 1, 0, 1)
    }
  });
  
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
};

const FinancialInvoice = mongoose.model('FinancialInvoice', financialInvoiceSchema);

export default FinancialInvoice;
