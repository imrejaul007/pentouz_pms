import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Import models
import RoomType from './src/models/RoomType.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management';
const HOTEL_ID = '68bc094f80c86bfe258e172b';

async function checkRawRoomTypes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log(`\n🏨 Raw room types data for hotel: ${HOTEL_ID}`);
    
    // Get all room types as raw objects
    const roomTypes = await RoomType.find({ hotelId: HOTEL_ID }).lean();
    console.log(`📊 Found ${roomTypes.length} room types`);

    roomTypes.forEach((rt, index) => {
      console.log(`\n${index + 1}. Raw Room Type Data:`);
      console.log(JSON.stringify(rt, null, 2));
    });

    console.log('\n🔍 Testing what fields are actually available:');
    roomTypes.forEach((rt, index) => {
      console.log(`\n  ${index + 1}. ${rt.name} (${rt.code})`);
      console.log(`     - _id: ${rt._id}`);
      console.log(`     - baseRate: ${rt.baseRate}`);
      console.log(`     - baseCurrency: ${rt.baseCurrency}`);
      console.log(`     - totalRooms: ${rt.totalRooms}`);
      console.log(`     - specifications: ${JSON.stringify(rt.specifications)}`);
      console.log(`     - maxOccupancy from specifications: ${rt.specifications?.maxOccupancy}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

checkRawRoomTypes();