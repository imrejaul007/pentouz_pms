import mongoose from 'mongoose';
import RoomAvailability from '../models/RoomAvailability.js';
import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';
import eventPublisher from './eventPublisher.js';

/**
 * Centralized Inventory Service with Real-Time Safety
 * Handles all inventory operations with proper locking and transactions
 */
class InventoryService {
  /**
   * Book rooms with distributed locking and atomic transactions
   * @param {Object} params - Booking parameters
   * @param {string} params.hotelId - Hotel ID
   * @param {string} params.roomTypeId - Room type ID
   * @param {Date} params.checkIn - Check-in date
   * @param {Date} params.checkOut - Check-out date
   * @param {number} params.roomsCount - Number of rooms to book
   * @param {string} params.source - Booking source (PMS, OTA, etc.)
   * @param {string} params.channelId - Channel ID for OTA bookings
   * @param {Object} params.session - MongoDB session for transaction
   */
  static async bookRoomsWithLocking(params) {
    const { hotelId, roomTypeId, checkIn, checkOut, roomsCount, source, channelId, session } = params;
    const lockKey = `inventory_lock:${hotelId}:${roomTypeId}`;
    const lockTimeout = 30000; // 30 seconds
    
    let lockAcquired = false;
    let lockValue = null;
    
    try {
      // 1. Acquire distributed lock with Redis
      lockValue = await this.acquireDistributedLock(lockKey, lockTimeout);
      lockAcquired = true;
      
      logger.info('Inventory lock acquired', { lockKey, lockValue, hotelId, roomTypeId });
      
      // 2. Check availability with atomic read
      const isAvailable = await this.checkAtomicAvailability({
        hotelId, 
        roomTypeId, 
        checkIn, 
        checkOut, 
        roomsCount,
        session
      });
      
      if (!isAvailable) {
        throw new Error(`Insufficient availability: ${roomsCount} rooms from ${checkIn} to ${checkOut}`);
      }
      
      // 3. Update inventory atomically for each date
      const bookingResult = await this.updateInventoryAtomically({
        hotelId,
        roomTypeId,
        checkIn,
        checkOut,
        roomsCount,
        operation: 'book',
        source,
        channelId,
        session
      });
      
      // Publish availability update event to queue for OTA sync
      try {
        const availabilityData = [];
        const startDate = new Date(checkIn);
        const endDate = new Date(checkOut);
        
        for (let date = new Date(startDate); date < endDate; date.setDate(date.getDate() + 1)) {
          // Find the updated availability for this date
          const updatedRecord = bookingResult.find(r => 
            r.date.toISOString().split('T')[0] === date.toISOString().split('T')[0]
          );
          
          if (updatedRecord) {
            availabilityData.push({
              date: date.toISOString().split('T')[0],
              available: updatedRecord.availableRooms,
              sold: updatedRecord.soldRooms
            });
          }
        }

        await eventPublisher.publishAvailabilityUpdate({
          hotelId,
          roomTypeId,
          dateRange: {
            startDate: checkIn.toISOString().split('T')[0],
            endDate: checkOut.toISOString().split('T')[0]
          },
          availability: availabilityData,
          source: 'booking',
          channels: source ? [source] : ['all']
        });
      } catch (publishError) {
        logger.warn('Failed to publish availability update event:', publishError.message);
      }

      logger.info('Rooms booked successfully', { 
        hotelId, 
        roomTypeId, 
        checkIn, 
        checkOut, 
        roomsCount, 
        source 
      });
      
      return bookingResult;
      
    } catch (error) {
      logger.error('Failed to book rooms with locking', {
        error: error.message,
        hotelId,
        roomTypeId,
        checkIn,
        checkOut,
        roomsCount
      });
      throw error;
      
    } finally {
      // Always release the lock
      if (lockAcquired && lockValue) {
        await this.releaseDistributedLock(lockKey, lockValue);
        logger.info('Inventory lock released', { lockKey, lockValue });
      }
    }
  }
  
  /**
   * Release rooms with distributed locking and atomic transactions
   */
  static async releaseRoomsWithLocking(params) {
    const { hotelId, roomTypeId, checkIn, checkOut, roomsCount, source, session } = params;
    const lockKey = `inventory_lock:${hotelId}:${roomTypeId}`;
    const lockTimeout = 30000;
    
    let lockAcquired = false;
    let lockValue = null;
    
    try {
      // Acquire distributed lock
      lockValue = await this.acquireDistributedLock(lockKey, lockTimeout);
      lockAcquired = true;
      
      // Update inventory atomically
      const releaseResult = await this.updateInventoryAtomically({
        hotelId,
        roomTypeId,
        checkIn,
        checkOut,
        roomsCount,
        operation: 'release',
        source,
        session
      });
      
      // Publish availability update event to queue for OTA sync
      try {
        const availabilityData = [];
        const startDate = new Date(checkIn);
        const endDate = new Date(checkOut);
        
        for (let date = new Date(startDate); date < endDate; date.setDate(date.getDate() + 1)) {
          // Find the updated availability for this date
          const updatedRecord = releaseResult.find(r => 
            r.date.toISOString().split('T')[0] === date.toISOString().split('T')[0]
          );
          
          if (updatedRecord) {
            availabilityData.push({
              date: date.toISOString().split('T')[0],
              available: updatedRecord.availableRooms,
              sold: updatedRecord.soldRooms
            });
          }
        }

        await eventPublisher.publishAvailabilityUpdate({
          hotelId,
          roomTypeId,
          dateRange: {
            startDate: checkIn.toISOString().split('T')[0],
            endDate: checkOut.toISOString().split('T')[0]
          },
          availability: availabilityData,
          source: 'cancellation',
          channels: source ? [source] : ['all']
        });
      } catch (publishError) {
        logger.warn('Failed to publish availability update event:', publishError.message);
      }

      logger.info('Rooms released successfully', { 
        hotelId, 
        roomTypeId, 
        checkIn, 
        checkOut, 
        roomsCount, 
        source 
      });
      
      return releaseResult;
      
    } catch (error) {
      logger.error('Failed to release rooms with locking', {
        error: error.message,
        hotelId,
        roomTypeId,
        checkIn,
        checkOut,
        roomsCount
      });
      throw error;
      
    } finally {
      if (lockAcquired && lockValue) {
        await this.releaseDistributedLock(lockKey, lockValue);
      }
    }
  }
  
  /**
   * Check availability atomically within transaction
   */
  static async checkAtomicAvailability({ hotelId, roomTypeId, checkIn, checkOut, roomsCount, session }) {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    
    // Check each date in the range
    for (let date = new Date(startDate); date < endDate; date.setDate(date.getDate() + 1)) {
      const availability = await RoomAvailability.findOne({
        hotelId,
        roomTypeId,
        date: new Date(date)
      }).session(session);
      
      if (!availability) {
        logger.warn('No availability record found', { hotelId, roomTypeId, date });
        return false;
      }
      
      // Check business rules
      if (availability.stopSellFlag || 
          availability.closedToArrival || 
          availability.availableRooms < roomsCount) {
        logger.warn('Availability check failed', { 
          hotelId, 
          roomTypeId, 
          date, 
          availableRooms: availability.availableRooms,
          requestedRooms: roomsCount,
          stopSellFlag: availability.stopSellFlag,
          closedToArrival: availability.closedToArrival
        });
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Update inventory atomically for date range
   */
  static async updateInventoryAtomically({ hotelId, roomTypeId, checkIn, checkOut, roomsCount, operation, source, channelId, session }) {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const results = [];
    
    for (let date = new Date(startDate); date < endDate; date.setDate(date.getDate() + 1)) {
      const updateFields = operation === 'book' 
        ? { 
            $inc: { 
              availableRooms: -roomsCount, 
              soldRooms: roomsCount 
            },
            $push: {
              reservations: {
                source,
                channelId,
                roomsReserved: roomsCount,
                timestamp: new Date()
              }
            }
          }
        : { 
            $inc: { 
              availableRooms: roomsCount, 
              soldRooms: -roomsCount 
            }
          };
      
      const result = await RoomAvailability.findOneAndUpdate(
        {
          hotelId,
          roomTypeId,
          date: new Date(date)
        },
        updateFields,
        { 
          session,
          new: true,
          runValidators: true
        }
      );
      
      if (!result) {
        throw new Error(`Failed to update availability for date: ${date}`);
      }
      
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Acquire distributed lock using Redis with timeout
   */
  static async acquireDistributedLock(lockKey, timeout) {
    const lockValue = `${Date.now()}-${Math.random()}`;
    const redisClient = getRedisClient();
    const acquired = await redisClient.set(
      lockKey, 
      lockValue, 
      'PX', // milliseconds
      timeout,
      'NX' // only if not exists
    );
    
    if (!acquired) {
      throw new Error(`Failed to acquire lock: ${lockKey}. Another process may be updating inventory.`);
    }
    
    return lockValue;
  }
  
  /**
   * Release distributed lock using Redis with value verification
   */
  static async releaseDistributedLock(lockKey, expectedValue) {
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    
    const redisClient = getRedisClient();
    const released = await redisClient.eval(script, 1, lockKey, expectedValue);
    return released === 1;
  }
  
  /**
   * Get availability with channel-specific overrides
   */
  static async getChannelAvailability(hotelId, roomTypeId, date, channelId) {
    const availability = await RoomAvailability.findOne({
      hotelId,
      roomTypeId,
      date: new Date(date)
    }).lean();
    
    if (!availability) {
      return null;
    }
    
    // Apply channel-specific overrides if exists
    const channelOverride = availability.channelInventory?.find(
      ci => ci.channel?.toString() === channelId
    );
    
    if (channelOverride) {
      return {
        ...availability,
        availableRooms: channelOverride.channelAvailableRooms || availability.availableRooms,
        sellingRate: channelOverride.channelRate || availability.sellingRate,
        closedToArrival: channelOverride.closedToArrival ?? availability.closedToArrival,
        stopSellFlag: channelOverride.stopSell ?? availability.stopSellFlag
      };
    }
    
    return availability;
  }
  
  /**
   * Update channel-specific inventory settings
   */
  static async updateChannelInventory(hotelId, roomTypeId, date, channelId, updates) {
    return await RoomAvailability.findOneAndUpdate(
      {
        hotelId,
        roomTypeId,
        date: new Date(date),
        'channelInventory.channel': channelId
      },
      {
        $set: Object.keys(updates).reduce((acc, key) => {
          acc[`channelInventory.$.${key}`] = updates[key];
          return acc;
        }, {})
      },
      { new: true }
    );
  }
  
  /**
   * Batch availability check for multiple dates/rooms
   */
  static async batchAvailabilityCheck(requests) {
    const results = [];
    
    for (const request of requests) {
      try {
        const available = await this.checkAtomicAvailability({
          ...request,
          session: null // No session for read-only operations
        });
        
        results.push({
          ...request,
          available,
          error: null
        });
      } catch (error) {
        results.push({
          ...request,
          available: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

export default InventoryService;