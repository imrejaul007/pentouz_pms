import express from 'express';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Simple test route
router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Billing history API is working',
    user: {
      id: req.user._id,
      role: req.user.role
    }
  });
});

/**
 * @swagger
 * /billing-history/user:
 *   get:
 *     summary: Get user's checkout inventory billing history
 *     tags: [Billing History]
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
 *           default: 10
 *     responses:
 *       200:
 *         description: User's checkout inventory billing history
 */
router.get('/user', catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;
  
  // Get user with billing history
  const user = await User.findById(req.user._id)
    .select('billingHistory')
    .populate({
      path: 'billingHistory.bookingId',
      select: 'bookingNumber checkIn checkOut'
    })
    .populate({
      path: 'billingHistory.roomId', 
      select: 'roomNumber type'
    });

  if (!user) {
    throw new ApplicationError('User not found', 404);
  }

  // Sort billing history by date (newest first)
  const sortedHistory = user.billingHistory.sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  // Apply pagination
  const total = sortedHistory.length;
  const paginatedHistory = sortedHistory.slice(skip, skip + parseInt(limit));

  // Calculate summary
  const summary = {
    totalCharges: sortedHistory.length,
    totalAmount: sortedHistory.reduce((sum, item) => sum + item.totalAmount, 0),
    totalPaid: sortedHistory.filter(item => item.paymentStatus === 'paid').length,
    totalPending: sortedHistory.filter(item => item.paymentStatus === 'pending').length
  };

  res.json({
    status: 'success',
    data: {
      billingHistory: paginatedHistory,
      summary,
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
 * /billing-history:
 *   get:
 *     summary: Get comprehensive billing history (invoices, transactions, refunds)
 *     tags: [Billing History]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, invoice, payment, refund, booking]
 *           default: all
 *       - in: query
 *         name: status
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
 *       - in: query
 *         name: guestId
 *         schema:
 *           type: string
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comprehensive billing history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     history:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [invoice, payment, refund, booking]
 *                           date:
 *                             type: string
 *                             format: date-time
 *                           amount:
 *                             type: number
 *                           status:
 *                             type: string
 *                           description:
 *                             type: string
 *                           bookingId:
 *                             type: string
 *                           guestName:
 *                             type: string
 *                           invoiceNumber:
 *                             type: string
 *                     summary:
 *                       type: object
 *                     pagination:
 *                       type: object
 */
router.get('/', catchAsync(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type = 'all',
      status,
      startDate,
      endDate,
      guestId,
      hotelId,
      search
    } = req.query;

  // Build base query based on user role
  let baseQuery = {};
  
  if (req.user.role === 'guest') {
    baseQuery.guestId = req.user._id;
  } else if (req.user.role === 'staff') {
    baseQuery.hotelId = req.user.hotelId;
  } else if (req.user.role === 'admin') {
    // Admin can see all hotels, or filter by specific hotel if provided
    if (hotelId) {
      baseQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
    }
    // If no hotelId provided, admin sees all data (no baseQuery.hotelId filter)
  }

  // Apply additional filters
  if (guestId && ['staff', 'admin'].includes(req.user.role)) {
    baseQuery.guestId = new mongoose.Types.ObjectId(guestId);
  }

  // Date range filter
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const skip = (page - 1) * limit;
  let historyItems = [];
  
  // Debug: Check what exists in database
  const totalInvoices = await Invoice.countDocuments();
  const totalPayments = await Payment.countDocuments();
  
  console.log('Billing history request:', {
    userRole: req.user.role,
    userId: req.user._id,
    userHotelId: req.user.hotelId,
    requestedHotelId: hotelId,
    baseQuery,
    type,
    filters: { status, startDate, endDate, guestId, search },
    dbCounts: { totalInvoices, totalPayments }
  });

  // Fetch invoices
  if (type === 'all' || type === 'invoice') {
    const invoiceQuery = { ...baseQuery };
    if (Object.keys(dateFilter).length > 0) {
      invoiceQuery.issueDate = dateFilter;
    }
    if (status) invoiceQuery.status = status;
    if (search) {
      invoiceQuery.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'items.description': { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const invoices = await Invoice.find(invoiceQuery)
      .populate('bookingId', 'bookingNumber')
      .populate('guestId', 'name email')
      .populate('hotelId', 'name')
      .select('invoiceNumber type status totalAmount issueDate items notes bookingId guestId hotelId payments')
      .sort('-issueDate');
    
    console.log('Invoice query:', invoiceQuery);
    console.log('Found invoices:', invoices.length);

    invoices.forEach(invoice => {
      historyItems.push({
        id: invoice._id,
        type: 'invoice',
        subType: invoice.type,
        date: invoice.issueDate,
        amount: invoice.totalAmount,
        status: invoice.status,
        description: `Invoice ${invoice.invoiceNumber} - ${invoice.type}`,
        bookingId: invoice.bookingId?._id,
        bookingNumber: invoice.bookingId?.bookingNumber,
        guestName: invoice.guestId?.name,
        guestEmail: invoice.guestId?.email,
        hotelName: invoice.hotelId?.name,
        invoiceNumber: invoice.invoiceNumber,
        amountPaid: invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0,
        amountRemaining: invoice.totalAmount - (invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0),
        itemCount: invoice.items?.length || 0
      });
    });
  }

  // Fetch payments from Invoice payments array (since seed data doesn't create separate Payment documents)
  if (type === 'all' || type === 'payment') {
    // Get invoices that have payments
    const invoicePaymentQuery = { ...baseQuery };
    if (Object.keys(dateFilter).length > 0) {
      invoicePaymentQuery.issueDate = dateFilter;
    }
    if (search) {
      invoicePaymentQuery.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'items.description': { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const invoicesWithPayments = await Invoice.find({
      ...invoicePaymentQuery,
      'payments.0': { $exists: true }  // Only invoices with payments
    })
      .populate('bookingId', 'bookingNumber')
      .populate('guestId', 'name email')
      .populate('hotelId', 'name')
      .select('invoiceNumber totalAmount issueDate payments bookingId guestId hotelId currency')
      .sort('-issueDate');
    
    console.log('Found invoices with payments:', invoicesWithPayments.length);

    invoicesWithPayments.forEach(invoice => {
      invoice.payments.forEach((payment, index) => {
        // Add each payment as a transaction
        historyItems.push({
          id: `${invoice._id}-payment-${index}`,
          type: 'payment',
          subType: 'transaction',
          date: payment.paidAt || invoice.issueDate,
          amount: payment.amount,
          status: 'succeeded', // Payments in invoices are considered successful
          description: `Payment for Invoice ${invoice.invoiceNumber} - ${payment.method}`,
          bookingId: invoice.bookingId?._id,
          bookingNumber: invoice.bookingId?.bookingNumber,
          guestName: invoice.guestId?.name,
          guestEmail: invoice.guestId?.email,
          hotelName: invoice.hotelId?.name,
          paymentMethod: payment.method,
          currency: invoice.currency || 'INR',
          transactionId: payment.transactionId,
          invoiceNumber: invoice.invoiceNumber
        });
      });
    });
  }

  // For refunds, we'll check if there are any refund-type invoices in the seed data
  if (type === 'all' || type === 'refund') {
    const refundInvoices = await Invoice.find({
      ...baseQuery,
      status: 'refunded'
    })
      .populate('bookingId', 'bookingNumber')
      .populate('guestId', 'name email')
      .populate('hotelId', 'name')
      .select('invoiceNumber type status totalAmount issueDate bookingId guestId hotelId currency')
      .sort('-issueDate');

    console.log('Found refund invoices:', refundInvoices.length);

    refundInvoices.forEach(invoice => {
      historyItems.push({
        id: `${invoice._id}-refund`,
        type: 'refund',
        subType: 'refund',
        date: invoice.issueDate,
        amount: invoice.totalAmount,
        status: 'completed',
        description: `Refund for Invoice ${invoice.invoiceNumber}`,
        bookingId: invoice.bookingId?._id,
        bookingNumber: invoice.bookingId?.bookingNumber,
        guestName: invoice.guestId?.name,
        guestEmail: invoice.guestId?.email,
        hotelName: invoice.hotelId?.name,
        currency: invoice.currency || 'INR',
        invoiceNumber: invoice.invoiceNumber,
        refundReason: 'Invoice refund'
      });
    });
  }

  // Include bookings as potential billing items (especially pending ones without invoices)
  if (type === 'all' || type === 'booking') {
    const bookingQuery = { ...baseQuery };
    if (Object.keys(dateFilter).length > 0) {
      bookingQuery.createdAt = dateFilter;
    }
    if (search) {
      bookingQuery.$or = [
        { bookingNumber: { $regex: search, $options: 'i' } },
        { 'guestDetails.specialRequests': { $regex: search, $options: 'i' } }
      ];
    }

    const bookings = await Booking.find(bookingQuery)
      .populate('userId', 'name email')
      .populate('hotelId', 'name')
      .populate('rooms.roomId', 'roomNumber type')
      .select('bookingNumber status paymentStatus totalAmount checkIn checkOut userId hotelId rooms createdAt currency nights')
      .sort('-createdAt');

    console.log('Found bookings:', bookings.length);

    bookings.forEach(booking => {
      // Add booking as billing item
      const roomInfo = booking.rooms?.map(r => r.roomId?.roomNumber).join(', ') || 'Room info not available';
      
      historyItems.push({
        id: booking._id,
        type: 'booking',
        subType: booking.paymentStatus,
        date: booking.createdAt,
        amount: booking.totalAmount,
        status: booking.status,
        description: `Room Booking ${booking.bookingNumber} - ${roomInfo}`,
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        guestName: booking.userId?.name,
        guestEmail: booking.userId?.email,
        hotelName: booking.hotelId?.name,
        currency: booking.currency || 'INR',
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights,
        paymentStatus: booking.paymentStatus,
        roomCount: booking.rooms?.length || 0
      });
    });
  }

  // Apply search filter to consolidated results if needed
  if (search && type === 'all') {
    const searchLower = search.toLowerCase();
    historyItems = historyItems.filter(item => 
      item.description.toLowerCase().includes(searchLower) ||
      item.guestName?.toLowerCase().includes(searchLower) ||
      item.bookingNumber?.toLowerCase().includes(searchLower) ||
      item.invoiceNumber?.toLowerCase().includes(searchLower)
    );
  }

  // Sort by date (newest first)
  historyItems.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Apply pagination
  const total = historyItems.length;
  const paginatedItems = historyItems.slice(skip, skip + parseInt(limit));

  // Calculate summary statistics
  const summary = {
    totalTransactions: total,
    totalAmount: historyItems.reduce((sum, item) => sum + (item.type === 'refund' ? -item.amount : item.amount), 0),
    invoiceCount: historyItems.filter(item => item.type === 'invoice').length,
    paymentCount: historyItems.filter(item => item.type === 'payment').length,
    refundCount: historyItems.filter(item => item.type === 'refund').length,
    bookingCount: historyItems.filter(item => item.type === 'booking').length,
    totalInvoiceAmount: historyItems.filter(item => item.type === 'invoice').reduce((sum, item) => sum + item.amount, 0),
    totalPaymentAmount: historyItems.filter(item => item.type === 'payment').reduce((sum, item) => sum + item.amount, 0),
    totalRefundAmount: historyItems.filter(item => item.type === 'refund').reduce((sum, item) => sum + item.amount, 0),
    totalBookingAmount: historyItems.filter(item => item.type === 'booking').reduce((sum, item) => sum + item.amount, 0)
  };

  console.log('Final results:', {
    totalHistoryItems: historyItems.length,
    paginatedItems: paginatedItems.length,
    summary
  });

  res.json({
    status: 'success',
    data: {
      history: paginatedItems,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
  
  } catch (error) {
    console.error('Billing history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      details: error.message
    });
  }
}));

/**
 * @swagger
 * /billing-history/stats:
 *   get:
 *     summary: Get billing history statistics and analytics
 *     tags: [Billing History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Billing statistics and analytics
 */
router.get('/stats', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { period = 'month', hotelId } = req.query;
  
  // Determine hotel ID based on user role
  const targetHotelId = req.user.role === 'staff' ? req.user.hotelId : hotelId;
  
  if (!targetHotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Calculate date range based on period
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'quarter':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case 'year':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case 'month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
  }

  const matchQuery = {
    hotelId: new mongoose.Types.ObjectId(targetHotelId),
    createdAt: { $gte: startDate, $lte: now }
  };

  // Get invoice statistics
  const invoiceStats = await Invoice.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(targetHotelId),
        issueDate: { $gte: startDate, $lte: now }
      }
    },
    {
      $group: {
        _id: {
          status: '$status',
          type: '$type'
        },
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        averageAmount: { $avg: '$totalAmount' }
      }
    }
  ]);

  // Get payment statistics
  const paymentStats = await Payment.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          status: '$status',
          method: '$paymentMethod'
        },
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' }
      }
    }
  ]);

  // Get daily revenue trend
  const revenueTrend = await Payment.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(targetHotelId),
        status: 'succeeded',
        createdAt: { $gte: startDate, $lte: now }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        revenue: { $sum: '$amount' },
        transactionCount: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);

  // Get refund statistics
  const refundStats = await Payment.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(targetHotelId),
        createdAt: { $gte: startDate, $lte: now },
        'refunds.0': { $exists: true }
      }
    },
    { $unwind: '$refunds' },
    {
      $group: {
        _id: null,
        totalRefunds: { $sum: 1 },
        totalRefundAmount: { $sum: '$refunds.amount' },
        averageRefundAmount: { $avg: '$refunds.amount' }
      }
    }
  ]);

  res.json({
    status: 'success',
    data: {
      period,
      dateRange: {
        startDate,
        endDate: now
      },
      invoices: invoiceStats,
      payments: paymentStats,
      refunds: refundStats[0] || { totalRefunds: 0, totalRefundAmount: 0, averageRefundAmount: 0 },
      revenueTrend
    }
  });
}));

/**
 * @swagger
 * /billing-history/export:
 *   get:
 *     summary: Export billing history data
 *     tags: [Billing History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, excel, pdf]
 *           default: csv
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
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, invoice, payment, refund]
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Export data or download link
 */
router.get('/export', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { format = 'csv', startDate, endDate, type = 'all', hotelId } = req.query;
  
  // For now, return the data in JSON format that can be processed by frontend
  // In production, you would implement actual CSV/Excel/PDF generation
  
  const targetHotelId = req.user.role === 'staff' ? req.user.hotelId : hotelId;
  
  if (!targetHotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Use the same logic as the main endpoint but without pagination
  const baseQuery = { hotelId: new mongoose.Types.ObjectId(targetHotelId) };
  
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  let exportData = [];

  // Fetch data based on type
  if (type === 'all' || type === 'invoice') {
    const invoiceQuery = { ...baseQuery };
    if (Object.keys(dateFilter).length > 0) {
      invoiceQuery.issueDate = dateFilter;
    }

    const invoices = await Invoice.find(invoiceQuery)
      .populate('bookingId', 'bookingNumber')
      .populate('guestId', 'name email phone')
      .populate('hotelId', 'name')
      .sort('-issueDate');

    invoices.forEach(invoice => {
      exportData.push({
        type: 'Invoice',
        date: invoice.issueDate,
        invoiceNumber: invoice.invoiceNumber,
        bookingNumber: invoice.bookingId?.bookingNumber,
        guestName: invoice.guestId?.name,
        guestEmail: invoice.guestId?.email,
        amount: invoice.totalAmount,
        status: invoice.status,
        currency: invoice.currency,
        hotelName: invoice.hotelId?.name
      });
    });
  }

  if (type === 'all' || type === 'payment') {
    const paymentQuery = { ...baseQuery };
    if (Object.keys(dateFilter).length > 0) {
      paymentQuery.createdAt = dateFilter;
    }

    const payments = await Payment.find(paymentQuery)
      .populate({
        path: 'bookingId',
        select: 'bookingNumber userId',
        populate: { path: 'userId', select: 'name email' }
      })
      .populate('hotelId', 'name')
      .sort('-createdAt');

    payments.forEach(payment => {
      exportData.push({
        type: 'Payment',
        date: payment.createdAt,
        transactionId: payment.stripePaymentIntentId,
        bookingNumber: payment.bookingId?.bookingNumber,
        guestName: payment.bookingId?.userId?.name,
        guestEmail: payment.bookingId?.userId?.email,
        amount: payment.amount,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        currency: payment.currency,
        hotelName: payment.hotelId?.name
      });

      // Add refunds
      payment.refunds?.forEach(refund => {
        exportData.push({
          type: 'Refund',
          date: refund.createdAt,
          refundId: refund.stripeRefundId,
          originalTransactionId: payment.stripePaymentIntentId,
          bookingNumber: payment.bookingId?.bookingNumber,
          guestName: payment.bookingId?.userId?.name,
          guestEmail: payment.bookingId?.userId?.email,
          amount: refund.amount,
          status: 'completed',
          reason: refund.reason,
          currency: payment.currency,
          hotelName: payment.hotelId?.name
        });
      });
    });
  }

  // Sort by date
  exportData.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json({
    status: 'success',
    data: {
      format,
      totalRecords: exportData.length,
      exportData,
      generatedAt: new Date()
    }
  });
}));

export default router;