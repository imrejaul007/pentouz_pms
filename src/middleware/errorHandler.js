import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// Error tracking for analytics
const errorTracker = new Map();

export class ApplicationError extends Error {
  constructor(message, statusCode = 500, code = null, details = {}) {
    super(message);
    this.name = 'ApplicationError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, ApplicationError);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

export class ValidationError extends ApplicationError {
  constructor(message, field = null, value = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
    this.value = value;
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED_ERROR');
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN_ERROR');
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends ApplicationError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

export class ExternalServiceError extends ApplicationError {
  constructor(service, message = 'External service unavailable') {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
  }
}

export const errorHandler = (err, req, res, next) => {
  const errorId = uuidv4();
  const timestamp = new Date().toISOString();
  
  // Track error frequency for analytics
  const errorKey = `${err.name}:${err.message}`;
  const errorCount = errorTracker.get(errorKey) || 0;
  errorTracker.set(errorKey, errorCount + 1);

  let error = {
    id: errorId,
    timestamp,
    name: err.name,
    message: err.message,
    statusCode: err.statusCode || 500,
    code: err.code,
    path: req.path,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id,
    userRole: req.user?.role,
    hotelId: req.user?.hotelId,
    correlationId: req.correlationId,
    requestId: req.requestId,
    count: errorCount + 1
  };

  // Handle specific error types
  if (err.name === 'CastError') {
    error.statusCode = 400;
    error.code = 'INVALID_ID';
    error.message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose duplicate key
  else if (err.code === 11000) {
    error.statusCode = 409;
    error.code = 'DUPLICATE_ENTRY';
    const field = Object.keys(err.keyValue || {})[0];
    const value = Object.values(err.keyValue || {})[0];
    error.message = `${field} '${value}' already exists`;
    error.field = field;
    error.value = value;
  }

  // Mongoose validation error
  else if (err.name === 'ValidationError') {
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    error.message = Object.values(err.errors).map(val => val.message).join(', ');
    error.validationErrors = Object.keys(err.errors).map(field => ({
      field,
      message: err.errors[field].message,
      value: err.errors[field].value
    }));
  }

  // JWT errors
  else if (err.name === 'JsonWebTokenError') {
    error.statusCode = 401;
    error.code = 'INVALID_TOKEN';
    error.message = 'Invalid authentication token';
  }

  else if (err.name === 'TokenExpiredError') {
    error.statusCode = 401;
    error.code = 'TOKEN_EXPIRED';
    error.message = 'Authentication token has expired';
  }

  // MongoDB connection errors
  else if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    error.statusCode = 503;
    error.code = 'DATABASE_UNAVAILABLE';
    error.message = 'Database temporarily unavailable';
  }

  // Rate limiting errors
  else if (err.name === 'RateLimitError' || err.statusCode === 429) {
    error.statusCode = 429;
    error.code = 'RATE_LIMIT_EXCEEDED';
    error.message = 'Too many requests, please try again later';
    error.retryAfter = err.retryAfter || 60;
  }

  // Payment processing errors
  else if (err.name === 'PaymentError') {
    error.statusCode = 402;
    error.code = 'PAYMENT_ERROR';
    error.message = err.message || 'Payment processing failed';
  }

  // External API errors
  else if (err.name === 'ExternalAPIError') {
    error.statusCode = 502;
    error.code = 'EXTERNAL_API_ERROR';
    error.message = `External service error: ${err.message}`;
    error.service = err.service;
  }

  // File upload errors
  else if (err.name === 'MulterError') {
    error.statusCode = 400;
    error.code = 'FILE_UPLOAD_ERROR';
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        error.message = 'File too large';
        break;
      case 'LIMIT_FILE_COUNT':
        error.message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        error.message = 'Unexpected file field';
        break;
      default:
        error.message = 'File upload error';
    }
  }

  // Security-related errors
  else if (err.name === 'SecurityError') {
    error.statusCode = 403;
    error.code = 'SECURITY_ERROR';
    error.message = 'Security violation detected';
    
    // Log security events separately
    logger.logSecurity('security_violation', {
      errorId,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      details: err.details
    });
  }

  // Handle operational vs programming errors
  const isOperational = error.statusCode < 500;
  const logLevel = isOperational ? 'warn' : 'error';
  
  // Create comprehensive error context
  const errorContext = {
    errorId,
    error: {
      name: err.name,
      message: err.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: err.stack
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      path: req.path,
      query: req.query,
      params: req.params,
      headers: sanitizeHeaders(req.headers),
      body: sanitizeRequestBody(req.body),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    },
    user: req.user ? {
      id: req.user.id,
      role: req.user.role,
      email: req.user.email,
      hotelId: req.user.hotelId
    } : null,
    timestamp,
    correlationId: req.correlationId,
    requestId: req.requestId
  };

  // Log the error with appropriate level
  logger[logLevel]('Request Error', errorContext);

  // For critical errors, also send alert
  if (!isOperational) {
    sendErrorAlert(error, errorContext);
  }

  // Prepare response
  const response = {
    success: false,
    error: {
      id: errorId,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Internal server error',
      statusCode: error.statusCode,
      timestamp
    }
  };

  // Add additional fields for development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
    response.error.details = error.validationErrors || error.details;
  }

  // Add retry information for rate limiting
  if (error.statusCode === 429) {
    response.error.retryAfter = error.retryAfter;
    res.set('Retry-After', error.retryAfter);
  }

  // Set security headers for security errors
  if (error.code === 'SECURITY_ERROR') {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
  }

  res.status(error.statusCode).json(response);
};

// Sanitize headers to remove sensitive information
function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  const sensitiveHeaders = [
    'authorization', 'x-api-key', 'x-secret', 'cookie', 'set-cookie',
    'x-access-token', 'x-refresh-token', 'x-csrf-token'
  ];

  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });

  return sanitized;
}

// Sanitize request body
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') return body;

  const sanitized = { ...body };
  const sensitiveFields = [
    'password', 'confirmPassword', 'currentPassword', 'newPassword',
    'token', 'accessToken', 'refreshToken', 'apiKey', 'secret',
    'creditCard', 'cardNumber', 'cvv', 'ssn', 'pin'
  ];

  const sanitizeObject = (obj, visited = new WeakSet()) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    // Handle circular references
    if (visited.has(obj)) {
      return '[Circular Reference]';
    }
    
    visited.add(obj);
    
    const result = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeObject(value, visited);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  };

  return sanitizeObject(sanitized);
}

// Send error alerts for critical issues
async function sendErrorAlert(error, context) {
  try {
    // This would integrate with your notification service
    // For now, we'll just log it as a high-priority error
    logger.error('CRITICAL ERROR ALERT', {
      alert: true,
      priority: 'high',
      errorId: error.id,
      statusCode: error.statusCode,
      message: error.message,
      userId: context.user?.id,
      hotelId: context.user?.hotelId,
      path: context.request.path,
      timestamp: context.timestamp
    });
  } catch (alertError) {
    logger.error('Failed to send error alert', { alertError: alertError.message });
  }
}

// Error handler for async routes
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Global error handlers
export const handleUncaughtException = (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    pid: process.pid,
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
  
  // Gracefully shut down
  process.exit(1);
};

export const handleUnhandledRejection = (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : null,
    promise: promise.toString(),
    pid: process.pid,
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
};

// 404 handler
export const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Error statistics
export const getErrorStats = () => {
  const stats = Array.from(errorTracker.entries()).map(([error, count]) => ({
    error,
    count,
    lastSeen: new Date().toISOString()
  }));

  return {
    totalUniqueErrors: errorTracker.size,
    totalErrorCount: Array.from(errorTracker.values()).reduce((sum, count) => sum + count, 0),
    errors: stats.sort((a, b) => b.count - a.count)
  };
};

// Clear error statistics (for maintenance)
export const clearErrorStats = () => {
  errorTracker.clear();
};

export default errorHandler;
