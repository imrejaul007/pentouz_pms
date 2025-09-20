import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Import models
import './src/models/Hotel.js';
import './src/models/Room.js';
import RoomType from './src/models/RoomType.js';
import RoomAvailability from './src/models/RoomAvailability.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management';

// Use the specific hotel ID provided
const HOTEL_ID = '68bc094f80c86bfe258e172b';

async function seedInventoryData() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Fetch room types for the specific hotel
    console.log(`\n🏨 Fetching room types for hotel: ${HOTEL_ID}`);
    const roomTypes = await RoomType.find({ 
      hotelId: HOTEL_ID, 
      isActive: true 
    });

    if (roomTypes.length === 0) {
      console.log('❌ No room types found for this hotel! Cannot create inventory.');
      return;
    }

    console.log(`✅ Found ${roomTypes.length} room types:`);
    roomTypes.forEach(rt => {
      console.log(`  - ${rt.name} (${rt.code}) - Base Price: ${rt.currency} ${rt.basePrice}`);
    });

    // Check if inventory already exists
    const existingInventory = await RoomAvailability.countDocuments({ hotelId: HOTEL_ID });
    if (existingInventory > 0) {
      console.log(`\n⚠️ Found ${existingInventory} existing inventory records for this hotel.`);
      console.log('Do you want to continue and add more data? (This will not delete existing data)');
    }

    // Generate inventory data for the next 90 days
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 90);

    console.log(`\n📅 Creating inventory from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const roomType of roomTypes) {
      console.log(`\n🛏️ Processing ${roomType.name} (${roomType.code})...`);
      
      // Get total rooms for this room type (or use a default)
      const Room = mongoose.model('Room');
      let totalRooms = await Room.countDocuments({
        hotelId: HOTEL_ID,
        roomTypeId: roomType._id,
        isActive: true
      });

      // If no rooms found, use a default based on room type
      if (totalRooms === 0) {
        totalRooms = roomType.code === 'STD' ? 20 : 
                    roomType.code === 'DLX' ? 15 : 
                    roomType.code === 'STE' ? 8 : 
                    roomType.code === 'EXE' ? 5 : 10;
        console.log(`  ℹ️ No Room records found, using default: ${totalRooms} rooms`);
      } else {
        console.log(`  ✅ Found ${totalRooms} rooms`);
      }

      const currentDate = new Date(startDate);
      let roomTypeCreated = 0;
      let roomTypeSkipped = 0;

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Check if inventory already exists for this date and room type
        const existing = await RoomAvailability.findOne({
          hotelId: HOTEL_ID,
          roomTypeId: roomType._id,
          date: new Date(currentDate)
        });

        if (existing) {
          roomTypeSkipped++;
        } else {
          // Create inventory record with realistic data
          const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
          const isHoliday = Math.random() < 0.05; // 5% chance of being a holiday
          
          // Calculate availability (some rooms might be sold or blocked)
          const soldRooms = Math.floor(Math.random() * (totalRooms * 0.3)); // Up to 30% sold
          const blockedRooms = Math.floor(Math.random() * (totalRooms * 0.1)); // Up to 10% blocked
          const availableRooms = totalRooms - soldRooms - blockedRooms;

          // Calculate rates (weekend and holiday premiums) in INR
          // Use default rates if basePrice is not set
          const baseRate = roomType.basePrice || (
            roomType.code === 'STD' ? 8000 : 
            roomType.code === 'DLX' ? 12000 : 
            roomType.code === 'STE' ? 20000 : 
            roomType.code === 'EXE' ? 28000 : 10000
          );
          let sellingRate = baseRate;
          
          if (isWeekend) sellingRate *= 1.2; // 20% weekend premium
          if (isHoliday) sellingRate *= 1.5; // 50% holiday premium
          
          sellingRate = Math.round(sellingRate);

          // Create restrictions (occasional stop-sell or minimum stays)
          const stopSellFlag = Math.random() < 0.02; // 2% chance of stop-sell
          const minimumStay = isHoliday ? 3 : isWeekend ? 2 : 1;

          const inventoryRecord = new RoomAvailability({
            hotelId: HOTEL_ID,
            roomTypeId: roomType._id,
            date: new Date(currentDate),
            totalRooms,
            availableRooms: Math.max(0, availableRooms),
            soldRooms,
            blockedRooms,
            baseRate,
            sellingRate,
            currency: roomType.currency || 'USD',
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
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`  ✅ Created: ${roomTypeCreated}, Skipped: ${roomTypeSkipped}`);
      totalCreated += roomTypeCreated;
      totalSkipped += roomTypeSkipped;
    }

    console.log(`\n🎉 Inventory seeding completed!`);
    console.log(`📊 Summary:`);
    console.log(`  - Total records created: ${totalCreated}`);
    console.log(`  - Total records skipped (already exist): ${totalSkipped}`);
    console.log(`  - Hotel ID: ${HOTEL_ID}`);
    console.log(`  - Room types: ${roomTypes.length}`);
    console.log(`  - Date range: 90 days from today`);

    // Verify the data
    console.log(`\n🔍 Verification:`);
    const finalCount = await RoomAvailability.countDocuments({ hotelId: HOTEL_ID });
    console.log(`  - Total inventory records for hotel: ${finalCount}`);

    // Show some sample data
    const samples = await RoomAvailability.find({ hotelId: HOTEL_ID })
      .populate('roomTypeId', 'name code')
      .limit(3)
      .sort({ date: 1 });

    console.log(`\n📋 Sample data:`);
    samples.forEach((inv, index) => {
      console.log(`  ${index + 1}. ${inv.date.toISOString().split('T')[0]} - ${inv.roomTypeId.name}: ${inv.availableRooms}/${inv.totalRooms} available, Rate: ${inv.currency} ${inv.sellingRate}`);
    });

    console.log(`\n✅ Your Inventory Calendar should now show data!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

// Run the seed
console.log('🌱 Starting inventory data seeding...\n');
seedInventoryData();