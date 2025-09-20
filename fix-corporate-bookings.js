import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function fixCorporateBookings() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    // 1. Find all corporate bookings that are pending
    console.log('\n📊 Checking for pending corporate bookings...');
    const pendingCorporateBookings = await bookingsCollection.find({
      'corporateBooking.corporateCompanyId': { $exists: true, $ne: null },
      status: 'pending'
    }).toArray();

    console.log(`Found ${pendingCorporateBookings.length} pending corporate bookings`);

    if (pendingCorporateBookings.length > 0) {
      console.log('\n🔧 Updating pending corporate bookings to confirmed status...');

      // Update all pending corporate bookings to confirmed
      const updateResult = await bookingsCollection.updateMany(
        {
          'corporateBooking.corporateCompanyId': { $exists: true, $ne: null },
          status: 'pending'
        },
        {
          $set: {
            status: 'confirmed',
            lastStatusChange: {
              from: 'pending',
              to: 'confirmed',
              timestamp: new Date(),
              reason: 'Corporate bookings auto-confirmed to prevent TTL deletion'
            }
          },
          $unset: {
            reservedUntil: "" // Remove reservedUntil field from corporate bookings
          },
          $push: {
            statusHistory: {
              status: 'confirmed',
              timestamp: new Date(),
              reason: 'Corporate bookings auto-confirmed to prevent TTL deletion',
              updatedBy: 'system'
            }
          }
        }
      );

      console.log(`✅ Updated ${updateResult.modifiedCount} corporate bookings to confirmed status`);
    }

    // 2. Remove reservedUntil from all corporate bookings
    console.log('\n🔧 Removing reservedUntil field from all corporate bookings...');
    const removeReservedUntilResult = await bookingsCollection.updateMany(
      {
        'corporateBooking.corporateCompanyId': { $exists: true, $ne: null },
        reservedUntil: { $exists: true }
      },
      {
        $unset: {
          reservedUntil: ""
        }
      }
    );

    console.log(`✅ Removed reservedUntil from ${removeReservedUntilResult.modifiedCount} corporate bookings`);

    // 3. Recreate TTL index with standard configuration
    console.log('\n📋 Checking current indexes...');
    const indexes = await bookingsCollection.indexes();
    const ttlIndex = indexes.find(idx =>
      idx.expireAfterSeconds !== undefined &&
      idx.key &&
      idx.key.reservedUntil === 1
    );

    if (ttlIndex) {
      console.log('🗑️  Dropping existing TTL index...');
      await bookingsCollection.dropIndex(ttlIndex.name);
      console.log('✅ Old TTL index dropped');
    }

    console.log('🔨 Creating standard TTL index...');
    await bookingsCollection.createIndex(
      {
        reservedUntil: 1
      },
      {
        expireAfterSeconds: 0,
        partialFilterExpression: {
          status: 'pending',
          reservedUntil: { $exists: true }
        },
        name: 'ttl_pending_bookings'
      }
    );
    console.log('✅ TTL index created successfully');

    // 4. Verify the fix
    console.log('\n✅ Verification Report:');
    const totalCorporateBookings = await bookingsCollection.countDocuments({
      'corporateBooking.corporateCompanyId': { $exists: true, $ne: null }
    });

    const corporateWithReservedUntil = await bookingsCollection.countDocuments({
      'corporateBooking.corporateCompanyId': { $exists: true, $ne: null },
      reservedUntil: { $exists: true }
    });

    const pendingCorporate = await bookingsCollection.countDocuments({
      'corporateBooking.corporateCompanyId': { $exists: true, $ne: null },
      status: 'pending'
    });

    console.log(`Total corporate bookings: ${totalCorporateBookings}`);
    console.log(`Corporate bookings with reservedUntil: ${corporateWithReservedUntil}`);
    console.log(`Pending corporate bookings: ${pendingCorporate}`);

    if (corporateWithReservedUntil === 0 && pendingCorporate === 0) {
      console.log('\n✅ All corporate bookings are now protected from TTL deletion!');
    } else if (corporateWithReservedUntil > 0) {
      console.log('\n⚠️  Warning: Some corporate bookings still have reservedUntil field');
    } else if (pendingCorporate > 0) {
      console.log('\n⚠️  Warning: Some corporate bookings are still pending');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('Corporate bookings are now protected from automatic deletion.');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the migration
fixCorporateBookings().catch(console.error);