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

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management';
const HOTEL_ID = '68bc094f80c86bfe258e172b';

async function fixInventoryWithCorrectIds() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log(`\n🏨 Getting correct room type IDs for hotel: ${HOTEL_ID}`);
    
    // Get actual room types from database
    const roomTypes = await RoomType.find({ hotelId: HOTEL_ID, isActive: true }).lean();
    console.log(`📊 Found ${roomTypes.length} active room types:`);
    
    roomTypes.forEach((rt, index) => {
      console.log(`  ${index + 1}. ${rt.name} (${rt.code})`);
      console.log(`     - ID: ${rt._id}`);
      console.log(`     - Base Rate: ₹${rt.baseRate}`);
      console.log(`     - Total Rooms: ${rt.totalRooms}`);
      console.log(`     - Max Occupancy: ${rt.specifications?.maxOccupancy}`);
    });

    console.log('\n🗑️ Clearing old inventory data...');
    const deleted = await RoomAvailability.deleteMany({ hotelId: HOTEL_ID });
    console.log(`✅ Deleted ${deleted.deletedCount} old inventory records`);

    console.log('\n📅 Creating fresh inventory with CORRECT room type IDs...');
    
    // Generate inventory data for the next 90 days
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 90);

    let totalCreated = 0;

    for (const roomType of roomTypes) {
      console.log(`\n🛏️ Creating inventory for ${roomType.name}...`);
      
      const currentDate = new Date(startDate);
      let roomTypeCreated = 0;

      while (currentDate <= endDate) {
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        const isHoliday = Math.random() < 0.05;
        
        const soldRooms = Math.floor(Math.random() * (roomType.totalRooms * 0.3));
        const blockedRooms = Math.floor(Math.random() * (roomType.totalRooms * 0.1));
        const availableRooms = roomType.totalRooms - soldRooms - blockedRooms;

        let sellingRate = roomType.baseRate;
        if (isWeekend) sellingRate *= 1.2;
        if (isHoliday) sellingRate *= 1.5;
        sellingRate = Math.round(sellingRate);

        const stopSellFlag = Math.random() < 0.02;
        const minimumStay = isHoliday ? 3 : isWeekend ? 2 : 1;

        const inventoryRecord = new RoomAvailability({
          hotelId: HOTEL_ID,
          roomTypeId: roomType._id.toString(), // Use ACTUAL room type ID from database
          date: new Date(currentDate),
          totalRooms: roomType.totalRooms,
          availableRooms: Math.max(0, availableRooms),
          soldRooms,
          blockedRooms,
          baseRate: roomType.baseRate,
          sellingRate,
          currency: 'INR',
          stopSellFlag,
          closedToArrival: stopSellFlag && Math.random() < 0.5,
          closedToDeparture: stopSellFlag && Math.random() < 0.5,
          minimumStay,
          maximumStay: 14,
          needsSync: true,
          lastModified: new Date(),
          channelInventory: [],
          reservations: soldRooms > 0 ? [{
            bookingId: new mongoose.Types.ObjectId(),
            roomsReserved: soldRooms,
            source: 'direct'
          }] : []
        });

        await inventoryRecord.save();
        roomTypeCreated++;
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`  ✅ Created ${roomTypeCreated} inventory records`);
      totalCreated += roomTypeCreated;
    }

    console.log(`\n🎉 Inventory fix completed!`);
    console.log(`📊 Summary:`);
    console.log(`  - Room types processed: ${roomTypes.length}`);
    console.log(`  - Inventory records created: ${totalCreated}`);
    console.log(`  - Currency: INR (Indian Rupees)`);
    
    // Verification
    console.log(`\n🔍 Verification - Today's inventory:`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayInventory = await RoomAvailability.find({ 
      hotelId: HOTEL_ID,
      date: today
    }).lean();
    
    console.log(`📅 Found ${todayInventory.length} records for today:`);
    for (const record of todayInventory) {
      const roomType = roomTypes.find(rt => rt._id.toString() === record.roomTypeId);
      console.log(`  - ${roomType?.name}: ${record.totalRooms} total, ${record.availableRooms} available, ₹${record.baseRate}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

fixInventoryWithCorrectIds();