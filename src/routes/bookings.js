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
  if (req.user.role === 'guest' && booking.userId.toString() !== req.user._id.toString()) {
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
      roomType // Add roomType field for room-type bookings
    } = req.body;

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
          roomType // Add roomType for room-type preference bookings
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

// Change room by finding booking via guest details (for drag & drop in tape chart)
router.post('/change-room-by-guest', 
  authenticate, 
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    console.log('🚀 BACKEND DEBUG - Request body:', req.body);
    console.log('🚀 BACKEND DEBUG - User info:', req.user);
    
    const { guestName, checkIn, checkOut, newRoomId, newRoomNumber, reason } = req.body;
    
    console.log('🚀 BACKEND DEBUG - Extracted data:', {
      guestName,
      checkIn,
      checkOut,
      newRoomId,
      newRoomNumber,
      reason
    });
    
    // Find booking by guest name and dates
    // First, find the user by name
    const user = await User.findOne({ 
      name: { $regex: new RegExp(guestName, 'i') } 
    });
    
    if (!user) {
      console.log('🚀 BACKEND DEBUG - No user found with name:', guestName);
      throw new ApplicationError(`Guest not found: ${guestName}`, 404);
    }
    
    console.log('🚀 BACKEND DEBUG - Found user:', user.name, user._id);
    
    // Then find the booking by userId and dates
    const searchQuery = {
      userId: user._id,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut)
    };
    
    console.log('🚀 BACKEND DEBUG - Search query:', searchQuery);
    
    const booking = await Booking.findOne(searchQuery);
    
    console.log('🚀 BACKEND DEBUG - Found booking:', booking);
    
    if (!booking) {
      console.log('🚀 BACKEND DEBUG - No booking found for search query');
      throw new ApplicationError(`Booking not found for ${guestName} (${checkIn} to ${checkOut})`, 404);
    }

    console.log('🚀 BACKEND DEBUG - Booking rooms:', booking.rooms);
    console.log('🚀 BACKEND DEBUG - Booking rooms length:', booking.rooms?.length);
    console.log('🚀 BACKEND DEBUG - Booking status:', booking.status);

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

    // Handle bookings without rooms (new bookings) or with existing rooms
    if (booking.rooms && booking.rooms.length > 0) {
      // Update existing room
      console.log('🚀 BACKEND DEBUG - Updating existing room from:', booking.rooms[0].roomId, 'to:', newRoomId);
      booking.rooms[0].roomId = new mongoose.Types.ObjectId(newRoomId);
    } else {
      // Add new room to booking
      console.log('🚀 BACKEND DEBUG - Adding new room to booking:', newRoomId);
      booking.rooms = [{
        roomId: new mongoose.Types.ObjectId(newRoomId),
        rate: 0 // Will be updated when room is confirmed
      }];
    }

    // Add a note about the room assignment/change
    if (!booking.notes) booking.notes = [];
    booking.notes.push(`Room assigned/changed to ${newRoomNumber} on ${new Date().toISOString()} by ${req.user.name}. Reason: ${reason}`);
    
    console.log('🚀 BACKEND DEBUG - Saving booking with updated room...');
    await booking.save();
    
    console.log('🚀 BACKEND DEBUG - Booking saved successfully');
    
    res.json({
      success: true,
      data: {
        booking,
        message: `${guestName}'s room assigned to ${newRoomNumber} successfully`
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

export default router;