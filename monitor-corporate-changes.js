#!/usr/bin/env node

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔍 Starting Corporate Data Monitor...');
console.log('📡 Monitoring changes to corporatecompanies and corporatecredits collections');

async function monitorChanges() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Monitor corporate companies collection
    const companiesChangeStream = db.collection('corporatecompanies').watch([
      { $match: { operationType: { $in: ['update', 'delete', 'replace'] } } }
    ]);

    // Monitor corporate credits collection
    const creditsChangeStream = db.collection('corporatecredits').watch([
      { $match: { operationType: { $in: ['update', 'delete', 'replace'] } } }
    ]);

    companiesChangeStream.on('change', (change) => {
      console.log('\n🚨 CORPORATE COMPANY CHANGE DETECTED:');
      console.log('Operation:', change.operationType);
      console.log('Document ID:', change.documentKey._id);
      console.log('Timestamp:', new Date().toISOString());

      if (change.updateDescription) {
        console.log('Updated Fields:', change.updateDescription.updatedFields);
        console.log('Removed Fields:', change.updateDescription.removedFields);

        // Check if isActive was changed to false
        if (change.updateDescription.updatedFields?.isActive === false) {
          console.log('🔴 WARNING: Company was deactivated!');
        }
      }

      if (change.fullDocument) {
        console.log('Company Name:', change.fullDocument.name);
        console.log('Is Active:', change.fullDocument.isActive);
      }

      console.log('---');
    });

    creditsChangeStream.on('change', (change) => {
      console.log('\n💳 CORPORATE CREDIT CHANGE DETECTED:');
      console.log('Operation:', change.operationType);
      console.log('Document ID:', change.documentKey._id);
      console.log('Timestamp:', new Date().toISOString());

      if (change.updateDescription) {
        console.log('Updated Fields:', change.updateDescription.updatedFields);
      }
      console.log('---');
    });

    console.log('🎯 Monitor active. Press Ctrl+C to stop...');
    console.log('⏰ Checking current data every 30 seconds...');

    // Periodic check
    setInterval(async () => {
      try {
        const companiesCount = await db.collection('corporatecompanies').countDocuments();
        const creditsCount = await db.collection('corporatecredits').countDocuments();
        const activeCompanies = await db.collection('corporatecompanies').countDocuments({ isActive: true });

        console.log(`📊 [${new Date().toISOString()}] Companies: ${companiesCount} (${activeCompanies} active) | Credits: ${creditsCount}`);
      } catch (error) {
        console.error('Error during periodic check:', error);
      }
    }, 30000);

  } catch (error) {
    console.error('❌ Monitor failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down monitor...');
  mongoose.connection.close();
  process.exit(0);
});

monitorChanges();