import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkGuestUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database\n');

    // Check guest users
    console.log('=== GUEST USERS ===');
    const guestUsers = await User.find({ role: 'guest' }).limit(5);
    guestUsers.forEach(user => {
      console.log(`User: ${user.name} (${user.email})`);
      console.log(`HotelID: ${user.hotelId}`);
      console.log(`Role: ${user.role}`);
      console.log('---');
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkGuestUsers();