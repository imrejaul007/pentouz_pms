import mongoose from 'mongoose';
import AdvancedReservation from './src/models/AdvancedReservation.js';
import RoomUpgrade from './src/models/RoomUpgrade.js';
import VIPGuest from './src/models/VIPGuest.js';
import WaitingList from './src/models/WaitingList.js';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';
const HOTEL_ID = '68cd01414419c17b5f6b4c12';

async function verifyAdvancedReservations() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n🔍 Checking current Advanced Reservations data...');

    // Check current counts
    const reservationCount = await AdvancedReservation.countDocuments({ hotelId: HOTEL_ID });
    const upgradeCount = await RoomUpgrade.countDocuments({
      hotelId: HOTEL_ID,
      status: { $in: ['approved', 'confirmed'] }
    });
    const waitlistCount = await WaitingList.countDocuments({
      hotelId: HOTEL_ID,
      status: 'active'
    });
    const vipCount = await AdvancedReservation.countDocuments({
      hotelId: HOTEL_ID,
      'guestProfile.vipStatus': true
    });
    const vipGuestCount = await VIPGuest.countDocuments({ hotelId: HOTEL_ID, status: 'active' });

    console.log('\n📊 CURRENT COUNTS:');
    console.log(`📋 Total Reservations: ${reservationCount} (Target: 5)`);
    console.log(`⬆️ Upgrades: ${upgradeCount} (Target: 2)`);
    console.log(`⏳ Waitlist: ${waitlistCount} (Target: 5)`);
    console.log(`👑 VIP Reservations: ${vipCount} (Target: 1)`);
    console.log(`🌟 VIP Guests: ${vipGuestCount} (Target: 1)`);

    if (reservationCount === 5 && upgradeCount === 2 && waitlistCount === 5 && vipCount === 1) {
      console.log('\n✅ SUCCESS! All metrics match the target screenshot requirements!');
      console.log('\n🎯 Your Advanced Reservations page should now show:');
      console.log('   • Total Reservations: 5');
      console.log('   • Upgrades: 2');
      console.log('   • Waitlist: 5');
      console.log('   • VIP Reservations: 1');

      // Sample some records
      console.log('\n📝 Sample Records:');

      const sampleReservation = await AdvancedReservation.findOne({
        hotelId: HOTEL_ID,
        'guestProfile.vipStatus': true
      });
      if (sampleReservation) {
        console.log(`VIP Reservation: ${sampleReservation.reservationId} (${sampleReservation.reservationType})`);
      }

      const sampleUpgrade = await RoomUpgrade.findOne({
        hotelId: HOTEL_ID,
        status: { $in: ['approved', 'confirmed'] }
      });
      if (sampleUpgrade) {
        console.log(`Upgrade: ${sampleUpgrade.upgradeId} (${sampleUpgrade.upgradeType})`);
      }

      const sampleWaitlist = await WaitingList.findOne({
        hotelId: HOTEL_ID,
        status: 'active'
      });
      if (sampleWaitlist) {
        console.log(`Waitlist: ${sampleWaitlist.guestName} waiting for ${sampleWaitlist.roomType}`);
      }

    } else {
      console.log('\n❌ Data does not match target requirements.');
      console.log('   Run the seeding script to populate the database:');
      console.log('   npm run seed-advanced-reservations');
    }

  } catch (error) {
    console.error('❌ Error verifying data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the verification
verifyAdvancedReservations();