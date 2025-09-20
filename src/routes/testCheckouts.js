import express from 'express';
import mongoose from 'mongoose';
import CheckoutInventory from '../models/CheckoutInventory.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Room from '../models/Room.js';

const router = express.Router();

// Test endpoint to compare checkout data sources
router.get('/compare-checkouts', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Count checkouts from CheckoutInventory (the actual checkout actions)
    const checkoutInventoryCount = await CheckoutInventory.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Count bookings with checked_out status (traditional way)
    const bookingCheckoutCount = await Booking.countDocuments({
      status: 'checked_out',
      updatedAt: { $gte: today, $lt: tomorrow }
    });

    // Get sample CheckoutInventory records with hotel info
    const sampleCheckoutInventory = await CheckoutInventory.find({
      createdAt: { $gte: today, $lt: tomorrow }
    }).populate([
      { path: 'bookingId', populate: { path: 'hotelId', select: 'name' } },
      { path: 'roomId', select: 'roomNumber' }
    ]).limit(5);

    // Get sample booking checkouts
    const sampleBookingCheckouts = await Booking.find({
      status: 'checked_out',
      updatedAt: { $gte: today, $lt: tomorrow }
    }).populate('userId rooms.roomId hotelId').limit(5);

    // Count by hotel ID for CheckoutInventory
    const checkoutsByHotel = await CheckoutInventory.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
      { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'booking' } },
      { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'hotels', localField: 'booking.hotelId', foreignField: '_id', as: 'hotel' } },
      { $unwind: { path: '$hotel', preserveNullAndEmptyArrays: true } },
      { 
        $group: { 
          _id: '$booking.hotelId', 
          hotelName: { $first: '$hotel.name' },
          count: { $sum: 1 } 
        } 
      }
    ]);

    res.json({
      status: 'success',
      data: {
        date: today.toISOString().split('T')[0],
        timeRange: {
          start: today.toISOString(),
          end: tomorrow.toISOString()
        },
        checkoutInventoryCount,
        bookingCheckoutCount,
        checkoutsByHotel,
        sampleCheckoutInventory,
        sampleBookingCheckouts,
        message: checkoutInventoryCount !== bookingCheckoutCount 
          ? 'Data inconsistency detected!' 
          : 'Data is consistent'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Test staff dashboard today endpoint specifically
router.get('/staff-today-debug', async (req, res) => {
  try {
    const hotelId = req.query.hotelId || '68b19648e35a38ee7b1d1828'; // Default hotel ID
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('Debug - Hotel ID:', hotelId);
    console.log('Debug - Today range:', today, 'to', tomorrow);

    // Test the exact query used in staff dashboard
    const todayCheckOuts = await CheckoutInventory.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
      { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'booking' } },
      { $match: { 'booking.hotelId': new mongoose.Types.ObjectId(hotelId) } },
      { $count: 'total' }
    ]);

    // Also get all CheckoutInventory records today regardless of hotel
    const allCheckoutsToday = await CheckoutInventory.find({
      createdAt: { $gte: today, $lt: tomorrow }
    }).populate('bookingId roomId');

    res.json({
      status: 'success',
      data: {
        hotelId,
        todayRange: { start: today, end: tomorrow },
        staffDashboardCheckoutCount: todayCheckOuts[0]?.total || 0,
        allCheckoutsToday: allCheckoutsToday.length,
        checkoutRecords: allCheckoutsToday.map(checkout => ({
          _id: checkout._id,
          createdAt: checkout.createdAt,
          roomNumber: checkout.roomId?.roomNumber,
          bookingHotelId: checkout.bookingId?.hotelId,
          items: checkout.items?.slice(0, 2) // First 2 items only
        }))
      }
    });
  } catch (error) {
    console.error('Staff today debug error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack
    });
  }
});

// Debug current user's checkout data
router.get('/debug-user-checkouts', async (req, res) => {
  try {
    const userId = req.user?.id;
    const hotelId = req.user?.hotelId;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all checkout inventory records for today
    const allCheckoutsToday = await CheckoutInventory.find({
      createdAt: { $gte: today, $lt: tomorrow }
    }).populate([
      { path: 'bookingId', populate: { path: 'hotelId', select: 'name' } },
      { path: 'roomId', select: 'roomNumber' },
      { path: 'staffId', select: 'name email' }
    ]);

    // Get checkout count for user's hotel (same logic as staff dashboard)
    const userHotelCheckouts = await CheckoutInventory.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
      { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'booking' } },
      { $match: { 'booking.hotelId': new mongoose.Types.ObjectId(hotelId) } },
      { $count: 'total' }
    ]);

    res.json({
      status: 'success',
      data: {
        currentUser: {
          userId,
          hotelId,
          name: req.user?.name,
          role: req.user?.role
        },
        timeRange: { start: today, end: tomorrow },
        userHotelCheckouts: userHotelCheckouts[0]?.total || 0,
        allCheckoutsToday: allCheckoutsToday.length,
        checkoutDetails: allCheckoutsToday.map(checkout => ({
          _id: checkout._id,
          createdAt: checkout.createdAt,
          roomNumber: checkout.roomId?.roomNumber,
          hotelId: checkout.bookingId?.hotelId?._id,
          hotelName: checkout.bookingId?.hotelId?.name,
          staffName: checkout.staffId?.name,
          itemCount: checkout.items?.length || 0
        }))
      }
    });
  } catch (error) {
    console.error('Debug user checkouts error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Check available bookings for checkout
router.get('/available-checkouts', async (req, res) => {
  try {
    const hotelId = req.user?.hotelId || req.query.hotelId;
    
    // Find bookings that are eligible for checkout inventory
    const eligibleBookings = await Booking.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'checked_in' // Required status for checkout inventory
    }).populate([
      { path: 'userId', select: 'name email' },
      { path: 'rooms.roomId', select: 'roomNumber type' },
      { path: 'hotelId', select: 'name' }
    ]).limit(10);

    // Check if any of these bookings already have checkout inventory
    const bookingIds = eligibleBookings.map(b => b._id);
    const existingCheckouts = await CheckoutInventory.find({
      bookingId: { $in: bookingIds }
    });

    const existingCheckoutBookingIds = existingCheckouts.map(c => c.bookingId.toString());

    res.json({
      status: 'success',
      data: {
        currentUser: {
          hotelId: req.user?.hotelId,
          name: req.user?.name,
          role: req.user?.role
        },
        eligibleBookingsCount: eligibleBookings.length,
        eligibleBookings: eligibleBookings.map(booking => ({
          _id: booking._id,
          bookingNumber: booking.bookingNumber,
          status: booking.status,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          guest: booking.userId?.name,
          rooms: booking.rooms.map(r => ({
            roomId: r.roomId._id,
            roomNumber: r.roomId.roomNumber,
            type: r.roomId.type
          })),
          hasCheckoutInventory: existingCheckoutBookingIds.includes(booking._id.toString())
        })),
        message: eligibleBookings.length === 0 
          ? 'No bookings with status "checked_in" found for checkout inventory'
          : `Found ${eligibleBookings.length} eligible bookings for checkout inventory`
      }
    });
  } catch (error) {
    console.error('Available checkouts error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Create a test checkout inventory record
router.post('/create-test-checkout', async (req, res) => {
  try {
    const hotelId = req.user?.hotelId;
    
    // Find any checked-in booking for this hotel
    const booking = await Booking.findOne({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'checked_in'
    }).populate('rooms.roomId');

    if (!booking) {
      return res.status(400).json({
        status: 'error',
        message: 'No checked-in bookings found for testing'
      });
    }

    const roomId = booking.rooms[0].roomId._id;
    
    // Create a simple test checkout inventory
    const testCheckout = await CheckoutInventory.create({
      bookingId: booking._id,
      roomId: roomId,
      checkedBy: req.user._id,
      items: [
        {
          itemName: 'Test Towel',
          category: 'bathroom',
          quantity: 1,
          unitPrice: 10,
          totalPrice: 10,
          status: 'used'
        }
      ],
      notes: 'Test checkout created by debug endpoint'
    });

    res.json({
      status: 'success',
      message: 'Test checkout inventory created successfully',
      data: {
        checkoutId: testCheckout._id,
        createdAt: testCheckout.createdAt,
        bookingId: booking._id,
        roomNumber: booking.rooms[0].roomId.roomNumber
      }
    });
  } catch (error) {
    console.error('Test checkout creation error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack
    });
  }
});

// Check all booking statuses to see what's available
router.get('/booking-statuses', async (req, res) => {
  try {
    const hotelId = req.user?.hotelId || '68b19648e35a38ee7b1d1828';
    
    // Get count of bookings by status
    const statusCounts = await Booking.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get recent bookings with their statuses
    const recentBookings = await Booking.find({
      hotelId: new mongoose.Types.ObjectId(hotelId)
    }).populate('userId rooms.roomId')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('bookingNumber status checkIn checkOut createdAt userId');

    res.json({
      status: 'success',
      data: {
        hotelId,
        statusCounts,
        recentBookings: recentBookings.map(b => ({
          _id: b._id,
          bookingNumber: b.bookingNumber,
          status: b.status,
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          guest: b.userId?.name,
          createdAt: b.createdAt
        })),
        message: `Found ${statusCounts.length} different booking statuses`
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Fix for checkout inventory: Create a checked-in booking
router.post('/create-checked-in-booking', async (req, res) => {
  try {
    const hotelId = req.user?.hotelId || '68b19648e35a38ee7b1d1828';
    console.log('DEBUG: Creating test booking for hotel:', hotelId);
    
    // Find an existing user
    let user = await User.findOne({ role: 'guest' });
    if (!user) {
      // Create a test user if none exists
      user = await User.create({
        name: 'Test Guest',
        email: 'testguest@example.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'guest'
      });
      console.log('DEBUG: Created test user:', user._id);
    }

    // Find an available room
    let room = await Room.findOne({ 
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isActive: true 
    });

    // If no room exists, create one
    if (!room) {
      console.log('DEBUG: No rooms found, creating test room...');
      room = await Room.create({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        roomNumber: '101',
        type: 'double', // Must be: single, double, suite, or deluxe
        baseRate: 100,  // Required field (not basePrice)
        currentRate: 100,
        capacity: 2,
        floor: 1,
        amenities: ['WiFi', 'TV', 'AC'],
        status: 'vacant', // Must be: vacant, occupied, dirty, maintenance, out_of_order
        isActive: true
      });
      console.log('DEBUG: Created test room:', room._id, room.roomNumber);
    }

    // Set check-in to start of today to match dashboard query
    const checkInDate = new Date();
    checkInDate.setHours(0, 0, 0, 0); // Start of today
    
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 2);
    checkOutDate.setHours(11, 0, 0, 0); // 11 AM checkout

    // Calculate nights (required field)
    const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
    const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));

    console.log('DEBUG: Booking dates:', {
      checkIn: checkInDate,
      checkOut: checkOutDate,
      nights: nights
    });

    // Create a booking with checked_in status
    const booking = await Booking.create({
      bookingNumber: `BK${Date.now()}`,
      userId: user._id,
      hotelId: new mongoose.Types.ObjectId(hotelId),
      rooms: [{
        roomId: room._id,
        rate: room.baseRate || 100,
        checkIn: checkInDate,
        checkOut: checkOutDate
      }],
      checkIn: checkInDate,
      checkOut: checkOutDate,
      nights: nights, // Required field
      totalAmount: (room.baseRate || 100) * nights, // Multiply by nights
      status: 'checked_in', // This is key for checkout inventory
      paymentStatus: 'paid',
      guestDetails: {
        adults: 1,
        children: 0
      }
    });

    res.json({
      status: 'success',
      message: 'Test checked-in booking created successfully! You can now perform checkout inventory.',
      data: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        roomNumber: room.roomNumber,
        roomType: room.type,
        guest: user.name,
        checkIn: booking.checkIn,
        hotelId: hotelId,
        nextSteps: [
          '1. Go to Checkout Inventory page',
          '2. Select this booking to perform checkout',
          '3. Add inventory items and complete checkout',
          '4. Return to Reports & Analytics to see updated count'
        ]
      }
    });
  } catch (error) {
    console.error('Create checked-in booking error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Debug check-in counting
router.get('/debug-checkins', async (req, res) => {
  try {
    const hotelId = req.user?.hotelId || '68b19648e35a38ee7b1d1828';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('DEBUG: Check-in query range:', { today, tomorrow, hotelId });

    // Same query as staff dashboard
    const todayCheckIns = await Booking.countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      checkIn: { $gte: today, $lt: tomorrow },
      status: { $in: ['confirmed', 'checked_in'] }
    });

    // Get actual bookings for debugging
    const actualBookings = await Booking.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      checkIn: { $gte: today, $lt: tomorrow },
      status: { $in: ['confirmed', 'checked_in'] }
    }).populate('userId rooms.roomId').select('bookingNumber checkIn status createdAt userId');

    // Get all bookings with checked_in status regardless of date
    const allCheckedIn = await Booking.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'checked_in'
    }).select('bookingNumber checkIn status createdAt').limit(5);

    res.json({
      status: 'success',
      data: {
        hotelId,
        queryRange: { start: today, end: tomorrow },
        todayCheckInsCount: todayCheckIns,
        actualTodayBookings: actualBookings.map(b => ({
          bookingNumber: b.bookingNumber,
          checkIn: b.checkIn,
          status: b.status,
          createdAt: b.createdAt,
          guest: b.userId?.name
        })),
        allCheckedInBookings: allCheckedIn.map(b => ({
          bookingNumber: b.bookingNumber,
          checkIn: b.checkIn,
          status: b.status,
          createdAt: b.createdAt,
          isToday: b.checkIn >= today && b.checkIn < tomorrow
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;