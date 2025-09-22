import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
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

export default router;