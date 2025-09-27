import mongoose from 'mongoose';
import calculationValidationService from '../services/calculationValidationService.js';
import financialRulesEngine from '../services/financialRulesEngine.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Settlement:
 *       type: object
 *       required:
 *         - hotelId
 *         - bookingId
 *         - status
 *         - finalAmount
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         bookingId:
 *           type: string
 *           description: Associated booking ID
 *         settlementNumber:
 *           type: string
 *           description: Unique settlement identifier
 *         status:
 *           type: string
 *           enum: [pending, partial, completed, overdue, cancelled, refunded]
 *           description: Settlement status
 *         finalAmount:
 *           type: number
 *           description: Final settlement amount
 *         outstandingBalance:
 *           type: number
 *           description: Amount still owed
 *         refundAmount:
 *           type: number
 *           description: Amount to be refunded
 *         currency:
 *           type: string
 *           default: INR
 *         dueDate:
 *           type: string
 *           format: date
 *         completedDate:
 *           type: string
 *           format: date
 *         guestDetails:
 *           type: object
 *           properties:
 *             guestId:
 *               type: string
 *             guestName:
 *               type: string
 *             guestEmail:
 *               type: string
 *             guestPhone:
 *               type: string
 *         escalationLevel:
 *           type: number
 *           description: Current escalation level (0-5)
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const settlementSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking ID is required'],
    index: true
  },
  settlementNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  status: {
    type: String,
    enum: {
      values: [
        'pending',      // Settlement required, awaiting payment
        'partial',      // Partially paid/settled
        'completed',    // Fully settled
        'overdue',      // Past due date
        'cancelled',    // Settlement cancelled
        'refunded'      // Refund processed
      ],
      message: 'Invalid settlement status'
    },
    required: [true, 'Settlement status is required'],
    index: true
  },
  // Financial details
  originalAmount: {
    type: Number,
    required: [true, 'Original booking amount is required'],
    min: 0
  },
  adjustments: [{
    type: {
      type: String,
      enum: ['extra_person_charge', 'damage_charge', 'minibar_charge', 'service_charge', 'discount', 'refund', 'penalty', 'cancellation_fee', 'other'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      required: true,
      maxLength: 500
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    appliedBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      userName: String,
      userRole: {
        type: String,
        enum: ['admin', 'staff']
      }
    },
    category: {
      type: String,
      enum: ['room_charge', 'food_beverage', 'amenities', 'services', 'damages', 'penalties', 'credits'],
      default: 'services'
    },
    taxable: {
      type: Boolean,
      default: true
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    invoiceGenerated: {
      type: Boolean,
      default: false
    },
    invoiceId: String,
    attachments: [String] // File paths or URLs for supporting documents
  }],
  finalAmount: {
    type: Number,
    required: [true, 'Final amount is required'],
    min: 0
  },
  totalPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  outstandingBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  // Payment tracking
  payments: [{
    paymentId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    method: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank_transfer', 'online_portal', 'refund_to_source'],
      required: true
    },
    reference: {
      type: String,
      trim: true
    },
    processedAt: {
      type: Date,
      default: Date.now
    },
    processedBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      userName: String,
      userRole: {
        type: String,
        enum: ['admin', 'staff']
      }
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'completed'
    },
    notes: String,
    metadata: mongoose.Schema.Types.Mixed
  }],
  // Guest information
  guestDetails: {
    guestId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    guestName: {
      type: String,
      required: true,
      trim: true
    },
    guestEmail: {
      type: String,
      lowercase: true,
      trim: true
    },
    guestPhone: {
      type: String,
      trim: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    }
  },
  // Booking reference details
  bookingDetails: {
    bookingNumber: String,
    checkInDate: Date,
    checkOutDate: Date,
    roomNumbers: [String],
    nights: Number,
    guestCount: {
      adults: Number,
      children: Number,
      extraPersons: Number
    }
  },
  // Timeline and deadlines
  dueDate: {
    type: Date,
    index: true
  },
  completedDate: Date,
  lastReminderSent: Date,
  nextReminderDue: Date,
  // Escalation management
  escalationLevel: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
    description: '0=No escalation, 1=First reminder, 2=Second reminder, 3=Manager involved, 4=Legal notice, 5=Collection agency'
  },
  escalationHistory: [{
    level: {
      type: Number,
      required: true
    },
    escalatedAt: {
      type: Date,
      default: Date.now
    },
    escalatedBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      userName: String
    },
    reason: String,
    action: String,
    notes: String
  }],
  // Communication tracking
  communications: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'phone_call', 'letter', 'in_person'],
      required: true
    },
    direction: {
      type: String,
      enum: ['outbound', 'inbound'],
      required: true
    },
    subject: String,
    message: String,
    sentAt: {
      type: Date,
      default: Date.now
    },
    sentBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      userName: String
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'responded', 'failed'],
      default: 'sent'
    },
    template: String,
    attachments: [String],
    response: String,
    responseDate: Date
  }],
  // Settlement terms and conditions
  terms: {
    paymentTerms: {
      type: String,
      default: 'Payment due within 7 days of checkout'
    },
    lateFeeRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 2 // 2% per month
    },
    gracePeriod: {
      type: Number,
      default: 3, // 3 days grace period
      description: 'Grace period in days before applying late fees'
    },
    maxEscalationLevel: {
      type: Number,
      default: 5
    }
  },
  // Dispute and resolution
  disputes: [{
    disputeId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    type: {
      type: String,
      enum: ['charge_dispute', 'service_complaint', 'billing_error', 'damage_claim', 'other'],
      required: true
    },
    amount: Number,
    description: {
      type: String,
      required: true
    },
    raisedAt: {
      type: Date,
      default: Date.now
    },
    raisedBy: {
      type: String,
      enum: ['guest', 'hotel'],
      required: true
    },
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'rejected', 'escalated'],
      default: 'open'
    },
    resolution: String,
    resolvedAt: Date,
    resolvedBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      userName: String
    },
    evidence: [String], // File paths or URLs
    notes: String
  }],
  // System flags and metadata
  flags: {
    isVIP: {
      type: Boolean,
      default: false
    },
    isCorporate: {
      type: Boolean,
      default: false
    },
    requiresManagerApproval: {
      type: Boolean,
      default: false
    },
    isHighValue: {
      type: Boolean,
      default: false
    },
    hasSensitiveInfo: {
      type: Boolean,
      default: false
    },
    autoEscalationEnabled: {
      type: Boolean,
      default: true
    }
  },
  notes: {
    type: String,
    maxLength: 2000
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  assignedTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  // Calculation audit trail
  calculationAuditLog: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['auto_correction', 'manual_adjustment', 'payment_addition', 'validation_override'],
      required: true
    },
    originalValues: mongoose.Schema.Types.Mixed,
    corrections: mongoose.Schema.Types.Mixed,
    reason: String,
    performedBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      userName: String,
      userRole: String
    },
    metadata: mongoose.Schema.Types.Mixed
  }],
  // Validation metadata (private - not exposed to client)
  _validationMetadata: {
    lastValidated: Date,
    validationResult: {
      isValid: Boolean,
      errorCount: Number,
      warningCount: Number,
      hasCorrections: Boolean
    },
    rulesEngineVersion: String,
    calculationServiceVersion: String
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      // Remove private validation metadata from JSON output
      delete ret._validationMetadata;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
settlementSchema.index({ hotelId: 1, status: 1, dueDate: 1 });
settlementSchema.index({ hotelId: 1, escalationLevel: 1, status: 1 });
settlementSchema.index({ 'guestDetails.guestId': 1, status: 1 });
settlementSchema.index({ createdAt: -1, hotelId: 1 });
settlementSchema.index({ dueDate: 1, status: 1 }, {
  partialFilterExpression: { status: { $in: ['pending', 'partial', 'overdue'] } }
});

// Text index for search functionality
settlementSchema.index({
  'guestDetails.guestName': 'text',
  'guestDetails.guestEmail': 'text',
  'bookingDetails.bookingNumber': 'text',
  notes: 'text'
});

// Pre-save validation middleware
settlementSchema.pre('save', async function(next) {
  try {
    // Store original values for audit trail
    if (!this._validationMetadata) {
      this._validationMetadata = {};
    }

    // Generate settlement number if not exists
    if (!this.settlementNumber) {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      this.settlementNumber = `SET${date}${random}`;
    }

    // Calculate total paid from payments array FIRST (needed for other calculations)
    if (this.payments && this.payments.length > 0) {
      this.totalPaid = this.payments
        .filter(p => p.status === 'completed')
        .reduce((total, payment) => total + payment.amount, 0);
    }

    // Perform comprehensive calculation validation
    const validationResult = calculationValidationService.validateSettlementCalculations(this);

    // Store validation metadata for audit trail
    this._validationMetadata = {
      lastValidated: new Date(),
      validationResult: {
        isValid: validationResult.isValid,
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
        hasCorrections: Object.keys(validationResult.corrections).length > 0
      }
    };

    // Apply corrections if there are calculation errors
    if (validationResult.corrections && Object.keys(validationResult.corrections).length > 0) {
      const hasChanges = calculationValidationService.applyCalculationCorrections(this, validationResult.corrections);

      if (hasChanges) {
        // Log corrections for audit trail
        if (!this.calculationAuditLog) this.calculationAuditLog = [];
        this.calculationAuditLog.push({
          timestamp: new Date(),
          type: 'auto_correction',
          originalValues: validationResult.originalValues,
          corrections: validationResult.corrections,
          reason: 'Pre-save validation correction'
        });
      }
    }

    // Fail save if there are validation errors that couldn't be corrected
    if (!validationResult.isValid && validationResult.errors.length > 0) {
      const error = new Error(`Settlement validation failed: ${validationResult.errors.join(', ')}`);
      error.name = 'ValidationError';
      error.validationErrors = validationResult.errors;
      error.validationWarnings = validationResult.warnings;
      return next(error);
    }

    // Manually calculate outstanding balance and refund amount using precise arithmetic
    this.outstandingBalance = Math.max(0, this.finalAmount - this.totalPaid);
    this.refundAmount = Math.max(0, this.totalPaid - this.finalAmount);

    // Update status based on amounts
    if (this.outstandingBalance === 0 && this.refundAmount === 0) {
      this.status = 'completed';
      if (!this.completedDate) {
        this.completedDate = new Date();
      }
    } else if (this.outstandingBalance > 0) {
      // Check if overdue
      if (this.dueDate && new Date() > this.dueDate && this.status !== 'overdue') {
        this.status = 'overdue';
      } else if (this.totalPaid > 0) {
        this.status = 'partial';
      } else {
        this.status = 'pending';
      }
    } else if (this.refundAmount > 0) {
      this.status = 'refunded';
    }

    // Set high value flag
    this.flags.isHighValue = this.finalAmount > 50000; // > 50K INR

    // Set next reminder due date
    if (this.status === 'pending' || this.status === 'partial' || this.status === 'overdue') {
      if (!this.nextReminderDue || this.nextReminderDue < new Date()) {
        const reminderInterval = Math.pow(2, this.escalationLevel) * 24 * 60 * 60 * 1000; // Exponential backoff
        this.nextReminderDue = new Date(Date.now() + reminderInterval);
      }
    }

    // Log warnings if any (non-blocking)
    if (validationResult.warnings && validationResult.warnings.length > 0) {
      console.warn(`Settlement ${this.settlementNumber} validation warnings:`, validationResult.warnings);
    }

    next();
  } catch (error) {
    console.error('Settlement validation error:', error);
    next(error);
  }
});

// Virtual for days overdue
settlementSchema.virtual('daysOverdue').get(function() {
  if (!this.dueDate || this.status === 'completed') return 0;
  const now = new Date();
  if (now <= this.dueDate) return 0;
  return Math.ceil((now - this.dueDate) / (1000 * 60 * 60 * 24));
});

// Virtual for settlement age
settlementSchema.virtual('ageInDays').get(function() {
  return Math.ceil((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Static method to find overdue settlements
settlementSchema.statics.findOverdue = async function(hotelId, gracePeriod = 0) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - gracePeriod);

  return await this.find({
    hotelId,
    status: { $in: ['pending', 'partial', 'overdue'] },
    dueDate: { $lt: cutoffDate },
    outstandingBalance: { $gt: 0 }
  }).sort({ dueDate: 1 });
};

// Static method for settlement analytics
settlementSchema.statics.getAnalytics = async function(hotelId, dateRange = {}) {
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
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$finalAmount' },
        avgAmount: { $avg: '$finalAmount' },
        totalOutstanding: { $sum: '$outstandingBalance' }
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
            avgAmount: '$avgAmount',
            totalOutstanding: '$totalOutstanding'
          }
        },
        totalSettlements: { $sum: '$count' },
        totalValue: { $sum: '$totalAmount' },
        totalOutstanding: { $sum: '$totalOutstanding' }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

// Instance method to add payment with validation
settlementSchema.methods.addPayment = function(paymentData, userContext) {
  if (!['admin', 'staff'].includes(userContext.userRole)) {
    throw new Error('Only admin and staff can add payments');
  }

  // Validate payment using financial rules engine
  const paymentValidation = financialRulesEngine.validatePaymentProcessing(paymentData, this);

  if (!paymentValidation.isValid) {
    throw new Error(`Payment validation failed: ${paymentValidation.violations.join(', ')}`);
  }

  // Validate payment amount against settlement
  const amountValidation = calculationValidationService.validatePaymentAmount(
    this,
    paymentData.amount,
    paymentData.allowOverpayment || false
  );

  if (!amountValidation.isValid) {
    throw new Error('Payment amount validation failed');
  }

  const payment = {
    amount: paymentData.amount,
    method: paymentData.method,
    reference: paymentData.reference,
    processedBy: {
      userId: userContext.userId,
      userName: userContext.userName,
      userRole: userContext.userRole
    },
    notes: paymentData.notes,
    status: paymentData.status || 'completed'
  };

  // Store original values for audit trail
  const originalValues = {
    totalPaid: this.totalPaid,
    outstandingBalance: this.outstandingBalance,
    refundAmount: this.refundAmount,
    status: this.status
  };

  this.payments.push(payment);

  // Add to calculation audit log
  if (!this.calculationAuditLog) this.calculationAuditLog = [];
  this.calculationAuditLog.push({
    type: 'payment_addition',
    originalValues,
    corrections: {
      paymentAdded: payment.amount,
      paymentMethod: payment.method
    },
    reason: `Payment of ${payment.amount} ${this.currency} added via ${payment.method}`,
    performedBy: {
      userId: userContext.userId,
      userName: userContext.userName,
      userRole: userContext.userRole
    },
    metadata: {
      paymentValidation: paymentValidation.warnings,
      requiresApproval: paymentValidation.requiresApproval,
      amountValidation
    }
  });

  // Add communication record
  this.communications.push({
    type: 'in_person',
    direction: 'inbound',
    subject: 'Payment Received',
    message: `Payment of ${payment.amount} ${this.currency} received via ${payment.method}`,
    sentBy: {
      userId: userContext.userId,
      userName: userContext.userName
    },
    status: 'delivered'
  });

  return payment;
};

// Instance method to escalate settlement
settlementSchema.methods.escalate = function(reason, userContext) {
  if (!['admin', 'staff'].includes(userContext.userRole)) {
    throw new Error('Only admin and staff can escalate settlements');
  }

  const newLevel = Math.min(this.escalationLevel + 1, this.terms.maxEscalationLevel);

  this.escalationHistory.push({
    level: newLevel,
    escalatedBy: {
      userId: userContext.userId,
      userName: userContext.userName
    },
    reason,
    action: this.getEscalationAction(newLevel),
    notes: `Escalated from level ${this.escalationLevel} to ${newLevel}`
  });

  this.escalationLevel = newLevel;

  return this.escalationLevel;
};

// Instance method to get escalation action
settlementSchema.methods.getEscalationAction = function(level) {
  const actions = {
    1: 'Send first payment reminder',
    2: 'Send second payment reminder',
    3: 'Manager review and contact',
    4: 'Legal notice preparation',
    5: 'Collection agency referral'
  };
  return actions[level] || 'Manual review required';
};

// Instance method to add communication
settlementSchema.methods.addCommunication = function(commData, userContext) {
  const communication = {
    type: commData.type,
    direction: commData.direction || 'outbound',
    subject: commData.subject,
    message: commData.message,
    sentBy: {
      userId: userContext.userId,
      userName: userContext.userName
    },
    status: commData.status || 'sent',
    template: commData.template,
    attachments: commData.attachments || []
  };

  this.communications.push(communication);
  this.lastReminderSent = new Date();

  return communication;
};

// Instance method to resolve dispute
settlementSchema.methods.resolveDispute = function(disputeId, resolution, userContext) {
  const dispute = this.disputes.find(d => d.disputeId === disputeId);
  if (!dispute) {
    throw new Error('Dispute not found');
  }

  dispute.status = 'resolved';
  dispute.resolution = resolution;
  dispute.resolvedAt = new Date();
  dispute.resolvedBy = {
    userId: userContext.userId,
    userName: userContext.userName
  };

  return dispute;
};

// Instance method to validate calculations manually
settlementSchema.methods.validateCalculations = function() {
  return calculationValidationService.validateSettlementCalculations(this);
};

// Instance method to apply financial rules validation
settlementSchema.methods.validateBusinessRules = function(booking = null) {
  return financialRulesEngine.validateSettlementCreation(this, booking);
};

// Instance method to calculate late fees
settlementSchema.methods.calculateLateFee = function(asOfDate = new Date()) {
  return calculationValidationService.calculateLateFee(this, asOfDate);
};

// Instance method to add adjustment with validation
settlementSchema.methods.addAdjustment = function(adjustmentData, userContext) {
  if (!['admin', 'staff'].includes(userContext.userRole)) {
    throw new Error('Only admin and staff can add adjustments');
  }

  // Validate adjustment using financial rules engine
  const adjustmentValidation = financialRulesEngine.validateAdjustmentRules(adjustmentData, this);

  if (!adjustmentValidation.isValid) {
    throw new Error(`Adjustment validation failed: ${adjustmentValidation.violations.join(', ')}`);
  }

  // Store original values for audit trail
  const originalValues = {
    finalAmount: this.finalAmount,
    outstandingBalance: this.outstandingBalance,
    adjustmentsCount: this.adjustments?.length || 0
  };

  const adjustment = {
    type: adjustmentData.type,
    amount: adjustmentData.amount,
    description: adjustmentData.description,
    appliedBy: {
      userId: userContext.userId,
      userName: userContext.userName,
      userRole: userContext.userRole
    },
    category: adjustmentData.category || 'services',
    taxable: adjustmentData.taxable !== false, // Default to true
    taxAmount: adjustmentData.taxAmount || 0,
    attachments: adjustmentData.attachments || []
  };

  if (!this.adjustments) this.adjustments = [];
  this.adjustments.push(adjustment);

  // Update final amount
  this.finalAmount = (this.finalAmount || 0) + adjustment.amount + adjustment.taxAmount;

  // Add to calculation audit log
  if (!this.calculationAuditLog) this.calculationAuditLog = [];
  this.calculationAuditLog.push({
    type: 'manual_adjustment',
    originalValues,
    corrections: {
      adjustmentType: adjustment.type,
      adjustmentAmount: adjustment.amount,
      newFinalAmount: this.finalAmount
    },
    reason: adjustmentData.description,
    performedBy: {
      userId: userContext.userId,
      userName: userContext.userName,
      userRole: userContext.userRole
    },
    metadata: {
      adjustmentValidation: adjustmentValidation.warnings,
      requiresApproval: adjustmentValidation.requiresApproval
    }
  });

  return adjustment;
};

// Instance method to get calculation audit trail
settlementSchema.methods.getCalculationAuditTrail = function() {
  return this.calculationAuditLog || [];
};

// Instance method to get validation status
settlementSchema.methods.getValidationStatus = function() {
  if (!this._validationMetadata) {
    return {
      isValid: false,
      lastValidated: null,
      message: 'Settlement not yet validated'
    };
  }

  return {
    isValid: this._validationMetadata.validationResult?.isValid || false,
    lastValidated: this._validationMetadata.lastValidated,
    errorCount: this._validationMetadata.validationResult?.errorCount || 0,
    warningCount: this._validationMetadata.validationResult?.warningCount || 0,
    hasCorrections: this._validationMetadata.validationResult?.hasCorrections || false
  };
};

// Static method to find settlements with calculation errors
settlementSchema.statics.findWithCalculationErrors = async function(hotelId) {
  return await this.find({
    hotelId,
    '_validationMetadata.validationResult.isValid': false
  }).select('settlementNumber finalAmount totalPaid outstandingBalance _validationMetadata');
};

// Static method to get calculation validation statistics
settlementSchema.statics.getValidationStatistics = async function(hotelId, dateRange = {}) {
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
        _id: null,
        totalSettlements: { $sum: 1 },
        validSettlements: {
          $sum: {
            $cond: [{ $eq: ['$_validationMetadata.validationResult.isValid', true] }, 1, 0]
          }
        },
        settlementsWithErrors: {
          $sum: {
            $cond: [{ $eq: ['$_validationMetadata.validationResult.isValid', false] }, 1, 0]
          }
        },
        settlementsWithCorrections: {
          $sum: {
            $cond: [{ $eq: ['$_validationMetadata.validationResult.hasCorrections', true] }, 1, 0]
          }
        },
        avgErrorCount: { $avg: '$_validationMetadata.validationResult.errorCount' },
        avgWarningCount: { $avg: '$_validationMetadata.validationResult.warningCount' }
      }
    },
    {
      $project: {
        _id: 0,
        totalSettlements: 1,
        validSettlements: 1,
        settlementsWithErrors: 1,
        settlementsWithCorrections: 1,
        validationRate: {
          $cond: [
            { $eq: ['$totalSettlements', 0] },
            0,
            { $divide: ['$validSettlements', '$totalSettlements'] }
          ]
        },
        avgErrorCount: { $round: ['$avgErrorCount', 2] },
        avgWarningCount: { $round: ['$avgWarningCount', 2] }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalSettlements: 0,
    validSettlements: 0,
    settlementsWithErrors: 0,
    settlementsWithCorrections: 0,
    validationRate: 0,
    avgErrorCount: 0,
    avgWarningCount: 0
  };
};

export default mongoose.model('Settlement', settlementSchema);