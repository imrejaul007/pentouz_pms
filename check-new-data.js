import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkNewData() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/hotel-management');
    
    console.log('=== Checking database after seed ===');
    
    // Check hotels
    const hotels = await mongoose.connection.db.collection('hotels').find({}).toArray();
    console.log('Total hotels found:', hotels.length);
    hotels.forEach((hotel, i) => {
      console.log(`Hotel ${i+1}: ${hotel.name} - ID: ${hotel._id}`);
    });
    
    // Check reviews
    const reviews = await mongoose.connection.db.collection('reviews').find({}).toArray();
    console.log('\nTotal reviews found:', reviews.length);
    
    // Group reviews by hotel ID
    const reviewsByHotel = {};
    reviews.forEach(review => {
      const hotelId = review.hotelId.toString();
      if (!reviewsByHotel[hotelId]) {
        reviewsByHotel[hotelId] = 0;
      }
      reviewsByHotel[hotelId]++;
    });
    
    console.log('Reviews by hotel:');
    Object.entries(reviewsByHotel).forEach(([hotelId, count]) => {
      console.log(`  Hotel ${hotelId}: ${count} reviews`);
    });
    
    // Show first few reviews
    if (reviews.length > 0) {
      console.log('\nFirst 3 reviews:');
      reviews.slice(0, 3).forEach((review, i) => {
        console.log(`Review ${i+1}:`);
        console.log(`  - Title: ${review.title}`);
        console.log(`  - Hotel ID: ${review.hotelId}`);
        console.log(`  - Rating: ${review.rating}`);
        console.log(`  - Status: ${review.moderationStatus}`);
        console.log(`  - Published: ${review.isPublished}`);
      });
    }
    
    mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
    mongoose.connection.close();
  }
}

checkNewData();