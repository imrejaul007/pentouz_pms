import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Offer:
 *       type: object
 *       required:
 *         - hotelId
 *         - title
 *         - pointsRequired
 *         - type
 *         - category
 *       properties:
 *         _id:
 *           type: string
 *           description: Offer ID
 *         hotelId:
 *           type: string
 *           description: Hotel ID where offer is available
 *         title:
 *           type: string
 *           description: Offer title
 *         description:
 *           type: string
 *           description: Detailed offer description
 *         pointsRequired:
 *           type: number
 *           description: Points needed to redeem this offer
 *         discountPercentage:
 *           type: number
 *           description: Percentage discount (for discount offers)
 *         discountAmount:
 *           type: number
 *           description: Fixed discount amount (for discount offers)
 *         type:
 *           type: string
 *           enum: [discount, free_service, upgrade, bonus_points]
 *           description: Type of offer
 *         category:
 *           type: string
 *           enum: [room, dining, spa, transport, general]
 *           description: Offer category
 *         isActive:
 *           type: boolean
 *           description: Whether offer is currently active
 *         validFrom:
 *           type: string
 *           format: date-time
 *           description: When offer becomes valid
 *         validUntil:
 *           type: string
 *           format: date-time
 *           description: When offer expires
 *         maxRedemptions:
 *           type: number
 *           description: Maximum number of times this offer can be redeemed
 *         currentRedemptions:
 *           type: number
 *           description: Current number of redemptions
 *         minTier:
 *           type: string
 *           enum: [bronze, silver, gold, platinum]
 *           description: Minimum loyalty tier required
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const offerSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  title: {
    type: String,
    required: [true, 'Offer title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  pointsRequired: {
    type: Number,
    required: [true, 'Points required is required'],
    min: [1, 'Points required must be at least 1'],
    validate: {
      validator: function(value) {
        return Number.isInteger(value) && value > 0;
      },
      message: 'Points required must be a positive integer'
    }
  },
  discountPercentage: {
    type: Number,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100%'],
    validate: {
      validator: function(value) {
        if (this.type === 'discount' && !value && !this.discountAmount) {
          return false;
        }
        return true;
      },
      message: 'Discount offers must have either percentage or amount'
    }
  },
  discountAmount: {
    type: Number,
    min: [0, 'Discount amount cannot be negative'],
    validate: {
      validator: function(value) {
        if (this.type === 'discount' && !value && !this.discountPercentage) {
          return false;
        }
        return true;
      },
      message: 'Discount offers must have either percentage or amount'
    }
  },
  type: {
    type: String,
    enum: ['discount', 'free_service', 'upgrade', 'bonus_points'],
    required: [true, 'Offer type is required']
  },
  category: {
    type: String,
    enum: ['room', 'dining', 'spa', 'transport', 'general'],
    required: [true, 'Offer category is required']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    validate: {
      validator: function(value) {
        if (value && this.validFrom && value <= this.validFrom) {
          return false;
        }
        return true;
      },
      message: 'Valid until date must be after valid from date'
    }
  },
  maxRedemptions: {
    type: Number,
    min: [1, 'Max redemptions must be at least 1'],
    validate: {
      validator: function(value) {
        return Number.isInteger(value) && value > 0;
      },
      message: 'Max redemptions must be a positive integer'
    }
  },
  currentRedemptions: {
    type: Number,
    default: 0,
    min: [0, 'Current redemptions cannot be negative'],
    validate: {
      validator: function(value) {
        if (this.maxRedemptions && value > this.maxRedemptions) {
          return false;
        }
        return true;
      },
      message: 'Current redemptions cannot exceed max redemptions'
    }
  },
  minTier: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum'],
    default: 'bronze'
  },
  imageUrl: {
    type: String,
    validate: {
      validator: function(value) {
        if (value && !value.match(/^https?:\/\/.+/)) {
          return false;
        }
        return true;
      },
      message: 'Image URL must be a valid HTTP/HTTPS URL'
    }
  },
  terms: {
    type: String,
    maxlength: [1000, 'Terms cannot exceed 1000 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
offerSchema.index({ hotelId: 1, isActive: 1 });
offerSchema.index({ hotelId: 1, category: 1, isActive: 1 });
offerSchema.index({ minTier: 1, isActive: 1 });
offerSchema.index({ validUntil: 1 }, { expireAfterSeconds: 0 });

// Virtual for checking if offer is currently valid
offerSchema.virtual('isValid').get(function() {
  const now = new Date();
  
  if (!this.isActive) return false;
  if (this.validFrom && now < this.validFrom) return false;
  if (this.validUntil && now > this.validUntil) return false;
  if (this.maxRedemptions && this.currentRedemptions >= this.maxRedemptions) return false;
  
  return true;
});

// Virtual for remaining redemptions
offerSchema.virtual('remainingRedemptions').get(function() {
  if (!this.maxRedemptions) return null;
  return Math.max(0, this.maxRedemptions - this.currentRedemptions);
});

// Virtual for discount display
offerSchema.virtual('discountDisplay').get(function() {
  if (this.type !== 'discount') return null;
  
  if (this.discountPercentage) {
    return `${this.discountPercentage}% off`;
  } else if (this.discountAmount) {
    return `₹${this.discountAmount} off`;
  }
  return null;
});

// Static method to get available offers for a user
offerSchema.statics.getAvailableOffers = async function(userId, userTier, hotelId = null) {
  const query = {
    isActive: true,
    minTier: { $lte: userTier },
    $or: [
      { validUntil: { $gt: new Date() } },
      { validUntil: { $exists: false } }
    ]
  };
  
  if (hotelId) {
    query.hotelId = hotelId;
  }
  
  const offers = await this.find(query)
    .sort({ pointsRequired: 1, createdAt: -1 })
    .populate('hotelId', 'name');
    
  return offers.filter(offer => offer.isValid);
};

// Static method to get offers by category
offerSchema.statics.getOffersByCategory = async function(category, hotelId = null) {
  const query = {
    category,
    isActive: true,
    $or: [
      { validUntil: { $gt: new Date() } },
      { validUntil: { $exists: false } }
    ]
  };
  
  if (hotelId) {
    query.hotelId = hotelId;
  }
  
  return await this.find(query)
    .sort({ pointsRequired: 1 })
    .populate('hotelId', 'name');
};

// Helper function to get tier hierarchy value
const getTierValue = (tier) => {
  const tierValues = {
    bronze: 0,
    silver: 1,
    gold: 2,
    platinum: 3
  };
  return tierValues[tier] || 0;
};

// Instance method to check if user can redeem this offer
offerSchema.methods.canRedeem = function(userTier, userPoints) {
  if (!this.isValid) return false;
  if (getTierValue(userTier) < getTierValue(this.minTier)) return false;
  if (userPoints < this.pointsRequired) return false;
  return true;
};

// Instance method to increment redemption count
offerSchema.methods.incrementRedemption = async function() {
  if (this.maxRedemptions && this.currentRedemptions >= this.maxRedemptions) {
    throw new Error('Maximum redemptions reached for this offer');
  }
  
  this.currentRedemptions += 1;
  return await this.save();
};

// Pre-save middleware to validate offer
offerSchema.pre('save', function(next) {
  if (this.type === 'discount' && !this.discountPercentage && !this.discountAmount) {
    return next(new Error('Discount offers must have either percentage or amount'));
  }
  
  if (this.validUntil && this.validFrom && this.validUntil <= this.validFrom) {
    return next(new Error('Valid until date must be after valid from date'));
  }
  
  next();
});

export default mongoose.model('Offer', offerSchema);
