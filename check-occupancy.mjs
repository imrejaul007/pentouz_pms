import mongoose from 'mongoose';
import Booking from './src/models/Booking.js';
import User from './src/models/User.js';
import Room from './src/models/Room.js';

async function checkBookings() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log('=== TODAY\'S DATE:', todayStr, '===');

    // Find all active bookings for today and near dates
    const activeBookings = await Booking.find({
      status: { $in: ['confirmed', 'checked_in'] },
      checkIn: { $lte: today },
      checkOut: { $gt: today }
    }).populate('userId', 'name email').populate('rooms.roomId', 'roomNumber type');

    console.log('\n=== ACTIVE BOOKINGS TODAY ===');
    console.log('Total active bookings:', activeBookings.length);

    activeBookings.forEach(booking => {
      console.log({
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        checkIn: booking.checkIn?.toISOString().split('T')[0],
        checkOut: booking.checkOut?.toISOString().split('T')[0],
        guest: booking.userId?.name,
        rooms: booking.rooms?.map(r => r.roomId?.roomNumber).join(', '),
        source: booking.bookingSource
      });
    });

    // Check all bookings regardless of status
    const allBookings = await Booking.find({}).populate('userId', 'name').populate('rooms.roomId', 'roomNumber');
    console.log('\n=== ALL BOOKINGS IN DATABASE ===');
    console.log('Total bookings:', allBookings.length);

    allBookings.slice(0, 10).forEach(booking => {
      console.log({
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        checkIn: booking.checkIn?.toISOString().split('T')[0],
        checkOut: booking.checkOut?.toISOString().split('T')[0],
        guest: booking.userId?.name,
        rooms: booking.rooms?.map(r => r.roomId?.roomNumber).join(', ')
      });
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkBookings();