import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';

dotenv.config();

console.log('Starting minimal seed test...');

const seedMinimal = async () => {
  try {
    console.log('1. Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('   ✓ Connected to MongoDB');

    console.log('2. Clearing existing data...');
    await User.deleteMany({});
    await Hotel.deleteMany({});
    console.log('   ✓ Data cleared');

    console.log('3. Creating temp user...');
    const tempUser = await User.create({
      name: 'Temp User',
      email: 'temp@hotel.com',
      password: 'temp123',
      role: 'guest'
    });
    console.log('   ✓ Temp user created with ID:', tempUser._id.toString());

    console.log('4. Creating hotel with fixed ID...');
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
        zipCode: '400001',
        coordinates: {
          latitude: 19.0760,
          longitude: 72.8777
        }
      },
      contact: {
        phone: '+91-22-1234-5678',
        email: 'info@thepentouz.com',
        website: 'https://thepentouz.com'
      },
      amenities: ['Free WiFi', 'Swimming Pool'],
      images: ['https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg'],
      ownerId: tempUser._id
    });

    console.log('   ✓ Hotel created with ID:', hotel._id.toString());

    console.log('5. Creating admin user...');
    const adminUser = await User.create({
      firstName: 'Hotel',
      lastName: 'Admin',
      name: 'Hotel Admin',
      email: 'admin@hotel.com',
      password: 'admin123',
      role: 'admin',
      hotelId: hotel._id
    });
    console.log('   ✓ Admin user created with hotel ID:', adminUser.hotelId.toString());

    console.log('\n✅ Minimal seed completed successfully!');
    console.log('Hotel ID:', hotel._id.toString());
    console.log('Admin can login with: admin@hotel.com / admin123');

    await mongoose.disconnect();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during seeding:');
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedMinimal();