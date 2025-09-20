import mongoose from 'mongoose';
import express from 'express';
import billingHistoryRouter from './src/routes/billingHistory.js';
import { authenticate } from './src/middleware/auth.js';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

const app = express();
app.use(express.json());

// Mock authentication middleware for testing
app.use('/api/billing-history', (req, res, next) => {
  // Mock a guest user for testing
  req.user = {
    _id: new mongoose.Types.ObjectId(),
    role: 'guest',
    email: 'test@guest.com'
  };
  next();
}, billingHistoryRouter);

async function testBillingAPI() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const server = app.listen(3001, () => {
      console.log('Test server running on port 3001');
    });

    // Make test request
    const response = await fetch('http://localhost:3001/api/billing-history?type=all&limit=5');
    const data = await response.json();
    
    console.log('\n=== API Response ===');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));

    server.close();
    await mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testBillingAPI();