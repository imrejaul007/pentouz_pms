import mongoose from 'mongoose';
import TapeChartModels from './src/models/TapeChart.js';

const { AdvancedReservation } = TapeChartModels;

// MongoDB connection
const MONGO_URI = "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function debugAdvancedReservations() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if advanced reservations exist
    const count = await AdvancedReservation.countDocuments();
    console.log(`Total Advanced Reservations in database: ${count}`);

    if (count > 0) {
      // Get all advanced reservations
      const reservations = await AdvancedReservation.find()
        .populate('bookingId', 'bookingNumber guestName checkIn checkOut')
        .limit(10);

      console.log('\nSample Advanced Reservations:');
      reservations.forEach((reservation, index) => {
        console.log(`${index + 1}. ID: ${reservation._id}`);
        console.log(`   Reservation ID: ${reservation.reservationId}`);
        console.log(`   Type: ${reservation.reservationType}`);
        console.log(`   Priority: ${reservation.priority}`);
        console.log(`   Booking: ${reservation.bookingId ? reservation.bookingId.bookingNumber : 'Not Found'}`);
        console.log(`   Guest: ${reservation.bookingId ? reservation.bookingId.guestName : 'Unknown'}`);
        console.log(`   VIP Status: ${reservation.guestProfile?.vipStatus || 'none'}`);
        console.log(`   Upgrades: ${reservation.upgrades?.length || 0}`);
        console.log(`   Special Requests: ${reservation.specialRequests?.length || 0}`);
        console.log(`   Has Waitlist: ${reservation.waitlistInfo ? 'Yes' : 'No'}`);
        console.log('   ---');
      });

      // Test aggregation queries similar to what the controller uses
      console.log('\nTesting Stats Aggregation:');

      const typeStats = await AdvancedReservation.aggregate([
        {
          $group: {
            _id: '$reservationType',
            count: { $sum: 1 }
          }
        }
      ]);
      console.log('Type Stats:', typeStats);

      const priorityStats = await AdvancedReservation.aggregate([
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 }
          }
        }
      ]);
      console.log('Priority Stats:', priorityStats);

      const upgradeStats = await AdvancedReservation.aggregate([
        { $unwind: '$upgrades' },
        {
          $group: {
            _id: '$upgrades.upgradeType',
            count: { $sum: 1 },
            totalCharge: { $sum: '$upgrades.additionalCharge' }
          }
        }
      ]);
      console.log('Upgrade Stats:', upgradeStats);

      const waitlistCount = await AdvancedReservation.countDocuments({
        waitlistInfo: { $ne: null }
      });
      console.log('Waitlist Count:', waitlistCount);
    } else {
      console.log('\nNo Advanced Reservations found in database!');
      console.log('This explains why the stats are showing zeros.');
      console.log('Need to check if seed script ran properly.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

debugAdvancedReservations();