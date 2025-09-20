import express from 'express';
import bookingEngineController from '../controllers/bookingEngineController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Booking Widget Routes
router.post('/widgets', authenticate, authorize(['admin', 'marketing_manager']), bookingEngineController.createBookingWidget);
router.get('/widgets', authenticate, authorize(['admin', 'marketing_manager', 'manager']), bookingEngineController.getBookingWidgets);
router.put('/widgets/:id', authenticate, authorize(['admin', 'marketing_manager']), bookingEngineController.updateBookingWidget);
router.get('/widgets/:widgetId/code', bookingEngineController.getWidgetCode);
router.post('/widgets/:widgetId/booking', bookingEngineController.processWidgetBooking);

// Widget Tracking Routes (Public for external websites)
router.post('/widget/track', bookingEngineController.trackWidgetEvent);
router.get('/widgets/:widgetId/analytics', authenticate, authorize(['admin', 'marketing_manager', 'manager']), bookingEngineController.getWidgetAnalytics);
router.get('/widgets/performance/summary', authenticate, authorize(['admin', 'marketing_manager', 'manager']), bookingEngineController.getWidgetsPerformanceSummary);

// Promo Code Routes
router.post('/promo-codes', authenticate, authorize(['admin', 'marketing_manager']), bookingEngineController.createPromoCode);
router.get('/promo-codes', authenticate, authorize(['admin', 'marketing_manager', 'manager']), bookingEngineController.getPromoCodes);
router.put('/promo-codes/:id', authenticate, authorize(['admin', 'marketing_manager']), bookingEngineController.updatePromoCode);
router.post('/promo-codes/validate', bookingEngineController.validatePromoCode);

// Guest CRM Routes
router.get('/crm/guests', authenticate, authorize(['admin', 'marketing_manager', 'manager']), bookingEngineController.getGuestCRM);
router.get('/crm/guests/:id', authenticate, authorize(['admin', 'marketing_manager', 'manager']), bookingEngineController.getGuestProfile);
router.put('/crm/guests/:id', authenticate, authorize(['admin', 'marketing_manager']), bookingEngineController.updateGuestProfile);

// Email Campaign Routes
router.post('/campaigns', authenticate, authorize(['admin', 'marketing_manager']), bookingEngineController.createEmailCampaign);
router.get('/campaigns', authenticate, authorize(['admin', 'marketing_manager', 'manager']), bookingEngineController.getEmailCampaigns);
router.post('/campaigns/:campaignId/send', authenticate, authorize(['admin', 'marketing_manager']), bookingEngineController.sendEmailCampaign);
router.get('/campaigns/:id/analytics', authenticate, authorize(['admin', 'marketing_manager', 'manager']), bookingEngineController.getCampaignAnalytics);

// Loyalty Program Routes
router.post('/loyalty-programs', authenticate, authorize(['admin', 'marketing_manager']), bookingEngineController.createLoyaltyProgram);
router.get('/loyalty-programs', authenticate, bookingEngineController.getLoyaltyPrograms);
router.post('/loyalty/points', authenticate, bookingEngineController.processLoyaltyPoints);

// Landing Page Routes
router.post('/landing-pages', authenticate, authorize(['admin', 'marketing_manager']), bookingEngineController.createLandingPage);
router.get('/landing-pages', authenticate, authorize(['admin', 'marketing_manager', 'manager']), bookingEngineController.getLandingPages);
router.get('/landing-pages/:id/analytics', authenticate, authorize(['admin', 'marketing_manager', 'manager']), bookingEngineController.getLandingPageAnalytics);

// Review Management Routes
router.post('/reviews', bookingEngineController.createReview);
router.get('/reviews', authenticate, authorize(['admin', 'marketing_manager', 'manager']), bookingEngineController.getReviews);
router.post('/reviews/:id/respond', authenticate, authorize(['admin', 'marketing_manager']), bookingEngineController.respondToReview);
router.put('/reviews/:id/moderate', authenticate, authorize(['admin', 'marketing_manager']), bookingEngineController.moderateReview);

// Dashboard and Analytics Routes
router.get('/dashboard', authenticate, authorize(['admin', 'marketing_manager', 'manager']), bookingEngineController.getMarketingDashboard);

export default router;
