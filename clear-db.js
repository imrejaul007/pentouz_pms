import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('🔗 Connected to MongoDB');
    await mongoose.connection.db.dropDatabase();
    console.log('🗑️  Database cleared');
    await mongoose.disconnect();
    console.log('✅ Database reset complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
};

connectDB();