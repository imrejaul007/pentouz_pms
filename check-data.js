import mongoose from 'mongoose';
import RoomTypeAllotment from './src/models/RoomTypeAllotment.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkData() {
  await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
  console.log('✅ Connected to database');
  
  const sample = await RoomTypeAllotment.findOne().lean();
  console.log('\n📊 Sample record keys:', Object.keys(sample));
  console.log('\n📊 Sample record structure:');
  console.log('Daily allotments length:', sample.dailyAllotments?.length || 0);
  console.log('Daily allocations length:', sample.dailyAllocations?.length || 0);
  console.log('Channels length:', sample.channels?.length || 0);
  console.log('Analytics:', sample.analytics ? 'exists' : 'missing');
  
  if (sample.dailyAllotments?.length > 0) {
    console.log('\n📅 First daily allotment:', JSON.stringify(sample.dailyAllotments[0], null, 2));
  } else if (sample.dailyAllocations?.length > 0) {
    console.log('\n📅 First daily allocation:', JSON.stringify(sample.dailyAllocations[0], null, 2));
  } else {
    console.log('\n❌ Both dailyAllotments and dailyAllocations are empty');
  }
  
  if (sample.channels?.length > 0) {
    console.log('\n📺 First channel:', JSON.stringify(sample.channels[0], null, 2));
  }
  
  if (sample.analytics) {
    console.log('\n📈 Analytics metrics:', JSON.stringify(sample.analytics.metrics, null, 2));
  }
  
  mongoose.connection.close();
}

checkData().catch(console.error);