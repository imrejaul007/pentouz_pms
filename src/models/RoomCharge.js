import mongoose from 'mongoose';

const roomChargeSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  chargeName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  chargeCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxLength: 20,
    validate: {
      validator: function(value) {
        return /^[A-Z0-9_-]+$/.test(value);
      },
      message: 'Charge code must contain only letters, numbers, underscores, and hyphens'
    }
  },
  chargeType: {
    type: String,
    required: true,
    enum: [
      'service_fee',        // General service fees
      'resort_fee',         // Resort or facility fees
      'cleaning_fee',       // Room cleaning charges
      'damage_fee',         // Damage or incidental charges
      'utility_fee',        // Utility surcharges
      'parking_fee',        // Parking charges
      'wifi_fee',          // Internet access fees
      'minibar_fee',       // Minibar consumption
      'laundry_fee',       // Laundry services
      'spa_fee',           // Spa and wellness charges
      'gym_fee',           // Fitness facility access
      'pet_fee',           // Pet accommodation fees
      'early_checkin_fee', // Early check-in charges
      'late_checkout_fee', // Late check-out charges
      'amenity_fee',       // Premium amenity access
      'cancellation_fee',  // Cancellation penalties
      'noshow_fee',        // No-show penalties
      'upgrade_fee',       // Room upgrade charges
      'package_fee',       // Service package charges
      'custom_fee'         // Custom charges
    ]
  },
  chargeCategory: {
    type: String,
    required: true,
    enum: [
      'mandatory',         // Mandatory charges (automatically applied)
      'optional',          // Optional charges (guest choice)
      'conditional',       // Applied based on conditions
      'penalty',           // Penalty or fine charges
      'service',           // Service-based charges
      'amenity',           // Amenity access charges
      'utility'            // Utility-based charges
    ]
  },
  chargeAmount: {
    type: Number,
    required: true,
    min: 0
  },
  isPercentage: {
    type: Boolean,
    default: false
  },
  percentageBase: {
    type: String,
    enum: ['room_rate', 'total_amount', 'subtotal'],
    default: 'room_rate' // What the percentage is calculated on
  },
  calculationMethod: {
    type: String,
    required: true,
    enum: ['per_stay', 'per_night', 'per_guest', 'per_room', 'percentage'],
    default: 'per_stay'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isSystemGenerated: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    default: 0,
    min: 0 // Higher priority charges are calculated first
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
  conditions: {
    minimumStayNights: {
      type: Number,
      min: 0
    },
    maximumStayNights: {
      type: Number,
      min: 0
    },
    minimumRoomRate: {
      type: Number,
      min: 0
    },
    maximumRoomRate: {
      type: Number,
      min: 0
    },
    guestCountMin: {
      type: Number,
      min: 1
    },
    guestCountMax: {
      type: Number,
      min: 1
    },
    seasonalConditions: [{
      name: String,
      startDate: Date,
      endDate: Date,
      multiplier: {
        type: Number,
        default: 1,
        min: 0
      }
    }],
    weekdayOnly: {
      type: Boolean,
      default: false
    },
    weekendOnly: {
      type: Boolean,
      default: false
    },
    applicableWeekdays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }]
  },
  exemptions: {
    exemptGuestTypes: [{
      type: String,
      enum: ['VIP', 'corporate', 'government', 'senior_citizen', 'military', 'employee']
    }],
    exemptMembershipLevels: [{
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond']
    }],
    exemptCountries: [String],
    exemptBookingChannels: [{
      type: String,
      enum: ['direct', 'booking_com', 'expedia', 'airbnb', 'agoda']
    }]
  },
  taxConfiguration: {
    isTaxable: {
      type: Boolean,
      default: true
    },
    taxCategory: {
      type: String,
      enum: ['standard', 'service', 'luxury', 'utility', 'exempt'],
      default: 'standard'
    },
    applicableTaxes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomTax'
    }],
    taxExemptionReason: {
      type: String,
      maxLength: 200
    }
  },
  displaySettings: {
    displayName: {
      type: String,
      maxLength: 100
    },
    description: {
      type: String,
      maxLength: 500
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: 0
    },
    showOnBookingSummary: {
      type: Boolean,
      default: true
    },
    showOnInvoice: {
      type: Boolean,
      default: true
    },
    groupWithCategory: {
      type: String,
      enum: ['fees', 'services', 'amenities', 'penalties', 'other'],
      default: 'fees'
    }
  },
  automationRules: {
    autoApply: {
      type: Boolean,
      default: false
    },
    applyConditions: [{
      field: String,        // e.g., 'room_rate', 'guest_count', 'stay_nights'
      operator: {
        type: String,
        enum: ['gt', 'lt', 'gte', 'lte', 'eq', 'ne', 'in', 'nin']
      },
      value: mongoose.Schema.Types.Mixed
    }],
    requireApproval: {
      type: Boolean,
      default: false
    },
    approvalThreshold: {
      type: Number,
      min: 0
    }
  },
  integrationSettings: {
    revenueAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RevenueAccount'
    },
    pmsCode: {
      type: String,
      maxLength: 20
    },
    accountingCode: {
      type: String,
      maxLength: 20
    },
    reportingCategory: {
      type: String,
      enum: ['room_revenue', 'service_revenue', 'other_revenue', 'fees', 'penalties'],
      default: 'service_revenue'
    }
  },
  auditInfo: {
    totalCharges: {
      type: Number,
      default: 0,
      min: 0
    },
    applicationCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastAppliedDate: {
      type: Date
    },
    averageChargeAmount: {
      type: Number,
      default: 0,
      min: 0
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
roomChargeSchema.index({ hotelId: 1, chargeCode: 1 }, { unique: true });
roomChargeSchema.index({ hotelId: 1, isActive: 1 });
roomChargeSchema.index({ hotelId: 1, chargeType: 1 });
roomChargeSchema.index({ hotelId: 1, chargeCategory: 1 });
roomChargeSchema.index({ hotelId: 1, validFrom: 1, validTo: 1 });
roomChargeSchema.index({ hotelId: 1, priority: -1 });

// Compound index for charge calculation queries
roomChargeSchema.index({ 
  hotelId: 1, 
  isActive: 1, 
  chargeCategory: 1,
  validFrom: 1,
  priority: -1
});

// Virtual for display name
roomChargeSchema.virtual('effectiveDisplayName').get(function() {
  return this.displaySettings.displayName || this.chargeName;
});

// Virtual for charge description
roomChargeSchema.virtual('effectiveDescription').get(function() {
  return this.displaySettings.description || `${this.chargeName} - ${this.chargeType.replace('_', ' ')}`;
});

// Method to check if charge is applicable for given criteria
roomChargeSchema.methods.isApplicable = function(criteria) {
  const now = new Date();
  const checkInDate = criteria.checkInDate ? new Date(criteria.checkInDate) : now;
  
  // Check if charge is active and within valid date range
  if (!this.isActive) return false;
  if (this.validFrom > checkInDate) return false;
  if (this.validTo && this.validTo < checkInDate) return false;
  
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
  
  // Check conditions
  if (this.conditions) {
    // Stay duration conditions
    if (criteria.stayNights) {
      if (this.conditions.minimumStayNights && criteria.stayNights < this.conditions.minimumStayNights) {
        return false;
      }
      if (this.conditions.maximumStayNights && criteria.stayNights > this.conditions.maximumStayNights) {
        return false;
      }
    }
    
    // Room rate conditions
    if (criteria.roomRate) {
      if (this.conditions.minimumRoomRate && criteria.roomRate < this.conditions.minimumRoomRate) {
        return false;
      }
      if (this.conditions.maximumRoomRate && criteria.roomRate > this.conditions.maximumRoomRate) {
        return false;
      }
    }
    
    // Guest count conditions
    if (criteria.guestCount) {
      if (this.conditions.guestCountMin && criteria.guestCount < this.conditions.guestCountMin) {
        return false;
      }
      if (this.conditions.guestCountMax && criteria.guestCount > this.conditions.guestCountMax) {
        return false;
      }
    }
    
    // Weekday conditions
    if (this.conditions.weekdayOnly || this.conditions.weekendOnly || this.conditions.applicableWeekdays.length > 0) {
      const dayOfWeek = checkInDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const weekdays = [1, 2, 3, 4, 5]; // Monday to Friday
      const weekends = [0, 6]; // Saturday and Sunday
      
      if (this.conditions.weekdayOnly && !weekdays.includes(dayOfWeek)) {
        return false;
      }
      if (this.conditions.weekendOnly && !weekends.includes(dayOfWeek)) {
        return false;
      }
      if (this.conditions.applicableWeekdays.length > 0) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        if (!this.conditions.applicableWeekdays.includes(dayNames[dayOfWeek])) {
          return false;
        }
      }
    }
  }
  
  // Check exemptions
  if (this.exemptions) {
    if (criteria.guestType && this.exemptions.exemptGuestTypes.includes(criteria.guestType)) {
      return false;
    }
    if (criteria.membershipLevel && this.exemptions.exemptMembershipLevels.includes(criteria.membershipLevel)) {
      return false;
    }
    if (criteria.guestCountry && this.exemptions.exemptCountries.includes(criteria.guestCountry)) {
      return false;
    }
    if (criteria.channel && this.exemptions.exemptBookingChannels.includes(criteria.channel)) {
      return false;
    }
  }
  
  return true;
};

// Method to calculate charge amount
roomChargeSchema.methods.calculateCharge = function(baseAmount, criteria = {}) {
  if (!this.isApplicable(criteria)) {
    return 0;
  }
  
  let chargeAmount = 0;
  
  if (this.isPercentage) {
    // Calculate percentage-based charge
    let percentageBase = baseAmount;
    
    switch (this.percentageBase) {
      case 'room_rate':
        percentageBase = criteria.roomRate || baseAmount;
        break;
      case 'total_amount':
        percentageBase = criteria.totalAmount || baseAmount;
        break;
      case 'subtotal':
        percentageBase = criteria.subtotal || baseAmount;
        break;
      default:
        percentageBase = baseAmount;
    }
    
    chargeAmount = (percentageBase * this.chargeAmount) / 100;
  } else {
    // Fixed amount charge
    switch (this.calculationMethod) {
      case 'per_stay':
        chargeAmount = this.chargeAmount;
        break;
      case 'per_night':
        chargeAmount = this.chargeAmount * (criteria.stayNights || 1);
        break;
      case 'per_guest':
        chargeAmount = this.chargeAmount * (criteria.guestCount || 1);
        break;
      case 'per_room':
        chargeAmount = this.chargeAmount * (criteria.roomCount || 1);
        break;
      default:
        chargeAmount = this.chargeAmount;
    }
  }
  
  // Apply seasonal multipliers
  if (this.conditions && this.conditions.seasonalConditions.length > 0) {
    const checkInDate = criteria.checkInDate ? new Date(criteria.checkInDate) : new Date();
    
    for (const season of this.conditions.seasonalConditions) {
      if (checkInDate >= season.startDate && checkInDate <= season.endDate) {
        chargeAmount *= season.multiplier;
        break;
      }
    }
  }
  
  return Math.round(chargeAmount * 100) / 100;
};

// Static method to get applicable charges
roomChargeSchema.statics.getApplicableCharges = async function(hotelId, criteria = {}) {
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
  if (criteria.chargeCategory) {
    query.chargeCategory = criteria.chargeCategory;
  }
  
  // Add type filter if specified
  if (criteria.chargeType) {
    query.chargeType = criteria.chargeType;
  }
  
  const charges = await this.find(query)
    .populate('applicableRoomTypes', 'name code')
    .populate('taxConfiguration.applicableTaxes', 'taxName taxType taxRate')
    .populate('integrationSettings.revenueAccountId', 'accountCode accountName')
    .sort({ priority: -1, chargeCategory: 1, chargeName: 1 });
  
  return charges.filter(charge => charge.isApplicable(criteria));
};

// Static method to get charge summary
roomChargeSchema.statics.getChargeSummary = async function(hotelId, filters = {}) {
  const matchQuery = { hotelId };
  
  if (filters.startDate || filters.endDate) {
    matchQuery.createdAt = {};
    if (filters.startDate) matchQuery.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) matchQuery.createdAt.$lte = new Date(filters.endDate);
  }
  
  if (filters.chargeType) matchQuery.chargeType = filters.chargeType;
  if (filters.chargeCategory) matchQuery.chargeCategory = filters.chargeCategory;
  
  const summary = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalCharges: { $sum: 1 },
        activeCharges: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        totalChargeAmount: { $sum: '$auditInfo.totalCharges' },
        totalApplications: { $sum: '$auditInfo.applicationCount' },
        chargesByType: {
          $push: {
            type: '$chargeType',
            amount: '$auditInfo.totalCharges',
            count: '$auditInfo.applicationCount'
          }
        },
        chargesByCategory: {
          $push: {
            category: '$chargeCategory',
            amount: '$auditInfo.totalCharges',
            count: '$auditInfo.applicationCount'
          }
        }
      }
    }
  ]);
  
  if (summary.length === 0) {
    return {
      totalCharges: 0,
      activeCharges: 0,
      totalChargeAmount: 0,
      totalApplications: 0,
      typeBreakdown: {},
      categoryBreakdown: {}
    };
  }
  
  const result = summary[0];
  
  // Process type breakdown
  const typeBreakdown = {};
  result.chargesByType.forEach(item => {
    if (!typeBreakdown[item.type]) {
      typeBreakdown[item.type] = { amount: 0, count: 0 };
    }
    typeBreakdown[item.type].amount += item.amount || 0;
    typeBreakdown[item.type].count += item.count || 0;
  });
  
  // Process category breakdown
  const categoryBreakdown = {};
  result.chargesByCategory.forEach(item => {
    if (!categoryBreakdown[item.category]) {
      categoryBreakdown[item.category] = { amount: 0, count: 0 };
    }
    categoryBreakdown[item.category].amount += item.amount || 0;
    categoryBreakdown[item.category].count += item.count || 0;
  });
  
  return {
    totalCharges: result.totalCharges,
    activeCharges: result.activeCharges,
    totalChargeAmount: result.totalChargeAmount || 0,
    totalApplications: result.totalApplications || 0,
    averageChargeAmount: result.totalApplications > 0 
      ? (result.totalChargeAmount || 0) / result.totalApplications 
      : 0,
    typeBreakdown,
    categoryBreakdown
  };
};

// Pre-save middleware for validation
roomChargeSchema.pre('save', function(next) {
  // Validate that percentage charges have valid percentage base
  if (this.isPercentage && !this.percentageBase) {
    this.percentageBase = 'room_rate';
  }
  
  // Validate that fixed amount charges have valid calculation method
  if (!this.isPercentage && this.calculationMethod === 'percentage') {
    return next(new Error('Fixed amount charges cannot use percentage calculation method'));
  }
  
  // Validate charge amount
  if (this.isPercentage && this.chargeAmount > 100) {
    return next(new Error('Percentage charge cannot exceed 100%'));
  }
  
  // Validate condition ranges
  if (this.conditions) {
    if (this.conditions.minimumStayNights && this.conditions.maximumStayNights) {
      if (this.conditions.minimumStayNights > this.conditions.maximumStayNights) {
        return next(new Error('Minimum stay nights cannot be greater than maximum stay nights'));
      }
    }
    
    if (this.conditions.minimumRoomRate && this.conditions.maximumRoomRate) {
      if (this.conditions.minimumRoomRate > this.conditions.maximumRoomRate) {
        return next(new Error('Minimum room rate cannot be greater than maximum room rate'));
      }
    }
    
    if (this.conditions.guestCountMin && this.conditions.guestCountMax) {
      if (this.conditions.guestCountMin > this.conditions.guestCountMax) {
        return next(new Error('Minimum guest count cannot be greater than maximum guest count'));
      }
    }
  }
  
  next();
});

// Post-save middleware for audit trail
roomChargeSchema.post('save', function() {
  console.log(`Room charge ${this.chargeCode} saved for hotel ${this.hotelId}`);
});

export default mongoose.model('RoomCharge', roomChargeSchema);
