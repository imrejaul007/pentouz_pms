const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0')
.then(async () => {
  console.log('Connected to MongoDB - Debugging reserved status in room database...');

  const Hotel = mongoose.model('Hotel', { name: String });
  const hotel = await Hotel.findOne();
  const hotelId = hotel._id;

  const Room = mongoose.model('Room', {
    roomNumber: String,
    status: String,
    floor: Number,
    type: String,
    hotelId: mongoose.Schema.Types.ObjectId,
    isActive: Boolean
  });

  // Find rooms with status: 'reserved'
  console.log('\n=== ROOMS WITH RESERVED STATUS ===');
  const reservedRooms = await Room.find({
    hotelId: hotelId,
    status: 'reserved'
  });

  console.log(`Found ${reservedRooms.length} rooms with status 'reserved':`);

  if (reservedRooms.length > 0) {
    reservedRooms.forEach(room => {
      console.log(`  Room ${room.roomNumber}: status=${room.status}, floor=${room.floor}, type=${room.type}`);
    });
  } else {
    console.log('No rooms found with reserved status in database');
  }

  // Let's check all room statuses
  console.log('\n=== ALL ROOM STATUS DISTRIBUTION ===');
  const statusDistribution = await Room.aggregate([
    { $match: { hotelId: hotelId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  statusDistribution.forEach(status => {
    console.log(`  ${status._id}: ${status.count} rooms`);
  });

  mongoose.disconnect();
})
.catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});