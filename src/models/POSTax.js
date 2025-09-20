import mongoose from 'mongoose';

/**
 * POS Tax Model
 * 
 * Manages comprehensive tax system for POS operations including:
 * - Multiple tax types (VAT, GST, Service Tax, Local Tax, Luxury Tax)
 * - Tax groups for different product categories
 * - Complex tax rules and calculations
 * - Tax exemptions and special cases
 */

const taxRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed_amount', 'compound'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  // For compound taxes (tax on tax)
  appliesToTaxes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POSTax'
  }],
  // Minimum and maximum thresholds
  minThreshold: {
    type: Number,
    default: 0
  },
  maxThreshold: {
    type: Number,
    default: null
  },
  // Rounding rules
  rounding: {
    type: String,
    enum: ['round', 'floor', 'ceil', 'none'],
    default: 'round'
  },
  // Decimal places for calculation
  decimalPlaces: {
    type: Number,
    default: 2,
    min: 0,
    max: 4
  }
}, { _id: true });

const taxExemptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  // Exemption conditions
  conditions: {
    // Customer type exemptions
    customerTypes: [{
      type: String,
      enum: ['individual', 'corporate', 'government', 'diplomatic', 'senior_citizen', 'student']
    }],
    // Product category exemptions
    productCategories: [String],
    // Time-based exemptions
    validFrom: Date,
    validTo: Date,
    // Amount-based exemptions
    minAmount: Number,
    maxAmount: Number,
    // Location-based exemptions
    applicableOutlets: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSOutlet'
    }]
  },
  // Exemption percentage (0-100)
  exemptionPercentage: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  // Documentation required
  requiresDocumentation: {
    type: Boolean,
    default: false
  },
  // Approval required
  requiresApproval: {
    type: Boolean,
    default: false
  }
}, { _id: true });

const posTaxSchema = new mongoose.Schema({
  // Standard fields
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  outletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POSOutlet',
    required: false, // Global taxes don't need outlet
    index: true
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

  // Tax identification
  taxId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: String,

  // Tax classification
  taxType: {
    type: String,
    enum: [
      'VAT',           // Value Added Tax
      'GST',           // Goods and Services Tax
      'SERVICE_TAX',   // Service Tax
      'LOCAL_TAX',     // Local/City Tax
      'LUXURY_TAX',    // Luxury Tax
      'ENTERTAINMENT_TAX', // Entertainment Tax
      'CUSTOM'         // Custom Tax
    ],
    required: true,
    index: true
  },

  // Tax group for categorization
  taxGroup: {
    type: String,
    enum: [
      'FOOD',          // Food items
      'BEVERAGE',      // Beverages
      'SERVICE',       // Services
      'PRODUCT',       // Retail products
      'ALCOHOL',       // Alcoholic beverages
      'TOBACCO',       // Tobacco products
      'LUXURY',        // Luxury items
      'GENERAL'        // General items
    ],
    required: true,
    index: true
  },

  // Tax rules and calculations
  rules: [taxRuleSchema],

  // Tax exemptions
  exemptions: [taxExemptionSchema],

  // Tax status and validity
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
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

  // Tax reporting and compliance
  reportingCode: {
    type: String,
    trim: true,
    uppercase: true
  },
  glAccountCode: {
    type: String,
    trim: true,
    uppercase: true
  },
  complianceTags: [String],

  // Tax calculation preferences
  calculationOrder: {
    type: Number,
    default: 1,
    min: 1
  },
  isCompound: {
    type: Boolean,
    default: false
  },
  isInclusive: {
    type: Boolean,
    default: false // false = tax added to price, true = tax included in price
  },

  // Display and formatting
  displayFormat: {
    showOnReceipt: {
      type: Boolean,
      default: true
    },
    showInBreakdown: {
      type: Boolean,
      default: true
    },
    receiptLabel: String,
    breakdownLabel: String
  },

  // Audit and tracking
  lastCalculated: Date,
  calculationCount: {
    type: Number,
    default: 0
  },
  totalCollected: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
posTaxSchema.index({ hotelId: 1, taxType: 1, isActive: 1 });
posTaxSchema.index({ hotelId: 1, taxGroup: 1, isActive: 1 });
posTaxSchema.index({ hotelId: 1, outletId: 1, isActive: 1 });
posTaxSchema.index({ validFrom: 1, validTo: 1 });

// Virtual for current validity
posTaxSchema.virtual('isCurrentlyValid').get(function() {
  const now = new Date();
  return this.isActive && 
         this.validFrom <= now && 
         (!this.validTo || this.validTo >= now);
});

// Virtual for effective tax rate (for simple percentage taxes)
posTaxSchema.virtual('effectiveRate').get(function() {
  if (this.rules.length === 1 && this.rules[0].type === 'percentage') {
    return this.rules[0].value;
  }
  return null;
});

// Pre-save middleware to generate taxId if not provided
posTaxSchema.pre('save', async function(next) {
  if (!this.taxId) {
    const prefix = this.taxType.substring(0, 3).toUpperCase();
    const count = await this.constructor.countDocuments({
      taxId: new RegExp(`^${prefix}`)
    });
    this.taxId = `${prefix}${(count + 1).toString().padStart(3, '0')}`;
  }
  next();
});

// Static method to get active taxes for a hotel/outlet
posTaxSchema.statics.getActiveTaxes = function(hotelId, outletId = null, taxGroup = null) {
  const query = {
    hotelId,
    isActive: true,
    validFrom: { $lte: new Date() },
    $or: [
      { validTo: { $exists: false } },
      { validTo: null },
      { validTo: { $gte: new Date() } }
    ]
  };

  if (outletId) {
    query.$or = [
      { outletId: null }, // Global taxes
      { outletId }
    ];
  }

  if (taxGroup) {
    query.taxGroup = taxGroup;
  }

  return this.find(query).sort({ calculationOrder: 1, taxType: 1 });
};

// Static method to calculate tax for an amount
posTaxSchema.statics.calculateTax = function(taxes, amount, options = {}) {
  const {
    customerType = 'individual',
    productCategory = null,
    outletId = null,
    applyExemptions = true
  } = options;

  let totalTax = 0;
  const taxBreakdown = [];

  for (const tax of taxes) {
    let taxAmount = 0;
    let exemptionApplied = false;

    // Check for exemptions
    if (applyExemptions && tax.exemptions.length > 0) {
      for (const exemption of tax.exemptions) {
        if (this.isExemptionApplicable(exemption, {
          customerType,
          productCategory,
          outletId,
          amount
        })) {
          exemptionApplied = true;
          break;
        }
      }
    }

    if (!exemptionApplied) {
      // Calculate tax based on rules
      for (const rule of tax.rules) {
        let ruleAmount = 0;

        switch (rule.type) {
          case 'percentage':
            ruleAmount = (amount * rule.value) / 100;
            break;
          case 'fixed_amount':
            ruleAmount = rule.value;
            break;
          case 'compound':
            // Tax on previous taxes
            const baseAmount = amount + totalTax;
            ruleAmount = (baseAmount * rule.value) / 100;
            break;
        }

        // Apply thresholds
        if (rule.minThreshold && amount < rule.minThreshold) {
          ruleAmount = 0;
        }
        if (rule.maxThreshold && amount > rule.maxThreshold) {
          ruleAmount = (rule.maxThreshold * rule.value) / 100;
        }

        // Apply rounding
        ruleAmount = this.applyRounding(ruleAmount, rule.rounding, rule.decimalPlaces);

        taxAmount += ruleAmount;
      }
    }

    totalTax += taxAmount;
    taxBreakdown.push({
      taxId: tax._id,
      taxName: tax.name,
      taxType: tax.taxType,
      taxGroup: tax.taxGroup,
      amount: taxAmount,
      rate: tax.effectiveRate,
      exemptionApplied
    });
  }

  return {
    totalTax: this.applyRounding(totalTax, 'round', 2),
    taxBreakdown
  };
};

// Helper method to check exemption applicability
posTaxSchema.statics.isExemptionApplicable = function(exemption, context) {
  const { customerType, productCategory, outletId, amount } = context;

  // Check customer type
  if (exemption.conditions.customerTypes.length > 0) {
    if (!exemption.conditions.customerTypes.includes(customerType)) {
      return false;
    }
  }

  // Check product category
  if (exemption.conditions.productCategories.length > 0) {
    if (!productCategory || !exemption.conditions.productCategories.includes(productCategory)) {
      return false;
    }
  }

  // Check amount thresholds
  if (exemption.conditions.minAmount && amount < exemption.conditions.minAmount) {
    return false;
  }
  if (exemption.conditions.maxAmount && amount > exemption.conditions.maxAmount) {
    return false;
  }

  // Check outlet applicability
  if (exemption.conditions.applicableOutlets.length > 0) {
    if (!outletId || !exemption.conditions.applicableOutlets.includes(outletId)) {
      return false;
    }
  }

  // Check time validity
  const now = new Date();
  if (exemption.conditions.validFrom && exemption.conditions.validFrom > now) {
    return false;
  }
  if (exemption.conditions.validTo && exemption.conditions.validTo < now) {
    return false;
  }

  return true;
};

// Helper method to apply rounding
posTaxSchema.statics.applyRounding = function(amount, rounding, decimalPlaces) {
  const factor = Math.pow(10, decimalPlaces);
  
  switch (rounding) {
    case 'round':
      return Math.round(amount * factor) / factor;
    case 'floor':
      return Math.floor(amount * factor) / factor;
    case 'ceil':
      return Math.ceil(amount * factor) / factor;
    case 'none':
    default:
      return amount;
  }
};

// Instance method to update calculation statistics
posTaxSchema.methods.updateCalculationStats = function(amount) {
  this.lastCalculated = new Date();
  this.calculationCount += 1;
  this.totalCollected += amount;
  return this.save();
};

export default mongoose.model('POSTax', posTaxSchema);
