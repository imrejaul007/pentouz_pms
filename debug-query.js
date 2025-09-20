import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function debugQuery() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/hotel-management');
    
    const hotelId = '68b19648e35a38ee7b1d1828';
    
    // Test different query variations
    console.log('=== Testing different queries ===');
    
    // Query 1: All reviews for this hotel
    const allReviews = await mongoose.connection.db.collection('reviews').find({
      hotelId: new mongoose.Types.ObjectId(hotelId)
    }).toArray();
    console.log('All reviews for hotel:', allReviews.length);
    
    // Query 2: Published reviews only
    const publishedReviews = await mongoose.connection.db.collection('reviews').find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isPublished: true
    }).toArray();
    console.log('Published reviews:', publishedReviews.length);
    
    // Query 3: Approved reviews only
    const approvedReviews = await mongoose.connection.db.collection('reviews').find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      moderationStatus: 'approved'
    }).toArray();
    console.log('Approved reviews:', approvedReviews.length);
    
    // Query 4: Full query used by API
    const apiQuery = await mongoose.connection.db.collection('reviews').find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isPublished: true,
      moderationStatus: 'approved'
    }).toArray();
    console.log('API query results:', apiQuery.length);
    
    if (apiQuery.length > 0) {
      console.log('First API result:');
      console.log('- Title:', apiQuery[0].title);
      console.log('- Rating:', apiQuery[0].rating);
      console.log('- Published:', apiQuery[0].isPublished);
      console.log('- Moderation:', apiQuery[0].moderationStatus);
    }
    
    // Let's also check the rating summary aggregation
    console.log('\n=== Testing rating summary ===');
    const pipeline = [
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          isPublished: true,
          moderationStatus: 'approved'
        }
      },
      {
        $group: {
          _id: '$hotelId',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ];
    
    const summaryResult = await mongoose.connection.db.collection('reviews').aggregate(pipeline).toArray();
    console.log('Summary result:', summaryResult);
    
    mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
    mongoose.connection.close();
  }
}

debugQuery();