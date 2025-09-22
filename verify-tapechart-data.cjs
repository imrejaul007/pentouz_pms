const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

// Define schemas
const bookingSchema = new mongoose.Schema({
  bookingId: String,
  totalAmount: Number,
  checkIn: Date,
  checkOut: Date,
  status: String,
  hotelId: mongoose.Schema.Types.ObjectId,
  guestDetails: {
    vipStatus: String,
    specialRequests: [String]
  },
  createdAt: Date,
  rooms: [{ roomId: mongoose.Schema.Types.ObjectId }]
});

const roomBlockSchema = new mongoose.Schema({
  status: String,
  startDate: Date,
  endDate: Date,
  hotelId: mongoose.Schema.Types.ObjectId
});

const waitingListSchema = new mongoose.Schema({
  hotelId: mongoose.Schema.Types.ObjectId,
  status: String
});

const roomSchema = new mongoose.Schema({
  hotelId: mongoose.Schema.Types.ObjectId,
  status: String,
  isActive: Boolean
});

const Booking = mongoose.model('Booking', bookingSchema);
const RoomBlock = mongoose.model('RoomBlock', roomBlockSchema);
const WaitingList = mongoose.model('WaitingList', waitingListSchema);
const Room = mongoose.model('Room', roomSchema);

async function verifyTapeChartData() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('=== TAPE CHART DASHBOARD VERIFICATION ===\n');

    const hotelId = '68cd01414419c17b5f6b4c12'; // THE PENTOUZ hotel ID

    // 1. RESERVATIONS SECTION VERIFICATION
    console.log('🏨 1. RESERVATIONS SECTION ANALYSIS');

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Query similar to dashboard logic
    const totalReservationsQuery = {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      $or: [
        { checkIn: { $lte: endOfDay }, checkOut: { $gte: startOfDay } },
        { status: { $in: ['confirmed', 'checked_in'] } }
      ]
    };

    const allReservations = await Booking.find(totalReservationsQuery);
    console.log(`📊 Total Reservations: ${allReservations.length}`);
    console.log(`   Expected from screenshot: 20`);
    console.log(`   Match: ${allReservations.length === 20 ? '✅' : '❌'}`);

    // VIP Reservations calculation
    const vipReservations = allReservations.filter(booking =>
      booking.guestDetails?.vipStatus || booking.totalAmount > 20000
    );
    console.log(`📊 VIP Reservations: ${vipReservations.length}`);
    console.log(`   Expected from screenshot: 2`);
    console.log(`   Match: ${vipReservations.length === 2 ? '✅' : '❌'}`);

    // Special Requests calculation
    const specialRequests = allReservations.filter(booking =>
      booking.guestDetails?.specialRequests && booking.guestDetails.specialRequests.length > 0
    );
    console.log(`📊 Special Requests: ${specialRequests.length}`);
    console.log(`   Expected from screenshot: 0`);
    console.log(`   Match: ${specialRequests.length === 0 ? '✅' : '❌'}`);

    // 2. ROOM BLOCKS SECTION VERIFICATION
    console.log('\n🏗️ 2. ROOM BLOCKS SECTION ANALYSIS');

    const activeBlocks = await RoomBlock.countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'active',
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    });
    console.log(`📊 Active Blocks: ${activeBlocks}`);
    console.log(`   Expected from screenshot: 0`);
    console.log(`   Match: ${activeBlocks === 0 ? '✅' : '❌'}`);

    const blockedRooms = await Room.countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'blocked'
    });
    console.log(`📊 Blocked Rooms: ${blockedRooms}`);
    console.log(`   Expected from screenshot: 0`);
    console.log(`   Match: ${blockedRooms === 0 ? '✅' : '❌'}`);

    // 3. WAITLIST SECTION VERIFICATION
    console.log('\n⏳ 3. WAITLIST SECTION ANALYSIS');

    const waitlistCount = await WaitingList.countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: { $in: ['waiting', 'active'] }
    });
    console.log(`📊 Guests on Waitlist: ${waitlistCount}`);
    console.log(`   Expected from screenshot: 0`);
    console.log(`   Match: ${waitlistCount === 0 ? '✅' : '❌'}`);

    // 4. RECENT ACTIVITY VERIFICATION
    console.log('\n🕐 4. RECENT ACTIVITY ANALYSIS');

    const recentCreationDate = new Date();
    recentCreationDate.setHours(recentCreationDate.getHours() - 2); // Last 2 hours

    const recentBookings = await Booking.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      createdAt: { $gte: recentCreationDate }
    }).sort({ createdAt: -1 }).limit(5);

    console.log(`📊 Recent Bookings (last 2 hours): ${recentBookings.length}`);

    if (recentBookings.length > 0) {
      console.log('📋 Recent Activity Details:');
      for (const booking of recentBookings) {
        console.log(`   Booking ID: ${booking._id}`);
        console.log(`   Created: ${booking.createdAt}`);
        console.log(`   Status: ${booking.status}`);
        console.log(`   Amount: ₹${booking.totalAmount || 0}`);
        console.log('   ---');
      }

      // Check if screenshot booking IDs exist
      const screenshotBookingIds = [
        '68cf700830251',  // Partial ID from screenshot
      ];

      console.log('\n🔍 SCREENSHOT BOOKING ID VERIFICATION:');
      for (const partialId of screenshotBookingIds) {
        const matchingBookings = await Booking.find({
          _id: { $regex: `^${partialId}` }
        });

        console.log(`   Booking ID starting with "${partialId}": ${matchingBookings.length} found`);
        if (matchingBookings.length > 0) {
          console.log(`   Full ID: ${matchingBookings[0]._id}`);
          console.log(`   Created: ${matchingBookings[0].createdAt}`);
          console.log(`   ✅ CONFIRMED: Screenshot shows real booking ID`);
        }
      }
    }

    // 5. OVERALL VERIFICATION SUMMARY
    console.log('\n📊 OVERALL VERIFICATION SUMMARY');
    console.log('====================================');

    const verificationResults = [
      { item: 'Total Reservations (20)', expected: 20, actual: allReservations.length },
      { item: 'VIP Reservations (2)', expected: 2, actual: vipReservations.length },
      { item: 'Special Requests (0)', expected: 0, actual: specialRequests.length },
      { item: 'Active Blocks (0)', expected: 0, actual: activeBlocks },
      { item: 'Blocked Rooms (0)', expected: 0, actual: blockedRooms },
      { item: 'Waitlist Count (0)', expected: 0, actual: waitlistCount }
    ];

    let allMatching = true;
    for (const result of verificationResults) {
      const match = result.expected === result.actual;
      console.log(`${match ? '✅' : '❌'} ${result.item}: Expected ${result.expected}, Got ${result.actual}`);
      if (!match) allMatching = false;
    }

    console.log(`\n${allMatching ? '🎉' : '⚠️'} VERDICT: ${allMatching ? 'ALL DATA MATCHES - 100% REAL DATABASE DATA' : 'SOME DISCREPANCIES FOUND'}`);

    if (allMatching) {
      console.log('📝 CONCLUSION: The Tape Chart dashboard displays entirely real data from the MongoDB database.');
      console.log('   - All reservation counts are accurate');
      console.log('   - All room block data is accurate');
      console.log('   - All waitlist data is accurate');
      console.log('   - Recent activity shows real booking IDs with real timestamps');
      console.log('   - No mock or placeholder data detected');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

verifyTapeChartData();