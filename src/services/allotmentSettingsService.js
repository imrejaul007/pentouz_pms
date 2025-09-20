import mongoose from 'mongoose';
import HotelAllotmentSettings from '../models/HotelAllotmentSettings.js';

class AllotmentSettingsService {
  /**
   * Get hotel allotment settings
   */
  async getHotelSettings(hotelId, userId) {
    try {
      console.log('🔍 [AllotmentSettingsService] Fetching hotel settings for:', hotelId);

      let settings = await HotelAllotmentSettings.findByHotelId(hotelId);

      if (!settings) {
        console.log('🆕 [AllotmentSettingsService] No settings found, creating default settings');
        // Use a valid ObjectId format or the actual user ID
        const defaultUserId = userId || new mongoose.Types.ObjectId();
        settings = await HotelAllotmentSettings.createDefaultSettings(hotelId, defaultUserId);
      }

      console.log('✅ [AllotmentSettingsService] Settings fetched successfully');
      return settings;
    } catch (error) {
      console.error('❌ [AllotmentSettingsService] Error fetching hotel settings:', error);
      throw new Error(`Failed to fetch hotel settings: ${error.message}`);
    }
  }

  /**
   * Update global default settings
   */
  async updateGlobalSettings(hotelId, globalSettings, userId) {
    try {
      console.log('🔧 [AllotmentSettingsService] Updating global settings for hotel:', hotelId);

      let settings = await HotelAllotmentSettings.findByHotelId(hotelId);

      if (!settings) {
        settings = await HotelAllotmentSettings.createDefaultSettings(hotelId, userId);
      }

      // Update global defaults
      if (globalSettings.globalDefaults) {
        settings.globalDefaults = { ...settings.globalDefaults, ...globalSettings.globalDefaults };
      }

      // Update default channels if provided
      if (globalSettings.defaultChannels) {
        settings.defaultChannels = globalSettings.defaultChannels;
      }

      // Update allocation rule templates if provided
      if (globalSettings.allocationRuleTemplates) {
        settings.allocationRuleTemplates = globalSettings.allocationRuleTemplates;
      }

      // Update UI preferences if provided
      if (globalSettings.uiPreferences) {
        settings.uiPreferences = { ...settings.uiPreferences, ...globalSettings.uiPreferences };
      }

      settings.updatedBy = userId;
      await settings.save();

      console.log('✅ [AllotmentSettingsService] Global settings updated successfully');
      return settings;
    } catch (error) {
      console.error('❌ [AllotmentSettingsService] Error updating global settings:', error);
      throw new Error(`Failed to update global settings: ${error.message}`);
    }
  }

  /**
   * Update integration settings
   */
  async updateIntegrationSettings(hotelId, integrationSettings, userId) {
    try {
      console.log('🔧 [AllotmentSettingsService] Updating integration settings for hotel:', hotelId);

      let settings = await HotelAllotmentSettings.findByHotelId(hotelId);

      if (!settings) {
        settings = await HotelAllotmentSettings.createDefaultSettings(hotelId, userId);
      }

      // Update integration settings
      if (integrationSettings.channelManager) {
        settings.integrationSettings.channelManager = {
          ...settings.integrationSettings.channelManager,
          ...integrationSettings.channelManager
        };
      }

      if (integrationSettings.pms) {
        settings.integrationSettings.pms = {
          ...settings.integrationSettings.pms,
          ...integrationSettings.pms
        };
      }

      if (integrationSettings.webhooks) {
        settings.integrationSettings.webhooks = integrationSettings.webhooks;
      }

      settings.updatedBy = userId;
      await settings.save();

      console.log('✅ [AllotmentSettingsService] Integration settings updated successfully');
      return settings;
    } catch (error) {
      console.error('❌ [AllotmentSettingsService] Error updating integration settings:', error);
      throw new Error(`Failed to update integration settings: ${error.message}`);
    }
  }

  /**
   * Update analytics settings
   */
  async updateAnalyticsSettings(hotelId, analyticsSettings, userId) {
    try {
      console.log('🔧 [AllotmentSettingsService] Updating analytics settings for hotel:', hotelId);

      let settings = await HotelAllotmentSettings.findByHotelId(hotelId);

      if (!settings) {
        settings = await HotelAllotmentSettings.createDefaultSettings(hotelId, userId);
      }

      // Update analytics settings
      settings.analyticsSettings = { ...settings.analyticsSettings, ...analyticsSettings };

      settings.updatedBy = userId;
      await settings.save();

      console.log('✅ [AllotmentSettingsService] Analytics settings updated successfully');
      return settings;
    } catch (error) {
      console.error('❌ [AllotmentSettingsService] Error updating analytics settings:', error);
      throw new Error(`Failed to update analytics settings: ${error.message}`);
    }
  }

  /**
   * Add or update allocation rule template
   */
  async addAllocationRuleTemplate(hotelId, templateData, userId) {
    try {
      console.log('🎯 [AllotmentSettingsService] Adding allocation rule template for hotel:', hotelId);

      let settings = await HotelAllotmentSettings.findByHotelId(hotelId);

      if (!settings) {
        settings = await HotelAllotmentSettings.createDefaultSettings(hotelId, userId);
      }

      // Generate ID for new template
      const templateId = templateData._id || new mongoose.Types.ObjectId();

      if (templateData._id) {
        // Update existing template
        const templateIndex = settings.allocationRuleTemplates.findIndex(
          t => t._id.toString() === templateData._id
        );

        if (templateIndex >= 0) {
          settings.allocationRuleTemplates[templateIndex] = { ...templateData, _id: templateId };
        } else {
          throw new Error('Template not found');
        }
      } else {
        // Add new template
        settings.addAllocationRuleTemplate({ ...templateData, _id: templateId });
      }

      settings.updatedBy = userId;
      await settings.save();

      console.log('✅ [AllotmentSettingsService] Allocation rule template added successfully');
      return settings;
    } catch (error) {
      console.error('❌ [AllotmentSettingsService] Error adding allocation rule template:', error);
      throw new Error(`Failed to add allocation rule template: ${error.message}`);
    }
  }

  /**
   * Delete allocation rule template
   */
  async deleteAllocationRuleTemplate(hotelId, templateId, userId) {
    try {
      console.log('🗑️ [AllotmentSettingsService] Deleting allocation rule template:', templateId);

      const settings = await HotelAllotmentSettings.findByHotelId(hotelId);

      if (!settings) {
        throw new Error('Hotel settings not found');
      }

      const templateIndex = settings.allocationRuleTemplates.findIndex(
        t => t._id.toString() === templateId
      );

      if (templateIndex === -1) {
        throw new Error('Template not found');
      }

      // Don't delete if it's the only default template of its type
      const template = settings.allocationRuleTemplates[templateIndex];
      if (template.isDefault) {
        const sameTypeDefaults = settings.allocationRuleTemplates.filter(
          t => t.type === template.type && t.isDefault
        );

        if (sameTypeDefaults.length === 1) {
          throw new Error('Cannot delete the only default template of this type');
        }
      }

      settings.allocationRuleTemplates.splice(templateIndex, 1);
      settings.updatedBy = userId;
      await settings.save();

      console.log('✅ [AllotmentSettingsService] Allocation rule template deleted successfully');
      return settings;
    } catch (error) {
      console.error('❌ [AllotmentSettingsService] Error deleting allocation rule template:', error);
      throw new Error(`Failed to delete allocation rule template: ${error.message}`);
    }
  }

  /**
   * Test integration connection
   */
  async testIntegration(hotelId, integrationType, config) {
    try {
      console.log('🧪 [AllotmentSettingsService] Testing integration:', integrationType);

      const results = {
        success: false,
        message: '',
        details: {}
      };

      switch (integrationType) {
        case 'channel_manager':
          results.success = await this.testChannelManagerConnection(config);
          results.message = results.success ? 'Channel manager connection successful' : 'Channel manager connection failed';
          results.details = {
            provider: config?.provider || 'unknown',
            apiUrl: config?.connectionSettings?.apiUrl || 'not provided',
            timestamp: new Date().toISOString()
          };
          break;

        case 'pms':
          results.success = await this.testPMSConnection(config);
          results.message = results.success ? 'PMS connection successful' : 'PMS connection failed';
          results.details = {
            provider: config?.provider || 'unknown',
            apiUrl: config?.connectionSettings?.apiUrl || 'not provided',
            timestamp: new Date().toISOString()
          };
          break;

        case 'webhook':
          results.success = await this.testWebhookEndpoint(config);
          results.message = results.success ? 'Webhook endpoint reachable' : 'Webhook endpoint unreachable';
          results.details = {
            url: config?.url || 'not provided',
            timestamp: new Date().toISOString()
          };
          break;

        default:
          throw new Error(`Unsupported integration type: ${integrationType}`);
      }

      console.log('✅ [AllotmentSettingsService] Integration test completed:', results);
      return results;
    } catch (error) {
      console.error('❌ [AllotmentSettingsService] Error testing integration:', error);
      return {
        success: false,
        message: `Integration test failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Test channel manager connection (mock implementation)
   */
  async testChannelManagerConnection(config) {
    try {
      // Mock implementation - in production, this would make actual API calls
      const hasRequiredSettings = config?.connectionSettings?.apiUrl && config?.connectionSettings?.apiKey;

      if (!hasRequiredSettings) {
        return false;
      }

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock success based on configuration completeness
      return Math.random() > 0.2; // 80% success rate for testing
    } catch (error) {
      console.error('❌ Channel manager test error:', error);
      return false;
    }
  }

  /**
   * Test PMS connection (mock implementation)
   */
  async testPMSConnection(config) {
    try {
      // Mock implementation
      const hasRequiredSettings = config?.connectionSettings?.apiUrl && config?.connectionSettings?.apiKey;

      if (!hasRequiredSettings) {
        return false;
      }

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mock success
      return Math.random() > 0.3; // 70% success rate for testing
    } catch (error) {
      console.error('❌ PMS test error:', error);
      return false;
    }
  }

  /**
   * Test webhook endpoint (mock implementation)
   */
  async testWebhookEndpoint(config) {
    try {
      if (!config?.url) {
        return false;
      }

      // Mock implementation - in production, would send test POST request
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock success based on URL validity
      const urlPattern = /^https?:\/\/.+/;
      return urlPattern.test(config.url);
    } catch (error) {
      console.error('❌ Webhook test error:', error);
      return false;
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(hotelId, userId) {
    try {
      console.log('🔄 [AllotmentSettingsService] Resetting settings to defaults for hotel:', hotelId);

      // Delete existing settings
      await HotelAllotmentSettings.findOneAndDelete({ hotelId });

      // Create new default settings
      const settings = await HotelAllotmentSettings.createDefaultSettings(hotelId, userId);

      console.log('✅ [AllotmentSettingsService] Settings reset to defaults successfully');
      return settings;
    } catch (error) {
      console.error('❌ [AllotmentSettingsService] Error resetting settings:', error);
      throw new Error(`Failed to reset settings: ${error.message}`);
    }
  }

  /**
   * Export settings as JSON
   */
  async exportSettings(hotelId) {
    try {
      console.log('📤 [AllotmentSettingsService] Exporting settings for hotel:', hotelId);

      const settings = await HotelAllotmentSettings.findByHotelId(hotelId);

      if (!settings) {
        throw new Error('Hotel settings not found');
      }

      // Create export data without sensitive information
      const exportData = {
        globalDefaults: settings.globalDefaults,
        defaultChannels: settings.defaultChannels,
        allocationRuleTemplates: settings.allocationRuleTemplates,
        analyticsSettings: {
          calculationFrequency: settings.analyticsSettings.calculationFrequency,
          enableRecommendations: settings.analyticsSettings.enableRecommendations,
          alerts: settings.analyticsSettings.alerts.map(alert => ({
            type: alert.type,
            threshold: alert.threshold,
            isActive: alert.isActive,
            frequency: alert.frequency
            // Exclude recipients for privacy
          })),
          performanceThresholds: settings.analyticsSettings.performanceThresholds
        },
        uiPreferences: settings.uiPreferences,
        exportedAt: new Date().toISOString(),
        version: settings.version
      };

      console.log('✅ [AllotmentSettingsService] Settings exported successfully');
      return exportData;
    } catch (error) {
      console.error('❌ [AllotmentSettingsService] Error exporting settings:', error);
      throw new Error(`Failed to export settings: ${error.message}`);
    }
  }

  /**
   * Import settings from JSON
   */
  async importSettings(hotelId, importData, userId) {
    try {
      console.log('📥 [AllotmentSettingsService] Importing settings for hotel:', hotelId);

      let settings = await HotelAllotmentSettings.findByHotelId(hotelId);

      if (!settings) {
        settings = await HotelAllotmentSettings.createDefaultSettings(hotelId, userId);
      }

      // Validate import data
      if (!importData || typeof importData !== 'object') {
        throw new Error('Invalid import data format');
      }

      // Update settings with imported data
      if (importData.globalDefaults) {
        settings.globalDefaults = { ...settings.globalDefaults, ...importData.globalDefaults };
      }

      if (importData.defaultChannels) {
        settings.defaultChannels = importData.defaultChannels;
      }

      if (importData.allocationRuleTemplates) {
        settings.allocationRuleTemplates = importData.allocationRuleTemplates;
      }

      if (importData.analyticsSettings) {
        settings.analyticsSettings = { ...settings.analyticsSettings, ...importData.analyticsSettings };
      }

      if (importData.uiPreferences) {
        settings.uiPreferences = { ...settings.uiPreferences, ...importData.uiPreferences };
      }

      settings.updatedBy = userId;
      await settings.save();

      console.log('✅ [AllotmentSettingsService] Settings imported successfully');
      return settings;
    } catch (error) {
      console.error('❌ [AllotmentSettingsService] Error importing settings:', error);
      throw new Error(`Failed to import settings: ${error.message}`);
    }
  }

  /**
   * Get settings summary for dashboard
   */
  async getSettingsSummary(hotelId) {
    try {
      const settings = await this.getHotelSettings(hotelId);

      return {
        activeChannelsCount: settings.activeChannelsCount,
        activeAlertsCount: settings.activeAlertsCount,
        integrationStatus: settings.integrationStatus,
        allocationRuleTemplatesCount: settings.allocationRuleTemplates?.length || 0,
        lastUpdated: settings.updatedAt,
        version: settings.version,
        configuration: {
          overbookingEnabled: settings.globalDefaults?.overbookingAllowed || false,
          autoReleaseEnabled: settings.globalDefaults?.autoRelease || false,
          analyticsEnabled: settings.analyticsSettings?.enableRecommendations || false,
          channelManagerConnected: settings.integrationSettings?.channelManager?.isConnected || false,
          pmsConnected: settings.integrationSettings?.pms?.isConnected || false
        }
      };
    } catch (error) {
      console.error('❌ [AllotmentSettingsService] Error getting settings summary:', error);
      throw new Error(`Failed to get settings summary: ${error.message}`);
    }
  }
}

export default new AllotmentSettingsService();