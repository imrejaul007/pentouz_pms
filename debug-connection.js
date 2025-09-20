import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function debugConnection() {
  try {
    console.log('🔗 Connection URI:', process.env.MONGO_URI.replace(/\/\/([^:]+:[^@]+)@/, '//(credentials)@'));

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get database name
    const dbName = mongoose.connection.db.databaseName;
    console.log('📊 Database Name:', dbName);

    // List all collections with document counts
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log(`\n📚 Collections in database "${dbName}":`);
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`   ${collection.name}: ${count} documents`);
    }

    // Check specifically for bookings collection
    const bookingsExists = collections.some(c => c.name === 'bookings');
    console.log(`\n🔍 Bookings collection exists: ${bookingsExists}`);

    if (bookingsExists) {
      const bookingsCount = await db.collection('bookings').countDocuments();
      console.log(`📊 Bookings count: ${bookingsCount}`);

      if (bookingsCount > 0) {
        const sampleBooking = await db.collection('bookings').findOne();
        console.log('\n📋 Sample booking structure:');
        console.log(JSON.stringify(sampleBooking, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

debugConnection();