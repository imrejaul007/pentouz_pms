import mongoose from 'mongoose';
import Booking from './src/models/Booking.js';
import Room from './src/models/Room.js';
import User from './src/models/User.js';

async function testDashboardData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    console.log('=== TESTING DASHBOARD CALCULATION ===');
    console.log('Date range:', startOfDay.toISOString(), 'to', endOfDay.toISOString());

    // Check rooms
    const rooms = await Room.find({ isActive: true });
    console.log('\n🏨 ROOMS DATA:');
    console.log('Total rooms:', rooms.length);

    const roomsByStatus = rooms.reduce((acc, room) => {
      acc[room.status] = (acc[room.status] || 0) + 1;
      return acc;
    }, {});
    console.log('Rooms by status:', roomsByStatus);

    // Check bookings with the same logic as dashboard
    const bookings = await Booking.find({
      $or: [
        { checkIn: { $lte: endOfDay }, checkOut: { $gte: startOfDay } },
        { status: { $in: ['confirmed', 'checked_in'] } }
      ]
    }).populate('rooms.roomId');

    console.log('\n📅 BOOKINGS DATA:');
    console.log('Total bookings found:', bookings.length);

    bookings.forEach(booking => {
      console.log({
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        checkIn: booking.checkIn?.toISOString().split('T')[0],
        checkOut: booking.checkOut?.toISOString().split('T')[0],
        rooms: booking.rooms?.map(r => r.roomId?.roomNumber).join(', ')
      });
    });

    // Calculate using same logic as service
    const occupiedRooms = roomsByStatus.occupied || 0;
    const availableRooms = roomsByStatus.vacant || 0;

    // Calculate reserved rooms from active bookings
    const now = new Date();
    const reservedRooms = bookings.filter(booking => {
      const isActive = ['confirmed', 'checked_in'].includes(booking.status) &&
                      new Date(booking.checkIn) <= now &&
                      new Date(booking.checkOut) > now;
      console.log(`Booking ${booking.bookingNumber}: active = ${isActive}, status = ${booking.status}`);
      return isActive;
    }).length;

    const actualOccupiedRooms = Math.max(occupiedRooms, reservedRooms);

    console.log('\n🔢 CALCULATIONS:');
    console.log('- occupied from room status:', occupiedRooms);
    console.log('- reserved from bookings:', reservedRooms);
    console.log('- actual occupied (max):', actualOccupiedRooms);
    console.log('- available rooms:', availableRooms);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testDashboardData();