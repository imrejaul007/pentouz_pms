import express from 'express';
import roomChargeController from '../controllers/roomChargeController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = express.Router({ mergeParams: true });

// Validation schemas
const createChargeValidation = [
  body('chargeName')
    .notEmpty()
    .withMessage('Charge name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Charge name must be between 2 and 100 characters'),
  
  body('chargeCode')
    .notEmpty()
    .withMessage('Charge code is required')
    .isLength({ min: 2, max: 20 })
    .withMessage('Charge code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9_-]+$/i)
    .withMessage('Charge code must contain only letters, numbers, underscores, and hyphens'),
  
  body('chargeType')
    .notEmpty()
    .withMessage('Charge type is required')
    .isIn([
      'service_fee', 'resort_fee', 'cleaning_fee', 'damage_fee', 'utility_fee',
      'parking_fee', 'wifi_fee', 'minibar_fee', 'laundry_fee', 'spa_fee',
      'gym_fee', 'pet_fee', 'early_checkin_fee', 'late_checkout_fee',
      'amenity_fee', 'cancellation_fee', 'noshow_fee', 'upgrade_fee',
      'package_fee', 'custom_fee'
    ])
    .withMessage('Invalid charge type'),
  
  body('chargeCategory')
    .notEmpty()
    .withMessage('Charge category is required')
    .isIn(['mandatory', 'optional', 'conditional', 'penalty', 'service', 'amenity', 'utility'])
    .withMessage('Invalid charge category'),
  
  body('chargeAmount')
    .notEmpty()
    .withMessage('Charge amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Charge amount must be greater than 0'),
  
  body('isPercentage')
    .optional()
    .isBoolean()
    .withMessage('isPercentage must be a boolean'),
  
  body('percentageBase')
    .optional()
    .isIn(['room_rate', 'total_amount', 'subtotal'])
    .withMessage('Invalid percentage base'),
  
  body('calculationMethod')
    .optional()
    .isIn(['per_stay', 'per_night', 'per_guest', 'per_room', 'percentage'])
    .withMessage('Invalid calculation method'),
  
  body('priority')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Priority must be a non-negative integer'),
  
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
  
  body('applicableRateTypes')
    .optional()
    .isArray()
    .withMessage('Applicable rate types must be an array'),
  
  body('applicableRateTypes.*')
    .optional()
    .isIn(['standard', 'corporate', 'group', 'promotional', 'package', 'seasonal'])
    .withMessage('Invalid rate type'),
  
  body('validFrom')
    .optional()
    .isISO8601()
    .withMessage('Valid from date must be a valid ISO date'),
  
  body('validTo')
    .optional()
    .isISO8601()
    .withMessage('Valid to date must be a valid ISO date'),
  
  body('conditions.minimumStayNights')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum stay nights must be a non-negative integer'),
  
  body('conditions.maximumStayNights')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Maximum stay nights must be a non-negative integer'),
  
  body('conditions.minimumRoomRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum room rate must be a non-negative number'),
  
  body('conditions.maximumRoomRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum room rate must be a non-negative number'),
  
  body('conditions.guestCountMin')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Minimum guest count must be at least 1'),
  
  body('conditions.guestCountMax')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum guest count must be at least 1'),
  
  body('conditions.weekdayOnly')
    .optional()
    .isBoolean()
    .withMessage('Weekday only must be a boolean'),
  
  body('conditions.weekendOnly')
    .optional()
    .isBoolean()
    .withMessage('Weekend only must be a boolean'),
  
  body('conditions.applicableWeekdays')
    .optional()
    .isArray()
    .withMessage('Applicable weekdays must be an array'),
  
  body('conditions.applicableWeekdays.*')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .withMessage('Invalid weekday'),
  
  body('exemptions.exemptGuestTypes')
    .optional()
    .isArray()
    .withMessage('Exempt guest types must be an array'),
  
  body('exemptions.exemptGuestTypes.*')
    .optional()
    .isIn(['VIP', 'corporate', 'government', 'senior_citizen', 'military', 'employee'])
    .withMessage('Invalid exempt guest type'),
  
  body('exemptions.exemptMembershipLevels')
    .optional()
    .isArray()
    .withMessage('Exempt membership levels must be an array'),
  
  body('exemptions.exemptMembershipLevels.*')
    .optional()
    .isIn(['bronze', 'silver', 'gold', 'platinum', 'diamond'])
    .withMessage('Invalid membership level'),
  
  body('exemptions.exemptCountries')
    .optional()
    .isArray()
    .withMessage('Exempt countries must be an array'),
  
  body('exemptions.exemptBookingChannels')
    .optional()
    .isArray()
    .withMessage('Exempt booking channels must be an array'),
  
  body('exemptions.exemptBookingChannels.*')
    .optional()
    .isIn(['direct', 'booking_com', 'expedia', 'airbnb', 'agoda'])
    .withMessage('Invalid booking channel'),
  
  body('taxConfiguration.isTaxable')
    .optional()
    .isBoolean()
    .withMessage('Is taxable must be a boolean'),
  
  body('taxConfiguration.taxCategory')
    .optional()
    .isIn(['standard', 'service', 'luxury', 'utility', 'exempt'])
    .withMessage('Invalid tax category'),
  
  body('taxConfiguration.applicableTaxes')
    .optional()
    .isArray()
    .withMessage('Applicable taxes must be an array'),
  
  body('taxConfiguration.applicableTaxes.*')
    .optional()
    .isMongoId()
    .withMessage('Each tax ID must be a valid MongoDB ID'),
  
  body('displaySettings.displayName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Display name must not exceed 100 characters'),
  
  body('displaySettings.description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('displaySettings.displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),
  
  body('displaySettings.showOnBookingSummary')
    .optional()
    .isBoolean()
    .withMessage('Show on booking summary must be a boolean'),
  
  body('displaySettings.showOnInvoice')
    .optional()
    .isBoolean()
    .withMessage('Show on invoice must be a boolean'),
  
  body('displaySettings.groupWithCategory')
    .optional()
    .isIn(['fees', 'services', 'amenities', 'penalties', 'other'])
    .withMessage('Invalid group category'),
  
  body('automationRules.autoApply')
    .optional()
    .isBoolean()
    .withMessage('Auto apply must be a boolean'),
  
  body('automationRules.requireApproval')
    .optional()
    .isBoolean()
    .withMessage('Require approval must be a boolean'),
  
  body('automationRules.approvalThreshold')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Approval threshold must be a non-negative number'),
  
  body('integrationSettings.revenueAccountId')
    .optional()
    .isMongoId()
    .withMessage('Revenue account ID must be a valid MongoDB ID'),
  
  body('integrationSettings.reportingCategory')
    .optional()
    .isIn(['room_revenue', 'service_revenue', 'other_revenue', 'fees', 'penalties'])
    .withMessage('Invalid reporting category'),
  
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),
  
  validate
];

const updateChargeValidation = [
  param('id')
    .isMongoId()
    .withMessage('Charge ID must be a valid MongoDB ID'),
  
  ...createChargeValidation.slice(0, -1), // Remove validate middleware
  validate
];

const chargeCalculationValidation = [
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
  
  body('rateType')
    .optional()
    .isIn(['standard', 'corporate', 'group', 'promotional', 'package', 'seasonal'])
    .withMessage('Invalid rate type'),
  
  body('guestType')
    .optional()
    .isIn(['VIP', 'corporate', 'government', 'senior_citizen', 'military'])
    .withMessage('Invalid guest type'),
  
  body('checkInDate')
    .optional()
    .isISO8601()
    .withMessage('Check-in date must be a valid ISO date'),
  
  body('includeOptionalCharges')
    .optional()
    .isBoolean()
    .withMessage('Include optional charges must be a boolean'),
  
  body('selectedCharges')
    .optional()
    .isArray()
    .withMessage('Selected charges must be an array'),
  
  body('selectedCharges.*')
    .optional()
    .isMongoId()
    .withMessage('Each selected charge ID must be a valid MongoDB ID'),
  
  validate
];

const bulkUpdateValidation = [
  body('chargeIds')
    .isArray({ min: 1 })
    .withMessage('Charge IDs must be a non-empty array'),
  
  body('chargeIds.*')
    .isMongoId()
    .withMessage('Each charge ID must be a valid MongoDB ID'),
  
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
    .withMessage('Charge ID must be a valid MongoDB ID'),
  validate
];

// All routes require authentication
router.use(authenticate);

// Public API endpoints for room charge information (accessible to all authenticated users)

// Get charge types and categories for dropdown options
router.get('/options', 
  roomChargeController.getChargeOptions
);

// Get applicable room charges for booking (used by booking engine)
router.get('/hotels/:hotelId/applicable', 
  paramValidation,
  roomChargeController.getApplicableCharges
);

// Calculate room charges for booking preview (used by booking engine)
router.post('/hotels/:hotelId/calculate', 
  paramValidation,
  chargeCalculationValidation,
  roomChargeController.calculateRoomCharges
);

// Calculate comprehensive booking total (room + charges + taxes)
router.post('/hotels/:hotelId/calculate-comprehensive', 
  paramValidation,
  chargeCalculationValidation,
  roomChargeController.calculateComprehensiveTotal
);

// Admin routes (require appropriate permissions)

// Get all room charges for a hotel
router.get('/hotels/:hotelId', 
  authorize(['admin', 'manager', 'finance', 'front_desk']),
  paramValidation,
  roomChargeController.getRoomCharges
);

// Get charge summary and analytics
router.get('/hotels/:hotelId/summary', 
  authorize(['admin', 'manager', 'finance']),
  paramValidation,
  roomChargeController.getChargeSummary
);

// Get single room charge by ID
router.get('/:id', 
  authorize(['admin', 'manager', 'finance', 'front_desk']),
  idParamValidation,
  roomChargeController.getRoomCharge
);

// Create new room charge (admin and finance only)
router.post('/hotels/:hotelId', 
  authorize(['admin', 'finance']),
  paramValidation,
  createChargeValidation,
  roomChargeController.createRoomCharge
);

// Update room charge (admin and finance only)
router.put('/:id', 
  authorize(['admin', 'finance']),
  updateChargeValidation,
  roomChargeController.updateRoomCharge
);

// Update charge audit information (system use)
router.patch('/:id/audit', 
  authorize(['admin', 'finance', 'system']),
  idParamValidation,
  body('totalCharges').optional().isFloat({ min: 0 }).withMessage('Total charges must be non-negative'),
  body('applicationCount').optional().isInt({ min: 0 }).withMessage('Application count must be non-negative'),
  validate,
  roomChargeController.updateChargeAudit
);

// Bulk update charge status (admin and finance only)
router.patch('/hotels/:hotelId/bulk-update', 
  authorize(['admin', 'finance']),
  paramValidation,
  bulkUpdateValidation,
  roomChargeController.bulkUpdateChargeStatus
);

// Delete/deactivate room charge (admin only)
router.delete('/:id', 
  authorize(['admin']),
  idParamValidation,
  roomChargeController.deleteRoomCharge
);

// Error handling middleware specific to room charge routes
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
    
    if (field === 'chargeCode') {
      message = 'A charge with this code already exists in this hotel.';
    }
    
    return res.status(400).json({
      status: 'error',
      message,
      field
    });
  }
  
  if (err.message && err.message.includes('calculation method')) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid calculation method for charge type',
      field: 'calculationMethod'
    });
  }
  
  if (err.message && err.message.includes('percentage charge cannot exceed')) {
    return res.status(400).json({
      status: 'error',
      message: 'Percentage charge cannot exceed 100%',
      field: 'chargeAmount'
    });
  }
  
  if (err.message && err.message.includes('cannot be greater than')) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid range values in conditions',
      field: 'conditions'
    });
  }
  
  next(err);
});

export default router;