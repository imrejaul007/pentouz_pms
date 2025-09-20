import mongoose from 'mongoose';
import APIKey from './src/models/APIKey.js';
import WebhookEndpoint from './src/models/WebhookEndpoint.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

async function createBulkAPIData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const hotel = await Hotel.findOne().select('_id');
    const adminUser = await User.findOne({ role: 'admin' }).select('_id');

    console.log('🔑 Creating enhanced API keys...');

    // API Keys
    const keyConfigs = [
      { name: 'Mobile App API Key', type: 'read', desc: 'API key for mobile application' },
      { name: 'POS Integration Key', type: 'write', desc: 'API key for Point of Sale system' },
      { name: 'Channel Manager Key', type: 'write', desc: 'API key for channel manager' },
      { name: 'Analytics Dashboard Key', type: 'read', desc: 'API key for analytics dashboard' },
      { name: 'Guest Portal Key', type: 'read', desc: 'API key for guest portal' },
      { name: 'Housekeeping App Key', type: 'write', desc: 'API key for housekeeping app' },
      { name: 'Third-party Integrations', type: 'admin', desc: 'API key for integrations' }
    ];

    for (const config of keyConfigs) {
      const prefix = config.type === 'read' ? 'rk_' : config.type === 'write' ? 'wk_' : 'ak_';
      const keyId = `${prefix}test_${crypto.randomBytes(16).toString('hex')}`;
      const keyHash = await bcrypt.hash(keyId, 10);

      try {
        await APIKey.create({
          keyId,
          keyHash,
          keyPrefix: `${prefix}test_`,
          name: config.name,
          type: config.type,
          hotelId: hotel._id,
          createdBy: adminUser._id,
          isActive: true,
          description: config.desc
        });
        console.log(`✅ Created API key: ${config.name}`);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⚠️ Skipped duplicate: ${config.name}`);
        } else {
          console.error(`❌ Error creating ${config.name}:`, error.message);
        }
      }
    }

    console.log('🔗 Creating webhook endpoints...');

    // Webhooks
    const webhookConfigs = [
      { name: 'Booking Events Webhook', url: 'https://api.thirdparty.com/webhooks/bookings', events: ['booking.created', 'booking.updated'] },
      { name: 'Payment Processing Webhook', url: 'https://payments.stripe.com/webhooks/hotel', events: ['payment.succeeded', 'payment.failed'] },
      { name: 'Channel Manager Webhook', url: 'https://channelmanager.booking.com/webhook/inventory', events: ['room.availability_updated', 'rate.updated'] },
      { name: 'Guest Service Requests', url: 'https://notifications.hotel.com/webhook/guest-requests', events: ['service.requested', 'service.completed'] },
      { name: 'Housekeeping Notifications', url: 'https://housekeeping.app.com/webhook/status', events: ['room.cleaned', 'room.inspected'] },
      { name: 'Revenue Management Alerts', url: 'https://revenue.analytics.com/webhook/pricing', events: ['rate.changed', 'occupancy.threshold'] },
      { name: 'Security Monitoring', url: 'https://security.monitor.com/webhook/incidents', events: ['security.breach', 'login.suspicious'] }
    ];

    for (const config of webhookConfigs) {
      try {
        await WebhookEndpoint.create({
          name: config.name,
          url: config.url,
          events: config.events,
          hotelId: hotel._id,
          createdBy: adminUser._id,
          isActive: true,
          description: `Webhook for ${config.name.toLowerCase()}`,
          secret: crypto.randomBytes(16).toString('hex')
        });
        console.log(`✅ Created webhook: ${config.name}`);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⚠️ Skipped duplicate: ${config.name}`);
        } else {
          console.error(`❌ Error creating ${config.name}:`, error.message);
        }
      }
    }

    await mongoose.disconnect();
    console.log('🎉 Bulk API data creation completed!');

  } catch (error) {
    console.error('❌ Bulk creation failed:', error.message);
  }
}

createBulkAPIData();