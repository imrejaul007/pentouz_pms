import express from 'express';
import webOptimizationController from '../controllers/webOptimizationController.js';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

router.use(adminAuth);

router.post('/:hotelId/ab-tests', webOptimizationController.createABTest);
router.get('/:hotelId/ab-tests', webOptimizationController.getABTests);
router.get('/:hotelId/ab-tests/:testId', webOptimizationController.getABTest);
router.put('/:hotelId/ab-tests/:testId', webOptimizationController.updateABTest);
router.delete('/:hotelId/ab-tests/:testId', webOptimizationController.deleteABTest);
router.post('/:hotelId/ab-tests/:testId/start', webOptimizationController.startABTest);
router.post('/:hotelId/ab-tests/:testId/stop', webOptimizationController.stopABTest);
router.post('/:hotelId/ab-tests/:testId/record-conversion', webOptimizationController.recordABTestConversion);
router.get('/:hotelId/ab-tests/:testId/results', webOptimizationController.getABTestResults);

router.post('/:hotelId/performance/record', webOptimizationController.recordPerformanceMetric);
router.get('/:hotelId/performance/report', webOptimizationController.getPerformanceReport);
router.get('/:hotelId/performance/vitals', webOptimizationController.getWebVitals);

router.post('/:hotelId/behavior/record', webOptimizationController.recordUserBehavior);
router.get('/:hotelId/behavior/heatmap', webOptimizationController.getHeatmapData);
router.get('/:hotelId/behavior/analytics', webOptimizationController.getUserBehaviorAnalytics);

router.post('/:hotelId/conversion/funnel', webOptimizationController.createConversionFunnel);
router.get('/:hotelId/conversion/funnels', webOptimizationController.getConversionFunnels);
router.get('/:hotelId/conversion/funnel/:funnelId/report', webOptimizationController.getConversionFunnelReport);

router.post('/:hotelId/personalization/rules', webOptimizationController.createPersonalizationRule);
router.get('/:hotelId/personalization/rules', webOptimizationController.getPersonalizationRules);
router.put('/:hotelId/personalization/rules/:ruleId', webOptimizationController.updatePersonalizationRule);
router.delete('/:hotelId/personalization/rules/:ruleId', webOptimizationController.deletePersonalizationRule);
router.post('/:hotelId/personalization/execute', webOptimizationController.executePersonalization);

router.get('/:hotelId/optimization/report', webOptimizationController.getOptimizationReport);
router.get('/:hotelId/optimization/recommendations', webOptimizationController.getOptimizationRecommendations);

export default router;