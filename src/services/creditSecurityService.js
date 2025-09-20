import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import validator from 'validator';
import CorporateCredit from '../models/CorporateCredit.js';
import CorporateCompany from '../models/CorporateCompany.js';

/**
 * Credit Management Security Service
 * Handles security, validation, audit logging, and data protection
 */
class CreditSecurityService {

  /**
   * Input validation and sanitization for credit operations
   */
  validateCreditInput(inputData, operationType) {
    const errors = [];
    const sanitizedData = {};

    switch (operationType) {
      case 'creditLimitRequest':
        // Validate company ID
        if (!inputData.companyId || !mongoose.isValidObjectId(inputData.companyId)) {
          errors.push('Invalid company ID format');
        } else {
          sanitizedData.companyId = inputData.companyId.trim();
        }

        // Validate requested limit
        if (!inputData.requestedLimit || typeof inputData.requestedLimit !== 'number' || inputData.requestedLimit <= 0) {
          errors.push('Requested limit must be a positive number');
        } else if (inputData.requestedLimit > 100000000) { // 10 crore max
          errors.push('Requested limit cannot exceed ₹10,00,00,000');
        } else {
          sanitizedData.requestedLimit = Math.round(inputData.requestedLimit * 100) / 100; // Round to 2 decimals
        }

        // Validate justification
        if (!inputData.justification || typeof inputData.justification !== 'string') {
          errors.push('Justification is required');
        } else if (inputData.justification.length < 10) {
          errors.push('Justification must be at least 10 characters');
        } else if (inputData.justification.length > 1000) {
          errors.push('Justification cannot exceed 1000 characters');
        } else {
          sanitizedData.justification = validator.escape(inputData.justification.trim());
        }
        break;

      case 'creditAdjustment':
        // Validate company ID
        if (!inputData.companyId || !mongoose.isValidObjectId(inputData.companyId)) {
          errors.push('Invalid company ID format');
        } else {
          sanitizedData.companyId = inputData.companyId.trim();
        }

        // Validate adjustment amount
        if (inputData.adjustmentAmount === undefined || typeof inputData.adjustmentAmount !== 'number') {
          errors.push('Adjustment amount must be a number');
        } else if (Math.abs(inputData.adjustmentAmount) > 10000000) { // 1 crore max adjustment
          errors.push('Adjustment amount cannot exceed ₹1,00,00,000');
        } else {
          sanitizedData.adjustmentAmount = Math.round(inputData.adjustmentAmount * 100) / 100;
        }

        // Validate reason
        if (!inputData.reason || typeof inputData.reason !== 'string') {
          errors.push('Reason is required');
        } else if (inputData.reason.length < 5) {
          errors.push('Reason must be at least 5 characters');
        } else if (inputData.reason.length > 500) {
          errors.push('Reason cannot exceed 500 characters');
        } else {
          sanitizedData.reason = validator.escape(inputData.reason.trim());
        }
        break;

      case 'bookingCredit':
        // Validate company ID
        if (!inputData.companyId || !mongoose.isValidObjectId(inputData.companyId)) {
          errors.push('Invalid company ID format');
        } else {
          sanitizedData.companyId = inputData.companyId.trim();
        }

        // Validate amount
        if (!inputData.amount || typeof inputData.amount !== 'number' || inputData.amount <= 0) {
          errors.push('Amount must be a positive number');
        } else if (inputData.amount > 1000000) { // 10 lakh max per booking
          errors.push('Booking amount cannot exceed ₹10,00,000');
        } else {
          sanitizedData.amount = Math.round(inputData.amount * 100) / 100;
        }

        // Validate booking ID
        if (!inputData.bookingId || typeof inputData.bookingId !== 'string') {
          errors.push('Booking ID is required');
        } else if (inputData.bookingId.length > 50) {
          errors.push('Booking ID too long');
        } else {
          sanitizedData.bookingId = inputData.bookingId.trim();
        }
        break;

      default:
        errors.push('Unknown operation type');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData
    };
  }

  /**
   * Rate limiting configurations for different credit operations
   */
  getCreditRateLimiters() {
    return {
      // Credit limit requests - more restrictive
      creditLimitRequest: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // Max 5 requests per 15 minutes
        message: {
          error: 'Too many credit limit requests. Please try again in 15 minutes.',
          code: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => `${req.user.id}-credit-limit-request`
      }),

      // Credit adjustments - very restrictive
      creditAdjustment: rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // Max 10 adjustments per hour
        message: {
          error: 'Too many credit adjustments. Please try again in 1 hour.',
          code: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => `${req.user.id}-credit-adjustment`
      }),

      // Booking credit processing - moderate
      bookingCredit: rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 20, // Max 20 bookings per minute
        message: {
          error: 'Too many booking requests. Please try again in 1 minute.',
          code: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => `${req.user.hotelId}-booking-credit`
      }),

      // Transaction queries - lenient
      transactionQueries: rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 100, // Max 100 queries per minute
        message: {
          error: 'Too many requests. Please try again shortly.',
          code: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => `${req.user.hotelId}-queries`
      })
    };
  }

  /**
   * Audit logging for sensitive credit operations
   */
  async logCreditOperation(operationData) {
    try {
      const logEntry = {
        timestamp: new Date(),
        operation: operationData.operation,
        userId: operationData.userId,
        hotelId: operationData.hotelId,
        companyId: operationData.companyId,
        details: {
          ...operationData.details,
          userAgent: operationData.userAgent,
          ipAddress: this.hashSensitiveData(operationData.ipAddress),
          sessionId: operationData.sessionId
        },
        severity: operationData.severity || 'info', // info, warning, critical
        success: operationData.success,
        error: operationData.error,
        metadata: {
          version: '1.0',
          source: 'credit-security-service'
        }
      };

      // In production, this would be sent to a secure logging service
      console.log('CREDIT_AUDIT_LOG:', JSON.stringify(logEntry));

      // Also store critical operations in database for compliance
      if (operationData.severity === 'critical') {
        // This could be stored in an AuditLog collection
        console.log('CRITICAL_OPERATION_LOGGED:', {
          operation: operationData.operation,
          userId: operationData.userId,
          timestamp: logEntry.timestamp
        });
      }

      return { success: true, logId: this.generateLogId() };

    } catch (error) {
      console.error('Audit logging failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Data encryption for sensitive financial information
   */
  encryptSensitiveData(data, encryptionKey = null) {
    try {
      const key = encryptionKey || process.env.CREDIT_ENCRYPTION_KEY || 'fallback-key-for-dev';
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipher(algorithm, key);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      return null;
    }
  }

  /**
   * Data decryption for sensitive financial information
   */
  decryptSensitiveData(encryptedData, encryptionKey = null) {
    try {
      const key = encryptionKey || process.env.CREDIT_ENCRYPTION_KEY || 'fallback-key-for-dev';
      const decipher = crypto.createDecipher(encryptedData.algorithm, key);

      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  /**
   * Transaction integrity verification
   */
  async verifyTransactionIntegrity(transactionId) {
    try {
      const transaction = await CorporateCredit.findById(transactionId);
      if (!transaction) {
        return { isValid: false, reason: 'Transaction not found' };
      }

      // Verify transaction consistency
      const company = await CorporateCompany.findById(transaction.corporateCompanyId);
      if (!company) {
        return { isValid: false, reason: 'Associated company not found' };
      }

      // Check if transaction amounts are reasonable
      if (transaction.amount <= 0) {
        return { isValid: false, reason: 'Invalid transaction amount' };
      }

      // Verify balance consistency (simplified check)
      if (transaction.balance < 0 && transaction.transactionType !== 'adjustment') {
        return {
          isValid: false,
          reason: 'Negative balance detected for non-adjustment transaction',
          severity: 'high'
        };
      }

      // Check for duplicate transactions (same amount, company, time)
      const duplicateCheck = await CorporateCredit.findOne({
        corporateCompanyId: transaction.corporateCompanyId,
        amount: transaction.amount,
        transactionDate: {
          $gte: new Date(transaction.transactionDate.getTime() - 1000), // 1 second window
          $lte: new Date(transaction.transactionDate.getTime() + 1000)
        },
        _id: { $ne: transactionId }
      });

      if (duplicateCheck) {
        return {
          isValid: false,
          reason: 'Potential duplicate transaction detected',
          severity: 'medium'
        };
      }

      return {
        isValid: true,
        checks: {
          transactionExists: true,
          companyExists: true,
          amountValid: true,
          balanceConsistent: true,
          noDuplicates: true
        }
      };

    } catch (error) {
      console.error('Transaction integrity check failed:', error);
      return {
        isValid: false,
        reason: 'Integrity check failed',
        error: error.message
      };
    }
  }

  /**
   * Security middleware for credit endpoints
   */
  getCreditSecurityMiddleware() {
    return (req, res, next) => {
      // Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

      // Log the request for audit trail
      this.logCreditOperation({
        operation: 'API_ACCESS',
        userId: req.user?.id,
        hotelId: req.user?.hotelId,
        details: {
          method: req.method,
          path: req.path,
          query: req.query
        },
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        sessionId: req.sessionID,
        severity: 'info',
        success: true
      });

      next();
    };
  }

  /**
   * Hash sensitive data for logging
   * @private
   */
  hashSensitiveData(data) {
    if (!data) return null;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Generate unique log ID
   * @private
   */
  generateLogId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validate credit limit changes for suspicious patterns
   */
  async validateCreditLimitChange(companyId, currentLimit, newLimit, userId) {
    try {
      const increaseAmount = newLimit - currentLimit;
      const increasePercentage = currentLimit > 0 ? (increaseAmount / currentLimit) * 100 : 100;

      const suspiciousPatterns = [];

      // Check for unusually large increases
      if (increasePercentage > 500) { // More than 500% increase
        suspiciousPatterns.push({
          type: 'large_percentage_increase',
          severity: 'high',
          description: `Credit limit increase of ${increasePercentage.toFixed(1)}% exceeds typical range`
        });
      }

      if (increaseAmount > 10000000) { // More than 1 crore increase
        suspiciousPatterns.push({
          type: 'large_absolute_increase',
          severity: 'high',
          description: `Credit limit increase of ₹${increaseAmount.toLocaleString()} is unusually large`
        });
      }

      // Check for frequent limit changes
      const recentChanges = await CorporateCredit.find({
        corporateCompanyId: companyId,
        transactionType: 'credit',
        category: 'adjustment',
        transactionDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });

      if (recentChanges.length > 3) {
        suspiciousPatterns.push({
          type: 'frequent_changes',
          severity: 'medium',
          description: `${recentChanges.length} credit limit changes in the last 30 days`
        });
      }

      return {
        isValid: suspiciousPatterns.length === 0,
        suspiciousPatterns,
        riskLevel: suspiciousPatterns.some(p => p.severity === 'high') ? 'high' :
                   suspiciousPatterns.some(p => p.severity === 'medium') ? 'medium' : 'low'
      };

    } catch (error) {
      console.error('Credit limit validation failed:', error);
      return {
        isValid: false,
        error: error.message,
        riskLevel: 'unknown'
      };
    }
  }
}

export default new CreditSecurityService();