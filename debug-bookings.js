import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from './src/models/Booking.js';

dotenv.config();

async function debugBookings() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get total booking count
    const totalCount = await Booking.countDocuments();
    console.log(`📊 Total bookings in database: ${totalCount}`);

    if (totalCount > 0) {
      // Check first few bookings
      const sampleBookings = await Booking.find({}).limit(5);
      console.log('\n📋 Sample Bookings:');

      sampleBookings.forEach((booking, index) => {
        console.log(`\n   Booking ${index + 1}:`);
        console.log(`     ID: ${booking._id}`);
        console.log(`     Number: ${booking.bookingNumber}`);
        console.log(`     Hotel ID: ${booking.hotelId}`);
        console.log(`     User ID: ${booking.userId}`);
        console.log(`     Status: ${booking.status}`);
        console.log(`     Total Amount: ₹${booking.totalAmount}`);
        console.log(`     Paid Amount: ₹${booking.paidAmount}`);
        console.log(`     Check-in: ${booking.checkIn}`);
        console.log(`     Check-out: ${booking.checkOut}`);
      });

      // Check hotel ID distribution
      const hotelIdDistribution = await Booking.aggregate([
        { $group: { _id: '$hotelId', count: { $sum: 1 } } }
      ]);

      console.log('\n🏨 Booking Hotel ID Distribution:');
      hotelIdDistribution.forEach(dist => {
        console.log(`     Hotel ID ${dist._id}: ${dist.count} bookings`);
      });

      // Check if hotelId field exists and is populated
      const bookingsWithoutHotelId = await Booking.find({ hotelId: { $exists: false } });
      console.log(`\n❓ Bookings without hotelId: ${bookingsWithoutHotelId.length}`);

      const bookingsWithNullHotelId = await Booking.find({ hotelId: null });
      console.log(`❓ Bookings with null hotelId: ${bookingsWithNullHotelId.length}`);

      // Try different status queries
      console.log('\n🔍 Status-based queries:');
      const checkedInCount = await Booking.countDocuments({ status: 'checked_in' });
      const confirmedCount = await Booking.countDocuments({ status: 'confirmed' });
      const checkedOutCount = await Booking.countDocuments({ status: 'checked_out' });

      console.log(`     checked_in: ${checkedInCount}`);
      console.log(`     confirmed: ${confirmedCount}`);
      console.log(`     checked_out: ${checkedOutCount}`);

    } else {
      console.log('❌ No bookings found in database');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

debugBookings();