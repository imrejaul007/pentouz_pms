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

async function fixRoomTypes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log(`\n🏨 Fixing room types for hotel: ${HOTEL_ID}`);
    
    // Get all room types for this hotel
    const roomTypes = await RoomType.find({ hotelId: HOTEL_ID });
    console.log(`📊 Found ${roomTypes.length} room types to fix`);

    let fixed = 0;
    for (const roomType of roomTypes) {
      console.log(`\n🔧 Fixing: ${roomType.name} (${roomType.code})`);
      
      // Determine proper values based on room code
      let basePrice, maxOccupancy, currency = 'INR';
      
      switch(roomType.code) {
        case 'STD':
          basePrice = 8000;  // ₹8,000 for Standard Room
          maxOccupancy = 2;
          break;
        case 'DLX':
          basePrice = 12000; // ₹12,000 for Deluxe Room
          maxOccupancy = 3;
          break;
        case 'STE':
          basePrice = 20000; // ₹20,000 for Premium Suite
          maxOccupancy = 4;
          break;
        case 'EXE':
          basePrice = 28000; // ₹28,000 for Executive Suite
          maxOccupancy = 4;
          break;
        default:
          basePrice = 10000;
          maxOccupancy = 2;
      }

      // Generate roomTypeId if missing
      const roomTypeId = roomType.roomTypeId || `RT_${roomType.code}_${Date.now()}`;

      // Update the room type
      await RoomType.findByIdAndUpdate(roomType._id, {
        roomTypeId,
        basePrice,
        maxOccupancy,
        currency,
        description: roomType.description || `Comfortable ${roomType.name.toLowerCase()} with modern amenities`,
        amenities: roomType.amenities || ['WiFi', 'Air Conditioning', 'Television', 'Room Service'],
        settings: {
          allowOverbooking: false,
          overbookingLimit: 0,
          requiresApproval: false
        }
      });

      console.log(`  ✅ Updated: ID=${roomTypeId}, Price=₹${basePrice}, Occupancy=${maxOccupancy}`);
      fixed++;
    }

    console.log(`\n🎉 Successfully fixed ${fixed} room types!`);

    // Verify the updates
    console.log('\n🔍 Verifying updates...');
    const updatedRoomTypes = await RoomType.find({ hotelId: HOTEL_ID });
    
    updatedRoomTypes.forEach((rt, index) => {
      console.log(`\n  ${index + 1}. ${rt.name} (${rt.code})`);
      console.log(`     - Room Type ID: ${rt.roomTypeId}`);
      console.log(`     - Base Price: ${rt.currency} ${rt.basePrice}`);
      console.log(`     - Max Occupancy: ${rt.maxOccupancy}`);
      console.log(`     - Active: ${rt.isActive}`);
    });

    // Test API endpoint format
    console.log('\n📡 Testing API Options format...');
    const options = await RoomType.find(
      { hotelId: HOTEL_ID, isActive: true },
      'roomTypeId name code basePrice maxOccupancy legacyType'
    ).lean();
    
    console.log('API Response would be:');
    console.log(JSON.stringify(options.map(opt => ({
      id: opt._id,
      roomTypeId: opt.roomTypeId,
      name: opt.name,
      code: opt.code,
      basePrice: opt.basePrice,
      maxOccupancy: opt.maxOccupancy,
      legacyType: opt.legacyType
    })), null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

fixRoomTypes();