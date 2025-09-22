import express from 'express';
import advancedReservationsController from '../controllers/advancedReservationsController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// Protect all routes
router.use(authenticate);

/**
 * @swagger
 * /advanced-reservations/stats:
 *   get:
 *     summary: Get advanced reservations statistics
 *     tags: [Advanced Reservations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Advanced reservations statistics retrieved successfully
 */
router.get('/stats', 
  authorize('admin', 'staff'), 
  catchAsync(advancedReservationsController.getAdvancedReservationsStats)
);

// Get available bookings for creating advanced reservations
router.get('/available-bookings', 
  authorize('admin', 'staff'), 
  catchAsync(advancedReservationsController.getAvailableBookings)
);

/**
 * @swagger
 * /advanced-reservations:
 *   get:
 *     summary: Get all advanced reservations
 *     tags: [Advanced Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: reservationType
 *         schema:
 *           type: string
 *           enum: [standard, group, corporate, vip, complimentary, house_use]
 *         description: Filter by reservation type
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, vip]
 *         description: Filter by priority
 *       - in: query
 *         name: hasWaitlist
 *         schema:
 *           type: boolean
 *         description: Filter reservations with waitlist info
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
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Sort by field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Advanced reservations retrieved successfully
 */
router.get('/', 
  authorize('admin', 'staff'), 
  catchAsync(advancedReservationsController.getAdvancedReservations)
);

/**
 * @swagger
 * /advanced-reservations:
 *   post:
 *     summary: Create a new advanced reservation
 *     tags: [Advanced Reservations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *             properties:
 *               bookingId:
 *                 type: string
 *               reservationType:
 *                 type: string
 *                 enum: [standard, group, corporate, vip, complimentary, house_use]
 *                 default: standard
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, vip]
 *                 default: medium
 *               roomPreferences:
 *                 type: object
 *               guestProfile:
 *                 type: object
 *               specialRequests:
 *                 type: array
 *               waitlistInfo:
 *                 type: object
 *     responses:
 *       201:
 *         description: Advanced reservation created successfully
 */
router.post('/', 
  authorize('admin', 'staff'), 
  catchAsync(advancedReservationsController.createAdvancedReservation)
);

/**
 * @swagger
 * /advanced-reservations/{id}:
 *   get:
 *     summary: Get advanced reservation by ID
 *     tags: [Advanced Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Advanced reservation ID
 *     responses:
 *       200:
 *         description: Advanced reservation retrieved successfully
 *       404:
 *         description: Advanced reservation not found
 */
router.get('/:id', 
  authorize('admin', 'staff'), 
  catchAsync(advancedReservationsController.getAdvancedReservation)
);

/**
 * @swagger
 * /advanced-reservations/{id}:
 *   put:
 *     summary: Update advanced reservation
 *     tags: [Advanced Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Advanced reservation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reservationType:
 *                 type: string
 *                 enum: [standard, group, corporate, vip, complimentary, house_use]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, vip]
 *               roomPreferences:
 *                 type: object
 *               guestProfile:
 *                 type: object
 *               specialRequests:
 *                 type: array
 *               waitlistInfo:
 *                 type: object
 *     responses:
 *       200:
 *         description: Advanced reservation updated successfully
 *       404:
 *         description: Advanced reservation not found
 */
router.put('/:id', 
  authorize('admin', 'staff'), 
  catchAsync(advancedReservationsController.updateAdvancedReservation)
);

/**
 * @swagger
 * /advanced-reservations/{id}/assign-room:
 *   post:
 *     summary: Assign room to advanced reservation
 *     tags: [Advanced Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Advanced reservation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomId
 *             properties:
 *               roomId:
 *                 type: string
 *               assignmentType:
 *                 type: string
 *                 enum: [auto, manual, upgrade, preference]
 *                 default: manual
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Room assigned successfully
 *       404:
 *         description: Advanced reservation or room not found
 */
router.post('/:id/assign-room', 
  authorize('admin', 'staff'), 
  catchAsync(advancedReservationsController.assignRoom)
);

/**
 * @swagger
 * /advanced-reservations/{id}/add-upgrade:
 *   post:
 *     summary: Add upgrade to advanced reservation
 *     tags: [Advanced Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Advanced reservation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromRoomType
 *               - toRoomType
 *               - upgradeType
 *             properties:
 *               fromRoomType:
 *                 type: string
 *               toRoomType:
 *                 type: string
 *               upgradeType:
 *                 type: string
 *                 enum: [complimentary, paid, loyalty, operational]
 *               upgradeReason:
 *                 type: string
 *               additionalCharge:
 *                 type: number
 *                 default: 0
 *     responses:
 *       200:
 *         description: Upgrade added successfully
 *       404:
 *         description: Advanced reservation not found
 */
router.post('/:id/add-upgrade', 
  authorize('admin', 'staff'), 
  catchAsync(advancedReservationsController.addUpgrade)
);

/**
 * @swagger
 * /advanced-reservations/{id}/add-flag:
 *   post:
 *     summary: Add flag to advanced reservation
 *     tags: [Advanced Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Advanced reservation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - flag
 *             properties:
 *               flag:
 *                 type: string
 *                 enum: [credit_hold, no_show_risk, special_attention, vip, complainer, loyalty_member]
 *               severity:
 *                 type: string
 *                 enum: [info, warning, critical]
 *                 default: info
 *               description:
 *                 type: string
 *               expiryDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Reservation flag added successfully
 *       404:
 *         description: Advanced reservation not found
 */
router.post('/:id/add-flag',
  authorize('admin', 'staff'),
  catchAsync(advancedReservationsController.addReservationFlag)
);

/**
 * @swagger
 * /advanced-reservations/{id}:
 *   delete:
 *     summary: Delete advanced reservation
 *     tags: [Advanced Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Advanced reservation ID
 *     responses:
 *       200:
 *         description: Advanced reservation deleted successfully
 *       404:
 *         description: Advanced reservation not found
 */
router.delete('/:id',
  authorize('admin', 'staff'),
  catchAsync(advancedReservationsController.deleteAdvancedReservation)
);

export default router;
