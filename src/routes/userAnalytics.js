import express from 'express';
import * as userAnalyticsController from '../controllers/userAnalyticsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Admin/Manager routes only
router.use(authorize('admin', 'manager'));

// Analytics and reporting routes
router.route('/engagement')
  .get(userAnalyticsController.getUserEngagementAnalytics);

router.route('/behavior')
  .get(userAnalyticsController.getUserBehaviorAnalysis);

router.route('/performance')
  .get(userAnalyticsController.getPerformanceMetrics);

router.route('/lifecycle')
  .get(userAnalyticsController.getUserLifecycleAnalysis);

router.route('/trends/engagement')
  .get(userAnalyticsController.getEngagementTrends);

router.route('/trends/performance')
  .get(userAnalyticsController.getPerformanceTrends);

router.route('/summary')
  .get(userAnalyticsController.getUserAnalyticsSummary);

router.route('/segmentation')
  .get(userAnalyticsController.getUserSegmentation);

router.route('/predictive')
  .get(userAnalyticsController.getPredictiveAnalytics);

router.route('/insights')
  .get(userAnalyticsController.getUserEngagementInsights);

router.route('/cohort')
  .get(userAnalyticsController.getUserCohortAnalysis);

router.route('/export')
  .get(userAnalyticsController.exportUserAnalytics);

// User-specific analytics
router.route('/users/:userId')
  .get(userAnalyticsController.getUserAnalyticsById);

// Analytics management
router.route('/calculate')
  .post(userAnalyticsController.calculateEngagementScores);

router.route('/')
  .post(userAnalyticsController.createOrUpdateUserAnalytics);

// Top performers
router.route('/top-engaged')
  .get(userAnalyticsController.getTopEngagedUsers);

export default router;
