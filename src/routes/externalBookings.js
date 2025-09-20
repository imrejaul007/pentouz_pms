import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import Booking from '../models/Booking.js';
import RoomAvailability from '../models/RoomAvailability.js';
import RoomType from '../models/RoomType.js';
import logger from '../utils/logger.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for external APIs
const externalApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use API key if available, otherwise use IP
    return req.headers['x-api-key'] || req.ip;
  }
});

// Apply rate limiting to all external booking routes
router.use(externalApiLimiter);

/**
 * @swagger
 * /api/v1/external/bookings:
 *   post:
 *     summary: Create a new booking from external system
 *     tags: [External Bookings]
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotelId
 *               - roomTypeId
 *               - checkIn
 *               - checkOut
 *               - guests
 *               - rate
 *               - idempotencyKey
 *             properties:
 *               hotelId:
 *                 type: string
 *                 description: Hotel ID
 *               roomTypeId:
 *                 type: string
 *                 description: Room type ID
 *               checkIn:
 *                 type: string
 *                 format: date
 *                 description: Check-in date (YYYY-MM-DD)
 *               checkOut:
 *                 type: string
 *                 format: date
 *                 description: Check-out date (YYYY-MM-DD)
 *               guests:
 *                 type: object
 *                 properties:
 *                   adults:
 *                     type: number
 *                     minimum: 1
 *                   children:
 *                     type: number
 *                     minimum: 0
 *                   specialRequests:
 *                     type: string
 *               rate:
 *                 type: number
 *                 minimum: 0
 *                 description: Rate per night
 *               currency:
 *                 type: string
 *                 default: INR
 *               idempotencyKey:
 *                 type: string
 *                 description: Unique key to prevent duplicate bookings
 *               source:
 *                 type: string
 *                 enum: [PMS, OTA:booking_com, OTA:expedia, OTA:airbnb, corporate, travel_agent]
 *               externalBookingId:
 *                 type: string
 *                 description: External system's booking ID
 *     responses:
 *       201:
 *         description: Booking created successfully
 *       400:
 *         description: Invalid request data
 *       409:
 *         description: Duplicate booking (idempotency)
 *       422:
 *         description: No rooms available
 *       500:
 *         description: Internal server error
 */

// Create booking from external system
router.post('/', 
  authenticate, // Basic authentication
  catchAsync(async (req, res) => {
    const {
      hotelId,
      roomTypeId,
      checkIn,
      checkOut,
      guests,
      rate,
      currency = 'INR',
      idempotencyKey,
      source = 'external',
      externalBookingId,
      specialRequests
    } = req.body;

    // Validate required fields
    if (!hotelId || !roomTypeId || !checkIn || !checkOut || !guests || !rate || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['hotelId', 'roomTypeId', 'checkIn', 'checkOut', 'guests', 'rate', 'idempotencyKey']
      });
    }

    // Validate dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const now = new Date();

    if (checkInDate < now.setHours(0, 0, 0, 0)) {
      return res.status(400).json({
        success: false,
        error: 'Check-in date cannot be in the past'
      });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date'
      });
    }

    // Check idempotency - prevent duplicate bookings
    const existingBooking = await Booking.findOne({
      idempotencyKey: idempotencyKey
    });

    if (existingBooking) {
      logger.info(`Duplicate booking request with idempotency key: ${idempotencyKey}`, {
        idempotencyKey,
        existingBookingId: existingBooking._id,
        source
      });

      return res.status(409).json({
        success: true,
        message: 'Booking already exists',
        bookingId: existingBooking._id,
        bookingNumber: existingBooking.bookingNumber,
        status: existingBooking.status
      });
    }

    // Validate room type exists
    const roomType = await RoomType.findById(roomTypeId);
    if (!roomType) {
      return res.status(400).json({
        success: false,
        error: 'Invalid room type ID'
      });
    }

    // Check availability with transaction locking
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const availability = await RoomAvailability.checkAvailabilityWithLock(
      hotelId,
      roomTypeId,
      checkInDate,
      checkOutDate,
      1 // 1 room
    );

    // Check if all dates are available
    const unavailableDates = availability.filter(date => !date.canBook);
    if (unavailableDates.length > 0) {
      return res.status(422).json({
        success: false,
        error: 'No rooms available for the requested dates',
        unavailableDates: unavailableDates.map(d => ({
          date: d.date.toISOString().split('T')[0],
          reason: d.restrictions.stopSell ? 'Stop sell' : 
                  d.restrictions.closedToArrival ? 'Closed to arrival' : 
                  'No availability'
        }))
      });
    }

    // Create booking
    const booking = new Booking({
      hotelId,
      userId: null, // External bookings don't have user accounts
      bookingNumber: generateBookingNumber(),
      rooms: [{
        roomId: null, // Will be assigned during check-in
        rate: rate
      }],
      checkIn: checkInDate,
      checkOut: checkOutDate,
      nights,
      status: 'confirmed',
      paymentStatus: 'paid', // External systems handle payments
      totalAmount: rate * nights,
      currency: currency.toUpperCase(),
      roomType: roomType.name,
      
      // External system fields
      source: source,
      idempotencyKey: idempotencyKey,
      channelBookingId: externalBookingId,
      
      guestDetails: {
        adults: guests.adults || 1,
        children: guests.children || 0,
        specialRequests: specialRequests || guests.specialRequests
      },

      // Store external system data
      rawBookingPayload: req.body,
      
      // Add to modifications history
      modifications: [{
        modificationId: `ext_${Date.now()}`,
        modificationType: 'amendment',
        modificationDate: new Date(),
        modifiedBy: {
          source: source,
          userId: 'external_system',
          channel: source
        },
        oldValues: {},
        newValues: req.body,
        reason: 'External booking creation'
      }]
    });

    await booking.save();

    // Update inventory with transaction locking
    await RoomAvailability.bookRoomsWithLock(
      hotelId,
      roomTypeId,
      checkInDate,
      checkOutDate,
      1, // 1 room
      booking._id,
      source
    );

    logger.info(`External booking created: ${booking._id}`, {
      idempotencyKey,
      externalBookingId,
      source,
      hotelId,
      roomTypeId
    });

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        totalAmount: booking.totalAmount,
        currency: booking.currency,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/external/bookings/{bookingId}:
 *   put:
 *     summary: Modify an existing booking from external system
 *     tags: [External Bookings]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkIn:
 *                 type: string
 *                 format: date
 *               checkOut:
 *                 type: string
 *                 format: date
 *               guests:
 *                 type: object
 *               rate:
 *                 type: number
 *               specialRequests:
 *                 type: string
 *               modificationReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking modified successfully
 *       404:
 *         description: Booking not found
 *       422:
 *         description: Modification not possible
 */

// Modify existing booking
router.put('/:bookingId',
  authenticate,
  catchAsync(async (req, res) => {
    const { bookingId } = req.params;
    const {
      checkIn,
      checkOut,
      guests,
      rate,
      specialRequests,
      modificationReason = 'External modification'
    } = req.body;

    // Find the booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Store old values for audit
    const oldValues = {
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights: booking.nights,
      totalAmount: booking.totalAmount,
      guestDetails: { ...booking.guestDetails },
      rooms: [...booking.rooms]
    };

    let inventoryChanged = false;

    // Handle date changes
    if (checkIn || checkOut) {
      const newCheckIn = checkIn ? new Date(checkIn) : booking.checkIn;
      const newCheckOut = checkOut ? new Date(checkOut) : booking.checkOut;

      if (newCheckOut <= newCheckIn) {
        return res.status(400).json({
          success: false,
          error: 'Check-out date must be after check-in date'
        });
      }

      // Check new availability if dates changed
      if (newCheckIn.getTime() !== booking.checkIn.getTime() || 
          newCheckOut.getTime() !== booking.checkOut.getTime()) {
        
        const newAvailability = await RoomAvailability.checkAvailabilityWithLock(
          booking.hotelId,
          booking.rooms[0].roomId || booking.roomType,
          newCheckIn,
          newCheckOut,
          1
        );

        const unavailableDates = newAvailability.filter(date => !date.canBook);
        if (unavailableDates.length > 0) {
          return res.status(422).json({
            success: false,
            error: 'No rooms available for the new dates',
            unavailableDates: unavailableDates.map(d => ({
              date: d.date.toISOString().split('T')[0],
              reason: d.restrictions.stopSell ? 'Stop sell' : 
                      d.restrictions.closedToArrival ? 'Closed to arrival' : 
                      'No availability'
            }))
          });
        }

        // Release old inventory and book new inventory
        await RoomAvailability.releaseRoomsWithLock(
          booking.hotelId,
          booking.rooms[0].roomId || booking.roomType,
          booking.checkIn,
          booking.checkOut,
          1,
          booking._id
        );

        await RoomAvailability.bookRoomsWithLock(
          booking.hotelId,
          booking.rooms[0].roomId || booking.roomType,
          newCheckIn,
          newCheckOut,
          1,
          booking._id,
          booking.source
        );

        inventoryChanged = true;
        booking.checkIn = newCheckIn;
        booking.checkOut = newCheckOut;
        booking.nights = Math.ceil((newCheckOut - newCheckIn) / (1000 * 60 * 60 * 24));
      }
    }

    // Handle rate changes
    if (rate && rate !== booking.rooms[0].rate) {
      booking.rooms[0].rate = rate;
      booking.totalAmount = rate * booking.nights;
    }

    // Handle guest changes
    if (guests) {
      if (guests.adults !== undefined) booking.guestDetails.adults = guests.adults;
      if (guests.children !== undefined) booking.guestDetails.children = guests.children;
      if (guests.specialRequests !== undefined) booking.guestDetails.specialRequests = guests.specialRequests;
    }

    if (specialRequests !== undefined) {
      booking.guestDetails.specialRequests = specialRequests;
    }

    // Add modification to history
    booking.modifications.push({
      modificationId: `ext_mod_${Date.now()}`,
      modificationType: 'amendment',
      modificationDate: new Date(),
      modifiedBy: {
        source: booking.source,
        userId: 'external_system',
        channel: booking.source
      },
      oldValues,
      newValues: {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights,
        totalAmount: booking.totalAmount,
        guestDetails: booking.guestDetails,
        rooms: booking.rooms
      },
      reason: modificationReason
    });

    await booking.save();

    logger.info(`External booking modified: ${booking._id}`, {
      bookingId,
      source: booking.source,
      inventoryChanged
    });

    res.json({
      success: true,
      message: 'Booking modified successfully',
      data: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        totalAmount: booking.totalAmount,
        currency: booking.currency,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/external/bookings/{bookingId}/cancel:
 *   post:
 *     summary: Cancel a booking from external system
 *     tags: [External Bookings]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
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
 *       404:
 *         description: Booking not found
 */

// Cancel booking
router.post('/:bookingId/cancel',
  authenticate,
  catchAsync(async (req, res) => {
    const { bookingId } = req.params;
    const { reason = 'External cancellation' } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(200).json({
        success: true,
        message: 'Booking is already cancelled',
        data: { bookingId: booking._id }
      });
    }

    // Store old values for audit
    const oldValues = {
      status: booking.status,
      totalAmount: booking.totalAmount
    };

    // Update booking status
    booking.status = 'cancelled';
    booking.cancellationReason = reason;

    // Release inventory
    await RoomAvailability.releaseRoomsWithLock(
      booking.hotelId,
      booking.rooms[0].roomId || booking.roomType,
      booking.checkIn,
      booking.checkOut,
      1,
      booking._id
    );

    // Add modification to history
    booking.modifications.push({
      modificationId: `ext_cancel_${Date.now()}`,
      modificationType: 'cancellation',
      modificationDate: new Date(),
      modifiedBy: {
        source: booking.source,
        userId: 'external_system',
        channel: booking.source
      },
      oldValues,
      newValues: {
        status: 'cancelled',
        cancellationReason: reason
      },
      reason
    });

    await booking.save();

    logger.info(`External booking cancelled: ${booking._id}`, {
      bookingId,
      source: booking.source,
      reason
    });

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/external/availability:
 *   get:
 *     summary: Check room availability for external systems
 *     tags: [External Bookings]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: roomTypeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: checkIn
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: checkOut
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Availability information
 *       400:
 *         description: Invalid parameters
 */

// Check availability
router.get('/availability',
  authenticate,
  catchAsync(async (req, res) => {
    const { hotelId, roomTypeId, checkIn, checkOut } = req.query;

    if (!hotelId || !roomTypeId || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        required: ['hotelId', 'roomTypeId', 'checkIn', 'checkOut']
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date'
      });
    }

    // Get availability with transaction locking
    const availability = await RoomAvailability.checkAvailabilityWithLock(
      hotelId,
      roomTypeId,
      checkInDate,
      checkOutDate,
      1
    );

    // Get room type information
    const roomType = await RoomType.findById(roomTypeId).select('name description baseRate');

    const availabilityResponse = availability.map(date => ({
      date: date.date.toISOString().split('T')[0],
      availableRooms: date.availableRooms,
      canBook: date.canBook,
      rate: roomType?.baseRate || 0,
      restrictions: {
        stopSell: date.restrictions.stopSell,
        closedToArrival: date.restrictions.closedToArrival,
        minLengthOfStay: date.restrictions.minLengthOfStay
      }
    }));

    res.json({
      success: true,
      data: {
        hotelId,
        roomTypeId,
        roomTypeName: roomType?.name,
        checkIn: checkIn,
        checkOut: checkOut,
        nights: Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)),
        availability: availabilityResponse,
        summary: {
          totalNights: availabilityResponse.length,
          availableNights: availabilityResponse.filter(d => d.canBook).length,
          minRate: Math.min(...availabilityResponse.map(d => d.rate)),
          maxRate: Math.max(...availabilityResponse.map(d => d.rate))
        }
      }
    });
  })
);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'External Booking API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Helper function to generate unique booking numbers
function generateBookingNumber() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `EXT-${timestamp.slice(-6)}-${random}`;
}

export default router;
