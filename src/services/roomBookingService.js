import Room from '../models/Room.js';
import ServiceBooking from '../models/ServiceBooking.js';
import MeetUpRequest from '../models/MeetUpRequest.js';
import Hotel from '../models/Hotel.js';
import { ApplicationError } from '../middleware/errorHandler.js';

/**
 * Room Booking Service for Meet-Up Management
 * Handles room availability checking and automatic booking for meet-ups
 */
class RoomBookingService {

  /**
   * Check room availability for a meet-up
   * @param {Object} params - Booking parameters
   * @param {string} params.hotelId - Hotel ID
   * @param {Date} params.date - Meet-up date
   * @param {Object} params.timeSlot - Time slot {start, end}
   * @param {number} params.capacity - Required capacity
   * @param {string} params.roomType - Preferred room type (optional)
   * @returns {Object} Availability result
   */
  async checkRoomAvailability(params) {
    const { hotelId, date, timeSlot, capacity, roomType } = params;

    try {
      // Validate date is in the future
      if (new Date(date) <= new Date()) {
        throw new ApplicationError('Meet-up date must be in the future', 400);
      }

      // Convert time strings to Date objects for comparison
      const startDateTime = this._createDateTime(date, timeSlot.start);
      const endDateTime = this._createDateTime(date, timeSlot.end);

      // Find suitable meeting rooms in the hotel
      let roomQuery = {
        hotelId,
        isActive: true,
        capacity: { $gte: capacity },
        $or: [
          { type: 'meeting_room' },
          { type: 'conference_room' },
          { roomNumber: { $regex: /^(MEET|CONF|BOARD)/i } }
        ]
      };

      // Filter by room type if specified
      if (roomType) {
        roomQuery.type = roomType;
      }

      const availableRooms = await Room.find(roomQuery);

      if (availableRooms.length === 0) {
        return {
          available: false,
          reason: 'No suitable meeting rooms found',
          alternatives: await this._suggestAlternatives(hotelId, capacity)
        };
      }

      // Check for booking conflicts
      const roomIds = availableRooms.map(room => room._id);
      const conflictingBookings = await this._findConflictingBookings(roomIds, startDateTime, endDateTime);
      const conflictingMeetUps = await this._findConflictingMeetUps(roomIds, startDateTime, endDateTime);

      // Filter out rooms with conflicts
      const occupiedRoomIds = new Set([
        ...conflictingBookings.flatMap(booking => booking.rooms.map(r => r.roomId.toString())),
        ...conflictingMeetUps.map(meetup => meetup.meetingRoomBooking?.roomId?.toString()).filter(Boolean)
      ]);

      const availableRoomsList = availableRooms.filter(room =>
        !occupiedRoomIds.has(room._id.toString())
      );

      if (availableRoomsList.length === 0) {
        return {
          available: false,
          reason: 'All suitable rooms are booked for the requested time slot',
          alternatives: await this._suggestAlternativeTimeSlots(hotelId, date, capacity, roomType),
          conflictingSlots: await this._getConflictingSlotsInfo(roomIds, startDateTime, endDateTime)
        };
      }

      // Sort rooms by preference (capacity, features, location)
      const sortedRooms = this._sortRoomsByPreference(availableRoomsList, capacity);

      return {
        available: true,
        recommendedRoom: sortedRooms[0],
        allAvailableRooms: sortedRooms,
        alternativeTimeSlots: await this._suggestAlternativeTimeSlots(hotelId, date, capacity, roomType, true)
      };

    } catch (error) {
      console.error('Room availability check error:', error);
      throw new ApplicationError(`Failed to check room availability: ${error.message}`, 500);
    }
  }

  /**
   * Automatically book a room for a meet-up
   * @param {Object} params - Booking parameters
   * @param {string} params.meetUpId - Meet-up request ID
   * @param {string} params.roomId - Selected room ID
   * @param {string} params.userId - User making the booking
   * @param {Array} params.equipment - Equipment requirements (optional)
   * @param {Array} params.services - Additional services (optional)
   * @returns {Object} Booking result
   */
  async createRoomBooking(params) {
    const { meetUpId, roomId, userId, equipment = [], services = [] } = params;

    try {
      // Get meet-up details
      const meetUp = await MeetUpRequest.findById(meetUpId);
      if (!meetUp) {
        throw new ApplicationError('Meet-up request not found', 404);
      }

      // Verify room exists and is available
      const room = await Room.findById(roomId);
      if (!room) {
        throw new ApplicationError('Room not found', 404);
      }

      if (room.hotelId.toString() !== meetUp.hotelId.toString()) {
        throw new ApplicationError('Room does not belong to the meet-up hotel', 400);
      }

      // Check availability one more time
      const startDateTime = this._createDateTime(meetUp.proposedDate, meetUp.proposedTime.start);
      const endDateTime = this._createDateTime(meetUp.proposedDate, meetUp.proposedTime.end);

      const availabilityCheck = await this.checkRoomAvailability({
        hotelId: meetUp.hotelId,
        date: meetUp.proposedDate,
        timeSlot: meetUp.proposedTime,
        capacity: meetUp.participants.maxParticipants
      });

      if (!availabilityCheck.available) {
        throw new ApplicationError('Room is no longer available for the requested time slot', 409);
      }

      const isSelectedRoomAvailable = availabilityCheck.allAvailableRooms.some(
        r => r._id.toString() === roomId
      );

      if (!isSelectedRoomAvailable) {
        throw new ApplicationError('Selected room is not available for the requested time slot', 409);
      }

      // Calculate total cost
      const bookingCost = await this._calculateBookingCost(room, equipment, services, startDateTime, endDateTime);

      // Create service booking for the room
      const serviceBooking = new ServiceBooking({
        userId,
        serviceId: null, // We'll use custom booking logic for rooms
        hotelId: meetUp.hotelId,
        bookingDate: startDateTime,
        numberOfPeople: meetUp.participants.maxParticipants,
        totalAmount: bookingCost.total,
        status: 'confirmed',
        specialRequests: `Meet-up room booking: ${meetUp.title}`,
        paymentStatus: 'pending',
        notes: `Automated room booking for meet-up: ${meetUp.title}. Equipment: ${equipment.join(', ')}. Services: ${services.join(', ')}`
      });

      await serviceBooking.save();

      // Update meet-up with room booking details
      meetUp.meetingRoomBooking = {
        roomId: roomId,
        bookingId: serviceBooking._id,
        isRequired: true,
        equipment: equipment,
        services: services,
        cost: bookingCost,
        confirmedAt: new Date()
      };

      await meetUp.save();

      return {
        success: true,
        booking: serviceBooking,
        room: room,
        meetUp: meetUp,
        cost: bookingCost,
        bookingReference: serviceBooking._id
      };

    } catch (error) {
      console.error('Room booking creation error:', error);
      throw new ApplicationError(`Failed to create room booking: ${error.message}`, 500);
    }
  }

  /**
   * Get available equipment for a hotel
   * @param {string} hotelId - Hotel ID
   * @returns {Array} Available equipment list
   */
  async getAvailableEquipment(hotelId) {
    try {
      const hotel = await Hotel.findById(hotelId);
      if (!hotel) {
        throw new ApplicationError('Hotel not found', 404);
      }

      // Default equipment list for meeting rooms
      const defaultEquipment = [
        {
          id: 'projector',
          name: 'Projector',
          description: 'HD projector with HDMI/VGA connectivity',
          costPerHour: 500, // INR
          available: true
        },
        {
          id: 'whiteboard',
          name: 'Whiteboard',
          description: 'Large whiteboard with markers',
          costPerHour: 100,
          available: true
        },
        {
          id: 'flipchart',
          name: 'Flip Chart',
          description: 'Flip chart stand with paper',
          costPerHour: 50,
          available: true
        },
        {
          id: 'sound_system',
          name: 'Sound System',
          description: 'Microphone and speakers',
          costPerHour: 300,
          available: true
        },
        {
          id: 'video_conference',
          name: 'Video Conference Setup',
          description: 'Camera and screen for video calls',
          costPerHour: 800,
          available: true
        },
        {
          id: 'laptop',
          name: 'Laptop',
          description: 'Business laptop for presentations',
          costPerHour: 200,
          available: true
        }
      ];

      return defaultEquipment;
    } catch (error) {
      console.error('Get equipment error:', error);
      throw new ApplicationError(`Failed to get available equipment: ${error.message}`, 500);
    }
  }

  /**
   * Get available services for meet-ups
   * @param {string} hotelId - Hotel ID
   * @returns {Array} Available services list
   */
  async getAvailableServices(hotelId) {
    try {
      const hotel = await Hotel.findById(hotelId);
      if (!hotel) {
        throw new ApplicationError('Hotel not found', 404);
      }

      // Default services for meet-ups
      const defaultServices = [
        {
          id: 'basic_refreshments',
          name: 'Basic Refreshments',
          description: 'Tea, coffee, and light snacks',
          costPerPerson: 150, // INR
          available: true,
          minPeople: 2
        },
        {
          id: 'business_lunch',
          name: 'Business Lunch',
          description: 'Professional lunch setup',
          costPerPerson: 800,
          available: true,
          minPeople: 4
        },
        {
          id: 'welcome_drinks',
          name: 'Welcome Drinks',
          description: 'Non-alcoholic welcome beverages',
          costPerPerson: 200,
          available: true,
          minPeople: 2
        },
        {
          id: 'stationery_kit',
          name: 'Stationery Kit',
          description: 'Notebooks, pens, and business cards',
          costPerPerson: 100,
          available: true,
          minPeople: 1
        },
        {
          id: 'photographer',
          name: 'Professional Photography',
          description: 'Event photographer for documentation',
          costPerHour: 2000,
          available: true,
          minDuration: 1
        },
        {
          id: 'concierge_support',
          name: 'Concierge Support',
          description: 'Dedicated concierge for the event',
          costPerHour: 500,
          available: true,
          minDuration: 2
        }
      ];

      return defaultServices;
    } catch (error) {
      console.error('Get services error:', error);
      throw new ApplicationError(`Failed to get available services: ${error.message}`, 500);
    }
  }

  /**
   * Cancel room booking for a meet-up
   * @param {string} meetUpId - Meet-up request ID
   * @param {string} reason - Cancellation reason
   * @returns {Object} Cancellation result
   */
  async cancelRoomBooking(meetUpId, reason = 'Meet-up cancelled') {
    try {
      const meetUp = await MeetUpRequest.findById(meetUpId);
      if (!meetUp) {
        throw new ApplicationError('Meet-up request not found', 404);
      }

      if (!meetUp.meetingRoomBooking?.bookingId) {
        return { success: true, message: 'No room booking to cancel' };
      }

      // Cancel the service booking
      const serviceBooking = await ServiceBooking.findById(meetUp.meetingRoomBooking.bookingId);
      if (serviceBooking) {
        await serviceBooking.cancelBooking(reason, meetUp.requesterId);
      }

      // Clear room booking from meet-up
      meetUp.meetingRoomBooking = {
        isRequired: false
      };
      await meetUp.save();

      return {
        success: true,
        message: 'Room booking cancelled successfully',
        refundEligible: this._isRefundEligible(serviceBooking?.bookingDate)
      };

    } catch (error) {
      console.error('Room booking cancellation error:', error);
      throw new ApplicationError(`Failed to cancel room booking: ${error.message}`, 500);
    }
  }

  // Private helper methods

  /**
   * Create DateTime object from date and time string
   * @private
   */
  _createDateTime(date, timeString) {
    const baseDate = new Date(date);
    const [hours, minutes] = timeString.split(':').map(Number);
    baseDate.setHours(hours, minutes, 0, 0);
    return baseDate;
  }

  /**
   * Find conflicting hotel bookings
   * @private
   */
  async _findConflictingBookings(roomIds, startTime, endTime) {
    return await ServiceBooking.find({
      'rooms.roomId': { $in: roomIds },
      status: { $in: ['confirmed', 'checked_in'] },
      $or: [
        {
          bookingDate: { $lt: endTime },
          // Assume booking duration is same as room booking
          $expr: {
            $gt: [
              { $add: ['$bookingDate', { $multiply: [2, 60, 60, 1000] }] }, // 2 hours default
              startTime
            ]
          }
        }
      ]
    });
  }

  /**
   * Find conflicting meet-up bookings
   * @private
   */
  async _findConflictingMeetUps(roomIds, startTime, endTime) {
    return await MeetUpRequest.find({
      'meetingRoomBooking.roomId': { $in: roomIds },
      status: { $in: ['accepted', 'confirmed'] },
      proposedDate: {
        $gte: new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate()),
        $lt: new Date(endTime.getFullYear(), endTime.getMonth(), endTime.getDate() + 1)
      }
    });
  }

  /**
   * Sort rooms by preference
   * @private
   */
  _sortRoomsByPreference(rooms, requiredCapacity) {
    return rooms.sort((a, b) => {
      // Prefer rooms with capacity closest to requirement
      const aCapacityScore = Math.abs(a.capacity - requiredCapacity);
      const bCapacityScore = Math.abs(b.capacity - requiredCapacity);

      if (aCapacityScore !== bCapacityScore) {
        return aCapacityScore - bCapacityScore;
      }

      // Then by room amenities (more amenities = better)
      const aAmenityScore = a.amenities?.length || 0;
      const bAmenityScore = b.amenities?.length || 0;

      return bAmenityScore - aAmenityScore;
    });
  }

  /**
   * Calculate booking cost
   * @private
   */
  async _calculateBookingCost(room, equipment, services, startTime, endTime) {
    const durationHours = (endTime - startTime) / (1000 * 60 * 60);

    // Base room cost (example: 1000 INR per hour)
    const baseRoomCost = 1000 * durationHours;

    // Equipment costs
    const equipmentList = await this.getAvailableEquipment(room.hotelId);
    const equipmentCost = equipment.reduce((total, equipId) => {
      const equip = equipmentList.find(e => e.id === equipId);
      return total + (equip?.costPerHour || 0) * durationHours;
    }, 0);

    // Service costs
    const servicesList = await this.getAvailableServices(room.hotelId);
    const serviceCost = services.reduce((total, serviceId) => {
      const service = servicesList.find(s => s.id === serviceId);
      if (service?.costPerHour) {
        return total + service.costPerHour * durationHours;
      } else if (service?.costPerPerson) {
        return total + service.costPerPerson * 2; // Default 2 people for estimation
      }
      return total;
    }, 0);

    const subtotal = baseRoomCost + equipmentCost + serviceCost;
    const tax = subtotal * 0.18; // 18% GST
    const total = subtotal + tax;

    return {
      baseRoom: baseRoomCost,
      equipment: equipmentCost,
      services: serviceCost,
      subtotal,
      tax,
      total,
      currency: 'INR',
      breakdown: {
        room: { cost: baseRoomCost, duration: durationHours },
        equipment: equipment.map(eq => {
          const equip = equipmentList.find(e => e.id === eq);
          return { id: eq, name: equip?.name, cost: (equip?.costPerHour || 0) * durationHours };
        }),
        services: services.map(sv => {
          const service = servicesList.find(s => s.id === sv);
          return { id: sv, name: service?.name, cost: service?.costPerHour ? service.costPerHour * durationHours : service?.costPerPerson * 2 };
        })
      }
    };
  }

  /**
   * Suggest alternative rooms
   * @private
   */
  async _suggestAlternatives(hotelId, capacity) {
    const alternatives = await Room.find({
      hotelId,
      isActive: true,
      capacity: { $gte: Math.max(2, capacity - 2) } // Slightly smaller capacity
    }).limit(3);

    return alternatives.map(room => ({
      roomId: room._id,
      roomNumber: room.roomNumber,
      capacity: room.capacity,
      type: room.type,
      amenities: room.amenities
    }));
  }

  /**
   * Suggest alternative time slots
   * @private
   */
  async _suggestAlternativeTimeSlots(hotelId, date, capacity, roomType, isAvailable = false) {
    const timeSlots = [
      '09:00-11:00', '11:00-13:00', '13:00-15:00',
      '15:00-17:00', '17:00-19:00', '19:00-21:00'
    ];

    const suggestions = [];

    for (const slot of timeSlots) {
      const [start, end] = slot.split('-');
      const availability = await this.checkRoomAvailability({
        hotelId,
        date,
        timeSlot: { start, end },
        capacity,
        roomType
      });

      if (availability.available) {
        suggestions.push({
          timeSlot: { start, end },
          displayTime: slot,
          availableRooms: availability.allAvailableRooms?.length || 0
        });
      }
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Get conflicting slots information
   * @private
   */
  async _getConflictingSlotsInfo(roomIds, startTime, endTime) {
    const conflicts = await this._findConflictingMeetUps(roomIds, startTime, endTime);

    return conflicts.map(meetup => ({
      meetUpTitle: meetup.title,
      timeSlot: `${meetup.proposedTime.start}-${meetup.proposedTime.end}`,
      roomNumber: meetup.meetingRoomBooking?.roomId ? 'Room booked' : 'Pending room assignment'
    }));
  }

  /**
   * Check if booking is eligible for refund
   * @private
   */
  _isRefundEligible(bookingDate) {
    if (!bookingDate) return false;
    const now = new Date();
    const booking = new Date(bookingDate);
    const hoursDifference = (booking - now) / (1000 * 60 * 60);
    return hoursDifference > 24; // 24 hour cancellation policy
  }
}

export default new RoomBookingService();