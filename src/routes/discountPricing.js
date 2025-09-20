import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
// import discountPricingController from '../controllers/discountPricingController.js';

const router = express.Router();

// Apply authentication and authorization to all routes
router.use(authenticate, authorize(['admin', 'manager', 'staff']));

// Advanced Features Overview
// router.get('/overview', discountPricingController.getAdvancedFeaturesOverview);

// // Special Discount Routes
// router.route('/discounts')
//   .get(discountPricingController.getSpecialDiscounts)
//   .post(discountPricingController.createSpecialDiscount);

// router.route('/discounts/:id')
//   .get(discountPricingController.getSpecialDiscount)
//   .patch(discountPricingController.updateSpecialDiscount)
//   .delete(discountPricingController.deleteSpecialDiscount);

// router.post('/discounts/applicable', discountPricingController.getApplicableDiscounts);

// Dynamic Pricing Routes
// router.route('/pricing')
//   .get(discountPricingController.getDynamicPricingRules)
//   .post(discountPricingController.createDynamicPricing);

// router.route('/pricing/:id')
//   .get(discountPricingController.getDynamicPricing)
//   .patch(discountPricingController.updateDynamicPricing)
//   .delete(discountPricingController.deleteDynamicPricing);

// router.post('/pricing/:id/calculate', discountPricingController.calculateDynamicPrice);

// // Market Segment Routes
// router.route('/market-segments')
//   .get(discountPricingController.getMarketSegments)
//   .post(discountPricingController.createMarketSegment);

// router.route('/market-segments/:id')
//   .get(discountPricingController.getMarketSegment)
//   .patch(discountPricingController.updateMarketSegment)
//   .delete(discountPricingController.deleteMarketSegment);

// router.post('/market-segments/match', discountPricingController.findMatchingSegments);

// // Job Type Routes
// router.route('/job-types')
//   .get(discountPricingController.getJobTypes)
//   .post(discountPricingController.createJobType);

// router.route('/job-types/:id')
//   .get(discountPricingController.getJobType)
//   .patch(discountPricingController.updateJobType)
//   .delete(discountPricingController.deleteJobType);

// router.get('/job-types/search', discountPricingController.searchJobTypes);

// // Bulk Operations
// router.patch('/discounts/bulk-status', discountPricingController.bulkUpdateDiscountStatus);
// router.patch('/pricing/bulk-status', discountPricingController.bulkUpdatePricingStatus);

// // Analytics Routes
// router.get('/analytics/discounts', discountPricingController.getDiscountAnalytics);
// router.get('/analytics/pricing', discountPricingController.getPricingAnalytics);
// router.get('/analytics/market-segments', discountPricingController.getMarketSegmentAnalytics);
// router.get('/analytics/job-types', discountPricingController.getJobTypeAnalytics);

export default router;
