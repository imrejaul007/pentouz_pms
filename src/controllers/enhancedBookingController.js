import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import RoomAvailability from '../models/RoomAvailability.js';
import AuditLog from '../models/AuditLog.js';
import availabilityService from '../services/availabilityService.js';
import rateManagementService from '../services/rateManagementService.js';
import { v4 as uuidv4 } from 'uuid';

class EnhancedBookingController {
  /**
   * Create booking using new OTA-ready system
   */
  async createBooking(req, res) {
    try {
      const {
        hotelId,
        checkIn,
        checkOut,
        guestDetails,
        roomTypeId, // New: using room type ID
        roomType,   // Legacy: room type string
        roomRequests = 1,
        channel,
        channelBookingId,
        channelReservationId,
        source = 'direct',
        totalAmount,
        currency = 'INR',
        paymentMethod,
        specialRequests,
        ratePlanId
      } = req.body;

      if (!hotelId || !checkIn || !checkOut || !guestDetails) {
        return res.status(400).json({
          success: false,
          message: 'Missing required booking information'
        });
      }

      let finalRoomTypeId = roomTypeId;
      let selectedRoomType;

      // Handle room type resolution (legacy vs new)
      if (!finalRoomTypeId && roomType) {
        selectedRoomType = await RoomType.findByLegacyType(hotelId, roomType);
        finalRoomTypeId = selectedRoomType?._id;
      } else if (finalRoomTypeId) {
        selectedRoomType = await RoomType.findById(finalRoomTypeId);
      }

      if (!selectedRoomType) {
        return res.status(400).json({
          success: false,
          message: 'Invalid room type specified'
        });
      }

      // Check availability using V2 system if room type ID is available
      let availabilityResult;
      if (finalRoomTypeId) {
        availabilityResult = await availabilityService.checkAvailabilityV2({
          hotelId,
          roomTypeId: finalRoomTypeId,
          checkIn,
          checkOut,
          roomsRequested: roomRequests
        });
      } else {
        // Fallback to legacy system
        availabilityResult = await availabilityService.checkAvailability(
          checkIn,
          checkOut,
          roomType,
          roomRequests,
          hotelId
        );
      }

      if (!availabilityResult.available || availabilityResult.availableRooms.length < roomRequests) {
        return res.status(409).json({
          success: false,
          message: 'Insufficient room availability for selected dates',
          availableRooms: availabilityResult.availableRooms.length
        });
      }

      // Calculate rates using rate management system
      let finalRate;
      if (totalAmount) {
        // Use provided total amount
        finalRate = totalAmount / roomRequests;
      } else if (ratePlanId) {
        // Calculate from rate plan
        const rateResult = await rateManagementService.calculateRateFromPlan(
          ratePlanId,
          checkIn,
          checkOut,
          roomRequests
        );
        finalRate = rateResult.finalRate;
      } else {
        // Calculate best available rate
        const bestRate = await rateManagementService.calculateBestRate(
          roomType || selectedRoomType.legacyType,
          checkIn,
          checkOut,
          roomRequests
        );
        finalRate = bestRate ? bestRate.finalRate : selectedRoomType.basePrice;
      }

      // Select specific rooms
      const selectedRooms = availabilityResult.availableRooms.slice(0, roomRequests);
      const bookingRooms = selectedRooms.map(room => ({
        roomId: room._id,
        rate: finalRate
      }));

      // Create booking
      const bookingData = {
        hotelId,
        userId: req.user._id,
        rooms: bookingRooms,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        guestDetails: {
          adults: guestDetails.adults || 1,
          children: guestDetails.children || 0,
          specialRequests: specialRequests || guestDetails.specialRequests
        },
        totalAmount: finalRate * roomRequests,
        currency,
        source,
        idempotencyKey: req.headers['idempotency-key'] || uuidv4()
      };

      // Add legacy room type for backward compatibility
      if (selectedRoomType.legacyType) {
        bookingData.roomType = selectedRoomType.legacyType;
      }

      // Add OTA-specific data if applicable
      if (channel) {
        bookingData.channel = channel;
        bookingData.channelBookingId = channelBookingId;
        bookingData.channelReservationId = channelReservationId;
        
        if (req.body.channelData) {
          bookingData.channelData = req.body.channelData;
        }
      }

      const booking = new Booking(bookingData);
      await booking.save();

      // Reserve the rooms in inventory system
      if (finalRoomTypeId) {
        await availabilityService.reserveRoomsV2({
          hotelId,
          roomTypeId: finalRoomTypeId,
          checkIn,
          checkOut,
          roomsToReserve: roomRequests,
          bookingId: booking._id
        });
      } else {
        // Fallback to legacy reservation
        await availabilityService.reserveRooms(
          selectedRooms.map(r => r._id),
          checkIn,
          checkOut,
          booking._id
        );
      }

      // Log the booking creation
      await AuditLog.logChange({
        hotelId,
        tableName: 'Booking',
        recordId: booking._id,
        changeType: 'create',
        newValues: booking.toObject(),
        userId: req.user._id,
        userEmail: req.user.email,
        source: source,
        metadata: {
          roomTypeId: finalRoomTypeId,
          channel: channel || 'direct',
          tags: ['booking_creation', 'ota_ready']
        }
      });

      // Populate booking for response
      await booking.populate([
        { path: 'hotelId', select: 'name address contact' },
        { path: 'rooms.roomId', select: 'roomNumber type floor' },
        { path: 'userId', select: 'name email phone' }
      ]);

      res.status(201).json({
        success: true,
        data: {
          booking,
          roomType: selectedRoomType,
          reservedRooms: selectedRooms
        },
        message: 'Booking created successfully'
      });

    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get bookings with enhanced filtering
   */
  async getBookings(req, res) {
    try {
      const {
        hotelId,
        roomTypeId,
        channel,
        source,
        status,
        checkIn,
        checkOut,
        page = 1,
        limit = 10
      } = req.query;

      // Build query based on user role and filters
      const query = {};
      
      if (req.user.role === 'guest') {
        query.userId = req.user._id;
      } else if (req.user.role === 'staff' && req.user.hotelId) {
        query.hotelId = req.user.hotelId;
      }

      if (hotelId && req.user.role === 'admin') {
        query.hotelId = hotelId;
      }

      if (status) query.status = status;
      if (source) query.source = source;
      if (channel) query.channel = channel;

      if (checkIn) {
        query.checkIn = { $gte: new Date(checkIn) };
      }

      if (checkOut) {
        query.checkOut = { $lte: new Date(checkOut) };
      }

      // Filter by room type if specified
      if (roomTypeId) {
        const roomsInType = await Room.find({ 
          roomTypeId, 
          isActive: true 
        }).select('_id');
        
        query['rooms.roomId'] = { 
          $in: roomsInType.map(r => r._id) 
        };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const bookings = await Booking.find(query)
        .populate('userId', 'name email phone')
        .populate('rooms.roomId', 'roomNumber type roomTypeId floor')
        .populate('hotelId', 'name address contact')
        .populate('channel', 'name category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Enhance bookings with room type information
      const enhancedBookings = await Promise.all(
        bookings.map(async (booking) => {
          const bookingObj = booking.toObject();
          
          // Get room type information for each room
          for (let room of bookingObj.rooms) {
            if (room.roomId.roomTypeId) {
              const roomType = await RoomType.findById(room.roomId.roomTypeId)
                .select('name code basePrice maxOccupancy');
              room.roomType = roomType;
            }
          }
          
          return bookingObj;
        })
      );

      const total = await Booking.countDocuments(query);

      res.json({
        success: true,
        results: bookings.length,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        },
        data: enhancedBookings
      });

    } catch (error) {
      console.error('Error getting bookings:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update booking with OTA sync
   */
  async updateBooking(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingBooking = await Booking.findById(id);
      if (!existingBooking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check permissions
      if (req.user.role === 'guest' && existingBooking.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      if (req.user.role === 'staff' && existingBooking.hotelId.toString() !== req.user.hotelId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const oldValues = existingBooking.toObject();

      // Handle date changes - need to update inventory
      if (updateData.checkIn || updateData.checkOut) {
        const newCheckIn = updateData.checkIn ? new Date(updateData.checkIn) : existingBooking.checkIn;
        const newCheckOut = updateData.checkOut ? new Date(updateData.checkOut) : existingBooking.checkOut;

        // Check availability for new dates
        const roomIds = existingBooking.rooms.map(r => r.roomId);
        const roomTypeId = await this.getRoomTypeFromRooms(roomIds);

        if (roomTypeId) {
          const availability = await availabilityService.checkAvailabilityV2({
            hotelId: existingBooking.hotelId,
            roomTypeId,
            checkIn: newCheckIn,
            checkOut: newCheckOut,
            roomsRequested: existingBooking.rooms.length
          });

          if (!availability.available) {
            return res.status(409).json({
              success: false,
              message: 'Rooms not available for new dates'
            });
          }
        }

        // Release old inventory and reserve new
        if (roomTypeId) {
          await availabilityService.releaseRoomsV2({
            hotelId: existingBooking.hotelId,
            roomTypeId,
            checkIn: existingBooking.checkIn,
            checkOut: existingBooking.checkOut,
            roomsToRelease: existingBooking.rooms.length,
            bookingId: existingBooking._id
          });

          await availabilityService.reserveRoomsV2({
            hotelId: existingBooking.hotelId,
            roomTypeId,
            checkIn: newCheckIn,
            checkOut: newCheckOut,
            roomsToReserve: existingBooking.rooms.length,
            bookingId: existingBooking._id
          });
        }
      }

      // Update booking
      const booking = await Booking.findByIdAndUpdate(
        id,
        {
          ...updateData,
          'syncStatus.needsSync': true // Mark for channel sync
        },
        { new: true, runValidators: true }
      );

      // Log modification
      const modificationEntry = {
        modificationId: uuidv4(),
        modificationType: 'amendment',
        modificationDate: new Date(),
        modifiedBy: {
          source: req.body.source || 'manual',
          userId: req.user._id.toString(),
          channel: req.body.channel || null
        },
        oldValues,
        newValues: booking.toObject(),
        reason: updateData.modificationReason || 'Booking updated'
      };

      booking.modifications.push(modificationEntry);
      await booking.save();

      // Log audit trail
      await AuditLog.logChange({
        hotelId: booking.hotelId,
        tableName: 'Booking',
        recordId: booking._id,
        changeType: 'update',
        oldValues,
        newValues: booking.toObject(),
        userId: req.user._id,
        userEmail: req.user.email,
        source: req.body.source || 'manual',
        metadata: {
          modificationType: modificationEntry.modificationType,
          tags: ['booking_update', 'ota_ready']
        }
      });

      await booking.populate([
        { path: 'hotelId', select: 'name address contact' },
        { path: 'rooms.roomId', select: 'roomNumber type roomTypeId floor' },
        { path: 'userId', select: 'name email phone' },
        { path: 'channel', select: 'name category' }
      ]);

      res.json({
        success: true,
        data: booking,
        message: 'Booking updated successfully'
      });

    } catch (error) {
      console.error('Error updating booking:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Cancel booking with inventory release
   */
  async cancelBooking(req, res) {
    try {
      const { id } = req.params;
      const { reason, refundAmount, source = 'manual' } = req.body;

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check if booking can be cancelled
      if (!booking.canCancel()) {
        return res.status(400).json({
          success: false,
          message: 'Booking cannot be cancelled (too close to check-in or already processed)'
        });
      }

      const oldValues = booking.toObject();

      // Release inventory
      const roomIds = booking.rooms.map(r => r.roomId);
      const roomTypeId = await this.getRoomTypeFromRooms(roomIds);

      if (roomTypeId) {
        await availabilityService.releaseRoomsV2({
          hotelId: booking.hotelId,
          roomTypeId,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          roomsToRelease: booking.rooms.length,
          bookingId: booking._id
        });
      } else {
        // Fallback to legacy release
        await availabilityService.releaseRooms(
          roomIds,
          booking.checkIn,
          booking.checkOut
        );
      }

      // Update booking status
      booking.status = 'cancelled';
      booking.cancellationReason = reason;
      booking.syncStatus.needsSync = true;

      // Add cancellation modification
      const cancellationEntry = {
        modificationId: uuidv4(),
        modificationType: 'cancellation',
        modificationDate: new Date(),
        modifiedBy: {
          source: source,
          userId: req.user._id.toString()
        },
        oldValues,
        newValues: { 
          status: 'cancelled', 
          cancellationReason: reason,
          refundAmount 
        },
        reason: reason || 'Booking cancelled'
      };

      booking.modifications.push(cancellationEntry);
      await booking.save();

      // Log audit trail
      await AuditLog.logChange({
        hotelId: booking.hotelId,
        tableName: 'Booking',
        recordId: booking._id,
        changeType: 'update',
        oldValues,
        newValues: booking.toObject(),
        userId: req.user._id,
        userEmail: req.user.email,
        source: source,
        metadata: {
          action: 'cancellation',
          reason,
          refundAmount,
          tags: ['booking_cancellation', 'inventory_release']
        }
      });

      res.json({
        success: true,
        data: booking,
        message: 'Booking cancelled successfully'
      });

    } catch (error) {
      console.error('Error cancelling booking:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get booking analytics by room type
   */
  async getBookingAnalytics(req, res) {
    try {
      const { 
        hotelId, 
        startDate, 
        endDate, 
        groupBy = 'roomType' 
      } = req.query;

      if (!hotelId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID, start date, and end date are required'
        });
      }

      const matchStage = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        status: { $ne: 'cancelled' }
      };

      let groupStage = {};
      let lookupStages = [];

      switch (groupBy) {
        case 'roomType':
          // Need to lookup room type through rooms
          lookupStages = [
            {
              $lookup: {
                from: 'rooms',
                localField: 'rooms.roomId',
                foreignField: '_id',
                as: 'roomDetails'
              }
            },
            {
              $lookup: {
                from: 'roomtypes',
                localField: 'roomDetails.roomTypeId',
                foreignField: '_id',
                as: 'roomTypeDetails'
              }
            }
          ];

          groupStage = {
            _id: {
              roomTypeName: '$roomTypeDetails.name',
              roomTypeCode: '$roomTypeDetails.code'
            },
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            totalRooms: { $sum: { $size: '$rooms' } },
            averageRate: { $avg: '$totalAmount' },
            channels: { $addToSet: '$source' }
          };
          break;

        case 'channel':
          groupStage = {
            _id: '$source',
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            totalRooms: { $sum: { $size: '$rooms' } },
            averageRate: { $avg: '$totalAmount' }
          };
          break;

        case 'status':
          groupStage = {
            _id: '$status',
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            totalRooms: { $sum: { $size: '$rooms' } }
          };
          break;
      }

      const pipeline = [
        { $match: matchStage },
        ...lookupStages,
        { $group: groupStage },
        { $sort: { totalRevenue: -1 } }
      ];

      const analytics = await Booking.aggregate(pipeline);

      res.json({
        success: true,
        data: {
          analytics,
          period: { startDate, endDate },
          groupBy
        }
      });

    } catch (error) {
      console.error('Error getting booking analytics:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Helper method to get room type from room IDs
  async getRoomTypeFromRooms(roomIds) {
    const room = await Room.findById(roomIds[0]).select('roomTypeId');
    return room?.roomTypeId;
  }

  /**
   * Get booking history with modifications
   */
  async getBookingHistory(req, res) {
    try {
      const { id } = req.params;
      const booking = await Booking.findById(id)
        .populate('userId', 'name email phone')
        .populate('rooms.roomId', 'roomNumber type roomTypeId floor')
        .populate('hotelId', 'name address contact');

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check permissions
      if (req.user.role === 'guest' && booking.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      if (req.user.role === 'staff' && booking.hotelId.toString() !== req.user.hotelId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: {
          booking,
          modifications: booking.modifications || [],
          auditTrail: [] // Placeholder for audit trail
        }
      });

    } catch (error) {
      console.error('Error getting booking history:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Sync booking with OTA channels
   */
  async syncBookingWithChannels(req, res) {
    try {
      const { id } = req.params;
      const { channels } = req.body;

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check permissions
      if (req.user.role === 'staff' && booking.hotelId.toString() !== req.user.hotelId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Mock sync results for now
      const syncResults = (channels || ['booking_com', 'expedia']).map(channel => ({
        channel,
        status: 'success',
        message: `Successfully synced to ${channel}`
      }));

      // Mark as synced
      booking.syncStatus = {
        lastSyncedAt: new Date(),
        syncedToChannels: syncResults.map(result => ({
          channel: result.channel,
          syncedAt: new Date(),
          syncStatus: result.status
        })),
        needsSync: false
      };

      await booking.save();

      res.json({
        success: true,
        data: {
          syncResults
        }
      });

    } catch (error) {
      console.error('Error syncing booking with channels:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get channel bookings with reconciliation
   */
  async getChannelBookings(req, res) {
    try {
      const {
        hotelId,
        channel,
        startDate,
        endDate,
        status,
        needsReconciliation,
        page = 1,
        limit = 10
      } = req.query;

      if (!hotelId) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID is required'
        });
      }

      // Build query
      const query = { hotelId };
      if (channel) query.channel = channel;
      if (status) query.status = status;
      if (startDate) query.checkIn = { $gte: new Date(startDate) };
      if (endDate) query.checkOut = { $lte: new Date(endDate) };
      if (needsReconciliation !== undefined) {
        query['syncStatus.needsSync'] = needsReconciliation === 'true';
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const bookings = await Booking.find(query)
        .populate('userId', 'name email phone')
        .populate('rooms.roomId', 'roomNumber type roomTypeId floor')
        .populate('hotelId', 'name address contact')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Booking.countDocuments(query);

      res.json({
        success: true,
        results: bookings.length,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        },
        data: bookings
      });

    } catch (error) {
      console.error('Error getting channel bookings:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Handle booking modification from channel
   */
  async handleChannelModification(req, res) {
    try {
      const {
        channelBookingId,
        channel,
        modificationType,
        newValues,
        reason
      } = req.body;

      // Find booking by channel booking ID
      const booking = await Booking.findOne({
        'channelBookingId': channelBookingId,
        'channel': channel
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found for this channel'
        });
      }

      // Check permissions
      if (req.user.role === 'staff' && booking.hotelId.toString() !== req.user.hotelId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const oldValues = booking.toObject();

      // Apply modifications based on type
      switch (modificationType) {
        case 'rate_change':
          if (newValues.totalAmount) {
            booking.totalAmount = newValues.totalAmount;
          }
          break;
        case 'date_change':
          if (newValues.checkIn) {
            booking.checkIn = new Date(newValues.checkIn);
          }
          if (newValues.checkOut) {
            booking.checkOut = new Date(newValues.checkOut);
          }
          break;
        case 'guest_change':
          if (newValues.guestDetails) {
            booking.guestDetails = { ...booking.guestDetails, ...newValues.guestDetails };
          }
          break;
        case 'cancellation':
          booking.status = 'cancelled';
          booking.cancellationReason = reason || 'Cancelled by channel';
          break;
      }

      // Add modification entry
      const modificationEntry = {
        modificationId: uuidv4(),
        modificationType,
        modificationDate: new Date(),
        modifiedBy: {
          source: channel,
          userId: req.user._id.toString(),
          channel
        },
        oldValues,
        newValues: booking.toObject(),
        reason: reason || `Modified by ${channel}`
      };

      booking.modifications.push(modificationEntry);
      booking.syncStatus.needsSync = false; // Mark as synced
      await booking.save();

      res.json({
        success: true,
        data: booking,
        message: 'Channel modification handled successfully'
      });

    } catch (error) {
      console.error('Error handling channel modification:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get booking dashboard with OTA metrics
   */
  async getBookingDashboard(req, res) {
    try {
      const { hotelId, period = '30d' } = req.query;

      if (!hotelId) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID is required'
        });
      }

      // Calculate date range based on period
      const endDate = new Date();
      let startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      // Get basic metrics
      const totalBookings = await Booking.countDocuments({
        hotelId,
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const totalRevenue = await Booking.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' }
          }
        }
      ]);

      const averageRate = totalBookings > 0 ? (totalRevenue[0]?.total || 0) / totalBookings : 0;

      // Get channel breakdown
      const channelBreakdown = await Booking.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: '$source',
            bookings: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        }
      ]);

      // Get room type breakdown
      const roomTypeBreakdown = await Booking.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: 'cancelled' }
          }
        },
        {
          $lookup: {
            from: 'rooms',
            localField: 'rooms.roomId',
            foreignField: '_id',
            as: 'roomDetails'
          }
        },
        {
          $lookup: {
            from: 'roomtypes',
            localField: 'roomDetails.roomTypeId',
            foreignField: '_id',
            as: 'roomTypeDetails'
          }
        },
        {
          $group: {
            _id: '$roomTypeDetails.name',
            bookings: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        }
      ]);

      // Get recent bookings
      const recentBookings = await Booking.find({
        hotelId,
        createdAt: { $gte: startDate, $lte: endDate }
      })
        .populate('userId', 'name email')
        .populate('rooms.roomId', 'roomNumber type')
        .sort({ createdAt: -1 })
        .limit(5);

      // Calculate pending modifications
      const pendingModifications = await Booking.countDocuments({
        hotelId,
        'modifications.modificationType': { $in: ['rate_change', 'date_change', 'guest_change'] },
        status: { $ne: 'cancelled' }
      });

      // Calculate sync issues
      const syncIssues = await Booking.countDocuments({
        hotelId,
        'syncStatus.needsSync': true
      });

      res.json({
        success: true,
        data: {
          totalBookings,
          totalRevenue: totalRevenue[0]?.total || 0,
          averageRate,
          occupancyRate: 0, // Placeholder
          channelBreakdown: channelBreakdown.reduce((acc, item) => {
            acc[item._id] = {
              bookings: item.bookings,
              revenue: item.revenue,
              percentage: totalBookings > 0 ? (item.bookings / totalBookings) * 100 : 0
            };
            return acc;
          }, {}),
          roomTypeBreakdown: roomTypeBreakdown.reduce((acc, item) => {
            acc[item._id] = {
              bookings: item.bookings,
              revenue: item.revenue,
              percentage: totalBookings > 0 ? (item.bookings / totalBookings) * 100 : 0
            };
            return acc;
          }, {}),
          recentBookings,
          pendingModifications,
          syncIssues
        }
      });

    } catch (error) {
      console.error('Error getting booking dashboard:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new EnhancedBookingController();
