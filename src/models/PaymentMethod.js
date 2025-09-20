import mongoose from 'mongoose';

const paymentMethodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Payment method name is required'],
    trim: true,
    maxLength: [100, 'Payment method name cannot exceed 100 characters'],
    index: true
  },
  code: {
    type: String,
    required: [true, 'Payment method code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxLength: [20, 'Payment method code cannot exceed 20 characters'],
    match: [/^[A-Z0-9_-]+$/, 'Payment method code can only contain letters, numbers, underscores and hyphens']
  },
  description: {
    type: String,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Payment method categorization
  type: {
    type: String,
    required: true,
    enum: [
      'credit_card', 'debit_card', 'cash', 'check', 'bank_transfer', 
      'digital_wallet', 'cryptocurrency', 'gift_card', 'voucher', 
      'loyalty_points', 'corporate_account', 'invoice', 'other'
    ],
    index: true
  },
  subtype: {
    type: String,
    maxLength: [50, 'Subtype cannot exceed 50 characters']
  },
  
  // Card-specific settings (for card payments)
  cardSettings: {
    supportedBrands: [{
      type: String,
      enum: ['visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb', 'unionpay', 'other']
    }],
    requiresCVV: {
      type: Boolean,
      default: true
    },
    requiresZip: {
      type: Boolean,
      default: true
    },
    supportsContactless: {
      type: Boolean,
      default: false
    },
    supportsChipAndPin: {
      type: Boolean,
      default: false
    },
    supportsSwipe: {
      type: Boolean,
      default: true
    },
    minAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    maxAmount: {
      type: Number,
      default: 10000,
      min: 0
    }
  },
  
  // Gateway integration
  gateway: {
    provider: {
      type: String,
      enum: [
        'stripe', 'paypal', 'square', 'authorize_net', 'braintree', 
        'worldpay', 'adyen', 'checkout', 'razorpay', 'payu', 
        'internal', 'manual', 'other'
      ],
      required: true
    },
    configuration: {
      apiKey: String,
      secretKey: String,
      merchantId: String,
      webhookSecret: String,
      environment: {
        type: String,
        enum: ['sandbox', 'production'],
        default: 'sandbox'
      },
      customSettings: mongoose.Schema.Types.Mixed
    },
    endpoints: {
      payment: String,
      refund: String,
      webhook: String,
      status: String
    },
    features: {
      supportsRefunds: {
        type: Boolean,
        default: true
      },
      supportsPartialRefunds: {
        type: Boolean,
        default: true
      },
      supportsVoids: {
        type: Boolean,
        default: true
      },
      supportsCapture: {
        type: Boolean,
        default: true
      },
      supportsAuth: {
        type: Boolean,
        default: true
      },
      supportsRecurring: {
        type: Boolean,
        default: false
      },
      supportsTokenization: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Financial settings
  fees: {
    fixed: {
      type: Number,
      default: 0,
      min: 0
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    minimumFee: {
      type: Number,
      default: 0,
      min: 0
    },
    maximumFee: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD',
      maxLength: 3
    },
    feeCalculation: {
      type: String,
      enum: ['add_to_total', 'deduct_from_amount', 'separate_charge'],
      default: 'add_to_total'
    }
  },
  
  // Currency support
  supportedCurrencies: [{
    code: {
      type: String,
      required: true,
      maxLength: 3
    },
    symbol: String,
    exchangeRate: {
      type: Number,
      default: 1,
      min: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Operational settings
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isOnline: {
    type: Boolean,
    default: true
  },
  isManual: {
    type: Boolean,
    default: false
  },
  requiresVerification: {
    type: Boolean,
    default: false
  },
  allowsPartialPayments: {
    type: Boolean,
    default: false
  },
  allowsOverpayments: {
    type: Boolean,
    default: false
  },
  
  // Time-based restrictions
  availableFrom: {
    type: Date
  },
  availableTo: {
    type: Date
  },
  weeklySchedule: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    enabled: {
      type: Boolean,
      default: true
    },
    startTime: String,
    endTime: String
  }],
  
  // Department and role access
  applicableDepartments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }],
  allowedRoles: [{
    type: String,
    enum: ['admin', 'manager', 'supervisor', 'front_desk', 'accounting', 'guest_services']
  }],
  restrictedRoles: [{
    type: String,
    enum: ['admin', 'manager', 'supervisor', 'front_desk', 'accounting', 'guest_services']
  }],
  
  // Limits and thresholds
  limits: {
    daily: {
      maxAmount: {
        type: Number,
        default: 0,
        min: 0
      },
      maxTransactions: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    monthly: {
      maxAmount: {
        type: Number,
        default: 0,
        min: 0
      },
      maxTransactions: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    perTransaction: {
      minAmount: {
        type: Number,
        default: 0,
        min: 0
      },
      maxAmount: {
        type: Number,
        default: 10000,
        min: 0
      }
    }
  },
  
  // Security settings
  security: {
    requiresSignature: {
      type: Boolean,
      default: false
    },
    requiresId: {
      type: Boolean,
      default: false
    },
    allowsRefunds: {
      type: Boolean,
      default: true
    },
    refundTimeLimit: {
      type: Number,
      default: 30, // days
      min: 0
    },
    encryptionLevel: {
      type: String,
      enum: ['none', 'basic', 'advanced', 'pci_compliant'],
      default: 'pci_compliant'
    },
    fraudProtection: {
      enabled: {
        type: Boolean,
        default: true
      },
      riskThreshold: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
      },
      actions: [{
        type: String,
        enum: ['flag', 'hold', 'decline', 'review']
      }]
    }
  },
  
  // Notification settings
  notifications: {
    onSuccess: {
      guest: { type: Boolean, default: true },
      staff: { type: Boolean, default: false },
      management: { type: Boolean, default: false }
    },
    onFailure: {
      guest: { type: Boolean, default: true },
      staff: { type: Boolean, default: true },
      management: { type: Boolean, default: false }
    },
    onRefund: {
      guest: { type: Boolean, default: true },
      staff: { type: Boolean, default: true },
      management: { type: Boolean, default: true }
    },
    onChargeback: {
      guest: { type: Boolean, default: false },
      staff: { type: Boolean, default: true },
      management: { type: Boolean, default: true }
    }
  },
  
  // Display settings
  display: {
    icon: String,
    color: {
      type: String,
      default: '#000000'
    },
    order: {
      type: Number,
      default: 0
    },
    showInPos: {
      type: Boolean,
      default: true
    },
    showInBooking: {
      type: Boolean,
      default: true
    },
    showOnWebsite: {
      type: Boolean,
      default: false
    },
    customLabel: String
  },
  
  // Analytics and tracking
  analytics: {
    totalTransactions: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    successfulTransactions: { type: Number, default: 0 },
    failedTransactions: { type: Number, default: 0 },
    refundedTransactions: { type: Number, default: 0 },
    refundedAmount: { type: Number, default: 0 },
    avgTransactionAmount: { type: Number, default: 0 },
    avgProcessingTime: { type: Number, default: 0 }, // in seconds
    lastTransaction: Date,
    popularityScore: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    lastCalculated: { type: Date, default: Date.now }
  },
  
  // Integration settings
  integrations: {
    pms: {
      enabled: { type: Boolean, default: true },
      code: String,
      mapping: mongoose.Schema.Types.Mixed
    },
    accounting: {
      enabled: { type: Boolean, default: true },
      glAccount: String,
      costCenter: String
    },
    reporting: {
      enabled: { type: Boolean, default: true },
      category: String,
      tags: [String]
    },
    pos: {
      enabled: { type: Boolean, default: true },
      terminalId: String,
      configuration: mongoose.Schema.Types.Mixed
    }
  },
  
  // Hotel association
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Audit log
  auditLog: [{
    action: {
      type: String,
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    changes: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String
  }]
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
paymentMethodSchema.index({ hotelId: 1, type: 1, isActive: 1 });
paymentMethodSchema.index({ code: 1 }, { unique: true });
paymentMethodSchema.index({ name: 'text', description: 'text' });
paymentMethodSchema.index({ 'analytics.totalTransactions': -1 });
paymentMethodSchema.index({ 'analytics.lastTransaction': -1 });
paymentMethodSchema.index({ createdAt: -1 });
paymentMethodSchema.index({ 'display.order': 1 });

// Virtual for success rate
paymentMethodSchema.virtual('successRate').get(function() {
  if (this.analytics.totalTransactions === 0) return 0;
  return ((this.analytics.successfulTransactions / this.analytics.totalTransactions) * 100).toFixed(2);
});

// Virtual for failure rate
paymentMethodSchema.virtual('failureRate').get(function() {
  if (this.analytics.totalTransactions === 0) return 0;
  return ((this.analytics.failedTransactions / this.analytics.totalTransactions) * 100).toFixed(2);
});

// Virtual for refund rate
paymentMethodSchema.virtual('refundRate').get(function() {
  if (this.analytics.successfulTransactions === 0) return 0;
  return ((this.analytics.refundedTransactions / this.analytics.successfulTransactions) * 100).toFixed(2);
});

// Virtual for fee calculation
paymentMethodSchema.virtual('calculateFee').get(function() {
  return (amount) => {
    let fee = this.fees.fixed + (amount * this.fees.percentage / 100);
    
    if (this.fees.minimumFee > 0 && fee < this.fees.minimumFee) {
      fee = this.fees.minimumFee;
    }
    
    if (this.fees.maximumFee > 0 && fee > this.fees.maximumFee) {
      fee = this.fees.maximumFee;
    }
    
    return parseFloat(fee.toFixed(2));
  };
});

// Methods
paymentMethodSchema.methods.canBeUsedBy = function(user) {
  // Check role restrictions
  if (this.restrictedRoles.includes(user.role)) {
    return false;
  }
  
  // Check allowed roles
  if (this.allowedRoles.length > 0 && !this.allowedRoles.includes(user.role)) {
    return false;
  }
  
  // Check department access
  if (this.applicableDepartments.length > 0) {
    return this.applicableDepartments.some(deptId => 
      deptId.toString() === user.departmentId?.toString()
    );
  }
  
  return true;
};

paymentMethodSchema.methods.isAvailableAt = function(dateTime = new Date()) {
  // Check if method is active
  if (!this.isActive) return false;
  
  // Check date range
  if (this.availableFrom && dateTime < this.availableFrom) return false;
  if (this.availableTo && dateTime > this.availableTo) return false;
  
  // Check weekly schedule
  if (this.weeklySchedule.length > 0) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[dateTime.getDay()];
    const currentTime = dateTime.toTimeString().substring(0, 5); // HH:MM format
    
    const daySchedule = this.weeklySchedule.find(schedule => schedule.day === currentDay);
    if (daySchedule) {
      if (!daySchedule.enabled) return false;
      if (daySchedule.startTime && currentTime < daySchedule.startTime) return false;
      if (daySchedule.endTime && currentTime > daySchedule.endTime) return false;
    }
  }
  
  return true;
};

paymentMethodSchema.methods.validateAmount = function(amount) {
  // Check per-transaction limits
  if (this.limits.perTransaction.minAmount > 0 && amount < this.limits.perTransaction.minAmount) {
    return { valid: false, reason: `Amount below minimum of ${this.limits.perTransaction.minAmount}` };
  }
  
  if (this.limits.perTransaction.maxAmount > 0 && amount > this.limits.perTransaction.maxAmount) {
    return { valid: false, reason: `Amount exceeds maximum of ${this.limits.perTransaction.maxAmount}` };
  }
  
  // Check card-specific limits if applicable
  if (this.type === 'credit_card' || this.type === 'debit_card') {
    if (amount < this.cardSettings.minAmount) {
      return { valid: false, reason: `Amount below card minimum of ${this.cardSettings.minAmount}` };
    }
    
    if (amount > this.cardSettings.maxAmount) {
      return { valid: false, reason: `Amount exceeds card maximum of ${this.cardSettings.maxAmount}` };
    }
  }
  
  return { valid: true };
};

paymentMethodSchema.methods.supportsCurrency = function(currencyCode) {
  if (this.supportedCurrencies.length === 0) return true; // No restrictions
  return this.supportedCurrencies.some(currency => currency.code === currencyCode);
};

paymentMethodSchema.methods.addAuditEntry = function(action, performedBy, changes, ipAddress, userAgent) {
  this.auditLog.push({
    action,
    performedBy,
    changes,
    ipAddress,
    userAgent
  });
  
  // Keep only last 100 audit entries
  if (this.auditLog.length > 100) {
    this.auditLog = this.auditLog.slice(-100);
  }
  
  return this.save();
};

paymentMethodSchema.methods.updateAnalytics = function(transactionData) {
  const { amount, success, processingTime, refunded, refundAmount } = transactionData;
  
  this.analytics.totalTransactions += 1;
  this.analytics.totalAmount += amount;
  
  if (success) {
    this.analytics.successfulTransactions += 1;
  } else {
    this.analytics.failedTransactions += 1;
  }
  
  if (refunded) {
    this.analytics.refundedTransactions += 1;
    this.analytics.refundedAmount += refundAmount || amount;
  }
  
  // Update averages
  this.analytics.avgTransactionAmount = this.analytics.totalAmount / this.analytics.totalTransactions;
  
  if (processingTime) {
    const totalProcessingTime = this.analytics.avgProcessingTime * (this.analytics.totalTransactions - 1) + processingTime;
    this.analytics.avgProcessingTime = totalProcessingTime / this.analytics.totalTransactions;
  }
  
  // Update conversion rate
  this.analytics.conversionRate = (this.analytics.successfulTransactions / this.analytics.totalTransactions) * 100;
  
  this.analytics.lastTransaction = new Date();
  this.analytics.lastCalculated = new Date();
  
  return this.save();
};

// Static methods
paymentMethodSchema.statics.findByType = function(hotelId, type, options = {}) {
  const { includeInactive = false } = options;
  const filter = { hotelId, type };
  
  if (!includeInactive) {
    filter.isActive = true;
  }
  
  return this.find(filter).sort({ 'display.order': 1, name: 1 });
};

paymentMethodSchema.statics.findAvailableAt = function(hotelId, dateTime = new Date()) {
  return this.find({ hotelId, isActive: true })
    .then(methods => methods.filter(method => method.isAvailableAt(dateTime)));
};

paymentMethodSchema.statics.getPaymentStats = function(hotelId) {
  return this.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        activeCount: { 
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        totalTransactions: { $sum: '$analytics.totalTransactions' },
        totalAmount: { $sum: '$analytics.totalAmount' },
        avgSuccessRate: { $avg: '$analytics.conversionRate' }
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);
};

// Pre-save middleware
paymentMethodSchema.pre('save', function(next) {
  // Auto-generate code if not provided
  if (!this.code && this.name) {
    this.code = this.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .substring(0, 20);
  }
  
  // Update popularity score based on usage
  if (this.analytics.totalTransactions > 0) {
    this.analytics.popularityScore = Math.log(this.analytics.totalTransactions + 1) * this.analytics.conversionRate;
  }
  
  next();
});

// Pre-remove middleware
paymentMethodSchema.pre('remove', async function(next) {
  // Check if payment method is being used in any recent transactions
  // This would depend on your transaction models
  
  // For now, just prevent deletion of gateway-integrated methods with transactions
  if (this.analytics.totalTransactions > 0 && this.gateway.provider !== 'manual') {
    const error = new Error('Cannot delete payment method with transaction history');
    error.code = 'PAYMENT_METHOD_HAS_TRANSACTIONS';
    return next(error);
  }
  
  next();
});

export default mongoose.model('PaymentMethod', paymentMethodSchema);
