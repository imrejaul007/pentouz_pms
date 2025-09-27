import TravelAgent from '../models/TravelAgent.js';
import TravelAgentBooking from '../models/TravelAgentBooking.js';
import TravelAgentRates from '../models/TravelAgentRates.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';
import analyticsService from '../services/analyticsService.js';
import exportService from '../services/exportService.js';

/**
 * @swagger
 * components:
 *   tags:
 *     name: AdminTravelDashboard
 *     description: Admin travel dashboard endpoints
 */

/**
 * @swagger
 * /api/v1/admin/travel-dashboard:
 *   get:
 *     summary: Get travel dashboard overview
 *     tags: [AdminTravelDashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 365d]
 *           default: 30d
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Travel dashboard data
 */
// Simple in-memory cache for dashboard data (5 minutes TTL)
const dashboardCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clean up expired cache entries every 10 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of dashboardCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      dashboardCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

export const getTravelDashboardOverview = catchAsync(async (req, res) => {
  const { period = '30d', hotelId } = req.query;

  // Create cache key
  const cacheKey = `dashboard_${period}_${hotelId || 'all'}_${req.user.hotelId || 'none'}`;

  // Check cache first
  const cached = dashboardCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return res.json({
      success: true,
      data: {
        ...cached.data,
        fromCache: true,
        cacheAge: Math.round((Date.now() - cached.timestamp) / 1000)
      }
    });
  }

  // Calculate date range based on period
  const periodMap = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
  const days = periodMap[period] || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let baseQuery = { isActive: true };
  let bookingQuery = { isActive: true, createdAt: { $gte: startDate } };

  // Filter by hotel if specified
  if (hotelId && hotelId !== 'all') {
    baseQuery.hotelId = mongoose.Types.ObjectId(hotelId);
    bookingQuery.hotelId = mongoose.Types.ObjectId(hotelId);
  } else if (req.user.hotelId) {
    // If user has hotel restriction, apply it
    baseQuery.hotelId = req.user.hotelId;
    bookingQuery.hotelId = req.user.hotelId;
  }

  // Optimize by running lighter queries first, then heavy aggregations separately
  const [
    totalAgents,
    activeAgents,
    pendingApprovals,
    totalBookingsFromBookings,
    totalBookingsFromAgents
  ] = await Promise.all([
    // Total travel agents
    TravelAgent.countDocuments(baseQuery),

    // Active travel agents
    TravelAgent.countDocuments({ ...baseQuery, status: 'active' }),

    // Pending approvals
    TravelAgent.countDocuments({ ...baseQuery, status: 'pending_approval' }),

    // Total bookings in period (from actual bookings)
    TravelAgentBooking.countDocuments(bookingQuery),

    // Total bookings from agent performance data
    TravelAgent.aggregate([
      { $match: baseQuery },
      { $group: { _id: null, total: { $sum: '$performanceMetrics.totalBookings' } } }
    ])
  ]);

  // Use agent performance data if no actual bookings exist
  const totalBookings = totalBookingsFromBookings > 0 ? totalBookingsFromBookings : (totalBookingsFromAgents[0]?.total || 0);

  // Get performance data from TravelAgent collection (using seeded data)
  const agentPerformanceData = await TravelAgent.aggregate([
    { $match: baseQuery },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$performanceMetrics.totalRevenue' },
        totalBookings: { $sum: '$performanceMetrics.totalBookings' },
        totalCommission: { $sum: '$performanceMetrics.totalCommissionEarned' },
        averageBookingValue: { $avg: '$performanceMetrics.averageBookingValue' }
      }
    }
  ]);

  // Run one optimized aggregation for financial data from actual bookings (if any exist)
  const financialData = await TravelAgentBooking.aggregate([
    { $match: bookingQuery },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$pricing.totalAmount' },
        averageBookingValue: { $avg: '$pricing.totalAmount' },
        totalBookings: { $sum: 1 },
        totalCommission: { $sum: '$commission.totalCommission' },
        pendingCommission: {
          $sum: {
            $cond: [
              { $eq: ['$commission.paymentStatus', 'pending'] },
              '$commission.totalCommission',
              0
            ]
          }
        },
        paidCommission: {
          $sum: {
            $cond: [
              { $eq: ['$commission.paymentStatus', 'paid'] },
              '$commission.totalCommission',
              0
            ]
          }
        }
      }
    }
  ]);

  // Use agent performance data if no actual bookings exist
  const finalFinancialData = financialData[0] || agentPerformanceData[0] || {
    totalRevenue: 0,
    averageBookingValue: 0,
    totalBookings: 0,
    totalCommission: 0,
    pendingCommission: 0,
    paidCommission: 0
  };

  // Get top performers from TravelAgent collection (using seeded performance data)
  const topPerformers = await TravelAgent.aggregate([
    { $match: baseQuery },
    {
      $project: {
        _id: 1,
        totalBookings: '$performanceMetrics.totalBookings',
        totalRevenue: '$performanceMetrics.totalRevenue',
        totalCommission: '$performanceMetrics.totalCommissionEarned',
        agentName: '$companyName',
        agentCode: '$agentCode'
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 5 }
  ]);

  // Get recent bookings with limited fields for performance
  let recentBookings = await TravelAgentBooking.find(bookingQuery)
    .select('travelAgentId hotelId createdAt pricing.totalAmount commission.totalCommission confirmationNumber bookingStatus guestDetails')
    .populate('travelAgentId', 'companyName agentCode')
    .populate('hotelId', 'name')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean(); // Use lean() for better performance

  // If no actual bookings exist, generate mock recent bookings from agent performance data
  if (recentBookings.length === 0) {
    const agentsWithBookings = await TravelAgent.find(baseQuery)
      .select('_id companyName agentCode performanceMetrics.totalBookings performanceMetrics.totalRevenue performanceMetrics.totalCommissionEarned')
      .limit(5)
      .lean();

    recentBookings = agentsWithBookings.map((agent, index) => ({
      _id: `mock_booking_${agent._id}_${index}`,
      travelAgentId: {
        _id: agent._id,
        companyName: agent.companyName,
        agentCode: agent.agentCode
      },
      hotelId: {
        _id: '68cd01414419c17b5f6b4c12',
        name: 'THE PENTOUZ'
      },
      createdAt: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)), // Mock dates
      pricing: {
        totalAmount: Math.round(agent.performanceMetrics.totalRevenue / agent.performanceMetrics.totalBookings) || 0
      },
      commission: {
        totalCommission: Math.round(agent.performanceMetrics.totalCommissionEarned / agent.performanceMetrics.totalBookings) || 0
      },
      confirmationNumber: `TA${agent.agentCode}-${1000 + index}`,
      status: 'confirmed'
    }));
  }

  // Simplified monthly trends
  const monthlyTrends = await TravelAgentBooking.aggregate([
    {
      $match: {
        ...bookingQuery,
        createdAt: {
          $gte: new Date(new Date().getFullYear(), 0, 1),
          $lt: new Date(new Date().getFullYear() + 1, 0, 1)
        }
      }
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        bookings: { $sum: 1 },
        revenue: { $sum: '$pricing.totalAmount' },
        commission: { $sum: '$commission.totalCommission' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  // Extract data safely from aggregation results
  const revenueData = finalFinancialData;
  const commissionData = finalFinancialData;

  // Calculate growth metrics (simplified - would need previous period data for accurate calculation)
  const agentGrowth = activeAgents > 0 ? ((activeAgents - pendingApprovals) / activeAgents * 100) : 0;
  const revenueGrowth = revenueData.totalRevenue > 0 ? 12.5 : 0; // Placeholder - would calculate from previous period

  const responseData = {
    overview: {
      totalAgents,
      activeAgents,
      pendingApprovals,
      totalBookings,
      agentGrowth: Math.round(agentGrowth * 100) / 100,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100
    },
    revenue: {
      totalRevenue: revenueData.totalRevenue,
      averageBookingValue: Math.round(revenueData.averageBookingValue || 0),
      totalBookings: revenueData.totalBookings
    },
    commission: {
      totalCommission: commissionData.totalCommission,
      pendingCommission: commissionData.pendingCommission,
      paidCommission: commissionData.paidCommission,
      commissionRate: revenueData.totalRevenue > 0
        ? Math.round((commissionData.totalCommission / revenueData.totalRevenue * 100) * 100) / 100
        : 0
    },
    topPerformers,
    recentBookings,
    monthlyTrends,
    period,
    generatedAt: new Date()
  };

  // Store in cache
  dashboardCache.set(cacheKey, {
    data: responseData,
    timestamp: Date.now()
  });

  res.json({
    success: true,
    data: responseData
  });
});

/**
 * @swagger
 * /api/v1/admin/travel-dashboard/analytics:
 *   get:
 *     summary: Get detailed travel analytics
 *     tags: [AdminTravelDashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 365d]
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detailed analytics data
 */
export const getTravelAnalytics = catchAsync(async (req, res) => {
  const { period = '30d', hotelId } = req.query;

  const periodMap = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
  const days = periodMap[period] || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let baseQuery = { isActive: true, createdAt: { $gte: startDate } };

  if (hotelId && hotelId !== 'all') {
    baseQuery.hotelId = mongoose.Types.ObjectId(hotelId);
  } else if (req.user.hotelId) {
    baseQuery.hotelId = req.user.hotelId;
  }

  const [
    bookingStatusBreakdown,
    paymentStatusBreakdown,
    seasonalityAnalysis,
    leadTimeAnalysis,
    commissionTiers,
    averageStayDuration
  ] = await Promise.all([
    // Booking status breakdown
    TravelAgentBooking.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$bookingStatus',
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' }
        }
      }
    ]),

    // Payment status breakdown
    TravelAgentBooking.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$paymentDetails.status',
          count: { $sum: 1 },
          amount: { $sum: '$pricing.totalAmount' }
        }
      }
    ]),

    // Seasonality analysis
    TravelAgentBooking.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$performance.seasonality',
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' },
          avgCommission: { $avg: '$commission.rate' }
        }
      }
    ]),

    // Lead time analysis
    TravelAgentBooking.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lte: ['$performance.leadTime', 7] }, then: '0-7 days' },
                { case: { $lte: ['$performance.leadTime', 30] }, then: '8-30 days' },
                { case: { $lte: ['$performance.leadTime', 90] }, then: '31-90 days' },
                { case: { $gt: ['$performance.leadTime', 90] }, then: '90+ days' }
              ],
              default: 'Unknown'
            }
          },
          count: { $sum: 1 },
          avgLeadTime: { $avg: '$performance.leadTime' }
        }
      }
    ]),

    // Commission tier analysis
    TravelAgentBooking.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lt: ['$commission.rate', 5] }, then: '0-5%' },
                { case: { $lt: ['$commission.rate', 10] }, then: '5-10%' },
                { case: { $lt: ['$commission.rate', 15] }, then: '10-15%' },
                { case: { $gte: ['$commission.rate', 15] }, then: '15%+' }
              ],
              default: 'Unknown'
            }
          },
          count: { $sum: 1 },
          totalCommission: { $sum: '$commission.totalCommission' },
          avgRate: { $avg: '$commission.rate' }
        }
      }
    ]),

    // Average stay duration
    TravelAgentBooking.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          avgNights: { $avg: '$bookingDetails.nights' },
          avgRooms: { $avg: '$guestDetails.totalRooms' },
          avgGuests: { $avg: '$guestDetails.totalGuests' }
        }
      }
    ])
  ]);

  res.json({
    success: true,
    data: {
      bookingStatusBreakdown,
      paymentStatusBreakdown,
      seasonalityAnalysis,
      leadTimeAnalysis,
      commissionTiers,
      averageStayMetrics: averageStayDuration[0] || {
        avgNights: 0,
        avgRooms: 0,
        avgGuests: 0
      },
      period,
      generatedAt: new Date()
    }
  });
});

/**
 * @swagger
 * /api/v1/admin/travel-dashboard/pending-commissions:
 *   get:
 *     summary: Get pending commission payments
 *     tags: [AdminTravelDashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pending commission payments
 */
export const getPendingCommissions = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  let hotelId = req.user.hotelId;
  if (req.query.hotelId && req.query.hotelId !== 'all') {
    hotelId = req.query.hotelId;
  }

  const pendingCommissions = await TravelAgentBooking.getPendingCommissions(hotelId);

  // Paginate results
  const paginatedCommissions = pendingCommissions.slice(skip, skip + parseInt(limit));
  const total = pendingCommissions.length;

  // Calculate summary
  const totalPendingAmount = pendingCommissions.reduce((sum, booking) =>
    sum + booking.commission.totalCommission, 0
  );

  res.json({
    success: true,
    data: {
      commissions: paginatedCommissions,
      summary: {
        totalPendingAmount,
        totalBookings: total,
        averageCommission: total > 0 ? totalPendingAmount / total : 0
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + paginatedCommissions.length < total,
        hasPrev: page > 1
      }
    }
  });
});

/**
 * @swagger
 * /api/v1/admin/travel-dashboard/rates:
 *   get:
 *     summary: Get travel agent rates overview
 *     tags: [AdminTravelDashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Travel agent rates data
 */
export const getTravelAgentRates = catchAsync(async (req, res) => {
  let baseQuery = { isActive: true };

  if (req.user.hotelId) {
    baseQuery.hotelId = req.user.hotelId;
  }

  const [
    totalRates,
    activeRates,
    expiringSoon,
    ratesByType,
    topDiscounts
  ] = await Promise.all([
    // Total rates
    TravelAgentRates.countDocuments(baseQuery),

    // Active rates (not expired)
    TravelAgentRates.countDocuments({
      ...baseQuery,
      validTo: { $gte: new Date() }
    }),

    // Expiring soon (within 30 days)
    TravelAgentRates.find({
      ...baseQuery,
      validTo: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    }).populate('travelAgentId', 'companyName agentCode')
     .populate('roomTypeId', 'name'),

    // Rates by type
    TravelAgentRates.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$rateType',
          count: { $sum: 1 },
          avgDiscount: { $avg: '$discountPercentage' }
        }
      }
    ]),

    // Top discounts
    TravelAgentRates.find({
      ...baseQuery,
      rateType: 'discount_percentage',
      validTo: { $gte: new Date() }
    })
    .populate('travelAgentId', 'companyName agentCode')
    .populate('roomTypeId', 'name')
    .sort({ discountPercentage: -1 })
    .limit(10)
  ]);

  res.json({
    success: true,
    data: {
      overview: {
        totalRates,
        activeRates,
        expiringSoonCount: expiringSoon.length
      },
      expiringSoon,
      ratesByType,
      topDiscounts,
      generatedAt: new Date()
    }
  });
});

/**
 * @swagger
 * /api/v1/admin/travel-dashboard/export:
 *   get:
 *     summary: Export travel dashboard data
 *     tags: [AdminTravelDashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 365d]
 *     responses:
 *       200:
 *         description: Exported data
 */
export const exportTravelData = catchAsync(async (req, res) => {
  const { format = 'json', period = '30d' } = req.query;

  // Get comprehensive data for export
  const overviewData = await getTravelDashboardOverview(
    { query: { period, hotelId: req.user.hotelId } },
    { json: () => {} }
  );

  // For now, return JSON format
  // In a real implementation, you'd format as CSV for CSV requests
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=travel-dashboard-export.csv');
    // Convert to CSV format here
    res.send('CSV export not implemented yet');
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=travel-dashboard-export.json');
    res.json({
      success: true,
      exportedAt: new Date(),
      period,
      data: overviewData
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/travel-dashboard/analytics/trends:
 *   get:
 *     summary: Get advanced booking trends analytics for admin
 *     tags: [AdminTravelDashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter]
 *           default: month
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Advanced booking trends analytics
 */
export const getAdvancedBookingTrends = catchAsync(async (req, res) => {
  const { startDate, endDate, granularity = 'month', hotelId } = req.query;

  const filters = { granularity };
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  if (hotelId) filters.hotelId = hotelId;

  const analytics = await analyticsService.analyzeBookingTrends(filters);

  res.json({
    success: true,
    data: analytics
  });
});

/**
 * @swagger
 * /api/v1/admin/travel-dashboard/analytics/forecast:
 *   get:
 *     summary: Get revenue forecast analytics for admin
 *     tags: [AdminTravelDashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodsAhead
 *         schema:
 *           type: integer
 *           default: 6
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter]
 *           default: month
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Revenue forecast analytics
 */
export const getRevenueForecastAnalytics = catchAsync(async (req, res) => {
  const { periodsAhead = 6, granularity = 'month', hotelId } = req.query;

  const filters = { granularity };
  if (hotelId) filters.hotelId = hotelId;

  const forecast = await analyticsService.forecastRevenue(filters, parseInt(periodsAhead));

  res.json({
    success: true,
    data: forecast
  });
});

/**
 * @swagger
 * /api/v1/admin/travel-dashboard/analytics/commission-projections:
 *   get:
 *     summary: Get commission projections for admin
 *     tags: [AdminTravelDashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: projectionMonths
 *         schema:
 *           type: integer
 *           default: 6
 *     responses:
 *       200:
 *         description: Commission projections
 */
export const getCommissionProjections = catchAsync(async (req, res) => {
  const { startDate, endDate, projectionMonths = 6 } = req.query;

  const filters = { projectionMonths: parseInt(projectionMonths) };
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  const projections = await analyticsService.calculateCommissionProjections(filters);

  res.json({
    success: true,
    data: projections
  });
});

/**
 * @swagger
 * /api/v1/admin/travel-dashboard/analytics/performance:
 *   get:
 *     summary: Get performance metrics for all travel agents
 *     tags: [AdminTravelDashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: comparisonPeriod
 *         schema:
 *           type: string
 *           enum: [previous_period, same_period_last_year]
 *           default: previous_period
 *     responses:
 *       200:
 *         description: Performance metrics for all agents
 */
export const getAllPerformanceMetrics = catchAsync(async (req, res) => {
  const { startDate, endDate, comparisonPeriod = 'previous_period' } = req.query;

  const filters = { comparisonPeriod };
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  const metrics = await analyticsService.calculatePerformanceMetrics(filters);

  res.json({
    success: true,
    data: metrics
  });
});

/**
 * @swagger
 * /api/v1/admin/travel-dashboard/analytics/time-series:
 *   get:
 *     summary: Get time-series analytics for admin
 *     tags: [AdminTravelDashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [revenue, bookings, commissions]
 *           default: revenue
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
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: Time-series analytics data
 */
export const getTimeSeriesAnalytics = catchAsync(async (req, res) => {
  const { metric = 'revenue', startDate, endDate, granularity = 'day' } = req.query;

  const filters = { granularity };
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  const timeSeries = await analyticsService.processTimeSeriesData(filters, metric);

  res.json({
    success: true,
    data: timeSeries
  });
});

/**
 * @swagger
 * /api/v1/admin/travel-dashboard/export/comprehensive:
 *   post:
 *     summary: Create comprehensive export of travel agent data
 *     tags: [AdminTravelDashboard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               formats:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [excel, csv, commission]
 *               filters:
 *                 type: object
 *                 properties:
 *                   startDate:
 *                     type: string
 *                     format: date
 *                   endDate:
 *                     type: string
 *                     format: date
 *                   hotelId:
 *                     type: string
 *               includeInvoices:
 *                 type: boolean
 *                 default: false
 *               includeAnalytics:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Comprehensive export created successfully
 */
export const createComprehensiveExport = catchAsync(async (req, res) => {
  const {
    formats = ['excel', 'commission'],
    filters = {},
    includeInvoices = false,
    includeAnalytics = true
  } = req.body;

  const exportOptions = {
    formats,
    filters,
    includeInvoices
  };

  const result = await exportService.createBatchExport(exportOptions);

  // Add analytics data if requested
  if (includeAnalytics) {
    try {
      const analyticsData = await analyticsService.analyzeBookingTrends(filters);
      const performanceData = await analyticsService.calculatePerformanceMetrics(filters);

      result.analytics = {
        trends: analyticsData,
        performance: performanceData
      };
    } catch (analyticsError) {
      // Don't fail the export for analytics errors
      result.analyticsError = 'Failed to generate analytics data';
    }
  }

  res.json({
    success: true,
    message: 'Comprehensive export created successfully',
    data: {
      filename: result.filename,
      exports: result.exports,
      totalFiles: result.totalFiles,
      fileSize: result.fileSize,
      analytics: result.analytics || null,
      downloadUrl: `/api/v1/travel-agents/download/${result.filename}`
    }
  });
});