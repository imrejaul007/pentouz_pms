import mongoose from 'mongoose';
import PropertyGroup from '../models/PropertyGroup.js';
import Hotel from '../models/Hotel.js';
import logger from '../utils/logger.js';
import cacheService from './cacheService.js';

/**
 * Property Branding Service
 * Handles property-specific settings, branding, and configuration inheritance
 */

class PropertyBrandingService {
  constructor() {
    this.cacheExpiry = 3600; // 1 hour cache for branding data
  }

  /**
   * Get effective settings for a property (inherits from group + property overrides)
   * @param {string} propertyId - Property/Hotel ID
   * @param {string} settingCategory - Category of settings to retrieve
   */
  async getEffectiveSettings(propertyId, settingCategory = 'all') {
    const cacheKey = `property-settings:${propertyId}:${settingCategory}`;

    try {
      // Try cache first
      const cachedSettings = await cacheService.get(cacheKey);
      if (cachedSettings) {
        return cachedSettings;
      }

      // Get property with group information
      const property = await Hotel.findById(propertyId)
        .populate('propertyGroupId', 'settings permissions')
        .lean();

      if (!property) {
        throw new Error('Property not found');
      }

      let effectiveSettings = {};

      // Start with default settings
      const defaultSettings = this.getDefaultSettings();
      
      // Apply group settings if property belongs to a group
      if (property.propertyGroupId) {
        const groupSettings = property.propertyGroupId.settings || {};
        effectiveSettings = this.mergeSettings(defaultSettings, groupSettings);
      } else {
        effectiveSettings = { ...defaultSettings };
      }

      // Apply property-specific overrides if inheritance is enabled
      if (property.groupSettings?.inheritSettings !== false) {
        const propertyOverrides = property.groupSettings?.overrides || {};
        effectiveSettings = this.mergeSettings(effectiveSettings, propertyOverrides);
      } else {
        // If not inheriting, use property's own settings
        effectiveSettings = this.mergeSettings(defaultSettings, property.settings || {});
      }

      // Apply property-specific settings that always override
      const propertySpecificSettings = {
        name: property.name,
        address: property.address,
        contact: property.contact,
        amenities: property.amenities,
        images: property.images
      };

      effectiveSettings = this.mergeSettings(effectiveSettings, propertySpecificSettings);

      // Filter by category if specified
      if (settingCategory !== 'all') {
        effectiveSettings = this.filterByCategory(effectiveSettings, settingCategory);
      }

      // Cache the result
      await cacheService.set(cacheKey, effectiveSettings, this.cacheExpiry);

      logger.debug(`Effective settings retrieved for property: ${propertyId}`, {
        settingCategory,
        hasGroupSettings: !!property.propertyGroupId,
        inheritanceEnabled: property.groupSettings?.inheritSettings !== false
      });

      return effectiveSettings;

    } catch (error) {
      logger.error('Error getting effective settings:', error);
      throw new Error(`Failed to get effective settings: ${error.message}`);
    }
  }

  /**
   * Update property-specific overrides
   * @param {string} propertyId - Property ID
   * @param {Object} overrides - Settings overrides to apply
   * @param {string} userId - User making the changes
   */
  async updatePropertyOverrides(propertyId, overrides, userId) {
    try {
      const property = await Hotel.findById(propertyId);
      
      if (!property) {
        throw new Error('Property not found');
      }

      // Initialize group settings if not exists
      if (!property.groupSettings) {
        property.groupSettings = {
          inheritSettings: true,
          overrides: {}
        };
      }

      // Merge new overrides with existing ones
      const currentOverrides = property.groupSettings.overrides || {};
      const updatedOverrides = this.mergeSettings(currentOverrides, overrides);

      // Update property
      property.groupSettings.overrides = updatedOverrides;
      property.groupSettings.lastSyncAt = new Date();
      
      await property.save();

      // Clear cache for this property
      await this.clearPropertySettingsCache(propertyId);

      logger.info(`Property overrides updated: ${propertyId}`, {
        userId,
        overrideKeys: Object.keys(overrides)
      });

      return {
        success: true,
        message: 'Property overrides updated successfully',
        overrides: updatedOverrides
      };

    } catch (error) {
      logger.error('Error updating property overrides:', error);
      throw new Error(`Failed to update property overrides: ${error.message}`);
    }
  }

  /**
   * Get property branding configuration
   * @param {string} propertyId - Property ID
   */
  async getPropertyBranding(propertyId) {
    const cacheKey = `property-branding:${propertyId}`;

    try {
      const cachedBranding = await cacheService.get(cacheKey);
      if (cachedBranding) {
        return cachedBranding;
      }

      const effectiveSettings = await this.getEffectiveSettings(propertyId, 'branding');
      
      const branding = {
        logo: effectiveSettings.brandGuidelines?.logoUrl || effectiveSettings.images?.[0] || null,
        colors: {
          primary: effectiveSettings.brandGuidelines?.primaryColor || '#1976D2',
          secondary: effectiveSettings.brandGuidelines?.secondaryColor || '#424242',
          accent: effectiveSettings.brandGuidelines?.accentColor || '#FFC107'
        },
        fonts: {
          primary: effectiveSettings.brandGuidelines?.primaryFont || 'Roboto',
          secondary: effectiveSettings.brandGuidelines?.secondaryFont || 'Open Sans'
        },
        website: effectiveSettings.brandGuidelines?.websiteUrl || effectiveSettings.contact?.website,
        socialMedia: effectiveSettings.brandGuidelines?.socialMedia || {},
        customCSS: effectiveSettings.brandGuidelines?.customCSS || null,
        favicon: effectiveSettings.brandGuidelines?.favicon || null,
        propertyName: effectiveSettings.name,
        tagline: effectiveSettings.brandGuidelines?.tagline || null
      };

      await cacheService.set(cacheKey, branding, this.cacheExpiry);

      return branding;

    } catch (error) {
      logger.error('Error getting property branding:', error);
      throw new Error(`Failed to get property branding: ${error.message}`);
    }
  }

  /**
   * Update property branding
   * @param {string} propertyId - Property ID
   * @param {Object} brandingData - New branding data
   * @param {string} userId - User making the changes
   */
  async updatePropertyBranding(propertyId, brandingData, userId) {
    try {
      const brandingOverrides = {
        brandGuidelines: {
          ...brandingData,
          updatedAt: new Date(),
          updatedBy: userId
        }
      };

      await this.updatePropertyOverrides(propertyId, brandingOverrides, userId);

      // Clear branding cache
      await cacheService.del(`property-branding:${propertyId}`);

      logger.info(`Property branding updated: ${propertyId}`, {
        userId,
        brandingKeys: Object.keys(brandingData)
      });

      return {
        success: true,
        message: 'Property branding updated successfully'
      };

    } catch (error) {
      logger.error('Error updating property branding:', error);
      throw new Error(`Failed to update property branding: ${error.message}`);
    }
  }

  /**
   * Get localization settings for a property
   * @param {string} propertyId - Property ID
   * @param {string} requestedLanguage - Requested language code
   */
  async getPropertyLocalization(propertyId, requestedLanguage = null) {
    const cacheKey = `property-localization:${propertyId}:${requestedLanguage || 'default'}`;

    try {
      const cachedLocalization = await cacheService.get(cacheKey);
      if (cachedLocalization) {
        return cachedLocalization;
      }

      const effectiveSettings = await this.getEffectiveSettings(propertyId, 'localization');
      
      const defaultLanguage = effectiveSettings.defaultLanguage || 'en';
      const supportedLanguages = effectiveSettings.supportedLanguages || [defaultLanguage];
      const targetLanguage = requestedLanguage && supportedLanguages.includes(requestedLanguage) 
        ? requestedLanguage 
        : defaultLanguage;

      const localization = {
        currentLanguage: targetLanguage,
        defaultLanguage,
        supportedLanguages,
        currency: effectiveSettings.baseCurrency || 'USD',
        supportedCurrencies: effectiveSettings.supportedCurrencies || [effectiveSettings.baseCurrency || 'USD'],
        timezone: effectiveSettings.timezone || 'UTC',
        dateFormat: effectiveSettings.dateFormat || 'YYYY-MM-DD',
        timeFormat: effectiveSettings.timeFormat || '24h',
        numberFormat: effectiveSettings.numberFormat || {
          decimal: '.',
          thousands: ',',
          precision: 2
        },
        address: this.formatAddressForLocale(effectiveSettings.address, targetLanguage),
        localizedContent: effectiveSettings.localizedContent?.[targetLanguage] || {}
      };

      await cacheService.set(cacheKey, localization, this.cacheExpiry);

      return localization;

    } catch (error) {
      logger.error('Error getting property localization:', error);
      throw new Error(`Failed to get property localization: ${error.message}`);
    }
  }

  /**
   * Update property localization settings
   * @param {string} propertyId - Property ID
   * @param {Object} localizationData - Localization data
   * @param {string} userId - User making changes
   */
  async updatePropertyLocalization(propertyId, localizationData, userId) {
    try {
      const localizationOverrides = {
        defaultLanguage: localizationData.defaultLanguage,
        supportedLanguages: localizationData.supportedLanguages,
        baseCurrency: localizationData.currency,
        supportedCurrencies: localizationData.supportedCurrencies,
        timezone: localizationData.timezone,
        dateFormat: localizationData.dateFormat,
        timeFormat: localizationData.timeFormat,
        numberFormat: localizationData.numberFormat,
        localizedContent: localizationData.localizedContent
      };

      // Remove undefined values
      Object.keys(localizationOverrides).forEach(key => {
        if (localizationOverrides[key] === undefined) {
          delete localizationOverrides[key];
        }
      });

      await this.updatePropertyOverrides(propertyId, localizationOverrides, userId);

      // Clear localization cache
      await cacheService.delPattern(`property-localization:${propertyId}:*`);

      logger.info(`Property localization updated: ${propertyId}`, {
        userId,
        languages: localizationData.supportedLanguages,
        currency: localizationData.currency
      });

      return {
        success: true,
        message: 'Property localization updated successfully'
      };

    } catch (error) {
      logger.error('Error updating property localization:', error);
      throw new Error(`Failed to update property localization: ${error.message}`);
    }
  }

  /**
   * Get inheritance settings for a property
   * @param {string} propertyId - Property ID
   */
  async getPropertyInheritance(propertyId) {
    try {
      const property = await Hotel.findById(propertyId)
        .populate('propertyGroupId', 'name settings')
        .select('groupSettings propertyGroupId')
        .lean();

      if (!property) {
        throw new Error('Property not found');
      }

      const inheritance = {
        hasPropertyGroup: !!property.propertyGroupId,
        propertyGroupName: property.propertyGroupId?.name || null,
        inheritSettings: property.groupSettings?.inheritSettings !== false,
        lastSyncAt: property.groupSettings?.lastSyncAt || null,
        version: property.groupSettings?.version || null,
        availableSettings: property.propertyGroupId ? 
          Object.keys(property.propertyGroupId.settings || {}) : [],
        currentOverrides: property.groupSettings?.overrides ? 
          Object.keys(property.groupSettings.overrides) : []
      };

      return inheritance;

    } catch (error) {
      logger.error('Error getting property inheritance:', error);
      throw new Error(`Failed to get property inheritance: ${error.message}`);
    }
  }

  /**
   * Toggle property inheritance settings
   * @param {string} propertyId - Property ID
   * @param {boolean} inheritSettings - Whether to inherit group settings
   * @param {string} userId - User making changes
   */
  async togglePropertyInheritance(propertyId, inheritSettings, userId) {
    try {
      const property = await Hotel.findById(propertyId);
      
      if (!property) {
        throw new Error('Property not found');
      }

      if (!property.groupSettings) {
        property.groupSettings = {};
      }

      property.groupSettings.inheritSettings = inheritSettings;
      property.groupSettings.lastSyncAt = new Date();

      await property.save();

      // Clear all settings cache for this property since inheritance changed
      await this.clearPropertySettingsCache(propertyId);

      logger.info(`Property inheritance toggled: ${propertyId}`, {
        userId,
        inheritSettings
      });

      return {
        success: true,
        message: `Property inheritance ${inheritSettings ? 'enabled' : 'disabled'} successfully`,
        inheritSettings
      };

    } catch (error) {
      logger.error('Error toggling property inheritance:', error);
      throw new Error(`Failed to toggle property inheritance: ${error.message}`);
    }
  }

  // Helper methods

  getDefaultSettings() {
    return {
      defaultCancellationPolicy: '24 hours before check-in',
      defaultChildPolicy: 'Children under 12 stay free',
      defaultPetPolicy: 'Pets not allowed',
      baseCurrency: 'USD',
      supportedCurrencies: ['USD'],
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      defaultLanguage: 'en',
      supportedLanguages: ['en'],
      brandGuidelines: {
        primaryColor: '#1976D2',
        secondaryColor: '#424242',
        logoUrl: null,
        websiteUrl: null
      }
    };
  }

  mergeSettings(base, override) {
    const merged = { ...base };
    
    for (const key in override) {
      if (override[key] !== null && override[key] !== undefined) {
        if (typeof override[key] === 'object' && !Array.isArray(override[key]) && override[key] !== null) {
          merged[key] = this.mergeSettings(merged[key] || {}, override[key]);
        } else {
          merged[key] = override[key];
        }
      }
    }
    
    return merged;
  }

  filterByCategory(settings, category) {
    const categoryMappings = {
      branding: ['brandGuidelines', 'name', 'images', 'contact'],
      localization: ['defaultLanguage', 'supportedLanguages', 'baseCurrency', 'supportedCurrencies', 'timezone', 'dateFormat', 'timeFormat', 'numberFormat', 'localizedContent'],
      policies: ['defaultCancellationPolicy', 'defaultChildPolicy', 'defaultPetPolicy'],
      contact: ['contact', 'address'],
      amenities: ['amenities'],
      all: Object.keys(settings)
    };

    const relevantKeys = categoryMappings[category] || [];
    const filtered = {};

    relevantKeys.forEach(key => {
      if (settings[key] !== undefined) {
        filtered[key] = settings[key];
      }
    });

    return filtered;
  }

  formatAddressForLocale(address, locale) {
    if (!address) return null;

    // Simple address formatting - can be enhanced with proper localization
    const formats = {
      'en': `${address.street}, ${address.city}, ${address.state} ${address.zipCode}, ${address.country}`,
      'es': `${address.street}, ${address.zipCode} ${address.city}, ${address.state}, ${address.country}`,
      'fr': `${address.street}, ${address.zipCode} ${address.city}, ${address.country}`,
      'de': `${address.street}, ${address.zipCode} ${address.city}, ${address.country}`
    };

    return formats[locale] || formats['en'];
  }

  async clearPropertySettingsCache(propertyId) {
    try {
      const patterns = [
        `property-settings:${propertyId}:*`,
        `property-branding:${propertyId}`,
        `property-localization:${propertyId}:*`
      ];

      let totalCleared = 0;
      for (const pattern of patterns) {
        const cleared = await cacheService.delPattern(pattern);
        totalCleared += cleared;
      }

      logger.debug(`Cleared ${totalCleared} cache entries for property: ${propertyId}`);
      return totalCleared;

    } catch (error) {
      logger.error('Error clearing property settings cache:', error);
    }
  }

  /**
   * Bulk update settings for multiple properties in a group
   * @param {string} propertyGroupId - Property group ID
   * @param {Object} settingsUpdate - Settings to update
   * @param {string} userId - User making changes
   */
  async bulkUpdateGroupProperties(propertyGroupId, settingsUpdate, userId) {
    try {
      const properties = await Hotel.find({ 
        propertyGroupId,
        'groupSettings.inheritSettings': { $ne: false }
      }).select('_id name');

      const updatePromises = properties.map(property => 
        this.updatePropertyOverrides(property._id, settingsUpdate, userId)
      );

      const results = await Promise.allSettled(updatePromises);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info(`Bulk property settings update completed for group: ${propertyGroupId}`, {
        userId,
        totalProperties: properties.length,
        successful,
        failed
      });

      return {
        success: true,
        message: `Settings updated for ${successful} properties`,
        details: {
          totalProperties: properties.length,
          successful,
          failed,
          failures: results
            .filter(r => r.status === 'rejected')
            .map(r => r.reason?.message)
        }
      };

    } catch (error) {
      logger.error('Error in bulk property settings update:', error);
      throw new Error(`Failed to bulk update property settings: ${error.message}`);
    }
  }
}

// Create singleton instance
const propertyBrandingService = new PropertyBrandingService();

export default propertyBrandingService;