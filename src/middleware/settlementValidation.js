import { body, param, query, validationResult } from 'express-validator';
import Decimal from 'decimal.js';
import { ApplicationError } from './errorHandler.js';
import calculationValidationService from '../services/calculationValidationService.js';
import financialRulesEngine from '../services/financialRulesEngine.js';
import Settlement from '../models/Settlement.js';

/**
 * Settlement Validation Middleware
 * Provides comprehensive validation for settlement-related API endpoints
 * Ensures data integrity and business rule compliance
 */

// Configure Decimal.js for consistent precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Validates settlement creation data
 */
export const validateSettlementCreation = [
  body('bookingId')
    .notEmpty()
    .withMessage('Booking ID is required')
    .isMongoId()
    .withMessage('Invalid booking ID format'),

  body('finalAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Final amount must be a positive number')
    .custom((value) => {
      const decimal = new Decimal(value);
      if (decimal.decimalPlaces() > 2) {
        throw new Error('Final amount cannot have more than 2 decimal places');
      }
      return true;
    }),

  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date')
    .custom((value) => {
      const dueDate = new Date(value);
      const minDate = new Date();
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 2); // Max 2 years in future

      if (dueDate < minDate) {
        throw new Error('Due date cannot be in the past');
      }
      if (dueDate > maxDate) {
        throw new Error('Due date cannot be more than 2 years in the future');
      }
      return true;
    }),

  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be 3 characters')
    .isAlpha()
    .withMessage('Currency must contain only letters')
    .toUpperCase(),

  body('notes')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Notes cannot exceed 2000 characters'),

  body('assignedTo')
    .optional()
    .isMongoId()
    .withMessage('Assigned to must be a valid user ID'),

  // Custom business rules validation
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      // Additional business validation would go here
      // (e.g., checking if booking exists, settlement doesn't already exist, etc.)

      next();
    } catch (error) {
      next(error);
    }
  }
];

/**
 * Validates payment addition data
 */
export const validatePaymentAddition = [
  param('id')
    .isMongoId()
    .withMessage('Invalid settlement ID'),

  body('amount')
    .notEmpty()
    .withMessage('Payment amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Payment amount must be greater than 0')
    .custom((value) => {
      const decimal = new Decimal(value);
      if (decimal.decimalPlaces() > 2) {
        throw new Error('Payment amount cannot have more than 2 decimal places');
      }

      // Check maximum payment limits
      const maxPayment = new Decimal('10000000'); // 1 Crore INR
      if (decimal.gt(maxPayment)) {
        throw new Error(`Payment amount exceeds maximum limit (${maxPayment.toFixed(2)})`);
      }

      return true;
    }),

  body('method')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['cash', 'card', 'upi', 'bank_transfer', 'online_portal', 'refund_to_source'])
    .withMessage('Invalid payment method'),

  body('reference')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Reference cannot exceed 100 characters')
    .trim(),

  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),

  body('allowOverpayment')
    .optional()
    .isBoolean()
    .withMessage('Allow overpayment must be boolean'),

  // Custom payment validation
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      // Find settlement for additional validation
      const settlement = await Settlement.findOne({
        _id: req.params.id,
        hotelId: req.user.hotelId
      });

      if (!settlement) {
        return res.status(404).json({
          status: 'error',
          message: 'Settlement not found'
        });
      }

      // Validate payment against business rules
      const paymentValidation = financialRulesEngine.validatePaymentProcessing(req.body, settlement);

      if (!paymentValidation.isValid) {
        return res.status(400).json({
          status: 'error',
          message: 'Payment validation failed',
          violations: paymentValidation.violations,
          warnings: paymentValidation.warnings
        });
      }

      // Validate payment amount against outstanding balance
      try {
        const amountValidation = calculationValidationService.validatePaymentAmount(
          settlement,
          req.body.amount,
          req.body.allowOverpayment || false
        );

        // Store validation results in request for use in route handler
        req.paymentValidation = {
          settlement,
          businessRules: paymentValidation,
          amountValidation,
          requiresApproval: paymentValidation.requiresApproval
        };

        next();
      } catch (validationError) {
        return res.status(400).json({
          status: 'error',
          message: validationError.message
        });
      }

    } catch (error) {
      next(error);
    }
  }
];

/**
 * Validates adjustment data
 */
export const validateAdjustment = [
  param('id')
    .isMongoId()
    .withMessage('Invalid settlement ID'),

  body('type')
    .notEmpty()
    .withMessage('Adjustment type is required')
    .isIn([
      'extra_person_charge', 'damage_charge', 'minibar_charge',
      'service_charge', 'discount', 'refund', 'penalty',
      'cancellation_fee', 'other'
    ])
    .withMessage('Invalid adjustment type'),

  body('amount')
    .notEmpty()
    .withMessage('Adjustment amount is required')
    .isFloat()
    .withMessage('Adjustment amount must be a number')
    .custom((value, { req }) => {
      const decimal = new Decimal(value);

      // Validate decimal places
      if (decimal.decimalPlaces() > 2) {
        throw new Error('Adjustment amount cannot have more than 2 decimal places');
      }

      // Validate amount based on adjustment type
      const type = req.body.type;
      if (['discount', 'refund'].includes(type) && decimal.gt(0)) {
        throw new Error(`${type} adjustments should typically be negative`);
      }

      if (['extra_person_charge', 'damage_charge', 'service_charge', 'penalty'].includes(type) && decimal.lt(0)) {
        throw new Error(`${type} adjustments should typically be positive`);
      }

      // Check maximum adjustment limits
      const maxAdjustment = new Decimal('5000000'); // 50 Lakh INR
      if (decimal.abs().gt(maxAdjustment)) {
        throw new Error(`Adjustment amount exceeds maximum limit (${maxAdjustment.toFixed(2)})`);
      }

      return true;
    }),

  body('description')
    .notEmpty()
    .withMessage('Adjustment description is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),

  body('category')
    .optional()
    .isIn(['room_charge', 'food_beverage', 'amenities', 'services', 'damages', 'penalties', 'credits'])
    .withMessage('Invalid adjustment category'),

  body('taxable')
    .optional()
    .isBoolean()
    .withMessage('Taxable must be boolean'),

  body('taxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tax amount must be non-negative')
    .custom((value) => {
      const decimal = new Decimal(value);
      if (decimal.decimalPlaces() > 2) {
        throw new Error('Tax amount cannot have more than 2 decimal places');
      }
      return true;
    }),

  // Custom adjustment validation
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      // Find settlement for additional validation
      const settlement = await Settlement.findOne({
        _id: req.params.id,
        hotelId: req.user.hotelId
      });

      if (!settlement) {
        return res.status(404).json({
          status: 'error',
          message: 'Settlement not found'
        });
      }

      // Validate adjustment against business rules
      const adjustmentValidation = financialRulesEngine.validateAdjustmentRules(req.body, settlement);

      if (!adjustmentValidation.isValid) {
        return res.status(400).json({
          status: 'error',
          message: 'Adjustment validation failed',
          violations: adjustmentValidation.violations,
          warnings: adjustmentValidation.warnings
        });
      }

      // Store validation results in request
      req.adjustmentValidation = {
        settlement,
        businessRules: adjustmentValidation,
        requiresApproval: adjustmentValidation.requiresApproval
      };

      next();

    } catch (error) {
      next(error);
    }
  }
];

/**
 * Validates settlement query parameters
 */
export const validateSettlementQuery = [
  query('status')
    .optional()
    .isIn(['pending', 'partial', 'completed', 'overdue', 'cancelled', 'refunded'])
    .withMessage('Invalid status filter'),

  query('escalationLevel')
    .optional()
    .isInt({ min: 0, max: 5 })
    .withMessage('Escalation level must be between 0 and 5'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000')
    .toInt(),

  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be non-negative')
    .toInt(),

  query('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (req.query.startDate && new Date(value) <= new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Query validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

/**
 * Validates escalation request
 */
export const validateEscalation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid settlement ID'),

  body('reason')
    .notEmpty()
    .withMessage('Escalation reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),

  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      // Find settlement
      const settlement = await Settlement.findOne({
        _id: req.params.id,
        hotelId: req.user.hotelId
      });

      if (!settlement) {
        return res.status(404).json({
          status: 'error',
          message: 'Settlement not found'
        });
      }

      // Check if escalation is valid
      if (settlement.status === 'completed' || settlement.status === 'cancelled') {
        return res.status(400).json({
          status: 'error',
          message: `Cannot escalate ${settlement.status} settlement`
        });
      }

      if (settlement.escalationLevel >= (settlement.terms?.maxEscalationLevel || 5)) {
        return res.status(400).json({
          status: 'error',
          message: 'Settlement has reached maximum escalation level'
        });
      }

      req.settlementForEscalation = settlement;
      next();

    } catch (error) {
      next(error);
    }
  }
];

/**
 * Validates communication addition
 */
export const validateCommunication = [
  param('id')
    .isMongoId()
    .withMessage('Invalid settlement ID'),

  body('type')
    .notEmpty()
    .withMessage('Communication type is required')
    .isIn(['email', 'sms', 'phone_call', 'letter', 'in_person'])
    .withMessage('Invalid communication type'),

  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Message must be between 10 and 2000 characters'),

  body('subject')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Subject cannot exceed 200 characters'),

  body('direction')
    .optional()
    .isIn(['outbound', 'inbound'])
    .withMessage('Direction must be outbound or inbound'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

/**
 * Middleware to validate calculation integrity before critical operations
 */
export const validateCalculationIntegrity = async (req, res, next) => {
  try {
    // Only apply to POST, PUT, PATCH operations on settlements
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    // Skip for new settlement creation (no existing data to validate)
    if (req.method === 'POST' && !req.params.id) {
      return next();
    }

    // Find settlement if ID is provided
    if (req.params.id) {
      const settlement = await Settlement.findOne({
        _id: req.params.id,
        hotelId: req.user.hotelId
      });

      if (!settlement) {
        return res.status(404).json({
          status: 'error',
          message: 'Settlement not found'
        });
      }

      // Validate current calculations
      const validationResult = settlement.validateCalculations();

      if (!validationResult.isValid) {
        // Log calculation errors for investigation
        console.error(`Settlement ${settlement.settlementNumber} has calculation errors:`, validationResult.errors);

        return res.status(400).json({
          status: 'error',
          message: 'Settlement has calculation errors that must be resolved',
          validationErrors: validationResult.errors,
          validationWarnings: validationResult.warnings,
          settlementNumber: settlement.settlementNumber
        });
      }

      // Store settlement in request for use by route handlers
      req.validatedSettlement = settlement;
    }

    next();

  } catch (error) {
    console.error('Calculation integrity validation error:', error);
    next(error);
  }
};

/**
 * Middleware to log financial operations for audit trail
 */
export const logFinancialOperation = (operationType) => {
  return (req, res, next) => {
    const originalSend = res.send;

    res.send = function(data) {
      // Log successful financial operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`Financial Operation: ${operationType}`, {
          userId: req.user?._id,
          userRole: req.user?.role,
          settlementId: req.params.id,
          operation: operationType,
          timestamp: new Date(),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          requestData: req.body
        });
      }

      originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Error handling middleware for validation errors
 */
export const handleValidationErrors = (error, req, res, next) => {
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: 'Settlement validation failed',
      errors: error.validationErrors || [],
      warnings: error.validationWarnings || []
    });
  }

  if (error.name === 'CastError' && error.path === '_id') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid settlement ID format'
    });
  }

  next(error);
};