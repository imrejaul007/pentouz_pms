import ChannelConfiguration from '../models/ChannelConfiguration.js';
import rateDistributionService from '../services/rateDistributionService.js';
import otaContentTranslationService from '../services/otaContentTranslationService.js';
import exchangeRateService from '../services/exchangeRateService.js';
import logger from '../utils/logger.js';

class ChannelLocalizationController {
  /**
   * Get all channel configurations for a hotel
   */
  async getChannelConfigurations(req, res) {
    try {
      const { hotelId } = req.params;
      const { includeInactive = false } = req.query;

      const query = { hotelId };
      if (!includeInactive) {
        query['status.isActive'] = true;
      }

      const configurations = await ChannelConfiguration.find(query)
        .sort({ channelName: 1 });

      res.json({
        success: true,
        data: configurations,
        total: configurations.length
      });

    } catch (error) {
      logger.error('Failed to get channel configurations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve channel configurations',
        error: error.message
      });
    }
  }

  /**
   * Create new channel configuration
   */
  async createChannelConfiguration(req, res) {
    try {
      const { hotelId } = req.params;
      const configData = { ...req.body, hotelId };

      // Validate required fields
      if (!configData.channelId || !configData.channelName) {
        return res.status(400).json({
          success: false,
          message: 'Channel ID and name are required'
        });
      }

      // Check if configuration already exists
      const existing = await ChannelConfiguration.getByHotelAndChannel(hotelId, configData.channelId);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Channel configuration already exists for this hotel'
        });
      }

      // Set default values
      if (!configData.languageSettings) {
        configData.languageSettings = {
          primaryLanguage: 'EN',
          supportedLanguages: [
            {
              languageCode: 'EN',
              isActive: true,
              priority: 1,
              translationQuality: 'native'
            }
          ],
          fallbackLanguage: 'EN',
          autoTranslate: true
        };
      }

      if (!configData.currencySettings) {
        configData.currencySettings = {
          baseCurrency: 'USD',
          supportedCurrencies: [
            {
              currencyCode: 'USD',
              isActive: true,
              markup: 0,
              rounding: 'nearest',
              conversionMethod: 'live_rate'
            }
          ],
          autoConvert: true,
          priceUpdateFrequency: 'hourly'
        };
      }

      const configuration = new ChannelConfiguration(configData);
      await configuration.save();

      res.status(201).json({
        success: true,
        data: configuration,
        message: 'Channel configuration created successfully'
      });

    } catch (error) {
      logger.error('Failed to create channel configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create channel configuration',
        error: error.message
      });
    }
  }

  /**
   * Update channel configuration
   */
  async updateChannelConfiguration(req, res) {
    try {
      const { hotelId, channelId } = req.params;
      const updateData = req.body;

      const configuration = await ChannelConfiguration.getByHotelAndChannel(hotelId, channelId);
      if (!configuration) {
        return res.status(404).json({
          success: false,
          message: 'Channel configuration not found'
        });
      }

      // Update configuration
      Object.assign(configuration, updateData);
      await configuration.save();

      res.json({
        success: true,
        data: configuration,
        message: 'Channel configuration updated successfully'
      });

    } catch (error) {
      logger.error('Failed to update channel configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update channel configuration',
        error: error.message
      });
    }
  }

  /**
   * Delete channel configuration
   */
  async deleteChannelConfiguration(req, res) {
    try {
      const { hotelId, channelId } = req.params;

      const result = await ChannelConfiguration.findOneAndDelete({
        hotelId,
        channelId
      });

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Channel configuration not found'
        });
      }

      res.json({
        success: true,
        message: 'Channel configuration deleted successfully'
      });

    } catch (error) {
      logger.error('Failed to delete channel configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete channel configuration',
        error: error.message
      });
    }
  }

  /**
   * Test channel connection
   */
  async testChannelConnection(req, res) {
    try {
      const { hotelId, channelId } = req.params;

      const configuration = await ChannelConfiguration.getByHotelAndChannel(hotelId, channelId);
      if (!configuration) {
        return res.status(404).json({
          success: false,
          message: 'Channel configuration not found'
        });
      }

      // Update status to testing
      configuration.status.connectionStatus = 'testing';
      await configuration.save();

      // Perform connection test based on channel type
      const testResult = await this.performChannelConnectionTest(configuration);

      // Update status based on test result
      configuration.status.connectionStatus = testResult.success ? 'connected' : 'error';
      if (!testResult.success && testResult.error) {
        configuration.status.syncStats.lastError = {
          message: testResult.error.message,
          timestamp: new Date(),
          code: testResult.error.code
        };
      }
      await configuration.save();

      res.json({
        success: testResult.success,
        data: testResult,
        message: testResult.success ? 'Connection test successful' : 'Connection test failed'
      });

    } catch (error) {
      logger.error('Failed to test channel connection:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test channel connection',
        error: error.message
      });
    }
  }

  /**
   * Distribute rates to channels
   */
  async distributeRates(req, res) {
    try {
      const { hotelId } = req.params;
      const { rateData, channels, options = {} } = req.body;

      if (!rateData) {
        return res.status(400).json({
          success: false,
          message: 'Rate data is required'
        });
      }

      let result;

      if (channels && channels.length > 0) {
        // Distribute to specific channels
        result = await this.distributeToSpecificChannels(hotelId, rateData, channels, options);
      } else {
        // Distribute to all active channels
        result = await rateDistributionService.distributeRates(hotelId, rateData);
      }

      res.json({
        success: result.success,
        data: result,
        message: `Rate distribution completed: ${result.successfulChannels}/${result.totalChannels} channels successful`
      });

    } catch (error) {
      logger.error('Failed to distribute rates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to distribute rates',
        error: error.message
      });
    }
  }

  /**
   * Translate content for OTA channels
   */
  async translateContent(req, res) {
    try {
      const { hotelId } = req.params;
      const { contentData, channels, options = {} } = req.body;

      if (!contentData) {
        return res.status(400).json({
          success: false,
          message: 'Content data is required'
        });
      }

      let result;

      if (channels && channels.length > 0) {
        // Translate for specific channels
        result = await this.translateForSpecificChannels(hotelId, contentData, channels, options);
      } else {
        // Translate for all active channels
        result = await otaContentTranslationService.translateHotelContent(hotelId, contentData, options);
      }

      res.json({
        success: result.summary.failedChannels === 0,
        data: result,
        message: `Content translation completed: ${result.summary.successfulChannels}/${result.summary.totalChannels} channels successful`
      });

    } catch (error) {
      logger.error('Failed to translate content:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to translate content',
        error: error.message
      });
    }
  }

  /**
   * Queue content translation for batch processing
   */
  async queueContentTranslation(req, res) {
    try {
      const { hotelId } = req.params;
      const { contentData, options = {} } = req.body;

      if (!contentData) {
        return res.status(400).json({
          success: false,
          message: 'Content data is required'
        });
      }

      const queueId = otaContentTranslationService.queueTranslation(
        hotelId,
        contentData,
        options,
        (error, result) => {
          if (error) {
            logger.error(`Queued translation failed for hotel ${hotelId}:`, error);
          } else {
            logger.info(`Queued translation completed for hotel ${hotelId}`, {
              successfulChannels: result.summary.successfulChannels,
              totalTranslations: result.summary.totalTranslations
            });
          }
        }
      );

      res.json({
        success: true,
        data: { queueId },
        message: 'Content translation queued successfully'
      });

    } catch (error) {
      logger.error('Failed to queue content translation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to queue content translation',
        error: error.message
      });
    }
  }

  /**
   * Get channel distribution status
   */
  async getDistributionStatus(req, res) {
    try {
      const { hotelId } = req.params;

      const status = await rateDistributionService.getDistributionStatus(hotelId);

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('Failed to get distribution status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get distribution status',
        error: error.message
      });
    }
  }

  /**
   * Get supported currencies for channels
   */
  async getSupportedCurrencies(req, res) {
    try {
      const { hotelId } = req.params;
      const { channelId } = req.query;

      let query = { hotelId, 'status.isActive': true };
      if (channelId) {
        query.channelId = channelId;
      }

      const configurations = await ChannelConfiguration.find(query);

      const currencySupport = {};
      for (const config of configurations) {
        currencySupport[config.channelId] = {
          baseCurrency: config.currencySettings.baseCurrency,
          supportedCurrencies: config.activeSupportedCurrencies,
          autoConvert: config.currencySettings.autoConvert,
          updateFrequency: config.currencySettings.priceUpdateFrequency
        };
      }

      res.json({
        success: true,
        data: currencySupport
      });

    } catch (error) {
      logger.error('Failed to get supported currencies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get supported currencies',
        error: error.message
      });
    }
  }

  /**
   * Get supported languages for channels
   */
  async getSupportedLanguages(req, res) {
    try {
      const { hotelId } = req.params;
      const { channelId } = req.query;

      let query = { hotelId, 'status.isActive': true };
      if (channelId) {
        query.channelId = channelId;
      }

      const configurations = await ChannelConfiguration.find(query);

      const languageSupport = {};
      for (const config of configurations) {
        languageSupport[config.channelId] = {
          primaryLanguage: config.languageSettings.primaryLanguage,
          supportedLanguages: config.activeSupportedLanguages,
          autoTranslate: config.languageSettings.autoTranslate,
          translationApprovalRequired: config.languageSettings.translationApprovalRequired
        };
      }

      res.json({
        success: true,
        data: languageSupport
      });

    } catch (error) {
      logger.error('Failed to get supported languages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get supported languages',
        error: error.message
      });
    }
  }

  /**
   * Get channel performance metrics
   */
  async getChannelMetrics(req, res) {
    try {
      const { hotelId } = req.params;
      const { channelId, period = '7d' } = req.query;

      let query = { hotelId, 'status.isActive': true };
      if (channelId) {
        query.channelId = channelId;
      }

      const configurations = await ChannelConfiguration.find(query);

      const metrics = {};
      for (const config of configurations) {
        metrics[config.channelId] = {
          connectionStatus: config.status.connectionStatus,
          syncHealth: config.syncHealthScore,
          performance: config.performance,
          lastSync: config.status.lastSync,
          syncStats: config.status.syncStats,
          uptime: this.calculateUptime(config, period),
          averageResponseTime: config.performance.averageResponseTime
        };
      }

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Failed to get channel metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get channel metrics',
        error: error.message
      });
    }
  }

  /**
   * Sync all channels for a hotel
   */
  async syncAllChannels(req, res) {
    try {
      const { hotelId } = req.params;
      const { syncType = 'full', force = false } = req.body;

      const configurations = await ChannelConfiguration.getActiveChannelsForHotel(hotelId);

      if (!configurations.length) {
        return res.status(404).json({
          success: false,
          message: 'No active channels found for this hotel'
        });
      }

      const syncResults = [];

      for (const config of configurations) {
        try {
          const result = await this.syncChannel(config, syncType, force);
          syncResults.push({
            channelId: config.channelId,
            success: result.success,
            syncedItems: result.syncedItems,
            errors: result.errors
          });
        } catch (error) {
          syncResults.push({
            channelId: config.channelId,
            success: false,
            errors: [error.message]
          });
        }
      }

      const successCount = syncResults.filter(r => r.success).length;

      res.json({
        success: successCount > 0,
        data: {
          totalChannels: configurations.length,
          successfulSyncs: successCount,
          results: syncResults
        },
        message: `Channel sync completed: ${successCount}/${configurations.length} channels successful`
      });

    } catch (error) {
      logger.error('Failed to sync all channels:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync all channels',
        error: error.message
      });
    }
  }

  // Private helper methods

  async performChannelConnectionTest(configuration) {
    try {
      const endpoint = configuration.integrationSettings.endpoints?.inventory || 
                     configuration.integrationSettings.endpoints?.rates;
      
      if (!endpoint) {
        throw new Error('No test endpoint configured');
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': this.buildTestAuthHeader(configuration),
          'Content-Type': 'application/json'
        },
        timeout: configuration.integrationSettings.timeout || 30000
      });

      return {
        success: response.ok,
        statusCode: response.status,
        responseTime: Date.now(), // Simplified for example
        endpoint
      };

    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      };
    }
  }

  buildTestAuthHeader(configuration) {
    const credentials = configuration.integrationSettings.apiCredentials;
    const channelId = configuration.channelId;

    switch (channelId) {
      case 'booking_com':
      case 'agoda':
        return `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`;
      case 'expedia':
      case 'airbnb':
        return `Bearer ${credentials.apiKey}`;
      default:
        return credentials.apiKey ? `Bearer ${credentials.apiKey}` : 
               `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`;
    }
  }

  async distributeToSpecificChannels(hotelId, rateData, channelIds, options) {
    const results = [];
    
    for (const channelId of channelIds) {
      try {
        const config = await ChannelConfiguration.getByHotelAndChannel(hotelId, channelId);
        if (!config) {
          results.push({
            channelId,
            success: false,
            errors: ['Channel configuration not found']
          });
          continue;
        }

        const result = await rateDistributionService.distributeToChannel(config, rateData);
        results.push({
          channelId,
          success: result.success,
          processedRates: result.processedRates,
          errors: result.errors
        });

      } catch (error) {
        results.push({
          channelId,
          success: false,
          errors: [error.message]
        });
      }
    }

    return {
      success: results.some(r => r.success),
      totalChannels: channelIds.length,
      successfulChannels: results.filter(r => r.success).length,
      channels: results
    };
  }

  async translateForSpecificChannels(hotelId, contentData, channelIds, options) {
    // Implementation similar to distributeToSpecificChannels but for translation
    const results = {
      hotelId,
      channels: {},
      summary: {
        totalChannels: channelIds.length,
        successfulChannels: 0,
        failedChannels: 0,
        totalTranslations: 0
      }
    };

    for (const channelId of channelIds) {
      try {
        const config = await ChannelConfiguration.getByHotelAndChannel(hotelId, channelId);
        if (!config) {
          results.channels[channelId] = {
            success: false,
            error: 'Channel configuration not found'
          };
          results.summary.failedChannels++;
          continue;
        }

        const channelResult = await otaContentTranslationService.translateContentForChannel(
          hotelId,
          contentData,
          config,
          options
        );

        results.channels[channelId] = channelResult;
        if (channelResult.success) {
          results.summary.successfulChannels++;
          results.summary.totalTranslations += channelResult.translatedContent.length;
        } else {
          results.summary.failedChannels++;
        }

      } catch (error) {
        results.channels[channelId] = {
          success: false,
          error: error.message
        };
        results.summary.failedChannels++;
      }
    }

    return results;
  }

  calculateUptime(configuration, period) {
    // Simplified uptime calculation
    const stats = configuration.status.syncStats;
    if (stats.totalSyncs === 0) return 100;
    
    return Math.round((stats.successfulSyncs / stats.totalSyncs) * 100);
  }

  async syncChannel(configuration, syncType, force) {
    // Placeholder for channel synchronization logic
    return {
      success: true,
      syncedItems: {
        rates: 0,
        inventory: 0,
        content: 0
      },
      errors: []
    };
  }
}

export default new ChannelLocalizationController();
