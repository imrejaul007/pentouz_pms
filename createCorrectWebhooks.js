import mongoose from 'mongoose';
import WebhookEndpoint from './src/models/WebhookEndpoint.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';
import crypto from 'crypto';
import 'dotenv/config';

async function createCorrectWebhooks() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const hotel = await Hotel.findOne().select('_id');
    const adminUser = await User.findOne({ role: 'admin' }).select('_id');

    console.log('🔗 Creating webhook endpoints with valid events...');

    // Webhooks with valid event types from the enum
    const webhookConfigs = [
      {
        name: 'Payment Processing System',
        url: 'https://payments.stripe.com/webhooks/hotel',
        events: ['payment.completed', 'payment.failed', 'payment.refunded'],
        desc: 'Webhook for payment processing events'
      },
      {
        name: 'Channel Manager Integration',
        url: 'https://channelmanager.booking.com/webhook/inventory',
        events: ['room.availability_changed', 'rate.updated', 'booking.created'],
        desc: 'Webhook for OTA channel synchronization'
      },
      {
        name: 'Guest Service Platform',
        url: 'https://notifications.hotel.com/webhook/guest-events',
        events: ['guest.created', 'guest.checked_in', 'guest.checked_out'],
        desc: 'Webhook for guest lifecycle events'
      },
      {
        name: 'Housekeeping Management',
        url: 'https://housekeeping.app.com/webhook/room-status',
        events: ['room.cleaned', 'room.status_changed', 'room.maintenance_scheduled'],
        desc: 'Webhook for housekeeping and room status updates'
      },
      {
        name: 'Revenue Management System',
        url: 'https://revenue.analytics.com/webhook/pricing',
        events: ['rate.updated', 'rate.created', 'booking.confirmed'],
        desc: 'Webhook for revenue management and pricing'
      },
      {
        name: 'System Monitoring',
        url: 'https://monitoring.hotel.com/webhook/system-events',
        events: ['system.error_occurred', 'system.backup_completed', 'system.maintenance_started'],
        desc: 'Webhook for system monitoring and alerts'
      },
      {
        name: 'Booking Lifecycle Manager',
        url: 'https://booking-manager.hotel.com/webhook/lifecycle',
        events: ['booking.created', 'booking.updated', 'booking.cancelled', 'booking.no_show'],
        desc: 'Webhook for complete booking lifecycle management'
      },
      {
        name: 'Customer Communication Platform',
        url: 'https://communications.hotel.com/webhook/customer-events',
        events: ['booking.confirmed', 'guest.checked_in', 'payment.completed'],
        desc: 'Webhook for customer communication and notifications'
      }
    ];

    let created = 0;
    let skipped = 0;

    for (const config of webhookConfigs) {
      try {
        await WebhookEndpoint.create({
          name: config.name,
          url: config.url,
          events: config.events,
          hotelId: hotel._id,
          createdBy: adminUser._id,
          isActive: Math.random() > 0.1, // 90% active
          description: config.desc,
          secret: crypto.randomBytes(16).toString('hex'),
          retryAttempts: 3,
          timeout: 30000
        });
        console.log(`✅ Created webhook: ${config.name}`);
        created++;
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⚠️ Skipped duplicate: ${config.name}`);
          skipped++;
        } else {
          console.error(`❌ Error creating ${config.name}:`, error.message);
        }
      }
    }

    await mongoose.disconnect();
    console.log(`🎉 Webhook creation completed! Created: ${created}, Skipped: ${skipped}`);

  } catch (error) {
    console.error('❌ Webhook creation failed:', error.message);
  }
}

createCorrectWebhooks();