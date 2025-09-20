import express from 'express';
import languageController from '../controllers/languageController.js';
import contentController from '../controllers/contentController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = express.Router();

// Validation schemas
const createLanguageValidation = [
  body('code')
    .isLength({ min: 2, max: 3 })
    .withMessage('Language code must be 2-3 characters')
    .isAlpha()
    .withMessage('Language code must contain only letters')
    .toUpperCase(),
  body('name')
    .notEmpty()
    .withMessage('Language name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Language name must be between 2 and 100 characters'),
  body('nativeName')
    .notEmpty()
    .withMessage('Native name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Native name must be between 2 and 100 characters'),
  body('locale')
    .notEmpty()
    .withMessage('Locale is required')
    .matches(/^[a-z]{2,3}-[a-z]{2}$/)
    .withMessage('Locale must be in format: language-country (e.g., en-us, fr-fr)'),
  body('direction')
    .optional()
    .isIn(['ltr', 'rtl'])
    .withMessage('Direction must be ltr or rtl'),
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean'),
  validate
];

const updateLanguageValidation = [
  param('code')
    .isLength({ min: 2, max: 3 })
    .withMessage('Language code must be 2-3 characters')
    .isAlpha()
    .withMessage('Language code must contain only letters')
    .toUpperCase(),
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Language name must be between 2 and 100 characters'),
  body('nativeName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Native name must be between 2 and 100 characters'),
  body('locale')
    .optional()
    .matches(/^[a-z]{2,3}-[a-z]{2}$/)
    .withMessage('Locale must be in format: language-country'),
  body('direction')
    .optional()
    .isIn(['ltr', 'rtl'])
    .withMessage('Direction must be ltr or rtl'),
  validate
];

const languageParamValidation = [
  param('code')
    .isLength({ min: 2, max: 3 })
    .withMessage('Language code must be 2-3 characters')
    .isAlpha()
    .withMessage('Language code must contain only letters')
    .toUpperCase(),
  validate
];

const translateResourceValidation = [
  param('resourceType')
    .isIn(['room_type', 'room_amenity', 'hotel_amenity', 'hotel_description', 'policy', 'email_template', 'content'])
    .withMessage('Invalid resource type'),
  param('resourceId')
    .isMongoId()
    .withMessage('Invalid resource ID'),
  body('fieldName')
    .notEmpty()
    .withMessage('Field name is required'),
  body('originalText')
    .notEmpty()
    .withMessage('Original text is required'),
  body('targetLanguages')
    .isArray({ min: 1 })
    .withMessage('Target languages must be a non-empty array'),
  body('targetLanguages.*')
    .isLength({ min: 2, max: 3 })
    .withMessage('Each target language must be 2-3 characters')
    .isAlpha()
    .withMessage('Each target language must contain only letters'),
  body('sourceLanguage')
    .optional()
    .isLength({ min: 2, max: 3 })
    .withMessage('Source language must be 2-3 characters')
    .isAlpha()
    .withMessage('Source language must contain only letters'),
  validate
];

const contentKeyValidation = [
  param('key')
    .matches(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/)
    .withMessage('Content key must follow format: namespace.category.item'),
  validate
];

const createContentValidation = [
  body('key')
    .matches(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/)
    .withMessage('Content key must follow format: namespace.category.item'),
  body('namespace')
    .isIn(['hotel', 'room', 'amenity', 'service', 'policy', 'email', 'sms', 'ui', 'form', 'error', 'notification', 'marketing', 'legal'])
    .withMessage('Invalid namespace'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isLength({ max: 50 })
    .withMessage('Category must be 50 characters or less'),
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title must be 200 characters or less'),
  body('defaultContent')
    .notEmpty()
    .withMessage('Default content is required'),
  body('contentType')
    .optional()
    .isIn(['text', 'html', 'markdown', 'template', 'json', 'list'])
    .withMessage('Invalid content type'),
  validate
];

// Public routes (no authentication required)

// Get all languages
router.get('/', languageController.getLanguages);

// Get language by code
router.get('/:code', languageParamValidation, languageController.getLanguage);

// Get supported languages for translation
router.get('/translation/supported', languageController.getSupportedLanguages);

// Detect language of text
router.post('/detect', [
  body('text').notEmpty().withMessage('Text is required'),
  validate
], languageController.detectLanguage);

// Format content by language
router.post('/format', [
  body('text').notEmpty().withMessage('Text is required'),
  body('languageCode').isLength({ min: 2, max: 3 }).withMessage('Language code required'),
  validate
], languageController.formatContent);

// Content routes (public access for reading)

// Get content with optional language
router.get('/content/all', contentController.getContent);

// Get content by key
router.get('/content/:key', contentKeyValidation, contentController.getContentByKey);

// Get content statistics
router.get('/content/stats/overview', contentController.getContentStats);

// Protected routes (authentication required)
router.use(authenticate);

// Language management (admin/content manager only)
router.post('/', 
  authorize(['admin', 'content_manager']), 
  createLanguageValidation, 
  languageController.createLanguage
);

router.put('/:code', 
  authorize(['admin', 'content_manager']), 
  updateLanguageValidation, 
  languageController.updateLanguage
);

router.delete('/:code', 
  authorize(['admin']), 
  languageParamValidation, 
  languageController.deleteLanguage
);

// Translation management

// Get resource translations
router.get('/translations/:resourceType/:resourceId', 
  authorize(['admin', 'content_manager', 'translator', 'reviewer']),
  [
    param('resourceType').notEmpty().withMessage('Resource type is required'),
    param('resourceId').isMongoId().withMessage('Invalid resource ID'),
    validate
  ],
  languageController.getResourceTranslations
);

// Translate resource
router.post('/translations/:resourceType/:resourceId', 
  authorize(['admin', 'content_manager', 'translator']),
  translateResourceValidation,
  languageController.translateResource
);

// Get pending translations
router.get('/translations/pending/review', 
  authorize(['admin', 'content_manager', 'reviewer', 'translator']),
  languageController.getPendingTranslations
);

// Approve translation
router.patch('/translations/:translationId/approve', 
  authorize(['admin', 'content_manager', 'reviewer']),
  [
    param('translationId').isMongoId().withMessage('Invalid translation ID'),
    body('notes').optional().isString().withMessage('Notes must be a string'),
    validate
  ],
  languageController.approveTranslation
);

// Reject translation
router.patch('/translations/:translationId/reject', 
  authorize(['admin', 'content_manager', 'reviewer']),
  [
    param('translationId').isMongoId().withMessage('Invalid translation ID'),
    body('notes').optional().isString().withMessage('Notes must be a string'),
    validate
  ],
  languageController.rejectTranslation
);

// Bulk update translations
router.patch('/translations/bulk', 
  authorize(['admin', 'content_manager', 'reviewer']),
  [
    body('updates').isArray({ min: 1 }).withMessage('Updates array is required'),
    body('updates.*.id').isMongoId().withMessage('Each update must have valid translation ID'),
    body('updates.*.action').isIn(['approved', 'rejected']).withMessage('Action must be approved or rejected'),
    validate
  ],
  languageController.bulkUpdateTranslations
);

// Get translation statistics
router.get('/translations/stats/overview', 
  authorize(['admin', 'content_manager', 'reviewer']),
  languageController.getTranslationStats
);

// Get translation workflow status
router.get('/translations/workflow/:resourceType/:resourceId/:targetLanguage', 
  authorize(['admin', 'content_manager', 'reviewer', 'translator']),
  [
    param('resourceType').notEmpty().withMessage('Resource type is required'),
    param('resourceId').isMongoId().withMessage('Invalid resource ID'),
    param('targetLanguage').isLength({ min: 2, max: 3 }).withMessage('Invalid target language'),
    validate
  ],
  languageController.getWorkflowStatus
);

// Channel support management
router.post('/:code/channels', 
  authorize(['admin', 'content_manager']),
  [
    ...languageParamValidation,
    body('channel')
      .isIn(['booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'trivago'])
      .withMessage('Invalid channel'),
    body('isDefault')
      .optional()
      .isBoolean()
      .withMessage('isDefault must be a boolean'),
    validate
  ],
  languageController.addChannelSupport
);

// Content management (protected routes)

// Create content
router.post('/content', 
  authorize(['admin', 'content_manager']),
  createContentValidation,
  contentController.createContent
);

// Update content
router.put('/content/:key', 
  authorize(['admin', 'content_manager']),
  [...contentKeyValidation, validate],
  contentController.updateContent
);

// Delete content
router.delete('/content/:key', 
  authorize(['admin', 'content_manager']),
  contentKeyValidation,
  contentController.deleteContent
);

// Publish content
router.patch('/content/:key/publish', 
  authorize(['admin', 'content_manager']),
  contentKeyValidation,
  contentController.publishContent
);

// Translate content
router.post('/content/:key/translate', 
  authorize(['admin', 'content_manager', 'translator']),
  [
    ...contentKeyValidation,
    body('targetLanguages')
      .isArray({ min: 1 })
      .withMessage('Target languages must be a non-empty array'),
    body('targetLanguages.*')
      .isLength({ min: 2, max: 3 })
      .withMessage('Each target language must be 2-3 characters'),
    validate
  ],
  contentController.translateContent
);

// Get content translations
router.get('/content/:key/translations', 
  authorize(['admin', 'content_manager', 'translator', 'reviewer']),
  contentKeyValidation,
  contentController.getContentTranslations
);

// Get translatable content
router.get('/content/translatable/list', 
  authorize(['admin', 'content_manager', 'translator']),
  contentController.getTranslatableContent
);

// Batch translate content
router.post('/content/batch/translate', 
  authorize(['admin', 'content_manager', 'translator']),
  [
    body('contentKeys')
      .isArray({ min: 1 })
      .withMessage('Content keys must be a non-empty array'),
    body('targetLanguages')
      .isArray({ min: 1 })
      .withMessage('Target languages must be a non-empty array'),
    validate
  ],
  contentController.batchTranslateContent
);

export default router;
