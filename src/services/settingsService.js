import UserSettings from '../models/UserSettings.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/appError.js';

class SettingsService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  // Get user settings with caching
  async getUserSettings(userId, useCache = true) {
    const cacheKey = `settings_${userId}`;

    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
    }

    try {
      let settings = await UserSettings.findOne({ userId }).populate('userId', 'name email role');

      if (!settings) {
        const user = await User.findById(userId);
        if (!user) {
          throw new AppError('User not found', 404);
        }
        settings = await UserSettings.createDefaultSettings(userId, user.role);
      }

      // Cache the result
      if (useCache) {
        this.cache.set(cacheKey, {
          data: settings,
          timestamp: Date.now()
        });
      }

      return settings;
    } catch (error) {
      logger.error('Error fetching user settings:', error);
      throw error;
    }
  }

  // Update user settings
  async updateUserSettings(userId, category, updateData) {
    try {
      const settings = await this.getUserSettings(userId, false);

      if (category) {
        settings.updateCategory(category, updateData);
      } else {
        Object.keys(updateData).forEach(key => {
          if (settings.schema.paths[key]) {
            settings[key] = { ...settings[key]?.toObject?.() || settings[key], ...updateData[key] };
          }
        });
        settings.lastModified = new Date();
        settings.version += 1;
      }

      await settings.save();

      // Invalidate cache
      this.cache.delete(`settings_${userId}`);

      // Emit settings update event
      this.emitSettingsUpdate(userId, category, updateData);

      return settings;
    } catch (error) {
      logger.error('Error updating user settings:', error);
      throw error;
    }
  }

  // Get settings by category
  async getSettingsByCategory(userId, category) {
    try {
      const settings = await this.getUserSettings(userId);
      return settings.getSettingsByCategory(category);
    } catch (error) {
      logger.error(`Error fetching ${category} settings:`, error);
      throw error;
    }
  }

  // Reset settings to defaults
  async resetUserSettings(userId, category = null) {
    try {
      const settings = await this.getUserSettings(userId, false);
      const user = await User.findById(userId);

      const defaultSettings = UserSettings.getDefaultSettings(user.role);

      if (category) {
        if (!defaultSettings[category]) {
          throw new AppError(`Invalid settings category: ${category}`, 400);
        }
        settings[category] = defaultSettings[category];
      } else {
        Object.keys(defaultSettings).forEach(key => {
          settings[key] = defaultSettings[key];
        });
      }

      settings.lastModified = new Date();
      settings.version += 1;

      await settings.save();

      // Invalidate cache
      this.cache.delete(`settings_${userId}`);

      return settings;
    } catch (error) {
      logger.error('Error resetting user settings:', error);
      throw error;
    }
  }

  // Bulk settings operations
  async bulkUpdateSettings(userIds, category, updateData) {
    const results = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        const updated = await this.updateUserSettings(userId, category, updateData);
        results.push({ userId, status: 'success', data: updated });
      } catch (error) {
        errors.push({ userId, status: 'error', error: error.message });
      }
    }

    return { results, errors };
  }

  // Hotel settings management (Admin only)
  async getHotelSettings(adminUserId) {
    try {
      const settings = await this.getUserSettings(adminUserId);
      if (!settings.hotel) {
        throw new AppError('Hotel settings not found', 404);
      }
      return settings.hotel;
    } catch (error) {
      logger.error('Error fetching hotel settings:', error);
      throw error;
    }
  }

  async updateHotelSettings(adminUserId, hotelData) {
    try {
      const settings = await this.getUserSettings(adminUserId, false);

      settings.hotel = { ...settings.hotel?.toObject?.() || settings.hotel, ...hotelData };
      settings.lastModified = new Date();
      settings.version += 1;

      await settings.save();

      // Invalidate cache
      this.cache.delete(`settings_${adminUserId}`);

      return settings.hotel;
    } catch (error) {
      logger.error('Error updating hotel settings:', error);
      throw error;
    }
  }

  // Notification preferences management
  async getNotificationPreferences(userId) {
    try {
      const settings = await this.getUserSettings(userId);
      return settings.notifications;
    } catch (error) {
      logger.error('Error fetching notification preferences:', error);
      throw error;
    }
  }

  async updateNotificationPreferences(userId, preferences) {
    try {
      const settings = await this.getUserSettings(userId, false);

      settings.notifications = { ...settings.notifications?.toObject?.() || settings.notifications, ...preferences };
      settings.lastModified = new Date();
      settings.version += 1;

      await settings.save();

      // Invalidate cache
      this.cache.delete(`settings_${userId}`);

      // Update notification service with new preferences
      this.syncNotificationPreferences(userId, settings.notifications);

      return settings.notifications;
    } catch (error) {
      logger.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  // Settings validation
  validateSettings(role, category, data) {
    const permissions = {
      admin: ['profile', 'hotel', 'notifications', 'display', 'system', 'integrations'],
      staff: ['profile', 'notifications', 'display', 'availability'],
      guest: ['profile', 'notifications', 'display', 'communication', 'privacy'],
      travel_agent: ['profile', 'notifications', 'display', 'communication', 'travelAgent']
    };

    if (category && !permissions[role]?.includes(category)) {
      throw new AppError(`Role ${role} cannot modify ${category} settings`, 403);
    }

    // Additional validation rules
    if (data.notifications?.quietHours) {
      const { start, end } = data.notifications.quietHours;
      if (start && end && !this.isValidTimeFormat(start) || !this.isValidTimeFormat(end)) {
        throw new AppError('Invalid time format for quiet hours', 400);
      }
    }

    if (data.display?.theme && !['light', 'dark', 'auto'].includes(data.display.theme)) {
      throw new AppError('Invalid theme option', 400);
    }

    return true;
  }

  // Settings migration
  async migrateSettings(userId, targetVersion = 1) {
    try {
      const settings = await this.getUserSettings(userId, false);

      if (settings.version >= targetVersion) {
        return settings; // Already up to date
      }

      // Perform migration
      settings.migrate();
      await settings.save();

      // Invalidate cache
      this.cache.delete(`settings_${userId}`);

      logger.info(`Settings migrated for user ${userId} to version ${targetVersion}`);

      return settings;
    } catch (error) {
      logger.error('Error migrating settings:', error);
      throw error;
    }
  }

  // Settings export/import
  async exportUserSettings(userId, format = 'json') {
    try {
      const settings = await this.getUserSettings(userId);
      const exportData = settings.toObject();

      // Remove sensitive data
      delete exportData.system?.apiKeys;
      delete exportData.integrations?.payment;

      if (format === 'json') {
        return {
          settings: exportData,
          exportedAt: new Date(),
          version: settings.version
        };
      } else if (format === 'csv') {
        return this.convertToCSV(exportData);
      }

      throw new AppError('Unsupported export format', 400);
    } catch (error) {
      logger.error('Error exporting settings:', error);
      throw error;
    }
  }

  async importUserSettings(userId, importData, role) {
    try {
      // Validate import data
      if (!importData || typeof importData !== 'object') {
        throw new AppError('Invalid import data', 400);
      }

      let settings = await UserSettings.findOne({ userId });

      if (!settings) {
        settings = new UserSettings({
          userId,
          role,
          ...importData
        });
      } else {
        // Merge imported settings
        Object.keys(importData).forEach(key => {
          if (settings.schema.paths[key] && this.validateSettings(role, key, { [key]: importData[key] })) {
            settings[key] = { ...settings[key]?.toObject?.() || settings[key], ...importData[key] };
          }
        });
      }

      settings.lastModified = new Date();
      settings.version += 1;

      await settings.save();

      // Invalidate cache
      this.cache.delete(`settings_${userId}`);

      return settings;
    } catch (error) {
      logger.error('Error importing settings:', error);
      throw error;
    }
  }

  // Analytics and reporting
  async getSettingsAnalytics() {
    try {
      const stats = await UserSettings.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
            avgVersion: { $avg: '$version' },
            lastModified: { $max: '$lastModified' },
            activeUsers: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            role: '$_id',
            count: 1,
            activeUsers: 1,
            avgVersion: { $round: ['$avgVersion', 2] },
            lastModified: 1,
            _id: 0
          }
        }
      ]);

      const totalUsers = await UserSettings.countDocuments();
      const recentlyActive = await UserSettings.countDocuments({
        lastModified: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });

      return {
        totalUsers,
        recentlyActive,
        roleBreakdown: stats,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error fetching settings analytics:', error);
      throw error;
    }
  }

  // User preference trends
  async getPreferenceTrends() {
    try {
      const trends = await UserSettings.aggregate([
        {
          $group: {
            _id: {
              theme: '$display.theme',
              language: '$display.language',
              role: '$role'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.role',
            preferences: {
              $push: {
                theme: '$_id.theme',
                language: '$_id.language',
                count: '$count'
              }
            }
          }
        }
      ]);

      return trends;
    } catch (error) {
      logger.error('Error fetching preference trends:', error);
      throw error;
    }
  }

  // Utility methods
  isValidTimeFormat(time) {
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  }

  convertToCSV(data) {
    const flatten = (obj, prefix = '') => {
      const flattened = {};
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(flattened, flatten(obj[key], `${prefix}${key}.`));
        } else {
          flattened[`${prefix}${key}`] = Array.isArray(obj[key]) ? obj[key].join(';') : obj[key];
        }
      }
      return flattened;
    };

    const flattened = flatten(data);
    const headers = Object.keys(flattened).join(',');
    const values = Object.values(flattened).map(val =>
      typeof val === 'string' && val.includes(',') ? `"${val}"` : val
    ).join(',');

    return `${headers}\n${values}`;
  }

  // Event emission for real-time updates
  emitSettingsUpdate(userId, category, updateData) {
    // This would integrate with your notification system
    // Example: notificationEmitter.emit(`settings:${userId}`, { category, data: updateData });
    logger.info(`Settings updated for user ${userId}`, { category, updateData });
  }

  // Sync notification preferences with notification service
  syncNotificationPreferences(userId, preferences) {
    // This would sync with your notification service
    // Example: notificationService.updateUserPreferences(userId, preferences);
    logger.info(`Notification preferences synced for user ${userId}`);
  }

  // Cache management
  clearCache(userId = null) {
    if (userId) {
      this.cache.delete(`settings_${userId}`);
    } else {
      this.cache.clear();
    }
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      expiry: this.cacheExpiry,
      keys: Array.from(this.cache.keys())
    };
  }

  // Cleanup method
  cleanup() {
    // Clean expired cache entries
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Create singleton instance
const settingsService = new SettingsService();

// Cleanup expired cache entries every 10 minutes
setInterval(() => {
  settingsService.cleanup();
}, 10 * 60 * 1000);

export default settingsService;