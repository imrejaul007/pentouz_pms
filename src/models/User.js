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
 *           enum: [guest, staff, admin, manager, travel_agent]
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
    enum: ['guest', 'staff', 'admin', 'manager', 'travel_agent'],
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
  billingDetails: {
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please enter a valid GST number']
    },
    companyName: {
      type: String,
      trim: true,
      maxlength: [200, 'Company name cannot be more than 200 characters']
    },
    billingAddress: {
      street: {
        type: String,
        trim: true
      },
      city: {
        type: String,
        trim: true
      },
      state: {
        type: String,
        trim: true
      },
      postalCode: {
        type: String,
        trim: true
      },
      country: {
        type: String,
        trim: true,
        default: 'India'
      }
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number']
    },
    billingContactPerson: {
      type: String,
      trim: true
    },
    billingEmail: {
      type: String,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid billing email']
    },
    billingPhone: {
      type: String,
      match: [/^\+?[\d\s-()]+$/, 'Please enter a valid billing phone number']
    }
  },
  travelAgentDetails: {
    travelAgentId: {
      type: mongoose.Schema.ObjectId,
      ref: 'TravelAgent'
    },
    agentCode: {
      type: String,
      trim: true,
      uppercase: true
    },
    commissionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 10
    },
    bookingLimits: {
      maxBookingsPerDay: {
        type: Number,
        default: 50
      },
      maxRoomsPerBooking: {
        type: Number,
        default: 10
      }
    },
    specialRatesAccess: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active'
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
  // Additional fields for settings
  avatar: {
    type: String,
    default: null
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  language: {
    type: String,
    default: 'en'
  },
  department: {
    type: String,
    default: null
  },
  employeeId: {
    type: String,
    default: null
  },
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

// Update billing details
userSchema.methods.updateBillingDetails = function(billingData) {
  if (!this.billingDetails) {
    this.billingDetails = {};
  }

  Object.assign(this.billingDetails, billingData);

  // If GST number is provided, mark as corporate guest
  if (billingData.gstNumber) {
    this.guestType = 'corporate';
  }
};

// Validate GST number format
userSchema.methods.validateGSTNumber = function(gstNumber) {
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gstNumber);
};

// Get formatted billing address
userSchema.methods.getFormattedBillingAddress = function() {
  if (!this.billingDetails || !this.billingDetails.billingAddress) {
    return '';
  }

  const addr = this.billingDetails.billingAddress;
  const parts = [addr.street, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean);
  return parts.join(', ');
};

// Check if user has complete billing information
userSchema.methods.hasCompleteBillingInfo = function() {
  if (!this.billingDetails) return false;

  const required = ['gstNumber', 'companyName'];
  return required.every(field => this.billingDetails[field]);
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