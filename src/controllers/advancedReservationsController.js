import TapeChartModels from '../models/TapeChart.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import { validationResult } from 'express-validator';

const { AdvancedReservation } = TapeChartModels;

class AdvancedReservationsController {
  // Create a new advanced reservation
  async createAdvancedReservation(req, res) {
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
        bookingId,
        reservationType,
        priority,
        roomPreferences,
        guestProfile,
        specialRequests,
        waitlistInfo
      } = req.body;

      // Validate bookingId
      if (!bookingId || bookingId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Booking ID is required'
        });
      }

      // Verify booking exists
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Create advanced reservation
      const advancedReservation = new AdvancedReservation({
        reservationId: `ADV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        bookingId,
        reservationType: reservationType || 'standard',
        priority: priority || 'medium',
        roomPreferences: roomPreferences || {},
        guestProfile: guestProfile || {},
        specialRequests: specialRequests || [],
        waitlistInfo: waitlistInfo || null,
        roomAssignments: [],
        upgrades: [],
        compRooms: [],
        reservationFlags: []
      });

      await advancedReservation.save();

      // Populate the created reservation
      const populatedReservation = await AdvancedReservation.findById(advancedReservation._id)
        .populate('bookingId', 'bookingNumber guestName checkIn checkOut status')
        .populate('roomAssignments.roomId', 'roomNumber type floor')
        .populate('roomAssignments.assignedBy', 'name email')
        .populate('specialRequests.assignedTo', 'name email');

      res.status(201).json({
        success: true,
        message: 'Advanced reservation created successfully',
        data: populatedReservation
      });

    } catch (error) {
      console.error('Create advanced reservation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create advanced reservation',
        error: error.message
      });
    }
  }

  // Get all advanced reservations
  async getAdvancedReservations(req, res) {
    try {
      const {
        reservationType,
        priority,
        status,
        hasWaitlist,
        search,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const query = {};

      if (reservationType) query.reservationType = reservationType;
      if (priority) query.priority = priority;
      if (hasWaitlist === 'true') query.waitlistInfo = { $ne: null };

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      let advancedReservations, total;

      // Handle search functionality
      if (search) {
        // First, find bookings that match the search term
        const matchingBookings = await Booking.find({
          $or: [
            { bookingNumber: { $regex: search, $options: 'i' } },
            { guestName: { $regex: search, $options: 'i' } }
          ]
        }).select('_id');

        const bookingIds = matchingBookings.map(b => b._id);

        // Combine reservation search with booking search
        const searchQuery = {
          ...query,
          $or: [
            { reservationId: { $regex: search, $options: 'i' } },
            { 'guestProfile.loyaltyNumber': { $regex: search, $options: 'i' } },
            { bookingId: { $in: bookingIds } }
          ]
        };

        [advancedReservations, total] = await Promise.all([
          AdvancedReservation.find(searchQuery)
            .populate('bookingId', 'bookingNumber guestName checkIn checkOut status totalAmount')
            .populate('roomAssignments.roomId', 'roomNumber type floor')
            .populate('roomAssignments.assignedBy', 'name email')
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit)),
          AdvancedReservation.countDocuments(searchQuery)
        ]);
      } else {
        [advancedReservations, total] = await Promise.all([
          AdvancedReservation.find(query)
            .populate('bookingId', 'bookingNumber guestName checkIn checkOut status totalAmount')
            .populate('roomAssignments.roomId', 'roomNumber type floor')
            .populate('roomAssignments.assignedBy', 'name email')
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit)),
          AdvancedReservation.countDocuments(query)
        ]);
      }

      res.json({
        success: true,
        data: advancedReservations,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      });

    } catch (error) {
      console.error('Get advanced reservations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch advanced reservations',
        error: error.message
      });
    }
  }

  // Get advanced reservation by ID
  async getAdvancedReservation(req, res) {
    try {
      const { id } = req.params;

      const advancedReservation = await AdvancedReservation.findById(id)
        .populate('bookingId', 'bookingNumber guestName checkIn checkOut status totalAmount rooms')
        .populate('roomAssignments.roomId', 'roomNumber type floor amenities')
        .populate('roomAssignments.assignedBy', 'name email')
        .populate('specialRequests.assignedTo', 'name email department')
        .populate('upgrades.approvedBy', 'name email')
        .populate('compRooms.authorizedBy', 'name email')
        .populate('reservationFlags.createdBy', 'name email');

      if (!advancedReservation) {
        return res.status(404).json({
          success: false,
          message: 'Advanced reservation not found'
        });
      }

      res.json({
        success: true,
        data: advancedReservation
      });

    } catch (error) {
      console.error('Get advanced reservation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch advanced reservation',
        error: error.message
      });
    }
  }

  // Update advanced reservation
  async updateAdvancedReservation(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const advancedReservation = await AdvancedReservation.findById(id);
      if (!advancedReservation) {
        return res.status(404).json({
          success: false,
          message: 'Advanced reservation not found'
        });
      }

      // Update allowed fields
      const allowedUpdates = [
        'reservationType', 'priority', 'roomPreferences', 'guestProfile',
        'specialRequests', 'waitlistInfo', 'reservationFlags'
      ];

      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          advancedReservation[field] = updates[field];
        }
      });

      await advancedReservation.save();

      const updatedReservation = await AdvancedReservation.findById(id)
        .populate('bookingId', 'bookingNumber guestName checkIn checkOut status')
        .populate('roomAssignments.roomId', 'roomNumber type floor')
        .populate('roomAssignments.assignedBy', 'name email');

      res.json({
        success: true,
        message: 'Advanced reservation updated successfully',
        data: updatedReservation
      });

    } catch (error) {
      console.error('Update advanced reservation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update advanced reservation',
        error: error.message
      });
    }
  }

  // Assign room to reservation
  async assignRoom(req, res) {
    try {
      const { id } = req.params;
      const { roomId, assignmentType, notes } = req.body;

      const advancedReservation = await AdvancedReservation.findById(id);
      if (!advancedReservation) {
        return res.status(404).json({
          success: false,
          message: 'Advanced reservation not found'
        });
      }

      // Verify room exists
      const room = await Room.findById(roomId);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }

      // Add room assignment
      const roomAssignment = {
        roomId,
        roomNumber: room.roomNumber,
        assignedDate: new Date(),
        assignmentType: assignmentType || 'manual',
        assignedBy: req.user._id,
        notes: notes || ''
      };

      advancedReservation.roomAssignments.push(roomAssignment);
      await advancedReservation.save();

      const updatedReservation = await AdvancedReservation.findById(id)
        .populate('roomAssignments.roomId', 'roomNumber type floor')
        .populate('roomAssignments.assignedBy', 'name email');

      res.json({
        success: true,
        message: 'Room assigned successfully',
        data: updatedReservation
      });

    } catch (error) {
      console.error('Assign room error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign room',
        error: error.message
      });
    }
  }

  // Add upgrade to reservation
  async addUpgrade(req, res) {
    try {
      const { id } = req.params;
      const { fromRoomType, toRoomType, upgradeType, upgradeReason, additionalCharge } = req.body;

      const advancedReservation = await AdvancedReservation.findById(id);
      if (!advancedReservation) {
        return res.status(404).json({
          success: false,
          message: 'Advanced reservation not found'
        });
      }

      // Add upgrade
      const upgrade = {
        fromRoomType,
        toRoomType,
        upgradeType,
        upgradeReason: upgradeReason || '',
        additionalCharge: additionalCharge || 0,
        approvedBy: req.user._id,
        upgradeDate: new Date()
      };

      advancedReservation.upgrades.push(upgrade);
      await advancedReservation.save();

      const updatedReservation = await AdvancedReservation.findById(id)
        .populate('upgrades.approvedBy', 'name email');

      res.json({
        success: true,
        message: 'Upgrade added successfully',
        data: updatedReservation
      });

    } catch (error) {
      console.error('Add upgrade error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add upgrade',
        error: error.message
      });
    }
  }

  // Get advanced reservations statistics
  async getAdvancedReservationsStats(req, res) {
    try {
      const stats = await AdvancedReservation.aggregate([
        {
          $group: {
            _id: '$reservationType',
            count: { $sum: 1 }
          }
        }
      ]);

      const priorityStats = await AdvancedReservation.aggregate([
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 }
          }
        }
      ]);

      const upgradeStats = await AdvancedReservation.aggregate([
        { $unwind: '$upgrades' },
        {
          $group: {
            _id: '$upgrades.upgradeType',
            count: { $sum: 1 },
            totalCharge: { $sum: '$upgrades.additionalCharge' }
          }
        }
      ]);

      const waitlistCount = await AdvancedReservation.countDocuments({
        waitlistInfo: { $ne: null }
      });

      const recentReservations = await AdvancedReservation.find()
        .populate('bookingId', 'bookingNumber guestName')
        .sort({ createdAt: -1 })
        .limit(5);

      res.json({
        success: true,
        data: {
          typeStats: stats,
          priorityStats,
          upgradeStats,
          waitlistCount,
          recentReservations
        }
      });

    } catch (error) {
      console.error('Get advanced reservations stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch advanced reservations statistics',
        error: error.message
      });
    }
  }

  // Add reservation flag
  async addReservationFlag(req, res) {
    try {
      const { id } = req.params;
      const { flag, severity, description, expiryDate } = req.body;

      const advancedReservation = await AdvancedReservation.findById(id);
      if (!advancedReservation) {
        return res.status(404).json({
          success: false,
          message: 'Advanced reservation not found'
        });
      }

      const reservationFlag = {
        flag,
        severity: severity || 'info',
        description: description || '',
        createdBy: req.user._id,
        expiryDate: expiryDate ? new Date(expiryDate) : null
      };

      advancedReservation.reservationFlags.push(reservationFlag);
      await advancedReservation.save();

      const updatedReservation = await AdvancedReservation.findById(id)
        .populate('reservationFlags.createdBy', 'name');

      res.json({
        success: true,
        message: 'Reservation flag added successfully',
        data: updatedReservation.reservationFlags
      });

    } catch (error) {
      console.error('Add reservation flag error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add reservation flag',
        error: error.message
      });
    }
  }

  // Get available bookings for creating advanced reservations
  async getAvailableBookings(req, res) {
    try {
      const bookings = await Booking.find({ status: { $in: ['confirmed', 'checked_in'] } })
        .select('_id bookingNumber guestName checkIn checkOut status totalAmount')
        .sort({ checkIn: 1 })
        .limit(50);

      res.json({
        success: true,
        data: bookings
      });

    } catch (error) {
      console.error('Get available bookings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available bookings',
        error: error.message
      });
    }
  }
}

export default new AdvancedReservationsController();
