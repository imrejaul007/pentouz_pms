import mongoose from 'mongoose';

const dayUseSlotSchema = new mongoose.Schema({
  slotId: {
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
  roomTypes: [{
    type: String,
    enum: ['single', 'double', 'suite', 'deluxe', 'all'],
    default: 'all'
  }],
  timeSlot: {
    startTime: {
      type: String,
      required: true,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    duration: {
      type: Number, // Duration in minutes
      required: true,
      min: 60, // Minimum 1 hour
      max: 720 // Maximum 12 hours
    }
  },
  pricing: {
    baseCurrency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'USD'
    },
    basePrice: {
      type: Number,
      required: true,
      min: 0
    },
    currencyPrices: [{
      currency: {
        type: String,
        required: true,
        uppercase: true
      },
      price: {
        type: Number,
        required: true,
        min: 0
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    }],
    pricingTiers: [{
      roomType: {
        type: String,
        enum: ['single', 'double', 'suite', 'deluxe']
      },
      price: {
        type: Number,
        required: true,
        min: 0
      },
      maxGuests: {
        type: Number,
        default: 2
      }
    }],
    additionalGuestFee: {
      type: Number,
      default: 0,
      min: 0
    },
    childDiscount: {
      enabled: {
        type: Boolean,
        default: false
      },
      ageLimit: {
        type: Number,
        default: 12
      },
      discountPercentage: {
        type: Number,
        default: 50,
        min: 0,
        max: 100
      }
    },
    dynamicPricing: {
      enabled: {
        type: Boolean,
        default: false
      },
      demandMultipliers: [{
        occupancyThreshold: {
          type: Number,
          min: 0,
          max: 100
        },
        multiplier: {
          type: Number,
          min: 0.5,
          max: 3.0
        }
      }],
      seasonalMultipliers: [{
        seasonId: String,
        multiplier: {
          type: Number,
          min: 0.5,
          max: 3.0
        }
      }]
    }
  },
  availability: {
    isActive: {
      type: Boolean,
      default: true
    },
    availableDays: {
      monday: { type: Boolean, default: true },
      tuesday: { type: Boolean, default: true },
      wednesday: { type: Boolean, default: true },
      thursday: { type: Boolean, default: true },
      friday: { type: Boolean, default: true },
      saturday: { type: Boolean, default: true },
      sunday: { type: Boolean, default: true }
    },
    validFrom: Date,
    validUntil: Date,
    blackoutDates: [Date],
    specialAvailability: [{
      date: {
        type: Date,
        required: true
      },
      isAvailable: {
        type: Boolean,
        required: true
      },
      reason: String,
      customPrice: Number
    }],
    maxRoomsPerSlot: {
      type: Number,
      default: 10,
      min: 1
    },
    advanceBookingDays: {
      min: {
        type: Number,
        default: 0
      },
      max: {
        type: Number,
        default: 30
      }
    },
    cancellationPolicy: {
      type: String,
      enum: ['flexible', 'moderate', 'strict', 'non_refundable'],
      default: 'flexible'
    },
    cancellationDeadlineHours: {
      type: Number,
      default: 24
    }
  },
  inclusions: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    value: Number,
    isHighlight: {
      type: Boolean,
      default: false
    }
  }],
  amenities: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    category: {
      type: String,
      enum: ['wellness', 'dining', 'business', 'entertainment', 'technology', 'other'],
      default: 'other'
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    additionalCost: {
      type: Number,
      default: 0
    }
  }],
  restrictions: {
    minGuests: {
      type: Number,
      default: 1,
      min: 1
    },
    maxGuests: {
      type: Number,
      default: 4
    },
    minAge: Number,
    maxAge: Number,
    requiresIdentification: {
      type: Boolean,
      default: true
    },
    allowsPets: {
      type: Boolean,
      default: false
    },
    smokingAllowed: {
      type: Boolean,
      default: false
    },
    specialRequirements: [String]
  },
  analytics: {
    totalBookings: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    reviewCount: {
      type: Number,
      default: 0
    },
    averageOccupancy: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    peakDemandDays: [{
      dayOfWeek: {
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      },
      demandScore: {
        type: Number,
        min: 0,
        max: 100
      }
    }],
    monthlyStats: [{
      month: {
        type: Number,
        min: 1,
        max: 12
      },
      year: Number,
      bookings: Number,
      revenue: Number,
      averagePrice: Number,
      occupancyRate: Number
    }]
  },
  operationalDetails: {
    checkInTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    checkOutTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    bufferTime: {
      before: {
        type: Number,
        default: 30 // Minutes
      },
      after: {
        type: Number,
        default: 30 // Minutes
      }
    },
    staffRequirements: [{
      department: String,
      role: String,
      count: Number,
      isRequired: {
        type: Boolean,
        default: true
      }
    }],
    preparationTime: {
      type: Number,
      default: 15 // Minutes
    },
    cleaningTime: {
      type: Number,
      default: 45 // Minutes
    }
  },
  marketing: {
    displayName: String,
    shortDescription: String,
    highlights: [String],
    images: [String],
    virtualTourUrl: String,
    promotionalOffer: {
      isActive: {
        type: Boolean,
        default: false
      },
      title: String,
      description: String,
      discountPercentage: Number,
      validUntil: Date
    },
    targetAudience: [{
      type: String,
      enum: ['business', 'leisure', 'local_residents', 'tourists', 'couples', 'families', 'groups']
    }],
    seasonalTags: [String]
  },
  integrations: {
    channelManager: {
      enabled: {
        type: Boolean,
        default: false
      },
      channels: [String]
    },
    pms: {
      roomBlockingEnabled: {
        type: Boolean,
        default: true
      },
      autoRoomAssignment: {
        type: Boolean,
        default: true
      }
    },
    pos: {
      chargeToRoom: {
        type: Boolean,
        default: true
      },
      discountCodes: [String]
    }
  },
  tags: [String],
  notes: String,
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
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
dayUseSlotSchema.virtual('durationHours').get(function() {
  return this.timeSlot.duration / 60;
});

dayUseSlotSchema.virtual('isCurrentlyActive').get(function() {
  if (!this.availability.isActive) return false;
  
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  
  // Check if today is available
  if (!this.availability.availableDays[dayOfWeek]) return false;
  
  // Check validity period
  if (this.availability.validFrom && now < this.availability.validFrom) return false;
  if (this.availability.validUntil && now > this.availability.validUntil) return false;
  
  // Check blackout dates
  const today = now.toISOString().split('T')[0];
  if (this.availability.blackoutDates.some(date => date.toISOString().split('T')[0] === today)) {
    return false;
  }
  
  // Check if current time falls within the slot
  return currentTime >= this.timeSlot.startTime && currentTime <= this.timeSlot.endTime;
});

dayUseSlotSchema.virtual('revenuePerHour').get(function() {
  if (this.analytics.totalBookings === 0 || this.timeSlot.duration === 0) return 0;
  return (this.analytics.totalRevenue / this.analytics.totalBookings) / this.durationHours;
});

dayUseSlotSchema.virtual('utilizationRate').get(function() {
  // This would be calculated based on actual booking data
  return this.analytics.averageOccupancy;
});

// Indexes
dayUseSlotSchema.index({ slotId: 1 });
dayUseSlotSchema.index({ 'timeSlot.startTime': 1, 'timeSlot.endTime': 1 });
dayUseSlotSchema.index({ roomTypes: 1, isActive: 1 });
dayUseSlotSchema.index({ 'availability.isActive': 1 });
dayUseSlotSchema.index({ 'analytics.averageRating': -1 });
dayUseSlotSchema.index({ 'analytics.totalRevenue': -1 });
dayUseSlotSchema.index({ displayOrder: 1 });
dayUseSlotSchema.index({ tags: 1 });

// Instance methods
dayUseSlotSchema.methods.calculatePrice = function(guestCount = 2, roomType = 'double', date = new Date(), currency = 'USD') {
  let basePrice = this.pricing.basePrice;
  
  // Get currency-specific price
  if (currency !== this.pricing.baseCurrency) {
    const currencyPrice = this.pricing.currencyPrices.find(cp => cp.currency === currency);
    if (currencyPrice) {
      basePrice = currencyPrice.price;
    }
  }
  
  // Apply room type specific pricing
  const tier = this.pricing.pricingTiers.find(t => t.roomType === roomType);
  if (tier) {
    basePrice = tier.price;
  }
  
  // Calculate additional guest fees
  const maxIncludedGuests = tier ? tier.maxGuests : 2;
  const additionalGuests = Math.max(0, guestCount - maxIncludedGuests);
  const additionalGuestFees = additionalGuests * this.pricing.additionalGuestFee;
  
  // Apply dynamic pricing if enabled
  if (this.pricing.dynamicPricing.enabled) {
    // This would integrate with occupancy data and seasonal pricing
    // For now, using a simple multiplier
    basePrice *= 1.0; // Placeholder for dynamic pricing logic
  }
  
  // Check for special availability pricing
  const dateString = date.toISOString().split('T')[0];
  const specialPrice = this.availability.specialAvailability.find(
    sa => sa.date.toISOString().split('T')[0] === dateString && sa.customPrice
  );
  
  if (specialPrice) {
    basePrice = specialPrice.customPrice;
  }
  
  const subtotal = basePrice + additionalGuestFees;
  
  return {
    basePrice,
    additionalGuestFees,
    subtotal,
    currency,
    breakdown: {
      roomType,
      guestCount,
      additionalGuests,
      pricePerAdditionalGuest: this.pricing.additionalGuestFee
    }
  };
};

dayUseSlotSchema.methods.checkAvailability = function(date, guestCount = 2, roomType = 'double') {
  const checkDate = new Date(date);
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][checkDate.getDay()];
  
  // Basic availability checks
  if (!this.availability.isActive) {
    return { available: false, reason: 'Slot is not active' };
  }
  
  if (!this.availability.availableDays[dayOfWeek]) {
    return { available: false, reason: 'Slot not available on this day of week' };
  }
  
  // Check validity period
  if (this.availability.validFrom && checkDate < this.availability.validFrom) {
    return { available: false, reason: 'Slot not yet available' };
  }
  
  if (this.availability.validUntil && checkDate > this.availability.validUntil) {
    return { available: false, reason: 'Slot no longer available' };
  }
  
  // Check blackout dates
  const dateString = checkDate.toISOString().split('T')[0];
  if (this.availability.blackoutDates.some(bd => bd.toISOString().split('T')[0] === dateString)) {
    return { available: false, reason: 'Date is blacked out' };
  }
  
  // Check special availability
  const specialAvailability = this.availability.specialAvailability.find(
    sa => sa.date.toISOString().split('T')[0] === dateString
  );
  
  if (specialAvailability && !specialAvailability.isAvailable) {
    return { available: false, reason: specialAvailability.reason || 'Special restriction applies' };
  }
  
  // Check advance booking requirements
  const now = new Date();
  const daysUntilBooking = Math.ceil((checkDate - now) / (1000 * 60 * 60 * 24));
  
  if (daysUntilBooking < this.availability.advanceBookingDays.min) {
    return { available: false, reason: `Minimum ${this.availability.advanceBookingDays.min} days advance booking required` };
  }
  
  if (daysUntilBooking > this.availability.advanceBookingDays.max) {
    return { available: false, reason: `Maximum ${this.availability.advanceBookingDays.max} days advance booking allowed` };
  }
  
  // Check guest count restrictions
  if (guestCount < this.restrictions.minGuests) {
    return { available: false, reason: `Minimum ${this.restrictions.minGuests} guests required` };
  }
  
  if (guestCount > this.restrictions.maxGuests) {
    return { available: false, reason: `Maximum ${this.restrictions.maxGuests} guests allowed` };
  }
  
  // Check room type availability
  if (!this.roomTypes.includes('all') && !this.roomTypes.includes(roomType)) {
    return { available: false, reason: `Room type '${roomType}' not available for this slot` };
  }
  
  return { 
    available: true,
    pricing: this.calculatePrice(guestCount, roomType, checkDate),
    inclusions: this.inclusions.filter(inc => inc.isHighlight),
    restrictions: {
      cancellationPolicy: this.availability.cancellationPolicy,
      cancellationDeadlineHours: this.availability.cancellationDeadlineHours
    }
  };
};

dayUseSlotSchema.methods.updateAnalytics = function(bookingData) {
  this.analytics.totalBookings += 1;
  this.analytics.totalRevenue += bookingData.totalAmount || 0;
  
  // Update monthly stats
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  
  let monthlyStats = this.analytics.monthlyStats.find(ms => ms.month === month && ms.year === year);
  if (!monthlyStats) {
    monthlyStats = {
      month,
      year,
      bookings: 0,
      revenue: 0,
      averagePrice: 0,
      occupancyRate: 0
    };
    this.analytics.monthlyStats.push(monthlyStats);
  }
  
  monthlyStats.bookings += 1;
  monthlyStats.revenue += bookingData.totalAmount || 0;
  monthlyStats.averagePrice = monthlyStats.revenue / monthlyStats.bookings;
  
  // Update peak demand tracking
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
  let peakDay = this.analytics.peakDemandDays.find(pd => pd.dayOfWeek === dayOfWeek);
  if (!peakDay) {
    peakDay = { dayOfWeek, demandScore: 0 };
    this.analytics.peakDemandDays.push(peakDay);
  }
  
  // Simple demand score calculation
  peakDay.demandScore = Math.min(100, peakDay.demandScore + 5);
};

dayUseSlotSchema.pre('save', function(next) {
  if (!this.slotId) {
    this.slotId = `dayuse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Calculate duration from start and end times
  if (this.timeSlot.startTime && this.timeSlot.endTime) {
    const [startHour, startMin] = this.timeSlot.startTime.split(':').map(Number);
    const [endHour, endMin] = this.timeSlot.endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    this.timeSlot.duration = endMinutes - startMinutes;
  }
  
  next();
});

export default mongoose.models.DayUseSlot || mongoose.model('DayUseSlot', dayUseSlotSchema);
