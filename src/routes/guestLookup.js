import express from 'express';
import guestLookupController from '../controllers/guestLookupController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /guest-lookup/room/{roomNumber}:
 *   get:
 *     summary: Get guest information by room number
 *     tags: [Guest Lookup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomNumber
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Guest information retrieved successfully
 */
router.get('/room/:roomNumber', guestLookupController.getGuestByRoom);

/**
 * @swagger
 * /guest-lookup/booking/{bookingId}:
 *   get:
 *     summary: Get guest information by booking ID
 *     tags: [Guest Lookup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Guest information retrieved successfully
 */
router.get('/booking/:bookingId', guestLookupController.getGuestByBooking);

/**
 * @swagger
 * /guest-lookup/search:
 *   get:
 *     summary: Search guests by name or email
 *     tags: [Guest Lookup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Guest search results
 */
router.get('/search', guestLookupController.searchGuests);

/**
 * @swagger
 * /guest-lookup/{guestId}/bookings:
 *   get:
 *     summary: Get guest's active bookings
 *     tags: [Guest Lookup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: guestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Guest's active bookings
 */
router.get('/:guestId/bookings', guestLookupController.getGuestActiveBookings);

/**
 * @swagger
 * /guest-lookup/{guestId}/billing-history:
 *   get:
 *     summary: Get guest's billing history
 *     tags: [Guest Lookup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: guestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Guest's billing history
 */
router.get('/:guestId/billing-history', guestLookupController.getGuestBillingHistory);

export default router;
