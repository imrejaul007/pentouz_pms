import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';
import Room from './src/models/Room.js';
import Loyalty from './src/models/Loyalty.js';
import HotelService from './src/models/HotelService.js';
import Notification from './src/models/Notification.js';
import DigitalKey from './src/models/DigitalKey.js';
import MeetUpRequest from './src/models/MeetUpRequest.js';

// Connect to database
await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://hotel:hotel123@cluster0.mongodb.net/hotel-management?retryWrites=true&w=majority');

async function setupTestData() {
  try {
    console.log('🔧 Setting up test data...');
    
    // Create test hotel
    const hotel = await Hotel.findOneAndUpdate(
      { name: 'Test Hotel' },
      {
        name: 'Test Hotel',
        address: '123 Test Street, Test City',
        phone: '+1234567890',
        email: 'test@hotel.com',
        description: 'A test hotel for development',
        amenities: ['WiFi', 'Pool', 'Gym'],
        rating: 4.5,
        isActive: true
      },
      { upsert: true, new: true }
    );
    console.log('✅ Test hotel created:', hotel._id);
    
    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 12);
    const user = await User.findOneAndUpdate(
      { email: 'test@example.com' },
      {
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'guest',
        phone: '+1234567890',
        isActive: true,
        loyaltyPoints: 1000,
        loyaltyTier: 'silver'
      },
      { upsert: true, new: true }
    );
    console.log('✅ Test user created:', user._id);
    
    // Create test room
    const room = await Room.findOneAndUpdate(
      { number: '101' },
      {
        hotelId: hotel._id,
        number: '101',
        type: 'deluxe',
        capacity: 2,
        price: 150,
        amenities: ['WiFi', 'TV', 'AC'],
        isAvailable: true
      },
      { upsert: true, new: true }
    );
    console.log('✅ Test room created:', room._id);
    
    // Create loyalty data
    const loyalty = await Loyalty.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        hotelId: hotel._id,
        points: 1000,
        tier: 'silver',
        totalEarned: 1500,
        totalRedeemed: 500
      },
      { upsert: true, new: true }
    );
    console.log('✅ Loyalty data created');
    
    // Create hotel service
    const service = await HotelService.findOneAndUpdate(
      { name: 'Test Spa Service' },
      {
        hotelId: hotel._id,
        name: 'Test Spa Service',
        description: 'A relaxing spa service',
        type: 'spa',
        price: 100,
        duration: 60,
        isActive: true
      },
      { upsert: true, new: true }
    );
    console.log('✅ Hotel service created');
    
    // Create notification
    const notification = await Notification.findOneAndUpdate(
      { userId: user._id, title: 'Test Notification' },
      {
        userId: user._id,
        hotelId: hotel._id,
        type: 'booking',
        title: 'Test Notification',
        message: 'This is a test notification',
        channels: ['in_app'],
        status: 'unread'
      },
      { upsert: true, new: true }
    );
    console.log('✅ Test notification created');
    
    // Create digital key
    const digitalKey = await DigitalKey.findOneAndUpdate(
      { userId: user._id, roomId: room._id },
      {
        userId: user._id,
        roomId: room._id,
        hotelId: hotel._id,
        keyCode: 'TEST123456',
        status: 'active',
        type: 'primary',
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      },
      { upsert: true, new: true }
    );
    console.log('✅ Digital key created');
    
    // Create meet-up request
    const meetUpRequest = await MeetUpRequest.findOneAndUpdate(
      { requesterId: user._id, title: 'Test Meet-Up' },
      {
        requesterId: user._id,
        targetUserId: user._id, // Self for testing
        hotelId: hotel._id,
        type: 'casual',
        title: 'Test Meet-Up',
        description: 'A test meet-up request',
        proposedDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        proposedTime: { start: '14:00', end: '16:00' },
        location: {
          type: 'hotel_lobby',
          name: 'Hotel Lobby'
        },
        status: 'pending'
      },
      { upsert: true, new: true }
    );
    console.log('✅ Meet-up request created');
    
    console.log('\n🎉 Test data setup completed successfully!');
    console.log('Test credentials:');
    console.log('Email: test@example.com');
    console.log('Password: password123');
    
  } catch (error) {
    console.error('❌ Error setting up test data:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

setupTestData();
