import express from 'express';
import Offer from '../models/Offer.js';
import Loyalty from '../models/Loyalty.js';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate, schemas } from '../middleware/validation.js';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Validation schemas for admin operations
const createOfferSchema = Joi.object({
  title: Joi.string().required().max(100),
  description: Joi.string().max(500),
  pointsRequired: Joi.number().integer().min(1).required(),
  discountPercentage: Joi.number().min(0).max(100),
  discountAmount: Joi.number().min(0),
  type: Joi.string().valid('discount', 'free_service', 'upgrade', 'bonus_points').required(),
  category: Joi.string().valid('room', 'dining', 'spa', 'transport', 'general').required(),
  minTier: Joi.string().valid('bronze', 'silver', 'gold', 'platinum').default('bronze'),
  validFrom: Joi.date().default(Date.now),
  validUntil: Joi.date(),
  maxRedemptions: Joi.number().integer().min(1),
  imageUrl: Joi.string().uri(),
  terms: Joi.string().max(1000)
}).custom((value, helpers) => {
  // Validate discount offers have either percentage or amount
  if (value.type === 'discount' && !value.discountPercentage && !value.discountAmount) {
    return helpers.error('any.custom', {
      message: 'Discount offers must have either discountPercentage or discountAmount'
    });
  }
  return value;
});

const updateOfferSchema = createOfferSchema.fork(['title', 'pointsRequired', 'type', 'category'], (schema) =>
  schema.optional()
);

const bulkOperationSchema = Joi.object({
  offerIds: Joi.array().items(Joi.string()).min(1).required(),
  operation: Joi.string().valid('activate', 'deactivate', 'delete').required()
});

/**
 * @swagger
 * /admin/loyalty/offers:
 *   get:
 *     summary: Get all offers for admin management
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [room, dining, spa, transport, general]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [discount, free_service, upgrade, bonus_points]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of offers with pagination
 */
router.get('/offers', authenticate, authorize(['admin', 'manager']), catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    category,
    type,
    isActive,
    search
  } = req.query;

  // Build query
  const query = {};
  
  if (category) query.category = category;
  if (type) query.type = type;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  
  // Add search functionality
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Get offers with pagination
  const offers = await Offer.find(query)
    .populate('hotelId', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count
  const total = await Offer.countDocuments(query);

  res.json({
    status: 'success',
    data: {
      offers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  });
}));

/**
 * @swagger
 * /admin/loyalty/offers:
 *   post:
 *     summary: Create a new offer
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOffer'
 *     responses:
 *       201:
 *         description: Offer created successfully
 */
router.post('/offers', 
  authenticate, 
  authorize(['admin', 'manager']), 
  validate(createOfferSchema),
  catchAsync(async (req, res) => {
    console.log('Creating new offer:', req.body);
    
    const offerData = {
      ...req.body,
      hotelId: req.user.hotelId // Associate with admin's hotel
    };
    
    const offer = new Offer(offerData);
    await offer.save();
    
    console.log('Offer created successfully:', offer._id);
    
    res.status(201).json({
      status: 'success',
      data: offer
    });
  })
);

/**
 * @swagger
 * /admin/loyalty/offers/{id}:
 *   get:
 *     summary: Get offer details for admin
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Offer details
 */
router.get('/offers/:id', authenticate, authorize(['admin', 'manager']), catchAsync(async (req, res) => {
  const offer = await Offer.findById(req.params.id)
    .populate('hotelId', 'name');
    
  if (!offer) {
    throw new ApplicationError('Offer not found', 404);
  }
  
  // Get redemption statistics
  const redemptionStats = await Loyalty.aggregate([
    { $match: { offerId: offer._id } },
    {
      $group: {
        _id: null,
        totalRedemptions: { $sum: 1 },
        totalPointsRedeemed: { $sum: { $abs: '$points' } }
      }
    }
  ]);

  const stats = redemptionStats[0] || { totalRedemptions: 0, totalPointsRedeemed: 0 };

  res.json({
    status: 'success',
    data: {
      offer,
      stats
    }
  });
}));

/**
 * @swagger
 * /admin/loyalty/offers/{id}:
 *   put:
 *     summary: Update an offer
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateOffer'
 *     responses:
 *       200:
 *         description: Offer updated successfully
 */
router.put('/offers/:id',
  authenticate,
  authorize(['admin', 'manager']),
  validate(updateOfferSchema),
  catchAsync(async (req, res) => {
    console.log('Updating offer:', req.params.id, req.body);
    
    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('hotelId', 'name');
    
    if (!offer) {
      throw new ApplicationError('Offer not found', 404);
    }
    
    console.log('Offer updated successfully:', offer._id);
    
    res.json({
      status: 'success',
      data: offer
    });
  })
);

/**
 * @swagger
 * /admin/loyalty/offers/{id}:
 *   delete:
 *     summary: Delete an offer
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Offer deleted successfully
 */
router.delete('/offers/:id', authenticate, authorize(['admin', 'manager']), catchAsync(async (req, res) => {
  console.log('Deleting offer:', req.params.id);
  
  const offer = await Offer.findByIdAndDelete(req.params.id);
  
  if (!offer) {
    throw new ApplicationError('Offer not found', 404);
  }
  
  console.log('Offer deleted successfully:', req.params.id);
  
  res.status(204).json({
    status: 'success',
    data: null
  });
}));

/**
 * @swagger
 * /admin/loyalty/offers/bulk:
 *   post:
 *     summary: Perform bulk operations on offers
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               offerIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               operation:
 *                 type: string
 *                 enum: [activate, deactivate, delete]
 *     responses:
 *       200:
 *         description: Bulk operation completed
 */
router.post('/offers/bulk',
  authenticate,
  authorize(['admin', 'manager']),
  validate(bulkOperationSchema),
  catchAsync(async (req, res) => {
    const { offerIds, operation } = req.body;
    
    console.log(`Performing bulk ${operation} on ${offerIds.length} offers`);
    
    let result;
    
    switch (operation) {
      case 'activate':
        result = await Offer.updateMany(
          { _id: { $in: offerIds } },
          { isActive: true }
        );
        break;
      case 'deactivate':
        result = await Offer.updateMany(
          { _id: { $in: offerIds } },
          { isActive: false }
        );
        break;
      case 'delete':
        result = await Offer.deleteMany({ _id: { $in: offerIds } });
        break;
      default:
        throw new ApplicationError('Invalid operation', 400);
    }
    
    console.log(`Bulk ${operation} completed:`, result);
    
    res.json({
      status: 'success',
      data: {
        operation,
        affectedCount: result.modifiedCount || result.deletedCount,
        details: result
      }
    });
  })
);

/**
 * @swagger
 * /admin/loyalty/analytics:
 *   get:
 *     summary: Get loyalty program analytics
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Loyalty analytics data
 */
router.get('/analytics', authenticate, authorize(['admin', 'manager']), catchAsync(async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  
  // Build date filter
  const dateFilter = {};
  if (dateFrom || dateTo) {
    dateFilter.createdAt = {};
    if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.createdAt.$lte = new Date(dateTo);
  }
  
  // Get offer performance analytics
  const offerPerformance = await Loyalty.aggregate([
    { $match: { type: 'redeemed', ...dateFilter } },
    {
      $group: {
        _id: '$offerId',
        totalRedemptions: { $sum: 1 },
        totalPointsRedeemed: { $sum: { $abs: '$points' } }
      }
    },
    {
      $lookup: {
        from: 'offers',
        localField: '_id',
        foreignField: '_id',
        as: 'offer'
      }
    },
    { $unwind: '$offer' },
    {
      $project: {
        offerTitle: '$offer.title',
        offerCategory: '$offer.category',
        offerType: '$offer.type',
        totalRedemptions: 1,
        totalPointsRedeemed: 1
      }
    },
    { $sort: { totalRedemptions: -1 } },
    { $limit: 10 }
  ]);
  
  // Get category breakdown
  const categoryBreakdown = await Loyalty.aggregate([
    { $match: { type: 'redeemed', ...dateFilter } },
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
        _id: '$offer.category',
        totalRedemptions: { $sum: 1 },
        totalPointsRedeemed: { $sum: { $abs: '$points' } }
      }
    },
    { $sort: { totalRedemptions: -1 } }
  ]);
  
  // Get overall stats
  const overallStats = await Loyalty.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalPoints: { $sum: '$points' }
      }
    }
  ]);
  
  // Get active offers count
  const activeOffersCount = await Offer.countDocuments({ isActive: true });
  const totalOffersCount = await Offer.countDocuments({});
  
  // Get user tier distribution
  const tierDistribution = await User.aggregate([
    { $match: { role: 'guest' } },
    {
      $group: {
        _id: '$loyalty.tier',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  res.json({
    status: 'success',
    data: {
      offerPerformance,
      categoryBreakdown,
      overallStats,
      offers: {
        active: activeOffersCount,
        total: totalOffersCount,
        inactive: totalOffersCount - activeOffersCount
      },
      tierDistribution
    }
  });
}));

/**
 * @swagger
 * /admin/loyalty/offers/{id}/stats:
 *   get:
 *     summary: Get detailed statistics for a specific offer
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detailed offer statistics
 */
router.get('/offers/:id/stats', authenticate, authorize(['admin', 'manager']), catchAsync(async (req, res) => {
  const offerId = req.params.id;
  
  // Verify offer exists
  const offer = await Offer.findById(offerId);
  if (!offer) {
    throw new ApplicationError('Offer not found', 404);
  }
  
  // Get redemption timeline
  const timeline = await Loyalty.aggregate([
    { $match: { offerId: offer._id, type: 'redeemed' } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        redemptions: { $sum: 1 },
        pointsRedeemed: { $sum: { $abs: '$points' } }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
    { $limit: 30 } // Last 30 days
  ]);
  
  // Get user tier breakdown for this offer
  const tierBreakdown = await Loyalty.aggregate([
    { $match: { offerId: offer._id, type: 'redeemed' } },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $group: {
        _id: '$user.loyalty.tier',
        redemptions: { $sum: 1 }
      }
    },
    { $sort: { redemptions: -1 } }
  ]);
  
  // Get recent redemptions
  const recentRedemptions = await Loyalty.find({ 
    offerId: offer._id, 
    type: 'redeemed' 
  })
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .limit(10);
  
  res.json({
    status: 'success',
    data: {
      offer,
      timeline,
      tierBreakdown,
      recentRedemptions
    }
  });
}));

export default router;
