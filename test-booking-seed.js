import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';
import Room from './src/models/Room.js';
import Booking from './src/models/Booking.js';
import CorporateCompany from './src/models/CorporateCompany.js';
import GroupBooking from './src/models/GroupBooking.js';
import { Channel } from './src/models/ChannelManager.js';

dotenv.config();

async function testBookingSeed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management');
    console.log('MongoDB connected successfully');

    // Get existing data
    const hotel = await Hotel.findOne();
    const users = await User.find({ role: 'guest' }).limit(5);
    const rooms = await Room.find().limit(10);

    if (!hotel || users.length === 0 || rooms.length === 0) {
      console.error('Missing required data. Run main seed script first.');
      return;
    }

    console.log(`Found hotel: ${hotel.name}`);
    console.log(`Found ${users.length} users`);
    console.log(`Found ${rooms.length} rooms`);

    // Create a simple booking
    const simpleBooking = {
      hotelId: hotel._id,
      userId: users[0]._id,
      bookingNumber: 'TEST-001',
      rooms: [{
        roomId: rooms[0]._id,
        rate: 3500
      }],
      checkIn: new Date('2024-12-20'),
      checkOut: new Date('2024-12-22'),
      nights: 2,
      status: 'confirmed',
      paymentStatus: 'paid',
      totalAmount: 7000,
      currency: 'INR',
      source: 'direct',
      guestDetails: {
        adults: 2,
        children: 0,
        specialRequests: 'Test booking'
      }
    };

    console.log('Creating test booking...');
    const booking = await Booking.create(simpleBooking);
    console.log(`✅ Created booking: ${booking.bookingNumber}`);

    console.log('Test completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testBookingSeed();