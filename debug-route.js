import mongoose from 'mongoose';
import Review from './src/models/Review.js';
import User from './src/models/User.js';
import dotenv from 'dotenv';
dotenv.config();

async function debugRouteLogic() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/hotel-management');
    
    const hotelId = '68b19648e35a38ee7b1d1828';
    console.log('Hotel ID from request:', hotelId);
    
    // Test query construction step by step
    const query = {
      hotelId,
      isPublished: true,
      moderationStatus: 'approved'
    };

    console.log('Query object:', query);
    
    // Test different formats of hotelId
    console.log('\n=== Testing different hotelId formats ===');
    
    // 1. String format (current)
    const stringQuery = await Review.find({ hotelId: hotelId }).countDocuments();
    console.log('String query count:', stringQuery);
    
    // 2. ObjectId format  
    const objectIdQuery = await Review.find({ hotelId: new mongoose.Types.ObjectId(hotelId) }).countDocuments();
    console.log('ObjectId query count:', objectIdQuery);
    
    // 3. Check actual format in database
    const sampleReview = await Review.findOne({});
    if (sampleReview) {
      console.log('Sample review hotelId type:', typeof sampleReview.hotelId);
      console.log('Sample review hotelId value:', sampleReview.hotelId);
      console.log('Sample review hotelId string:', sampleReview.hotelId.toString());
    }
    
    // 4. Test the full query as used in the route
    console.log('\n=== Testing full query ===');
    const fullQuery = {
      hotelId: new mongoose.Types.ObjectId(hotelId),  // Try ObjectId format
      isPublished: true,
      moderationStatus: 'approved'
    };
    
    const reviews = await Review.find(fullQuery).limit(5);
    console.log('Full query results:', reviews.length);
    
    if (reviews.length > 0) {
      console.log('First review found:');
      console.log('- Title:', reviews[0].title);
      console.log('- Rating:', reviews[0].rating);
    }
    
    mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    mongoose.connection.close();
  }
}

debugRouteLogic();