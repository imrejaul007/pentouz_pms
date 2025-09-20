import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     MarketSegment:
 *       type: object
 *       required:
 *         - name
 *         - code
 *         - category
 *         - isActive
 *       properties:
 *         _id:
 *           type: string
 *           description: Market segment ID
 *         name:
 *           type: string
 *           description: Market segment name
 *         code:
 *           type: string
 *           description: Unique code for the market segment
 *         description:
 *           type: string
 *           description: Market segment description
 *         category:
 *           type: string
 *           enum: [leisure, business, corporate, group, government, military, student, senior, family, other]
 *           description: Market segment category
 *         subcategory:
 *           type: string
 *           description: Market segment subcategory
 *         characteristics:
 *           type: object
 *           properties:
 *             averageStayDuration:
 *               type: number
 *             averageGroupSize:
 *               type: number
 *             preferredRoomTypes:
 *               type: array
 *               items:
 *                 type: string
 *             budgetRange:
 *               type: object
 *               properties:
 *                 min:
 *                   type: number
 *                 max:
 *                   type: number
 *             bookingPattern:
 *               type: string
 *               enum: [advance, last_minute, flexible, seasonal]
 *             seasonality:
 *               type: array
 *               items:
 *                 type: string
 *         demographics:
 *           type: object
 *           properties:
 *             ageRange:
 *               type: object
 *               properties:
 *                 min:
 *                   type: number
 *                 max:
 *                   type: number
 *             incomeLevel:
 *               type: string
 *               enum: [low, middle, high, luxury]
 *             education:
 *               type: string
 *               enum: [high_school, college, graduate, professional]
 *             occupation:
 *               type: string
 *         preferences:
 *           type: object
 *           properties:
 *             amenities:
 *               type: array
 *               items:
 *                 type: string
 *             services:
 *               type: array
 *               items:
 *                 type: string
 *             activities:
 *               type: array
 *               items:
 *                 type: string
 *             dining:
 *               type: string
 *               enum: [casual, fine_dining, room_service, all_inclusive]
 *         pricing:
 *           type: object
 *           properties:
 *             priceSensitivity:
 *               type: string
 *               enum: [low, medium, high, luxury]
 *             discountAcceptance:
 *               type: number
 *               min: 0
 *               max: 100
 *             packagePreference:
 *               type: boolean
 *         communication:
 *           type: object
 *           properties:
 *             preferredChannels:
 *               type: array
 *               items:
 *                 type: string
 *                 enum: [email, phone, sms, social_media, direct_mail, online]
 *             language:
 *               type: string
 *             timezone:
 *               type: string
 *         analytics:
 *           type: object
 *           properties:
 *             totalBookings:
 *               type: number
 *             totalRevenue:
 *               type: number
 *             averageBookingValue:
 *               type: number
 *             conversionRate:
 *               type: number
 *             customerLifetimeValue:
 *               type: number
 *             repeatBookingRate:
 *               type: number
 *             lastActivity:
 *               type: string
 *               format: date-time
 *         isActive:
 *           type: boolean
 *           description: Whether the market segment is active
 *         priority:
 *           type: number
 *           description: Priority for targeting (higher = more important)
 *         hotelId:
 *           type: string
 *           description: Hotel ID this segment belongs to
 *         createdBy:
 *           type: string
 *           description: User who created this segment
 *         updatedBy:
 *           type: string
 *           description: User who last updated this segment
 */

const marketSegmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Market segment name is required'],
    trim: true,
    maxLength: [200, 'Market segment name cannot exceed 200 characters'],
    index: true
  },
  code: {
    type: String,
    required: [true, 'Market segment code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxLength: [20, 'Market segment code cannot exceed 20 characters'],
    match: [/^[A-Z0-9_-]+$/, 'Market segment code can only contain letters, numbers, underscores and hyphens']
  },
  description: {
    type: String,
    maxLength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Market segment category is required'],
    enum: [
      'leisure', 'business', 'corporate', 'group', 'government', 
      'military', 'student', 'senior', 'family', 'other'
    ],
    index: true
  },
  subcategory: {
    type: String,
    trim: true,
    maxLength: [100, 'Subcategory cannot exceed 100 characters']
  },
  characteristics: {
    averageStayDuration: {
      type: Number,
      min: [1, 'Average stay duration must be at least 1 night']
    },
    averageGroupSize: {
      type: Number,
      min: [1, 'Average group size must be at least 1']
    },
    preferredRoomTypes: [{
      type: mongoose.Schema.ObjectId,
      ref: 'RoomType'
    }],
    budgetRange: {
      min: {
        type: Number,
        min: [0, 'Minimum budget cannot be negative']
      },
      max: {
        type: Number,
        min: [0, 'Maximum budget cannot be negative']
      }
    },
    bookingPattern: {
      type: String,
      enum: ['advance', 'last_minute', 'flexible', 'seasonal']
    },
    seasonality: [{
      type: String,
      enum: ['spring', 'summer', 'autumn', 'winter', 'holiday', 'off_season']
    }]
  },
  demographics: {
    ageRange: {
      min: {
        type: Number,
        min: [0, 'Minimum age cannot be negative'],
        max: [120, 'Minimum age cannot exceed 120']
      },
      max: {
        type: Number,
        min: [0, 'Maximum age cannot be negative'],
        max: [120, 'Maximum age cannot exceed 120']
      }
    },
    incomeLevel: {
      type: String,
      enum: ['low', 'middle', 'high', 'luxury']
    },
    education: {
      type: String,
      enum: ['high_school', 'college', 'graduate', 'professional']
    },
    occupation: {
      type: String,
      trim: true,
      maxLength: [100, 'Occupation cannot exceed 100 characters']
    }
  },
  preferences: {
    amenities: [{
      type: String,
      trim: true,
      maxLength: [100, 'Amenity name cannot exceed 100 characters']
    }],
    services: [{
      type: String,
      trim: true,
      maxLength: [100, 'Service name cannot exceed 100 characters']
    }],
    activities: [{
      type: String,
      trim: true,
      maxLength: [100, 'Activity name cannot exceed 100 characters']
    }],
    dining: {
      type: String,
      enum: ['casual', 'fine_dining', 'room_service', 'all_inclusive']
    }
  },
  pricing: {
    priceSensitivity: {
      type: String,
      enum: ['low', 'medium', 'high', 'luxury']
    },
    discountAcceptance: {
      type: Number,
      min: [0, 'Discount acceptance cannot be negative'],
      max: [100, 'Discount acceptance cannot exceed 100']
    },
    packagePreference: {
      type: Boolean,
      default: false
    }
  },
  communication: {
    preferredChannels: [{
      type: String,
      enum: ['email', 'phone', 'sms', 'social_media', 'direct_mail', 'online']
    }],
    language: {
      type: String,
      trim: true,
      maxLength: [10, 'Language code cannot exceed 10 characters']
    },
    timezone: {
      type: String,
      trim: true,
      maxLength: [50, 'Timezone cannot exceed 50 characters']
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
    customerLifetimeValue: {
      type: Number,
      default: 0
    },
    repeatBookingRate: {
      type: Number,
      default: 0,
      min: [0, 'Repeat booking rate cannot be negative'],
      max: [100, 'Repeat booking rate cannot exceed 100']
    },
    lastActivity: {
      type: Date
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
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
marketSegmentSchema.index({ hotelId: 1, category: 1 });
marketSegmentSchema.index({ hotelId: 1, isActive: 1 });
marketSegmentSchema.index({ hotelId: 1, priority: -1 });

// Ensure unique market segment codes per hotel
marketSegmentSchema.index({ hotelId: 1, code: 1 }, { unique: true });

// Virtual for budget range summary
marketSegmentSchema.virtual('budgetRangeSummary').get(function() {
  if (!this.characteristics.budgetRange) return 'Not specified';
  const { min, max } = this.characteristics.budgetRange;
  if (min && max) {
    return `$${min} - $${max}`;
  } else if (min) {
    return `$${min}+`;
  } else if (max) {
    return `Up to $${max}`;
  }
  return 'Not specified';
});

// Virtual for age range summary
marketSegmentSchema.virtual('ageRangeSummary').get(function() {
  if (!this.demographics.ageRange) return 'Not specified';
  const { min, max } = this.demographics.ageRange;
  if (min && max) {
    return `${min} - ${max} years`;
  } else if (min) {
    return `${min}+ years`;
  } else if (max) {
    return `Up to ${max} years`;
  }
  return 'Not specified';
});

// Virtual for characteristics summary
marketSegmentSchema.virtual('characteristicsSummary').get(function() {
  const characteristics = [];
  
  if (this.characteristics.averageStayDuration) {
    characteristics.push(`${this.characteristics.averageStayDuration} nights avg`);
  }
  
  if (this.characteristics.averageGroupSize) {
    characteristics.push(`${this.characteristics.averageGroupSize} people avg`);
  }
  
  if (this.characteristics.bookingPattern) {
    characteristics.push(this.characteristics.bookingPattern.replace('_', ' '));
  }
  
  return characteristics.join(', ') || 'No characteristics defined';
});

// Instance methods
marketSegmentSchema.methods.updateAnalytics = function(bookingValue, isRepeat = false) {
  this.analytics.totalBookings += 1;
  this.analytics.totalRevenue += bookingValue;
  this.analytics.averageBookingValue = this.analytics.totalRevenue / this.analytics.totalBookings;
  
  if (isRepeat) {
    const currentRepeatRate = this.analytics.repeatBookingRate;
    const totalBookings = this.analytics.totalBookings;
    this.analytics.repeatBookingRate = 
      ((currentRepeatRate * (totalBookings - 1)) + 100) / totalBookings;
  } else {
    const currentRepeatRate = this.analytics.repeatBookingRate;
    const totalBookings = this.analytics.totalBookings;
    this.analytics.repeatBookingRate = 
      (currentRepeatRate * (totalBookings - 1)) / totalBookings;
  }
  
  this.analytics.lastActivity = new Date();
  
  return this.save();
};

marketSegmentSchema.methods.calculateCustomerLifetimeValue = function() {
  if (this.analytics.totalBookings === 0) return 0;
  
  const avgBookingValue = this.analytics.averageBookingValue;
  const repeatRate = this.analytics.repeatBookingRate / 100;
  const avgStayDuration = this.characteristics.averageStayDuration || 1;
  
  // Simple CLV calculation: (Avg Booking Value × Repeat Rate × Avg Stay Duration)
  this.analytics.customerLifetimeValue = avgBookingValue * repeatRate * avgStayDuration;
  
  return this.analytics.customerLifetimeValue;
};

marketSegmentSchema.methods.isTargetMatch = function(guestProfile) {
  // Check age range
  if (this.demographics.ageRange && guestProfile.age) {
    const { min, max } = this.demographics.ageRange;
    if (min && guestProfile.age < min) return false;
    if (max && guestProfile.age > max) return false;
  }
  
  // Check income level
  if (this.demographics.incomeLevel && guestProfile.incomeLevel) {
    if (this.demographics.incomeLevel !== guestProfile.incomeLevel) return false;
  }
  
  // Check budget range
  if (this.characteristics.budgetRange && guestProfile.budget) {
    const { min, max } = this.characteristics.budgetRange;
    if (min && guestProfile.budget < min) return false;
    if (max && guestProfile.budget > max) return false;
  }
  
  // Check preferred room types
  if (this.characteristics.preferredRoomTypes.length > 0 && guestProfile.preferredRoomType) {
    if (!this.characteristics.preferredRoomTypes.includes(guestProfile.preferredRoomType)) {
      return false;
    }
  }
  
  return true;
};

// Static methods
marketSegmentSchema.statics.getByCategory = function(hotelId, category) {
  return this.find({ hotelId, category, isActive: true })
    .sort({ priority: -1, createdAt: -1 })
    .populate('createdBy updatedBy', 'name email');
};

marketSegmentSchema.statics.getActiveSegments = function(hotelId) {
  return this.find({ hotelId, isActive: true })
    .sort({ priority: -1, createdAt: -1 });
};

marketSegmentSchema.statics.getTopPerformingSegments = function(hotelId, limit = 5) {
  return this.find({ hotelId, isActive: true })
    .sort({ 'analytics.totalRevenue': -1 })
    .limit(limit)
    .select('name category analytics.totalRevenue analytics.totalBookings analytics.averageBookingValue');
};

marketSegmentSchema.statics.getSegmentAnalytics = function(hotelId, dateRange) {
  const pipeline = [
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$category',
        totalSegments: { $sum: 1 },
        activeSegments: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        totalBookings: { $sum: '$analytics.totalBookings' },
        totalRevenue: { $sum: '$analytics.totalRevenue' },
        avgBookingValue: { $avg: '$analytics.averageBookingValue' },
        avgConversionRate: { $avg: '$analytics.conversionRate' },
        avgRepeatRate: { $avg: '$analytics.repeatBookingRate' }
      }
    },
    { $sort: { _id: 1 } }
  ];

  return this.aggregate(pipeline);
};

marketSegmentSchema.statics.findMatchingSegments = function(hotelId, guestProfile) {
  return this.getActiveSegments(hotelId).then(segments => {
    return segments.filter(segment => segment.isTargetMatch(guestProfile));
  });
};

// Pre-save middleware
marketSegmentSchema.pre('save', function(next) {
  // Validate age range
  if (this.demographics.ageRange) {
    const { min, max } = this.demographics.ageRange;
    if (min && max && min > max) {
      return next(new Error('Minimum age cannot be greater than maximum age'));
    }
  }

  // Validate budget range
  if (this.characteristics.budgetRange) {
    const { min, max } = this.characteristics.budgetRange;
    if (min && max && min > max) {
      return next(new Error('Minimum budget cannot be greater than maximum budget'));
    }
  }

  // Validate stay duration
  if (this.characteristics.averageStayDuration && this.characteristics.averageStayDuration < 1) {
    return next(new Error('Average stay duration must be at least 1 night'));
  }

  // Validate group size
  if (this.characteristics.averageGroupSize && this.characteristics.averageGroupSize < 1) {
    return next(new Error('Average group size must be at least 1'));
  }

  next();
});

const MarketSegment = mongoose.model('MarketSegment', marketSegmentSchema);

export default MarketSegment;
