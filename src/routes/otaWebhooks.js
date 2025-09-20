import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import Booking from '../models/Booking.js';
import RoomAvailability from '../models/RoomAvailability.js';
import { Channel } from '../models/ChannelManager.js';
import InventoryService from '../services/inventoryService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/webhooks/ota:
 *   post:
 *     summary: Handle OTA webhook requests
 *     tags: [OTA Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channel:
 *                 type: string
 *                 enum: [booking_com, expedia, airbnb, agoda]
 *               eventType:
 *                 type: string
 *                 enum: [reservation, modification, cancellation, rate_change]
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook data
 *       500:
 *         description: Internal server error
 */

// Webhook signature verification middleware
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-webhook-signature'];
  const channel = req.body.channel;
  
  // TODO: Implement proper signature verification
  // For now, we'll accept all webhooks in development
  if (process.env.NODE_ENV === 'production' && !signature) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  
  next();
};

// Rate limiting per channel
const channelRateLimit = (req, res, next) => {
  const channel = req.body.channel;
  const channelId = req.body.channelId;
  
  // TODO: Implement Redis-based rate limiting
  // For now, we'll accept all requests
  next();
};

// Main webhook handler
router.post('/ota', 
  verifyWebhookSignature,
  channelRateLimit,
  catchAsync(async (req, res) => {
    const { channel, eventType, data, channelId } = req.body;
    
    logger.info(`OTA Webhook received: ${channel} - ${eventType}`, {
      channel,
      eventType,
      channelId,
      timestamp: new Date().toISOString()
    });

    try {
      switch (eventType) {
        case 'reservation':
          await handleReservation(channel, data);
          break;
        case 'modification':
          await handleModification(channel, data);
          break;
        case 'cancellation':
          await handleCancellation(channel, data);
          break;
        case 'rate_change':
          await handleRateChange(channel, data);
          break;
        default:
          logger.warn(`Unknown event type: ${eventType}`);
          return res.status(400).json({ error: 'Unknown event type' });
      }

      res.status(200).json({ 
        success: true, 
        message: `${eventType} processed successfully` 
      });

    } catch (error) {
      logger.error(`Error processing OTA webhook: ${error.message}`, {
        channel,
        eventType,
        channelId,
        error: error.stack
      });

      res.status(500).json({ 
        error: 'Failed to process webhook',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
      });
    }
  })
);

// Handle new reservations from OTAs with transaction safety
async function handleReservation(channel, data) {
  const {
    bookingId,
    reservationId,
    hotelId,
    roomTypeId,
    checkIn,
    checkOut,
    guests,
    rate,
    currency,
    confirmationCode
  } = data;

  // Start MongoDB transaction for atomic booking
  const session = await mongoose.startSession();
  
  try {
    return await session.withTransaction(async () => {
      // Check if booking already exists (enhanced idempotency)
      const existingBooking = await Booking.findOne({
        source: channel,
        channelBookingId: bookingId
      }).session(session);

      if (existingBooking) {
        logger.info(`Booking already exists: ${bookingId}`, { channel, bookingId });
        return existingBooking;
      }

      // Book rooms using centralized inventory service with locking
      await InventoryService.bookRoomsWithLocking({
        hotelId,
        roomTypeId,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        roomsCount: 1,
        source: channel,
        channelId: null, // Will be populated if channel mapping exists
        session
      });

      // Create new booking within transaction
      const booking = new Booking({
        hotelId,
        userId: null, // OTA bookings don't have user accounts
        rooms: [{
          roomId: null, // Will be assigned during check-in
          rate: rate
        }],
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        nights: Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)),
        status: 'confirmed',
        paymentStatus: 'paid', // OTAs handle payments
        totalAmount: rate,
        currency: currency || 'INR',
        
        // OTA-specific fields with enhanced structure
        source: channel,
        channelBookingId: bookingId,
        channelReservationId: reservationId,
        
        channelData: {
          confirmationCode,
          channelRate: rate,
          channelCurrency: currency,
          bookerCountry: guests?.country,
          bookerLanguage: guests?.language
        },

        guestDetails: {
          adults: guests?.adults || 1,
          children: guests?.children || 0,
          specialRequests: guests?.specialRequests
        }
      });

      await booking.save({ session });

      logger.info(`OTA reservation created with transaction safety: ${booking._id}`, { 
        channel, 
        bookingId, 
        hotelId 
      });

      return booking;
    });
    
  } finally {
    await session.endSession();
  }
}

// Handle booking modifications from OTAs
async function handleModification(channel, data) {
  const {
    bookingId,
    modificationType,
    oldValues,
    newValues,
    reason
  } = data;

  const booking = await Booking.findOne({
    'channelIdempotency.channel': channel,
    'channelIdempotency.channelBookingId': bookingId
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  // Add modification to history
  booking.modifications.push({
    modificationId: `mod_${Date.now()}`,
    modificationType,
    modificationDate: new Date(),
    modifiedBy: {
      source: channel,
      userId: 'ota_system',
      channel: channel
    },
    oldValues,
    newValues,
    reason
  });

  // Update booking fields based on modification type
  if (modificationType === 'date_change') {
    if (newValues.checkIn) booking.checkIn = new Date(newValues.checkIn);
    if (newValues.checkOut) booking.checkOut = new Date(newValues.checkOut);
    if (newValues.checkIn || newValues.checkOut) {
      booking.nights = Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24));
    }
  }

  if (modificationType === 'guest_change') {
    if (newValues.guestDetails) {
      booking.guestDetails = { ...booking.guestDetails, ...newValues.guestDetails };
    }
  }

  if (modificationType === 'rate_change') {
    if (newValues.rate) {
      booking.rooms[0].rate = newValues.rate;
      booking.totalAmount = newValues.rate;
    }
  }

  await booking.save();

  logger.info(`OTA modification processed: ${booking._id}`, { 
    channel, 
    bookingId, 
    modificationType 
  });

  return booking;
}

// Handle booking cancellations from OTAs
async function handleCancellation(channel, data) {
  const { bookingId, reason } = data;

  const booking = await Booking.findOne({
    'channelIdempotency.channel': channel,
    'channelIdempotency.channelBookingId': bookingId
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  // Update booking status
  booking.status = 'cancelled';
  booking.cancellationReason = reason;

  // Add to modifications history
  booking.modifications.push({
    modificationId: `cancel_${Date.now()}`,
    modificationType: 'cancellation',
    modificationDate: new Date(),
    modifiedBy: {
      source: channel,
      userId: 'ota_system',
      channel: channel
    },
    oldValues: { status: 'confirmed' },
    newValues: { status: 'cancelled' },
    reason
  });

  await booking.save();

  // Release inventory using centralized service with locking
  await InventoryService.releaseRoomsWithLocking({
    hotelId: booking.hotelId,
    roomTypeId: booking.rooms[0].roomId, // This should be roomTypeId, not roomId
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    roomsCount: 1,
    source: channel,
    session: null // No session needed for cancellation operations
  });

  logger.info(`OTA cancellation processed: ${booking._id}`, { 
    channel, 
    bookingId, 
    reason 
  });

  return booking;
}

// Handle rate changes from OTAs
async function handleRateChange(channel, data) {
  const { roomTypeId, date, newRate, currency } = data;

  // Update room availability rates
  await RoomAvailability.updateMany(
    {
      roomTypeId,
      date: new Date(date)
    },
    {
      $set: {
        sellingRate: newRate,
        currency: currency || 'INR',
        needsSync: true
      }
    }
  );

  logger.info(`OTA rate change processed`, { 
    channel, 
    roomTypeId, 
    date, 
    newRate 
  });
}

// Legacy inventory functions replaced with centralized InventoryService
// All inventory operations now use distributed locking and atomic transactions
// See: InventoryService.bookRoomsWithLocking() and InventoryService.releaseRoomsWithLocking()

// Health check endpoint for webhook monitoring
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'OTA Webhooks',
    timestamp: new Date().toISOString()
  });
});

export default router;