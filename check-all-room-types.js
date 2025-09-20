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

async function checkAllRoomTypes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log(`\n🏨 ALL room types for hotel: ${HOTEL_ID}`);
    
    // Get ALL room types (active and inactive)
    const allRoomTypes = await RoomType.find({ hotelId: HOTEL_ID }).lean();
    console.log(`📊 Total room types found: ${allRoomTypes.length}`);

    allRoomTypes.forEach((rt, index) => {
      console.log(`\n${index + 1}. ${rt.name} (${rt.code})`);
      console.log(`   - ID: ${rt._id}`);
      console.log(`   - Base Rate: ${rt.baseCurrency || 'USD'} ${rt.baseRate || 'undefined'}`);
      console.log(`   - Max Occupancy: ${rt.specifications?.maxOccupancy || 'undefined'}`);
      console.log(`   - Total Rooms: ${rt.totalRooms || 'undefined'}`);
      console.log(`   - Active: ${rt.isActive}`);
      console.log(`   - Created: ${rt.createdAt}`);
    });

    // Also check what the API endpoint returns
    console.log(`\n🔍 Testing API endpoint response:`);
    const activeRoomTypes = await RoomType.find({ 
      hotelId: HOTEL_ID, 
      isActive: true 
    }).select('_id name code baseRate totalRooms specifications.maxOccupancy');

    const options = activeRoomTypes.map(rt => ({
      id: rt._id.toString(),
      name: rt.name,
      code: rt.code,
      basePrice: rt.baseRate,
      maxOccupancy: rt.specifications?.maxOccupancy || 2,
    }));

    console.log(`📡 API would return ${options.length} options:`);
    options.forEach((opt, index) => {
      console.log(`  ${index + 1}. ${opt.name} (${opt.code}) - ID: ${opt.id} - Price: ₹${opt.basePrice}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

checkAllRoomTypes();