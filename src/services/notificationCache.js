import Redis from 'ioredis';
import NotificationTemplate from '../models/NotificationTemplate.js';
import NotificationPreference from '../models/NotificationPreference.js';
import User from '../models/User.js';

// Enhanced Redis configuration for development and production
const getRedisOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    retryDelayOnFailover: isProduction ? 200 : 100,
    enableOfflineQueue: true,
    maxRetriesPerRequest: isProduction ? 3 : 1,
    lazyConnect: true,
    connectTimeout: isProduction ? 10000 : 5000,
    retryConnect: isProduction,
    // Production-specific settings
    ...(isProduction && {
      keepAlive: 30000,
      family: 4, // Use IPv4
      keyPrefix: `pentouz:${process.env.APP_ENV || 'prod'}:`,
      enableAutoPipelining: true,
      // TLS support for cloud Redis services
      ...(process.env.REDIS_TLS === 'true' && {
        tls: {
          rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false'
        }
      })
    })
  };
};

// Initialize Redis client - IORedis takes URL as first parameter, options as second
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, getRedisOptions());

// Handle Redis connection errors gracefully
redis.on('error', (error) => {
  // Suppress flood of connection errors but log once
  if (!redis.errorLogged) {
    console.warn('⚠️  Redis connection failed - using fallback cache. Error:', error.message);
    redis.errorLogged = true;
  }
});

redis.on('connect', () => {
  console.log('✅ Redis cache connected successfully');
  redis.errorLogged = false;
});

redis.on('ready', () => {
  console.log('✅ Redis cache ready');
});

// Cache key patterns
const CACHE_KEYS = {
  TEMPLATE: (hotelId, templateId) => `template:${hotelId}:${templateId}`,
  TEMPLATE_BY_TYPE: (hotelId, type) => `template:${hotelId}:type:${type}`,
  TEMPLATES_BY_CATEGORY: (hotelId, category) => `templates:${hotelId}:category:${category}`,
  USER_PREFERENCES: (userId) => `preferences:${userId}`,
  USER_PROFILE: (userId) => `user:${userId}`,
  NOTIFICATION_COUNT: (userId) => `count:${userId}`,
  HOTEL_SETTINGS: (hotelId) => `hotel:${hotelId}:settings`,
  ROUTING_RULES: (hotelId) => `routing:${hotelId}`,
  TEMPLATE_STATS: (hotelId) => `stats:${hotelId}:templates`
};

// Cache TTL (Time To Live) in seconds
const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400 // 24 hours
};

class NotificationCache {
  constructor() {
    this.redis = redis;
    this.connected = false;
    this.initialize();
  }

  async initialize() {
    try {
      await this.redis.ping();
      this.connected = true;
      console.log('✅ Redis cache connected successfully');
    } catch (error) {
      console.warn('⚠️  Redis cache connection failed, falling back to memory cache:', error.message);
      this.connected = false;
    }
  }

  // Generic cache methods
  async get(key) {
    if (!this.connected) return null;

    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = CACHE_TTL.MEDIUM) {
    if (!this.connected) return false;

    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.connected) return false;

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async invalidatePattern(pattern) {
    if (!this.connected) return false;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Cache pattern invalidation error:', error);
      return false;
    }
  }

  // Template caching methods
  async getTemplate(hotelId, templateId) {
    const cacheKey = CACHE_KEYS.TEMPLATE(hotelId, templateId);
    let template = await this.get(cacheKey);

    if (!template) {
      template = await NotificationTemplate.findOne({
        _id: templateId,
        hotelId,
        'metadata.isActive': true
      }).lean();

      if (template) {
        await this.set(cacheKey, template, CACHE_TTL.LONG);
      }
    }

    return template;
  }

  async getTemplateByType(hotelId, type) {
    const cacheKey = CACHE_KEYS.TEMPLATE_BY_TYPE(hotelId, type);
    let template = await this.get(cacheKey);

    if (!template) {
      template = await NotificationTemplate.getByType(hotelId, type);

      if (template) {
        await this.set(cacheKey, template, CACHE_TTL.LONG);
      }
    }

    return template;
  }

  async getTemplatesByCategory(hotelId, category) {
    const cacheKey = CACHE_KEYS.TEMPLATES_BY_CATEGORY(hotelId, category);
    let templates = await this.get(cacheKey);

    if (!templates) {
      templates = await NotificationTemplate.getByCategory(hotelId, category);

      if (templates) {
        await this.set(cacheKey, templates, CACHE_TTL.MEDIUM);
      }
    }

    return templates || [];
  }

  async invalidateTemplateCache(hotelId, templateId = null) {
    if (templateId) {
      await this.del(CACHE_KEYS.TEMPLATE(hotelId, templateId));
    }

    // Invalidate all template-related caches for the hotel
    await this.invalidatePattern(`template:${hotelId}:*`);
    await this.invalidatePattern(`templates:${hotelId}:*`);
    await this.del(CACHE_KEYS.TEMPLATE_STATS(hotelId));
  }

  // User preference caching
  async getUserPreferences(userId) {
    const cacheKey = CACHE_KEYS.USER_PREFERENCES(userId);
    let preferences = await this.get(cacheKey);

    if (!preferences) {
      preferences = await NotificationPreference.findOne({ userId }).lean();

      if (preferences) {
        await this.set(cacheKey, preferences, CACHE_TTL.MEDIUM);
      }
    }

    return preferences;
  }

  async invalidateUserPreferences(userId) {
    await this.del(CACHE_KEYS.USER_PREFERENCES(userId));
  }

  // User profile caching
  async getUserProfile(userId) {
    const cacheKey = CACHE_KEYS.USER_PROFILE(userId);
    let user = await this.get(cacheKey);

    if (!user) {
      user = await User.findById(userId)
        .select('firstName lastName email role hotelId department isActive')
        .lean();

      if (user) {
        await this.set(cacheKey, user, CACHE_TTL.LONG);
      }
    }

    return user;
  }

  async invalidateUserProfile(userId) {
    await this.del(CACHE_KEYS.USER_PROFILE(userId));
  }

  // Notification count caching
  async getNotificationCount(userId) {
    const cacheKey = CACHE_KEYS.NOTIFICATION_COUNT(userId);
    return await this.get(cacheKey);
  }

  async setNotificationCount(userId, count) {
    const cacheKey = CACHE_KEYS.NOTIFICATION_COUNT(userId);
    await this.set(cacheKey, count, CACHE_TTL.SHORT);
  }

  async incrementNotificationCount(userId) {
    if (!this.connected) return;

    try {
      const cacheKey = CACHE_KEYS.NOTIFICATION_COUNT(userId);
      const current = await this.redis.get(cacheKey);
      const count = current ? parseInt(current) + 1 : 1;
      await this.redis.setex(cacheKey, CACHE_TTL.SHORT, count);
    } catch (error) {
      console.error('Error incrementing notification count:', error);
    }
  }

  async invalidateNotificationCount(userId) {
    await this.del(CACHE_KEYS.NOTIFICATION_COUNT(userId));
  }

  // Hotel settings caching
  async getHotelSettings(hotelId) {
    const cacheKey = CACHE_KEYS.HOTEL_SETTINGS(hotelId);
    let settings = await this.get(cacheKey);

    if (!settings) {
      // Fetch from database - this would be your hotel settings model
      // For now, return default settings
      settings = {
        timezone: 'UTC',
        quietHours: { start: 22, end: 7 },
        defaultLanguage: 'en',
        maxNotificationsPerHour: 50
      };

      await this.set(cacheKey, settings, CACHE_TTL.VERY_LONG);
    }

    return settings;
  }

  async invalidateHotelSettings(hotelId) {
    await this.del(CACHE_KEYS.HOTEL_SETTINGS(hotelId));
  }

  // Routing rules caching
  async getRoutingRules(hotelId) {
    const cacheKey = CACHE_KEYS.ROUTING_RULES(hotelId);
    return await this.get(cacheKey);
  }

  async setRoutingRules(hotelId, rules) {
    const cacheKey = CACHE_KEYS.ROUTING_RULES(hotelId);
    await this.set(cacheKey, rules, CACHE_TTL.LONG);
  }

  async invalidateRoutingRules(hotelId) {
    await this.del(CACHE_KEYS.ROUTING_RULES(hotelId));
  }

  // Template statistics caching
  async getTemplateStats(hotelId) {
    const cacheKey = CACHE_KEYS.TEMPLATE_STATS(hotelId);
    let stats = await this.get(cacheKey);

    if (!stats) {
      stats = await NotificationTemplate.getPerformanceStats(hotelId);

      if (stats) {
        await this.set(cacheKey, stats, CACHE_TTL.MEDIUM);
      }
    }

    return stats || [];
  }

  async invalidateTemplateStats(hotelId) {
    await this.del(CACHE_KEYS.TEMPLATE_STATS(hotelId));
  }

  // Batch operations for better performance
  async getMultipleTemplates(hotelId, templateIds) {
    const keys = templateIds.map(id => CACHE_KEYS.TEMPLATE(hotelId, id));
    const cached = await this.getMultiple(keys);

    const missing = [];
    const results = {};

    templateIds.forEach((id, index) => {
      if (cached[index]) {
        results[id] = cached[index];
      } else {
        missing.push(id);
      }
    });

    // Fetch missing templates from database
    if (missing.length > 0) {
      const templates = await NotificationTemplate.find({
        _id: { $in: missing },
        hotelId,
        'metadata.isActive': true
      }).lean();

      // Cache the fetched templates
      const cachePromises = templates.map(template => {
        results[template._id.toString()] = template;
        return this.set(
          CACHE_KEYS.TEMPLATE(hotelId, template._id),
          template,
          CACHE_TTL.LONG
        );
      });

      await Promise.all(cachePromises);
    }

    return results;
  }

  async getMultiple(keys) {
    if (!this.connected || keys.length === 0) return [];

    try {
      const values = await this.redis.mget(...keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error('Cache mget error:', error);
      return new Array(keys.length).fill(null);
    }
  }

  // Health check and monitoring
  async getHealthStatus() {
    if (!this.connected) {
      return { status: 'disconnected', connected: false };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      const info = await this.redis.info('memory');
      const memory = this.parseRedisInfo(info);

      return {
        status: 'healthy',
        connected: true,
        latency,
        memory: {
          used: memory.used_memory_human,
          peak: memory.used_memory_peak_human,
          keys: await this.redis.dbsize()
        }
      };
    } catch (error) {
      return {
        status: 'error',
        connected: false,
        error: error.message
      };
    }
  }

  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const result = {};

    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    });

    return result;
  }

  // Cleanup and maintenance
  async cleanup() {
    if (!this.connected) return;

    try {
      // Clean up expired notification counts (they should auto-expire, but just in case)
      const countKeys = await this.redis.keys('count:*');
      if (countKeys.length > 1000) { // Cleanup if too many keys
        await this.redis.del(...countKeys.slice(0, 500));
      }

      console.log('Cache cleanup completed');
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  // Graceful shutdown
  async disconnect() {
    if (this.redis) {
      await this.redis.disconnect();
      console.log('Redis cache disconnected');
    }
  }
}

// Create singleton instance
const notificationCache = new NotificationCache();

// Cleanup on process exit
process.on('SIGINT', () => {
  notificationCache.disconnect();
});

process.on('SIGTERM', () => {
  notificationCache.disconnect();
});

export default notificationCache;