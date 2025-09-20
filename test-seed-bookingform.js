import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BookingFormTemplate from './src/models/BookingFormTemplate.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('Database connected');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const testBookingFormCreation = async () => {
  try {
    // Get existing data (from already seeded database)
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

    // Try to create the exact same templates from seed file
    console.log('\n📝 Testing BookingFormTemplate creation...\n');
    
    try {
      console.log('Creating template 1...');
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
      console.log(`✅ Template 1 created: ${bookingFormTemplate1._id}`);

      console.log('Creating template 2...');
      const bookingFormTemplate2 = await BookingFormTemplate.create({
        hotelId: hotel._id,
        createdBy: staffUsers[0]._id,
        name: 'Quick Booking Form',
        description: 'Simplified booking form for fast reservations',
        category: 'booking',
        fields: [
          { id: 'full_name', type: 'text', label: 'Full Name', required: true, order: 1 },
          { id: 'contact_number', type: 'phone', label: 'Contact Number', required: true, order: 2 },
          { id: 'check_in', type: 'date', label: 'Check-in Date', required: true, order: 3 },
          { id: 'check_out', type: 'date', label: 'Check-out Date', required: true, order: 4 },
          { id: 'room_preference', type: 'select', label: 'Room Preference', required: true, order: 5, options: [
            { label: 'Any Available', value: 'any' },
            { label: 'Single Room', value: 'single' },
            { label: 'Double Room', value: 'double' }
          ]}
        ],
        settings: {
          submitUrl: '/api/v1/bookings/quick',
          method: 'POST',
          successMessage: 'Thank you! Your quick booking has been received.',
          errorMessage: 'There was an error processing your booking. Please try again.'
        },
        status: 'published',
        isPublished: true
      });
      console.log(`✅ Template 2 created: ${bookingFormTemplate2._id}`);

      console.log('Creating template 3...');
      const bookingFormTemplate3 = await BookingFormTemplate.create({
        hotelId: hotel._id,
        createdBy: managerUser._id,
        name: 'Corporate Inquiry Form',
        description: 'Form for corporate clients to inquire about services and group bookings',
        category: 'inquiry',
        fields: [
          { id: 'company_name', type: 'text', label: 'Company Name', required: true, order: 1 },
          { id: 'contact_person', type: 'text', label: 'Contact Person', required: true, order: 2 },
          { id: 'business_email', type: 'email', label: 'Business Email', required: true, order: 3 },
          { id: 'phone', type: 'phone', label: 'Phone Number', required: true, order: 4 },
          { id: 'inquiry_type', type: 'select', label: 'Inquiry Type', required: true, order: 5, options: [
            { label: 'Group Booking', value: 'group_booking' },
            { label: 'Corporate Events', value: 'corporate_events' },
            { label: 'Long-term Stay', value: 'long_term' },
            { label: 'General Inquiry', value: 'general' }
          ]},
          { id: 'message', type: 'textarea', label: 'Message', required: true, order: 6 }
        ],
        settings: {
          submitUrl: '/api/v1/inquiries/corporate',
          method: 'POST',
          successMessage: 'Thank you! Your inquiry has been submitted. We will contact you shortly.',
          errorMessage: 'There was an error submitting your inquiry. Please try again.',
          emailNotifications: {
            enabled: true,
            recipientEmails: ['corporate@thepentouz.com'],
            subject: 'New Corporate Inquiry'
          }
        },
        status: 'published',
        isPublished: true
      });
      console.log(`✅ Template 3 created: ${bookingFormTemplate3._id}`);

      console.log(`\n🎉 All 3 BookingFormTemplates created successfully!`);

    } catch (templateError) {
      console.error('\n❌ BookingFormTemplate creation failed:');
      console.error('Error message:', templateError.message);
      
      if (templateError.errors) {
        console.error('\nValidation errors:');
        for (const [field, error] of Object.entries(templateError.errors)) {
          console.error(`  - ${field}: ${error.message}`);
        }
      }
      
      console.error('\nFull error object:');
      console.error(templateError);
      
      if (templateError.stack) {
        console.error('\nStack trace:');
        console.error(templateError.stack);
      }
    }

  } catch (error) {
    console.error('Main error:', error);
  }
};

const main = async () => {
  await connectDB();
  await testBookingFormCreation();
  await mongoose.connection.close();
  console.log('\nDatabase connection closed');
  process.exit(0);
};

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});