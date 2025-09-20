import express from 'express';
import {
  createCampaign,
  getCampaigns,
  getCampaign,
  updateCampaign,
  sendCampaign,
  duplicateCampaign,
  deleteCampaign,
  previewCampaign,
  getAudienceCount,
  getCampaignAnalytics,
  getScheduledCampaigns
} from '../controllers/emailCampaignController.js';
import {
  trackEmailOpen,
  trackEmailClick,
  trackUnsubscribe,
  getEmailAnalytics,
  getBulkEmailAnalytics,
  getRealtimeMetrics
} from '../controllers/emailTrackingController.js';
import { authenticate } from '../middleware/auth.js';
import authorize from '../middleware/authorize.js';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.js';

const router = express.Router();

router.use(authenticate);

const createCampaignValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Campaign name must be between 1 and 100 characters'),
  body('subject')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Subject must be between 1 and 200 characters'),
  body('content')
    .optional()
    .isLength({ max: 50000 })
    .withMessage('Content must not exceed 50,000 characters'),
  body('htmlContent')
    .optional()
    .isLength({ max: 100000 })
    .withMessage('HTML content must not exceed 100,000 characters'),
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date')
    .custom((value) => {
      if (value && new Date(value) <= new Date()) {
        throw new Error('Scheduled date must be in the future');
      }
      return true;
    }),
  body('segmentCriteria')
    .optional()
    .isObject()
    .withMessage('Segment criteria must be an object'),
  body('template')
    .optional()
    .isString()
    .withMessage('Template must be a string'),
  body('personalization')
    .optional()
    .isObject()
    .withMessage('Personalization must be an object'),
  validate
];

const updateCampaignValidation = [
  param('id').isMongoId().withMessage('Invalid campaign ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Campaign name must be between 1 and 100 characters'),
  body('subject')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Subject must be between 1 and 200 characters'),
  body('content')
    .optional()
    .isLength({ max: 50000 })
    .withMessage('Content must not exceed 50,000 characters'),
  body('htmlContent')
    .optional()
    .isLength({ max: 100000 })
    .withMessage('HTML content must not exceed 100,000 characters'),
  body('scheduledAt')
    .optional()
    .custom((value) => {
      if (value && new Date(value) <= new Date()) {
        throw new Error('Scheduled date must be in the future');
      }
      return true;
    }),
  validate
];

const getCampaignsValidation = [
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
    .isIn(['draft', 'scheduled', 'sending', 'sent', 'failed'])
    .withMessage('Invalid status value'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must not exceed 100 characters'),
  validate
];

const campaignIdValidation = [
  param('id').isMongoId().withMessage('Invalid campaign ID'),
  validate
];

const audienceCountValidation = [
  body('segmentCriteria')
    .optional()
    .isObject()
    .withMessage('Segment criteria must be an object'),
  body('segmentCriteria.role')
    .optional()
    .isIn(['guest', 'staff', 'admin', 'manager'])
    .withMessage('Invalid role value'),
  body('segmentCriteria.isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('segmentCriteria.lastLoginAfter')
    .optional()
    .isISO8601()
    .withMessage('lastLoginAfter must be a valid ISO 8601 date'),
  body('segmentCriteria.totalBookingsMin')
    .optional()
    .isInt({ min: 0 })
    .withMessage('totalBookingsMin must be a non-negative integer'),
  validate
];

const previewValidation = [
  param('id').isMongoId().withMessage('Invalid campaign ID'),
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID'),
  validate
];

router.post('/', authorize(['admin', 'manager']), createCampaignValidation, createCampaign);

router.get('/', authorize(['admin', 'manager', 'staff']), getCampaignsValidation, getCampaigns);

router.get('/scheduled', authorize(['admin', 'manager']), getScheduledCampaigns);

router.post('/audience-count', authorize(['admin', 'manager']), audienceCountValidation, getAudienceCount);

router.get('/:id', authorize(['admin', 'manager', 'staff']), campaignIdValidation, getCampaign);

router.put('/:id', authorize(['admin', 'manager']), updateCampaignValidation, updateCampaign);

router.post('/:id/send', authorize(['admin', 'manager']), campaignIdValidation, sendCampaign);

router.post('/:id/duplicate', authorize(['admin', 'manager']), campaignIdValidation, duplicateCampaign);

router.delete('/:id', authorize(['admin', 'manager']), campaignIdValidation, deleteCampaign);

router.post('/:id/preview', authorize(['admin', 'manager']), previewValidation, previewCampaign);

router.get('/:id/analytics', authorize(['admin', 'manager', 'staff']), campaignIdValidation, getCampaignAnalytics);

// Email tracking routes (public - no authentication required)
router.get('/track/open/:campaignId/:userId/:trackingId', trackEmailOpen);
router.get('/track/click/:campaignId/:userId/:linkId', trackEmailClick);
router.get('/track/unsubscribe/:campaignId/:userId', trackUnsubscribe);

// Analytics routes (authenticated)
router.get('/:id/analytics/detailed', authorize(['admin', 'manager', 'staff']), campaignIdValidation, getEmailAnalytics);
router.get('/analytics/bulk', authorize(['admin', 'manager', 'staff']), getBulkEmailAnalytics);
router.get('/:id/analytics/realtime', authorize(['admin', 'manager', 'staff']), campaignIdValidation, getRealtimeMetrics);

export default router;