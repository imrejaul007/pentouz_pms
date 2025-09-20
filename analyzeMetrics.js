import mongoose from 'mongoose';
import APIMetrics from './src/models/APIMetrics.js';
import 'dotenv/config';

async function analyzeMetrics() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const totalCount = await APIMetrics.countDocuments();
    console.log('Total API Metrics:', totalCount);

    // Group by day
    const metricsByDay = await APIMetrics.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          },
          count: { $sum: 1 },
          uniqueEndpoints: { $addToSet: { method: "$endpoint.method", path: "$endpoint.path" } },
          totalRequests: { $sum: "$requests.total" },
          avgResponseTime: { $avg: "$performance.averageResponseTime" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log('\nMetrics by Day:');
    metricsByDay.forEach(day => {
      console.log(`${day._id}: ${day.count} metrics, ${day.uniqueEndpoints.length} endpoints, ${day.totalRequests} total requests, ${Math.round(day.avgResponseTime)}ms avg response`);
    });

    // Top endpoints
    const topEndpoints = await APIMetrics.aggregate([
      {
        $group: {
          _id: {
            method: "$endpoint.method",
            path: "$endpoint.path",
            category: "$endpoint.category"
          },
          totalRequests: { $sum: "$requests.total" },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalRequests: -1 } },
      { $limit: 10 }
    ]);

    console.log('\nTop 10 Endpoints by Total Requests:');
    topEndpoints.forEach((endpoint, i) => {
      console.log(`${i + 1}. ${endpoint._id.method} ${endpoint._id.path} (${endpoint._id.category}) - ${endpoint.totalRequests} requests`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Analysis completed');
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeMetrics();