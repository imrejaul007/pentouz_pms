import mongoose from 'mongoose';
import APIMetrics from '../models/APIMetrics.js';
import APIKey from '../models/APIKey.js';
import Hotel from '../models/Hotel.js';
import endpointRegistryService from '../services/endpointRegistryService.js';
import logger from '../utils/logger.js';
import 'dotenv/config';

/**
 * Historical API Metrics Seed Script
 * Generates 30 days of realistic API usage data for the API Management dashboard
 */
class HistoricalMetricsSeeder {
  constructor() {
    this.startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    this.endDate = new Date();
    this.endpoints = [];
    this.apiKeys = [];
    this.hotels = [];
  }

  async initialize() {
    try {
      // Connect to database
      await mongoose.connect(process.env.MONGO_URI);
      logger.info('Connected to MongoDB for metrics seeding');
      console.log('✅ Connected to MongoDB for metrics seeding');

      // Get existing data
      this.hotels = await Hotel.find({}).select('_id name');
      this.apiKeys = await APIKey.find({}).select('_id keyId type hotelId');

      // Get endpoint catalog
      await endpointRegistryService.scanRoutes();
      this.endpoints = endpointRegistryService.getAllEndpoints();

      logger.info(`Found ${this.hotels.length} hotels, ${this.apiKeys.length} API keys, ${this.endpoints.length} endpoints`);
      console.log(`✅ Found ${this.hotels.length} hotels, ${this.apiKeys.length} API keys, ${this.endpoints.length} endpoints`);

    } catch (error) {
      logger.error('Failed to initialize metrics seeder:', error);
      throw error;
    }
  }

  async generateMetrics() {
    try {
      logger.info('Starting historical metrics generation...');
      console.log('🚀 Starting historical metrics generation...');

      // Clear existing metrics (optional - uncomment if you want fresh data)
      // await APIMetrics.deleteMany({});
      // logger.info('Cleared existing metrics');

      const metricsToInsert = [];
      let dayCount = 0;
      const totalDays = Math.ceil((this.endDate - this.startDate) / (24 * 60 * 60 * 1000));

      // Generate metrics for each day
      for (let date = new Date(this.startDate); date <= this.endDate; date.setDate(date.getDate() + 1)) {
        dayCount++;
        console.log(`📅 Processing day ${dayCount}/${totalDays}: ${date.toDateString()}`);

        const dayMetrics = await this.generateDayMetrics(new Date(date));
        metricsToInsert.push(...dayMetrics);

        // Batch insert every 1000 records for performance
        if (metricsToInsert.length >= 1000) {
          await this.batchInsertMetrics(metricsToInsert);
          metricsToInsert.length = 0; // Clear array
        }
      }

      // Insert remaining metrics
      if (metricsToInsert.length > 0) {
        await this.batchInsertMetrics(metricsToInsert);
      }

      logger.info('Historical metrics generation completed successfully');
      console.log('✅ Historical metrics generation completed successfully');

    } catch (error) {
      logger.error('Error generating historical metrics:', error);
      throw error;
    }
  }

  async generateDayMetrics(date) {
    const dayMetrics = [];

    // Generate different traffic patterns based on day of week
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isMonday = dayOfWeek === 1;

    // Base traffic multiplier
    let trafficMultiplier = 1.0;
    if (isWeekend) trafficMultiplier = 0.6; // Lower weekend traffic
    if (isMonday) trafficMultiplier = 1.4; // Higher Monday traffic

    // Generate hourly metrics for the day
    for (let hour = 0; hour < 24; hour++) {
      const hourlyMetrics = await this.generateHourMetrics(date, hour, trafficMultiplier);
      dayMetrics.push(...hourlyMetrics);
    }

    return dayMetrics;
  }

  async generateHourMetrics(date, hour, trafficMultiplier) {
    const hourMetrics = [];

    // Hour-based traffic patterns (business hours are busier)
    let hourMultiplier = 1.0;
    if (hour >= 9 && hour <= 17) hourMultiplier = 1.5; // Business hours
    if (hour >= 0 && hour <= 6) hourMultiplier = 0.3; // Night hours
    if (hour >= 12 && hour <= 14) hourMultiplier = 1.8; // Lunch peak

    const totalMultiplier = trafficMultiplier * hourMultiplier;

    // Generate metrics for each hotel
    for (const hotel of this.hotels) {
      // Generate metrics for selected endpoints (not all to keep it realistic)
      const selectedEndpoints = this.selectEndpointsForHour(totalMultiplier);

      for (const endpoint of selectedEndpoints) {
        const metric = await this.generateEndpointMetric(
          hotel._id,
          endpoint,
          date,
          hour,
          totalMultiplier
        );
        hourMetrics.push(metric);
      }
    }

    return hourMetrics;
  }

  selectEndpointsForHour(trafficMultiplier) {
    // Select a subset of endpoints based on their typical usage
    const highTrafficEndpoints = this.endpoints.filter(e =>
      e.category === 'Bookings' ||
      e.category === 'Rooms' ||
      e.category === 'Authentication' ||
      e.category === 'Dashboard'
    );

    const mediumTrafficEndpoints = this.endpoints.filter(e =>
      e.category === 'Guests' ||
      e.category === 'Payments' ||
      e.category === 'Inventory' ||
      e.category === 'Reports'
    );

    const lowTrafficEndpoints = this.endpoints.filter(e =>
      e.category === 'API Management' ||
      e.category === 'Administration' ||
      e.category === 'Analytics'
    );

    let selectedEndpoints = [];

    // Always include some high traffic endpoints
    selectedEndpoints.push(...this.randomSelect(highTrafficEndpoints, Math.ceil(5 * trafficMultiplier)));

    // Include medium traffic endpoints based on traffic
    if (trafficMultiplier > 0.8) {
      selectedEndpoints.push(...this.randomSelect(mediumTrafficEndpoints, Math.ceil(3 * trafficMultiplier)));
    }

    // Include low traffic endpoints occasionally
    if (Math.random() < 0.3 * trafficMultiplier) {
      selectedEndpoints.push(...this.randomSelect(lowTrafficEndpoints, 1));
    }

    return selectedEndpoints;
  }

  randomSelect(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, array.length));
  }

  async generateEndpointMetric(hotelId, endpoint, date, hour, trafficMultiplier) {
    // Create timestamp for this hour
    const timestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour);

    // Generate realistic request counts based on endpoint type
    const baseRequests = this.getBaseRequestCount(endpoint);
    const totalRequests = Math.max(1, Math.floor(baseRequests * trafficMultiplier * (0.5 + Math.random())));

    // Generate error rate (realistic percentages)
    const errorRate = this.getErrorRate(endpoint);
    const errors = Math.floor(totalRequests * errorRate);
    const successfulRequests = totalRequests - errors;

    // Generate response times (in milliseconds)
    const avgResponseTime = this.getAverageResponseTime(endpoint);
    const responseTimeVariation = avgResponseTime * 0.3; // 30% variation
    const responseTimes = [];

    for (let i = 0; i < Math.min(totalRequests, 50); i++) { // Limit samples
      const responseTime = Math.max(10,
        avgResponseTime + (Math.random() - 0.5) * 2 * responseTimeVariation
      );
      responseTimes.push(Math.round(responseTime));
    }

    // Generate status code distribution
    const statusCodes = this.generateStatusCodes(totalRequests, errors);

    // Generate API key usage
    const apiKeyUsage = this.generateAPIKeyUsage(hotelId, totalRequests);

    // Generate user metrics
    const userMetrics = this.generateUserMetrics(totalRequests);

    // Generate geographic data
    const geographic = this.generateGeographicData();

    // Generate bandwidth data
    const bandwidth = this.generateBandwidthData(totalRequests, endpoint);

    return {
      hotelId,
      period: 'hour',
      timestamp,
      endpoint: {
        method: endpoint.method,
        path: endpoint.path,
        category: endpoint.category
      },
      requests: {
        total: totalRequests,
        successful: successfulRequests,
        failed: errors,
        byStatusCode: statusCodes
      },
      performance: {
        averageResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) || avgResponseTime,
        minResponseTime: Math.min(...responseTimes) || avgResponseTime * 0.5,
        maxResponseTime: Math.max(...responseTimes) || avgResponseTime * 2,
        p50ResponseTime: this.percentile(responseTimes, 0.5) || avgResponseTime,
        p95ResponseTime: this.percentile(responseTimes, 0.95) || avgResponseTime * 1.5,
        p99ResponseTime: this.percentile(responseTimes, 0.99) || avgResponseTime * 2,
        responseTimes: responseTimes.slice(0, 100) // Limit stored samples
      },
      errors: {
        total: errors,
        byType: this.generateErrorTypes(errors)
      },
      apiKeyUsage,
      users: userMetrics,
      geographic,
      bandwidth,
      security: {
        suspiciousActivities: Math.floor(Math.random() * 3),
        blockedRequests: Math.floor(Math.random() * 2),
        authFailures: Math.floor(errors * 0.3)
      }
    };
  }

  getBaseRequestCount(endpoint) {
    // Different endpoints have different base traffic
    const categoryMultipliers = {
      'Authentication': 50,
      'Bookings': 80,
      'Rooms': 60,
      'Guests': 40,
      'Dashboard': 100,
      'Payments': 25,
      'Reports': 15,
      'Inventory': 30,
      'API Management': 5,
      'Administration': 10
    };

    return categoryMultipliers[endpoint.category] || 20;
  }

  getErrorRate(endpoint) {
    // Different endpoints have different error rates
    const errorRates = {
      'Authentication': 0.05, // 5% - auth failures
      'Payments': 0.08, // 8% - payment failures
      'External API': 0.12, // 12% - external service issues
      'Reports': 0.03, // 3% - usually stable
      'Dashboard': 0.02, // 2% - cached data
    };

    return errorRates[endpoint.category] || 0.04; // 4% default
  }

  getAverageResponseTime(endpoint) {
    // Different endpoints have different response times
    const responseTimes = {
      'Authentication': 150,
      'Dashboard': 80,
      'Bookings': 200,
      'Reports': 800,
      'Payments': 400,
      'Rooms': 120,
      'Guests': 180
    };

    return responseTimes[endpoint.category] || 250;
  }

  generateStatusCodes(totalRequests, errors) {
    const successful = totalRequests - errors;
    const statusCodes = {};

    // 2xx responses (successful)
    statusCodes['200'] = Math.floor(successful * 0.85);
    statusCodes['201'] = Math.floor(successful * 0.15);

    // 4xx responses (client errors)
    statusCodes['400'] = Math.floor(errors * 0.4);
    statusCodes['401'] = Math.floor(errors * 0.3);
    statusCodes['404'] = Math.floor(errors * 0.2);

    // 5xx responses (server errors)
    statusCodes['500'] = Math.floor(errors * 0.1);

    return statusCodes;
  }

  generateAPIKeyUsage(hotelId, totalRequests) {
    const hotelKeys = this.apiKeys.filter(key =>
      key.hotelId && key.hotelId.toString() === hotelId.toString()
    );

    const usage = {
      totalKeys: hotelKeys.length,
      byKeyType: {}
    };

    // Distribute requests among API keys
    const keyTypes = ['read', 'write', 'admin'];
    keyTypes.forEach(type => {
      const typeCount = hotelKeys.filter(k => k.type === type).length;
      if (typeCount > 0) {
        usage.byKeyType[type] = Math.floor(totalRequests * Math.random() * 0.5);
      }
    });

    return usage;
  }

  generateUserMetrics(totalRequests) {
    const authenticatedRatio = 0.7 + Math.random() * 0.25; // 70-95% authenticated
    const authenticated = Math.floor(totalRequests * authenticatedRatio);
    const anonymous = totalRequests - authenticated;

    return {
      total: Math.floor(totalRequests * 0.6), // Unique users
      authenticated,
      anonymous,
      byRole: {
        'guest': Math.floor(authenticated * 0.6),
        'staff': Math.floor(authenticated * 0.25),
        'admin': Math.floor(authenticated * 0.15)
      }
    };
  }

  generateGeographicData() {
    const countries = ['US', 'UK', 'CA', 'DE', 'FR', 'AU', 'IN', 'JP'];
    const geographic = {
      countries: {},
      regions: {}
    };

    countries.forEach(country => {
      if (Math.random() < 0.6) { // Not all countries every hour
        geographic.countries[country] = Math.floor(Math.random() * 20) + 1;
      }
    });

    return geographic;
  }

  generateBandwidthData(totalRequests, endpoint) {
    // Estimate bandwidth based on endpoint type
    const avgRequestSize = endpoint.method === 'POST' ? 2048 : 512;
    const avgResponseSize = endpoint.category === 'Reports' ? 8192 : 1024;

    return {
      totalBytes: totalRequests * (avgRequestSize + avgResponseSize),
      requestBytes: totalRequests * avgRequestSize,
      responseBytes: totalRequests * avgResponseSize,
      averageRequestSize: avgRequestSize,
      averageResponseSize: avgResponseSize
    };
  }

  generateErrorTypes(totalErrors) {
    if (totalErrors === 0) return {};

    return {
      'validation': Math.floor(totalErrors * 0.4),
      'auth': Math.floor(totalErrors * 0.3),
      'server': Math.floor(totalErrors * 0.2),
      'timeout': Math.floor(totalErrors * 0.1)
    };
  }

  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  async batchInsertMetrics(metrics) {
    try {
      await APIMetrics.insertMany(metrics, { ordered: false });
      logger.info(`Inserted batch of ${metrics.length} metrics`);
      console.log(`📊 Inserted batch of ${metrics.length} metrics`);
    } catch (error) {
      logger.error('Error inserting metrics batch:', error.message);
      console.error('❌ Error inserting metrics batch:', error.message);
      // Continue with other batches even if one fails
    }
  }

  async cleanup() {
    try {
      await mongoose.disconnect();
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
    }
  }
}

// Main execution function
async function main() {
  const seeder = new HistoricalMetricsSeeder();

  try {
    await seeder.initialize();
    await seeder.generateMetrics();
    logger.info('✅ Historical API metrics seeding completed successfully');
  } catch (error) {
    logger.error('❌ Historical API metrics seeding failed:', error);
    process.exit(1);
  } finally {
    await seeder.cleanup();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default HistoricalMetricsSeeder;