import express from 'express';
import dayUseController from '../controllers/dayUseController.js';
import { authenticate } from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

// Public routes (authenticated users)
router.use(authenticate);

// Slot availability and information (accessible to all authenticated users)
router.get('/slots', dayUseController.getSlots);
router.get('/slots/available/:date', dayUseController.getAvailableSlots);
router.get('/slots/:id', dayUseController.getSlotById);
router.get('/slots/:slotId/availability', dayUseController.checkSlotAvailability);

// Booking management (accessible to all authenticated users)
router.post('/bookings', dayUseController.createBooking);
router.get('/bookings', dayUseController.getBookings);
router.get('/bookings/:id', dayUseController.getBookingById);
router.put('/bookings/:id', dayUseController.updateBooking);
router.post('/bookings/:id/cancel', dayUseController.cancelBooking);
router.post('/bookings/:id/notes', dayUseController.addBookingNote);

// Check-in/Check-out operations (staff and admin only)
router.use(adminAuth);

router.post('/bookings/:id/checkin', dayUseController.checkInBooking);
router.post('/bookings/:id/checkout', dayUseController.checkOutBooking);

// Slot management (admin only)
router.post('/slots', dayUseController.createSlot);
router.put('/slots/:id', dayUseController.updateSlot);
router.delete('/slots/:id', dayUseController.deleteSlot);

// Analytics and reporting (admin only)
router.get('/analytics', dayUseController.getAnalytics);
router.get('/analytics/slots/:slotId/performance', dayUseController.getSlotPerformance);
router.get('/analytics/revenue', dayUseController.getRevenueReport);
router.get('/analytics/occupancy/:date', dayUseController.getOccupancyReport);
router.get('/schedule/today', dayUseController.getTodaySchedule);

export default router;
