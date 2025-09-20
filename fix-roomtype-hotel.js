import mongoose from 'mongoose';
import RoomType from './src/models/RoomType.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';
const OLD_HOTEL_ID = '68b9e0125eaf06d56ef64a78';
const NEW_HOTEL_ID = '68bc094f80c86bfe258e172b';

async function fixRoomTypeHotel() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Update existing room types to use the correct hotel ID
    console.log(`Updating room types from hotel ${OLD_HOTEL_ID} to ${NEW_HOTEL_ID}`);
    
    const result = await RoomType.updateMany(
      { hotelId: OLD_HOTEL_ID },
      { $set: { hotelId: NEW_HOTEL_ID } }
    );
    
    console.log(`Updated ${result.modifiedCount} room types`);

    // Verify the update
    const roomTypes = await RoomType.find({ hotelId: NEW_HOTEL_ID });
    console.log('\nRoom types now under correct hotel:');
    let totalRooms = 0;
    let totalValue = 0;
    
    roomTypes.forEach(rt => {
      console.log(`${rt.name} (${rt.code}): ${rt.totalRooms} rooms, ₹${rt.baseRate}`);
      totalRooms += rt.totalRooms;
      totalValue += rt.baseRate;
    });
    
    const avgRate = Math.round(totalValue / roomTypes.length);
    console.log(`\nSummary:`);
    console.log(`Total Room Types: ${roomTypes.length}`);
    console.log(`Total Rooms: ${totalRooms}`);
    console.log(`Average Base Rate: ₹${avgRate}`);
    console.log(`Active Types: ${roomTypes.filter(rt => rt.isActive).length}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixRoomTypeHotel();