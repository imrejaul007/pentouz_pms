import mongoose from 'mongoose';
import APIMetrics from './src/models/APIMetrics.js';
import 'dotenv/config';

async function checkMetrics() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const count = await APIMetrics.countDocuments();
    console.log('Total API Metrics:', count);

    if (count > 0) {
      const recent = await APIMetrics.find({}).sort({ timestamp: -1 }).limit(5);
      console.log('Recent metrics:', recent.map(m => ({
        id: m._id,
        timestamp: m.timestamp,
        endpoint: m.endpoint,
        requests: m.requests.total
      })));
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkMetrics();