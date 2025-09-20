import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from '../models/Booking.js';
import KPI from '../models/KPI.js';
import logger from '../utils/logger.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    logger.info('Database connected for debugging');
  } catch (error) {
    logger.error('Database connection failed:', error);
    process.exit(1);
  }
};

const debugKPIs = async () => {
  try {
    // Get the hotel ID
    const hotelId = '68b54c3ee4ece2394a618e2f';
    
    // Check bookings
    console.log('\n=== BOOKING DATA ===');
    const bookings = await Booking.find({ hotelId });
    console.log(`Total bookings: ${bookings.length}`);
    
    const confirmedBookings = await Booking.find({ 
      hotelId, 
      status: { $in: ['confirmed', 'checked_in', 'checked_out'] } 
    });
    console.log(`Confirmed bookings: ${confirmedBookings.length}`);
    
    // Show sample bookings
    if (bookings.length > 0) {
      console.log('\nSample booking data:');
      const sampleBooking = bookings[0];
      console.log({
        id: sampleBooking._id,
        status: sampleBooking.status,
        checkIn: sampleBooking.checkIn,
        checkOut: sampleBooking.checkOut,
        nights: sampleBooking.nights,
        rooms: sampleBooking.rooms?.length || 0,
        totalAmount: sampleBooking.totalAmount
      });
    }
    
    // Check KPI data
    console.log('\n=== KPI DATA ===');
    const kpis = await KPI.find({ hotelId }).sort({ date: -1 }).limit(1);
    if (kpis.length > 0) {
      const kpi = kpis[0];
      console.log('Latest KPI data:');
      console.log({
        date: kpi.date,
        period: kpi.period,
        roomRevenue: kpi.revenue.roomRevenue,
        roomNightsSold: kpi.occupancy.roomNightsSold,
        availableRoomNights: kpi.occupancy.availableRoomNights,
        occupancyRate: kpi.occupancy.occupancyRate,
        adr: kpi.rates.adr,
        gop: kpi.profitability.gop,
        operatingExpenses: kpi.profitability.operatingExpenses,
        roomDirectCosts: kpi.profitability.roomDirectCosts
      });
    } else {
      console.log('No KPI data found');
    }
    
    // Manual aggregation test for current month
    console.log('\n=== MANUAL OCCUPANCY TEST ===');
    const currentDate = new Date();
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);
    
    console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const testPipeline = [
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          status: { $in: ['confirmed', 'checked_in', 'checked_out'] },
          $or: [
            { checkIn: { $gte: startDate, $lte: endDate } },
            { checkOut: { $gte: startDate, $lte: endDate } },
            { checkIn: { $lte: startDate }, checkOut: { $gte: endDate } }
          ]
        }
      },
      {
        $addFields: {
          roomNights: {
            $multiply: [
              { $size: '$rooms' },
              '$nights'
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRoomNights: { $sum: '$roomNights' },
          bookingCount: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ];
    
    const result = await Booking.aggregate(testPipeline);
    console.log('Manual aggregation result:', result[0] || { message: 'No matching bookings' });
    
  } catch (error) {
    logger.error('Debug failed:', error);
    throw error;
  }
};

const main = async () => {
  await connectDB();
  await debugKPIs();
  await mongoose.connection.close();
  process.exit(0);
};

main().catch((error) => {
  logger.error('Debug process failed:', error);
  process.exit(1);
});