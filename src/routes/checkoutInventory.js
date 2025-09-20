import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import CheckoutInventory from '../models/CheckoutInventory.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/checkout-inventory:
 *   post:
 *     summary: Create a new checkout inventory check
 *     tags: [Checkout Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - roomId
 *               - items
 *             properties:
 *               bookingId:
 *                 type: string
 *               roomId:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemName:
 *                       type: string
 *                     category:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *                     status:
 *                       type: string
 *                     notes:
 *                       type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Checkout inventory check created successfully
 */
router.post('/', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { bookingId, roomId, items, notes } = req.body;
  const { _id: checkedBy } = req.user;

  console.log('DEBUG: Creating checkout inventory:', {
    bookingId,
    roomId,
    itemsCount: items?.length,
    checkedBy,
    userRole: req.user.role
  });

  // Verify booking exists and is checked in
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    console.log('DEBUG: Booking not found:', bookingId);
    throw new ApplicationError('Booking not found', 404);
  }

  console.log('DEBUG: Booking found:', {
    id: booking._id,
    status: booking.status,
    hotelId: booking.hotelId
  });

  if (booking.status !== 'checked_in') {
    console.log('DEBUG: Invalid booking status:', booking.status);
    throw new ApplicationError('Booking must be checked in to perform inventory check', 400);
  }

  // Verify room exists and belongs to the booking
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApplicationError('Room not found', 404);
  }

  const bookingRoom = booking.rooms.find(r => r.roomId.toString() === roomId);
  if (!bookingRoom) {
    throw new ApplicationError('Room does not belong to this booking', 400);
  }

  // Calculate total price for each item
  const processedItems = items.map(item => ({
    ...item,
    totalPrice: item.quantity * item.unitPrice
  }));

  console.log('DEBUG: Creating CheckoutInventory record with data:', {
    bookingId,
    roomId,
    checkedBy,
    itemsCount: processedItems.length
  });

  const checkoutInventory = await CheckoutInventory.create({
    bookingId,
    roomId,
    checkedBy,
    items: processedItems,
    notes
  });

  console.log('DEBUG: CheckoutInventory created successfully:', {
    id: checkoutInventory._id,
    createdAt: checkoutInventory.createdAt
  });

  await checkoutInventory.populate([
    { path: 'bookingId', select: 'bookingNumber checkIn checkOut totalAmount' },
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);

  res.status(201).json({
    status: 'success',
    data: { checkoutInventory }
  });
}));

/**
 * @swagger
 * /api/v1/checkout-inventory:
 *   get:
 *     summary: Get all checkout inventory checks
 *     tags: [Checkout Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: bookingId
 *         schema:
 *           type: string
 *         description: Filter by booking ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of checkout inventory checks
 */
router.get('/', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { status, paymentStatus, bookingId, page = 1, limit = 10 } = req.query;
  const { hotelId } = req.user;

  const filter = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (bookingId) filter.bookingId = bookingId;

  const skip = (page - 1) * limit;

  const [checkoutInventories, total] = await Promise.all([
    CheckoutInventory.find(filter)
      .populate([
        { 
          path: 'bookingId', 
          select: 'bookingNumber checkIn checkOut totalAmount',
          match: { hotelId }
        },
        { path: 'roomId', select: 'roomNumber type' },
        { path: 'checkedBy', select: 'name email' }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    CheckoutInventory.countDocuments(filter)
  ]);

  // Filter out results where bookingId is null (due to hotelId mismatch)
  const filteredInventories = checkoutInventories.filter(inv => inv.bookingId);

  res.status(200).json({
    status: 'success',
    data: {
      checkoutInventories: filteredInventories,
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
 * /api/v1/checkout-inventory/{id}:
 *   get:
 *     summary: Get checkout inventory check by ID
 *     tags: [Checkout Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Checkout inventory check details
 */
router.get('/:id', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const checkoutInventory = await CheckoutInventory.findById(req.params.id)
    .populate([
      { path: 'bookingId', select: 'bookingNumber checkIn checkOut totalAmount userId' },
      { path: 'roomId', select: 'roomNumber type' },
      { path: 'checkedBy', select: 'name email' }
    ]);

  if (!checkoutInventory) {
    throw new ApplicationError('Checkout inventory check not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { checkoutInventory }
  });
}));

/**
 * @swagger
 * /api/v1/checkout-inventory/{id}:
 *   patch:
 *     summary: Update checkout inventory check
 *     tags: [Checkout Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               items:
 *                 type: array
 *               status:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checkout inventory check updated successfully
 */
router.patch('/:id', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { items, status, notes } = req.body;

  const checkoutInventory = await CheckoutInventory.findById(req.params.id);
  if (!checkoutInventory) {
    throw new ApplicationError('Checkout inventory check not found', 404);
  }

  if (items) {
    // Recalculate total price for each item
    const processedItems = items.map(item => ({
      ...item,
      totalPrice: item.quantity * item.unitPrice
    }));
    checkoutInventory.items = processedItems;
  }

  if (status) checkoutInventory.status = status;
  if (notes) checkoutInventory.notes = notes;

  await checkoutInventory.save();

  await checkoutInventory.populate([
    { path: 'bookingId', select: 'bookingNumber checkIn checkOut totalAmount' },
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);

  res.status(200).json({
    status: 'success',
    data: { checkoutInventory }
  });
}));

/**
 * @swagger
 * /api/v1/checkout-inventory/{id}/complete:
 *   post:
 *     summary: Mark checkout inventory as completed (ready for payment)
 *     tags: [Checkout Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Checkout inventory ID
 *     responses:
 *       200:
 *         description: Inventory check marked as completed
 */
router.post('/:id/complete', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const checkoutInventory = await CheckoutInventory.findById(req.params.id);
  if (!checkoutInventory) {
    throw new ApplicationError('Checkout inventory check not found', 404);
  }

  if (checkoutInventory.status !== 'pending') {
    throw new ApplicationError('Only pending inventory checks can be marked as completed', 400);
  }

  // Update status to completed
  checkoutInventory.status = 'completed';
  await checkoutInventory.save();

  await checkoutInventory.populate([
    { path: 'bookingId', select: 'bookingNumber checkIn checkOut totalAmount' },
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);

  res.status(200).json({
    status: 'success',
    data: { checkoutInventory },
    message: 'Inventory check marked as completed. Customer can now proceed to payment.'
  });
}));

/**
 * @swagger
 * /api/v1/checkout-inventory/{id}/payment:
 *   post:
 *     summary: Process payment for checkout inventory
 *     tags: [Checkout Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethod
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, card, upi, bank_transfer]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment processed successfully
 */
router.post('/:id/payment', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { paymentMethod, notes } = req.body;

  const checkoutInventory = await CheckoutInventory.findById(req.params.id);
  if (!checkoutInventory) {
    throw new ApplicationError('Checkout inventory check not found', 404);
  }

  if (checkoutInventory.paymentStatus === 'paid') {
    throw new ApplicationError('Payment already processed', 400);
  }

  // Update payment details
  checkoutInventory.paymentMethod = paymentMethod;
  checkoutInventory.paymentStatus = 'paid';
  checkoutInventory.status = 'completed'; // Set to completed when paid
  checkoutInventory.paidAt = new Date();
  if (notes) checkoutInventory.notes = notes;

  await checkoutInventory.save();

  // Update booking status to checked out
  const booking = await Booking.findByIdAndUpdate(checkoutInventory.bookingId, {
    status: 'checked_out',
    checkOutTime: new Date()
  }, { new: true });

  // Add billing history to user account if user exists
  if (booking && booking.userId) {
    await User.findByIdAndUpdate(booking.userId, {
      $push: {
        billingHistory: {
          type: 'checkout_charges',
          bookingId: checkoutInventory.bookingId,
          roomId: checkoutInventory.roomId,
          description: 'Room checkout inventory charges',
          items: checkoutInventory.items.filter(item => item.totalPrice > 0).map(item => ({
            name: item.itemName,
            category: item.category,
            status: item.status,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            notes: item.notes
          })),
          subtotal: checkoutInventory.subtotal,
          tax: checkoutInventory.tax,
          totalAmount: checkoutInventory.totalAmount,
          paymentMethod: checkoutInventory.paymentMethod,
          paymentStatus: checkoutInventory.paymentStatus,
          paidAt: checkoutInventory.paidAt,
          checkoutInventoryId: checkoutInventory._id,
          createdAt: new Date()
        }
      }
    });
  }

  await checkoutInventory.populate([
    { path: 'bookingId', select: 'bookingNumber checkIn checkOut totalAmount' },
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);

  res.status(200).json({
    status: 'success',
    data: { checkoutInventory },
    message: 'Payment processed and guest checked out successfully'
  });
}));

/**
 * @swagger
 * /api/v1/checkout-inventory/booking/{bookingId}:
 *   get:
 *     summary: Get checkout inventory check by booking ID
 *     tags: [Checkout Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Checkout inventory check for booking
 */
router.get('/booking/:bookingId', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const checkoutInventory = await CheckoutInventory.findByBooking(req.params.bookingId);

  if (!checkoutInventory) {
    throw new ApplicationError('Checkout inventory check not found for this booking', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { checkoutInventory }
  });
}));

export default router;
