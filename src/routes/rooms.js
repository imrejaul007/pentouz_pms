import express from 'express';
import mongoose from 'mongoose';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

/**
 * @swagger
 * /rooms:
 *   get:
 *     summary: Get rooms with availability
 *     tags: [Rooms]
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *         description: Hotel ID
 *       - in: query
 *         name: checkIn
 *         schema:
 *           type: string
 *           format: date
 *         description: Check-in date (YYYY-MM-DD)
 *       - in: query
 *         name: checkOut
 *         schema:
 *           type: string
 *           format: date
 *         description: Check-out date (YYYY-MM-DD)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *         description: Room type filter
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of rooms
 */
router.get('/', optionalAuth, catchAsync(async (req, res) => {
  const {
    hotelId,
    checkIn,
    checkOut,
    type,
    page = 1,
    limit = 10,
    minPrice,
    maxPrice
  } = req.query;

  // Build query
  const query = { isActive: true };
  
  if (hotelId) {
    query.hotelId = hotelId;
  }
  
  if (type) {
    query.type = type;
  }

  if (minPrice || maxPrice) {
    query.currentRate = {};
    if (minPrice) query.currentRate.$gte = parseFloat(minPrice);
    if (maxPrice) query.currentRate.$lte = parseFloat(maxPrice);
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  let rooms;
  let total;
  
  // If dates provided, check availability
  if (checkIn && checkOut) {
    const checkInDate = new Date(checkIn + 'T00:00:00.000Z');
    const checkOutDate = new Date(checkOut + 'T00:00:00.000Z');
    
    if (checkInDate > checkOutDate) {
      throw new ApplicationError('Check-out date must be after check-in date', 400);
    }

    // If no hotelId provided, get the first available hotel
    let targetHotelId = hotelId;
    if (!targetHotelId) {
      const firstRoom = await Room.findOne({ isActive: true }).select('hotelId');
      if (firstRoom) {
        targetHotelId = firstRoom.hotelId;
      } else {
        throw new ApplicationError('No hotels available', 404);
      }
    }

    // For admin requests, show all rooms but mark availability
    if (req.headers['x-admin-request'] || req.user?.role === 'admin') {
      console.log('Admin request detected - showing all rooms with availability status');
      console.log('Date range:', { checkInDate, checkOutDate });
      console.log('Target hotel ID:', targetHotelId);

      // Get all rooms for the hotel
      const allRooms = await Room.find({
        hotelId: targetHotelId,
        isActive: true,
        ...(type && { type })
      }).sort({ roomNumber: 1 });

      console.log(`Found ${allRooms.length} total rooms for hotel ${targetHotelId}`);

      // Get conflicting bookings for the date range with proper date overlap logic
      const conflictingBookings = await Booking.find({
        hotelId: targetHotelId,
        status: { $in: ['confirmed', 'checked_in'] },
        $and: [
          { checkIn: { $lt: checkOutDate } },
          { checkOut: { $gt: checkInDate } }
        ]
      }).populate('rooms.roomId');

      console.log(`Found ${conflictingBookings.length} conflicting bookings`);

      // Extract occupied room IDs with better logging
      const occupiedRoomIds = [];
      conflictingBookings.forEach(booking => {
        booking.rooms.forEach(room => {
          if (room.roomId && room.roomId._id) {
            occupiedRoomIds.push(room.roomId._id.toString());
          }
        });
      });

      console.log('Occupied room IDs:', occupiedRoomIds);

      // For admin requests, show all rooms but mark availability based on booking conflicts only
      // For walk-in bookings, only check booking conflicts, not room status
      rooms = allRooms.map(room => {
        const isOccupied = occupiedRoomIds.includes(room._id.toString());
        const isAvailable = !isOccupied && (room.status === 'vacant' || room.status === 'dirty');

        return {
          ...room.toObject(),
          isAvailable,
          currentStatus: room.status,
          isOccupiedByBooking: isOccupied
        };
      });

      console.log(`Processed ${rooms.length} rooms, ${rooms.filter(r => r.isAvailable).length} available`);
      total = rooms.length;
      
      // Apply pagination
      const startIndex = skip;
      const endIndex = skip + parseInt(limit);
      rooms = rooms.slice(startIndex, endIndex);
      
      // Populate hotel info if rooms exist
      if (rooms.length > 0) {
        rooms = await Room.populate(rooms, { path: 'hotelId', select: 'name address' });
      }
    } else {
      // For regular users, use strict availability filtering
      const availableRooms = await Room.findAvailable(targetHotelId, checkInDate, checkOutDate, type);
      
      // Debug logging
      console.log('Available rooms found:', availableRooms.length);
      console.log('Check-in date:', checkInDate);
      console.log('Check-out date:', checkOutDate);
      console.log('Hotel ID:', targetHotelId);
      
      // Apply pagination manually since findAvailable returns results, not a query
      const startIndex = skip;
      const endIndex = skip + parseInt(limit);
      rooms = availableRooms.slice(startIndex, endIndex);
      
      // Set total count
      total = availableRooms.length;
      
      // Populate hotel info if rooms exist
      if (rooms.length > 0) {
        rooms = await Room.populate(rooms, { path: 'hotelId', select: 'name address' });
      }
    }
  } else {
    // For admin requests without dates, use real-time status
    if (hotelId && (req.headers['x-admin-request'] || req.user?.role === 'admin')) {
      const result = await Room.getRoomsWithRealTimeStatus(hotelId, {
        type,
        page: parseInt(page),
        limit: parseInt(limit)
      });
      
      rooms = result.rooms;
      total = result.total;
      
      // Populate hotel info
      if (rooms.length > 0) {
        rooms = await Room.populate(rooms, { path: 'hotelId', select: 'name address' });
      }
    } else {
      // Regular query for non-admin requests
      rooms = await Room.find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('hotelId', 'name address')
        .sort({ roomNumber: 1 });
        
      total = await Room.countDocuments(query);
    }
  }

  res.json({
    status: 'success',
    results: rooms.length,
    data: {
      rooms,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

// Temporary debug endpoint
router.get('/debug', async (req, res) => {
  try {
    const { hotelId } = req.query;

    // Convert hotelId to ObjectId if provided
    const hotelQuery = hotelId ? { hotelId: new mongoose.Types.ObjectId(hotelId) } : {};
    const baseQuery = { isActive: true, ...hotelQuery };

    // Get total rooms
    const totalRooms = await Room.countDocuments(baseQuery);

    // Get rooms with different statuses
    const statusCounts = await Room.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Get all bookings
    const allBookings = await Booking.find({
      ...hotelQuery,
      status: { $in: ['confirmed', 'checked_in'] }
    }).select('status checkIn checkOut rooms.roomId hotelId');

    // Get current date info
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Get current bookings
    const currentBookings = await Booking.find({
      ...hotelQuery,
      status: { $in: ['confirmed', 'checked_in'] },
      checkOut: { $gte: today },
      checkIn: { $lte: tomorrow }
    }).select('status checkIn checkOut rooms.roomId hotelId');
    
    res.json({
      totalRooms,
      statusCounts,
      allBookings: allBookings.length,
      currentBookings: currentBookings.length,
      currentBookingsDetails: currentBookings.map(b => ({
        id: b._id,
        status: b.status,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        roomIds: b.rooms.map(r => r.roomId.toString())
      })),
      today: today.toISOString(),
      tomorrow: tomorrow.toISOString(),
      hotelId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get room metrics for admin dashboard
router.get('/metrics', authenticate, catchAsync(async (req, res) => {
  const { hotelId } = req.query;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Use real-time status calculation instead of static status
  const result = await Room.getRoomsWithRealTimeStatus(hotelId, { limit: 1000 });
  const rooms = result.rooms;

  const totalRooms = rooms.length;
  
  // Count rooms based on computed status (real-time)
  const occupiedRooms = rooms.filter(r => r.computedStatus === 'occupied').length;
  const availableRooms = rooms.filter(r => r.computedStatus === 'vacant').length;
  const maintenanceRooms = rooms.filter(r => r.computedStatus === 'maintenance').length;
  const outOfOrderRooms = rooms.filter(r => r.computedStatus === 'out_of_order').length;
  const dirtyRooms = rooms.filter(r => r.computedStatus === 'dirty').length;

  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
  const availabilityRate = totalRooms > 0 ? (availableRooms / totalRooms) * 100 : 0;

  res.json({
    status: 'success',
    data: {
      totalRooms,
      occupiedRooms,
      availableRooms,
      maintenanceRooms,
      outOfOrderRooms,
      dirtyRooms,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      availabilityRate: Math.round(availabilityRate * 100) / 100,
    }
  });
}));

/**
 * @swagger
 * /rooms/{id}:
 *   get:
 *     summary: Get room by ID
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Room details
 */
router.get('/:id', catchAsync(async (req, res) => {
  const room = await Room.findById(req.params.id)
    .populate('hotelId', 'name address contact policies');

  if (!room || !room.isActive) {
    throw new ApplicationError('Room not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      room
    }
  });
}));

/**
 * @swagger
 * /rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Room'
 *     responses:
 *       201:
 *         description: Room created successfully
 */
router.post('/', 
  authenticate, 
  authorize('admin', 'staff'), 
  validate(schemas.createRoom), 
  catchAsync(async (req, res) => {
    const room = await Room.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        room
      }
    });
  })
);

/**
 * @swagger
 * /rooms/{id}:
 *   patch:
 *     summary: Update room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Room updated successfully
 */
router.patch('/:id', 
  authenticate, 
  authorize('admin', 'staff'), 
  catchAsync(async (req, res) => {
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!room) {
      throw new ApplicationError('Room not found', 404);
    }

    res.json({
      status: 'success',
      data: {
        room
      }
    });
  })
);

/**
 * @swagger
 * /rooms/{id}:
 *   delete:
 *     summary: Delete room (soft delete)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       204:
 *         description: Room deleted successfully
 */
router.delete('/:id', 
  authenticate, 
  authorize('admin'), 
  catchAsync(async (req, res) => {
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!room) {
      throw new ApplicationError('Room not found', 404);
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  })
);

export default router;