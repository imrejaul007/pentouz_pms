import mongoose from 'mongoose';
import RoomType from './src/models/RoomType.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';
const OLD_HOTEL_ID = '68b9e0125eaf06d56ef64a78';
const NEW_HOTEL_ID = '68bc094f80c86bfe258e172b';

async function updateRoomTypeHotel() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // First check if room types exist for the new hotel ID
    const existingRoomTypes = await RoomType.find({ hotelId: NEW_HOTEL_ID });
    if (existingRoomTypes.length > 0) {
      console.log(`Room types already exist for hotel ${NEW_HOTEL_ID}. Skipping...`);
      process.exit(0);
    }

    // Get room types from old hotel
    const roomTypesToCopy = await RoomType.find({ hotelId: OLD_HOTEL_ID });
    console.log(`Found ${roomTypesToCopy.length} room types to copy`);

    // Create new room types for the correct hotel
    const newRoomTypes = roomTypesToCopy.map(rt => {
      const rtObj = rt.toObject();
      delete rtObj._id; // Remove _id so new ones are created
      delete rtObj.__v;
      delete rtObj.createdAt;
      delete rtObj.updatedAt;
      
      return {
        ...rtObj,
        hotelId: NEW_HOTEL_ID
      };
    });

    const createdRoomTypes = await RoomType.create(newRoomTypes);
    console.log(`Created ${createdRoomTypes.length} room types for hotel ${NEW_HOTEL_ID}`);

    // Display the created room types
    console.log('\nCreated room types:');
    createdRoomTypes.forEach(rt => {
      console.log(`${rt.name} (${rt.code}): ${rt.totalRooms} rooms, ₹${rt.baseRate}`);
    });

    const totalRooms = createdRoomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0);
    console.log(`\nTotal rooms: ${totalRooms}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateRoomTypeHotel();