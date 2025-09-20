import express from 'express';
import channelLocalizationController from '../controllers/channelLocalizationController.js';
import otaMonitoringService from '../services/otaMonitoringService.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = express.Router();

// Authentication required for all routes
router.use(authenticate);

// Validation schemas
const hotelIdValidation = [
  param('hotelId').isMongoId().withMessage('Invalid hotel ID'),
  validate
];

const channelIdValidation = [
  param('channelId').isIn([
    'booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 
    'trivago', 'kayak', 'priceline', 'hostelworld', 'vrbo'
  ]).withMessage('Invalid channel ID'),
  validate
];

const createChannelConfigValidation = [
  ...hotelIdValidation,
  body('channelId').isIn([
    'booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 
    'trivago', 'kayak', 'priceline', 'hostelworld', 'vrbo'
  ]).withMessage('Invalid channel ID'),
  body('channelName').notEmpty().withMessage('Channel name is required'),
  body('languageSettings.primaryLanguage').isLength({ min: 2, max: 3 }).withMessage('Invalid primary language'),
  body('currencySettings.baseCurrency').isLength({ min: 3, max: 3 }).withMessage('Invalid base currency'),
  validate
];

const updateChannelConfigValidation = [
  ...hotelIdValidation,
  ...channelIdValidation,
  validate
];

const rateDistributionValidation = [
  ...hotelIdValidation,
  body('rateData').isObject().withMessage('Rate data is required'),
  body('channels').optional().isArray().withMessage('Channels must be an array'),
  validate
];

const contentTranslationValidation = [
  ...hotelIdValidation,
  body('contentData').isObject().withMessage('Content data is required'),
  body('channels').optional().isArray().withMessage('Channels must be an array'),
  validate
];

const timeRangeValidation = [
  query('timeRange').optional().isIn(['1h', '24h', '7d', '30d', '90d']).withMessage('Invalid time range'),
  validate
];

// Channel Configuration Routes

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/channels:
 *   get:
 *     summary: Get all channel configurations for a hotel
 *     tags: [Channel Management]
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Channel configurations retrieved successfully
 */
router.get('/hotels/:hotelId/channels', 
  authorize(['admin', 'hotel_manager']),
  hotelIdValidation,
  channelLocalizationController.getChannelConfigurations
);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/channels:
 *   post:
 *     summary: Create new channel configuration
 *     tags: [Channel Management]
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channelId:
 *                 type: string
 *                 enum: [booking_com, expedia, airbnb, agoda, hotels_com]
 *               channelName:
 *                 type: string
 *               languageSettings:
 *                 type: object
 *               currencySettings:
 *                 type: object
 *     responses:
 *       201:
 *         description: Channel configuration created successfully
 */
router.post('/hotels/:hotelId/channels',
  authorize(['admin', 'hotel_manager']),
  createChannelConfigValidation,
  channelLocalizationController.createChannelConfiguration
);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/channels/{channelId}:
 *   put:
 *     summary: Update channel configuration
 *     tags: [Channel Management]
 */
router.put('/hotels/:hotelId/channels/:channelId',
  authorize(['admin', 'hotel_manager']),
  updateChannelConfigValidation,
  channelLocalizationController.updateChannelConfiguration
);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/channels/{channelId}:
 *   delete:
 *     summary: Delete channel configuration
 *     tags: [Channel Management]
 */
router.delete('/hotels/:hotelId/channels/:channelId',
  authorize(['admin', 'hotel_manager']),
  updateChannelConfigValidation,
  channelLocalizationController.deleteChannelConfiguration
);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/channels/{channelId}/test:
 *   post:
 *     summary: Test channel connection
 *     tags: [Channel Management]
 */
router.post('/hotels/:hotelId/channels/:channelId/test',
  authorize(['admin', 'hotel_manager', 'channel_manager']),
  updateChannelConfigValidation,
  channelLocalizationController.testChannelConnection
);

// Rate Distribution Routes

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/distribute-rates:
 *   post:
 *     summary: Distribute rates to OTA channels
 *     tags: [Rate Distribution]
 */
router.post('/hotels/:hotelId/distribute-rates',
  authorize(['admin', 'hotel_manager', 'revenue_manager']),
  rateDistributionValidation,
  channelLocalizationController.distributeRates
);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/distribution-status:
 *   get:
 *     summary: Get rate distribution status
 *     tags: [Rate Distribution]
 */
router.get('/hotels/:hotelId/distribution-status',
  authorize(['admin', 'hotel_manager', 'revenue_manager']),
  hotelIdValidation,
  channelLocalizationController.getDistributionStatus
);

// Content Translation Routes

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/translate-content:
 *   post:
 *     summary: Translate content for OTA channels
 *     tags: [Content Translation]
 */
router.post('/hotels/:hotelId/translate-content',
  authorize(['admin', 'hotel_manager', 'content_manager']),
  contentTranslationValidation,
  channelLocalizationController.translateContent
);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/queue-translation:
 *   post:
 *     summary: Queue content translation for batch processing
 *     tags: [Content Translation]
 */
router.post('/hotels/:hotelId/queue-translation',
  authorize(['admin', 'hotel_manager', 'content_manager']),
  contentTranslationValidation,
  channelLocalizationController.queueContentTranslation
);

// Currency and Language Support Routes

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/supported-currencies:
 *   get:
 *     summary: Get supported currencies for channels
 *     tags: [Channel Support]
 */
router.get('/hotels/:hotelId/supported-currencies',
  authorize(['admin', 'hotel_manager', 'revenue_manager']),
  [...hotelIdValidation, 
   query('channelId').optional().isString(),
   validate],
  channelLocalizationController.getSupportedCurrencies
);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/supported-languages:
 *   get:
 *     summary: Get supported languages for channels
 *     tags: [Channel Support]
 */
router.get('/hotels/:hotelId/supported-languages',
  authorize(['admin', 'hotel_manager', 'content_manager']),
  [...hotelIdValidation,
   query('channelId').optional().isString(),
   validate],
  channelLocalizationController.getSupportedLanguages
);

// Monitoring and Analytics Routes

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/channel-metrics:
 *   get:
 *     summary: Get channel performance metrics
 *     tags: [Monitoring]
 */
router.get('/hotels/:hotelId/channel-metrics',
  authorize(['admin', 'hotel_manager']),
  [...hotelIdValidation, ...timeRangeValidation],
  channelLocalizationController.getChannelMetrics
);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/dashboard:
 *   get:
 *     summary: Get comprehensive OTA dashboard data
 *     tags: [Monitoring]
 */
router.get('/hotels/:hotelId/dashboard',
  authorize(['admin', 'hotel_manager']),
  [...hotelIdValidation, ...timeRangeValidation],
  async (req, res) => {
    try {
      const { hotelId } = req.params;
      const { timeRange = '7d' } = req.query;

      const dashboardData = await otaMonitoringService.getDashboardData(hotelId, timeRange);

      res.json({
        success: true,
        data: dashboardData
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard data',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/channels/{channelId}/report:
 *   get:
 *     summary: Get detailed channel performance report
 *     tags: [Monitoring]
 */
router.get('/hotels/:hotelId/channels/:channelId/report',
  authorize(['admin', 'hotel_manager']),
  [...hotelIdValidation, ...channelIdValidation, ...timeRangeValidation],
  async (req, res) => {
    try {
      const { hotelId, channelId } = req.params;
      const { timeRange = '30d' } = req.query;

      const report = await otaMonitoringService.getChannelReport(hotelId, channelId, timeRange);

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get channel report',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/translation-analytics:
 *   get:
 *     summary: Get translation quality analytics
 *     tags: [Analytics]
 */
router.get('/hotels/:hotelId/translation-analytics',
  authorize(['admin', 'hotel_manager', 'content_manager']),
  [...hotelIdValidation,
   query('channelId').optional().isString(),
   query('language').optional().isLength({ min: 2, max: 3 }),
   query('contentType').optional().isString(),
   ...timeRangeValidation],
  async (req, res) => {
    try {
      const { hotelId } = req.params;
      const options = req.query;

      const analytics = await otaMonitoringService.getTranslationAnalytics(hotelId, options);

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get translation analytics',
        error: error.message
      });
    }
  }
);

// Bulk Operations Routes

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/sync-all:
 *   post:
 *     summary: Sync all channels for a hotel
 *     tags: [Bulk Operations]
 */
router.post('/hotels/:hotelId/sync-all',
  authorize(['admin', 'hotel_manager']),
  [...hotelIdValidation,
   body('syncType').optional().isIn(['full', 'incremental', 'rates_only', 'content_only']),
   body('force').optional().isBoolean(),
   validate],
  channelLocalizationController.syncAllChannels
);

// Webhook endpoints for channel notifications
router.post('/webhooks/channels/:channelId',
  // Special webhook authentication middleware would go here
  param('channelId').isString(),
  async (req, res) => {
    try {
      const { channelId } = req.params;
      const webhookData = req.body;

      // Process webhook based on channel type and event
      await otaMonitoringService.recordMetric(
        webhookData.hotelId,
        channelId,
        'webhook_received',
        {
          eventType: webhookData.eventType,
          data: webhookData,
          receivedAt: new Date()
        },
        { eventType: webhookData.eventType }
      );

      res.json({ success: true, message: 'Webhook processed' });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error.message
      });
    }
  }
);

// Real-time monitoring endpoints
router.get('/hotels/:hotelId/real-time-status',
  authorize(['admin', 'hotel_manager']),
  hotelIdValidation,
  async (req, res) => {
    try {
      const { hotelId } = req.params;

      // This would typically use WebSocket or Server-Sent Events
      // For now, return current status
      const status = otaMonitoringService.getRealTimeStatus(hotelId);

      res.json({
        success: true,
        data: status,
        timestamp: new Date()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get real-time status',
        error: error.message
      });
    }
  }
);

// Export monitoring data for external analysis
router.get('/hotels/:hotelId/export-metrics',
  authorize(['admin', 'hotel_manager']),
  [...hotelIdValidation,
   query('format').optional().isIn(['json', 'csv', 'xlsx']),
   ...timeRangeValidation,
   validate],
  async (req, res) => {
    try {
      const { hotelId } = req.params;
      const { format = 'json', timeRange = '30d' } = req.query;

      const dashboardData = await otaMonitoringService.getDashboardData(hotelId, timeRange);

      switch (format) {
        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename=ota-metrics-${hotelId}-${timeRange}.csv`);
          // Convert data to CSV format
          break;
        case 'xlsx':
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename=ota-metrics-${hotelId}-${timeRange}.xlsx`);
          // Convert data to Excel format
          break;
        default:
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename=ota-metrics-${hotelId}-${timeRange}.json`);
      }

      res.json(dashboardData);

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to export metrics',
        error: error.message
      });
    }
  }
);

export default router;
