import TapeChartModels from '../models/TapeChart.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import CorporateCompany from '../models/CorporateCompany.js';
import { validationResult } from 'express-validator';

const { RoomBlock } = TapeChartModels;

class RoomBlockController {
  // Create a new room block
  async createRoomBlock(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const {
        blockId,
        blockName,
        groupName,
        corporateId,
        eventType,
        startDate,
        endDate,
        roomIds,
        totalRooms,
        blockRate,
        contactPerson,
        billingInstructions,
        specialInstructions,
        amenities,
        cateringRequirements
      } = req.body;

      // Validate rooms exist and are available
      const rooms = await Room.find({ 
        _id: { $in: roomIds }, 
        isActive: true 
      });

      if (rooms.length !== roomIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some rooms not found or inactive'
        });
      }

      // Check for conflicting room blocks
      const conflictingBlocks = await RoomBlock.find({
        status: { $in: ['active', 'partially_released'] },
        'rooms.roomId': { $in: roomIds },
        $or: [
          { startDate: { $lt: endDate, $gte: startDate } },
          { endDate: { $gt: startDate, $lte: endDate } },
          { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
        ]
      });

      if (conflictingBlocks.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Some rooms are already blocked for the selected dates',
          conflictingBlocks: conflictingBlocks.map(block => ({
            blockName: block.blockName,
            startDate: block.startDate,
            endDate: block.endDate
          }))
        });
      }

      // Prepare room data
      const roomData = rooms.map(room => ({
        roomId: room._id,
        roomNumber: room.roomNumber,
        roomType: room.type,
        rate: blockRate || room.currentRate,
        status: 'blocked'
      }));

      // Create room block
      const roomBlock = new RoomBlock({
        blockId,
        blockName,
        groupName,
        corporateId,
        eventType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        rooms: roomData,
        totalRooms: totalRooms || rooms.length,
        blockRate,
        contactPerson,
        billingInstructions,
        specialInstructions,
        amenities: amenities || [],
        cateringRequirements,
        createdBy: req.user._id
      });

      await roomBlock.save();

      // Populate the created block
      const populatedBlock = await RoomBlock.findById(roomBlock._id)
        .populate('corporateId', 'name')
        .populate('rooms.roomId', 'roomNumber type')
        .populate('createdBy', 'name email');

      res.status(201).json({
        success: true,
        message: 'Room block created successfully',
        data: populatedBlock
      });

    } catch (error) {
      console.error('Create room block error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create room block',
        error: error.message
      });
    }
  }

  // Get all room blocks
  async getRoomBlocks(req, res) {
    try {
      const {
        hotelId,
        status,
        eventType,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sortBy = 'startDate',
        sortOrder = 'asc'
      } = req.query;

      const query = {};
      if (status) query.status = status;
      if (eventType) query.eventType = eventType;
      
      if (startDate || endDate) {
        query.$or = [];
        if (startDate) {
          query.$or.push({ startDate: { $gte: new Date(startDate) } });
        }
        if (endDate) {
          query.$or.push({ endDate: { $lte: new Date(endDate) } });
        }
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [roomBlocks, total] = await Promise.all([
        RoomBlock.find(query)
          .populate('corporateId', 'name')
          .populate('rooms.roomId', 'roomNumber type')
          .populate('createdBy', 'name email')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        RoomBlock.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: roomBlocks,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      });

    } catch (error) {
      console.error('Get room blocks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch room blocks',
        error: error.message
      });
    }
  }

  // Get room block by ID
  async getRoomBlock(req, res) {
    try {
      const { id } = req.params;

      const roomBlock = await RoomBlock.findById(id)
        .populate('corporateId', 'name contactPerson')
        .populate('rooms.roomId', 'roomNumber type floor')
        .populate('rooms.bookingId', 'bookingNumber userId')
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email');

      if (!roomBlock) {
        return res.status(404).json({
          success: false,
          message: 'Room block not found'
        });
      }

      res.json({
        success: true,
        data: roomBlock
      });

    } catch (error) {
      console.error('Get room block error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch room block',
        error: error.message
      });
    }
  }

  // Update room block
  async updateRoomBlock(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const roomBlock = await RoomBlock.findById(id);
      if (!roomBlock) {
        return res.status(404).json({
          success: false,
          message: 'Room block not found'
        });
      }

      // Update allowed fields
      const allowedUpdates = [
        'blockName', 'groupName', 'eventType', 'contactPerson',
        'billingInstructions', 'specialInstructions', 'amenities',
        'cateringRequirements', 'paymentTerms', 'status'
      ];

      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          roomBlock[field] = updates[field];
        }
      });

      roomBlock.lastModifiedBy = req.user._id;
      await roomBlock.save();

      const updatedBlock = await RoomBlock.findById(id)
        .populate('corporateId', 'name')
        .populate('rooms.roomId', 'roomNumber type')
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email');

      res.json({
        success: true,
        message: 'Room block updated successfully',
        data: updatedBlock
      });

    } catch (error) {
      console.error('Update room block error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update room block',
        error: error.message
      });
    }
  }

  // Release room from block
  async releaseRoom(req, res) {
    try {
      const { id, roomId } = req.params;
      const { reason } = req.body;

      const roomBlock = await RoomBlock.findById(id);
      if (!roomBlock) {
        return res.status(404).json({
          success: false,
          message: 'Room block not found'
        });
      }

      const room = roomBlock.rooms.id(roomId);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found in block'
        });
      }

      if (room.status === 'released') {
        return res.status(400).json({
          success: false,
          message: 'Room is already released'
        });
      }

      room.status = 'released';
      
      // Initialize notes array if it doesn't exist
      if (!roomBlock.notes) {
        roomBlock.notes = [];
      }
      
      // Add note about release
      roomBlock.notes.push({
        content: `Room ${room.roomNumber} released. Reason: ${reason || 'Not specified'}`,
        createdBy: req.user._id,
        createdAt: new Date()
      });

      roomBlock.lastModifiedBy = req.user._id;
      await roomBlock.save();

      res.json({
        success: true,
        message: 'Room released successfully',
        data: roomBlock
      });

    } catch (error) {
      console.error('Release room error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to release room',
        error: error.message
      });
    }
  }

  // Book room from block
  async bookRoom(req, res) {
    try {
      const { id, roomId } = req.params;
      const { guestName, specialRequests, bookingId } = req.body;

      const roomBlock = await RoomBlock.findById(id);
      if (!roomBlock) {
        return res.status(404).json({
          success: false,
          message: 'Room block not found'
        });
      }

      const room = roomBlock.rooms.id(roomId);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found in block'
        });
      }

      if (room.status !== 'blocked') {
        return res.status(400).json({
          success: false,
          message: 'Room is not available for booking'
        });
      }

      room.status = 'booked';
      room.guestName = guestName;
      room.specialRequests = specialRequests;
      if (bookingId) room.bookingId = bookingId;

      // Initialize notes array if it doesn't exist
      if (!roomBlock.notes) {
        roomBlock.notes = [];
      }

      // Add note about booking
      roomBlock.notes.push({
        content: `Room ${room.roomNumber} booked for ${guestName}`,
        createdBy: req.user._id,
        createdAt: new Date()
      });

      roomBlock.lastModifiedBy = req.user._id;
      await roomBlock.save();

      res.json({
        success: true,
        message: 'Room booked successfully',
        data: roomBlock
      });

    } catch (error) {
      console.error('Book room error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to book room',
        error: error.message
      });
    }
  }

  // Get room block statistics
  async getRoomBlockStats(req, res) {
    try {
      const query = {};

      const stats = await RoomBlock.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalRooms: { $sum: '$totalRooms' },
            totalBookedRooms: { $sum: '$roomsBooked' },
            totalReleasedRooms: { $sum: '$roomsReleased' }
          }
        }
      ]);

      const eventTypeStats = await RoomBlock.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 },
            totalRooms: { $sum: '$totalRooms' }
          }
        }
      ]);

      const recentBlocks = await RoomBlock.find(query)
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(5);

      res.json({
        success: true,
        data: {
          statusStats: stats,
          eventTypeStats,
          recentBlocks
        }
      });

    } catch (error) {
      console.error('Get room block stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch room block statistics',
        error: error.message
      });
    }
  }

  // Add note to room block
  async addNote(req, res) {
    try {
      const { id } = req.params;
      const { content, isInternal = true } = req.body;

      const roomBlock = await RoomBlock.findById(id);
      if (!roomBlock) {
        return res.status(404).json({
          success: false,
          message: 'Room block not found'
        });
      }

      // Initialize notes array if it doesn't exist
      if (!roomBlock.notes) {
        roomBlock.notes = [];
      }

      roomBlock.notes.push({
        content,
        createdBy: req.user._id,
        isInternal
      });

      await roomBlock.save();

      const updatedBlock = await RoomBlock.findById(id)
        .populate('notes.createdBy', 'name');

      res.json({
        success: true,
        message: 'Note added successfully',
        data: updatedBlock.notes
      });

    } catch (error) {
      console.error('Add note error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add note',
        error: error.message
      });
    }
  }
}

export default new RoomBlockController();
