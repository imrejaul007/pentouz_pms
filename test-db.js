import mongoose from 'mongoose';
import ChartOfAccounts from './src/models/ChartOfAccounts.js';

async function testDatabase() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hotel_management');
    console.log('✅ Connected to database');
    
    const count = await ChartOfAccounts.countDocuments();
    console.log('📊 Total Chart of Accounts:', count);
    
    if (count > 0) {
      const accounts = await ChartOfAccounts.find().limit(5);
      console.log('💰 Sample accounts:');
      accounts.forEach(acc => {
        console.log(`  - ${acc.accountCode}: ${acc.accountName} (${acc.accountType}) - Hotel: ${acc.hotelId}`);
      });
    } else {
      console.log('❌ No Chart of Accounts found in database');
    }
    
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDatabase();
