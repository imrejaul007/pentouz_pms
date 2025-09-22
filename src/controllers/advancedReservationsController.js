import AdvancedReservation from '../models/AdvancedReservation.js';
import RoomUpgrade from '../models/RoomUpgrade.js';
import WaitingList from '../models/WaitingList.js';
import VIPGuest from '../models/VIPGuest.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';

class AdvancedReservationsController {
  /**
   * Create new advanced reservation
   */
  async createAdvancedReservation(req, res) {
    try {
      const hotelId = req.user.hotelId;
      const userId = req.user.id;

      // Validate booking exists
      const booking = await Booking.findById(req.body.bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check if advanced reservation already exists for this booking
      const existingReservation = await AdvancedReservation.findOne({
        bookingId: req.body.bookingId
      });

      if (existingReservation) {
        return res.status(400).json({
          success: false,
          message: 'Advanced reservation already exists for this booking'
        });
      }

      // Create advanced reservation
      const reservationData = {
        ...req.body,
        hotelId,
        createdBy: userId
      };

      const reservation = new AdvancedReservation(reservationData);
      await reservation.save();

      // Populate the created reservation
      await reservation.populate([
        { path: 'bookingId', select: 'bookingNumber checkIn checkOut guestDetails' },
        { path: 'createdBy', select: 'name email' }
      ]);

      res.status(201).json({
        success: true,
        data: reservation
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Advanced reservation already exists for this booking'
        });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Get all advanced reservations with filters and pagination
   */
  async getAdvancedReservations(req, res) {
    try {
      const hotelId = req.user.hotelId;
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        reservationType,
        priority,
        hasWaitlist,
        status,
        vipStatus
      } = req.query;

      // Build filter object
      const filter = { hotelId };

      if (reservationType) filter.reservationType = reservationType;
      if (priority) filter.priority = priority;
      if (status) filter.status = status;
      if (hasWaitlist === 'true') filter['waitlistInfo.isOnWaitlist'] = true;
      if (vipStatus === 'true') filter['guestProfile.vipStatus'] = true;

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with population
      const [reservations, totalCount] = await Promise.all([
        AdvancedReservation.find(filter)
          .populate('bookingId', 'bookingNumber checkIn checkOut guestDetails totalAmount')
          .populate('createdBy', 'name email')
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit)),
        AdvancedReservation.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: {
          reservations,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalCount,
            hasNext: skip + parseInt(limit) < totalCount,
            hasPrev: parseInt(page) > 1
          }
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get single advanced reservation by ID
   */
  async getAdvancedReservation(req, res) {
    try {
      const { id } = req.params;
      const hotelId = req.user.hotelId;

      const reservation = await AdvancedReservation.findOne({
        _id: id,
        hotelId
      })
        .populate('bookingId', 'bookingNumber checkIn checkOut guestDetails totalAmount roomType')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('roomAssignments.roomId', 'roomNumber roomType floor')
        .populate('roomAssignments.assignedBy', 'name email');

      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Advanced reservation not found'
        });
      }

      res.json({ success: true, data: reservation });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Update advanced reservation
   */
  async updateAdvancedReservation(req, res) {
    try {
      const { id } = req.params;
      const hotelId = req.user.hotelId;
      const userId = req.user.id;

      const updateData = {
        ...req.body,
        updatedBy: userId
      };

      const reservation = await AdvancedReservation.findOneAndUpdate(
        { _id: id, hotelId },
        updateData,
        { new: true, runValidators: true }
      )
        .populate('bookingId', 'bookingNumber checkIn checkOut guestDetails')
        .populate('updatedBy', 'name email');

      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Advanced reservation not found'
        });
      }

      res.json({ success: true, data: reservation });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Assign room to advanced reservation
   */
  async assignRoom(req, res) {
    try {
      const { id } = req.params;
      const { roomId, assignmentType = 'manual', notes } = req.body;
      const hotelId = req.user.hotelId;
      const userId = req.user.id;

      const reservation = await AdvancedReservation.findOne({ _id: id, hotelId });
      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Advanced reservation not found'
        });
      }

      // Add room assignment
      const roomAssignment = {
        roomId,
        assignedBy: userId,
        assignmentType,
        notes,
        assignedAt: new Date()
      };

      reservation.roomAssignments.push(roomAssignment);
      await reservation.save();

      await reservation.populate([
        { path: 'roomAssignments.roomId', select: 'roomNumber roomType floor' },
        { path: 'roomAssignments.assignedBy', select: 'name email' }
      ]);

      res.json({ success: true, data: reservation });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Add upgrade to advanced reservation
   */
  async addUpgrade(req, res) {
    try {
      const { id } = req.params;
      const upgradeData = req.body;
      const hotelId = req.user.hotelId;

      const reservation = await AdvancedReservation.findOne({ _id: id, hotelId });
      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Advanced reservation not found'
        });
      }

      // Add upgrade using the model method
      await reservation.addUpgrade(upgradeData);

      res.json({
        success: true,
        data: reservation,
        message: 'Upgrade added successfully'
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Get advanced reservations statistics for dashboard
   * This is the CRITICAL endpoint that the frontend calls
   */
  async getAdvancedReservationsStats(req, res) {
    try {
      const hotelId = req.user.hotelId || req.query.hotelId;

      if (!hotelId) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID is required'
        });
      }

      // Get reservation statistics using the model method
      const stats = await AdvancedReservation.getReservationStats(hotelId);

      // Get waitlist count from WaitingList collection
      const waitlistCount = await WaitingList.countDocuments({ hotelId });

      // Get VIP guest count
      const vipCount = await VIPGuest.countDocuments({ hotelId });

      // Get recent reservations for preview
      const recentReservations = await AdvancedReservation.find({ hotelId })
        .populate('bookingId', 'bookingNumber guestDetails')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('reservationId reservationType priority guestProfile.vipStatus createdAt');

      // Format stats for frontend consumption
      const formattedStats = {
        typeStats: Object.entries(stats.byType).map(([type, count]) => ({
          _id: type,
          count: count
        })),
        upgradeStats: [
          { _id: 'approved', count: stats.upgradeRequests }
        ],
        waitlistCount: waitlistCount,
        totalReservations: stats.totalReservations,
        vipReservations: stats.vipReservations,
        pendingApprovals: stats.pendingApprovals,
        specialRequests: stats.specialRequests,
        avgPriorityScore: stats.avgPriorityScore,
        avgComplexityScore: stats.avgComplexityScore,
        priorityStats: Object.entries(stats.byPriority).map(([priority, count]) => ({
          _id: priority,
          count: count
        })),
        recentReservations: recentReservations
      };

      res.json({
        success: true,
        data: formattedStats
      });
    } catch (error) {
      console.error('Advanced Reservations Stats Error:', error);
      res.status(500).json({
        success: false,
        message: error.message
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

  /**
   * Get available bookings for creating advanced reservations
   */
  async getAvailableBookings(req, res) {
    try {
      const hotelId = req.user.hotelId;
      const { page = 1, limit = 20, search } = req.query;

      // Get booking IDs that already have advanced reservations
      const existingAdvancedReservations = await AdvancedReservation.find({ hotelId })
        .select('bookingId')
        .lean();

      const existingBookingIds = existingAdvancedReservations.map(ar => ar.bookingId);

      // Build query for available bookings
      const query = {
        hotelId,
        _id: { $nin: existingBookingIds },
        status: { $in: ['confirmed', 'checked_in'] }
      };

      // Add search functionality
      if (search) {
        query.$or = [
          { bookingNumber: { $regex: search, $options: 'i' } },
          { 'guestDetails.firstName': { $regex: search, $options: 'i' } },
          { 'guestDetails.lastName': { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [bookings, totalCount] = await Promise.all([
        Booking.find(query)
          .select('bookingNumber checkIn checkOut guestDetails roomType totalAmount status')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Booking.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          bookings,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalCount,
            hasNext: skip + parseInt(limit) < totalCount,
            hasPrev: parseInt(page) > 1
          }
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Delete advanced reservation
   */
  async deleteAdvancedReservation(req, res) {
    try {
      const { id } = req.params;
      const hotelId = req.user.hotelId;

      const reservation = await AdvancedReservation.findOneAndDelete({
        _id: id,
        hotelId
      });

      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Advanced reservation not found'
        });
      }

      res.json({
        success: true,
        message: 'Advanced reservation deleted successfully'
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new AdvancedReservationsController();
