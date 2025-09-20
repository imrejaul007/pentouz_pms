import express from 'express';
import {
  checkRoomAvailability,
  getAvailableRooms,
  getAvailableEquipment,
  getAvailableServices,
  bookRoom,
  calculateBookingCost,
  cancelRoomBooking,
  getBookingDetails,
  getRoomSchedule
} from '../controllers/meetUpResourceController.js';
import { authenticate } from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Meet-Up Resources
 *   description: Room booking and resource management for meet-ups
 */

// Room availability and booking routes
router.post('/room-availability', validate(schemas.checkRoomAvailability), checkRoomAvailability);
router.get('/rooms/:hotelId', getAvailableRooms);
router.post('/book-room', validate(schemas.bookRoom), bookRoom);
router.post('/booking-cost', validate(schemas.calculateBookingCost), calculateBookingCost);
router.delete('/cancel-booking/:meetUpId', cancelRoomBooking);
router.get('/booking-details/:meetUpId', getBookingDetails);

// Equipment and services routes
router.get('/equipment/:hotelId', getAvailableEquipment);
router.get('/services/:hotelId', getAvailableServices);

// Schedule and admin routes
router.get('/room-schedule/:hotelId', getRoomSchedule);

// Admin-only routes
router.get('/admin/all-bookings', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, hotelId, date, status } = req.query;
    const skip = (page - 1) * limit;

    let query = {
      'meetingRoomBooking.roomId': { $exists: true }
    };

    if (hotelId && hotelId !== 'all') {
      query.hotelId = hotelId;
    }

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      query.proposedDate = { $gte: startOfDay, $lt: endOfDay };
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const meetUps = await MeetUpRequest.find(query)
      .populate('meetingRoomBooking.roomId', 'roomNumber type capacity')
      .populate('meetingRoomBooking.bookingId')
      .populate('requesterId', 'name email')
      .populate('targetUserId', 'name email')
      .populate('hotelId', 'name')
      .sort({ proposedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MeetUpRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        bookings: meetUps,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          hasNext: skip + meetUps.length < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room bookings',
      error: error.message
    });
  }
});

router.get('/admin/booking-analytics', adminAuth, async (req, res) => {
  try {
    const { period = '30d', hotelId } = req.query;

    // Calculate date range based on period
    const periodMap = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '365d': 365
    };

    const days = periodMap[period] || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let baseQuery = {
      'meetingRoomBooking.roomId': { $exists: true },
      createdAt: { $gte: startDate }
    };

    if (hotelId && hotelId !== 'all') {
      baseQuery.hotelId = hotelId;
    }

    const [
      totalBookings,
      confirmedBookings,
      totalRevenue,
      roomUtilization,
      popularEquipment,
      popularServices,
      peakTimes
    ] = await Promise.all([
      // Total room bookings
      MeetUpRequest.countDocuments(baseQuery),

      // Confirmed bookings
      MeetUpRequest.countDocuments({
        ...baseQuery,
        status: { $in: ['accepted', 'completed'] }
      }),

      // Total revenue from room bookings
      MeetUpRequest.aggregate([
        { $match: baseQuery },
        { $lookup: { from: 'servicebookings', localField: 'meetingRoomBooking.bookingId', foreignField: '_id', as: 'booking' } },
        { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, total: { $sum: '$booking.totalAmount' } } }
      ]),

      // Room utilization by type
      MeetUpRequest.aggregate([
        { $match: baseQuery },
        { $lookup: { from: 'rooms', localField: 'meetingRoomBooking.roomId', foreignField: '_id', as: 'room' } },
        { $unwind: { path: '$room', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$room.type', count: { $sum: 1 }, totalCapacity: { $sum: '$room.capacity' } } },
        { $sort: { count: -1 } }
      ]),

      // Most popular equipment
      MeetUpRequest.aggregate([
        { $match: { ...baseQuery, 'meetingRoomBooking.equipment': { $exists: true, $ne: [] } } },
        { $unwind: '$meetingRoomBooking.equipment' },
        { $group: { _id: '$meetingRoomBooking.equipment', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Most popular services
      MeetUpRequest.aggregate([
        { $match: { ...baseQuery, 'meetingRoomBooking.services': { $exists: true, $ne: [] } } },
        { $unwind: '$meetingRoomBooking.services' },
        { $group: { _id: '$meetingRoomBooking.services', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Peak booking times
      MeetUpRequest.aggregate([
        { $match: baseQuery },
        {
          $project: {
            hour: { $hour: { $dateFromString: { dateString: { $concat: ['2023-01-01T', '$proposedTime.start', ':00'] } } } },
            dayOfWeek: { $dayOfWeek: '$proposedDate' }
          }
        },
        { $group: { _id: { hour: '$hour', dayOfWeek: '$dayOfWeek' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalBookings,
          confirmedBookings,
          confirmationRate: totalBookings > 0 ? (confirmedBookings / totalBookings * 100) : 0,
          totalRevenue: totalRevenue[0]?.total || 0,
          currency: 'INR'
        },
        roomUtilization,
        popularEquipment,
        popularServices,
        peakTimes,
        period,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking analytics',
      error: error.message
    });
  }
});

export default router;
