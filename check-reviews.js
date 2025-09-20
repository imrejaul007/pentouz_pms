import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkReviews() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/hotel-management');
    console.log('Connected to MongoDB');
    
    const reviews = await mongoose.connection.db.collection('reviews').find({}).toArray();
    
    console.log('Total reviews found:', reviews.length);
    
    if (reviews.length > 0) {
      console.log('\nReview details:');
      reviews.forEach((review, i) => {
        console.log(`Review ${i+1}:`);
        console.log(`  - ID: ${review._id}`);
        console.log(`  - Moderation Status: ${review.moderationStatus}`);
        console.log(`  - Published: ${review.isPublished}`);
        console.log(`  - Rating: ${review.rating}`);
        console.log(`  - Title: ${review.title}`);
        console.log('---');
      });
    } else {
      console.log('No reviews found in database - this is likely why reviews are not loading');
    }
    
    // Check if there are any hotels
    const hotels = await mongoose.connection.db.collection('hotels').find({}).toArray();
    console.log('\nTotal hotels found:', hotels.length);
    
    mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
    mongoose.connection.close();
  }
}

checkReviews();