import express from 'express';
import * as blacklistController from '../controllers/blacklistController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Admin/Manager routes only
router.use(authorize('admin', 'manager'));

// CRUD operations
router.route('/')
  .get(blacklistController.getAllBlacklistEntries)
  .post(blacklistController.addToBlacklist);

router.route('/statistics')
  .get(blacklistController.getBlacklistStatistics);

router.route('/export')
  .get(blacklistController.exportBlacklist);

router.route('/bulk-update')
  .patch(blacklistController.bulkUpdateBlacklist);

router.route('/auto-expire')
  .post(blacklistController.autoExpireBlacklists);

router.route('/expired')
  .get(blacklistController.getExpiredBlacklists);

router.route('/appeals/pending')
  .get(blacklistController.getPendingAppeals);

router.route('/check/:guestId')
  .get(blacklistController.checkGuestBlacklist);

router.route('/validate-booking')
  .post(blacklistController.validateBooking);

router.route('/guest/:guestId/history')
  .get(blacklistController.getGuestBlacklistHistory);

router.route('/:id')
  .get(blacklistController.getBlacklistEntry)
  .patch(blacklistController.updateBlacklistEntry)
  .delete(blacklistController.removeFromBlacklist);

router.route('/:id/appeal')
  .post(blacklistController.submitAppeal)
  .patch(blacklistController.reviewAppeal);

export default router;
