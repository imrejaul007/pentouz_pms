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
import RoomAvailability from './src/models/RoomAvailability.js';

const MONGO_URI = process.env.MONGO_URI; // Using correct variable from .env
const HOTEL_ID = '68bc094f80c86bfe258e172b';

async function checkCloudDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB Atlas Cloud Database...');
    console.log(`📡 Database URI: ${MONGO_URI?.substring(0, 50)}...`);
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    console.log(`\n🏨 Checking room types in CLOUD database for hotel: ${HOTEL_ID}`);
    
    // Get all room types from cloud database
    const roomTypes = await RoomType.find({ hotelId: HOTEL_ID }).lean();
    console.log(`📊 Found ${roomTypes.length} room types in cloud database:`);
    
    roomTypes.forEach((rt, index) => {
      console.log(`\n${index + 1}. ${rt.name} (${rt.code})`);
      console.log(`   - ID: ${rt._id}`);
      console.log(`   - Base Rate: ${rt.baseCurrency || 'USD'} ${rt.baseRate || 'undefined'}`);
      console.log(`   - Total Rooms: ${rt.totalRooms || 'undefined'}`);
      console.log(`   - Max Occupancy: ${rt.specifications?.maxOccupancy || 'undefined'}`);
      console.log(`   - Active: ${rt.isActive}`);
      console.log(`   - Created: ${rt.createdAt}`);
      console.log(`   - Updated: ${rt.updatedAt}`);
    });

    // Check what the API endpoint would return
    console.log(`\n🔍 Testing API endpoint response from cloud database:`);
    const activeRoomTypes = await RoomType.find({ 
      hotelId: HOTEL_ID, 
      isActive: true 
    }).select('_id name code baseRate totalRooms specifications.maxOccupancy baseCurrency');

    console.log(`📡 API would return ${activeRoomTypes.length} active room types:`);
    activeRoomTypes.forEach((rt, index) => {
      console.log(`  ${index + 1}. ${rt.name} (${rt.code})`);
      console.log(`     - ID: ${rt._id}`);
      console.log(`     - Price: ${rt.baseCurrency || 'USD'} ${rt.baseRate || 'undefined'}`);
      console.log(`     - Max Occupancy: ${rt.specifications?.maxOccupancy || 2}`);
      console.log(`     - Total Rooms: ${rt.totalRooms || 'undefined'}`);
    });

    // Check inventory count
    console.log(`\n📅 Checking inventory in cloud database:`);
    const inventoryCount = await RoomAvailability.countDocuments({ hotelId: HOTEL_ID });
    console.log(`📋 Total inventory records: ${inventoryCount}`);

    if (inventoryCount > 0) {
      // Sample some inventory records
      const sampleInventory = await RoomAvailability.find({ hotelId: HOTEL_ID }).limit(5).lean();
      console.log(`\n🔍 Sample inventory records:`);
      sampleInventory.forEach((record, i) => {
        console.log(`  ${i+1}. Date: ${record.date.toISOString().split('T')[0]}, Room Type ID: ${record.roomTypeId}, Total: ${record.totalRooms}, Rate: ${record.currency || 'USD'} ${record.baseRate}`);
      });

      // Check today's inventory
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayInventory = await RoomAvailability.find({ 
        hotelId: HOTEL_ID,
        date: today
      }).lean();
      
      console.log(`\n📅 Today's inventory (${today.toDateString()}):`);
      if (todayInventory.length > 0) {
        todayInventory.forEach((record, i) => {
          const matchingRoomType = roomTypes.find(rt => rt._id.toString() === record.roomTypeId);
          console.log(`  ${i+1}. ${matchingRoomType ? matchingRoomType.name : 'Unknown'} - Room Type ID: ${record.roomTypeId}`);
          console.log(`      Total: ${record.totalRooms}, Available: ${record.availableRooms}, Rate: ${record.currency || 'USD'} ${record.baseRate}`);
        });
      } else {
        console.log(`  📭 No inventory records found for today`);
      }
    }

    // Check for room type ID mismatches
    console.log(`\n🔍 Checking for room type ID consistency:`);
    const inventoryRoomTypeIds = await RoomAvailability.distinct('roomTypeId', { hotelId: HOTEL_ID });
    const actualRoomTypeIds = roomTypes.map(rt => rt._id.toString());
    
    console.log(`📋 Room type IDs in inventory: ${inventoryRoomTypeIds.length}`);
    inventoryRoomTypeIds.forEach(id => console.log(`   - ${id}`));
    
    console.log(`📋 Actual room type IDs in database: ${actualRoomTypeIds.length}`);
    actualRoomTypeIds.forEach(id => console.log(`   - ${id}`));
    
    const mismatched = inventoryRoomTypeIds.filter(id => !actualRoomTypeIds.includes(id));
    if (mismatched.length > 0) {
      console.log(`⚠️ WARNING: ${mismatched.length} inventory records have room type IDs that don't match any actual room types:`);
      mismatched.forEach(id => console.log(`   - ${id}`));
    } else {
      console.log(`✅ All inventory room type IDs match actual room types`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

checkCloudDatabase();