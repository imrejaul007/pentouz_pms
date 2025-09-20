import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BookingFormTemplate from './src/models/BookingFormTemplate.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('Database connected for testing');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const testBookingTemplates = async () => {
  try {
    // Get existing hotel and user
    const hotel = await Hotel.findOne({});
    const user = await User.findOne({ role: 'admin' });
    
    if (!hotel || !user) {
      console.error('No hotel or admin user found. Run seed first.');
      return;
    }

    console.log(`Found hotel: ${hotel.name}`);
    console.log(`Found admin user: ${user.name}`);

    // Create a simple booking form template
    const simpleTemplate = {
      templateId: 'TEST001',
      name: 'Test Booking Form',
      title: 'Test Form',
      description: 'Simple test booking form',
      category: 'booking',
      formType: 'BOOKING_FORM',
      status: 'published',
      isDefault: false,
      version: 1.0,
      fields: [
        {
          id: 'name',
          name: 'guestName',
          label: 'Guest Name',
          type: 'text',
          required: true,
          order: 1,
          validation: [
            {
              type: 'min_length',
              value: 2,
              message: 'Name must be at least 2 characters'
            },
            {
              type: 'max_length',
              value: 50,
              message: 'Name cannot exceed 50 characters'
            }
          ],
          placeholder: 'Enter guest name',
          width: '100'
        }
      ],
      hotelId: hotel._id,
      createdBy: user._id
    };

    console.log('Creating booking form template...');
    const createdTemplate = await BookingFormTemplate.create(simpleTemplate);
    console.log('✅ Successfully created booking form template:', createdTemplate._id);
    console.log('Template name:', createdTemplate.name);
    console.log('Template status:', createdTemplate.status);

  } catch (error) {
    console.error('Error creating booking form template:', error);
    if (error.errors) {
      console.error('Validation errors:');
      for (const field in error.errors) {
        console.error(`- ${field}: ${error.errors[field].message}`);
      }
    }
  }
};

const main = async () => {
  await connectDB();
  await testBookingTemplates();
  await mongoose.connection.close();
  console.log('Database connection closed');
  process.exit(0);
};

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});