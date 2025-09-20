import mongoose from 'mongoose';
import WaitingList from './src/models/WaitingList.js';

const MONGO_URI = "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function checkWaitingList() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const count = await WaitingList.countDocuments();
    console.log(`Waiting List entries in database: ${count}`);

    if (count > 0) {
      const entries = await WaitingList.find().limit(5);
      console.log('Sample entries:');
      entries.forEach((entry, idx) => {
        console.log(`${idx + 1}. ${entry.guestName} - ${entry.roomType} - ${entry.status}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

checkWaitingList();