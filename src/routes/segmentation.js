import express from 'express';
import {
  performAdvancedSegmentation,
  getSegmentInsights,
  getAvailableSegments,
  getSegmentationSummary,
  getSegmentMembers,
  analyzeCustomerJourney
} from '../controllers/segmentationController.js';
import { authenticate } from '../middleware/auth.js';
import authorize from '../middleware/authorize.js';
import { param, query } from 'express-validator';
import { validate } from '../middleware/validation.js';

const router = express.Router();

router.use(authenticate);

const segmentIdValidation = [
  param('segmentId')
    .isString()
    .withMessage('Segment ID must be a string')
    .isLength({ min: 1, max: 50 })
    .withMessage('Segment ID must be between 1 and 50 characters'),
  validate
];

const userIdValidation = [
  param('userId').isMongoId().withMessage('Invalid user ID'),
  validate
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
  validate
];

// Advanced segmentation analysis
router.post('/analyze', authorize(['admin', 'manager']), performAdvancedSegmentation);

// Get segmentation summary
router.get('/summary', authorize(['admin', 'manager', 'staff']), getSegmentationSummary);

// Get available segment rules
router.get('/rules', authorize(['admin', 'manager', 'staff']), getAvailableSegments);

// Get specific segment insights
router.get('/segments/:segmentId/insights', authorize(['admin', 'manager', 'staff']), segmentIdValidation, getSegmentInsights);

// Get segment members with pagination
router.get('/segments/:segmentId/members', authorize(['admin', 'manager', 'staff']), segmentIdValidation, paginationValidation, getSegmentMembers);

// Analyze customer journey for specific user
router.get('/journey/:userId', authorize(['admin', 'manager', 'staff']), userIdValidation, analyzeCustomerJourney);

export default router;