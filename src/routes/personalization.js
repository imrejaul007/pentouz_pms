import express from 'express';
import {
  generatePersonalizedExperience,
  getPersonalizedContent,
  getPersonalizedPricing,
  getPersonalizedRecommendations,
  getPersonalizedOffers,
  getPersonalizedDashboard,
  getPersonalizedExperienceForGuest,
  updatePersonalizationPreferences,
  getPersonalizationAnalytics,
  testPersonalizationVariant
} from '../controllers/personalizationController.js';
import { authenticate } from '../middleware/auth.js';
import authorize from '../middleware/authorize.js';
import { crmTrackingMiddleware } from '../middleware/crmTrackingMiddleware.js';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.js';

const router = express.Router();

router.use(authenticate);

const guestIdValidation = [
  param('guestId').isMongoId().withMessage('Invalid guest ID'),
  validate
];

const preferencesValidation = [
  body('roomType')
    .optional()
    .isString()
    .withMessage('Room type must be a string'),
  body('priceRange')
    .optional()
    .isObject()
    .withMessage('Price range must be an object'),
  body('amenities')
    .optional()
    .isArray()
    .withMessage('Amenities must be an array'),
  body('communicationPreferences')
    .optional()
    .isObject()
    .withMessage('Communication preferences must be an object'),
  validate
];

const variantTestValidation = [
  body('variant')
    .isIn(['aggressive_discount', 'luxury_focused', 'urgency_boost', 'minimal_offers'])
    .withMessage('Invalid variant type'),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object'),
  validate
];

const contextValidation = [
  body('checkInDate')
    .optional()
    .isISO8601()
    .withMessage('Check-in date must be a valid date'),
  body('checkOutDate')
    .optional()
    .isISO8601()
    .withMessage('Check-out date must be a valid date'),
  body('guests')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Guests must be between 1 and 10'),
  body('budget')
    .optional()
    .isNumeric()
    .withMessage('Budget must be a number'),
  validate
];

// Core personalization endpoints
router.post('/experience',
  crmTrackingMiddleware('personalization_request'),
  contextValidation,
  generatePersonalizedExperience
);

router.get('/content',
  crmTrackingMiddleware('content_request'),
  getPersonalizedContent
);

router.post('/pricing',
  crmTrackingMiddleware('pricing_request'),
  contextValidation,
  getPersonalizedPricing
);

router.post('/recommendations',
  crmTrackingMiddleware('recommendation_request'),
  contextValidation,
  getPersonalizedRecommendations
);

router.post('/offers',
  crmTrackingMiddleware('offer_request'),
  contextValidation,
  getPersonalizedOffers
);

router.get('/dashboard',
  crmTrackingMiddleware('dashboard_view'),
  getPersonalizedDashboard
);

// Guest-specific personalization (Admin/Manager only)
router.post('/guests/:guestId/experience',
  authorize(['admin', 'manager']),
  guestIdValidation,
  contextValidation,
  getPersonalizedExperienceForGuest
);

// Preference management
router.put('/preferences',
  crmTrackingMiddleware('preferences_update'),
  preferencesValidation,
  updatePersonalizationPreferences
);

// Analytics and testing
router.get('/analytics',
  authorize(['admin', 'manager']),
  getPersonalizationAnalytics
);

router.post('/test/variant',
  authorize(['admin', 'manager']),
  variantTestValidation,
  testPersonalizationVariant
);

export default router;