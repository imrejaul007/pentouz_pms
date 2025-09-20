import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import InventoryHistoricalService from '../services/inventoryHistoricalService.js';
import CostOptimizationService from '../services/costOptimizationService.js';
import ComplianceService from '../services/complianceService.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Inventory Analytics
 *   description: Advanced inventory analytics and reporting APIs
 */

// Historical Trend Analysis Routes

/**
 * @swagger
 * /api/v1/inventory/analytics/historical-trends:
 *   get:
 *     summary: Get historical trend analysis for inventory items
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: itemIds
 *         schema:
 *           type: string
 *         description: Comma-separated list of item IDs
 *       - in: query
 *         name: categories
 *         schema:
 *           type: string
 *         description: Comma-separated list of categories
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analysis
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analysis
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *         description: Data granularity
 *     responses:
 *       200:
 *         description: Historical trend analysis data
 */
router.get('/historical-trends', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    itemIds,
    categories,
    startDate,
    endDate,
    granularity = 'daily'
  } = req.query;

  const options = {
    granularity
  };

  if (itemIds) {
    options.itemIds = itemIds.split(',');
  }

  if (categories) {
    options.categories = categories.split(',');
  }

  if (startDate) {
    options.startDate = new Date(startDate);
  }

  if (endDate) {
    options.endDate = new Date(endDate);
  }

  const trendAnalysis = await InventoryHistoricalService.getTrendAnalysis(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: {
      trends: trendAnalysis,
      options,
      generatedAt: new Date()
    }
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/create-snapshot:
 *   post:
 *     summary: Create a historical snapshot of current inventory state
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               snapshotType:
 *                 type: string
 *                 enum: [daily, weekly, monthly, manual, trigger]
 *               triggeredBy:
 *                 type: object
 *     responses:
 *       201:
 *         description: Snapshot created successfully
 */
router.post('/create-snapshot', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { snapshotType = 'manual', triggeredBy } = req.body;

  const snapshot = await InventoryHistoricalService.createSnapshot(req.user.hotelId, snapshotType, triggeredBy);

  res.status(201).json({
    status: 'success',
    data: {
      snapshot,
      message: 'Inventory snapshot created successfully'
    }
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/anomalies:
 *   get:
 *     summary: Detect consumption anomalies
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: number
 *           default: 2
 *         description: Standard deviation threshold for anomaly detection
 *       - in: query
 *         name: lookbackDays
 *         schema:
 *           type: number
 *           default: 30
 *         description: Number of days to look back for analysis
 *       - in: query
 *         name: itemIds
 *         schema:
 *           type: string
 *         description: Comma-separated list of item IDs to analyze
 *     responses:
 *       200:
 *         description: Detected anomalies
 */
router.get('/anomalies', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    threshold = 2,
    lookbackDays = 30,
    itemIds
  } = req.query;

  const options = {
    threshold: parseFloat(threshold),
    lookbackDays: parseInt(lookbackDays)
  };

  if (itemIds) {
    options.itemIds = itemIds.split(',');
  }

  const anomalies = await InventoryHistoricalService.detectAnomalies(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: {
      anomalies,
      options,
      detectedAt: new Date()
    }
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/seasonal-patterns:
 *   get:
 *     summary: Get seasonal consumption patterns
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: itemId
 *         schema:
 *           type: string
 *         description: Specific item ID for pattern analysis
 *     responses:
 *       200:
 *         description: Seasonal patterns data
 */
router.get('/seasonal-patterns', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { itemId } = req.query;

  const patterns = await InventoryHistoricalService.getSeasonalPatterns(req.user.hotelId, itemId);

  res.json({
    status: 'success',
    data: {
      patterns,
      itemId,
      generatedAt: new Date()
    }
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/predictive-demand:
 *   get:
 *     summary: Generate predictive demand forecasting
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: forecastDays
 *         schema:
 *           type: number
 *           default: 30
 *         description: Number of days to forecast ahead
 *       - in: query
 *         name: itemIds
 *         schema:
 *           type: string
 *         description: Comma-separated list of item IDs
 *       - in: query
 *         name: includeSeasonality
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include seasonal adjustments
 *       - in: query
 *         name: confidenceLevel
 *         schema:
 *           type: number
 *           default: 0.95
 *         description: Confidence level for predictions
 *     responses:
 *       200:
 *         description: Demand forecast data
 */
router.get('/predictive-demand', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    forecastDays = 30,
    itemIds,
    includeSeasonality = true,
    confidenceLevel = 0.95
  } = req.query;

  const options = {
    forecastDays: parseInt(forecastDays),
    includeSeasonality: includeSeasonality === 'true',
    confidenceLevel: parseFloat(confidenceLevel)
  };

  if (itemIds) {
    options.itemIds = itemIds.split(',');
  }

  const forecast = await InventoryHistoricalService.generateDemandForecast(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: {
      forecast,
      options,
      generatedAt: new Date()
    }
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/dashboard:
 *   get:
 *     summary: Get comprehensive analytics dashboard data
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: number
 *           default: 30
 *         description: Analysis period in days
 *       - in: query
 *         name: includeForecasting
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include forecasting data
 *       - in: query
 *         name: includeAnomalies
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include anomaly detection
 *     responses:
 *       200:
 *         description: Analytics dashboard data
 */
router.get('/dashboard', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    period = 30,
    includeForecasting = true,
    includeAnomalies = true
  } = req.query;

  const options = {
    period: parseInt(period),
    includeForecasting: includeForecasting === 'true',
    includeAnomalies: includeAnomalies === 'true'
  };

  const dashboard = await InventoryHistoricalService.getDashboardAnalytics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: dashboard
  });
}));

// Cost Optimization Routes

/**
 * @swagger
 * /api/v1/inventory/analytics/cost-optimization:
 *   get:
 *     summary: Get cost optimization dashboard
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: number
 *           default: 90
 *         description: Analysis period in days
 *       - in: query
 *         name: includeForecasting
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include cost forecasting
 *       - in: query
 *         name: includeBenchmarking
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include industry benchmarking
 *     responses:
 *       200:
 *         description: Cost optimization data
 */
router.get('/cost-optimization', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    period = 90,
    includeForecasting = true,
    includeBenchmarking = false
  } = req.query;

  const options = {
    period: parseInt(period),
    includeForecasting: includeForecasting === 'true',
    includeBenchmarking: includeBenchmarking === 'true'
  };

  const dashboard = await CostOptimizationService.getCostOptimizationDashboard(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: dashboard
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/price-comparison:
 *   post:
 *     summary: Perform price comparison analysis
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               itemIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *               analysisDepth:
 *                 type: string
 *                 enum: [basic, standard, comprehensive]
 *     responses:
 *       201:
 *         description: Price comparison analysis completed
 */
router.post('/price-comparison', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    itemIds = [],
    categories = [],
    analysisDepth = 'standard'
  } = req.body;

  const options = {
    itemIds,
    categories,
    analysisDepth
  };

  const analysis = await CostOptimizationService.performPriceComparison(req.user.hotelId, options);

  res.status(201).json({
    status: 'success',
    data: {
      analysis,
      message: 'Price comparison analysis completed successfully'
    }
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/bulk-optimization:
 *   post:
 *     summary: Optimize bulk purchasing strategies
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               itemIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               storageConstraints:
 *                 type: object
 *               cashFlowConstraints:
 *                 type: object
 *               seasonalFactors:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Bulk optimization analysis completed
 */
router.post('/bulk-optimization', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    itemIds = [],
    storageConstraints = {},
    cashFlowConstraints = {},
    seasonalFactors = true
  } = req.body;

  const options = {
    itemIds,
    storageConstraints,
    cashFlowConstraints,
    seasonalFactors
  };

  const analysis = await CostOptimizationService.optimizeBulkPurchasing(req.user.hotelId, options);

  res.status(201).json({
    status: 'success',
    data: {
      analysis,
      message: 'Bulk optimization analysis completed successfully'
    }
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/supplier-performance:
 *   get:
 *     summary: Analyze supplier performance
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: number
 *           default: 180
 *         description: Analysis timeframe in days
 *       - in: query
 *         name: includeQualityMetrics
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include quality metrics
 *       - in: query
 *         name: includeReliabilityScore
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include reliability scoring
 *     responses:
 *       200:
 *         description: Supplier performance analysis
 */
router.get('/supplier-performance', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    timeframe = 180,
    includeQualityMetrics = true,
    includeReliabilityScore = true
  } = req.query;

  const options = {
    timeframe: parseInt(timeframe),
    includeQualityMetrics: includeQualityMetrics === 'true',
    includeReliabilityScore: includeReliabilityScore === 'true'
  };

  const analysis = await CostOptimizationService.analyzeSupplierPerformance(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: analysis
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/roi-calculation:
 *   post:
 *     summary: Calculate ROI for inventory investments
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               investmentScenarios:
 *                 type: array
 *                 items:
 *                   type: object
 *               timeHorizon:
 *                 type: number
 *                 default: 365
 *               discountRate:
 *                 type: number
 *                 default: 0.1
 *               includeRiskAdjustment:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: ROI calculation results
 */
router.post('/roi-calculation', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    investmentScenarios = [],
    timeHorizon = 365,
    discountRate = 0.1,
    includeRiskAdjustment = true
  } = req.body;

  const options = {
    investmentScenarios,
    timeHorizon,
    discountRate,
    includeRiskAdjustment
  };

  const analysis = await CostOptimizationService.calculateInventoryROI(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: analysis
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/contract-analysis:
 *   get:
 *     summary: Analyze supplier contracts
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeRenewalRecommendations
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include renewal recommendations
 *       - in: query
 *         name: includeMarketComparison
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include market comparison
 *       - in: query
 *         name: riskAssessment
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include risk assessment
 *     responses:
 *       200:
 *         description: Contract analysis results
 */
router.get('/contract-analysis', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    includeRenewalRecommendations = true,
    includeMarketComparison = true,
    riskAssessment = true
  } = req.query;

  const options = {
    includeRenewalRecommendations: includeRenewalRecommendations === 'true',
    includeMarketComparison: includeMarketComparison === 'true',
    riskAssessment: riskAssessment === 'true'
  };

  const analysis = await CostOptimizationService.analyzeContracts(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: analysis
  });
}));

// Compliance Routes

/**
 * @swagger
 * /api/v1/inventory/analytics/compliance:
 *   get:
 *     summary: Get compliance dashboard
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: number
 *           default: 90
 *         description: Analysis period in days
 *       - in: query
 *         name: includeForecasting
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include compliance forecasting
 *       - in: query
 *         name: includeBenchmarking
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include industry benchmarking
 *     responses:
 *       200:
 *         description: Compliance dashboard data
 */
router.get('/compliance', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    period = 90,
    includeForecasting = true,
    includeBenchmarking = false
  } = req.query;

  const options = {
    period: parseInt(period),
    includeForecasting: includeForecasting === 'true',
    includeBenchmarking: includeBenchmarking === 'true'
  };

  const dashboard = await ComplianceService.getComplianceDashboard(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: dashboard
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/compliance/generate-report:
 *   post:
 *     summary: Generate compliance report
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [fda, health_department, fire_safety, environmental, osha, general]
 *                 required: true
 *               includePreviousPeriod:
 *                 type: boolean
 *                 default: true
 *               includeRecommendations:
 *                 type: boolean
 *                 default: true
 *               autoScheduleFollowUp:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Compliance report generated successfully
 */
router.post('/compliance/generate-report', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    reportType,
    includePreviousPeriod = true,
    includeRecommendations = true,
    autoScheduleFollowUp = true
  } = req.body;

  if (!reportType) {
    throw new ApplicationError('Report type is required', 400);
  }

  const options = {
    includePreviousPeriod,
    includeRecommendations,
    autoScheduleFollowUp
  };

  const report = await ComplianceService.generateComplianceReport(req.user.hotelId, reportType, options);

  res.status(201).json({
    status: 'success',
    data: {
      report,
      message: `${reportType} compliance report generated successfully`
    }
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/compliance/monitor:
 *   get:
 *     summary: Monitor compliance status in real-time
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: alertThreshold
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *           default: medium
 *         description: Alert threshold level
 *       - in: query
 *         name: includePreventive
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include preventive actions
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *           enum: [all, critical, operational]
 *           default: all
 *         description: Monitoring scope
 *     responses:
 *       200:
 *         description: Real-time compliance monitoring data
 */
router.get('/compliance/monitor', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    alertThreshold = 'medium',
    includePreventive = true,
    scope = 'all'
  } = req.query;

  const options = {
    alertThreshold,
    includePreventive: includePreventive === 'true',
    scope
  };

  const monitoring = await ComplianceService.monitorComplianceStatus(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: monitoring
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/compliance/audit:
 *   post:
 *     summary: Perform compliance audit
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auditType:
 *                 type: string
 *                 enum: [comprehensive, food_safety, safety, operational, environmental]
 *                 default: comprehensive
 *               includeEvidence:
 *                 type: boolean
 *                 default: true
 *               generateActionPlan:
 *                 type: boolean
 *                 default: true
 *               assessRisk:
 *                 type: boolean
 *                 default: true
 *               auditor:
 *                 type: string
 *     responses:
 *       201:
 *         description: Compliance audit completed
 */
router.post('/compliance/audit', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    auditType = 'comprehensive',
    includeEvidence = true,
    generateActionPlan = true,
    assessRisk = true,
    auditor
  } = req.body;

  const options = {
    includeEvidence,
    generateActionPlan,
    assessRisk,
    auditor: auditor || `${req.user.name} (System Generated)`
  };

  const audit = await ComplianceService.performComplianceAudit(req.user.hotelId, auditType, options);

  res.status(201).json({
    status: 'success',
    data: {
      audit,
      message: `${auditType} compliance audit completed successfully`
    }
  });
}));

/**
 * @swagger
 * /api/v1/inventory/analytics/compliance/corrective-actions:
 *   get:
 *     summary: Track corrective actions
 *     tags: [Inventory Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeOverdue
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include overdue actions
 *       - in: query
 *         name: includePending
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include pending actions
 *       - in: query
 *         name: includeCompleted
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include completed actions
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: number
 *           default: 90
 *         description: Timeframe in days
 *     responses:
 *       200:
 *         description: Corrective actions tracking data
 */
router.get('/compliance/corrective-actions', authenticate, authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const {
    includeOverdue = true,
    includePending = true,
    includeCompleted = false,
    timeframe = 90
  } = req.query;

  const options = {
    includeOverdue: includeOverdue === 'true',
    includePending: includePending === 'true',
    includeCompleted: includeCompleted === 'true',
    timeframe: parseInt(timeframe)
  };

  const tracking = await ComplianceService.trackCorrectiveActions(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: tracking
  });
}));

export default router;
