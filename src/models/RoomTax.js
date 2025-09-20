import mongoose from 'mongoose';

const roomTaxSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  taxName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  taxType: {
    type: String,
    required: true,
    enum: [
      'VAT',           // Value Added Tax
      'GST',           // Goods and Services Tax
      'service_tax',   // Service Tax
      'luxury_tax',    // Luxury Tax
      'city_tax',      // City/Local Tax
      'tourism_tax',   // Tourism Tax
      'occupancy_tax', // Occupancy Tax
      'resort_fee',    // Resort Fee
      'facility_tax',  // Facility Tax
      'custom'         // Custom Tax
    ]
  },
  taxRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100 // For percentage taxes
  },
  isPercentage: {
    type: Boolean,
    default: true
  },
  fixedAmount: {
    type: Number,
    min: 0,
    default: 0 // For fixed amount taxes
  },
  taxCategory: {
    type: String,
    required: true,
    enum: [
      'room_charge',
      'service_charge',
      'additional_service',
      'government',
      'local_authority',
      'facility'
    ]
  },
  applicableRoomTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomType'
  }],
  applicableChannels: [{
    type: String,
    enum: ['direct', 'booking_com', 'expedia', 'airbnb', 'agoda', 'all']
  }],
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
  isCompoundTax: {
    type: Boolean,
    default: false // Tax calculated on top of other taxes
  },
  compoundOrder: {
    type: Number,
    default: 0 // Order for compound tax calculation
  },
  exemptionRules: {
    minimumStayNights: {
      type: Number,
      min: 0
    },
    maximumStayNights: {
      type: Number,
      min: 0
    },
    exemptGuestTypes: [{
      type: String,
      enum: ['VIP', 'corporate', 'government', 'senior_citizen', 'military']
    }],
    exemptCountries: [String],
    exemptSeasons: [{
      name: String,
      startDate: Date,
      endDate: Date
    }]
  },
  calculationMethod: {
    type: String,
    enum: ['per_room', 'per_guest', 'per_night', 'per_booking'],
    default: 'per_room'
  },
  roundingRule: {
    type: String,
    enum: ['round_up', 'round_down', 'round_nearest', 'no_rounding'],
    default: 'round_nearest'
  },
  description: {
    type: String,
    maxLength: 500
  },
  legalReference: {
    type: String,
    maxLength: 200 // Legal act or regulation reference
  },
  reportingCategory: {
    type: String,
    enum: ['revenue', 'tax_payable', 'service_charge', 'government_levy'],
    default: 'tax_payable'
  },
  accountingCode: {
    type: String,
    maxLength: 20 // For accounting system integration
  },
  isEditable: {
    type: Boolean,
    default: true // Some taxes might be system-defined and non-editable
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
roomTaxSchema.index({ hotelId: 1, isActive: 1 });
roomTaxSchema.index({ hotelId: 1, taxType: 1 });
roomTaxSchema.index({ hotelId: 1, validFrom: 1, validTo: 1 });
roomTaxSchema.index({ hotelId: 1, taxCategory: 1 });

// Compound index for tax calculation queries
roomTaxSchema.index({ 
  hotelId: 1, 
  isActive: 1, 
  validFrom: 1, 
  validTo: 1 
});

// Virtual for effective tax rate calculation
roomTaxSchema.virtual('effectiveRate').get(function() {
  if (this.isPercentage) {
    return this.taxRate;
  } else {
    // For fixed amount taxes, rate depends on base amount
    return this.fixedAmount;
  }
});

// Method to check if tax is applicable for given criteria
roomTaxSchema.methods.isApplicable = function(criteria) {
  const now = new Date();
  
  // Check if tax is active and within valid date range
  if (!this.isActive) return false;
  if (this.validFrom > now) return false;
  if (this.validTo && this.validTo < now) return false;
  
  // Check room type applicability
  if (this.applicableRoomTypes.length > 0 && criteria.roomTypeId) {
    if (!this.applicableRoomTypes.includes(criteria.roomTypeId)) return false;
  }
  
  // Check channel applicability
  if (this.applicableChannels.length > 0 && criteria.channel) {
    if (!this.applicableChannels.includes(criteria.channel) && 
        !this.applicableChannels.includes('all')) {
      return false;
    }
  }
  
  // Check exemption rules
  if (this.exemptionRules) {
    // Check stay duration exemptions
    if (criteria.stayNights) {
      if (this.exemptionRules.minimumStayNights && 
          criteria.stayNights < this.exemptionRules.minimumStayNights) {
        return false;
      }
      if (this.exemptionRules.maximumStayNights && 
          criteria.stayNights > this.exemptionRules.maximumStayNights) {
        return false;
      }
    }
    
    // Check guest type exemptions
    if (criteria.guestType && 
        this.exemptionRules.exemptGuestTypes.includes(criteria.guestType)) {
      return false;
    }
    
    // Check country exemptions
    if (criteria.guestCountry && 
        this.exemptionRules.exemptCountries.includes(criteria.guestCountry)) {
      return false;
    }
  }
  
  return true;
};

// Method to calculate tax amount
roomTaxSchema.methods.calculateTax = function(baseAmount, criteria = {}) {
  if (!this.isApplicable(criteria)) {
    return 0;
  }
  
  let taxAmount = 0;
  
  if (this.isPercentage) {
    taxAmount = (baseAmount * this.taxRate) / 100;
  } else {
    // Fixed amount tax
    switch (this.calculationMethod) {
      case 'per_room':
        taxAmount = this.fixedAmount * (criteria.roomCount || 1);
        break;
      case 'per_guest':
        taxAmount = this.fixedAmount * (criteria.guestCount || 1);
        break;
      case 'per_night':
        taxAmount = this.fixedAmount * (criteria.stayNights || 1);
        break;
      case 'per_booking':
        taxAmount = this.fixedAmount;
        break;
      default:
        taxAmount = this.fixedAmount;
    }
  }
  
  // Apply rounding rules
  switch (this.roundingRule) {
    case 'round_up':
      taxAmount = Math.ceil(taxAmount);
      break;
    case 'round_down':
      taxAmount = Math.floor(taxAmount);
      break;
    case 'round_nearest':
      taxAmount = Math.round(taxAmount);
      break;
    case 'no_rounding':
    default:
      taxAmount = Math.round(taxAmount * 100) / 100; // Round to 2 decimal places
      break;
  }
  
  return taxAmount;
};

// Static method to get applicable taxes for criteria
roomTaxSchema.statics.getApplicableTaxes = async function(hotelId, criteria = {}) {
  const query = {
    hotelId,
    isActive: true,
    validFrom: { $lte: new Date() },
    $or: [
      { validTo: { $exists: false } },
      { validTo: { $gte: new Date() } }
    ]
  };
  
  // Add room type filter if specified
  if (criteria.roomTypeId) {
    query.$or = [
      { applicableRoomTypes: { $size: 0 } }, // No specific room types (applies to all)
      { applicableRoomTypes: criteria.roomTypeId }
    ];
  }
  
  const taxes = await this.find(query).sort({ compoundOrder: 1, taxCategory: 1 });
  
  return taxes.filter(tax => tax.isApplicable(criteria));
};

// Pre-save middleware for validation
roomTaxSchema.pre('save', function(next) {
  // Validate that either percentage or fixed amount is set
  if (this.isPercentage && this.taxRate <= 0) {
    return next(new Error('Tax rate must be greater than 0 for percentage taxes'));
  }
  
  if (!this.isPercentage && this.fixedAmount <= 0) {
    return next(new Error('Fixed amount must be greater than 0 for fixed amount taxes'));
  }
  
  // Set compound order if not specified
  if (this.isCompoundTax && this.compoundOrder === 0) {
    this.compoundOrder = 1;
  }
  
  next();
});

// Export the model
export default mongoose.model('RoomTax', roomTaxSchema);
