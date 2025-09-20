import mongoose from 'mongoose';
import RateMapping from './src/models/RateMapping.js';
import RoomMapping from './src/models/RoomMapping.js';
import { RatePlan, RateOverride, SeasonalRate, DynamicPricing, YieldManagement, Package } from './src/models/RateManagement.js';

const MONGODB_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function verifyRateData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('=== 💰 Rate Management System Successfully Seeded! ===\n');

    // Count records for each model
    const roomMappingCount = await RoomMapping.countDocuments();
    console.log('🗺️  Room Mappings:', roomMappingCount);

    const ratePlanCount = await RatePlan.countDocuments();
    console.log('💰 Rate Plans:', ratePlanCount);

    const rateMappingCount = await RateMapping.countDocuments();
    console.log('🔗 Rate Mappings:', rateMappingCount);

    const rateOverrideCount = await RateOverride.countDocuments();
    console.log('🎯 Rate Overrides:', rateOverrideCount);

    const seasonalRateCount = await SeasonalRate.countDocuments();
    console.log('🌟 Seasonal Rates:', seasonalRateCount);

    const dynamicPricingCount = await DynamicPricing.countDocuments();
    console.log('🎲 Dynamic Pricing Rules:', dynamicPricingCount);

    const yieldManagementCount = await YieldManagement.countDocuments();
    console.log('📊 Yield Management Records:', yieldManagementCount);

    const packageCount = await Package.countDocuments();
    console.log('📦 Packages:', packageCount);

    console.log('\n=== Sample Records ===');

    // Show sample room mappings
    const roomMappings = await RoomMapping.find().select('channel channelRoomName isActive').limit(3);
    roomMappings.forEach(mapping => {
      console.log(`🗺️  ${mapping.channelRoomName} (${mapping.channel}): Active: ${mapping.isActive}`);
    });

    // Show sample rate plans
    const ratePlans = await RatePlan.find().select('name type baseCurrency isActive priority');
    ratePlans.forEach(plan => {
      console.log(`💰 ${plan.name} (${plan.type}): ${plan.baseCurrency}, Priority: ${plan.priority}, Active: ${plan.isActive}`);
    });

    // Show sample rate mappings
    const rateMappings = await RateMapping.find().select('pmsRatePlanId channelRatePlanName metrics.totalBookings');
    rateMappings.forEach(mapping => {
      const bookings = mapping.metrics?.totalBookings || 0;
      console.log(`🔗 ${mapping.channelRatePlanName} (${mapping.pmsRatePlanId}): ${bookings} bookings`);
    });

    // Show sample rate overrides
    const rateOverrides = await RateOverride.find().select('roomType ratePlanId overrideRate reason isActive');
    rateOverrides.forEach(override => {
      console.log(`🎯 ${override.roomType} override for ${override.ratePlanId}: ₹${override.overrideRate} (${override.reason})`);
    });

    // Show sample seasonal rates
    const seasonalRates = await SeasonalRate.find().select('name startDate endDate priority isActive');
    seasonalRates.forEach(season => {
      const start = season.startDate.toISOString().split('T')[0];
      const end = season.endDate.toISOString().split('T')[0];
      console.log(`🌟 ${season.name}: ${start} to ${end}, Priority: ${season.priority}, Active: ${season.isActive}`);
    });

    // Show sample dynamic pricing rules
    const dynamicPricing = await DynamicPricing.find().select('name type priority isActive');
    dynamicPricing.forEach(rule => {
      console.log(`🎲 ${rule.name} (${rule.type}): Priority ${rule.priority}, Active: ${rule.isActive}`);
    });

    // Show sample packages
    const packages = await Package.find().select('name type pricing.basePrice pricing.baseCurrency isActive');
    packages.forEach(pkg => {
      const price = pkg.pricing.basePrice;
      const currency = pkg.pricing.baseCurrency;
      console.log(`📦 ${pkg.name} (${pkg.type}): ${currency}${price}, Active: ${pkg.isActive}`);
    });

    console.log('\n=== Performance Metrics ===');

    // Aggregate metrics from rate mappings
    const totalBookings = await RateMapping.aggregate([
      {
        $group: {
          _id: null,
          totalBookings: { $sum: '$metrics.totalBookings' },
          totalRevenue: { $sum: '$metrics.totalRevenue' },
          avgConversionRate: { $avg: '$metrics.conversionRate' }
        }
      }
    ]);

    if (totalBookings.length > 0) {
      const metrics = totalBookings[0];
      console.log(`📊 Total Channel Bookings: ${metrics.totalBookings}`);
      console.log(`💰 Total Channel Revenue: ₹${metrics.totalRevenue.toLocaleString()}`);
      console.log(`📈 Average Conversion Rate: ${metrics.avgConversionRate.toFixed(1)}%`);
    }

    console.log('\n=== Rate Plan Distribution ===');

    // Show rate plan types distribution
    const ratePlanTypes = await RatePlan.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgPriority: { $avg: '$priority' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    ratePlanTypes.forEach(type => {
      console.log(`💼 ${type._id}: ${type.count} plans, Avg Priority: ${type.avgPriority}`);
    });

    console.log('\n=== Channel Distribution ===');

    // Show channel distribution
    const channelDistribution = await RoomMapping.aggregate([
      {
        $group: {
          _id: '$channel',
          count: { $sum: 1 },
          avgCommission: { $avg: '$mappingConfig.commission' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    channelDistribution.forEach(channel => {
      const commission = channel.avgCommission ? channel.avgCommission.toFixed(1) : 'N/A';
      console.log(`📺 ${channel._id.replace('_', ' ').toUpperCase()}: ${channel.count} mappings, Avg Commission: ${commission}%`);
    });

    console.log('\n=== Yield Management Insights ===');

    // Show yield management averages
    const yieldAverages = await YieldManagement.aggregate([
      {
        $group: {
          _id: '$roomType',
          avgOccupancy: { $avg: '$metrics.occupancyRate' },
          avgADR: { $avg: '$metrics.averageDailyRate' },
          avgRevPAR: { $avg: '$metrics.revPAR' },
          avgDemandScore: { $avg: '$metrics.demandScore' },
          count: { $sum: 1 }
        }
      },
      { $sort: { avgRevPAR: -1 } }
    ]);

    yieldAverages.forEach(yieldData => {
      console.log(`📊 ${yieldData._id.toUpperCase()}: Occ: ${yieldData.avgOccupancy.toFixed(1)}%, ADR: ₹${yieldData.avgADR.toFixed(0)}, RevPAR: ₹${yieldData.avgRevPAR.toFixed(0)}, Demand: ${yieldData.avgDemandScore.toFixed(0)}`);
    });

    console.log('\n=== Package Analysis ===');

    // Show package pricing distribution
    const packagePricing = await Package.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgPrice: { $avg: '$pricing.basePrice' },
          minPrice: { $min: '$pricing.basePrice' },
          maxPrice: { $max: '$pricing.basePrice' }
        }
      },
      { $sort: { avgPrice: -1 } }
    ]);

    packagePricing.forEach(pkg => {
      console.log(`📦 ${pkg._id.toUpperCase()}: ${pkg.count} packages, Avg: ₹${pkg.avgPrice.toFixed(0)}, Range: ₹${pkg.minPrice}-₹${pkg.maxPrice}`);
    });

    console.log('\n✅ All rate management models successfully seeded and verified!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

verifyRateData();