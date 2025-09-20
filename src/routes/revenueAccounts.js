import express from 'express';
import revenueAccountController from '../controllers/revenueAccountController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = express.Router({ mergeParams: true });

// Validation schemas
const createAccountValidation = [
  body('accountCode')
    .notEmpty()
    .withMessage('Account code is required')
    .isLength({ min: 2, max: 20 })
    .withMessage('Account code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9_-]+$/i)
    .withMessage('Account code must contain only letters, numbers, underscores, and hyphens'),
  
  body('accountName')
    .notEmpty()
    .withMessage('Account name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Account name must be between 2 and 100 characters'),
  
  body('revenueCategory')
    .notEmpty()
    .withMessage('Revenue category is required')
    .isIn([
      'room_revenue', 'upgrade_revenue', 'package_revenue', 'addon_revenue',
      'fee_revenue', 'tax_revenue', 'deposit_revenue', 'penalty_revenue',
      'corporate_revenue', 'group_revenue', 'promotional_revenue',
      'seasonal_revenue', 'channel_revenue', 'other_revenue'
    ])
    .withMessage('Invalid revenue category'),
  
  body('accountType')
    .notEmpty()
    .withMessage('Account type is required')
    .isIn(['primary', 'secondary', 'adjustment', 'promotional', 'fee', 'tax', 'deposit'])
    .withMessage('Invalid account type'),
  
  body('parentAccount')
    .optional()
    .isMongoId()
    .withMessage('Parent account must be a valid MongoDB ID'),
  
  body('reportingGroup')
    .optional()
    .isIn([
      'rooms_department', 'food_beverage', 'other_operated_departments',
      'rentals_other_income', 'total_operated_department_revenue'
    ])
    .withMessage('Invalid reporting group'),
  
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
  
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  
  body('glAccountCode')
    .optional()
    .isLength({ max: 30 })
    .withMessage('GL account code must not exceed 30 characters'),
  
  body('autoCalculation.isEnabled')
    .optional()
    .isBoolean()
    .withMessage('Auto calculation enabled must be a boolean'),
  
  body('autoCalculation.calculationMethod')
    .optional()
    .isIn(['percentage', 'fixed_amount', 'per_night', 'per_guest', 'tiered'])
    .withMessage('Invalid calculation method'),
  
  body('autoCalculation.calculationValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Calculation value must be a non-negative number'),
  
  body('autoCalculation.basedOnAccount')
    .optional()
    .isMongoId()
    .withMessage('Based on account must be a valid MongoDB ID'),
  
  body('budgetInfo.monthlyBudget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Monthly budget must be a non-negative number'),
  
  body('budgetInfo.yearlyBudget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Yearly budget must be a non-negative number'),
  
  body('budgetInfo.budgetCurrency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Budget currency must be a 3-character code'),
  
  body('taxConfiguration.isTaxable')
    .optional()
    .isBoolean()
    .withMessage('Is taxable must be a boolean'),
  
  body('taxConfiguration.taxCategory')
    .optional()
    .isIn(['standard', 'exempt', 'reduced_rate', 'zero_rate'])
    .withMessage('Invalid tax category'),
  
  body('accountDescription')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Account description must not exceed 500 characters'),
  
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),
  
  validate
];

const updateAccountValidation = [
  param('id')
    .isMongoId()
    .withMessage('Account ID must be a valid MongoDB ID'),
  
  ...createAccountValidation.slice(0, -1), // Remove validate middleware
  validate
];

const allocationCalculationValidation = [
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
  
  body('additionalCharges')
    .optional()
    .isArray()
    .withMessage('Additional charges must be an array'),
  
  body('additionalCharges.*.type')
    .optional()
    .isIn(['upgrade', 'package', 'addon', 'fee', 'penalty', 'deposit'])
    .withMessage('Invalid charge type'),
  
  body('additionalCharges.*.amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Charge amount must be greater than 0'),
  
  validate
];

const bulkUpdateValidation = [
  body('accountIds')
    .isArray({ min: 1 })
    .withMessage('Account IDs must be a non-empty array'),
  
  body('accountIds.*')
    .isMongoId()
    .withMessage('Each account ID must be a valid MongoDB ID'),
  
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
    .withMessage('Account ID must be a valid MongoDB ID'),
  validate
];

// All routes require authentication
router.use(authenticate);

// Public API endpoints for revenue account information (accessible to all authenticated users)

// Get account options for dropdown menus
router.get('/options', 
  revenueAccountController.getAccountOptions
);

// Get applicable revenue accounts for booking (used by booking engine)
router.get('/hotels/:hotelId/applicable', 
  paramValidation,
  revenueAccountController.getApplicableRevenueAccounts
);

// Calculate revenue allocation for booking preview (used by booking engine)
router.post('/hotels/:hotelId/calculate', 
  paramValidation,
  allocationCalculationValidation,
  revenueAccountController.calculateRevenueAllocation
);

// Admin routes (require appropriate permissions)

// Get all revenue accounts for a hotel
router.get('/hotels/:hotelId', 
  authorize(['admin', 'manager', 'finance', 'front_desk']),
  paramValidation,
  revenueAccountController.getRevenueAccounts
);

// Get revenue summary and analytics
router.get('/hotels/:hotelId/summary', 
  authorize(['admin', 'manager', 'finance']),
  paramValidation,
  revenueAccountController.getRevenueSummary
);

// Generate revenue report
router.get('/hotels/:hotelId/reports', 
  authorize(['admin', 'manager', 'finance']),
  paramValidation,
  revenueAccountController.generateRevenueReport
);

// Get budget analysis
router.get('/hotels/:hotelId/budget-analysis', 
  authorize(['admin', 'manager', 'finance']),
  paramValidation,
  revenueAccountController.getBudgetAnalysis
);

// Get single revenue account by ID
router.get('/:id', 
  authorize(['admin', 'manager', 'finance', 'front_desk']),
  idParamValidation,
  revenueAccountController.getRevenueAccount
);

// Create new revenue account (admin and finance only)
router.post('/hotels/:hotelId', 
  authorize(['admin', 'finance']),
  paramValidation,
  createAccountValidation,
  revenueAccountController.createRevenueAccount
);

// Update revenue account (admin and finance only)
router.put('/:id', 
  authorize(['admin', 'finance']),
  updateAccountValidation,
  revenueAccountController.updateRevenueAccount
);

// Bulk update account status (admin and finance only)
router.patch('/hotels/:hotelId/bulk-update', 
  authorize(['admin', 'finance']),
  paramValidation,
  bulkUpdateValidation,
  revenueAccountController.bulkUpdateAccountStatus
);

// Delete/deactivate revenue account (admin only)
router.delete('/:id', 
  authorize(['admin']),
  idParamValidation,
  revenueAccountController.deleteRevenueAccount
);

// Error handling middleware specific to revenue account routes
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
    
    if (field === 'accountCode') {
      message = 'An account with this code already exists in this hotel.';
    } else if (field === 'glAccountCode') {
      message = 'An account with this GL code already exists.';
    }
    
    return res.status(400).json({
      status: 'error',
      message,
      field
    });
  }
  
  if (err.message && err.message.includes('hierarchy cannot exceed')) {
    return res.status(400).json({
      status: 'error',
      message: 'Account hierarchy cannot exceed 5 levels',
      field: 'parentAccount'
    });
  }
  
  if (err.message && err.message.includes('circular reference')) {
    return res.status(400).json({
      status: 'error',
      message: 'Circular reference detected in account hierarchy',
      field: 'parentAccount'
    });
  }
  
  next(err);
});

export default router;