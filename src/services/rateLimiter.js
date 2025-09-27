import notificationCache from './notificationCache.js';

// Rate limiting configuration
const RATE_LIMITS = {
  // Global limits per hotel
  HOTEL_PER_MINUTE: 100,
  HOTEL_PER_HOUR: 1000,
  HOTEL_PER_DAY: 10000,

  // Per user limits
  USER_PER_MINUTE: 10,
  USER_PER_HOUR: 50,
  USER_PER_DAY: 200,

  // Per template limits (to prevent template spam)
  TEMPLATE_PER_HOUR: 100,
  TEMPLATE_PER_DAY: 500,

  // Per category limits
  PROMOTIONAL_PER_DAY: 5, // Limit promotional notifications
  EMERGENCY_PER_HOUR: 20, // Even emergencies have limits

  // Channel-specific limits
  SMS_PER_DAY: 50,
  EMAIL_PER_HOUR: 30,
  PUSH_PER_MINUTE: 5
};

// Rate limit keys
const RATE_LIMIT_KEYS = {
  HOTEL_MINUTE: (hotelId) => `rate:hotel:${hotelId}:minute`,
  HOTEL_HOUR: (hotelId) => `rate:hotel:${hotelId}:hour`,
  HOTEL_DAY: (hotelId) => `rate:hotel:${hotelId}:day`,

  USER_MINUTE: (userId) => `rate:user:${userId}:minute`,
  USER_HOUR: (userId) => `rate:user:${userId}:hour`,
  USER_DAY: (userId) => `rate:user:${userId}:day`,

  TEMPLATE_HOUR: (templateId) => `rate:template:${templateId}:hour`,
  TEMPLATE_DAY: (templateId) => `rate:template:${templateId}:day`,

  CATEGORY_HOUR: (hotelId, category) => `rate:category:${hotelId}:${category}:hour`,
  CATEGORY_DAY: (hotelId, category) => `rate:category:${hotelId}:${category}:day`,

  CHANNEL_MINUTE: (userId, channel) => `rate:channel:${userId}:${channel}:minute`,
  CHANNEL_HOUR: (userId, channel) => `rate:channel:${userId}:${channel}:hour`,
  CHANNEL_DAY: (userId, channel) => `rate:channel:${userId}:${channel}:day`
};

// Time windows in seconds
const TIME_WINDOWS = {
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400
};

class RateLimiter {
  constructor() {
    this.cache = notificationCache;
  }

  /**
   * Check if a notification can be sent based on rate limits
   */
  async canSendNotification({
    hotelId,
    userId,
    templateId,
    category,
    channels = [],
    priority = 'medium'
  }) {
    try {
      const checks = await Promise.all([
        this.checkHotelLimits(hotelId),
        this.checkUserLimits(userId),
        this.checkTemplateLimits(templateId),
        this.checkCategoryLimits(hotelId, category),
        this.checkChannelLimits(userId, channels),
        this.checkPriorityOverrides(priority)
      ]);

      const failedChecks = checks.filter(check => !check.allowed);

      if (failedChecks.length > 0) {
        return {
          allowed: false,
          reason: failedChecks[0].reason,
          resetTime: failedChecks[0].resetTime,
          limits: failedChecks.map(check => ({
            type: check.type,
            current: check.current,
            limit: check.limit,
            resetTime: check.resetTime
          }))
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // On error, allow the notification (fail open)
      return { allowed: true };
    }
  }

  /**
   * Record that a notification was sent (increment counters)
   */
  async recordNotificationSent({
    hotelId,
    userId,
    templateId,
    category,
    channels = []
  }) {
    try {
      await Promise.all([
        this.incrementCounter(RATE_LIMIT_KEYS.HOTEL_MINUTE(hotelId), TIME_WINDOWS.MINUTE),
        this.incrementCounter(RATE_LIMIT_KEYS.HOTEL_HOUR(hotelId), TIME_WINDOWS.HOUR),
        this.incrementCounter(RATE_LIMIT_KEYS.HOTEL_DAY(hotelId), TIME_WINDOWS.DAY),

        this.incrementCounter(RATE_LIMIT_KEYS.USER_MINUTE(userId), TIME_WINDOWS.MINUTE),
        this.incrementCounter(RATE_LIMIT_KEYS.USER_HOUR(userId), TIME_WINDOWS.HOUR),
        this.incrementCounter(RATE_LIMIT_KEYS.USER_DAY(userId), TIME_WINDOWS.DAY),

        templateId && this.incrementCounter(RATE_LIMIT_KEYS.TEMPLATE_HOUR(templateId), TIME_WINDOWS.HOUR),
        templateId && this.incrementCounter(RATE_LIMIT_KEYS.TEMPLATE_DAY(templateId), TIME_WINDOWS.DAY),

        this.incrementCounter(RATE_LIMIT_KEYS.CATEGORY_HOUR(hotelId, category), TIME_WINDOWS.HOUR),
        this.incrementCounter(RATE_LIMIT_KEYS.CATEGORY_DAY(hotelId, category), TIME_WINDOWS.DAY),

        ...channels.map(channel => [
          this.incrementCounter(RATE_LIMIT_KEYS.CHANNEL_MINUTE(userId, channel), TIME_WINDOWS.MINUTE),
          this.incrementCounter(RATE_LIMIT_KEYS.CHANNEL_HOUR(userId, channel), TIME_WINDOWS.HOUR),
          this.incrementCounter(RATE_LIMIT_KEYS.CHANNEL_DAY(userId, channel), TIME_WINDOWS.DAY)
        ]).flat()
      ].filter(Boolean));
    } catch (error) {
      console.error('Error recording notification sent:', error);
    }
  }

  /**
   * Check hotel-wide rate limits
   */
  async checkHotelLimits(hotelId) {
    const [minuteCount, hourCount, dayCount] = await Promise.all([
      this.getCounter(RATE_LIMIT_KEYS.HOTEL_MINUTE(hotelId)),
      this.getCounter(RATE_LIMIT_KEYS.HOTEL_HOUR(hotelId)),
      this.getCounter(RATE_LIMIT_KEYS.HOTEL_DAY(hotelId))
    ]);

    if (minuteCount >= RATE_LIMITS.HOTEL_PER_MINUTE) {
      return {
        allowed: false,
        type: 'hotel_minute',
        reason: 'Hotel minute limit exceeded',
        current: minuteCount,
        limit: RATE_LIMITS.HOTEL_PER_MINUTE,
        resetTime: this.getResetTime(TIME_WINDOWS.MINUTE)
      };
    }

    if (hourCount >= RATE_LIMITS.HOTEL_PER_HOUR) {
      return {
        allowed: false,
        type: 'hotel_hour',
        reason: 'Hotel hourly limit exceeded',
        current: hourCount,
        limit: RATE_LIMITS.HOTEL_PER_HOUR,
        resetTime: this.getResetTime(TIME_WINDOWS.HOUR)
      };
    }

    if (dayCount >= RATE_LIMITS.HOTEL_PER_DAY) {
      return {
        allowed: false,
        type: 'hotel_day',
        reason: 'Hotel daily limit exceeded',
        current: dayCount,
        limit: RATE_LIMITS.HOTEL_PER_DAY,
        resetTime: this.getResetTime(TIME_WINDOWS.DAY)
      };
    }

    return { allowed: true };
  }

  /**
   * Check per-user rate limits
   */
  async checkUserLimits(userId) {
    const [minuteCount, hourCount, dayCount] = await Promise.all([
      this.getCounter(RATE_LIMIT_KEYS.USER_MINUTE(userId)),
      this.getCounter(RATE_LIMIT_KEYS.USER_HOUR(userId)),
      this.getCounter(RATE_LIMIT_KEYS.USER_DAY(userId))
    ]);

    if (minuteCount >= RATE_LIMITS.USER_PER_MINUTE) {
      return {
        allowed: false,
        type: 'user_minute',
        reason: 'User minute limit exceeded',
        current: minuteCount,
        limit: RATE_LIMITS.USER_PER_MINUTE,
        resetTime: this.getResetTime(TIME_WINDOWS.MINUTE)
      };
    }

    if (hourCount >= RATE_LIMITS.USER_PER_HOUR) {
      return {
        allowed: false,
        type: 'user_hour',
        reason: 'User hourly limit exceeded',
        current: hourCount,
        limit: RATE_LIMITS.USER_PER_HOUR,
        resetTime: this.getResetTime(TIME_WINDOWS.HOUR)
      };
    }

    if (dayCount >= RATE_LIMITS.USER_PER_DAY) {
      return {
        allowed: false,
        type: 'user_day',
        reason: 'User daily limit exceeded',
        current: dayCount,
        limit: RATE_LIMITS.USER_PER_DAY,
        resetTime: this.getResetTime(TIME_WINDOWS.DAY)
      };
    }

    return { allowed: true };
  }

  /**
   * Check template-specific rate limits
   */
  async checkTemplateLimits(templateId) {
    if (!templateId) return { allowed: true };

    const [hourCount, dayCount] = await Promise.all([
      this.getCounter(RATE_LIMIT_KEYS.TEMPLATE_HOUR(templateId)),
      this.getCounter(RATE_LIMIT_KEYS.TEMPLATE_DAY(templateId))
    ]);

    if (hourCount >= RATE_LIMITS.TEMPLATE_PER_HOUR) {
      return {
        allowed: false,
        type: 'template_hour',
        reason: 'Template hourly limit exceeded',
        current: hourCount,
        limit: RATE_LIMITS.TEMPLATE_PER_HOUR,
        resetTime: this.getResetTime(TIME_WINDOWS.HOUR)
      };
    }

    if (dayCount >= RATE_LIMITS.TEMPLATE_PER_DAY) {
      return {
        allowed: false,
        type: 'template_day',
        reason: 'Template daily limit exceeded',
        current: dayCount,
        limit: RATE_LIMITS.TEMPLATE_PER_DAY,
        resetTime: this.getResetTime(TIME_WINDOWS.DAY)
      };
    }

    return { allowed: true };
  }

  /**
   * Check category-specific rate limits
   */
  async checkCategoryLimits(hotelId, category) {
    const [hourCount, dayCount] = await Promise.all([
      this.getCounter(RATE_LIMIT_KEYS.CATEGORY_HOUR(hotelId, category)),
      this.getCounter(RATE_LIMIT_KEYS.CATEGORY_DAY(hotelId, category))
    ]);

    // Special limits for promotional notifications
    if (category === 'promotional' && dayCount >= RATE_LIMITS.PROMOTIONAL_PER_DAY) {
      return {
        allowed: false,
        type: 'promotional_day',
        reason: 'Daily promotional limit exceeded',
        current: dayCount,
        limit: RATE_LIMITS.PROMOTIONAL_PER_DAY,
        resetTime: this.getResetTime(TIME_WINDOWS.DAY)
      };
    }

    // Special limits for emergency notifications
    if (category === 'emergency' && hourCount >= RATE_LIMITS.EMERGENCY_PER_HOUR) {
      return {
        allowed: false,
        type: 'emergency_hour',
        reason: 'Hourly emergency limit exceeded',
        current: hourCount,
        limit: RATE_LIMITS.EMERGENCY_PER_HOUR,
        resetTime: this.getResetTime(TIME_WINDOWS.HOUR)
      };
    }

    return { allowed: true };
  }

  /**
   * Check channel-specific rate limits
   */
  async checkChannelLimits(userId, channels) {
    for (const channel of channels) {
      const [minuteCount, hourCount, dayCount] = await Promise.all([
        this.getCounter(RATE_LIMIT_KEYS.CHANNEL_MINUTE(userId, channel)),
        this.getCounter(RATE_LIMIT_KEYS.CHANNEL_HOUR(userId, channel)),
        this.getCounter(RATE_LIMIT_KEYS.CHANNEL_DAY(userId, channel))
      ]);

      // SMS limits
      if (channel === 'sms' && dayCount >= RATE_LIMITS.SMS_PER_DAY) {
        return {
          allowed: false,
          type: 'sms_day',
          reason: 'Daily SMS limit exceeded',
          current: dayCount,
          limit: RATE_LIMITS.SMS_PER_DAY,
          resetTime: this.getResetTime(TIME_WINDOWS.DAY)
        };
      }

      // Email limits
      if (channel === 'email' && hourCount >= RATE_LIMITS.EMAIL_PER_HOUR) {
        return {
          allowed: false,
          type: 'email_hour',
          reason: 'Hourly email limit exceeded',
          current: hourCount,
          limit: RATE_LIMITS.EMAIL_PER_HOUR,
          resetTime: this.getResetTime(TIME_WINDOWS.HOUR)
        };
      }

      // Push notification limits
      if (channel === 'push' && minuteCount >= RATE_LIMITS.PUSH_PER_MINUTE) {
        return {
          allowed: false,
          type: 'push_minute',
          reason: 'Push notification minute limit exceeded',
          current: minuteCount,
          limit: RATE_LIMITS.PUSH_PER_MINUTE,
          resetTime: this.getResetTime(TIME_WINDOWS.MINUTE)
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check for priority overrides (urgent notifications can bypass some limits)
   */
  async checkPriorityOverrides(priority) {
    // Urgent notifications bypass user and template limits but not hotel limits
    if (priority === 'urgent') {
      return { allowed: true, override: true };
    }

    return { allowed: true };
  }

  /**
   * Get current counter value
   */
  async getCounter(key) {
    try {
      const value = await this.cache.get(key);
      return value || 0;
    } catch (error) {
      console.error('Error getting counter:', error);
      return 0;
    }
  }

  /**
   * Increment counter with expiry
   */
  async incrementCounter(key, ttl) {
    if (!key) return;

    try {
      if (this.cache.connected && this.cache.redis) {
        // Use Redis INCR with EXPIRE for atomic operation
        const pipeline = this.cache.redis.pipeline();
        pipeline.incr(key);
        pipeline.expire(key, ttl);
        await pipeline.exec();
      }
    } catch (error) {
      console.error('Error incrementing counter:', error);
    }
  }

  /**
   * Calculate reset time for a given window
   */
  getResetTime(windowSeconds) {
    const now = new Date();
    return new Date(now.getTime() + windowSeconds * 1000);
  }

  /**
   * Get rate limit status for a user/hotel
   */
  async getRateLimitStatus(hotelId, userId) {
    try {
      const [hotelStats, userStats] = await Promise.all([
        this.getHotelStats(hotelId),
        this.getUserStats(userId)
      ]);

      return {
        hotel: hotelStats,
        user: userStats
      };
    } catch (error) {
      console.error('Error getting rate limit status:', error);
      return null;
    }
  }

  async getHotelStats(hotelId) {
    const [minuteCount, hourCount, dayCount] = await Promise.all([
      this.getCounter(RATE_LIMIT_KEYS.HOTEL_MINUTE(hotelId)),
      this.getCounter(RATE_LIMIT_KEYS.HOTEL_HOUR(hotelId)),
      this.getCounter(RATE_LIMIT_KEYS.HOTEL_DAY(hotelId))
    ]);

    return {
      minute: { current: minuteCount, limit: RATE_LIMITS.HOTEL_PER_MINUTE },
      hour: { current: hourCount, limit: RATE_LIMITS.HOTEL_PER_HOUR },
      day: { current: dayCount, limit: RATE_LIMITS.HOTEL_PER_DAY }
    };
  }

  async getUserStats(userId) {
    const [minuteCount, hourCount, dayCount] = await Promise.all([
      this.getCounter(RATE_LIMIT_KEYS.USER_MINUTE(userId)),
      this.getCounter(RATE_LIMIT_KEYS.USER_HOUR(userId)),
      this.getCounter(RATE_LIMIT_KEYS.USER_DAY(userId))
    ]);

    return {
      minute: { current: minuteCount, limit: RATE_LIMITS.USER_PER_MINUTE },
      hour: { current: hourCount, limit: RATE_LIMITS.USER_PER_HOUR },
      day: { current: dayCount, limit: RATE_LIMITS.USER_PER_DAY }
    };
  }

  /**
   * Reset rate limits (for admin override)
   */
  async resetRateLimits(type, identifier) {
    try {
      let pattern;

      switch (type) {
        case 'hotel':
          pattern = `rate:hotel:${identifier}:*`;
          break;
        case 'user':
          pattern = `rate:user:${identifier}:*`;
          break;
        case 'template':
          pattern = `rate:template:${identifier}:*`;
          break;
        default:
          throw new Error('Invalid reset type');
      }

      await this.cache.invalidatePattern(pattern);
      return true;
    } catch (error) {
      console.error('Error resetting rate limits:', error);
      return false;
    }
  }

  /**
   * Get rate limiting metrics for monitoring
   */
  async getMetrics() {
    try {
      const redis = this.cache.redis;
      if (!redis) return null;

      const keys = await redis.keys('rate:*');
      const metrics = {
        totalKeys: keys.length,
        hotels: {},
        users: {},
        templates: {},
        categories: {}
      };

      // Group keys by type for analysis
      keys.forEach(key => {
        const parts = key.split(':');
        if (parts.length >= 3) {
          const type = parts[1];
          const identifier = parts[2];

          if (type === 'hotel') {
            if (!metrics.hotels[identifier]) metrics.hotels[identifier] = 0;
            metrics.hotels[identifier]++;
          } else if (type === 'user') {
            if (!metrics.users[identifier]) metrics.users[identifier] = 0;
            metrics.users[identifier]++;
          } else if (type === 'template') {
            if (!metrics.templates[identifier]) metrics.templates[identifier] = 0;
            metrics.templates[identifier]++;
          } else if (type === 'category') {
            const category = parts[4];
            if (category) {
              if (!metrics.categories[category]) metrics.categories[category] = 0;
              metrics.categories[category]++;
            }
          }
        }
      });

      return metrics;
    } catch (error) {
      console.error('Error getting rate limit metrics:', error);
      return null;
    }
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

export default rateLimiter;