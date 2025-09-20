import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function completeReset() {
  try {
    console.log('🔄 Starting complete database reset...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // Drop the entire database
    console.log('💥 Dropping entire database...');
    await mongoose.connection.db.dropDatabase();
    console.log('✓ Database dropped successfully');

    console.log('🎯 Creating fresh database...');
    // Disconnect and reconnect to ensure clean state
    await mongoose.disconnect();
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Fresh database connection established');

    console.log('🎉 Complete reset successful! Database is now empty and ready for seeding.');
    await mongoose.disconnect();
    console.log('✓ Disconnected');

  } catch (error) {
    console.error('❌ Reset failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

completeReset();