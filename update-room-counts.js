import mongoose from 'mongoose';
import RoomType from './src/models/RoomType.js';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const HOTEL_ID = '68bc094f80c86bfe258e172b';

async function updateRoomCounts() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB Atlas');

    // Updated room counts to total 100 rooms
    const roomTypeUpdates = [
      { code: 'STD', name: 'Standard Room', totalRooms: 40, baseRate: 2500 },
      { code: 'DLX', name: 'Deluxe Room', totalRooms: 30, baseRate: 3500 },
      { code: 'EXE', name: 'Executive Deluxe', totalRooms: 20, baseRate: 6000 },
      { code: 'STE', name: 'Premium Suite', totalRooms: 10, baseRate: 8000 }
    ];

    console.log('\nUpdating room counts:');
    
    for (const update of roomTypeUpdates) {
      const result = await RoomType.findOneAndUpdate(
        { hotelId: HOTEL_ID, code: update.code },
        { 
          totalRooms: update.totalRooms,
          baseRate: update.baseRate,
          name: update.name
        },
        { new: true }
      );
      
      if (result) {
        console.log(`✅ Updated ${result.name} (${result.code}): ${result.totalRooms} rooms, ₹${result.baseRate}`);
      } else {
        console.log(`❌ Could not find room type with code: ${update.code}`);
      }
    }

    // Verify final state
    const finalRoomTypes = await RoomType.find({ hotelId: HOTEL_ID }).sort({ code: 1 });
    console.log(`\n📊 Final State - ${finalRoomTypes.length} room types:`);
    
    let totalRooms = 0;
    let totalRevenue = 0;
    
    finalRoomTypes.forEach(rt => {
      console.log(`${rt.name} (${rt.code}): ${rt.totalRooms} rooms, ₹${rt.baseRate}`);
      totalRooms += rt.totalRooms;
      totalRevenue += rt.baseRate * rt.totalRooms;
    });
    
    const avgRate = Math.round(finalRoomTypes.reduce((sum, rt) => sum + rt.baseRate, 0) / finalRoomTypes.length);
    const avgRevenuePerRoom = Math.round(totalRevenue / totalRooms);
    
    console.log(`\n🎯 Summary:`);
    console.log(`Total Room Types: ${finalRoomTypes.length}`);
    console.log(`Total Rooms: ${totalRooms}`);
    console.log(`Average Base Rate: ₹${avgRate}`);
    console.log(`Average Revenue per Room: ₹${avgRevenuePerRoom}`);
    console.log(`Total Potential Daily Revenue: ₹${totalRevenue}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateRoomCounts();