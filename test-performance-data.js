import mongoose from 'mongoose';
import TravelAgent from './src/models/TravelAgent.js';

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0";

async function testPerformanceData() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Test the aggregation query
    const baseQuery = { isActive: true };
    
    console.log('\n📊 Testing performance data aggregation...');
    const agentPerformanceData = await TravelAgent.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$performanceMetrics.totalRevenue' },
          totalBookings: { $sum: '$performanceMetrics.totalBookings' },
          totalCommission: { $sum: '$performanceMetrics.totalCommissionEarned' },
          averageBookingValue: { $avg: '$performanceMetrics.averageBookingValue' }
        }
      }
    ]);

    console.log('📈 Aggregation result:', JSON.stringify(agentPerformanceData, null, 2));

    // Test individual agent data
    console.log('\n👥 Testing individual agent data...');
    const agents = await TravelAgent.find(baseQuery)
      .limit(1)
      .lean();

    console.log('🏢 Sample agent (all fields):', JSON.stringify(agents[0], null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testPerformanceData();
