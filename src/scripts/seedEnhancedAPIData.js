import mongoose from 'mongoose';
import APIKey from '../models/APIKey.js';
import WebhookEndpoint from '../models/WebhookEndpoint.js';
import Hotel from '../models/Hotel.js';
import User from '../models/User.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';
import 'dotenv/config';

/**
 * Enhanced API Data Seed Script
 * Adds more diverse API keys and comprehensive webhook endpoints
 */
class EnhancedAPIDataSeeder {
  constructor() {
    this.hotels = [];
    this.adminUser = null;
  }

  async initialize() {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      logger.info('Connected to MongoDB for enhanced API data seeding');
      console.log('✅ Connected to MongoDB for enhanced API data seeding');

      this.hotels = await Hotel.find({}).select('_id name');
      this.adminUser = await User.findOne({ role: 'admin' }).select('_id');

      console.log(`✅ Found ${this.hotels.length} hotels`);
      console.log(`✅ Using admin user: ${this.adminUser._id}`);

    } catch (error) {
      logger.error('Failed to initialize enhanced API data seeder:', error);
      throw error;
    }
  }

  async seedEnhancedAPIKeys() {
    try {
      console.log('🔑 Creating enhanced API keys...');

      const hotelId = this.hotels[0]._id;
      const apiKeysToCreate = [];

      // Create diverse API keys for different purposes
      const keyConfigs = [
        {
          name: 'Mobile App API Key',
          type: 'read',
          description: 'API key for mobile application read access',
          permissions: ['bookings:read', 'rooms:read', 'guests:read'],
          rateLimit: 1000
        },
        {
          name: 'POS Integration Key',
          type: 'write',
          description: 'API key for Point of Sale system integration',
          permissions: ['pos:read', 'pos:write', 'payments:write'],
          rateLimit: 500
        },
        {
          name: 'Channel Manager Key',
          type: 'write',
          description: 'API key for channel manager (Booking.com, etc.)',
          permissions: ['bookings:write', 'rooms:read', 'availability:write'],
          rateLimit: 2000
        },
        {
          name: 'Analytics Dashboard Key',
          type: 'read',
          description: 'API key for analytics and reporting dashboard',
          permissions: ['analytics:read', 'reports:read', 'metrics:read'],
          rateLimit: 100
        },
        {
          name: 'Guest Portal Key',
          type: 'read',
          description: 'API key for guest self-service portal',
          permissions: ['bookings:read', 'services:read', 'notifications:read'],
          rateLimit: 800
        },
        {
          name: 'Housekeeping App Key',
          type: 'write',
          description: 'API key for housekeeping mobile application',
          permissions: ['housekeeping:read', 'housekeeping:write', 'rooms:read'],
          rateLimit: 300
        },
        {
          name: 'Third-party Integrations',
          type: 'admin',
          description: 'API key for third-party system integrations',
          permissions: ['*'],
          rateLimit: 1500
        }
      ];

      for (const config of keyConfigs) {
        const keyId = this.generateAPIKey(config.type);
        const keyHash = await bcrypt.hash(keyId, 10);

        apiKeysToCreate.push({
          keyId,
          keyHash,
          keyPrefix: keyId.split('_').slice(0, 2).join('_') + '_',
          name: config.name,
          type: config.type,
          hotelId,
          createdBy: this.adminUser._id,
          isActive: true,
          description: config.description,
          permissions: config.permissions,
          rateLimit: config.rateLimit,
          usageCount: Math.floor(Math.random() * 10000),
          lastUsed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        });
      }

      const existingCount = await APIKey.countDocuments();
      await APIKey.insertMany(apiKeysToCreate, { ordered: false });

      console.log(`✅ Created ${apiKeysToCreate.length} new API keys (total: ${existingCount + apiKeysToCreate.length})`);

    } catch (error) {
      if (error.code === 11000) {
        console.log('⚠️ Some API keys already exist, skipping duplicates');
      } else {
        logger.error('Error creating enhanced API keys:', error);
        throw error;
      }
    }
  }

  async seedComprehensiveWebhooks() {
    try {
      console.log('🔗 Creating comprehensive webhook endpoints...');

      const hotelId = this.hotels[0]._id;
      const webhooksToCreate = [];

      // Define comprehensive webhook configurations
      const webhookConfigs = [
        {
          name: 'Booking Events Webhook',
          url: 'https://api.thirdparty.com/webhooks/bookings',
          events: ['booking.created', 'booking.updated', 'booking.cancelled', 'booking.confirmed'],
          description: 'Webhook for all booking-related events'
        },
        {
          name: 'Payment Processing Webhook',
          url: 'https://payments.stripe.com/webhooks/hotel',
          events: ['payment.succeeded', 'payment.failed', 'payment.refunded'],
          description: 'Webhook for payment processing events',
          secret: crypto.randomBytes(32).toString('hex')
        },
        {
          name: 'Channel Manager Webhook',
          url: 'https://channelmanager.booking.com/webhook/inventory',
          events: ['room.availability_updated', 'rate.updated', 'booking.from_ota'],
          description: 'Webhook for channel manager synchronization'
        },
        {
          name: 'Guest Service Requests',
          url: 'https://notifications.hotel.com/webhook/guest-requests',
          events: ['service.requested', 'service.completed', 'maintenance.requested'],
          description: 'Webhook for guest service and maintenance requests'
        },
        {
          name: 'Housekeeping Notifications',
          url: 'https://housekeeping.app.com/webhook/status',
          events: ['room.cleaned', 'room.inspected', 'inventory.low'],
          description: 'Webhook for housekeeping status updates'
        },
        {
          name: 'Revenue Management Alerts',
          url: 'https://revenue.analytics.com/webhook/pricing',
          events: ['rate.changed', 'occupancy.threshold', 'revenue.milestone'],
          description: 'Webhook for revenue management and pricing alerts'
        },
        {
          name: 'Security Monitoring',
          url: 'https://security.monitor.com/webhook/incidents',
          events: ['security.breach', 'login.suspicious', 'access.denied'],
          description: 'Webhook for security monitoring and incidents'
        },
        {
          name: 'Analytics Data Pipeline',
          url: 'https://analytics.datawarehouse.com/webhook/events',
          events: ['guest.checkin', 'guest.checkout', 'transaction.completed'],
          description: 'Webhook for analytics data pipeline'
        },
        {
          name: 'SMS Notification Service',
          url: 'https://sms.service.com/webhook/hotel-notifications',
          events: ['booking.reminder', 'checkin.ready', 'checkout.reminder'],
          description: 'Webhook for SMS notification service'
        },
        {
          name: 'Email Marketing Platform',
          url: 'https://email.marketing.com/webhook/guest-lifecycle',
          events: ['guest.registered', 'stay.completed', 'feedback.received'],
          description: 'Webhook for email marketing automation'
        }
      ];

      for (const config of webhookConfigs) {
        webhooksToCreate.push({
          name: config.name,
          url: config.url,
          events: config.events,
          hotelId,
          createdBy: this.adminUser._id,
          isActive: Math.random() > 0.1, // 90% active
          description: config.description,
          secret: config.secret || crypto.randomBytes(16).toString('hex'),
          retryAttempts: 3,
          timeout: 30000,
          deliveryCount: Math.floor(Math.random() * 5000),
          failureCount: Math.floor(Math.random() * 50),
          lastDelivery: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'THE-PENTOUZ-Webhook/1.0',
            'X-Hotel-ID': hotelId.toString()
          }
        });
      }

      const existingCount = await WebhookEndpoint.countDocuments();
      await WebhookEndpoint.insertMany(webhooksToCreate, { ordered: false });

      console.log(`✅ Created ${webhooksToCreate.length} new webhook endpoints (total: ${existingCount + webhooksToCreate.length})`);

    } catch (error) {
      if (error.code === 11000) {
        console.log('⚠️ Some webhook endpoints already exist, skipping duplicates');
      } else {
        logger.error('Error creating comprehensive webhooks:', error);
        throw error;
      }
    }
  }

  generateAPIKey(type) {
    const prefix = type === 'read' ? 'rk_' : type === 'write' ? 'wk_' : 'ak_';
    const env = process.env.NODE_ENV === 'production' ? 'live_' : 'test_';
    const randomKey = crypto.randomBytes(32).toString('hex');
    return `${prefix}${env}${randomKey}`;
  }

  async cleanup() {
    try {
      await mongoose.disconnect();
      logger.info('Disconnected from MongoDB');
      console.log('✅ Disconnected from MongoDB');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
    }
  }
}

// Main execution function
async function main() {
  const seeder = new EnhancedAPIDataSeeder();

  try {
    await seeder.initialize();

    console.log('\n🚀 Phase 4A: Enhancing API Keys...');
    await seeder.seedEnhancedAPIKeys();

    console.log('\n🚀 Phase 4B: Creating Comprehensive Webhooks...');
    await seeder.seedComprehensiveWebhooks();

    console.log('\n✅ Enhanced API data seeding completed successfully');
    logger.info('Enhanced API data seeding completed successfully');

  } catch (error) {
    console.error('❌ Enhanced API data seeding failed:', error.message);
    logger.error('Enhanced API data seeding failed:', error);
    process.exit(1);
  } finally {
    await seeder.cleanup();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default EnhancedAPIDataSeeder;