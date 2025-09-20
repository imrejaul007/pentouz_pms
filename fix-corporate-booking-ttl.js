import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function fixCorporateBookingTTL() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    // List all indexes
    console.log('\n📋 Current indexes on bookings collection:');
    const indexes = await bookingsCollection.indexes();

    // Find the TTL index
    const ttlIndex = indexes.find(idx =>
      idx.expireAfterSeconds !== undefined &&
      idx.key &&
      idx.key.reservedUntil === 1
    );

    if (ttlIndex) {
      console.log('\n🔍 Found TTL index:', JSON.stringify(ttlIndex, null, 2));

      // Drop the old TTL index
      console.log('\n🗑️  Dropping old TTL index...');
      await bookingsCollection.dropIndex(ttlIndex.name);
      console.log('✅ Old TTL index dropped successfully');
    } else {
      console.log('\n⚠️  No TTL index found on reservedUntil field');
    }

    // Create the new TTL index that excludes corporate bookings
    // MongoDB doesn't support $ne in partial filter expressions, so we use a different approach
    console.log('\n🔨 Creating new TTL index with proper filter...');
    await bookingsCollection.createIndex(
      {
        reservedUntil: 1
      },
      {
        expireAfterSeconds: 0,
        partialFilterExpression: {
          status: 'pending',
          reservedUntil: { $exists: true },
          'corporateBooking.corporateCompanyId': { $exists: false }
        },
        name: 'ttl_pending_non_corporate_bookings'
      }
    );
    console.log('✅ New TTL index created successfully');

    // Check for any pending corporate bookings that might have been affected
    console.log('\n📊 Checking corporate bookings status...');
    const corporateBookingsCount = await bookingsCollection.countDocuments({
      'corporateBooking.corporateCompanyId': { $exists: true, $ne: null }
    });

    const pendingCorporateBookings = await bookingsCollection.countDocuments({
      'corporateBooking.corporateCompanyId': { $exists: true, $ne: null },
      status: 'pending'
    });

    console.log(`Total corporate bookings: ${corporateBookingsCount}`);
    console.log(`Pending corporate bookings: ${pendingCorporateBookings}`);

    // Update any pending corporate bookings to confirmed to prevent deletion
    if (pendingCorporateBookings > 0) {
      console.log('\n⚠️  Found pending corporate bookings. Would you like to update them to confirmed status?');
      console.log('This will prevent them from being accidentally deleted.');

      // For safety, let's just report them
      const pendingBookings = await bookingsCollection.find({
        'corporateBooking.corporateCompanyId': { $exists: true, $ne: null },
        status: 'pending'
      }).limit(10).toArray();

      console.log('\nFirst 10 pending corporate bookings:');
      pendingBookings.forEach(booking => {
        console.log(`- Booking ${booking.bookingNumber}: Company ID ${booking.corporateBooking.corporateCompanyId}, Reserved Until: ${booking.reservedUntil}`);
      });
    }

    // Verify the new index
    console.log('\n✅ Verifying new index configuration...');
    const newIndexes = await bookingsCollection.indexes();
    const newTtlIndex = newIndexes.find(idx => idx.name === 'ttl_pending_non_corporate_bookings');

    if (newTtlIndex) {
      console.log('New TTL index verified:', JSON.stringify(newTtlIndex, null, 2));
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('Corporate bookings are now protected from automatic TTL deletion.');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the migration
fixCorporateBookingTTL().catch(console.error);