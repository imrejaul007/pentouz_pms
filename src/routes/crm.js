import express from 'express';
import {
  getGuestProfile,
  getGuestInsights,
  updateGuestProfile,
  getGuestBehaviorAnalytics,
  trackGuestBehavior,
  getSegmentedGuests,
  getCRMAnalytics,
  refreshGuestMetrics,
  bulkUpdateMetrics,
  getPersonalizationData
} from '../controllers/crmController.js';
import { authenticate } from '../middleware/auth.js';
import authorize from '../middleware/authorize.js';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.js';

const router = express.Router();

router.use(authenticate);

const guestIdValidation = [
  param('userId').isMongoId().withMessage('Invalid user ID'),
  validate
];

const behaviorTrackingValidation = [
  body('behaviorType')
    .isIn([
      'page_view', 'room_search', 'room_view', 'add_to_cart', 'checkout_start',
      'booking_complete', 'email_open', 'email_click', 'support_contact',
      'review_left', 'loyalty_action', 'preferences_update', 'profile_update'
    ])
    .withMessage('Invalid behavior type'),
  body('sessionId')
    .optional()
    .isString()
    .withMessage('Session ID must be a string'),
  body('deviceType')
    .optional()
    .isIn(['desktop', 'mobile', 'tablet'])
    .withMessage('Invalid device type'),
  body('transactionValue')
    .optional()
    .isNumeric()
    .withMessage('Transaction value must be numeric'),
  validate
];

const segmentationValidation = [
  query('segment')
    .optional()
    .isIn([
      'Champions', 'Loyal Customers', 'Potential Loyalists', 'New Customers',
      'Promising', 'Need Attention', 'About to Sleep', 'At Risk',
      'Cannot Lose Them', 'Hibernating', 'Lost'
    ])
    .withMessage('Invalid segment'),
  query('lifecycleStage')
    .optional()
    .isIn(['prospect', 'new_customer', 'active', 'loyal', 'champion', 'at_risk', 'lost'])
    .withMessage('Invalid lifecycle stage'),
  query('minLoyaltyScore')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Min loyalty score must be between 0 and 100'),
  query('maxLoyaltyScore')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Max loyalty score must be between 0 and 100'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validate
];

const profileUpdateValidation = [
  param('userId').isMongoId().withMessage('Invalid user ID'),
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object'),
  body('communicationPreferences')
    .optional()
    .isObject()
    .withMessage('Communication preferences must be an object'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  validate
];

const behaviorAnalyticsValidation = [
  param('userId').isMongoId().withMessage('Invalid user ID'),
  query('timeRange')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Time range must be between 1 and 365 days'),
  validate
];

// Guest profile management
router.get('/guests/:userId/profile', authorize(['admin', 'manager', 'staff']), guestIdValidation, getGuestProfile);

router.get('/guests/:userId/insights', authorize(['admin', 'manager', 'staff']), guestIdValidation, getGuestInsights);

router.put('/guests/:userId/profile', authorize(['admin', 'manager']), profileUpdateValidation, updateGuestProfile);

router.get('/guests/:userId/personalization', authorize(['admin', 'manager', 'staff']), guestIdValidation, getPersonalizationData);

// Behavior tracking and analytics
router.get('/guests/:userId/behavior', authorize(['admin', 'manager', 'staff']), behaviorAnalyticsValidation, getGuestBehaviorAnalytics);

router.post('/guests/:userId/behavior', authorize(['admin', 'manager', 'staff']), guestIdValidation, behaviorTrackingValidation, trackGuestBehavior);

// Segmentation and analytics
router.get('/segments', authorize(['admin', 'manager', 'staff']), segmentationValidation, getSegmentedGuests);

router.get('/analytics', authorize(['admin', 'manager', 'staff']), getCRMAnalytics);

// Metrics management
router.post('/guests/:userId/refresh-metrics', authorize(['admin', 'manager']), guestIdValidation, refreshGuestMetrics);

router.post('/bulk-update-metrics', authorize(['admin', 'manager']), bulkUpdateMetrics);

export default router;