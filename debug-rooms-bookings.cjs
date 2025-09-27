const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0')
.then(async () => {
  console.log('Connected to MongoDB - Debugging room-booking relationships...');

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

  const Booking = mongoose.model('Booking', {
    hotelId: mongoose.Schema.Types.ObjectId,
    status: String,
    checkIn: Date,
    checkOut: Date,
    rooms: [{ roomId: mongoose.Schema.Types.ObjectId }]
  });

  // First, let's see all bookings with status confirmed or checked_in
  console.log('\n=== ALL ACTIVE BOOKINGS ===');
  const allBookings = await Booking.find({
    hotelId: hotelId,
    status: { $in: ['confirmed', 'checked_in'] }
  });

  console.log(`Total active bookings: ${allBookings.length}`);

  for (let booking of allBookings) {
    console.log(`\nBooking ${booking._id}:`);
    console.log(`  Status: ${booking.status}`);
    console.log(`  Check-in: ${booking.checkIn}`);
    console.log(`  Check-out: ${booking.checkOut}`);
    console.log(`  Room IDs in booking:`, booking.rooms.map(r => r.roomId));

    // Now manually fetch room details for each room ID
    for (let roomRef of booking.rooms) {
      const room = await Room.findById(roomRef.roomId);
      if (room) {
        console.log(`    Room ${room.roomNumber}: status=${room.status}, floor=${room.floor}, type=${room.type}`);
      } else {
        console.log(`    Room ID ${roomRef.roomId}: NOT FOUND IN ROOMS COLLECTION`);
      }
    }
  }

  // Now let's check today's date logic
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  console.log('\n=== DATE ANALYSIS ===');
  console.log('Today:', today.toISOString());
  console.log('Tomorrow:', tomorrow.toISOString());

  // Check what should be reserved vs occupied
  console.log('\n=== ROOM STATUS CLASSIFICATION ===');

  for (let booking of allBookings) {
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);

    let expectedStatus = 'unknown';
    if (booking.status === 'checked_in') {
      expectedStatus = 'occupied';
    } else if (booking.status === 'confirmed') {
      if (checkIn <= today) {
        expectedStatus = 'occupied'; // Should be checked in today
      } else {
        expectedStatus = 'reserved'; // Future reservation
      }
    }

    console.log(`\nBooking ${booking._id}:`);
    console.log(`  Status: ${booking.status} -> Expected Room Status: ${expectedStatus}`);
    console.log(`  Check-in: ${checkIn.toISOString()} (${checkIn <= today ? 'today or past' : 'future'})`);
    console.log(`  Check-out: ${checkOut.toISOString()}`);
    console.log(`  Rooms: ${booking.rooms.length} room(s)`);
  }

  mongoose.disconnect();
})
.catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});