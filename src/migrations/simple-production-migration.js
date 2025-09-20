import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
config({ path: envPath });

console.log('🚀 SIMPLE PRODUCTION MIGRATION');
console.log('==============================');
console.log('⚠️  Migrating production data step by step');
console.log('⚠️  No transactions - safer execution');
console.log('==============================\n');

const ROOM_TYPE_CONFIG = {
  'single': { name: 'Single Room', code: 'SGL', maxOccupancy: 1 },
  'double': { name: 'Double Room', code: 'DBL', maxOccupancy: 2 },
  'suite': { name: 'Suite', code: 'STE', maxOccupancy: 4 },
  'deluxe': { name: 'Deluxe Room', code: 'DLX', maxOccupancy: 3 }
};

async function runSimpleMigration() {
  try {
    // Connect
    const mongoURI = process.env.MONGO_URI;
    await mongoose.connect(mongoURI);
    console.log('📡 Connected to production database');
    
    // Import models
    const { default: Room } = await import('../models/Room.js');
    const { default: RoomType } = await import('../models/RoomType.js');
    const { default: RoomAvailability } = await import('../models/RoomAvailability.js');
    
    console.log('✅ Models loaded');
    
    // Step 1: Create Room Types
    console.log('\n🏗️  STEP 1: Creating Room Types...');
    
    const roomAnalysis = await Room.aggregate([
      {
        $group: {
          _id: { hotelId: '$hotelId', type: '$type' },
          count: { $sum: 1 },
          avgRate: { $avg: '$baseRate' },
          maxCapacity: { $max: '$capacity' }
        }
      }
    ]);
    
    console.log(`Found ${roomAnalysis.length} combinations to create`);
    
    const createdTypes = [];
    for (const data of roomAnalysis) {
      const { hotelId, type } = data._id;
      const config = ROOM_TYPE_CONFIG[type];
      
      if (!config) {
        console.log(`⚠️  Skipping unknown type: ${type}`);
        continue;
      }
      
      // Check if exists
      const exists = await RoomType.findOne({ hotelId, legacyType: type });
      if (exists) {
        console.log(`✅ Already exists: ${config.name}`);
        createdTypes.push(exists);
        continue;
      }
      
      // Create new
      const roomType = new RoomType({
        hotelId,
        name: config.name,
        code: config.code,
        maxOccupancy: data.maxCapacity || config.maxOccupancy,
        basePrice: Math.round(data.avgRate || 3000),
        legacyType: type,
        isActive: true
      });
      
      await roomType.save();
      createdTypes.push(roomType);
      console.log(`✅ Created: ${roomType.name} (${roomType.roomTypeId})`);
    }
    
    console.log(`🎉 Total room types ready: ${createdTypes.length}`);
    
    // Step 2: Create limited availability (just 30 days to start)
    console.log('\n📅 STEP 2: Creating 30 days of availability...');
    
    let totalCreated = 0;
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30); // Just 30 days for now
    
    for (const roomType of createdTypes) {
      // Get room count
      const roomCount = await Room.countDocuments({
        hotelId: roomType.hotelId,
        type: roomType.legacyType,
        isActive: true
      });
      
      console.log(`📊 Creating availability for ${roomType.name} (${roomCount} rooms)`);
      
      // Create daily records
      const records = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const date = new Date(d);
        
        // Check if record exists
        const exists = await RoomAvailability.findOne({
          hotelId: roomType.hotelId,
          roomTypeId: roomType._id,
          date
        });
        
        if (exists) continue;
        
        records.push({
          hotelId: roomType.hotelId,
          roomTypeId: roomType._id,
          date: new Date(date),
          totalRooms: roomCount,
          availableRooms: roomCount,
          soldRooms: 0,
          blockedRooms: 0,
          overbookedRooms: 0,
          baseRate: roomType.basePrice,
          sellingRate: roomType.basePrice,
          currency: 'INR',
          needsSync: true
        });
      }
      
      // Insert records
      if (records.length > 0) {
        await RoomAvailability.insertMany(records);
        totalCreated += records.length;
        console.log(`✅ Created ${records.length} records for ${roomType.name}`);
      }
    }
    
    console.log(`🎉 Total availability records created: ${totalCreated}`);
    
    // Step 3: Verify
    console.log('\n🔍 STEP 3: Final verification...');
    const roomTypeCount = await RoomType.countDocuments({ legacyType: { $exists: true } });
    const availabilityCount = await RoomAvailability.countDocuments();
    const originalRoomCount = await Room.countDocuments();
    
    console.log(`✅ Room Types: ${roomTypeCount}`);
    console.log(`✅ Availability Records: ${availabilityCount}`);
    console.log(`✅ Original Rooms: ${originalRoomCount}`);
    
    await mongoose.disconnect();
    console.log('📡 Disconnected');
    
    if (roomTypeCount > 0 && availabilityCount > 0) {
      console.log('\n🎉 MIGRATION SUCCESSFUL!');
      console.log('========================');
      console.log('✅ Your hotel system is now channel-ready!');
      console.log('✅ Room types with unique IDs created');
      console.log('✅ Date-level inventory tracking active');
      console.log('✅ Ready for OTA integrations');
      
      console.log('\n🌟 What you can do now:');
      console.log('1. Set up Booking.com integration');
      console.log('2. Configure Expedia channel');
      console.log('3. Add Airbnb connection');
      console.log('4. Real-time rate/inventory sync');
      
      return true;
    } else {
      console.log('\n❌ Migration incomplete');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    return false;
  }
}

runSimpleMigration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(() => {
    process.exit(1);
  });
