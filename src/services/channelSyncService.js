import mongoose from 'mongoose';
import { Channel } from '../models/ChannelManager.js';
import RoomAvailability from '../models/RoomAvailability.js';
import RoomType from '../models/RoomType.js';
import Booking from '../models/Booking.js';
import AuditLog from '../models/AuditLog.js';
import BookingComService from './channels/bookingComService.js';

/**
 * Centralized Channel Synchronization Service
 * Handles rate and availability sync across all OTA channels
 */
class ChannelSyncService {
  
  constructor() {
    this.channelServices = {
      'booking.com': new BookingComService()
    };
    this.syncInProgress = new Set();
  }

  /**
   * Sync rates and availability for a hotel across all channels
   * @param {string} hotelId - Hotel ID
   * @param {Object} options - Sync options
   */
  async syncHotelToChannels(hotelId, options = {}) {
    try {
      const {
        startDate = new Date(),
        endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        roomTypeId = null,
        channelId = null,
        force = false
      } = options;

      console.log(`🔄 Starting hotel sync for ${hotelId}...`);

      // Prevent duplicate syncs for the same hotel
      const syncKey = `${hotelId}_${roomTypeId || 'all'}`;
      if (this.syncInProgress.has(syncKey) && !force) {
        console.log(`⚠️  Sync already in progress for ${syncKey}`);
        return {
          success: false,
          message: 'Sync already in progress'
        };
      }

      this.syncInProgress.add(syncKey);

      try {
        // Get active channels for this hotel
        const channelQuery = {
          hotelId,
          isActive: true,
          connectionStatus: 'connected'
        };

        if (channelId) {
          channelQuery.channelId = channelId;
        }

        const channels = await Channel.find(channelQuery);

        if (channels.length === 0) {
          return {
            success: false,
            message: 'No active channels found for this hotel'
          };
        }

        console.log(`📡 Found ${channels.length} active channels`);

        // Get room types to sync
        const roomTypeQuery = { hotelId, isActive: true };
        if (roomTypeId) {
          roomTypeQuery._id = roomTypeId;
        }

        const roomTypes = await RoomType.find(roomTypeQuery);

        if (roomTypes.length === 0) {
          return {
            success: false,
            message: 'No active room types found'
          };
        }

        console.log(`🏨 Syncing ${roomTypes.length} room types`);

        // Sync each channel
        const results = [];
        let totalSynced = 0;
        let errors = 0;

        for (const channel of channels) {
          try {
            const channelResult = await this.syncChannelRatesAndAvailability(
              channel,
              roomTypes,
              startDate,
              endDate
            );

            results.push({
              channel: channel.name,
              channelId: channel.channelId,
              success: channelResult.success,
              message: channelResult.message,
              recordsSynced: channelResult.totalSynced || 0,
              errors: channelResult.errors || 0
            });

            if (channelResult.success) {
              totalSynced += channelResult.totalSynced || 0;
            } else {
              errors++;
            }

          } catch (channelError) {
            console.error(`Channel sync error for ${channel.name}:`, channelError);
            results.push({
              channel: channel.name,
              channelId: channel.channelId,
              success: false,
              message: channelError.message,
              recordsSynced: 0,
              errors: 1
            });
            errors++;
          }
        }

        return {
          success: errors === 0,
          message: `Synced ${totalSynced} records across ${channels.length} channels with ${errors} errors`,
          totalChannels: channels.length,
          totalRoomTypes: roomTypes.length,
          totalSynced,
          errors,
          results
        };

      } finally {
        this.syncInProgress.delete(syncKey);
      }

    } catch (error) {
      console.error('Hotel sync failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync rates and availability for a specific channel
   * @param {Object} channel - Channel document
   * @param {Array} roomTypes - Room types to sync
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async syncChannelRatesAndAvailability(channel, roomTypes, startDate, endDate) {
    try {
      const channelService = this.channelServices[channel.category];
      if (!channelService) {
        throw new Error(`No service available for channel ${channel.category}`);
      }

      console.log(`📤 Syncing to ${channel.name}...`);

      // Get availability data for all room types
      const availabilityData = await this.getAvailabilityForSync(
        channel.hotelId,
        roomTypes,
        startDate,
        endDate
      );

      if (availabilityData.length === 0) {
        return {
          success: false,
          message: 'No availability data found to sync'
        };
      }

      // Group by room type and prepare sync data
      const syncResults = [];
      let totalSynced = 0;
      let errors = 0;

      for (const roomType of roomTypes) {
        try {
          // Find mapping for this room type
          const roomMapping = channel.roomMappings.find(
            mapping => mapping.hotelRoomTypeId.toString() === roomType._id.toString()
          );

          if (!roomMapping) {
            console.warn(`No mapping found for room type ${roomType.name}`);
            continue;
          }

          // Filter availability for this room type
          const roomTypeAvailability = availabilityData.filter(
            av => av.roomTypeId.toString() === roomType._id.toString()
          );

          if (roomTypeAvailability.length === 0) {
            continue;
          }

          // Prepare sync data for this room type
          const syncData = roomTypeAvailability.map(record => ({
            date: record.date.toISOString().split('T')[0],
            room_type_id: roomMapping.channelRoomTypeId,
            availability: record.availableRooms,
            rate: record.sellingRate || record.baseRate,
            currency: record.currency,
            restrictions: {
              closed: record.stopSellFlag,
              closed_to_arrival: record.closedToArrival,
              closed_to_departure: record.closedToDeparture,
              min_length_of_stay: record.minLengthOfStay,
              max_length_of_stay: record.maxLengthOfStay
            }
          }));

          // Sync to channel
          const channelSyncResult = await channelService.sendToBookingCom(channel, syncData);

          if (channelSyncResult.success) {
            totalSynced += syncData.length;

            // Update sync status in availability records
            await RoomAvailability.updateMany(
              {
                hotelId: channel.hotelId,
                roomTypeId: roomType._id,
                date: { $gte: startDate, $lte: endDate }
              },
              {
                $set: {
                  needsSync: false,
                  lastSyncedAt: new Date(),
                  [`syncStatus.${channel.category}`]: {
                    synced: true,
                    syncedAt: new Date(),
                    recordCount: syncData.length
                  }
                }
              }
            );

            // Log successful sync
            await AuditLog.logChannelSync(
              channel.hotelId,
              channel,
              {
                tableName: 'RoomAvailability',
                recordId: roomType._id,
                newValues: {
                  recordsSynced: syncData.length,
                  dateRange: { startDate, endDate }
                }
              },
              true
            );

          } else {
            errors++;
            console.error(`Sync failed for room type ${roomType.name}:`, channelSyncResult.error);
          }

          syncResults.push({
            roomType: roomType.name,
            recordsSynced: syncData.length,
            success: channelSyncResult.success,
            error: channelSyncResult.error
          });

        } catch (roomError) {
          errors++;
          console.error(`Error syncing room type ${roomType.name}:`, roomError);
          syncResults.push({
            roomType: roomType.name,
            success: false,
            error: roomError.message
          });
        }
      }

      // Update channel's last sync time
      channel.lastSync.rates = new Date();
      channel.lastSync.inventory = new Date();
      await channel.save();

      return {
        success: errors === 0,
        message: `Synced ${totalSynced} records for ${roomTypes.length} room types with ${errors} errors`,
        totalSynced,
        errors,
        details: syncResults
      };

    } catch (error) {
      console.error(`Channel sync failed for ${channel.name}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get availability data for sync
   * @param {string} hotelId - Hotel ID
   * @param {Array} roomTypes - Room types
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getAvailabilityForSync(hotelId, roomTypes, startDate, endDate) {
    try {
      const roomTypeIds = roomTypes.map(rt => rt._id);

      const availability = await RoomAvailability.find({
        hotelId,
        roomTypeId: { $in: roomTypeIds },
        date: { $gte: startDate, $lte: endDate }
      }).populate('roomTypeId').sort({ date: 1 });

      return availability;

    } catch (error) {
      console.error('Failed to get availability for sync:', error);
      return [];
    }
  }

  /**
   * Handle incoming reservation from OTA
   * @param {string} channelCategory - Channel category (e.g., 'booking.com')
   * @param {Object} reservationData - OTA reservation data
   */
  async handleIncomingReservation(channelCategory, reservationData) {
    try {
      const channelService = this.channelServices[channelCategory];
      if (!channelService) {
        throw new Error(`No service available for channel ${channelCategory}`);
      }

      return await channelService.handleIncomingReservation(reservationData);

    } catch (error) {
      console.error('Failed to handle incoming reservation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get sync status for a hotel
   * @param {string} hotelId - Hotel ID
   */
  async getSyncStatus(hotelId) {
    try {
      // Get channels and their last sync times
      const channels = await Channel.find({ hotelId, isActive: true })
        .select('name channelId category lastSync connectionStatus');

      // Get availability records that need sync
      const needsSyncCount = await RoomAvailability.countDocuments({
        hotelId,
        needsSync: true
      });

      // Get recent sync activity
      const recentSyncLogs = await AuditLog.find({
        hotelId,
        tableName: 'RoomAvailability',
        'metadata.tags': 'channel-sync'
      })
        .sort({ timestamp: -1 })
        .limit(10)
        .select('timestamp changeType newValues metadata');

      return {
        success: true,
        channels: channels.map(channel => ({
          name: channel.name,
          channelId: channel.channelId,
          category: channel.category,
          connectionStatus: channel.connectionStatus,
          lastSync: channel.lastSync,
          isActive: channel.isActive
        })),
        needsSyncCount,
        isInProgress: this.syncInProgress.has(`${hotelId}_all`),
        recentActivity: recentSyncLogs
      };

    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update channel inventory after booking change
   * @param {Object} booking - Booking document
   * @param {string} action - 'create', 'cancel', 'modify'
   */
  async updateChannelInventoryAfterBooking(booking, action) {
    try {
      if (!booking.hotelId) return;

      console.log(`📋 Updating channel inventory after booking ${action}`);

      // Get the room type for this booking
      const roomType = await RoomType.findOne({
        hotelId: booking.hotelId,
        $or: [
          { legacyType: booking.roomType },
          { _id: booking.roomTypeId }
        ]
      });

      if (!roomType) {
        console.warn('Room type not found for booking', booking._id);
        return;
      }

      // Update availability based on action
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);

      // Calculate inventory change
      let inventoryChange = 0;
      switch (action) {
        case 'create':
          inventoryChange = -booking.rooms.length; // Reduce available
          break;
        case 'cancel':
          inventoryChange = booking.rooms.length; // Increase available
          break;
        case 'modify':
          // Handle modification logic (would need more context)
          inventoryChange = 0;
          break;
      }

      if (inventoryChange === 0) return;

      // Update availability records for the date range
      const availabilityService = (await import('./availabilityService.js')).default;
      
      if (action === 'create') {
        await availabilityService.reserveRooms({
          hotelId: booking.hotelId,
          roomTypeId: roomType._id,
          checkIn,
          checkOut,
          roomsCount: booking.rooms.length,
          bookingId: booking._id,
          source: booking.source || 'direct'
        });
      } else if (action === 'cancel') {
        await availabilityService.releaseRooms({
          hotelId: booking.hotelId,
          roomTypeId: roomType._id,
          checkIn,
          checkOut,
          roomsCount: booking.rooms.length,
          bookingId: booking._id
        });
      }

      // Trigger sync to channels
      await this.syncHotelToChannels(booking.hotelId, {
        startDate: checkIn,
        endDate: checkOut,
        roomTypeId: roomType._id
      });

    } catch (error) {
      console.error('Failed to update channel inventory:', error);
    }
  }

  /**
   * Get channel performance metrics
   * @param {string} hotelId - Hotel ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getChannelMetrics(hotelId, startDate, endDate) {
    try {
      const channels = await Channel.find({ hotelId, isActive: true });
      const metrics = [];

      for (const channel of channels) {
        const channelService = this.channelServices[channel.category];
        if (!channelService) continue;

        const channelMetrics = await channelService.getChannelMetrics(
          channel.channelId,
          startDate,
          endDate
        );

        if (channelMetrics.success !== false) {
          metrics.push({
            channelId: channel.channelId,
            channelName: channel.name,
            category: channel.category,
            ...channelMetrics
          });
        }
      }

      return {
        success: true,
        period: { startDate, endDate },
        channels: metrics,
        summary: {
          totalChannels: channels.length,
          activeChannels: metrics.length,
          totalBookings: metrics.reduce((sum, m) => sum + (m.metrics?.totalBookings || 0), 0),
          totalRevenue: metrics.reduce((sum, m) => sum + (m.metrics?.totalRevenue || 0), 0),
          totalCommission: metrics.reduce((sum, m) => sum + (m.metrics?.commission || 0), 0)
        }
      };

    } catch (error) {
      console.error('Failed to get channel metrics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new ChannelSyncService();