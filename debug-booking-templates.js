import mongoose from 'mongoose';
import User from './src/models/User.js';
import BookingFormTemplate from './src/models/BookingFormTemplate.js';
import dotenv from 'dotenv';

dotenv.config();

async function debugBookingTemplates() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔌 Connected to MongoDB');

    // Get all users
    const users = await User.find({}).select('_id name email role hotelId');
    console.log('\n👥 All Users:');
    users.forEach(user => {
      console.log(`  - ID: ${user._id}, Name: ${user.name}, Role: ${user.role}, HotelId: ${user.hotelId}`);
    });

    // Get all booking form templates
    const templates = await BookingFormTemplate.find({}).select('_id name hotelId category status');
    console.log('\n📋 All Booking Form Templates:');
    if (templates.length === 0) {
      console.log('  No templates found in database');
    } else {
      templates.forEach(template => {
        console.log(`  - ID: ${template._id}, Name: ${template.name}, HotelId: ${template.hotelId}, Category: ${template.category}, Status: ${template.status}`);
      });
    }

    // Check for hotelId mismatches
    console.log('\n🔍 Checking HotelId Matches:');
    for (const user of users) {
      if (user.hotelId) {
        const userTemplates = await BookingFormTemplate.find({ hotelId: user.hotelId });
        console.log(`  - User ${user.name} (${user.hotelId}) has ${userTemplates.length} templates`);
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Debugging complete');
  } catch (error) {
    console.error('❌ Debug error:', error);
    await mongoose.disconnect();
  }
}

debugBookingTemplates();