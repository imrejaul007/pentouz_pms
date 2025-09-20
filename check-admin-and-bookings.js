import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Booking from './src/models/Booking.js';
import Room from './src/models/Room.js';
import Hotel from './src/models/Hotel.js';

dotenv.config();

async function checkDataIntegrity() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check for admin users
    console.log('\n👤 Checking Admin Users:');
    const adminUsers = await User.find({ role: { $in: ['admin', 'manager'] } });
    console.log(`   Found ${adminUsers.length} admin/manager users:`);
    adminUsers.forEach(user => {
      console.log(`     - ${user.email} (${user.role}) - Hotel: ${user.hotelId}`);
    });

    // Check if admin@hotel.com exists
    const adminUser = await User.findOne({ email: 'admin@hotel.com' });
    if (adminUser) {
      console.log('✅ admin@hotel.com exists');
      console.log(`   Role: ${adminUser.role}, Hotel ID: ${adminUser.hotelId}`);
    } else {
      console.log('❌ admin@hotel.com NOT found');
    }

    // Check hotel data
    console.log('\n🏨 Hotel Information:');
    const hotels = await Hotel.find();
    console.log(`   Found ${hotels.length} hotels:`);
    hotels.forEach(hotel => {
      console.log(`     - ${hotel.name} (ID: ${hotel._id})`);
    });

    // Check booking data with revenue
    console.log('\n💰 Booking Revenue Analysis:');
    const bookingsWithRevenue = await Booking.find({}, {
      bookingNumber: 1,
      totalAmount: 1,
      paidAmount: 1,
      status: 1,
      checkIn: 1,
      checkOut: 1,
      userId: 1
    }).limit(10);

    console.log(`   Sample of ${bookingsWithRevenue.length} bookings:`);
    let totalRevenue = 0;
    bookingsWithRevenue.forEach(booking => {
      console.log(`     - ${booking.bookingNumber}: ₹${booking.totalAmount} (paid: ₹${booking.paidAmount || 0}) - ${booking.status}`);
      totalRevenue += booking.paidAmount || 0;
    });

    console.log(`\n   Sample Total Paid Amount: ₹${totalRevenue}`);

    // Check booking status distribution
    const statusDistribution = await Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalRevenue: { $sum: '$paidAmount' } } }
    ]);

    console.log('\n📊 Booking Status Distribution:');
    statusDistribution.forEach(stat => {
      console.log(`     ${stat._id}: ${stat.count} bookings, Revenue: ₹${stat.totalRevenue || 0}`);
    });

    // Check room occupancy
    const roomStatusDistribution = await Room.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    console.log('\n🏠 Room Status Distribution:');
    roomStatusDistribution.forEach(stat => {
      console.log(`     ${stat._id}: ${stat.count} rooms`);
    });

    // Check if rooms are properly linked to bookings
    const currentBookings = await Booking.find({
      status: { $in: ['checked_in', 'confirmed'] }
    }).populate('rooms.roomId');

    console.log(`\n🔗 Active Bookings Room Links: ${currentBookings.length} bookings`);

    console.log('\n✅ Data integrity check completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkDataIntegrity();