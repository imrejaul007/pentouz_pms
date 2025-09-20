import express from 'express';
import phoneExtensionController from '../controllers/phoneExtensionController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = express.Router({ mergeParams: true });

// Validation schemas
const createExtensionValidation = [
  body('extensionNumber')
    .optional()
    .isLength({ min: 3, max: 10 })
    .withMessage('Extension number must be between 3 and 10 characters')
    .matches(/^[0-9]+$/)
    .withMessage('Extension number must contain only digits'),

  body('displayName')
    .notEmpty()
    .withMessage('Display name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Display name must be between 2 and 100 characters'),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('phoneType')
    .notEmpty()
    .withMessage('Phone type is required')
    .isIn([
      'room_phone', 'desk_phone', 'cordless', 'conference', 'fax',
      'emergency', 'service', 'admin', 'maintenance', 'security'
    ])
    .withMessage('Invalid phone type'),

  body('phoneModel')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Phone model cannot exceed 100 characters'),

  body('roomId')
    .optional()
    .isMongoId()
    .withMessage('Room ID must be a valid MongoDB ID'),

  body('features')
    .optional()
    .isArray()
    .withMessage('Features must be an array'),

  body('features.*')
    .optional()
    .isIn([
      'voicemail', 'caller_id', 'call_waiting', 'conference_call',
      'speed_dial', 'intercom', 'wake_up_call', 'do_not_disturb'
    ])
    .withMessage('Invalid phone feature'),

  body('location.floor')
    .optional()
    .isInt({ min: -5, max: 100 })
    .withMessage('Floor must be between -5 and 100'),

  body('location.wing')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Wing cannot exceed 50 characters'),

  body('location.area')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Area cannot exceed 100 characters'),

  body('location.coordinates.x')
    .optional()
    .isNumeric()
    .withMessage('X coordinate must be a number'),

  body('location.coordinates.y')
    .optional()
    .isNumeric()
    .withMessage('Y coordinate must be a number'),

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'maintenance', 'out_of_order', 'temporary'])
    .withMessage('Invalid status'),

  body('isAvailable')
    .optional()
    .isBoolean()
    .withMessage('isAvailable must be a boolean'),

  body('callSettings.allowOutgoingCalls')
    .optional()
    .isBoolean()
    .withMessage('Allow outgoing calls must be a boolean'),

  body('callSettings.allowInternationalCalls')
    .optional()
    .isBoolean()
    .withMessage('Allow international calls must be a boolean'),

  body('callSettings.allowLongDistanceCalls')
    .optional()
    .isBoolean()
    .withMessage('Allow long distance calls must be a boolean'),

  body('callSettings.restrictedNumbers')
    .optional()
    .isArray()
    .withMessage('Restricted numbers must be an array'),

  body('callSettings.restrictedNumbers.*.number')
    .optional()
    .notEmpty()
    .withMessage('Restricted number cannot be empty'),

  body('callSettings.restrictedNumbers.*.reason')
    .optional()
    .notEmpty()
    .withMessage('Restriction reason cannot be empty'),

  body('callSettings.speedDialNumbers')
    .optional()
    .isArray()
    .withMessage('Speed dial numbers must be an array'),

  body('callSettings.speedDialNumbers.*.label')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Speed dial label must be between 1 and 50 characters'),

  body('callSettings.speedDialNumbers.*.number')
    .optional()
    .isLength({ min: 1, max: 20 })
    .withMessage('Speed dial number must be between 1 and 20 characters'),

  body('callSettings.speedDialNumbers.*.position')
    .optional()
    .isInt({ min: 1, max: 99 })
    .withMessage('Speed dial position must be between 1 and 99'),

  body('directorySettings.showInDirectory')
    .optional()
    .isBoolean()
    .withMessage('Show in directory must be a boolean'),

  body('directorySettings.publicListing')
    .optional()
    .isBoolean()
    .withMessage('Public listing must be a boolean'),

  body('directorySettings.category')
    .optional()
    .isIn(['guest_rooms', 'common_areas', 'staff', 'services', 'emergency', 'admin'])
    .withMessage('Invalid directory category'),

  body('directorySettings.sortOrder')
    .optional()
    .isInt()
    .withMessage('Sort order must be an integer'),

  body('integrationSettings.pbxId')
    .optional()
    .isLength({ max: 50 })
    .withMessage('PBX ID cannot exceed 50 characters'),

  body('integrationSettings.sipAddress')
    .optional()
    .isLength({ max: 100 })
    .withMessage('SIP address cannot exceed 100 characters'),

  body('integrationSettings.macAddress')
    .optional()
    .matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)
    .withMessage('Invalid MAC address format'),

  body('integrationSettings.ipAddress')
    .optional()
    .isIP('4')
    .withMessage('Invalid IP address format'),

  body('integrationSettings.firmwareVersion')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Firmware version cannot exceed 50 characters'),

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

const updateExtensionValidation = [
  param('id')
    .isMongoId()
    .withMessage('Extension ID must be a valid MongoDB ID'),

  ...createExtensionValidation.slice(0, -1), // Remove validate middleware
  validate
];

const bulkUpdateValidation = [
  body('extensionIds')
    .isArray({ min: 1 })
    .withMessage('Extension IDs must be a non-empty array'),

  body('extensionIds.*')
    .isMongoId()
    .withMessage('Each extension ID must be a valid MongoDB ID'),

  body('status')
    .isIn(['active', 'inactive', 'maintenance', 'out_of_order', 'temporary'])
    .withMessage('Invalid status'),

  validate
];

const bulkAssignValidation = [
  body('assignments')
    .isArray({ min: 1 })
    .withMessage('Assignments must be a non-empty array'),

  body('assignments.*.extensionId')
    .isMongoId()
    .withMessage('Extension ID must be a valid MongoDB ID'),

  body('assignments.*.roomId')
    .optional({ nullable: true })
    .isMongoId()
    .withMessage('Room ID must be a valid MongoDB ID'),

  validate
];

const maintenanceValidation = [
  body('reason')
    .notEmpty()
    .withMessage('Maintenance reason is required')
    .isLength({ max: 200 })
    .withMessage('Reason cannot exceed 200 characters'),

  body('scheduledUntil')
    .optional()
    .isISO8601()
    .withMessage('Scheduled until must be a valid ISO date'),

  body('technician')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Technician name cannot exceed 100 characters'),

  validate
];

const usageUpdateValidation = [
  body('callType')
    .optional()
    .isIn(['received', 'made'])
    .withMessage('Call type must be either "received" or "made"'),

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
    .withMessage('Extension ID must be a valid MongoDB ID'),
  validate
];

// All routes require authentication
router.use(authenticate);

// Public API endpoints (accessible to all authenticated users)

// Get extension options for dropdowns
router.get('/options',
  phoneExtensionController.getExtensionOptions
);

// Get phone directory (public listing)
router.get('/hotels/:hotelId/directory',
  paramValidation,
  phoneExtensionController.getPhoneDirectory
);

// Admin routes (require appropriate permissions)

// Get all phone extensions for a hotel
router.get('/hotels/:hotelId',
  authorize(['admin', 'manager', 'front_desk', 'maintenance']),
  paramValidation,
  phoneExtensionController.getPhoneExtensions
);

// Get usage report
router.get('/hotels/:hotelId/usage-report',
  authorize(['admin', 'manager']),
  paramValidation,
  phoneExtensionController.getUsageReport
);

// Get single phone extension by ID
router.get('/:id',
  authorize(['admin', 'manager', 'front_desk', 'maintenance']),
  idParamValidation,
  phoneExtensionController.getPhoneExtension
);

// Create new phone extension (admin and manager only)
router.post('/hotels/:hotelId',
  authorize(['admin', 'manager']),
  paramValidation,
  createExtensionValidation,
  phoneExtensionController.createPhoneExtension
);

// Update phone extension (admin and manager only)
router.put('/:id',
  authorize(['admin', 'manager']),
  updateExtensionValidation,
  phoneExtensionController.updatePhoneExtension
);

// Update extension usage statistics (system and maintenance use)
router.patch('/:id/usage',
  authorize(['admin', 'manager', 'system', 'maintenance']),
  idParamValidation,
  usageUpdateValidation,
  phoneExtensionController.updateUsageStats
);

// Set maintenance mode
router.patch('/:id/maintenance',
  authorize(['admin', 'manager', 'maintenance']),
  idParamValidation,
  maintenanceValidation,
  phoneExtensionController.setMaintenanceMode
);

// Clear maintenance mode
router.patch('/:id/maintenance/clear',
  authorize(['admin', 'manager', 'maintenance']),
  idParamValidation,
  phoneExtensionController.clearMaintenanceMode
);

// Bulk update extension status (admin and manager only)
router.patch('/hotels/:hotelId/bulk-update',
  authorize(['admin', 'manager']),
  paramValidation,
  bulkUpdateValidation,
  phoneExtensionController.bulkUpdateStatus
);

// Bulk assign extensions to rooms (admin and manager only)
router.patch('/hotels/:hotelId/bulk-assign',
  authorize(['admin', 'manager']),
  paramValidation,
  bulkAssignValidation,
  phoneExtensionController.bulkAssignToRooms
);

// Delete phone extension (admin only)
router.delete('/:id',
  authorize(['admin']),
  idParamValidation,
  phoneExtensionController.deletePhoneExtension
);

// Error handling middleware specific to phone extension routes
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

    if (field === 'extensionNumber') {
      message = 'Extension number already exists in this hotel.';
    }

    return res.status(400).json({
      status: 'error',
      message,
      field
    });
  }

  if (err.message && err.message.includes('Extension number already exists')) {
    return res.status(400).json({
      status: 'error',
      message: 'Extension number already exists in this hotel',
      field: 'extensionNumber'
    });
  }

  if (err.message && err.message.includes('Speed dial positions must be unique')) {
    return res.status(400).json({
      status: 'error',
      message: 'Speed dial positions must be unique',
      field: 'callSettings.speedDialNumbers'
    });
  }

  if (err.message && err.message.includes('Room not found')) {
    return res.status(400).json({
      status: 'error',
      message: 'Room not found or does not belong to this hotel',
      field: 'roomId'
    });
  }

  if (err.message && err.message.includes('Cannot delete an active extension')) {
    return res.status(400).json({
      status: 'error',
      message: 'Cannot delete an active extension. Please deactivate it first.',
      field: 'status'
    });
  }

  next(err);
});

export default router;