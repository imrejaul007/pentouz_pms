import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabaseStatus() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('\n📊 Collections in database:');

    let totalDocuments = 0;
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`   ${collection.name}: ${count} documents`);
      totalDocuments += count;
    }

    console.log(`\n📈 Total documents: ${totalDocuments}`);

    // Check specific collections for TapeChart
    const hotelCount = await db.collection('hotels').countDocuments();
    const roomCount = await db.collection('rooms').countDocuments();
    const bookingCount = await db.collection('bookings').countDocuments();
    const userCount = await db.collection('users').countDocuments();

    console.log('\n🏨 Key Collections:');
    console.log(`   Hotels: ${hotelCount}`);
    console.log(`   Rooms: ${roomCount}`);
    console.log(`   Bookings: ${bookingCount}`);
    console.log(`   Users: ${userCount}`);

    if (hotelCount > 0 && roomCount > 0) {
      console.log('\n✅ Database appears to be seeded with basic data');
    } else {
      console.log('\n⚠️  Database may need initial seeding');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkDatabaseStatus();