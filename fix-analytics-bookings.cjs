const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const BookingSchema = new mongoose.Schema({}, { strict: false });
const RoomSchema = new mongoose.Schema({}, { strict: false });

const Booking = mongoose.model('Booking', BookingSchema);
const Room = mongoose.model('Room', RoomSchema);

async function createAnalyticsBookings() {
  try {
    // Clear existing bookings
    await Booking.deleteMany({});
    console.log('Cleared existing bookings');

    // Get hotel and rooms
    const hotelId = '68c65dc8cbb8060e028e96dc';
    const rooms = await Room.find({ hotelId, isActive: true }).limit(50);
    console.log(`Found ${rooms.length} rooms`);

    if (rooms.length === 0) {
      console.log('No rooms found, creating with default room data');
    }

    const bookings = [];
    for (let i = 0; i < 15; i++) {
      // Create bookings with checkIn dates in the last 30 days (within analytics range)
      const daysAgo = Math.floor(Math.random() * 25) + 1; // 1-25 days ago
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() - daysAgo);

      const nights = Math.floor(Math.random() * 4) + 1; // 1-4 nights
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + nights);

      const rate = 2000 + Math.random() * 3000; // ₹2000-5000 per night
      const totalAmount = rate * nights;

      const roomData = rooms.length > 0 ? rooms[i % rooms.length] : { _id: new mongoose.Types.ObjectId(), roomNumber: `${100 + i}` };

      bookings.push({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        guestId: new mongoose.Types.ObjectId('68c65dc8cbb8060e028e96d1'),
        bookingNumber: `BK${Date.now()}-${i}`,
        rooms: [{
          roomId: roomData._id,
          roomNumber: roomData.roomNumber,
          rate: rate
        }],
        checkIn,
        checkOut,
        nights,
        totalAmount,
        status: 'confirmed',
        paymentStatus: 'paid',
        bookingSource: 'direct',
        createdAt: new Date() // Recent creation date (within 7 day window)
      });
    }

    await Booking.insertMany(bookings);

    const totalRevenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalNights = bookings.reduce((sum, b) => sum + b.nights, 0);
    const avgRate = totalRevenue / totalNights;

    console.log(`✅ Created ${bookings.length} bookings with checkIn dates in last 30 days`);
    console.log(`💰 Total Revenue: ₹${totalRevenue.toLocaleString()}`);
    console.log(`🏨 Total Room Nights: ${totalNights}`);
    console.log(`💵 Average Daily Rate: ₹${avgRate.toFixed(2)}`);
    console.log(`📅 CheckIn range: ${new Date(Math.min(...bookings.map(b => b.checkIn))).toDateString()} to ${new Date(Math.max(...bookings.map(b => b.checkIn))).toDateString()}`);

  } catch (error) {
    console.error('Error creating bookings:', error);
  } finally {
    mongoose.disconnect();
    console.log('🔌 Disconnected');
  }
}

createAnalyticsBookings();