import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import {
  // Room Mapping Controllers
  getRoomMappings,
  getRoomMapping,
  createRoomMapping,
  updateRoomMapping,
  deleteRoomMapping,
  getRoomMappingsByRoomType,
  getRoomMappingsByChannel,
  
  // Rate Mapping Controllers
  getRateMappings,
  getRateMapping,
  createRateMapping,
  updateRateMapping,
  deleteRateMapping,
  getRateMappingsByRoomMapping,
  getRateMappingsByRatePlan,
  testRateCalculation,
  
  // Bulk Operations
  bulkCreateRoomMappings,
  bulkUpdateSyncStatus
} from '../controllers/mappingController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Mappings
 *   description: OTA Channel Mapping Management
 */

/**
 * @swagger
 * /api/v1/mappings/room-mappings:
 *   get:
 *     summary: Get all room mappings
 *     tags: [Mappings]
 *     parameters:
 *       - in: query
 *         name: roomTypeId
 *         schema:
 *           type: string
 *         description: Filter by room type ID
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *         description: Filter by channel
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Filter by active status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Room mappings retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/room-mappings', getRoomMappings);

/**
 * @swagger
 * /api/v1/mappings/room-mappings/{id}:
 *   get:
 *     summary: Get room mapping by ID
 *     tags: [Mappings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room mapping ID
 *     responses:
 *       200:
 *         description: Room mapping retrieved successfully
 *       404:
 *         description: Room mapping not found
 */
router.get('/room-mappings/:id', getRoomMapping);

/**
 * @swagger
 * /api/v1/mappings/room-mappings:
 *   post:
 *     summary: Create new room mapping
 *     tags: [Mappings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pmsRoomTypeId
 *               - channel
 *               - channelRoomId
 *               - channelRoomName
 *             properties:
 *               pmsRoomTypeId:
 *                 type: string
 *               channel:
 *                 type: string
 *                 enum: [booking_com, expedia, airbnb, agoda]
 *               channelRoomId:
 *                 type: string
 *               channelRoomName:
 *                 type: string
 *               channelRoomDescription:
 *                 type: string
 *               mappingConfig:
 *                 type: object
 *     responses:
 *       201:
 *         description: Room mapping created successfully
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Channel room ID already mapped
 */
router.post('/room-mappings', createRoomMapping);

/**
 * @swagger
 * /api/v1/mappings/room-mappings/{id}:
 *   patch:
 *     summary: Update room mapping
 *     tags: [Mappings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room mapping ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channelRoomName:
 *                 type: string
 *               channelRoomDescription:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               mappingConfig:
 *                 type: object
 *     responses:
 *       200:
 *         description: Room mapping updated successfully
 *       404:
 *         description: Room mapping not found
 */
router.patch('/room-mappings/:id', updateRoomMapping);

/**
 * @swagger
 * /api/v1/mappings/room-mappings/{id}:
 *   delete:
 *     summary: Delete room mapping
 *     tags: [Mappings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room mapping ID
 *     responses:
 *       204:
 *         description: Room mapping deleted successfully
 *       400:
 *         description: Cannot delete - has dependent rate mappings
 *       404:
 *         description: Room mapping not found
 */
router.delete('/room-mappings/:id', deleteRoomMapping);

// Room mapping queries
router.get('/room-mappings/by-room-type/:roomTypeId', getRoomMappingsByRoomType);
router.get('/room-mappings/by-channel/:channel', getRoomMappingsByChannel);

/**
 * Rate Mapping Routes
 */

/**
 * @swagger
 * /api/v1/mappings/rate-mappings:
 *   get:
 *     summary: Get all rate mappings
 *     tags: [Mappings]
 *     parameters:
 *       - in: query
 *         name: roomMappingId
 *         schema:
 *           type: string
 *         description: Filter by room mapping ID
 *       - in: query
 *         name: pmsRatePlanId
 *         schema:
 *           type: string
 *         description: Filter by PMS rate plan ID
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Filter by active status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Rate mappings retrieved successfully
 */
router.get('/rate-mappings', getRateMappings);
router.get('/rate-mappings/:id', getRateMapping);
router.post('/rate-mappings', createRateMapping);
router.patch('/rate-mappings/:id', updateRateMapping);
router.delete('/rate-mappings/:id', deleteRateMapping);

// Rate mapping queries
router.get('/rate-mappings/by-room-mapping/:roomMappingId', getRateMappingsByRoomMapping);
router.get('/rate-mappings/by-rate-plan/:pmsRatePlanId', getRateMappingsByRatePlan);

// Rate calculation testing
router.post('/rate-mappings/:id/test-calculation', testRateCalculation);

/**
 * Bulk Operations
 */

/**
 * @swagger
 * /api/v1/mappings/room-mappings/bulk:
 *   post:
 *     summary: Bulk create room mappings
 *     tags: [Mappings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mappings
 *             properties:
 *               mappings:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/RoomMapping'
 *     responses:
 *       201:
 *         description: Room mappings created successfully
 *       400:
 *         description: Invalid input data
 */
router.post('/room-mappings/bulk', bulkCreateRoomMappings);

/**
 * @swagger
 * /api/v1/mappings/sync-status/bulk:
 *   patch:
 *     summary: Bulk update sync status for mappings
 *     tags: [Mappings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mappings
 *             properties:
 *               mappings:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [success, failed, pending]
 *                     error:
 *                       type: string
 *     responses:
 *       200:
 *         description: Sync status updated successfully
 */
router.patch('/sync-status/bulk', bulkUpdateSyncStatus);

/**
 * Utility Routes
 */

// Get available channels
router.get('/channels', catchAsync(async (req, res) => {
  const channels = [
    { 
      value: 'booking_com', 
      label: 'Booking.com',
      description: 'World\'s largest online accommodation platform',
      logo: 'https://cf.bstatic.com/static/img/b26logo/booking_logo_retina/22615963add19ac6b6d715dcb6eac4dd7d66c80c.png'
    },
    { 
      value: 'expedia', 
      label: 'Expedia',
      description: 'Global travel booking platform',
      logo: 'https://a.travel-assets.com/globalcontrols-service/content/f285fb631b0a976202ef57611c7050e9ef5ca51a/images/EG_Wordmark_blue_RGB.svg'
    },
    { 
      value: 'airbnb', 
      label: 'Airbnb',
      description: 'Home sharing platform',
      logo: 'https://news.airbnb.com/wp-content/uploads/sites/4/2017/01/airbnb_vertical_lockup_web.png'
    },
    { 
      value: 'agoda', 
      label: 'Agoda',
      description: 'Asian travel booking platform',
      logo: 'https://cdn6.agoda.net/images/kite-js/logo/agoda/color-default.svg'
    },
    { 
      value: 'hotels_com', 
      label: 'Hotels.com',
      description: 'Hotel booking platform',
      logo: 'https://a.travel-assets.com/globalcontrols-service/content/f285fb631b0a976202ef57611c7050e9ef5ca51a/images/HC_Wordmark_blue_RGB.svg'
    },
    { 
      value: 'amadeus', 
      label: 'Amadeus',
      description: 'Global Distribution System',
      logo: 'https://amadeus.com/documents/en/resources/amadeus-logo.png'
    },
    { 
      value: 'sabre', 
      label: 'Sabre',
      description: 'Global Distribution System',
      logo: 'https://www.sabre.com/images/sabre-logo.svg'
    },
    { 
      value: 'direct_web', 
      label: 'Direct Web',
      description: 'Direct hotel website bookings',
      logo: null
    }
  ];
  
  res.status(200).json({
    status: 'success',
    data: {
      channels
    }
  });
}));

// Get mapping statistics
router.get('/statistics', catchAsync(async (req, res) => {
  const RoomMapping = (await import('../models/RoomMapping.js')).default;
  const RateMapping = (await import('../models/RateMapping.js')).default;
  
  const [
    totalRoomMappings,
    activeRoomMappings,
    totalRateMappings,
    activeRateMappings,
    mappingsByChannel
  ] = await Promise.all([
    RoomMapping.countDocuments(),
    RoomMapping.countDocuments({ isActive: true }),
    RateMapping.countDocuments(),
    RateMapping.countDocuments({ isActive: true }),
    RoomMapping.aggregate([
      { $group: { _id: '$channel', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);
  
  res.status(200).json({
    status: 'success',
    data: {
      roomMappings: {
        total: totalRoomMappings,
        active: activeRoomMappings,
        inactive: totalRoomMappings - activeRoomMappings
      },
      rateMappings: {
        total: totalRateMappings,
        active: activeRateMappings,
        inactive: totalRateMappings - activeRateMappings
      },
      byChannel: mappingsByChannel
    }
  });
}));

export default router;
