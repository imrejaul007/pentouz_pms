import { Channel, InventorySync, ReservationMapping, RatePurityLog, ChannelPerformance, OverbookingRule } from '../models/ChannelManager.js';
import ChannelManagerService from '../services/channelManager.js';
import { v4 as uuidv4 } from 'uuid';

const channelManager = new ChannelManagerService();

// Channel Management
export const createChannel = async (req, res) => {
  try {
    const channelData = {
      ...req.body,
      channelId: uuidv4(),
      connectionStatus: 'pending'
    };
    
    const channel = new Channel(channelData);
    await channel.save();
    
    res.status(201).json({
      success: true,
      data: channel
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getChannels = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    const filter = {};
    
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const channels = await Channel.find(filter)
      .populate('roomMappings.hotelRoomTypeId', 'name')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: channels
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getChannel = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id)
      .populate('roomMappings.hotelRoomTypeId', 'name');
    
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }
    
    res.json({
      success: true,
      data: channel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateChannel = async (req, res) => {
  try {
    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }
    
    res.json({
      success: true,
      data: channel
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteChannel = async (req, res) => {
  try {
    const channel = await Channel.findByIdAndDelete(req.params.id);
    
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Channel deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const testChannelConnection = async (req, res) => {
  try {
    const { channelId } = req.params;
    const channel = await Channel.findById(channelId);
    
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // Test connection based on channel type
    const connector = channelManager.connectors[channel.category];
    
    if (!connector) {
      return res.status(400).json({
        success: false,
        message: `No connector available for ${channel.category}`
      });
    }

    // Attempt a test connection
    try {
      const testResult = await connector.testConnection(channel.credentials);
      
      // Update channel status
      channel.connectionStatus = testResult.success ? 'connected' : 'error';
      await channel.save();
      
      res.json({
        success: true,
        data: {
          connectionStatus: channel.connectionStatus,
          testResult
        }
      });
    } catch (error) {
      channel.connectionStatus = 'error';
      await channel.save();
      
      res.status(400).json({
        success: false,
        message: 'Connection test failed: ' + error.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Synchronization
export const syncToChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { roomTypeId, startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }
    
    const result = await channelManager.syncToChannel(channelId, roomTypeId, {
      startDate,
      endDate
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const syncToAllChannels = async (req, res) => {
  try {
    const { roomTypeId, startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }
    
    const results = await channelManager.syncToAllChannels(roomTypeId, {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    });
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getSyncHistory = async (req, res) => {
  try {
    const { channelId, roomTypeId, startDate, endDate, status } = req.query;
    const filter = {};
    
    if (channelId) filter.channel = channelId;
    if (roomTypeId) filter.roomType = roomTypeId;
    if (status) filter.syncStatus = status;
    
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const syncHistory = await InventorySync.find(filter)
      .populate('channel', 'name category')
      .populate('roomType', 'name')
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({
      success: true,
      data: syncHistory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Reservation Management
export const pullReservations = async (req, res) => {
  try {
    const { channelId } = req.params;
    
    let results;
    if (channelId === 'all') {
      results = await channelManager.pullReservationsFromAllChannels();
    } else {
      const channelResults = await channelManager.pullReservationsFromChannel(channelId);
      results = [channelResults];
    }
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getReservationMappings = async (req, res) => {
  try {
    const { channelId, status } = req.query;
    const filter = {};
    
    if (channelId) filter.channel = channelId;
    if (status) filter.status = status;
    
    const mappings = await ReservationMapping.find(filter)
      .populate('hotelReservationId')
      .populate('channel', 'name category')
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({
      success: true,
      data: mappings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Rate Parity Monitoring
export const monitorRateParity = async (req, res) => {
  try {
    const { roomTypeId, startDate, endDate } = req.body;
    
    if (!roomTypeId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Room type ID, start date, and end date are required'
      });
    }
    
    const result = await channelManager.monitorRateParity(roomTypeId, {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getRateParityLogs = async (req, res) => {
  try {
    const { roomTypeId, startDate, endDate, violationsOnly } = req.query;
    const filter = {};
    
    if (roomTypeId) filter.roomType = roomTypeId;
    
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (violationsOnly === 'true') {
      filter.overallCompliance = false;
    }
    
    const logs = await RatePurityLog.find(filter)
      .populate('roomType', 'name')
      .populate('channelRates.channel', 'name category')
      .populate('violations.channel', 'name category')
      .sort({ date: -1 })
      .limit(100);
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Channel Performance
export const getChannelPerformance = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { startDate, endDate } = req.query;

    if (!channelId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Channel ID, start date, and end date are required'
      });
    }
    
    const performance = await channelManager.getChannelPerformance(channelId, {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    });
    
    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAllChannelsPerformance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }
    
    const channels = await Channel.find({ isActive: true });
    const performanceData = [];
    
    for (const channel of channels) {
      try {
        const performance = await channelManager.getChannelPerformance(channel._id, {
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        });
        
        performanceData.push({
          channel: {
            id: channel._id,
            name: channel.name,
            category: channel.category,
            type: channel.type
          },
          performance
        });
      } catch (error) {
        console.error(`Error getting performance for channel ${channel.name}:`, error);
      }
    }
    
    res.json({
      success: true,
      data: performanceData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Overbooking Protection
export const checkOverbooking = async (req, res) => {
  try {
    const { roomTypeId, date } = req.body;
    
    if (!roomTypeId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Room type ID and date are required'
      });
    }
    
    const result = await channelManager.preventOverbooking(roomTypeId, new Date(date));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const createOverbookingRule = async (req, res) => {
  try {
    const ruleData = {
      ...req.body,
      ruleId: uuidv4()
    };
    
    const rule = new OverbookingRule(ruleData);
    await rule.save();
    
    res.status(201).json({
      success: true,
      data: rule
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getOverbookingRules = async (req, res) => {
  try {
    const rules = await OverbookingRule.find()
      .populate('roomType', 'name')
      .populate('channels.channel', 'name category')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Dashboard and Analytics
export const getDashboardStats = async (req, res) => {
  try {
    const totalChannels = await Channel.countDocuments({ isActive: true });
    const connectedChannels = await Channel.countDocuments({ 
      isActive: true, 
      connectionStatus: 'connected' 
    });
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const todaysSyncs = await InventorySync.countDocuments({
      createdAt: { $gte: today }
    });
    
    const successfulSyncs = await InventorySync.countDocuments({
      createdAt: { $gte: yesterday },
      syncStatus: 'success'
    });
    
    const failedSyncs = await InventorySync.countDocuments({
      createdAt: { $gte: yesterday },
      syncStatus: 'failed'
    });
    
    const totalSyncs = await InventorySync.countDocuments({
      createdAt: { $gte: yesterday }
    });
    
    const syncSuccessRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;
    
    // Get recent sync failures
    const recentFailures = await InventorySync.find({
      syncStatus: 'failed',
      createdAt: { $gte: yesterday }
    })
    .populate('channel', 'name category')
    .populate('roomType', 'name')
    .sort({ createdAt: -1 })
    .limit(5);
    
    res.json({
      success: true,
      data: {
        totalChannels,
        connectedChannels,
        connectionRate: totalChannels > 0 ? (connectedChannels / totalChannels) * 100 : 0,
        todaysSyncs,
        syncSuccessRate,
        recentFailures
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getChannelAnalytics = async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    let startDate = new Date();
    switch (period) {
      case '1d':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    const channelMetrics = await ChannelPerformance.aggregate([
      {
        $match: {
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$channel',
          totalBookings: { $sum: '$metrics.bookings' },
          totalRevenue: { $sum: '$metrics.revenue' },
          totalCommission: { $sum: '$metrics.commission' },
          avgConversionRate: { $avg: '$metrics.conversionRate' },
          avgClickThroughRate: { $avg: '$metrics.clickThroughRate' }
        }
      },
      {
        $lookup: {
          from: 'channels',
          localField: '_id',
          foreignField: '_id',
          as: 'channel'
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        period,
        channels: channelMetrics
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  createChannel,
  getChannels,
  getChannel,
  updateChannel,
  deleteChannel,
  testChannelConnection,
  syncToChannel,
  syncToAllChannels,
  getSyncHistory,
  pullReservations,
  getReservationMappings,
  monitorRateParity,
  getRateParityLogs,
  getChannelPerformance,
  getAllChannelsPerformance,
  checkOverbooking,
  createOverbookingRule,
  getOverbookingRules,
  getDashboardStats,
  getChannelAnalytics
};
