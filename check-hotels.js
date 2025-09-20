import mongoose from 'mongoose';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkHotelsAndUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database\n');

    // Check hotels
    const hotels = await Hotel.find({});
    console.log('=== HOTELS IN DATABASE ===');
    hotels.forEach(hotel => {
      console.log(`ID: ${hotel._id}`);
      console.log(`Name: ${hotel.name}`);
      console.log(`Created: ${hotel.createdAt}`);
      console.log('---');
    });

    // Check admin users
    console.log('\n=== ADMIN USERS ===');
    const adminUsers = await User.find({ role: 'admin' });
    adminUsers.forEach(user => {
      console.log(`User: ${user.name} (${user.email})`);
      console.log(`HotelID: ${user.hotelId}`);
      console.log(`Created: ${user.createdAt}`);
      console.log('---');
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkHotelsAndUsers();