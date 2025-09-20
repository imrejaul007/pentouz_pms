import express from 'express';
import revenueController from '../controllers/revenueManagementController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Pricing Rules Routes
router.post('/pricing-rules', authenticate, authorize(['admin', 'revenue_manager']), revenueController.createPricingRule);
router.get('/pricing-rules', authenticate, authorize(['admin', 'revenue_manager', 'manager']), revenueController.getPricingRules);
router.put('/pricing-rules/:id', authenticate, authorize(['admin', 'revenue_manager']), revenueController.updatePricingRule);
router.delete('/pricing-rules/:id', authenticate, authorize(['admin', 'revenue_manager']), revenueController.deletePricingRule);

// Dynamic Pricing Routes
router.get('/dynamic-rate', authenticate, revenueController.calculateDynamicRate);

// Demand Forecasting Routes
router.post('/demand-forecast', authenticate, authorize(['admin', 'revenue_manager']), revenueController.generateDemandForecast);
router.get('/demand-forecast', authenticate, authorize(['admin', 'revenue_manager', 'manager']), revenueController.getDemandForecast);

// Rate Shopping Routes
router.post('/competitor-rates', authenticate, authorize(['admin', 'revenue_manager']), revenueController.addCompetitorRate);
router.get('/competitor-rates', authenticate, authorize(['admin', 'revenue_manager', 'manager']), revenueController.getCompetitorRates);
router.put('/competitor-rates', authenticate, authorize(['admin', 'revenue_manager']), revenueController.updateCompetitorRates);

// Package Management Routes
router.post('/packages', authenticate, authorize(['admin', 'revenue_manager']), revenueController.createPackage);
router.get('/packages', authenticate, revenueController.getPackages);
router.put('/packages/:id', authenticate, authorize(['admin', 'revenue_manager']), revenueController.updatePackage);

// Corporate Rates Routes
router.post('/corporate-rates', authenticate, authorize(['admin', 'revenue_manager']), revenueController.createCorporateRate);
router.get('/corporate-rates', authenticate, authorize(['admin', 'revenue_manager', 'manager']), revenueController.getCorporateRates);

// Revenue Analytics Routes
router.get('/analytics', authenticate, authorize(['admin', 'revenue_manager', 'manager']), revenueController.getRevenueAnalytics);
router.get('/analytics/summary', authenticate, authorize(['admin', 'revenue_manager', 'manager']), revenueController.getRevenueSummary);

// Optimization Routes
router.get('/optimization/recommendations', authenticate, authorize(['admin', 'revenue_manager']), revenueController.getOptimizationRecommendations);

// Dashboard Metrics Route
router.get('/dashboard/metrics', authenticate, authorize(['admin', 'revenue_manager', 'manager']), revenueController.getDashboardMetrics);

// Room Type Rate Management Routes
router.put('/room-type-rates/:id', authenticate, authorize(['admin', 'revenue_manager']), revenueController.updateRoomTypeRate);
router.post('/room-type-rates/bulk-update', authenticate, authorize(['admin', 'revenue_manager']), revenueController.bulkUpdateRoomTypeRates);

// Room Types for Dynamic Pricing
router.get('/room-types', authenticate, authorize(['admin', 'revenue_manager', 'manager']), revenueController.getRoomTypesForPricing);

export default router;