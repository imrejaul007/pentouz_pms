import SearchService from '../services/searchService.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
// import RoomBlock from '../models/RoomBlock.js'; // Temporarily disabled
import AuditLog from '../models/AuditLog.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const searchService = new SearchService();

class SearchController {
  async globalSearch(req, res) {
    try {
      const { q: query } = req.query;
      
      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters long'
        });
      }

      const options = {
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
        entities: req.query.entities ? req.query.entities.split(',') : ['reservations', 'guests', 'invoices', 'rooms', 'services'],
        sortBy: req.query.sortBy || 'relevance',
        sortOrder: req.query.sortOrder || 'desc'
      };

      const results = await searchService.globalSearch(query, options);
      
      if (req.user) {
        await searchService.saveSearchHistory(req.user.id, query, results.total);
      }

      res.json({
        success: true,
        data: results
      });
      
    } catch (error) {
      console.error('Global search error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during search'
      });
    }
  }

  async getSearchSuggestions(req, res) {
    try {
      const { q: query } = req.query;
      
      if (!query || query.length < 2) {
        return res.json({
          success: true,
          data: []
        });
      }

      const limit = parseInt(req.query.limit) || 10;
      const suggestions = await searchService.getSearchSuggestions(query, limit);

      res.json({
        success: true,
        data: suggestions
      });
      
    } catch (error) {
      console.error('Search suggestions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get search suggestions'
      });
    }
  }

  parseFilters(filtersString) {
    if (!filtersString) return {};

    try {
      return JSON.parse(filtersString);
    } catch (error) {
      console.error('Error parsing filters:', error);
      return {};
    }
  }

  // Advanced search for tape chart
  advancedSearch = catchAsync(async (req, res, next) => {
    const {
      query,
      entityType,
      filters = {},
      sort = { field: 'createdAt', order: 'desc' },
      pagination = { page: 1, limit: 50 }
    } = req.body;

    const hotelId = req.user.hotelId;
    const searchResults = {};

    // Build text search regex
    const searchRegex = query ? new RegExp(query, 'i') : null;

    // Helper function to build date range query
    const buildDateRangeQuery = (dateRange) => {
      if (!dateRange) return {};
      const query = {};
      if (dateRange.start) query.$gte = new Date(dateRange.start);
      if (dateRange.end) query.$lte = new Date(dateRange.end);
      return query;
    };

    // Search rooms
    if (!entityType || entityType === 'room') {
      const roomQuery = { hotelId };

      // Text search
      if (searchRegex) {
        roomQuery.$or = [
          { roomNumber: searchRegex },
          { type: searchRegex },
          { amenities: { $in: [searchRegex] } },
          { description: searchRegex }
        ];
      }

      // Apply filters
      if (filters.status && filters.status.length > 0) {
        roomQuery.status = { $in: filters.status };
      }
      if (filters.roomTypes && filters.roomTypes.length > 0) {
        roomQuery.type = { $in: filters.roomTypes };
      }
      if (filters.floors && filters.floors.length > 0) {
        roomQuery.floor = { $in: filters.floors };
      }
      if (filters.priceRange) {
        if (filters.priceRange.min !== undefined) {
          roomQuery.baseRate = { ...roomQuery.baseRate, $gte: filters.priceRange.min };
        }
        if (filters.priceRange.max !== undefined) {
          roomQuery.baseRate = { ...roomQuery.baseRate, $lte: filters.priceRange.max };
        }
      }

      // Execute room search
      const roomSortField = sort.field === 'createdAt' ? 'createdAt' : sort.field;
      const roomSort = { [roomSortField]: sort.order === 'desc' ? -1 : 1 };

      const totalRooms = await Room.countDocuments(roomQuery);
      const rooms = await Room.find(roomQuery)
        .sort(roomSort)
        .limit(pagination.limit)
        .skip((pagination.page - 1) * pagination.limit);

      searchResults.rooms = rooms;
      searchResults.roomsPagination = {
        total: totalRooms,
        pages: Math.ceil(totalRooms / pagination.limit)
      };
    }

    // Search bookings
    if (!entityType || entityType === 'booking') {
      const bookingQuery = { hotelId };

      // Text search
      if (searchRegex) {
        bookingQuery.$or = [
          { bookingNumber: searchRegex },
          { guestName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { roomType: searchRegex }
        ];
      }

      // Apply filters
      if (filters.status && filters.status.length > 0) {
        bookingQuery.status = { $in: filters.status };
      }
      if (filters.dateRange) {
        const dateQuery = buildDateRangeQuery(filters.dateRange);
        if (Object.keys(dateQuery).length > 0) {
          bookingQuery.$or = [
            { checkIn: dateQuery },
            { checkOut: dateQuery }
          ];
        }
      }

      // Execute booking search
      const totalBookings = await Booking.countDocuments(bookingQuery);
      const bookings = await Booking.find(bookingQuery)
        .populate('roomId', 'roomNumber type')
        .sort({ createdAt: -1 })
        .limit(pagination.limit)
        .skip((pagination.page - 1) * pagination.limit);

      searchResults.bookings = bookings;
      searchResults.bookingsPagination = {
        total: totalBookings,
        pages: Math.ceil(totalBookings / pagination.limit)
      };
    }

    // Log search activity
    await AuditLog.logChange({
      hotelId,
      tableName: 'Search',
      recordId: 'search-query',
      changeType: 'search',
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      source: 'manual',
      newValues: {
        query,
        entityType,
        filters,
        resultsCount: {
          rooms: searchResults.rooms?.length || 0,
          bookings: searchResults.bookings?.length || 0
        }
      },
      metadata: {
        priority: 'low',
        tags: ['search', 'tape_chart']
      }
    });

    res.status(200).json({
      success: true,
      message: 'Search completed successfully',
      data: searchResults,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        rooms: searchResults.roomsPagination,
        bookings: searchResults.bookingsPagination
      }
    });
  });

  // Advanced filtering
  advancedFilter = catchAsync(async (req, res, next) => {
    const {
      entityType = 'room',
      filters = {},
      sort = { field: 'createdAt', order: 'desc' },
      pagination = { page: 1, limit: 50 }
    } = req.body;

    const hotelId = req.user.hotelId;
    let results = [];
    let total = 0;

    switch (entityType) {
      case 'room': {
        const roomQuery = { hotelId };

        // Apply all room filters
        if (filters.status) roomQuery.status = { $in: filters.status };
        if (filters.roomTypes) roomQuery.type = { $in: filters.roomTypes };
        if (filters.floors) roomQuery.floor = { $in: filters.floors };

        if (filters.priceRange) {
          roomQuery.baseRate = {};
          if (filters.priceRange.min !== undefined) roomQuery.baseRate.$gte = filters.priceRange.min;
          if (filters.priceRange.max !== undefined) roomQuery.baseRate.$lte = filters.priceRange.max;
        }

        total = await Room.countDocuments(roomQuery);

        const sortField = sort.field === 'createdAt' ? 'createdAt' : sort.field;
        const sortOrder = { [sortField]: sort.order === 'desc' ? -1 : 1 };

        results = await Room.find(roomQuery)
          .sort(sortOrder)
          .limit(pagination.limit)
          .skip((pagination.page - 1) * pagination.limit);
        break;
      }

      case 'booking': {
        const bookingQuery = { hotelId };

        // Apply all booking filters
        if (filters.status) bookingQuery.status = { $in: filters.status };
        if (filters.roomTypes) bookingQuery.roomType = { $in: filters.roomTypes };

        if (filters.dateRange) {
          if (filters.dateRange.start || filters.dateRange.end) {
            const dateQuery = {};
            if (filters.dateRange.start) dateQuery.$gte = new Date(filters.dateRange.start);
            if (filters.dateRange.end) dateQuery.$lte = new Date(filters.dateRange.end);

            bookingQuery.$or = [
              { checkIn: dateQuery },
              { checkOut: dateQuery }
            ];
          }
        }

        total = await Booking.countDocuments(bookingQuery);

        results = await Booking.find(bookingQuery)
          .populate('roomId', 'roomNumber type')
          .sort({ createdAt: -1 })
          .limit(pagination.limit)
          .skip((pagination.page - 1) * pagination.limit);
        break;
      }

      default:
        return next(new ApplicationError('Invalid entity type for filtering', 400));
    }

    const responseData = {};
    responseData[`${entityType}s`] = results;

    res.status(200).json({
      success: true,
      message: `${entityType} filtering completed successfully`,
      data: responseData,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit)
      }
    });
  });

  // Get search filter options
  getFilterOptions = catchAsync(async (req, res, next) => {
    const hotelId = req.user.hotelId;

    // Get all unique values for filter options
    const [
      roomTypes,
      floors,
      amenities,
      roomStatuses,
      bookingStatuses
    ] = await Promise.all([
      Room.distinct('type', { hotelId }),
      Room.distinct('floor', { hotelId }),
      Room.distinct('amenities', { hotelId }),
      Room.distinct('status', { hotelId }),
      Booking.distinct('status', { hotelId })
    ]);

    // Get price ranges
    const priceStats = await Room.aggregate([
      { $match: { hotelId } },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$baseRate' },
          maxPrice: { $max: '$baseRate' },
          avgPrice: { $avg: '$baseRate' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        roomTypes: roomTypes.sort(),
        floors: floors.sort((a, b) => a - b),
        amenities: amenities.flat().filter((v, i, a) => a.indexOf(v) === i).sort(),
        statuses: {
          rooms: roomStatuses.sort(),
          bookings: bookingStatuses.sort()
        },
        ranges: {
          price: priceStats[0] || { minPrice: 0, maxPrice: 10000, avgPrice: 5000 }
        }
      }
    });
  });
}

export default new SearchController();
