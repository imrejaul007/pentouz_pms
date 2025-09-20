import mongoose from 'mongoose';
import PricingStrategy from './src/models/PricingStrategy.js';
import SpecialDiscount from './src/models/SpecialDiscount.js';
import Offer from './src/models/Offer.js';

const MONGODB_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function verifyPricingData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('=== 💰 Pricing System Successfully Seeded! ===\n');

    // Count records
    const strategyCount = await PricingStrategy.countDocuments();
    console.log('💰 Pricing Strategies:', strategyCount);

    const discountCount = await SpecialDiscount.countDocuments();
    console.log('🎟️  Special Discounts (Promo Codes):', discountCount);

    const offerCount = await Offer.countDocuments();
    console.log('🎁 Loyalty Offers:', offerCount);

    console.log('\n=== Sample Records ===');

    // Show sample strategies
    const strategies = await PricingStrategy.find().select('name type isActive priority');
    strategies.forEach(strategy => {
      console.log(`💰 ${strategy.name} (${strategy.type}): Priority ${strategy.priority}, Active: ${strategy.isActive}`);
    });

    // Show sample discounts
    const discounts = await SpecialDiscount.find().select('name code discountType discountValue isActive');
    discounts.forEach(discount => {
      const discountDisplay = discount.discountType === 'percentage' 
        ? `${discount.discountValue}%`
        : `₹${discount.discountValue}`;
      console.log(`🎟️  ${discount.name} (${discount.code}): ${discountDisplay} off, Active: ${discount.isActive}`);
    });

    // Show sample offers
    const offers = await Offer.find().select('title pointsRequired type category');
    offers.forEach(offer => {
      console.log(`🎁 ${offer.title} (${offer.category}): ${offer.pointsRequired} points, Type: ${offer.type}`);
    });

    console.log('\n=== Performance Metrics ===');

    // Show analytics from special discounts
    const totalDiscounts = await SpecialDiscount.aggregate([
      {
        $group: {
          _id: null,
          totalBookings: { $sum: '$analytics.totalBookings' },
          totalRevenue: { $sum: '$analytics.totalRevenue' },
          totalDiscountGiven: { $sum: '$analytics.totalDiscountGiven' },
          avgConversionRate: { $avg: '$analytics.conversionRate' }
        }
      }
    ]);

    if (totalDiscounts.length > 0) {
      const metrics = totalDiscounts[0];
      console.log(`📊 Total Bookings with Discounts: ${metrics.totalBookings}`);
      console.log(`💰 Total Revenue from Discount Bookings: ₹${metrics.totalRevenue.toLocaleString()}`);
      console.log(`💸 Total Discount Amount Given: ₹${metrics.totalDiscountGiven.toLocaleString()}`);
      console.log(`📈 Average Conversion Rate: ${metrics.avgConversionRate.toFixed(1)}%`);
    }

    console.log('\n=== Strategy Distribution ===');

    // Show strategy types distribution
    const strategyTypes = await PricingStrategy.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgPriority: { $avg: '$priority' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    strategyTypes.forEach(type => {
      console.log(`💼 ${type._id.toUpperCase()}: ${type.count} strategies, Avg Priority: ${type.avgPriority}`);
    });

    console.log('\n=== Discount Categories ===');

    // Show discount types distribution
    const discountTypes = await SpecialDiscount.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalUsage: { $sum: '$usageLimits.currentUsage' },
          avgDiscount: { $avg: '$discountValue' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    discountTypes.forEach(type => {
      console.log(`🏷️  ${type._id.replace('_', ' ').toUpperCase()}: ${type.count} codes, ${type.totalUsage} uses, Avg: ${type.avgDiscount.toFixed(1)}%`);
    });

    console.log('\n✅ All pricing system models seeded successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

verifyPricingData();