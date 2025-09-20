import mongoose from 'mongoose';

const MONGO_URI = "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI);

const bookingSchema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, required: true },
  guestId: { type: mongoose.Schema.Types.ObjectId, required: true },
  rooms: [{
    roomId: { type: mongoose.Schema.Types.ObjectId, required: true },
    rate: Number
  }],
  checkIn: Date,
  checkOut: Date,
  totalAmount: Number,
  nights: Number,
  status: String,
  roomType: String,
  createdAt: { type: Date, default: Date.now }
});

const Booking = mongoose.model('Booking', bookingSchema);

async function createSampleBookings() {
  const hotelId = new mongoose.Types.ObjectId('68c79dd0a3918994a8e852da');
  const guestId = new mongoose.Types.ObjectId();
  
  const bookings = [
    {
      hotelId,
      guestId,
      rooms: [{ roomId: new mongoose.Types.ObjectId(), rate: 3500 }],
      checkIn: new Date('2025-09-10'),
      checkOut: new Date('2025-09-12'),
      totalAmount: 7000,
      nights: 2,
      status: 'checked_out',
      roomType: 'double'
    },
    {
      hotelId,
      guestId,
      rooms: [{ roomId: new mongoose.Types.ObjectId(), rate: 6000 }],
      checkIn: new Date('2025-09-08'),
      checkOut: new Date('2025-09-11'),
      totalAmount: 18000,
      nights: 3,
      status: 'checked_out',
      roomType: 'deluxe'
    },
    {
      hotelId,
      guestId,
      rooms: [{ roomId: new mongoose.Types.ObjectId(), rate: 2500 }],
      checkIn: new Date('2025-09-12'),
      checkOut: new Date('2025-09-14'),
      totalAmount: 5000,
      nights: 2,
      status: 'checked_out',
      roomType: 'single'
    },
    {
      hotelId,
      guestId,
      rooms: [{ roomId: new mongoose.Types.ObjectId(), rate: 4000 }],
      checkIn: new Date('2025-09-05'),
      checkOut: new Date('2025-09-08'),
      totalAmount: 12000,
      nights: 3,
      status: 'checked_out',
      roomType: 'double'
    },
    {
      hotelId,
      guestId,
      rooms: [{ roomId: new mongoose.Types.ObjectId(), rate: 8000 }],
      checkIn: new Date('2025-09-01'),
      checkOut: new Date('2025-09-05'),
      totalAmount: 32000,
      nights: 4,
      status: 'checked_out',
      roomType: 'suite'
    }
  ];

  await Booking.deleteMany({ hotelId });
  await Booking.insertMany(bookings);
  
  console.log('Sample bookings created:', bookings.length);
  console.log('Total revenue:', bookings.reduce((sum, b) => sum + b.totalAmount, 0));
  
  mongoose.disconnect();
}

createSampleBookings().catch(console.error);
