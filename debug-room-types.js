import mongoose from 'mongoose';
import RoomType from './src/models/RoomType.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';
const HOTEL_ID = '68b9e0125eaf06d56ef64a78';

async function debugRoomTypes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Check all room types in the database
    const allRoomTypes = await RoomType.find({}).select('_id hotelId name code baseRate totalRooms');
    console.log('\nAll room types in database:');
    allRoomTypes.forEach((rt, index) => {
      console.log(`${index + 1}. ID: ${rt._id}`);
      console.log(`   Hotel ID: ${rt.hotelId} (type: ${typeof rt.hotelId})`);
      console.log(`   Name: ${rt.name}`);
      console.log(`   Code: ${rt.code}`);
      console.log(`   Base Rate: ${rt.baseRate}`);
      console.log(`   Total Rooms: ${rt.totalRooms}`);
      console.log('---');
    });

    // Check room types for our specific hotel ID as string
    console.log(`\nSearching for room types with hotelId as string: "${HOTEL_ID}"`);
    const roomTypesAsString = await RoomType.find({ hotelId: HOTEL_ID });
    console.log(`Found ${roomTypesAsString.length} room types with string query`);

    // Check room types for our specific hotel ID as ObjectId
    console.log(`\nSearching for room types with hotelId as ObjectId: "${HOTEL_ID}"`);
    try {
      const roomTypesAsObjectId = await RoomType.find({ hotelId: new mongoose.Types.ObjectId(HOTEL_ID) });
      console.log(`Found ${roomTypesAsObjectId.length} room types with ObjectId query`);
    } catch (objIdError) {
      console.log('ObjectId conversion failed:', objIdError.message);
    }

    process.exit(0);
  } catch (error) {
    console.error('Debug failed:', error);
    process.exit(1);
  }
}

debugRoomTypes();