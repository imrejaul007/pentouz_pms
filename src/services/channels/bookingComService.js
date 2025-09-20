import axios from 'axios';
import { Channel, InventorySync, ReservationMapping } from '../../models/ChannelManager.js';
import RoomAvailability from '../../models/RoomAvailability.js';
import RoomType from '../../models/RoomType.js';
import Booking from '../../models/Booking.js';
import AuditLog from '../../models/AuditLog.js';

/**
 * Booking.com Channel Integration Service
 * Handles rate, availability, and reservation sync with Booking.com
 */
class BookingComService {
  
  constructor() {
    this.baseURL = process.env.BOOKINGCOM_API_BASE || 'https://api.sandbox.booking.com';
    this.clientId = process.env.BOOKINGCOM_CLIENT_ID;
    this.clientSecret = process.env.BOOKINGCOM_CLIENT_SECRET;
    this.channelName = 'Booking.com';
    this.channelType = 'ota';
  }

  /**
   * Initialize Booking.com channel for a hotel
   * @param {Object} params - { hotelId, credentials, settings }
   */
  async initializeChannel({ hotelId, credentials, settings = {} }) {
    try {
      // Check if channel already exists
      let channel = await Channel.findOne({
        category: 'booking.com',
        'credentials.hotelId': credentials.hotelId
      });

      if (channel) {
        console.log('✅ Booking.com channel already exists');
        return { success: true, channel, isExisting: true };
      }

      // Create new channel configuration
      const channelData = {
        channelId: `booking_com_${hotelId}_${Date.now()}`,
        name: 'Booking.com',
        type: 'ota',
        category: 'booking.com',
        isActive: true,
        connectionStatus: 'pending',
        credentials: {
          apiKey: credentials.apiKey || this.clientId,
          apiSecret: credentials.apiSecret || this.clientSecret,
          hotelId: credentials.hotelId, // Booking.com hotel ID
          username: credentials.username,
          password: credentials.password,
          endpoint: this.baseURL
        },
        settings: {
          autoSync: true,
          syncFrequency: 15, // minutes
          enableRateSync: true,
          enableInventorySync: true,
          enableRestrictionSync: true,
          commission: settings.commission || 18, // Booking.com standard commission
          currency: settings.currency || 'INR',
          defaultLeadTime: 0,
          maxLeadTime: 365,
          minLengthOfStay: 1,
          maxLengthOfStay: 30,
          ...settings
        },
        roomMappings: [], // Will be populated later
        lastSync: {
          rates: null,
          inventory: null,
          restrictions: null,
          reservations: null
        }
      };

      channel = new Channel(channelData);
      await channel.save();

      // Test connection
      const connectionTest = await this.testConnection(channel);
      if (connectionTest.success) {
        channel.connectionStatus = 'connected';
        await channel.save();
      }

      // Log channel creation
      await AuditLog.logChange({
        hotelId,
        tableName: 'Channel',
        recordId: channel._id,
        changeType: 'create',
        source: 'channel_setup',
        newValues: {
          channelName: 'Booking.com',
          connectionStatus: channel.connectionStatus
        },
        metadata: {
          tags: ['channel-integration', 'booking.com', 'setup']
        }
      });

      return {
        success: true,
        channel,
        isExisting: false,
        message: 'Booking.com channel initialized successfully'
      };

    } catch (error) {
      console.error('Failed to initialize Booking.com channel:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test connection to Booking.com API
   * @param {Object} channel - Channel configuration
   */
  async testConnection(channel) {
    try {
      const response = await axios.get(`${channel.credentials.endpoint}/v1/hotels/${channel.credentials.hotelId}/info`, {
        auth: {
          username: channel.credentials.username,
          password: channel.credentials.password
        },
        timeout: 10000
      });

      if (response.status === 200) {
        return {
          success: true,
          message: 'Connection successful',
          hotelInfo: response.data
        };
      }

      return {
        success: false,
        message: 'Connection failed'
      };

    } catch (error) {
      console.error('Booking.com connection test failed:', error);
      return {
        success: false,
        message: error.message,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Create room type mappings between hotel and Booking.com
   * @param {string} channelId - Channel ID
   * @param {Array} mappings - Room type mappings
   */
  async createRoomMappings(channelId, mappings) {
    try {
      const channel = await Channel.findOne({ channelId });
      if (!channel) {
        throw new Error('Channel not found');
      }

      // Process each mapping
      const processedMappings = [];
      for (const mapping of mappings) {
        const roomType = await RoomType.findById(mapping.hotelRoomTypeId);
        if (!roomType) {
          console.warn(`Room type ${mapping.hotelRoomTypeId} not found`);
          continue;
        }

        const roomMapping = {
          hotelRoomTypeId: mapping.hotelRoomTypeId,
          channelRoomTypeId: mapping.channelRoomTypeId,
          channelRoomTypeName: mapping.channelRoomTypeName,
          ratePlanMappings: mapping.ratePlans || [
            {
              hotelRatePlanId: 'BAR', // Base Available Rate
              channelRatePlanId: mapping.channelRoomTypeId,
              channelRatePlanName: `${mapping.channelRoomTypeName} - Standard Rate`
            }
          ]
        };

        processedMappings.push(roomMapping);

        // Log the mapping
        await AuditLog.logChange({
          hotelId: roomType.hotelId,
          tableName: 'Channel',
          recordId: channel._id,
          changeType: 'update',
          source: 'room_mapping',
          newValues: {
            roomTypeName: roomType.name,
            channelRoomTypeId: mapping.channelRoomTypeId,
            channelRoomTypeName: mapping.channelRoomTypeName
          },
          metadata: {
            tags: ['room-mapping', 'booking.com']
          }
        });
      }

      // Update channel with mappings
      channel.roomMappings = processedMappings;
      await channel.save();

      return {
        success: true,
        message: `Created ${processedMappings.length} room mappings`,
        mappings: processedMappings
      };

    } catch (error) {
      console.error('Failed to create room mappings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync rates and availability to Booking.com
   * @param {string} channelId - Channel ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async syncRatesAndAvailability(channelId, startDate, endDate) {
    try {
      const channel = await Channel.findOne({ channelId }).populate('roomMappings.hotelRoomTypeId');
      if (!channel) {
        throw new Error('Channel not found');
      }

      const syncResults = [];
      let totalSynced = 0;
      let errors = 0;

      for (const roomMapping of channel.roomMappings) {
        try {
          // Get availability data for this room type
          const availabilityRecords = await RoomAvailability.find({
            roomTypeId: roomMapping.hotelRoomTypeId,
            date: { $gte: startDate, $lte: endDate }
          }).sort({ date: 1 });

          if (availabilityRecords.length === 0) {
            console.log(`No availability data for room type ${roomMapping.hotelRoomTypeId}`);
            continue;
          }

          // Prepare sync data for Booking.com API
          const syncData = availabilityRecords.map(record => ({
            date: record.date.toISOString().split('T')[0], // YYYY-MM-DD format
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

          // Send to Booking.com (simulated - replace with actual API call)
          const syncResult = await this.sendToBookingCom(channel, syncData);
          
          if (syncResult.success) {
            totalSynced += syncData.length;
            
            // Update sync status in availability records
            await RoomAvailability.updateMany(
              {
                roomTypeId: roomMapping.hotelRoomTypeId,
                date: { $gte: startDate, $lte: endDate }
              },
              {
                $set: {
                  needsSync: false,
                  lastSyncedAt: new Date()
                }
              }
            );

            // Log successful sync
            await AuditLog.logChannelSync(
              roomMapping.hotelRoomTypeId.hotelId,
              channel,
              {
                tableName: 'RoomAvailability',
                recordId: roomMapping.hotelRoomTypeId,
                newValues: {
                  recordsSynced: syncData.length,
                  dateRange: { startDate, endDate }
                }
              },
              true
            );

          } else {
            errors++;
            console.error(`Sync failed for room type ${roomMapping.channelRoomTypeName}:`, syncResult.error);
          }

          syncResults.push({
            roomType: roomMapping.channelRoomTypeName,
            recordsSynced: syncData.length,
            success: syncResult.success,
            error: syncResult.error
          });

        } catch (roomError) {
          errors++;
          console.error(`Error syncing room type ${roomMapping.channelRoomTypeName}:`, roomError);
          
          syncResults.push({
            roomType: roomMapping.channelRoomTypeName,
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
        message: `Synced ${totalSynced} records with ${errors} errors`,
        totalSynced,
        errors,
        details: syncResults
      };

    } catch (error) {
      console.error('Sync failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send data to Booking.com API (simulated for now)
   * @param {Object} channel - Channel configuration
   * @param {Array} syncData - Data to sync
   */
  async sendToBookingCom(channel, syncData) {
    try {
      // This is a simulation - in production, you would call the actual Booking.com API
      console.log(`📤 [SIMULATION] Sending ${syncData.length} records to Booking.com...`);
      console.log('📊 Sample data:', syncData.slice(0, 2));

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate success (in production, handle actual API response)
      return {
        success: true,
        message: 'Data sent successfully to Booking.com',
        recordsProcessed: syncData.length
      };

      /* 
      // PRODUCTION CODE (uncomment when ready):
      const response = await axios.post(
        `${channel.credentials.endpoint}/v1/hotels/${channel.credentials.hotelId}/inventory`,
        {
          inventory_updates: syncData
        },
        {
          auth: {
            username: channel.credentials.username,
            password: channel.credentials.password
          },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      return {
        success: response.status === 200,
        message: response.data.message || 'Sync completed',
        recordsProcessed: syncData.length,
        response: response.data
      };
      */

    } catch (error) {
      console.error('Failed to send data to Booking.com:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle incoming reservation from Booking.com
   * @param {Object} reservationData - Booking.com reservation data
   */
  async handleIncomingReservation(reservationData) {
    try {
      // Find the channel mapping
      const channel = await Channel.findOne({ category: 'booking.com' });
      if (!channel) {
        throw new Error('Booking.com channel not found');
      }

      // Map Booking.com room type to hotel room type
      const roomMapping = channel.roomMappings.find(
        mapping => mapping.channelRoomTypeId === reservationData.room_type_id
      );

      if (!roomMapping) {
        throw new Error(`Room mapping not found for ${reservationData.room_type_id}`);
      }

      // Create booking in hotel system
      const booking = new Booking({
        hotelId: channel.hotelId, // This should be set based on channel config
        userId: null, // OTA bookings don't have user accounts
        rooms: [{
          roomId: null, // Will be assigned during check-in
          rate: reservationData.rate
        }],
        checkIn: new Date(reservationData.checkin_date),
        checkOut: new Date(reservationData.checkout_date),
        status: 'confirmed',
        paymentStatus: 'paid', // Booking.com handles payments
        totalAmount: reservationData.total_amount,
        currency: reservationData.currency,
        roomType: roomMapping.hotelRoomTypeId.legacyType, // For backward compatibility
        
        // OTA-specific fields
        channelBookingId: reservationData.booking_id,
        channelReservationId: reservationData.reservation_id,
        channel: channel._id,
        rawBookingPayload: reservationData,
        
        channelData: {
          confirmationCode: reservationData.confirmation_code,
          channelCommission: {
            percentage: channel.settings.commission,
            amount: reservationData.total_amount * (channel.settings.commission / 100)
          },
          paymentMethod: 'virtual_card',
          channelRate: reservationData.rate,
          channelCurrency: reservationData.currency,
          bookerCountry: reservationData.guest_details?.country,
          bookerLanguage: reservationData.guest_details?.language
        },

        guestDetails: {
          adults: reservationData.guest_details?.adults || 1,
          children: reservationData.guest_details?.children || 0,
          specialRequests: reservationData.special_requests
        },

        source: 'booking_com'
      });

      await booking.save();

      // Update room availability
      const availabilityService = (await import('../availabilityService.js')).default;
      await availabilityService.reserveRooms({
        hotelId: booking.hotelId,
        roomTypeId: roomMapping.hotelRoomTypeId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomsCount: booking.rooms.length,
        bookingId: booking._id,
        source: 'booking_com'
      });

      // Create reservation mapping for tracking
      const reservationMapping = new ReservationMapping({
        mappingId: `booking_com_${reservationData.booking_id}_${Date.now()}`,
        hotelReservationId: booking._id,
        channelReservationId: reservationData.booking_id,
        channel: channel._id,
        status: 'confirmed'
      });

      await reservationMapping.save();

      // Log the new booking
      await AuditLog.logBookingChange(booking, 'create', null, {
        source: 'booking_com_webhook',
        channelData: {
          channelBookingId: reservationData.booking_id,
          channelName: 'Booking.com'
        }
      });

      return {
        success: true,
        booking,
        message: 'Booking.com reservation processed successfully'
      };

    } catch (error) {
      console.error('Failed to process Booking.com reservation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get channel performance metrics
   * @param {string} channelId - Channel ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getChannelMetrics(channelId, startDate, endDate) {
    try {
      const channel = await Channel.findOne({ channelId });
      if (!channel) {
        throw new Error('Channel not found');
      }

      const bookings = await Booking.find({
        channel: channel._id,
        createdAt: { $gte: startDate, $lte: endDate },
        source: 'booking_com'
      });

      const totalBookings = bookings.length;
      const totalRevenue = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
      const commission = totalRevenue * (channel.settings.commission / 100);
      const netRevenue = totalRevenue - commission;
      const averageRate = totalBookings > 0 ? totalRevenue / totalBookings : 0;

      return {
        channel: channel.name,
        period: { startDate, endDate },
        metrics: {
          totalBookings,
          totalRevenue,
          commission,
          netRevenue,
          averageRate,
          commissionRate: channel.settings.commission
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

export default BookingComService;