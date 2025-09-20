import mongoose from 'mongoose';
import RoomType from './src/models/RoomType.js';
import Room from './src/models/Room.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';
const HOTEL_ID = '68bc094f80c86bfe258e172b';

async function forceCleanRoomTypes() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Check for rooms that might be blocking deletion
    const rooms = await Room.find({ hotelId: HOTEL_ID });
    console.log(`Found ${rooms.length} room documents for this hotel`);
    
    if (rooms.length > 0) {
      console.log('Room documents found - these might be blocking soft deletion');
      rooms.forEach(room => {
        console.log(`Room ${room.roomNumber}: roomTypeId=${room.roomTypeId}, type=${room.type}`);
      });
    }

    // List all room types (including inactive ones)
    const allRoomTypes = await RoomType.find({ hotelId: HOTEL_ID });
    console.log(`\nFound ${allRoomTypes.length} room types:`);
    
    allRoomTypes.forEach((rt, index) => {
      console.log(`${index + 1}. ${rt.name} (${rt.code}) - Active: ${rt.isActive}`);
    });

    // If there are more than 4 room types, offer to clean them up
    if (allRoomTypes.length > 4) {
      console.log('\n⚠️  Found more than 4 room types. Cleaning up...');
      
      // Keep only the 4 main room types we want
      const wantedCodes = ['STD', 'DLX', 'EXE', 'STE'];
      const roomTypesToDelete = allRoomTypes.filter(rt => !wantedCodes.includes(rt.code));
      
      console.log(`Deleting ${roomTypesToDelete.length} unwanted room types:`);
      for (const rt of roomTypesToDelete) {
        console.log(`- Deleting: ${rt.name} (${rt.code})`);
        await RoomType.findByIdAndDelete(rt._id);
      }
      
      console.log('✅ Cleanup completed!');
    } else {
      console.log('✅ Room types are already clean (4 or fewer found)');
    }

    // Show final state
    const finalRoomTypes = await RoomType.find({ hotelId: HOTEL_ID });
    console.log(`\nFinal result: ${finalRoomTypes.length} room types`);
    
    let totalRooms = 0;
    finalRoomTypes.forEach(rt => {
      console.log(`${rt.name} (${rt.code}): ${rt.totalRooms} rooms, ₹${rt.baseRate}, Active: ${rt.isActive}`);
      totalRooms += rt.totalRooms;
    });
    
    console.log(`\nTotal rooms: ${totalRooms}`);
    console.log('\n💡 Try refreshing your browser with Ctrl+F5 to clear cache');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

forceCleanRoomTypes();