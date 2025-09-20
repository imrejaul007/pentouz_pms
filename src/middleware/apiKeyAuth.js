import APIKey from '../models/APIKey.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';

/**
 * API Key Authentication Middleware
 * Authenticates requests using API keys instead of JWT tokens
 */
export const authenticateAPIKey = catchAsync(async (req, res, next) => {
  let apiKey;
  
  // Extract API key from various sources
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    apiKey = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-api-key']) {
    apiKey = req.headers['x-api-key'];
  } else if (req.query.api_key) {
    apiKey = req.query.api_key;
  }
  
  if (!apiKey) {
    return next(new ApplicationError('API key is required. Provide it in Authorization header, x-api-key header, or api_key query parameter.', 401));
  }
  
  // Verify API key
  const validKey = await APIKey.verifyKey(apiKey);
  if (!validKey) {
    logger.warn('Invalid API key attempt', { 
      apiKey: apiKey.substring(0, 10) + '...', 
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    return next(new ApplicationError('Invalid or expired API key', 401));
  }
  
  // Check IP restrictions
  if (validKey.allowedIPs && validKey.allowedIPs.length > 0) {
    const clientIP = req.ip || req.connection.remoteAddress;
    const isAllowed = validKey.allowedIPs.includes('*') || 
                     validKey.allowedIPs.includes(clientIP);
    
    if (!isAllowed) {
      logger.warn('API key used from unauthorized IP', {
        keyId: validKey.keyId.substring(0, 10) + '...',
        clientIP,
        allowedIPs: validKey.allowedIPs
      });
      return next(new ApplicationError('API key not authorized for this IP address', 403));
    }
  }
  
  // Check domain restrictions
  if (validKey.allowedDomains && validKey.allowedDomains.length > 0) {
    const origin = req.headers.origin || req.headers.referer;
    if (origin) {
      const domain = new URL(origin).hostname;
      const isAllowed = validKey.allowedDomains.includes('*') ||
                       validKey.allowedDomains.some(allowed => domain.endsWith(allowed));
      
      if (!isAllowed) {
        logger.warn('API key used from unauthorized domain', {
          keyId: validKey.keyId.substring(0, 10) + '...',
          domain,
          allowedDomains: validKey.allowedDomains
        });
        return next(new ApplicationError('API key not authorized for this domain', 403));
      }
    }
  }
  
  // Check rate limits
  const rateLimitCheck = validKey.checkRateLimit();
  if (!rateLimitCheck.allowed) {
    const resetTime = Math.ceil((rateLimitCheck.resetTime - new Date()) / 1000);
    res.set('X-RateLimit-Limit', validKey.rateLimit[`requestsPer${rateLimitCheck.limit.charAt(0).toUpperCase() + rateLimitCheck.limit.slice(1)}`]);
    res.set('X-RateLimit-Reset', rateLimitCheck.resetTime.toISOString());
    res.set('Retry-After', resetTime);
    
    return next(new ApplicationError(`Rate limit exceeded. Try again in ${resetTime} seconds.`, 429));
  }
  
  // Record usage (async, don't wait)
  validKey.recordUsage(req).catch(error => {
    logger.error('Failed to record API key usage', error);
  });
  
  // Attach API key info to request
  req.apiKey = validKey;
  req.user = {
    id: validKey._id,
    type: 'api_key',
    permissions: validKey.permissions,
    hotelId: validKey.hotelId,
    role: validKey.type
  };
  
  logger.info('API key authenticated successfully', {
    keyId: validKey.keyId.substring(0, 10) + '...',
    keyName: validKey.name,
    keyType: validKey.type,
    hotelId: validKey.hotelId
  });
  
  next();
});

/**
 * Check API key permissions for specific resource and action
 */
export const requirePermission = (resource, action = 'read') => {
  return catchAsync(async (req, res, next) => {
    if (!req.apiKey) {
      return next(new ApplicationError('API key authentication required', 401));
    }
    
    const { permissions, type } = req.apiKey;
    
    // Admin keys have all permissions
    if (type === 'admin') {
      return next();
    }
    
    // Check if permission exists
    const hasPermission = permissions.some(perm => 
      perm.resource === resource && perm.actions.includes(action)
    );
    
    // Write keys can read everything they can write
    if (!hasPermission && type === 'write' && action === 'read') {
      const hasWritePermission = permissions.some(perm =>
        perm.resource === resource && perm.actions.includes('write')
      );
      if (hasWritePermission) {
        return next();
      }
    }
    
    if (!hasPermission) {
      logger.warn('API key permission denied', {
        keyId: req.apiKey.keyId.substring(0, 10) + '...',
        resource,
        action,
        permissions
      });
      return next(new ApplicationError(`Insufficient permissions. Required: ${action} on ${resource}`, 403));
    }
    
    next();
  });
};

/**
 * Hybrid authentication - supports both JWT and API keys
 */
export const hybridAuth = catchAsync(async (req, res, next) => {
  // Check for API key first
  const hasAPIKey = req.headers.authorization?.startsWith('Bearer ') && 
                   req.headers.authorization.split(' ')[1].startsWith('ak_') ||
                   req.headers.authorization.split(' ')[1].startsWith('wk_') ||
                   req.headers.authorization.split(' ')[1].startsWith('rk_') ||
                   req.headers['x-api-key'] ||
                   req.query.api_key;
  
  if (hasAPIKey) {
    return authenticateAPIKey(req, res, next);
  }
  
  // Fall back to JWT authentication
  const { authenticate } = await import('./auth.js');
  return authenticate(req, res, next);
});

/**
 * API Key rate limiting middleware
 */
export const apiKeyRateLimit = catchAsync(async (req, res, next) => {
  if (!req.apiKey) {
    return next();
  }
  
  // Set rate limit headers
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dailyUsage = req.apiKey.rateLimitUsage.today.date && 
                    req.apiKey.rateLimitUsage.today.date.getTime() === today.getTime() 
                    ? req.apiKey.rateLimitUsage.today.requests : 0;
  
  res.set('X-RateLimit-Limit-Day', req.apiKey.rateLimit.requestsPerDay);
  res.set('X-RateLimit-Remaining-Day', Math.max(0, req.apiKey.rateLimit.requestsPerDay - dailyUsage));
  res.set('X-RateLimit-Reset-Day', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());
  
  next();
});

export default {
  authenticateAPIKey,
  requirePermission,
  hybridAuth,
  apiKeyRateLimit
};
