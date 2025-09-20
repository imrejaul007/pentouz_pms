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

async function testRoomTypesAPI() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log(`\n🏨 Testing room types API for hotel: ${HOTEL_ID}`);
    
    // Simulate what the API endpoint does
    const roomTypes = await RoomType.find({ 
      hotelId: HOTEL_ID, 
      isActive: true 
    }).select('_id name code baseRate totalRooms specifications.maxOccupancy');

    console.log(`📊 Found ${roomTypes.length} room types`);

    // Map to API response format
    const options = roomTypes.map(rt => ({
      id: rt._id.toString(), // Frontend expects 'id', not '_id'
      _id: rt._id,
      roomTypeId: rt._id.toString(),
      name: rt.name,
      code: rt.code,
      basePrice: rt.baseRate, // Map baseRate to basePrice for frontend compatibility
      baseRate: rt.baseRate,  // Keep baseRate as well for any legacy usage
      totalRooms: rt.totalRooms,
      maxOccupancy: rt.specifications?.maxOccupancy || 2,
      legacyType: rt.code.toLowerCase()
    }));

    console.log('\n📡 API Response Format:');
    console.log(JSON.stringify({ success: true, data: options }, null, 2));

    console.log('\n✅ This should populate the dropdown correctly!');
    console.log('Frontend should now see options like:');
    options.forEach((opt, index) => {
      console.log(`  ${index + 1}. ${opt.name} (${opt.code}) - ₹${opt.basePrice} - Max ${opt.maxOccupancy}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

testRoomTypesAPI();