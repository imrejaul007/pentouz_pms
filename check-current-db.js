import mongoose from 'mongoose';

const checkCurrentDB = async () => {
  try {
    // Connect to the same database that the backend is using
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';
    console.log('🔗 Connecting to:', mongoUri);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Get current database info
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log('📊 Current Database:', dbName);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('📁 Collections found:', collections.length);
    
    collections.forEach(collection => {
      console.log(`  - ${collection.name}`);
    });
    
    // Check if chartofaccounts collection exists and has data
    if (collections.find(c => c.name === 'chartofaccounts')) {
      const chartOfAccounts = db.collection('chartofaccounts');
      const count = await chartOfAccounts.countDocuments();
      console.log(`📊 Chart of Accounts documents: ${count}`);
      
      if (count > 0) {
        const sample = await chartOfAccounts.findOne();
        console.log('📝 Sample document:', {
          _id: sample._id,
          accountName: sample.accountName,
          accountCode: sample.accountCode,
          hotelId: sample.hotelId
        });
      }
    } else {
      console.log('❌ chartofaccounts collection not found');
    }
    
    // Check if bankaccounts collection exists and has data
    if (collections.find(c => c.name === 'bankaccounts')) {
      const bankAccounts = db.collection('bankaccounts');
      const count = await bankAccounts.countDocuments();
      console.log(`🏦 Bank Accounts documents: ${count}`);
    } else {
      console.log('❌ bankaccounts collection not found');
    }
    
    // Check if journalentries collection exists and has data
    if (collections.find(c => c.name === 'journalentries')) {
      const journalEntries = db.collection('journalentries');
      const count = await journalEntries.countDocuments();
      console.log(`📝 Journal Entries documents: ${count}`);
    } else {
      console.log('❌ journalentries collection not found');
    }
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

checkCurrentDB();
