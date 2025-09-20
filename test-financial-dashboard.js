import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ChartOfAccounts from './src/models/ChartOfAccounts.js';
import Hotel from './src/models/Hotel.js';
import FinancialService from './src/services/financialService.js';

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

const testFinancialDashboard = async () => {
  try {
    await connectDB();
    
    console.log('\n=== TESTING FINANCIAL DATA ===\n');
    
    // Get first hotel
    const hotel = await Hotel.findOne();
    console.log('Hotel found:', hotel ? hotel.name : 'No hotel found');
    
    if (!hotel) {
      console.log('No hotel found. Please run the seeding script first.');
      return;
    }
    
    // Get all chart of accounts for this hotel
    const accounts = await ChartOfAccounts.find({ hotelId: hotel._id });
    console.log(`\nChart of Accounts found: ${accounts.length}`);
    
    if (accounts.length === 0) {
      console.log('No accounts found. Please run the financial seeding script.');
      return;
    }
    
    // Show account details
    console.log('\n=== ACCOUNT DETAILS ===');
    accounts.forEach(account => {
      console.log(`${account.accountCode} - ${account.accountName}: ${account.accountType} = ₹${account.currentBalance}`);
    });
    
    // Test financial service
    console.log('\n=== TESTING FINANCIAL SERVICE ===');
    const financialService = new FinancialService();
    
    try {
      const dashboard = await financialService.generateFinancialDashboard('month', hotel._id);
      console.log('\nDashboard Data:', JSON.stringify(dashboard, null, 2));
    } catch (error) {
      console.error('Error generating dashboard:', error.message);
      console.error('Stack:', error.stack);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

testFinancialDashboard();
