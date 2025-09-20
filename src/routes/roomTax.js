import express from 'express';
import roomTaxController from '../controllers/roomTaxController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = express.Router({ mergeParams: true });

// Validation schemas
const createTaxValidation = [
  body('taxName')
    .notEmpty()
    .withMessage('Tax name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tax name must be between 2 and 100 characters'),
  
  body('taxType')
    .notEmpty()
    .withMessage('Tax type is required')
    .isIn(['VAT', 'GST', 'service_tax', 'luxury_tax', 'city_tax', 'tourism_tax', 'occupancy_tax', 'resort_fee', 'facility_tax', 'custom'])
    .withMessage('Invalid tax type'),
  
  body('taxCategory')
    .notEmpty()
    .withMessage('Tax category is required')
    .isIn(['room_charge', 'service_charge', 'additional_service', 'government', 'local_authority', 'facility'])
    .withMessage('Invalid tax category'),
  
  body('taxRate')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Tax rate must be between 0 and 100'),
  
  body('fixedAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Fixed amount must be a positive number'),
  
  body('isPercentage')
    .optional()
    .isBoolean()
    .withMessage('isPercentage must be a boolean'),
  
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
  
  body('validFrom')
    .optional()
    .isISO8601()
    .withMessage('Valid from date must be a valid ISO date'),
  
  body('validTo')
    .optional()
    .isISO8601()
    .withMessage('Valid to date must be a valid ISO date'),
  
  body('calculationMethod')
    .optional()
    .isIn(['per_room', 'per_guest', 'per_night', 'per_booking'])
    .withMessage('Invalid calculation method'),
  
  body('roundingRule')
    .optional()
    .isIn(['round_up', 'round_down', 'round_nearest', 'no_rounding'])
    .withMessage('Invalid rounding rule'),
  
  body('isCompoundTax')
    .optional()
    .isBoolean()
    .withMessage('isCompoundTax must be a boolean'),
  
  body('compoundOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Compound order must be a non-negative integer'),
  
  body('exemptionRules.minimumStayNights')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum stay nights must be a non-negative integer'),
  
  body('exemptionRules.maximumStayNights')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Maximum stay nights must be a non-negative integer'),
  
  body('exemptionRules.exemptGuestTypes')
    .optional()
    .isArray()
    .withMessage('Exempt guest types must be an array'),
  
  body('exemptionRules.exemptGuestTypes.*')
    .optional()
    .isIn(['VIP', 'corporate', 'government', 'senior_citizen', 'military'])
    .withMessage('Invalid exempt guest type'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  validate
];

const updateTaxValidation = [
  param('id')
    .isMongoId()
    .withMessage('Tax ID must be a valid MongoDB ID'),
  
  ...createTaxValidation.slice(0, -1), // Remove validate middleware
  validate
];

const taxCalculationValidation = [
  body('baseAmount')
    .notEmpty()
    .withMessage('Base amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Base amount must be greater than 0'),
  
  body('roomTypeId')
    .optional()
    .isMongoId()
    .withMessage('Room type ID must be a valid MongoDB ID'),
  
  body('roomCount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Room count must be at least 1'),
  
  body('guestCount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Guest count must be at least 1'),
  
  body('stayNights')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Stay nights must be at least 1'),
  
  body('channel')
    .optional()
    .isIn(['direct', 'booking_com', 'expedia', 'airbnb', 'agoda'])
    .withMessage('Invalid booking channel'),
  
  body('checkInDate')
    .optional()
    .isISO8601()
    .withMessage('Check-in date must be a valid ISO date'),
  
  validate
];

const bulkUpdateValidation = [
  body('taxIds')
    .isArray({ min: 1 })
    .withMessage('Tax IDs must be a non-empty array'),
  
  body('taxIds.*')
    .isMongoId()
    .withMessage('Each tax ID must be a valid MongoDB ID'),
  
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
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
    .withMessage('Tax ID must be a valid MongoDB ID'),
  validate
];

// All routes require authentication
router.use(authenticate);

// Public API endpoints for tax information (accessible to all authenticated users)

// Get tax types and categories for dropdown options
router.get('/options', 
  roomTaxController.getTaxOptions
);

// Get applicable taxes for booking (used by booking engine)
router.get('/hotels/:hotelId/applicable', 
  paramValidation,
  roomTaxController.getApplicableTaxes
);

// Calculate taxes for booking preview (used by booking engine)
router.post('/hotels/:hotelId/calculate', 
  paramValidation,
  taxCalculationValidation,
  roomTaxController.calculateTaxes
);

// Admin routes (require appropriate permissions)

// Get all taxes for a hotel
router.get('/hotels/:hotelId', 
  authorize(['admin', 'manager', 'finance', 'front_desk']),
  paramValidation,
  roomTaxController.getRoomTaxes
);

// Get tax summary and analytics
router.get('/hotels/:hotelId/summary', 
  authorize(['admin', 'manager', 'finance']),
  paramValidation,
  roomTaxController.getTaxSummary
);

// Get single tax by ID
router.get('/:id', 
  authorize(['admin', 'manager', 'finance', 'front_desk']),
  idParamValidation,
  roomTaxController.getRoomTax
);

// Create new tax (admin and finance only)
router.post('/hotels/:hotelId', 
  authorize(['admin', 'finance']),
  paramValidation,
  createTaxValidation,
  roomTaxController.createRoomTax
);

// Update tax (admin and finance only)
router.put('/:id', 
  authorize(['admin', 'finance']),
  updateTaxValidation,
  roomTaxController.updateRoomTax
);

// Bulk update tax status (admin and finance only)
router.patch('/hotels/:hotelId/bulk-update', 
  authorize(['admin', 'finance']),
  paramValidation,
  bulkUpdateValidation,
  roomTaxController.bulkUpdateTaxStatus
);

// Delete/deactivate tax (admin only)
router.delete('/:id', 
  authorize(['admin']),
  idParamValidation,
  roomTaxController.deleteRoomTax
);

// Error handling middleware specific to room tax routes
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
    return res.status(400).json({
      status: 'error',
      message: 'Duplicate tax name. A tax with this name already exists.',
      field: Object.keys(err.keyPattern)[0]
    });
  }
  
  next(err);
});

export default router;