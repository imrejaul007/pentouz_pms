import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      ...(stack && { stack }),
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'hotel-management-system',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports: [
    // Error logs - only errors and above
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    }),

    // Combined logs - all levels
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),

    // Application logs - info and above
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),

    // Debug logs - separate file for debugging
    new winston.transports.File({
      filename: path.join(logsDir, 'debug.log'),
      level: 'debug',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let logMessage = `${timestamp} ${level}: ${message}`;
        
        if (Object.keys(meta).length > 0) {
          logMessage += ` ${JSON.stringify(meta, null, 2)}`;
        }
        
        if (stack) {
          logMessage += `\n${stack}`;
        }
        
        return logMessage;
      })
    )
  }));
}

// Enhanced logger with additional methods
class EnhancedLogger {
  constructor(winstonLogger) {
    this.winston = winstonLogger;
  }

  info(message, meta = {}) {
    this.winston.info(message, this.sanitizeMeta(meta));
  }

  error(message, meta = {}) {
    this.winston.error(message, this.sanitizeMeta(meta));
  }

  warn(message, meta = {}) {
    this.winston.warn(message, this.sanitizeMeta(meta));
  }

  debug(message, meta = {}) {
    this.winston.debug(message, this.sanitizeMeta(meta));
  }

  http(message, meta = {}) {
    this.winston.http(message, this.sanitizeMeta(meta));
  }

  verbose(message, meta = {}) {
    this.winston.verbose(message, this.sanitizeMeta(meta));
  }

  silly(message, meta = {}) {
    this.winston.silly(message, this.sanitizeMeta(meta));
  }

  // Structured logging methods
  logAuth(action, user, details = {}) {
    this.info('Authentication Event', {
      category: 'auth',
      action,
      userId: user?.id,
      userRole: user?.role,
      ...details
    });
  }

  logBooking(action, booking, details = {}) {
    this.info('Booking Event', {
      category: 'booking',
      action,
      bookingId: booking?.id,
      hotelId: booking?.hotelId,
      guestId: booking?.guestId,
      ...details
    });
  }

  logPayment(action, payment, details = {}) {
    this.info('Payment Event', {
      category: 'payment',
      action,
      paymentId: payment?.id,
      amount: payment?.amount,
      currency: payment?.currency,
      method: payment?.method,
      ...details
    });
  }

  logSecurity(event, details = {}) {
    this.warn('Security Event', {
      category: 'security',
      event,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  logPerformance(operation, duration, details = {}) {
    const level = duration > 5000 ? 'warn' : 'info';
    this[level]('Performance Metric', {
      category: 'performance',
      operation,
      duration: `${duration}ms`,
      slow: duration > 1000,
      ...details
    });
  }

  logDatabase(operation, query, duration, details = {}) {
    this.debug('Database Operation', {
      category: 'database',
      operation,
      query: this.sanitizeQuery(query),
      duration: `${duration}ms`,
      ...details
    });
  }

  logError(error, context = {}) {
    const errorInfo = {
      category: 'error',
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      statusCode: error.statusCode,
      ...context
    };

    this.error('Application Error', errorInfo);
  }

  // Sanitize sensitive data
  sanitizeMeta(meta) {
    if (!meta || typeof meta !== 'object') return meta;

    const sanitized = { ...meta };
    const sensitiveFields = [
      'password', 'token', 'authorization', 'secret', 'key',
      'creditCard', 'ssn', 'cvv', 'pin', 'cardNumber'
    ];

    const sanitizeValue = (obj, visited = new WeakSet()) => {
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
          result[key] = sanitizeValue(value, visited);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    };

    return sanitizeValue(sanitized);
  }

  // Sanitize database queries
  sanitizeQuery(query) {
    if (typeof query !== 'string') return query;
    
    // Remove potential sensitive data from queries
    return query.replace(/(\$set\s*:\s*\{[^}]*)(password|token|secret)(\s*:\s*['"][^'"]*['"])/gi, '$1$2: "[REDACTED]"');
  }

  // Child logger with additional context
  child(context) {
    return {
      info: (message, meta = {}) => this.info(message, { ...context, ...meta }),
      error: (message, meta = {}) => this.error(message, { ...context, ...meta }),
      warn: (message, meta = {}) => this.warn(message, { ...context, ...meta }),
      debug: (message, meta = {}) => this.debug(message, { ...context, ...meta }),
      http: (message, meta = {}) => this.http(message, { ...context, ...meta })
    };
  }
}

const enhancedLogger = new EnhancedLogger(logger);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  enhancedLogger.info('Received SIGTERM, shutting down gracefully');
  logger.end();
});

process.on('SIGINT', () => {
  enhancedLogger.info('Received SIGINT, shutting down gracefully');
  logger.end();
});

export default enhancedLogger;