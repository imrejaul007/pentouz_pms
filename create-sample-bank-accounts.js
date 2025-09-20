import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BankAccount from './src/models/BankAccount.js';
import ChartOfAccounts from './src/models/ChartOfAccounts.js';
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('Database connected for bank accounts seeding');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const createSampleBankAccounts = async () => {
  try {
    // Get existing data
    const adminUser = await User.findOne({ role: 'admin' });
    const hotel = await Hotel.findOne();
    const cashAccount = await ChartOfAccounts.findOne({ accountCode: '1110' }); // Cash and Bank account
    
    if (!adminUser || !hotel || !cashAccount) {
      console.log('❌ Required data not found. Please run seed-financial.js first.');
      return;
    }

    console.log('🏦 Creating sample bank accounts...');

    const sampleBankAccounts = [
      {
        accountNumber: 'SB0012345678',
        accountName: 'Main Business Account',
        bankName: 'State Bank of India',
        accountType: 'Savings',
        currency: 'INR',
        openingBalance: 500000,
        openingDate: new Date('2024-01-01'),
        glAccountId: cashAccount._id,
        branchName: 'Main Branch',
        ifscCode: 'SBIN0001234',
        swiftCode: 'SBININBB123',
        isPrimary: true,
        isActive: true,
        hotelId: hotel._id,
        createdBy: adminUser._id,
        currentBalance: 500000
      },
      {
        accountNumber: 'CB0098765432',
        accountName: 'Operating Expenses Account',
        bankName: 'HDFC Bank',
        accountType: 'Checking',
        currency: 'INR',
        openingBalance: 200000,
        openingDate: new Date('2024-01-01'),
        glAccountId: cashAccount._id,
        branchName: 'City Center Branch',
        ifscCode: 'HDFC0001234',
        swiftCode: 'HDFCINBB123',
        isPrimary: false,
        isActive: true,
        hotelId: hotel._id,
        createdBy: adminUser._id,
        currentBalance: 200000
      },
      {
        accountNumber: 'FD0011223344',
        accountName: 'Fixed Deposit Account',
        bankName: 'ICICI Bank',
        accountType: 'Investment',
        currency: 'INR',
        openingBalance: 1000000,
        openingDate: new Date('2024-01-01'),
        glAccountId: cashAccount._id,
        branchName: 'Corporate Branch',
        ifscCode: 'ICIC0001234',
        swiftCode: 'ICICINBB123',
        isPrimary: false,
        isActive: true,
        hotelId: hotel._id,
        createdBy: adminUser._id,
        currentBalance: 1000000,
        maturityDate: new Date('2025-01-01'),
        interestRate: 6.5
      }
    ];

    // Clear existing bank accounts
    await BankAccount.deleteMany({});
    console.log('🗑️ Cleared existing bank accounts');

    // Create new bank accounts
    const createdAccounts = await BankAccount.insertMany(sampleBankAccounts);
    
    console.log('✅ Successfully created bank accounts:');
    createdAccounts.forEach((account, index) => {
      console.log(`  ${index + 1}. ${account.accountName} - ${account.bankName}`);
      console.log(`     Account: ${account.accountNumber}`);
      console.log(`     Balance: ₹${account.currentBalance.toLocaleString()}`);
      console.log(`     Type: ${account.accountType}`);
      console.log('');
    });

    console.log(`🎯 Total bank accounts created: ${createdAccounts.length}`);
    
  } catch (error) {
    console.error('❌ Error creating bank accounts:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

const main = async () => {
  await connectDB();
  await createSampleBankAccounts();
};

main();
