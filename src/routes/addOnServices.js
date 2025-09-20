import express from 'express';
import addOnController from '../controllers/addOnController.js';
import { authenticate } from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

// Public routes (accessible by authenticated users)
router.use(authenticate);

// Get services with filtering and pagination
router.get('/', addOnController.getServices);

// Get service categories
router.get('/categories', addOnController.getCategories);

// Get featured services
router.get('/featured', addOnController.getFeaturedServices);

// Get upsell recommendations
router.get('/upsell-recommendations', addOnController.getUpsellRecommendations);

// Get service by ID
router.get('/:id', addOnController.getServiceById);

// Check service availability
router.get('/:serviceId/availability', addOnController.checkAvailability);

// Get service pricing
router.get('/:serviceId/pricing', addOnController.getServicePricing);

// Book a service
router.post('/:serviceId/book', addOnController.bookService);

// Get service analytics (for service owners)
router.get('/:serviceId/analytics', addOnController.getServiceAnalytics);

// Service Inclusions routes
router.get('/inclusions/list', addOnController.getInclusions);
router.get('/inclusions/package/:packageId', addOnController.getPackageInclusions);
router.post('/inclusions/:id/redeem', addOnController.processRedemption);

// Admin-only routes
router.use(adminAuth);

// Service Management
router.post('/', addOnController.createService);
router.put('/:id', addOnController.updateService);
router.delete('/:id', addOnController.deleteService);

// Bulk operations
router.post('/bulk', addOnController.bulkCreateServices);

// Service Inclusions Management
router.post('/inclusions', addOnController.createInclusion);
router.put('/inclusions/:id', addOnController.updateInclusion);

export default router;
