const mongoose = require('mongoose');
const Booking = require('./src/models/Booking.js');

async function diagnoseDashboard() {
  try {
    console.log('🔍 Diagnosing Dashboard Data Issues...\n');
    
    // Connect to database
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/hotel-management');
    console.log('✅ Connected to MongoDB\n');
    
    // Check total bookings
    const totalBookings = await Booking.countDocuments();
    console.log(`📊 Total bookings in database: ${totalBookings}`);
    
    if (totalBookings === 0) {
      console.log('❌ PROBLEM FOUND: No bookings in database!');
      console.log('💡 SOLUTION: Run the seed script to populate data');
      console.log('   Command: cd backend && node src/scripts/seed.js\n');
      return;
    }
    
    // Check recent bookings (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    
    console.log(`📅 Checking bookings from: ${thirtyDaysAgo.toISOString()}`);
    console.log(`📅 To: ${now.toISOString()}\n`);
    
    const recentBookings = await Booking.countDocuments({
      checkIn: { $gte: thirtyDaysAgo, $lte: now }
    });
    
    console.log(`📈 Bookings in last 30 days: ${recentBookings}`);
    
    if (recentBookings === 0) {
      console.log('⚠️  WARNING: No bookings in the last 30 days');
      console.log('💡 This explains why dashboard shows 0 values');
      
      // Check what date ranges we have
      const sampleBookings = await Booking.find({}).limit(5).select('checkIn checkOut totalAmount status');
      console.log('\n📋 Sample booking dates:');
      sampleBookings.forEach((booking, index) => {
        console.log(`   ${index + 1}. Check-in: ${booking.checkIn?.toISOString()}, Amount: ${booking.totalAmount}, Status: ${booking.status}`);
      });
      
      // Check if we have any bookings with valid amounts
      const bookingsWithAmount = await Booking.countDocuments({
        totalAmount: { $gt: 0 }
      });
      console.log(`\n💰 Bookings with revenue > 0: ${bookingsWithAmount}`);
      
    } else {
      console.log('✅ Found recent bookings - dashboard should work');
      
      // Calculate sample revenue
      const recentBookingsData = await Booking.find({
        checkIn: { $gte: thirtyDaysAgo, $lte: now }
      }).select('totalAmount');
      
      const totalRevenue = recentBookingsData.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
      console.log(`💰 Total revenue in last 30 days: ₹${totalRevenue.toLocaleString()}`);
    }
    
    // Check for any data quality issues
    const bookingsWithoutAmount = await Booking.countDocuments({
      $or: [
        { totalAmount: { $exists: false } },
        { totalAmount: null },
        { totalAmount: 0 }
      ]
    });
    
    if (bookingsWithoutAmount > 0) {
      console.log(`\n⚠️  ${bookingsWithoutAmount} bookings have no revenue data`);
    }
    
    console.log('\n🏁 Diagnosis complete!');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

diagnoseDashboard();
