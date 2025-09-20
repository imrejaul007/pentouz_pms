import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FinancialInvoice from './src/models/FinancialInvoice.js';
import ChartOfAccounts from './src/models/ChartOfAccounts.js';
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('Database connected for invoices seeding');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const createSampleInvoices = async () => {
  try {
    // Get existing data
    const adminUser = await User.findOne({ role: 'admin' });
    const hotel = await Hotel.findOne();
    const revenueAccount = await ChartOfAccounts.findOne({ accountCode: '4100' }); // Room Revenue account
    const expenseAccount = await ChartOfAccounts.findOne({ accountCode: '6100' }); // Operating Expenses account
    
    if (!adminUser || !hotel || !revenueAccount || !expenseAccount) {
      console.log('❌ Required data not found. Please run seed-financial.js first.');
      return;
    }

    console.log('📄 Creating sample invoices...');

    const sampleInvoices = [
      {
        invoiceId: 'INV-2024-001',
        invoiceNumber: 'INV-2024-001',
        hotelId: hotel._id,
        type: 'guest_folio',
        customer: {
          type: 'guest',
          guestId: adminUser._id,
          details: {
            name: 'John Smith',
            address: {
              street: '123 Main Street',
              city: 'Mumbai',
              state: 'Maharashtra',
              zipCode: '400001',
              country: 'India'
            },
            email: 'john.smith@email.com',
            phone: '+91-98765-43210'
          }
        },
        issueDate: new Date('2024-01-15'),
        dueDate: new Date('2024-02-14'),
        currency: 'INR',
        exchangeRate: 1,
        lineItems: [
          {
            description: 'Deluxe Room - 2 Nights',
            account: revenueAccount._id,
            quantity: 2,
            unitPrice: 5000,
            amount: 10000,
            taxRate: 18,
            taxAmount: 1800,
            taxCode: 'GST'
          },
          {
            description: 'Room Service - Dinner',
            account: revenueAccount._id,
            quantity: 1,
            unitPrice: 1200,
            amount: 1200,
            taxRate: 18,
            taxAmount: 216,
            taxCode: 'GST'
          }
        ],
        subtotal: 11200,
        totalTax: 2016,
        totalAmount: 13216,
        balanceAmount: 13216,
        status: 'sent',
        paymentTerms: 'Net 30',
        notes: 'Thank you for choosing our hotel!',
        createdBy: adminUser._id
      },
      {
        invoiceId: 'INV-2024-002',
        invoiceNumber: 'INV-2024-002',
        hotelId: hotel._id,
        type: 'corporate_billing',
        customer: {
          type: 'corporate',
          details: {
            name: 'TechCorp Solutions Ltd.',
            address: {
              street: '456 Business Park',
              city: 'Bangalore',
              state: 'Karnataka',
              zipCode: '560001',
              country: 'India'
            },
            taxId: 'GST123456789',
            email: 'accounts@techcorp.com',
            phone: '+91-87654-32109'
          }
        },
        issueDate: new Date('2024-01-16'),
        dueDate: new Date('2024-02-15'),
        currency: 'INR',
        exchangeRate: 1,
        lineItems: [
          {
            description: 'Conference Room - Full Day',
            account: revenueAccount._id,
            quantity: 1,
            unitPrice: 15000,
            amount: 15000,
            taxRate: 18,
            taxAmount: 2700
          },
          {
            description: 'Catering Services',
            account: revenueAccount._id,
            quantity: 1,
            unitPrice: 8000,
            amount: 8000,
            taxRate: 18,
            taxAmount: 1440,
            taxCode: 'GST'
          }
        ],
        subtotal: 23000,
        totalTax: 4140,
        totalAmount: 27140,
        balanceAmount: 0,
        status: 'paid',
        paymentTerms: 'Net 30',
        notes: 'Corporate event billing',
        createdBy: adminUser._id,
        paidDate: new Date('2024-01-20'),
        paidAmount: 27140
      },
      {
        invoiceId: 'INV-2024-003',
        invoiceNumber: 'INV-2024-003',
        hotelId: hotel._id,
        type: 'vendor_invoice',
        customer: {
          type: 'vendor',
          details: {
            name: 'Fresh Foods Supply Co.',
            address: {
              street: '789 Industrial Area',
              city: 'Pune',
              state: 'Maharashtra',
              zipCode: '411001',
              country: 'India'
            },
            taxId: 'GST987654321',
            email: 'billing@freshfoods.com',
            phone: '+91-76543-21098'
          }
        },
        issueDate: new Date('2024-01-17'),
        dueDate: new Date('2024-02-16'),
        currency: 'INR',
        exchangeRate: 1,
        lineItems: [
          {
            description: 'Fresh Vegetables - Weekly Supply',
            account: expenseAccount._id,
            quantity: 1,
            unitPrice: 15000,
            amount: 15000,
            taxRate: 18,
            taxAmount: 2700,
            taxCode: 'GST'
          }
        ],
        subtotal: 15000,
        totalTax: 2700,
        totalAmount: 17700,
        balanceAmount: 17700,
        status: 'sent',
        paymentTerms: 'Net 30',
        notes: 'Weekly food supply invoice',
        createdBy: adminUser._id
      }
    ];

    // Clear existing invoices
    await FinancialInvoice.deleteMany({});
    console.log('🗑️ Cleared existing invoices');

    // Create new invoices
    const createdInvoices = await FinancialInvoice.insertMany(sampleInvoices);
    
    console.log('✅ Successfully created invoices:');
    createdInvoices.forEach((invoice, index) => {
      console.log(`  ${index + 1}. ${invoice.invoiceNumber} - ${invoice.customer.details.name}`);
      console.log(`     Type: ${invoice.type}`);
      console.log(`     Amount: ₹${invoice.totalAmount.toLocaleString()}`);
      console.log(`     Status: ${invoice.status}`);
      console.log(`     Due Date: ${invoice.dueDate.toLocaleDateString()}`);
      console.log('');
    });

    console.log(`🎯 Total invoices created: ${createdInvoices.length}`);
    
  } catch (error) {
    console.error('❌ Error creating invoices:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

const main = async () => {
  await connectDB();
  await createSampleInvoices();
};

main();
