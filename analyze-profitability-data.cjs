const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

// Define schemas
const roomSchema = new mongoose.Schema({
  roomNumber: String,
  type: String,
  roomType: String,
  status: String,
  hotelId: mongoose.Schema.Types.ObjectId,
  isActive: Boolean,
  floor: Number
});

const bookingSchema = new mongoose.Schema({
  bookingId: String,
  roomType: String,
  totalAmount: Number,
  checkIn: Date,
  checkOut: Date,
  nights: Number,
  status: String,
  hotelId: mongoose.Schema.Types.ObjectId,
  rooms: [{
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    roomNumber: String
  }]
});

const Room = mongoose.model('Room', roomSchema);
const Booking = mongoose.model('Booking', bookingSchema);

async function analyzeProfitabilityData() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('=== PROFITABILITY ANALYTICS DATA ANALYSIS ===\n');

    // 1. Analyze Room Types Issue
    console.log('1️⃣ ROOM TYPE ANALYSIS');

    // Check room type fields in Room collection
    const roomTypeDistribution = await Room.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: {
            type: '$type',
            roomType: '$roomType'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.type': 1 } }
    ]);

    console.log('📊 Room Type Distribution:');
    for (const dist of roomTypeDistribution) {
      console.log(`   Type: "${dist._id.type || 'null'}", RoomType: "${dist._id.roomType || 'null'}" - Count: ${dist.count}`);
    }

    // 2. Analyze Booking Room Types
    console.log('\n2️⃣ BOOKING ROOM TYPE ANALYSIS');

    const bookingRoomTypes = await Booking.aggregate([
      {
        $group: {
          _id: '$roomType',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('📊 Booking Room Type Distribution:');
    for (const booking of bookingRoomTypes) {
      console.log(`   RoomType: "${booking._id || 'null'}" - Bookings: ${booking.count}, Revenue: ₹${booking.totalRevenue || 0}`);
    }

    // 3. Check occupancy calculation data
    console.log('\n3️⃣ OCCUPANCY CALCULATION DATA');

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const currentBookings = await Booking.find({
      status: { $in: ['confirmed', 'checked_in'] },
      checkIn: { $lte: today },
      checkOut: { $gte: today }
    });

    console.log(`📅 Current active bookings: ${currentBookings.length}`);
    console.log(`📅 Date range for current: ${today.toDateString()}`);

    // Calculate room nights for current month
    const monthlyBookings = await Booking.find({
      $or: [
        { checkIn: { $gte: monthStart, $lte: today } },
        { checkOut: { $gte: monthStart, $lte: today } },
        { checkIn: { $lt: monthStart }, checkOut: { $gt: today } }
      ],
      status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
    });

    console.log(`📅 Monthly bookings (${monthStart.toDateString()} to ${today.toDateString()}): ${monthlyBookings.length}`);

    let totalRoomNights = 0;
    let totalRevenue = 0;

    for (const booking of monthlyBookings) {
      let nights = booking.nights;
      if (!nights && booking.checkIn && booking.checkOut) {
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      }
      nights = Math.max(1, nights || 1);

      const roomCount = booking.rooms ? booking.rooms.length : 1;
      const bookingRoomNights = nights * roomCount;

      totalRoomNights += bookingRoomNights;
      totalRevenue += booking.totalAmount || 0;

      console.log(`   Booking ${booking.bookingId || booking._id}: ${nights} nights x ${roomCount} rooms = ${bookingRoomNights} room-nights, Revenue: ₹${booking.totalAmount || 0}`);
    }

    console.log(`\n📊 CALCULATED METRICS:`);
    console.log(`   Total Room-Nights Sold: ${totalRoomNights}`);
    console.log(`   Total Revenue: ₹${totalRevenue}`);
    console.log(`   Average Daily Rate: ₹${totalRoomNights > 0 ? Math.round(totalRevenue / totalRoomNights) : 0}`);

    // Calculate occupancy rate
    const totalRooms = await Room.countDocuments({ isActive: true });
    const daysInMonth = today.getDate();
    const possibleRoomNights = totalRooms * daysInMonth;
    const occupancyRate = (totalRoomNights / possibleRoomNights) * 100;

    console.log(`   Total Rooms: ${totalRooms}`);
    console.log(`   Days in Month: ${daysInMonth}`);
    console.log(`   Possible Room-Nights: ${possibleRoomNights}`);
    console.log(`   Occupancy Rate: ${occupancyRate.toFixed(2)}%`);

    // 4. Room type profitability analysis
    console.log('\n4️⃣ ROOM TYPE PROFITABILITY ANALYSIS');

    // Get bookings with room details populated
    const bookingsWithRooms = await Booking.find({
      $or: [
        { checkIn: { $gte: monthStart, $lte: today } },
        { checkOut: { $gte: monthStart, $lte: today } },
        { checkIn: { $lt: monthStart }, checkOut: { $gt: today } }
      ],
      status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
    }).populate('rooms.roomId');

    console.log(`📊 Bookings with room details: ${bookingsWithRooms.length}`);

    // Categorize by actual room types
    const roomTypeProfitability = {};

    for (const booking of bookingsWithRooms) {
      let roomType = booking.roomType;

      // If roomType is null/undefined, try to get from associated room
      if (!roomType || roomType === 'undefined' || roomType === null) {
        if (booking.rooms && booking.rooms.length > 0 && booking.rooms[0].roomId) {
          roomType = booking.rooms[0].roomId.type || 'Unknown';
        } else {
          roomType = 'Unknown';
        }
      }

      if (!roomTypeProfitability[roomType]) {
        roomTypeProfitability[roomType] = {
          bookings: 0,
          revenue: 0,
          roomNights: 0
        };
      }

      let nights = booking.nights;
      if (!nights && booking.checkIn && booking.checkOut) {
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      }
      nights = Math.max(1, nights || 1);

      const roomCount = booking.rooms ? booking.rooms.length : 1;

      roomTypeProfitability[roomType].bookings++;
      roomTypeProfitability[roomType].revenue += booking.totalAmount || 0;
      roomTypeProfitability[roomType].roomNights += nights * roomCount;
    }

    console.log('📊 Room Type Profitability Results:');
    for (const [roomType, data] of Object.entries(roomTypeProfitability)) {
      const avgRate = data.roomNights > 0 ? data.revenue / data.roomNights : 0;
      console.log(`   ${roomType}:`);
      console.log(`     Bookings: ${data.bookings}`);
      console.log(`     Revenue: ₹${data.revenue}`);
      console.log(`     Room-Nights: ${data.roomNights}`);
      console.log(`     Avg Rate: ₹${Math.round(avgRate)}`);
      console.log('');
    }

    // 5. Check room inventory by type
    console.log('5️⃣ ROOM INVENTORY BY TYPE');

    const roomInventory = await Room.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('📊 Room Inventory Distribution:');
    for (const room of roomInventory) {
      const roomType = room._id || 'Unknown';
      const profitData = roomTypeProfitability[roomType] || { roomNights: 0 };
      const roomTypeOccupancy = profitData.roomNights / (room.count * daysInMonth) * 100;

      console.log(`   ${roomType}: ${room.count} rooms, Occupancy: ${roomTypeOccupancy.toFixed(2)}%`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

analyzeProfitabilityData();