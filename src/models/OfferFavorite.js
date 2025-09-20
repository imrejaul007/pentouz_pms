import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     OfferFavorite:
 *       type: object
 *       required:
 *         - userId
 *         - offerId
 *       properties:
 *         _id:
 *           type: string
 *           description: Favorite ID
 *         userId:
 *           type: string
 *           description: User ID who favorited the offer
 *         offerId:
 *           type: string
 *           description: Offer ID that was favorited
 *         notifyOnExpiry:
 *           type: boolean
 *           description: Whether to notify user when offer is about to expire
 *           default: true
 *         notifyOnUpdate:
 *           type: boolean
 *           description: Whether to notify user when offer is updated
 *           default: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const offerFavoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  offerId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Offer',
    required: [true, 'Offer ID is required'],
    index: true
  },
  notifyOnExpiry: {
    type: Boolean,
    default: true,
    description: 'Send notification when offer is about to expire'
  },
  notifyOnUpdate: {
    type: Boolean,
    default: false,
    description: 'Send notification when offer details are updated'
  },
  notes: {
    type: String,
    maxlength: [200, 'Notes cannot exceed 200 characters'],
    description: 'Personal notes about why this offer was favorited'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
offerFavoriteSchema.index({ userId: 1, offerId: 1 }, { unique: true }); // Prevent duplicate favorites
offerFavoriteSchema.index({ userId: 1, createdAt: -1 }); // For user's favorites list
offerFavoriteSchema.index({ notifyOnExpiry: 1, 'offer.validUntil': 1 }); // For expiry notifications

// Virtual populate for offer details
offerFavoriteSchema.virtual('offer', {
  ref: 'Offer',
  localField: 'offerId',
  foreignField: '_id',
  justOne: true
});

// Virtual populate for user details
offerFavoriteSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Static methods
offerFavoriteSchema.statics.getUserFavorites = async function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    category,
    type,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;

  const skip = (page - 1) * limit;
  
  // Build aggregation pipeline
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: 'offers',
        localField: 'offerId',
        foreignField: '_id',
        as: 'offer',
        pipeline: [
          { $match: { isActive: true } } // Only include active offers
        ]
      }
    },
    { $unwind: '$offer' },
    {
      $lookup: {
        from: 'hotels',
        localField: 'offer.hotelId',
        foreignField: '_id',
        as: 'offer.hotel'
      }
    },
    { $unwind: { path: '$offer.hotel', preserveNullAndEmptyArrays: true } }
  ];

  // Add filters if specified
  if (category) {
    pipeline.push({ $match: { 'offer.category': category } });
  }
  
  if (type) {
    pipeline.push({ $match: { 'offer.type': type } });
  }

  // Add sorting
  const sortOptions = {};
  if (sortBy === 'createdAt') {
    sortOptions.createdAt = sortOrder;
  } else if (sortBy === 'offerName') {
    sortOptions['offer.title'] = sortOrder;
  } else if (sortBy === 'pointsRequired') {
    sortOptions['offer.pointsRequired'] = sortOrder;
  } else if (sortBy === 'validUntil') {
    sortOptions['offer.validUntil'] = sortOrder;
  }
  
  pipeline.push({ $sort: sortOptions });

  // Get total count for pagination
  const countPipeline = [...pipeline, { $count: 'total' }];
  const countResult = await this.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  // Add pagination
  pipeline.push(
    { $skip: skip },
    { $limit: parseInt(limit) }
  );

  // Execute aggregation
  const favorites = await this.aggregate(pipeline);

  return {
    favorites,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  };
};

offerFavoriteSchema.statics.getOfferPopularity = async function(offerId) {
  const stats = await this.aggregate([
    { $match: { offerId: new mongoose.Types.ObjectId(offerId) } },
    {
      $group: {
        _id: null,
        totalFavorites: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $project: {
        _id: 0,
        totalFavorites: 1,
        uniqueUsers: { $size: '$uniqueUsers' }
      }
    }
  ]);

  return stats[0] || { totalFavorites: 0, uniqueUsers: 0 };
};

offerFavoriteSchema.statics.getPopularOffers = async function(options = {}) {
  const {
    limit = 10,
    category,
    minFavorites = 1,
    timeframe // 'week', 'month', 'year' or specific date
  } = options;

  const pipeline = [
    {
      $lookup: {
        from: 'offers',
        localField: 'offerId',
        foreignField: '_id',
        as: 'offer'
      }
    },
    { $unwind: '$offer' },
    { $match: { 'offer.isActive': true } }
  ];

  // Add time filter if specified
  if (timeframe) {
    let dateFilter = {};
    const now = new Date();
    
    if (timeframe === 'week') {
      dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    } else if (timeframe === 'month') {
      dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    } else if (timeframe === 'year') {
      dateFilter = { $gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
    } else if (timeframe instanceof Date) {
      dateFilter = { $gte: timeframe };
    }
    
    if (Object.keys(dateFilter).length > 0) {
      pipeline.push({ $match: { createdAt: dateFilter } });
    }
  }

  // Add category filter if specified
  if (category) {
    pipeline.push({ $match: { 'offer.category': category } });
  }

  // Group by offer and count favorites
  pipeline.push(
    {
      $group: {
        _id: '$offerId',
        offer: { $first: '$offer' },
        favoriteCount: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        latestFavorited: { $max: '$createdAt' }
      }
    },
    {
      $match: { favoriteCount: { $gte: minFavorites } }
    },
    {
      $project: {
        _id: 0,
        offerId: '$_id',
        offer: 1,
        favoriteCount: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        latestFavorited: 1,
        popularityScore: {
          $add: [
            '$favoriteCount',
            { $multiply: [{ $size: '$uniqueUsers' }, 0.5] } // Unique users weighted at 50%
          ]
        }
      }
    },
    { $sort: { popularityScore: -1, latestFavorited: -1 } },
    { $limit: parseInt(limit) }
  );

  return await this.aggregate(pipeline);
};

offerFavoriteSchema.statics.getUserRecommendations = async function(userId, options = {}) {
  const { limit = 5, excludeFavorites = true } = options;
  
  // Get user's favorite categories and types
  const userPreferences = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: 'offers',
        localField: 'offerId',
        foreignField: '_id',
        as: 'offer'
      }
    },
    { $unwind: '$offer' },
    {
      $group: {
        _id: null,
        favoriteCategories: { $addToSet: '$offer.category' },
        favoriteTypes: { $addToSet: '$offer.type' },
        avgPointsRange: { $avg: '$offer.pointsRequired' }
      }
    }
  ]);

  const preferences = userPreferences[0];
  if (!preferences) {
    // If user has no favorites, return popular offers
    const popular = await this.getPopularOffers({ limit });
    return popular.map(item => ({
      ...item,
      recommendationReason: 'Popular with other users',
      score: item.popularityScore
    }));
  }

  // Build recommendation pipeline
  const pipeline = [
    {
      $match: {
        isActive: true,
        $or: [
          { category: { $in: preferences.favoriteCategories } },
          { type: { $in: preferences.favoriteTypes } },
          {
            pointsRequired: {
              $gte: preferences.avgPointsRange * 0.7,
              $lte: preferences.avgPointsRange * 1.3
            }
          }
        ]
      }
    }
  ];

  // Exclude already favorited offers if requested
  if (excludeFavorites) {
    const userFavoriteOfferIds = await this.find({ userId }).distinct('offerId');
    if (userFavoriteOfferIds.length > 0) {
      pipeline.push({ $match: { _id: { $nin: userFavoriteOfferIds } } });
    }
  }

  // Add recommendation scoring
  pipeline.push(
    {
      $addFields: {
        recommendationScore: {
          $add: [
            { $cond: [{ $in: ['$category', preferences.favoriteCategories] }, 3, 0] },
            { $cond: [{ $in: ['$type', preferences.favoriteTypes] }, 2, 0] },
            {
              $cond: [
                {
                  $and: [
                    { $gte: ['$pointsRequired', preferences.avgPointsRange * 0.8] },
                    { $lte: ['$pointsRequired', preferences.avgPointsRange * 1.2] }
                  ]
                },
                1,
                0
              ]
            }
          ]
        },
        recommendationReason: {
          $cond: [
            { $in: ['$category', preferences.favoriteCategories] },
            { $concat: ['Based on your interest in ', '$category', ' offers'] },
            { $cond: [
              { $in: ['$type', preferences.favoriteTypes] },
              { $concat: ['You like ', '$type', ' offers'] },
              'Similar to your preferences'
            ]}
          ]
        }
      }
    },
    { $sort: { recommendationScore: -1, pointsRequired: 1 } },
    { $limit: parseInt(limit) }
  );

  const Offer = mongoose.model('Offer');
  return await Offer.aggregate(pipeline);
};

// Instance methods
offerFavoriteSchema.methods.shouldNotifyExpiry = function() {
  if (!this.notifyOnExpiry) return false;
  
  // Check if offer is expiring within 7 days
  if (this.offer && this.offer.validUntil) {
    const expiryDate = new Date(this.offer.validUntil);
    const now = new Date();
    const daysDiff = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    return daysDiff <= 7 && daysDiff > 0;
  }
  
  return false;
};

// Pre-save middleware
offerFavoriteSchema.pre('save', async function(next) {
  // Verify offer exists and is active
  const Offer = mongoose.model('Offer');
  const offer = await Offer.findById(this.offerId);
  
  if (!offer) {
    return next(new Error('Offer not found'));
  }
  
  if (!offer.isActive) {
    return next(new Error('Cannot favorite inactive offer'));
  }
  
  next();
});

// Post-save middleware for analytics
offerFavoriteSchema.post('save', async function(doc) {
  // Could trigger analytics events here
  console.log(`Offer ${doc.offerId} favorited by user ${doc.userId}`);
});

export default mongoose.model('OfferFavorite', offerFavoriteSchema);
