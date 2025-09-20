import queueService from './queueService.js';
import logger from '../utils/logger.js';

/**
 * Event Publisher Service
 * 
 * Publishes various system events to the queue for OTA synchronization
 * Acts as the interface between business operations and the queue system
 */
class EventPublisher {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the event publisher
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      await queueService.initialize();
      this.isInitialized = true;
      
      logger.info('Event publisher initialized');
    } catch (error) {
      logger.error('Failed to initialize event publisher', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure publisher is initialized before publishing events
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Publish rate update event
   * @param {Object} data - Rate update data
   * @param {Object} options - Publishing options
   */
  async publishRateUpdate(data, options = {}) {
    await this.ensureInitialized();

    try {
      const {
        hotelId,
        roomTypeId,
        ratePlanId,
        dateRange,
        rates,
        channelSpecificRates = {},
        channels = ['all'],
        source = 'manual',
        reason = 'Rate update'
      } = data;

      const payload = {
        hotelId,
        roomTypeId,
        ratePlanId,
        dateRange,
        rates,
        channelSpecificRates,
        channels,
        source,
        reason
      };

      const event = await queueService.addEvent('rate_update', payload, {
        priority: options.priority || 3,
        source: options.source || 'system',
        userId: options.userId,
        correlationId: options.correlationId,
        batchId: options.batchId,
        scheduledFor: options.scheduledFor
      });

      logger.info('Rate update event published', {
        eventId: event.eventId,
        roomTypeId,
        ratePlanId,
        dateRange,
        channels: channels.length
      });

      return event;
    } catch (error) {
      logger.error('Failed to publish rate update event', {
        error: error.message,
        data: JSON.stringify(data).substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Publish availability update event
   * @param {Object} data - Availability update data
   * @param {Object} options - Publishing options
   */
  async publishAvailabilityUpdate(data, options = {}) {
    await this.ensureInitialized();

    try {
      const {
        hotelId,
        roomTypeId,
        dateRange,
        availability,
        inventoryType = 'rooms',
        channels = ['all'],
        source = 'booking',
        bookingReference
      } = data;

      const payload = {
        hotelId,
        roomTypeId,
        dateRange,
        availability,
        inventoryType,
        channels,
        source,
        bookingReference
      };

      const event = await queueService.addEvent('availability_update', payload, {
        priority: options.priority || 2, // High priority for inventory changes
        source: options.source || 'system',
        userId: options.userId,
        correlationId: options.correlationId,
        batchId: options.batchId,
        scheduledFor: options.scheduledFor
      });

      logger.info('Availability update event published', {
        eventId: event.eventId,
        roomTypeId,
        dateRange,
        source,
        bookingReference
      });

      return event;
    } catch (error) {
      logger.error('Failed to publish availability update event', {
        error: error.message,
        data: JSON.stringify(data).substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Publish restriction update event
   * @param {Object} data - Restriction update data
   * @param {Object} options - Publishing options
   */
  async publishRestrictionUpdate(data, options = {}) {
    await this.ensureInitialized();

    try {
      const {
        hotelId,
        roomTypeId,
        dateRange,
        restrictions,
        channels = ['all'],
        source = 'manual',
        ruleId
      } = data;

      const payload = {
        hotelId,
        roomTypeId,
        dateRange,
        restrictions,
        channels,
        source,
        ruleId
      };

      const event = await queueService.addEvent('restriction_update', payload, {
        priority: options.priority || 3,
        source: options.source || 'system',
        userId: options.userId,
        correlationId: options.correlationId,
        batchId: options.batchId,
        scheduledFor: options.scheduledFor
      });

      logger.info('Restriction update event published', {
        eventId: event.eventId,
        roomTypeId,
        dateRange,
        ruleId
      });

      return event;
    } catch (error) {
      logger.error('Failed to publish restriction update event', {
        error: error.message,
        data: JSON.stringify(data).substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Publish room type update event
   * @param {Object} data - Room type update data
   * @param {Object} options - Publishing options
   */
  async publishRoomTypeUpdate(data, options = {}) {
    await this.ensureInitialized();

    try {
      const {
        hotelId,
        roomTypeId,
        updateType,
        changes,
        channelMappingUpdates = {},
        channels = ['all'],
        source = 'manual'
      } = data;

      const payload = {
        hotelId,
        roomTypeId,
        updateType,
        changes,
        channelMappingUpdates,
        channels,
        source
      };

      const event = await queueService.addEvent('room_type_update', payload, {
        priority: options.priority || 4, // Lower priority for descriptive changes
        source: options.source || 'system',
        userId: options.userId,
        correlationId: options.correlationId,
        batchId: options.batchId,
        scheduledFor: options.scheduledFor
      });

      logger.info('Room type update event published', {
        eventId: event.eventId,
        roomTypeId,
        updateType,
        changesCount: Object.keys(changes).length
      });

      return event;
    } catch (error) {
      logger.error('Failed to publish room type update event', {
        error: error.message,
        data: JSON.stringify(data).substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Publish booking modification event
   * @param {Object} data - Booking modification data
   * @param {Object} options - Publishing options
   */
  async publishBookingModification(data, options = {}) {
    await this.ensureInitialized();

    try {
      const {
        hotelId,
        bookingId,
        modificationType,
        changes,
        channelBookingId,
        channel,
        inventoryImpact,
        source = 'guest_request'
      } = data;

      const payload = {
        hotelId,
        bookingId,
        modificationType,
        changes,
        channelBookingId,
        channel,
        inventoryImpact,
        channels: channel ? [channel] : [],
        source
      };

      const event = await queueService.addEvent('booking_modification', payload, {
        priority: options.priority || 1, // Highest priority for booking changes
        source: options.source || 'system',
        userId: options.userId,
        correlationId: options.correlationId,
        batchId: options.batchId,
        scheduledFor: options.scheduledFor
      });

      logger.info('Booking modification event published', {
        eventId: event.eventId,
        bookingId,
        modificationType,
        channelBookingId,
        channel
      });

      return event;
    } catch (error) {
      logger.error('Failed to publish booking modification event', {
        error: error.message,
        data: JSON.stringify(data).substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Publish cancellation event
   * @param {Object} data - Cancellation data
   * @param {Object} options - Publishing options
   */
  async publishCancellation(data, options = {}) {
    await this.ensureInitialized();

    try {
      const {
        hotelId,
        bookingId,
        cancellationType,
        channelBookingId,
        channel,
        inventoryRelease,
        refundInfo,
        source = 'guest_initiated'
      } = data;

      const payload = {
        hotelId,
        bookingId,
        cancellationType,
        channelBookingId,
        channel,
        inventoryRelease,
        refundInfo,
        channels: channel ? [channel] : [],
        source
      };

      const event = await queueService.addEvent('cancellation', payload, {
        priority: options.priority || 1, // Highest priority for cancellations
        source: options.source || 'system',
        userId: options.userId,
        correlationId: options.correlationId,
        batchId: options.batchId,
        scheduledFor: options.scheduledFor
      });

      logger.info('Cancellation event published', {
        eventId: event.eventId,
        bookingId,
        cancellationType,
        channelBookingId,
        channel
      });

      return event;
    } catch (error) {
      logger.error('Failed to publish cancellation event', {
        error: error.message,
        data: JSON.stringify(data).substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Publish stop sell update event
   * @param {Object} data - Stop sell update data
   * @param {Object} options - Publishing options
   */
  async publishStopSellUpdate(data, options = {}) {
    await this.ensureInitialized();

    try {
      const {
        hotelId,
        ruleId,
        action,
        affectedRoomTypes,
        dateRange,
        restrictions,
        channelTargeting,
        reason,
        source = 'manual'
      } = data;

      const payload = {
        hotelId,
        ruleId,
        action,
        affectedRoomTypes,
        dateRange,
        restrictions,
        channelTargeting,
        channels: channelTargeting || ['all'],
        reason,
        source
      };

      const event = await queueService.addEvent('stop_sell_update', payload, {
        priority: options.priority || 2, // High priority for stop sell changes
        source: options.source || 'system',
        userId: options.userId,
        correlationId: options.correlationId,
        batchId: options.batchId,
        scheduledFor: options.scheduledFor
      });

      logger.info('Stop sell update event published', {
        eventId: event.eventId,
        ruleId,
        action,
        affectedRoomTypes: affectedRoomTypes.length,
        channels: channelTargeting?.length || 0
      });

      return event;
    } catch (error) {
      logger.error('Failed to publish stop sell update event', {
        error: error.message,
        data: JSON.stringify(data).substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Publish multiple events as a batch
   * @param {Array} events - Array of event data objects
   * @param {Object} options - Batch options
   */
  async publishBatch(events, options = {}) {
    await this.ensureInitialized();

    try {
      const batchEvents = events.map(event => ({
        eventType: event.type,
        payload: event.data,
        options: {
          priority: event.priority,
          scheduledFor: event.scheduledFor,
          ...event.options
        }
      }));

      const createdEvents = await queueService.addBatch(batchEvents, {
        source: options.source || 'bulk_operation',
        userId: options.userId,
        batchId: options.batchId
      });

      logger.info('Batch events published', {
        batchId: options.batchId,
        eventCount: createdEvents.length,
        eventTypes: [...new Set(events.map(e => e.type))]
      });

      return createdEvents;
    } catch (error) {
      logger.error('Failed to publish batch events', {
        error: error.message,
        eventCount: events.length
      });
      throw error;
    }
  }

  /**
   * Helper method to publish inventory change from booking
   * @param {Object} booking - Booking object
   * @param {string} changeType - Type of change ('create', 'modify', 'cancel')
   * @param {Object} options - Publishing options
   */
  async publishBookingInventoryChange(booking, changeType, options = {}) {
    try {
      const availabilityData = [];
      
      // Calculate inventory impact
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      
      for (let date = new Date(checkIn); date < checkOut; date.setDate(date.getDate() + 1)) {
        const impact = changeType === 'cancel' ? 1 : -1; // Release inventory on cancel, consume on create/modify
        
        availabilityData.push({
          date: new Date(date).toISOString().split('T')[0],
          available: impact * booking.rooms,
          sold: -impact * booking.rooms
        });
      }

      return await this.publishAvailabilityUpdate({
        hotelId: booking.hotel,
        roomTypeId: booking.roomType,
        dateRange: {
          startDate: checkIn.toISOString().split('T')[0],
          endDate: checkOut.toISOString().split('T')[0]
        },
        availability: availabilityData,
        source: changeType,
        bookingReference: booking._id.toString(),
        channels: booking.source ? [booking.source] : ['all']
      }, options);
      
    } catch (error) {
      logger.error('Failed to publish booking inventory change', {
        bookingId: booking._id,
        changeType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Helper method to publish rate changes from rate plan updates
   * @param {Object} ratePlan - Rate plan object
   * @param {Object} rateChanges - Rate changes data
   * @param {Object} options - Publishing options
   */
  async publishRatePlanUpdate(ratePlan, rateChanges, options = {}) {
    try {
      return await this.publishRateUpdate({
        hotelId: ratePlan.hotel,
        roomTypeId: ratePlan.roomType,
        ratePlanId: ratePlan._id.toString(),
        dateRange: rateChanges.dateRange,
        rates: rateChanges.rates,
        channelSpecificRates: rateChanges.channelSpecificRates || {},
        channels: rateChanges.channels || ['all'],
        source: 'revenue_management',
        reason: rateChanges.reason || 'Rate plan updated'
      }, options);
      
    } catch (error) {
      logger.error('Failed to publish rate plan update', {
        ratePlanId: ratePlan._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Helper method to publish stop sell rule changes
   * @param {Object} stopSellRule - Stop sell rule object
   * @param {string} action - Action taken ('apply', 'remove', 'modify')
   * @param {Object} options - Publishing options
   */
  async publishStopSellRuleChange(stopSellRule, action, options = {}) {
    try {
      return await this.publishStopSellUpdate({
        hotelId: stopSellRule.hotelId,
        ruleId: stopSellRule._id.toString(),
        action,
        affectedRoomTypes: stopSellRule.allRoomTypes ? [] : stopSellRule.roomTypes.map(rt => rt.toString()),
        dateRange: {
          startDate: stopSellRule.dateRange.startDate.toISOString().split('T')[0],
          endDate: stopSellRule.dateRange.endDate.toISOString().split('T')[0]
        },
        restrictions: stopSellRule.actions,
        channelTargeting: stopSellRule.allChannels ? ['all'] : stopSellRule.channels,
        reason: `Stop sell rule ${action}ed: ${stopSellRule.name}`,
        source: 'stop_sell_rule'
      }, options);
      
    } catch (error) {
      logger.error('Failed to publish stop sell rule change', {
        ruleId: stopSellRule._id,
        action,
        error: error.message
      });
      throw error;
    }
  }
}

// Create singleton instance
const eventPublisher = new EventPublisher();

export default eventPublisher;