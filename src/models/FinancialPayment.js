import mongoose from 'mongoose';

const financialPaymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  type: {
    type: String,
    enum: ['receipt', 'payment', 'refund', 'adjustment'],
    required: true,
    default: 'receipt'
  },
  method: {
    type: String,
    enum: ['cash', 'check', 'credit_card', 'debit_card', 'bank_transfer', 'online', 'mobile_payment', 'upi'],
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  amount: {
    type: Number,
    required: true
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
    name: {
      type: String,
      required: true
    }
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinancialInvoice'
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  reference: String,
  bankAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount'
  },
  paymentDetails: {
    cardLast4: String,
    authCode: String,
    transactionId: String,
    checkNumber: String,
    bankReference: String,
    upiId: String,
    merchantTransactionId: String
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    required: true,
    default: 'pending'
  },
  reconciled: {
    type: Boolean,
    default: false
  },
  reconciledDate: Date,
  reconciledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String,
  internalNotes: String,
  fees: {
    processingFee: {
      type: Number,
      default: 0
    },
    gatewayFee: {
      type: Number,
      default: 0
    },
    bankFee: {
      type: Number,
      default: 0
    }
  },
  netAmount: {
    type: Number,
    required: true
  },
  journalEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GeneralLedger'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date,
  failureReason: String,
  retryCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
financialPaymentSchema.index({ hotelId: 1, date: -1 });
financialPaymentSchema.index({ hotelId: 1, status: 1 });
financialPaymentSchema.index({ hotelId: 1, type: 1 });
financialPaymentSchema.index({ hotelId: 1, method: 1 });
financialPaymentSchema.index({ invoice: 1 });
financialPaymentSchema.index({ booking: 1 });
financialPaymentSchema.index({ 'customer.guestId': 1 });
financialPaymentSchema.index({ reconciled: 1 });
financialPaymentSchema.index({ 'paymentDetails.transactionId': 1 });

// Pre-save middleware to calculate net amount
financialPaymentSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('fees')) {
    const totalFees = (this.fees?.processingFee || 0) + 
                     (this.fees?.gatewayFee || 0) + 
                     (this.fees?.bankFee || 0);
    
    this.netAmount = this.amount - totalFees;
  }
  
  // Set processed timestamp when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.processedAt) {
    this.processedAt = new Date();
  }
  
  next();
});

// Generate payment reference
financialPaymentSchema.statics.generatePaymentReference = async function(hotelId, type = 'receipt') {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const count = await this.countDocuments({
    hotelId,
    type,
    createdAt: {
      $gte: new Date(year, new Date().getMonth(), 1),
      $lt: new Date(year, new Date().getMonth() + 1, 1)
    }
  });
  
  const typePrefix = type.toUpperCase().substring(0, 3);
  return `${typePrefix}-${year}${month}-${String(count + 1).padStart(4, '0')}`;
};

// Virtual for payment summary
financialPaymentSchema.virtual('summary').get(function() {
  return {
    id: this.paymentId,
    amount: this.amount,
    method: this.method,
    status: this.status,
    date: this.date,
    customer: this.customer.name,
    reference: this.reference
  };
});

// Instance method to process payment
financialPaymentSchema.methods.process = async function(userId) {
  this.status = 'processing';
  this.processedBy = userId;
  this.updatedBy = userId;
  
  try {
    // Here you would integrate with payment gateway
    // For now, we'll simulate success
    this.status = 'completed';
    this.processedAt = new Date();
    
    await this.save();
    return { success: true, message: 'Payment processed successfully' };
  } catch (error) {
    this.status = 'failed';
    this.failureReason = error.message;
    this.retryCount += 1;
    
    await this.save();
    return { success: false, message: error.message };
  }
};

// Instance method to refund payment
financialPaymentSchema.methods.refund = async function(amount, reason, userId) {
  if (this.status !== 'completed') {
    throw new Error('Can only refund completed payments');
  }
  
  if (amount > this.amount) {
    throw new Error('Refund amount cannot exceed payment amount');
  }
  
  // Create refund record
  const RefundPayment = this.constructor;
  const refund = new RefundPayment({
    hotelId: this.hotelId,
    type: 'refund',
    method: this.method,
    amount: amount,
    currency: this.currency,
    customer: this.customer,
    invoice: this.invoice,
    booking: this.booking,
    reference: `REFUND-${this.reference}`,
    bankAccount: this.bankAccount,
    notes: reason,
    status: 'completed',
    createdBy: userId
  });
  
  await refund.save();
  
  // Update original payment if fully refunded
  if (amount === this.amount) {
    this.status = 'refunded';
    this.updatedBy = userId;
    await this.save();
  }
  
  return refund;
};

const FinancialPayment = mongoose.model('FinancialPayment', financialPaymentSchema);

export default FinancialPayment;
