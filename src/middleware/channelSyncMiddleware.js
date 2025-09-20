import mongoose from 'mongoose';
import { Channel } from '../models/ChannelManager.js';
import RoomAvailability from '../models/RoomAvailability.js';
import AuditLog from '../models/AuditLog.js';
import BookingComService from '../services/channels/bookingComService.js';

/**
 * Channel Sync Middleware
 * Automatically triggers synchronization when availability or rates change
 */

class ChannelSyncMiddleware {
  
  constructor() {
    this.syncQueue = new Map();
    this.isProcessing = false;
    this.channelServices = {
      'booking.com': new BookingComService()
    };
    
    // Process sync queue every 5 minutes
    this.startSyncProcessor();
  }

  /**
   * Middleware to capture availability changes
   */
  static captureAvailabilityChange() {
    return async (req, res, next) => {
      const originalSend = res.send;
      
      res.send = function(data) {
        // Call original send first
        originalSend.call(this, data);
        
        // If request was successful and involved availability changes
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const instance = ChannelSyncMiddleware.getInstance();
          instance.queueAvailabilitySync(req);
        }
      };
      
      next();
    };
  }

  /**
   * Middleware to capture rate changes
   */
  static captureRateChange() {
    return async (req, res, next) => {
      const originalSend = res.send;
      
      res.send = function(data) {
        originalSend.call(this, data);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const instance = ChannelSyncMiddleware.getInstance();
          instance.queueRateSync(req);
        }
      };
      
      next();
    };
  }

  /**
   * Queue availability changes for sync
   */
  async queueAvailabilitySync(req) {
    try {
      const { hotelId, roomTypeId } = this.extractSyncData(req);
      if (!hotelId || !roomTypeId) return;

      const syncKey = `avail_${hotelId}_${roomTypeId}`;
      
      // Add to sync queue with timestamp
      this.syncQueue.set(syncKey, {
        type: 'availability',
        hotelId,
        roomTypeId,
        timestamp: new Date(),
        priority: req.body.urgent ? 'high' : 'normal'
      });

      console.log(`📋 Queued availability sync: ${syncKey}`);
      
    } catch (error) {
      console.error('Failed to queue availability sync:', error);
    }
  }

  /**
   * Queue rate changes for sync
   */
  async queueRateSync(req) {
    try {
      const { hotelId, roomTypeId } = this.extractSyncData(req);
      if (!hotelId || !roomTypeId) return;

      const syncKey = `rate_${hotelId}_${roomTypeId}`;
      
      this.syncQueue.set(syncKey, {
        type: 'rate',
        hotelId,
        roomTypeId,
        timestamp: new Date(),
        priority: 'normal'
      });

      console.log(`📋 Queued rate sync: ${syncKey}`);
      
    } catch (error) {
      console.error('Failed to queue rate sync:', error);
    }
  }

  /**
   * Extract sync data from request
   */
  extractSyncData(req) {
    // Extract from URL params or body
    const hotelId = req.params.hotelId || req.body.hotelId || req.user?.hotelId;
    const roomTypeId = req.params.roomTypeId || req.body.roomTypeId;
    
    return { hotelId, roomTypeId };
  }

  /**
   * Start the sync processor
   */
  startSyncProcessor() {
    setInterval(async () => {
      if (!this.isProcessing && this.syncQueue.size > 0) {
        await this.processSyncQueue();
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    console.log('🔄 Channel sync processor started');
    console.log('🔍 DEBUG: Channel sync processor initialization completed');
  }

  /**
   * Process the sync queue
   */
  async processSyncQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log(`🔄 Processing ${this.syncQueue.size} sync items...`);
    
    try {
      // Group sync items by hotel and room type
      const syncGroups = this.groupSyncItems();
      
      for (const [groupKey, items] of syncGroups) {
        await this.processSyncGroup(groupKey, items);
      }
      
      // Clear processed items
      this.syncQueue.clear();
      
    } catch (error) {
      console.error('Sync queue processing failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Group sync items by hotel and room type
   */
  groupSyncItems() {
    const groups = new Map();
    
    for (const [key, item] of this.syncQueue) {
      const groupKey = `${item.hotelId}_${item.roomTypeId}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          hotelId: item.hotelId,
          roomTypeId: item.roomTypeId,
          items: []
        });
      }
      
      groups.get(groupKey).items.push(item);
    }
    
    return groups;
  }

  /**
   * Process a sync group
   */
  async processSyncGroup(groupKey, group) {
    try {
      const { hotelId, roomTypeId } = group;
      
      // Find active channels for this hotel
      const activeChannels = await Channel.find({
        hotelId,
        isActive: true,
        connectionStatus: 'connected'
      });

      if (activeChannels.length === 0) {
        console.log(`No active channels for hotel ${hotelId}`);
        return;
      }

      // Get date range for sync (next 30 days)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      // Process each channel
      for (const channel of activeChannels) {
        await this.syncToChannel(channel, roomTypeId, startDate, endDate, group.items);
      }

    } catch (error) {
      console.error(`Failed to process sync group ${groupKey}:`, error);
    }
  }

  /**
   * Sync to a specific channel
   */
  async syncToChannel(channel, roomTypeId, startDate, endDate, syncItems) {
    try {
      const channelService = this.channelServices[channel.category];
      if (!channelService) {
        console.warn(`No service available for channel ${channel.category}`);
        return;
      }

      const syncResult = await channelService.syncRatesAndAvailability(
        channel.channelId,
        startDate,
        endDate
      );

      if (syncResult.success) {
        console.log(`✅ Synced to ${channel.name}: ${syncResult.message}`);
        
        // Update channel's last sync time
        channel.lastSync.rates = new Date();
        channel.lastSync.inventory = new Date();
        await channel.save();

        // Log successful sync
        await AuditLog.logChannelSync(
          channel.hotelId,
          channel,
          {
            tableName: 'RoomAvailability',
            recordId: roomTypeId,
            newValues: {
              syncItems: syncItems.length,
              dateRange: { startDate, endDate }
            }
          },
          true
        );

      } else {
        console.error(`❌ Sync failed for ${channel.name}: ${syncResult.error}`);
        
        // Log failed sync
        await AuditLog.logChannelSync(
          channel.hotelId,
          channel,
          {
            tableName: 'RoomAvailability',
            recordId: roomTypeId,
            newValues: {
              error: syncResult.error,
              syncItems: syncItems.length
            }
          },
          false
        );
      }

    } catch (error) {
      console.error(`Channel sync error for ${channel.name}:`, error);
    }
  }

  /**
   * Manual sync trigger
   */
  async triggerManualSync(hotelId, roomTypeId = null, channelId = null) {
    try {
      console.log('🔥 Triggering manual sync...');
      
      // Build query for channels
      const channelQuery = { hotelId, isActive: true };
      if (channelId) channelQuery.channelId = channelId;
      
      const channels = await Channel.find(channelQuery);
      
      if (channels.length === 0) {
        return {
          success: false,
          message: 'No active channels found'
        };
      }

      const results = [];
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      for (const channel of channels) {
        const channelService = this.channelServices[channel.category];
        if (!channelService) continue;

        const result = await channelService.syncRatesAndAvailability(
          channel.channelId,
          startDate,
          endDate
        );

        results.push({
          channel: channel.name,
          success: result.success,
          message: result.message,
          recordsSynced: result.totalSynced || 0
        });
      }

      return {
        success: true,
        message: `Manual sync completed for ${channels.length} channels`,
        results
      };

    } catch (error) {
      console.error('Manual sync failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      queueSize: this.syncQueue.size,
      isProcessing: this.isProcessing,
      queuedItems: Array.from(this.syncQueue.values()).map(item => ({
        type: item.type,
        hotelId: item.hotelId,
        roomTypeId: item.roomTypeId,
        timestamp: item.timestamp,
        priority: item.priority
      }))
    };
  }

  /**
   * Singleton instance
   */
  static getInstance() {
    if (!this.instance) {
      this.instance = new ChannelSyncMiddleware();
    }
    return this.instance;
  }
}

// Initialize singleton instance
const syncMiddleware = ChannelSyncMiddleware.getInstance();

export default ChannelSyncMiddleware;
export { syncMiddleware };
