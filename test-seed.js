import mongoose from 'mongoose';

console.log('Starting test...');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const testConnection = async () => {
  try {
    console.log('Testing database connection...');
    await connectDB();
    console.log('Connection test successful!');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
};

testConnection();
