import mongoose from 'mongoose';
import RoomType from './src/models/RoomType.js';
import Hotel from './src/models/Hotel.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';

async function checkHotelRoomTypes() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Check hotels
    const hotels = await Hotel.find({}).select('name _id');
    console.log('\nHotels in database:');
    hotels.forEach(hotel => {
      console.log(`${hotel.name}: ${hotel._id}`);
    });

    // Check room types by hotel
    const roomTypes = await RoomType.find({}).select('name code totalRooms baseRate hotelId');
    console.log('\nRoom Types by Hotel:');
    
    const groupedByHotel = {};
    roomTypes.forEach(rt => {
      if (!groupedByHotel[rt.hotelId]) {
        groupedByHotel[rt.hotelId] = [];
      }
      groupedByHotel[rt.hotelId].push(rt);
    });

    Object.keys(groupedByHotel).forEach(hotelId => {
      console.log(`\nHotel ID: ${hotelId}`);
      const roomTypesForHotel = groupedByHotel[hotelId];
      let totalRooms = 0;
      roomTypesForHotel.forEach(rt => {
        console.log(`  ${rt.name} (${rt.code}): ${rt.totalRooms} rooms, ₹${rt.baseRate}`);
        totalRooms += rt.totalRooms;
      });
      console.log(`  Total: ${totalRooms} rooms`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkHotelRoomTypes();