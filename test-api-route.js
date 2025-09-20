import mongoose from 'mongoose';
import Review from './src/models/Review.js';
import dotenv from 'dotenv';
dotenv.config();

async function testRoute() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/hotel-management');
    
    const hotelId = '68b19648e35a38ee7b1d1828';
    const page = 1;
    const limit = 10;
    const sortBy = 'newest';
    
    console.log('=== Testing API Route Logic ===');
    
    // Exact query from the route
    const query = {
      hotelId,
      isPublished: true,
      moderationStatus: 'approved'
    };

    console.log('Query object:', query);

    // Sort options
    let sortOption = '-createdAt'; // newest by default
    console.log('Sort option:', sortOption);

    const skip = (page - 1) * limit;

    // Test the exact query used in the route
    console.log('Testing with Mongoose model...');
    
    const [reviews, total, summary] = await Promise.all([
      Review.find(query)
        .populate('userId', 'name')
        .populate('response.respondedBy', 'name')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit)),
      Review.countDocuments(query),
      Review.getHotelRatingSummary(hotelId)
    ]);

    console.log('Reviews found:', reviews.length);
    console.log('Total count:', total);
    console.log('Summary:', summary);

    if (reviews.length > 0) {
      console.log('First review title:', reviews[0].title);
      console.log('First review userId populated:', reviews[0].userId);
    }
    
    mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    mongoose.connection.close();
  }
}

testRoute();