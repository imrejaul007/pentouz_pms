import HotelArea from '../models/HotelArea.js';
import Room from '../models/Room.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';

class HotelAreaController {
  // Get all hotel areas with hierarchy
  async getAllAreas(req, res) {
    try {
      const { hotelId } = req.params;
      const {
        areaType,
        status,
        parentAreaId,
        includeHierarchy = 'false',
        includeStats = 'false',
        page = 1,
        limit = 50,
        sortBy = 'displaySettings.displayOrder',
        sortOrder = 'asc'
      } = req.query;

      // Build filter
      const filter = { hotelId };
      if (areaType) filter.areaType = areaType;
      if (status) filter.status = status;
      if (parentAreaId) {
        filter.parentAreaId = parentAreaId === 'null' ? null : parentAreaId;
      }

      if (includeHierarchy === 'true') {
        // Get complete hierarchy
        const hierarchy = await HotelArea.getAreaHierarchy(hotelId);
        return res.json({
          success: true,
          data: { areas: hierarchy }
        });
      }

      // Paginated results
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
        populate: [
          { path: 'parentAreaId', select: 'areaName areaCode areaType' },
          { path: 'assignedStaff.staffId', select: 'firstName lastName email role' },
          { path: 'auditInfo.createdBy auditInfo.updatedBy', select: 'firstName lastName email' }
        ]
      };

      if (includeStats === 'false') {
        options.select = '-statistics -maintenanceInfo.maintenanceSchedule -emergencyInfo';
      }

      const result = await HotelArea.paginate(filter, options);

      res.json({
        success: true,
        data: {
          areas: result.docs,
          pagination: {
            currentPage: result.page,
            totalPages: result.totalPages,
            totalItems: result.totalDocs,
            hasNext: result.hasNextPage,
            hasPrev: result.hasPrevPage
          }
        }
      });
    } catch (error) {
      console.error('Error fetching hotel areas:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch hotel areas',
        error: error.message
      });
    }
  }

  // Get single hotel area by ID
  async getAreaById(req, res) {
    try {
      const { id } = req.params;
      const { includeChildren = 'false', includeRooms = 'false' } = req.query;

      let query = HotelArea.findById(id)
        .populate('parentAreaId', 'areaName areaCode areaType fullPath')
        .populate('assignedStaff.staffId', 'firstName lastName email role')
        .populate('roomTypeDistribution.roomTypeId', 'typeName displayName')
        .populate('auditInfo.createdBy auditInfo.updatedBy', 'firstName lastName email');

      const area = await query;

      if (!area) {
        return res.status(404).json({
          success: false,
          message: 'Hotel area not found'
        });
      }

      const result = { area };

      if (includeChildren === 'true') {
        result.children = await HotelArea.find({
          parentAreaId: area._id,
          status: { $in: ['active', 'under_renovation'] }
        }).sort({ 'displaySettings.displayOrder': 1, areaName: 1 });
      }

      if (includeRooms === 'true') {
        result.rooms = await Room.find({
          hotelAreaId: area._id
        }).select('roomNumber roomTypeId status floorNumber').populate('roomTypeId', 'typeName');
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching hotel area:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch hotel area',
        error: error.message
      });
    }
  }

  // Create new hotel area
  async createArea(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { hotelId } = req.params;
      const areaData = {
        ...req.body,
        hotelId,
        'auditInfo.createdBy': req.user._id,
        'auditInfo.updatedBy': req.user._id
      };

      // Validate parent area exists if specified
      if (areaData.parentAreaId) {
        const parentArea = await HotelArea.findOne({
          _id: areaData.parentAreaId,
          hotelId
        });

        if (!parentArea) {
          return res.status(400).json({
            success: false,
            message: 'Parent area not found'
          });
        }

        // Check hierarchy depth
        if (parentArea.hierarchyLevel >= 9) {
          return res.status(400).json({
            success: false,
            message: 'Maximum hierarchy depth exceeded'
          });
        }
      }

      const area = new HotelArea(areaData);
      await area.save();

      // Populate the saved area
      await area.populate([
        { path: 'parentAreaId', select: 'areaName areaCode areaType' },
        { path: 'auditInfo.createdBy', select: 'firstName lastName email' }
      ]);

      res.status(201).json({
        success: true,
        message: 'Hotel area created successfully',
        data: { area }
      });
    } catch (error) {
      console.error('Error creating hotel area:', error);
      
      if (error.message.includes('Area code already exists')) {
        return res.status(400).json({
          success: false,
          message: 'Area code already exists in this hotel'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create hotel area',
        error: error.message
      });
    }
  }

  // Update hotel area
  async updateArea(req, res) {
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
      const updateData = {
        ...req.body,
        'auditInfo.updatedBy': req.user._id,
        updatedAt: new Date()
      };

      // Check if area exists
      const existingArea = await HotelArea.findById(id);
      if (!existingArea) {
        return res.status(404).json({
          success: false,
          message: 'Hotel area not found'
        });
      }

      // Validate parent area if being updated
      if (updateData.parentAreaId && updateData.parentAreaId !== existingArea.parentAreaId?.toString()) {
        // Prevent circular reference
        if (updateData.parentAreaId === id) {
          return res.status(400).json({
            success: false,
            message: 'Area cannot be its own parent'
          });
        }

        // Check if the new parent would create a circular reference
        const descendants = await HotelArea.find({ fullPath: { $regex: existingArea.areaName } });
        const descendantIds = descendants.map(d => d._id.toString());
        
        if (descendantIds.includes(updateData.parentAreaId)) {
          return res.status(400).json({
            success: false,
            message: 'Cannot set descendant area as parent (circular reference)'
          });
        }

        const parentArea = await HotelArea.findById(updateData.parentAreaId);
        if (!parentArea) {
          return res.status(400).json({
            success: false,
            message: 'Parent area not found'
          });
        }

        if (parentArea.hierarchyLevel >= 9) {
          return res.status(400).json({
            success: false,
            message: 'Maximum hierarchy depth would be exceeded'
          });
        }
      }

      const area = await HotelArea.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).populate([
        { path: 'parentAreaId', select: 'areaName areaCode areaType' },
        { path: 'auditInfo.createdBy auditInfo.updatedBy', select: 'firstName lastName email' }
      ]);

      res.json({
        success: true,
        message: 'Hotel area updated successfully',
        data: { area }
      });
    } catch (error) {
      console.error('Error updating hotel area:', error);
      
      if (error.message.includes('Area code already exists')) {
        return res.status(400).json({
          success: false,
          message: 'Area code already exists in this hotel'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update hotel area',
        error: error.message
      });
    }
  }

  // Delete hotel area
  async deleteArea(req, res) {
    try {
      const { id } = req.params;

      const area = await HotelArea.findById(id);
      if (!area) {
        return res.status(404).json({
          success: false,
          message: 'Hotel area not found'
        });
      }

      // Check if area has children
      const childrenCount = await HotelArea.countDocuments({ parentAreaId: id });
      if (childrenCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete area with child areas. Please reassign or delete child areas first.'
        });
      }

      // Check if area has rooms assigned
      const roomsCount = await Room.countDocuments({ hotelAreaId: id });
      if (roomsCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete area with assigned rooms. Please reassign rooms to other areas first.'
        });
      }

      await HotelArea.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Hotel area deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting hotel area:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete hotel area',
        error: error.message
      });
    }
  }

  // Bulk update area status
  async bulkUpdateStatus(req, res) {
    try {
      const { hotelId } = req.params;
      const { areaIds, status } = req.body;

      if (!Array.isArray(areaIds) || areaIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Area IDs array is required'
        });
      }

      const result = await HotelArea.bulkUpdateStatus(areaIds, status, req.user._id);

      res.json({
        success: true,
        message: `${result.modifiedCount} hotel areas updated successfully`,
        data: {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount
        }
      });
    } catch (error) {
      console.error('Error bulk updating areas:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update hotel areas',
        error: error.message
      });
    }
  }

  // Get area statistics and analytics
  async getAreaStatistics(req, res) {
    try {
      const { hotelId } = req.params;
      const { startDate, endDate, areaType } = req.query;

      const stats = await HotelArea.generateAreaStats(hotelId, { startDate, endDate });

      // Get overall summary
      const summary = await HotelArea.aggregate([
        { $match: { hotelId: mongoose.Types.ObjectId(hotelId) } },
        {
          $group: {
            _id: null,
            totalAreas: { $sum: 1 },
            activeAreas: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            totalRooms: { $sum: '$totalRooms' },
            availableRooms: { $sum: '$availableRooms' },
            averageOccupancy: { $avg: '$statistics.averageOccupancy' },
            totalRevenue: { $sum: '$statistics.totalRevenue' },
            maintenanceRequests: { $sum: '$statistics.maintenanceRequestCount' }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          summary: summary[0] || {},
          areaTypeBreakdown: stats,
          generatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error generating area statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate area statistics',
        error: error.message
      });
    }
  }

  // Update area room counts (utility endpoint)
  async updateRoomCounts(req, res) {
    try {
      const { id } = req.params;

      const area = await HotelArea.findById(id);
      if (!area) {
        return res.status(404).json({
          success: false,
          message: 'Hotel area not found'
        });
      }

      await area.updateRoomCounts();

      res.json({
        success: true,
        message: 'Room counts updated successfully',
        data: {
          totalRooms: area.totalRooms,
          availableRooms: area.availableRooms
        }
      });
    } catch (error) {
      console.error('Error updating room counts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update room counts',
        error: error.message
      });
    }
  }

  // Get area hierarchy tree for specific area
  async getAreaTree(req, res) {
    try {
      const { id } = req.params;

      const area = await HotelArea.findById(id);
      if (!area) {
        return res.status(404).json({
          success: false,
          message: 'Hotel area not found'
        });
      }

      const tree = await area.getHierarchyTree();

      res.json({
        success: true,
        data: { tree }
      });
    } catch (error) {
      console.error('Error getting area tree:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get area hierarchy tree',
        error: error.message
      });
    }
  }

  // Update area statistics
  async updateAreaStatistics(req, res) {
    try {
      const { id } = req.params;

      const area = await HotelArea.findById(id);
      if (!area) {
        return res.status(404).json({
          success: false,
          message: 'Hotel area not found'
        });
      }

      await area.updateStatistics();

      res.json({
        success: true,
        message: 'Area statistics updated successfully',
        data: {
          statistics: area.statistics
        }
      });
    } catch (error) {
      console.error('Error updating area statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update area statistics',
        error: error.message
      });
    }
  }

  // Assign staff to area
  async assignStaff(req, res) {
    try {
      const { id } = req.params;
      const { staffAssignments } = req.body;

      const area = await HotelArea.findById(id);
      if (!area) {
        return res.status(404).json({
          success: false,
          message: 'Hotel area not found'
        });
      }

      // Validate staff assignments
      if (!Array.isArray(staffAssignments)) {
        return res.status(400).json({
          success: false,
          message: 'Staff assignments must be an array'
        });
      }

      area.assignedStaff = staffAssignments;
      area.auditInfo.updatedBy = req.user._id;
      await area.save();

      await area.populate('assignedStaff.staffId', 'firstName lastName email role');

      res.json({
        success: true,
        message: 'Staff assigned successfully',
        data: {
          assignedStaff: area.assignedStaff
        }
      });
    } catch (error) {
      console.error('Error assigning staff:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign staff',
        error: error.message
      });
    }
  }

  // Get areas by type
  async getAreasByType(req, res) {
    try {
      const { hotelId, areaType } = req.params;

      const areas = await HotelArea.find({
        hotelId,
        areaType,
        status: { $in: ['active', 'under_renovation'] }
      })
      .select('areaName areaCode totalRooms availableRooms statistics displaySettings')
      .sort({ 'displaySettings.displayOrder': 1, areaName: 1 });

      res.json({
        success: true,
        data: { areas }
      });
    } catch (error) {
      console.error('Error fetching areas by type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch areas by type',
        error: error.message
      });
    }
  }
}

export default new HotelAreaController();
