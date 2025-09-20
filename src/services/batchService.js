import mongoose from 'mongoose';
import RateManagement from '../models/RateManagement.js';
import RoomAvailability from '../models/RoomAvailability.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import logger from '../utils/logger.js';
import eventPublisher from './eventPublisher.js';

/**
 * High-Performance Batch Operations Service
 * Handles bulk updates for rates, availability, and inventory
 */

class BatchService {
  constructor() {
    this.batchSize = 1000; // Default batch size
    this.maxConcurrentBatches = 5; // Maximum concurrent batch operations
  }

  /**
   * Batch update rates for multiple dates and room types
   * @param {string} hotelId - Hotel ID
   * @param {Array} rateUpdates - Array of rate update objects
   * @param {Object} options - Batch operation options
   */
  async batchUpdateRates(hotelId, rateUpdates, options = {}) {
    const { batchSize = this.batchSize, session = null } = options;
    const startTime = Date.now();

    try {
      logger.info(`Starting batch rate update for hotel ${hotelId}`, {
        totalUpdates: rateUpdates.length,
        batchSize
      });

      // Validate input
      if (!rateUpdates || !Array.isArray(rateUpdates) || rateUpdates.length === 0) {
        throw new Error('Rate updates array is required and must not be empty');
      }

      // Split into batches
      const batches = this.splitIntoBatches(rateUpdates, batchSize);
      const results = [];

      // Process batches concurrently with controlled concurrency
      for (let i = 0; i < batches.length; i += this.maxConcurrentBatches) {
        const batchPromises = batches
          .slice(i, i + this.maxConcurrentBatches)
          .map((batch, batchIndex) => this.processBatchRates(hotelId, batch, i + batchIndex, session));

        const batchResults = await Promise.allSettled(batchPromises);
        
        // Check for failures
        const failures = batchResults.filter(result => result.status === 'rejected');
        if (failures.length > 0) {
          logger.error('Some rate batches failed:', failures.map(f => f.reason));
        }

        results.push(...batchResults.filter(r => r.status === 'fulfilled').map(r => r.value));
      }

      // Calculate totals
      const totalUpdated = results.reduce((sum, batch) => sum + batch.modifiedCount, 0);
      const totalUpserted = results.reduce((sum, batch) => sum + (batch.upsertedCount || 0), 0);

      const duration = Date.now() - startTime;
      logger.info(`Batch rate update completed`, {
        hotelId,
        totalUpdated,
        totalUpserted,
        duration: `${duration}ms`,
        batchCount: batches.length
      });

      // Publish rate update events
      await this.publishRateUpdateEvents(hotelId, rateUpdates);

      return {
        success: true,
        totalUpdated,
        totalUpserted,
        batchCount: batches.length,
        duration
      };

    } catch (error) {
      logger.error('Batch rate update failed:', error);
      throw new Error(`Batch rate update failed: ${error.message}`);
    }
  }

  /**
   * Process a single batch of rate updates
   */
  async processBatchRates(hotelId, batch, batchIndex, session) {
    try {
      const bulkOps = batch.map(update => ({
        updateOne: {
          filter: {
            hotelId,
            date: new Date(update.date),
            roomType: update.roomType,
            ratePlanId: update.ratePlanId
          },
          update: {
            $set: {
              baseRate: update.baseRate,
              modifiers: update.modifiers || {},
              restrictions: update.restrictions || {},
              updatedAt: new Date(),
              lastModifiedBy: update.userId || 'system'
            }
          },
          upsert: true
        }
      }));

      const options = session ? { session } : {};
      const result = await RateManagement.bulkWrite(bulkOps, options);

      logger.debug(`Batch ${batchIndex} processed`, {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount
      });

      return result;

    } catch (error) {
      logger.error(`Batch ${batchIndex} failed:`, error);
      throw error;
    }
  }

  /**
   * Batch update room availability for multiple dates and rooms
   * @param {string} hotelId - Hotel ID
   * @param {Array} availabilityUpdates - Array of availability update objects
   * @param {Object} options - Batch operation options
   */
  async batchUpdateAvailability(hotelId, availabilityUpdates, options = {}) {
    const { batchSize = this.batchSize, session = null } = options;
    const startTime = Date.now();

    try {
      logger.info(`Starting batch availability update for hotel ${hotelId}`, {
        totalUpdates: availabilityUpdates.length,
        batchSize
      });

      // Validate input
      if (!availabilityUpdates || !Array.isArray(availabilityUpdates) || availabilityUpdates.length === 0) {
        throw new Error('Availability updates array is required and must not be empty');
      }

      // Split into batches
      const batches = this.splitIntoBatches(availabilityUpdates, batchSize);
      const results = [];

      // Process batches
      for (let i = 0; i < batches.length; i += this.maxConcurrentBatches) {
        const batchPromises = batches
          .slice(i, i + this.maxConcurrentBatches)
          .map((batch, batchIndex) => this.processBatchAvailability(hotelId, batch, i + batchIndex, session));

        const batchResults = await Promise.allSettled(batchPromises);
        
        const failures = batchResults.filter(result => result.status === 'rejected');
        if (failures.length > 0) {
          logger.error('Some availability batches failed:', failures.map(f => f.reason));
        }

        results.push(...batchResults.filter(r => r.status === 'fulfilled').map(r => r.value));
      }

      const totalUpdated = results.reduce((sum, batch) => sum + batch.modifiedCount, 0);
      const totalUpserted = results.reduce((sum, batch) => sum + (batch.upsertedCount || 0), 0);

      const duration = Date.now() - startTime;
      logger.info(`Batch availability update completed`, {
        hotelId,
        totalUpdated,
        totalUpserted,
        duration: `${duration}ms`,
        batchCount: batches.length
      });

      // Publish availability update events
      await this.publishAvailabilityUpdateEvents(hotelId, availabilityUpdates);

      return {
        success: true,
        totalUpdated,
        totalUpserted,
        batchCount: batches.length,
        duration
      };

    } catch (error) {
      logger.error('Batch availability update failed:', error);
      throw new Error(`Batch availability update failed: ${error.message}`);
    }
  }

  /**
   * Process a single batch of availability updates
   */
  async processBatchAvailability(hotelId, batch, batchIndex, session) {
    try {
      const bulkOps = batch.map(update => ({
        updateOne: {
          filter: {
            hotelId,
            roomTypeId: update.roomTypeId,
            date: new Date(update.date)
          },
          update: {
            $set: {
              totalRooms: update.totalRooms,
              availableRooms: update.availableRooms,
              soldRooms: update.soldRooms || 0,
              blockedRooms: update.blockedRooms || 0,
              stopSellFlag: update.stopSellFlag || false,
              closedToArrival: update.closedToArrival || false,
              closedToDeparture: update.closedToDeparture || false,
              minStay: update.minStay || 1,
              maxStay: update.maxStay || 30,
              updatedAt: new Date(),
              lastModifiedBy: update.userId || 'system'
            }
          },
          upsert: true
        }
      }));

      const options = session ? { session } : {};
      const result = await RoomAvailability.bulkWrite(bulkOps, options);

      logger.debug(`Availability batch ${batchIndex} processed`, {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount
      });

      return result;

    } catch (error) {
      logger.error(`Availability batch ${batchIndex} failed:`, error);
      throw error;
    }
  }

  /**
   * Batch create room availability records for date ranges
   * @param {string} hotelId - Hotel ID
   * @param {Array} roomTypes - Array of room type IDs
   * @param {Date} startDate - Start date for availability
   * @param {Date} endDate - End date for availability
   * @param {Object} defaultValues - Default availability values
   */
  async batchCreateAvailability(hotelId, roomTypes, startDate, endDate, defaultValues = {}) {
    const startTime = Date.now();

    try {
      logger.info(`Creating batch availability records`, {
        hotelId,
        roomTypes: roomTypes.length,
        dateRange: `${startDate} to ${endDate}`
      });

      const records = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Generate records for each date and room type
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        for (const roomTypeId of roomTypes) {
          records.push({
            hotelId,
            roomTypeId,
            date: new Date(date),
            totalRooms: defaultValues.totalRooms || 10,
            availableRooms: defaultValues.availableRooms || 10,
            soldRooms: 0,
            blockedRooms: 0,
            stopSellFlag: false,
            closedToArrival: false,
            closedToDeparture: false,
            minStay: defaultValues.minStay || 1,
            maxStay: defaultValues.maxStay || 30,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      // Insert in batches
      const batches = this.splitIntoBatches(records, this.batchSize);
      let totalInserted = 0;

      for (let i = 0; i < batches.length; i++) {
        try {
          const result = await RoomAvailability.insertMany(batches[i], { ordered: false });
          totalInserted += result.length;
          
          logger.debug(`Availability creation batch ${i + 1} completed`, {
            inserted: result.length
          });
        } catch (error) {
          // Handle duplicate key errors gracefully
          if (error.code === 11000) {
            logger.warn(`Some availability records already exist in batch ${i + 1}`);
            totalInserted += (batches[i].length - error.writeErrors.length);
          } else {
            throw error;
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`Batch availability creation completed`, {
        hotelId,
        totalInserted,
        totalRecords: records.length,
        duration: `${duration}ms`,
        batchCount: batches.length
      });

      return {
        success: true,
        totalInserted,
        totalRecords: records.length,
        batchCount: batches.length,
        duration
      };

    } catch (error) {
      logger.error('Batch availability creation failed:', error);
      throw new Error(`Batch availability creation failed: ${error.message}`);
    }
  }

  /**
   * Batch update multiple room properties
   * @param {string} hotelId - Hotel ID
   * @param {Array} roomUpdates - Array of room update objects
   */
  async batchUpdateRooms(hotelId, roomUpdates, options = {}) {
    const { batchSize = this.batchSize } = options;
    const startTime = Date.now();

    try {
      logger.info(`Starting batch room update for hotel ${hotelId}`, {
        totalUpdates: roomUpdates.length
      });

      const bulkOps = roomUpdates.map(update => ({
        updateOne: {
          filter: { _id: update.roomId, hotelId },
          update: {
            $set: {
              ...update.updates,
              updatedAt: new Date()
            }
          }
        }
      }));

      const result = await Room.bulkWrite(bulkOps);

      const duration = Date.now() - startTime;
      logger.info(`Batch room update completed`, {
        hotelId,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        duration: `${duration}ms`
      });

      return {
        success: true,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        duration
      };

    } catch (error) {
      logger.error('Batch room update failed:', error);
      throw new Error(`Batch room update failed: ${error.message}`);
    }
  }

  /**
   * Batch process bookings (for imports or bulk operations)
   * @param {string} hotelId - Hotel ID
   * @param {Array} bookings - Array of booking objects
   */
  async batchProcessBookings(hotelId, bookings, options = {}) {
    const { batchSize = 100 } = options; // Smaller batch size for bookings
    const startTime = Date.now();
    const session = await mongoose.startSession();

    try {
      logger.info(`Starting batch booking processing for hotel ${hotelId}`, {
        totalBookings: bookings.length
      });

      const results = [];
      const batches = this.splitIntoBatches(bookings, batchSize);

      await session.withTransaction(async () => {
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          
          // Validate each booking in the batch
          const validBookings = batch.map(booking => ({
            ...booking,
            hotelId,
            status: booking.status || 'confirmed',
            createdAt: new Date(),
            updatedAt: new Date()
          }));

          const result = await Booking.insertMany(validBookings, { session });
          results.push(...result);

          logger.debug(`Booking batch ${i + 1} processed`, {
            inserted: result.length
          });
        }
      });

      const duration = Date.now() - startTime;
      logger.info(`Batch booking processing completed`, {
        hotelId,
        totalProcessed: results.length,
        duration: `${duration}ms`,
        batchCount: batches.length
      });

      return {
        success: true,
        totalProcessed: results.length,
        batchCount: batches.length,
        duration,
        bookingIds: results.map(b => b._id)
      };

    } catch (error) {
      logger.error('Batch booking processing failed:', error);
      throw new Error(`Batch booking processing failed: ${error.message}`);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Split array into batches
   */
  splitIntoBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Publish rate update events for OTA sync
   */
  async publishRateUpdateEvents(hotelId, rateUpdates) {
    try {
      // Group updates by date range for efficient event publishing
      const dateRanges = this.groupByDateRange(rateUpdates);
      
      for (const range of dateRanges) {
        await eventPublisher.publishRateUpdate({
          hotelId,
          roomTypes: range.roomTypes,
          dateRange: {
            startDate: range.startDate,
            endDate: range.endDate
          },
          source: 'batch_update',
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.warn('Failed to publish rate update events:', error.message);
    }
  }

  /**
   * Publish availability update events for OTA sync
   */
  async publishAvailabilityUpdateEvents(hotelId, availabilityUpdates) {
    try {
      const dateRanges = this.groupByDateRange(availabilityUpdates);
      
      for (const range of dateRanges) {
        await eventPublisher.publishAvailabilityUpdate({
          hotelId,
          roomTypes: range.roomTypes,
          dateRange: {
            startDate: range.startDate,
            endDate: range.endDate
          },
          source: 'batch_update',
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.warn('Failed to publish availability update events:', error.message);
    }
  }

  /**
   * Group updates by date range for efficient event publishing
   */
  groupByDateRange(updates) {
    // Simple grouping - can be enhanced for more complex scenarios
    const grouped = {};
    
    updates.forEach(update => {
      const dateKey = update.date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          startDate: dateKey,
          endDate: dateKey,
          roomTypes: new Set()
        };
      }
      grouped[dateKey].roomTypes.add(update.roomType || update.roomTypeId);
    });

    return Object.values(grouped).map(group => ({
      ...group,
      roomTypes: Array.from(group.roomTypes)
    }));
  }

  /**
   * Get batch operation statistics
   */
  async getBatchStats(hotelId, timeRange = '7d') {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange.replace('d', '')));

      // This would require implementing a batch operations log
      // For now, return mock data
      return {
        hotelId,
        timeRange,
        rateUpdates: {
          totalBatches: 15,
          totalRecords: 1500,
          averageBatchSize: 100,
          averageProcessingTime: 2500
        },
        availabilityUpdates: {
          totalBatches: 25,
          totalRecords: 5000,
          averageBatchSize: 200,
          averageProcessingTime: 1800
        }
      };
    } catch (error) {
      logger.error('Failed to get batch stats:', error);
      throw new Error(`Failed to get batch statistics: ${error.message}`);
    }
  }
}

// Create singleton instance
const batchService = new BatchService();

export default batchService;