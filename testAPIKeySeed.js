import mongoose from 'mongoose';
import APIKey from './src/models/APIKey.js';
import WebhookEndpoint from './src/models/WebhookEndpoint.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

async function testSeed() {
  try {
    console.log('🚀 Testing API key and webhook creation...');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const hotel = await Hotel.findOne().select('_id');
    const adminUser = await User.findOne({ role: 'admin' }).select('_id');

    console.log(`✅ Hotel ID: ${hotel._id}`);
    console.log(`✅ Admin User ID: ${adminUser._id}`);

    // Test creating one API key
    const keyId = `rk_test_${crypto.randomBytes(16).toString('hex')}`;
    const keyHash = await bcrypt.hash(keyId, 10);

    console.log('📝 Creating test API key...');
    const newAPIKey = await APIKey.create({
      keyId,
      keyHash,
      keyPrefix: 'rk_test_',
      name: 'Test Mobile App Key',
      type: 'read',
      hotelId: hotel._id,
      createdBy: adminUser._id,
      isActive: true,
      description: 'Test API key for mobile app'
    });

    console.log(`✅ Created API key: ${newAPIKey._id}`);

    // Test creating one webhook
    console.log('📝 Creating test webhook...');
    const newWebhook = await WebhookEndpoint.create({
      name: 'Test Booking Webhook',
      url: 'https://test.example.com/webhook',
      events: ['booking.created', 'booking.updated'],
      hotelId: hotel._id,
      createdBy: adminUser._id,
      isActive: true,
      description: 'Test webhook for booking events',
      secret: crypto.randomBytes(16).toString('hex')
    });

    console.log(`✅ Created webhook: ${newWebhook._id}`);

    await mongoose.disconnect();
    console.log('✅ Test completed successfully');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  }
}

testSeed();