import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         _id:
 *           type: string
 *           description: User ID
 *         salutationId:
 *           type: string
 *           description: Reference to salutation (Mr, Mrs, Dr, etc.)
 *         name:
 *           type: string
 *           description: User's full name
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         phone:
 *           type: string
 *           description: User's phone number
 *         role:
 *           type: string
 *           enum: [guest, staff, admin, manager]
 *           default: guest
 *           description: User role
 *         preferences:
 *           type: object
 *           properties:
 *             bedType:
 *               type: string
 *             floor:
 *               type: string
 *             smokingAllowed:
 *               type: boolean
 *             offers:
 *               type: object
 *               properties:
 *                 favoriteCategories:
 *                   type: array
 *                   items:
 *                     type: string
 *                     enum: [room, dining, spa, transport, general]
 *                 favoriteTypes:
 *                   type: array
 *                   items:
 *                     type: string
 *                     enum: [discount, free_service, upgrade, bonus_points]
 *                 priceRangePreference:
 *                   type: object
 *                   properties:
 *                     min:
 *                       type: number
 *                       default: 0
 *                     max:
 *                       type: number
 *                       default: 5000
 *                 notifications:
 *                   type: object
 *                   properties:
 *                     newOffers:
 *                       type: boolean
 *                       default: true
 *                     expiringOffers:
 *                       type: boolean
 *                       default: true
 *                     personalizedRecommendations:
 *                       type: boolean
 *                       default: true
 *         loyalty:
 *           type: object
 *           properties:
 *             points:
 *               type: number
 *               default: 0
 *             tier:
 *               type: string
 *               default: 'bronze'
 *         isActive:
 *           type: boolean
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const userSchema = new mongoose.Schema({
  salutationId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Salutation'
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['guest', 'staff', 'admin', 'manager'],
    default: 'guest'
  },
  guestType: {
    type: String,
    enum: ['normal', 'corporate'],
    default: 'normal'
  },
  corporateDetails: {
    corporateCompanyId: {
      type: mongoose.Schema.ObjectId,
      ref: 'CorporateCompany'
    },
    employeeId: {
      type: String,
      trim: true
    },
    department: {
      type: String,
      trim: true
    },
    designation: {
      type: String,
      trim: true
    },
    costCenter: {
      type: String,
      trim: true
    },
    approvalRequired: {
      type: Boolean,
      default: false
    },
    approverEmail: {
      type: String,
      lowercase: true
    }
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: function() {
      return this.role === 'staff' || this.role === 'admin';
    }
  },
  preferences: {
    bedType: {
      type: String,
      enum: ['single', 'double', 'queen', 'king']
    },
    floor: String,
    smokingAllowed: {
      type: Boolean,
      default: false
    },
    other: String,
    offers: {
      favoriteCategories: [{
        type: String,
        enum: ['room', 'dining', 'spa', 'transport', 'general']
      }],
      favoriteTypes: [{
        type: String,
        enum: ['discount', 'free_service', 'upgrade', 'bonus_points']
      }],
      priceRangePreference: {
        min: {
          type: Number,
          default: 0
        },
        max: {
          type: Number,
          default: 5000
        }
      },
      notifications: {
        newOffers: {
          type: Boolean,
          default: true
        },
        expiringOffers: {
          type: Boolean,
          default: true
        },
        personalizedRecommendations: {
          type: Boolean,
          default: true
        }
      }
    }
  },
  loyalty: {
    points: {
      type: Number,
      default: 0
    },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze'
    }
  },
  billingHistory: [{
    type: {
      type: String,
      enum: ['checkout_charges', 'booking_payment', 'service_charge', 'refund'],
      required: true
    },
    bookingId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Booking'
    },
    roomId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Room'
    },
    description: {
      type: String,
      required: true
    },
    items: [{
      name: String,
      category: String,
      status: String,
      quantity: Number,
      unitPrice: Number,
      totalPrice: Number,
      notes: String
    }],
    subtotal: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank_transfer']
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    },
    paidAt: Date,
    checkoutInventoryId: {
      type: mongoose.Schema.ObjectId,
      ref: 'CheckoutInventory'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  passwordResetToken: String,
  passwordResetExpires: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes - email has unique constraint in schema, only need compound index
userSchema.index({ hotelId: 1, role: 1 });

// Virtual for bookings
userSchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'userId'
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update loyalty tier based on points
userSchema.methods.updateLoyaltyTier = function() {
  const points = this.loyalty.points;
  
  if (points >= 10000) this.loyalty.tier = 'platinum';
  else if (points >= 5000) this.loyalty.tier = 'gold';
  else if (points >= 1000) this.loyalty.tier = 'silver';
  else this.loyalty.tier = 'bronze';
};

// Update offer preferences based on user behavior
userSchema.methods.updateOfferPreferences = function(category, type) {
  if (!this.preferences.offers) {
    this.preferences.offers = {
      favoriteCategories: [],
      favoriteTypes: [],
      priceRangePreference: { min: 0, max: 5000 },
      notifications: {
        newOffers: true,
        expiringOffers: true,
        personalizedRecommendations: true
      }
    };
  }
  
  // Add category if not already present
  if (category && !this.preferences.offers.favoriteCategories.includes(category)) {
    this.preferences.offers.favoriteCategories.push(category);
  }
  
  // Add type if not already present
  if (type && !this.preferences.offers.favoriteTypes.includes(type)) {
    this.preferences.offers.favoriteTypes.push(type);
  }
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

export default mongoose.model('User', userSchema);