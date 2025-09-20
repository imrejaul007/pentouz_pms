import mongoose from 'mongoose';
import APIMetrics from './src/models/APIMetrics.js';
import APIKey from './src/models/APIKey.js';
import Hotel from './src/models/Hotel.js';
import endpointRegistryService from './src/services/endpointRegistryService.js';
import 'dotenv/config';

async function testInit() {
  try {
    console.log('🚀 Starting test initialization...');

    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get existing data
    const hotels = await Hotel.find({}).select('_id name');
    const apiKeys = await APIKey.find({}).select('_id keyId type hotelId');
    console.log(`✅ Found ${hotels.length} hotels, ${apiKeys.length} API keys`);

    // Get endpoint catalog
    console.log('🔍 Scanning routes...');
    await endpointRegistryService.scanRoutes();
    const endpoints = endpointRegistryService.getAllEndpoints();
    console.log(`✅ Found ${endpoints.length} endpoints`);

    // Test one metric creation
    console.log('📊 Testing metric creation...');
    const testMetric = {
      hotelId: hotels[0]._id,
      period: 'hour',
      timestamp: new Date(),
      endpoint: {
        method: 'GET',
        path: '/api/v1/test',
        category: 'Test'
      },
      requests: {
        total: 10,
        successful: 9,
        failed: 1,
        byStatusCode: { '200': 9, '500': 1 }
      },
      performance: {
        averageResponseTime: 150,
        minResponseTime: 50,
        maxResponseTime: 300,
        p50ResponseTime: 120,
        p95ResponseTime: 250,
        p99ResponseTime: 290,
        responseTimes: [50, 100, 150, 200, 300]
      },
      errors: {
        total: 1,
        byType: { 'server': 1 }
      },
      apiKeyUsage: {
        totalKeys: 1,
        byKeyType: { 'read': 5 }
      },
      users: {
        total: 5,
        authenticated: 4,
        anonymous: 1,
        byRole: { 'guest': 3, 'staff': 1, 'admin': 0 }
      },
      geographic: {
        countries: { 'US': 8, 'UK': 2 },
        regions: {}
      },
      bandwidth: {
        totalBytes: 5120,
        requestBytes: 1024,
        responseBytes: 4096,
        averageRequestSize: 102,
        averageResponseSize: 410
      },
      security: {
        suspiciousActivities: 0,
        blockedRequests: 0,
        authFailures: 0
      }
    };

    const savedMetric = await APIMetrics.create(testMetric);
    console.log('✅ Test metric created:', savedMetric._id);

    await mongoose.disconnect();
    console.log('✅ Test completed successfully');

  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

testInit();