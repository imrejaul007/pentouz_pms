import Joi from 'joi';
import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';
import logger from '../utils/logger.js';
import { ValidationError } from '../middleware/errorHandler.js';

class ValidationService {
  constructor() {
    this.customValidators = new Map();
    this.sanitizers = new Map();
    this.validationCache = new Map();
    
    // Initialize built-in validators and sanitizers
    this.initializeBuiltInValidators();
    this.initializeBuiltInSanitizers();
  }

  /**
   * Initialize built-in validators
   */
  initializeBuiltInValidators() {
    // Email validator with domain checking
    this.addValidator('email', async (value) => {
      if (!validator.isEmail(value)) {
        return { valid: false, message: 'Invalid email format' };
      }

      // Check for suspicious domains
      const suspiciousDomains = [
        'tempmail', 'guerrillamail', '10minutemail', 'throwaway',
        'mailinator', 'temp-mail', 'disposable'
      ];
      
      const domain = value.split('@')[1].toLowerCase();
      if (suspiciousDomains.some(suspicious => domain.includes(suspicious))) {
        return { valid: false, message: 'Disposable email addresses are not allowed' };
      }

      return { valid: true };
    });

    // Phone number validator
    this.addValidator('phone', async (value) => {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length < 10 || cleaned.length > 15) {
        return { valid: false, message: 'Phone number must be 10-15 digits' };
      }

      if (!validator.isMobilePhone(value, 'any', { strictMode: false })) {
        return { valid: false, message: 'Invalid phone number format' };
      }

      return { valid: true };
    });

    // Strong password validator
    this.addValidator('strongPassword', async (value) => {
      const minLength = 8;
      const hasUpperCase = /[A-Z]/.test(value);
      const hasLowerCase = /[a-z]/.test(value);
      const hasNumbers = /\d/.test(value);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

      const issues = [];
      if (value.length < minLength) issues.push(`at least ${minLength} characters`);
      if (!hasUpperCase) issues.push('uppercase letter');
      if (!hasLowerCase) issues.push('lowercase letter');
      if (!hasNumbers) issues.push('number');
      if (!hasSpecialChar) issues.push('special character');

      if (issues.length > 0) {
        return {
          valid: false,
          message: `Password must contain ${issues.join(', ')}`
        };
      }

      // Check against common passwords
      const commonPasswords = [
        'password', '123456', 'password123', 'admin', 'qwerty',
        'letmein', 'welcome', 'monkey', '1234567890'
      ];

      if (commonPasswords.includes(value.toLowerCase())) {
        return { valid: false, message: 'Password is too common' };
      }

      return { valid: true };
    });

    // Credit card validator
    this.addValidator('creditCard', async (value) => {
      const cleaned = value.replace(/\s|-/g, '');
      if (!validator.isCreditCard(cleaned)) {
        return { valid: false, message: 'Invalid credit card number' };
      }

      // Additional Luhn algorithm check
      if (!this.luhnCheck(cleaned)) {
        return { valid: false, message: 'Credit card number failed validation' };
      }

      return { valid: true };
    });

    // URL validator with protocol checking
    this.addValidator('url', async (value) => {
      if (!validator.isURL(value, {
        protocols: ['http', 'https'],
        require_protocol: true,
        require_valid_protocol: true
      })) {
        return { valid: false, message: 'Invalid URL format' };
      }

      // Check for suspicious domains
      const suspiciousDomains = [
        'bit.ly', 'tinyurl', 't.co', 'short.link', 'goo.gl'
      ];

      try {
        const url = new URL(value);
        if (suspiciousDomains.includes(url.hostname)) {
          return { valid: false, message: 'Shortened URLs are not allowed' };
        }
      } catch (error) {
        return { valid: false, message: 'Invalid URL structure' };
      }

      return { valid: true };
    });

    // File upload validator
    this.addValidator('fileUpload', async (value, options = {}) => {
      const {
        allowedTypes = ['image/jpeg', 'image/png', 'image/gif'],
        maxSize = 5 * 1024 * 1024, // 5MB
        minSize = 1024 // 1KB
      } = options;

      if (!value.mimetype || !allowedTypes.includes(value.mimetype)) {
        return {
          valid: false,
          message: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
        };
      }

      if (value.size > maxSize) {
        return {
          valid: false,
          message: `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`
        };
      }

      if (value.size < minSize) {
        return {
          valid: false,
          message: `File too small. Minimum size: ${Math.round(minSize / 1024)}KB`
        };
      }

      return { valid: true };
    });

    // Business rules validator
    this.addValidator('businessRules', async (value, rules) => {
      for (const rule of rules) {
        const result = await rule(value);
        if (!result.valid) {
          return result;
        }
      }
      return { valid: true };
    });
  }

  /**
   * Initialize built-in sanitizers
   */
  initializeBuiltInSanitizers() {
    // HTML sanitizer
    this.addSanitizer('html', (value) => {
      return DOMPurify.sanitize(value, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href']
      });
    });

    // Text sanitizer
    this.addSanitizer('text', (value) => {
      return validator.escape(value.toString().trim());
    });

    // Email sanitizer
    this.addSanitizer('email', (value) => {
      return validator.normalizeEmail(value.toLowerCase().trim());
    });

    // Phone sanitizer
    this.addSanitizer('phone', (value) => {
      return value.replace(/\D/g, '');
    });

    // Name sanitizer
    this.addSanitizer('name', (value) => {
      return value.trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s-'\.]/g, '')
        .substring(0, 100);
    });

    // Currency sanitizer
    this.addSanitizer('currency', (value) => {
      const cleaned = value.toString().replace(/[^\d.-]/g, '');
      return parseFloat(cleaned) || 0;
    });

    // SQL injection prevention
    this.addSanitizer('sql', (value) => {
      const sqlInjectionPatterns = [
        /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i,
        /UNION\s+SELECT/i,
        /DROP\s+TABLE/i,
        /INSERT\s+INTO/i,
        /DELETE\s+FROM/i,
        /UPDATE\s+.+\s+SET/i,
        /--/,
        /\/\*/,
        /\*\//,
        /xp_/i,
        /sp_/i
      ];

      let sanitized = value.toString();
      
      sqlInjectionPatterns.forEach(pattern => {
        if (pattern.test(sanitized)) {
          logger.logSecurity('sql_injection_attempt', {
            originalValue: sanitized,
            pattern: pattern.toString()
          });
          sanitized = sanitized.replace(pattern, '');
        }
      });

      return sanitized;
    });

    // XSS prevention
    this.addSanitizer('xss', (value) => {
      const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
        /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi
      ];

      let sanitized = value.toString();

      xssPatterns.forEach(pattern => {
        if (pattern.test(sanitized)) {
          logger.logSecurity('xss_attempt', {
            originalValue: sanitized,
            pattern: pattern.toString()
          });
          sanitized = sanitized.replace(pattern, '');
        }
      });

      return DOMPurify.sanitize(sanitized);
    });
  }

  /**
   * Add custom validator
   */
  addValidator(name, validator) {
    this.customValidators.set(name, validator);
  }

  /**
   * Add custom sanitizer
   */
  addSanitizer(name, sanitizer) {
    this.sanitizers.set(name, sanitizer);
  }

  /**
   * Validate value using custom validator
   */
  async validateCustom(validatorName, value, options = {}) {
    const validator = this.customValidators.get(validatorName);
    if (!validator) {
      throw new Error(`Validator '${validatorName}' not found`);
    }

    try {
      return await validator(value, options);
    } catch (error) {
      logger.error('Validation error', {
        validator: validatorName,
        error: error.message
      });
      return { valid: false, message: 'Validation failed' };
    }
  }

  /**
   * Sanitize value using custom sanitizer
   */
  sanitize(sanitizerName, value) {
    const sanitizer = this.sanitizers.get(sanitizerName);
    if (!sanitizer) {
      throw new Error(`Sanitizer '${sanitizerName}' not found`);
    }

    try {
      return sanitizer(value);
    } catch (error) {
      logger.error('Sanitization error', {
        sanitizer: sanitizerName,
        error: error.message
      });
      return value; // Return original value if sanitization fails
    }
  }

  /**
   * Comprehensive data validation and sanitization
   */
  async validateAndSanitize(data, schema) {
    const result = {
      valid: true,
      errors: [],
      sanitizedData: {},
      warnings: []
    };

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      try {
        // Skip if field is not present and not required
        if (value === undefined || value === null) {
          if (rules.required) {
            result.valid = false;
            result.errors.push({
              field,
              message: `${field} is required`
            });
          }
          continue;
        }

        // Sanitize first
        let sanitizedValue = value;
        if (rules.sanitizers) {
          for (const sanitizerName of rules.sanitizers) {
            sanitizedValue = this.sanitize(sanitizerName, sanitizedValue);
          }
        }

        // Then validate
        if (rules.validators) {
          for (const validatorConfig of rules.validators) {
            const { name, options } = typeof validatorConfig === 'string' 
              ? { name: validatorConfig, options: {} }
              : validatorConfig;

            const validation = await this.validateCustom(name, sanitizedValue, options);
            if (!validation.valid) {
              result.valid = false;
              result.errors.push({
                field,
                message: validation.message
              });
              break; // Stop validating this field on first error
            }
          }
        }

        // Additional Joi validation if provided
        if (rules.joi) {
          const { error } = rules.joi.validate(sanitizedValue);
          if (error) {
            result.valid = false;
            result.errors.push({
              field,
              message: error.details[0].message
            });
          }
        }

        result.sanitizedData[field] = sanitizedValue;

      } catch (error) {
        result.valid = false;
        result.errors.push({
          field,
          message: `Validation failed: ${error.message}`
        });
      }
    }

    return result;
  }

  /**
   * Middleware for comprehensive validation
   */
  createValidationMiddleware(schema) {
    return async (req, res, next) => {
      try {
        const result = await this.validateAndSanitize(req.body, schema);
        
        if (!result.valid) {
          throw new ValidationError(
            `Validation failed: ${result.errors.map(e => `${e.field}: ${e.message}`).join(', ')}`
          );
        }

        // Replace request body with sanitized data
        req.body = result.sanitizedData;
        
        // Add warnings to request for potential logging
        if (result.warnings.length > 0) {
          req.validationWarnings = result.warnings;
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Rate limiting validation
   */
  async validateRateLimit(identifier, action, limits) {
    const key = `rate_limit:${action}:${identifier}`;
    const now = Date.now();
    
    // This would integrate with Redis in production
    if (!this.rateLimitCache) {
      this.rateLimitCache = new Map();
    }

    const record = this.rateLimitCache.get(key) || { count: 0, resetTime: now + limits.window };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + limits.window;
    }

    record.count++;
    this.rateLimitCache.set(key, record);

    if (record.count > limits.max) {
      return {
        valid: false,
        message: `Rate limit exceeded for ${action}. Try again in ${Math.ceil((record.resetTime - now) / 1000)} seconds`
      };
    }

    return { valid: true };
  }

  /**
   * Business rule validation factory
   */
  createBusinessRule(name, validator) {
    return {
      name,
      validate: async (value, context = {}) => {
        try {
          return await validator(value, context);
        } catch (error) {
          logger.error('Business rule validation error', {
            rule: name,
            error: error.message,
            context
          });
          return { valid: false, message: 'Business rule validation failed' };
        }
      }
    };
  }

  /**
   * Batch validation for multiple records
   */
  async validateBatch(records, schema) {
    const results = [];
    
    for (let i = 0; i < records.length; i++) {
      const result = await this.validateAndSanitize(records[i], schema);
      results.push({
        index: i,
        ...result
      });
    }

    return {
      valid: results.every(r => r.valid),
      results,
      validCount: results.filter(r => r.valid).length,
      invalidCount: results.filter(r => !r.valid).length
    };
  }

  /**
   * Luhn algorithm for credit card validation
   */
  luhnCheck(cardNumber) {
    let sum = 0;
    let alternate = false;

    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let n = parseInt(cardNumber[i]);
      
      if (alternate) {
        n *= 2;
        if (n > 9) {
          n = (n % 10) + 1;
        }
      }
      
      sum += n;
      alternate = !alternate;
    }

    return sum % 10 === 0;
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
    if (this.rateLimitCache) {
      this.rateLimitCache.clear();
    }
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    return {
      customValidators: this.customValidators.size,
      sanitizers: this.sanitizers.size,
      cacheSize: this.validationCache.size,
      rateLimitCacheSize: this.rateLimitCache?.size || 0
    };
  }
}

// Pre-defined validation schemas for common use cases
export const commonValidationSchemas = {
  user: {
    name: {
      required: true,
      sanitizers: ['name'],
      validators: ['required'],
      joi: Joi.string().min(2).max(100)
    },
    email: {
      required: true,
      sanitizers: ['email'],
      validators: ['email']
    },
    phone: {
      required: false,
      sanitizers: ['phone'],
      validators: ['phone']
    },
    password: {
      required: true,
      validators: ['strongPassword']
    }
  },

  booking: {
    checkIn: {
      required: true,
      joi: Joi.date().iso().min('now')
    },
    checkOut: {
      required: true,
      joi: Joi.date().iso().greater(Joi.ref('checkIn'))
    },
    adults: {
      required: true,
      joi: Joi.number().integer().min(1).max(10)
    },
    children: {
      required: false,
      joi: Joi.number().integer().min(0).max(5)
    }
  },

  payment: {
    amount: {
      required: true,
      sanitizers: ['currency'],
      joi: Joi.number().min(0.01)
    },
    currency: {
      required: true,
      joi: Joi.string().length(3).uppercase()
    },
    cardNumber: {
      required: true,
      validators: ['creditCard']
    }
  }
};

// Create singleton instance
const validationService = new ValidationService();

export default validationService;