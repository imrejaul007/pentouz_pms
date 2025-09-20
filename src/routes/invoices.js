import express from 'express';
import Invoice from '../models/Invoice.js';
import Booking from '../models/Booking.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /invoices:
 *   post:
 *     summary: Create a new invoice
 *     tags: [Invoices]
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
 *               - items
 *               - dueDate
 *             properties:
 *               bookingId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [accommodation, service, additional, refund, cancellation]
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                     category:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *                     taxRate:
 *                       type: number
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               discounts:
 *                 type: array
 *               splitBilling:
 *                 type: object
 *                 properties:
 *                   isEnabled:
 *                     type: boolean
 *                   method:
 *                     type: string
 *                   splits:
 *                     type: array
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Invoice created successfully
 */
router.post('/', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const {
    bookingId,
    type,
    items,
    dueDate,
    discounts,
    splitBilling,
    notes,
    billingAddress
  } = req.body;

  // Verify booking exists
  const booking = await Booking.findById(bookingId)
    .populate('userId', 'name email')
    .populate('hotelId', 'name');
  
  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }

  // Check hotel access
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : booking.hotelId._id;
  if (req.user.role === 'staff' && booking.hotelId._id.toString() !== hotelId.toString()) {
    throw new ApplicationError('You can only create invoices for your hotel', 403);
  }

  const invoiceData = {
    hotelId,
    bookingId,
    guestId: booking.userId._id,
    type: type || 'accommodation',
    items: items.map(item => ({
      ...item,
      totalPrice: item.quantity * item.unitPrice,
      taxAmount: ((item.quantity * item.unitPrice) * (item.taxRate || 0)) / 100
    })),
    dueDate: new Date(dueDate),
    notes,
    billingAddress
  };

  const invoice = await Invoice.create(invoiceData);

  // Add discounts if provided
  if (discounts && discounts.length > 0) {
    for (const discount of discounts) {
      await invoice.addDiscount(
        discount.description,
        discount.type,
        discount.value,
        req.user._id
      );
    }
  }

  // Setup split billing if enabled
  if (splitBilling && splitBilling.isEnabled) {
    await invoice.setupSplitBilling(splitBilling.method, splitBilling.splits);
  }

  await invoice.populate([
    { path: 'hotelId', select: 'name address contact' },
    { path: 'bookingId', select: 'bookingNumber checkIn checkOut' },
    { path: 'guestId', select: 'name email phone' }
  ]);

  res.status(201).json({
    status: 'success',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices:
 *   get:
 *     summary: Get invoices
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: guestId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of invoices
 */
router.get('/', catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    guestId,
    startDate,
    endDate,
    overdue
  } = req.query;

  const query = {};

  // Role-based filtering
  if (req.user.role === 'guest') {
    query.guestId = req.user._id;
  } else if (req.user.role === 'staff') {
    query.hotelId = req.user.hotelId;
  } else if (req.user.role === 'admin' && req.query.hotelId) {
    query.hotelId = req.query.hotelId;
  }

  // Apply filters
  if (status) query.status = status;
  if (type) query.type = type;
  if (guestId && ['staff', 'admin'].includes(req.user.role)) query.guestId = guestId;

  if (startDate || endDate) {
    query.issueDate = {};
    if (startDate) query.issueDate.$gte = new Date(startDate);
    if (endDate) query.issueDate.$lte = new Date(endDate);
  }

  // Filter overdue invoices
  if (overdue === 'true') {
    query.dueDate = { $lt: new Date() };
    query.status = { $in: ['issued', 'partially_paid'] };
  }

  const skip = (page - 1) * limit;
  
  const [invoices, total] = await Promise.all([
    Invoice.find(query)
      .populate('hotelId', 'name')
      .populate('bookingId', 'bookingNumber checkIn checkOut')
      .populate('guestId', 'name email')
      .sort('-issueDate')
      .skip(skip)
      .limit(parseInt(limit)),
    Invoice.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      invoices,
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
 * /invoices/{id}:
 *   get:
 *     summary: Get specific invoice
 *     tags: [Invoices]
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
 *         description: Invoice details
 */
router.get('/:id', catchAsync(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('hotelId', 'name address contact')
    .populate('bookingId', 'bookingNumber checkIn checkOut rooms')
    .populate('guestId', 'name email phone')
    .populate('payments.paidBy', 'name')
    .populate('discounts.appliedBy', 'name')
    .populate('splitBilling.splits.guestId', 'name email');

  if (!invoice) {
    throw new ApplicationError('Invoice not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'guest' && invoice.guestId._id.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only view your own invoices', 403);
  }

  if (req.user.role === 'staff' && invoice.hotelId._id.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only view invoices for your hotel', 403);
  }

  res.json({
    status: 'success',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices/{id}:
 *   patch:
 *     summary: Update invoice
 *     tags: [Invoices]
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
 *               status:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               items:
 *                 type: array
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invoice updated successfully
 */
router.patch('/:id', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  
  if (!invoice) {
    throw new ApplicationError('Invoice not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && invoice.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only update invoices for your hotel', 403);
  }

  // Don't allow updates to paid invoices
  if (invoice.status === 'paid') {
    throw new ApplicationError('Cannot update paid invoices', 400);
  }

  const allowedUpdates = ['status', 'dueDate', 'items', 'notes', 'internalNotes'];
  const updates = {};
  
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  Object.assign(invoice, updates);
  
  // Recalculate if items were updated
  if (updates.items) {
    invoice.calculateTotals();
  }
  
  await invoice.save();

  res.json({
    status: 'success',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices/{id}/payments:
 *   post:
 *     summary: Add payment to invoice
 *     tags: [Invoices]
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
 *               - amount
 *               - method
 *             properties:
 *               amount:
 *                 type: number
 *               method:
 *                 type: string
 *               transactionId:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment added successfully
 */
router.post('/:id/payments', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { amount, method, transactionId, notes } = req.body;
  
  const invoice = await Invoice.findById(req.params.id);
  
  if (!invoice) {
    throw new ApplicationError('Invoice not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && invoice.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only add payments to invoices for your hotel', 403);
  }

  if (amount <= 0 || amount > invoice.amountRemaining) {
    throw new ApplicationError('Invalid payment amount', 400);
  }

  await invoice.addPayment(amount, method, req.user._id, transactionId, notes);

  await invoice.populate([
    { path: 'payments.paidBy', select: 'name' }
  ]);

  res.json({
    status: 'success',
    message: 'Payment added successfully',
    data: { 
      invoice,
      amountPaid: invoice.amountPaid,
      amountRemaining: invoice.amountRemaining
    }
  });
}));

/**
 * @swagger
 * /invoices/{id}/discounts:
 *   post:
 *     summary: Add discount to invoice
 *     tags: [Invoices]
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
 *               - description
 *               - type
 *               - value
 *             properties:
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [percentage, fixed_amount, loyalty_points]
 *               value:
 *                 type: number
 *     responses:
 *       200:
 *         description: Discount added successfully
 */
router.post('/:id/discounts', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { description, type, value } = req.body;
  
  const invoice = await Invoice.findById(req.params.id);
  
  if (!invoice) {
    throw new ApplicationError('Invoice not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && invoice.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only add discounts to invoices for your hotel', 403);
  }

  if (invoice.status === 'paid') {
    throw new ApplicationError('Cannot add discounts to paid invoices', 400);
  }

  await invoice.addDiscount(description, type, value, req.user._id);

  res.json({
    status: 'success',
    message: 'Discount added successfully',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices/{id}/split-billing:
 *   post:
 *     summary: Setup split billing for invoice
 *     tags: [Invoices]
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
 *               - method
 *               - splits
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [equal, percentage, item_based, custom_amount]
 *               splits:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     guestId:
 *                       type: string
 *                     guestName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     percentage:
 *                       type: number
 *     responses:
 *       200:
 *         description: Split billing setup successfully
 */
router.post('/:id/split-billing', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { method, splits } = req.body;
  
  const invoice = await Invoice.findById(req.params.id);
  
  if (!invoice) {
    throw new ApplicationError('Invoice not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && invoice.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only setup split billing for invoices for your hotel', 403);
  }

  if (invoice.status === 'paid') {
    throw new ApplicationError('Cannot setup split billing for paid invoices', 400);
  }

  await invoice.setupSplitBilling(method, splits);

  res.json({
    status: 'success',
    message: 'Split billing setup successfully',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices/{id}/splits/{splitIndex}/pay:
 *   post:
 *     summary: Mark split as paid
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: splitIndex
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - method
 *             properties:
 *               amount:
 *                 type: number
 *               method:
 *                 type: string
 *               transactionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Split marked as paid successfully
 */
router.post('/:id/splits/:splitIndex/pay', authorize('staff', 'admin', 'guest'), catchAsync(async (req, res) => {
  const { amount, method, transactionId } = req.body;
  const { splitIndex } = req.params;
  
  const invoice = await Invoice.findById(req.params.id);
  
  if (!invoice) {
    throw new ApplicationError('Invoice not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'guest') {
    const split = invoice.splitBilling.splits[parseInt(splitIndex)];
    if (!split || split.guestId.toString() !== req.user._id.toString()) {
      throw new ApplicationError('You can only pay your own split', 403);
    }
  } else if (req.user.role === 'staff' && invoice.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only manage splits for invoices for your hotel', 403);
  }

  await invoice.markSplitPaid(parseInt(splitIndex), amount, method, transactionId);

  res.json({
    status: 'success',
    message: 'Split marked as paid successfully',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices/stats:
 *   get:
 *     summary: Get invoice statistics
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Invoice statistics
 */
router.get('/stats', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const [revenueStats, overdueInvoices] = await Promise.all([
    Invoice.getRevenueStats(hotelId, startDate, endDate),
    Invoice.getOverdueInvoices(hotelId)
  ]);

  // Get overall summary
  const matchQuery = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    ...(startDate && endDate ? {
      issueDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    } : {})
  };

  const overallStats = await Invoice.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        totalPaid: { $sum: '$amountPaid' },
        outstandingAmount: { $sum: '$amountRemaining' },
        draftCount: {
          $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
        },
        issuedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'issued'] }, 1, 0] }
        },
        paidCount: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
        },
        overdueCount: {
          $sum: { 
            $cond: [
              { 
                $and: [
                  { $lt: ['$dueDate', new Date()] },
                  { $in: ['$status', ['issued', 'partially_paid']] }
                ]
              }, 
              1, 
              0 
            ] 
          }
        }
      }
    }
  ]);

  res.json({
    status: 'success',
    data: {
      overall: overallStats[0] || {},
      revenue: revenueStats,
      overdue: {
        count: overdueInvoices.length,
        totalAmount: overdueInvoices.reduce((sum, inv) => sum + inv.amountRemaining, 0),
        invoices: overdueInvoices.slice(0, 10) // First 10 overdue
      }
    }
  });
}));

/**
 * @swagger
 * /invoices/overdue:
 *   get:
 *     summary: Get overdue invoices
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Overdue invoices
 */
router.get('/overdue', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const overdueInvoices = await Invoice.getOverdueInvoices(hotelId);

  res.json({
    status: 'success',
    data: {
      invoices: overdueInvoices,
      count: overdueInvoices.length,
      totalAmount: overdueInvoices.reduce((sum, inv) => sum + inv.amountRemaining, 0)
    }
  });
}));

export default router;
