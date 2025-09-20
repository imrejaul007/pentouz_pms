import express from 'express';
import roomTypeController from '../controllers/roomTypeController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     RoomType:
 *       type: object
 *       required:
 *         - hotelId
 *         - name
 *         - code
 *         - maxOccupancy
 *         - basePrice
 *       properties:
 *         roomTypeId:
 *           type: string
 *           description: Unique room type identifier
 *         hotelId:
 *           type: string
 *           description: Hotel ObjectId
 *         name:
 *           type: string
 *           description: Room type name (e.g., "Deluxe Ocean View")
 *         code:
 *           type: string
 *           description: Short code (e.g., "DOV")
 *         maxOccupancy:
 *           type: integer
 *           minimum: 1
 *           description: Maximum number of guests
 *         basePrice:
 *           type: number
 *           minimum: 0
 *           description: Base price per night
 *         description:
 *           type: string
 *           maxLength: 500
 *         amenities:
 *           type: array
 *           items:
 *             type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *         size:
 *           type: object
 *           properties:
 *             squareFeet:
 *               type: number
 *             squareMeters:
 *               type: number
 *         bedConfiguration:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               bedType:
 *                 type: string
 *                 enum: [single, double, queen, king, twin, sofa_bed]
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *         settings:
 *           type: object
 *           properties:
 *             allowOverbooking:
 *               type: boolean
 *               default: false
 *             overbookingLimit:
 *               type: integer
 *               default: 0
 *             requiresApproval:
 *               type: boolean
 *               default: false
 *         isActive:
 *           type: boolean
 *           default: true
 *         legacyType:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *           description: For backward compatibility
 */

/**
 * @swagger
 * /api/v1/room-types/hotel/{hotelId}:
 *   get:
 *     summary: Get all room types for a hotel
 *     tags: [Room Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: includeStats
 *         schema:
 *           type: boolean
 *           description: Include room count and inventory statistics
 *     responses:
 *       200:
 *         description: List of room types
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RoomType'
 */
router.get('/hotel/:hotelId', authenticate, authorize(['admin', 'manager', 'front_desk']), roomTypeController.getRoomTypes);

/**
 * @swagger
 * /api/v1/room-types/hotel/{hotelId}/options:
 *   get:
 *     summary: Get room type options for dropdowns
 *     tags: [Room Types]
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room type options
 */
router.get('/hotel/:hotelId/options', roomTypeController.getRoomTypeOptions);

/**
 * @swagger
 * /api/v1/room-types/{id}:
 *   get:
 *     summary: Get single room type by ID
 *     tags: [Room Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room type details
 *       404:
 *         description: Room type not found
 */
router.get('/:id', authenticate, authorize(['admin', 'manager', 'front_desk']), roomTypeController.getRoomType);

/**
 * @swagger
 * /api/v1/room-types:
 *   post:
 *     summary: Create new room type
 *     tags: [Room Types]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoomType'
 *     responses:
 *       201:
 *         description: Room type created successfully
 *       400:
 *         description: Validation error or duplicate code
 */
router.post('/', authenticate, authorize(['admin', 'manager']), roomTypeController.createRoomType);

/**
 * @swagger
 * /api/v1/room-types/{id}:
 *   put:
 *     summary: Update room type
 *     tags: [Room Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoomType'
 *     responses:
 *       200:
 *         description: Room type updated successfully
 *       404:
 *         description: Room type not found
 */
router.put('/:id', authenticate, authorize(['admin', 'manager']), roomTypeController.updateRoomType);

/**
 * @swagger
 * /api/v1/room-types/{id}:
 *   delete:
 *     summary: Delete (deactivate) room type
 *     tags: [Room Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room type deactivated successfully
 *       400:
 *         description: Cannot delete - rooms are using this type
 *       404:
 *         description: Room type not found
 */
router.delete('/:id', authenticate, authorize(['admin', 'manager']), roomTypeController.deleteRoomType);

/**
 * @swagger
 * /api/v1/room-types/{id}/channel-mapping:
 *   post:
 *     summary: Add channel mapping to room type
 *     tags: [Room Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel
 *               - channelRoomTypeId
 *               - channelRoomTypeName
 *             properties:
 *               channel:
 *                 type: string
 *                 description: Channel ObjectId
 *               channelRoomTypeId:
 *                 type: string
 *                 description: Room type ID in the channel system
 *               channelRoomTypeName:
 *                 type: string
 *                 description: Room type name in the channel system
 *     responses:
 *       200:
 *         description: Channel mapping added successfully
 *       400:
 *         description: Mapping already exists
 *       404:
 *         description: Room type not found
 */
router.post('/:id/channel-mapping', authenticate, authorize(['admin', 'channel_manager']), roomTypeController.addChannelMapping);

/**
 * @swagger
 * /api/v1/room-types/{id}/channel-mapping/{channelId}:
 *   delete:
 *     summary: Remove channel mapping from room type
 *     tags: [Room Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Channel mapping removed successfully
 *       404:
 *         description: Room type not found
 */
router.delete('/:id/channel-mapping/:channelId', authenticate, authorize(['admin', 'channel_manager']), roomTypeController.removeChannelMapping);

/**
 * @swagger
 * /api/v1/room-types/legacy/{hotelId}/{legacyType}:
 *   get:
 *     summary: Get room type by legacy type (for migration)
 *     tags: [Room Types]
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: legacyType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *     responses:
 *       200:
 *         description: Room type found
 *       404:
 *         description: Room type not found for legacy type
 */
router.get('/legacy/:hotelId/:legacyType', roomTypeController.getRoomTypeByLegacy);

/**
 * @swagger
 * /api/v1/room-types/migrate/hotel/{hotelId}/rooms:
 *   post:
 *     summary: Migrate existing rooms to use room types
 *     tags: [Room Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Migration completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRooms:
 *                       type: integer
 *                     migratedCount:
 *                       type: integer
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           roomId:
 *                             type: string
 *                           roomNumber:
 *                             type: string
 *                           legacyType:
 *                             type: string
 *                           roomTypeId:
 *                             type: string
 *                           status:
 *                             type: string
 *                           error:
 *                             type: string
 *                 message:
 *                   type: string
 */
router.post('/migrate/hotel/:hotelId/rooms', authenticate, authorize(['admin']), roomTypeController.migrateRoomsToRoomTypes);

/**
 * @swagger
 * /api/v1/room-types/{id}/inventory:
 *   post:
 *     summary: Bulk create inventory for room type
 *     tags: [Room Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - year
 *               - month
 *               - totalRooms
 *               - baseRate
 *             properties:
 *               year:
 *                 type: integer
 *                 example: 2024
 *               month:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
 *                 example: 3
 *               totalRooms:
 *                 type: integer
 *                 minimum: 1
 *                 example: 10
 *               baseRate:
 *                 type: number
 *                 minimum: 0
 *                 example: 2500
 *     responses:
 *       200:
 *         description: Inventory created successfully
 *       404:
 *         description: Room type not found
 */
router.post('/:id/inventory', authenticate, authorize(['admin', 'manager']), roomTypeController.createInventoryForRoomType);

/**
 * @swagger
 * /api/v1/room-types/{hotelId}/localized:
 *   get:
 *     summary: Get localized room types for a hotel
 *     tags: [Room Types]
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           default: EN
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: published
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Localized room types retrieved successfully
 */
router.get('/:hotelId/localized', authenticate, authorize(['admin', 'manager', 'front_desk']), roomTypeController.getLocalizedRoomTypes);

export default router;