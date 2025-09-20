import mongoose from 'mongoose';
import Hotel from './src/models/Hotel.js';
import dotenv from 'dotenv';

dotenv.config();

async function testHotelCreation() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    // Clear existing hotels
    await Hotel.deleteMany({});
    console.log('Cleared existing hotels');

    // Try to create hotel with fixed ID
    const FIXED_HOTEL_ID = new mongoose.Types.ObjectId('670000000000000000000001');

    const hotel = await Hotel.create({
      _id: FIXED_HOTEL_ID,
      name: 'THE PENTOUZ',
      description: 'A luxury hotel in the heart of the city',
      address: {
        street: '123 MG Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        zipCode: '400001'
      },
      contact: {
        phone: '+91-22-1234-5678',
        email: 'info@thepentouz.com',
        website: 'https://thepentouz.com'
      },
      amenities: ['Free WiFi', 'Swimming Pool'],
      images: ['https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg']
    });

    console.log('Hotel created successfully with ID:', hotel._id.toString());

    await mongoose.disconnect();
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
    await mongoose.disconnect();
  }
}

testHotelCreation();