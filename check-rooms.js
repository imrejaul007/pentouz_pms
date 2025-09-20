import mongoose from 'mongoose';
import Room from './src/models/Room.js';

// MongoDB connection string
const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

// Your hotel ID
const HOTEL_ID = '68c7a56eb7329106fbd8fd30';

async function checkRooms() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check if rooms exist for this hotel
    const rooms = await Room.find({ hotelId: HOTEL_ID });
    console.log(`📊 Found ${rooms.length} rooms for hotel ${HOTEL_ID}`);
    
    if (rooms.length === 0) {
      console.log('❌ No rooms found! Creating sample rooms...');
      
      // Create sample rooms
      const sampleRooms = [];
      for (let floor = 1; floor <= 10; floor++) {
        for (let roomNum = 1; roomNum <= 10; roomNum++) {
          const roomNumber = `${floor}${roomNum.toString().padStart(2, '0')}`;
          const type = ['single', 'double', 'suite', 'deluxe'][Math.floor(Math.random() * 4)];
          let baseRate;
          
          switch (type) {
            case 'single': baseRate = 2500; break;
            case 'double': baseRate = 3500; break;
            case 'suite': baseRate = 8000; break;
            case 'deluxe': baseRate = 6000; break;
            default: baseRate = 3000;
          }
          
          sampleRooms.push({
            hotelId: HOTEL_ID,
            roomNumber,
            type,
            baseRate,
            currentRate: baseRate + Math.floor(Math.random() * 500),
            status: ['vacant', 'occupied', 'dirty', 'maintenance'][Math.floor(Math.random() * 4)],
            floor,
            capacity: type === 'single' ? 1 : type === 'suite' ? 4 : 2,
            amenities: [
              'Air Conditioning',
              'TV',
              'WiFi',
              'Mini Fridge',
              ...(type === 'suite' || type === 'deluxe' ? ['Balcony', 'Coffee Machine'] : []),
              ...(type === 'suite' ? ['Living Area', 'Kitchenette'] : [])
            ],
            images: [
              'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg',
              'https://images.pexels.com/photos/775219/pexels-photo-775219.jpeg'
            ],
            description: `Beautiful ${type} room with modern amenities`,
            isActive: true
          });
        }
      }
      
      await Room.insertMany(sampleRooms);
      console.log(`✅ Created ${sampleRooms.length} sample rooms`);
    } else {
      console.log('✅ Rooms already exist!');
      console.log('Sample rooms:');
      rooms.slice(0, 5).forEach(room => {
        console.log(`  - ${room.roomNumber} (Floor ${room.floor}, ${room.type}, ${room.status})`);
      });
    }
    
    // Show floor distribution
    const floorData = {};
    rooms.forEach(room => {
      if (!floorData[room.floor]) {
        floorData[room.floor] = 0;
      }
      floorData[room.floor]++;
    });
    
    console.log('\n📊 Floor Distribution:');
    Object.entries(floorData).forEach(([floor, count]) => {
      console.log(`  Floor ${floor}: ${count} rooms`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

checkRooms();
