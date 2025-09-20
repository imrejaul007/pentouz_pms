import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     GuestType:
 *       type: object
 *       required:
 *         - name
 *         - code
 *         - category
 *         - isActive
 *       properties:
 *         _id:
 *           type: string
 *           description: Guest type ID
 *         name:
 *           type: string
 *           description: Guest type name
 *         code:
 *           type: string
 *           description: Unique code for the guest type
 *         category:
 *           type: string
 *           enum: [individual, corporate, group, vip, frequent, walk_in, online, referral, other]
 *           description: Guest type category
 *         description:
 *           type: string
 *           description: Guest type description
 *         isActive:
 *           type: boolean
 *           description: Whether the guest type is active
 *         benefits:
 *           type: object
 *           properties:
 *             discountPercentage:
 *               type: number
 *               description: Discount percentage for this guest type
 *             priorityCheckin:
 *               type: boolean
 *               description: Whether this guest type gets priority check-in
 *             roomUpgrade:
 *               type: boolean
 *               description: Whether this guest type is eligible for room upgrades
 *             lateCheckout:
 *               type: boolean
 *               description: Whether this guest type gets late checkout
 *             welcomeAmenities:
 *               type: array
 *               items:
 *                 type: string
 *               description: Welcome amenities for this guest type
 *         requirements:
 *           type: object
 *           properties:
 *             minimumStay:
 *               type: number
 *               description: Minimum stay requirement
 *             advanceBooking:
 *               type: number
 *               description: Advance booking requirement in days
 *             depositRequired:
 *               type: boolean
 *               description: Whether deposit is required
 *             depositPercentage:
 *               type: number
 *               description: Deposit percentage if required
 *             identificationRequired:
 *               type: boolean
 *               description: Whether identification is required
 *             corporateApproval:
 *               type: boolean
 *               description: Whether corporate approval is required
 *         pricing:
 *           type: object
 *           properties:
 *             rateMultiplier:
 *               type: number
 *               default: 1.0
 *               description: Rate multiplier for this guest type
 *             taxExempt:
 *               type: boolean
 *               description: Whether this guest type is tax exempt
 *             serviceChargeExempt:
 *               type: boolean
 *               description: Whether this guest type is exempt from service charges
 *         displayOrder:
 *           type: number
 *           description: Display order in lists
 *         color:
 *           type: string
 *           description: Color code for display purposes
 *         icon:
 *           type: string
 *           description: Icon identifier for display
 *         hotelId:
 *           type: string
 *           description: Hotel ID this guest type belongs to
 *         createdBy:
 *           type: string
 *           description: User who created this guest type
 *         updatedBy:
 *           type: string
 *           description: User who last updated this guest type
 */

const guestTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Guest type name is required'],
    trim: true,
    maxLength: [100, 'Guest type name cannot exceed 100 characters'],
    index: true
  },
  code: {
    type: String,
    required: [true, 'Guest type code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxLength: [20, 'Guest type code cannot exceed 20 characters'],
    match: [/^[A-Z0-9_-]+$/, 'Guest type code can only contain letters, numbers, underscores and hyphens']
  },
  category: {
    type: String,
    required: [true, 'Guest type category is required'],
    enum: [
      'individual', 'corporate', 'group', 'vip', 'frequent', 
      'walk_in', 'online', 'referral', 'other'
    ],
    index: true
  },
  description: {
    type: String,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  benefits: {
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    priorityCheckin: {
      type: Boolean,
      default: false
    },
    roomUpgrade: {
      type: Boolean,
      default: false
    },
    lateCheckout: {
      type: Boolean,
      default: false
    },
    welcomeAmenities: [{
      type: String,
      trim: true
    }],
    complimentaryServices: [{
      type: String,
      trim: true
    }],
    loyaltyPointsMultiplier: {
      type: Number,
      min: 0,
      max: 10,
      default: 1
    }
  },
  requirements: {
    minimumStay: {
      type: Number,
      min: 0,
      default: 0
    },
    advanceBooking: {
      type: Number,
      min: 0,
      default: 0
    },
    depositRequired: {
      type: Boolean,
      default: false
    },
    depositPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    identificationRequired: {
      type: Boolean,
      default: true
    },
    corporateApproval: {
      type: Boolean,
      default: false
    },
    creditCheck: {
      type: Boolean,
      default: false
    },
    minimumAge: {
      type: Number,
      min: 0,
      max: 120
    }
  },
  pricing: {
    rateMultiplier: {
      type: Number,
      min: 0,
      max: 10,
      default: 1.0
    },
    taxExempt: {
      type: Boolean,
      default: false
    },
    serviceChargeExempt: {
      type: Boolean,
      default: false
    },
    cityTaxExempt: {
      type: Boolean,
      default: false
    },
    tourismTaxExempt: {
      type: Boolean,
      default: false
    }
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color code'],
    default: '#3B82F6'
  },
  icon: {
    type: String,
    trim: true,
    default: 'user'
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
guestTypeSchema.index({ hotelId: 1, category: 1 });
guestTypeSchema.index({ hotelId: 1, isActive: 1 });
guestTypeSchema.index({ hotelId: 1, displayOrder: 1 });

// Ensure unique guest type codes per hotel
guestTypeSchema.index({ hotelId: 1, code: 1 }, { unique: true });

// Virtual for benefits summary
guestTypeSchema.virtual('benefitsSummary').get(function() {
  const benefits = [];
  if (this.benefits.discountPercentage > 0) {
    benefits.push(`${this.benefits.discountPercentage}% discount`);
  }
  if (this.benefits.priorityCheckin) benefits.push('Priority check-in');
  if (this.benefits.roomUpgrade) benefits.push('Room upgrade');
  if (this.benefits.lateCheckout) benefits.push('Late checkout');
  if (this.benefits.welcomeAmenities.length > 0) {
    benefits.push(`${this.benefits.welcomeAmenities.length} welcome amenities`);
  }
  if (this.benefits.loyaltyPointsMultiplier > 1) {
    benefits.push(`${this.benefits.loyaltyPointsMultiplier}x loyalty points`);
  }
  return benefits.join(', ');
});

// Virtual for requirements summary
guestTypeSchema.virtual('requirementsSummary').get(function() {
  const requirements = [];
  if (this.requirements.minimumStay > 0) {
    requirements.push(`Min ${this.requirements.minimumStay} nights`);
  }
  if (this.requirements.advanceBooking > 0) {
    requirements.push(`${this.requirements.advanceBooking} days advance booking`);
  }
  if (this.requirements.depositRequired) {
    requirements.push(`${this.requirements.depositPercentage}% deposit`);
  }
  if (this.requirements.corporateApproval) {
    requirements.push('Corporate approval');
  }
  if (this.requirements.creditCheck) {
    requirements.push('Credit check');
  }
  if (this.requirements.minimumAge) {
    requirements.push(`Min age: ${this.requirements.minimumAge}`);
  }
  return requirements.join(', ');
});

// Instance methods
guestTypeSchema.methods.calculateRate = function(baseRate) {
  return baseRate * this.pricing.rateMultiplier;
};

guestTypeSchema.methods.calculateDiscount = function(amount) {
  return amount * (this.benefits.discountPercentage / 100);
};

guestTypeSchema.methods.isEligibleForUpgrade = function() {
  return this.benefits.roomUpgrade;
};

guestTypeSchema.methods.getDepositAmount = function(totalAmount) {
  if (!this.requirements.depositRequired) return 0;
  return totalAmount * (this.requirements.depositPercentage / 100);
};

guestTypeSchema.methods.validateBooking = function(bookingData) {
  const errors = [];
  
  // Check minimum stay
  if (this.requirements.minimumStay > 0) {
    const nights = Math.ceil((new Date(bookingData.checkOut) - new Date(bookingData.checkIn)) / (1000 * 60 * 60 * 24));
    if (nights < this.requirements.minimumStay) {
      errors.push(`Minimum stay of ${this.requirements.minimumStay} nights required for ${this.name}`);
    }
  }
  
  // Check advance booking
  if (this.requirements.advanceBooking > 0) {
    const daysUntilCheckIn = Math.ceil((new Date(bookingData.checkIn) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntilCheckIn < this.requirements.advanceBooking) {
      errors.push(`Advance booking of ${this.requirements.advanceBooking} days required for ${this.name}`);
    }
  }
  
  // Check minimum age
  if (this.requirements.minimumAge && bookingData.guestAge) {
    if (bookingData.guestAge < this.requirements.minimumAge) {
      errors.push(`Minimum age of ${this.requirements.minimumAge} required for ${this.name}`);
    }
  }
  
  return errors;
};

// Static methods
guestTypeSchema.statics.getByCategory = function(hotelId, category) {
  return this.find({ hotelId, category, isActive: true })
    .sort({ displayOrder: 1, name: 1 })
    .populate('createdBy updatedBy', 'name email');
};

guestTypeSchema.statics.getActiveTypes = function(hotelId) {
  return this.find({ hotelId, isActive: true })
    .sort({ category: 1, displayOrder: 1, name: 1 })
    .populate('createdBy updatedBy', 'name email');
};

guestTypeSchema.statics.getVIPTypes = function(hotelId) {
  return this.find({ hotelId, category: 'vip', isActive: true })
    .sort({ displayOrder: 1, name: 1 });
};

guestTypeSchema.statics.getCorporateTypes = function(hotelId) {
  return this.find({ hotelId, category: 'corporate', isActive: true })
    .sort({ displayOrder: 1, name: 1 });
};

// Pre-save middleware
guestTypeSchema.pre('save', function(next) {
  // Ensure display order is set
  if (this.displayOrder === undefined || this.displayOrder === null) {
    this.displayOrder = 0;
  }
  
  // Validate deposit percentage if deposit is required
  if (this.requirements.depositRequired && this.requirements.depositPercentage <= 0) {
    return next(new Error('Deposit percentage must be greater than 0 when deposit is required'));
  }
  
  // Validate discount percentage
  if (this.benefits.discountPercentage < 0 || this.benefits.discountPercentage > 100) {
    return next(new Error('Discount percentage must be between 0 and 100'));
  }
  
  // Validate rate multiplier
  if (this.pricing.rateMultiplier < 0 || this.pricing.rateMultiplier > 10) {
    return next(new Error('Rate multiplier must be between 0 and 10'));
  }
  
  next();
});

const GuestType = mongoose.model('GuestType', guestTypeSchema);

export default GuestType;
