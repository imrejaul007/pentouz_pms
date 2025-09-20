import logger from '../utils/logger.js';
import otaPayloadService from '../services/otaPayloadService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Comprehensive API logging middleware that captures all request/response data
 */
export const comprehensiveAPILogger = (options = {}) => {
  const {
    logPayloads = true,
    maxPayloadSize = 1024 * 1024, // 1MB limit
    excludePaths = ['/health', '/metrics'],
    logLevel = 'info',
    storeOTAPayloads = true
  } = options;

  return (req, res, next) => {
    const startTime = Date.now();
    const requestId = uuidv4();
    const correlationId = req.headers['x-correlation-id'] || otaPayloadService.generateCorrelationId();

    // Add correlation ID to request for downstream use
    req.correlationId = correlationId;
    req.requestId = requestId;

    // Skip logging for excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Capture request data
    const requestData = {
      id: requestId,
      correlationId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      path: req.path,
      query: req.query,
      params: req.params,
      headers: sanitizeHeaders(req.headers),
      ip: getClientIP(req),
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      authenticated: !!req.user,
      userId: req.user?.id,
      userRole: req.user?.role
    };

    // Capture request body if present and under size limit
    let requestBody = null;
    if (logPayloads && req.body) {
      const bodySize = Buffer.byteLength(JSON.stringify(req.body));
      if (bodySize <= maxPayloadSize) {
        requestBody = req.body;
        requestData.bodySize = bodySize;
      } else {
        requestData.bodyTruncated = true;
        requestData.bodySize = bodySize;
      }
    }

    // Store original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    let responseBody = null;
    let responseSent = false;

    // Override response methods to capture response data
    res.send = function(body) {
      if (!responseSent) {
        captureResponse(body, 'send');
      }
      return originalSend.call(this, body);
    };

    res.json = function(body) {
      if (!responseSent) {
        captureResponse(body, 'json');
      }
      return originalJson.call(this, body);
    };

    res.end = function(chunk, encoding) {
      if (!responseSent) {
        captureResponse(chunk, 'end', encoding);
      }
      return originalEnd.call(this, chunk, encoding);
    };

    function captureResponse(body, method, encoding) {
      if (responseSent) return;
      responseSent = true;

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Capture response body if under size limit
      if (logPayloads && body) {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        const bodySize = Buffer.byteLength(bodyStr);
        
        if (bodySize <= maxPayloadSize) {
          responseBody = method === 'json' ? body : bodyStr;
        }
      }

      const responseData = {
        requestId,
        correlationId,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: sanitizeHeaders(res.getHeaders()),
        duration,
        responseSize: responseBody ? Buffer.byteLength(JSON.stringify(responseBody)) : 0,
        method: method,
        encoding
      };

      // Log the complete request/response cycle
      logRequestResponse(requestData, responseData, requestBody, responseBody, duration);

      // Store OTA payloads if this is an OTA-related endpoint
      if (storeOTAPayloads && isOTAEndpoint(req)) {
        storeOTAPayload(req, requestBody, responseData, responseBody).catch(error => {
          logger.error('Failed to store OTA payload:', error);
        });
      }
    }

    next();
  };
};

/**
 * Enhanced request logger that captures full request/response cycles
 */
function logRequestResponse(requestData, responseData, requestBody, responseBody, duration) {
  const logData = {
    request: {
      ...requestData,
      body: requestBody
    },
    response: {
      ...responseData,
      body: responseBody
    },
    performance: {
      duration: `${duration}ms`,
      slow: duration > 1000 // Flag slow requests
    }
  };

  // Determine log level based on response status
  if (responseData.statusCode >= 500) {
    logger.error('API Request/Response - Server Error', logData);
  } else if (responseData.statusCode >= 400) {
    logger.warn('API Request/Response - Client Error', logData);
  } else if (duration > 5000) {
    logger.warn('API Request/Response - Slow Response', logData);
  } else {
    logger.info('API Request/Response', logData);
  }
}

/**
 * Store OTA payload data
 */
async function storeOTAPayload(req, requestBody, responseData, responseBody) {
  try {
    // Determine if this is an inbound or outbound OTA call
    const isWebhook = req.path.includes('webhook') || req.path.includes('/ota');
    const isOutbound = req.path.includes('sync') || req.path.includes('channel');

    const metadata = {
      correlationId: req.correlationId,
      traceId: req.headers['x-trace-id'],
      channel: detectOTAChannel(req),
      operation: detectOTAOperation(req, requestBody),
      priority: responseData.statusCode >= 400 ? 'high' : 'medium'
    };

    if (isWebhook) {
      // Store inbound webhook payload
      await otaPayloadService.storeInboundPayload(req, requestBody, metadata);
    } else if (isOutbound) {
      // Store outbound API call payload
      const requestData = {
        url: req.originalUrl,
        method: req.method,
        headers: req.headers,
        payload: requestBody
      };

      const responseDataForStorage = {
        status: responseData.statusCode,
        headers: responseData.headers,
        data: responseBody
      };

      await otaPayloadService.storeOutboundPayload(requestData, responseDataForStorage, {
        ...metadata,
        responseTime: responseData.duration
      });
    }
  } catch (error) {
    logger.error('Failed to store OTA payload in middleware:', error);
  }
}

/**
 * Detect if this is an OTA-related endpoint
 */
function isOTAEndpoint(req) {
  const otaPathPatterns = [
    '/api/v1/ota',
    '/api/v1/channels',
    '/api/v1/webhooks',
    '/api/v1/external',
    '/api/v1/ota-amendments',
    'booking.com',
    'expedia',
    'airbnb',
    'agoda'
  ];

  return otaPathPatterns.some(pattern => 
    req.path.toLowerCase().includes(pattern.toLowerCase()) ||
    req.headers['user-agent']?.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Detect OTA channel from request
 */
function detectOTAChannel(req) {
  const userAgent = req.headers['user-agent']?.toLowerCase() || '';
  const path = req.path.toLowerCase();
  const origin = req.headers['origin']?.toLowerCase() || '';

  if (userAgent.includes('booking') || path.includes('booking') || origin.includes('booking')) {
    return 'booking_com';
  }
  if (userAgent.includes('expedia') || path.includes('expedia') || origin.includes('expedia')) {
    return 'expedia';
  }
  if (userAgent.includes('airbnb') || path.includes('airbnb') || origin.includes('airbnb')) {
    return 'airbnb';
  }
  if (userAgent.includes('agoda') || path.includes('agoda') || origin.includes('agoda')) {
    return 'agoda';
  }

  return 'other';
}

/**
 * Detect OTA operation type
 */
function detectOTAOperation(req, payload) {
  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();

  // Webhook operations
  if (path.includes('webhook')) {
    if (payload?.event_type) {
      return `webhook_${payload.event_type}`;
    }
    return 'webhook_notification';
  }

  // Amendment operations
  if (path.includes('amendment')) {
    if (method === 'POST' && path.includes('approve')) return 'amendment_approval';
    if (method === 'POST' && path.includes('reject')) return 'amendment_rejection';
    return 'amendment_request';
  }

  // Booking operations
  if (path.includes('booking')) {
    if (method === 'POST') return 'booking_create';
    if (method === 'PUT' || method === 'PATCH') return 'booking_update';
    if (method === 'DELETE') return 'booking_cancel';
    return 'booking_sync';
  }

  // Inventory operations
  if (path.includes('availability') || path.includes('inventory')) {
    return 'availability_update';
  }

  // Rate operations
  if (path.includes('rate') || path.includes('pricing')) {
    return 'rate_update';
  }

  return 'unknown';
}

/**
 * Sanitize headers (remove sensitive information)
 */
function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  
  const sensitiveHeaders = [
    'authorization',
    'x-api-key',
    'x-secret',
    'cookie',
    'set-cookie'
  ];

  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Get client IP address
 */
function getClientIP(req) {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         'unknown';
}

/**
 * Outbound API call logger for HTTP clients
 */
export class OutboundAPILogger {
  constructor(options = {}) {
    this.options = {
      logPayloads: true,
      maxPayloadSize: 1024 * 1024, // 1MB
      storeOTAPayloads: true,
      ...options
    };
  }

  /**
   * Log outbound HTTP request
   */
  async logRequest(requestConfig, metadata = {}) {
    const startTime = Date.now();
    const requestId = uuidv4();
    const correlationId = metadata.correlationId || otaPayloadService.generateCorrelationId();

    const requestData = {
      id: requestId,
      correlationId,
      timestamp: new Date().toISOString(),
      method: requestConfig.method?.toUpperCase() || 'GET',
      url: requestConfig.url,
      headers: sanitizeHeaders(requestConfig.headers || {}),
      timeout: requestConfig.timeout,
      metadata
    };

    // Log payload if enabled
    if (this.options.logPayloads && requestConfig.data) {
      const payloadSize = Buffer.byteLength(JSON.stringify(requestConfig.data));
      if (payloadSize <= this.options.maxPayloadSize) {
        requestData.payload = requestConfig.data;
      }
      requestData.payloadSize = payloadSize;
    }

    logger.info('Outbound API Request', requestData);

    return {
      requestId,
      correlationId,
      startTime,
      requestData
    };
  }

  /**
   * Log outbound HTTP response
   */
  async logResponse(responseData, requestContext) {
    const endTime = Date.now();
    const duration = endTime - requestContext.startTime;

    const logData = {
      requestId: requestContext.requestId,
      correlationId: requestContext.correlationId,
      statusCode: responseData.status,
      statusText: responseData.statusText,
      headers: sanitizeHeaders(responseData.headers || {}),
      duration: `${duration}ms`,
      responseSize: responseData.data ? Buffer.byteLength(JSON.stringify(responseData.data)) : 0
    };

    // Log response payload if enabled
    if (this.options.logPayloads && responseData.data) {
      const payloadSize = Buffer.byteLength(JSON.stringify(responseData.data));
      if (payloadSize <= this.options.maxPayloadSize) {
        logData.response = responseData.data;
      }
    }

    // Determine log level
    if (responseData.status >= 500) {
      logger.error('Outbound API Response - Server Error', logData);
    } else if (responseData.status >= 400) {
      logger.warn('Outbound API Response - Client Error', logData);
    } else {
      logger.info('Outbound API Response', logData);
    }

    // Store OTA payload if applicable
    if (this.options.storeOTAPayloads && this.isOTACall(requestContext.requestData.url)) {
      try {
        await otaPayloadService.storeOutboundPayload(
          {
            url: requestContext.requestData.url,
            method: requestContext.requestData.method,
            headers: requestContext.requestData.headers,
            payload: requestContext.requestData.payload
          },
          {
            status: responseData.status,
            headers: responseData.headers,
            data: responseData.data
          },
          {
            correlationId: requestContext.correlationId,
            responseTime: duration,
            ...requestContext.requestData.metadata
          }
        );
      } catch (error) {
        logger.error('Failed to store outbound OTA payload:', error);
      }
    }

    return logData;
  }

  /**
   * Check if this is an OTA API call
   */
  isOTACall(url) {
    const otaDomains = [
      'booking.com',
      'expedia.com',
      'airbnb.com',
      'agoda.com',
      'hotels.com'
    ];

    return otaDomains.some(domain => url.toLowerCase().includes(domain));
  }

  /**
   * Log HTTP error
   */
  logError(error, requestContext) {
    const duration = Date.now() - requestContext.startTime;

    const errorData = {
      requestId: requestContext.requestId,
      correlationId: requestContext.correlationId,
      error: {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText
      },
      duration: `${duration}ms`,
      url: requestContext.requestData.url,
      method: requestContext.requestData.method
    };

    logger.error('Outbound API Request Failed', errorData);
    return errorData;
  }
}

/**
 * HTTP client wrapper with automatic logging
 */
export function createLoggedHTTPClient(httpClient, options = {}) {
  const outboundLogger = new OutboundAPILogger(options);

  // Wrap request method
  const originalRequest = httpClient.request || httpClient;

  return async function loggedRequest(config) {
    const requestContext = await outboundLogger.logRequest(config);

    try {
      const response = await originalRequest(config);
      await outboundLogger.logResponse(response, requestContext);
      return response;
    } catch (error) {
      outboundLogger.logError(error, requestContext);
      throw error;
    }
  };
}

export default comprehensiveAPILogger;
