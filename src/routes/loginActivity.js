import express from 'express';
import * as loginActivityController from '../controllers/loginActivityController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Admin/Manager routes only
router.use(authorize('admin', 'manager'));

// Analytics and reporting routes
router.route('/analytics')
  .get(loginActivityController.getLoginAnalytics);

router.route('/analytics/patterns')
  .get(loginActivityController.getLoginPatterns);

router.route('/analytics/security')
  .get(loginActivityController.getSecurityMetrics);

router.route('/analytics/behavior')
  .get(loginActivityController.getUserBehaviorAnalysis);

router.route('/analytics/compliance')
  .get(loginActivityController.getComplianceReport);

router.route('/analytics/export')
  .get(loginActivityController.exportLoginAnalytics);

// Session management routes
router.route('/sessions/active')
  .get(loginActivityController.getActiveSessions);

router.route('/sessions/suspicious')
  .get(loginActivityController.getSuspiciousSessions);

router.route('/sessions/:sessionId')
  .get(loginActivityController.getSessionDetails)
  .patch(loginActivityController.updateSessionRiskScore);

router.route('/sessions/:sessionId/end')
  .post(loginActivityController.endSession);

router.route('/sessions/:sessionId/security-flag')
  .post(loginActivityController.addSecurityFlag);

// User session history
router.route('/users/:userId/sessions')
  .get(loginActivityController.getUserSessionHistory);

// Real-time monitoring
router.route('/monitoring/realtime')
  .get(loginActivityController.getRealTimeMonitoring);

// Security alerts
router.route('/alerts')
  .get(loginActivityController.getSecurityAlerts);

export default router;
