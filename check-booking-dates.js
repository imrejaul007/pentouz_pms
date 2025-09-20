import mongoose from 'mongoose';
import Booking from './src/models/Booking.js';

const MONGO_URI = "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function checkBookingDates() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const bookings = await Booking.find().limit(10);
    console.log(`\nFound ${bookings.length} bookings`);

    console.log('\n📅 Sample booking dates:');
    bookings.forEach((booking, i) => {
      console.log(`${i+1}. Booking ${booking.bookingNumber}`);
      console.log(`   CheckIn: ${booking.checkIn}`);
      console.log(`   CheckOut: ${booking.checkOut}` );
      console.log(`   CreatedAt: ${booking.createdAt}`);
      console.log(`   Status: ${booking.status}`);
      console.log(`   Total: ₹${booking.totalAmount}`);
      console.log('');
    });

    // Check current date range for analytics (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    console.log(`\n🔍 Analytics date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const analyticsBookings = await Booking.find({
      checkIn: { $gte: startDate, $lte: endDate },
      status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
    });

    console.log(`📊 Bookings in analytics range: ${analyticsBookings.length}`);

    // Check future bookings
    const futureBookings = await Booking.find({
      checkIn: { $gte: endDate }
    });

    console.log(`🔮 Future bookings: ${futureBookings.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  }
}

checkBookingDates();