import mongoose from 'mongoose';

const reasonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Reason name is required'],
    trim: true,
    maxLength: [100, 'Reason name cannot exceed 100 characters'],
    index: true
  },
  code: {
    type: String,
    required: [true, 'Reason code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxLength: [20, 'Reason code cannot exceed 20 characters'],
    match: [/^[A-Z0-9_-]+$/, 'Reason code can only contain letters, numbers, underscores and hyphens']
  },
  description: {
    type: String,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Categorization
  category: {
    type: String,
    required: true,
    enum: [
      'cancellation', 'no_show', 'modification', 'discount', 'comp', 'refund',
      'upgrade', 'downgrade', 'early_checkout', 'late_checkout', 'damage',
      'complaint', 'maintenance', 'overbooking', 'group_booking', 'vip',
      'loyalty', 'package', 'seasonal', 'promotional', 'operational', 'other'
    ],
    index: true
  },
  subcategory: {
    type: String,
    maxLength: [50, 'Subcategory cannot exceed 50 characters']
  },
  
  // Business rules
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  requiresApproval: {
    type: Boolean,
    default: false
  },
  requiresManagerApproval: {
    type: Boolean,
    default: false
  },
  requiresComments: {
    type: Boolean,
    default: false
  },
  requiresDocumentation: {
    type: Boolean,
    default: false
  },
  
  // Financial impact
  allowsRefund: {
    type: Boolean,
    default: false
  },
  maxRefundPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  allowsDiscount: {
    type: Boolean,
    default: false
  },
  maxDiscountPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  allowsComp: {
    type: Boolean,
    default: false
  },
  hasFinancialImpact: {
    type: Boolean,
    default: false
  },
  
  // Workflow settings
  autoApply: {
    type: Boolean,
    default: false
  },
  notifyGuest: {
    type: Boolean,
    default: true
  },
  notifyManagement: {
    type: Boolean,
    default: false
  },
  createTask: {
    type: Boolean,
    default: false
  },
  taskTemplate: {
    type: String,
    maxLength: [200, 'Task template cannot exceed 200 characters']
  },
  
  // Time constraints
  canUseAfterCheckIn: {
    type: Boolean,
    default: true
  },
  canUseAfterCheckOut: {
    type: Boolean,
    default: false
  },
  canUseBeforeArrival: {
    type: Boolean,
    default: true
  },
  hoursBeforeArrival: {
    type: Number,
    min: 0,
    max: 8760, // 1 year in hours
    default: 24
  },
  hoursAfterCheckOut: {
    type: Number,
    min: 0,
    max: 8760,
    default: 0
  },
  
  // Department and role access
  applicableDepartments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }],
  allowedRoles: [{
    type: String,
    enum: ['admin', 'manager', 'supervisor', 'front_desk', 'housekeeping', 'maintenance', 'guest_services']
  }],
  restrictedRoles: [{
    type: String,
    enum: ['admin', 'manager', 'supervisor', 'front_desk', 'housekeeping', 'maintenance', 'guest_services']
  }],
  
  // Integration settings
  integrations: {
    pms: {
      enabled: { type: Boolean, default: true },
      code: String,
      mapping: mongoose.Schema.Types.Mixed
    },
    accounting: {
      enabled: { type: Boolean, default: false },
      code: String,
      glAccount: String
    },
    reporting: {
      enabled: { type: Boolean, default: true },
      category: String,
      tags: [String]
    }
  },
  
  // Templates and messages
  templates: {
    guestNotification: {
      email: {
        subject: String,
        body: String
      },
      sms: {
        message: String
      }
    },
    internalNotification: {
      subject: String,
      message: String
    },
    documentation: {
      required: [String],
      optional: [String]
    }
  },
  
  // Priority and escalation
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  escalationRules: [{
    condition: String,
    timeLimit: Number, // in hours
    escalateTo: [{
      type: String,
      enum: ['manager', 'gm', 'owner', 'department_head']
    }],
    action: {
      type: String,
      enum: ['notify', 'require_approval', 'auto_apply', 'reject']
    }
  }],
  
  // Analytics and tracking
  usage: {
    totalUsed: { type: Number, default: 0 },
    lastUsed: Date,
    avgFrequencyPerMonth: { type: Number, default: 0 },
    avgFinancialImpact: { type: Number, default: 0 },
    commonPatterns: [String]
  },
  
  // Compliance and audit
  complianceFlags: [{
    type: String,
    enum: ['gdpr', 'financial_audit', 'tax_related', 'legal_required', 'insurance_claim']
  }],
  retentionPeriod: {
    type: Number,
    default: 2555, // 7 years in days
    min: 30,
    max: 3650
  },
  
  // Hotel association
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  
  // System fields
  isSystemReason: {
    type: Boolean,
    default: false
  },
  systemCategory: {
    type: String,
    enum: ['auto_cancellation', 'no_show_fee', 'overbooking', 'system_maintenance', 'payment_failure']
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
  
  // Usage log
  usageLog: [{
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    usedAt: {
      type: Date,
      default: Date.now
    },
    context: {
      type: String,
      enum: ['booking', 'cancellation', 'modification', 'billing', 'maintenance', 'complaint', 'other']
    },
    entityId: mongoose.Schema.Types.ObjectId,
    entityType: String,
    financialImpact: {
      amount: Number,
      currency: String,
      type: {
        type: String,
        enum: ['refund', 'discount', 'comp', 'charge', 'adjustment']
      }
    },
    notes: String,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
reasonSchema.index({ hotelId: 1, category: 1, isActive: 1 });
reasonSchema.index({ code: 1 }, { unique: true });
reasonSchema.index({ name: 'text', description: 'text' });
reasonSchema.index({ 'usage.totalUsed': -1 });
reasonSchema.index({ 'usage.lastUsed': -1 });
reasonSchema.index({ createdAt: -1 });

// Virtual for usage frequency
reasonSchema.virtual('usageFrequency').get(function() {
  const monthsActive = Math.max(1, Math.ceil((new Date() - this.createdAt) / (1000 * 60 * 60 * 24 * 30)));
  return (this.usage.totalUsed / monthsActive).toFixed(2);
});

// Virtual for last usage
reasonSchema.virtual('daysSinceLastUse').get(function() {
  if (!this.usage.lastUsed) return -1;
  return Math.floor((new Date() - this.usage.lastUsed) / (1000 * 60 * 60 * 24));
});

// Virtual for financial impact classification
reasonSchema.virtual('financialImpactLevel').get(function() {
  if (!this.hasFinancialImpact) return 'none';
  if (this.maxRefundPercentage >= 75 || this.maxDiscountPercentage >= 50) return 'high';
  if (this.maxRefundPercentage >= 25 || this.maxDiscountPercentage >= 25) return 'medium';
  return 'low';
});

// Methods
reasonSchema.methods.canBeUsedBy = function(user) {
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

reasonSchema.methods.requiresApprovalFor = function(context, amount = 0) {
  if (this.requiresManagerApproval) return 'manager';
  if (this.requiresApproval) return 'supervisor';
  
  // Check escalation rules
  for (const rule of this.escalationRules) {
    if (this.matchesEscalationCondition(rule.condition, context, amount)) {
      if (rule.action === 'require_approval') {
        return rule.escalateTo[0] || 'manager';
      }
    }
  }
  
  return null;
};

reasonSchema.methods.matchesEscalationCondition = function(condition, context, amount) {
  // Simple condition matching - could be expanded with a proper rule engine
  if (condition.includes('amount >') && amount) {
    const threshold = parseFloat(condition.match(/amount > (\d+)/)?.[1] || '0');
    return amount > threshold;
  }
  
  if (condition.includes('context =') && context) {
    const expectedContext = condition.match(/context = (\w+)/)?.[1];
    return context === expectedContext;
  }
  
  return false;
};

reasonSchema.methods.logUsage = function(userId, context, entityId, entityType, options = {}) {
  this.usageLog.push({
    usedBy: userId,
    context,
    entityId,
    entityType,
    financialImpact: options.financialImpact,
    notes: options.notes,
    approvedBy: options.approvedBy
  });
  
  // Update usage statistics
  this.usage.totalUsed += 1;
  this.usage.lastUsed = new Date();
  
  // Update financial impact average
  if (options.financialImpact?.amount) {
    const totalImpact = this.usage.avgFinancialImpact * (this.usage.totalUsed - 1) + options.financialImpact.amount;
    this.usage.avgFinancialImpact = totalImpact / this.usage.totalUsed;
  }
  
  return this.save();
};

// Static methods
reasonSchema.statics.findByCategory = function(hotelId, category, options = {}) {
  const { includeInactive = false } = options;
  const filter = { hotelId, category };
  
  if (!includeInactive) {
    filter.isActive = true;
  }
  
  return this.find(filter).sort({ name: 1 });
};

reasonSchema.statics.findByRole = function(hotelId, userRole, options = {}) {
  const { category, includeInactive = false } = options;
  const filter = { 
    hotelId,
    $or: [
      { allowedRoles: { $in: [userRole] } },
      { allowedRoles: { $size: 0 } }
    ],
    restrictedRoles: { $nin: [userRole] }
  };
  
  if (category) filter.category = category;
  if (!includeInactive) filter.isActive = true;
  
  return this.find(filter).sort({ name: 1 });
};

reasonSchema.statics.getMostUsed = function(hotelId, limit = 10) {
  return this.find({ hotelId, isActive: true })
    .sort({ 'usage.totalUsed': -1 })
    .limit(limit);
};

reasonSchema.statics.getReasonStats = function(hotelId) {
  return this.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        activeCount: { 
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        totalUsage: { $sum: '$usage.totalUsed' },
        avgFinancialImpact: { $avg: '$usage.avgFinancialImpact' }
      }
    },
    { $sort: { totalUsage: -1 } }
  ]);
};

// Pre-save middleware
reasonSchema.pre('save', function(next) {
  // Auto-generate code if not provided
  if (!this.code && this.name) {
    this.code = this.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .substring(0, 20);
  }
  
  // Calculate usage frequency
  const monthsActive = Math.max(1, Math.ceil((new Date() - this.createdAt) / (1000 * 60 * 60 * 24 * 30)));
  this.usage.avgFrequencyPerMonth = this.usage.totalUsed / monthsActive;
  
  next();
});

// Pre-remove middleware
reasonSchema.pre('remove', async function(next) {
  // Check if reason is being used in any bookings, cancellations, etc.
  // This would depend on your booking/transaction models
  
  // For now, just prevent deletion of system reasons
  if (this.isSystemReason) {
    const error = new Error('Cannot delete system reason');
    error.code = 'SYSTEM_REASON_DELETE';
    return next(error);
  }
  
  next();
});

export default mongoose.model('Reason', reasonSchema);
