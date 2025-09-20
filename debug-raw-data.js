import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const HOTEL_ID = '68b9e0125eaf06d56ef64a78';

async function debugRawData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB successfully\n');

    // Get raw collection data
    const db = mongoose.connection.db;
    
    // Check all room types
    console.log('=== ALL ROOM TYPES (Raw) ===');
    const allRoomTypes = await db.collection('roomtypes').find({}).limit(10).toArray();
    console.log(`Total room types in database: ${await db.collection('roomtypes').countDocuments()}`);
    console.log('Sample room types:');
    allRoomTypes.forEach((rt, i) => {
      console.log(`${i+1}. ID: ${rt._id}, Name: ${rt.name}, HotelId: ${rt.hotelId}`);
    });

    // Check room types for specific hotel
    console.log(`\n=== ROOM TYPES FOR HOTEL ${HOTEL_ID} ===`);
    const hotelRoomTypes = await db.collection('roomtypes').find({ hotelId: new mongoose.Types.ObjectId(HOTEL_ID) }).toArray();
    console.log(`Found ${hotelRoomTypes.length} room types for this hotel`);
    hotelRoomTypes.forEach((rt, i) => {
      console.log(`${i+1}. ID: ${rt._id}, Name: ${rt.name}`);
    });

    // Check all allotments
    console.log('\n=== ALL ALLOTMENTS (Raw Sample) ===');
    const allAllotments = await db.collection('roomtypeallotments').find({}).limit(5).toArray();
    console.log(`Total allotments in database: ${await db.collection('roomtypeallotments').countDocuments()}`);
    console.log('Sample allotments:');
    allAllotments.forEach((allot, i) => {
      console.log(`${i+1}. Raw document:`, JSON.stringify(allot, null, 2));
    });

    // Check allotments for specific hotel
    console.log(`\n=== ALLOTMENTS FOR HOTEL ${HOTEL_ID} ===`);
    const hotelAllotments = await db.collection('roomtypeallotments').find({ hotelId: new mongoose.Types.ObjectId(HOTEL_ID) }).limit(3).toArray();
    console.log(`Found ${await db.collection('roomtypeallotments').countDocuments({ hotelId: new mongoose.Types.ObjectId(HOTEL_ID) })} allotments for this hotel`);
    console.log('Sample allotments for this hotel:');
    hotelAllotments.forEach((allot, i) => {
      console.log(`${i+1}. Raw document:`, JSON.stringify(allot, null, 2));
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

debugRawData();