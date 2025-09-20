import 'dotenv/config';
import mongoose from 'mongoose';
import BookingFormTemplate from './src/models/BookingFormTemplate.js';

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel_management');
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.log('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

async function checkTemplates() {
  await connectDB();
  
  try {
    const currentUserHotelId = '68bc094f80c86bfe258e172b';
    
    console.log('🔍 Checking templates for current user hotelId...');
    console.log('🏨 Current user hotelId:', currentUserHotelId);
    
    // Simple query without populate
    const filter = { hotelId: currentUserHotelId };
    console.log('📊 MongoDB filter:', JSON.stringify(filter, null, 2));
    
    const templates = await BookingFormTemplate.find(filter)
      .sort({ updatedAt: -1 })
      .limit(12)
      .select('name hotelId status category createdAt updatedAt');
    
    const total = await BookingFormTemplate.countDocuments(filter);
    
    console.log('📋 Found templates count:', templates.length);
    console.log('📊 Total count:', total);
    
    if (templates.length > 0) {
      console.log('\n📋 Templates found:');
      templates.forEach((template, index) => {
        console.log(`${index + 1}. ${template.name}`);
        console.log(`   ID: ${template._id}`);
        console.log(`   Hotel ID: ${template.hotelId}`);
        console.log(`   Status: ${template.status}`);
        console.log(`   Category: ${template.category}`);
        console.log(`   Created: ${template.createdAt}`);
        console.log('');
      });
    } else {
      console.log('❌ No templates found for current user hotelId!');
      
      // Check all templates
      const allTemplates = await BookingFormTemplate.find({}).select('name hotelId status');
      console.log('\n🔍 All templates in database:');
      if (allTemplates.length === 0) {
        console.log('❌ No templates exist in database at all!');
      } else {
        allTemplates.forEach(t => {
          console.log(`- ${t.name} (hotelId: ${t.hotelId}, status: ${t.status})`);
        });
      }
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkTemplates();