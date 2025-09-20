import express from 'express';
import {
  sendItemsToLaundry,
  markItemsAsInLaundry,
  markItemsAsCleaning,
  markItemsAsReady,
  returnItemsFromLaundry,
  markItemsAsLost,
  markItemsAsDamaged,
  getLaundryDashboard,
  getLaundryStatus,
  getOverdueItems,
  getLaundryStatistics,
  getAllLaundryTransactions,
  getLaundryTransaction
} from '../controllers/laundryController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/v1/laundry/send-items:
 *   post:
 *     summary: Send items to laundry
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomId
 *               - items
 *               - expectedReturnDate
 *             properties:
 *               roomId:
 *                 type: string
 *                 description: Room ID where items were collected
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - itemId
 *                     - quantity
 *                   properties:
 *                     itemId:
 *                       type: string
 *                       description: Inventory item ID
 *                     quantity:
 *                       type: number
 *                       minimum: 1
 *                       description: Number of items
 *                     notes:
 *                       type: string
 *                       description: Item-specific notes
 *                     specialInstructions:
 *                       type: string
 *                       description: Special instructions for this item
 *               expectedReturnDate:
 *                 type: string
 *                 format: date
 *                 description: Expected return date
 *               notes:
 *                 type: string
 *                 description: General notes
 *               specialInstructions:
 *                 type: string
 *                 description: Special instructions
 *               isUrgent:
 *                 type: boolean
 *                 default: false
 *                 description: Whether this is urgent
 *     responses:
 *       201:
 *         description: Items sent to laundry successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Items sent to laundry successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     transactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/LaundryTransaction'
 *                     totalItems:
 *                       type: number
 *                     totalCost:
 *                       type: number
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 */
router.post('/send-items', 
  authorize(['admin', 'manager', 'housekeeping', 'front_desk']),
  catchAsync(sendItemsToLaundry)
);

/**
 * @swagger
 * /api/v1/laundry/{id}/mark-in-laundry:
 *   put:
 *     summary: Mark items as in laundry
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Laundry transaction ID
 *     responses:
 *       200:
 *         description: Items marked as in laundry
 *       404:
 *         description: Laundry transaction not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id/mark-in-laundry',
  authorize(['admin', 'manager', 'housekeeping']),
  catchAsync(markItemsAsInLaundry)
);

/**
 * @swagger
 * /api/v1/laundry/{id}/mark-cleaning:
 *   put:
 *     summary: Mark items as cleaning
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Laundry transaction ID
 *     responses:
 *       200:
 *         description: Items marked as cleaning
 *       404:
 *         description: Laundry transaction not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id/mark-cleaning',
  authorize(['admin', 'manager', 'housekeeping']),
  catchAsync(markItemsAsCleaning)
);

/**
 * @swagger
 * /api/v1/laundry/{id}/mark-ready:
 *   put:
 *     summary: Mark items as ready for return
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Laundry transaction ID
 *     responses:
 *       200:
 *         description: Items marked as ready
 *       404:
 *         description: Laundry transaction not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id/mark-ready',
  authorize(['admin', 'manager', 'housekeeping']),
  catchAsync(markItemsAsReady)
);

/**
 * @swagger
 * /api/v1/laundry/{id}/return-items:
 *   put:
 *     summary: Return items from laundry
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Laundry transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quality:
 *                 type: string
 *                 enum: [excellent, good, fair, poor, damaged]
 *                 default: good
 *                 description: Quality of returned items
 *               issues:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of issues found
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: URLs of photos showing issues
 *     responses:
 *       200:
 *         description: Items returned successfully
 *       404:
 *         description: Laundry transaction not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id/return-items',
  authorize(['admin', 'manager', 'housekeeping', 'front_desk']),
  catchAsync(returnItemsFromLaundry)
);

/**
 * @swagger
 * /api/v1/laundry/{id}/mark-lost:
 *   put:
 *     summary: Mark items as lost
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Laundry transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Notes about the loss
 *     responses:
 *       200:
 *         description: Items marked as lost
 *       404:
 *         description: Laundry transaction not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id/mark-lost',
  authorize(['admin', 'manager', 'housekeeping']),
  catchAsync(markItemsAsLost)
);

/**
 * @swagger
 * /api/v1/laundry/{id}/mark-damaged:
 *   put:
 *     summary: Mark items as damaged
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Laundry transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Notes about the damage
 *     responses:
 *       200:
 *         description: Items marked as damaged
 *       404:
 *         description: Laundry transaction not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id/mark-damaged',
  authorize(['admin', 'manager', 'housekeeping']),
  catchAsync(markItemsAsDamaged)
);

/**
 * @swagger
 * /api/v1/laundry/dashboard:
 *   get:
 *     summary: Get laundry dashboard data
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_laundry, cleaning, ready, returned, lost, damaged]
 *         description: Filter by status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: Laundry dashboard data
 *       401:
 *         description: Unauthorized
 */
router.get('/dashboard',
  authorize(['admin', 'manager', 'housekeeping', 'front_desk']),
  catchAsync(getLaundryDashboard)
);

/**
 * @swagger
 * /api/v1/laundry/status:
 *   get:
 *     summary: Get laundry status
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *         description: Filter by room ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_laundry, cleaning, ready, returned, lost, damaged]
 *         description: Filter by status
 *       - in: query
 *         name: itemId
 *         schema:
 *           type: string
 *         description: Filter by item ID
 *     responses:
 *       200:
 *         description: Laundry status data
 *       401:
 *         description: Unauthorized
 */
router.get('/status',
  authorize(['admin', 'manager', 'housekeeping', 'front_desk']),
  catchAsync(getLaundryStatus)
);

/**
 * @swagger
 * /api/v1/laundry/overdue:
 *   get:
 *     summary: Get overdue laundry items
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue laundry items
 *       401:
 *         description: Unauthorized
 */
router.get('/overdue',
  authorize(['admin', 'manager', 'housekeeping', 'front_desk']),
  catchAsync(getOverdueItems)
);

/**
 * @swagger
 * /api/v1/laundry/statistics:
 *   get:
 *     summary: Get laundry statistics
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics
 *     responses:
 *       200:
 *         description: Laundry statistics
 *       401:
 *         description: Unauthorized
 */
router.get('/statistics',
  authorize(['admin', 'manager']),
  catchAsync(getLaundryStatistics)
);

/**
 * @swagger
 * /api/v1/laundry:
 *   get:
 *     summary: Get all laundry transactions
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_laundry, cleaning, ready, returned, lost, damaged]
 *         description: Filter by status
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *         description: Filter by room ID
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -createdAt
 *         description: Sort field and order
 *     responses:
 *       200:
 *         description: List of laundry transactions
 *       401:
 *         description: Unauthorized
 */
router.get('/',
  authorize(['admin', 'manager', 'housekeeping', 'front_desk']),
  catchAsync(getAllLaundryTransactions)
);

/**
 * @swagger
 * /api/v1/laundry/{id}:
 *   get:
 *     summary: Get laundry transaction by ID
 *     tags: [Laundry Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Laundry transaction ID
 *     responses:
 *       200:
 *         description: Laundry transaction details
 *       404:
 *         description: Laundry transaction not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/:id',
  authorize(['admin', 'manager', 'housekeeping', 'front_desk']),
  catchAsync(getLaundryTransaction)
);

export default router;
