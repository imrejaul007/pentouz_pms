import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import roomBookingService from '../services/roomBookingService.js';
import MeetUpRequest from '../models/MeetUpRequest.js';
import Room from '../models/Room.js';
import ServiceBooking from '../models/ServiceBooking.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     RoomAvailabilityRequest:
 *       type: object
 *       required:
 *         - hotelId
 *         - date
 *         - timeSlot
 *         - capacity
 *       properties:
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         date:
 *           type: string
 *           format: date
 *           description: Meet-up date
 *         timeSlot:
 *           type: object
 *           properties:
 *             start:
 *               type: string
 *               pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
 *               description: Start time in HH:MM format
 *             end:
 *               type: string
 *               pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
 *               description: End time in HH:MM format
 *         capacity:
 *           type: number
 *           minimum: 2
 *           description: Required room capacity
 *         roomType:
 *           type: string
 *           description: Preferred room type (optional)
 *
 *     RoomBookingRequest:
 *       type: object
 *       required:
 *         - meetUpId
 *         - roomId
 *       properties:
 *         meetUpId:
 *           type: string
 *           description: Meet-up request ID
 *         roomId:
 *           type: string
 *           description: Selected room ID
 *         equipment:
 *           type: array
 *           items:
 *             type: string
 *           description: Required equipment IDs
 *         services:
 *           type: array
 *           items:
 *             type: string
 *           description: Additional service IDs
 */

/**
 * @swagger
 * /api/v1/meetup-resources/room-availability:
 *   post:
 *     summary: Check room availability for meet-up
 *     tags: [Meet-Up Resources]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoomAvailabilityRequest'
 *     responses:
 *       200:
 *         description: Room availability information
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const checkRoomAvailability = catchAsync(async (req, res) => {
  const { hotelId, date, timeSlot, capacity, roomType } = req.body;

  // Validate required fields
  if (!hotelId || !date || !timeSlot || !capacity) {
    throw new ApplicationError('Missing required fields: hotelId, date, timeSlot, capacity', 400);
  }

  // Validate time slot format
  if (!timeSlot.start || !timeSlot.end) {
    throw new ApplicationError('Time slot must include start and end times', 400);
  }

  const availability = await roomBookingService.checkRoomAvailability({
    hotelId,
    date: new Date(date),
    timeSlot,
    capacity: parseInt(capacity),
    roomType
  });

  res.json({
    success: true,
    data: availability
  });
});

/**
 * @swagger
 * /api/v1/meetup-resources/rooms/{hotelId}:
 *   get:
 *     summary: Get available meeting rooms for a hotel
 *     tags: [Meet-Up Resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Hotel ID
 *       - in: query
 *         name: capacity
 *         schema:
 *           type: number
 *         description: Minimum required capacity
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Room type filter
 *     responses:
 *       200:
 *         description: List of available meeting rooms
 *       404:
 *         description: Hotel not found
 *       500:
 *         description: Server error
 */
export const getAvailableRooms = catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  const { capacity, type } = req.query;

  let query = {
    hotelId,
    isActive: true,
    $or: [
      { type: 'meeting_room' },
      { type: 'conference_room' },
      { roomNumber: { $regex: /^(MEET|CONF|BOARD)/i } }
    ]
  };

  if (capacity) {
    query.capacity = { $gte: parseInt(capacity) };
  }

  if (type) {
    query.type = type;
  }

  const rooms = await Room.find(query)
    .select('roomNumber type capacity amenities description baseRate')
    .sort({ capacity: 1, roomNumber: 1 });

  res.json({
    success: true,
    data: {
      rooms,
      totalRooms: rooms.length
    }
  });
});

/**
 * @swagger
 * /api/v1/meetup-resources/equipment/{hotelId}:
 *   get:
 *     summary: Get available equipment for meet-ups
 *     tags: [Meet-Up Resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Hotel ID
 *     responses:
 *       200:
 *         description: List of available equipment
 *       404:
 *         description: Hotel not found
 *       500:
 *         description: Server error
 */
export const getAvailableEquipment = catchAsync(async (req, res) => {
  const { hotelId } = req.params;

  const equipment = await roomBookingService.getAvailableEquipment(hotelId);

  res.json({
    success: true,
    data: {
      equipment,
      totalItems: equipment.length
    }
  });
});

/**
 * @swagger
 * /api/v1/meetup-resources/services/{hotelId}:
 *   get:
 *     summary: Get available services for meet-ups
 *     tags: [Meet-Up Resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Hotel ID
 *     responses:
 *       200:
 *         description: List of available services
 *       404:
 *         description: Hotel not found
 *       500:
 *         description: Server error
 */
export const getAvailableServices = catchAsync(async (req, res) => {
  const { hotelId } = req.params;

  const services = await roomBookingService.getAvailableServices(hotelId);

  res.json({
    success: true,
    data: {
      services,
      totalServices: services.length
    }
  });
});

/**
 * @swagger
 * /api/v1/meetup-resources/book-room:
 *   post:
 *     summary: Book a room for meet-up
 *     tags: [Meet-Up Resources]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoomBookingRequest'
 *     responses:
 *       201:
 *         description: Room booked successfully
 *       400:
 *         description: Invalid request or room not available
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Meet-up or room not found
 *       409:
 *         description: Room booking conflict
 *       500:
 *         description: Server error
 */
export const bookRoom = catchAsync(async (req, res) => {
  const { meetUpId, roomId, equipment = [], services = [] } = req.body;

  // Validate required fields
  if (!meetUpId || !roomId) {
    throw new ApplicationError('Meet-up ID and room ID are required', 400);
  }

  // Check if user owns the meet-up or is the target user
  const meetUp = await MeetUpRequest.findById(meetUpId);
  if (!meetUp) {
    throw new ApplicationError('Meet-up request not found', 404);
  }

  const userId = req.user._id;
  if (meetUp.requesterId.toString() !== userId.toString() &&
      meetUp.targetUserId.toString() !== userId.toString()) {
    throw new ApplicationError('You can only book rooms for your own meet-ups', 403);
  }

  // Check if meet-up is in accepted status
  if (meetUp.status !== 'accepted') {
    throw new ApplicationError('Can only book rooms for accepted meet-ups', 400);
  }

  const booking = await roomBookingService.createRoomBooking({
    meetUpId,
    roomId,
    userId,
    equipment,
    services
  });

  res.status(201).json({
    success: true,
    message: 'Room booked successfully',
    data: booking
  });
});

/**
 * @swagger
 * /api/v1/meetup-resources/booking-cost:
 *   post:
 *     summary: Calculate booking cost estimate
 *     tags: [Meet-Up Resources]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotelId
 *               - duration
 *             properties:
 *               hotelId:
 *                 type: string
 *               duration:
 *                 type: number
 *                 description: Duration in hours
 *               equipment:
 *                 type: array
 *                 items:
 *                   type: string
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *               participants:
 *                 type: number
 *                 description: Number of participants
 *     responses:
 *       200:
 *         description: Cost estimate
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Server error
 */
export const calculateBookingCost = catchAsync(async (req, res) => {
  const { hotelId, duration, equipment = [], services = [], participants = 2 } = req.body;

  if (!hotelId || !duration) {
    throw new ApplicationError('Hotel ID and duration are required', 400);
  }

  // Create dummy room for cost calculation
  const dummyRoom = { hotelId };

  // Create dummy time range
  const now = new Date();
  const startTime = now;
  const endTime = new Date(now.getTime() + duration * 60 * 60 * 1000);

  const cost = await roomBookingService._calculateBookingCost(
    dummyRoom,
    equipment,
    services,
    startTime,
    endTime
  );

  res.json({
    success: true,
    data: {
      cost,
      participants,
      duration
    }
  });
});

/**
 * @swagger
 * /api/v1/meetup-resources/cancel-booking/{meetUpId}:
 *   delete:
 *     summary: Cancel room booking for meet-up
 *     tags: [Meet-Up Resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: meetUpId
 *         required: true
 *         schema:
 *           type: string
 *         description: Meet-up request ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Cancellation reason
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 *       403:
 *         description: Unauthorized to cancel booking
 *       404:
 *         description: Meet-up not found
 *       500:
 *         description: Server error
 */
export const cancelRoomBooking = catchAsync(async (req, res) => {
  const { meetUpId } = req.params;
  const { reason = 'Cancelled by user' } = req.body;

  // Check if user owns the meet-up
  const meetUp = await MeetUpRequest.findById(meetUpId);
  if (!meetUp) {
    throw new ApplicationError('Meet-up request not found', 404);
  }

  const userId = req.user._id;
  if (meetUp.requesterId.toString() !== userId.toString() &&
      meetUp.targetUserId.toString() !== userId.toString()) {
    throw new ApplicationError('You can only cancel bookings for your own meet-ups', 403);
  }

  const result = await roomBookingService.cancelRoomBooking(meetUpId, reason);

  res.json({
    success: true,
    message: result.message,
    data: {
      refundEligible: result.refundEligible
    }
  });
});

/**
 * @swagger
 * /api/v1/meetup-resources/booking-details/{meetUpId}:
 *   get:
 *     summary: Get room booking details for meet-up
 *     tags: [Meet-Up Resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: meetUpId
 *         required: true
 *         schema:
 *           type: string
 *         description: Meet-up request ID
 *     responses:
 *       200:
 *         description: Booking details
 *       403:
 *         description: Unauthorized to view booking
 *       404:
 *         description: Meet-up or booking not found
 *       500:
 *         description: Server error
 */
export const getBookingDetails = catchAsync(async (req, res) => {
  const { meetUpId } = req.params;

  // Get meet-up with room booking details
  const meetUp = await MeetUpRequest.findById(meetUpId)
    .populate('meetingRoomBooking.roomId', 'roomNumber type capacity amenities description')
    .populate('meetingRoomBooking.bookingId');

  if (!meetUp) {
    throw new ApplicationError('Meet-up request not found', 404);
  }

  const userId = req.user._id;
  if (meetUp.requesterId.toString() !== userId.toString() &&
      meetUp.targetUserId.toString() !== userId.toString() &&
      req.user.role !== 'admin') {
    throw new ApplicationError('You can only view booking details for your own meet-ups', 403);
  }

  if (!meetUp.meetingRoomBooking?.roomId) {
    return res.json({
      success: true,
      data: {
        hasBooking: false,
        message: 'No room booking found for this meet-up'
      }
    });
  }

  res.json({
    success: true,
    data: {
      hasBooking: true,
      booking: meetUp.meetingRoomBooking,
      room: meetUp.meetingRoomBooking.roomId,
      serviceBooking: meetUp.meetingRoomBooking.bookingId
    }
  });
});

/**
 * @swagger
 * /api/v1/meetup-resources/room-schedule/{hotelId}:
 *   get:
 *     summary: Get room booking schedule for a hotel
 *     tags: [Meet-Up Resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Hotel ID
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to check (defaults to today)
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *         description: Specific room ID filter
 *     responses:
 *       200:
 *         description: Room booking schedule
 *       404:
 *         description: Hotel not found
 *       500:
 *         description: Server error
 */
export const getRoomSchedule = catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  const { date = new Date().toISOString().split('T')[0], roomId } = req.query;

  // Parse the date
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  // Find all meet-ups with room bookings for the date
  let meetUpQuery = {
    hotelId,
    'meetingRoomBooking.roomId': { $exists: true },
    proposedDate: { $gte: startOfDay, $lt: endOfDay },
    status: { $in: ['accepted', 'confirmed'] }
  };

  if (roomId) {
    meetUpQuery['meetingRoomBooking.roomId'] = roomId;
  }

  const meetUps = await MeetUpRequest.find(meetUpQuery)
    .populate('meetingRoomBooking.roomId', 'roomNumber type capacity')
    .populate('requesterId', 'name email')
    .populate('targetUserId', 'name email')
    .select('title proposedTime meetingRoomBooking requesterId targetUserId status');

  // Group by room
  const schedule = meetUps.reduce((acc, meetUp) => {
    const roomId = meetUp.meetingRoomBooking.roomId._id.toString();
    if (!acc[roomId]) {
      acc[roomId] = {
        room: meetUp.meetingRoomBooking.roomId,
        bookings: []
      };
    }

    acc[roomId].bookings.push({
      meetUpId: meetUp._id,
      title: meetUp.title,
      timeSlot: meetUp.proposedTime,
      participants: [meetUp.requesterId, meetUp.targetUserId],
      status: meetUp.status
    });

    return acc;
  }, {});

  // Sort bookings by start time
  Object.values(schedule).forEach(roomSchedule => {
    roomSchedule.bookings.sort((a, b) => a.timeSlot.start.localeCompare(b.timeSlot.start));
  });

  res.json({
    success: true,
    data: {
      date: targetDate.toISOString().split('T')[0],
      schedule: Object.values(schedule),
      totalBookings: meetUps.length
    }
  });
});

export default {
  checkRoomAvailability,
  getAvailableRooms,
  getAvailableEquipment,
  getAvailableServices,
  bookRoom,
  calculateBookingCost,
  cancelRoomBooking,
  getBookingDetails,
  getRoomSchedule
};
