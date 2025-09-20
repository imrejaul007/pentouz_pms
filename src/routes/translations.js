import express from 'express';
import translationController from '../controllers/translationController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = express.Router();

// Validation schemas
const namespaceValidation = [
  param('namespace')
    .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .withMessage('Namespace must start with letter and contain only letters, numbers, and underscores'),
  validate
];

const languageValidation = [
  param('language')
    .isLength({ min: 2, max: 3 })
    .withMessage('Language code must be 2-3 characters')
    .isAlpha()
    .withMessage('Language code must contain only letters')
    .toUpperCase(),
  validate
];

const keyValidation = [
  param('key')
    .matches(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/)
    .withMessage('Translation key must follow format: category.subcategory.item'),
  validate
];

const translateTextValidation = [
  body('text')
    .notEmpty()
    .withMessage('Text is required'),
  body('toLanguage')
    .isLength({ min: 2, max: 3 })
    .withMessage('Target language is required and must be 2-3 characters')
    .isAlpha()
    .withMessage('Target language must contain only letters'),
  body('fromLanguage')
    .optional()
    .isLength({ min: 2, max: 3 })
    .withMessage('Source language must be 2-3 characters')
    .isAlpha()
    .withMessage('Source language must contain only letters'),
  validate
];

const saveTranslationValidation = [
  body('key')
    .matches(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/)
    .withMessage('Translation key must follow format: category.subcategory.item'),
  body('namespace')
    .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .withMessage('Namespace must start with letter and contain only letters, numbers, and underscores'),
  body('sourceText')
    .notEmpty()
    .withMessage('Source text is required'),
  body('translations')
    .isObject()
    .withMessage('Translations must be an object'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be low, medium, high, or critical'),
  validate
];

const batchTranslateValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items must be a non-empty array'),
  body('items.*.key')
    .matches(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/)
    .withMessage('Each item key must follow format: category.subcategory.item'),
  body('items.*.text')
    .notEmpty()
    .withMessage('Each item must have text'),
  body('fromLanguage')
    .optional()
    .isLength({ min: 2, max: 3 })
    .withMessage('Source language must be 2-3 characters'),
  body('toLanguages')
    .isArray({ min: 1 })
    .withMessage('Target languages must be a non-empty array'),
  body('toLanguages.*')
    .isLength({ min: 2, max: 3 })
    .withMessage('Each target language must be 2-3 characters'),
  validate
];

const batchTranslationsValidation = [
  body('keys')
    .isArray({ min: 1 })
    .withMessage('Keys must be a non-empty array'),
  body('language')
    .isLength({ min: 2, max: 3 })
    .withMessage('Language is required and must be 2-3 characters'),
  body('namespace')
    .optional()
    .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .withMessage('Namespace must start with letter and contain only letters, numbers, and underscores'),
  validate
];

// Public routes (no authentication required for reading translations)

/**
 * Get translation namespaces
 * GET /api/translations/namespaces
 */
router.get('/namespaces', translationController.getNamespaces);

/**
 * Get translations for namespace and language
 * GET /api/translations/:namespace/:language
 */
router.get('/:namespace/:language', 
  [...namespaceValidation, ...languageValidation],
  translationController.getTranslations
);

/**
 * Get batch translations
 * POST /api/translations/batch
 */
router.post('/batch', 
  batchTranslationsValidation,
  translationController.getBatchTranslations
);

// Protected routes (authentication required)
router.use(authenticate);

/**
 * Translate text
 * POST /api/translations/translate
 */
router.post('/translate', 
  authorize(['admin', 'content_manager', 'translator', 'staff', 'guest']), // Allow all authenticated users to translate
  translateTextValidation,
  translationController.translateText
);

/**
 * Batch translate multiple texts
 * POST /api/translations/batch-translate
 */
router.post('/batch-translate', 
  authorize(['admin', 'content_manager', 'translator']),
  batchTranslateValidation,
  translationController.batchTranslate
);

/**
 * Save/create translation
 * POST /api/translations
 */
router.post('/', 
  authorize(['admin', 'content_manager', 'translator']),
  saveTranslationValidation,
  translationController.saveTranslation
);

/**
 * Delete translation
 * DELETE /api/translations/:namespace/:key
 */
router.delete('/:namespace/:key', 
  authorize(['admin', 'content_manager']),
  [...namespaceValidation, ...keyValidation],
  translationController.deleteTranslation
);

/**
 * Approve translation
 * PUT /api/translations/:namespace/:key/approve
 */
router.put('/:namespace/:key/approve', 
  authorize(['admin', 'content_manager', 'reviewer']),
  [
    ...namespaceValidation,
    ...keyValidation,
    body('language')
      .isLength({ min: 2, max: 3 })
      .withMessage('Language is required and must be 2-3 characters'),
    body('reviewerId')
      .optional()
      .isString()
      .withMessage('Reviewer ID must be a string'),
    validate
  ],
  translationController.approveTranslation
);

/**
 * Get translation statistics
 * GET /api/translations/stats
 */
router.get('/stats', 
  authorize(['admin', 'content_manager', 'reviewer']),
  [
    query('namespace')
      .optional()
      .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
      .withMessage('Namespace must start with letter and contain only letters, numbers, and underscores'),
    query('language')
      .optional()
      .isLength({ min: 2, max: 3 })
      .withMessage('Language must be 2-3 characters'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    validate
  ],
  translationController.getTranslationStats
);

export default router;