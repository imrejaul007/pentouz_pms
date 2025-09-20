import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ChartOfAccounts from './src/models/ChartOfAccounts.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('Database connected for checking Chart of Accounts');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const checkChartOfAccounts = async () => {
  try {
    // Check total count
    const totalAccounts = await ChartOfAccounts.countDocuments();
    console.log(`📊 Total Chart of Accounts in database: ${totalAccounts}`);

    if (totalAccounts === 0) {
      console.log('❌ No Chart of Accounts found in database');
      return;
    }

    // Get all accounts
    const accounts = await ChartOfAccounts.find().sort({ accountCode: 1 });
    
    console.log('📝 Chart of Accounts found:');
    accounts.forEach((account, index) => {
      console.log(`  ${index + 1}. ${account.accountCode} - ${account.accountName}`);
      console.log(`     Type: ${account.accountType}`);
      console.log(`     Category: ${account.category}`);
      console.log(`     Balance: ₹${account.balance?.toLocaleString() || '0'}`);
      console.log(`     Active: ${account.isActive ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Find specific account types
    const revenueAccounts = accounts.filter(acc => acc.accountType === 'revenue');
    const expenseAccounts = accounts.filter(acc => acc.accountType === 'expense');
    const assetAccounts = accounts.filter(acc => acc.accountType === 'asset');
    
    console.log('📊 Account Type Summary:');
    console.log(`  Revenue Accounts: ${revenueAccounts.length}`);
    console.log(`  Expense Accounts: ${expenseAccounts.length}`);
    console.log(`  Asset Accounts: ${assetAccounts.length}`);
    
    if (revenueAccounts.length > 0) {
      console.log('\n💰 Revenue Accounts:');
      revenueAccounts.forEach(acc => {
        console.log(`    - ${acc.accountCode}: ${acc.accountName}`);
      });
    }
    
    if (expenseAccounts.length > 0) {
      console.log('\n💸 Expense Accounts:');
      expenseAccounts.forEach(acc => {
        console.log(`    - ${acc.accountCode}: ${acc.accountName}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking Chart of Accounts:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

const main = async () => {
  await connectDB();
  await checkChartOfAccounts();
};

main();
