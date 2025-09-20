import mongoose from 'mongoose';
import Hotel from './src/models/Hotel.js';
import APIKey from './src/models/APIKey.js';
import 'dotenv/config';

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const hotels = await Hotel.find({}).select('_id name');
    console.log('Hotels found:', hotels.length);
    if (hotels.length > 0) {
      console.log('First hotel:', hotels[0]);
    }

    const apiKeys = await APIKey.find({}).select('_id keyId type hotelId');
    console.log('API Keys found:', apiKeys.length);
    if (apiKeys.length > 0) {
      console.log('First API key:', apiKeys[0]);
    }

    await mongoose.disconnect();
    console.log('Check completed');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkData();