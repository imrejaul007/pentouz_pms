const mongoose = require('mongoose');

// Connect to MongoDB
const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management';

async function testHotelMetrics() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get the first hotel from database
    const hotel = await mongoose.connection.db.collection('hotels').findOne({});
    if (!hotel) {
      console.log('❌ No hotels found in database');
      return;
    }

    console.log('🏨 Found hotel:', hotel.name, 'ID:', hotel._id);

    // Get today's date range
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    console.log('📅 Date range:', startOfMonth.toISOString(), 'to', today.toISOString());

    // Get total rooms for this hotel
    const totalRooms = await mongoose.connection.db.collection('rooms').countDocuments({
      hotelId: hotel._id,
      isActive: true
    });

    console.log('🏠 Total rooms for hotel:', totalRooms);

    // Get current bookings (for occupancy)
    const currentBookings = await mongoose.connection.db.collection('bookings').find({
      hotelId: hotel._id,
      checkIn: { $lte: today },
      checkOut: { $gt: today },
      status: { $in: ['confirmed', 'checked_in'] }
    }).toArray();

    console.log('📋 Current bookings:', currentBookings.length);

    // Get period bookings (for revenue)
    const periodBookings = await mongoose.connection.db.collection('bookings').find({
      hotelId: hotel._id,
      $or: [
        { checkIn: { $gte: startOfMonth, $lte: today } },
        { checkOut: { $gte: startOfMonth, $lte: today } },
        {
          checkIn: { $lt: startOfMonth },
          checkOut: { $gt: today }
        }
      ],
      status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
    }).toArray();

    console.log('💰 Period bookings for revenue calculation:', periodBookings.length);

    // Calculate metrics
    const occupiedRooms = currentBookings.length;
    const availableRooms = totalRooms - occupiedRooms;
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    const totalRevenue = periodBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);

    const totalRoomNights = periodBookings.reduce((sum, booking) => {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      return sum + Math.max(1, nights);
    }, 0);

    const averageDailyRate = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;
    const revenuePerAvailableRoom = totalRooms > 0 ? totalRevenue / totalRooms : 0;

    console.log('\n📊 CALCULATED METRICS:');
    console.log('  Occupied Rooms:', occupiedRooms);
    console.log('  Available Rooms:', availableRooms);
    console.log('  Occupancy Rate:', Math.round(occupancyRate * 100) / 100, '%');
    console.log('  Total Revenue:', '₹', Math.round(totalRevenue));
    console.log('  Average Daily Rate:', '₹', Math.round(averageDailyRate));
    console.log('  Revenue Per Available Room:', '₹', Math.round(revenuePerAvailableRoom));

    // Test the simulated API response
    const apiResponse = {
      success: true,
      data: {
        occupiedRooms,
        availableRooms,
        oooRooms: 0, // Simplified
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        averageDailyRate: Math.round(averageDailyRate),
        revenuePerAvailableRoom: Math.round(revenuePerAvailableRoom),
        totalRevenue: Math.round(totalRevenue),
        lastMonth: {
          occupancyRate: Math.max(0, occupancyRate - 5), // Simplified
          averageDailyRate: Math.round(averageDailyRate * 0.9),
          revenuePerAvailableRoom: Math.round(revenuePerAvailableRoom * 0.9),
          totalRevenue: Math.round(totalRevenue * 0.9)
        }
      }
    };

    console.log('\n🚀 SIMULATED API RESPONSE:');
    console.log(JSON.stringify(apiResponse, null, 2));

    console.log('\n✅ Hotel metrics test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing hotel metrics:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔄 Disconnected from MongoDB');
  }
}

testHotelMetrics();