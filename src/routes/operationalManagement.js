import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { operationalManagementController } from '../controllers/operationalManagementController.js';

const router = express.Router();

// Apply authentication and authorization to all routes
router.use(authenticate, authorize(['admin', 'manager', 'staff']));

// Operational Management Overview
router.get('/overview', operationalManagementController.getOperationalOverview);

// Counter Routes
router.route('/counters')
  .get(operationalManagementController.getCounters)
  .post(operationalManagementController.createCounter);

router.route('/counters/:id')
  .get(operationalManagementController.getCounter)
  .patch(operationalManagementController.updateCounter)
  .delete(operationalManagementController.deleteCounter);

router.patch('/counters/:id/status', operationalManagementController.updateCounterStatus);

// Arrival/Departure Mode Routes
router.route('/arrival-departure-modes')
  .get(operationalManagementController.getArrivalDepartureModes)
  .post(operationalManagementController.createArrivalDepartureMode);

router.route('/arrival-departure-modes/:id')
  .get(operationalManagementController.getArrivalDepartureMode)
  .patch(operationalManagementController.updateArrivalDepartureMode)
  .delete(operationalManagementController.deleteArrivalDepartureMode);

// Lost & Found Routes
router.route('/lost-found')
  .get(operationalManagementController.getLostFoundItems)
  .post(operationalManagementController.createLostFoundItem);

router.route('/lost-found/:id')
  .get(operationalManagementController.getLostFoundItem)
  .patch(operationalManagementController.updateLostFoundItem);

router.patch('/lost-found/:id/claim', operationalManagementController.claimLostFoundItem);
router.patch('/lost-found/:id/dispose', operationalManagementController.disposeLostFoundItem);
router.patch('/lost-found/:id/location', operationalManagementController.updateLostFoundItemLocation);

// Bulk Operations
router.patch('/counters/bulk-status', operationalManagementController.bulkUpdateCounterStatus);
router.patch('/lost-found/bulk-dispose-expired', operationalManagementController.bulkDisposeExpiredItems);

// Analytics Routes
router.get('/analytics/counters', operationalManagementController.getCounterAnalytics);
router.get('/analytics/modes', operationalManagementController.getModeAnalytics);
router.get('/analytics/lost-found', operationalManagementController.getLostFoundAnalytics);

// Special Queries
router.get('/lost-found/expired', operationalManagementController.getExpiredLostFoundItems);
router.get('/lost-found/valuable', operationalManagementController.getValuableLostFoundItems);

export default router;
