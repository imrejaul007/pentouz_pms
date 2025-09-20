import mongoose from 'mongoose';
import dotenv from 'dotenv';
import JournalEntry from './src/models/JournalEntry.js';
import ChartOfAccounts from './src/models/ChartOfAccounts.js';
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('Database connected for journal entries seeding');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const createSampleJournalEntries = async () => {
  try {
    // Get existing data
    const adminUser = await User.findOne({ role: 'admin' });
    const hotel = await Hotel.findOne();
    const accounts = await ChartOfAccounts.find({ hotelId: hotel._id });

    if (!adminUser || !hotel || accounts.length === 0) {
      console.error('Required data not found. Please run seed-financial.js first.');
      return;
    }

    console.log(`Found ${accounts.length} accounts for hotel ${hotel.name}`);

    // Clear existing journal entries
    await JournalEntry.deleteMany({});
    console.log('Cleared existing journal entries');

    // Find specific accounts for journal entries
    const cashAccount = accounts.find(acc => acc.accountName === 'Cash and Bank');
    const revenueAccount = accounts.find(acc => acc.accountName === 'Room Revenue');
    const expenseAccount = accounts.find(acc => acc.accountName === 'Operating Expenses');
    const payableAccount = accounts.find(acc => acc.accountName === 'Accounts Payable');

    if (!cashAccount || !revenueAccount || !expenseAccount || !payableAccount) {
      console.error('Required accounts not found');
      return;
    }

    // Sample Journal Entry 1: Room Revenue
    const roomRevenueEntry = await JournalEntry.create({
      entryNumber: 'JE-2024-001',
      entryDate: new Date('2024-01-15'),
      entryType: 'Manual',
      description: 'Room revenue for January 15, 2024',
      lines: [
        {
          accountId: cashAccount._id,
          description: 'Cash received from room bookings',
          debitAmount: 50000,
          creditAmount: 0,
          currency: 'INR'
        },
        {
          accountId: revenueAccount._id,
          description: 'Room revenue earned',
          debitAmount: 0,
          creditAmount: 50000,
          currency: 'INR'
        }
      ],
      totalDebit: 50000,
      totalCredit: 50000,
      referenceType: 'POS',
      referenceNumber: 'POS-001',
      status: 'Posted',
      fiscalYear: 2024,
      fiscalPeriod: 1,
      hotelId: hotel._id,
      createdBy: adminUser._id,
      postedDate: new Date('2024-01-15')
    });

    // Sample Journal Entry 2: Operating Expense
    const operatingExpenseEntry = await JournalEntry.create({
      entryNumber: 'JE-2024-002',
      entryDate: new Date('2024-01-16'),
      entryType: 'Manual',
      description: 'Operating expenses for January 16, 2024',
      lines: [
        {
          accountId: expenseAccount._id,
          description: 'Operating expenses incurred',
          debitAmount: 25000,
          creditAmount: 0,
          currency: 'INR'
        },
        {
          accountId: cashAccount._id,
          description: 'Cash paid for expenses',
          debitAmount: 0,
          creditAmount: 25000,
          currency: 'INR'
        }
      ],
      totalDebit: 25000,
      totalCredit: 25000,
      referenceType: 'Expense',
      referenceNumber: 'EXP-001',
      status: 'Posted',
      fiscalYear: 2024,
      fiscalPeriod: 1,
      hotelId: hotel._id,
      createdBy: adminUser._id,
      postedDate: new Date('2024-01-16')
    });

    // Sample Journal Entry 3: Accounts Payable
    const accountsPayableEntry = await JournalEntry.create({
      entryNumber: 'JE-2024-003',
      entryDate: new Date('2024-01-17'),
      entryType: 'Manual',
      description: 'Purchase of supplies on credit',
      lines: [
        {
          accountId: expenseAccount._id,
          description: 'Supplies expense',
          debitAmount: 15000,
          creditAmount: 0,
          currency: 'INR'
        },
        {
          accountId: payableAccount._id,
          description: 'Accounts payable to supplier',
          debitAmount: 0,
          creditAmount: 15000,
          currency: 'INR'
        }
      ],
      totalDebit: 15000,
      totalCredit: 15000,
      referenceType: 'Expense',
      referenceNumber: 'PO-001',
      status: 'Posted',
      fiscalYear: 2024,
      fiscalPeriod: 1,
      hotelId: hotel._id,
      createdBy: adminUser._id,
      postedDate: new Date('2024-01-17')
    });

    // Sample Journal Entry 4: Payment to Supplier
    const paymentEntry = await JournalEntry.create({
      entryNumber: 'JE-2024-004',
      entryDate: new Date('2024-01-18'),
      entryType: 'Manual',
      description: 'Payment to supplier for supplies',
      lines: [
        {
          accountId: payableAccount._id,
          description: 'Accounts payable reduced',
          debitAmount: 15000,
          creditAmount: 0,
          currency: 'INR'
        },
        {
          accountId: cashAccount._id,
          description: 'Cash paid to supplier',
          debitAmount: 0,
          creditAmount: 15000,
          currency: 'INR'
        }
      ],
      totalDebit: 15000,
      totalCredit: 15000,
      referenceType: 'Payment',
      referenceNumber: 'PAY-001',
      status: 'Posted',
      fiscalYear: 2024,
      fiscalPeriod: 1,
      hotelId: hotel._id,
      createdBy: adminUser._id,
      postedDate: new Date('2024-01-18')
    });

    console.log('✅ Created sample journal entries:');
    console.log(`  - ${roomRevenueEntry.entryNumber}: Room Revenue ₹50,000`);
    console.log(`  - ${operatingExpenseEntry.entryNumber}: Operating Expense ₹25,000`);
    console.log(`  - ${accountsPayableEntry.entryNumber}: Supplies on Credit ₹15,000`);
    console.log(`  - ${paymentEntry.entryNumber}: Payment to Supplier ₹15,000`);

    // Verify the entries were created
    const totalEntries = await JournalEntry.countDocuments();
    console.log(`\n📊 Total journal entries in database: ${totalEntries}`);

  } catch (error) {
    console.error('❌ Error creating journal entries:', error);
  }
};

const main = async () => {
  try {
    await connectDB();
    await createSampleJournalEntries();
    console.log('\n🎯 Journal entries seeding completed!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

main();
