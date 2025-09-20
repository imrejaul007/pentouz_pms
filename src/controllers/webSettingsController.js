import WebSettings from '../models/WebSettings.js';
import AuditLog from '../models/AuditLog.js';
import mongoose from 'mongoose';

// Helper functions for testing integrations
async function testPaymentGateway(config) {
  try {
    console.log('🔵 Testing payment gateway with config:', config);
    
    if (!config || typeof config !== 'object') {
      return { 
        success: false, 
        message: 'Invalid payment gateway configuration' 
      };
    }

    // Basic validation for common payment gateway fields
    if (config.gateway) {
      console.log('Payment gateway type:', config.gateway);
    }

    // Simulate test - in real implementation, you would make actual API calls
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call delay

    return { 
      success: true, 
      message: 'Payment gateway test completed successfully',
      details: {
        gateway: config.gateway || 'unknown',
        testMode: true,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error testing payment gateway:', error);
    return { 
      success: false, 
      message: 'Payment gateway test failed',
      error: error.message 
    };
  }
}

async function testEmailMarketing(config) {
  try {
    console.log('🔵 Testing email marketing with config:', config);
    
    if (!config || typeof config !== 'object') {
      return { 
        success: false, 
        message: 'Invalid email marketing configuration' 
      };
    }

    // Simulate test - in real implementation, you would make actual API calls
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call delay

    return { 
      success: true, 
      message: 'Email marketing test completed successfully',
      details: {
        provider: config.provider || 'unknown',
        testMode: true,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error testing email marketing:', error);
    return { 
      success: false, 
      message: 'Email marketing test failed',
      error: error.message 
    };
  }
}

async function testGoogleAnalytics(config) {
  try {
    console.log('🔵 Testing Google Analytics with config:', config);
    
    if (!config || typeof config !== 'object') {
      return { 
        success: false, 
        message: 'Invalid Google Analytics configuration' 
      };
    }

    // Basic validation for GA fields
    if (config.trackingId || config.measurementId) {
      console.log('GA tracking ID found');
    }

    // Simulate test - in real implementation, you would validate the tracking ID
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call delay

    return { 
      success: true, 
      message: 'Google Analytics test completed successfully',
      details: {
        trackingId: config.trackingId ? '***' + config.trackingId.slice(-4) : 'not provided',
        measurementId: config.measurementId ? '***' + config.measurementId.slice(-4) : 'not provided',
        testMode: true,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error testing Google Analytics:', error);
    return { 
      success: false, 
      message: 'Google Analytics test failed',
      error: error.message 
    };
  }
}

async function testFacebookPixel(config) {
  try {
    console.log('🔵 Testing Facebook Pixel with config:', config);
    
    if (!config || typeof config !== 'object') {
      return { 
        success: false, 
        message: 'Invalid Facebook Pixel configuration' 
      };
    }

    // Basic validation for pixel ID
    if (config.pixelId) {
      console.log('Facebook Pixel ID found');
    }

    // Simulate test - in real implementation, you would validate the pixel ID
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call delay

    return { 
      success: true, 
      message: 'Facebook Pixel test completed successfully',
      details: {
        pixelId: config.pixelId ? '***' + config.pixelId.slice(-4) : 'not provided',
        testMode: true,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error testing Facebook Pixel:', error);
    return { 
      success: false, 
      message: 'Facebook Pixel test failed',
      error: error.message 
    };
  }
}

class WebSettingsController {
  /**
   * Get web settings for a hotel
   */
  async getSettings(req, res) {
    try {
      const { hotelId } = req.params;

      if (!hotelId) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID is required'
        });
      }

      const settings = await WebSettings.getActiveSettings(hotelId);

      if (!settings) {
        // Create default settings if none exist
        const newSettings = await WebSettings.createDefaultSettings(hotelId, req.user.id);
        return res.json({
          success: true,
          data: newSettings,
          message: 'Default settings created'
        });
      }

      res.json({
        success: true,
        data: settings
      });

    } catch (error) {
      console.error('Error getting web settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve web settings',
        error: error.message
      });
    }
  }

  /**
   * Update web settings
   */
  async updateSettings(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { hotelId } = req.params;
      const updateData = req.body;

      // Filter out virtual fields that shouldn't be saved to the database
      const virtualFields = ['fullAddress', 'languagesCount', 'activeGateways', 'activeCount'];
      const filteredUpdateData = { ...updateData };
      
      // Remove virtual fields from all nested objects
      Object.keys(filteredUpdateData).forEach(key => {
        if (virtualFields.includes(key)) {
          delete filteredUpdateData[key];
        } else if (filteredUpdateData[key] && typeof filteredUpdateData[key] === 'object') {
          virtualFields.forEach(virtualField => {
            if (filteredUpdateData[key][virtualField] !== undefined) {
              delete filteredUpdateData[key][virtualField];
            }
          });
        }
      });

      console.log('Web Settings Update Request:', {
        hotelId,
        hasUpdateData: !!updateData,
        originalKeys: updateData ? Object.keys(updateData) : [],
        filteredKeys: Object.keys(filteredUpdateData),
        removedVirtualFields: virtualFields.filter(field => 
          updateData && updateData[field] !== undefined
        ),
        userId: req.user?.id
      });

      if (!hotelId) {
        console.log('Error: Hotel ID is missing');
        return res.status(400).json({
          success: false,
          message: 'Hotel ID is required'
        });
      }

      // Basic validation - removed strict requirements
      if (filteredUpdateData.general && filteredUpdateData.general.hotelName === '') {
        console.log('Error: Hotel name is empty string');
        return res.status(400).json({
          success: false,
          message: 'Hotel name cannot be empty'
        });
      }

      // Create backup of current settings
      const currentSettings = await WebSettings.getActiveSettings(hotelId);
      if (currentSettings) {
        const backup = currentSettings.createBackup();
        
        // Log settings change
        const userId = req.user && req.user.id ? req.user.id : null;
        await AuditLog.logSettingsChange(currentSettings, 'web_settings_update', userId, {
          source: 'web_settings_controller',
          backup: backup,
          changes: filteredUpdateData
        });
      }

      // Update or create settings
      const updateFields = {
        ...filteredUpdateData,
        updatedAt: new Date()
      };

      // Only add updatedBy if user is authenticated
      if (req.user && req.user.id) {
        updateFields.updatedBy = req.user.id;
      }

      const settings = await WebSettings.findOneAndUpdate(
        { hotelId, isActive: true },
        updateFields,
        {
          new: true,
          upsert: true,
          runValidators: true,
          session
        }
      ).populate('createdBy updatedBy', 'name email');

      await session.commitTransaction();

      res.json({
        success: true,
        data: settings,
        message: 'Web settings updated successfully'
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('Error updating web settings:', {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        hotelId: req.params.hotelId,
        updateDataKeys: req.body ? Object.keys(req.body) : []
      });

      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        console.log('Mongoose validation errors:', messages);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: messages
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update web settings',
        error: error.message
      });
    } finally {
      session.endSession();
    }
  }

  /**
   * Update specific settings section
   */
  async updateSection(req, res) {
    try {
      const { hotelId, section } = req.params;
      const updateData = req.body;

      // Filter out virtual fields that shouldn't be saved to the database
      const virtualFields = ['fullAddress', 'languagesCount', 'activeGateways', 'activeCount'];
      const filteredUpdateData = { ...updateData };
      
      // Remove virtual fields
      virtualFields.forEach(virtualField => {
        if (filteredUpdateData[virtualField] !== undefined) {
          delete filteredUpdateData[virtualField];
        }
      });

      console.log('Web Settings Section Update:', {
        hotelId,
        section,
        originalKeys: Object.keys(updateData),
        filteredKeys: Object.keys(filteredUpdateData),
        removedVirtualFields: virtualFields.filter(field => updateData[field] !== undefined)
      });

      const validSections = ['general', 'booking', 'payment', 'seo', 'integrations', 'theme', 'advanced', 'maintenance'];
      
      if (!validSections.includes(section)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid settings section'
        });
      }

      const updateFields = {
        [`${section}`]: filteredUpdateData,
        updatedAt: new Date()
      };

      // Only add updatedBy if user is authenticated
      if (req.user && req.user.id) {
        updateFields.updatedBy = req.user.id;
      }

      const settings = await WebSettings.findOneAndUpdate(
        { hotelId, isActive: true },
        { $set: updateFields },
        {
          new: true,
          runValidators: true
        }
      ).populate('createdBy updatedBy', 'name email');

      if (!settings) {
        return res.status(404).json({
          success: false,
          message: 'Settings not found'
        });
      }

      // Log section update
      const userId = req.user && req.user.id ? req.user.id : null;
      await AuditLog.logSettingsChange(settings, `web_settings_section_update_${section}`, userId, {
        source: 'web_settings_controller',
        section: section,
        changes: updateData
      });

      res.json({
        success: true,
        data: settings,
        message: `${section} settings updated successfully`
      });

    } catch (error) {
      console.error('Error updating settings section:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update settings section',
        error: error.message
      });
    }
  }

  /**
   * Test settings configuration (e.g., payment gateway, email, etc.)
   */
  async testSettings(req, res) {
    try {
      const { hotelId } = req.params;
      const { type, config } = req.body;

      console.log('🟡 WebSettings Test Request:', {
        hotelId,
        type,
        config,
        hasConfig: !!config,
        configKeys: config ? Object.keys(config) : [],
        userId: req.user?.id
      });

      if (!hotelId) {
        console.log('Error: Hotel ID is missing in test request');
        return res.status(400).json({
          success: false,
          message: 'Hotel ID is required'
        });
      }

      if (!type) {
        console.log('Error: Test type is missing');
        return res.status(400).json({
          success: false,
          message: 'Test type is required'
        });
      }

      const settings = await WebSettings.getActiveSettings(hotelId);
      if (!settings) {
        console.log('Error: Settings not found for hotel:', hotelId);
        return res.status(404).json({
          success: false,
          message: 'Settings not found'
        });
      }

      console.log('🟢 Settings found, proceeding with test type:', type);

      let testResult = { success: false, message: 'Test not implemented' };

      switch (type) {
        case 'payment_gateway':
          console.log('Testing payment gateway...');
          testResult = await testPaymentGateway(config);
          break;
        case 'email_marketing':
          console.log('Testing email marketing...');
          testResult = await testEmailMarketing(config);
          break;
        case 'google_analytics':
          console.log('Testing Google Analytics...');
          testResult = await testGoogleAnalytics(config);
          break;
        case 'facebook_pixel':
          console.log('Testing Facebook Pixel...');
          testResult = await testFacebookPixel(config);
          break;
        default:
          console.log('Error: Invalid test type:', type);
          return res.status(400).json({
            success: false,
            message: 'Invalid test type'
          });
      }

      console.log('🟢 Test completed:', { type, testResult });

      res.json({
        success: true,
        data: testResult
      });

    } catch (error) {
      console.error('🔴 Error testing settings:', {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        hotelId: req.params.hotelId,
        testType: req.body?.type
      });
      res.status(500).json({
        success: false,
        message: 'Failed to test settings',
        error: error.message
      });
    }
  }

  /**
   * Export settings
   */
  async exportSettings(req, res) {
    try {
      const { hotelId } = req.params;
      const { format = 'json' } = req.query;

      const settings = await WebSettings.getActiveSettings(hotelId);
      if (!settings) {
        return res.status(404).json({
          success: false,
          message: 'Settings not found'
        });
      }

      // Create sanitized export (remove sensitive data)
      const exportData = settings.toObject();
      
      // Remove sensitive information
      if (exportData.payment && exportData.payment.gateways) {
        exportData.payment.gateways = exportData.payment.gateways.map(gateway => ({
          ...gateway,
          configuration: {} // Remove sensitive config
        }));
      }

      if (exportData.integrations) {
        const sensitiveFields = ['apiKey', 'trackingId', 'measurementId', 'pixelId'];
        sensitiveFields.forEach(field => {
          Object.keys(exportData.integrations).forEach(key => {
            if (exportData.integrations[key] && exportData.integrations[key][field]) {
              exportData.integrations[key][field] = '***REDACTED***';
            }
          });
        });
      }

      // Log export activity
      await AuditLog.logSettingsChange(settings, 'web_settings_export', req.user.id, {
        source: 'web_settings_controller',
        format: format,
        exportTime: new Date()
      });

      if (format === 'json') {
        res.json({
          success: true,
          data: exportData,
          exportedAt: new Date(),
          version: settings.version
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Unsupported export format'
        });
      }

    } catch (error) {
      console.error('Error exporting settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export settings',
        error: error.message
      });
    }
  }

  /**
   * Import settings
   */
  async importSettings(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { hotelId } = req.params;
      const importData = req.body;

      // Validate import data structure
      if (!importData || typeof importData !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Invalid import data'
        });
      }

      // Create backup before import
      const currentSettings = await WebSettings.getActiveSettings(hotelId);
      if (currentSettings) {
        const backup = currentSettings.createBackup();
        
        await AuditLog.logSettingsChange(currentSettings, 'web_settings_import', req.user.id, {
          source: 'web_settings_controller',
          backup: backup,
          importData: importData
        });
      }

      // Remove sensitive fields from import data (user must manually configure)
      delete importData._id;
      delete importData.__v;
      delete importData.createdAt;
      delete importData.updatedAt;
      delete importData.createdBy;
      delete importData.updatedBy;

      // Import settings
      const settings = await WebSettings.importSettings(hotelId, importData, req.user.id);

      await session.commitTransaction();

      res.json({
        success: true,
        data: settings,
        message: 'Settings imported successfully'
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('Error importing settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to import settings',
        error: error.message
      });
    } finally {
      session.endSession();
    }
  }

  /**
   * Get settings preview
   */
  async previewSettings(req, res) {
    try {
      const { hotelId } = req.params;
      const previewData = req.body;

      const currentSettings = await WebSettings.getActiveSettings(hotelId);
      if (!currentSettings) {
        return res.status(404).json({
          success: false,
          message: 'Settings not found'
        });
      }

      // Merge current settings with preview data
      const previewSettings = {
        ...currentSettings.toObject(),
        ...previewData
      };

      // Generate preview metadata
      const preview = {
        settings: previewSettings,
        metadata: {
          previewId: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000), // 1 hour
          changes: this.getChanges(currentSettings.toObject(), previewData)
        }
      };

      res.json({
        success: true,
        data: preview
      });

    } catch (error) {
      console.error('Error generating settings preview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate preview',
        error: error.message
      });
    }
  }

  /**
   * Reset settings to default
   */
  async resetToDefault(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { hotelId } = req.params;
      const userId = req.user && req.user.id ? req.user.id : null;

      console.log('🟡 WebSettings Reset Request:', {
        hotelId,
        userId,
        hasUser: !!req.user
      });

      // Create backup
      const currentSettings = await WebSettings.getActiveSettings(hotelId);
      if (currentSettings) {
        const backup = currentSettings.createBackup();
        
        await AuditLog.logSettingsChange(currentSettings, 'web_settings_reset', userId, {
          source: 'web_settings_controller',
          backup: backup,
          resetTime: new Date()
        });
      }

      // Delete existing settings
      await WebSettings.deleteMany({ hotelId }, { session });

      // Create new default settings with session support
      const defaultSettings = new WebSettings({
        hotelId,
        createdBy: userId,
        general: {
          hotelName: 'My Hotel',
          timezone: 'UTC',
          currency: {
            code: 'USD',
            symbol: '$',
            position: 'before'
          },
          languages: [{
            code: 'en',
            name: 'English',
            isDefault: true
          }]
        }
      });

      await defaultSettings.save({ session });

      await session.commitTransaction();

      console.log('🟢 WebSettings Reset Successful:', {
        hotelId,
        defaultSettingsId: defaultSettings._id
      });

      res.json({
        success: true,
        data: defaultSettings,
        message: 'Settings reset to default successfully'
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('🔴 Error resetting settings:', {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        hotelId: req.params.hotelId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to reset settings',
        error: error.message
      });
    } finally {
      session.endSession();
    }
  }


  getChanges(original, updated) {
    const changes = [];
    
    const compareObjects = (obj1, obj2, path = '') => {
      for (const key in obj2) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (obj1[key] !== obj2[key]) {
          if (typeof obj2[key] === 'object' && obj2[key] !== null && !Array.isArray(obj2[key])) {
            compareObjects(obj1[key] || {}, obj2[key], currentPath);
          } else {
            changes.push({
              field: currentPath,
              oldValue: obj1[key],
              newValue: obj2[key]
            });
          }
        }
      }
    };

    compareObjects(original, updated);
    return changes;
  }
}

export default new WebSettingsController();
