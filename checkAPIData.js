import mongoose from 'mongoose';
import APIKey from './src/models/APIKey.js';
import WebhookEndpoint from './src/models/WebhookEndpoint.js';
import 'dotenv/config';

async function checkExisting() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const apiKeys = await APIKey.find({});
    console.log(`\n📋 Existing API Keys (${apiKeys.length}):`);
    apiKeys.forEach(key => {
      console.log(`- Type: ${key.type} | KeyID: ${key.keyId.substring(0, 20)}... | Hotel: ${key.hotelId} | Status: ${key.isActive ? 'Active' : 'Inactive'}`);
    });

    const webhooks = await WebhookEndpoint.find({});
    console.log(`\n🔗 Existing Webhooks (${webhooks.length}):`);
    if (webhooks.length > 0) {
      webhooks.forEach(wh => {
        console.log(`- URL: ${wh.url} | Events: ${wh.events.length} | Status: ${wh.isActive ? 'Active' : 'Inactive'}`);
      });
    } else {
      console.log('No webhooks found');
    }

    await mongoose.disconnect();
    console.log('\n✅ Check completed');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkExisting();