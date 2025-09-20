import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import mongoose from 'mongoose';

// Get all guests with advanced filtering and search
export const getAllGuests = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    loyaltyTier,
    guestType,
    hasBookings,
    hasReviews,
    lastStayDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    hotelId
  } = req.query;

  // Build query
  const query = { role: 'guest' };
  
  if (hotelId) {
    query.hotelId = hotelId;
  }

  // Search functionality
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  // Filter by loyalty tier
  if (loyaltyTier) {
    query['loyalty.tier'] = loyaltyTier;
  }

  // Filter by guest type
  if (guestType) {
    query.guestType = guestType;
  }

  // Filter by booking history
  if (hasBookings === 'true') {
    const guestsWithBookings = await Booking.distinct('userId', { hotelId });
    query._id = { $in: guestsWithBookings };
  } else if (hasBookings === 'false') {
    const guestsWithBookings = await Booking.distinct('userId', { hotelId });
    query._id = { $nin: guestsWithBookings };
  }

  // Filter by review history
  if (hasReviews === 'true') {
    const guestsWithReviews = await Review.distinct('userId', { hotelId });
    query._id = { $in: guestsWithReviews };
  } else if (hasReviews === 'false') {
    const guestsWithReviews = await Review.distinct('userId', { hotelId });
    query._id = { $nin: guestsWithReviews };
  }

  // Filter by last stay date
  if (lastStayDate) {
    const date = new Date(lastStayDate);
    const guestsWithRecentStays = await Booking.distinct('userId', {
      hotelId,
      checkOut: { $gte: date }
    });
    query._id = { $in: guestsWithRecentStays };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  const guests = await User.find(query)
    .populate('salutationId', 'title fullForm')
    .select('-password -passwordResetToken -passwordResetExpires')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(query);

  // Get additional data for each guest
  const guestsWithStats = await Promise.all(
    guests.map(async (guest) => {
      const [bookingStats, reviewStats] = await Promise.all([
        // Booking statistics
        Booking.aggregate([
          { $match: { userId: guest._id, hotelId: guest.hotelId } },
          {
            $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              totalNights: { $sum: { $subtract: ['$checkOut', '$checkIn'] } },
              totalSpent: { $sum: '$totalAmount' },
              lastStay: { $max: '$checkOut' }
            }
          }
        ]),
        // Review statistics
        Review.aggregate([
          { $match: { userId: guest._id, hotelId: guest.hotelId } },
          {
            $group: {
              _id: null,
              totalReviews: { $sum: 1 },
              averageRating: { $avg: '$rating' }
            }
          }
        ])
      ]);

      return {
        ...guest.toObject(),
        stats: {
          bookings: bookingStats[0] || { totalBookings: 0, totalNights: 0, totalSpent: 0, lastStay: null },
          reviews: reviewStats[0] || { totalReviews: 0, averageRating: 0 }
        }
      };
    })
  );

  res.json({
    status: 'success',
    results: guestsWithStats.length,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    },
    data: { guests: guestsWithStats }
  });
});

// Get guest by ID with detailed information
export const getGuest = catchAsync(async (req, res) => {
  const guest = await User.findById(req.params.id)
    .populate('salutationId', 'title fullForm')
    .select('-password -passwordResetToken -passwordResetExpires');

  if (!guest || guest.role !== 'guest') {
    throw new ApplicationError('Guest not found', 404);
  }

  // Get detailed statistics
  const [bookingStats, recentBookings, reviews] = await Promise.all([
    // Booking statistics
    Booking.aggregate([
      { $match: { userId: guest._id, hotelId: guest.hotelId } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalNights: { $sum: { $subtract: ['$checkOut', '$checkIn'] } },
          totalSpent: { $sum: '$totalAmount' },
          averageStayLength: { $avg: { $subtract: ['$checkOut', '$checkIn'] } },
          firstStay: { $min: '$checkIn' },
          lastStay: { $max: '$checkOut' }
        }
      }
    ]),
    // Recent bookings
    Booking.find({ userId: guest._id, hotelId: guest.hotelId })
      .populate('rooms.roomId', 'roomNumber type')
      .sort({ createdAt: -1 })
      .limit(5),
    // Reviews
    Review.find({ userId: guest._id, hotelId: guest.hotelId })
      .sort({ createdAt: -1 })
      .limit(5)
  ]);

  const guestWithDetails = {
    ...guest.toObject(),
    stats: {
      bookings: bookingStats[0] || {
        totalBookings: 0,
        totalNights: 0,
        totalSpent: 0,
        averageStayLength: 0,
        firstStay: null,
        lastStay: null
      },
      recentBookings,
      reviews
    }
  };

  res.json({
    status: 'success',
    data: { guest: guestWithDetails }
  });
});

// Create new guest
export const createGuest = catchAsync(async (req, res) => {
  const guestData = {
    ...req.body,
    role: 'guest',
    hotelId: req.user.hotelId
  };

  const guest = await User.create(guestData);
  await guest.populate('salutationId', 'title fullForm');

  res.status(201).json({
    status: 'success',
    data: { guest }
  });
});

// Update guest
export const updateGuest = catchAsync(async (req, res) => {
  const guest = await User.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  )
    .populate('salutationId', 'title fullForm')
    .select('-password -passwordResetToken -passwordResetExpires');

  if (!guest || guest.role !== 'guest') {
    throw new ApplicationError('Guest not found', 404);
  }

  res.json({
    status: 'success',
    data: { guest }
  });
});

// Delete guest
export const deleteGuest = catchAsync(async (req, res) => {
  const guest = await User.findById(req.params.id);

  if (!guest || guest.role !== 'guest') {
    throw new ApplicationError('Guest not found', 404);
  }

  // Check if guest has bookings
  const hasBookings = await Booking.exists({ userId: guest._id });
  if (hasBookings) {
    throw new ApplicationError('Cannot delete guest with existing bookings', 400);
  }

  await User.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Bulk operations
export const bulkUpdateGuests = catchAsync(async (req, res) => {
  const { guestIds, updateData } = req.body;

  if (!Array.isArray(guestIds) || guestIds.length === 0) {
    throw new ApplicationError('Guest IDs array is required', 400);
  }

  const result = await User.updateMany(
    { _id: { $in: guestIds }, role: 'guest' },
    updateData
  );

  res.json({
    status: 'success',
    data: {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    }
  });
});

// Get guest analytics
export const getGuestAnalytics = catchAsync(async (req, res) => {
  const { hotelId } = req.query;

  const query = { role: 'guest' };
  if (hotelId) query.hotelId = hotelId;

  const analytics = await User.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalGuests: { $sum: 1 },
        byLoyaltyTier: {
          $push: '$loyalty.tier'
        },
        byGuestType: {
          $push: '$guestType'
        },
        byRegistrationMonth: {
          $push: {
            month: { $month: '$createdAt' },
            year: { $year: '$createdAt' }
          }
        }
      }
    }
  ]);

  if (analytics.length === 0) {
    return res.json({
      status: 'success',
      data: {
        totalGuests: 0,
        loyaltyTierDistribution: {},
        guestTypeDistribution: {},
        registrationTrends: {}
      }
    });
  }

  const result = analytics[0];

  // Calculate loyalty tier distribution
  const loyaltyTierDistribution = {};
  result.byLoyaltyTier.forEach(tier => {
    loyaltyTierDistribution[tier] = (loyaltyTierDistribution[tier] || 0) + 1;
  });

  // Calculate guest type distribution
  const guestTypeDistribution = {};
  result.byGuestType.forEach(type => {
    guestTypeDistribution[type] = (guestTypeDistribution[type] || 0) + 1;
  });

  // Calculate registration trends
  const registrationTrends = {};
  result.byRegistrationMonth.forEach(item => {
    const key = `${item.year}-${item.month}`;
    registrationTrends[key] = (registrationTrends[key] || 0) + 1;
  });

  res.json({
    status: 'success',
    data: {
      totalGuests: result.totalGuests,
      loyaltyTierDistribution,
      guestTypeDistribution,
      registrationTrends
    }
  });
});

// Search guests with advanced criteria
export const searchGuests = catchAsync(async (req, res) => {
  const {
    query: searchQuery,
    filters = {},
    page = 1,
    limit = 20,
    hotelId
  } = req.body;

  const query = { role: 'guest' };
  if (hotelId) query.hotelId = hotelId;

  // Text search
  if (searchQuery) {
    query.$or = [
      { name: { $regex: searchQuery, $options: 'i' } },
      { email: { $regex: searchQuery, $options: 'i' } },
      { phone: { $regex: searchQuery, $options: 'i' } }
    ];
  }

  // Apply filters
  if (filters.loyaltyTier) {
    query['loyalty.tier'] = filters.loyaltyTier;
  }
  if (filters.guestType) {
    query.guestType = filters.guestType;
  }
  if (filters.hasBookings !== undefined) {
    const guestsWithBookings = await Booking.distinct('userId', { hotelId });
    if (filters.hasBookings) {
      query._id = { $in: guestsWithBookings };
    } else {
      query._id = { $nin: guestsWithBookings };
    }
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const guests = await User.find(query)
    .populate('salutationId', 'title fullForm')
    .select('-password -passwordResetToken -passwordResetExpires')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(query);

  res.json({
    status: 'success',
    results: guests.length,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    },
    data: { guests }
  });
});

// Export guests to CSV
export const exportGuests = catchAsync(async (req, res) => {
  const { hotelId, format = 'csv' } = req.query;

  const query = { role: 'guest' };
  if (hotelId) query.hotelId = hotelId;

  const guests = await User.find(query)
    .populate('salutationId', 'title fullForm')
    .select('-password -passwordResetToken -passwordResetExpires')
    .sort({ createdAt: -1 });

  if (format === 'csv') {
    const csvHeader = 'Name,Email,Phone,Salutation,Loyalty Tier,Guest Type,Created At\n';
    const csvData = guests.map(guest => {
      const salutation = guest.salutationId ? guest.salutationId.title : '';
      return [
        guest.name,
        guest.email,
        guest.phone || '',
        salutation,
        guest.loyalty.tier,
        guest.guestType,
        guest.createdAt.toISOString()
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=guests.csv');
    res.send(csvHeader + csvData);
  } else {
    res.json({
      status: 'success',
      results: guests.length,
      data: { guests }
    });
  }
});

export default {
  getAllGuests,
  getGuest,
  createGuest,
  updateGuest,
  deleteGuest,
  bulkUpdateGuests,
  getGuestAnalytics,
  searchGuests,
  exportGuests
};
