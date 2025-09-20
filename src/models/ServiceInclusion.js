import mongoose from 'mongoose';

const serviceInclusionSchema = new mongoose.Schema({
  inclusionId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: [
      'service', 'amenity', 'meal', 'activity', 'transport', 
      'access', 'discount', 'upgrade', 'credit', 'other'
    ],
    required: true
  },
  category: {
    type: String,
    enum: [
      'room_amenities', 'dining', 'spa_wellness', 'fitness', 'entertainment',
      'business_services', 'transportation', 'childcare', 'pet_services',
      'concierge', 'tours_excursions', 'shopping', 'medical', 'technology'
    ],
    required: true
  },
  value: {
    // Monetary value of the inclusion
    basePrice: {
      type: Number,
      default: 0,
      min: 0
    },
    baseCurrency: {
      type: String,
      uppercase: true,
      default: 'USD'
    },
    currencyValues: [{
      currency: {
        type: String,
        required: true,
        uppercase: true
      },
      value: {
        type: Number,
        required: true,
        min: 0
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    }],
    // Non-monetary value indicators
    isComplimentary: {
      type: Boolean,
      default: true
    },
    retailValue: {
      type: Number,
      min: 0
    },
    savingsAmount: {
      type: Number,
      min: 0
    }
  },
  quantity: {
    type: {
      type: String,
      enum: ['unlimited', 'limited', 'per_person', 'per_room', 'per_night', 'one_time'],
      default: 'unlimited'
    },
    amount: {
      type: Number,
      min: 1,
      default: 1
    },
    unit: {
      type: String,
      trim: true
    }
  },
  eligibility: {
    roomTypes: [{
      type: String,
      enum: ['single', 'double', 'suite', 'deluxe', 'all'],
      default: 'all'
    }],
    ratePlans: [String],
    packageTypes: [String],
    membershipLevels: [{
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'all'],
      default: 'all'
    }],
    minimumStay: {
      type: Number,
      min: 1,
      default: 1
    },
    maximumStay: {
      type: Number,
      min: 1
    },
    advanceBookingRequired: {
      type: Number,
      default: 0,
      min: 0
    },
    ageRestrictions: {
      minAge: {
        type: Number,
        min: 0
      },
      maxAge: {
        type: Number,
        min: 0
      }
    },
    guestCountRestrictions: {
      minGuests: {
        type: Number,
        min: 1,
        default: 1
      },
      maxGuests: {
        type: Number,
        min: 1
      }
    }
  },
  availability: {
    isActive: {
      type: Boolean,
      default: true
    },
    validFrom: Date,
    validUntil: Date,
    blackoutDates: [Date],
    availableDays: {
      monday: { type: Boolean, default: true },
      tuesday: { type: Boolean, default: true },
      wednesday: { type: Boolean, default: true },
      thursday: { type: Boolean, default: true },
      friday: { type: Boolean, default: true },
      saturday: { type: Boolean, default: true },
      sunday: { type: Boolean, default: true }
    },
    timeRestrictions: {
      startTime: {
        type: String,
        match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      },
      endTime: {
        type: String,
        match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      }
    },
    capacityLimits: {
      dailyLimit: {
        type: Number,
        min: 1
      },
      currentUsage: {
        type: Number,
        default: 0
      },
      lastResetDate: {
        type: Date,
        default: Date.now
      }
    }
  },
  fulfillment: {
    deliveryMethod: {
      type: String,
      enum: ['automatic', 'manual', 'voucher', 'reservation_required', 'pickup'],
      default: 'automatic'
    },
    location: {
      venue: String,
      address: String,
      floor: String,
      roomNumber: String,
      specialInstructions: String
    },
    contactInfo: {
      department: String,
      phone: String,
      email: String,
      hours: String
    },
    leadTime: {
      type: Number,
      default: 0,
      min: 0
    },
    instructions: String,
    requirements: [String],
    voucher: {
      template: String,
      validityPeriod: {
        type: Number,
        default: 365
      },
      transferable: {
        type: Boolean,
        default: false
      }
    }
  },
  bundling: {
    canBeStandalone: {
      type: Boolean,
      default: true
    },
    requiredWithServices: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AddOnService'
    }],
    compatibleServices: [{
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AddOnService'
      },
      priority: {
        type: Number,
        default: 0
      }
    }],
    exclusiveWith: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceInclusion'
    }],
    bundleDiscounts: [{
      withServices: [String],
      discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true
      },
      discountValue: {
        type: Number,
        required: true,
        min: 0
      }
    }]
  },
  tracking: {
    redemptionTracking: {
      type: Boolean,
      default: false
    },
    totalRedemptions: {
      type: Number,
      default: 0
    },
    lastRedemptionDate: Date,
    averageRedemptionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    guestSatisfactionScore: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    feedbackCount: {
      type: Number,
      default: 0
    }
  },
  marketing: {
    displayName: String,
    marketingDescription: String,
    highlights: [String],
    images: [String],
    icons: [String],
    badgeText: String,
    isPromotional: {
      type: Boolean,
      default: false
    },
    promotionalText: String,
    displayPriority: {
      type: Number,
      default: 0
    },
    showInPackageDescription: {
      type: Boolean,
      default: true
    },
    showValue: {
      type: Boolean,
      default: true
    }
  },
  costs: {
    costToHotel: {
      type: Number,
      default: 0,
      min: 0
    },
    supplierCost: {
      type: Number,
      default: 0,
      min: 0
    },
    staffTimeCost: {
      type: Number,
      default: 0,
      min: 0
    },
    profitMargin: {
      type: Number,
      default: 0
    }
  },
  compliance: {
    taxImplications: String,
    licenseRequired: {
      type: Boolean,
      default: false
    },
    insuranceCovered: {
      type: Boolean,
      default: true
    },
    healthSafetyNotes: [String],
    legalDisclaimer: String
  },
  tags: [String],
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Virtuals
serviceInclusionSchema.virtual('isCurrentlyAvailable').get(function() {
  if (!this.availability.isActive) return false;
  
  const now = new Date();
  
  // Check validity period
  if (this.availability.validFrom && now < this.availability.validFrom) return false;
  if (this.availability.validUntil && now > this.availability.validUntil) return false;
  
  // Check blackout dates
  const today = now.toISOString().split('T')[0];
  if (this.availability.blackoutDates.some(date => date.toISOString().split('T')[0] === today)) {
    return false;
  }
  
  // Check day of week
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  if (!this.availability.availableDays[dayOfWeek]) return false;
  
  // Check time restrictions
  if (this.availability.timeRestrictions.startTime && this.availability.timeRestrictions.endTime) {
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (currentTime < this.availability.timeRestrictions.startTime || 
        currentTime > this.availability.timeRestrictions.endTime) {
      return false;
    }
  }
  
  // Check capacity
  if (this.availability.capacityLimits.dailyLimit) {
    const lastReset = new Date(this.availability.capacityLimits.lastResetDate);
    if (lastReset.toDateString() !== now.toDateString()) {
      // Reset daily usage if it's a new day
      this.availability.capacityLimits.currentUsage = 0;
      this.availability.capacityLimits.lastResetDate = now;
    }
    
    if (this.availability.capacityLimits.currentUsage >= this.availability.capacityLimits.dailyLimit) {
      return false;
    }
  }
  
  return true;
});

serviceInclusionSchema.virtual('totalValue').get(function() {
  return this.value.basePrice + (this.value.savingsAmount || 0);
});

serviceInclusionSchema.virtual('utilizationRate').get(function() {
  if (this.tracking.totalRedemptions === 0) return 0;
  // This would be calculated based on total packages sold vs redemptions
  return this.tracking.averageRedemptionRate;
});

serviceInclusionSchema.virtual('profitability').get(function() {
  const totalCost = this.costs.costToHotel + this.costs.supplierCost + this.costs.staffTimeCost;
  if (totalCost === 0) return 100;
  return ((this.value.basePrice - totalCost) / this.value.basePrice) * 100;
});

// Indexes
// Note: inclusionId already has unique: true, no need for separate index
serviceInclusionSchema.index({ type: 1, category: 1 });
serviceInclusionSchema.index({ 'availability.isActive': 1 });
serviceInclusionSchema.index({ 'eligibility.roomTypes': 1 });
serviceInclusionSchema.index({ 'marketing.displayPriority': -1 });
serviceInclusionSchema.index({ tags: 1 });
serviceInclusionSchema.index({ 'tracking.guestSatisfactionScore': -1 });

// Instance methods
serviceInclusionSchema.methods.checkEligibility = function(bookingContext = {}) {
  const { roomType, ratePlan, packageType, membershipLevel, lengthOfStay, guestCount, guestAges } = bookingContext;
  
  // Check room types
  if (this.eligibility.roomTypes.length > 0 && 
      !this.eligibility.roomTypes.includes('all') && 
      !this.eligibility.roomTypes.includes(roomType)) {
    return { eligible: false, reason: 'Room type not eligible' };
  }
  
  // Check rate plans
  if (this.eligibility.ratePlans.length > 0 && ratePlan && 
      !this.eligibility.ratePlans.includes(ratePlan)) {
    return { eligible: false, reason: 'Rate plan not eligible' };
  }
  
  // Check package types
  if (this.eligibility.packageTypes.length > 0 && packageType && 
      !this.eligibility.packageTypes.includes(packageType)) {
    return { eligible: false, reason: 'Package type not eligible' };
  }
  
  // Check membership levels
  if (this.eligibility.membershipLevels.length > 0 && 
      !this.eligibility.membershipLevels.includes('all') && 
      !this.eligibility.membershipLevels.includes(membershipLevel)) {
    return { eligible: false, reason: 'Membership level not eligible' };
  }
  
  // Check minimum stay
  if (lengthOfStay && lengthOfStay < this.eligibility.minimumStay) {
    return { eligible: false, reason: `Minimum ${this.eligibility.minimumStay} nights required` };
  }
  
  // Check maximum stay
  if (this.eligibility.maximumStay && lengthOfStay && lengthOfStay > this.eligibility.maximumStay) {
    return { eligible: false, reason: `Maximum ${this.eligibility.maximumStay} nights allowed` };
  }
  
  // Check guest count restrictions
  if (guestCount) {
    if (guestCount < this.eligibility.guestCountRestrictions.minGuests) {
      return { eligible: false, reason: `Minimum ${this.eligibility.guestCountRestrictions.minGuests} guests required` };
    }
    
    if (this.eligibility.guestCountRestrictions.maxGuests && 
        guestCount > this.eligibility.guestCountRestrictions.maxGuests) {
      return { eligible: false, reason: `Maximum ${this.eligibility.guestCountRestrictions.maxGuests} guests allowed` };
    }
  }
  
  // Check age restrictions
  if (guestAges && guestAges.length > 0) {
    const hasEligibleGuest = guestAges.some(age => {
      const meetsMinAge = !this.eligibility.ageRestrictions.minAge || age >= this.eligibility.ageRestrictions.minAge;
      const meetsMaxAge = !this.eligibility.ageRestrictions.maxAge || age <= this.eligibility.ageRestrictions.maxAge;
      return meetsMinAge && meetsMaxAge;
    });
    
    if (!hasEligibleGuest) {
      return { eligible: false, reason: 'Age restrictions not met' };
    }
  }
  
  return { eligible: true };
};

serviceInclusionSchema.methods.calculateQuantity = function(bookingContext = {}) {
  const { guestCount = 1, nights = 1 } = bookingContext;
  
  switch (this.quantity.type) {
    case 'per_person':
      return this.quantity.amount * guestCount;
    case 'per_room':
      return this.quantity.amount;
    case 'per_night':
      return this.quantity.amount * nights;
    case 'one_time':
      return this.quantity.amount;
    case 'unlimited':
      return 'unlimited';
    case 'limited':
      return this.quantity.amount;
    default:
      return this.quantity.amount;
  }
};

serviceInclusionSchema.methods.processRedemption = function(redemptionContext = {}) {
  if (this.tracking.redemptionTracking) {
    this.tracking.totalRedemptions += 1;
    this.tracking.lastRedemptionDate = new Date();
    
    // Update capacity usage
    if (this.availability.capacityLimits.dailyLimit) {
      this.availability.capacityLimits.currentUsage += 1;
    }
    
    // Update redemption rate
    // This would be calculated based on total packages sold
    // For now, we'll just track the increment
    
    return {
      success: true,
      redemptionId: `${this.inclusionId}_${Date.now()}`,
      timestamp: new Date(),
      remainingCapacity: this.availability.capacityLimits.dailyLimit ? 
        (this.availability.capacityLimits.dailyLimit - this.availability.capacityLimits.currentUsage) : 
        'unlimited'
    };
  }
  
  return { success: false, reason: 'Redemption tracking not enabled' };
};

serviceInclusionSchema.methods.generateVoucher = function(guestInfo = {}) {
  if (this.fulfillment.deliveryMethod === 'voucher' && this.fulfillment.voucher.template) {
    const voucherId = `${this.inclusionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + this.fulfillment.voucher.validityPeriod);
    
    return {
      voucherId,
      inclusionName: this.name,
      description: this.description,
      instructions: this.fulfillment.instructions,
      validUntil,
      transferable: this.fulfillment.voucher.transferable,
      guestInfo,
      location: this.fulfillment.location,
      contactInfo: this.fulfillment.contactInfo,
      template: this.fulfillment.voucher.template
    };
  }
  
  return null;
};

serviceInclusionSchema.pre('save', function(next) {
  if (!this.inclusionId) {
    this.inclusionId = `incl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

export default mongoose.models.ServiceInclusion || mongoose.model('ServiceInclusion', serviceInclusionSchema);