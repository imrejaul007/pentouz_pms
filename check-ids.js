import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkData() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/hotel-management');
    
    const hotels = await mongoose.connection.db.collection('hotels').find({}).toArray();
    console.log('Hotels found:', hotels.length);
    if (hotels.length > 0) {
      console.log('Hotel ID:', hotels[0]._id.toString());
    }
    
    const reviews = await mongoose.connection.db.collection('reviews').find({}).toArray();
    console.log('Reviews found:', reviews.length);
    if (reviews.length > 0) {
      console.log('First review hotel ID:', reviews[0].hotelId.toString());
      console.log('Review published:', reviews[0].isPublished);
      console.log('Review moderation:', reviews[0].moderationStatus);
    }
    
    mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
    mongoose.connection.close();
  }
}

checkData();