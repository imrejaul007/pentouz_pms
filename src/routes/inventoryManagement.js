import express from 'express';
import inventoryController from '../controllers/inventoryController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     InventoryUpdate:
 *       type: object
 *       required:
 *         - hotelId
 *         - roomTypeId
 *         - date
 *       properties:
 *         hotelId:
 *           type: string
 *         roomTypeId:
 *           type: string
 *         date:
 *           type: string
 *           format: date
 *         availableRooms:
 *           type: integer
 *           minimum: 0
 *         baseRate:
 *           type: number
 *           minimum: 0
 *         sellingRate:
 *           type: number
 *           minimum: 0
 *         restrictions:
 *           type: object
 *           properties:
 *             stopSellFlag:
 *               type: boolean
 *             closedToArrival:
 *               type: boolean
 *             closedToDeparture:
 *               type: boolean
 *             minimumStay:
 *               type: integer
 *             maximumStay:
 *               type: integer
 *         channel:
 *           type: string
 *           description: Optional channel ID for channel-specific updates
 */

/**
 * @swagger
 * /api/v1/inventory-management:
 *   get:
 *     summary: Get inventory for date range
 *     tags: [Inventory Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: roomTypeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *           description: Optional channel ID to get channel-specific data
 *     responses:
 *       200:
 *         description: Inventory data retrieved successfully
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
 *                     $ref: '#/components/schemas/RoomAvailability'
 */
router.get('/', authenticate, authorize(['admin', 'manager', 'front_desk']), inventoryController.getInventory);

/**
 * @swagger
 * /api/v1/inventory-management/update:
 *   post:
 *     summary: Update inventory for specific date
 *     tags: [Inventory Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InventoryUpdate'
 *     responses:
 *       200:
 *         description: Inventory updated successfully
 *       400:
 *         description: Missing required parameters
 *       404:
 *         description: Room type not found
 */
router.post('/update', authenticate, authorize(['admin', 'manager']), inventoryController.updateInventory);

/**
 * @swagger
 * /api/v1/inventory-management/bulk-update:
 *   post:
 *     summary: Bulk update inventory for multiple dates
 *     tags: [Inventory Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotelId
 *               - roomTypeId
 *               - updates
 *             properties:
 *               hotelId:
 *                 type: string
 *               roomTypeId:
 *                 type: string
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - date
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                     availableRooms:
 *                       type: integer
 *                     baseRate:
 *                       type: number
 *                     sellingRate:
 *                       type: number
 *                     restrictions:
 *                       type: object
 *               channel:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bulk update completed
 */
router.post('/bulk-update', authenticate, authorize(['admin', 'manager']), inventoryController.bulkUpdateInventory);

/**
 * @swagger
 * /api/v1/inventory-management/stop-sell:
 *   post:
 *     summary: Set stop sell for date range
 *     tags: [Inventory Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotelId
 *               - roomTypeId
 *               - startDate
 *               - endDate
 *             properties:
 *               hotelId:
 *                 type: string
 *               roomTypeId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               stopSell:
 *                 type: boolean
 *                 default: true
 *               channel:
 *                 type: string
 *                 description: Optional channel ID for channel-specific stop sell
 *               reason:
 *                 type: string
 *                 description: Reason for stop sell
 *     responses:
 *       200:
 *         description: Stop sell status updated successfully
 */
router.post('/stop-sell', authenticate, authorize(['admin', 'manager']), inventoryController.setStopSell);

/**
 * @swagger
 * /api/v1/inventory-management/calendar:
 *   get:
 *     summary: Get inventory calendar view for a month
 *     tags: [Inventory Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: roomTypeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           example: 2024
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *           example: 3
 *     responses:
 *       200:
 *         description: Calendar data retrieved successfully
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
 *                     year:
 *                       type: integer
 *                     month:
 *                       type: integer
 *                     calendar:
 *                       type: object
 *                       description: Date-indexed calendar data
 */
router.get('/calendar', authenticate, authorize(['admin', 'manager', 'front_desk']), inventoryController.getInventoryCalendar);

/**
 * @swagger
 * /api/v1/inventory-management/summary:
 *   get:
 *     summary: Get inventory summary statistics
 *     tags: [Inventory Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: roomTypeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Summary statistics retrieved successfully
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
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalInventoryDays:
 *                           type: integer
 *                         totalRoomNights:
 *                           type: integer
 *                         totalAvailable:
 *                           type: integer
 *                         totalSold:
 *                           type: integer
 *                         totalBlocked:
 *                           type: integer
 *                         averageRate:
 *                           type: number
 *                         occupancyRate:
 *                           type: string
 *                         availabilityRate:
 *                           type: string
 *                         stopSellDays:
 *                           type: integer
 *                     dateRange:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                         endDate:
 *                           type: string
 */
router.get('/summary', authenticate, authorize(['admin', 'manager', 'front_desk']), inventoryController.getInventorySummary);

/**
 * @swagger
 * /api/v1/inventory-management/create-range:
 *   post:
 *     summary: Create inventory for date range
 *     tags: [Inventory Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotelId
 *               - roomTypeId
 *               - startDate
 *               - endDate
 *             properties:
 *               hotelId:
 *                 type: string
 *               roomTypeId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               baseRate:
 *                 type: number
 *                 minimum: 0
 *                 description: Optional base rate (uses room type default if not provided)
 *               createMode:
 *                 type: string
 *                 enum: [skip_existing, overwrite]
 *                 default: skip_existing
 *                 description: How to handle existing inventory records
 *     responses:
 *       200:
 *         description: Inventory range created successfully
 *       404:
 *         description: Room type not found
 */
router.post('/create-range', authenticate, authorize(['admin', 'manager']), inventoryController.createInventoryRange);

export default router;
