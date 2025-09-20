import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FinancialInvoice from './src/models/FinancialInvoice.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('Database connected for checking invoices');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const checkInvoices = async () => {
  try {
    // Check total count
    const totalInvoices = await FinancialInvoice.countDocuments();
    console.log(`📊 Total invoices in database: ${totalInvoices}`);

    if (totalInvoices === 0) {
      console.log('❌ No invoices found in database');
      return;
    }

    // Get all invoices
    const invoices = await FinancialInvoice.find().sort({ createdAt: -1 });
    
    console.log('📄 Invoices found:');
    invoices.forEach((invoice, index) => {
      console.log(`  ${index + 1}. ${invoice.invoiceNumber} - ${invoice.customer?.details?.name}`);
      console.log(`     Type: ${invoice.type}`);
      console.log(`     Status: ${invoice.status}`);
      console.log(`     Amount: ₹${invoice.totalAmount?.toLocaleString()}`);
      console.log(`     Hotel ID: ${invoice.hotelId}`);
      console.log(`     Created: ${invoice.createdAt}`);
      console.log('');
    });

    // Check for invoices with null hotelId
    const nullHotelInvoices = invoices.filter(inv => !inv.hotelId);
    if (nullHotelInvoices.length > 0) {
      console.log('⚠️  Invoices with null hotelId:');
      nullHotelInvoices.forEach(inv => {
        console.log(`  - ${inv.invoiceNumber}: ${inv.customer?.details?.name}`);
      });
    }

    // Check for invoices with valid hotelId
    const validHotelInvoices = invoices.filter(inv => inv.hotelId);
    if (validHotelInvoices.length > 0) {
      console.log('✅ Invoices with valid hotelId:');
      validHotelInvoices.forEach(inv => {
        console.log(`  - ${inv.invoiceNumber}: ${inv.customer?.details?.name} (Hotel: ${inv.hotelId})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking invoices:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

const main = async () => {
  await connectDB();
  await checkInvoices();
};

main();
