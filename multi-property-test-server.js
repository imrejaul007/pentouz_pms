import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management';
const JWT_SECRET = 'df8f6b41c5144d8e074db699cdf3bda1f370f61975f6cf80d635a6fd3cca7197';

// Simple auth middleware (for testing)
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Login endpoint for testing
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // For testing, create a dummy user token
    const user = {
      id: 'test-user-id',
      email: email || 'admin@hotel.com',
      role: 'admin',
      hotelId: '68cd01414419c17b5f6b4c12'
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      data: {
        token,
        user
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Get hotels endpoint (for Multi-Property Manager)
app.get('/api/v1/admin/hotels', authenticate, async (req, res) => {
  try {
    console.log('🏨 Fetching hotels...');

    const hotels = await mongoose.connection.db.collection('hotels').find({}).toArray();

    console.log(`✅ Found ${hotels.length} hotels`);

    res.json({
      success: true,
      data: {
        hotels: hotels,
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_count: hotels.length,
          per_page: hotels.length
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching hotels:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hotels',
      error: error.message
    });
  }
});

// Hotel metrics endpoint (authenticated)
app.get('/api/v1/analytics/hotel/:hotelId/metrics', authenticate, async (req, res) => {
  try {
    const { hotelId } = req.params;
    console.log(`🏨 HOTEL METRICS - Fetching metrics for hotel ${hotelId}`);

    // Get hotel information
    const hotel = await mongoose.connection.db.collection('hotels').findOne({
      _id: new mongoose.Types.ObjectId(hotelId)
    });

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found'
      });
    }

    console.log(`🏨 Found hotel: ${hotel.name}`);

    // Get total rooms
    const totalRooms = await mongoose.connection.db.collection('rooms').countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isActive: true
    });

    console.log(`🏠 Total rooms: ${totalRooms}`);

    // Get current date
    const today = new Date();

    // Get current bookings (for occupancy calculation)
    const currentBookings = await mongoose.connection.db.collection('bookings').find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      checkIn: { $lte: today },
      checkOut: { $gt: today },
      status: { $in: ['confirmed', 'checked_in'] }
    }).toArray();

    const occupiedRooms = currentBookings.length;
    const availableRooms = totalRooms - occupiedRooms;
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    console.log(`📊 Occupancy: ${occupiedRooms}/${totalRooms} = ${occupancyRate}%`);

    // Get this month's bookings for revenue calculation
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const periodBookings = await mongoose.connection.db.collection('bookings').find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      $or: [
        { checkIn: { $gte: startOfMonth, $lte: today } },
        { checkOut: { $gte: startOfMonth, $lte: today } },
        {
          checkIn: { $lt: startOfMonth },
          checkOut: { $gt: today }
        }
      ],
      status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
    }).toArray();

    // Calculate revenue metrics
    const totalRevenue = periodBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    const totalRoomNights = periodBookings.reduce((sum, booking) => {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      return sum + Math.max(1, nights);
    }, 0);

    const averageDailyRate = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;
    const revenuePerAvailableRoom = totalRooms > 0 ? totalRevenue / totalRooms : 0;

    console.log(`💰 Revenue: ₹${totalRevenue}, ADR: ₹${averageDailyRate}, RevPAR: ₹${revenuePerAvailableRoom}`);

    const metrics = {
      occupiedRooms,
      availableRooms,
      oooRooms: 0, // Simplified for testing
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      averageDailyRate: Math.round(averageDailyRate),
      revenuePerAvailableRoom: Math.round(revenuePerAvailableRoom),
      totalRevenue: Math.round(totalRevenue),
      lastMonth: {
        occupancyRate: Math.max(0, Math.round((occupancyRate - 5) * 100) / 100),
        averageDailyRate: Math.round(averageDailyRate * 0.9),
        revenuePerAvailableRoom: Math.round(revenuePerAvailableRoom * 0.9),
        totalRevenue: Math.round(totalRevenue * 0.9)
      }
    };

    console.log(`✅ Returning metrics:`, metrics);

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    console.error('❌ Error fetching hotel metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hotel metrics',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'Multi-Property test server is running!',
    timestamp: new Date().toISOString()
  });
});

// Start server
async function startServer() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const PORT = 4002; // Use different port to avoid conflicts
    app.listen(PORT, () => {
      console.log(`🚀 Multi-Property test server running on http://localhost:${PORT}`);
      console.log(`🏨 Hotels endpoint: http://localhost:${PORT}/api/v1/admin/hotels`);
      console.log(`📊 Analytics endpoint: http://localhost:${PORT}/api/v1/analytics/hotel/{hotelId}/metrics`);
      console.log(`🔐 Login endpoint: http://localhost:${PORT}/api/v1/auth/login`);
      console.log(`🧪 Health endpoint: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
  }
}

startServer();