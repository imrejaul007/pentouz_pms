import express from 'express';
import * as userManagementController from '../controllers/userManagementController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Admin/Manager routes only
router.use(authorize('admin', 'manager'));

// Analytics and reporting routes
router.route('/analytics')
  .get(userManagementController.getUserAnalytics);

router.route('/analytics/activity')
  .get(userManagementController.getUserActivityMetrics);

router.route('/analytics/performance')
  .get(userManagementController.getUserPerformanceMetrics);

router.route('/analytics/segmentation')
  .get(userManagementController.getUserSegmentation);

router.route('/analytics/engagement')
  .get(userManagementController.getUserEngagementMetrics);

// Advanced user management routes
router.route('/advanced-list')
  .get(userManagementController.getAdvancedUserList);

router.route('/bulk-operations')
  .post(userManagementController.bulkUserOperations);

router.route('/import')
  .post(userManagementController.importUsers);

router.route('/export')
  .get(userManagementController.exportUsers);

// User activity and performance routes
router.route('/activity-timeline')
  .get(userManagementController.getUserActivityTimeline);

router.route('/performance-report')
  .get(userManagementController.getUserPerformanceReport);

router.route('/health-monitoring')
  .get(userManagementController.getUserHealthMonitoring);

export default router;
