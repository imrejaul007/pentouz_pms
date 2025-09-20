import mongoose from 'mongoose';
import RoomType from './src/models/RoomType.js';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function checkRoomTypes() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB Atlas');
    
    const allRoomTypes = await RoomType.find({}).sort({ hotelId: 1, code: 1 });
    console.log(`\nFound ${allRoomTypes.length} room types total:\n`);
    
    const hotelGroups = {};
    allRoomTypes.forEach(rt => {
      if (!hotelGroups[rt.hotelId]) {
        hotelGroups[rt.hotelId] = [];
      }
      hotelGroups[rt.hotelId].push(rt);
    });
    
    Object.keys(hotelGroups).forEach(hotelId => {
      console.log(`Hotel ID: ${hotelId}`);
      console.log(`Room types: ${hotelGroups[hotelId].length}`);
      
      let totalRooms = 0;
      hotelGroups[hotelId].forEach((rt, i) => {
        console.log(`  ${i+1}. ID: ${rt._id}`);
        console.log(`     Name: ${rt.name} (${rt.code})`);
        console.log(`     Rooms: ${rt.totalRooms}, Rate: ₹${rt.baseRate}`);
        console.log(`     Active: ${rt.isActive}, Published: ${rt.isPublished}`);
        console.log('     ---');
        totalRooms += rt.totalRooms;
      });
      console.log(`  Total rooms for this hotel: ${totalRooms}\n`);
    });
    
    // Check for your specific hotel
    const targetHotel = '68bc094f80c86bfe258e172b';
    const targetRoomTypes = allRoomTypes.filter(rt => rt.hotelId.toString() === targetHotel);
    
    if (targetRoomTypes.length > 0) {
      console.log(`\n🎯 Target Hotel (${targetHotel}) has ${targetRoomTypes.length} room types:`);
      targetRoomTypes.forEach((rt, i) => {
        console.log(`${i+1}. ${rt.name} (${rt.code}): ${rt.totalRooms} rooms, ₹${rt.baseRate}`);
      });
    } else {
      console.log(`\n❌ No room types found for target hotel: ${targetHotel}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRoomTypes();