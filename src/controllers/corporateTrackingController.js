import CorporateCompany from '../models/CorporateCompany.js';
import GroupBooking from '../models/GroupBooking.js';
import CorporateCredit from '../models/CorporateCredit.js';
import Booking from '../models/Booking.js';
import KPI from '../models/KPI.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';

/**
 * @swagger
 * tags:
 *   name: Corporate Tracking
 *   description: Admin dashboard for corporate booking tracking and analytics
 */

/**
 * @swagger
 * /api/v1/corporate/admin/dashboard-overview:
 *   get:
 *     summary: Get corporate dashboard overview metrics
 *     tags: [Corporate Tracking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Corporate dashboard overview data
 */
export const getCorporateDashboardOverview = catchAsync(async (req, res, next) => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const startOfMonth = new Date(currentYear, currentMonth, 1);
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const startOfYear = new Date(currentYear, 0, 1);

  // Total corporate companies
  const totalCompanies = await CorporateCompany.countDocuments({ isActive: true });
  const newCompaniesThisMonth = await CorporateCompany.countDocuments({
    isActive: true,
    createdAt: { $gte: startOfMonth, $lte: endOfMonth }
  });

  // Corporate bookings metrics - using checkIn dates for actual stays
  const totalCorporateBookings = await Booking.countDocuments({
    hotelId: req.user.hotelId,
    'corporateBooking.corporateCompanyId': { $exists: true },
    checkIn: { $gte: startOfYear }
  });

  const monthlyBookings = await Booking.countDocuments({
    hotelId: req.user.hotelId,
    'corporateBooking.corporateCompanyId': { $exists: true },
    checkIn: { $gte: startOfMonth, $lte: endOfMonth }
  });

  // Revenue metrics - using checkIn dates for actual revenue realization
  const monthlyRevenue = await Booking.aggregate([
    {
      $match: {
        hotelId: req.user.hotelId,
        'corporateBooking.corporateCompanyId': { $exists: true },
        checkIn: { $gte: startOfMonth, $lte: endOfMonth },
        status: { $nin: ['cancelled', 'no_show'] }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        averageBookingValue: { $avg: '$totalAmount' }
      }
    }
  ]);

  const yearlyRevenue = await Booking.aggregate([
    {
      $match: {
        hotelId: req.user.hotelId,
        'corporateBooking.corporateCompanyId': { $exists: true },
        checkIn: { $gte: startOfYear },
        status: { $nin: ['cancelled', 'no_show'] }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' }
      }
    }
  ]);

  // Group bookings metrics
  const activeGroupBookings = await GroupBooking.countDocuments({
    hotelId: req.user.hotelId,
    status: { $in: ['draft', 'confirmed', 'partially_confirmed'] }
  });

  const upcomingGroupBookings = await GroupBooking.countDocuments({
    hotelId: req.user.hotelId,
    checkIn: { $gte: currentDate },
    status: { $in: ['confirmed', 'partially_confirmed'] }
  });

  // Credit metrics
  const totalCreditExposure = await CorporateCredit.aggregate([
    {
      $match: {
        hotelId: req.user.hotelId,
        transactionType: { $in: ['debit', 'adjustment'] },
        status: { $in: ['approved', 'pending'] }
      }
    },
    {
      $group: {
        _id: null,
        totalExposure: { $sum: '$amount' }
      }
    }
  ]);

  const overdueAmount = await CorporateCredit.aggregate([
    {
      $match: {
        hotelId: req.user.hotelId,
        transactionType: { $in: ['debit', 'adjustment'] },
        status: 'approved',
        dueDate: { $lt: currentDate }
      }
    },
    {
      $group: {
        _id: null,
        overdueAmount: { $sum: '$amount' }
      }
    }
  ]);

  // Top performing companies - using checkIn dates for actual performance
  const topCompanies = await Booking.aggregate([
    {
      $match: {
        hotelId: req.user.hotelId,
        'corporateBooking.corporateCompanyId': { $exists: true },
        checkIn: { $gte: startOfYear },
        status: { $nin: ['cancelled', 'no_show'] }
      }
    },
    {
      $group: {
        _id: '$corporateBooking.corporateCompanyId',
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageBookingValue: { $avg: '$totalAmount' }
      }
    },
    {
      $lookup: {
        from: 'corporatecompanies',
        localField: '_id',
        foreignField: '_id',
        as: 'company'
      }
    },
    {
      $unwind: '$company'
    },
    {
      $sort: { totalRevenue: -1 }
    },
    {
      $limit: 5
    },
    {
      $project: {
        companyName: '$company.name',
        totalBookings: 1,
        totalRevenue: 1,
        averageBookingValue: { $round: ['$averageBookingValue', 2] }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      overview: {
        companies: {
          total: totalCompanies,
          newThisMonth: newCompaniesThisMonth
        },
        bookings: {
          totalYearly: totalCorporateBookings,
          thisMonth: monthlyBookings
        },
        revenue: {
          monthly: monthlyRevenue[0]?.totalRevenue || 0,
          yearly: yearlyRevenue[0]?.totalRevenue || 0,
          averageBookingValue: Math.round((monthlyRevenue[0]?.averageBookingValue || 0) * 100) / 100
        },
        groupBookings: {
          active: activeGroupBookings,
          upcoming: upcomingGroupBookings
        },
        credit: {
          totalExposure: totalCreditExposure[0]?.totalExposure || 0,
          overdueAmount: overdueAmount[0]?.overdueAmount || 0
        }
      },
      topCompanies
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/admin/monthly-trends:
 *   get:
 *     summary: Get monthly trends for corporate bookings
 *     tags: [Corporate Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 12
 *         description: Number of months to retrieve
 *     responses:
 *       200:
 *         description: Monthly trends data
 */
export const getMonthlyTrends = catchAsync(async (req, res, next) => {
  const months = parseInt(req.query.months) || 12;
  const currentDate = new Date();
  const startDate = new Date(currentDate);
  startDate.setMonth(startDate.getMonth() - months);

  const monthlyTrends = await Booking.aggregate([
    {
      $match: {
        'corporateBooking.corporateCompanyId': { $exists: true },
        checkIn: { $gte: startDate },
        status: { $nin: ['cancelled', 'no_show'] }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$checkIn' },
          month: { $month: '$checkIn' }
        },
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageRevenue: { $avg: '$totalAmount' },
        uniqueCompanies: { $addToSet: '$corporateBooking.corporateCompanyId' }
      }
    },
    {
      $addFields: {
        uniqueCompaniesCount: { $size: '$uniqueCompanies' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    },
    {
      $project: {
        year: '$_id.year',
        month: '$_id.month',
        totalBookings: 1,
        totalRevenue: 1,
        averageRevenue: { $round: ['$averageRevenue', 2] },
        uniqueCompaniesCount: 1
      }
    }
  ]);

  // Fill in missing months with zero values
  const completeData = [];
  const current = new Date(startDate);
  
  while (current <= currentDate) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;
    
    const existingData = monthlyTrends.find(item => 
      item.year === year && item.month === month
    );
    
    completeData.push({
      year,
      month,
      monthName: current.toLocaleDateString('en-US', { month: 'short' }),
      totalBookings: existingData?.totalBookings || 0,
      totalRevenue: existingData?.totalRevenue || 0,
      averageRevenue: existingData?.averageRevenue || 0,
      uniqueCompaniesCount: existingData?.uniqueCompaniesCount || 0
    });
    
    current.setMonth(current.getMonth() + 1);
  }

  res.status(200).json({
    status: 'success',
    results: completeData.length,
    data: {
      trends: completeData
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/admin/company-performance:
 *   get:
 *     summary: Get detailed performance metrics for all corporate companies
 *     tags: [Corporate Tracking]
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
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [revenue, bookings, lastBooking, creditUtilization]
 *           default: revenue
 *     responses:
 *       200:
 *         description: Company performance data
 */
export const getCompanyPerformance = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const sortBy = req.query.sortBy || 'revenue';
  const skip = (page - 1) * limit;

  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);

  const companies = await CorporateCompany.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $lookup: {
        from: 'bookings',
        let: { companyId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$corporateBooking.corporateCompanyId', '$$companyId'] },
                  { $gte: ['$createdAt', startOfYear] },
                  { $nin: ['$status', ['cancelled', 'no_show']] }
                ]
              }
            }
          }
        ],
        as: 'bookings'
      }
    },
    {
      $lookup: {
        from: 'corporatecredits',
        let: { companyId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$corporateCompanyId', '$$companyId'] },
                  { $in: ['$transactionType', ['debit', 'adjustment']] },
                  { $eq: ['$status', 'approved'] }
                ]
              }
            }
          }
        ],
        as: 'creditTransactions'
      }
    },
    {
      $addFields: {
        totalBookings: { $size: '$bookings' },
        totalRevenue: { $sum: '$bookings.totalAmount' },
        averageBookingValue: { $avg: '$bookings.totalAmount' },
        lastBookingDate: { $max: '$bookings.createdAt' },
        creditUtilized: { $sum: '$creditTransactions.amount' },
        creditUtilizationPercentage: {
          $cond: [
            { $gt: ['$creditLimit', 0] },
            { $multiply: [{ $divide: [{ $sum: '$creditTransactions.amount' }, '$creditLimit'] }, 100] },
            0
          ]
        }
      }
    },
    {
      $project: {
        name: 1,
        email: 1,
        phone: 1,
        gstNumber: 1,
        creditLimit: 1,
        paymentTerms: 1,
        totalBookings: 1,
        totalRevenue: { $round: ['$totalRevenue', 2] },
        averageBookingValue: { $round: ['$averageBookingValue', 2] },
        lastBookingDate: 1,
        creditUtilized: { $round: ['$creditUtilized', 2] },
        creditUtilizationPercentage: { $round: ['$creditUtilizationPercentage', 2] },
        availableCredit: { $subtract: ['$creditLimit', { $ifNull: ['$creditUtilized', 0] }] }
      }
    }
  ]);

  // Sort based on sortBy parameter
  let sortField = {};
  switch (sortBy) {
    case 'bookings':
      sortField = { totalBookings: -1 };
      break;
    case 'lastBooking':
      sortField = { lastBookingDate: -1 };
      break;
    case 'creditUtilization':
      sortField = { creditUtilizationPercentage: -1 };
      break;
    default:
      sortField = { totalRevenue: -1 };
  }

  const sortedCompanies = companies.sort((a, b) => {
    const aVal = a[Object.keys(sortField)[0]] || 0;
    const bVal = b[Object.keys(sortField)[0]] || 0;
    return Object.values(sortField)[0] === -1 ? bVal - aVal : aVal - bVal;
  });

  const paginatedCompanies = sortedCompanies.slice(skip, skip + limit);

  res.status(200).json({
    status: 'success',
    results: paginatedCompanies.length,
    totalResults: companies.length,
    currentPage: page,
    totalPages: Math.ceil(companies.length / limit),
    data: {
      companies: paginatedCompanies
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/admin/booking-analytics:
 *   get:
 *     summary: Get detailed booking analytics for corporate bookings
 *     tags: [Corporate Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Booking analytics data
 */
export const getBookingAnalytics = catchAsync(async (req, res, next) => {
  const period = req.query.period || 'month';
  
  let startDate;
  const currentDate = new Date();
  
  switch (period) {
    case 'week':
      startDate = new Date(currentDate);
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'quarter':
      startDate = new Date(currentDate);
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'year':
      startDate = new Date(currentDate);
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default: // month
      startDate = new Date(currentDate);
      startDate.setMonth(startDate.getMonth() - 1);
  }

  // Booking status distribution
  const statusDistribution = await Booking.aggregate([
    {
      $match: {
        'corporateBooking.corporateCompanyId': { $exists: true },
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        revenue: { $sum: '$totalAmount' }
      }
    }
  ]);

  // Payment method analysis
  const paymentMethodAnalysis = await Booking.aggregate([
    {
      $match: {
        'corporateBooking.corporateCompanyId': { $exists: true },
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$corporateBooking.paymentMethod',
        count: { $sum: 1 },
        revenue: { $sum: '$totalAmount' }
      }
    }
  ]);

  // Advance booking analysis (how far in advance bookings are made)
  const advanceBookingAnalysis = await Booking.aggregate([
    {
      $match: {
        'corporateBooking.corporateCompanyId': { $exists: true },
        createdAt: { $gte: startDate }
      }
    },
    {
      $addFields: {
        advanceDays: {
          $divide: [
            { $subtract: ['$checkIn', '$createdAt'] },
            86400000 // milliseconds in a day
          ]
        }
      }
    },
    {
      $bucket: {
        groupBy: '$advanceDays',
        boundaries: [0, 1, 7, 14, 30, 60, 90, 365],
        default: 'over_year',
        output: {
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      }
    }
  ]);

  // Room type preferences
  const roomTypePreferences = await Booking.aggregate([
    {
      $match: {
        'corporateBooking.corporateCompanyId': { $exists: true },
        createdAt: { $gte: startDate }
      }
    },
    {
      $unwind: '$rooms'
    },
    {
      $lookup: {
        from: 'rooms',
        localField: 'rooms.roomId',
        foreignField: '_id',
        as: 'roomDetails'
      }
    },
    {
      $unwind: '$roomDetails'
    },
    {
      $group: {
        _id: '$roomDetails.type',
        count: { $sum: 1 },
        revenue: { $sum: '$rooms.rate' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  // Average stay duration
  const avgStayDuration = await Booking.aggregate([
    {
      $match: {
        'corporateBooking.corporateCompanyId': { $exists: true },
        createdAt: { $gte: startDate }
      }
    },
    {
      $addFields: {
        stayDuration: {
          $divide: [
            { $subtract: ['$checkOut', '$checkIn'] },
            86400000 // milliseconds in a day
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        averageStay: { $avg: '$stayDuration' },
        minStay: { $min: '$stayDuration' },
        maxStay: { $max: '$stayDuration' }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      period,
      analytics: {
        statusDistribution,
        paymentMethodAnalysis,
        advanceBookingAnalysis,
        roomTypePreferences,
        stayDuration: {
          average: Math.round((avgStayDuration[0]?.averageStay || 0) * 10) / 10,
          minimum: avgStayDuration[0]?.minStay || 0,
          maximum: avgStayDuration[0]?.maxStay || 0
        }
      }
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/admin/credit-analysis:
 *   get:
 *     summary: Get comprehensive credit analysis for corporate companies
 *     tags: [Corporate Tracking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Credit analysis data
 */
export const getCreditAnalysis = catchAsync(async (req, res, next) => {
  const currentDate = new Date();

  // Credit utilization by company
  const creditUtilization = await CorporateCompany.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $lookup: {
        from: 'corporatecredits',
        let: { companyId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$corporateCompanyId', '$$companyId'] },
                  { $in: ['$transactionType', ['debit', 'adjustment']] },
                  { $eq: ['$status', 'approved'] }
                ]
              }
            }
          }
        ],
        as: 'debitTransactions'
      }
    },
    {
      $lookup: {
        from: 'corporatecredits',
        let: { companyId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$corporateCompanyId', '$$companyId'] },
                  { $in: ['$transactionType', ['credit', 'payment']] },
                  { $eq: ['$status', 'approved'] }
                ]
              }
            }
          }
        ],
        as: 'creditTransactions'
      }
    },
    {
      $addFields: {
        totalDebits: { $sum: '$debitTransactions.amount' },
        totalCredits: { $sum: '$creditTransactions.amount' },
        outstandingBalance: {
          $subtract: [
            { $sum: '$debitTransactions.amount' },
            { $sum: '$creditTransactions.amount' }
          ]
        }
      }
    },
    {
      $addFields: {
        creditUtilizationPercentage: {
          $cond: [
            { $gt: ['$creditLimit', 0] },
            { $multiply: [{ $divide: ['$outstandingBalance', '$creditLimit'] }, 100] },
            0
          ]
        },
        availableCredit: { $subtract: ['$creditLimit', '$outstandingBalance'] }
      }
    },
    {
      $project: {
        name: 1,
        creditLimit: 1,
        outstandingBalance: { $round: ['$outstandingBalance', 2] },
        availableCredit: { $round: ['$availableCredit', 2] },
        creditUtilizationPercentage: { $round: ['$creditUtilizationPercentage', 2] }
      }
    },
    {
      $sort: { creditUtilizationPercentage: -1 }
    }
  ]);

  // Overdue analysis
  const overdueAnalysis = await CorporateCredit.aggregate([
    {
      $match: {
        transactionType: { $in: ['debit', 'adjustment'] },
        status: 'approved',
        dueDate: { $lt: currentDate }
      }
    },
    {
      $lookup: {
        from: 'corporatecompanies',
        localField: 'corporateCompanyId',
        foreignField: '_id',
        as: 'company'
      }
    },
    {
      $unwind: '$company'
    },
    {
      $addFields: {
        daysOverdue: {
          $ceil: {
            $divide: [
              { $subtract: [currentDate, '$dueDate'] },
              86400000
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: '$corporateCompanyId',
        companyName: { $first: '$company.name' },
        totalOverdueAmount: { $sum: '$amount' },
        overdueTransactions: { $sum: 1 },
        maxDaysOverdue: { $max: '$daysOverdue' },
        avgDaysOverdue: { $avg: '$daysOverdue' }
      }
    },
    {
      $sort: { totalOverdueAmount: -1 }
    }
  ]);

  // Payment trends
  const paymentTrends = await CorporateCredit.aggregate([
    {
      $match: {
        transactionType: 'payment',
        status: 'approved',
        transactionDate: { $gte: new Date(currentDate.getFullYear(), 0, 1) }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$transactionDate' },
          month: { $month: '$transactionDate' }
        },
        totalPayments: { $sum: '$amount' },
        paymentCount: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);

  // Credit limit distribution
  const creditLimitDistribution = await CorporateCompany.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $bucket: {
        groupBy: '$creditLimit',
        boundaries: [0, 50000, 100000, 250000, 500000, 1000000],
        default: 'over_1M',
        output: {
          count: { $sum: 1 },
          companies: { $push: '$name' }
        }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      creditUtilization: creditUtilization.slice(0, 20), // Top 20 companies
      overdueAnalysis,
      paymentTrends,
      creditLimitDistribution,
      summary: {
        totalCompaniesWithCredit: creditUtilization.length,
        companiesOverdue: overdueAnalysis.length,
        totalOverdueAmount: overdueAnalysis.reduce((sum, item) => sum + item.totalOverdueAmount, 0)
      }
    }
  });
});
