import mongoose from 'mongoose';
import Booking from './src/models/Booking.js';
import Room from './src/models/Room.js';

// Connect to MongoDB
await mongoose.connect('mongodb://localhost:27017/hotel_management');

const hotelId = '68afe8080c02fcbe30092b8e';

// Get some rooms
const rooms = await Room.find({ hotelId, isActive: true }).limit(3);
console.log('Found rooms:', rooms.map(r => ({ id: r._id, number: r.roomNumber, status: r.status })));

if (rooms.length === 0) {
  console.log('No rooms found. Please create rooms first.');
  process.exit(1);
}

// Create test bookings
const today = new Date();
const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
const dayAfterTomorrow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);

const testBookings = [
  {
    hotelId,
    userId: '507f1f77bcf86cd799439011', // Mock user ID
    checkIn: today,
    checkOut: dayAfterTomorrow,
    nights: 2,
    status: 'checked_in',
    rooms: [{ roomId: rooms[0]._id, rate: rooms[0].currentRate }],
    totalAmount: rooms[0].currentRate * 2,
    paymentStatus: 'paid',
    guestDetails: {
      adults: 2,
      children: 0,
      specialRequests: 'Early check-in requested'
    }
  },
  {
    hotelId,
    userId: '507f1f77bcf86cd799439012', // Mock user ID
    checkIn: today,
    checkOut: tomorrow,
    nights: 1,
    status: 'confirmed',
    rooms: [{ roomId: rooms[1]._id, rate: rooms[1].currentRate }],
    totalAmount: rooms[1].currentRate,
    paymentStatus: 'paid',
    guestDetails: {
      adults: 1,
      children: 0
    }
  }
];

// Create the bookings
for (const bookingData of testBookings) {
  const booking = new Booking(bookingData);
  await booking.save();
  console.log('Created booking:', booking._id, 'for room:', bookingData.rooms[0].roomId);
}

console.log('Test bookings created successfully!');
process.exit(0);
