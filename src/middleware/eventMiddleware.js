import eventPublisher from '../services/eventPublisher.js';
import logger from '../utils/logger.js';

/**
 * Event Middleware
 * 
 * Automatically publishes events for data changes that need OTA synchronization
 * Attaches to Mongoose middleware hooks to capture database operations
 */

/**
 * Booking Event Middleware
 * Publishes events when bookings are created, modified, or cancelled
 */
export const bookingEventMiddleware = {
  // After booking creation
  postSave: async function(doc) {
    try {
      if (this.isNew) {
        await eventPublisher.publishBookingInventoryChange(doc, 'create', {
          source: 'booking_middleware'
        });
        
        logger.debug('Booking creation event published', {
          bookingId: doc._id,
          roomType: doc.roomType,
          checkIn: doc.checkIn,
          checkOut: doc.checkOut
        });
      }
    } catch (error) {
      logger.error('Failed to publish booking creation event', {
        bookingId: doc._id,
        error: error.message
      });
    }
  },

  // Before booking update
  preUpdate: async function() {
    // Store original values for comparison
    this._originalBooking = await this.model.findOne(this.getQuery());
  },

  // After booking update
  postUpdate: async function(doc) {
    try {
      if (this._originalBooking) {
        // Check if dates or rooms changed
        const datesChanged = this._originalBooking.checkIn !== doc.checkIn || 
                           this._originalBooking.checkOut !== doc.checkOut;
        const roomsChanged = this._originalBooking.rooms !== doc.rooms;
        const statusChanged = this._originalBooking.status !== doc.status;

        if (datesChanged || roomsChanged || statusChanged) {
          await eventPublisher.publishBookingModification({
            hotelId: doc.hotel,
            bookingId: doc._id.toString(),
            modificationType: datesChanged ? 'dates_changed' : 
                            roomsChanged ? 'guest_count_changed' : 'status_changed',
            changes: {
              originalValues: {
                checkIn: this._originalBooking.checkIn,
                checkOut: this._originalBooking.checkOut,
                rooms: this._originalBooking.rooms,
                status: this._originalBooking.status
              },
              newValues: {
                checkIn: doc.checkIn,
                checkOut: doc.checkOut,
                rooms: doc.rooms,
                status: doc.status
              }
            },
            channelBookingId: doc.channelBookingId,
            channel: doc.source,
            source: 'booking_modification'
          }, {
            source: 'booking_middleware'
          });

          logger.debug('Booking modification event published', {
            bookingId: doc._id,
            modificationType: datesChanged ? 'dates_changed' : 
                            roomsChanged ? 'guest_count_changed' : 'status_changed'
          });
        }
      }
    } catch (error) {
      logger.error('Failed to publish booking modification event', {
        bookingId: doc._id,
        error: error.message
      });
    }
  },

  // Before booking removal (cancellation)
  preRemove: async function() {
    try {
      await eventPublisher.publishCancellation({
        hotelId: this.hotel,
        bookingId: this._id.toString(),
        cancellationType: 'hotel_initiated',
        channelBookingId: this.channelBookingId,
        channel: this.source,
        inventoryRelease: {
          roomTypeId: this.roomType,
          dateRange: {
            startDate: this.checkIn.toISOString().split('T')[0],
            endDate: this.checkOut.toISOString().split('T')[0]
          },
          quantity: this.rooms
        },
        source: 'booking_cancellation'
      }, {
        source: 'booking_middleware'
      });

      logger.debug('Booking cancellation event published', {
        bookingId: this._id,
        roomType: this.roomType
      });
    } catch (error) {
      logger.error('Failed to publish booking cancellation event', {
        bookingId: this._id,
        error: error.message
      });
    }
  }
};

/**
 * Room Availability Event Middleware
 * Publishes events when availability is manually updated
 */
export const availabilityEventMiddleware = {
  // After availability update
  postUpdate: async function(doc) {
    try {
      // Only publish if this was a manual update (not from booking operations)
      if (this.getUpdate().$set && !this.options.skipEventPublish) {
        const updates = this.getUpdate().$set;
        
        // Check for availability-related changes
        if ('availableRooms' in updates || 'stopSellFlag' in updates || 
            'closedToArrival' in updates || 'minStay' in updates) {
          
          await eventPublisher.publishAvailabilityUpdate({
            hotelId: doc.hotelId,
            roomTypeId: doc.roomTypeId,
            dateRange: {
              startDate: doc.date.toISOString().split('T')[0],
              endDate: doc.date.toISOString().split('T')[0]
            },
            availability: [{
              date: doc.date.toISOString().split('T')[0],
              available: doc.availableRooms,
              sold: doc.soldRooms,
              blocked: doc.blockedRooms || 0
            }],
            source: 'manual_adjustment'
          }, {
            source: 'availability_middleware'
          });

          logger.debug('Availability update event published', {
            hotelId: doc.hotelId,
            roomTypeId: doc.roomTypeId,
            date: doc.date
          });
        }
      }
    } catch (error) {
      logger.error('Failed to publish availability update event', {
        hotelId: doc.hotelId,
        roomTypeId: doc.roomTypeId,
        error: error.message
      });
    }
  }
};

/**
 * Stop Sell Rules Event Middleware
 * Publishes events when stop sell rules are created, updated, or activated
 */
export const stopSellRuleEventMiddleware = {
  // After rule creation
  postSave: async function(doc) {
    try {
      if (this.isNew && doc.isActive) {
        await eventPublisher.publishStopSellRuleChange(doc, 'apply', {
          source: 'stop_sell_middleware'
        });

        logger.debug('Stop sell rule creation event published', {
          ruleId: doc._id,
          hotelId: doc.hotelId
        });
      }
    } catch (error) {
      logger.error('Failed to publish stop sell rule creation event', {
        ruleId: doc._id,
        error: error.message
      });
    }
  },

  // Before rule update
  preUpdate: async function() {
    this._originalRule = await this.model.findOne(this.getQuery());
  },

  // After rule update
  postUpdate: async function(doc) {
    try {
      if (this._originalRule) {
        const wasActive = this._originalRule.isActive;
        const isActive = doc.isActive;

        if (!wasActive && isActive) {
          // Rule was activated
          await eventPublisher.publishStopSellRuleChange(doc, 'apply', {
            source: 'stop_sell_middleware'
          });
        } else if (wasActive && !isActive) {
          // Rule was deactivated
          await eventPublisher.publishStopSellRuleChange(doc, 'remove', {
            source: 'stop_sell_middleware'
          });
        } else if (isActive) {
          // Rule was modified while active
          await eventPublisher.publishStopSellRuleChange(doc, 'modify', {
            source: 'stop_sell_middleware'
          });
        }

        logger.debug('Stop sell rule update event published', {
          ruleId: doc._id,
          action: !wasActive && isActive ? 'apply' : 
                 wasActive && !isActive ? 'remove' : 'modify'
        });
      }
    } catch (error) {
      logger.error('Failed to publish stop sell rule update event', {
        ruleId: doc._id,
        error: error.message
      });
    }
  }
};

/**
 * Room Type Event Middleware
 * Publishes events when room type information changes
 */
export const roomTypeEventMiddleware = {
  // Before room type update
  preUpdate: async function() {
    this._originalRoomType = await this.model.findOne(this.getQuery());
  },

  // After room type update
  postUpdate: async function(doc) {
    try {
      if (this._originalRoomType) {
        const updates = this.getUpdate().$set || {};
        const significantFields = ['name', 'description', 'maxOccupancy', 'amenities', 'photos'];
        
        const hasSignificantChanges = significantFields.some(field => 
          field in updates && updates[field] !== this._originalRoomType[field]
        );

        if (hasSignificantChanges) {
          const changes = {};
          significantFields.forEach(field => {
            if (field in updates) {
              changes[field] = updates[field];
            }
          });

          await eventPublisher.publishRoomTypeUpdate({
            hotelId: doc.hotel,
            roomTypeId: doc._id.toString(),
            updateType: 'details',
            changes,
            source: 'room_type_update'
          }, {
            source: 'room_type_middleware'
          });

          logger.debug('Room type update event published', {
            roomTypeId: doc._id,
            changesCount: Object.keys(changes).length
          });
        }
      }
    } catch (error) {
      logger.error('Failed to publish room type update event', {
        roomTypeId: doc._id,
        error: error.message
      });
    }
  }
};

/**
 * Apply middleware to Mongoose models
 * Call this function during app initialization to attach event middleware
 */
export const applyEventMiddleware = async () => {
  try {
    // Import models (lazy load to avoid circular dependencies)
    const { default: Booking } = await import('../models/Booking.js');
    const { default: RoomAvailability } = await import('../models/RoomAvailability.js');
    const { default: StopSellRule } = await import('../models/StopSellRule.js');
    const { default: RoomType } = await import('../models/RoomType.js');

    // Apply booking middleware
    Booking.schema.post('save', bookingEventMiddleware.postSave);
    Booking.schema.pre('updateOne', bookingEventMiddleware.preUpdate);
    Booking.schema.pre('findOneAndUpdate', bookingEventMiddleware.preUpdate);
    Booking.schema.post('updateOne', bookingEventMiddleware.postUpdate);
    Booking.schema.post('findOneAndUpdate', bookingEventMiddleware.postUpdate);
    Booking.schema.pre('remove', bookingEventMiddleware.preRemove);
    Booking.schema.pre('deleteOne', bookingEventMiddleware.preRemove);

    // Apply availability middleware
    RoomAvailability.schema.post('updateOne', availabilityEventMiddleware.postUpdate);
    RoomAvailability.schema.post('findOneAndUpdate', availabilityEventMiddleware.postUpdate);

    // Apply stop sell rule middleware
    StopSellRule.schema.post('save', stopSellRuleEventMiddleware.postSave);
    StopSellRule.schema.pre('updateOne', stopSellRuleEventMiddleware.preUpdate);
    StopSellRule.schema.pre('findOneAndUpdate', stopSellRuleEventMiddleware.preUpdate);
    StopSellRule.schema.post('updateOne', stopSellRuleEventMiddleware.postUpdate);
    StopSellRule.schema.post('findOneAndUpdate', stopSellRuleEventMiddleware.postUpdate);

    // Apply room type middleware
    RoomType.schema.pre('updateOne', roomTypeEventMiddleware.preUpdate);
    RoomType.schema.pre('findOneAndUpdate', roomTypeEventMiddleware.preUpdate);
    RoomType.schema.post('updateOne', roomTypeEventMiddleware.postUpdate);
    RoomType.schema.post('findOneAndUpdate', roomTypeEventMiddleware.postUpdate);

    logger.info('Event middleware applied to models successfully');
  } catch (error) {
    logger.error('Failed to apply event middleware', { error: error.message });
    throw error;
  }
};

/**
 * Middleware to skip event publishing for specific operations
 * Add this to query options to prevent automatic event publishing
 */
export const skipEventPublishing = { skipEventPublish: true };

export default {
  bookingEventMiddleware,
  availabilityEventMiddleware,
  stopSellRuleEventMiddleware,
  roomTypeEventMiddleware,
  applyEventMiddleware,
  skipEventPublishing
};
