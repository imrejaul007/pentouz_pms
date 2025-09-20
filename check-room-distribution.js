import mongoose from 'mongoose';
import Room from './src/models/Room.js';
import RoomType from './src/models/RoomType.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';

async function checkRoomDistribution() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Get current room types and their data
    const roomTypes = await RoomType.find({}).select('name code totalRooms baseRate');
    console.log('\nCurrent Room Types:');
    roomTypes.forEach(rt => {
      console.log(`${rt.name} (${rt.code}): ${rt.totalRooms} rooms, ₹${rt.baseRate}`);
    });

    // Check actual room documents if they exist
    const totalRooms = await Room.countDocuments({});
    console.log(`\nTotal Room documents in database: ${totalRooms}`);

    if (totalRooms > 0) {
      // Get room distribution by type
      const roomsByType = await Room.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      console.log('\nRoom distribution by type:');
      roomsByType.forEach(group => {
        console.log(`${group._id}: ${group.count} rooms`);
      });
    }

    console.log('\nCurrent room type totals sum:', roomTypes.reduce((sum, rt) => sum + (rt.totalRooms || 0), 0));
    console.log('Target: 100 rooms total');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRoomDistribution();