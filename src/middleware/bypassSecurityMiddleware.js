import bypassSecurityService from '../services/bypassSecurityService.js';
import AdminBypassAudit from '../models/AdminBypassAudit.js';

/**
 * Comprehensive security middleware for admin bypass operations
 */

/**
 * Rate limiting middleware for bypass operations
 */
export const bypassRateLimit = bypassSecurityService.createBypassRateLimiter();

/**
 * Security validation middleware
 */
export const validateBypassSecurity = bypassSecurityService.validateBypassSecurity();

/**
 * Password confirmation middleware for high-risk operations
 */
export const requirePasswordConfirmation = bypassSecurityService.requirePasswordConfirmation();

/**
 * Session timeout validation middleware
 */
export const validateSession = (req, res, next) => {
  const sessionId = req.sessionID || req.user?.sessionId;

  if (!sessionId) {
    return res.status(401).json({
      error: 'Invalid session',
      message: 'No valid session found. Please login again.',
      code: 'INVALID_SESSION'
    });
  }

  // Check if session has timed out for bypass operations
  if (!bypassSecurityService.checkSessionTimeout(sessionId)) {
    // Set new session timeout for this bypass operation
    bypassSecurityService.setSessionTimeout(sessionId);
  }

  next();
};

/**
 * Admin role validation with enhanced security
 */
export const validateAdminRole = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please login to access this resource.',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Check if user has admin role
    if (user.role !== 'admin' && user.role !== 'manager') {
      await bypassSecurityService.logSecurityEvent({
        hotelId: user.hotelId,
        adminId: user._id,
        eventType: 'unauthorized_bypass_attempt',
        severity: 'warning',
        details: {
          userRole: user.role,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Admin or Manager role required for bypass operations.',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Check if admin account is active and not suspended
    if (user.status === 'suspended' || user.status === 'inactive') {
      await bypassSecurityService.logSecurityEvent({
        hotelId: user.hotelId,
        adminId: user._id,
        eventType: 'suspended_account_bypass_attempt',
        severity: 'critical',
        details: {
          accountStatus: user.status,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return res.status(403).json({
        error: 'Account suspended',
        message: 'Your account has been suspended. Contact system administrator.',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    // Check recent failed login attempts (if available)
    const recentFailedLogins = user.failedLoginAttempts || 0;
    if (recentFailedLogins >= 3) {
      await bypassSecurityService.logSecurityEvent({
        hotelId: user.hotelId,
        adminId: user._id,
        eventType: 'high_failed_logins_bypass_attempt',
        severity: 'warning',
        details: {
          failedLoginAttempts: recentFailedLogins,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return res.status(403).json({
        error: 'Account flagged',
        message: 'Account flagged due to recent failed login attempts. Contact supervisor.',
        code: 'ACCOUNT_FLAGGED'
      });
    }

    next();
  } catch (error) {
    console.error('Admin role validation error:', error);
    next(error);
  }
};

/**
 * Bypass operation validation
 */
export const validateBypassOperation = async (req, res, next) => {
  try {
    const { bookingId, reason, paymentMethod } = req.body;
    const errors = [];

    // Validate required fields
    if (!bookingId) {
      errors.push('Booking ID is required');
    }

    if (!reason || !reason.description || reason.description.trim().length < 10) {
      errors.push('Detailed reason (minimum 10 characters) is required');
    }

    if (!reason.category) {
      errors.push('Reason category is required');
    }

    if (!paymentMethod) {
      errors.push('Payment method is required');
    }

    // Validate reason category
    const validCategories = [
      'emergency_medical',
      'system_failure',
      'inventory_unavailable',
      'guest_complaint',
      'staff_shortage',
      'technical_issue',
      'management_override',
      'compliance_requirement',
      'other'
    ];

    if (reason.category && !validCategories.includes(reason.category)) {
      errors.push('Invalid reason category');
    }

    // Validate payment method
    const validPaymentMethods = ['cash', 'card', 'upi', 'bank_transfer'];
    if (paymentMethod && !validPaymentMethods.includes(paymentMethod)) {
      errors.push('Invalid payment method');
    }

    // Validate urgency level if provided
    if (reason.urgencyLevel) {
      const validUrgencyLevels = ['low', 'medium', 'high', 'critical'];
      if (!validUrgencyLevels.includes(reason.urgencyLevel)) {
        errors.push('Invalid urgency level');
      }
    }

    // Validate financial impact if provided
    if (req.body.financialImpact) {
      const { estimatedLoss, currency } = req.body.financialImpact;

      if (estimatedLoss && (typeof estimatedLoss !== 'number' || estimatedLoss < 0)) {
        errors.push('Estimated loss must be a positive number');
      }

      if (currency) {
        const validCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'];
        if (!validCurrencies.includes(currency)) {
          errors.push('Invalid currency code');
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please correct the following errors',
        errors,
        code: 'VALIDATION_FAILED'
      });
    }

    next();
  } catch (error) {
    console.error('Bypass operation validation error:', error);
    next(error);
  }
};

/**
 * Duplicate bypass prevention
 */
export const preventDuplicateBypass = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const adminId = req.user._id;

    // Check for recent bypass attempts for the same booking
    const recentBypass = await AdminBypassAudit.findOne({
      bookingId,
      adminId,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
      'operationStatus.status': { $in: ['initiated', 'pending_approval', 'in_progress'] }
    });

    if (recentBypass) {
      await bypassSecurityService.logSecurityEvent({
        hotelId: req.user.hotelId,
        adminId,
        eventType: 'duplicate_bypass_attempt',
        severity: 'warning',
        details: {
          bookingId,
          existingBypassId: recentBypass.bypassId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return res.status(409).json({
        error: 'Duplicate bypass operation',
        message: 'A bypass operation for this booking is already in progress.',
        existingBypassId: recentBypass.bypassId,
        code: 'DUPLICATE_BYPASS_OPERATION'
      });
    }

    next();
  } catch (error) {
    console.error('Duplicate bypass prevention error:', error);
    next(error);
  }
};

/**
 * Audit logging middleware
 */
export const auditBypassAttempt = async (req, res, next) => {
  try {
    const originalSend = res.send;

    // Capture the response
    res.send = function(data) {
      // Log the bypass attempt result
      setImmediate(async () => {
        try {
          const success = res.statusCode >= 200 && res.statusCode < 300;
          const responseData = typeof data === 'string' ? JSON.parse(data) : data;

          await bypassSecurityService.logSecurityEvent({
            hotelId: req.user.hotelId,
            adminId: req.user._id,
            eventType: success ? 'bypass_attempt_success' : 'bypass_attempt_failed',
            severity: success ? 'info' : 'warning',
            details: {
              bookingId: req.body.bookingId,
              reason: req.body.reason,
              statusCode: res.statusCode,
              success,
              responseMessage: responseData?.message,
              riskScore: req.bypassSecurity?.riskScore,
              securityFlags: req.bypassSecurity?.securityFlags,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              timestamp: new Date()
            }
          });
        } catch (error) {
          console.error('Failed to log bypass attempt:', error);
        }
      });

      // Call original send
      originalSend.call(this, data);
    };

    next();
  } catch (error) {
    console.error('Audit logging middleware error:', error);
    next(error);
  }
};

/**
 * Request sanitization middleware
 */
export const sanitizeBypassRequest = (req, res, next) => {
  try {
    // Sanitize reason description
    if (req.body.reason && req.body.reason.description) {
      // Remove potential XSS attacks and normalize whitespace
      req.body.reason.description = req.body.reason.description
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/[<>\"']/g, '')
        .trim()
        .substring(0, 1000); // Limit length
    }

    // Sanitize other text fields
    if (req.body.reason && req.body.reason.subcategory) {
      req.body.reason.subcategory = req.body.reason.subcategory
        .replace(/[<>\"']/g, '')
        .trim()
        .substring(0, 100);
    }

    // Ensure numeric fields are properly typed
    if (req.body.financialImpact && req.body.financialImpact.estimatedLoss) {
      req.body.financialImpact.estimatedLoss = parseFloat(req.body.financialImpact.estimatedLoss) || 0;
    }

    if (req.body.reason && req.body.reason.estimatedDuration) {
      req.body.reason.estimatedDuration = parseInt(req.body.reason.estimatedDuration) || 0;
    }

    next();
  } catch (error) {
    console.error('Request sanitization error:', error);
    next(error);
  }
};

/**
 * Error handling middleware specific to bypass operations
 */
export const handleBypassErrors = (error, req, res, next) => {
  console.error('Bypass operation error:', error);

  // Log the error
  setImmediate(async () => {
    try {
      await bypassSecurityService.logSecurityEvent({
        hotelId: req.user?.hotelId,
        adminId: req.user?._id,
        eventType: 'bypass_operation_error',
        severity: 'critical',
        details: {
          error: {
            message: error.message,
            stack: error.stack,
            code: error.code
          },
          request: {
            bookingId: req.body?.bookingId,
            reason: req.body?.reason,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        }
      });
    } catch (logError) {
      console.error('Failed to log bypass error:', logError);
    }
  });

  // Send appropriate error response
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.message,
      code: 'VALIDATION_ERROR'
    });
  }

  if (error.name === 'MongoError' || error.name === 'MongooseError') {
    return res.status(500).json({
      error: 'Database Error',
      message: 'A database error occurred. Please try again.',
      code: 'DATABASE_ERROR'
    });
  }

  if (error.code === 'BYPASS_RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      error: error.message,
      code: error.code
    });
  }

  // Generic error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred. Please contact support if the issue persists.',
    code: 'INTERNAL_SERVER_ERROR'
  });
};
