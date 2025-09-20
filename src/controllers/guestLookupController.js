import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import mongoose from 'mongoose';

// Get guest by room number
export const getGuestByRoom = catchAsync(async (req, res) => {
  const { roomNumber } = req.params;
  const { hotelId } = req.query;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Check if user has access to this hotel
  if (req.user.role === 'staff' && req.user.hotelId.toString() !== hotelId) {
    throw new ApplicationError('You can only lookup guests for your hotel', 403);
  }

  // Find the room
  const room = await Room.findOne({
    roomNumber,
    hotelId,
    isActive: true
  });

  if (!room) {
    throw new ApplicationError('Room not found or not active', 404);
  }

  // Find active booking for this room
  const currentDate = new Date();
  const activeBooking = await Booking.findOne({
    'rooms.roomId': room._id,
    status: { $in: ['confirmed', 'checked_in'] },
    checkIn: { $lte: currentDate },
    checkOut: { $gte: currentDate }
  }).populate('userId', 'name email phone');

  if (!activeBooking) {
    throw new ApplicationError('No active booking found for this room', 404);
  }

  // Get guest details
  const guest = activeBooking.userId;

  res.json({
    status: 'success',
    data: {
      guest: {
        id: guest._id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone
      },
      booking: {
        id: activeBooking._id,
        bookingNumber: activeBooking.bookingNumber,
        checkIn: activeBooking.checkIn,
        checkOut: activeBooking.checkOut,
        status: activeBooking.status
      },
      room: {
        id: room._id,
        roomNumber: room.roomNumber,
        type: room.type
      }
    }
  });
});

// Get guest by booking ID
export const getGuestByBooking = catchAsync(async (req, res) => {
  const { bookingId } = req.params;

  // Find the booking
  const booking = await Booking.findById(bookingId)
    .populate('userId', 'name email phone')
    .populate('rooms.roomId', 'roomNumber type')
    .populate('hotelId', 'name');

  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }

  // Check if user has access to this booking
  if (req.user.role === 'staff' && req.user.hotelId.toString() !== booking.hotelId.toString()) {
    throw new ApplicationError('You can only lookup guests for your hotel', 403);
  }

  if (req.user.role === 'guest' && req.user._id.toString() !== booking.userId._id.toString()) {
    throw new ApplicationError('You can only lookup your own bookings', 403);
  }

  // Get guest details
  const guest = booking.userId;

  res.json({
    status: 'success',
    data: {
      guest: {
        id: guest._id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone
      },
      booking: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        status: booking.status,
        totalAmount: booking.totalAmount,
        currency: booking.currency
      },
      rooms: booking.rooms.map(room => ({
        id: room.roomId._id,
        roomNumber: room.roomId.roomNumber,
        type: room.roomId.type,
        rate: room.rate
      })),
      hotel: {
        id: booking.hotelId._id,
        name: booking.hotelId.name
      }
    }
  });
});

// Search guests by name or email
export const searchGuests = catchAsync(async (req, res) => {
  const { query, hotelId, page = 1, limit = 20 } = req.query;

  if (!query || !hotelId) {
    throw new ApplicationError('Search query and hotel ID are required', 400);
  }

  // Check if user has access to this hotel
  if (req.user.role === 'staff' && req.user.hotelId.toString() !== hotelId) {
    throw new ApplicationError('You can only search guests for your hotel', 403);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Search in users collection
  const userQuery = {
    hotelId,
    role: 'guest',
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { email: { $regex: query, $options: 'i' } }
    ]
  };

  const guests = await User.find(userQuery)
    .select('name email phone createdAt')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(userQuery);

  res.json({
    status: 'success',
    results: guests.length,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    },
    data: guests
  });
});

// Get guest's active bookings
export const getGuestActiveBookings = catchAsync(async (req, res) => {
  const { guestId } = req.params;
  const { hotelId } = req.query;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Check if user has access to this hotel
  if (req.user.role === 'staff' && req.user.hotelId.toString() !== hotelId) {
    throw new ApplicationError('You can only access guest data for your hotel', 403);
  }

  if (req.user.role === 'guest' && req.user._id.toString() !== guestId) {
    throw new ApplicationError('You can only access your own data', 403);
  }

  // Find active bookings for the guest
  const currentDate = new Date();
  const activeBookings = await Booking.find({
    userId: guestId,
    hotelId,
    status: { $in: ['confirmed', 'checked_in'] },
    checkOut: { $gte: currentDate }
  }).populate('rooms.roomId', 'roomNumber type');

  res.json({
    status: 'success',
    results: activeBookings.length,
    data: activeBookings
  });
});

// Get guest's billing history
export const getGuestBillingHistory = catchAsync(async (req, res) => {
  const { guestId } = req.params;
  const { hotelId, page = 1, limit = 20 } = req.query;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Check if user has access to this hotel
  if (req.user.role === 'staff' && req.user.hotelId.toString() !== hotelId) {
    throw new ApplicationError('You can only access guest data for your hotel', 403);
  }

  if (req.user.role === 'guest' && req.user._id.toString() !== guestId) {
    throw new ApplicationError('You can only access your own data', 403);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Find billing history for the guest
  const BillingSession = mongoose.model('BillingSession');
  const billingHistory = await BillingSession.find({
    hotelId,
    $or: [
      { guestId },
      { 'items.guestId': guestId }
    ]
  })
  .populate('hotelId', 'name')
  .populate('bookingId', 'bookingNumber')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(parseInt(limit));

  const total = await BillingSession.countDocuments({
    hotelId,
    $or: [
      { guestId },
      { 'items.guestId': guestId }
    ]
  });

  res.json({
    status: 'success',
    results: billingHistory.length,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    },
    data: billingHistory
  });
});

export default {
  getGuestByRoom,
  getGuestByBooking,
  searchGuests,
  getGuestActiveBookings,
  getGuestBillingHistory
};
