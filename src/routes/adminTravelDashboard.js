import express from 'express';
import {
  getTravelDashboardOverview,
  getTravelAnalytics,
  getPendingCommissions,
  getTravelAgentRates,
  exportTravelData,
  getAdvancedBookingTrends,
  getRevenueForecastAnalytics,
  getCommissionProjections,
  getAllPerformanceMetrics,
  getTimeSeriesAnalytics,
  createComprehensiveExport
} from '../controllers/adminTravelDashboardController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Apply authorization - only admin, manager, and staff can access travel dashboard
router.use(authorize('admin', 'manager', 'staff'));

// Travel dashboard routes
router.get('/', getTravelDashboardOverview);
router.get('/overview', getTravelDashboardOverview); // Alias for frontend compatibility
router.get('/agents', getTravelDashboardOverview); // Alias for frontend compatibility
router.get('/analytics', getTravelAnalytics);
router.get('/pending-commissions', getPendingCommissions);
router.get('/rates', getTravelAgentRates);
router.get('/export', exportTravelData);

// Advanced analytics routes
router.get('/analytics/trends', getAdvancedBookingTrends);
router.get('/analytics/forecast', getRevenueForecastAnalytics);
router.get('/analytics/commission-projections', getCommissionProjections);
router.get('/analytics/performance', getAllPerformanceMetrics);
router.get('/analytics/time-series', getTimeSeriesAnalytics);

// Advanced export routes
router.post('/export/comprehensive', createComprehensiveExport);

export default router;