import PropertyGroup from '../models/PropertyGroup.js';
import Hotel from '../models/Hotel.js';
import User from '../models/User.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import { offsetPaginate } from '../utils/pagination.js';
import logger from '../utils/logger.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';

/**
 * Property Group Management Controller
 * Handles multi-property chain management operations
 */

// Create a new property group
export const createPropertyGroup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const propertyGroupData = {
      ...req.body,
      ownerId: req.user._id
    };

    const propertyGroup = new PropertyGroup(propertyGroupData);
    await propertyGroup.save();

    // Add audit entry
    await propertyGroup.addAuditEntry('CREATE', req.user._id, propertyGroupData, req.ip);

    logger.info(`Property group created: ${propertyGroup._id}`, {
      userId: req.user._id,
      groupName: propertyGroup.name
    });

    res.status(201).json({
      success: true,
      message: 'Property group created successfully',
      data: propertyGroup
    });

  } catch (error) {
    logger.error('Error creating property group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create property group',
      error: error.message
    });
  }
};

// Get all property groups for the current user
export const getPropertyGroups = async (req, res) => {
  try {
    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      populate: [
        { path: 'properties', select: 'name address.city isActive totalRooms roomCount' }
      ]
    };

    const query = {
      ownerId: req.user._id,
      ...(req.query.status && { status: req.query.status }),
      ...(req.query.groupType && { groupType: req.query.groupType })
    };

    const result = await offsetPaginate(PropertyGroup, query, options);

    // Calculate real metrics for each property group
    for (const group of result.data) {
      const metrics = await calculateGroupMetrics(group);
      group.metrics = metrics;
    }

    console.log(`🏢 PROPERTY GROUPS - Calculated metrics for ${result.data.length} groups`);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    logger.error('Error fetching property groups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch property groups',
      error: error.message
    });
  }
};

// Get a specific property group by ID
export const getPropertyGroupById = async (req, res) => {
  try {
    const { id } = req.params;

    const propertyGroup = await PropertyGroup.findOne({
      _id: id,
      ownerId: req.user._id
    }).populate([
      { path: 'properties', select: 'name address isActive totalRooms metrics' },
      { path: 'ownerId', select: 'name email' }
    ]);

    if (!propertyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Property group not found'
      });
    }

    // Get detailed statistics
    const stats = await PropertyGroup.getGroupStats(id);

    res.json({
      success: true,
      data: {
        ...propertyGroup.toObject(),
        statistics: stats
      }
    });

  } catch (error) {
    logger.error('Error fetching property group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch property group',
      error: error.message
    });
  }
};

// Update a property group
export const updatePropertyGroup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    const propertyGroup = await PropertyGroup.findOne({
      _id: id,
      ownerId: req.user._id
    });

    if (!propertyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Property group not found'
      });
    }

    // Store original data for audit
    const originalData = propertyGroup.toObject();

    // Update the property group
    Object.assign(propertyGroup, updateData);
    await propertyGroup.save();

    // Add audit entry
    await propertyGroup.addAuditEntry('UPDATE', req.user._id, {
      original: originalData,
      updated: updateData
    }, req.ip);

    logger.info(`Property group updated: ${propertyGroup._id}`, {
      userId: req.user._id,
      changes: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: 'Property group updated successfully',
      data: propertyGroup
    });

  } catch (error) {
    logger.error('Error updating property group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update property group',
      error: error.message
    });
  }
};

// Delete a property group
export const deletePropertyGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const propertyGroup = await PropertyGroup.findOne({
      _id: id,
      ownerId: req.user._id
    });

    if (!propertyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Property group not found'
      });
    }

    // Check if there are properties in this group
    const propertyCount = await Hotel.countDocuments({ propertyGroupId: id });
    
    if (propertyCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete property group. ${propertyCount} properties are still associated with this group.`,
        details: {
          associatedProperties: propertyCount
        }
      });
    }

    await PropertyGroup.findByIdAndDelete(id);

    logger.info(`Property group deleted: ${id}`, {
      userId: req.user._id,
      groupName: propertyGroup.name
    });

    res.json({
      success: true,
      message: 'Property group deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting property group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete property group',
      error: error.message
    });
  }
};

// Add properties to a group
export const addPropertiesToGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyIds } = req.body;

    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Property IDs array is required'
      });
    }

    const propertyGroup = await PropertyGroup.findOne({
      _id: id,
      ownerId: req.user._id
    });

    if (!propertyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Property group not found'
      });
    }

    // Update properties to belong to this group
    const updateResult = await Hotel.updateMany(
      {
        _id: { $in: propertyIds },
        ownerId: req.user._id,
        propertyGroupId: { $exists: false } // Only unassigned properties
      },
      {
        $set: {
          propertyGroupId: id,
          'groupSettings.inheritSettings': true,
          'groupSettings.lastSyncAt': new Date(),
          'groupSettings.version': propertyGroup.updatedAt
        }
      }
    );

    // Update group metrics
    await propertyGroup.updateMetrics();

    // Add audit entry
    await propertyGroup.addAuditEntry('ADD_PROPERTIES', req.user._id, {
      propertyIds,
      propertiesAdded: updateResult.modifiedCount
    }, req.ip);

    logger.info(`Properties added to group: ${id}`, {
      userId: req.user._id,
      propertyIds,
      propertiesAdded: updateResult.modifiedCount
    });

    res.json({
      success: true,
      message: `${updateResult.modifiedCount} properties added to group successfully`,
      data: {
        propertiesAdded: updateResult.modifiedCount,
        totalRequested: propertyIds.length
      }
    });

  } catch (error) {
    logger.error('Error adding properties to group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add properties to group',
      error: error.message
    });
  }
};

// Remove properties from a group
export const removePropertiesFromGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyIds } = req.body;

    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Property IDs array is required'
      });
    }

    const propertyGroup = await PropertyGroup.findOne({
      _id: id,
      ownerId: req.user._id
    });

    if (!propertyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Property group not found'
      });
    }

    // Remove properties from this group
    const updateResult = await Hotel.updateMany(
      {
        _id: { $in: propertyIds },
        ownerId: req.user._id,
        propertyGroupId: id
      },
      {
        $unset: {
          propertyGroupId: '',
          groupSettings: ''
        }
      }
    );

    // Update group metrics
    await propertyGroup.updateMetrics();

    // Add audit entry
    await propertyGroup.addAuditEntry('REMOVE_PROPERTIES', req.user._id, {
      propertyIds,
      propertiesRemoved: updateResult.modifiedCount
    }, req.ip);

    logger.info(`Properties removed from group: ${id}`, {
      userId: req.user._id,
      propertyIds,
      propertiesRemoved: updateResult.modifiedCount
    });

    res.json({
      success: true,
      message: `${updateResult.modifiedCount} properties removed from group successfully`,
      data: {
        propertiesRemoved: updateResult.modifiedCount,
        totalRequested: propertyIds.length
      }
    });

  } catch (error) {
    logger.error('Error removing properties from group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove properties from group',
      error: error.message
    });
  }
};

// Update group settings and sync to all properties
export const syncGroupSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const { settingsToSync } = req.body;

    const propertyGroup = await PropertyGroup.findOne({
      _id: id,
      ownerId: req.user._id
    });

    if (!propertyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Property group not found'
      });
    }

    // Update group settings
    if (settingsToSync) {
      Object.assign(propertyGroup.settings, settingsToSync);
      await propertyGroup.save();
    }

    // Sync settings to all properties in the group
    const updateResult = await Hotel.updateMany(
      {
        propertyGroupId: id,
        'groupSettings.inheritSettings': true
      },
      {
        $set: {
          'groupSettings.lastSyncAt': new Date(),
          'groupSettings.version': propertyGroup.updatedAt,
          // Sync specific settings based on inheritance rules
          ...(settingsToSync?.defaultCancellationPolicy && {
            'policies.cancellationPolicy': settingsToSync.defaultCancellationPolicy
          }),
          ...(settingsToSync?.baseCurrency && {
            'settings.currency': settingsToSync.baseCurrency
          }),
          ...(settingsToSync?.timezone && {
            'settings.timezone': settingsToSync.timezone
          })
        }
      }
    );

    // Add audit entry
    await propertyGroup.addAuditEntry('SYNC_SETTINGS', req.user._id, {
      settingsToSync,
      propertiesUpdated: updateResult.modifiedCount
    }, req.ip);

    logger.info(`Group settings synced: ${id}`, {
      userId: req.user._id,
      settingsToSync,
      propertiesUpdated: updateResult.modifiedCount
    });

    res.json({
      success: true,
      message: `Settings synced to ${updateResult.modifiedCount} properties successfully`,
      data: {
        propertiesUpdated: updateResult.modifiedCount,
        syncedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error syncing group settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync group settings',
      error: error.message
    });
  }
};

// Get consolidated dashboard data for all properties in a group
export const getConsolidatedDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '7d' } = req.query;

    const propertyGroup = await PropertyGroup.findOne({
      _id: id,
      ownerId: req.user._id
    });

    if (!propertyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Property group not found'
      });
    }

    // Get all properties in this group
    const properties = await Hotel.find({ 
      propertyGroupId: id,
      isActive: true 
    }).select('_id name address.city totalRooms');

    const propertyIds = properties.map(p => p._id);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    const days = parseInt(period.replace('d', ''));
    startDate.setDate(startDate.getDate() - days);

    // Import models for aggregation
    const Booking = mongoose.model('Booking');
    const RoomAvailability = mongoose.model('RoomAvailability');

    // Get consolidated metrics
    const [bookingStats, availabilityStats, revenueStats] = await Promise.all([
      // Booking statistics
      Booking.aggregate([
        {
          $match: {
            hotelId: { $in: propertyIds },
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$hotelId',
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            averageRate: { $avg: '$totalAmount' },
            statusBreakdown: {
              $push: {
                status: '$status',
                count: 1
              }
            }
          }
        }
      ]),

      // Availability statistics
      RoomAvailability.aggregate([
        {
          $match: {
            hotelId: { $in: propertyIds },
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$hotelId',
            totalRooms: { $sum: '$totalRooms' },
            availableRooms: { $sum: '$availableRooms' },
            soldRooms: { $sum: '$soldRooms' },
            occupancyRate: {
              $avg: {
                $divide: ['$soldRooms', '$totalRooms']
              }
            }
          }
        }
      ]),

      // Revenue trends
      Booking.aggregate([
        {
          $match: {
            hotelId: { $in: propertyIds },
            status: 'completed',
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
            },
            dailyRevenue: { $sum: '$totalAmount' },
            dailyBookings: { $sum: 1 }
          }
        },
        { $sort: { '_id.date': 1 } }
      ])
    ]);

    // Combine data with property information
    const consolidatedData = {
      group: propertyGroup,
      properties: properties.map(property => {
        const bookingData = bookingStats.find(b => b._id.toString() === property._id.toString()) || {};
        const availabilityData = availabilityStats.find(a => a._id.toString() === property._id.toString()) || {};
        
        return {
          ...property.toObject(),
          metrics: {
            totalBookings: bookingData.totalBookings || 0,
            totalRevenue: bookingData.totalRevenue || 0,
            averageRate: bookingData.averageRate || 0,
            occupancyRate: (availabilityData.occupancyRate * 100) || 0,
            availableRooms: availabilityData.availableRooms || 0,
            soldRooms: availabilityData.soldRooms || 0
          }
        };
      }),
      summary: {
        totalProperties: properties.length,
        totalBookings: bookingStats.reduce((sum, b) => sum + (b.totalBookings || 0), 0),
        totalRevenue: bookingStats.reduce((sum, b) => sum + (b.totalRevenue || 0), 0),
        averageOccupancy: availabilityStats.length > 0 
          ? availabilityStats.reduce((sum, a) => sum + (a.occupancyRate || 0), 0) / availabilityStats.length * 100
          : 0,
        period: {
          startDate,
          endDate,
          days
        }
      },
      trends: revenueStats
    };

    res.json({
      success: true,
      data: consolidatedData
    });

  } catch (error) {
    logger.error('Error getting consolidated dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get consolidated dashboard data',
      error: error.message
    });
  }
};

// Get audit log for a property group
export const getPropertyGroupAuditLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const propertyGroup = await PropertyGroup.findOne({
      _id: id,
      ownerId: req.user._id
    }).populate({
      path: 'auditLog.performedBy',
      select: 'name email'
    });

    if (!propertyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Property group not found'
      });
    }

    // Paginate audit log
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    const auditEntries = propertyGroup.auditLog
      .slice(startIndex, endIndex)
      .sort((a, b) => b.performedAt - a.performedAt);

    res.json({
      success: true,
      data: auditEntries,
      pagination: {
        currentPage: parseInt(page),
        totalEntries: propertyGroup.auditLog.length,
        totalPages: Math.ceil(propertyGroup.auditLog.length / limit),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    logger.error('Error getting property group audit log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit log',
      error: error.message
    });
  }
};

// Helper function to calculate real group metrics
const calculateGroupMetrics = async (group) => {
  try {
    console.log(`🏢 CALCULATING METRICS - Group: ${group.name}, Properties: ${group.properties?.length || 0}`);

    let totalRevenue = 0;
    let totalRooms = 0;
    let totalOccupied = 0;
    let totalBookings = 0;
    let activeProperties = 0;

    if (!group.properties || group.properties.length === 0) {
      console.log(`🏢 CALCULATING METRICS - No properties found for group ${group.name}`);
      return {
        totalProperties: 0,
        totalRooms: 0,
        averageOccupancyRate: 0,
        totalRevenue: 0,
        activeUsers: 0
      };
    }

    // Calculate metrics for each property in the group
    for (const property of group.properties) {
      if (!property.isActive) continue;

      activeProperties++;

      // Get property hotel ID (property is a hotel object)
      const hotelId = property._id;
      console.log(`🏢 CALCULATING METRICS - Processing hotel: ${property.name} (${hotelId})`);

      // Get total rooms for this property
      const roomCount = await Room.countDocuments({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        isActive: true
      });

      totalRooms += roomCount;
      console.log(`🏢 CALCULATING METRICS - Hotel ${property.name} has ${roomCount} rooms`);

      // Get current bookings for occupancy
      const today = new Date();
      const currentBookings = await Booking.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        checkIn: { $lte: today },
        checkOut: { $gt: today },
        status: { $in: ['confirmed', 'checked_in'] }
      });

      totalOccupied += currentBookings.length;
      console.log(`🏢 CALCULATING METRICS - Hotel ${property.name} has ${currentBookings.length} occupied rooms`);

      // Get this month's revenue
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const monthlyBookings = await Booking.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        $or: [
          { checkIn: { $gte: monthStart, $lte: monthEnd } },
          { checkOut: { $gte: monthStart, $lte: monthEnd } },
          {
            checkIn: { $lt: monthStart },
            checkOut: { $gt: monthEnd }
          }
        ],
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      });

      const propertyRevenue = monthlyBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
      totalRevenue += propertyRevenue;
      totalBookings += monthlyBookings.length;

      console.log(`🏢 CALCULATING METRICS - Hotel ${property.name} revenue: ₹${propertyRevenue}`);
    }

    // Calculate averages
    const averageOccupancyRate = totalRooms > 0 ? (totalOccupied / totalRooms) * 100 : 0;

    const metrics = {
      totalProperties: activeProperties,
      totalRooms,
      averageOccupancyRate: Math.round(averageOccupancyRate * 100) / 100,
      totalRevenue: Math.round(totalRevenue),
      activeUsers: totalBookings, // Using bookings as a proxy for active users
      // Additional computed metrics
      totalOccupied,
      totalAvailable: totalRooms - totalOccupied
    };

    console.log(`🏢 CALCULATING METRICS - Final metrics for ${group.name}:`, metrics);
    return metrics;

  } catch (error) {
    console.error(`🏢 CALCULATING METRICS - Error calculating metrics for group ${group.name}:`, error);
    return {
      totalProperties: 0,
      totalRooms: 0,
      averageOccupancyRate: 0,
      totalRevenue: 0,
      activeUsers: 0
    };
  }
};

export default {
  createPropertyGroup,
  getPropertyGroups,
  getPropertyGroupById,
  updatePropertyGroup,
  deletePropertyGroup,
  addPropertiesToGroup,
  removePropertiesFromGroup,
  syncGroupSettings,
  getConsolidatedDashboard,
  getPropertyGroupAuditLog
};
