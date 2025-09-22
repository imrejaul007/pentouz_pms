import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from './src/models/Booking.js';
import Room from './src/models/Room.js';
import WaitingList from './src/models/WaitingList.js';
import TapeChart from './src/models/TapeChart.js';

dotenv.config();

const { RoomBlock, AdvancedReservation } = TapeChart;

async function verifyDashboardData() {
  try {
    // Connect to MongoDB using the provided connection string
    const mongoURI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    console.log('\n=== DASHBOARD DATA VERIFICATION ===\n');

    // 1. Check total bookings
    const totalBookings = await Booking.countDocuments();
    console.log(`📊 Total Bookings in Database: ${totalBookings}`);

    // 2. Check confirmed/active bookings
    const activeBookings = await Booking.countDocuments({
      status: { $in: ['confirmed', 'checked_in'] }
    });
    console.log(`📊 Active Bookings (confirmed/checked_in): ${activeBookings}`);

    // 3. Check today's bookings
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todayBookings = await Booking.find({
      $or: [
        { checkIn: { $lte: endOfDay }, checkOut: { $gte: startOfDay } },
        { status: { $in: ['confirmed', 'checked_in'] } }
      ]
    });
    console.log(`📊 Today's Relevant Bookings: ${todayBookings.length}`);

    // 4. Check VIP bookings
    const vipBookings = await Booking.countDocuments({
      $or: [
        { 'guestDetails.vipStatus': { $exists: true, $ne: null } },
        { totalAmount: { $gt: 20000 } }
      ]
    });
    console.log(`👑 VIP Bookings: ${vipBookings}`);

    // 5. Check recent bookings (last 2 hours)
    const recentBookings = await Booking.find({
      createdAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }
    }).sort({ createdAt: -1 }).limit(10);

    console.log(`🕐 Recent Bookings (last 2 hours): ${recentBookings.length}`);
    if (recentBookings.length > 0) {
      console.log('Recent booking details:');
      recentBookings.forEach((booking, index) => {
        console.log(`  ${index + 1}. ID: ${booking.bookingId || booking._id}`);
        console.log(`     Created: ${booking.createdAt}`);
        console.log(`     Guest: ${booking.guestDetails?.name || 'N/A'}`);
        console.log(`     Status: ${booking.status}`);
        console.log('');
      });
    }

    // 6. Check room status
    const roomCounts = await Room.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    console.log('🏨 Room Status Breakdown:');
    roomCounts.forEach(status => {
      console.log(`  ${status._id}: ${status.count}`);
    });

    // 7. Check room blocks
    const activeBlocks = await RoomBlock.countDocuments({
      status: 'active',
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay }
    });
    console.log(`🔲 Active Room Blocks: ${activeBlocks}`);

    // 8. Check waitlist
    const waitlistCount = await WaitingList.countDocuments({
      status: { $in: ['waiting', 'active'] }
    });
    console.log(`⏳ Waitlist Count: ${waitlistCount}`);

    // 9. Check special requests
    const specialRequestsCount = await Booking.countDocuments({
      specialRequests: { $exists: true, $ne: null, $ne: '' }
    });
    console.log(`🎯 Special Requests: ${specialRequestsCount}`);

    // 10. Sample booking data for verification
    console.log('\n=== SAMPLE BOOKING DATA ===');
    const sampleBookings = await Booking.find({}).limit(3).populate('userId', 'username email');
    sampleBookings.forEach((booking, index) => {
      console.log(`\nBooking ${index + 1}:`);
      console.log(`  ID: ${booking.bookingId || booking._id}`);
      console.log(`  Status: ${booking.status}`);
      console.log(`  Check-in: ${booking.checkIn}`);
      console.log(`  Check-out: ${booking.checkOut}`);
      console.log(`  Guest: ${booking.guestDetails?.name || 'N/A'}`);
      console.log(`  Total Amount: ${booking.totalAmount || 'N/A'}`);
      console.log(`  Created: ${booking.createdAt}`);
      console.log(`  VIP Status: ${booking.guestDetails?.vipStatus || 'None'}`);
    });

    // 11. Dashboard calculation simulation
    console.log('\n=== DASHBOARD SIMULATION ===');

    const hotelId = sampleBookings[0]?.hotelId;
    if (hotelId) {
      console.log(`Using hotelId: ${hotelId}`);

      // Simulate dashboard calculation
      const rooms = await Room.find({ hotelId, isActive: true });
      const bookings = await Booking.find({
        hotelId,
        $or: [
          { checkIn: { $lte: endOfDay }, checkOut: { $gte: startOfDay } },
          { status: { $in: ['confirmed', 'checked_in'] } }
        ]
      });

      const vipBookingsForHotel = bookings.filter(b =>
        b.guestDetails?.vipStatus || b.totalAmount > 20000
      );

      console.log(`📊 Dashboard Data for Hotel ${hotelId}:`);
      console.log(`  Total Rooms: ${rooms.length}`);
      console.log(`  Total Reservations: ${bookings.length}`);
      console.log(`  VIP Reservations: ${vipBookingsForHotel.length}`);
      console.log(`  Special Requests: ${bookings.filter(b => b.specialRequests?.length > 0).length}`);
    }

    console.log('\n✅ Database verification completed');

  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

verifyDashboardData();