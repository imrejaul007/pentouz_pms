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

async function fixExistingRoomTypes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log(`\n🏨 Fixing room types for hotel: ${HOTEL_ID}`);
    
    // These are the exact IDs from the database screenshot
    const roomTypeUpdates = [
      {
        id: '68bc094f80c86bfe258e1731',
        code: 'STD',
        name: 'Standard Room',
        baseRate: 8000,
        totalRooms: 20,
        maxOccupancy: 2
      },
      {
        id: '68bc094f80c86bfe258e1736', 
        code: 'DLX',
        name: 'Deluxe Room',
        baseRate: 12000,
        totalRooms: 15,
        maxOccupancy: 3
      },
      {
        id: '68bc094f80c86bfe258e173d',
        code: 'STE', 
        name: 'Premium Suite',
        baseRate: 20000,
        totalRooms: 8,
        maxOccupancy: 4
      },
      {
        id: '68bc094f80c86bfe258e1746',
        code: 'EXE',
        name: 'Executive Deluxe',
        baseRate: 28000,
        totalRooms: 5,
        maxOccupancy: 4
      }
    ];

    console.log('\n🔧 Updating room types...');
    
    for (const update of roomTypeUpdates) {
      console.log(`\n📝 Updating ${update.name} (${update.code})...`);
      
      await RoomType.findByIdAndUpdate(update.id, {
        baseRate: update.baseRate,
        baseCurrency: 'INR',
        totalRooms: update.totalRooms,
        'specifications.maxOccupancy': update.maxOccupancy
      });
      
      console.log(`  ✅ Updated: ₹${update.baseRate}, ${update.totalRooms} rooms, max ${update.maxOccupancy} guests`);
    }

    console.log('\n🗑️ Clearing old inventory data...');
    const deleted = await RoomAvailability.deleteMany({ hotelId: HOTEL_ID });
    console.log(`✅ Deleted ${deleted.deletedCount} old inventory records`);

    console.log('\n📅 Creating fresh inventory with correct room type IDs...');
    
    // Generate inventory data for the next 90 days
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 90);

    let totalCreated = 0;

    for (const roomTypeUpdate of roomTypeUpdates) {
      console.log(`\n🛏️ Creating inventory for ${roomTypeUpdate.name}...`);
      
      const currentDate = new Date(startDate);
      let roomTypeCreated = 0;

      while (currentDate <= endDate) {
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        const isHoliday = Math.random() < 0.05;
        
        const soldRooms = Math.floor(Math.random() * (roomTypeUpdate.totalRooms * 0.3));
        const blockedRooms = Math.floor(Math.random() * (roomTypeUpdate.totalRooms * 0.1));
        const availableRooms = roomTypeUpdate.totalRooms - soldRooms - blockedRooms;

        let sellingRate = roomTypeUpdate.baseRate;
        if (isWeekend) sellingRate *= 1.2;
        if (isHoliday) sellingRate *= 1.5;
        sellingRate = Math.round(sellingRate);

        const stopSellFlag = Math.random() < 0.02;
        const minimumStay = isHoliday ? 3 : isWeekend ? 2 : 1;

        const inventoryRecord = new RoomAvailability({
          hotelId: HOTEL_ID,
          roomTypeId: roomTypeUpdate.id, // Use the exact ID from the frontend
          date: new Date(currentDate),
          totalRooms: roomTypeUpdate.totalRooms,
          availableRooms: Math.max(0, availableRooms),
          soldRooms,
          blockedRooms,
          baseRate: roomTypeUpdate.baseRate,
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

    console.log(`\n🎉 Fix completed!`);
    console.log(`📊 Summary:`);
    console.log(`  - Room types updated: ${roomTypeUpdates.length}`);
    console.log(`  - Inventory records created: ${totalCreated}`);
    console.log(`  - Currency: INR (Indian Rupees)`);
    
    // Verify the updates
    console.log(`\n🔍 Verification:`);
    for (const update of roomTypeUpdates) {
      const roomType = await RoomType.findById(update.id);
      console.log(`  - ${roomType.name}: ₹${roomType.baseRate}, ${roomType.totalRooms} rooms`);
    }

    const inventoryCount = await RoomAvailability.countDocuments({ hotelId: HOTEL_ID });
    console.log(`  - Total inventory records: ${inventoryCount}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

fixExistingRoomTypes();