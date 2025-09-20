import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import webSettingsController from '../controllers/webSettingsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';

const router = express.Router();

// Middleware to check for validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  console.log('🟡 WebSettings Route Validation:', {
    method: req.method,
    url: req.url,
    params: req.params,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    hasErrors: !errors.isEmpty(),
    errors: errors.array()
  });

  if (!errors.isEmpty()) {
    console.log('🔴 WebSettings Route Validation FAILED:', {
      validationErrors: errors.array(),
      method: req.method,
      url: req.url,
      hotelId: req.params.hotelId
    });
    
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  
  console.log('🟢 WebSettings Route Validation PASSED');
  next();
};

// Apply authentication and admin role requirement to all routes
router.use(authenticate);
router.use(requireRole(['admin']));

// GET /api/v1/web-settings/:hotelId - Get web settings for hotel
router.get('/:hotelId',
  [
    param('hotelId').isMongoId().withMessage('Valid hotel ID is required')
  ],
  handleValidationErrors,
  webSettingsController.getSettings
);

// PUT /api/v1/web-settings/:hotelId - Update web settings
router.put('/:hotelId',
  [
    param('hotelId').isMongoId().withMessage('Valid hotel ID is required')
    // Removed all body validation to allow flexible updates
  ],
  handleValidationErrors,
  webSettingsController.updateSettings
);

// PUT /api/v1/web-settings/:hotelId/section/:section - Update specific settings section
router.put('/:hotelId/section/:section',
  [
    param('hotelId').isMongoId().withMessage('Valid hotel ID is required'),
    param('section').isIn(['general', 'booking', 'payment', 'seo', 'integrations', 'theme', 'advanced', 'maintenance']).withMessage('Invalid settings section')
    // Removed all body validation to allow flexible section updates
  ],
  handleValidationErrors,
  webSettingsController.updateSection
);

// POST /api/v1/web-settings/:hotelId/test - Test settings configuration
router.post('/:hotelId/test',
  [
    param('hotelId').isMongoId().withMessage('Valid hotel ID is required'),
    body('type').isIn(['payment_gateway', 'email_marketing', 'google_analytics', 'facebook_pixel']).withMessage('Invalid test type'),
    body('config').isObject().withMessage('Configuration object is required')
  ],
  handleValidationErrors,
  webSettingsController.testSettings
);

// GET /api/v1/web-settings/:hotelId/export - Export settings
router.get('/:hotelId/export',
  [
    param('hotelId').isMongoId().withMessage('Valid hotel ID is required'),
    query('format').optional().isIn(['json']).withMessage('Invalid export format')
  ],
  handleValidationErrors,
  webSettingsController.exportSettings
);

// POST /api/v1/web-settings/:hotelId/import - Import settings
router.post('/:hotelId/import',
  [
    param('hotelId').isMongoId().withMessage('Valid hotel ID is required'),
    body().isObject().withMessage('Settings data is required')
  ],
  handleValidationErrors,
  webSettingsController.importSettings
);

// POST /api/v1/web-settings/:hotelId/preview - Generate settings preview
router.post('/:hotelId/preview',
  [
    param('hotelId').isMongoId().withMessage('Valid hotel ID is required'),
    body().isObject().withMessage('Preview data is required')
  ],
  handleValidationErrors,
  webSettingsController.previewSettings
);

// POST /api/v1/web-settings/:hotelId/reset - Reset settings to default
router.post('/:hotelId/reset',
  [
    param('hotelId').isMongoId().withMessage('Valid hotel ID is required'),
    body('confirm').equals('RESET').withMessage('Confirmation required: must send "confirm": "RESET"')
  ],
  handleValidationErrors,
  webSettingsController.resetToDefault
);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Web Settings API Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

export default router;