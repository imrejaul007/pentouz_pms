import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Correct hotel ID and room type IDs
const HOTEL_ID = '68bc094f80c86bfe258e172b';

const ROOM_TYPES = [
  {
    _id: '68bc094f80c86bfe258e1731',
    code: 'STD',
    name: 'Standard Room',
    totalRooms: 40,
    baseRate: 2500
  },
  {
    _id: '68bc094f80c86bfe258e1736',
    code: 'DLX', 
    name: 'Deluxe Room',
    totalRooms: 30,
    baseRate: 3500
  },
  {
    _id: '68bc094f80c86bfe258e173d',
    code: 'STE',
    name: 'Premium Suite',
    totalRooms: 10,
    baseRate: 8000
  },
  {
    _id: '68bc094f80c86bfe258e1746',
    code: 'EXE',
    name: 'Executive Deluxe',
    totalRooms: 20,
    baseRate: 6000
  }
];

// Define schema
const roomTypeAllotmentSchema = new mongoose.Schema({
  roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
  date: { type: Date, required: true },
  totalRooms: { type: Number, required: true },
  availableRooms: { type: Number, required: true },
  bookedRooms: { type: Number, default: 0 },
  blockedRooms: { type: Number, default: 0 },
  rate: { type: Number, required: true },
  minimumStay: { type: Number, default: 1 },
  maximumStay: { type: Number },
  stopSell: { type: Boolean, default: false },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' }
}, { collection: 'roomtypeallotments' });

const RoomTypeAllotment = mongoose.model('RoomTypeAllotment', roomTypeAllotmentSchema);

async function seedAllotments() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB successfully\n');

    // Clear existing allotments for this hotel
    console.log('=== CLEANING EXISTING ALLOTMENTS ===');
    const deleteResult = await RoomTypeAllotment.deleteMany({ 
      hotelId: new mongoose.Types.ObjectId(HOTEL_ID) 
    });
    console.log(`Deleted ${deleteResult.deletedCount} existing allotments for hotel ${HOTEL_ID}\n`);

    // Generate allotments for next 30 days
    const startDate = new Date();
    const allotments = [];

    console.log('=== CREATING NEW ALLOTMENTS ===');
    
    for (const roomType of ROOM_TYPES) {
      console.log(`Creating allotments for ${roomType.name} (${roomType.code})...`);
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        
        // Calculate availability (keeping some rooms booked for realistic data)
        const totalRooms = roomType.totalRooms;
        const bookedRooms = Math.floor(Math.random() * (totalRooms * 0.7)); // Random bookings up to 70%
        const blockedRooms = Math.floor(Math.random() * 3); // Random blocked rooms (0-2)
        const availableRooms = totalRooms - bookedRooms - blockedRooms;
        
        // Calculate rate with some variation
        const baseRate = roomType.baseRate;
        const rateVariation = Math.random() * 0.2 - 0.1; // ±10% variation
        const rate = Math.round(baseRate * (1 + rateVariation));

        const allotment = {
          roomTypeId: new mongoose.Types.ObjectId(roomType._id),
          hotelId: new mongoose.Types.ObjectId(HOTEL_ID),
          date: date,
          totalRooms: totalRooms,
          availableRooms: Math.max(0, availableRooms), // Ensure non-negative
          bookedRooms: bookedRooms,
          blockedRooms: blockedRooms,
          rate: rate,
          minimumStay: 1,
          maximumStay: 14,
          stopSell: false
        };

        allotments.push(allotment);
      }
    }

    // Insert all allotments
    console.log(`\nInserting ${allotments.length} new allotments...`);
    const insertResult = await RoomTypeAllotment.insertMany(allotments);
    console.log(`Successfully inserted ${insertResult.length} allotments\n`);

    // Display summary
    console.log('=== SUMMARY ===');
    for (const roomType of ROOM_TYPES) {
      const count = await RoomTypeAllotment.countDocuments({
        roomTypeId: new mongoose.Types.ObjectId(roomType._id),
        hotelId: new mongoose.Types.ObjectId(HOTEL_ID)
      });
      console.log(`${roomType.name}: ${count} allotments created`);
    }

    // Show sample data
    console.log('\n=== SAMPLE ALLOTMENTS ===');
    const sampleAllotments = await RoomTypeAllotment.find({
      hotelId: new mongoose.Types.ObjectId(HOTEL_ID)
    })
    .populate('roomTypeId', 'name code')
    .limit(5)
    .lean();

    sampleAllotments.forEach((allotment, index) => {
      console.log(`${index + 1}. ${allotment.roomTypeId?.name || 'Unknown'} - ${new Date(allotment.date).toLocaleDateString()}`);
      console.log(`   Total: ${allotment.totalRooms}, Available: ${allotment.availableRooms}, Booked: ${allotment.bookedRooms}, Rate: $${allotment.rate}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

seedAllotments();