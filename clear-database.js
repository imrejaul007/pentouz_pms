import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function clearDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected successfully');

    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`Found ${collections.length} collections`);

    // Drop all collections
    for (const collection of collections) {
      const collectionName = collection.name;
      console.log(`Dropping collection: ${collectionName}`);
      await mongoose.connection.db.collection(collectionName).drop();
    }

    console.log('✅ Database cleared successfully');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

clearDatabase();