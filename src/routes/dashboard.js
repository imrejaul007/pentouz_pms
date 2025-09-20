import express from 'express';
import dashboardController from '../controllers/dashboardController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Dashboard counts endpoint
router.get('/counts', authenticate, authorize(['admin', 'staff']), dashboardController.getDashboardCounts);

// Room status summary
router.get('/room-status', authenticate, authorize(['admin', 'staff']), dashboardController.getRoomStatusSummary);

// Recent activities
router.get('/activities', authenticate, authorize(['admin', 'staff']), dashboardController.getRecentActivities);

export default router;
