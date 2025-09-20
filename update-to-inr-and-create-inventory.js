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

const MONGO_URI = process.env.MONGO_URI;
const HOTEL_ID = '68bc094f80c86bfe258e172b';

async function updateToINRAndCreateInventory() {
  try {
    console.log('🔄 Connecting to MongoDB Atlas Cloud Database...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    console.log(`\n🏨 Updating room types to INR currency for hotel: ${HOTEL_ID}`);
    
    // Get current room types from cloud database
    const roomTypes = await RoomType.find({ hotelId: HOTEL_ID }).lean();
    console.log(`📊 Found ${roomTypes.length} room types to update:`);

    // Update each room type to use INR currency (keeping same price values)
    for (const roomType of roomTypes) {
      console.log(`\n💰 Updating ${roomType.name} to INR currency...`);
      console.log(`   Current: ${roomType.baseCurrency || 'USD'} ${roomType.baseRate}`);
      
      await RoomType.findByIdAndUpdate(roomType._id, {
        baseCurrency: 'INR',
        // Keep the same price values, just change currency
        baseRate: roomType.baseRate,
        updatedAt: new Date()
      });
      
      console.log(`   Updated: INR ₹${roomType.baseRate}`);
    }

    console.log('\n🗑️ Clearing old inventory data...');
    const deleted = await RoomAvailability.deleteMany({ hotelId: HOTEL_ID });
    console.log(`✅ Deleted ${deleted.deletedCount} old inventory records`);

    console.log('\n📅 Creating inventory data with correct room type IDs...');
    
    // Generate inventory data for the next 90 days
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 90);

    let totalCreated = 0;

    // Room type data from your cloud database
    const roomTypeData = [
      {
        id: '68bc094f80c86bfe258e1731',
        name: 'Standard Room',
        code: 'STD', 
        baseRate: 2500,
        totalRooms: 40,
        maxOccupancy: 2
      },
      {
        id: '68bc094f80c86bfe258e1736',
        name: 'Deluxe Room',
        code: 'DLX',
        baseRate: 3500, 
        totalRooms: 30,
        maxOccupancy: 3
      },
      {
        id: '68bc094f80c86bfe258e173d',
        name: 'Premium Suite',
        code: 'STE',
        baseRate: 8000,
        totalRooms: 10,
        maxOccupancy: 4
      },
      {
        id: '68bc094f80c86bfe258e1746',
        name: 'Executive Deluxe', 
        code: 'EXE',
        baseRate: 16000,
        totalRooms: 20,
        maxOccupancy: 4
      }
    ];

    for (const roomTypeInfo of roomTypeData) {
      console.log(`\n🛏️ Creating inventory for ${roomTypeInfo.name}...`);
      
      const currentDate = new Date(startDate);
      let roomTypeCreated = 0;

      while (currentDate <= endDate) {
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        const isHoliday = Math.random() < 0.05;
        
        // Generate realistic occupancy data
        const soldRooms = Math.floor(Math.random() * (roomTypeInfo.totalRooms * 0.4));
        const blockedRooms = Math.floor(Math.random() * (roomTypeInfo.totalRooms * 0.05));
        const availableRooms = roomTypeInfo.totalRooms - soldRooms - blockedRooms;

        // Apply pricing adjustments for weekends/holidays
        let sellingRate = roomTypeInfo.baseRate;
        if (isWeekend) sellingRate *= 1.15;
        if (isHoliday) sellingRate *= 1.3;
        sellingRate = Math.round(sellingRate);

        const stopSellFlag = Math.random() < 0.02;
        const minimumStay = isHoliday ? 3 : isWeekend ? 2 : 1;

        const inventoryRecord = new RoomAvailability({
          hotelId: HOTEL_ID,
          roomTypeId: roomTypeInfo.id, // Use exact ID from cloud database
          date: new Date(currentDate),
          totalRooms: roomTypeInfo.totalRooms,
          availableRooms: Math.max(0, availableRooms),
          soldRooms,
          blockedRooms,
          baseRate: roomTypeInfo.baseRate,
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

    console.log(`\n🎉 Update completed successfully!`);
    console.log(`📊 Summary:`);
    console.log(`  - Room types updated to INR: ${roomTypes.length}`);
    console.log(`  - Inventory records created: ${totalCreated}`);
    console.log(`  - Currency: INR (Indian Rupees)`);
    
    // Verification
    console.log(`\n🔍 Verification:`);
    
    // Check updated room types
    const updatedRoomTypes = await RoomType.find({ hotelId: HOTEL_ID });
    console.log(`💰 Updated room types (now in INR):`);
    updatedRoomTypes.forEach(rt => {
      console.log(`  - ${rt.name}: ₹${rt.baseRate} (${rt.baseCurrency}), ${rt.totalRooms} rooms`);
    });
    
    // Check today's inventory
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayInventory = await RoomAvailability.find({ 
      hotelId: HOTEL_ID,
      date: today
    }).lean();
    
    console.log(`\n📅 Today's inventory (${today.toDateString()}):`);
    todayInventory.forEach((record, i) => {
      const roomTypeInfo = roomTypeData.find(rt => rt.id === record.roomTypeId);
      console.log(`  ${i+1}. ${roomTypeInfo?.name}: ${record.totalRooms} total, ${record.availableRooms} available, ₹${record.baseRate} base rate`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

updateToINRAndCreateInventory();