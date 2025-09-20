import express from 'express';
import mongoose from 'mongoose';
import PricingStrategy from '../models/PricingStrategy.js';
import DemandForecast from '../models/DemandForecast.js';
import { CompetitorRate, Competitor } from '../models/CompetitorMonitoring.js';
import dynamicPricingService from '../services/dynamicPricingService.js';
import revenueManagementService from '../services/revenueManagementService.js';
import revenueOptimizationController from '../controllers/revenueOptimizationController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { param, body, query } from 'express-validator';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticate);

/**
 * @swagger
 * /api/revenue/kpis:
 *   get:
 *     summary: Get comprehensive revenue KPIs
 *     tags: [Revenue Management]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Revenue KPIs and metrics
 */
router.get('/kpis', async (req, res) => {
  try {
    const hotelId = req.user.hotelId;
    const { startDate, endDate } = req.query;

    // Default to last 30 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const kpis = await revenueManagementService.calculateRevenueKPIs(hotelId, start, end);

    res.json(kpis);

  } catch (error) {
    console.error('Failed to get revenue KPIs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/revenue/yield-analysis:
 *   get:
 *     summary: Run comprehensive yield management analysis
 *     tags: [Revenue Management]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Yield management analysis results
 */
router.get('/yield-analysis', async (req, res) => {
  try {
    const hotelId = req.user.hotelId;
    const { startDate, endDate } = req.query;

    const options = {};
    if (startDate) options.analysisStartDate = new Date(startDate);
    if (endDate) options.analysisEndDate = new Date(endDate);

    const analysis = await revenueManagementService.runYieldManagementAnalysis(hotelId, options);

    res.json(analysis);

  } catch (error) {
    console.error('Failed to run yield analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/revenue/pricing/calculate:
 *   post:
 *     summary: Calculate optimal rates using dynamic pricing
 *     tags: [Revenue Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               roomTypeId:
 *                 type: string
 *               includeCompetitorData:
 *                 type: boolean
 *               includeDemandForecast:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Calculated optimal rates
 */
router.post('/pricing/calculate', async (req, res) => {
  try {
    const hotelId = req.user.hotelId;
    const {
      startDate,
      endDate,
      roomTypeId,
      includeCompetitorData = true,
      includeDemandForecast = true,
      forceRecalculation = false
    } = req.body;

    // Default to next 14 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const result = await dynamicPricingService.calculateOptimalRates(hotelId, start, end, {
      roomTypeId,
      includeCompetitorData,
      includeDemandForecast,
      forceRecalculation
    });

    res.json(result);

  } catch (error) {
    console.error('Failed to calculate optimal rates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/revenue/pricing/apply:
 *   post:
 *     summary: Apply calculated pricing changes
 *     tags: [Revenue Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pricingResults:
 *                 type: array
 *               minRecommendationScore:
 *                 type: number
 *               autoApply:
 *                 type: boolean
 *               notifyChannels:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Pricing changes applied
 */
router.post('/pricing/apply', async (req, res) => {
  try {
    const hotelId = req.user.hotelId;
    const {
      pricingResults,
      minRecommendationScore = 60,
      autoApply = true,
      notifyChannels = true
    } = req.body;

    if (!pricingResults || !Array.isArray(pricingResults)) {
      return res.status(400).json({
        success: false,
        error: 'Pricing results array is required'
      });
    }

    const result = await dynamicPricingService.applyPricingChanges(hotelId, pricingResults, {
      minRecommendationScore,
      autoApply,
      notifyChannels
    });

    res.json(result);

  } catch (error) {
    console.error('Failed to apply pricing changes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/revenue/pricing/automated:
 *   post:
 *     summary: Run automated pricing optimization
 *     tags: [Revenue Management]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               daysAhead:
 *                 type: number
 *               autoApply:
 *                 type: boolean
 *               minRecommendationScore:
 *                 type: number
 *     responses:
 *       200:
 *         description: Automated pricing completed
 */
router.post('/pricing/automated', async (req, res) => {
  try {
    const hotelId = req.user.hotelId;
    const {
      daysAhead = 30,
      autoApply = false, // Default to manual approval
      minRecommendationScore = 70
    } = req.body;

    const result = await dynamicPricingService.runAutomatedPricing(hotelId, {
      daysAhead,
      autoApply,
      minRecommendationScore
    });

    res.json(result);

  } catch (error) {
    console.error('Failed to run automated pricing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/revenue/strategies:
 *   get:
 *     summary: Get pricing strategies
 *     tags: [Revenue Management]
 */
router.get('/strategies', async (req, res) => {
  try {
    const hotelId = req.user.hotelId;

    const strategies = await PricingStrategy.find({ hotelId })
      .populate('roomTypes.roomTypeId')
      .sort({ priority: -1, createdAt: -1 });

    res.json({
      success: true,
      strategies
    });

  } catch (error) {
    console.error('Failed to get pricing strategies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/revenue/strategies:
 *   post:
 *     summary: Create new pricing strategy
 *     tags: [Revenue Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [dynamic, fixed, seasonal, event_based, competitor_based, demand_based]
 *               roomTypes:
 *                 type: array
 *               rules:
 *                 type: array
 *               constraints:
 *                 type: object
 *     responses:
 *       201:
 *         description: Pricing strategy created
 */
router.post('/strategies', async (req, res) => {
  try {
    const hotelId = req.user.hotelId;
    const strategyData = {
      ...req.body,
      hotelId
    };

    const strategy = new PricingStrategy(strategyData);
    await strategy.save();

    res.status(201).json({
      success: true,
      strategy,
      message: 'Pricing strategy created successfully'
    });

  } catch (error) {
    console.error('Failed to create pricing strategy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/revenue/strategies/{strategyId}:
 *   put:
 *     summary: Update pricing strategy
 *     tags: [Revenue Management]
 */
router.put('/strategies/:strategyId', async (req, res) => {
  try {
    const { strategyId } = req.params;
    const hotelId = req.user.hotelId;

    const strategy = await PricingStrategy.findOneAndUpdate(
      { strategyId, hotelId },
      req.body,
      { new: true }
    ).populate('roomTypes.roomTypeId');

    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: 'Pricing strategy not found'
      });
    }

    res.json({
      success: true,
      strategy,
      message: 'Pricing strategy updated successfully'
    });

  } catch (error) {
    console.error('Failed to update pricing strategy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/revenue/forecasts:
 *   get:
 *     summary: Get demand forecasts
 *     tags: [Revenue Management]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: roomTypeId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Demand forecasts
 */
router.get('/forecasts', async (req, res) => {
  try {
    const hotelId = req.user.hotelId;
    const { startDate, endDate, roomTypeId } = req.query;

    const query = { hotelId };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    if (roomTypeId) {
      query.roomTypeId = roomTypeId;
    }

    const forecasts = await DemandForecast.find(query)
      .populate('roomTypeId')
      .sort({ date: 1 });

    res.json({
      success: true,
      forecasts
    });

  } catch (error) {
    console.error('Failed to get forecasts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/revenue/forecasts/generate:
 *   post:
 *     summary: Generate demand forecasts
 *     tags: [Revenue Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               roomTypeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Forecasts generated
 */
router.post('/forecasts/generate', async (req, res) => {
  try {
    const hotelId = req.user.hotelId;
    const { startDate, endDate, roomTypeId } = req.body;

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const RoomType = (await import('../models/RoomType.js')).default;
    
    // Get room types to forecast
    const roomTypeQuery = { hotelId, isActive: true };
    if (roomTypeId) roomTypeQuery._id = roomTypeId;
    
    const roomTypes = await RoomType.find(roomTypeQuery);
    const generatedForecasts = [];

    // Generate forecasts for each room type and date
    const currentDate = new Date(start);
    while (currentDate <= end) {
      for (const roomType of roomTypes) {
        try {
          const forecast = await DemandForecast.generateForecast(
            hotelId,
            roomType._id,
            new Date(currentDate)
          );
          generatedForecasts.push(forecast);
        } catch (forecastError) {
          console.error(`Failed to generate forecast for ${roomType.name} on ${currentDate}:`, forecastError);
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      success: true,
      message: `Generated ${generatedForecasts.length} forecasts`,
      forecasts: generatedForecasts.slice(0, 10), // Return first 10 for response size
      totalGenerated: generatedForecasts.length
    });

  } catch (error) {
    console.error('Failed to generate forecasts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/revenue/competitors:
 *   get:
 *     summary: Get competitor monitoring data
 *     tags: [Revenue Management]
 */
router.get('/competitors', async (req, res) => {
  try {
    const hotelId = req.user.hotelId;

    const competitors = await Competitor.find({ hotelId })
      .sort({ 'monitoring.priority': -1 });

    res.json({
      success: true,
      competitors
    });

  } catch (error) {
    console.error('Failed to get competitors:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/revenue/competitors:
 *   post:
 *     summary: Add new competitor for monitoring
 *     tags: [Revenue Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               location:
 *                 type: object
 *               propertyDetails:
 *                 type: object
 *               monitoring:
 *                 type: object
 *               dataSources:
 *                 type: array
 *     responses:
 *       201:
 *         description: Competitor added
 */
router.post('/competitors', async (req, res) => {
  try {
    const hotelId = req.user.hotelId;
    const competitorData = {
      ...req.body,
      hotelId
    };

    const competitor = new Competitor(competitorData);
    await competitor.save();

    res.status(201).json({
      success: true,
      competitor,
      message: 'Competitor added successfully'
    });

  } catch (error) {
    console.error('Failed to add competitor:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/revenue/competitors/{competitorId}/rates:
 *   get:
 *     summary: Get competitor rates
 *     tags: [Revenue Management]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: roomType
 *         schema:
 *           type: string
 */
router.get('/competitors/:competitorId/rates', async (req, res) => {
  try {
    const { competitorId } = req.params;
    const hotelId = req.user.hotelId;
    const { startDate, endDate, roomType } = req.query;

    const query = { 
      hotelId,
      competitorId: mongoose.Types.ObjectId(competitorId)
    };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    if (roomType) {
      query.roomType = roomType;
    }

    const rates = await CompetitorRate.find(query)
      .populate('competitorId')
      .sort({ date: -1 })
      .limit(100);

    res.json({
      success: true,
      rates
    });

  } catch (error) {
    console.error('Failed to get competitor rates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Phase 6: Advanced Revenue Optimization Routes

const hotelIdValidation = [
  param('hotelId').isMongoId().withMessage('Invalid hotel ID'),
  validate
];

/**
 * @swagger
 * /api/revenue/{hotelId}/optimization/strategy:
 *   post:
 *     summary: Generate comprehensive revenue optimization strategy
 *     tags: [Revenue Optimization]
 */
router.post('/:hotelId/optimization/strategy',
  authorize(['admin', 'revenue_manager']),
  hotelIdValidation,
  revenueOptimizationController.generateOptimizationStrategy
);

/**
 * @swagger
 * /api/revenue/{hotelId}/optimization/pricing:
 *   get:
 *     summary: Get localized pricing optimization
 *     tags: [Revenue Optimization]
 */
router.get('/:hotelId/optimization/pricing',
  authorize(['admin', 'revenue_manager']),
  hotelIdValidation,
  revenueOptimizationController.getPricingOptimization
);

/**
 * @swagger
 * /api/revenue/{hotelId}/analytics/regional:
 *   get:
 *     summary: Get regional market analysis
 *     tags: [Revenue Analytics]
 */
router.get('/:hotelId/analytics/regional',
  authorize(['admin', 'revenue_manager']),
  hotelIdValidation,
  revenueOptimizationController.getRegionalAnalysis
);

/**
 * @swagger
 * /api/revenue/{hotelId}/analytics/languages:
 *   get:
 *     summary: Get multi-language performance metrics
 *     tags: [Revenue Analytics]
 */
router.get('/:hotelId/analytics/languages',
  authorize(['admin', 'revenue_manager', 'content_manager']),
  hotelIdValidation,
  revenueOptimizationController.getLanguageMetrics
);

/**
 * @swagger
 * /api/revenue/{hotelId}/reports:
 *   post:
 *     summary: Generate comprehensive revenue report
 *     tags: [Revenue Reports]
 */
router.post('/:hotelId/reports',
  authorize(['admin', 'revenue_manager']),
  hotelIdValidation,
  [
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required'),
    body('reportType').optional().isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom_period']),
    body('baseCurrency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    validate
  ],
  revenueOptimizationController.generateRevenueReport
);

/**
 * @swagger
 * /api/revenue/{hotelId}/reports:
 *   get:
 *     summary: Get revenue reports list
 *     tags: [Revenue Reports]
 */
router.get('/:hotelId/reports',
  authorize(['admin', 'revenue_manager']),
  hotelIdValidation,
  revenueOptimizationController.getRevenueReports
);

/**
 * @swagger
 * /api/revenue/{hotelId}/reports/{reportId}:
 *   get:
 *     summary: Get specific revenue report
 *     tags: [Revenue Reports]
 */
router.get('/:hotelId/reports/:reportId',
  authorize(['admin', 'revenue_manager']),
  [
    ...hotelIdValidation,
    param('reportId').notEmpty().withMessage('Report ID is required'),
    validate
  ],
  revenueOptimizationController.getRevenueReport
);

/**
 * @swagger
 * /api/revenue/{hotelId}/dashboard:
 *   get:
 *     summary: Get comprehensive dashboard analytics
 *     tags: [Revenue Analytics]
 */
router.get('/:hotelId/dashboard',
  authorize(['admin', 'revenue_manager']),
  hotelIdValidation,
  revenueOptimizationController.getDashboardAnalytics
);

/**
 * @swagger
 * /api/revenue/{hotelId}/kpis:
 *   get:
 *     summary: Get optimization KPIs and metrics
 *     tags: [Revenue Analytics]
 */
router.get('/:hotelId/optimization/kpis',
  authorize(['admin', 'revenue_manager']),
  hotelIdValidation,
  revenueOptimizationController.getOptimizationKPIs
);

export default router;