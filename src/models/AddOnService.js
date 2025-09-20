import mongoose from 'mongoose';

const addOnServiceSchema = new mongoose.Schema({
  serviceId: {
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
  shortDescription: {
    type: String,
    maxlength: 150,
    trim: true
  },
  category: {
    type: String,
    enum: [
      'dining', 'spa', 'fitness', 'transportation', 'entertainment', 
      'business', 'laundry', 'childcare', 'pet_services', 'concierge',
      'tours', 'shopping', 'medical', 'technology', 'other'
    ],
    required: true
  },
  type: {
    type: String,
    enum: ['once', 'per_night', 'per_person', 'per_hour', 'per_unit'],
    required: true,
    default: 'once'
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
      },
      source: {
        type: String,
        enum: ['manual', 'auto_conversion'],
        default: 'auto_conversion'
      }
    }],
    tieredPricing: [{
      minQuantity: {
        type: Number,
        required: true,
        min: 1
      },
      maxQuantity: {
        type: Number,
        min: 1
      },
      price: {
        type: Number,
        required: true,
        min: 0
      },
      discountPercentage: {
        type: Number,
        min: 0,
        max: 100
      }
    }],
    memberDiscounts: [{
      membershipLevel: {
        type: String,
        enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
        required: true
      },
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
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    },
    maxQuantityPerBooking: {
      type: Number,
      default: 10,
      min: 1
    },
    maxCapacityPerDay: {
      type: Number,
      min: 1
    },
    advanceBookingRequired: {
      type: Number,
      default: 0,
      min: 0
    },
    availableTimeSlots: [{
      startTime: {
        type: String,
        match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      },
      endTime: {
        type: String,
        match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      },
      daysOfWeek: [{
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      }],
      capacity: {
        type: Number,
        min: 1
      }
    }],
    seasonalAvailability: [{
      startDate: Date,
      endDate: Date,
      isAvailable: Boolean,
      reason: String
    }]
  },
  requirements: {
    minAge: {
      type: Number,
      min: 0
    },
    maxAge: {
      type: Number,
      min: 0
    },
    requiresReservation: {
      type: Boolean,
      default: false
    },
    cancellationPolicy: {
      type: String,
      enum: ['flexible', 'moderate', 'strict', 'non_refundable'],
      default: 'flexible'
    },
    cancellationDeadline: {
      type: Number,
      default: 24,
      min: 0
    },
    specialRequirements: [String],
    healthRestrictions: [String],
    equipmentProvided: [String],
    whatToBring: [String]
  },
  location: {
    venue: String,
    address: String,
    floor: String,
    roomNumber: String,
    specialInstructions: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    isOffsite: {
      type: Boolean,
      default: false
    },
    transportationIncluded: {
      type: Boolean,
      default: false
    }
  },
  media: {
    images: [String],
    videos: [String],
    brochures: [String],
    virtualTourUrl: String
  },
  staff: {
    staffRequired: {
      type: Boolean,
      default: false
    },
    staffMembers: [{
      name: String,
      role: String,
      qualifications: [String],
      languages: [String]
    }],
    staffToGuestRatio: {
      type: String,
      match: /^\d+:\d+$/
    }
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
    lastBookedDate: Date,
    popularityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  upselling: {
    isUpsellItem: {
      type: Boolean,
      default: false
    },
    upsellTriggers: [{
      condition: {
        type: String,
        enum: ['room_type', 'booking_value', 'length_of_stay', 'guest_profile', 'season', 'special_event'],
        required: true
      },
      value: String,
      priority: {
        type: Number,
        default: 0
      }
    }],
    complementaryServices: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AddOnService'
    }],
    bundleOffers: [{
      name: String,
      serviceIds: [String],
      bundlePrice: Number,
      savings: Number,
      validUntil: Date
    }]
  },
  terms: {
    termsAndConditions: String,
    liability: String,
    refundPolicy: String,
    ageRestrictions: String
  },
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
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
addOnServiceSchema.virtual('isCurrentlyAvailable').get(function() {
  if (!this.availability.isAvailable) return false;
  
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  
  // Check seasonal availability
  const seasonalAvail = this.availability.seasonalAvailability.find(season => 
    now >= season.startDate && now <= season.endDate
  );
  
  if (seasonalAvail && !seasonalAvail.isAvailable) return false;
  
  // Check time slots
  if (this.availability.availableTimeSlots.length > 0) {
    const availableSlot = this.availability.availableTimeSlots.find(slot =>
      slot.daysOfWeek.includes(dayOfWeek) &&
      currentTime >= slot.startTime &&
      currentTime <= slot.endTime
    );
    return !!availableSlot;
  }
  
  return true;
});

addOnServiceSchema.virtual('priceRange').get(function() {
  if (this.pricing.tieredPricing.length > 0) {
    const prices = this.pricing.tieredPricing.map(tier => tier.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  }
  return {
    min: this.pricing.basePrice,
    max: this.pricing.basePrice
  };
});

addOnServiceSchema.virtual('averageDailyBookings').get(function() {
  const daysSinceCreated = Math.max(1, Math.ceil((new Date() - this.createdAt) / (1000 * 60 * 60 * 24)));
  return Math.round((this.analytics.totalBookings / daysSinceCreated) * 100) / 100;
});

// Indexes
addOnServiceSchema.index({ serviceId: 1 });
addOnServiceSchema.index({ category: 1, isActive: 1 });
addOnServiceSchema.index({ 'pricing.basePrice': 1 });
addOnServiceSchema.index({ displayOrder: 1, isFeatured: -1 });
addOnServiceSchema.index({ tags: 1 });
addOnServiceSchema.index({ 'analytics.popularityScore': -1 });
addOnServiceSchema.index({ 'analytics.averageRating': -1 });

// Instance methods
addOnServiceSchema.methods.calculatePrice = function(quantity = 1, guestProfile = null, currency = 'USD') {
  let basePrice = this.pricing.basePrice;
  
  // Get currency price
  if (currency !== this.pricing.baseCurrency) {
    const currencyPrice = this.pricing.currencyPrices.find(cp => cp.currency === currency);
    if (currencyPrice) {
      basePrice = currencyPrice.price;
    }
  }
  
  // Apply tiered pricing
  if (this.pricing.tieredPricing.length > 0) {
    const tier = this.pricing.tieredPricing.find(t => 
      quantity >= t.minQuantity && (t.maxQuantity ? quantity <= t.maxQuantity : true)
    );
    if (tier) {
      basePrice = tier.price;
    }
  }
  
  // Apply member discounts
  if (guestProfile && guestProfile.membershipLevel && this.pricing.memberDiscounts.length > 0) {
    const discount = this.pricing.memberDiscounts.find(d => d.membershipLevel === guestProfile.membershipLevel);
    if (discount) {
      if (discount.discountType === 'percentage') {
        basePrice = basePrice * (1 - discount.discountValue / 100);
      } else {
        basePrice = Math.max(0, basePrice - discount.discountValue);
      }
    }
  }
  
  return {
    unitPrice: basePrice,
    totalPrice: basePrice * quantity,
    quantity,
    currency
  };
};

addOnServiceSchema.methods.checkAvailability = function(requestedDate, requestedTime = null, quantity = 1) {
  if (!this.availability.isAvailable) {
    return { available: false, reason: 'Service not available' };
  }
  
  const date = new Date(requestedDate);
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
  
  // Check seasonal availability
  const seasonalAvail = this.availability.seasonalAvailability.find(season => 
    date >= season.startDate && date <= season.endDate
  );
  
  if (seasonalAvail && !seasonalAvail.isAvailable) {
    return { available: false, reason: seasonalAvail.reason || 'Not available during this period' };
  }
  
  // Check time slots if time is provided
  if (requestedTime && this.availability.availableTimeSlots.length > 0) {
    const availableSlot = this.availability.availableTimeSlots.find(slot =>
      slot.daysOfWeek.includes(dayOfWeek) &&
      requestedTime >= slot.startTime &&
      requestedTime <= slot.endTime
    );
    
    if (!availableSlot) {
      return { available: false, reason: 'Not available at requested time' };
    }
    
    if (availableSlot.capacity && quantity > availableSlot.capacity) {
      return { available: false, reason: `Capacity exceeded. Maximum ${availableSlot.capacity} allowed` };
    }
  }
  
  // Check quantity limits
  if (quantity > this.availability.maxQuantityPerBooking) {
    return { available: false, reason: `Quantity exceeded. Maximum ${this.availability.maxQuantityPerBooking} per booking` };
  }
  
  // Check advance booking requirement
  const now = new Date();
  const hoursUntilService = (date - now) / (1000 * 60 * 60);
  if (hoursUntilService < this.availability.advanceBookingRequired) {
    return { available: false, reason: `Requires ${this.availability.advanceBookingRequired} hours advance booking` };
  }
  
  return { available: true };
};

addOnServiceSchema.methods.updateAnalytics = function(bookingData) {
  this.analytics.totalBookings += 1;
  this.analytics.totalRevenue += bookingData.totalAmount || 0;
  this.analytics.lastBookedDate = new Date();
  
  // Update popularity score based on recent bookings
  const daysSinceLastBooked = (new Date() - this.analytics.lastBookedDate) / (1000 * 60 * 60 * 24);
  this.analytics.popularityScore = Math.min(100, this.analytics.popularityScore + (10 / Math.max(1, daysSinceLastBooked)));
};

addOnServiceSchema.methods.getUpsellRecommendations = function(bookingContext = {}) {
  const recommendations = [];
  
  for (const trigger of this.upselling.upsellTriggers) {
    let shouldRecommend = false;
    
    switch (trigger.condition) {
      case 'room_type':
        shouldRecommend = bookingContext.roomType === trigger.value;
        break;
      case 'booking_value':
        shouldRecommend = bookingContext.totalValue >= parseFloat(trigger.value);
        break;
      case 'length_of_stay':
        shouldRecommend = bookingContext.nights >= parseInt(trigger.value);
        break;
      case 'guest_profile':
        shouldRecommend = bookingContext.guestProfile && bookingContext.guestProfile.type === trigger.value;
        break;
      case 'season':
        const now = new Date();
        const month = now.getMonth() + 1;
        shouldRecommend = trigger.value.includes(month.toString());
        break;
    }
    
    if (shouldRecommend) {
      recommendations.push({
        service: this,
        trigger: trigger.condition,
        priority: trigger.priority,
        reason: `Recommended based on ${trigger.condition}`
      });
    }
  }
  
  return recommendations.sort((a, b) => b.priority - a.priority);
};

addOnServiceSchema.pre('save', function(next) {
  if (!this.serviceId) {
    this.serviceId = `addon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Update popularity score based on ratings and bookings
  if (this.analytics.reviewCount > 0 && this.analytics.totalBookings > 0) {
    const ratingWeight = 0.4;
    const bookingWeight = 0.6;
    const normalizedRating = (this.analytics.averageRating / 5) * 100;
    const normalizedBookings = Math.min(100, (this.analytics.totalBookings / 100) * 100);
    
    this.analytics.popularityScore = (normalizedRating * ratingWeight) + (normalizedBookings * bookingWeight);
  }
  
  next();
});

export default mongoose.models.AddOnService || mongoose.model('AddOnService', addOnServiceSchema);
