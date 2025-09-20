import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Import models
import RoomAvailability from './src/models/RoomAvailability.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management';
const HOTEL_ID = '68bc094f80c86bfe258e172b';

async function checkInventory() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log(`\n📊 Checking inventory for hotel: ${HOTEL_ID}`);
    
    const count = await RoomAvailability.countDocuments({ hotelId: HOTEL_ID });
    console.log(`📋 Total inventory records: ${count}`);
    
    // Get today's inventory to check current data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayInventory = await RoomAvailability.find({ 
      hotelId: HOTEL_ID,
      date: today
    }).lean();
    
    console.log(`\n📅 Today's inventory (${today.toDateString()}):`);
    todayInventory.forEach((record, i) => {
      console.log(`  ${i+1}. Room Type: ${record.roomTypeId}, Total: ${record.totalRooms}, Available: ${record.availableRooms}, Base Rate: ₹${record.baseRate}, Selling Rate: ₹${record.sellingRate}`);
    });
    
    // Sample records from different dates
    console.log(`\n🔍 Sample records from database:`);
    const samples = await RoomAvailability.find({ hotelId: HOTEL_ID }).limit(5).lean();
    samples.forEach((record, i) => {
      console.log(`  ${i+1}. Date: ${record.date.toISOString().split('T')[0]}, Room Type: ${record.roomTypeId}, Total: ${record.totalRooms}, Rate: ₹${record.baseRate}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

checkInventory();