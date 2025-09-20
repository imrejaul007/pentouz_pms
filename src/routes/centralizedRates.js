import express from 'express';
import {
  createRate,
  distributeRate,
  getRates,
  getRateById,
  updateRate,
  deleteRate,
  calculateRate,
  resolveConflict,
  getConflicts,
  getRateAnalytics,
  syncRates,
  previewRateDistribution,
  getRateHistory,
  exportRates,
  getGroupDashboard,
  validateRate,
  duplicateRate,
  updateRateStatus
} from '../controllers/centralizedRateController.js';
import { authenticate } from '../middleware/auth.js';
import authorize from '../middleware/authorize.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Rate CRUD operations
router.post('/', authorize(['admin', 'rate_manager']), createRate);
router.get('/', getRates);
router.get('/:rateId', getRateById);
router.put('/:rateId', authorize(['admin', 'rate_manager']), updateRate);
router.delete('/:rateId', authorize(['admin', 'rate_manager']), deleteRate);

// Rate operations
router.post('/:rateId/distribute', authorize(['admin', 'rate_manager']), distributeRate);
router.post('/:rateId/calculate', calculateRate);
router.get('/:rateId/validate', validateRate);
router.post('/:rateId/duplicate', authorize(['admin', 'rate_manager']), duplicateRate);
router.patch('/:rateId/status', authorize(['admin', 'rate_manager']), updateRateStatus);

// Distribution and sync
router.post('/:rateId/preview-distribution', previewRateDistribution);
router.post('/group/:groupId/sync', authorize(['admin', 'rate_manager']), syncRates);

// Analytics and reporting
router.get('/:rateId/analytics', getRateAnalytics);
router.get('/:rateId/history', getRateHistory);
router.get('/group/:groupId/dashboard', getGroupDashboard);
router.get('/export', authorize(['admin', 'rate_manager']), exportRates);

// Conflict management
router.get('/conflicts', getConflicts);
router.post('/conflicts/:conflictId/resolve', authorize(['admin', 'rate_manager']), resolveConflict);

export default router;
