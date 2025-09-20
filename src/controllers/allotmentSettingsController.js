import allotmentSettingsService from '../services/allotmentSettingsService.js';
import { validationResult } from 'express-validator';

const allotmentSettingsController = {
  /**
   * Get hotel allotment settings
   */
  async getHotelSettings(req, res) {
    try {
      const hotelId = req.user?.hotelId || req.params.hotelId || '68c7e027ffdee5575f571414';
      const userId = req.user?.id;

      console.log('🔍 [AllotmentSettingsController] Getting hotel settings for:', hotelId, 'User:', userId);

      const settings = await allotmentSettingsService.getHotelSettings(hotelId, userId);

      res.json({
        success: true,
        data: settings,
        message: 'Hotel settings retrieved successfully'
      });
    } catch (error) {
      console.error('❌ [AllotmentSettingsController] Error getting hotel settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get hotel settings',
        message: error.message
      });
    }
  },

  /**
   * Update global default settings
   */
  async updateGlobalSettings(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const hotelId = req.user?.hotelId || req.params.hotelId || '68c7e027ffdee5575f571414';
      const userId = req.user?.id || 'system';

      console.log('🔧 [AllotmentSettingsController] Updating global settings for hotel:', hotelId);

      const updatedSettings = await allotmentSettingsService.updateGlobalSettings(
        hotelId,
        req.body,
        userId
      );

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Global settings updated successfully'
      });
    } catch (error) {
      console.error('❌ [AllotmentSettingsController] Error updating global settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update global settings',
        message: error.message
      });
    }
  },

  /**
   * Update integration settings
   */
  async updateIntegrationSettings(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const hotelId = req.user?.hotelId || req.params.hotelId || '68c7e027ffdee5575f571414';
      const userId = req.user?.id || 'system';

      console.log('🔧 [AllotmentSettingsController] Updating integration settings for hotel:', hotelId);

      const updatedSettings = await allotmentSettingsService.updateIntegrationSettings(
        hotelId,
        req.body,
        userId
      );

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Integration settings updated successfully'
      });
    } catch (error) {
      console.error('❌ [AllotmentSettingsController] Error updating integration settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update integration settings',
        message: error.message
      });
    }
  },

  /**
   * Update analytics settings
   */
  async updateAnalyticsSettings(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const hotelId = req.user?.hotelId || req.params.hotelId || '68c7e027ffdee5575f571414';
      const userId = req.user?.id || 'system';

      console.log('🔧 [AllotmentSettingsController] Updating analytics settings for hotel:', hotelId);

      const updatedSettings = await allotmentSettingsService.updateAnalyticsSettings(
        hotelId,
        req.body,
        userId
      );

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Analytics settings updated successfully'
      });
    } catch (error) {
      console.error('❌ [AllotmentSettingsController] Error updating analytics settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update analytics settings',
        message: error.message
      });
    }
  },

  /**
   * Add or update allocation rule template
   */
  async addAllocationRuleTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const hotelId = req.user?.hotelId || req.params.hotelId || '68c7e027ffdee5575f571414';
      const userId = req.user?.id || 'system';

      console.log('🎯 [AllotmentSettingsController] Adding allocation rule template for hotel:', hotelId);

      const updatedSettings = await allotmentSettingsService.addAllocationRuleTemplate(
        hotelId,
        req.body,
        userId
      );

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Allocation rule template added successfully'
      });
    } catch (error) {
      console.error('❌ [AllotmentSettingsController] Error adding allocation rule template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add allocation rule template',
        message: error.message
      });
    }
  },

  /**
   * Delete allocation rule template
   */
  async deleteAllocationRuleTemplate(req, res) {
    try {
      const { templateId } = req.params;
      const hotelId = req.user?.hotelId || '68c7e027ffdee5575f571414';
      const userId = req.user?.id || 'system';

      console.log('🗑️ [AllotmentSettingsController] Deleting allocation rule template:', templateId);

      const updatedSettings = await allotmentSettingsService.deleteAllocationRuleTemplate(
        hotelId,
        templateId,
        userId
      );

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Allocation rule template deleted successfully'
      });
    } catch (error) {
      console.error('❌ [AllotmentSettingsController] Error deleting allocation rule template:', error);
      res.status(400).json({
        success: false,
        error: 'Failed to delete allocation rule template',
        message: error.message
      });
    }
  },

  /**
   * Test integration connection
   */
  async testIntegration(req, res) {
    try {
      const { type } = req.params;
      const config = req.body;
      const hotelId = req.user?.hotelId || '68c7e027ffdee5575f571414';

      console.log('🧪 [AllotmentSettingsController] Testing integration:', type);

      const testResult = await allotmentSettingsService.testIntegration(hotelId, type, config);

      res.json({
        success: true,
        data: testResult,
        message: `Integration test completed for ${type}`
      });
    } catch (error) {
      console.error('❌ [AllotmentSettingsController] Error testing integration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test integration',
        message: error.message
      });
    }
  },

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(req, res) {
    try {
      const hotelId = req.user?.hotelId || '68c7e027ffdee5575f571414';
      const userId = req.user?.id || 'system';

      console.log('🔄 [AllotmentSettingsController] Resetting settings to defaults for hotel:', hotelId);

      const defaultSettings = await allotmentSettingsService.resetToDefaults(hotelId, userId);

      res.json({
        success: true,
        data: defaultSettings,
        message: 'Settings reset to defaults successfully'
      });
    } catch (error) {
      console.error('❌ [AllotmentSettingsController] Error resetting settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset settings',
        message: error.message
      });
    }
  },

  /**
   * Export settings
   */
  async exportSettings(req, res) {
    try {
      const hotelId = req.user?.hotelId || '68c7e027ffdee5575f571414';

      console.log('📤 [AllotmentSettingsController] Exporting settings for hotel:', hotelId);

      const exportData = await allotmentSettingsService.exportSettings(hotelId);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="allotment-settings-${hotelId}-${Date.now()}.json"`);

      res.json({
        success: true,
        data: exportData,
        message: 'Settings exported successfully'
      });
    } catch (error) {
      console.error('❌ [AllotmentSettingsController] Error exporting settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export settings',
        message: error.message
      });
    }
  },

  /**
   * Import settings
   */
  async importSettings(req, res) {
    try {
      const hotelId = req.user?.hotelId || '68c7e027ffdee5575f571414';
      const userId = req.user?.id || 'system';
      const importData = req.body;

      console.log('📥 [AllotmentSettingsController] Importing settings for hotel:', hotelId);

      const updatedSettings = await allotmentSettingsService.importSettings(
        hotelId,
        importData,
        userId
      );

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Settings imported successfully'
      });
    } catch (error) {
      console.error('❌ [AllotmentSettingsController] Error importing settings:', error);
      res.status(400).json({
        success: false,
        error: 'Failed to import settings',
        message: error.message
      });
    }
  },

  /**
   * Get settings summary for dashboard
   */
  async getSettingsSummary(req, res) {
    try {
      const hotelId = req.user?.hotelId || '68c7e027ffdee5575f571414';

      console.log('📊 [AllotmentSettingsController] Getting settings summary for hotel:', hotelId);

      const summary = await allotmentSettingsService.getSettingsSummary(hotelId);

      res.json({
        success: true,
        data: summary,
        message: 'Settings summary retrieved successfully'
      });
    } catch (error) {
      console.error('❌ [AllotmentSettingsController] Error getting settings summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get settings summary',
        message: error.message
      });
    }
  },

  /**
   * Validate settings before saving
   */
  async validateSettings(req, res) {
    try {
      const { section, settings } = req.body;

      console.log('🔍 [AllotmentSettingsController] Validating settings for section:', section);

      // Basic validation rules
      const validationErrors = [];

      switch (section) {
        case 'global':
          if (settings.globalDefaults) {
            if (settings.globalDefaults.totalInventory < 1 || settings.globalDefaults.totalInventory > 1000) {
              validationErrors.push('Total inventory must be between 1 and 1000');
            }
            if (settings.globalDefaults.overbookingLimit < 0 || settings.globalDefaults.overbookingLimit > 50) {
              validationErrors.push('Overbooking limit must be between 0 and 50');
            }
          }
          break;

        case 'channels':
          if (settings.defaultChannels) {
            settings.defaultChannels.forEach((channel, index) => {
              if (!channel.channelId || !channel.channelName) {
                validationErrors.push(`Channel ${index + 1}: ID and name are required`);
              }
              if (channel.commission < 0 || channel.commission > 100) {
                validationErrors.push(`Channel ${channel.channelName}: Commission must be between 0 and 100`);
              }
            });
          }
          break;

        case 'analytics':
          if (settings.analyticsSettings?.alerts) {
            settings.analyticsSettings.alerts.forEach((alert, index) => {
              if (!alert.type || typeof alert.threshold !== 'number') {
                validationErrors.push(`Alert ${index + 1}: Type and threshold are required`);
              }
            });
          }
          break;
      }

      const isValid = validationErrors.length === 0;

      res.json({
        success: true,
        data: {
          isValid,
          errors: validationErrors,
          section
        },
        message: isValid ? 'Settings validation passed' : 'Settings validation failed'
      });
    } catch (error) {
      console.error('❌ [AllotmentSettingsController] Error validating settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate settings',
        message: error.message
      });
    }
  },

  /**
   * Get default channel configurations
   */
  async getDefaultChannels(req, res) {
    try {
      const defaultChannels = [
        {
          channelId: 'direct',
          channelName: 'Direct Booking',
          priority: 100,
          commission: 0,
          markup: 0,
          isActive: true,
          rateModifiers: { weekdays: 0, weekends: 5, holidays: 10 }
        },
        {
          channelId: 'booking_com',
          channelName: 'Booking.com',
          priority: 90,
          commission: 15,
          markup: 0,
          isActive: true,
          rateModifiers: { weekdays: 0, weekends: 10, holidays: 15 }
        },
        {
          channelId: 'expedia',
          channelName: 'Expedia',
          priority: 80,
          commission: 18,
          markup: 0,
          isActive: true,
          rateModifiers: { weekdays: 0, weekends: 8, holidays: 12 }
        },
        {
          channelId: 'airbnb',
          channelName: 'Airbnb',
          priority: 70,
          commission: 12,
          markup: 0,
          isActive: false,
          rateModifiers: { weekdays: 0, weekends: 15, holidays: 20 }
        },
        {
          channelId: 'agoda',
          channelName: 'Agoda',
          priority: 60,
          commission: 16,
          markup: 0,
          isActive: false,
          rateModifiers: { weekdays: 0, weekends: 12, holidays: 18 }
        }
      ];

      res.json({
        success: true,
        data: defaultChannels,
        message: 'Default channel configurations retrieved successfully'
      });
    } catch (error) {
      console.error('❌ [AllotmentSettingsController] Error getting default channels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get default channels',
        message: error.message
      });
    }
  }
};

export default allotmentSettingsController;
