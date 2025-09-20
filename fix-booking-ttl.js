import mongoose from 'mongoose';

const MONGO_URI = "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0";

async function fixBookingTTL() {
  try {
    console.log('🔧 Connecting to database...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to database');

    console.log('🔧 Checking current booking status...');

    // Update all confirmed bookings to remove reservedUntil
    const result = await mongoose.connection.db.collection('bookings').updateMany(
      {
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] },
        reservedUntil: { $exists: true, $ne: null }
      },
      {
        $unset: { reservedUntil: "" }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} confirmed bookings - removed reservedUntil field`);

    // Update all pending bookings to have a future reservedUntil (24 hours from now)
    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const pendingResult = await mongoose.connection.db.collection('bookings').updateMany(
      {
        status: 'pending',
        $or: [
          { reservedUntil: { $exists: false } },
          { reservedUntil: { $lt: new Date() } }
        ]
      },
      {
        $set: { reservedUntil: futureTime }
      }
    );

    console.log(`✅ Updated ${pendingResult.modifiedCount} pending bookings - set reservedUntil to 24 hours from now`);

    // Check current booking count
    const bookingCount = await mongoose.connection.db.collection('bookings').countDocuments();
    console.log(`📊 Total bookings in database: ${bookingCount}`);

    // Show distribution by status
    const statusDistribution = await mongoose.connection.db.collection('bookings').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    console.log('📈 Booking status distribution:');
    statusDistribution.forEach(item => {
      console.log(`  ${item._id}: ${item.count} bookings`);
    });

  } catch (error) {
    console.error('❌ Error fixing booking TTL:', error);
  } finally {
    mongoose.disconnect();
  }
}

fixBookingTTL();