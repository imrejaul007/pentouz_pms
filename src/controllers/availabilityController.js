import availabilityService from '../services/availabilityService.js';
import rateManagementService from '../services/rateManagementService.js';
import RoomType from '../models/RoomType.js';

class AvailabilityController {
  /**
   * Check room availability for given dates (V2 - OTA-ready)
   */
  async checkAvailability(req, res) {
    try {
      const {
        checkInDate,
        checkOutDate,
        roomType,     // Legacy: room type string
        roomTypeId,   // New: room type ObjectId
        guestCount = 1,
        hotelId
      } = req.query;

      if (!checkInDate || !checkOutDate) {
        return res.status(400).json({
          success: false,
          message: 'Check-in and check-out dates are required'
        });
      }

      let finalRoomTypeId = roomTypeId;

      // Handle legacy roomType parameter
      if (!finalRoomTypeId && roomType && hotelId) {
        const roomTypeObj = await RoomType.findByLegacyType(hotelId, roomType);
        finalRoomTypeId = roomTypeObj?._id;
      }

      // Use new V2 availability checking if we have roomTypeId
      if (finalRoomTypeId && hotelId) {
        const availability = await availabilityService.checkAvailabilityV2({
          hotelId,
          roomTypeId: finalRoomTypeId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          roomsRequested: parseInt(guestCount)
        });

        res.json({
          success: true,
          data: availability
        });
      } else {
        // Fall back to legacy method for backward compatibility
        const availability = await availabilityService.checkAvailability(
          checkInDate,
          checkOutDate,
          roomType,
          parseInt(guestCount),
          hotelId
        );

        // Get rates for available rooms
        if (availability.available) {
          const rates = await rateManagementService.getAllAvailableRates(
            roomType || 'single',
            checkInDate,
            checkOutDate
          );
          availability.rates = rates;
        }

        res.json({
          success: true,
          data: availability
        });
      }

    } catch (error) {
      console.error('Error checking availability:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get availability calendar for a month
   */
  async getAvailabilityCalendar(req, res) {
    try {
      const { year, month, roomType, hotelId } = req.query;

      if (!year || !month) {
        return res.status(400).json({
          success: false,
          message: 'Year and month are required'
        });
      }

      const calendar = await availabilityService.getAvailabilityCalendar(
        parseInt(year),
        parseInt(month),
        roomType,
        hotelId
      );

      res.json({
        success: true,
        data: calendar
      });

    } catch (error) {
      console.error('Error getting availability calendar:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get room availability status for specific date range
   */
  async getRoomStatus(req, res) {
    try {
      const { roomId, startDate, endDate } = req.query;

      if (!roomId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Room ID, start date, and end date are required'
        });
      }

      const status = await availabilityService.getRoomAvailabilityStatus(
        roomId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Error getting room status:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Block rooms for maintenance or other reasons
   */
  async blockRooms(req, res) {
    try {
      const { roomIds, startDate, endDate, reason } = req.body;

      if (!roomIds || !Array.isArray(roomIds) || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Room IDs array, start date, and end date are required'
        });
      }

      const blocks = await availabilityService.blockRooms(
        roomIds,
        startDate,
        endDate,
        reason,
        req.user.id
      );

      res.status(201).json({
        success: true,
        data: blocks,
        message: `Successfully blocked ${roomIds.length} room(s)`
      });

    } catch (error) {
      console.error('Error blocking rooms:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Unblock rooms
   */
  async unblockRooms(req, res) {
    try {
      const { roomIds, startDate, endDate } = req.body;

      if (!roomIds || !Array.isArray(roomIds) || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Room IDs array, start date, and end date are required'
        });
      }

      const result = await availabilityService.unblockRooms(
        roomIds,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: result,
        message: `Successfully unblocked ${result.deletedCount} room block(s)`
      });

    } catch (error) {
      console.error('Error unblocking rooms:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Calculate occupancy rate
   */
  async getOccupancyRate(req, res) {
    try {
      const { startDate, endDate, hotelId } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const occupancy = await availabilityService.calculateOccupancyRate(
        startDate,
        endDate,
        hotelId
      );

      res.json({
        success: true,
        data: occupancy
      });

    } catch (error) {
      console.error('Error calculating occupancy rate:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Find alternative rooms
   */
  async findAlternatives(req, res) {
    try {
      const { checkIn, checkOut, roomType, guestCount = 1 } = req.query;

      if (!checkIn || !checkOut || !roomType) {
        return res.status(400).json({
          success: false,
          message: 'Check-in date, check-out date, and room type are required'
        });
      }

      const alternatives = await availabilityService.findAlternativeRooms(
        checkIn,
        checkOut,
        roomType,
        parseInt(guestCount)
      );

      // Get rates for alternative rooms
      for (const alternative of alternatives) {
        const rates = await rateManagementService.getAllAvailableRates(
          alternative.roomType,
          checkIn,
          checkOut
        );
        alternative.rates = rates;
      }

      res.json({
        success: true,
        data: alternatives
      });

    } catch (error) {
      console.error('Error finding alternative rooms:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Check for overbooking
   */
  async checkOverbooking(req, res) {
    try {
      const { date, roomType } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Date is required'
        });
      }

      const overbookingInfo = await availabilityService.handleOverbooking(
        new Date(date),
        roomType
      );

      res.json({
        success: true,
        data: overbookingInfo
      });

    } catch (error) {
      console.error('Error checking overbooking:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get comprehensive availability and rate information
   */
  async getAvailabilityWithRates(req, res) {
    try {
      const {
        checkInDate,
        checkOutDate,
        guestCount = 1,
        hotelId
      } = req.query;

      if (!checkInDate || !checkOutDate) {
        return res.status(400).json({
          success: false,
          message: 'Check-in and check-out dates are required'
        });
      }

      const roomTypes = ['single', 'double', 'suite', 'deluxe'];
      const availabilityWithRates = [];

      for (const roomType of roomTypes) {
        const availability = await availabilityService.checkAvailability(
          checkInDate,
          checkOutDate,
          roomType,
          parseInt(guestCount),
          hotelId
        );

        if (availability.available) {
          const rates = await rateManagementService.getAllAvailableRates(
            roomType,
            checkInDate,
            checkOutDate,
            true
          );

          const bestRate = await rateManagementService.calculateBestRate(
            roomType,
            checkInDate,
            checkOutDate,
            parseInt(guestCount)
          );

          availabilityWithRates.push({
            roomType,
            available: true,
            availableRooms: availability.availableRooms,
            rooms: availability.rooms.slice(0, 3), // Show max 3 rooms per type
            bestRate,
            allRates: rates
          });
        }
      }

      res.json({
        success: true,
        data: {
          checkInDate,
          checkOutDate,
          guestCount: parseInt(guestCount),
          availableRoomTypes: availabilityWithRates
        }
      });

    } catch (error) {
      console.error('Error getting availability with rates:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Search rooms with filters
   */
  async searchRooms(req, res) {
    try {
      const {
        checkInDate,
        checkOutDate,
        guestCount = 1,
        minPrice,
        maxPrice,
        amenities,
        floor,
        roomType,
        hotelId
      } = req.query;

      if (!checkInDate || !checkOutDate) {
        return res.status(400).json({
          success: false,
          message: 'Check-in and check-out dates are required'
        });
      }

      // Get basic availability
      const availability = await availabilityService.checkAvailability(
        checkInDate,
        checkOutDate,
        roomType,
        parseInt(guestCount),
        hotelId
      );

      if (!availability.available) {
        return res.json({
          success: true,
          data: {
            rooms: [],
            message: 'No rooms available for selected dates'
          }
        });
      }

      // Apply filters
      let filteredRooms = availability.rooms;

      // Filter by floor
      if (floor) {
        filteredRooms = filteredRooms.filter(room => room.floor === parseInt(floor));
      }

      // Filter by amenities
      if (amenities) {
        const requestedAmenities = amenities.split(',');
        filteredRooms = filteredRooms.filter(room =>
          requestedAmenities.every(amenity =>
            room.amenities?.includes(amenity.trim())
          )
        );
      }

      // Get rates and apply price filter
      const roomsWithRates = [];
      for (const room of filteredRooms) {
        const bestRate = await rateManagementService.calculateBestRate(
          room.type,
          checkInDate,
          checkOutDate,
          parseInt(guestCount)
        );

        if (bestRate) {
          const roomWithRate = {
            ...room.toObject(),
            bestRate
          };

          // Apply price filter
          if (minPrice && bestRate.finalRate < parseFloat(minPrice)) continue;
          if (maxPrice && bestRate.finalRate > parseFloat(maxPrice)) continue;

          roomsWithRates.push(roomWithRate);
        }
      }

      // Sort by price
      roomsWithRates.sort((a, b) => a.bestRate.finalRate - b.bestRate.finalRate);

      res.json({
        success: true,
        data: {
          rooms: roomsWithRates,
          totalFound: roomsWithRates.length,
          checkInDate,
          checkOutDate,
          filters: {
            guestCount: parseInt(guestCount),
            minPrice,
            maxPrice,
            amenities,
            floor,
            roomType
          }
        }
      });

    } catch (error) {
      console.error('Error searching rooms:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new AvailabilityController();
