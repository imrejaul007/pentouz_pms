import mongoose from 'mongoose';
import Booking from './src/models/Booking.js';
import Invoice from './src/models/Invoice.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkBillingData() {
  try {
    const connectionString = process.env.DATABASE_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';
    console.log('Connecting to:', connectionString);
    await mongoose.connect(connectionString);
    console.log('Connected to MongoDB');
    
    const totalBookings = await Booking.countDocuments();
    const totalInvoices = await Invoice.countDocuments();
    console.log('\n=== Database Overview ===');
    console.log(`Total bookings: ${totalBookings}`);
    console.log(`Total invoices: ${totalInvoices}`);
    
    const recentBookings = await Booking.find().sort({createdAt: -1}).limit(5);
    console.log('\n=== Recent Bookings ===');
    console.log('Found bookings:', recentBookings.length);
    recentBookings.forEach((booking, i) => {
      console.log(`Booking ${i+1}: ${booking.bookingNumber || 'No Number'}, Status: ${booking.status}, Payment: ${booking.paymentStatus}, Amount: ${booking.totalAmount}, Created: ${booking.createdAt}`);
    });

    const recentInvoices = await Invoice.find().sort({createdAt: -1}).limit(5);
    console.log('\n=== Recent Invoices ===');  
    console.log('Found invoices:', recentInvoices.length);
    recentInvoices.forEach((invoice, i) => {
      console.log(`Invoice ${i+1}: ${invoice.invoiceNumber}, Status: ${invoice.status}, Amount: ${invoice.totalAmount}, Type: ${invoice.type}, Created: ${invoice.createdAt}`);
    });
    
    // Check how many invoices are linked to bookings
    const invoicesWithBookings = await Invoice.countDocuments({ bookingId: { $exists: true, $ne: null } });
    const bookingsWithInvoices = await Booking.countDocuments({ 
      _id: { $in: await Invoice.distinct('bookingId') }
    });
    
    console.log('\n=== Relationships ===');
    console.log(`Invoices linked to bookings: ${invoicesWithBookings}/${recentInvoices.length}`);
    console.log(`Bookings with invoices: ${bookingsWithInvoices}/${recentBookings.length}`);
    
    await mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkBillingData();