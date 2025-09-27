import express from 'express';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../middleware/auth.js';
import NotificationAnalytics from '../models/NotificationAnalytics.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validateAnalyticsRequest } from '../middleware/validation.js';
import {
  generateReport,
  getReportStatus,
  getCachedReport,
  clearReportCache,
  clearDashboardCache,
  getReportTemplates,
  scheduleReport,
  exportReport,
  getDashboardMetrics,
  getRealtimeKPIs,
  getStaffOperationalMetrics,
  forecastOccupancy,
  predictDemand,
  analyzeMarketTrends,
  getStaffProductivity,
  getHousekeepingEfficiency,
  getFrontDeskPerformance,
  getCorporateBookings,
  getCorporatePayments,
  getBookingChannels,
  getChannelROI,
  getRoomTypeProfitability,
  getRevenueForecast,
  getSmartRecommendations,
  getProfitabilityMetrics,
  getHotelMetrics
} from '../controllers/analyticsController.js';

const router = express.Router();

// Apply authentication middleware to all analytics routes
router.use(authenticate);

// Basic report generation
router.post('/reports/generate', authorize(['admin', 'manager']), generateReport);
router.get('/reports/status/:reportId', authorize(['admin', 'manager']), getReportStatus);
router.get('/reports/cached/:cacheKey', authorize(['admin', 'manager']), getCachedReport);

// Report management
router.get('/reports/templates', authorize(['admin', 'manager']), getReportTemplates);
router.delete('/reports/cache/:reportType?', authorize(['admin']), clearReportCache);
router.delete('/dashboard/cache/:cacheKey?', authorize(['admin']), clearDashboardCache);
router.post('/reports/schedule', authorize(['admin']), scheduleReport);
router.get('/reports/export/:reportId/:format', authorize(['admin', 'manager']), exportReport);

// Dashboard and real-time metrics
router.get('/dashboard/metrics', authorize(['admin', 'manager', 'staff']), getDashboardMetrics);
router.get('/kpis/realtime', authorize(['admin', 'manager', 'staff']), getRealtimeKPIs);
router.get('/staff/operational', authorize(['staff']), getStaffOperationalMetrics);

// Advanced analytics endpoints
router.get('/reports/executive-summary', authorize(['admin']), (req, res, next) => {
  req.reportType = 'executive_summary';
  generateReport(req, res, next);
});

router.get('/reports/revenue-analysis', authorize(['admin', 'manager']), (req, res, next) => {
  req.reportType = 'revenue_analysis';
  generateReport(req, res, next);
});

router.get('/reports/occupancy-analysis', authorize(['admin', 'manager']), (req, res, next) => {
  req.reportType = 'occupancy_analysis';
  generateReport(req, res, next);
});

router.get('/reports/guest-segmentation', authorize(['admin', 'manager']), (req, res, next) => {
  req.reportType = 'guest_segmentation';
  generateReport(req, res, next);
});

router.get('/reports/booking-trends', authorize(['admin', 'manager']), (req, res, next) => {
  req.reportType = 'booking_trends';
  generateReport(req, res, next);
});

router.get('/reports/performance-comparison', authorize(['admin', 'manager']), (req, res, next) => {
  req.reportType = 'performance_comparison';
  generateReport(req, res, next);
});

router.get('/reports/channel-analysis', authorize(['admin', 'manager']), (req, res, next) => {
  req.reportType = 'channel_analysis';
  generateReport(req, res, next);
});

router.get('/reports/seasonal-analysis', authorize(['admin', 'manager']), (req, res, next) => {
  req.reportType = 'seasonal_analysis';
  generateReport(req, res, next);
});

// ETL management endpoints
router.post('/etl/run', authorize(['admin']), async (req, res) => {
  try {
    const { ETLService } = await import('../services/analytics/ETLService.js');
    const etlService = new ETLService();
    
    // Run ETL in background
    etlService.executeFullETL().catch(error => {
      console.error('ETL execution failed:', error);
    });
    
    res.json({
      success: true,
      message: 'ETL process initiated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to initiate ETL process',
      error: error.message
    });
  }
});

router.get('/etl/status', authorize(['admin']), async (req, res) => {
  try {
    const { ETLService } = await import('../services/analytics/ETLService.js');
    const etlService = new ETLService();
    
    const status = {
      isRunning: etlService.isRunning || false,
      lastRun: etlService.lastRunTimestamp || null,
      nextScheduled: etlService.nextScheduledRun || null,
      status: etlService.isRunning ? 'running' : 'idle'
    };
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get ETL status',
      error: error.message
    });
  }
});

// Predictive analytics endpoints
router.get('/forecast/occupancy/:hotelId', authorize(['admin', 'manager']), forecastOccupancy);
router.get('/predict/demand/:hotelId', authorize(['admin', 'manager']), predictDemand);
router.get('/market/trends/:hotelId', authorize(['admin', 'manager']), analyzeMarketTrends);

// Staff Productivity Analytics Routes
router.post('/staff-productivity', authorize(['admin', 'manager']), getStaffProductivity);
router.post('/staff-productivity/housekeeping', authorize(['admin', 'manager']), getHousekeepingEfficiency);
router.post('/staff-productivity/front-desk', authorize(['admin', 'manager']), getFrontDeskPerformance);

// Corporate Analytics Routes
router.post('/corporate-bookings', authorize(['admin', 'manager']), getCorporateBookings);
router.post('/corporate-payments', authorize(['admin', 'manager']), getCorporatePayments);

// Booking Channel Analytics Routes
router.post('/booking-channels', authorize(['admin', 'manager']), getBookingChannels);
router.post('/booking-channels/roi', authorize(['admin', 'manager']), getChannelROI);

// Enhanced Analytics Endpoints for Profitability Dashboard
router.get('/room-type-profitability', authorize(['admin', 'manager']), getRoomTypeProfitability);
router.get('/revenue-forecast', authorize(['admin', 'manager']), getRevenueForecast);
router.get('/smart-recommendations', authorize(['admin', 'manager']), getSmartRecommendations);
router.get('/profitability-metrics', authorize(['admin', 'manager']), getProfitabilityMetrics);

// Hotel Metrics for Multi-Property Manager
router.get('/hotel/:hotelId/metrics', authorize(['admin', 'manager', 'staff']), getHotelMetrics);

// NOTIFICATION ANALYTICS ENDPOINTS
// POST /api/v1/analytics/notification-events - Track notification events
router.post('/notification-events', catchAsync(async (req, res, next) => {
  const { event, notificationId, channel = 'in_app', metadata = {}, deviceInfo = {} } = req.body;

  const analytics = new NotificationAnalytics({
    hotelId: req.user.hotelId,
    userId: req.user._id,
    notificationId: notificationId || new mongoose.Types.ObjectId(),
    eventType: event,
    channel,
    deviceInfo: {
      userAgent: req.get('User-Agent'),
      platform: deviceInfo.platform || 'unknown',
      isMobile: /mobile/i.test(req.get('User-Agent')),
      browser: deviceInfo.browser || 'unknown',
      ...deviceInfo
    },
    metadata: {
      category: metadata.category || 'general',
      priority: metadata.priority || 'normal',
      source: metadata.source || 'system',
      templateId: metadata.templateId,
      actionTaken: metadata.actionTaken,
      ...metadata
    },
    timing: {
      [`${event}At`]: new Date(),
      responseTime: metadata.responseTime
    }
  });

  await analytics.save();

  res.status(200).json({
    status: 'success',
    message: 'Event tracked successfully'
  });
}));

// GET /api/v1/analytics/notifications/dashboard - Get notification dashboard analytics (Admin/Staff)
router.get('/notifications/dashboard', authorize(['admin', 'staff']), validateAnalyticsRequest, catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const { timeRange = 7 } = req.query;

  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const [
    deliveryStats,
    userEngagement,
    categoryPerformance,
    channelPerformance,
    realTimeMetrics
  ] = await Promise.all([
    NotificationAnalytics.getDeliveryStats(hotelId, parseInt(timeRange)),
    NotificationAnalytics.getUserEngagement(hotelId, parseInt(timeRange)),
    NotificationAnalytics.getCategoryPerformance(hotelId, parseInt(timeRange)),
    NotificationAnalytics.getChannelPerformance(hotelId, parseInt(timeRange)),
    NotificationAnalytics.getRealTimeMetrics(hotelId)
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      deliveryStats,
      userEngagement: userEngagement.slice(0, 50), // Limit to top 50 users
      categoryPerformance,
      channelPerformance,
      realTimeMetrics,
      timeRange: parseInt(timeRange)
    }
  });
}));

// GET /api/v1/analytics/notifications/delivery-stats - Get detailed delivery statistics
router.get('/notifications/delivery-stats', authorize(['admin', 'staff']), validateAnalyticsRequest, catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const { timeRange = 30, channel, category } = req.query;

  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const stats = await NotificationAnalytics.getDeliveryStats(hotelId, parseInt(timeRange));

  // Filter by channel if specified
  let filteredStats = stats;
  if (channel) {
    filteredStats = stats.filter(stat => stat._id.channel === channel);
  }

  res.status(200).json({
    status: 'success',
    data: {
      stats: filteredStats,
      filters: { timeRange: parseInt(timeRange), channel, category }
    }
  });
}));

// GET /api/v1/analytics/notifications/user-engagement - Get user engagement metrics
router.get('/notifications/user-engagement', authorize(['admin', 'staff']), validateAnalyticsRequest, catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const { timeRange = 30, limit = 100 } = req.query;

  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const engagement = await NotificationAnalytics.getUserEngagement(hotelId, parseInt(timeRange));

  res.status(200).json({
    status: 'success',
    data: {
      engagement: engagement.slice(0, parseInt(limit)),
      totalUsers: engagement.length,
      filters: { timeRange: parseInt(timeRange), limit: parseInt(limit) }
    }
  });
}));

// GET /api/v1/analytics/notifications/category-performance - Get notification category performance
router.get('/notifications/category-performance', authorize(['admin', 'staff']), validateAnalyticsRequest, catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const { timeRange = 30 } = req.query;

  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const performance = await NotificationAnalytics.getCategoryPerformance(hotelId, parseInt(timeRange));

  res.status(200).json({
    status: 'success',
    data: {
      performance,
      filters: { timeRange: parseInt(timeRange) }
    }
  });
}));

// GET /api/v1/analytics/notifications/channel-performance - Get notification channel performance
router.get('/notifications/channel-performance', authorize(['admin', 'staff']), validateAnalyticsRequest, catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const { timeRange = 30 } = req.query;

  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const performance = await NotificationAnalytics.getChannelPerformance(hotelId, parseInt(timeRange));

  res.status(200).json({
    status: 'success',
    data: {
      performance,
      filters: { timeRange: parseInt(timeRange) }
    }
  });
}));

// GET /api/v1/analytics/notifications/real-time - Get real-time notification metrics
router.get('/notifications/real-time', authorize(['admin', 'staff']), catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;

  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const metrics = await NotificationAnalytics.getRealTimeMetrics(hotelId);

  res.status(200).json({
    status: 'success',
    data: { metrics }
  });
}));

// GET /api/v1/analytics/notifications/export - Export notification analytics data (Admin only)
router.get('/notifications/export', authorize(['admin']), validateAnalyticsRequest, catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const { timeRange = 30, format = 'json' } = req.query;

  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(timeRange));

  const data = await NotificationAnalytics.find({
    hotelId,
    createdAt: { $gte: startDate }
  }).populate('userId', 'name email role').populate('notificationId', 'title message category');

  if (format === 'csv') {
    // Convert to CSV format
    const csvData = data.map(item => ({
      date: item.createdAt.toISOString(),
      user: item.userId?.name || 'Unknown',
      email: item.userId?.email || 'N/A',
      role: item.userId?.role || 'Unknown',
      notification: item.notificationId?.title || 'N/A',
      category: item.metadata.category,
      channel: item.channel,
      event: item.eventType,
      responseTime: item.timing.responseTime || 0
    }));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="notification-analytics-${Date.now()}.csv"`);

    // Simple CSV conversion
    const csvHeader = Object.keys(csvData[0] || {}).join(',');
    const csvRows = csvData.map(row => Object.values(row).join(','));
    const csvContent = [csvHeader, ...csvRows].join('\n');

    return res.send(csvContent);
  }

  res.status(200).json({
    status: 'success',
    data: {
      analytics: data,
      totalRecords: data.length,
      timeRange: parseInt(timeRange)
    }
  });
}));

export default router;