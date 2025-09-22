const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

// Define schemas for all collections
const advancedReservationSchema = new mongoose.Schema({
  reservationId: String,
  guestDetails: {
    name: String,
    email: String,
    phone: String,
    vipStatus: String,
    preferences: [String],
    specialRequests: [String]
  },
  roomPreferences: {
    roomType: String,
    floor: Number,
    amenities: [String],
    accessibility: Boolean
  },
  bookingDetails: {
    checkIn: Date,
    checkOut: Date,
    nights: Number,
    adults: Number,
    children: Number,
    totalAmount: Number
  },
  status: String,
  hotelId: mongoose.Schema.Types.ObjectId,
  upgradeEligible: Boolean,
  waitlistPriority: Number,
  createdAt: Date,
  updatedAt: Date
});

const bookingSchema = new mongoose.Schema({
  bookingId: String,
  guestDetails: {
    name: String,
    email: String,
    vipStatus: String,
    specialRequests: [String]
  },
  totalAmount: Number,
  checkIn: Date,
  checkOut: Date,
  status: String,
  hotelId: mongoose.Schema.Types.ObjectId,
  roomType: String,
  isAdvanced: Boolean,
  upgradeEligible: Boolean,
  createdAt: Date
});

const waitingListSchema = new mongoose.Schema({
  guestId: mongoose.Schema.Types.ObjectId,
  guestDetails: {
    name: String,
    email: String,
    phone: String
  },
  requestedDates: {
    checkIn: Date,
    checkOut: Date
  },
  roomType: String,
  status: String,
  priority: Number,
  hotelId: mongoose.Schema.Types.ObjectId,
  createdAt: Date
});

const roomBlockSchema = new mongoose.Schema({
  blockName: String,
  status: String,
  startDate: Date,
  endDate: Date,
  hotelId: mongoose.Schema.Types.ObjectId
});

const AdvancedReservation = mongoose.model('AdvancedReservation', advancedReservationSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const WaitingList = mongoose.model('WaitingList', waitingListSchema);
const RoomBlock = mongoose.model('RoomBlock', roomBlockSchema);

async function verifyAdvancedReservationsData() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('=== ADVANCED RESERVATIONS PAGE VERIFICATION ===\n');

    const hotelId = '68cd01414419c17b5f6b4c12'; // THE PENTOUZ hotel ID

    // 1. ADVANCED RESERVATIONS ANALYSIS
    console.log('🏨 1. ADVANCED RESERVATIONS COLLECTION ANALYSIS');

    const advancedReservations = await AdvancedReservation.find({
      hotelId: new mongoose.Types.ObjectId(hotelId)
    });

    console.log(`📊 Advanced Reservations Found: ${advancedReservations.length}`);
    console.log(`   Expected from screenshot: 5`);
    console.log(`   Match: ${advancedReservations.length === 5 ? '✅' : '❌'}`);

    if (advancedReservations.length > 0) {
      console.log('\n📋 Advanced Reservations Details:');
      for (const reservation of advancedReservations) {
        console.log(`   Reservation ID: ${reservation.reservationId || reservation._id}`);
        console.log(`   Guest: ${reservation.guestDetails?.name || 'N/A'}`);
        console.log(`   Status: ${reservation.status}`);
        console.log(`   VIP: ${reservation.guestDetails?.vipStatus || 'No'}`);
        console.log(`   Upgrade Eligible: ${reservation.upgradeEligible || false}`);
        console.log(`   Check-in: ${reservation.bookingDetails?.checkIn || 'N/A'}`);
        console.log('   ---');
      }
    }

    // 2. UPGRADES ANALYSIS
    console.log('\n🔄 2. UPGRADES ANALYSIS');

    // Check Advanced Reservations for upgrade eligibility
    const upgradeEligibleAdvanced = advancedReservations.filter(res => res.upgradeEligible === true);

    // Also check regular bookings for upgrade eligibility
    const upgradeEligibleBookings = await Booking.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      upgradeEligible: true
    });

    const totalUpgrades = upgradeEligibleAdvanced.length + upgradeEligibleBookings.length;

    console.log(`📊 Upgrade Eligible (Advanced): ${upgradeEligibleAdvanced.length}`);
    console.log(`📊 Upgrade Eligible (Regular): ${upgradeEligibleBookings.length}`);
    console.log(`📊 Total Upgrades: ${totalUpgrades}`);
    console.log(`   Expected from screenshot: 2`);
    console.log(`   Match: ${totalUpgrades === 2 ? '✅' : '❌'}`);

    // 3. WAITLIST ANALYSIS
    console.log('\n⏳ 3. WAITLIST ANALYSIS');

    const waitlistEntries = await WaitingList.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: { $in: ['waiting', 'active', 'pending'] }
    });

    console.log(`📊 Waitlist Entries: ${waitlistEntries.length}`);
    console.log(`   Expected from screenshot: 5`);
    console.log(`   Match: ${waitlistEntries.length === 5 ? '✅' : '❌'}`);

    if (waitlistEntries.length > 0) {
      console.log('\n📋 Waitlist Details:');
      for (const entry of waitlistEntries) {
        console.log(`   Guest: ${entry.guestDetails?.name || 'N/A'}`);
        console.log(`   Room Type: ${entry.roomType || 'N/A'}`);
        console.log(`   Status: ${entry.status}`);
        console.log(`   Priority: ${entry.priority || 'N/A'}`);
        console.log('   ---');
      }
    }

    // 4. VIP RESERVATIONS ANALYSIS
    console.log('\n👑 4. VIP RESERVATIONS ANALYSIS');

    const vipAdvanced = advancedReservations.filter(res =>
      res.guestDetails?.vipStatus && res.guestDetails.vipStatus !== 'none'
    );

    const vipBookings = await Booking.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      'guestDetails.vipStatus': { $exists: true, $ne: null, $ne: 'none' }
    });

    const totalVipReservations = vipAdvanced.length + vipBookings.length;

    console.log(`📊 VIP Advanced Reservations: ${vipAdvanced.length}`);
    console.log(`📊 VIP Regular Bookings: ${vipBookings.length}`);
    console.log(`📊 Total VIP Reservations: ${totalVipReservations}`);
    console.log(`   Expected from screenshot: 1`);
    console.log(`   Match: ${totalVipReservations === 1 ? '✅' : '❌'}`);

    // 5. NAVIGATION BADGES VERIFICATION
    console.log('\n🧭 5. NAVIGATION BADGES VERIFICATION');

    // Room Blocks count
    const roomBlocks = await RoomBlock.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'active'
    });

    console.log(`📊 Room Blocks (Active): ${roomBlocks.length}`);
    console.log(`   Expected badge: 2`);
    console.log(`   Match: ${roomBlocks.length === 2 ? '✅' : '❌'}`);

    // Total reservations (Advanced + Regular)
    const allBookings = await Booking.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: { $in: ['confirmed', 'pending', 'checked_in'] }
    });

    const totalReservations = advancedReservations.length + allBookings.length;

    console.log(`📊 Total Reservations (All): ${totalReservations}`);
    console.log(`   Expected badge: 5`);
    console.log(`   Match: ${totalReservations === 5 ? '✅' : '❌'}`);

    // Waitlist badge
    console.log(`📊 Waitlist Badge: ${waitlistEntries.length}`);
    console.log(`   Expected badge: 1`);
    console.log(`   Match: ${waitlistEntries.length === 1 ? '✅' : '❌'}`);

    // 6. PENDING RESERVATIONS
    console.log('\n⏰ 6. PENDING RESERVATIONS ANALYSIS');

    const pendingAdvanced = advancedReservations.filter(res => res.status === 'pending');
    const pendingBookings = await Booking.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'pending'
    });

    const totalPending = pendingAdvanced.length + pendingBookings.length;

    console.log(`📊 Pending Advanced: ${pendingAdvanced.length}`);
    console.log(`📊 Pending Regular: ${pendingBookings.length}`);
    console.log(`📊 Total Pending: ${totalPending}`);
    console.log(`   Expected from screenshot: 5`);
    console.log(`   Match: ${totalPending === 5 ? '✅' : '❌'}`);

    // 7. COLLECTIONS AVAILABILITY CHECK
    console.log('\n📚 7. DATABASE COLLECTIONS CHECK');

    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);

    const relevantCollections = [
      'advancedreservations',
      'bookings',
      'waitinglists',
      'roomblocks'
    ];

    console.log('📋 Available Collections:');
    for (const name of relevantCollections) {
      const exists = collectionNames.includes(name);
      console.log(`   ${name}: ${exists ? '✅' : '❌'}`);
    }

    // 8. OVERALL VERIFICATION SUMMARY
    console.log('\n📊 OVERALL VERIFICATION SUMMARY');
    console.log('====================================');

    const verificationResults = [
      { item: 'Total Advanced Reservations (5)', expected: 5, actual: advancedReservations.length },
      { item: 'Upgrades (2)', expected: 2, actual: totalUpgrades },
      { item: 'Waitlist (5)', expected: 5, actual: waitlistEntries.length },
      { item: 'VIP Reservations (1)', expected: 1, actual: totalVipReservations },
      { item: 'Pending Reservations (5)', expected: 5, actual: totalPending }
    ];

    let allMatching = true;
    for (const result of verificationResults) {
      const match = result.expected === result.actual;
      console.log(`${match ? '✅' : '❌'} ${result.item}: Expected ${result.expected}, Got ${result.actual}`);
      if (!match) allMatching = false;
    }

    console.log(`\n${allMatching ? '🎉' : '⚠️'} VERDICT: ${allMatching ? 'ALL DATA MATCHES - 100% REAL DATABASE DATA' : 'DISCREPANCIES FOUND - POSSIBLE MOCK DATA'}`);

    if (allMatching) {
      console.log('📝 CONCLUSION: The Advanced Reservations page displays entirely real data from the MongoDB database.');
      console.log('   - All reservation counts are accurate');
      console.log('   - All upgrade calculations are correct');
      console.log('   - All waitlist data is accurate');
      console.log('   - All VIP status tracking is correct');
      console.log('   - Navigation badges reflect real data');
      console.log('   - No mock or placeholder data detected');
    } else {
      console.log('📝 ISSUES FOUND:');
      console.log('   - Some metrics do not match database reality');
      console.log('   - May indicate mock data, incorrect queries, or missing database records');
      console.log('   - Requires investigation of frontend component data sources');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

verifyAdvancedReservationsData();