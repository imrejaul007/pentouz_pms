import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import mongoose from 'mongoose';

class GuestSearchService {
  /**
   * Advanced guest search with multiple criteria
   */
  async searchGuests(searchCriteria, options = {}) {
    const {
      text,
      loyaltyTier,
      guestType,
      hasBookings,
      hasReviews,
      lastStayDate,
      registrationDateRange,
      totalSpentRange,
      averageRatingRange,
      hotelId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = searchCriteria;

    const query = { role: 'guest' };
    if (hotelId) query.hotelId = hotelId;

    // Text search across multiple fields
    if (text) {
      query.$or = [
        { name: { $regex: text, $options: 'i' } },
        { email: { $regex: text, $options: 'i' } },
        { phone: { $regex: text, $options: 'i' } }
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
    if (hasBookings !== undefined) {
      const guestsWithBookings = await Booking.distinct('userId', { hotelId });
      if (hasBookings) {
        query._id = { $in: guestsWithBookings };
      } else {
        query._id = { $nin: guestsWithBookings };
      }
    }

    // Filter by review history
    if (hasReviews !== undefined) {
      const guestsWithReviews = await Review.distinct('userId', { hotelId });
      if (hasReviews) {
        query._id = { $in: guestsWithReviews };
      } else {
        query._id = { $nin: guestsWithReviews };
      }
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

    // Filter by registration date range
    if (registrationDateRange) {
      query.createdAt = {};
      if (registrationDateRange.from) {
        query.createdAt.$gte = new Date(registrationDateRange.from);
      }
      if (registrationDateRange.to) {
        query.createdAt.$lte = new Date(registrationDateRange.to);
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const guests = await User.find(query)
      .populate('salutationId', 'title fullForm')
      .select('-password -passwordResetToken -passwordResetExpires')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    // Get additional statistics for each guest
    const guestsWithStats = await Promise.all(
      guests.map(async (guest) => {
        const stats = await this.getGuestStats(guest._id, hotelId);
        return {
          ...guest.toObject(),
          stats
        };
      })
    );

    // Apply additional filters based on stats
    let filteredGuests = guestsWithStats;

    if (totalSpentRange) {
      filteredGuests = filteredGuests.filter(guest => {
        const totalSpent = guest.stats.bookings.totalSpent || 0;
        return totalSpent >= (totalSpentRange.min || 0) && 
               totalSpent <= (totalSpentRange.max || Infinity);
      });
    }

    if (averageRatingRange) {
      filteredGuests = filteredGuests.filter(guest => {
        const avgRating = guest.stats.reviews.averageRating || 0;
        return avgRating >= (averageRatingRange.min || 0) && 
               avgRating <= (averageRatingRange.max || 5);
      });
    }

    return {
      guests: filteredGuests,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    };
  }

  /**
   * Get comprehensive statistics for a guest
   */
  async getGuestStats(guestId, hotelId) {
    const [bookingStats, reviewStats] = await Promise.all([
      // Booking statistics
      Booking.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(guestId), hotelId: new mongoose.Types.ObjectId(hotelId) } },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            totalNights: { $sum: { $subtract: ['$checkOut', '$checkIn'] } },
            totalSpent: { $sum: '$totalAmount' },
            averageStayLength: { $avg: { $subtract: ['$checkOut', '$checkIn'] } },
            firstStay: { $min: '$checkIn' },
            lastStay: { $max: '$checkOut' },
            averageBookingValue: { $avg: '$totalAmount' }
          }
        }
      ]),
      // Review statistics
      Review.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(guestId), hotelId: new mongoose.Types.ObjectId(hotelId) } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
            lastReview: { $max: '$createdAt' }
          }
        }
      ])
    ]);

    return {
      bookings: bookingStats[0] || {
        totalBookings: 0,
        totalNights: 0,
        totalSpent: 0,
        averageStayLength: 0,
        firstStay: null,
        lastStay: null,
        averageBookingValue: 0
      },
      reviews: reviewStats[0] || {
        totalReviews: 0,
        averageRating: 0,
        lastReview: null
      }
    };
  }

  /**
   * Fuzzy search for guest names
   */
  async fuzzySearchGuests(searchTerm, hotelId, limit = 10) {
    const query = {
      role: 'guest',
      hotelId,
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ]
    };

    const guests = await User.find(query)
      .populate('salutationId', 'title fullForm')
      .select('name email phone salutationId loyalty')
      .limit(limit)
      .sort({ name: 1 });

    return guests;
  }

  /**
   * Get guest suggestions based on partial input
   */
  async getGuestSuggestions(partialInput, hotelId, limit = 5) {
    if (!partialInput || partialInput.length < 2) {
      return [];
    }

    const query = {
      role: 'guest',
      hotelId,
      $or: [
        { name: { $regex: `^${partialInput}`, $options: 'i' } },
        { email: { $regex: `^${partialInput}`, $options: 'i' } }
      ]
    };

    const guests = await User.find(query)
      .populate('salutationId', 'title')
      .select('name email salutationId')
      .limit(limit)
      .sort({ name: 1 });

    return guests.map(guest => ({
      id: guest._id,
      name: guest.name,
      email: guest.email,
      salutation: guest.salutationId?.title || '',
      displayName: `${guest.salutationId?.title || ''} ${guest.name}`.trim()
    }));
  }

  /**
   * Search guests by booking history
   */
  async searchGuestsByBookingHistory(bookingCriteria, hotelId) {
    const {
      roomType,
      checkInDate,
      checkOutDate,
      bookingStatus,
      minAmount,
      maxAmount
    } = bookingCriteria;

    const bookingQuery = { hotelId };
    
    if (roomType) {
      bookingQuery['rooms.roomType'] = roomType;
    }
    if (checkInDate) {
      bookingQuery.checkIn = { $gte: new Date(checkInDate) };
    }
    if (checkOutDate) {
      bookingQuery.checkOut = { $lte: new Date(checkOutDate) };
    }
    if (bookingStatus) {
      bookingQuery.status = bookingStatus;
    }
    if (minAmount || maxAmount) {
      bookingQuery.totalAmount = {};
      if (minAmount) bookingQuery.totalAmount.$gte = minAmount;
      if (maxAmount) bookingQuery.totalAmount.$lte = maxAmount;
    }

    const guestIds = await Booking.distinct('userId', bookingQuery);

    const guests = await User.find({
      _id: { $in: guestIds },
      role: 'guest'
    })
      .populate('salutationId', 'title fullForm')
      .select('-password -passwordResetToken -passwordResetExpires');

    return guests;
  }

  /**
   * Get guest segments based on behavior
   */
  async getGuestSegments(hotelId) {
    const segments = {
      frequentGuests: [],
      highValueGuests: [],
      recentGuests: [],
      inactiveGuests: []
    };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Frequent guests (3+ bookings)
    const frequentGuestIds = await Booking.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
      { $group: { _id: '$userId', bookingCount: { $sum: 1 } } },
      { $match: { bookingCount: { $gte: 3 } } },
      { $project: { _id: 1 } }
    ]);

    if (frequentGuestIds.length > 0) {
      segments.frequentGuests = await User.find({
        _id: { $in: frequentGuestIds.map(g => g._id) },
        role: 'guest'
      })
        .populate('salutationId', 'title')
        .select('name email loyalty')
        .limit(10);
    }

    // High value guests (total spent > $1000)
    const highValueGuestIds = await Booking.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
      { $group: { _id: '$userId', totalSpent: { $sum: '$totalAmount' } } },
      { $match: { totalSpent: { $gte: 1000 } } },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      { $project: { _id: 1 } }
    ]);

    if (highValueGuestIds.length > 0) {
      segments.highValueGuests = await User.find({
        _id: { $in: highValueGuestIds.map(g => g._id) },
        role: 'guest'
      })
        .populate('salutationId', 'title')
        .select('name email loyalty');
    }

    // Recent guests (booked in last 30 days)
    const recentGuestIds = await Booking.distinct('userId', {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      createdAt: { $gte: thirtyDaysAgo }
    });

    if (recentGuestIds.length > 0) {
      segments.recentGuests = await User.find({
        _id: { $in: recentGuestIds },
        role: 'guest'
      })
        .populate('salutationId', 'title')
        .select('name email loyalty')
        .limit(10);
    }

    // Inactive guests (no bookings in last 90 days but have booking history)
    const allGuestIds = await Booking.distinct('userId', {
      hotelId: new mongoose.Types.ObjectId(hotelId)
    });

    const activeGuestIds = await Booking.distinct('userId', {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      createdAt: { $gte: ninetyDaysAgo }
    });

    const inactiveGuestIds = allGuestIds.filter(id => !activeGuestIds.includes(id));

    if (inactiveGuestIds.length > 0) {
      segments.inactiveGuests = await User.find({
        _id: { $in: inactiveGuestIds },
        role: 'guest'
      })
        .populate('salutationId', 'title')
        .select('name email loyalty')
        .limit(10);
    }

    return segments;
  }

  /**
   * Get guest analytics dashboard data
   */
  async getGuestAnalytics(hotelId) {
    const [
      totalGuests,
      loyaltyDistribution,
      guestTypeDistribution,
      registrationTrends,
      bookingTrends,
      revenueByGuest
    ] = await Promise.all([
      // Total guests
      User.countDocuments({ role: 'guest', hotelId }),
      
      // Loyalty tier distribution
      User.aggregate([
        { $match: { role: 'guest', hotelId } },
        { $group: { _id: '$loyalty.tier', count: { $sum: 1 } } }
      ]),
      
      // Guest type distribution
      User.aggregate([
        { $match: { role: 'guest', hotelId } },
        { $group: { _id: '$guestType', count: { $sum: 1 } } }
      ]),
      
      // Registration trends (last 12 months)
      User.aggregate([
        { $match: { role: 'guest', hotelId } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ]),
      
      // Booking trends
      Booking.aggregate([
        { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            bookings: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ]),
      
      // Revenue by guest
      Booking.aggregate([
        { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
        {
          $group: {
            _id: '$userId',
            totalRevenue: { $sum: '$totalAmount' },
            bookingCount: { $sum: 1 }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 }
      ])
    ]);

    return {
      totalGuests,
      loyaltyDistribution: loyaltyDistribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      guestTypeDistribution: guestTypeDistribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      registrationTrends,
      bookingTrends,
      topRevenueGuests: revenueByGuest
    };
  }
}

export default new GuestSearchService();
