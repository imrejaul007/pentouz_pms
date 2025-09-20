import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Booking from './src/models/Booking.js';
import Room from './src/models/Room.js';
import Hotel from './src/models/Hotel.js';

dotenv.config();

async function createBookingsForJohn() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0');

    // Find John Doe
    const john = await User.findOne({ email: 'john@example.com' });
    if (!john) {
      console.log('John Doe not found!');
      await mongoose.disconnect();
      return;
    }
    console.log('Found John Doe:', john.name, john._id);

    // Find hotel
    const hotel = await Hotel.findOne();
    if (!hotel) {
      console.log('No hotel found!');
      await mongoose.disconnect();
      return;
    }
    console.log('Found hotel:', hotel.name);

    // Find some rooms
    const rooms = await Room.find({ hotelId: hotel._id }).limit(3);
    if (rooms.length === 0) {
      console.log('No rooms found!');
      await mongoose.disconnect();
      return;
    }
    console.log('Found', rooms.length, 'rooms');

    // Create bookings for John
    const today = new Date();
    const bookings = [
      {
        hotelId: hotel._id,
        userId: john._id,
        rooms: [{
          roomId: rooms[0]._id,
          rate: rooms[0].currentRate || rooms[0].baseRate || 3000
        }],
        checkIn: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        checkOut: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        nights: 3,
        status: 'confirmed',
        paymentStatus: 'paid',
        totalAmount: (rooms[0].currentRate || rooms[0].baseRate || 3000) * 3,
        currency: 'INR',
        guestDetails: {
          adults: 2,
          children: 0,
          specialRequests: 'Late check-in requested'
        },
        bookingNumber: 'BK' + Date.now() + '001',
        source: 'direct',
        channelBookingId: 'DIRECT-' + Date.now() + '-1',
        idempotencyKey: 'john-booking-1-' + Date.now(),
        roomType: rooms[0].type || 'deluxe'
      },
      {
        hotelId: hotel._id,
        userId: john._id,
        rooms: [{
          roomId: rooms[1]._id,
          rate: rooms[1].currentRate || rooms[1].baseRate || 4000
        }],
        checkIn: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        checkOut: new Date(today.getTime() + 35 * 24 * 60 * 60 * 1000), // 35 days from now
        nights: 5,
        status: 'pending',
        paymentStatus: 'pending',
        totalAmount: (rooms[1].currentRate || rooms[1].baseRate || 4000) * 5,
        currency: 'INR',
        guestDetails: {
          adults: 1,
          children: 1,
          specialRequests: 'Need crib for baby'
        },
        bookingNumber: 'BK' + Date.now() + '002',
        source: 'direct',
        channelBookingId: 'DIRECT-' + Date.now() + '-2',
        idempotencyKey: 'john-booking-2-' + Date.now(),
        roomType: rooms[1].type || 'suite'
      },
      {
        hotelId: hotel._id,
        userId: john._id,
        rooms: [{
          roomId: rooms[2]._id,
          rate: rooms[2].currentRate || rooms[2].baseRate || 5000
        }],
        checkIn: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        checkOut: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        nights: 5,
        status: 'checked_out',
        paymentStatus: 'paid',
        totalAmount: (rooms[2].currentRate || rooms[2].baseRate || 5000) * 5,
        currency: 'INR',
        guestDetails: {
          adults: 2,
          children: 2
        },
        bookingNumber: 'BK' + Date.now() + '003',
        source: 'direct',
        channelBookingId: 'DIRECT-' + Date.now() + '-3',
        idempotencyKey: 'john-booking-3-' + Date.now(),
        roomType: rooms[2].type || 'deluxe'
      }
    ];

    console.log('Creating bookings...');
    const createdBookings = await Booking.create(bookings);
    console.log('✅ Created', createdBookings.length, 'bookings for John Doe');
    console.log('Booking details:');
    createdBookings.forEach(b => {
      console.log(`  - ${b.bookingNumber}: ${b.status} | ${b.roomType} | ₹${b.totalAmount}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

createBookingsForJohn();