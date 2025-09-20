import PhoneExtension from '../models/PhoneExtension.js';
import phoneDirectoryService from '../services/phoneDirectoryService.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';

class PhoneExtensionController {
  // Get all phone extensions for a hotel
  async getPhoneExtensions(req, res) {
    try {
      const { hotelId } = req.params;
      const {
        page = 1,
        limit = 50,
        search,
        phoneType,
        status,
        floor,
        category,
        sortBy = 'extensionNumber',
        sortOrder = 'asc',
        includeStats = false
      } = req.query;

      // Build filter query
      const filter = { hotelId };

      if (search) {
        filter.$or = [
          { extensionNumber: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
          { roomNumber: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      if (phoneType) {
        filter.phoneType = phoneType;
      }

      if (status) {
        filter.status = status;
      }

      if (floor) {
        filter['location.floor'] = parseInt(floor);
      }

      if (category) {
        filter['directorySettings.category'] = category;
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      let query = PhoneExtension.find(filter)
        .populate('roomInfo', 'roomNumber floor roomType status')
        .populate('hotelInfo', 'name')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

      if (!includeStats) {
        query = query.select('-usageStats -auditInfo.version');
      }

      const [extensions, totalCount] = await Promise.all([
        query.exec(),
        PhoneExtension.countDocuments(filter)
      ]);

      // Get summary statistics
      const summary = await PhoneExtension.aggregate([
        { $match: { hotelId: mongoose.Types.ObjectId(hotelId) } },
        {
          $group: {
            _id: null,
            totalExtensions: { $sum: 1 },
            activeExtensions: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            inactiveExtensions: {
              $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
            },
            maintenanceExtensions: {
              $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] }
            },
            assignedToRooms: {
              $sum: { $cond: [{ $ne: ['$roomId', null] }, 1, 0] }
            },
            phoneTypeBreakdown: {
              $push: '$phoneType'
            }
          }
        }
      ]);

      // Process phone type breakdown
      const phoneTypeStats = {};
      if (summary.length > 0 && summary[0].phoneTypeBreakdown) {
        summary[0].phoneTypeBreakdown.forEach(type => {
          phoneTypeStats[type] = (phoneTypeStats[type] || 0) + 1;
        });
      }

      res.status(200).json({
        status: 'success',
        data: {
          extensions,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalCount,
            hasNextPage: skip + extensions.length < totalCount,
            hasPrevPage: parseInt(page) > 1
          },
          summary: summary.length > 0 ? {
            ...summary[0],
            phoneTypeStats
          } : {
            totalExtensions: 0,
            activeExtensions: 0,
            inactiveExtensions: 0,
            maintenanceExtensions: 0,
            assignedToRooms: 0,
            phoneTypeStats: {}
          }
        }
      });
    } catch (error) {
      console.error('Error fetching phone extensions:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch phone extensions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get single phone extension
  async getPhoneExtension(req, res) {
    try {
      const { id } = req.params;
      const { includeUsageStats = false } = req.query;

      let query = PhoneExtension.findById(id)
        .populate('roomInfo', 'roomNumber floor roomType status amenities')
        .populate('hotelInfo', 'name')
        .populate('auditInfo.createdBy', 'firstName lastName email')
        .populate('auditInfo.updatedBy', 'firstName lastName email');

      if (!includeUsageStats) {
        query = query.select('-usageStats.peakUsageHours');
      }

      const extension = await query.exec();

      if (!extension) {
        return res.status(404).json({
          status: 'error',
          message: 'Phone extension not found'
        });
      }

      res.status(200).json({
        status: 'success',
        data: extension
      });
    } catch (error) {
      console.error('Error fetching phone extension:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch phone extension',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Create new phone extension
  async createPhoneExtension(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { hotelId } = req.params;
      const extensionData = {
        ...req.body,
        hotelId,
        auditInfo: {
          createdBy: req.user._id
        }
      };

      // Generate extension number if not provided
      if (!extensionData.extensionNumber) {
        const prefix = req.body.extensionPrefix || '';
        extensionData.extensionNumber = await PhoneExtension.generateNextExtension(hotelId, prefix);
      }

      const extension = new PhoneExtension(extensionData);
      await extension.save();

      // Populate the saved extension
      await extension.populate([
        { path: 'roomInfo', select: 'roomNumber floor roomType status' },
        { path: 'hotelInfo', select: 'name' },
        { path: 'auditInfo.createdBy', select: 'firstName lastName email' }
      ]);

      res.status(201).json({
        status: 'success',
        message: 'Phone extension created successfully',
        data: extension
      });
    } catch (error) {
      console.error('Error creating phone extension:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: Object.keys(error.errors).map(field => ({
            field,
            message: error.errors[field].message
          }))
        });
      }

      if (error.code === 11000) {
        return res.status(400).json({
          status: 'error',
          message: 'Extension number already exists in this hotel'
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to create phone extension',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Update phone extension
  async updatePhoneExtension(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const updateData = {
        ...req.body,
        'auditInfo.updatedBy': req.user._id
      };

      const extension = await PhoneExtension.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).populate([
        { path: 'roomInfo', select: 'roomNumber floor roomType status' },
        { path: 'hotelInfo', select: 'name' },
        { path: 'auditInfo.createdBy', select: 'firstName lastName email' },
        { path: 'auditInfo.updatedBy', select: 'firstName lastName email' }
      ]);

      if (!extension) {
        return res.status(404).json({
          status: 'error',
          message: 'Phone extension not found'
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Phone extension updated successfully',
        data: extension
      });
    } catch (error) {
      console.error('Error updating phone extension:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: Object.keys(error.errors).map(field => ({
            field,
            message: error.errors[field].message
          }))
        });
      }

      if (error.code === 11000) {
        return res.status(400).json({
          status: 'error',
          message: 'Extension number already exists in this hotel'
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to update phone extension',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Delete phone extension
  async deletePhoneExtension(req, res) {
    try {
      const { id } = req.params;
      
      const extension = await PhoneExtension.findById(id);
      if (!extension) {
        return res.status(404).json({
          status: 'error',
          message: 'Phone extension not found'
        });
      }

      // Check if extension is currently in use (could add more business logic here)
      if (extension.status === 'active' && extension.isAvailable) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot delete an active extension. Please deactivate it first.'
        });
      }

      await PhoneExtension.findByIdAndDelete(id);

      res.status(200).json({
        status: 'success',
        message: 'Phone extension deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting phone extension:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete phone extension',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Bulk update phone extension status
  async bulkUpdateStatus(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { hotelId } = req.params;
      const { extensionIds, status } = req.body;

      const result = await PhoneExtension.bulkUpdateStatus(
        extensionIds,
        status,
        req.user._id
      );

      res.status(200).json({
        status: 'success',
        message: `Successfully updated ${result.modifiedCount} phone extensions`,
        data: {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount
        }
      });
    } catch (error) {
      console.error('Error bulk updating phone extensions:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update phone extensions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get phone directory
  async getPhoneDirectory(req, res) {
    try {
      const { hotelId } = req.params;
      const { category, format = 'json', includeInternal = false } = req.query;

      const directory = await phoneDirectoryService.generateDirectory(
        hotelId,
        {
          category,
          includeInternal: includeInternal === 'true'
        }
      );

      if (format === 'pdf') {
        const pdfBuffer = await phoneDirectoryService.generateDirectoryPDF(directory);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="phone-directory-${hotelId}.pdf"`);
        return res.send(pdfBuffer);
      }

      if (format === 'csv') {
        const csvData = await phoneDirectoryService.generateDirectoryCSV(directory);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="phone-directory-${hotelId}.csv"`);
        return res.send(csvData);
      }

      res.status(200).json({
        status: 'success',
        data: directory
      });
    } catch (error) {
      console.error('Error generating phone directory:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate phone directory',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Bulk assign extensions to rooms
  async bulkAssignToRooms(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { hotelId } = req.params;
      const { assignments } = req.body; // Array of { extensionId, roomId }

      const result = await phoneDirectoryService.bulkAssignExtensions(
        hotelId,
        assignments,
        req.user._id
      );

      res.status(200).json({
        status: 'success',
        message: `Successfully assigned ${result.successCount} extensions`,
        data: result
      });
    } catch (error) {
      console.error('Error bulk assigning extensions:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to assign extensions to rooms',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Generate usage report
  async getUsageReport(req, res) {
    try {
      const { hotelId } = req.params;
      const { startDate, endDate, phoneType } = req.query;

      const dateRange = {};
      if (startDate) dateRange.startDate = startDate;
      if (endDate) dateRange.endDate = endDate;

      const report = await PhoneExtension.getUsageReport(hotelId, dateRange);

      // Get detailed usage statistics
      const detailedStats = await phoneDirectoryService.generateUsageReport(
        hotelId,
        {
          dateRange,
          phoneType,
          includeHistory: true
        }
      );

      res.status(200).json({
        status: 'success',
        data: {
          summary: report,
          detailed: detailedStats
        }
      });
    } catch (error) {
      console.error('Error generating usage report:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate usage report',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Update extension usage (for call tracking)
  async updateUsageStats(req, res) {
    try {
      const { id } = req.params;
      const { callType = 'received' } = req.body;

      const extension = await PhoneExtension.findById(id);
      if (!extension) {
        return res.status(404).json({
          status: 'error',
          message: 'Phone extension not found'
        });
      }

      await extension.updateUsageStats(callType);

      res.status(200).json({
        status: 'success',
        message: 'Usage statistics updated successfully',
        data: {
          totalCallsReceived: extension.usageStats.totalCallsReceived,
          totalCallsMade: extension.usageStats.totalCallsMade,
          lastUsed: extension.usageStats.lastUsed
        }
      });
    } catch (error) {
      console.error('Error updating usage statistics:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update usage statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Set maintenance mode
  async setMaintenanceMode(req, res) {
    try {
      const { id } = req.params;
      const { reason, scheduledUntil, technician } = req.body;

      const extension = await PhoneExtension.findById(id);
      if (!extension) {
        return res.status(404).json({
          status: 'error',
          message: 'Phone extension not found'
        });
      }

      await extension.setMaintenance(reason, scheduledUntil, technician);

      res.status(200).json({
        status: 'success',
        message: 'Extension set to maintenance mode',
        data: extension
      });
    } catch (error) {
      console.error('Error setting maintenance mode:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to set maintenance mode',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Clear maintenance mode
  async clearMaintenanceMode(req, res) {
    try {
      const { id } = req.params;

      const extension = await PhoneExtension.findById(id);
      if (!extension) {
        return res.status(404).json({
          status: 'error',
          message: 'Phone extension not found'
        });
      }

      await extension.clearMaintenance();

      res.status(200).json({
        status: 'success',
        message: 'Maintenance mode cleared',
        data: extension
      });
    } catch (error) {
      console.error('Error clearing maintenance mode:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to clear maintenance mode',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get extension options for dropdowns
  async getExtensionOptions(req, res) {
    try {
      const phoneTypes = [
        'room_phone', 'desk_phone', 'cordless', 'conference', 'fax', 
        'emergency', 'service', 'admin', 'maintenance', 'security'
      ];

      const statuses = ['active', 'inactive', 'maintenance', 'out_of_order', 'temporary'];

      const categories = ['guest_rooms', 'common_areas', 'staff', 'services', 'emergency', 'admin'];

      const features = [
        'voicemail', 'caller_id', 'call_waiting', 'conference_call', 
        'speed_dial', 'intercom', 'wake_up_call', 'do_not_disturb'
      ];

      res.status(200).json({
        status: 'success',
        data: {
          phoneTypes,
          statuses,
          categories,
          features
        }
      });
    } catch (error) {
      console.error('Error fetching extension options:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch extension options',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

export default new PhoneExtensionController();
