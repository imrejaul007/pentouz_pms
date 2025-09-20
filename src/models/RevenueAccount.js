import mongoose from 'mongoose';

const revenueAccountSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  accountCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxLength: 20,
    validate: {
      validator: function(value) {
        return /^[A-Z0-9_-]+$/.test(value);
      },
      message: 'Account code must contain only letters, numbers, underscores, and hyphens'
    }
  },
  accountName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  accountDescription: {
    type: String,
    maxLength: 500
  },
  revenueCategory: {
    type: String,
    required: true,
    enum: [
      'room_revenue',        // Standard room charges
      'upgrade_revenue',     // Room upgrade charges
      'package_revenue',     // Package deals
      'addon_revenue',       // Add-on services
      'fee_revenue',         // Resort fees, service fees
      'tax_revenue',         // Tax collections (reference only)
      'deposit_revenue',     // Security deposits
      'penalty_revenue',     // No-show, cancellation penalties
      'corporate_revenue',   // Corporate rate bookings
      'group_revenue',       // Group booking revenue
      'promotional_revenue', // Promotional rates
      'seasonal_revenue',    // Seasonal rate adjustments
      'channel_revenue',     // OTA-specific revenue
      'other_revenue'        // Miscellaneous revenue
    ]
  },
  accountType: {
    type: String,
    required: true,
    enum: [
      'primary',      // Main room revenue
      'secondary',    // Additional charges
      'adjustment',   // Rate adjustments
      'promotional',  // Discounts and promotions
      'fee',         // Fixed fees
      'tax',         // Tax-related (reference)
      'deposit'      // Deposits and prepayments
    ]
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isSystemGenerated: {
    type: Boolean,
    default: false // System-generated accounts cannot be deleted
  },
  parentAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RevenueAccount',
    default: null // For hierarchical account structure
  },
  accountLevel: {
    type: Number,
    default: 1, // 1 = top level, 2 = sub-account, etc.
    min: 1,
    max: 5
  },
  sortOrder: {
    type: Number,
    default: 0,
    min: 0
  },
  glAccountCode: {
    type: String,
    trim: true,
    maxLength: 30, // General Ledger account mapping
    sparse: true
  },
  reportingGroup: {
    type: String,
    enum: [
      'rooms_department',
      'food_beverage',
      'other_operated_departments',
      'rentals_other_income',
      'total_operated_department_revenue'
    ],
    default: 'rooms_department'
  },
  applicableRoomTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomType'
  }],
  applicableChannels: [{
    type: String,
    enum: ['direct', 'booking_com', 'expedia', 'airbnb', 'agoda', 'all']
  }],
  applicableRateTypes: [{
    type: String,
    enum: ['standard', 'corporate', 'group', 'promotional', 'package', 'seasonal']
  }],
  validFrom: {
    type: Date,
    required: true,
    default: Date.now
  },
  validTo: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value > this.validFrom;
      },
      message: 'Valid to date must be after valid from date'
    }
  },
  autoCalculation: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    calculationMethod: {
      type: String,
      enum: ['percentage', 'fixed_amount', 'per_night', 'per_guest', 'tiered'],
      default: 'percentage'
    },
    calculationValue: {
      type: Number,
      min: 0,
      default: 0
    },
    basedOnAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RevenueAccount',
      default: null // Which account to base calculation on
    }
  },
  budgetInfo: {
    monthlyBudget: {
      type: Number,
      default: 0,
      min: 0
    },
    yearlyBudget: {
      type: Number,
      default: 0,
      min: 0
    },
    budgetCurrency: {
      type: String,
      default: 'USD',
      maxLength: 3
    }
  },
  taxConfiguration: {
    isTaxable: {
      type: Boolean,
      default: true
    },
    taxCategory: {
      type: String,
      enum: ['standard', 'exempt', 'reduced_rate', 'zero_rate'],
      default: 'standard'
    },
    exemptionReason: {
      type: String,
      maxLength: 200
    }
  },
  integrationSettings: {
    exportToPMS: {
      type: Boolean,
      default: true
    },
    exportToAccounting: {
      type: Boolean,
      default: true
    },
    pmsMappingCode: {
      type: String,
      maxLength: 20
    },
    accountingMappingCode: {
      type: String,
      maxLength: 20
    }
  },
  auditInfo: {
    lastRevenueDate: {
      type: Date
    },
    totalRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    transactionCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastAuditDate: {
      type: Date
    }
  },
  notes: {
    type: String,
    maxLength: 1000
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
revenueAccountSchema.index({ hotelId: 1, isActive: 1 });
revenueAccountSchema.index({ hotelId: 1, revenueCategory: 1 });
revenueAccountSchema.index({ hotelId: 1, accountCode: 1 }, { unique: true });
revenueAccountSchema.index({ hotelId: 1, accountType: 1 });
revenueAccountSchema.index({ hotelId: 1, parentAccount: 1 });
revenueAccountSchema.index({ hotelId: 1, reportingGroup: 1 });
revenueAccountSchema.index({ hotelId: 1, validFrom: 1, validTo: 1 });

// Compound index for revenue tracking
revenueAccountSchema.index({ 
  hotelId: 1, 
  isActive: 1, 
  revenueCategory: 1,
  validFrom: 1 
});

// Virtual for full account display
revenueAccountSchema.virtual('fullAccountName').get(function() {
  return `${this.accountCode} - ${this.accountName}`;
});

// Virtual for hierarchy display
revenueAccountSchema.virtual('hierarchyLevel').get(function() {
  return '  '.repeat(this.accountLevel - 1) + this.accountName;
});

// Virtual for revenue per transaction
revenueAccountSchema.virtual('avgRevenuePerTransaction').get(function() {
  if (this.auditInfo.transactionCount === 0) return 0;
  return this.auditInfo.totalRevenue / this.auditInfo.transactionCount;
});

// Method to check if account is applicable for criteria
revenueAccountSchema.methods.isApplicable = function(criteria) {
  const now = new Date();
  
  // Check if account is active and within valid date range
  if (!this.isActive) return false;
  if (this.validFrom > now) return false;
  if (this.validTo && this.validTo < now) return false;
  
  // Check room type applicability
  if (this.applicableRoomTypes.length > 0 && criteria.roomTypeId) {
    if (!this.applicableRoomTypes.some(rt => rt.toString() === criteria.roomTypeId.toString())) {
      return false;
    }
  }
  
  // Check channel applicability
  if (this.applicableChannels.length > 0 && criteria.channel) {
    if (!this.applicableChannels.includes(criteria.channel) && 
        !this.applicableChannels.includes('all')) {
      return false;
    }
  }
  
  // Check rate type applicability
  if (this.applicableRateTypes.length > 0 && criteria.rateType) {
    if (!this.applicableRateTypes.includes(criteria.rateType)) {
      return false;
    }
  }
  
  return true;
};

// Method to calculate auto revenue
revenueAccountSchema.methods.calculateAutoRevenue = function(baseAmount, criteria = {}) {
  if (!this.autoCalculation.isEnabled) return 0;
  
  let calculatedAmount = 0;
  
  switch (this.autoCalculation.calculationMethod) {
    case 'percentage':
      calculatedAmount = (baseAmount * this.autoCalculation.calculationValue) / 100;
      break;
    case 'fixed_amount':
      calculatedAmount = this.autoCalculation.calculationValue;
      break;
    case 'per_night':
      calculatedAmount = this.autoCalculation.calculationValue * (criteria.nights || 1);
      break;
    case 'per_guest':
      calculatedAmount = this.autoCalculation.calculationValue * (criteria.guests || 1);
      break;
    case 'tiered':
      // Implement tiered calculation based on amount ranges
      calculatedAmount = this.calculateTieredAmount(baseAmount);
      break;
    default:
      calculatedAmount = 0;
  }
  
  return Math.round(calculatedAmount * 100) / 100;
};

// Method for tiered calculation
revenueAccountSchema.methods.calculateTieredAmount = function(baseAmount) {
  // This would be expanded based on tiered rate configuration
  // For now, simple implementation
  if (baseAmount < 100) return this.autoCalculation.calculationValue * 0.5;
  if (baseAmount < 200) return this.autoCalculation.calculationValue;
  return this.autoCalculation.calculationValue * 1.5;
};

// Static method to get applicable accounts
revenueAccountSchema.statics.getApplicableAccounts = async function(hotelId, criteria = {}) {
  const query = {
    hotelId,
    isActive: true,
    validFrom: { $lte: new Date() },
    $or: [
      { validTo: { $exists: false } },
      { validTo: { $gte: new Date() } }
    ]
  };
  
  // Add category filter if specified
  if (criteria.revenueCategory) {
    query.revenueCategory = criteria.revenueCategory;
  }
  
  // Add account type filter if specified
  if (criteria.accountType) {
    query.accountType = criteria.accountType;
  }
  
  const accounts = await this.find(query)
    .populate('parentAccount', 'accountCode accountName')
    .populate('applicableRoomTypes', 'name code')
    .sort({ accountLevel: 1, sortOrder: 1, accountCode: 1 });
  
  return accounts.filter(account => account.isApplicable(criteria));
};

// Static method to get account hierarchy
revenueAccountSchema.statics.getAccountHierarchy = async function(hotelId) {
  const accounts = await this.find({
    hotelId,
    isActive: true
  }).sort({ accountLevel: 1, sortOrder: 1, accountCode: 1 });
  
  const hierarchy = [];
  const accountMap = new Map();
  
  // First pass: create account map
  accounts.forEach(account => {
    accountMap.set(account._id.toString(), {
      ...account.toObject(),
      children: []
    });
  });
  
  // Second pass: build hierarchy
  accounts.forEach(account => {
    const accountObj = accountMap.get(account._id.toString());
    
    if (account.parentAccount) {
      const parent = accountMap.get(account.parentAccount.toString());
      if (parent) {
        parent.children.push(accountObj);
      } else {
        hierarchy.push(accountObj);
      }
    } else {
      hierarchy.push(accountObj);
    }
  });
  
  return hierarchy;
};

// Static method to get revenue summary
revenueAccountSchema.statics.getRevenueSummary = async function(hotelId, filters = {}) {
  const matchQuery = { hotelId };
  
  if (filters.startDate || filters.endDate) {
    matchQuery.createdAt = {};
    if (filters.startDate) matchQuery.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) matchQuery.createdAt.$lte = new Date(filters.endDate);
  }
  
  if (filters.revenueCategory) matchQuery.revenueCategory = filters.revenueCategory;
  if (filters.accountType) matchQuery.accountType = filters.accountType;
  
  const summary = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalAccounts: { $sum: 1 },
        activeAccounts: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        totalBudgetedRevenue: { $sum: '$budgetInfo.yearlyBudget' },
        totalActualRevenue: { $sum: '$auditInfo.totalRevenue' },
        accountsByCategory: {
          $push: {
            category: '$revenueCategory',
            revenue: '$auditInfo.totalRevenue'
          }
        },
        accountsByType: {
          $push: {
            type: '$accountType',
            revenue: '$auditInfo.totalRevenue'
          }
        }
      }
    }
  ]);
  
  if (summary.length === 0) {
    return {
      totalAccounts: 0,
      activeAccounts: 0,
      totalBudgetedRevenue: 0,
      totalActualRevenue: 0,
      categoryBreakdown: {},
      typeBreakdown: {}
    };
  }
  
  const result = summary[0];
  
  // Process category breakdown
  const categoryBreakdown = {};
  result.accountsByCategory.forEach(item => {
    if (!categoryBreakdown[item.category]) {
      categoryBreakdown[item.category] = 0;
    }
    categoryBreakdown[item.category] += item.revenue || 0;
  });
  
  // Process type breakdown
  const typeBreakdown = {};
  result.accountsByType.forEach(item => {
    if (!typeBreakdown[item.type]) {
      typeBreakdown[item.type] = 0;
    }
    typeBreakdown[item.type] += item.revenue || 0;
  });
  
  return {
    totalAccounts: result.totalAccounts,
    activeAccounts: result.activeAccounts,
    totalBudgetedRevenue: result.totalBudgetedRevenue || 0,
    totalActualRevenue: result.totalActualRevenue || 0,
    categoryBreakdown,
    typeBreakdown,
    budgetVariance: (result.totalActualRevenue || 0) - (result.totalBudgetedRevenue || 0)
  };
};

// Pre-save middleware for validation and auto-calculations
revenueAccountSchema.pre('save', async function(next) {
  // Set account level based on parent
  if (this.parentAccount) {
    const parent = await this.constructor.findById(this.parentAccount);
    if (parent) {
      this.accountLevel = parent.accountLevel + 1;
    }
  }
  
  // Validate account level depth
  if (this.accountLevel > 5) {
    return next(new Error('Account hierarchy cannot exceed 5 levels'));
  }
  
  // Ensure account code is unique within hotel
  if (this.isNew || this.isModified('accountCode')) {
    const existing = await this.constructor.findOne({
      hotelId: this.hotelId,
      accountCode: this.accountCode,
      _id: { $ne: this._id }
    });
    
    if (existing) {
      return next(new Error('Account code must be unique within hotel'));
    }
  }
  
  // Auto-generate GL account code if not provided
  if (!this.glAccountCode && this.isNew) {
    this.glAccountCode = this.generateGLAccountCode();
  }
  
  next();
});

// Method to generate GL account code
revenueAccountSchema.methods.generateGLAccountCode = function() {
  const categoryPrefixes = {
    'room_revenue': '4100',
    'upgrade_revenue': '4110',
    'package_revenue': '4120',
    'addon_revenue': '4130',
    'fee_revenue': '4140',
    'deposit_revenue': '2100',
    'penalty_revenue': '4150',
    'corporate_revenue': '4160',
    'group_revenue': '4170',
    'promotional_revenue': '4180',
    'seasonal_revenue': '4190',
    'channel_revenue': '4200',
    'other_revenue': '4900'
  };
  
  const prefix = categoryPrefixes[this.revenueCategory] || '4900';
  const suffix = this.accountCode.slice(-2).padStart(2, '0');
  
  return `${prefix}${suffix}`;
};

// Post-save middleware for audit trail
revenueAccountSchema.post('save', function() {
  // Log account creation/update for audit purposes
  console.log(`Revenue account ${this.accountCode} saved for hotel ${this.hotelId}`);
});

export default mongoose.model('RevenueAccount', revenueAccountSchema);
