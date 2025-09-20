import cacheService from '../services/cacheService.js';
import logger from '../utils/logger.js';

// Cache middleware factory
export const createCacheMiddleware = (options = {}) => {
  const {
    ttl = 3600, // Default 1 hour
    keyGenerator = null,
    condition = null, // Function to determine if request should be cached
    invalidatePatterns = [] // Patterns to invalidate after cache miss
  } = options;

  return async (req, res, next) => {
    // Skip caching if condition is not met
    if (condition && !condition(req)) {
      return next();
    }

    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching if user is authenticated (for sensitive data)
    if (req.user && req.user.role === 'admin') {
      return next();
    }

    const cacheKey = keyGenerator ? keyGenerator(req) : generateCacheKey(req);
    
    try {
      // Try to get from cache
      const cachedData = await cacheService.get(cacheKey);
      
      if (cachedData) {
        logger.info(`Cache hit for ${req.originalUrl}`);
        return res.json(cachedData);
      }

      logger.info(`Cache miss for ${req.originalUrl}`);

      // Store original response methods
      const originalJson = res.json;
      const originalSend = res.send;

      // Override response methods to cache the response
      res.json = function(data) {
        cacheService.set(cacheKey, data, ttl);
        return originalJson.call(this, data);
      };

      res.send = function(data) {
        if (typeof data === 'object') {
          cacheService.set(cacheKey, data, ttl);
        }
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

// Generate cache key based on request
const generateCacheKey = (req) => {
  const baseKey = `api:${req.method}:${req.originalUrl}`;
  
  // Include query parameters
  const queryString = Object.keys(req.query)
    .sort()
    .map(key => `${key}=${req.query[key]}`)
    .join('&');
  
  // Include user context if available
  const userContext = req.user ? `:user:${req.user._id}` : '';
  
  return `${baseKey}${queryString ? `:${queryString}` : ''}${userContext}`;
};

// Cache invalidation middleware
export const createCacheInvalidationMiddleware = (patterns = []) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    const originalSend = res.send;

    res.json = async function(data) {
      try {
        // Invalidate cache patterns
        for (const pattern of patterns) {
          await cacheService.delPattern(pattern);
        }
        logger.info(`Invalidated cache patterns: ${patterns.join(', ')}`);
      } catch (error) {
        logger.error('Cache invalidation error:', error);
      }
      
      return originalJson.call(this, data);
    };

    res.send = async function(data) {
      try {
        // Invalidate cache patterns
        for (const pattern of patterns) {
          await cacheService.delPattern(pattern);
        }
        logger.info(`Invalidated cache patterns: ${patterns.join(', ')}`);
      } catch (error) {
        logger.error('Cache invalidation error:', error);
      }
      
      return originalSend.call(this, data);
    };

    next();
  };
};

// Specific cache middlewares for different routes
export const userCacheMiddleware = createCacheMiddleware({
  ttl: 1800, // 30 minutes
  keyGenerator: (req) => `user:${req.params.id || req.user?._id}`,
  condition: (req) => req.method === 'GET'
});

export const bookingCacheMiddleware = createCacheMiddleware({
  ttl: 900, // 15 minutes
  keyGenerator: (req) => `booking:${req.params.id || 'list'}`,
  condition: (req) => req.method === 'GET'
});

export const hotelCacheMiddleware = createCacheMiddleware({
  ttl: 7200, // 2 hours
  keyGenerator: (req) => `hotel:${req.params.id || 'list'}`,
  condition: (req) => req.method === 'GET'
});

export const dashboardCacheMiddleware = createCacheMiddleware({
  ttl: 300, // 5 minutes
  keyGenerator: (req) => `dashboard:${req.user?.hotelId}:${req.query.period || 'default'}`,
  condition: (req) => req.method === 'GET' && req.user
});

export const analyticsCacheMiddleware = createCacheMiddleware({
  ttl: 600, // 10 minutes
  keyGenerator: (req) => `analytics:${req.user?.hotelId}:${req.query.type || 'default'}`,
  condition: (req) => req.method === 'GET' && req.user
});

// Cache invalidation middlewares
export const bookingInvalidationMiddleware = createCacheInvalidationMiddleware([
  'booking:*',
  'dashboard:*',
  'analytics:*'
]);

export const userInvalidationMiddleware = createCacheInvalidationMiddleware([
  'user:*',
  'booking:user:*'
]);

export const hotelInvalidationMiddleware = createCacheInvalidationMiddleware([
  'hotel:*',
  'room:*',
  'dashboard:*',
  'analytics:*'
]);

// Cache warming middleware
export const cacheWarmingMiddleware = (routes = []) => {
  return async (req, res, next) => {
    // This middleware can be used to warm up cache for frequently accessed routes
    if (routes.includes(req.path)) {
      try {
        // Pre-fetch and cache data for common queries
        await warmCacheForRoute(req.path, req.user);
      } catch (error) {
        logger.error('Cache warming error:', error);
      }
    }
    next();
  };
};

// Cache warming function
const warmCacheForRoute = async (route, user) => {
  // Implement cache warming logic based on route
  switch (route) {
    case '/api/v1/dashboard':
      if (user?.hotelId) {
        // Warm dashboard cache
        const cacheKey = `dashboard:${user.hotelId}:default`;
        // You could pre-fetch dashboard data here
        logger.info(`Warming cache for dashboard: ${cacheKey}`);
      }
      break;
    case '/api/v1/analytics':
      if (user?.hotelId) {
        // Warm analytics cache
        const cacheKey = `analytics:${user.hotelId}:default`;
        logger.info(`Warming cache for analytics: ${cacheKey}`);
      }
      break;
    default:
      break;
  }
};

// Cache statistics middleware
export const cacheStatsMiddleware = async (req, res, next) => {
  if (req.path === '/api/v1/cache/stats' && req.method === 'GET') {
    try {
      const stats = await cacheService.getStats();
      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Cache stats error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get cache statistics'
      });
    }
  }
  next();
};

// Cache health check middleware
export const cacheHealthMiddleware = async (req, res, next) => {
  if (req.path === '/api/v1/cache/health' && req.method === 'GET') {
    try {
      const health = await cacheService.healthCheck();
      return res.json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Cache health check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check cache health'
      });
    }
  }
  next();
};
