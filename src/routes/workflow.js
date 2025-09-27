import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import WorkflowController from '../controllers/workflowController.js';

const router = express.Router();

// Workflow routes
router.post('/bulk-checkin', optionalAuth, WorkflowController.bulkCheckIn);
router.post('/bulk-checkout', optionalAuth, WorkflowController.bulkCheckOut);
router.post('/housekeeping', optionalAuth, WorkflowController.scheduleHousekeeping);
router.post('/maintenance', optionalAuth, WorkflowController.requestMaintenance);
router.post('/room-status', optionalAuth, WorkflowController.updateRoomStatus);

// Analytics routes
router.get('/actions', optionalAuth, WorkflowController.getWorkflowActions);
router.get('/analytics/floor/:floorId', optionalAuth, WorkflowController.getFloorAnalytics);
router.get('/analytics/predictive', optionalAuth, WorkflowController.getPredictiveAnalytics);

// Upgrade Processing routes
router.get('/upgrades/suggestions', optionalAuth, WorkflowController.generateUpgradeSuggestions);
router.post('/upgrades/process', optionalAuth, WorkflowController.processUpgrade);
router.get('/upgrades/analytics', optionalAuth, WorkflowController.getUpgradeAnalytics);

export default router;
