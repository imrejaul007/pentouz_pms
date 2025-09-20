import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     SpecialDiscount:
 *       type: object
 *       required:
 *         - name
 *         - code
 *         - type
 *         - discountValue
 *         - startDate
 *         - endDate
 *         - isActive
 *       properties:
 *         _id:
 *           type: string
 *           description: Special discount ID
 *         name:
 *           type: string
 *           description: Discount name
 *         code:
 *           type: string
 *           description: Unique discount code
 *         description:
 *           type: string
 *           description: Discount description
 *         type:
 *           type: string
 *           enum: [early_bird, last_minute, long_stay, seasonal, corporate, group, loyalty, promotional, other]
 *           description: Discount type
 *         category:
 *           type: string
 *           enum: [booking, room, service, package, membership, referral, other]
 *           description: Discount category
 *         discountValue:
 *           type: number
 *           description: Discount value (percentage or fixed amount)
 *         discountType:
 *           type: string
 *           enum: [percentage, fixed_amount, free_night, upgrade, package_discount]
 *           description: How the discount is applied
 *         maxDiscountAmount:
 *           type: number
 *           description: Maximum discount amount (for percentage discounts)
 *         minBookingValue:
 *           type: number
 *           description: Minimum booking value required
 *         minNights:
 *           type: number
 *           description: Minimum nights required
 *         maxNights:
 *           type: number
 *           description: Maximum nights applicable
 *         applicableRoomTypes:
 *           type: array
 *           items:
 *             type: string
 *           description: Room types this discount applies to
 *         applicableServices:
 *           type: array
 *           items:
 *             type: string
 *           description: Services this discount applies to
 *         guestRestrictions:
 *           type: object
 *           properties:
 *             firstTimeGuestsOnly:
 *               type: boolean
 *             returningGuestsOnly:
 *               type: boolean
 *             loyaltyTierRequired:
 *               type: string
 *             corporateGuestsOnly:
 *               type: boolean
 *             groupSizeMin:
 *               type: number
 *             groupSizeMax:
 *               type: number
 *         usageLimits:
 *           type: object
 *           properties:
 *             maxUsagePerGuest:
 *               type: number
 *             maxTotalUsage:
 *               type: number
 *             currentUsage:
 *               type: number
 *             maxUsagePerDay:
 *               type: number
 *         combinability:
 *           type: object
 *           properties:
 *             combinableWithOtherOffers:
 *               type: boolean
 *             combinableWithLoyalty:
 *               type: boolean
 *             combinableWithCorporate:
 *               type: boolean
 *         dates:
 *           type: object
 *           properties:
 *             startDate:
 *               type: string
 *               format: date-time
 *             endDate:
 *               type: string
 *               format: date-time
 *             advanceBookingDays:
 *               type: number
 *             lastMinuteDays:
 *               type: number
 *         conditions:
 *           type: object
 *           properties:
 *             requiresApproval:
 *               type: boolean
 *             requiresDocumentation:
 *               type: boolean
 *             blackoutDates:
 *               type: array
 *               items:
 *                 type: string
 *                 format: date
 *             blackoutDays:
 *               type: array
 *               items:
 *                 type: string
 *                 enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday]
 *         analytics:
 *           type: object
 *           properties:
 *             totalBookings:
 *               type: number
 *             totalRevenue:
 *               type: number
 *             totalDiscountGiven:
 *               type: number
 *             averageBookingValue:
 *               type: number
 *             conversionRate:
 *               type: number
 *             lastUsed:
 *               type: string
 *               format: date-time
 *         isActive:
 *           type: boolean
 *           description: Whether the discount is active
 *         isPublic:
 *           type: boolean
 *           description: Whether the discount is publicly visible
 *         priority:
 *           type: number
 *           description: Priority for discount application (higher = applied first)
 *         hotelId:
 *           type: string
 *           description: Hotel ID this discount belongs to
 *         createdBy:
 *           type: string
 *           description: User who created this discount
 *         updatedBy:
 *           type: string
 *           description: User who last updated this discount
 */

const specialDiscountSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Discount name is required'],
    trim: true,
    maxLength: [200, 'Discount name cannot exceed 200 characters'],
    index: true
  },
  code: {
    type: String,
    required: [true, 'Discount code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxLength: [50, 'Discount code cannot exceed 50 characters'],
    match: [/^[A-Z0-9_-]+$/, 'Discount code can only contain letters, numbers, underscores and hyphens']
  },
  description: {
    type: String,
    maxLength: [1000, 'Description cannot exceed 1000 characters']
  },
  type: {
    type: String,
    required: [true, 'Discount type is required'],
    enum: [
      'early_bird', 'last_minute', 'long_stay', 'seasonal', 'corporate', 
      'group', 'loyalty', 'promotional', 'other'
    ],
    index: true
  },
  category: {
    type: String,
    required: [true, 'Discount category is required'],
    enum: ['booking', 'room', 'service', 'package', 'membership', 'referral', 'other'],
    index: true
  },
  discountValue: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: [0, 'Discount value cannot be negative']
  },
  discountType: {
    type: String,
    required: [true, 'Discount type is required'],
    enum: ['percentage', 'fixed_amount', 'free_night', 'upgrade', 'package_discount'],
    index: true
  },
  maxDiscountAmount: {
    type: Number,
    min: [0, 'Maximum discount amount cannot be negative']
  },
  minBookingValue: {
    type: Number,
    min: [0, 'Minimum booking value cannot be negative']
  },
  minNights: {
    type: Number,
    min: [1, 'Minimum nights must be at least 1']
  },
  maxNights: {
    type: Number,
    min: [1, 'Maximum nights must be at least 1']
  },
  applicableRoomTypes: [{
    type: mongoose.Schema.ObjectId,
    ref: 'RoomType'
  }],
  applicableServices: [{
    type: String,
    trim: true
  }],
  guestRestrictions: {
    firstTimeGuestsOnly: {
      type: Boolean,
      default: false
    },
    returningGuestsOnly: {
      type: Boolean,
      default: false
    },
    loyaltyTierRequired: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum']
    },
    corporateGuestsOnly: {
      type: Boolean,
      default: false
    },
    groupSizeMin: {
      type: Number,
      min: [1, 'Minimum group size must be at least 1']
    },
    groupSizeMax: {
      type: Number,
      min: [1, 'Maximum group size must be at least 1']
    }
  },
  usageLimits: {
    maxUsagePerGuest: {
      type: Number,
      min: [1, 'Maximum usage per guest must be at least 1'],
      default: 1
    },
    maxTotalUsage: {
      type: Number,
      min: [1, 'Maximum total usage must be at least 1']
    },
    currentUsage: {
      type: Number,
      default: 0,
      min: [0, 'Current usage cannot be negative']
    },
    maxUsagePerDay: {
      type: Number,
      min: [1, 'Maximum usage per day must be at least 1']
    }
  },
  combinability: {
    combinableWithOtherOffers: {
      type: Boolean,
      default: false
    },
    combinableWithLoyalty: {
      type: Boolean,
      default: false
    },
    combinableWithCorporate: {
      type: Boolean,
      default: false
    }
  },
  dates: {
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    },
    advanceBookingDays: {
      type: Number,
      min: [0, 'Advance booking days cannot be negative']
    },
    lastMinuteDays: {
      type: Number,
      min: [0, 'Last minute days cannot be negative']
    }
  },
  conditions: {
    requiresApproval: {
      type: Boolean,
      default: false
    },
    requiresDocumentation: {
      type: Boolean,
      default: false
    },
    blackoutDates: [{
      type: Date
    }],
    blackoutDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }]
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
    totalDiscountGiven: {
      type: Number,
      default: 0
    },
    averageBookingValue: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0,
      min: [0, 'Conversion rate cannot be negative'],
      max: [100, 'Conversion rate cannot exceed 100']
    },
    lastUsed: {
      type: Date
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0,
    index: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
specialDiscountSchema.index({ hotelId: 1, type: 1 });
specialDiscountSchema.index({ hotelId: 1, category: 1 });
specialDiscountSchema.index({ hotelId: 1, isActive: 1 });
specialDiscountSchema.index({ hotelId: 1, 'dates.startDate': 1, 'dates.endDate': 1 });
specialDiscountSchema.index({ hotelId: 1, priority: -1 });

// Ensure unique discount codes per hotel
specialDiscountSchema.index({ hotelId: 1, code: 1 }, { unique: true });

// Virtual for discount summary
specialDiscountSchema.virtual('discountSummary').get(function() {
  if (this.discountType === 'percentage') {
    return `${this.discountValue}%${this.maxDiscountAmount ? ` (max $${this.maxDiscountAmount})` : ''}`;
  } else if (this.discountType === 'fixed_amount') {
    return `$${this.discountValue}`;
  } else if (this.discountType === 'free_night') {
    return `${this.discountValue} free night${this.discountValue > 1 ? 's' : ''}`;
  } else if (this.discountType === 'upgrade') {
    return 'Room upgrade';
  } else {
    return `${this.discountValue}% package discount`;
  }
});

// Virtual for usage percentage
specialDiscountSchema.virtual('usagePercentage').get(function() {
  if (!this.usageLimits.maxTotalUsage) return 0;
  return (this.usageLimits.currentUsage / this.usageLimits.maxTotalUsage) * 100;
});

// Virtual for days remaining
specialDiscountSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const endDate = new Date(this.dates.endDate);
  const diffTime = endDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance methods
specialDiscountSchema.methods.isValid = function() {
  const now = new Date();
  
  // Check if discount is active
  if (!this.isActive) return false;
  
  // Check date validity
  if (now < this.dates.startDate || now > this.dates.endDate) return false;
  
  // Check usage limits
  if (this.usageLimits.maxTotalUsage && this.usageLimits.currentUsage >= this.usageLimits.maxTotalUsage) {
    return false;
  }
  
  // Check blackout dates
  if (this.conditions.blackoutDates) {
    const today = now.toISOString().split('T')[0];
    if (this.conditions.blackoutDates.some(date => date.toISOString().split('T')[0] === today)) {
      return false;
    }
  }
  
  // Check blackout days
  if (this.conditions.blackoutDays) {
    const today = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    if (this.conditions.blackoutDays.includes(today)) {
      return false;
    }
  }
  
  return true;
};

specialDiscountSchema.methods.canApplyToBooking = function(bookingData) {
  // Check basic validity
  if (!this.isValid()) return false;
  
  // Check minimum booking value
  if (this.minBookingValue && bookingData.totalValue < this.minBookingValue) {
    return false;
  }
  
  // Check minimum nights
  if (this.minNights && bookingData.nights < this.minNights) {
    return false;
  }
  
  // Check maximum nights
  if (this.maxNights && bookingData.nights > this.maxNights) {
    return false;
  }
  
  // Check room type applicability
  if (this.applicableRoomTypes.length > 0) {
    if (!bookingData.roomTypes.some(roomType => 
      this.applicableRoomTypes.includes(roomType)
    )) {
      return false;
    }
  }
  
  return true;
};

specialDiscountSchema.methods.calculateDiscount = function(bookingValue) {
  let discount = 0;
  
  if (this.discountType === 'percentage') {
    discount = (bookingValue * this.discountValue) / 100;
    if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
      discount = this.maxDiscountAmount;
    }
  } else if (this.discountType === 'fixed_amount') {
    discount = this.discountValue;
  } else if (this.discountType === 'free_night') {
    // This would need room rate calculation logic
    discount = 0; // Placeholder
  } else if (this.discountType === 'upgrade') {
    // This would need upgrade cost calculation logic
    discount = 0; // Placeholder
  }
  
  return Math.min(discount, bookingValue); // Don't exceed booking value
};

specialDiscountSchema.methods.updateAnalytics = function(bookingValue, discountAmount) {
  this.analytics.totalBookings += 1;
  this.analytics.totalRevenue += bookingValue;
  this.analytics.totalDiscountGiven += discountAmount;
  this.analytics.averageBookingValue = this.analytics.totalRevenue / this.analytics.totalBookings;
  this.analytics.lastUsed = new Date();
  
  return this.save();
};

// Static methods
specialDiscountSchema.statics.getByType = function(hotelId, type) {
  return this.find({ hotelId, type, isActive: true })
    .sort({ priority: -1, createdAt: -1 })
    .populate('createdBy updatedBy', 'name email');
};

specialDiscountSchema.statics.getActiveDiscounts = function(hotelId) {
  const now = new Date();
  return this.find({
    hotelId,
    isActive: true,
    'dates.startDate': { $lte: now },
    'dates.endDate': { $gte: now }
  })
    .sort({ priority: -1, createdAt: -1 });
};

specialDiscountSchema.statics.getApplicableDiscounts = function(hotelId, bookingData) {
  return this.getActiveDiscounts(hotelId).then(discounts => {
    return discounts.filter(discount => discount.canApplyToBooking(bookingData));
  });
};

specialDiscountSchema.statics.getDiscountAnalytics = function(hotelId, dateRange) {
  const pipeline = [
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$type',
        totalDiscounts: { $sum: 1 },
        activeDiscounts: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        totalBookings: { $sum: '$analytics.totalBookings' },
        totalRevenue: { $sum: '$analytics.totalRevenue' },
        totalDiscountGiven: { $sum: '$analytics.totalDiscountGiven' },
        avgConversionRate: { $avg: '$analytics.conversionRate' }
      }
    },
    { $sort: { _id: 1 } }
  ];

  return this.aggregate(pipeline);
};

// Pre-save middleware
specialDiscountSchema.pre('save', function(next) {
  // Validate date range
  if (this.dates.startDate >= this.dates.endDate) {
    return next(new Error('Start date must be before end date'));
  }

  // Validate discount value based on type
  if (this.discountType === 'percentage' && (this.discountValue < 0 || this.discountValue > 100)) {
    return next(new Error('Percentage discount must be between 0 and 100'));
  }

  if (this.discountType === 'fixed_amount' && this.discountValue <= 0) {
    return next(new Error('Fixed amount discount must be greater than 0'));
  }

  // Validate usage limits
  if (this.usageLimits.maxUsagePerGuest < 1) {
    return next(new Error('Maximum usage per guest must be at least 1'));
  }

  if (this.usageLimits.maxTotalUsage && this.usageLimits.maxTotalUsage < 1) {
    return next(new Error('Maximum total usage must be at least 1'));
  }

  // Validate group size restrictions
  if (this.guestRestrictions.groupSizeMin && this.guestRestrictions.groupSizeMax) {
    if (this.guestRestrictions.groupSizeMin > this.guestRestrictions.groupSizeMax) {
      return next(new Error('Minimum group size cannot be greater than maximum group size'));
    }
  }

  next();
});

const SpecialDiscount = mongoose.model('SpecialDiscount', specialDiscountSchema);

export default SpecialDiscount;
