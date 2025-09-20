import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Loyalty:
 *       type: object
 *       required:
 *         - userId
 *         - hotelId
 *         - type
 *         - points
 *         - description
 *       properties:
 *         _id:
 *           type: string
 *           description: Loyalty transaction ID
 *         userId:
 *           type: string
 *           description: User ID who earned/redeemed points
 *         hotelId:
 *           type: string
 *           description: Hotel ID where transaction occurred
 *         type:
 *           type: string
 *           enum: [earned, redeemed, expired, bonus]
 *           description: Type of loyalty transaction
 *         points:
 *           type: number
 *           description: Points earned (positive) or redeemed (negative)
 *         description:
 *           type: string
 *           description: Human-readable description of transaction
 *         bookingId:
 *           type: string
 *           description: Associated booking ID (for earned points)
 *         offerId:
 *           type: string
 *           description: Associated offer ID (for redemptions)
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: When points expire (if applicable)
 *         metadata:
 *           type: object
 *           description: Additional transaction data
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const loyaltySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  type: {
    type: String,
    enum: ['earned', 'redeemed', 'expired', 'bonus'],
    required: [true, 'Transaction type is required']
  },
  points: {
    type: Number,
    required: [true, 'Points amount is required'],
    validate: {
      validator: function(value) {
        // Points can be positive (earned) or negative (redeemed)
        return typeof value === 'number' && !isNaN(value);
      },
      message: 'Points must be a valid number'
    }
  },
  description: {
    type: String,
    required: [true, 'Transaction description is required'],
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    index: true
  },
  offerId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Offer',
    index: true
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Points expire after 2 years by default
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 2);
      return expiryDate;
    }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
loyaltySchema.index({ userId: 1, createdAt: -1 });
loyaltySchema.index({ userId: 1, type: 1 });
loyaltySchema.index({ hotelId: 1, type: 1 });
loyaltySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for checking if points are expired
loyaltySchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Virtual for transaction value (positive for earned, negative for redeemed)
loyaltySchema.virtual('transactionValue').get(function() {
  return this.points;
});

// Static method to get user's total points
loyaltySchema.statics.getUserTotalPoints = async function(userId) {
  const result = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, totalPoints: { $sum: '$points' } } }
  ]);
  return result.length > 0 ? result[0].totalPoints : 0;
};

// Static method to get user's active points (not expired)
loyaltySchema.statics.getUserActivePoints = async function(userId) {
  const result = await this.aggregate([
    { 
      $match: { 
        userId: new mongoose.Types.ObjectId(userId),
        $or: [
          { expiresAt: { $gt: new Date() } },
          { expiresAt: { $exists: false } }
        ]
      } 
    },
    { $group: { _id: null, totalPoints: { $sum: '$points' } } }
  ]);
  return result.length > 0 ? result[0].totalPoints : 0;
};

// Static method to get user's transaction history
loyaltySchema.statics.getUserHistory = async function(userId, options = {}) {
  const { page = 1, limit = 20, type } = options;
  const skip = (page - 1) * limit;
  
  const matchQuery = { userId: new mongoose.Types.ObjectId(userId) };
  if (type) {
    matchQuery.type = type;
  }
  
  const transactions = await this.find(matchQuery)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('bookingId', 'bookingNumber checkIn checkOut totalAmount')
    .populate('offerId', 'title category')
    .populate('hotelId', 'name');
    
  const total = await this.countDocuments(matchQuery);
  
  return {
    transactions,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  };
};

// Instance method to check if transaction is valid
loyaltySchema.methods.isValid = function() {
  if (this.isExpired) return false;
  if (this.points === 0) return false;
  return true;
};

export default mongoose.model('Loyalty', loyaltySchema);
