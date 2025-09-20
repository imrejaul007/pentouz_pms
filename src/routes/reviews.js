import express from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import Hotel from '../models/Hotel.js';
import User from '../models/User.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Create a new review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotelId
 *               - rating
 *               - title
 *               - content
 *             properties:
 *               hotelId:
 *                 type: string
 *               bookingId:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               categories:
 *                 type: object
 *                 properties:
 *                   cleanliness:
 *                     type: number
 *                   service:
 *                     type: number
 *                   location:
 *                     type: number
 *                   value:
 *                     type: number
 *                   amenities:
 *                     type: number
 *               visitType:
 *                 type: string
 *               stayDate:
 *                 type: string
 *                 format: date
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Review created successfully
 */
router.post('/', authenticate, catchAsync(async (req, res) => {
  const {
    hotelId,
    bookingId,
    rating,
    title,
    content,
    categories,
    visitType,
    stayDate,
    images
  } = req.body;

  // Verify hotel exists
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) {
    throw new ApplicationError('Hotel not found', 404);
  }

  // Check if booking exists and belongs to user (if provided)
  if (bookingId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }
    if (booking.userId.toString() !== req.user._id.toString()) {
      throw new ApplicationError('You can only review your own bookings', 403);
    }
    if (booking.hotelId.toString() !== hotelId) {
      throw new ApplicationError('Booking does not match hotel', 400);
    }

    // Check if review already exists for this booking
    const existingReview = await Review.findOne({ bookingId });
    if (existingReview) {
      throw new ApplicationError('You have already reviewed this booking', 400);
    }
  } else {
    // Check if user has already reviewed this hotel (without booking)
    const existingReview = await Review.findOne({ 
      hotelId, 
      userId: req.user._id,
      bookingId: { $exists: false }
    });
    if (existingReview) {
      throw new ApplicationError('You have already reviewed this hotel', 400);
    }
  }

  const review = await Review.create({
    hotelId,
    userId: req.user._id,
    bookingId,
    rating,
    title,
    content,
    categories,
    visitType,
    stayDate,
    images: images || [],
    guestName: req.user.name
  });

  await review.populate([
    { path: 'hotelId', select: 'name' },
    { path: 'userId', select: 'name' }
  ]);

  res.status(201).json({
    status: 'success',
    data: { review }
  });
}));

/**
 * @swagger
 * /reviews/hotel/{hotelId}:
 *   get:
 *     summary: Get reviews for a specific hotel
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [newest, oldest, highest_rated, lowest_rated, most_helpful]
 *     responses:
 *       200:
 *         description: Hotel reviews and summary
 */
router.get('/hotel/:hotelId', optionalAuth, catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  const {
    page = 1,
    limit = 10,
    rating,
    sortBy = 'newest'
  } = req.query;

  console.log('=== REVIEWS API DEBUG ===');
  console.log('Hotel ID from params:', hotelId);
  console.log('Query params:', { page, limit, rating, sortBy });

  const query = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isPublished: true,
    moderationStatus: 'approved'
  };

  console.log('MongoDB query:', query);

  if (rating) {
    query.rating = parseInt(rating);
  }

  // Sort options
  let sortOption = '-createdAt'; // newest by default
  switch (sortBy) {
    case 'oldest':
      sortOption = 'createdAt';
      break;
    case 'highest_rated':
      sortOption = '-rating';
      break;
    case 'lowest_rated':
      sortOption = 'rating';
      break;
    case 'most_helpful':
      sortOption = '-helpfulVotes';
      break;
  }

  console.log('Sort option:', sortOption);

  const skip = (page - 1) * limit;
  console.log('Skip:', skip, 'Limit:', limit);

  // Test raw query first
  console.log('Testing raw Review.find query...');
  const testReviews = await Review.find({ hotelId: new mongoose.Types.ObjectId(hotelId) });
  console.log('Raw hotel query found:', testReviews.length, 'reviews');

  const [reviews, total, summary] = await Promise.all([
    Review.find(query)
      .populate('hotelId', 'name address')
      .populate('userId', 'name')
      .populate('bookingId', 'bookingNumber checkIn checkOut')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit)),
    Review.countDocuments(query),
    Review.getHotelRatingSummary(hotelId)
  ]);

  console.log('Query results:');
  console.log('- Reviews found:', reviews.length);
  console.log('- Total count:', total);
  console.log('- Summary:', summary);
  console.log('=== END DEBUG ===');

  res.json({
    status: 'success',
    data: {
      reviews,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /reviews/hotel/{hotelId}/summary:
 *   get:
 *     summary: Get hotel rating summary
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hotel rating summary
 */
router.get('/hotel/:hotelId/summary', catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  
  const summary = await Review.getHotelRatingSummary(hotelId);
  
  if (!summary) {
    return res.json({
      status: 'success',
      data: {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        categoryAverages: {}
      }
    });
  }

  res.json({
    status: 'success',
    data: summary
  });
}));

/**
 * @swagger
 * /reviews/{id}:
 *   get:
 *     summary: Get specific review
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review details
 */
router.get('/:id', catchAsync(async (req, res) => {
  const review = await Review.findById(req.params.id)
    .populate('hotelId', 'name address')
    .populate('userId', 'name')
    .populate('bookingId', 'bookingNumber checkIn checkOut')
    .populate('response.respondedBy', 'name role');

  if (!review || (!review.isPublished && review.moderationStatus !== 'approved')) {
    throw new ApplicationError('Review not found', 404);
  }

  res.json({
    status: 'success',
    data: { review }
  });
}));

/**
 * @swagger
 * /reviews/{id}/response:
 *   post:
 *     summary: Add response to review (staff/admin only)
 *     tags: [Reviews]
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
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Response added successfully
 */
router.post('/:id/response', authenticate, authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { content } = req.body;
  
  const review = await Review.findById(req.params.id);
  if (!review) {
    throw new ApplicationError('Review not found', 404);
  }

  // Staff can only respond to reviews for their hotel
  if (req.user.role === 'staff' && review.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only respond to reviews for your hotel', 403);
  }

  await review.addResponse(content, req.user._id);
  
  await review.populate([
    { path: 'response.respondedBy', select: 'name role' }
  ]);

  res.json({
    status: 'success',
    message: 'Response added successfully',
    data: { review }
  });
}));

/**
 * @swagger
 * /reviews/{id}/helpful:
 *   post:
 *     summary: Mark review as helpful
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review marked as helpful
 */
router.post('/:id/helpful', catchAsync(async (req, res) => {
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { $inc: { helpfulVotes: 1 } },
    { new: true }
  );

  if (!review) {
    throw new ApplicationError('Review not found', 404);
  }

  res.json({
    status: 'success',
    message: 'Review marked as helpful',
    data: { helpfulVotes: review.helpfulVotes }
  });
}));

/**
 * @swagger
 * /reviews/{id}/report:
 *   post:
 *     summary: Report review as inappropriate
 *     tags: [Reviews]
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
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review reported successfully
 */
router.post('/:id/report', catchAsync(async (req, res) => {
  const { reason } = req.body;
  
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { $inc: { reportedCount: 1 } },
    { new: true }
  );

  if (!review) {
    throw new ApplicationError('Review not found', 404);
  }

  // Auto-hide review if reported too many times
  if (review.reportedCount >= 5) {
    review.moderationStatus = 'pending';
    review.isPublished = false;
    await review.save();
  }

  res.json({
    status: 'success',
    message: 'Review reported successfully'
  });
}));

/**
 * @swagger
 * /reviews/{id}/moderate:
 *   patch:
 *     summary: Moderate review (admin only)
 *     tags: [Reviews]
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
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected, pending]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review moderated successfully
 */
router.patch('/:id/moderate', authenticate, authorize('admin'), catchAsync(async (req, res) => {
  const { status, notes } = req.body;
  
  const review = await Review.findById(req.params.id);
  if (!review) {
    throw new ApplicationError('Review not found', 404);
  }

  await review.moderate(status, notes);

  res.json({
    status: 'success',
    message: 'Review moderated successfully',
    data: { review }
  });
}));

/**
 * @swagger
 * /reviews/pending:
 *   get:
 *     summary: Get pending reviews for moderation (admin only)
 *     tags: [Reviews]
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
 *     responses:
 *       200:
 *         description: Pending reviews
 */
router.get('/pending', authenticate, authorize('admin'), catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20
  } = req.query;

  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find({ moderationStatus: 'pending' })
      .populate('hotelId', 'name')
      .populate('userId', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit)),
    Review.countDocuments({ moderationStatus: 'pending' })
  ]);

  res.json({
    status: 'success',
    data: {
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /reviews/user/my-reviews:
 *   get:
 *     summary: Get current user's reviews
 *     tags: [Reviews]
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
 *           default: 10
 *     responses:
 *       200:
 *         description: User's reviews
 */
router.get('/user/my-reviews', authenticate, catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10
  } = req.query;

  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find({ userId: req.user._id })
      .populate('hotelId', 'name address')
      .populate('bookingId', 'bookingNumber')
      .populate('response.respondedBy', 'name')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit)),
    Review.countDocuments({ userId: req.user._id })
  ]);

  res.json({
    status: 'success',
    data: {
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

export default router;