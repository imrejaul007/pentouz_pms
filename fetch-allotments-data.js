import mongoose from 'mongoose';

// MongoDB connection string
const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Hotel ID to filter data
const HOTEL_ID = '68bc094f80c86bfe258e172b';

// Define schemas
const roomTypeSchema = new mongoose.Schema({
  name: String,
  basePrice: Number,
  maxOccupancy: Number,
  amenities: [String],
  description: String,
  images: [String],
  roomCount: Number,
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' }
}, { collection: 'roomtypes' });

const roomTypeAllotmentSchema = new mongoose.Schema({
  roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
  date: { type: Date, required: true },
  totalRooms: { type: Number, required: true },
  availableRooms: { type: Number, required: true },
  bookedRooms: { type: Number, default: 0 },
  blockedRooms: { type: Number, default: 0 },
  rate: { type: Number, required: true },
  minimumStay: { type: Number, default: 1 },
  maximumStay: { type: Number },
  stopSell: { type: Boolean, default: false },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' }
}, { collection: 'roomtypeallotments' });

// Create models
const RoomType = mongoose.model('RoomType', roomTypeSchema);
const RoomTypeAllotment = mongoose.model('RoomTypeAllotment', roomTypeAllotmentSchema);

async function fetchData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB successfully');

    // Fetch room types for the specified hotel
    console.log('\n=== FETCHING ROOM TYPES ===');
    const roomTypes = await RoomType.find({ hotelId: HOTEL_ID }).lean();
    console.log(`Found ${roomTypes.length} room types for hotel ${HOTEL_ID}:\n`);
    
    roomTypes.forEach((roomType, index) => {
      console.log(`Room Type ${index + 1}:`);
      console.log(`  ID: ${roomType._id}`);
      console.log(`  Name: ${roomType.name}`);
      console.log(`  Base Price: ${roomType.basePrice}`);
      console.log(`  Max Occupancy: ${roomType.maxOccupancy}`);
      console.log(`  Room Count: ${roomType.roomCount}`);
      console.log(`  Hotel ID: ${roomType.hotelId}`);
      console.log('---');
    });

    // Fetch room type allotments for the specified hotel
    console.log('\n=== FETCHING ROOM TYPE ALLOTMENTS ===');
    const allotments = await RoomTypeAllotment.find({ hotelId: HOTEL_ID })
      .populate('roomTypeId', 'name basePrice')
      .lean();
    
    console.log(`Found ${allotments.length} allotments:\n`);
    
    // Group allotments by room type for better readability
    const allotmentsByRoomType = {};
    
    allotments.forEach(allotment => {
      const roomTypeName = allotment.roomTypeId ? allotment.roomTypeId.name : 'Unknown';
      const roomTypeId = allotment.roomTypeId ? allotment.roomTypeId._id : allotment.roomTypeId;
      
      if (!allotmentsByRoomType[roomTypeName]) {
        allotmentsByRoomType[roomTypeName] = [];
      }
      
      allotmentsByRoomType[roomTypeName].push({
        date: allotment.date,
        totalRooms: allotment.totalRooms,
        availableRooms: allotment.availableRooms,
        bookedRooms: allotment.bookedRooms,
        blockedRooms: allotment.blockedRooms,
        rate: allotment.rate,
        stopSell: allotment.stopSell,
        roomTypeId: roomTypeId
      });
    });
    
    // Display allotments grouped by room type
    Object.keys(allotmentsByRoomType).forEach(roomTypeName => {
      console.log(`\nAllotments for Room Type: ${roomTypeName}`);
      console.log('=' .repeat(50));
      
      allotmentsByRoomType[roomTypeName]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach(allotment => {
          console.log(`  Date: ${new Date(allotment.date).toLocaleDateString()}`);
          console.log(`    Room Type ID: ${allotment.roomTypeId}`);
          console.log(`    Total Rooms: ${allotment.totalRooms}`);
          console.log(`    Available: ${allotment.availableRooms}`);
          console.log(`    Booked: ${allotment.bookedRooms}`);
          console.log(`    Blocked: ${allotment.blockedRooms}`);
          console.log(`    Rate: $${allotment.rate}`);
          console.log(`    Stop Sell: ${allotment.stopSell}`);
          console.log('  ---');
        });
    });

    // Summary statistics
    console.log('\n=== SUMMARY ===');
    console.log(`Total Room Types: ${roomTypes.length}`);
    console.log(`Total Allotments: ${allotments.length}`);
    
    if (allotments.length > 0) {
      const uniqueDates = [...new Set(allotments.map(a => new Date(a.date).toDateString()))];
      console.log(`Unique Dates: ${uniqueDates.length}`);
      console.log(`Date Range: ${uniqueDates.sort()[0]} to ${uniqueDates.sort()[uniqueDates.length - 1]}`);
    }

  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
fetchData();