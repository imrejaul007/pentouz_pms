import express from 'express';
import * as vipController from '../controllers/vipController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Admin/Manager routes only
router.use(authorize('admin', 'manager'));

// CRUD operations
router.route('/')
  .get(vipController.getAllVIPGuests)
  .post(vipController.addToVIP);

router.route('/statistics')
  .get(vipController.getVIPStatistics);

router.route('/export')
  .get(vipController.exportVIPData);

router.route('/bulk-update')
  .patch(vipController.bulkUpdateVIPGuests);

router.route('/auto-expire')
  .post(vipController.autoExpireVIPs);

router.route('/expiring')
  .get(vipController.getExpiringVIPs);

router.route('/requirements')
  .get(vipController.getVIPLevelRequirements);

router.route('/concierge-staff')
  .get(vipController.getConciergeStaff);

router.route('/check/:guestId')
  .get(vipController.checkVIPStatus);

router.route('/benefits/:guestId')
  .get(vipController.getVIPBenefits);

router.route('/validate-booking')
  .post(vipController.validateVIPBooking);

router.route('/update-qualification')
  .post(vipController.updateQualificationAfterStay);

router.route('/guest/:guestId/history')
  .get(vipController.getVIPGuestHistory);

router.route('/:id')
  .get(vipController.getVIPGuest)
  .patch(vipController.updateVIPGuest)
  .delete(vipController.removeFromVIP);

router.route('/:id/assign-concierge')
  .patch(vipController.assignConcierge);

export default router;
