import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BankAccount from './src/models/BankAccount.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Database connected for checking bank accounts');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const checkBankAccounts = async () => {
  try {
    await connectDB();
    
    console.log('🔍 Checking bank accounts in database...');
    
    const accounts = await BankAccount.find({});
    console.log(`📊 Total Bank Accounts in database: ${accounts.length}`);
    
    if (accounts.length > 0) {
      console.log('📝 Bank Accounts found:');
      accounts.forEach((account, index) => {
        console.log(`  ${index + 1}. ${account.accountName}`);
        console.log(`     Account Number: ${account.accountNumber}`);
        console.log(`     Type: ${account.accountType}`);
        console.log(`     Balance: ₹${account.currentBalance}`);
        console.log(`     Bank: ${account.bankName}`);
        console.log(`     Active: ${account.isActive ? 'Yes' : 'No'}`);
        console.log(`     Primary: ${account.isPrimary ? 'Yes' : 'No'}`);
        console.log(`     Hotel ID: ${account.hotelId}`);
        console.log('');
      });
    } else {
      console.log('❌ No bank accounts found in database');
    }
    
    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📚 Available collections:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking bank accounts:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

checkBankAccounts();
