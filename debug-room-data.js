import mongoose from 'mongoose';
import RoomType from './src/models/RoomType.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';
const HOTEL_ID = '68bc094f80c86bfe258e172b';

async function debugRoomData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // First check all room types to see what hotel IDs exist
    console.log('\nChecking all room types in database:');
    const allRoomTypes = await RoomType.find({}).select('hotelId name code baseRate totalRooms');
    console.log(`Found ${allRoomTypes.length} total room types:`);
    
    allRoomTypes.forEach((rt, index) => {
      console.log(`${index + 1}. ${rt.name} (${rt.code}) - Hotel: ${rt.hotelId}`);
      console.log(`   Base Rate: ${rt.baseRate}, Total Rooms: ${rt.totalRooms}`);
    });

    // Check room types data for our specific hotel
    console.log(`\n\nSearching for room types with hotelId: "${HOTEL_ID}"`);
    const roomTypes = await RoomType.find({ hotelId: HOTEL_ID });
    
    console.log(`\nFound ${roomTypes.length} room types for this hotel:`);
    roomTypes.forEach((rt, index) => {
      console.log(`\n${index + 1}. ${rt.name} (${rt.code})`);
      console.log(`   ID: ${rt._id}`);
      console.log(`   Hotel ID: ${rt.hotelId}`);
      console.log(`   Base Rate: ${rt.baseRate} (type: ${typeof rt.baseRate})`);
      console.log(`   Total Rooms: ${rt.totalRooms} (type: ${typeof rt.totalRooms})`);
      console.log(`   Max Occupancy: ${rt.specifications?.maxOccupancy}`);
      console.log(`   Is Active: ${rt.isActive}`);
      console.log('---');
    });

    process.exit(0);
  } catch (error) {
    console.error('Debug failed:', error);
    process.exit(1);
  }
}

debugRoomData();