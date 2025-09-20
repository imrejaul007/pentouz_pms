import mongoose from 'mongoose';
import RoomType from './src/models/RoomType.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';
const HOTEL_ID = '68bc094f80c86bfe258e172b';

async function listAndDeleteRoomTypes() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // List all room types for this hotel
    const allRoomTypes = await RoomType.find({ hotelId: HOTEL_ID });
    console.log(`\nFound ${allRoomTypes.length} room types:`);
    
    allRoomTypes.forEach((rt, index) => {
      console.log(`${index + 1}. ID: ${rt._id}`);
      console.log(`   Name: ${rt.name} (${rt.code})`);
      console.log(`   Rooms: ${rt.totalRooms}, Rate: ₹${rt.baseRate}`);
      console.log(`   Active: ${rt.isActive}`);
      console.log('---');
    });

    // Keep only the 4 main room types we want
    const wantedRoomTypes = ['STD', 'DLX', 'EXE', 'STE'];
    
    // Find room types to delete (not in our wanted list)
    const roomTypesToDelete = allRoomTypes.filter(rt => !wantedRoomTypes.includes(rt.code));
    
    if (roomTypesToDelete.length > 0) {
      console.log(`\nDeleting ${roomTypesToDelete.length} unwanted room types:`);
      
      for (const rt of roomTypesToDelete) {
        console.log(`Deleting: ${rt.name} (${rt.code})`);
        await RoomType.findByIdAndDelete(rt._id);
      }
      
      console.log('\nDeletion completed!');
    } else {
      console.log('\nNo unwanted room types found.');
    }

    // Show final result
    const finalRoomTypes = await RoomType.find({ hotelId: HOTEL_ID });
    console.log(`\nFinal result - ${finalRoomTypes.length} room types remaining:`);
    
    let totalRooms = 0;
    let totalValue = 0;
    
    finalRoomTypes.forEach(rt => {
      console.log(`${rt.name} (${rt.code}): ${rt.totalRooms} rooms, ₹${rt.baseRate}`);
      totalRooms += rt.totalRooms;
      totalValue += rt.baseRate;
    });
    
    if (finalRoomTypes.length > 0) {
      const avgRate = Math.round(totalValue / finalRoomTypes.length);
      console.log(`\nSummary:`);
      console.log(`Total Room Types: ${finalRoomTypes.length}`);
      console.log(`Total Rooms: ${totalRooms}`);
      console.log(`Average Base Rate: ₹${avgRate}`);
      console.log(`Active Types: ${finalRoomTypes.filter(rt => rt.isActive).length}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listAndDeleteRoomTypes();