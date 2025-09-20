import express from 'express';
import seasonalPricingController from '../controllers/seasonalPricingController.js';
import { authenticate } from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

// Public routes (accessible by authenticated users)
router.use(authenticate);

// Get seasonal adjustment for a specific date and room type
router.get('/adjustment', seasonalPricingController.getSeasonalAdjustment);

// Check booking availability for date range
router.get('/availability', seasonalPricingController.checkBookingAvailability);

// Get pricing calendar for a date range
router.get('/calendar', seasonalPricingController.getPricingCalendar);

// Get seasons by date range
router.get('/seasons/date-range', seasonalPricingController.getSeasonsByDateRange);

// Get special periods by date range
router.get('/special-periods/date-range', seasonalPricingController.getSpecialPeriodsByDateRange);

// Get seasonal analytics
router.get('/analytics', seasonalPricingController.getSeasonalAnalytics);

// Admin-only routes
router.use(adminAuth);

// Season management routes
router.post('/seasons', seasonalPricingController.createSeason);
router.get('/seasons', seasonalPricingController.getSeasons);
router.get('/seasons/:id', seasonalPricingController.getSeasonById);
router.put('/seasons/:id', seasonalPricingController.updateSeason);
router.delete('/seasons/:id', seasonalPricingController.deleteSeason);

// Special period management routes
router.post('/special-periods', seasonalPricingController.createSpecialPeriod);
router.get('/special-periods', seasonalPricingController.getSpecialPeriods);
router.get('/special-periods/:id', seasonalPricingController.getSpecialPeriodById);
router.put('/special-periods/:id', seasonalPricingController.updateSpecialPeriod);
router.delete('/special-periods/:id', seasonalPricingController.deleteSpecialPeriod);

// Bulk operations
router.post('/special-periods/bulk', seasonalPricingController.bulkCreateSpecialPeriods);

// Alert management
router.get('/alerts/upcoming', seasonalPricingController.getUpcomingAlerts);

export default router;