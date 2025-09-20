import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Room from '../models/Room.js';
import GuestService from '../models/GuestService.js';
import MaintenanceTask from '../models/MaintenanceTask.js';
import Invoice from '../models/Invoice.js';

class SearchService {
  async globalSearch(query, options = {}) {
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const hotelId = options.hotelId;
      const startTime = Date.now();

      if (!query || query.trim().length < 2) {
        return {
          query,
          total: 0,
          results: [],
          pagination: { limit, offset, hasNext: false, hasPrev: false },
          facets: { entities: {}, dateRanges: {}, statuses: {} },
          searchTime: Date.now() - startTime,
          suggestions: []
        };
      }

      const searchRegex = new RegExp(query.trim(), 'i');
      const results = [];
      let totalResults = 0;

      // Search across different entities
      const searchPromises = [];

      // Search Bookings
      if (!options.entityType || options.entityType === 'booking') {
        const bookingQuery = {
          $and: [
            hotelId ? { hotelId: new mongoose.Types.ObjectId(hotelId) } : {},
            {
              $or: [
                { bookingId: searchRegex },
                { 'guestDetails.firstName': searchRegex },
                { 'guestDetails.lastName': searchRegex },
                { 'guestDetails.email': searchRegex },
                { 'guestDetails.phone': searchRegex }
              ]
            }
          ]
        };

        searchPromises.push(
          Booking.find(bookingQuery)
            .limit(limit)
            .skip(offset)
            .populate('roomId', 'number floor')
            .populate('userId', 'email username')
            .lean()
            .then(bookings => {
              return bookings.map(booking => ({
                type: 'booking',
                id: booking._id,
                title: `Booking ${booking.bookingId || booking._id}`,
                subtitle: `Guest: ${booking.guestDetails?.firstName || ''} ${booking.guestDetails?.lastName || ''}`,
                content: `Room: ${booking.roomId?.number || 'N/A'}, Status: ${booking.status}`,
                metadata: {
                  checkIn: booking.checkIn,
                  checkOut: booking.checkOut,
                  totalAmount: booking.totalAmount,
                  status: booking.status
                },
                relevanceScore: this.calculateRelevance(query, booking),
                entity: booking
              }));
            })
        );
      }

      // Search Users
      if (!options.entityType || options.entityType === 'user') {
        const userQuery = {
          $and: [
            hotelId ? { hotelId: new mongoose.Types.ObjectId(hotelId) } : {},
            {
              $or: [
                { email: searchRegex },
                { username: searchRegex },
                { 'profile.firstName': searchRegex },
                { 'profile.lastName': searchRegex },
                { 'profile.phone': searchRegex }
              ]
            }
          ]
        };

        searchPromises.push(
          User.find(userQuery)
            .limit(limit)
            .skip(offset)
            .select('email username profile role lastLogin')
            .lean()
            .then(users => {
              return users.map(user => ({
                type: 'user',
                id: user._id,
                title: user.username || user.email,
                subtitle: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`,
                content: `Role: ${user.role}, Last Login: ${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}`,
                metadata: {
                  role: user.role,
                  email: user.email,
                  lastLogin: user.lastLogin
                },
                relevanceScore: this.calculateRelevance(query, user),
                entity: user
              }));
            })
        );
      }

      // Search Rooms
      if (!options.entityType || options.entityType === 'room') {
        const roomQuery = {
          $and: [
            hotelId ? { hotelId: new mongoose.Types.ObjectId(hotelId) } : {},
            {
              $or: [
                { number: searchRegex },
                { floor: searchRegex },
                { roomType: searchRegex },
                { status: searchRegex }
              ]
            }
          ]
        };

        searchPromises.push(
          Room.find(roomQuery)
            .limit(limit)
            .skip(offset)
            .lean()
            .then(rooms => {
              return rooms.map(room => ({
                type: 'room',
                id: room._id,
                title: `Room ${room.number}`,
                subtitle: `${room.roomType} - Floor ${room.floor}`,
                content: `Status: ${room.status}, Capacity: ${room.maxGuests}`,
                metadata: {
                  number: room.number,
                  floor: room.floor,
                  roomType: room.roomType,
                  status: room.status
                },
                relevanceScore: this.calculateRelevance(query, room),
                entity: room
              }));
            })
        );
      }

      // Search Guest Services
      if (!options.entityType || options.entityType === 'service') {
        const serviceQuery = {
          $and: [
            hotelId ? { hotelId: new mongoose.Types.ObjectId(hotelId) } : {},
            {
              $or: [
                { title: searchRegex },
                { description: searchRegex },
                { category: searchRegex },
                { status: searchRegex }
              ]
            }
          ]
        };

        searchPromises.push(
          GuestService.find(serviceQuery)
            .limit(limit)
            .skip(offset)
            .populate('userId', 'email username')
            .lean()
            .then(services => {
              return services.map(service => ({
                type: 'service',
                id: service._id,
                title: service.title,
                subtitle: `Category: ${service.category}`,
                content: `Status: ${service.status}, Guest: ${service.userId?.email || 'N/A'}`,
                metadata: {
                  category: service.category,
                  status: service.status,
                  requestDate: service.createdAt
                },
                relevanceScore: this.calculateRelevance(query, service),
                entity: service
              }));
            })
        );
      }

      // Execute all searches in parallel
      const searchResults = await Promise.all(searchPromises);

      // Combine and sort results by relevance
      const allResults = searchResults.flat()
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

      totalResults = allResults.length;

      // Calculate facets
      const facets = this.calculateFacets(allResults);

      return {
        query,
        total: totalResults,
        results: allResults,
        pagination: {
          limit,
          offset,
          hasNext: totalResults >= limit,
          hasPrev: offset > 0
        },
        facets,
        searchTime: Date.now() - startTime,
        suggestions: await this.getSearchSuggestions(query, 5)
      };

    } catch (error) {
      logger.error('Search service error:', error);
      throw error;
    }
  }

  async getSearchSuggestions(query, limit = 10) {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }

      const searchRegex = new RegExp(query.trim(), 'i');
      const suggestions = [];

      // Get suggestions from recent bookings
      const recentBookings = await Booking.find({
        $or: [
          { 'guestDetails.firstName': searchRegex },
          { 'guestDetails.lastName': searchRegex },
          { bookingId: searchRegex }
        ]
      })
      .limit(limit)
      .select('guestDetails.firstName guestDetails.lastName bookingId')
      .lean();

      recentBookings.forEach(booking => {
        if (booking.guestDetails?.firstName) {
          suggestions.push(booking.guestDetails.firstName);
        }
        if (booking.guestDetails?.lastName) {
          suggestions.push(booking.guestDetails.lastName);
        }
        if (booking.bookingId) {
          suggestions.push(booking.bookingId);
        }
      });

      // Get suggestions from room types and numbers
      const rooms = await Room.find({
        $or: [
          { number: searchRegex },
          { roomType: searchRegex }
        ]
      })
      .limit(limit)
      .select('number roomType')
      .lean();

      rooms.forEach(room => {
        if (room.number) {
          suggestions.push(`Room ${room.number}`);
        }
        if (room.roomType) {
          suggestions.push(room.roomType);
        }
      });

      // Remove duplicates and limit results
      return [...new Set(suggestions)].slice(0, limit);

    } catch (error) {
      logger.error('Search suggestions error:', error);
      return [];
    }
  }

  async saveSearchHistory(userId, query, resultCount) {
    try {
      // For now, just log the search - in production this could be saved to a SearchHistory model
      logger.info(`Search by user ${userId}: "${query}" returned ${resultCount} results`);

      // Future implementation could save to database:
      // await SearchHistory.create({
      //   userId: new mongoose.Types.ObjectId(userId),
      //   query,
      //   resultCount,
      //   timestamp: new Date()
      // });

    } catch (error) {
      logger.error('Save search history error:', error);
    }
  }

  // Helper method to calculate relevance score
  calculateRelevance(query, entity) {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Exact matches get highest score
    Object.values(entity).forEach(value => {
      if (typeof value === 'string' && value.toLowerCase() === queryLower) {
        score += 100;
      } else if (typeof value === 'string' && value.toLowerCase().includes(queryLower)) {
        score += 50;
      }
    });

    // Check nested objects for matches
    if (entity.guestDetails) {
      const fullName = `${entity.guestDetails.firstName || ''} ${entity.guestDetails.lastName || ''}`.toLowerCase();
      if (fullName.includes(queryLower)) {
        score += 75;
      }
    }

    if (entity.profile) {
      const fullName = `${entity.profile.firstName || ''} ${entity.profile.lastName || ''}`.toLowerCase();
      if (fullName.includes(queryLower)) {
        score += 75;
      }
    }

    return score;
  }

  // Helper method to calculate facets for search results
  calculateFacets(results) {
    const facets = {
      entities: {},
      dateRanges: {},
      statuses: {}
    };

    results.forEach(result => {
      // Entity type facets
      facets.entities[result.type] = (facets.entities[result.type] || 0) + 1;

      // Status facets
      if (result.metadata?.status) {
        facets.statuses[result.metadata.status] = (facets.statuses[result.metadata.status] || 0) + 1;
      }

      // Date range facets (for bookings)
      if (result.metadata?.checkIn) {
        const month = new Date(result.metadata.checkIn).toLocaleString('en-US', { month: 'long', year: 'numeric' });
        facets.dateRanges[month] = (facets.dateRanges[month] || 0) + 1;
      }
    });

    return facets;
  }
}

export default SearchService;