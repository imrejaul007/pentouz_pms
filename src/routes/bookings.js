import express from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import Invoice from '../models/Invoice.js';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { dashboardUpdateService } from '../services/dashboardUpdateService.js';
import websocketService from '../services/websocketService.js';
import { marketingSyncMiddleware } from '../middleware/marketingSyncMiddleware.js';
import { bookingCompletionMiddleware } from '../middleware/crmTrackingMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /bookings/current-hotel:
 *   get:
 *     summary: Get current user's hotel ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user's hotel ID
 */
router.get('/current-hotel', authenticate, catchAsync(async (req, res) => {
  res.json({
    status: 'success',
    data: {
      hotelId: req.user.hotelId
    }
  });
}));

/**
 * @swagger
 * /bookings/upcoming:
 *   get:
 *     summary: Get upcoming bookings (arrivals within next 7-30 days)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days to look ahead for upcoming arrivals
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of upcoming bookings
 */
router.get('/upcoming', authenticate, catchAsync(async (req, res) => {
  const {
    days = 7,
    page = 1,
    limit = 50
  } = req.query;

  // Build query based on user role
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  const query = {
    status: { $in: ['confirmed', 'pending'] },
    checkIn: {
      $gte: today, // Today or later (from start of day)
      $lte: new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000) // Within specified days
    }
  };

  // Role-based filtering
  if (req.user.role === 'guest') {
    query.userId = req.user._id;
  } else if (req.user.role === 'staff' && req.user.hotelId) {
    query.hotelId = req.user.hotelId;
  } else if (req.user.role === 'admin' && req.user.hotelId) {
    query.hotelId = req.user.hotelId;
  }
  // Admin sees bookings for their hotel, or all if no hotelId

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const bookings = await Booking.find(query)
    .populate('userId', 'name email phone')
    .populate('rooms.roomId', 'roomNumber type baseRate currentRate')
    .populate('hotelId', 'name address contact')
    .populate('corporateBooking.corporateCompanyId', 'name gstNumber')
    .sort({ checkIn: 1 }) // Sort by check-in date (ascending)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Booking.countDocuments(query);

  // Get quick stats for today and tomorrow
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  const todayQuery = { ...query, checkIn: { $gte: today, $lt: tomorrow } };
  const tomorrowQuery = { ...query, checkIn: { $gte: tomorrow, $lt: dayAfterTomorrow } };

  const [todayCount, tomorrowCount] = await Promise.all([
    Booking.countDocuments(todayQuery),
    Booking.countDocuments(tomorrowQuery)
  ]);

  res.json({
    status: 'success',
    results: bookings.length,
    stats: {
      todayArrivals: todayCount,
      tomorrowArrivals: tomorrowCount,
      totalUpcoming: total
    },
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    },
    data: bookings
  });
}));

/**
 * @swagger
 * /bookings:
 *   get:
 *     summary: Get bookings
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, checked_in, checked_out, cancelled, no_show]
 *       - in: query
 *         name: checkIn
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: checkOut
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [corporate, individual]
 *         description: Filter by booking type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of bookings
 */
router.get('/', authenticate, catchAsync(async (req, res) => {
  const {
    status,
    checkIn,
    checkOut,
    type,
    page = 1,
    limit = 10
  } = req.query;

  // Build query based on user role
  const query = {};

  if (req.user.role === 'guest') {
    query.userId = req.user._id;
  } else if (req.user.role === 'staff' && req.user.hotelId) {
    query.hotelId = req.user.hotelId;
  }
  // Admin sees all bookings

  if (status) {
    // Support comma-separated status values (e.g., "confirmed,pending,checked_in")
    if (status.includes(',')) {
      query.status = { $in: status.split(',').map(s => s.trim()) };
    } else {
      query.status = status;
    }
  }

  // Filter by booking type (corporate, individual)
  if (type === 'corporate') {
    query['corporateBooking.corporateCompanyId'] = { $exists: true, $ne: null };
  } else if (type === 'individual') {
    query.$or = [
      { 'corporateBooking.corporateCompanyId': { $exists: false } },
      { 'corporateBooking.corporateCompanyId': null }
    ];
  }

  if (checkIn) {
    query.checkIn = { $gte: new Date(checkIn) };
  }

  if (checkOut) {
    query.checkOut = { $lte: new Date(checkOut) };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const bookings = await Booking.find(query)
    .populate('userId', 'name email phone')
    .populate('rooms.roomId', 'roomNumber type baseRate currentRate')
    .populate('hotelId', 'name address contact')
    .populate('corporateBooking.corporateCompanyId', 'name gstNumber')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Booking.countDocuments(query);

  res.json({
    status: 'success',
    results: bookings.length,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    },
    data: bookings
  });
}));

/**
 * @swagger
 * /bookings/room/{roomId}:
 *   get:
 *     summary: Get bookings for a specific room
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, checked_in, checked_out, cancelled, no_show]
 *       - in: query
 *         name: timeFilter
 *         schema:
 *           type: string
 *           enum: [past, future, current, all]
 *         default: all
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of bookings for the room
 */
router.get('/room/:roomId', authenticate, authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const { 
    status,
    timeFilter = 'all',
    page = 1,
    limit = 10
  } = req.query;
  
  // Validate room exists and user has access
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApplicationError('Room not found', 404);
  }
  
  // Check if user has access to this hotel
  if (req.user.role === 'staff' && req.user.hotelId.toString() !== room.hotelId.toString()) {
    throw new ApplicationError('You do not have access to this room', 403);
  }
  
  // Build query
  const query = {
    'rooms.roomId': roomId
  };
  
  if (status) {
    query.status = status;
  }
  
  // Add time-based filters
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (timeFilter) {
    case 'past':
      query.checkOut = { $lt: today };
      break;
    case 'future':
      query.checkIn = { $gt: today };
      break;
    case 'current':
      query.$and = [
        { checkIn: { $lte: today } },
        { checkOut: { $gte: today } }
      ];
      break;
    // 'all' case - no additional filter needed
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const bookings = await Booking.find(query)
    .populate('userId', 'name email phone')
    .populate('rooms.roomId', 'roomNumber type baseRate currentRate')
    .populate('hotelId', 'name')
    .sort({ checkIn: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await Booking.countDocuments(query);
  
  res.json({
    status: 'success',
    data: {
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /bookings/{id}:
 *   get:
 *     summary: Get booking by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking details
 */
router.get('/:id', authenticate, catchAsync(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('userId', 'name email phone')
    .populate('rooms.roomId', 'roomNumber type baseRate currentRate')
    .populate('hotelId', 'name address contact policies');

  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'guest' && booking.userId._id.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You do not have permission to view this booking', 403);
  }

  if (req.user.role === 'staff' && booking.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You do not have permission to view this booking', 403);
  }

  res.json({
    status: 'success',
    data: {
      booking
    }
  });
}));

/**
 * @swagger
 * /bookings:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
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
 *               - roomIds
 *               - checkIn
 *               - checkOut
 *               - idempotencyKey
 *             properties:
 *               hotelId:
 *                 type: string
 *               roomIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               checkIn:
 *                 type: string
 *                 format: date
 *               checkOut:
 *                 type: string
 *                 format: date
 *               guestDetails:
 *                 type: object
 *               idempotencyKey:
 *                 type: string
 *     responses:
 *       201:
 *         description: Booking created successfully
 */
router.post('/',
  authenticate,
  bookingCompletionMiddleware,
  validate(schemas.createBooking),
  marketingSyncMiddleware('booking_created'),
  catchAsync(async (req, res) => {
    console.log('🔍 DEBUG - Full request body:', JSON.stringify(req.body, null, 2));

    const {
      hotelId,
      userId,
      roomIds,
      checkIn,
      checkOut,
      guestDetails,
      totalAmount,
      currency,
      paymentStatus,
      status,
      idempotencyKey,
      roomType, // Add roomType field for room-type bookings
      // Payment information for walk-in bookings
      paymentMethod,
      advanceAmount,
      paymentReference,
      paymentNotes
    } = req.body;

    console.log('🔍 DEBUG - Extracted payment fields:', {
      paymentMethod,
      advanceAmount,
      paymentReference,
      paymentNotes
    });

    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Check for duplicate booking with same idempotency key (with intelligent expiration)
        const existingBooking = await Booking.findOne({ idempotencyKey });
        if (existingBooking) {
          // Allow reuse of idempotency key if:
          // 1. The existing booking is from the same user AND
          // 2. Either the existing booking is old (>1 hour) OR it's in a final state
          const isOldBooking = (Date.now() - existingBooking.createdAt.getTime()) > (60 * 60 * 1000); // 1 hour
          const isFinalState = ['checked_out', 'cancelled', 'no_show'].includes(existingBooking.status);
          const isSameUser = existingBooking.userId.toString() === (userId || req.user._id).toString();
          
          if (!isSameUser) {
            throw new ApplicationError(
              `Booking conflict detected. This booking reference is already in use by another user. ` +
              `Please refresh the page and try again.`, 
              409
            );
          }
          
          if (!isOldBooking && !isFinalState) {
            // Recent booking by same user that's still active
            const timeSinceCreated = Math.round((Date.now() - existingBooking.createdAt.getTime()) / (1000 * 60)); // minutes
            throw new ApplicationError(
              `Duplicate booking detected. You already have booking ${existingBooking.bookingNumber} created ${timeSinceCreated} minutes ago. ` +
              `If you want to make a different booking, please wait a few minutes or contact support.`, 
              409
            );
          }
          
          // Old booking or final state - allow new booking but log it
          console.log(`Reusing idempotency key from ${isFinalState ? 'completed' : 'old'} booking ${existingBooking.bookingNumber} for user ${userId || req.user._id}`);
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        let rooms = [];
        let roomsWithRates = [];

        // Only validate rooms if roomIds are provided
        if (roomIds && roomIds.length > 0) {
          // Get rooms and check availability
          rooms = await Room.find({
            _id: { $in: roomIds },
            hotelId,
            isActive: true
          });

          if (rooms.length !== roomIds.length) {
            throw new ApplicationError('One or more rooms not found or not available', 404);
          }

          // Check for overlapping bookings
          const overlappingBookings = await Booking.findOverlapping(
            roomIds,
            checkInDate,
            checkOutDate
          );

          if (overlappingBookings.length > 0) {
            const conflictingRooms = overlappingBookings.map(booking => {
              const conflictedRoom = rooms.find(room => 
                booking.rooms.some(bookingRoom => bookingRoom.roomId.toString() === room._id.toString())
              );
              return {
                roomNumber: conflictedRoom?.roomNumber || 'Unknown',
                conflictingBooking: booking.bookingNumber,
                conflictDates: `${booking.checkIn.toDateString()} - ${booking.checkOut.toDateString()}`,
                status: booking.status
              };
            });
            
            const roomDetails = conflictingRooms.map(room => 
              `Room ${room.roomNumber} (conflicting with booking ${room.conflictingBooking}, ${room.conflictDates}, status: ${room.status})`
            ).join('; ');
            
            throw new ApplicationError(
              `Room availability conflict detected. The following rooms are already booked for overlapping dates: ${roomDetails}. ` +
              `Please select different dates or contact support if you believe this is an error.`,
              409
            );
          }

          // Calculate rates from actual rooms
          roomsWithRates = rooms.map(room => ({
            roomId: room._id,
            rate: room.currentRate
          }));
        }
        // For bookings without room allocation, use empty rooms array

        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        const calculatedTotal = roomsWithRates.length > 0 
          ? roomsWithRates.reduce((total, room) => total + room.rate, 0) * nights
          : 0; // No calculated total for bookings without room allocation

        // Create booking - use admin-provided values when available
        // Prepare payment details if payment information is provided
        console.log('🔍 Payment Debug - paymentMethod:', paymentMethod);
        console.log('🔍 Payment Debug - advanceAmount:', advanceAmount, typeof advanceAmount);
        console.log('🔍 Payment Debug - condition check:', paymentMethod && advanceAmount > 0);

        const paymentDetails = {};
        const numericAdvanceAmount = Number(advanceAmount);

        if (paymentMethod && numericAdvanceAmount > 0) {
          console.log('✅ Payment Processing - Creating payment details');
          paymentDetails.paymentMethods = [{
            method: paymentMethod,
            amount: numericAdvanceAmount,
            reference: paymentReference || '',
            processedBy: req.user._id,
            processedAt: new Date(),
            notes: paymentNotes || 'Walk-in booking payment'
          }];
          paymentDetails.totalPaid = numericAdvanceAmount;
          paymentDetails.remainingAmount = Math.max(0, (totalAmount || calculatedTotal) - numericAdvanceAmount);
          paymentDetails.collectedAt = new Date();
          paymentDetails.collectedBy = req.user._id;
          console.log('✅ Payment Details Created:', paymentDetails);
        } else {
          console.log('❌ Payment Skipped - Conditions not met');
        }

        const booking = await Booking.create([{
          hotelId,
          userId: userId || req.user._id, // Use provided userId for admin bookings, fallback to current user
          rooms: roomsWithRates,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          nights,
          guestDetails,
          totalAmount: totalAmount || calculatedTotal, // Use provided total or calculated total (required for non-room bookings)
          currency: currency || 'INR',
          idempotencyKey,
          status: status || 'pending',
          paymentStatus: paymentStatus || 'pending',
          roomType, // Add roomType for room-type preference bookings
          ...paymentDetails // Spread payment details if provided
        }], { session });

        // Create corresponding invoice for billing history
        const finalAmount = totalAmount || calculatedTotal;
        const bookingCurrency = currency || 'INR';
        
        // Calculate due date (typically 30 days from issue date)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        
        // Create invoice items from room charges
        const invoiceItems = roomsWithRates.length > 0 
          ? roomsWithRates.map(room => {
              const roomDetails = rooms.find(r => r._id.toString() === room.roomId.toString());
              return {
                description: `Room ${roomDetails?.roomNumber || 'N/A'} - ${roomDetails?.type || 'Standard'} (${nights} nights)`,
                category: 'accommodation',
                quantity: nights,
                unitPrice: room.rate,
                totalPrice: room.rate * nights,
                taxRate: 10, // Standard 10% tax rate
                taxAmount: (room.rate * nights * 10) / 100
              };
            })
          : [{
              description: `Accommodation Booking (${nights} nights) - Room allocation pending`,
              category: 'accommodation',
              quantity: nights,
              unitPrice: Math.round(finalAmount / nights),
              totalPrice: finalAmount,
              taxRate: 18, // 18% GST for Indian bookings
              taxAmount: 0 // Tax already included in finalAmount from frontend
            }];
        
        // Calculate subtotal and tax
        const subtotal = invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const taxAmount = invoiceItems.reduce((sum, item) => sum + item.taxAmount, 0);
        const totalWithTax = subtotal + taxAmount;
        
        const invoice = await Invoice.create([{
          hotelId,
          bookingId: booking[0]._id,
          guestId: userId || req.user._id,
          type: 'accommodation',
          status: paymentStatus === 'paid' ? 'paid' : 'issued',
          items: invoiceItems,
          subtotal,
          taxAmount,
          totalAmount: totalWithTax,
          currency: bookingCurrency,
          dueDate,
          paidDate: paymentStatus === 'paid' ? new Date() : null,
          payments: paymentStatus === 'paid' ? [{
            amount: totalWithTax,
            method: 'credit_card', // Default method, can be updated later
            paidBy: userId || req.user._id,
            paidAt: new Date(),
            notes: 'Booking payment'
          }] : []
        }], { session });

        // Notify admin dashboard of new booking
        await dashboardUpdateService.notifyNewBooking(booking[0], req.user);
        await dashboardUpdateService.triggerDashboardRefresh(hotelId, 'bookings');

        // Real-time WebSocket notifications
        try {
          // Notify hotel staff and admins of new booking
          await websocketService.broadcastToHotel(hotelId, 'booking:created', {
            booking: booking[0],
            invoice: invoice[0],
            user: req.user
          });

          // Notify the guest who created the booking
          if (booking[0].userId) {
            await websocketService.sendToUser(booking[0].userId.toString(), 'booking:created', {
              booking: booking[0],
              invoice: invoice[0]
            });
          }

          // Notify staff roles specifically
          await websocketService.broadcastToRole('staff', 'booking:created', booking[0]);
          await websocketService.broadcastToRole('admin', 'booking:created', booking[0]);
          await websocketService.broadcastToRole('manager', 'booking:created', booking[0]);
        } catch (wsError) {
          // Log WebSocket errors but don't fail the booking creation
          console.warn('Failed to send real-time booking notification:', wsError.message);
        }

        res.status(201).json({
          status: 'success',
          data: {
            booking: booking[0],
            invoice: invoice[0]
          }
        });
      });
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  })
);

/**
 * @swagger
 * /bookings/{id}:
 *   patch:
 *     summary: Update booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking updated successfully
 */
router.patch('/:id',
  authenticate,
  marketingSyncMiddleware('booking_updated'),
  catchAsync(async (req, res) => {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check permissions
    if (req.user.role === 'guest' && booking.userId.toString() !== req.user._id.toString()) {
      throw new ApplicationError('You do not have permission to modify this booking', 403);
    }

    if (req.user.role === 'staff' && booking.hotelId.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('You do not have permission to modify this booking', 403);
    }

    // Restrict certain fields for guests
    const allowedFields = req.user.role === 'guest' 
      ? ['guestDetails'] 
      : Object.keys(req.body);

    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const originalBooking = await Booking.findById(req.params.id);
    const oldPaymentStatus = originalBooking?.paymentStatus;

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'rooms.roomId', select: 'roomNumber type baseRate currentRate' },
      { path: 'userId', select: 'name email phone' },
      { path: 'hotelId', select: 'name address contact' }
    ]);

    // Update corresponding invoice if payment status changed
    if (updateData.paymentStatus && ['admin', 'staff'].includes(req.user.role)) {
      const invoice = await Invoice.findOne({ bookingId: req.params.id });
      if (invoice) {
        if (updateData.paymentStatus === 'paid' && invoice.status !== 'paid') {
          // Mark invoice as paid
          invoice.status = 'paid';
          invoice.paidDate = new Date();
          
          // Add payment record if not exists
          const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
          if (totalPaid < invoice.totalAmount) {
            invoice.payments.push({
              amount: invoice.totalAmount - totalPaid,
              method: 'credit_card', // Default method
              paidBy: updatedBooking.userId,
              paidAt: new Date(),
              notes: 'Payment status updated via booking'
            });
          }
        } else if (updateData.paymentStatus === 'pending' && invoice.status === 'paid') {
          // Revert invoice to issued status
          invoice.status = 'issued';
          invoice.paidDate = null;
          invoice.payments = []; // Clear payments
        }
        
        await invoice.save();
      }

      // Notify admin dashboard if payment status changed
      if (oldPaymentStatus !== updateData.paymentStatus) {
        await dashboardUpdateService.notifyPaymentUpdate(updatedBooking, oldPaymentStatus, updateData.paymentStatus, updatedBooking.userId);
        await dashboardUpdateService.triggerDashboardRefresh(updatedBooking.hotelId, 'payments');
      }
    }

    // Real-time WebSocket notifications for booking update
    try {
      // Notify hotel staff and admins of booking update
      await websocketService.broadcastToHotel(updatedBooking.hotelId, 'booking:updated', {
        booking: updatedBooking,
        updateData,
        updatedBy: req.user
      });

      // Notify the guest who owns the booking
      if (updatedBooking.userId) {
        await websocketService.sendToUser(updatedBooking.userId.toString(), 'booking:updated', {
          booking: updatedBooking,
          updateData
        });
      }

      // Notify staff roles specifically if payment status changed
      if (oldPaymentStatus !== updateData.paymentStatus) {
        await websocketService.broadcastToRole('staff', 'booking:payment_updated', {
          booking: updatedBooking,
          oldPaymentStatus,
          newPaymentStatus: updateData.paymentStatus
        });
        await websocketService.broadcastToRole('admin', 'booking:payment_updated', {
          booking: updatedBooking,
          oldPaymentStatus,
          newPaymentStatus: updateData.paymentStatus
        });
      }
    } catch (wsError) {
      // Log WebSocket errors but don't fail the booking update
      console.warn('Failed to send real-time booking update notification:', wsError.message);
    }

    res.json({
      status: 'success',
      data: {
        booking: updatedBooking
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/cancel:
 *   patch:
 *     summary: Cancel booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 */
router.patch('/:id/cancel', 
  authenticate, 
  catchAsync(async (req, res) => {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check permissions
    if (req.user.role === 'guest' && booking.userId.toString() !== req.user._id.toString()) {
      throw new ApplicationError('You do not have permission to cancel this booking', 403);
    }

    if (!booking.canCancel()) {
      throw new ApplicationError('This booking cannot be cancelled', 400);
    }

    booking.status = 'cancelled';
    booking.cancellationReason = req.body.reason || 'Cancelled by user';
    await booking.save();

    // Notify admin dashboard of booking cancellation
    await dashboardUpdateService.notifyBookingCancellation(booking, req.user, req.body.reason);
    await dashboardUpdateService.triggerDashboardRefresh(booking.hotelId, 'bookings');

    res.json({
      status: 'success',
      data: {
        booking
      }
    });
  })
);

// Change room for a booking (for drag & drop in tape chart)
router.post('/change-room', 
  authenticate, 
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const { bookingId, newRoomId, newRoomNumber, reason, changeDate } = req.body;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Find the room in the booking's rooms array and update it
    if (booking.rooms && booking.rooms.length > 0) {
      booking.rooms[0].roomId = new mongoose.Types.ObjectId(newRoomId);
      // Add a note about the room change
      if (!booking.notes) booking.notes = [];
      booking.notes.push(`Room changed to ${newRoomNumber} on ${new Date().toISOString()} by ${req.user.name}. Reason: ${reason}`);
      
      await booking.save();
      
      res.json({
        success: true,
        data: {
          booking,
          message: `Room changed to ${newRoomNumber} successfully`
        }
      });
    } else {
      throw new ApplicationError('Booking has no rooms to change', 400);
    }
  })
);

// Change room by finding booking via guest details or booking ID (for drag & drop in tape chart)
router.post('/change-room-by-guest',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    console.log('🚀 BACKEND DEBUG - Request body:', req.body);
    console.log('🚀 BACKEND DEBUG - User info:', req.user);

    const { bookingId, guestName, checkIn, checkOut, newRoomId, newRoomNumber, reason } = req.body;

    console.log('🚀 BACKEND DEBUG - Extracted data:', {
      bookingId,
      guestName,
      checkIn,
      checkOut,
      newRoomId,
      newRoomNumber,
      reason
    });

    let booking;

    // First try to find by bookingId if provided
    if (bookingId) {
      console.log('🚀 BACKEND DEBUG - Searching by booking ID:', bookingId);
      booking = await Booking.findById(bookingId);
    }

    // If not found by ID, search by guest name and dates
    if (!booking && guestName) {
      console.log('🚀 BACKEND DEBUG - Searching by guest name and dates');

      // Find the user by name
      const user = await User.findOne({
        name: { $regex: new RegExp(guestName, 'i') }
      });

      if (user) {
        console.log('🚀 BACKEND DEBUG - Found user:', user.name, user._id);

        // Create flexible date range to handle timezone issues
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        checkInDate.setHours(0, 0, 0, 0);
        checkOutDate.setHours(23, 59, 59, 999);

        // Search with date range
        const searchQuery = {
          userId: user._id,
          checkIn: {
            $gte: new Date(checkInDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
            $lte: new Date(checkInDate.getTime() + 24 * 60 * 60 * 1000)  // 1 day after
          },
          checkOut: {
            $gte: new Date(checkOutDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
            $lte: new Date(checkOutDate.getTime() + 24 * 60 * 60 * 1000)  // 1 day after
          }
        };

        console.log('🚀 BACKEND DEBUG - Search query:', searchQuery);
        booking = await Booking.findOne(searchQuery);
      } else {
        console.log('🚀 BACKEND DEBUG - No user found with name:', guestName);
      }
    }

    if (!booking) {
      console.log('🚀 BACKEND DEBUG - No booking found');
      throw new ApplicationError(`Booking not found for ${guestName || bookingId}`, 404);
    }

    console.log('🚀 BACKEND DEBUG - Found booking:', booking._id);
    console.log('🚀 BACKEND DEBUG - Booking rooms:', booking.rooms);
    console.log('🚀 BACKEND DEBUG - Booking rooms length:', booking.rooms?.length);
    console.log('🚀 BACKEND DEBUG - Booking status:', booking.status);

    // Ensure rooms array exists
    if (!booking.rooms) {
      booking.rooms = [];
    }

    // Check if booking is cancelled and reactivate it if needed
    if (booking.status === 'cancelled') {
      console.log('🚀 BACKEND DEBUG - Reactivating cancelled booking...');
      booking.status = 'confirmed';
      booking.lastStatusChange = {
        from: 'cancelled',
        to: 'confirmed',
        timestamp: new Date(),
        reason: 'Reactivated for room assignment'
      };
    }

    // Find the room to get its rate and validate room type
    const Room = mongoose.model('Room');
    const room = await Room.findById(newRoomId);

    if (!room) {
      throw new ApplicationError(`Room not found: ${newRoomNumber}`, 404);
    }

    console.log('🚀 BACKEND DEBUG - Room details:', {
      roomNumber: room.roomNumber,
      roomType: room.roomType,
      price: room.price,
      isActive: room.isActive
    });

    console.log('🚀 BACKEND DEBUG - Booking room type:', booking.roomType);

    // Validate room type compatibility
    if (booking.roomType && room.roomType) {
      const bookingRoomType = booking.roomType.toLowerCase();
      const actualRoomType = room.roomType.toLowerCase();

      // Check if room types match (allow some flexibility for similar types)
      const isCompatible =
        bookingRoomType === actualRoomType ||
        (bookingRoomType === 'deluxe' && actualRoomType === 'deluxe') ||
        (bookingRoomType === 'suite' && actualRoomType === 'suite') ||
        (bookingRoomType === 'single' && actualRoomType === 'single') ||
        (bookingRoomType === 'double' && actualRoomType === 'double');

      if (!isCompatible) {
        console.log('🚀 BACKEND DEBUG - Room type mismatch!');
        throw new ApplicationError(
          `Room type mismatch: Booking requires ${booking.roomType} but room ${newRoomNumber} is ${room.roomType}`,
          400
        );
      }
    }

    // Validate that the target date is within the booking's check-in/check-out period
    const { newCheckInDate } = req.body;
    if (newCheckInDate) {
      const targetDate = new Date(newCheckInDate);
      const bookingCheckIn = new Date(booking.checkIn);
      const bookingCheckOut = new Date(booking.checkOut);

      // Normalize dates to compare only the date part
      targetDate.setHours(0, 0, 0, 0);
      bookingCheckIn.setHours(0, 0, 0, 0);
      bookingCheckOut.setHours(0, 0, 0, 0);

      console.log('🚀 BACKEND DEBUG - Date validation:', {
        targetDate: targetDate.toISOString(),
        bookingCheckIn: bookingCheckIn.toISOString(),
        bookingCheckOut: bookingCheckOut.toISOString()
      });

      // Check if target date is within the booking period (inclusive of check-in, exclusive of check-out)
      if (targetDate < bookingCheckIn || targetDate >= bookingCheckOut) {
        throw new ApplicationError(
          `Date mismatch: Cannot assign guest to ${targetDate.toDateString()}. Booking is only valid from ${bookingCheckIn.toDateString()} to ${new Date(bookingCheckOut.getTime() - 1).toDateString()}`,
          400
        );
      }
    }

    // Check if room is active and available
    if (!room.isActive) {
      throw new ApplicationError(`Room ${newRoomNumber} is not active`, 400);
    }

    const roomRate = room.price || booking.totalAmount / booking.nights || 100;

    // Handle bookings without rooms (new bookings) or with existing rooms
    if (booking.rooms.length > 0) {
      // Update existing room
      console.log('🚀 BACKEND DEBUG - Updating existing room from:', booking.rooms[0].roomId, 'to:', newRoomId);
      booking.rooms[0].roomId = new mongoose.Types.ObjectId(newRoomId);
      booking.rooms[0].rate = roomRate;
    } else {
      // Add new room to booking
      console.log('🚀 BACKEND DEBUG - Adding new room to booking:', newRoomId);
      booking.rooms.push({
        roomId: new mongoose.Types.ObjectId(newRoomId),
        rate: roomRate
      });
    }

    // Add a note about the room assignment/change
    if (!booking.notes) booking.notes = [];
    booking.notes.push(`Room assigned/changed to ${newRoomNumber} on ${new Date().toISOString()} by ${req.user.name}. Reason: ${reason}`);

    console.log('🚀 BACKEND DEBUG - Saving booking with updated room...');
    await booking.save();

    console.log('🚀 BACKEND DEBUG - Booking saved successfully');

    // Populate the updated booking with user and room details
    await booking.populate('userId', 'name email');
    await booking.populate('rooms.roomId', 'roomNumber roomType');

    res.json({
      success: true,
      data: {
        booking,
        message: `${guestName || 'Booking'}'s room assigned to ${newRoomNumber} successfully`
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/modification-request:
 *   post:
 *     summary: Create a booking modification request
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               modificationType:
 *                 type: string
 *                 enum: [date_change, room_upgrade, guest_count, early_checkin, late_checkout, cancellation]
 *               requestedChanges:
 *                 type: object
 *               reason:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *     responses:
 *       200:
 *         description: Modification request created successfully
 */
router.post('/:id/modification-request',
  authenticate,
  catchAsync(async (req, res) => {
    const { modificationType, requestedChanges, reason, priority = 'medium' } = req.body;
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId).populate('userId hotelId');
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check if user owns this booking or is staff/admin
    const isOwner = booking.userId._id.toString() === req.user._id.toString();
    const isStaff = ['admin', 'staff', 'manager'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      throw new ApplicationError('You are not authorized to modify this booking', 403);
    }

    // Create modification request object following the booking schema
    const modificationRequest = {
      modificationId: new mongoose.Types.ObjectId().toString(),
      modificationType,
      modificationDate: new Date(),
      modifiedBy: {
        source: req.user.role === 'admin' || req.user.role === 'staff' ? 'admin' : 'guest',
        userId: req.user._id.toString(),
        userName: req.user.name,
        ipAddress: req.ip || 'unknown'
      },
      oldValues: {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomType: booking.roomType,
        totalAmount: booking.totalAmount,
        guestDetails: booking.guestDetails
      },
      newValues: requestedChanges,
      reason,
      autoApproved: false
    };

    // Add to booking's modifications array
    if (!booking.modifications) booking.modifications = [];
    booking.modifications.push(modificationRequest);

    await booking.save();

    // Notify staff/admin about new modification request
    try {
      if (websocketService) {
        const notificationData = {
          type: 'booking_modification_request',
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          guestName: booking.userId.name,
          modificationType,
          priority,
          requestedChanges,
          reason,
          requestedBy: req.user.name,
          hotelId: booking.hotelId._id
        };

        // Notify hotel staff and admins
        await websocketService.broadcastToHotel(booking.hotelId._id, 'booking:modification_requested', notificationData);
        await websocketService.broadcastToRole('admin', 'booking:modification_requested', notificationData);
        await websocketService.broadcastToRole('staff', 'booking:modification_requested', notificationData);
      }
    } catch (wsError) {
      console.error('WebSocket notification failed:', wsError);
    }

    res.json({
      status: 'success',
      data: {
        modificationRequest,
        message: 'Modification request submitted successfully'
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/modification-requests:
 *   get:
 *     summary: Get modification requests for a booking
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Modification requests retrieved successfully
 */
router.get('/:id/modification-requests',
  authenticate,
  catchAsync(async (req, res) => {
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId)
      .populate('userId', 'name email');

    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check permissions
    const isOwner = booking.userId._id.toString() === req.user._id.toString();
    const isStaff = ['admin', 'staff', 'manager'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      throw new ApplicationError('You are not authorized to view modification requests for this booking', 403);
    }

    res.json({
      status: 'success',
      data: {
        modifications: booking.modifications || []
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/modification-requests/{requestId}/review:
 *   patch:
 *     summary: Review (approve/reject) a booking modification request
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Modification Request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *               reviewNotes:
 *                 type: string
 *               approvedChanges:
 *                 type: object
 *     responses:
 *       200:
 *         description: Modification request reviewed successfully
 */
router.patch('/:id/modification-requests/:requestId/review',
  authenticate,
  authorize(['admin', 'staff', 'manager']),
  catchAsync(async (req, res) => {
    const { action, reviewNotes, approvedChanges } = req.body;
    const { id: bookingId, requestId } = req.params;

    const booking = await Booking.findById(bookingId).populate('userId hotelId');
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    const modificationRequest = booking.modifications.find(
      mod => mod.modificationId === requestId
    );

    if (!modificationRequest) {
      throw new ApplicationError('Modification request not found', 404);
    }

    // For now, we'll track status in the reason field since the schema doesn't have a status field
    if (modificationRequest.reason && modificationRequest.reason.includes('REVIEWED:')) {
      throw new ApplicationError('Modification request has already been reviewed', 400);
    }

    // Update modification request
    modificationRequest.reason = `${modificationRequest.reason || ''} REVIEWED: ${action.toUpperCase()} by ${req.user.name}. ${reviewNotes || ''}`.trim();

    if (action === 'approve' && approvedChanges) {
      modificationRequest.approvedChanges = approvedChanges;

      // Apply approved changes to booking
      if (approvedChanges.checkIn) booking.checkIn = new Date(approvedChanges.checkIn);
      if (approvedChanges.checkOut) booking.checkOut = new Date(approvedChanges.checkOut);
      if (approvedChanges.totalAmount) booking.totalAmount = approvedChanges.totalAmount;
      if (approvedChanges.guestDetails) {
        booking.guestDetails = { ...booking.guestDetails, ...approvedChanges.guestDetails };
      }

      // Add status history entry
      booking.statusHistory.push({
        status: booking.status,
        timestamp: new Date(),
        changedBy: {
          source: 'staff',
          userId: req.user._id,
          userName: req.user.name
        },
        reason: `Booking modified: ${modificationRequest.modificationType}`,
        automaticTransition: false,
        validatedTransition: true
      });
    }

    await booking.save();

    // Notify guest about decision
    try {
      if (websocketService) {
        const notificationData = {
          type: 'booking_modification_reviewed',
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          modificationType: modificationRequest.modificationType,
          status: modificationRequest.status,
          reviewNotes,
          reviewedBy: req.user.name,
          hotelId: booking.hotelId._id
        };

        // Notify the guest
        await websocketService.notifyUser(booking.userId._id, 'booking:modification_reviewed', notificationData);
      }
    } catch (wsError) {
      console.error('WebSocket notification failed:', wsError);
    }

    res.json({
      status: 'success',
      data: {
        modificationRequest,
        message: `Modification request ${action}d successfully`
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/check-in:
 *   patch:
 *     summary: Check-in a guest
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentDetails:
 *                 type: object
 *                 properties:
 *                   paymentMethods:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         method:
 *                           type: string
 *                           enum: [cash, card, upi, online_portal, corporate]
 *                         amount:
 *                           type: number
 *                         reference:
 *                           type: string
 *                         notes:
 *                           type: string
 *     responses:
 *       200:
 *         description: Guest checked in successfully
 */
router.patch('/:id/check-in', 
  authenticate, 
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check permissions
    if (req.user.role === 'staff' && booking.hotelId.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('You do not have permission to check-in this booking', 403);
    }

    // Validate booking status
    if (booking.status !== 'confirmed') {
      throw new ApplicationError('Only confirmed bookings can be checked in', 400);
    }

    const { paymentDetails } = req.body;

    // Update booking with check-in information
    const updateData = {
      status: 'checked_in',
      checkInTime: new Date(), // Auto-update check-in time
      lastStatusChange: {
        from: booking.status,
        to: 'checked_in',
        timestamp: new Date(),
        reason: 'Guest checked in'
      }
    };

    // Add payment details if provided
    if (paymentDetails && paymentDetails.paymentMethods) {
      updateData.paymentDetails = {
        ...paymentDetails,
        collectedAt: new Date(),
        collectedBy: req.user._id
      };
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'rooms.roomId', select: 'roomNumber type baseRate currentRate' },
      { path: 'userId', select: 'name email phone' },
      { path: 'hotelId', select: 'name address contact' }
    ]);

    // Add to status history
    updatedBooking.statusHistory.push({
      status: 'checked_in',
      timestamp: new Date(),
      changedBy: {
        source: 'admin',
        userId: req.user._id.toString(),
        userName: req.user.name
      },
      reason: 'Guest checked in',
      automaticTransition: false,
      validatedTransition: true
    });

    await updatedBooking.save();

    res.json({
      status: 'success',
      data: {
        booking: updatedBooking,
        message: 'Guest checked in successfully'
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/check-out:
 *   patch:
 *     summary: Check-out a guest
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Guest checked out successfully
 */
router.patch('/:id/check-out', 
  authenticate, 
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check permissions
    if (req.user.role === 'staff' && booking.hotelId.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('You do not have permission to check-out this booking', 403);
    }

    // Validate booking status
    if (booking.status !== 'checked_in') {
      throw new ApplicationError('Only checked-in bookings can be checked out', 400);
    }

    // Update booking with check-out information
    const updateData = {
      status: 'checked_out',
      checkOutTime: new Date(), // Auto-update check-out time
      lastStatusChange: {
        from: booking.status,
        to: 'checked_out',
        timestamp: new Date(),
        reason: 'Guest checked out'
      }
    };

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'rooms.roomId', select: 'roomNumber type baseRate currentRate' },
      { path: 'userId', select: 'name email phone' },
      { path: 'hotelId', select: 'name address contact' }
    ]);

    // Add to status history
    updatedBooking.statusHistory.push({
      status: 'checked_out',
      timestamp: new Date(),
      changedBy: {
        source: 'admin',
        userId: req.user._id.toString(),
        userName: req.user.name
      },
      reason: 'Guest checked out',
      automaticTransition: false,
      validatedTransition: true
    });

    await updatedBooking.save();

    res.json({
      status: 'success',
      data: {
        booking: updatedBooking,
        message: 'Guest checked out successfully'
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/extra-persons:
 *   post:
 *     summary: Add extra person to booking (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 description: Person's name
 *               type:
 *                 type: string
 *                 enum: [adult, child]
 *                 description: Person type
 *               age:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 120
 *                 description: Age (required for children)
 *               autoCalculateCharges:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to automatically calculate charges
 *     responses:
 *       200:
 *         description: Extra person added successfully
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.post('/:id/extra-persons',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, type, age, autoCalculateCharges = true } = req.body;

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check if booking belongs to user's hotel
    if (booking.hotelId.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('Booking not found in your hotel', 404);
    }

    // User context for RBAC
    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    // Add extra person
    const extraPerson = await booking.addExtraPerson({ name, type, age }, userContext);

    // Auto-calculate charges if requested
    if (autoCalculateCharges) {
      await booking.calculateExtraPersonCharges();
    }

    // Save booking
    await booking.save();

    // Populate booking details for response
    await booking.populate('userId', 'name email');
    await booking.populate('rooms.roomId', 'roomNumber roomType');

    res.json({
      status: 'success',
      data: {
        extraPerson,
        booking,
        message: `${type} ${name} added to booking successfully`
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/extra-persons/{personId}:
 *   delete:
 *     summary: Remove extra person from booking (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: path
 *         name: personId
 *         required: true
 *         schema:
 *           type: string
 *         description: Extra person ID
 *     responses:
 *       200:
 *         description: Extra person removed successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking or person not found
 */
router.delete('/:id/extra-persons/:personId',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const { id, personId } = req.params;

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check if booking belongs to user's hotel
    if (booking.hotelId.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('Booking not found in your hotel', 404);
    }

    // User context for RBAC
    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    // Remove extra person
    const removedPerson = await booking.removeExtraPerson(personId, userContext);

    // Recalculate charges
    await booking.calculateExtraPersonCharges();

    // Save booking
    await booking.save();

    res.json({
      status: 'success',
      data: {
        removedPerson,
        message: `${removedPerson.type} ${removedPerson.name} removed from booking successfully`
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/extra-persons/calculate-charges:
 *   post:
 *     summary: Calculate charges for extra persons (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Extra person charges calculated successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.post('/:id/extra-persons/calculate-charges',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check if booking belongs to user's hotel
    if (booking.hotelId.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('Booking not found in your hotel', 404);
    }

    // Calculate charges
    const chargeResult = await booking.calculateExtraPersonCharges();

    // Save booking
    await booking.save();

    // Populate the updated booking to get complete data
    await booking.populate([
      { path: 'userId', select: 'name email phone' },
      { path: 'rooms.roomId', select: 'roomNumber type baseRate' }
    ]);

    res.json({
      status: 'success',
      data: {
        chargeBreakdown: chargeResult.chargeBreakdown,
        totalExtraCharge: chargeResult.totalExtraCharge,
        currency: chargeResult.currency,
        updatedTotalAmount: booking.calculateTotalAmount(),
        booking: booking, // Include the full updated booking
        extraPersonCharges: booking.extraPersonCharges, // Include updated charges with payment status
        message: 'Extra person charges calculated successfully'
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/extra-persons/payment:
 *   post:
 *     summary: Process multi-payment for extra person charges (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMethods:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     method:
 *                       type: string
 *                       enum: [cash, upi, stripe]
 *                     amount:
 *                       type: number
 *                     reference:
 *                       type: string
 *                     notes:
 *                       type: string
 *               extraPersonCharges:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     personId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     description:
 *                       type: string
 *               totalAmount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.post('/:id/extra-persons/payment',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { paymentMethods, extraPersonCharges, totalAmount } = req.body;

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check if booking belongs to user's hotel
    if (booking.hotelId.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('Booking not found in your hotel', 404);
    }

    // Validate payment methods
    if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
      throw new ApplicationError('Payment methods are required', 400);
    }

    // Calculate total paid amount
    const totalPaid = paymentMethods.reduce((sum, payment) => sum + (payment.amount || 0), 0);

    if (totalPaid <= 0) {
      throw new ApplicationError('Total payment amount must be greater than 0', 400);
    }

    try {
      // Process each payment method
      const processedPayments = paymentMethods.map(payment => ({
        method: payment.method,
        amount: payment.amount,
        reference: payment.reference || `${payment.method}-${Date.now()}`,
        processedBy: req.user._id,
        processedAt: new Date(),
        notes: payment.notes || `${payment.method.toUpperCase()} payment for extra person charges`
      }));

      // Update booking with payment information
      if (!booking.paymentMethods) {
        booking.paymentMethods = [];
      }

      // Add the new payment methods
      booking.paymentMethods.push(...processedPayments);

      // Update total paid amount
      const previousTotalPaid = booking.totalPaid || 0;
      booking.totalPaid = previousTotalPaid + totalPaid;

      // Update payment status
      const bookingTotalAmount = booking.calculateTotalAmount();
      if (booking.totalPaid >= bookingTotalAmount) {
        booking.paymentStatus = 'paid';
        booking.remainingAmount = 0;
      } else if (booking.totalPaid > 0) {
        booking.paymentStatus = 'partially_paid';
        booking.remainingAmount = bookingTotalAmount - booking.totalPaid;
      }

      // Mark extra person charges as paid
      if (booking.extraPersonCharges && booking.extraPersonCharges.length > 0) {
        booking.extraPersonCharges.forEach(charge => {
          // Find corresponding charge in the request
          const requestCharge = extraPersonCharges.find(reqCharge =>
            reqCharge.personId === charge.personId
          );

          if (requestCharge) {
            charge.paidAmount = (charge.paidAmount || 0) + requestCharge.amount;
            charge.isPaid = charge.paidAmount >= charge.totalCharge;
            if (charge.isPaid && !charge.paidAt) {
              charge.paidAt = new Date();
            }
          }
        });
      }

      // Add payment record to history
      if (!booking.paymentHistory) {
        booking.paymentHistory = [];
      }

      booking.paymentHistory.push({
        type: 'extra_person_charges',
        amount: totalPaid,
        paymentMethods: processedPayments,
        processedBy: req.user._id,
        processedAt: new Date(),
        description: 'Payment for extra person charges',
        extraPersonCharges: extraPersonCharges
      });

      // Save booking
      await booking.save();

      // Populate booking details for response
      await booking.populate('userId', 'name email');
      await booking.populate('rooms.roomId', 'roomNumber roomType');

      res.json({
        status: 'success',
        data: {
          booking,
          paymentSummary: {
            totalPaid,
            paymentMethods: processedPayments,
            updatedBookingTotal: bookingTotalAmount,
            updatedTotalPaid: booking.totalPaid,
            remainingAmount: booking.remainingAmount,
            paymentStatus: booking.paymentStatus
          },
          message: 'Extra person charges payment processed successfully'
        }
      });

    } catch (error) {
      console.error('Error processing extra person charges payment:', error);
      throw new ApplicationError('Failed to process payment', 500);
    }
  })
);

/**
 * @swagger
 * /bookings/{id}/settlement:
 *   get:
 *     summary: Get booking settlement details (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Settlement details retrieved successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.get('/:id/settlement',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check if booking belongs to user's hotel
    if (booking.hotelId.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('Booking not found in your hotel', 404);
    }

    // Calculate settlement if not exists
    const settlement = booking.calculateSettlement();

    res.json({
      status: 'success',
      data: {
        settlement,
        bookingDetails: {
          bookingNumber: booking.bookingNumber,
          guestName: booking.userId ? booking.userId.name : 'N/A',
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          status: booking.status
        }
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/settlement/adjustment:
 *   post:
 *     summary: Add settlement adjustment (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - amount
 *               - description
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [extra_person_charge, damage_charge, minibar_charge, service_charge, discount, refund, penalty, other]
 *                 description: Type of adjustment
 *               amount:
 *                 type: number
 *                 description: Adjustment amount (positive for charges, negative for credits)
 *               description:
 *                 type: string
 *                 description: Detailed description of the adjustment
 *     responses:
 *       200:
 *         description: Settlement adjustment added successfully
 *       400:
 *         description: Invalid adjustment data
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.post('/:id/settlement/adjustment',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { type, amount, description } = req.body;

    // Validate input
    if (!type || amount === undefined || !description) {
      throw new ApplicationError('Type, amount, and description are required', 400);
    }

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check if booking belongs to user's hotel
    if (booking.hotelId.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('Booking not found in your hotel', 404);
    }

    // User context for RBAC
    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    // Add settlement adjustment
    const adjustment = booking.addSettlementAdjustment({ type, amount, description }, userContext);

    // Save booking
    await booking.save();

    res.json({
      status: 'success',
      data: {
        adjustment,
        updatedSettlement: booking.settlementTracking,
        message: 'Settlement adjustment added successfully'
      }
    });
  })
);


/**
 * @swagger
 * /bookings/{id}/settlement/payment:
 *   post:
 *     summary: Process settlement payment (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethods
 *               - amount
 *             properties:
 *               paymentMethods:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     method:
 *                       type: string
 *                       enum: [cash, upi, stripe, bank_transfer]
 *                     amount:
 *                       type: number
 *                     reference:
 *                       type: string
 *                     notes:
 *                       type: string
 *               amount:
 *                 type: number
 *                 description: Total settlement amount
 *     responses:
 *       200:
 *         description: Settlement payment processed successfully
 *       400:
 *         description: Invalid payment data
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.post('/:id/settlement/payment',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const { paymentMethods, amount } = req.body;
    const { id } = req.params;

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check if booking belongs to user's hotel
    if (booking.hotelId.toString() !== req.user.hotelId.toString()) {
      throw new ApplicationError('Booking not found in your hotel', 404);
    }

    // Validate payment methods
    if (!paymentMethods || paymentMethods.length === 0) {
      throw new ApplicationError('At least one payment method is required', 400);
    }

    const totalPaid = paymentMethods.reduce((sum, payment) => sum + payment.amount, 0);
    if (Math.abs(totalPaid - amount) > 0.01) {
      throw new ApplicationError('Payment amounts do not match total', 400);
    }

    // Process payments
    const processedPayments = paymentMethods.map(payment => ({
      method: payment.method,
      amount: payment.amount,
      reference: payment.reference || `${payment.method}-${Date.now()}`,
      processedBy: req.user._id,
      processedAt: new Date(),
      notes: payment.notes || `Settlement payment via ${payment.method}`
    }));

    // Initialize settlement tracking if not exists
    if (!booking.settlementTracking) {
      booking.settlementTracking = {
        status: 'pending',
        finalAmount: 0,
        outstandingBalance: 0,
        refundAmount: 0,
        adjustments: [],
        settlementHistory: []
      };
    }

    // Add payment to settlement history
    booking.settlementTracking.settlementHistory.push({
      action: 'payment_received',
      amount: totalPaid,
      paymentMethods: processedPayments,
      processedBy: req.user._id,
      processedAt: new Date(),
      description: 'Settlement payment received',
      reference: processedPayments.map(p => p.reference).join(', ')
    });

    // Update outstanding balance
    const previousBalance = booking.settlementTracking.outstandingBalance || 0;
    booking.settlementTracking.outstandingBalance = Math.max(0, previousBalance - totalPaid);

    // Update settlement status
    if (booking.settlementTracking.outstandingBalance === 0) {
      booking.settlementTracking.status = 'completed';
    } else {
      booking.settlementTracking.status = 'partial';
    }

    // Add to booking payment history
    if (!booking.paymentHistory) {
      booking.paymentHistory = [];
    }

    booking.paymentHistory.push({
      type: 'settlement',
      amount: totalPaid,
      paymentMethods: processedPayments,
      processedBy: req.user._id,
      processedAt: new Date(),
      description: 'Settlement payment',
      settlementDetails: {
        previousBalance: previousBalance,
        paidAmount: totalPaid,
        remainingBalance: booking.settlementTracking.outstandingBalance
      }
    });

    // Save booking
    await booking.save();

    // Populate booking details for response
    await booking.populate([
      { path: 'userId', select: 'name email phone' },
      { path: 'rooms.roomId', select: 'roomNumber type' }
    ]);

    res.json({
      status: 'success',
      data: {
        booking: booking,
        settlementTracking: booking.settlementTracking,
        paymentSummary: {
          totalPaid: totalPaid,
          previousBalance: previousBalance,
          remainingBalance: booking.settlementTracking.outstandingBalance,
          paymentMethods: processedPayments
        },
        message: 'Settlement payment processed successfully'
      }
    });
  })
);

export default router;