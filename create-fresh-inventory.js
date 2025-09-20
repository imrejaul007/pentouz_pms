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

async function createFreshInventory() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear old inventory data first
    console.log(`\n🗑️ Clearing old inventory data for hotel: ${HOTEL_ID}`);
    const deleted = await RoomAvailability.deleteMany({ hotelId: HOTEL_ID });
    console.log(`✅ Deleted ${deleted.deletedCount} old inventory records`);

    // Get the current room types
    console.log(`\n🏨 Fetching current room types for hotel: ${HOTEL_ID}`);
    const roomTypes = await RoomType.find({ hotelId: HOTEL_ID, isActive: true }).lean();
    console.log(`✅ Found ${roomTypes.length} room types:`);

    roomTypes.forEach(rt => {
      console.log(`  - ${rt.name} (${rt.code}): ID=${rt._id}, Rate=₹${rt.baseRate}, Rooms=${rt.totalRooms}`);
    });

    // Generate inventory data for the next 90 days
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 90);

    console.log(`\n📅 Creating inventory from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    let totalCreated = 0;

    for (const roomType of roomTypes) {
      console.log(`\n🛏️ Creating inventory for ${roomType.name} (${roomType.code})...`);
      
      const currentDate = new Date(startDate);
      let roomTypeCreated = 0;

      while (currentDate <= endDate) {
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        const isHoliday = Math.random() < 0.05; // 5% chance of being a holiday
        
        // Calculate availability (some rooms might be sold or blocked)
        const soldRooms = Math.floor(Math.random() * (roomType.totalRooms * 0.3)); // Up to 30% sold
        const blockedRooms = Math.floor(Math.random() * (roomType.totalRooms * 0.1)); // Up to 10% blocked
        const availableRooms = roomType.totalRooms - soldRooms - blockedRooms;

        // Calculate rates with weekend and holiday premiums in INR
        let sellingRate = roomType.baseRate;
        
        if (isWeekend) sellingRate *= 1.2; // 20% weekend premium
        if (isHoliday) sellingRate *= 1.5; // 50% holiday premium
        
        sellingRate = Math.round(sellingRate);

        // Create restrictions (occasional stop-sell or minimum stays)
        const stopSellFlag = Math.random() < 0.02; // 2% chance of stop-sell
        const minimumStay = isHoliday ? 3 : isWeekend ? 2 : 1;

        const inventoryRecord = new RoomAvailability({
          hotelId: HOTEL_ID,
          roomTypeId: roomType._id, // Use the correct room type ID
          date: new Date(currentDate),
          totalRooms: roomType.totalRooms,
          availableRooms: Math.max(0, availableRooms),
          soldRooms,
          blockedRooms,
          baseRate: roomType.baseRate,
          sellingRate,
          currency: 'INR', // Set to INR
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

      console.log(`  ✅ Created ${roomTypeCreated} records for ${roomType.name}`);
      totalCreated += roomTypeCreated;
    }

    console.log(`\n🎉 Fresh inventory creation completed!`);
    console.log(`📊 Summary:`);
    console.log(`  - Total records created: ${totalCreated}`);
    console.log(`  - Hotel ID: ${HOTEL_ID}`);
    console.log(`  - Room types: ${roomTypes.length}`);
    console.log(`  - Date range: 90 days from today`);
    console.log(`  - Currency: INR (Indian Rupees)`);

    // Verify the data
    console.log(`\n🔍 Verification:`);
    const finalCount = await RoomAvailability.countDocuments({ hotelId: HOTEL_ID });
    console.log(`  - Total inventory records for hotel: ${finalCount}`);

    // Show some sample data
    const samples = await RoomAvailability.find({ hotelId: HOTEL_ID })
      .populate('roomTypeId', 'name code baseRate baseCurrency')
      .limit(5)
      .sort({ date: 1 });

    console.log(`\n📋 Sample data:`);
    samples.forEach((inv, index) => {
      console.log(`  ${index + 1}. ${inv.date.toISOString().split('T')[0]} - ${inv.roomTypeId.name}: ${inv.availableRooms}/${inv.totalRooms} available, Rate: ₹${inv.sellingRate}`);
    });

    console.log(`\n✅ Your Inventory Calendar should now show data with INR currency!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

createFreshInventory();