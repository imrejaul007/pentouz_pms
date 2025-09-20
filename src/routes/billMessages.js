import express from 'express';
import billMessageController from '../controllers/billMessageController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = express.Router({ mergeParams: true });

// Validation schemas
const createMessageValidation = [
  body('messageName')
    .notEmpty()
    .withMessage('Message name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Message name must be between 2 and 100 characters'),

  body('messageCode')
    .notEmpty()
    .withMessage('Message code is required')
    .isLength({ min: 2, max: 20 })
    .withMessage('Message code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9_-]+$/i)
    .withMessage('Message code must contain only letters, numbers, underscores, and hyphens'),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('messageTemplate')
    .notEmpty()
    .withMessage('Message template is required')
    .isLength({ max: 2000 })
    .withMessage('Message template cannot exceed 2000 characters'),

  body('messageType')
    .notEmpty()
    .withMessage('Message type is required')
    .isIn([
      'welcome', 'checkout', 'payment_reminder', 'service_charge',
      'late_checkout', 'damage_notice', 'promotional', 'thank_you',
      'policy_notice', 'amenity_info', 'custom', 'legal_notice',
      'cancellation', 'no_show', 'upgrade_notice', 'special_request'
    ])
    .withMessage('Invalid message type'),

  body('category')
    .notEmpty()
    .withMessage('Message category is required')
    .isIn(['billing', 'service', 'promotional', 'informational', 'legal', 'operational'])
    .withMessage('Invalid message category'),

  body('templateVariables')
    .optional()
    .isArray()
    .withMessage('Template variables must be an array'),

  body('templateVariables.*.name')
    .optional()
    .notEmpty()
    .withMessage('Variable name is required')
    .isLength({ max: 50 })
    .withMessage('Variable name cannot exceed 50 characters'),

  body('templateVariables.*.displayName')
    .optional()
    .notEmpty()
    .withMessage('Variable display name is required')
    .isLength({ max: 100 })
    .withMessage('Variable display name cannot exceed 100 characters'),

  body('templateVariables.*.dataType')
    .optional()
    .isIn(['string', 'number', 'date', 'currency', 'boolean', 'array'])
    .withMessage('Invalid variable data type'),

  body('templateVariables.*.required')
    .optional()
    .isBoolean()
    .withMessage('Variable required field must be a boolean'),

  body('templateVariables.*.description')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Variable description cannot exceed 200 characters'),

  body('applicableRoomTypes')
    .optional()
    .isArray()
    .withMessage('Applicable room types must be an array'),

  body('applicableRoomTypes.*')
    .optional()
    .isMongoId()
    .withMessage('Each room type ID must be a valid MongoDB ID'),

  body('applicableChannels')
    .optional()
    .isArray()
    .withMessage('Applicable channels must be an array'),

  body('applicableChannels.*')
    .optional()
    .isIn(['direct', 'booking_com', 'expedia', 'airbnb', 'agoda', 'all'])
    .withMessage('Invalid channel'),

  body('applicableGuestTypes')
    .optional()
    .isArray()
    .withMessage('Applicable guest types must be an array'),

  body('applicableGuestTypes.*')
    .optional()
    .isIn(['VIP', 'corporate', 'group', 'leisure', 'government', 'crew', 'all'])
    .withMessage('Invalid guest type'),

  body('triggerConditions.automaticTrigger')
    .optional()
    .isBoolean()
    .withMessage('Automatic trigger must be a boolean'),

  body('triggerConditions.triggerEvents')
    .optional()
    .isArray()
    .withMessage('Trigger events must be an array'),

  body('triggerConditions.triggerEvents.*')
    .optional()
    .isIn([
      'check_in', 'check_out', 'payment_due', 'payment_received',
      'service_added', 'damage_reported', 'late_checkout',
      'cancellation', 'no_show', 'booking_confirmation',
      'pre_arrival', 'post_departure', 'manual'
    ])
    .withMessage('Invalid trigger event'),

  body('triggerConditions.triggerDelay.amount')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Trigger delay amount must be a non-negative integer'),

  body('triggerConditions.triggerDelay.unit')
    .optional()
    .isIn(['minutes', 'hours', 'days'])
    .withMessage('Invalid trigger delay unit'),

  body('triggerConditions.conditions.minAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum amount must be a non-negative number'),

  body('triggerConditions.conditions.maxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum amount must be a non-negative number'),

  body('triggerConditions.conditions.requiresApproval')
    .optional()
    .isBoolean()
    .withMessage('Requires approval must be a boolean'),

  body('triggerConditions.conditions.approvalThreshold')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Approval threshold must be a non-negative number'),

  body('triggerConditions.conditions.weekdayOnly')
    .optional()
    .isBoolean()
    .withMessage('Weekday only must be a boolean'),

  body('triggerConditions.conditions.weekendOnly')
    .optional()
    .isBoolean()
    .withMessage('Weekend only must be a boolean'),

  body('triggerConditions.conditions.specificDates')
    .optional()
    .isArray()
    .withMessage('Specific dates must be an array'),

  body('triggerConditions.conditions.specificDates.*')
    .optional()
    .isISO8601()
    .withMessage('Each specific date must be a valid ISO date'),

  body('triggerConditions.conditions.excludeDates')
    .optional()
    .isArray()
    .withMessage('Exclude dates must be an array'),

  body('triggerConditions.conditions.excludeDates.*')
    .optional()
    .isISO8601()
    .withMessage('Each exclude date must be a valid ISO date'),

  body('formatting.fontSize')
    .optional()
    .isIn(['small', 'medium', 'large'])
    .withMessage('Invalid font size'),

  body('formatting.fontStyle')
    .optional()
    .isIn(['normal', 'bold', 'italic'])
    .withMessage('Invalid font style'),

  body('formatting.alignment')
    .optional()
    .isIn(['left', 'center', 'right', 'justify'])
    .withMessage('Invalid text alignment'),

  body('formatting.includeHeader')
    .optional()
    .isBoolean()
    .withMessage('Include header must be a boolean'),

  body('formatting.includeFooter')
    .optional()
    .isBoolean()
    .withMessage('Include footer must be a boolean'),

  body('formatting.headerText')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Header text cannot exceed 200 characters'),

  body('formatting.footerText')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Footer text cannot exceed 200 characters'),

  body('language')
    .optional()
    .isLength({ max: 5 })
    .withMessage('Language code cannot exceed 5 characters'),

  body('translations')
    .optional()
    .isArray()
    .withMessage('Translations must be an array'),

  body('translations.*.language')
    .optional()
    .notEmpty()
    .withMessage('Translation language is required')
    .isLength({ max: 5 })
    .withMessage('Translation language code cannot exceed 5 characters'),

  body('translations.*.messageTemplate')
    .optional()
    .notEmpty()
    .withMessage('Translation message template is required')
    .isLength({ max: 2000 })
    .withMessage('Translation template cannot exceed 2000 characters'),

  body('translations.*.headerText')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Translation header cannot exceed 200 characters'),

  body('translations.*.footerText')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Translation footer cannot exceed 200 characters'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),

  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean'),

  body('priority')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Priority must be between 0 and 100'),

  body('integrationSettings.printAutomatically')
    .optional()
    .isBoolean()
    .withMessage('Print automatically must be a boolean'),

  body('integrationSettings.emailCopy')
    .optional()
    .isBoolean()
    .withMessage('Email copy must be a boolean'),

  body('integrationSettings.emailAddresses')
    .optional()
    .isArray()
    .withMessage('Email addresses must be an array'),

  body('integrationSettings.emailAddresses.*')
    .optional()
    .isEmail()
    .withMessage('Invalid email address'),

  body('integrationSettings.attachToFolio')
    .optional()
    .isBoolean()
    .withMessage('Attach to folio must be a boolean'),

  body('integrationSettings.chargeCode')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Charge code cannot exceed 20 characters'),

  body('integrationSettings.requireSignature')
    .optional()
    .isBoolean()
    .withMessage('Require signature must be a boolean'),

  body('integrationSettings.generatePDF')
    .optional()
    .isBoolean()
    .withMessage('Generate PDF must be a boolean'),

  body('scheduling.scheduledDate')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO date'),

  body('scheduling.recurringSchedule.enabled')
    .optional()
    .isBoolean()
    .withMessage('Recurring schedule enabled must be a boolean'),

  body('scheduling.recurringSchedule.frequency')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
    .withMessage('Invalid recurring frequency'),

  body('scheduling.recurringSchedule.interval')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Recurring interval must be at least 1'),

  body('scheduling.recurringSchedule.endDate')
    .optional()
    .isISO8601()
    .withMessage('Recurring end date must be a valid ISO date'),

  body('scheduling.recurringSchedule.maxOccurrences')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max occurrences must be at least 1'),

  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),

  body('internalNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Internal notes cannot exceed 1000 characters'),

  validate
];

const updateMessageValidation = [
  param('id')
    .isMongoId()
    .withMessage('Message ID must be a valid MongoDB ID'),

  ...createMessageValidation.slice(0, -1), // Remove validate middleware
  validate
];

const processMessageValidation = [
  body('variables')
    .optional()
    .isObject()
    .withMessage('Variables must be an object'),

  body('languageCode')
    .optional()
    .isLength({ max: 5 })
    .withMessage('Language code cannot exceed 5 characters'),

  body('guestId')
    .optional()
    .isMongoId()
    .withMessage('Guest ID must be a valid MongoDB ID'),

  body('bookingId')
    .optional()
    .isMongoId()
    .withMessage('Booking ID must be a valid MongoDB ID'),

  body('roomId')
    .optional()
    .isMongoId()
    .withMessage('Room ID must be a valid MongoDB ID'),

  validate
];

const previewValidation = [
  body('sampleVariables')
    .optional()
    .isObject()
    .withMessage('Sample variables must be an object'),

  validate
];

const templateValidation = [
  body('template')
    .notEmpty()
    .withMessage('Template is required')
    .isLength({ max: 2000 })
    .withMessage('Template cannot exceed 2000 characters'),

  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array'),

  validate
];

const bulkUpdateValidation = [
  body('messageIds')
    .isArray({ min: 1 })
    .withMessage('Message IDs must be a non-empty array'),

  body('messageIds.*')
    .isMongoId()
    .withMessage('Each message ID must be a valid MongoDB ID'),

  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean'),

  validate
];

const duplicateValidation = [
  body('newName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('New name must be between 2 and 100 characters'),

  body('newCode')
    .optional()
    .isLength({ min: 2, max: 20 })
    .withMessage('New code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9_-]+$/i)
    .withMessage('New code must contain only letters, numbers, underscores, and hyphens'),

  validate
];

const importValidation = [
  body('messages')
    .isArray({ min: 1 })
    .withMessage('Messages must be a non-empty array'),

  body('skipDuplicates')
    .optional()
    .isBoolean()
    .withMessage('Skip duplicates must be a boolean'),

  body('updateExisting')
    .optional()
    .isBoolean()
    .withMessage('Update existing must be a boolean'),

  validate
];

const paramValidation = [
  param('hotelId')
    .isMongoId()
    .withMessage('Hotel ID must be a valid MongoDB ID'),
  validate
];

const idParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Message ID must be a valid MongoDB ID'),
  validate
];

// All routes require authentication
router.use(authenticate);

// Public API endpoints (accessible to all authenticated users)

// Get message options for dropdowns
// router.get('/options',
//   billMessageController.getMessageOptions
// ); // Method does not exist - commented out

// Template validation endpoint
// router.post('/validate-template',
//   templateValidation,
//   billMessageController.validateTemplate
// ); // Method does not exist - commented out

// Admin routes (require appropriate permissions)

// Get all bill messages for a hotel
router.get('/hotels/:hotelId',
  authorize(['admin', 'manager', 'front_desk', 'finance']),
  paramValidation,
  billMessageController.getBillMessages
);

// Get usage analytics
router.get('/hotels/:hotelId/analytics',
  authorize(['admin', 'manager', 'finance']),
  paramValidation,
  billMessageController.getUsageAnalytics
);

// Export messages
router.get('/hotels/:hotelId/export',
  authorize(['admin', 'manager']),
  paramValidation,
  billMessageController.exportMessages
);

// Get single bill message by ID
router.get('/:id',
  authorize(['admin', 'manager', 'front_desk', 'finance']),
  idParamValidation,
  billMessageController.getBillMessage
);

// Create new bill message (admin and manager only)
router.post('/hotels/:hotelId',
  authorize(['admin', 'manager']),
  paramValidation,
  createMessageValidation,
  billMessageController.createBillMessage
);

// Update bill message (admin and manager only)
router.put('/:id',
  authorize(['admin', 'manager']),
  updateMessageValidation,
  billMessageController.updateBillMessage
);

// Process message template
router.post('/:id/process',
  authorize(['admin', 'manager', 'front_desk', 'finance']),
  idParamValidation,
  processMessageValidation,
  billMessageController.processMessage
);

// Generate message preview
router.post('/:id/preview',
  authorize(['admin', 'manager', 'front_desk']),
  idParamValidation,
  previewValidation,
  billMessageController.generatePreview
);

// Duplicate message
router.post('/:id/duplicate',
  authorize(['admin', 'manager']),
  idParamValidation,
  duplicateValidation,
  billMessageController.duplicateMessage
);

// Find applicable messages for trigger event
router.post('/hotels/:hotelId/applicable',
  authorize(['admin', 'manager', 'front_desk', 'system']),
  paramValidation,
  billMessageController.findApplicableMessages
);

// Auto-generate messages for trigger event
router.post('/hotels/:hotelId/auto-generate',
  authorize(['admin', 'manager', 'front_desk', 'system']),
  paramValidation,
  billMessageController.autoGenerateMessages
);

// Bulk update message status (admin and manager only)
router.patch('/hotels/:hotelId/bulk-update',
  authorize(['admin', 'manager']),
  paramValidation,
  bulkUpdateValidation,
  billMessageController.bulkUpdateStatus
);

// Import messages (admin only)
router.post('/hotels/:hotelId/import',
  authorize(['admin']),
  paramValidation,
  importValidation,
  billMessageController.importMessages
);

// Delete bill message (admin only)
router.delete('/:id',
  authorize(['admin']),
  idParamValidation,
  billMessageController.deleteBillMessage
);

// Error handling middleware specific to bill message routes
router.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: Object.keys(err.errors).map(field => ({
        field,
        message: err.errors[field].message
      }))
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    let message = 'Duplicate value error';

    if (field === 'messageCode') {
      message = 'A message with this code already exists in this hotel.';
    }

    return res.status(400).json({
      status: 'error',
      message,
      field
    });
  }

  if (err.message && err.message.includes('Message code already exists')) {
    return res.status(400).json({
      status: 'error',
      message: 'Message code already exists in this hotel',
      field: 'messageCode'
    });
  }

  if (err.message && err.message.includes('Template variable names must be unique')) {
    return res.status(400).json({
      status: 'error',
      message: 'Template variable names must be unique',
      field: 'templateVariables'
    });
  }

  if (err.message && err.message.includes('Automatic triggers require at least one trigger event')) {
    return res.status(400).json({
      status: 'error',
      message: 'Automatic triggers require at least one trigger event',
      field: 'triggerConditions.triggerEvents'
    });
  }

  if (err.message && err.message.includes('Minimum amount cannot be greater than maximum amount')) {
    return res.status(400).json({
      status: 'error',
      message: 'Minimum amount cannot be greater than maximum amount',
      field: 'triggerConditions.conditions'
    });
  }

  if (err.message && err.message.includes('Cannot delete message that has been used')) {
    return res.status(400).json({
      status: 'error',
      message: 'Cannot delete message that has been used. Consider deactivating it instead.',
      field: 'usageStats'
    });
  }

  next(err);
});

export default router;
