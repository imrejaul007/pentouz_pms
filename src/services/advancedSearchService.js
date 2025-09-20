import mongoose from 'mongoose';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import PropertyGroup from '../models/PropertyGroup.js';
import SharedResource from '../models/SharedResource.js';
import { searchPaginate } from '../utils/pagination.js';
import logger from '../utils/logger.js';
import cacheService from './cacheService.js';

/**
 * Advanced Search Service
 * Provides intelligent search capabilities across all entities
 */

class AdvancedSearchService {
  constructor() {
    this.cacheExpiry = 600; // 10 minutes cache for search results
    this.searchTimeout = 5000; // 5 second timeout for complex searches
  }

  /**
   * Global search across multiple entity types
   * @param {string} query - Search query
   * @param {Object} options - Search options
   */
  async globalSearch(query, options = {}) {
    const {
      userId,
      userProperties = [],
      entityTypes = ['hotels', 'rooms', 'bookings', 'users', 'resources'],
      limit = 10,
      includeHighlights = true
    } = options;

    const cacheKey = `global_search:${query}:${userId}:${entityTypes.join(',')}:${limit}`;

    try {
      const cachedResults = await cacheService.get(cacheKey);
      if (cachedResults) {
        logger.debug('Global search cache hit', { query, userId });
        return cachedResults;
      }

      const searchPromises = [];
      const results = { query, results: [], totalResults: 0, searchTime: 0 };
      const startTime = Date.now();

      // Search hotels
      if (entityTypes.includes('hotels')) {
        searchPromises.push(
          this.searchHotels(query, { userProperties, limit, includeHighlights })
            .then(hotelResults => ({ type: 'hotels', data: hotelResults }))
        );
      }

      // Search rooms
      if (entityTypes.includes('rooms')) {
        searchPromises.push(
          this.searchRooms(query, { userProperties, limit, includeHighlights })
            .then(roomResults => ({ type: 'rooms', data: roomResults }))
        );
      }

      // Search bookings
      if (entityTypes.includes('bookings')) {
        searchPromises.push(
          this.searchBookings(query, { userProperties, limit, includeHighlights })
            .then(bookingResults => ({ type: 'bookings', data: bookingResults }))
        );
      }

      // Search users
      if (entityTypes.includes('users')) {
        searchPromises.push(
          this.searchUsers(query, { userProperties, limit, includeHighlights })
            .then(userResults => ({ type: 'users', data: userResults }))
        );
      }

      // Search shared resources
      if (entityTypes.includes('resources')) {
        searchPromises.push(
          this.searchSharedResources(query, { userProperties, limit, includeHighlights })
            .then(resourceResults => ({ type: 'resources', data: resourceResults }))
        );
      }

      // Execute all searches in parallel with timeout
      const searchResults = await Promise.allSettled(
        searchPromises.map(promise => 
          Promise.race([
            promise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Search timeout')), this.searchTimeout)
            )
          ])
        )
      );

      // Combine results
      searchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          const { type, data } = result.value;
          results.results.push({
            type,
            count: data.data?.length || 0,
            items: data.data || [],
            highlights: data.highlights || []
          });
          results.totalResults += data.data?.length || 0;
        } else {
          logger.warn('Search failed for entity type:', result.reason);
        }
      });

      // Sort results by relevance
      results.results.forEach(entityResult => {
        entityResult.items = this.sortByRelevance(entityResult.items, query);
      });

      results.searchTime = Date.now() - startTime;

      // Cache results
      await cacheService.set(cacheKey, results, this.cacheExpiry);

      logger.info('Global search completed', {
        query,
        userId,
        totalResults: results.totalResults,
        searchTime: results.searchTime,
        entityTypes
      });

      return results;

    } catch (error) {
      logger.error('Global search error:', error);
      throw new Error(`Global search failed: ${error.message}`);
    }
  }

  /**
   * Search hotels with advanced filters
   * @param {string} query - Search query
   * @param {Object} options - Search options
   */
  async searchHotels(query, options = {}) {
    const {
      userProperties = [],
      location,
      amenities = [],
      priceRange,
      rating,
      availability,
      limit = 20,
      includeHighlights = false
    } = options;

    try {
      let searchQuery = {};

      // Text search
      if (query && query.trim()) {
        searchQuery.$or = [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { 'address.city': { $regex: query, $options: 'i' } },
          { 'address.country': { $regex: query, $options: 'i' } },
          { amenities: { $in: [new RegExp(query, 'i')] } }
        ];
      }

      // Property access filter
      if (userProperties.length > 0) {
        searchQuery._id = { $in: userProperties };
      }

      // Location filter
      if (location) {
        searchQuery.$and = searchQuery.$and || [];
        searchQuery.$and.push({
          $or: [
            { 'address.city': { $regex: location, $options: 'i' } },
            { 'address.country': { $regex: location, $options: 'i' } },
            { 'address.state': { $regex: location, $options: 'i' } }
          ]
        });
      }

      // Amenities filter
      if (amenities.length > 0) {
        searchQuery.amenities = { $all: amenities };
      }

      // Active filter
      searchQuery.isActive = true;

      const hotels = await Hotel.find(searchQuery)
        .populate('propertyGroupId', 'name')
        .limit(limit)
        .lean();

      // Calculate relevance scores
      const scoredHotels = hotels.map(hotel => ({
        ...hotel,
        _relevanceScore: this.calculateHotelRelevance(hotel, query, options)
      }));

      // Generate highlights if requested
      let highlights = [];
      if (includeHighlights && query) {
        highlights = this.generateHighlights(scoredHotels, query, ['name', 'description', 'address']);
      }

      return {
        data: scoredHotels,
        highlights,
        searchInfo: {
          query,
          filters: { location, amenities, priceRange, rating },
          resultCount: scoredHotels.length
        }
      };

    } catch (error) {
      logger.error('Hotel search error:', error);
      throw new Error(`Hotel search failed: ${error.message}`);
    }
  }

  /**
   * Search rooms with advanced filters
   * @param {string} query - Search query
   * @param {Object} options - Search options
   */
  async searchRooms(query, options = {}) {
    const {
      userProperties = [],
      roomType,
      capacity,
      priceRange,
      amenities = [],
      availability,
      limit = 20,
      includeHighlights = false
    } = options;

    try {
      let searchQuery = {};

      // Text search
      if (query && query.trim()) {
        searchQuery.$or = [
          { number: { $regex: query, $options: 'i' } },
          { type: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { amenities: { $in: [new RegExp(query, 'i')] } }
        ];
      }

      // Property access filter
      if (userProperties.length > 0) {
        searchQuery.hotelId = { $in: userProperties };
      }

      // Room type filter
      if (roomType) {
        searchQuery.type = roomType;
      }

      // Capacity filter
      if (capacity) {
        searchQuery.capacity = { $gte: capacity };
      }

      // Price range filter
      if (priceRange) {
        searchQuery.basePrice = {
          $gte: priceRange.min || 0,
          $lte: priceRange.max || 999999
        };
      }

      // Amenities filter
      if (amenities.length > 0) {
        searchQuery.amenities = { $all: amenities };
      }

      // Status filter
      searchQuery.status = { $in: ['available', 'occupied'] };
      searchQuery.isActive = true;

      const rooms = await Room.find(searchQuery)
        .populate('hotelId', 'name address.city')
        .limit(limit)
        .lean();

      // Calculate relevance scores
      const scoredRooms = rooms.map(room => ({
        ...room,
        _relevanceScore: this.calculateRoomRelevance(room, query, options)
      }));

      // Generate highlights
      let highlights = [];
      if (includeHighlights && query) {
        highlights = this.generateHighlights(scoredRooms, query, ['number', 'type', 'description']);
      }

      return {
        data: scoredRooms,
        highlights,
        searchInfo: {
          query,
          filters: { roomType, capacity, priceRange, amenities },
          resultCount: scoredRooms.length
        }
      };

    } catch (error) {
      logger.error('Room search error:', error);
      throw new Error(`Room search failed: ${error.message}`);
    }
  }

  /**
   * Search bookings with advanced filters
   * @param {string} query - Search query
   * @param {Object} options - Search options
   */
  async searchBookings(query, options = {}) {
    const {
      userProperties = [],
      status,
      dateRange,
      guestName,
      amount,
      limit = 20,
      includeHighlights = false
    } = options;

    try {
      let searchQuery = {};

      // Text search
      if (query && query.trim()) {
        searchQuery.$or = [
          { bookingId: { $regex: query, $options: 'i' } },
          { 'guestDetails.firstName': { $regex: query, $options: 'i' } },
          { 'guestDetails.lastName': { $regex: query, $options: 'i' } },
          { 'guestDetails.email': { $regex: query, $options: 'i' } },
          { 'guestDetails.phone': { $regex: query, $options: 'i' } }
        ];
      }

      // Property access filter
      if (userProperties.length > 0) {
        searchQuery.hotelId = { $in: userProperties };
      }

      // Status filter
      if (status) {
        searchQuery.status = status;
      }

      // Date range filter
      if (dateRange) {
        const { startDate, endDate } = dateRange;
        searchQuery.$and = searchQuery.$and || [];
        
        if (startDate) {
          searchQuery.$and.push({ checkIn: { $gte: new Date(startDate) } });
        }
        
        if (endDate) {
          searchQuery.$and.push({ checkOut: { $lte: new Date(endDate) } });
        }
      }

      // Guest name filter
      if (guestName) {
        searchQuery.$and = searchQuery.$and || [];
        searchQuery.$and.push({
          $or: [
            { 'guestDetails.firstName': { $regex: guestName, $options: 'i' } },
            { 'guestDetails.lastName': { $regex: guestName, $options: 'i' } }
          ]
        });
      }

      // Amount filter
      if (amount) {
        searchQuery.totalAmount = {
          $gte: amount.min || 0,
          $lte: amount.max || 999999
        };
      }

      const bookings = await Booking.find(searchQuery)
        .populate('hotelId', 'name')
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      // Calculate relevance scores
      const scoredBookings = bookings.map(booking => ({
        ...booking,
        _relevanceScore: this.calculateBookingRelevance(booking, query, options)
      }));

      // Generate highlights
      let highlights = [];
      if (includeHighlights && query) {
        highlights = this.generateHighlights(scoredBookings, query, ['bookingId', 'guestDetails']);
      }

      return {
        data: scoredBookings,
        highlights,
        searchInfo: {
          query,
          filters: { status, dateRange, guestName, amount },
          resultCount: scoredBookings.length
        }
      };

    } catch (error) {
      logger.error('Booking search error:', error);
      throw new Error(`Booking search failed: ${error.message}`);
    }
  }

  /**
   * Search users with access control
   * @param {string} query - Search query
   * @param {Object} options - Search options
   */
  async searchUsers(query, options = {}) {
    const {
      userProperties = [],
      role,
      status = 'active',
      limit = 20,
      includeHighlights = false
    } = options;

    try {
      let searchQuery = {};

      // Text search (excluding sensitive fields)
      if (query && query.trim()) {
        searchQuery.$or = [
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
          { 'profile.department': { $regex: query, $options: 'i' } }
        ];
      }

      // Property access filter - only show users from accessible properties
      if (userProperties.length > 0) {
        searchQuery.$or = searchQuery.$or || [];
        searchQuery.$or.push({ hotelId: { $in: userProperties } });
      }

      // Role filter
      if (role) {
        searchQuery.role = role;
      }

      // Status filter
      searchQuery.isActive = status === 'active';

      const users = await User.find(searchQuery)
        .select('-password -resetToken -salt') // Exclude sensitive fields
        .populate('hotelId', 'name')
        .limit(limit)
        .lean();

      // Calculate relevance scores
      const scoredUsers = users.map(user => ({
        ...user,
        _relevanceScore: this.calculateUserRelevance(user, query, options)
      }));

      // Generate highlights
      let highlights = [];
      if (includeHighlights && query) {
        highlights = this.generateHighlights(scoredUsers, query, ['name', 'email', 'profile.department']);
      }

      return {
        data: scoredUsers,
        highlights,
        searchInfo: {
          query,
          filters: { role, status },
          resultCount: scoredUsers.length
        }
      };

    } catch (error) {
      logger.error('User search error:', error);
      throw new Error(`User search failed: ${error.message}`);
    }
  }

  /**
   * Search shared resources
   * @param {string} query - Search query
   * @param {Object} options - Search options
   */
  async searchSharedResources(query, options = {}) {
    const {
      userProperties = [],
      type,
      category,
      availability,
      location,
      limit = 20,
      includeHighlights = false
    } = options;

    try {
      let searchQuery = {};

      // Text search
      if (query && query.trim()) {
        searchQuery.$or = [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { category: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ];
      }

      // Property access filter - show resources accessible to user's properties
      if (userProperties.length > 0) {
        searchQuery.$and = searchQuery.$and || [];
        searchQuery.$and.push({
          $or: [
            { ownerPropertyId: { $in: userProperties } },
            { sharingPolicy: 'open' },
            { 'sharedWith.propertyId': { $in: userProperties }, 'sharedWith.status': 'active' }
          ]
        });
      }

      // Type filter
      if (type) {
        searchQuery.type = type;
      }

      // Category filter
      if (category) {
        searchQuery.category = category;
      }

      // Availability filter
      if (availability) {
        searchQuery['availability.status'] = availability;
      }

      // Active filter
      searchQuery.isActive = true;

      const resources = await SharedResource.find(searchQuery)
        .populate('ownerPropertyId', 'name')
        .populate('location.currentPropertyId', 'name')
        .limit(limit)
        .lean();

      // Calculate relevance scores
      const scoredResources = resources.map(resource => ({
        ...resource,
        _relevanceScore: this.calculateResourceRelevance(resource, query, options)
      }));

      // Generate highlights
      let highlights = [];
      if (includeHighlights && query) {
        highlights = this.generateHighlights(scoredResources, query, ['name', 'description', 'category']);
      }

      return {
        data: scoredResources,
        highlights,
        searchInfo: {
          query,
          filters: { type, category, availability, location },
          resultCount: scoredResources.length
        }
      };

    } catch (error) {
      logger.error('Resource search error:', error);
      throw new Error(`Resource search failed: ${error.message}`);
    }
  }

  /**
   * Smart suggestions based on query
   * @param {string} partialQuery - Partial search query
   * @param {Object} options - Options
   */
  async getSearchSuggestions(partialQuery, options = {}) {
    const { entityType = 'all', userProperties = [], limit = 5 } = options;
    const cacheKey = `search_suggestions:${partialQuery}:${entityType}:${userProperties.length}`;

    try {
      const cachedSuggestions = await cacheService.get(cacheKey);
      if (cachedSuggestions) {
        return cachedSuggestions;
      }

      const suggestions = [];
      const regex = new RegExp(partialQuery, 'i');

      // Hotel name suggestions
      if (entityType === 'all' || entityType === 'hotels') {
        const hotelSuggestions = await Hotel.find({
          name: regex,
          _id: { $in: userProperties },
          isActive: true
        })
        .select('name')
        .limit(limit)
        .lean();

        suggestions.push(...hotelSuggestions.map(h => ({
          type: 'hotel',
          text: h.name,
          value: h.name
        })));
      }

      // Room type suggestions
      if (entityType === 'all' || entityType === 'rooms') {
        const roomTypes = await Room.distinct('type', {
          type: regex,
          hotelId: { $in: userProperties },
          isActive: true
        });

        suggestions.push(...roomTypes.slice(0, limit).map(type => ({
          type: 'room_type',
          text: type,
          value: type
        })));
      }

      // Location suggestions
      if (entityType === 'all' || entityType === 'locations') {
        const cities = await Hotel.distinct('address.city', {
          'address.city': regex,
          _id: { $in: userProperties },
          isActive: true
        });

        suggestions.push(...cities.slice(0, limit).map(city => ({
          type: 'location',
          text: city,
          value: city
        })));
      }

      // Sort by relevance
      const sortedSuggestions = suggestions
        .sort((a, b) => {
          const aScore = this.calculateSuggestionScore(a.text, partialQuery);
          const bScore = this.calculateSuggestionScore(b.text, partialQuery);
          return bScore - aScore;
        })
        .slice(0, limit * 2); // Return more suggestions than requested

      await cacheService.set(cacheKey, sortedSuggestions, 300); // Cache for 5 minutes

      return sortedSuggestions;

    } catch (error) {
      logger.error('Search suggestions error:', error);
      return [];
    }
  }

  /**
   * Advanced filtering with multiple criteria
   * @param {string} entityType - Type of entity to filter
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Additional options
   */
  async advancedFilter(entityType, filters, options = {}) {
    const { userProperties = [], sort = {}, pagination = {} } = options;

    try {
      let Model;
      let baseQuery = {};

      // Select model based on entity type
      switch (entityType) {
        case 'hotels':
          Model = Hotel;
          if (userProperties.length > 0) {
            baseQuery._id = { $in: userProperties };
          }
          break;
        case 'rooms':
          Model = Room;
          if (userProperties.length > 0) {
            baseQuery.hotelId = { $in: userProperties };
          }
          break;
        case 'bookings':
          Model = Booking;
          if (userProperties.length > 0) {
            baseQuery.hotelId = { $in: userProperties };
          }
          break;
        case 'resources':
          Model = SharedResource;
          if (userProperties.length > 0) {
            baseQuery.$or = [
              { ownerPropertyId: { $in: userProperties } },
              { sharingPolicy: 'open' },
              { 'sharedWith.propertyId': { $in: userProperties } }
            ];
          }
          break;
        default:
          throw new Error('Invalid entity type');
      }

      // Build filter query
      const filterQuery = this.buildFilterQuery(filters, entityType);
      const finalQuery = { ...baseQuery, ...filterQuery };

      // Execute query with pagination
      const result = await searchPaginate(Model, '', [], {
        query: finalQuery,
        sort,
        ...pagination
      });

      return result;

    } catch (error) {
      logger.error('Advanced filter error:', error);
      throw new Error(`Advanced filtering failed: ${error.message}`);
    }
  }

  // Helper methods for relevance calculation

  calculateHotelRelevance(hotel, query, options) {
    let score = 0;
    const queryLower = query.toLowerCase();

    // Exact name match gets highest score
    if (hotel.name.toLowerCase().includes(queryLower)) {
      score += 100;
    }

    // Description match
    if (hotel.description && hotel.description.toLowerCase().includes(queryLower)) {
      score += 50;
    }

    // Location match
    if (hotel.address?.city?.toLowerCase().includes(queryLower)) {
      score += 75;
    }

    // Amenities match
    if (hotel.amenities?.some(amenity => amenity.toLowerCase().includes(queryLower))) {
      score += 25;
    }

    // Boost for active properties
    if (hotel.isActive) {
      score += 10;
    }

    return score;
  }

  calculateRoomRelevance(room, query, options) {
    let score = 0;
    const queryLower = query.toLowerCase();

    // Room number exact match
    if (room.number && room.number.toLowerCase().includes(queryLower)) {
      score += 100;
    }

    // Room type match
    if (room.type.toLowerCase().includes(queryLower)) {
      score += 75;
    }

    // Description match
    if (room.description && room.description.toLowerCase().includes(queryLower)) {
      score += 50;
    }

    // Amenities match
    if (room.amenities?.some(amenity => amenity.toLowerCase().includes(queryLower))) {
      score += 25;
    }

    // Boost for available rooms
    if (room.status === 'available') {
      score += 15;
    }

    return score;
  }

  calculateBookingRelevance(booking, query, options) {
    let score = 0;
    const queryLower = query.toLowerCase();

    // Booking ID match
    if (booking.bookingId && booking.bookingId.toLowerCase().includes(queryLower)) {
      score += 100;
    }

    // Guest name match
    if (booking.guestDetails?.firstName?.toLowerCase().includes(queryLower) ||
        booking.guestDetails?.lastName?.toLowerCase().includes(queryLower)) {
      score += 90;
    }

    // Email match
    if (booking.guestDetails?.email?.toLowerCase().includes(queryLower)) {
      score += 80;
    }

    // Phone match
    if (booking.guestDetails?.phone?.includes(query)) {
      score += 70;
    }

    // Recent bookings get slight boost
    const daysSinceCreated = (Date.now() - new Date(booking.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 30) {
      score += Math.max(10 - daysSinceCreated / 3, 0);
    }

    return score;
  }

  calculateUserRelevance(user, query, options) {
    let score = 0;
    const queryLower = query.toLowerCase();

    // Name match
    if (user.name.toLowerCase().includes(queryLower)) {
      score += 100;
    }

    // Email match
    if (user.email.toLowerCase().includes(queryLower)) {
      score += 90;
    }

    // Department match
    if (user.profile?.department?.toLowerCase().includes(queryLower)) {
      score += 60;
    }

    // Role-based boost
    const roleBoosts = { 'admin': 10, 'manager': 8, 'staff': 5 };
    score += roleBoosts[user.role] || 0;

    // Active users get boost
    if (user.isActive) {
      score += 15;
    }

    return score;
  }

  calculateResourceRelevance(resource, query, options) {
    let score = 0;
    const queryLower = query.toLowerCase();

    // Name match
    if (resource.name.toLowerCase().includes(queryLower)) {
      score += 100;
    }

    // Category match
    if (resource.category.toLowerCase().includes(queryLower)) {
      score += 80;
    }

    // Description match
    if (resource.description && resource.description.toLowerCase().includes(queryLower)) {
      score += 50;
    }

    // Tags match
    if (resource.tags?.some(tag => tag.toLowerCase().includes(queryLower))) {
      score += 40;
    }

    // Boost for available resources
    if (resource.availability?.status === 'available') {
      score += 20;
    }

    // Boost for shared resources
    if (resource.sharingPolicy === 'open') {
      score += 10;
    }

    return score;
  }

  calculateSuggestionScore(text, query) {
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();

    if (textLower.startsWith(queryLower)) {
      return 100;
    }

    if (textLower.includes(queryLower)) {
      return 80 - (textLower.indexOf(queryLower) * 2);
    }

    return 0;
  }

  // Helper method to sort by relevance
  sortByRelevance(items, query) {
    return items.sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));
  }

  // Helper method to generate highlights
  generateHighlights(items, query, fields) {
    const highlights = [];
    const regex = new RegExp(`(${query})`, 'gi');

    items.forEach(item => {
      fields.forEach(field => {
        const fieldValue = this.getNestedField(item, field);
        if (fieldValue && typeof fieldValue === 'string' && fieldValue.match(regex)) {
          highlights.push({
            itemId: item._id,
            field,
            highlighted: fieldValue.replace(regex, '<mark>$1</mark>')
          });
        }
      });
    });

    return highlights;
  }

  // Helper method to get nested field values
  getNestedField(obj, field) {
    return field.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Helper method to build filter queries
  buildFilterQuery(filters, entityType) {
    const query = {};

    Object.keys(filters).forEach(key => {
      const value = filters[key];
      
      if (value === null || value === undefined) return;

      switch (key) {
        case 'dateRange':
          if (value.start) query.createdAt = { $gte: new Date(value.start) };
          if (value.end) query.createdAt = { ...query.createdAt, $lte: new Date(value.end) };
          break;
          
        case 'priceRange':
          const priceField = entityType === 'rooms' ? 'basePrice' : 'totalAmount';
          if (value.min !== undefined) query[priceField] = { $gte: value.min };
          if (value.max !== undefined) query[priceField] = { ...query[priceField], $lte: value.max };
          break;
          
        case 'status':
          query.status = Array.isArray(value) ? { $in: value } : value;
          break;
          
        case 'type':
          query.type = Array.isArray(value) ? { $in: value } : value;
          break;
          
        case 'amenities':
          if (Array.isArray(value) && value.length > 0) {
            query.amenities = { $all: value };
          }
          break;
          
        case 'location':
          query.$or = [
            { 'address.city': { $regex: value, $options: 'i' } },
            { 'address.country': { $regex: value, $options: 'i' } }
          ];
          break;
          
        default:
          // Direct field match
          query[key] = value;
      }
    });

    return query;
  }

  /**
   * Clear search cache for specific patterns
   * @param {Array} patterns - Cache patterns to clear
   */
  async clearSearchCache(patterns = ['global_search:*', 'search_suggestions:*']) {
    try {
      let totalCleared = 0;
      for (const pattern of patterns) {
        const cleared = await cacheService.delPattern(pattern);
        totalCleared += cleared;
      }
      
      logger.debug(`Cleared ${totalCleared} search cache entries`);
      return totalCleared;
    } catch (error) {
      logger.error('Error clearing search cache:', error);
    }
  }
}

// Create singleton instance
const advancedSearchService = new AdvancedSearchService();

export default advancedSearchService;