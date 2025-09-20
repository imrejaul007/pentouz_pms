import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import TapeChart from '../models/TapeChart.js';
import RoomAvailability from '../models/RoomAvailability.js';
import RoomType from '../models/RoomType.js';
import AuditLog from '../models/AuditLog.js';
import mongoose from 'mongoose';

class AvailabilityService {
  /**
   * NEW: Check availability using the new RoomAvailability system (preferred method)
   * @param {Object} params - { hotelId, roomTypeId, checkIn, checkOut, roomsRequested }
   * @returns {Object} - availability details
   */
  async checkAvailabilityV2({ hotelId, roomTypeId, checkIn, checkOut, roomsRequested = 1 }) {
    try {
      // Convert dates
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      
      // Get availability records for the date range
      const availabilityRecords = await RoomAvailability.find({
        hotelId,
        roomTypeId,
        date: { $gte: checkInDate, $lt: checkOutDate }
      }).populate('roomTypeId', 'name code basePrice').sort({ date: 1 });
      
      if (availabilityRecords.length === 0) {
        return {
          available: false,
          reason: 'No availability data found for requested dates',
          details: null
        };
      }
      
      // Check each day for minimum availability
      const dailyAvailability = availabilityRecords.map(record => ({
        date: record.date,
        totalRooms: record.totalRooms,
        availableRooms: record.availableRooms,
        soldRooms: record.soldRooms,
        rate: record.sellingRate || record.baseRate,
        sufficient: record.availableRooms >= roomsRequested
      }));
      
      const allDaysAvailable = dailyAvailability.every(day => day.sufficient);
      const minAvailable = Math.min(...dailyAvailability.map(day => day.availableRooms));
      const totalRate = dailyAvailability.reduce((sum, day) => sum + day.rate, 0);
      const avgRate = totalRate / dailyAvailability.length;
      
      return {
        available: allDaysAvailable && minAvailable >= roomsRequested,
        roomsAvailable: minAvailable,
        roomsRequested,
        nights: dailyAvailability.length,
        averageRate: avgRate,
        totalAmount: avgRate * dailyAvailability.length * roomsRequested,
        roomType: availabilityRecords[0].roomTypeId,
        dailyBreakdown: dailyAvailability,
        reason: allDaysAvailable ? null : `Only ${minAvailable} rooms available, ${roomsRequested} requested`
      };
      
    } catch (error) {
      console.error('Availability check failed:', error);
      return {
        available: false,
        reason: 'System error during availability check',
        error: error.message
      };
    }
  }

  /**
   * LEGACY: Check room availability for given dates and room type (backward compatibility)
   * @param {Date} checkInDate 
   * @param {Date} checkOutDate 
   * @param {String} roomType - optional
   * @param {Number} guestCount 
   * @param {String} hotelId 
   */
  async checkAvailability(checkInDate, checkOutDate, roomType = null, guestCount = 1, hotelId = null) {
    try {
      // Validate dates
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      
      if (checkIn >= checkOut) {
        throw new Error('Check-out date must be after check-in date');
      }

      if (checkIn < new Date().setHours(0, 0, 0, 0)) {
        throw new Error('Check-in date cannot be in the past');
      }

      // Get all rooms based on criteria
      const roomQuery = {
        isActive: true,
        status: { $ne: 'out_of_order' },
        capacity: { $gte: guestCount }
      };

      if (hotelId) {
        roomQuery.hotelId = hotelId;
      }

      if (roomType) {
        roomQuery.type = roomType;
      }

      const allRooms = await Room.find(roomQuery);

      // Get all bookings that overlap with the requested dates
      const overlappingBookings = await Booking.find({
        status: { $in: ['confirmed', 'checked_in'] },
        $or: [
          {
            checkIn: { $lt: checkOut },
            checkOut: { $gt: checkIn }
          }
        ]
      }).select('rooms checkIn checkOut');

      // Get blocked rooms from tape chart
      const blockedRooms = await TapeChart.find({
        date: {
          $gte: checkIn,
          $lt: checkOut
        },
        status: { $in: ['blocked', 'maintenance'] }
      }).select('roomId date');

      // Calculate available rooms
      const availableRooms = [];
      
      for (const room of allRooms) {
        const isAvailable = this.isRoomAvailable(
          room._id,
          checkIn,
          checkOut,
          overlappingBookings,
          blockedRooms
        );

        if (isAvailable) {
          availableRooms.push(room);
        }
      }

      return {
        available: availableRooms.length > 0,
        totalRooms: allRooms.length,
        availableRooms: availableRooms.length,
        rooms: availableRooms,
        checkIn,
        checkOut
      };

    } catch (error) {
      console.error('Error checking availability:', error);
      throw error;
    }
  }

  /**
   * Check if a specific room is available for given dates
   */
  isRoomAvailable(roomId, checkIn, checkOut, overlappingBookings, blockedRooms) {
    // Check if room is in any overlapping booking
    const isBooked = overlappingBookings.some(booking => 
      booking.rooms.some(room => 
        room.roomId.toString() === roomId.toString()
      )
    );

    if (isBooked) return false;

    // Check if room is blocked on any date in the range
    const isBlocked = blockedRooms.some(block => 
      block.roomId.toString() === roomId.toString() &&
      block.date >= checkIn && block.date < checkOut
    );

    return !isBlocked;
  }

  /**
   * Get availability calendar for a month
   */
  async getAvailabilityCalendar(year, month, roomType = null, hotelId = null) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      const dailyAvailability = [];
      
      for (let day = 1; day <= endDate.getDate(); day++) {
        const currentDate = new Date(year, month - 1, day);
        const nextDate = new Date(year, month - 1, day + 1);
        
        const availability = await this.checkAvailability(
          currentDate,
          nextDate,
          roomType,
          1,
          hotelId
        );
        
        dailyAvailability.push({
          date: currentDate,
          available: availability.available,
          roomsAvailable: availability.availableRooms,
          totalRooms: availability.totalRooms
        });
      }
      
      return {
        year,
        month,
        availability: dailyAvailability
      };
    } catch (error) {
      console.error('Error getting availability calendar:', error);
      throw error;
    }
  }

  /**
   * Block rooms for maintenance or other reasons
   */
  async blockRooms(roomIds, startDate, endDate, reason = 'maintenance', userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const blocks = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let date = new Date(start); date < end; date.setDate(date.getDate() + 1)) {
        for (const roomId of roomIds) {
          const block = await TapeChart.findOneAndUpdate(
            {
              roomId,
              date: new Date(date)
            },
            {
              roomId,
              date: new Date(date),
              status: 'blocked',
              blockReason: reason,
              blockedBy: userId,
              blockedAt: new Date()
            },
            {
              upsert: true,
              new: true,
              session
            }
          );
          blocks.push(block);
        }
      }

      await session.commitTransaction();
      return blocks;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Unblock rooms
   */
  async unblockRooms(roomIds, startDate, endDate) {
    try {
      const result = await TapeChart.deleteMany({
        roomId: { $in: roomIds },
        date: {
          $gte: new Date(startDate),
          $lt: new Date(endDate)
        },
        status: 'blocked'
      });

      return result;
    } catch (error) {
      console.error('Error unblocking rooms:', error);
      throw error;
    }
  }

  /**
   * Get room availability status for a specific date range
   */
  async getRoomAvailabilityStatus(roomId, startDate, endDate) {
    try {
      const bookings = await Booking.find({
        'rooms.roomId': roomId,
        status: { $in: ['confirmed', 'checked_in'] },
        $or: [
          {
            checkIn: { $lt: endDate },
            checkOut: { $gt: startDate }
          }
        ]
      }).select('checkIn checkOut status guestDetails');

      const blocks = await TapeChart.find({
        roomId,
        date: {
          $gte: startDate,
          $lt: endDate
        },
        status: 'blocked'
      }).select('date blockReason');

      return {
        roomId,
        bookings,
        blocks,
        startDate,
        endDate
      };
    } catch (error) {
      console.error('Error getting room availability status:', error);
      throw error;
    }
  }

  /**
   * Calculate occupancy rate for a date range
   */
  async calculateOccupancyRate(startDate, endDate, hotelId = null) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

      const roomQuery = { isActive: true };
      if (hotelId) {
        roomQuery.hotelId = hotelId;
      }

      const totalRooms = await Room.countDocuments(roomQuery);
      const totalRoomNights = totalRooms * days;

      const bookings = await Booking.find({
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] },
        checkIn: { $lt: end },
        checkOut: { $gt: start }
      });

      let occupiedRoomNights = 0;

      bookings.forEach(booking => {
        const bookingStart = booking.checkIn > start ? booking.checkIn : start;
        const bookingEnd = booking.checkOut < end ? booking.checkOut : end;
        const bookingDays = Math.ceil((bookingEnd - bookingStart) / (1000 * 60 * 60 * 24));
        occupiedRoomNights += booking.rooms.length * bookingDays;
      });

      const occupancyRate = totalRoomNights > 0 
        ? (occupiedRoomNights / totalRoomNights) * 100 
        : 0;

      return {
        startDate: start,
        endDate: end,
        totalRooms,
        totalRoomNights,
        occupiedRoomNights,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        averageDailyOccupancy: Math.round((occupiedRoomNights / days) * 100) / 100
      };
    } catch (error) {
      console.error('Error calculating occupancy rate:', error);
      throw error;
    }
  }

  /**
   * Find alternative available rooms when requested room is not available
   */
  async findAlternativeRooms(checkIn, checkOut, originalRoomType, guestCount = 1) {
    try {
      // Define room type upgrade path
      const upgradeMap = {
        'single': ['double', 'suite', 'deluxe'],
        'double': ['suite', 'deluxe'],
        'suite': ['deluxe'],
        'deluxe': []
      };

      const alternatives = [];
      const upgradePath = upgradeMap[originalRoomType] || [];

      for (const roomType of upgradePath) {
        const availability = await this.checkAvailability(
          checkIn,
          checkOut,
          roomType,
          guestCount
        );

        if (availability.available) {
          alternatives.push({
            roomType,
            availableRooms: availability.availableRooms,
            rooms: availability.rooms.slice(0, 3) // Return max 3 alternatives per type
          });
        }
      }

      return alternatives;
    } catch (error) {
      console.error('Error finding alternative rooms:', error);
      throw error;
    }
  }

  /**
   * Check and handle overbooking scenarios
   */
  async handleOverbooking(date, roomType = null) {
    try {
      const availability = await this.checkAvailability(
        date,
        new Date(date.getTime() + 24 * 60 * 60 * 1000),
        roomType
      );

      if (availability.availableRooms < 0) {
        // Overbooking detected
        return {
          isOverbooked: true,
          overbookingCount: Math.abs(availability.availableRooms),
          date,
          roomType,
          suggestions: await this.findAlternativeRooms(
            date,
            new Date(date.getTime() + 24 * 60 * 60 * 1000),
            roomType
          )
        };
      }

      return {
        isOverbooked: false,
        availableRooms: availability.availableRooms
      };
    } catch (error) {
      console.error('Error handling overbooking:', error);
      throw error;
    }
  }

  /**
   * NEW: Reserve rooms and update availability
   * @param {Object} params - { hotelId, roomTypeId, checkIn, checkOut, roomsCount, bookingId, source, userId }
   * @returns {Object} - reservation result
   */
  async reserveRooms({ hotelId, roomTypeId, checkIn, checkOut, roomsCount, bookingId, source = 'direct', userId }) {
    try {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      
      // Get all availability records for the date range
      const availabilityRecords = await RoomAvailability.find({
        hotelId,
        roomTypeId,
        date: { $gte: checkInDate, $lt: checkOutDate }
      }).sort({ date: 1 });
      
      // Check if reservation is possible
      const canReserve = availabilityRecords.every(record => 
        record.availableRooms >= roomsCount
      );
      
      if (!canReserve) {
        throw new Error('Insufficient availability for requested dates');
      }
      
      // Update each day's availability
      const updatedRecords = [];
      for (const record of availabilityRecords) {
        // Book the rooms
        await record.bookRooms(roomsCount, bookingId, source);
        updatedRecords.push(record);
        
        // Log the inventory change
        await AuditLog.logInventoryChange(record, 'booking', userId, {
          source: 'booking_service',
          bookingDetails: {
            bookingId,
            roomsBooked: roomsCount,
            source
          }
        });
      }
      
      return {
        success: true,
        message: 'Rooms reserved successfully',
        reservedRooms: roomsCount,
        nights: availabilityRecords.length,
        updatedRecords: updatedRecords.length
      };
      
    } catch (error) {
      console.error('Room reservation failed:', error);
      return {
        success: false,
        message: 'Failed to reserve rooms',
        error: error.message
      };
    }
  }

  /**
   * NEW: Release rooms and update availability (for cancellations)
   * @param {Object} params - { hotelId, roomTypeId, checkIn, checkOut, roomsCount, bookingId, userId }
   * @returns {Object} - release result
   */
  async releaseRooms({ hotelId, roomTypeId, checkIn, checkOut, roomsCount, bookingId, userId }) {
    try {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      
      const availabilityRecords = await RoomAvailability.find({
        hotelId,
        roomTypeId,
        date: { $gte: checkInDate, $lt: checkOutDate },
        'reservations.bookingId': bookingId
      }).sort({ date: 1 });
      
      // Release rooms from each day
      const releasedRecords = [];
      for (const record of availabilityRecords) {
        await record.releaseRooms(roomsCount, bookingId);
        releasedRecords.push(record);
        
        // Log the inventory change
        await AuditLog.logInventoryChange(record, 'cancellation', userId, {
          source: 'booking_service',
          bookingDetails: {
            bookingId,
            roomsReleased: roomsCount
          }
        });
      }
      
      return {
        success: true,
        message: 'Rooms released successfully',
        releasedRooms: roomsCount,
        nights: availabilityRecords.length,
        updatedRecords: releasedRecords.length
      };
      
    } catch (error) {
      console.error('Room release failed:', error);
      return {
        success: false,
        message: 'Failed to release rooms',
        error: error.message
      };
    }
  }

  /**
   * NEW: Get room type options for a hotel
   * @param {string} hotelId - Hotel ID
   * @returns {Array} - room type options
   */
  async getRoomTypeOptions(hotelId) {
    try {
      const roomTypes = await RoomType.find({ hotelId, isActive: true })
        .select('_id name code basePrice maxOccupancy legacyType')
        .sort({ name: 1 });
      
      return roomTypes.map(rt => ({
        id: rt._id,
        roomTypeId: rt.roomTypeId,
        name: rt.name,
        code: rt.code,
        basePrice: rt.basePrice,
        maxOccupancy: rt.maxOccupancy,
        legacyType: rt.legacyType
      }));
      
    } catch (error) {
      console.error('Failed to get room type options:', error);
      return [];
    }
  }

  /**
   * NEW: Get availability summary for a hotel
   * @param {string} hotelId - Hotel ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} - availability summary
   */
  async getAvailabilitySummary(hotelId, startDate = new Date(), endDate = null) {
    try {
      if (!endDate) {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30); // Default 30 days
      }
      
      const summary = await RoomAvailability.aggregate([
        {
          $match: {
            hotelId: hotelId,
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $lookup: {
            from: 'roomtypes',
            localField: 'roomTypeId',
            foreignField: '_id',
            as: 'roomType'
          }
        },
        {
          $unwind: '$roomType'
        },
        {
          $group: {
            _id: '$roomTypeId',
            roomTypeName: { $first: '$roomType.name' },
            roomTypeCode: { $first: '$roomType.code' },
            totalDays: { $sum: 1 },
            totalRoomsAvailable: { $sum: '$availableRooms' },
            totalRoomsSold: { $sum: '$soldRooms' },
            totalRoomsBlocked: { $sum: '$blockedRooms' },
            averageRate: { $avg: '$baseRate' },
            occupancyRate: {
              $avg: {
                $divide: ['$soldRooms', '$totalRooms']
              }
            }
          }
        }
      ]);
      
      return {
        success: true,
        dateRange: { startDate, endDate },
        roomTypes: summary
      };
      
    } catch (error) {
      console.error('Failed to get availability summary:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new AvailabilityService();