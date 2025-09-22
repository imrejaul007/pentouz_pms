import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from './src/models/Booking.js';
import Room from './src/models/Room.js';

dotenv.config();

async function verifyDashboardDataSimple() {
  try {
    // Connect to MongoDB using the provided connection string
    const mongoURI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    console.log('\n=== DETAILED DASHBOARD VERIFICATION ===\n');

    // Get sample booking for hotelId
    const sampleBooking = await Booking.findOne({});
    const hotelId = sampleBooking?.hotelId;
    console.log(`Using hotelId: ${hotelId}`);

    if (!hotelId) {
      console.log('❌ No bookings found to get hotelId');
      return;
    }

    // TODAY'S CALCULATION (same as dashboard)
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // 1. Get all rooms for the hotel
    const rooms = await Room.find({ hotelId, isActive: true });
    console.log(`🏨 Total Rooms in Hotel: ${rooms.length}`);

    // 2. Get today's bookings (EXACT same query as dashboard)
    const bookings = await Booking.find({
      hotelId,
      $or: [
        { checkIn: { $lte: endOfDay }, checkOut: { $gte: startOfDay } },
        { status: { $in: ['confirmed', 'checked_in'] } }
      ]
    });
    console.log(`📊 Today's Bookings (dashboard query): ${bookings.length}`);

    // 3. VIP calculation (EXACT same as dashboard)
    const vipReservations = bookings.filter(b =>
      b.guestDetails?.vipStatus || b.totalAmount > 20000
    );
    console.log(`👑 VIP Reservations: ${vipReservations.length}`);

    // 4. Special requests
    const specialRequests = bookings.filter(b => b.specialRequests?.length > 0).length;
    console.log(`🎯 Special Requests: ${specialRequests}`);

    // 5. Room status breakdown
    const roomsByStatus = rooms.reduce((acc, room) => {
      acc[room.status] = (acc[room.status] || 0) + 1;
      return acc;
    }, {});
    console.log('🏨 Room Status Breakdown:', roomsByStatus);

    // 6. Recent Activity (last 2 hours) - EXACT same as dashboard
    const recentBookings = await Booking.find({
      hotelId,
      createdAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }
    }).sort({ createdAt: -1 }).limit(5);

    console.log(`\n🕐 Recent Activity (last 2 hours): ${recentBookings.length} bookings`);

    if (recentBookings.length > 0) {
      console.log('Recent booking IDs and timestamps:');
      recentBookings.forEach((booking, index) => {
        const bookingId = booking.bookingId || booking._id.toString();
        console.log(`  ${index + 1}. ID: ${bookingId}`);
        console.log(`     Timestamp: ${booking.createdAt.toISOString()}`);
        console.log(`     Status: ${booking.status}`);

        // Check if this matches the screenshot pattern
        if (bookingId.startsWith('68cf700830251')) {
          console.log(`     🎯 MATCHES SCREENSHOT PATTERN!`);
        }
      });
    }

    // 7. Check if the "20 reservations" matches
    console.log(`\n=== FINAL VERIFICATION ===`);
    console.log(`📊 Screenshot shows: 20 Total Reservations`);
    console.log(`🔍 Database shows: ${bookings.length} Total Reservations`);
    console.log(`✅ MATCH: ${bookings.length === 20 ? 'YES' : 'NO'}`);

    console.log(`👑 Screenshot shows: 2 VIP Reservations`);
    console.log(`🔍 Database shows: ${vipReservations.length} VIP Reservations`);
    console.log(`✅ MATCH: ${vipReservations.length === 2 ? 'YES' : 'NO'}`);

    // 8. Detailed booking analysis
    console.log(`\n=== BOOKING DETAILS ===`);
    console.log(`Total bookings in database: ${await Booking.countDocuments()}`);
    console.log(`Active bookings (confirmed/checked_in): ${await Booking.countDocuments({ status: { $in: ['confirmed', 'checked_in'] } })}`);

    // Check if any bookings have the exact timestamps from screenshot
    const exactMatch = await Booking.findOne({
      createdAt: new Date('2025-09-21T03:24:56.454Z')
    });
    console.log(`🎯 Exact timestamp match (2025-09-21T03:24:56.454Z): ${exactMatch ? 'FOUND' : 'NOT FOUND'}`);

    // Sample some booking IDs to verify
    console.log(`\n=== BOOKING ID SAMPLES ===`);
    const allBookings = await Booking.find({}).limit(10);
    allBookings.forEach((booking, index) => {
      const id = booking.bookingId || booking._id.toString();
      console.log(`${index + 1}. ${id} (created: ${booking.createdAt})`);
    });

  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

verifyDashboardDataSimple();