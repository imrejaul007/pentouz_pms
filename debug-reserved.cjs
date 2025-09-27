const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0')
.then(async () => {
  console.log('Connected to MongoDB - Testing reserved room logic...');

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

  // Check if we have any confirmed bookings that would create 'reserved' status
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  console.log('Date range for analysis:');
  console.log('Today:', today.toISOString());
  console.log('Tomorrow:', tomorrow.toISOString());

  // Look for future confirmed bookings
  const futureBookings = await Booking.find({
    hotelId: hotelId,
    status: 'confirmed',
    checkIn: { $gt: today }, // Future check-in (should be reserved)
  }).populate('rooms.roomId', 'roomNumber');

  console.log('\nFuture confirmed bookings (should show as reserved):');
  console.log('Total found:', futureBookings.length);

  if (futureBookings.length > 0) {
    futureBookings.forEach(booking => {
      console.log(`Booking ${booking._id}:`);
      console.log(`  Status: ${booking.status}`);
      console.log(`  Check-in: ${booking.checkIn}`);
      console.log(`  Check-out: ${booking.checkOut}`);
      console.log(`  Rooms: ${booking.rooms.map(r => r.roomId?.roomNumber || 'Unknown').join(', ')}`);
    });
  } else {
    console.log('No future confirmed bookings found.');
  }

  // Also check current confirmed bookings that are starting today
  const todayBookings = await Booking.find({
    hotelId: hotelId,
    status: 'confirmed',
    checkIn: { $gte: today, $lt: tomorrow }, // Starting today
  }).populate('rooms.roomId', 'roomNumber');

  console.log('\nToday confirmed bookings (should show as occupied):');
  console.log('Total found:', todayBookings.length);

  if (todayBookings.length > 0) {
    todayBookings.forEach(booking => {
      console.log(`Booking ${booking._id}:`);
      console.log(`  Status: ${booking.status}`);
      console.log(`  Check-in: ${booking.checkIn}`);
      console.log(`  Rooms: ${booking.rooms.map(r => r.roomId?.roomNumber || 'Unknown').join(', ')}`);
    });
  }

  // Check checked_in bookings
  const checkedInBookings = await Booking.find({
    hotelId: hotelId,
    status: 'checked_in',
  }).populate('rooms.roomId', 'roomNumber');

  console.log('\nChecked-in bookings:');
  console.log('Total found:', checkedInBookings.length);

  if (checkedInBookings.length > 0) {
    checkedInBookings.slice(0, 3).forEach(booking => {
      console.log(`Booking ${booking._id}:`);
      console.log(`  Status: ${booking.status}`);
      console.log(`  Check-in: ${booking.checkIn}`);
      console.log(`  Check-out: ${booking.checkOut}`);
      console.log(`  Rooms: ${booking.rooms.map(r => r.roomId?.roomNumber || 'Unknown').join(', ')}`);
    });
  }

  mongoose.disconnect();
})
.catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});