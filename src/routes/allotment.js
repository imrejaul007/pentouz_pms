import express from 'express';
import { body, param, query } from 'express-validator';
import allotmentController from '../controllers/allotmentController.js';
import allotmentSettingsController from '../controllers/allotmentSettingsController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for allocation operations
const allocationLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 allocation operations per minute
  message: {
    success: false,
    error: 'Too many allocation operations, please try again later.'
  }
});

// Rate limiting for booking operations
const bookingLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 booking operations per minute
  message: {
    success: false,
    error: 'Too many booking operations, please try again later.'
  }
});

// Rate limiting for analytics
const analyticsLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 analytics requests per minute
  message: {
    success: false,
    error: 'Too many analytics requests, please try again later.'
  }
});

// Validation schemas
const createAllotmentValidation = [
  body('name')
    .notEmpty()
    .withMessage('Allotment name is required')
    .isLength({ max: 200 })
    .withMessage('Allotment name must be less than 200 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('roomTypeId')
    .notEmpty()
    .withMessage('Room type ID is required')
    .isMongoId()
    .withMessage('Invalid room type ID'),
  
  body('defaultSettings.totalInventory')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Total inventory must be between 1 and 1000'),
  
  body('defaultSettings.defaultAllocationMethod')
    .optional()
    .isIn(['percentage', 'fixed', 'dynamic'])
    .withMessage('Invalid allocation method'),
  
  body('defaultSettings.overbookingAllowed')
    .optional()
    .isBoolean()
    .withMessage('Overbooking allowed must be a boolean'),
  
  body('defaultSettings.overbookingLimit')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Overbooking limit must be between 0 and 50'),
  
  body('channels')
    .optional()
    .isArray()
    .withMessage('Channels must be an array'),
  
  body('channels.*.channelId')
    .if(body('channels').exists())
    .notEmpty()
    .withMessage('Channel ID is required')
    .isIn(['direct', 'booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'custom'])
    .withMessage('Invalid channel ID'),
  
  body('channels.*.channelName')
    .if(body('channels').exists())
    .notEmpty()
    .withMessage('Channel name is required')
    .isLength({ max: 100 })
    .withMessage('Channel name must be less than 100 characters'),
  
  body('channels.*.priority')
    .if(body('channels').exists())
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Channel priority must be between 0 and 100'),
  
  body('channels.*.commission')
    .if(body('channels').exists())
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Commission must be between 0 and 100'),
  
  body('channels.*.markup')
    .if(body('channels').exists())
    .optional()
    .isFloat({ min: -100, max: 1000 })
    .withMessage('Markup must be between -100 and 1000')
];

const updateAllotmentValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid allotment ID'),
  
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Allotment name cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Allotment name must be less than 200 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Invalid status'),
  
  body('defaultSettings.totalInventory')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Total inventory must be between 1 and 1000')
];

const allotmentIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid allotment ID')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['all', 'active', 'inactive', 'suspended'])
    .withMessage('Invalid status filter'),
  
  query('roomTypeId')
    .optional()
    .isMongoId()
    .withMessage('Invalid room type ID'),
  
  query('sortBy')
    .optional()
    .isIn(['name', 'createdAt', 'updatedAt', 'status'])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

const dateRangeValidation = [
  query('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

const applyRuleValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid allotment ID'),
  
  body('ruleId')
    .notEmpty()
    .withMessage('Rule ID is required')
    .isMongoId()
    .withMessage('Invalid rule ID'),
  
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      const daysDiff = (new Date(endDate) - new Date(req.body.startDate)) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        throw new Error('Date range cannot exceed 365 days');
      }
      return true;
    })
];

const channelAllocationValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid allotment ID'),
  
  body('channelId')
    .notEmpty()
    .withMessage('Channel ID is required')
    .isIn(['direct', 'booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'custom'])
    .withMessage('Invalid channel ID'),
  
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  
  body('allocated')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Allocated rooms must be between 0 and 1000'),
  
  body('sold')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Sold rooms must be between 0 and 1000'),
  
  body('blocked')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Blocked rooms must be between 0 and 1000')
];

const bookingValidation = [
  body('roomTypeId')
    .notEmpty()
    .withMessage('Room type ID is required')
    .isMongoId()
    .withMessage('Invalid room type ID'),
  
  body('checkIn')
    .notEmpty()
    .withMessage('Check-in date is required')
    .isISO8601()
    .withMessage('Check-in date must be a valid ISO 8601 date'),
  
  body('checkOut')
    .notEmpty()
    .withMessage('Check-out date is required')
    .isISO8601()
    .withMessage('Check-out date must be a valid ISO 8601 date')
    .custom((checkOut, { req }) => {
      if (new Date(checkOut) <= new Date(req.body.checkIn)) {
        throw new Error('Check-out date must be after check-in date');
      }
      return true;
    }),
  
  body('channelId')
    .notEmpty()
    .withMessage('Channel ID is required')
    .isIn(['direct', 'booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'custom'])
    .withMessage('Invalid channel ID'),
  
  body('rooms')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Number of rooms must be between 1 and 10')
];

const releaseRoomsValidation = [
  ...bookingValidation, // Same validation as booking
  
  body('rooms')
    .notEmpty()
    .withMessage('Number of rooms to release is required')
    .isInt({ min: 1, max: 10 })
    .withMessage('Number of rooms must be between 1 and 10')
];

const analyticsValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid allotment ID'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  
  query('groupBy')
    .optional()
    .isIn(['day', 'week', 'month'])
    .withMessage('Group by must be day, week, or month')
];

const availabilityValidation = [
  query('roomTypeId')
    .notEmpty()
    .withMessage('Room type ID is required')
    .isMongoId()
    .withMessage('Invalid room type ID'),
  
  query('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  
  query('channelId')
    .optional()
    .isIn(['direct', 'booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'custom'])
    .withMessage('Invalid channel ID')
];

const exportValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid allotment ID'),

  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be json or csv'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

// Settings validation schemas
const globalSettingsValidation = [
  body('globalDefaults')
    .optional()
    .isObject()
    .withMessage('Global defaults must be an object'),

  body('globalDefaults.totalInventory')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Total inventory must be between 1 and 1000'),

  body('globalDefaults.overbookingLimit')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Overbooking limit must be between 0 and 50'),

  body('defaultChannels')
    .optional()
    .isArray()
    .withMessage('Default channels must be an array'),

  body('defaultChannels.*.channelId')
    .if(body('defaultChannels').exists())
    .isIn(['direct', 'booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'custom'])
    .withMessage('Invalid channel ID'),

  body('defaultChannels.*.commission')
    .if(body('defaultChannels').exists())
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Commission must be between 0 and 100')
];

const integrationSettingsValidation = [
  body('channelManager')
    .optional()
    .isObject()
    .withMessage('Channel manager settings must be an object'),

  body('pms')
    .optional()
    .isObject()
    .withMessage('PMS settings must be an object'),

  body('webhooks')
    .optional()
    .isArray()
    .withMessage('Webhooks must be an array')
];

const allocationRuleTemplateValidation = [
  body('name')
    .notEmpty()
    .withMessage('Template name is required')
    .isLength({ max: 100 })
    .withMessage('Template name must be less than 100 characters'),

  body('type')
    .isIn(['percentage', 'fixed', 'dynamic', 'priority'])
    .withMessage('Invalid allocation type'),

  body('allocation')
    .isObject()
    .withMessage('Allocation configuration is required')
];

const integrationTestValidation = [
  param('type')
    .isIn(['channel_manager', 'pms', 'webhook'])
    .withMessage('Invalid integration type')
];

const settingsValidation = [
  body('section')
    .isIn(['global', 'channels', 'analytics', 'integration'])
    .withMessage('Invalid settings section'),

  body('settings')
    .isObject()
    .withMessage('Settings must be an object')
];

// Admin routes - require authentication and admin role
router.use(authenticate, (req, res, next) => {
  // For testing purposes, allow any authenticated user
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.'
    });
  }
  // TODO: Re-enable admin role check in production
  // if (req.user.role !== 'admin') {
  //   return res.status(403).json({
  //     success: false,
  //     error: 'Access denied. Admin role required.'
  //   });
  // }
  next();
});

// Allotment CRUD operations
router.post('/', createAllotmentValidation, allotmentController.createAllotment);
router.get('/', paginationValidation, allotmentController.getAllotments);

// Dashboard route MUST come before /:id to prevent "dashboard" being treated as an ID
router.get('/dashboard', allotmentController.getDashboard);

// Room type route MUST come before /:id to prevent "room-type" being treated as an ID
router.get('/room-type/:roomTypeId',
  [
    param('roomTypeId')
      .isMongoId()
      .withMessage('Invalid room type ID'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
  ],
  allotmentController.getAllotmentByRoomType
);

router.get('/:id', allotmentIdValidation, allotmentController.getAllotment);
router.put('/:id', updateAllotmentValidation, allotmentController.updateAllotment);
router.delete('/:id', allotmentIdValidation, allotmentController.deleteAllotment);

// Date range operations
router.get('/date-range', dateRangeValidation, allotmentController.getAllotmentsByDateRange);

// Allocation management
router.post('/:id/apply-rule', 
  allocationLimit,
  applyRuleValidation, 
  allotmentController.applyAllocationRule
);

router.post('/:id/update-allocation',
  allocationLimit,
  channelAllocationValidation,
  allotmentController.updateChannelAllocation
);

router.post('/:id/optimize',
  allocationLimit,
  allotmentIdValidation,
  allotmentController.optimizeAllocations
);

// Booking operations
router.post('/bookings/process',
  bookingLimit,
  bookingValidation,
  allotmentController.processBooking
);

router.post('/bookings/release',
  bookingLimit,
  releaseRoomsValidation,
  allotmentController.releaseRooms
);

// Availability and analytics
router.get('/availability',
  availabilityValidation,
  allotmentController.getAvailability
);

router.get('/:id/analytics',
  optionalAuth,
  analyticsLimit,
  analyticsValidation,
  allotmentController.getAnalytics
);

router.get('/:id/channel-performance',
  analyticsLimit,
  allotmentIdValidation,
  allotmentController.getChannelPerformance
);

router.get('/:id/recommendations',
  allotmentIdValidation,
  allotmentController.getRecommendations
);

// Dashboard and reporting
// Note: Dashboard route moved above for proper routing order

// Export functionality
router.get('/:id/export',
  exportValidation,
  allotmentController.exportAllotment
);

// Settings routes - MUST come before public routes to prevent path conflicts
// Hotel settings management
router.get('/settings/hotel', allotmentSettingsController.getHotelSettings);
router.get('/settings/summary', allotmentSettingsController.getSettingsSummary);

// Global settings
router.put('/settings/global',
  globalSettingsValidation,
  allotmentSettingsController.updateGlobalSettings
);

// Integration settings
router.put('/settings/integrations',
  integrationSettingsValidation,
  allotmentSettingsController.updateIntegrationSettings
);

// Analytics settings
router.put('/settings/analytics',
  body('analyticsSettings').isObject().withMessage('Analytics settings must be an object'),
  allotmentSettingsController.updateAnalyticsSettings
);

// Allocation rule templates
router.post('/settings/templates',
  allocationRuleTemplateValidation,
  allotmentSettingsController.addAllocationRuleTemplate
);

router.delete('/settings/templates/:templateId',
  param('templateId').isMongoId().withMessage('Invalid template ID'),
  allotmentSettingsController.deleteAllocationRuleTemplate
);

// Integration testing
router.post('/settings/test/:type',
  integrationTestValidation,
  allotmentSettingsController.testIntegration
);

// Settings utilities
router.post('/settings/validate',
  settingsValidation,
  allotmentSettingsController.validateSettings
);

router.post('/settings/reset', allotmentSettingsController.resetToDefaults);

router.get('/settings/export', allotmentSettingsController.exportSettings);

router.post('/settings/import',
  body('*').custom((value, { req }) => {
    if (!req.body || typeof req.body !== 'object') {
      throw new Error('Import data must be a valid JSON object');
    }
    return true;
  }),
  allotmentSettingsController.importSettings
);

// Default channel configurations
router.get('/settings/channels/defaults', allotmentSettingsController.getDefaultChannels);

// Public routes for booking systems (limited authentication)
const publicRouter = express.Router();

// Availability check (for booking engines)
publicRouter.get('/availability/check',
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // High limit for booking engines
    message: { success: false, error: 'Rate limit exceeded' }
  }),
  availabilityValidation,
  allotmentController.getAvailability
);

// Booking processing (for integrated booking systems)
publicRouter.post('/bookings/process',
  bookingLimit,
  authenticate, // Still require authentication but allow booking systems
  bookingValidation,
  allotmentController.processBooking
);

// Mount public routes
router.use('/public', publicRouter);

// Webhook routes (for channel manager integrations)
const webhookRouter = express.Router();

webhookRouter.post('/inventory-update',
  rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 500, // High limit for channel managers
    message: { success: false, error: 'Webhook rate limit exceeded' }
  }),
  [
    body('hotelId')
      .notEmpty()
      .withMessage('Hotel ID is required')
      .isMongoId()
      .withMessage('Invalid hotel ID'),
    
    body('roomTypeId')
      .notEmpty()
      .withMessage('Room type ID is required')
      .isMongoId()
      .withMessage('Invalid room type ID'),
    
    body('updates')
      .isArray()
      .withMessage('Updates must be an array'),
    
    body('updates.*.date')
      .isISO8601()
      .withMessage('Date must be valid ISO 8601 format'),
    
    body('updates.*.channelId')
      .isIn(['direct', 'booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'custom'])
      .withMessage('Invalid channel ID')
  ],
  async (req, res) => {
    try {
      // This would be implemented for channel manager integrations
      res.json({
        success: true,
        message: 'Inventory update received',
        processed: req.body.updates.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to process inventory update'
      });
    }
  }
);

// Mount webhook routes
router.use('/webhooks', webhookRouter);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Allotment route error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }))
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }
  
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Allotment configuration already exists for this room type'
    });
  }
  
  if (error.message && error.message.includes('insufficient inventory')) {
    return res.status(409).json({
      success: false,
      error: 'Insufficient inventory',
      message: error.message
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

export default router;