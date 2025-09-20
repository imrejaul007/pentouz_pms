import express from 'express';
import * as guestController from '../controllers/guestController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Public routes (for guest self-service)
router.get('/:id', guestController.getGuest);
router.get('/:id/bookings', guestController.getGuest);
router.patch('/:id', guestController.updateGuest);

// Admin/Staff routes
router.use(authorize('admin', 'manager', 'staff'));

// Enhanced guest management routes
router.route('/')
  .get(guestController.getAllGuests)
  .post(guestController.createGuest);

router.route('/analytics')
  .get(guestController.getGuestAnalytics);

router.route('/search')
  .post(guestController.searchGuests);

router.route('/export')
  .get(guestController.exportGuests);

router.route('/bulk-update')
  .patch(guestController.bulkUpdateGuests);

router.route('/:id')
  .get(guestController.getGuest)
  .patch(guestController.updateGuest)
  .delete(guestController.deleteGuest);

export default router;
