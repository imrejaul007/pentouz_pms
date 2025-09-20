import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BookingFormTemplate from './src/models/BookingFormTemplate.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('Database connected for debugging');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const debugTemplates = async () => {
  try {
    // Get existing hotel and users
    const hotel = await Hotel.findOne({});
    const adminUser = await User.findOne({ role: 'admin' });
    const staffUsers = await User.find({ role: 'staff' });
    const managerUser = await User.findOne({ role: 'manager' }) || adminUser;
    
    if (!hotel || !adminUser) {
      console.error('No hotel or admin user found. Run seed first.');
      return;
    }

    console.log(`Found hotel: ${hotel.name}`);
    console.log(`Found admin user: ${adminUser.name}`);
    console.log(`Found manager user: ${managerUser.name}`);
    console.log(`Found ${staffUsers.length} staff users`);

    // Create the exact same data from the seed file (using working pattern from reference)
    console.log('Creating booking form templates...');
    
    try {
      const bookingFormTemplate1 = await BookingFormTemplate.create({
        hotelId: hotel._id,
        createdBy: adminUser._id,
        name: 'Standard Hotel Booking Form',
        description: 'Main booking form for hotel reservations with guest details and preferences',
        category: 'booking',
        fields: [
          { id: 'check_in', type: 'date', label: 'Check-in Date', required: true, order: 1 },
          { id: 'check_out', type: 'date', label: 'Check-out Date', required: true, order: 2 },
          { id: 'guests', type: 'number', label: 'Number of Guests', required: true, min: 1, max: 10, order: 3 },
          { id: 'room_type', type: 'select', label: 'Room Type', required: true, order: 4, options: [
            { label: 'Standard Room', value: 'single' },
            { label: 'Deluxe Room', value: 'double' },
            { label: 'Executive Suite', value: 'suite' },
            { label: 'Presidential Suite', value: 'deluxe' }
          ]},
          { id: 'first_name', type: 'text', label: 'First Name', required: true, order: 5 },
          { id: 'last_name', type: 'text', label: 'Last Name', required: true, order: 6 },
          { id: 'email', type: 'email', label: 'Email Address', required: true, order: 7 },
          { id: 'phone', type: 'phone', label: 'Phone Number', required: true, order: 8 },
          { id: 'special_requests', type: 'textarea', label: 'Special Requests', required: false, order: 9 }
        ],
        settings: {
          submitUrl: '/api/v1/bookings',
          method: 'POST',
          successMessage: 'Thank you! Your booking has been confirmed.',
          errorMessage: 'There was an error processing your booking. Please try again.',
          emailNotifications: {
            enabled: true,
            recipientEmails: ['reservations@thepentouz.com'],
            subject: 'New Booking Request'
          }
        },
        status: 'published',
        isPublished: true
      });

      console.log(`✅ Successfully created booking form template: ${bookingFormTemplate1.name} (ID: ${bookingFormTemplate1._id})`);
      
    } catch (templateError) {
      console.error('❌ BookingFormTemplate creation error:', templateError.message);
      if (templateError.errors) {
        console.error('Validation errors:');
        for (const field in templateError.errors) {
          console.error(`- ${field}: ${templateError.errors[field].message}`);
        }
      }
      console.error('Full error:', templateError);
    }

  } catch (error) {
    console.error('Error in debug function:', error);
    console.error('Stack trace:', error.stack);
  }
};

const main = async () => {
  await connectDB();
  await debugTemplates();
  await mongoose.connection.close();
  console.log('Database connection closed');
  process.exit(0);
};

main().catch((error) => {
  console.error('Debug failed:', error);
  process.exit(1);
});