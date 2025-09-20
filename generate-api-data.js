import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import APIMetrics from './src/models/APIMetrics.js';
import APIKey from './src/models/APIKey.js';
import WebhookEndpoint from './src/models/WebhookEndpoint.js';
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';

// Helper function to generate API key
function generateAPIKey(type, environment = 'sandbox') {
  const prefix = `${type === 'admin' ? 'ak' : type === 'write' ? 'wk' : 'rk'}_${environment === 'production' ? 'live' : 'test'}`;
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `${prefix}_${randomBytes}`;
}

// Helper function to hash API key
async function hashAPIKey(key) {
  return await bcrypt.hash(key, 12);
}

// Helper function to generate webhook secret
function generateWebhookSecret() {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

async function generateAPIData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect('mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0');
    console.log('✅ Connected to MongoDB');

    // Get a hotel ID
    const hotel = await Hotel.findOne();
    if (!hotel) {
      console.log('❌ No hotel found. Please run the seed script first.');
      return;
    }

    const hotelId = hotel._id;
    console.log(`🏨 Using hotel: ${hotel.name} (${hotelId})`);

    // Get a user ID
    const user = await User.findOne();
    if (!user) {
      console.log('❌ No user found. Please run the seed script first.');
      return;
    }

    const userId = user._id;
    console.log(`👤 Using user: ${user.name} (${userId})`);

    // Clear existing API data
    console.log('🧹 Clearing existing API data...');
    await APIMetrics.deleteMany({ hotelId });
    await APIKey.deleteMany({ hotelId });
    await WebhookEndpoint.deleteMany({ hotelId });

    // Generate sample API keys
    console.log('🔑 Creating sample API keys...');
    const apiKeys = [];
    
    // Create API keys one by one with manual key generation
    const keyId1 = generateAPIKey('read', 'sandbox');
    const keyHash1 = await hashAPIKey(keyId1);
    const keyPrefix1 = keyId1.substring(0, keyId1.lastIndexOf('_'));
    
    const key1 = new APIKey({
      name: 'Frontend App Key',
      description: 'API key for frontend application',
      keyId: keyId1,
      keyHash: keyHash1,
      keyPrefix: keyPrefix1,
      hotelId,
      createdBy: userId,
      type: 'read',
      permissions: [
        { resource: 'bookings', actions: ['read'] },
        { resource: 'rooms', actions: ['read'] },
        { resource: 'guests', actions: ['read'] }
      ],
      rateLimit: { 
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000
      },
      isActive: true,
      usage: {
        totalRequests: 15420,
        lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      }
    });
    await key1.save();
    apiKeys.push(key1);

    const keyId2 = generateAPIKey('write', 'sandbox');
    const keyHash2 = await hashAPIKey(keyId2);
    const keyPrefix2 = keyId2.substring(0, keyId2.lastIndexOf('_'));
    
    const key2 = new APIKey({
      name: 'Mobile App Key',
      description: 'API key for mobile application',
      keyId: keyId2,
      keyHash: keyHash2,
      keyPrefix: keyPrefix2,
      hotelId,
      createdBy: userId,
      type: 'write',
      permissions: [
        { resource: 'bookings', actions: ['create', 'read', 'update'] },
        { resource: 'rooms', actions: ['read'] },
        { resource: 'guests', actions: ['create', 'read', 'update'] }
      ],
      rateLimit: { 
        requestsPerMinute: 30,
        requestsPerHour: 500,
        requestsPerDay: 5000
      },
      isActive: true,
      usage: {
        totalRequests: 8930,
        lastUsed: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      }
    });
    await key2.save();
    apiKeys.push(key2);

    const keyId3 = generateAPIKey('admin', 'sandbox');
    const keyHash3 = await hashAPIKey(keyId3);
    const keyPrefix3 = keyId3.substring(0, keyId3.lastIndexOf('_'));
    
    const key3 = new APIKey({
      name: 'Admin Dashboard Key',
      description: 'API key for admin dashboard',
      keyId: keyId3,
      keyHash: keyHash3,
      keyPrefix: keyPrefix3,
      hotelId,
      createdBy: userId,
      type: 'admin',
      permissions: [
        { resource: 'bookings', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'rooms', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'guests', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'payments', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'reports', actions: ['read'] }
      ],
      rateLimit: { 
        requestsPerMinute: 120,
        requestsPerHour: 2000,
        requestsPerDay: 20000
      },
      isActive: true,
      usage: {
        totalRequests: 25680,
        lastUsed: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
      }
    });
    await key3.save();
    apiKeys.push(key3);

    console.log(`✅ Created ${apiKeys.length} API keys`);

    // Generate sample webhooks
    console.log('🔗 Creating sample webhooks...');
    const webhooks = [];
    
    const webhook1 = new WebhookEndpoint({
      name: 'Booking Notifications',
      description: 'Webhook for booking events',
      url: 'https://example.com/webhooks/booking',
      secret: generateWebhookSecret(),
      hotelId,
      createdBy: userId,
      events: ['booking.created', 'booking.updated', 'booking.cancelled'],
      httpConfig: {
        method: 'POST',
        headers: new Map([['Content-Type', 'application/json']]),
        timeout: 5000,
        contentType: 'application/json'
      },
      retryPolicy: {
        enabled: true,
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000,
        maxDelay: 60000,
        retryOn: ['timeout', 'connection_error', '5xx']
      },
      isActive: true,
      stats: {
        totalDeliveries: 1250,
        successfulDeliveries: 1180,
        failedDeliveries: 70,
        lastDelivery: {
          attempt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          success: true,
          statusCode: 200,
          responseTime: 450
        },
        averageResponseTime: 450
      },
      health: {
        status: 'healthy',
        lastHealthCheck: new Date(),
        consecutiveFailures: 0,
        uptime: 94.4
      }
    });
    await webhook1.save();
    webhooks.push(webhook1);

    const webhook2 = new WebhookEndpoint({
      name: 'Payment Webhook',
      description: 'Webhook for payment events',
      url: 'https://payment.example.com/webhook',
      secret: generateWebhookSecret(),
      hotelId,
      createdBy: userId,
      events: ['payment.completed', 'payment.failed'],
      httpConfig: {
        method: 'POST',
        headers: new Map([['Content-Type', 'application/json']]),
        timeout: 3000,
        contentType: 'application/json'
      },
      retryPolicy: {
        enabled: true,
        maxRetries: 5,
        backoffMultiplier: 1.5,
        initialDelay: 500,
        maxDelay: 30000,
        retryOn: ['timeout', 'connection_error', '5xx', '4xx']
      },
      isActive: true,
      stats: {
        totalDeliveries: 890,
        successfulDeliveries: 845,
        failedDeliveries: 45,
        lastDelivery: {
          attempt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          success: true,
          statusCode: 200,
          responseTime: 320
        },
        averageResponseTime: 320
      },
      health: {
        status: 'healthy',
        lastHealthCheck: new Date(),
        consecutiveFailures: 0,
        uptime: 94.9
      }
    });
    await webhook2.save();
    webhooks.push(webhook2);

    console.log(`✅ Created ${webhooks.length} webhooks`);

    // Generate sample API metrics for the last 24 hours
    console.log('📊 Generating API metrics...');
    const now = new Date();
    const metrics = [];

    // Sample endpoints
    const endpoints = [
      { method: 'GET', path: '/api/v1/bookings', category: 'reservations' },
      { method: 'POST', path: '/api/v1/bookings', category: 'reservations' },
      { method: 'GET', path: '/api/v1/rooms', category: 'rooms' },
      { method: 'PUT', path: '/api/v1/rooms/:id', category: 'rooms' },
      { method: 'GET', path: '/api/v1/guests', category: 'guests' },
      { method: 'POST', path: '/api/v1/guests', category: 'guests' },
      { method: 'GET', path: '/api/v1/payments', category: 'payments' },
      { method: 'POST', path: '/api/v1/payments', category: 'payments' },
      { method: 'GET', path: '/api/v1/inventory', category: 'inventory' },
      { method: 'GET', path: '/api/v1/reports', category: 'reports' }
    ];

    // Generate hourly metrics for the last 24 hours
    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(now.getTime() - hour * 60 * 60 * 1000);
      
      for (const endpoint of endpoints) {
        const baseRequests = Math.floor(Math.random() * 100) + 20;
        const errorRate = Math.random() * 0.05; // 0-5% error rate
        const errors = Math.floor(baseRequests * errorRate);
        const successful = baseRequests - errors;
        const responseTime = Math.floor(Math.random() * 200) + 100; // 100-300ms

        metrics.push({
          hotelId,
          period: 'hour',
          timestamp,
          endpoint,
          requests: {
            total: baseRequests,
            successful,
            failed: errors,
            byStatusCode: {
              200: successful,
              400: Math.floor(errors * 0.3),
              401: Math.floor(errors * 0.2),
              404: Math.floor(errors * 0.2),
              500: Math.floor(errors * 0.3)
            }
          },
          performance: {
            averageResponseTime: responseTime,
            minResponseTime: responseTime - 50,
            maxResponseTime: responseTime + 100,
            p50ResponseTime: responseTime,
            p95ResponseTime: responseTime + 80,
            p99ResponseTime: responseTime + 150
          },
          errors: {
            total: errors,
            byType: {
              validation: Math.floor(errors * 0.4),
              authentication: Math.floor(errors * 0.3),
              server_error: Math.floor(errors * 0.3)
            }
          },
          apiKeyUsage: {
            keyRequests: {
              [apiKeys[0]._id.toString()]: Math.floor(baseRequests * 0.4),
              [apiKeys[1]._id.toString()]: Math.floor(baseRequests * 0.3),
              [apiKeys[2]._id.toString()]: Math.floor(baseRequests * 0.3)
            },
            byKeyType: {
              read: Math.floor(baseRequests * 0.4),
              write: Math.floor(baseRequests * 0.3),
              admin: Math.floor(baseRequests * 0.3)
            }
          },
          users: {
            total: Math.floor(Math.random() * 20) + 5,
            authenticated: Math.floor(Math.random() * 15) + 3,
            anonymous: Math.floor(Math.random() * 10) + 2,
            byRole: {
              admin: Math.floor(Math.random() * 3) + 1,
              manager: Math.floor(Math.random() * 5) + 2,
              staff: Math.floor(Math.random() * 10) + 3
            }
          },
          bandwidth: {
            totalBytes: baseRequests * (Math.floor(Math.random() * 5000) + 1000),
            requestBytes: baseRequests * (Math.floor(Math.random() * 2000) + 500),
            responseBytes: baseRequests * (Math.floor(Math.random() * 3000) + 500)
          },
          security: {
            suspiciousActivities: Math.floor(Math.random() * 2),
            authFailures: Math.floor(errors * 0.2),
            blockedRequests: Math.floor(Math.random() * 3)
          }
        });
      }
    }

    // Insert metrics in batches
    const batchSize = 100;
    for (let i = 0; i < metrics.length; i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);
      await APIMetrics.insertMany(batch);
    }

    console.log(`✅ Generated ${metrics.length} API metrics`);

    // Calculate totals for dashboard
    const totalRequests = metrics.reduce((sum, m) => sum + m.requests.total, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.errors.total, 0);
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.performance.averageResponseTime, 0) / metrics.length;

    console.log('\n📈 Generated Data Summary:');
    console.log(`   Total Requests: ${totalRequests.toLocaleString()}`);
    console.log(`   Total Errors: ${totalErrors.toLocaleString()}`);
    console.log(`   Error Rate: ${((totalErrors / totalRequests) * 100).toFixed(2)}%`);
    console.log(`   Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`   API Keys: ${apiKeys.length}`);
    console.log(`   Webhooks: ${webhooks.length}`);

    console.log('\n🎉 API data generation completed!');
    console.log('💡 Refresh the API Management page to see the real data.');

  } catch (error) {
    console.error('❌ Error generating API data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

generateAPIData();
