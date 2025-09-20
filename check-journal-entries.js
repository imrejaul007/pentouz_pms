import mongoose from 'mongoose';
import dotenv from 'dotenv';
import JournalEntry from './src/models/JournalEntry.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('Database connected for checking journal entries');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const checkJournalEntries = async () => {
  try {
    // Check total count
    const totalEntries = await JournalEntry.countDocuments();
    console.log(`📊 Total journal entries in database: ${totalEntries}`);

    if (totalEntries === 0) {
      console.log('❌ No journal entries found in database');
      return;
    }

    // Get all entries without population
    const entries = await JournalEntry.find({});
    console.log('\n📝 Journal Entries found:');
    
    entries.forEach((entry, index) => {
      console.log(`\n${index + 1}. Entry: ${entry.entryNumber}`);
      console.log(`   Description: ${entry.description}`);
      console.log(`   Date: ${entry.entryDate}`);
      console.log(`   Status: ${entry.status}`);
      console.log(`   Total Debit: ${entry.totalDebit}`);
      console.log(`   Total Credit: ${entry.totalCredit}`);
      console.log(`   Lines: ${entry.lines.length}`);
      console.log(`   Created By: ${entry.createdBy}`);
      console.log(`   Hotel ID: ${entry.hotelId}`);
    });

    // Check the first entry in detail
    if (entries.length > 0) {
      const firstEntry = entries[0];
      console.log('\n🔍 First Entry Details (simplified):');
      console.log({
        _id: firstEntry._id,
        entryNumber: firstEntry.entryNumber,
        description: firstEntry.description,
        entryDate: firstEntry.entryDate,
        status: firstEntry.status,
        totalDebit: firstEntry.totalDebit,
        totalCredit: firstEntry.totalCredit,
        lines: firstEntry.lines.length,
        hotelId: firstEntry.hotelId,
        createdBy: firstEntry.createdBy
      });
    }

  } catch (error) {
    console.error('❌ Error checking journal entries:', error);
  }
};

const main = async () => {
  try {
    await connectDB();
    await checkJournalEntries();
    console.log('\n🎯 Journal entries check completed!');
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

main();
