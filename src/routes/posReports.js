import express from 'express';
import mongoose from 'mongoose';
import BillingSession from '../models/BillingSession.js';
import POSOutlet from '../models/POSOutlet.js';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Sales Summary Report - Daily/Weekly/Monthly aggregated sales
router.get('/sales-summary', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    groupBy = 'day', // day, week, month
    hotelId
  } = req.query;

  if (!startDate || !endDate) {
    throw new ApplicationError('Start date and end date are required', 400);
  }

  const matchQuery = {
    status: { $in: ['paid', 'room_charged'] }, // Only completed transactions
    paidAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  // Filter by hotel
  if (req.user.role === 'staff' && req.user.hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(req.user.hotelId);
  } else if (hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
  }

  // Date format for grouping
  let dateFormat;
  switch (groupBy) {
    case 'week':
      dateFormat = '%Y-W%U'; // Year-Week
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: dateFormat, date: '$paidAt' } },
          paymentMethod: '$paymentMethod'
        },
        totalSales: { $sum: '$grandTotal' },
        transactionCount: { $sum: 1 },
        averageTransactionValue: { $avg: '$grandTotal' },
        totalTax: { $sum: '$totalTax' },
        totalDiscount: { $sum: '$totalDiscount' }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        totalSales: { $sum: '$totalSales' },
        transactionCount: { $sum: '$transactionCount' },
        averageTransactionValue: { $avg: '$averageTransactionValue' },
        totalTax: { $sum: '$totalTax' },
        totalDiscount: { $sum: '$totalDiscount' },
        paymentBreakdown: {
          $push: {
            method: '$_id.paymentMethod',
            amount: '$totalSales',
            count: '$transactionCount'
          }
        }
      }
    },
    { $sort: { '_id': 1 } }
  ];

  const results = await BillingSession.aggregate(pipeline);

  // Calculate summary totals
  const summary = {
    totalSales: results.reduce((sum, item) => sum + item.totalSales, 0),
    totalTransactions: results.reduce((sum, item) => sum + item.transactionCount, 0),
    totalTax: results.reduce((sum, item) => sum + item.totalTax, 0),
    totalDiscount: results.reduce((sum, item) => sum + item.totalDiscount, 0),
    averageTransactionValue: results.length > 0 ? 
      results.reduce((sum, item) => sum + item.totalSales, 0) / results.reduce((sum, item) => sum + item.transactionCount, 0) : 0
  };

  res.json({
    status: 'success',
    data: {
      summary,
      breakdown: results.map(item => ({
        date: item._id,
        totalSales: item.totalSales,
        transactionCount: item.transactionCount,
        averageTransactionValue: item.averageTransactionValue,
        totalTax: item.totalTax,
        totalDiscount: item.totalDiscount,
        paymentBreakdown: item.paymentBreakdown
      })),
      period: { startDate, endDate, groupBy }
    }
  });
}));

// Outlet Performance Report - Revenue by outlet
router.get('/outlet-performance', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    hotelId
  } = req.query;

  if (!startDate || !endDate) {
    throw new ApplicationError('Start date and end date are required', 400);
  }

  const matchQuery = {
    status: { $in: ['paid', 'room_charged'] },
    paidAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (req.user.role === 'staff' && req.user.hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(req.user.hotelId);
  } else if (hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
  }

  const pipeline = [
    { $match: matchQuery },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.outlet',
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        totalItems: { $sum: '$items.quantity' },
        transactionCount: { $addToSet: '$_id' },
        averageItemPrice: { $avg: '$items.price' },
        totalTax: { $sum: '$items.tax' }
      }
    },
    {
      $project: {
        outlet: '$_id',
        totalRevenue: 1,
        totalItems: 1,
        transactionCount: { $size: '$transactionCount' },
        averageItemPrice: 1,
        totalTax: 1,
        averageTransactionValue: { $divide: ['$totalRevenue', { $size: '$transactionCount' }] }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ];

  const results = await BillingSession.aggregate(pipeline);

  // Get outlet details
  const outletDetails = await POSOutlet.find({
    hotelId: req.user.role === 'staff' ? req.user.hotelId : hotelId,
    isActive: true
  }).select('name type location outletId');

  // Merge outlet details with results
  const enrichedResults = results.map(result => {
    const outletInfo = outletDetails.find(outlet => outlet.name === result.outlet);
    return {
      ...result,
      outletType: outletInfo?.type || 'unknown',
      location: outletInfo?.location || 'unknown',
      outletId: outletInfo?.outletId || result.outlet
    };
  });

  const totalRevenue = results.reduce((sum, item) => sum + item.totalRevenue, 0);

  res.json({
    status: 'success',
    data: {
      outlets: enrichedResults.map(item => ({
        ...item,
        revenuePercentage: totalRevenue > 0 ? (item.totalRevenue / totalRevenue * 100).toFixed(1) : 0
      })),
      summary: {
        totalRevenue,
        totalOutlets: results.length,
        topPerformer: results.length > 0 ? results[0].outlet : null
      },
      period: { startDate, endDate }
    }
  });
}));

// Transaction History Report - Detailed billing sessions with filters
router.get('/transaction-history', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    status,
    paymentMethod,
    outlet,
    page = 1,
    limit = 50,
    hotelId
  } = req.query;

  const matchQuery = {};

  // Date filter
  if (startDate && endDate) {
    matchQuery.paidAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  // Status filter
  if (status) {
    matchQuery.status = status;
  }

  // Payment method filter
  if (paymentMethod) {
    matchQuery.paymentMethod = paymentMethod;
  }

  // Hotel filter
  if (req.user.role === 'staff' && req.user.hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(req.user.hotelId);
  } else if (hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
  }

  // Outlet filter (requires looking into items)
  let pipeline = [{ $match: matchQuery }];

  if (outlet) {
    pipeline.push({
      $match: {
        'items.outlet': outlet
      }
    });
  }

  // Add pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  pipeline = [
    ...pipeline,
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: '_id',
        as: 'staffDetails'
      }
    },
    {
      $project: {
        sessionId: 1,
        guestName: 1,
        roomNumber: 1,
        items: 1,
        subtotal: 1,
        totalTax: 1,
        totalDiscount: 1,
        grandTotal: 1,
        paymentMethod: 1,
        status: 1,
        createdAt: 1,
        paidAt: 1,
        notes: 1,
        staffName: { $arrayElemAt: ['$staffDetails.name', 0] }
      }
    },
    { $sort: { paidAt: -1 } },
    { $skip: skip },
    { $limit: parseInt(limit) }
  ];

  const transactions = await BillingSession.aggregate(pipeline);
  
  // Get total count for pagination
  const totalCount = await BillingSession.countDocuments(matchQuery);

  res.json({
    status: 'success',
    data: {
      transactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(totalCount / parseInt(limit)),
        total: totalCount,
        limit: parseInt(limit)
      },
      filters: { startDate, endDate, status, paymentMethod, outlet }
    }
  });
}));

// Payment Methods Analysis - Breakdown by payment type
router.get('/payment-methods', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    hotelId
  } = req.query;

  if (!startDate || !endDate) {
    throw new ApplicationError('Start date and end date are required', 400);
  }

  const matchQuery = {
    status: { $in: ['paid', 'room_charged'] },
    paidAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (req.user.role === 'staff' && req.user.hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(req.user.hotelId);
  } else if (hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: '$paymentMethod',
        totalAmount: { $sum: '$grandTotal' },
        transactionCount: { $sum: 1 },
        averageTransactionValue: { $avg: '$grandTotal' },
        totalTax: { $sum: '$totalTax' }
      }
    },
    { $sort: { totalAmount: -1 } }
  ];

  const results = await BillingSession.aggregate(pipeline);
  
  const totalRevenue = results.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalTransactions = results.reduce((sum, item) => sum + item.transactionCount, 0);

  res.json({
    status: 'success',
    data: {
      paymentMethods: results.map(item => ({
        method: item._id,
        totalAmount: item.totalAmount,
        transactionCount: item.transactionCount,
        averageTransactionValue: item.averageTransactionValue,
        totalTax: item.totalTax,
        revenuePercentage: totalRevenue > 0 ? (item.totalAmount / totalRevenue * 100).toFixed(1) : 0,
        transactionPercentage: totalTransactions > 0 ? (item.transactionCount / totalTransactions * 100).toFixed(1) : 0
      })),
      summary: {
        totalRevenue,
        totalTransactions,
        averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0
      },
      period: { startDate, endDate }
    }
  });
}));

// Top Items Report - Best-selling menu items
router.get('/top-items', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    limit = 20,
    hotelId
  } = req.query;

  if (!startDate || !endDate) {
    throw new ApplicationError('Start date and end date are required', 400);
  }

  const matchQuery = {
    status: { $in: ['paid', 'room_charged'] },
    paidAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (req.user.role === 'staff' && req.user.hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(req.user.hotelId);
  } else if (hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
  }

  const pipeline = [
    { $match: matchQuery },
    { $unwind: '$items' },
    {
      $group: {
        _id: {
          itemId: '$items.itemId',
          name: '$items.name',
          category: '$items.category',
          outlet: '$items.outlet'
        },
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        averagePrice: { $avg: '$items.price' },
        totalTax: { $sum: '$items.tax' },
        orderCount: { $sum: 1 }
      }
    },
    {
      $project: {
        name: '$_id.name',
        category: '$_id.category',
        outlet: '$_id.outlet',
        totalQuantity: 1,
        totalRevenue: 1,
        averagePrice: 1,
        totalTax: 1,
        orderCount: 1
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: parseInt(limit) }
  ];

  const results = await BillingSession.aggregate(pipeline);

  const totalRevenue = results.reduce((sum, item) => sum + item.totalRevenue, 0);

  res.json({
    status: 'success',
    data: {
      items: results.map((item, index) => ({
        ...item,
        rank: index + 1,
        revenuePercentage: totalRevenue > 0 ? (item.totalRevenue / totalRevenue * 100).toFixed(1) : 0
      })),
      summary: {
        totalUniqueItems: results.length,
        totalRevenue
      },
      period: { startDate, endDate }
    }
  });
}));

// Staff Performance Report - Transactions by staff member
router.get('/staff-performance', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    hotelId
  } = req.query;

  if (!startDate || !endDate) {
    throw new ApplicationError('Start date and end date are required', 400);
  }

  const matchQuery = {
    status: { $in: ['paid', 'room_charged'] },
    paidAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (req.user.role === 'staff' && req.user.hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(req.user.hotelId);
  } else if (hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: '_id',
        as: 'staff'
      }
    },
    { $unwind: '$staff' },
    {
      $group: {
        _id: '$staff._id',
        staffName: { $first: '$staff.name' },
        staffEmail: { $first: '$staff.email' },
        transactionCount: { $sum: 1 },
        totalRevenue: { $sum: '$grandTotal' },
        averageTransactionValue: { $avg: '$grandTotal' },
        totalItemsSold: { $sum: { $size: '$items' } }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ];

  const results = await BillingSession.aggregate(pipeline);

  const totalRevenue = results.reduce((sum, item) => sum + item.totalRevenue, 0);
  const totalTransactions = results.reduce((sum, item) => sum + item.transactionCount, 0);

  res.json({
    status: 'success',
    data: {
      staff: results.map((item, index) => ({
        ...item,
        rank: index + 1,
        revenuePercentage: totalRevenue > 0 ? (item.totalRevenue / totalRevenue * 100).toFixed(1) : 0,
        transactionPercentage: totalTransactions > 0 ? (item.transactionCount / totalTransactions * 100).toFixed(1) : 0
      })),
      summary: {
        totalStaff: results.length,
        totalRevenue,
        totalTransactions,
        averageRevenuePerStaff: results.length > 0 ? totalRevenue / results.length : 0
      },
      period: { startDate, endDate }
    }
  });
}));

// Guest Analytics Report - Room charge summaries by guest
router.get('/guest-analytics', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    limit = 50,
    hotelId
  } = req.query;

  if (!startDate || !endDate) {
    throw new ApplicationError('Start date and end date are required', 400);
  }

  const matchQuery = {
    status: { $in: ['paid', 'room_charged'] },
    paidAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (req.user.role === 'staff' && req.user.hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(req.user.hotelId);
  } else if (hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: {
          guestName: '$guestName',
          roomNumber: '$roomNumber'
        },
        totalSpent: { $sum: '$grandTotal' },
        transactionCount: { $sum: 1 },
        averageTransactionValue: { $avg: '$grandTotal' },
        totalItemsPurchased: { $sum: { $size: '$items' } },
        paymentMethods: { $addToSet: '$paymentMethod' },
        lastTransaction: { $max: '$paidAt' },
        roomCharges: {
          $sum: {
            $cond: [{ $eq: ['$paymentMethod', 'room_charge'] }, '$grandTotal', 0]
          }
        }
      }
    },
    {
      $project: {
        guestName: '$_id.guestName',
        roomNumber: '$_id.roomNumber',
        totalSpent: 1,
        transactionCount: 1,
        averageTransactionValue: 1,
        totalItemsPurchased: 1,
        paymentMethods: 1,
        lastTransaction: 1,
        roomCharges: 1,
        roomChargePercentage: {
          $cond: [
            { $gt: ['$totalSpent', 0] },
            { $multiply: [{ $divide: ['$roomCharges', '$totalSpent'] }, 100] },
            0
          ]
        }
      }
    },
    { $sort: { totalSpent: -1 } },
    { $limit: parseInt(limit) }
  ];

  const results = await BillingSession.aggregate(pipeline);

  const totalRevenue = results.reduce((sum, item) => sum + item.totalSpent, 0);

  res.json({
    status: 'success',
    data: {
      guests: results.map((item, index) => ({
        ...item,
        rank: index + 1,
        spendingPercentage: totalRevenue > 0 ? (item.totalSpent / totalRevenue * 100).toFixed(1) : 0
      })),
      summary: {
        totalGuests: results.length,
        totalRevenue,
        averageSpendPerGuest: results.length > 0 ? totalRevenue / results.length : 0,
        totalRoomCharges: results.reduce((sum, item) => sum + item.roomCharges, 0)
      },
      period: { startDate, endDate }
    }
  });
}));

// Peak Hours Analysis - Busiest times analysis
router.get('/peak-hours', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    hotelId
  } = req.query;

  if (!startDate || !endDate) {
    throw new ApplicationError('Start date and end date are required', 400);
  }

  const matchQuery = {
    status: { $in: ['paid', 'room_charged'] },
    paidAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (req.user.role === 'staff' && req.user.hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(req.user.hotelId);
  } else if (hotelId) {
    matchQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: {
          hour: { $hour: '$paidAt' },
          dayOfWeek: { $dayOfWeek: '$paidAt' }
        },
        transactionCount: { $sum: 1 },
        totalRevenue: { $sum: '$grandTotal' },
        averageTransactionValue: { $avg: '$grandTotal' }
      }
    },
    {
      $group: {
        _id: '$_id.hour',
        transactionCount: { $sum: '$transactionCount' },
        totalRevenue: { $sum: '$totalRevenue' },
        averageTransactionValue: { $avg: '$averageTransactionValue' },
        dayBreakdown: {
          $push: {
            dayOfWeek: '$_id.dayOfWeek',
            transactions: '$transactionCount',
            revenue: '$totalRevenue'
          }
        }
      }
    },
    { $sort: { '_id': 1 } }
  ];

  const results = await BillingSession.aggregate(pipeline);

  // Day of week analysis
  const dayPipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: { $dayOfWeek: '$paidAt' },
        transactionCount: { $sum: 1 },
        totalRevenue: { $sum: '$grandTotal' }
      }
    },
    { $sort: { '_id': 1 } }
  ];

  const dayResults = await BillingSession.aggregate(dayPipeline);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Find peak hours and days
  const peakHour = results.reduce((max, item) => 
    item.transactionCount > max.transactionCount ? item : max, 
    { transactionCount: 0, _id: 0 }
  );

  const peakDay = dayResults.reduce((max, item) => 
    item.transactionCount > max.transactionCount ? item : max, 
    { transactionCount: 0, _id: 1 }
  );

  res.json({
    status: 'success',
    data: {
      hourlyAnalysis: results.map(item => ({
        hour: item._id,
        hourFormatted: `${item._id.toString().padStart(2, '0')}:00`,
        transactionCount: item.transactionCount,
        totalRevenue: item.totalRevenue,
        averageTransactionValue: item.averageTransactionValue
      })),
      dailyAnalysis: dayResults.map(item => ({
        dayOfWeek: item._id,
        dayName: dayNames[item._id - 1],
        transactionCount: item.transactionCount,
        totalRevenue: item.totalRevenue
      })),
      insights: {
        peakHour: {
          hour: peakHour._id,
          hourFormatted: `${peakHour._id.toString().padStart(2, '0')}:00`,
          transactions: peakHour.transactionCount
        },
        peakDay: {
          dayOfWeek: peakDay._id,
          dayName: dayNames[peakDay._id - 1],
          transactions: peakDay.transactionCount
        }
      },
      period: { startDate, endDate }
    }
  });
}));

export default router;