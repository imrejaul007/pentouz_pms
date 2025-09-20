import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { BookingComConnector } from '../services/bookingComConnector.js';

const router = express.Router();

// Quick setup endpoint for testing - enable Booking.com integration
router.post('/setup/:hotelId', 
  authenticate, 
  authorize('admin'), 
  catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    
    try {
      const Hotel = (await import('../models/Hotel.js')).default;
      const hotel = await Hotel.findById(hotelId);
      
      if (!hotel) {
        throw new ApplicationError('Hotel not found', 404);
      }

      // Initialize and enable Booking.com integration for demo
      hotel.otaConnections = {
        bookingCom: {
          isEnabled: true,
          credentials: {
            clientId: 'demo_client_id',
            clientSecret: 'demo_client_secret',
            hotelId: 'booking_com_hotel_123'
          },
          lastSync: null
        }
      };
      
      await hotel.save();

      res.json({
        status: 'success',
        data: {
          message: 'Booking.com integration enabled for demo',
          hotelId: hotelId
        }
      });
    } catch (error) {
      throw new ApplicationError(`Setup failed: ${error.message}`, 500);
    }
  })
);

// Manual sync trigger for Booking.com
router.post('/bookingcom/sync', 
  authenticate, 
  authorize('admin'), 
  catchAsync(async (req, res) => {
    const { hotelId } = req.body;
    
    if (!hotelId) {
      throw new ApplicationError('Hotel ID is required', 400);
    }

    try {
      const connector = new BookingComConnector();
      const result = await connector.syncAvailability(hotelId);

      res.json({
        status: 'success',
        data: {
          message: 'Sync initiated successfully',
          syncId: result.syncId,
          estimatedCompletion: result.estimatedCompletion
        }
      });
    } catch (error) {
      throw new ApplicationError(`Sync failed: ${error.message}`, 500);
    }
  })
);

// Get Booking.com sync status
router.get('/bookingcom/status/:hotelId', 
  authenticate, 
  authorize('admin', 'staff'), 
  catchAsync(async (req, res) => {
    const { hotelId } = req.params;

    try {
      const connector = new BookingComConnector();
      const status = await connector.getSyncStatus(hotelId);

      res.json({
        status: 'success',
        data: status
      });
    } catch (error) {
      throw new ApplicationError(`Failed to get sync status: ${error.message}`, 500);
    }
  })
);

// Get OTA sync history
router.get('/sync-history', 
  authenticate, 
  authorize('admin', 'staff'), 
  catchAsync(async (req, res) => {
    const { hotelId, page = 1, limit = 10, provider, status } = req.query;

    try {
      const SyncHistory = (await import('../models/SyncHistory.js')).default;
      
      // Build query filters
      const filters = {};
      if (hotelId) filters.hotelId = hotelId;
      if (provider) filters.provider = provider;
      if (status) filters.status = status;

      // Execute paginated query
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [history, total] = await Promise.all([
        SyncHistory.find(filters)
          .sort({ startedAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('hotelId', 'name')
          .lean(),
        SyncHistory.countDocuments(filters)
      ]);

      // Transform data for frontend
      const transformedHistory = history.map(record => ({
        id: record._id,
        hotelId: record.hotelId._id,
        hotelName: record.hotelId.name,
        provider: record.provider,
        type: record.type,
        status: record.status,
        startedAt: record.startedAt,
        completedAt: record.completedAt,
        roomsUpdated: record.roomsUpdated,
        bookingsReceived: record.bookingsReceived,
        errors: record.errors?.map(err => err.message) || [],
        duration: record.metadata?.duration,
        syncId: record.syncId
      }));

      const pages = Math.ceil(total / parseInt(limit));

      res.json({
        status: 'success',
        data: {
          history: transformedHistory,
          pagination: {
            current: parseInt(page),
            pages: pages,
            total: total
          }
        }
      });
    } catch (error) {
      throw new ApplicationError(`Failed to get sync history: ${error.message}`, 500);
    }
  })
);

// Get OTA configuration for a hotel
router.get('/config/:hotelId',
  authenticate,
  authorize('admin'),
  catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    
    try {
      // Try to get actual hotel configuration
      const Hotel = (await import('../models/Hotel.js')).default;
      const hotel = await Hotel.findById(hotelId);
      
      if (!hotel) {
        throw new ApplicationError('Hotel not found', 404);
      }
      
      // Initialize OTA connections if they don't exist
      if (!hotel.otaConnections) {
        hotel.otaConnections = {
          bookingCom: {
            isEnabled: false,
            credentials: {},
            lastSync: null
          }
        };
        await hotel.save();
      }
      
      const config = {
        bookingCom: {
          enabled: hotel.otaConnections.bookingCom?.isEnabled || false,
          hotelId: hotel.otaConnections.bookingCom?.credentials?.hotelId || '',
          lastSync: hotel.otaConnections.bookingCom?.lastSync || null,
          syncFrequency: '1h', // This could be stored in hotel config
          autoSync: true, // This could be stored in hotel config
          webhookEnabled: true, // This could be stored in hotel config
          webhookUrl: `${process.env.BASE_URL || 'http://localhost:4000'}/api/v1/webhooks/booking-com`
        },
        expedia: {
          enabled: false,
          hotelId: '',
          lastSync: null,
          syncFrequency: '1h',
          autoSync: false,
          webhookEnabled: false,
          webhookUrl: ''
        },
        airbnb: {
          enabled: false,
          hotelId: '',
          lastSync: null,
          syncFrequency: '1h',
          autoSync: false,
          webhookEnabled: false,
          webhookUrl: ''
        }
      };

      res.json({
        status: 'success',
        data: { config }
      });
    } catch (error) {
      throw new ApplicationError(`Failed to get OTA configuration: ${error.message}`, 500);
    }
  })
);

// Update OTA configuration
router.patch('/config/:hotelId',
  authenticate,
  authorize('admin'),
  catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const { provider, config } = req.body;

    if (!provider || !config) {
      throw new ApplicationError('Provider and configuration are required', 400);
    }

    try {
      const Hotel = (await import('../models/Hotel.js')).default;
      const hotel = await Hotel.findById(hotelId);
      
      if (!hotel) {
        throw new ApplicationError('Hotel not found', 404);
      }

      // Initialize OTA connections if they don't exist
      if (!hotel.otaConnections) {
        hotel.otaConnections = {};
      }

      // Update the specific provider configuration
      if (provider === 'bookingCom') {
        hotel.otaConnections.bookingCom = {
          isEnabled: config.enabled || false,
          credentials: {
            clientId: config.clientId || '',
            clientSecret: config.clientSecret || '',
            hotelId: config.hotelId || ''
          },
          lastSync: hotel.otaConnections.bookingCom?.lastSync || null
        };
      }
      // Add other providers as needed
      
      await hotel.save();

      res.json({
        status: 'success',
        data: {
          message: `${provider} configuration updated successfully`,
          config: hotel.otaConnections[provider]
        }
      });
    } catch (error) {
      throw new ApplicationError(`Failed to update OTA configuration: ${error.message}`, 500);
    }
  })
);

// Get OTA statistics
router.get('/stats/:hotelId',
  authenticate,
  authorize('admin', 'staff'),
  catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    
    try {
      const SyncHistory = (await import('../models/SyncHistory.js')).default;
      const Hotel = (await import('../models/Hotel.js')).default;

      // Get hotel and check active providers
      const hotel = await Hotel.findById(hotelId);
      if (!hotel) {
        throw new ApplicationError('Hotel not found', 404);
      }

      const activeProviders = [];
      const totalProviders = 3; // booking.com, expedia, airbnb
      
      if (hotel.otaConnections?.bookingCom?.isEnabled) activeProviders.push('booking_com');
      if (hotel.otaConnections?.expedia?.isEnabled) activeProviders.push('expedia');
      if (hotel.otaConnections?.airbnb?.isEnabled) activeProviders.push('airbnb');

      // Calculate real statistics from sync history
      const [
        totalSyncs,
        successfulSyncs,
        failedSyncs,
        lastSync,
        avgDuration,
        todayBookings,
        weekBookings,
        monthBookings,
        totalRoomsUpdated
      ] = await Promise.all([
        SyncHistory.countDocuments({ hotelId }),
        SyncHistory.countDocuments({ hotelId, status: 'completed' }),
        SyncHistory.countDocuments({ hotelId, status: 'failed' }),
        SyncHistory.findOne({ hotelId }).sort({ startedAt: -1 }).select('startedAt'),
        SyncHistory.aggregate([
          { $match: { hotelId: hotel._id, status: 'completed', 'metadata.duration': { $exists: true } } },
          { $group: { _id: null, avgDuration: { $avg: '$metadata.duration' } } }
        ]),
        SyncHistory.aggregate([
          { 
            $match: { 
              hotelId: hotel._id, 
              startedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            } 
          },
          { $group: { _id: null, total: { $sum: '$bookingsReceived' } } }
        ]),
        SyncHistory.aggregate([
          { 
            $match: { 
              hotelId: hotel._id, 
              startedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            } 
          },
          { $group: { _id: null, total: { $sum: '$bookingsReceived' } } }
        ]),
        SyncHistory.aggregate([
          { 
            $match: { 
              hotelId: hotel._id, 
              startedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            } 
          },
          { $group: { _id: null, total: { $sum: '$bookingsReceived' } } }
        ]),
        SyncHistory.aggregate([
          { $match: { hotelId: hotel._id, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$roomsUpdated' } } }
        ])
      ]);

      const stats = {
        totalSyncs,
        successfulSyncs,
        failedSyncs,
        lastSync: lastSync?.startedAt || null,
        averageSyncTime: Math.round((avgDuration[0]?.avgDuration || 0) / 1000), // Convert to seconds
        providersActive: activeProviders.length,
        totalProviders,
        roomsSynced: totalRoomsUpdated[0]?.total || 0,
        bookingsReceived: {
          today: todayBookings[0]?.total || 0,
          thisWeek: weekBookings[0]?.total || 0,
          thisMonth: monthBookings[0]?.total || 0
        },
        syncFrequency: {
          bookingCom: hotel.otaConnections?.bookingCom?.isEnabled ? '1h' : 'disabled',
          expedia: hotel.otaConnections?.expedia?.isEnabled ? '1h' : 'disabled',
          airbnb: hotel.otaConnections?.airbnb?.isEnabled ? '1h' : 'disabled'
        }
      };

      res.json({
        status: 'success',
        data: { stats }
      });
    } catch (error) {
      throw new ApplicationError(`Failed to get OTA statistics: ${error.message}`, 500);
    }
  })
);

export default router;