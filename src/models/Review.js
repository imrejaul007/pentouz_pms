import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       required:
 *         - hotelId
 *         - userId
 *         - rating
 *         - title
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         userId:
 *           type: string
 *           description: Guest user ID
 *         bookingId:
 *           type: string
 *           description: Associated booking ID (optional)
 *         rating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           description: Overall rating
 *         title:
 *           type: string
 *           description: Review title
 *         content:
 *           type: string
 *           description: Review content
 *         categories:
 *           type: object
 *           properties:
 *             cleanliness:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             service:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             location:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             value:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             amenities:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *         isVerified:
 *           type: boolean
 *           default: false
 *         isPublished:
 *           type: boolean
 *           default: true
 *         response:
 *           type: object
 *           properties:
 *             content:
 *               type: string
 *             respondedBy:
 *               type: string
 *             respondedAt:
 *               type: string
 *               format: date-time
 *         helpfulVotes:
 *           type: number
 *           default: 0
 *         reportedCount:
 *           type: number
 *           default: 0
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         visitType:
 *           type: string
 *           enum: [business, leisure, family, couple, solo]
 *         stayDate:
 *           type: string
 *           format: date
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const reviewSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking'
  },
  rating: {
    type: Number,
    required: [true, 'Overall rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  title: {
    type: String,
    required: [true, 'Review title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Review content is required'],
    maxlength: [2000, 'Review content cannot be more than 2000 characters']
  },
  categories: {
    cleanliness: {
      type: Number,
      min: 1,
      max: 5
    },
    service: {
      type: Number,
      min: 1,
      max: 5
    },
    location: {
      type: Number,
      min: 1,
      max: 5
    },
    value: {
      type: Number,
      min: 1,
      max: 5
    },
    amenities: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  response: {
    content: {
      type: String,
      maxlength: [1000, 'Response cannot be more than 1000 characters']
    },
    respondedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    respondedAt: Date
  },
  helpfulVotes: {
    type: Number,
    default: 0,
    min: 0
  },
  reportedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  images: [{
    type: String,
    match: [/^https?:\/\//, 'Image URL must be valid']
  }],
  visitType: {
    type: String,
    enum: {
      values: ['business', 'leisure', 'family', 'couple', 'solo'],
      message: 'Invalid visit type'
    }
  },
  stayDate: {
    type: Date
  },
  guestName: {
    type: String,
    trim: true
  },
  roomType: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    enum: ['direct', 'booking_com', 'google', 'tripadvisor', 'expedia'],
    default: 'direct'
  },
  language: {
    type: String,
    default: 'en'
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  moderationNotes: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
reviewSchema.index({ hotelId: 1, isPublished: 1, rating: 1 });
reviewSchema.index({ userId: 1, createdAt: -1 });
reviewSchema.index({ bookingId: 1 });
reviewSchema.index({ moderationStatus: 1 });
reviewSchema.index({ isVerified: 1, rating: 1 });

// Virtual for average category rating
reviewSchema.virtual('averageCategoryRating').get(function() {
  if (!this.categories) return null;
  
  const ratings = Object.values(this.categories).filter(rating => rating != null);
  if (ratings.length === 0) return null;
  
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
});

// Pre-save middleware to set verification status
reviewSchema.pre('save', async function(next) {
  if (this.isNew && this.bookingId) {
    // Auto-verify if review is linked to a completed booking
    const Booking = mongoose.model('Booking');
    const booking = await Booking.findById(this.bookingId);
    
    if (booking && booking.status === 'checked_out' && booking.userId.toString() === this.userId.toString()) {
      this.isVerified = true;
      this.stayDate = booking.checkOut;
    }
  }
  next();
});

// Static method to get hotel rating summary
reviewSchema.statics.getHotelRatingSummary = async function(hotelId) {
  const pipeline = [
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        isPublished: true,
        moderationStatus: 'approved'
      }
    },
    {
      $group: {
        _id: '$hotelId',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        },
        categoryAverages: {
          $push: {
            cleanliness: '$categories.cleanliness',
            service: '$categories.service',
            location: '$categories.location',
            value: '$categories.value',
            amenities: '$categories.amenities'
          }
        }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  if (!result.length) return null;

  const summary = result[0];
  
  // Calculate rating distribution
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  summary.ratingDistribution.forEach(rating => {
    distribution[Math.floor(rating)]++;
  });

  // Calculate category averages
  const categoryAverages = {};
  const categories = ['cleanliness', 'service', 'location', 'value', 'amenities'];
  
  categories.forEach(category => {
    const ratings = summary.categoryAverages
      .map(cat => cat[category])
      .filter(rating => rating != null);
    
    if (ratings.length > 0) {
      categoryAverages[category] = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    }
  });

  return {
    averageRating: Math.round(summary.averageRating * 10) / 10,
    totalReviews: summary.totalReviews,
    ratingDistribution: distribution,
    categoryAverages
  };
};

// Static method to get recent reviews
reviewSchema.statics.getRecentReviews = async function(hotelId, limit = 10) {
  return await this.find({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isPublished: true,
    moderationStatus: 'approved'
  })
  .populate('userId', 'name')
  .sort('-createdAt')
  .limit(limit)
  .select('rating title content categories stayDate visitType response createdAt');
};

// Instance method to add response
reviewSchema.methods.addResponse = function(content, respondedBy) {
  this.response = {
    content,
    respondedBy,
    respondedAt: new Date()
  };
  return this.save();
};

// Instance method to moderate review
reviewSchema.methods.moderate = function(status, notes = '') {
  this.moderationStatus = status;
  if (notes) this.moderationNotes = notes;
  if (status === 'rejected') this.isPublished = false;
  return this.save();
};

export default mongoose.model('Review', reviewSchema);
