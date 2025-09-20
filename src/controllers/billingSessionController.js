import BillingSession from '../models/BillingSession.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { v4 as uuidv4 } from 'uuid';

// Create a new billing session
export const createBillingSession = catchAsync(async (req, res) => {
  const {
    guestName,
    roomNumber,
    bookingId,
    bookingNumber,
    hotelId
  } = req.body;

  // Validate required fields
  if (!guestName || !roomNumber || !hotelId) {
    throw new ApplicationError('Guest name, room number, and hotel ID are required', 400);
  }

  // Check if user has access to this hotel
  if (req.user.role === 'staff' && req.user.hotelId.toString() !== hotelId) {
    throw new ApplicationError('You can only create billing sessions for your hotel', 403);
  }

  // Check if there's already an active session for this room
  const existingSession = await BillingSession.findOne({
    roomNumber,
    hotelId,
    status: { $in: ['draft', 'room_charged'] }
  });

  if (existingSession) {
    throw new ApplicationError('There is already an active billing session for this room', 409);
  }

  // If bookingNumber is provided, try to find the actual booking to get the ObjectId
  let actualBookingId = bookingId;
  if (bookingNumber && !bookingId) {
    try {
      const booking = await Booking.findOne({ bookingNumber });
      if (booking) {
        actualBookingId = booking._id;
      }
    } catch (error) {
      console.log('Could not find booking by number:', bookingNumber);
    }
  }

  // Create new session
  const sessionData = {
    sessionId: `BS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    hotelId,
    guestName,
    roomNumber,
    bookingId: actualBookingId,
    bookingNumber,
    createdBy: req.user._id
  };

  const billingSession = await BillingSession.create(sessionData);

  res.status(201).json({
    status: 'success',
    data: { billingSession }
  });
});

// Get billing session by ID
export const getBillingSession = catchAsync(async (req, res) => {
  const { id } = req.params;

  const billingSession = await BillingSession.findById(id)
    .populate('hotelId', 'name')
    .populate('bookingId', 'bookingNumber checkIn checkOut')
    .populate('createdBy', 'name');

  if (!billingSession) {
    throw new ApplicationError('Billing session not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && billingSession.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only access billing sessions for your hotel', 403);
  }

  res.json({
    status: 'success',
    data: { billingSession }
  });
});

// Update billing session
export const updateBillingSession = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const billingSession = await BillingSession.findById(id);

  if (!billingSession) {
    throw new ApplicationError('Billing session not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && billingSession.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only update billing sessions for your hotel', 403);
  }

  // Prevent updates to completed sessions
  if (billingSession.status === 'paid' || billingSession.status === 'void') {
    throw new ApplicationError('Cannot update completed billing sessions', 400);
  }

  // Update session
  Object.keys(updateData).forEach(key => {
    if (key !== 'sessionId' && key !== 'hotelId') {
      billingSession[key] = updateData[key];
    }
  });

  // Recalculate totals if items changed
  if (updateData.items) {
    billingSession.calculateTotals();
  }

  await billingSession.save();

  res.json({
    status: 'success',
    data: { billingSession }
  });
});

// Delete billing session
export const deleteBillingSession = catchAsync(async (req, res) => {
  const { id } = req.params;

  const billingSession = await BillingSession.findById(id);

  if (!billingSession) {
    throw new ApplicationError('Billing session not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && billingSession.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only delete billing sessions for your hotel', 403);
  }

  // Only allow deletion of draft sessions
  if (billingSession.status !== 'draft') {
    throw new ApplicationError('Only draft billing sessions can be deleted', 400);
  }

  await BillingSession.findByIdAndDelete(id);

  res.json({
    status: 'success',
    message: 'Billing session deleted successfully'
  });
});

// Add item to billing session
export const addItemToSession = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { item } = req.body;

  if (!item || !item.id || !item.name || !item.price || !item.outlet) {
    throw new ApplicationError('Item details are incomplete', 400);
  }

  const billingSession = await BillingSession.findById(id);

  if (!billingSession) {
    throw new ApplicationError('Billing session not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && billingSession.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only modify billing sessions for your hotel', 403);
  }

  // Check if session is editable
  if (billingSession.status !== 'draft') {
    throw new ApplicationError('Cannot add items to completed billing sessions', 400);
  }

  // Add item to session
  billingSession.addItem(item);
  await billingSession.save();

  res.json({
    status: 'success',
    data: { billingSession }
  });
});

// Update item quantity in session
export const updateItemInSession = catchAsync(async (req, res) => {
  const { id, itemId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    throw new ApplicationError('Valid quantity is required', 400);
  }

  const billingSession = await BillingSession.findById(id);

  if (!billingSession) {
    throw new ApplicationError('Billing session not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && billingSession.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only modify billing sessions for your hotel', 403);
  }

  // Check if session is editable
  if (billingSession.status !== 'draft') {
    throw new ApplicationError('Cannot modify completed billing sessions', 400);
  }

  // Update item quantity
  billingSession.updateItemQuantity(itemId, quantity);
  await billingSession.save();

  res.json({
    status: 'success',
    data: { billingSession }
  });
});

// Remove item from session
export const removeItemFromSession = catchAsync(async (req, res) => {
  const { id, itemId } = req.params;

  const billingSession = await BillingSession.findById(id);

  if (!billingSession) {
    throw new ApplicationError('Billing session not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && billingSession.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only modify billing sessions for your hotel', 403);
  }

  // Check if session is editable
  if (billingSession.status !== 'draft') {
    throw new ApplicationError('Cannot modify completed billing sessions', 400);
  }

  // Remove item from session
  billingSession.removeItem(itemId);
  await billingSession.save();

  res.json({
    status: 'success',
    data: { billingSession }
  });
});

// Checkout billing session
export const checkoutSession = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, splitPayments, notes } = req.body;

  const billingSession = await BillingSession.findById(id);

  if (!billingSession) {
    throw new ApplicationError('Billing session not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && billingSession.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only checkout billing sessions for your hotel', 403);
  }

  // Check if session can be checked out
  if (billingSession.status !== 'draft') {
    throw new ApplicationError('Only draft billing sessions can be checked out', 400);
  }

  if (billingSession.items.length === 0) {
    throw new ApplicationError('Cannot checkout empty billing session', 400);
  }

  // Process payment
  billingSession.processPayment(paymentMethod);
  
  if (splitPayments && splitPayments.length > 0) {
    billingSession.splitPayments = splitPayments;
  }

  if (notes) {
    billingSession.notes = notes;
  }

  await billingSession.save();

  res.json({
    status: 'success',
    message: 'Billing session checked out successfully',
    data: { billingSession }
  });
});

// Void billing session
export const voidSession = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const billingSession = await BillingSession.findById(id);

  if (!billingSession) {
    throw new ApplicationError('Billing session not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && billingSession.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only void billing sessions for your hotel', 403);
  }

  // Check if session can be voided
  if (billingSession.status === 'void') {
    throw new ApplicationError('Billing session is already voided', 400);
  }

  // Void session
  billingSession.voidSession();
  if (reason) {
    billingSession.notes = reason;
  }

  await billingSession.save();

  res.json({
    status: 'success',
    message: 'Billing session voided successfully',
    data: { billingSession }
  });
});

// Get all billing sessions for a hotel
export const getHotelBillingSessions = catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  const { status, page = 1, limit = 20 } = req.query;

  // Check access permissions
  if (req.user.role === 'staff' && req.user.hotelId.toString() !== hotelId) {
    throw new ApplicationError('You can only view billing sessions for your hotel', 403);
  }

  const query = { hotelId };
  if (status) {
    query.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const billingSessions = await BillingSession.find(query)
    .populate('hotelId', 'name')
    .populate('bookingId', 'bookingNumber')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await BillingSession.countDocuments(query);

  res.json({
    status: 'success',
    results: billingSessions.length,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    },
    data: billingSessions
  });
});

export default {
  createBillingSession,
  getBillingSession,
  updateBillingSession,
  deleteBillingSession,
  addItemToSession,
  updateItemInSession,
  removeItemFromSession,
  checkoutSession,
  voidSession,
  getHotelBillingSessions
};
