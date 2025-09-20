import express from 'express';
import availabilityController from '../controllers/availabilityController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AvailabilityQuery:
 *       type: object
 *       required:
 *         - checkInDate
 *         - checkOutDate
 *       properties:
 *         checkInDate:
 *           type: string
 *           format: date
 *         checkOutDate:
 *           type: string
 *           format: date
 *         roomType:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *         guestCount:
 *           type: integer
 *           minimum: 1
 *         hotelId:
 *           type: string
 */

/**
 * @swagger
 * /api/v1/availability/check:
 *   get:
 *     summary: Check room availability
 *     tags: [Availability]
 *     parameters:
 *       - in: query
 *         name: checkInDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: checkOutDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: roomType
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *       - in: query
 *         name: guestCount
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Availability check results
 *       400:
 *         description: Invalid parameters
 */
router.get('/check', availabilityController.checkAvailability);

/**
 * @swagger
 * /api/v1/availability/calendar:
 *   get:
 *     summary: Get availability calendar for a month
 *     tags: [Availability]
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *       - in: query
 *         name: roomType
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Monthly availability calendar
 */
router.get('/calendar', availabilityController.getAvailabilityCalendar);

/**
 * @swagger
 * /api/v1/availability/room-status:
 *   get:
 *     summary: Get room availability status for date range
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomId
 *         required: true
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
 *         description: Room status information
 */
router.get('/room-status', authenticate, authorize(['admin', 'manager', 'front_desk']), availabilityController.getRoomStatus);

/**
 * @swagger
 * /api/v1/availability/block:
 *   post:
 *     summary: Block rooms for maintenance or other reasons
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomIds
 *               - startDate
 *               - endDate
 *             properties:
 *               roomIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               reason:
 *                 type: string
 *                 default: maintenance
 *     responses:
 *       201:
 *         description: Rooms blocked successfully
 */
router.post('/block', authenticate, authorize(['admin', 'manager']), availabilityController.blockRooms);

/**
 * @swagger
 * /api/v1/availability/unblock:
 *   post:
 *     summary: Unblock rooms
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomIds
 *               - startDate
 *               - endDate
 *             properties:
 *               roomIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Rooms unblocked successfully
 */
router.post('/unblock', authenticate, authorize(['admin', 'manager']), availabilityController.unblockRooms);

/**
 * @swagger
 * /api/v1/availability/occupancy:
 *   get:
 *     summary: Calculate occupancy rate
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Occupancy rate data
 */
router.get('/occupancy', authenticate, authorize(['admin', 'manager', 'front_desk']), availabilityController.getOccupancyRate);

/**
 * @swagger
 * /api/v1/availability/alternatives:
 *   get:
 *     summary: Find alternative rooms when requested type is not available
 *     tags: [Availability]
 *     parameters:
 *       - in: query
 *         name: checkIn
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: checkOut
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: roomType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *       - in: query
 *         name: guestCount
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Alternative room options
 */
router.get('/alternatives', availabilityController.findAlternatives);

/**
 * @swagger
 * /api/v1/availability/overbooking:
 *   get:
 *     summary: Check for overbooking scenarios
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: roomType
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *     responses:
 *       200:
 *         description: Overbooking status and suggestions
 */
router.get('/overbooking', authenticate, authorize(['admin', 'manager', 'front_desk']), availabilityController.checkOverbooking);

/**
 * @swagger
 * /api/v1/availability/with-rates:
 *   get:
 *     summary: Get comprehensive availability and rate information
 *     tags: [Availability]
 *     parameters:
 *       - in: query
 *         name: checkInDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: checkOutDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: guestCount
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Availability with rates for all room types
 */
router.get('/with-rates', availabilityController.getAvailabilityWithRates);

/**
 * @swagger
 * /api/v1/availability/search:
 *   get:
 *     summary: Search rooms with filters
 *     tags: [Availability]
 *     parameters:
 *       - in: query
 *         name: checkInDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: checkOutDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: guestCount
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: amenities
 *         schema:
 *           type: string
 *           description: Comma-separated list of amenities
 *       - in: query
 *         name: floor
 *         schema:
 *           type: integer
 *       - in: query
 *         name: roomType
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Filtered room search results with rates
 */
router.get('/search', availabilityController.searchRooms);

export default router;
