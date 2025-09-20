import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';
import logger from '../utils/logger.js';
import validationService from '../services/validationService.js';

/**
 * Comprehensive input sanitization middleware
 */
export const sanitizeInput = (options = {}) => {
  const {
    sanitizeHeaders = true,
    sanitizeQuery = true,
    sanitizeParams = true,
    sanitizeBody = true,
    logSuspiciousActivity = true,
    strictMode = false
  } = options;

  return (req, res, next) => {
    try {
      const originalData = {
        headers: req.headers,
        query: req.query,
        params: req.params,
        body: req.body
      };

      const suspiciousPatterns = [];

      // Sanitize headers
      if (sanitizeHeaders && req.headers) {
        req.headers = sanitizeObject(req.headers, suspiciousPatterns, 'headers');
      }

      // Sanitize query parameters
      if (sanitizeQuery && req.query) {
        req.query = sanitizeObject(req.query, suspiciousPatterns, 'query');
      }

      // Sanitize route parameters
      if (sanitizeParams && req.params) {
        req.params = sanitizeObject(req.params, suspiciousPatterns, 'params');
      }

      // Sanitize request body
      if (sanitizeBody && req.body) {
        req.body = sanitizeObject(req.body, suspiciousPatterns, 'body');
      }

      // Log suspicious activity
      if (logSuspiciousActivity && suspiciousPatterns.length > 0) {
        logger.logSecurity('suspicious_input_detected', {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          url: req.originalUrl,
          method: req.method,
          patterns: suspiciousPatterns,
          userId: req.user?.id
        });

        // In strict mode, reject requests with suspicious patterns
        if (strictMode) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'SUSPICIOUS_INPUT',
              message: 'Request contains potentially malicious content'
            }
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Input sanitization error', {
        error: error.message,
        url: req.originalUrl,
        method: req.method
      });
      
      // Don't block request if sanitization fails in non-strict mode
      if (strictMode) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'SANITIZATION_ERROR',
            message: 'Input processing failed'
          }
        });
      }

      next();
    }
  };
};

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj, suspiciousPatterns = [], context = '') {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => 
      sanitizeObject(item, suspiciousPatterns, `${context}[${index}]`)
    );
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key, suspiciousPatterns, `${context}.${key}`);
      sanitized[sanitizedKey] = sanitizeObject(value, suspiciousPatterns, `${context}.${key}`);
    }
    
    return sanitized;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj, suspiciousPatterns, context);
  }

  // Return numbers, booleans, etc. unchanged
  return obj;
}

/**
 * Sanitize individual string values
 */
function sanitizeString(str, suspiciousPatterns = [], context = '') {
  if (typeof str !== 'string') {
    return str;
  }

  let sanitized = str;
  let foundSuspicious = false;

  // SQL Injection patterns
  const sqlPatterns = [
    {
      regex: /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bDROP\b|\bUPDATE\b|\bCREATE\b|\bALTER\b)\s/gi,
      name: 'SQL_INJECTION',
      severity: 'high'
    },
    {
      regex: /(\bOR\b|\bAND\b)\s*\d+\s*=\s*\d+/gi,
      name: 'SQL_CONDITION_BYPASS',
      severity: 'high'
    },
    {
      regex: /(--|\/\*|\*\/|;|\bxp_|\bsp_)/gi,
      name: 'SQL_COMMENT_OR_PROCEDURE',
      severity: 'medium'
    }
  ];

  // XSS patterns
  const xssPatterns = [
    {
      regex: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      name: 'SCRIPT_TAG',
      severity: 'high'
    },
    {
      regex: /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      name: 'IFRAME_TAG',
      severity: 'high'
    },
    {
      regex: /javascript\s*:/gi,
      name: 'JAVASCRIPT_URL',
      severity: 'high'
    },
    {
      regex: /on\w+\s*=/gi,
      name: 'EVENT_HANDLER',
      severity: 'medium'
    },
    {
      regex: /<(object|embed|applet|link|meta|base)\b/gi,
      name: 'DANGEROUS_HTML_TAG',
      severity: 'medium'
    }
  ];

  // Command injection patterns
  const commandPatterns = [
    {
      regex: /(\||&|;|`|\$\(|\${|<|>|>>)/g,
      name: 'COMMAND_INJECTION',
      severity: 'high'
    },
    {
      regex: /(curl|wget|nc|netcat|telnet|ssh|ftp|tftp)/gi,
      name: 'NETWORK_COMMAND',
      severity: 'medium'
    }
  ];

  // Path traversal patterns
  const pathTraversalPatterns = [
    {
      regex: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/gi,
      name: 'PATH_TRAVERSAL',
      severity: 'high'
    },
    {
      regex: /(\/etc\/passwd|\/etc\/shadow|\/proc\/|\/sys\/)/gi,
      name: 'SENSITIVE_PATH_ACCESS',
      severity: 'high'
    }
  ];

  // LDAP injection patterns
  const ldapPatterns = [
    {
      regex: /(\*|\(|\)|\\|\||&|!|=|<|>|~|\/)/g,
      name: 'LDAP_INJECTION',
      severity: 'medium',
      // Only flag if multiple special chars present
      threshold: 3
    }
  ];

  // NoSQL injection patterns
  const nosqlPatterns = [
    {
      regex: /(\$where|\$ne|\$gt|\$lt|\$in|\$nin|\$regex|\$or|\$and)/gi,
      name: 'NOSQL_INJECTION',
      severity: 'medium'
    }
  ];

  const allPatterns = [
    ...sqlPatterns,
    ...xssPatterns,
    ...commandPatterns,
    ...pathTraversalPatterns,
    ...nosqlPatterns
  ];

  // Check for suspicious patterns
  for (const pattern of allPatterns) {
    const matches = sanitized.match(pattern.regex);
    
    if (matches && matches.length > 0) {
      // For patterns with threshold, check if threshold is met
      if (pattern.threshold && matches.length < pattern.threshold) {
        continue;
      }

      foundSuspicious = true;
      suspiciousPatterns.push({
        type: pattern.name,
        severity: pattern.severity,
        context,
        matches: matches.slice(0, 5), // Limit to first 5 matches
        originalString: str.substring(0, 100) // First 100 chars for context
      });

      // Sanitize by removing or escaping the suspicious content
      if (pattern.severity === 'high') {
        // Remove high-severity patterns entirely
        sanitized = sanitized.replace(pattern.regex, '');
      } else {
        // Escape medium/low severity patterns
        sanitized = sanitized.replace(pattern.regex, (match) => {
          return match.replace(/[<>&'"]/g, (char) => {
            const entities = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#x27;', '"': '&quot;' };
            return entities[char] || char;
          });
        });
      }
    }
  }

  // Additional sanitization
  if (foundSuspicious || context.includes('body') || context.includes('query')) {
    // HTML encode special characters
    sanitized = validator.escape(sanitized);
    
    // Use DOMPurify for additional XSS protection
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
  }

  return sanitized;
}

/**
 * Specific sanitization for different data types
 */
export const sanitizeSpecific = {
  email: (email) => {
    if (!email || typeof email !== 'string') return email;
    return validator.normalizeEmail(email.toLowerCase().trim()) || email;
  },

  phone: (phone) => {
    if (!phone || typeof phone !== 'string') return phone;
    return phone.replace(/\D/g, '');
  },

  name: (name) => {
    if (!name || typeof name !== 'string') return name;
    return name.trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-'\.]/g, '')
      .substring(0, 100);
  },

  currency: (amount) => {
    if (amount === null || amount === undefined) return amount;
    const cleaned = amount.toString().replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100; // Round to 2 decimal places
  },

  url: (url) => {
    if (!url || typeof url !== 'string') return url;
    try {
      const parsed = new URL(url);
      // Only allow http and https
      if (['http:', 'https:'].includes(parsed.protocol)) {
        return parsed.toString();
      }
      return '';
    } catch {
      return '';
    }
  },

  html: (html) => {
    if (!html || typeof html !== 'string') return html;
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'p', 'br', 'a'],
      ALLOWED_ATTR: ['href'],
      ALLOWED_SCHEMES: ['http', 'https', 'mailto']
    });
  }
};

/**
 * File upload sanitization
 */
export const sanitizeFileUpload = (file) => {
  if (!file) return file;

  // Sanitize filename
  const sanitizedFilename = file.originalname
    ? file.originalname
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .substring(0, 255)
    : 'upload';

  // Validate file size (default 10MB limit)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File size exceeds limit');
  }

  // Validate MIME type
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error('File type not allowed');
  }

  return {
    ...file,
    originalname: sanitizedFilename
  };
};

/**
 * Middleware to sanitize specific fields
 */
export const sanitizeFields = (fieldMap) => {
  return (req, res, next) => {
    try {
      if (req.body) {
        for (const [field, sanitizer] of Object.entries(fieldMap)) {
          if (req.body[field] !== undefined) {
            if (typeof sanitizer === 'string') {
              req.body[field] = sanitizeSpecific[sanitizer](req.body[field]);
            } else if (typeof sanitizer === 'function') {
              req.body[field] = sanitizer(req.body[field]);
            }
          }
        }
      }

      if (req.query) {
        for (const [field, sanitizer] of Object.entries(fieldMap)) {
          if (req.query[field] !== undefined) {
            if (typeof sanitizer === 'string') {
              req.query[field] = sanitizeSpecific[sanitizer](req.query[field]);
            } else if (typeof sanitizer === 'function') {
              req.query[field] = sanitizer(req.query[field]);
            }
          }
        }
      }

      next();
    } catch (error) {
      logger.error('Field sanitization error', {
        error: error.message,
        url: req.originalUrl,
        method: req.method
      });
      next(error);
    }
  };
};

/**
 * Rate limiting for sanitization alerts
 */
const alertRateLimit = new Map();

function shouldAlert(ip, type) {
  const key = `${ip}:${type}`;
  const now = Date.now();
  const limit = alertRateLimit.get(key) || { count: 0, resetTime: now + 60000 }; // 1 minute window

  if (now > limit.resetTime) {
    limit.count = 0;
    limit.resetTime = now + 60000;
  }

  limit.count++;
  alertRateLimit.set(key, limit);

  return limit.count <= 5; // Allow max 5 alerts per minute per IP
}

export default sanitizeInput;
