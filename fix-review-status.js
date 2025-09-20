import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function fixReviewStatus() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/hotel-management');
    
    console.log('=== Checking current review status ===');
    
    // Check current reviews
    const reviews = await mongoose.connection.db.collection('reviews').find({}).toArray();
    console.log('Total reviews found:', reviews.length);
    
    reviews.forEach((review, i) => {
      console.log(`Review ${i+1}:`);
      console.log(`  - moderationStatus: ${review.moderationStatus}`);
      console.log(`  - isPublished: ${review.isPublished}`);
      console.log(`  - title: ${review.title}`);
    });
    
    // Update all reviews to have approved status if they don't already
    console.log('\n=== Updating review status ===');
    
    const updateResult = await mongoose.connection.db.collection('reviews').updateMany(
      { moderationStatus: { $ne: 'approved' } }, // Reviews that are not approved
      { 
        $set: { 
          moderationStatus: 'approved',
          isPublished: true 
        } 
      }
    );
    
    console.log('Update result:', updateResult);
    
    // Check again
    const updatedReviews = await mongoose.connection.db.collection('reviews').find({}).toArray();
    console.log('\n=== After update ===');
    console.log('Reviews with approved status:', updatedReviews.filter(r => r.moderationStatus === 'approved').length);
    console.log('Reviews that are published:', updatedReviews.filter(r => r.isPublished === true).length);
    
    mongoose.connection.close();
    console.log('\nDone!');
  } catch (err) {
    console.error('Error:', err.message);
    mongoose.connection.close();
  }
}

fixReviewStatus();