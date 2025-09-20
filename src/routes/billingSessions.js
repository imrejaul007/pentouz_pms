import express from 'express';
import billingSessionController from '../controllers/billingSessionController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /billing-sessions:
 *   post:
 *     summary: Create a new billing session
 *     tags: [Billing Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guestName
 *               - roomNumber
 *               - hotelId
 *             properties:
 *               guestName:
 *                 type: string
 *               roomNumber:
 *                 type: string
 *               bookingId:
 *                 type: string
 *               hotelId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Billing session created successfully
 */
router.post('/', authorize('staff', 'admin'), billingSessionController.createBillingSession);

/**
 * @swagger
 * /billing-sessions/{id}:
 *   get:
 *     summary: Get billing session by ID
 *     tags: [Billing Sessions]
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
 *         description: Billing session details
 */
router.get('/:id', billingSessionController.getBillingSession);

/**
 * @swagger
 * /billing-sessions/{id}:
 *   put:
 *     summary: Update billing session
 *     tags: [Billing Sessions]
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
 *     responses:
 *       200:
 *         description: Billing session updated successfully
 */
router.put('/:id', authorize('staff', 'admin'), billingSessionController.updateBillingSession);

/**
 * @swagger
 * /billing-sessions/{id}:
 *   delete:
 *     summary: Delete billing session
 *     tags: [Billing Sessions]
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
 *         description: Billing session deleted successfully
 */
router.delete('/:id', authorize('staff', 'admin'), billingSessionController.deleteBillingSession);

/**
 * @swagger
 * /billing-sessions/{id}/items:
 *   post:
 *     summary: Add item to billing session
 *     tags: [Billing Sessions]
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
 *               - item
 *             properties:
 *               item:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   category:
 *                     type: string
 *                   price:
 *                     type: number
 *                   outlet:
 *                     type: string
 *     responses:
 *       200:
 *         description: Item added successfully
 */
router.post('/:id/items', authorize('staff', 'admin'), billingSessionController.addItemToSession);

/**
 * @swagger
 * /billing-sessions/{id}/items/{itemId}:
 *   put:
 *     summary: Update item quantity in billing session
 *     tags: [Billing Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: itemId
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
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: number
 *     responses:
 *       200:
 *         description: Item quantity updated successfully
 */
router.put('/:id/items/:itemId', authorize('staff', 'admin'), billingSessionController.updateItemInSession);

/**
 * @swagger
 * /billing-sessions/{id}/items/{itemId}:
 *   delete:
 *     summary: Remove item from billing session
 *     tags: [Billing Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item removed successfully
 */
router.delete('/:id/items/:itemId', authorize('staff', 'admin'), billingSessionController.removeItemFromSession);

/**
 * @swagger
 * /billing-sessions/{id}/checkout:
 *   post:
 *     summary: Checkout billing session
 *     tags: [Billing Sessions]
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
 *               - paymentMethod
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, card, room_charge, corporate, split]
 *               splitPayments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     method:
 *                       type: string
 *                     amount:
 *                       type: number
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Billing session checked out successfully
 */
router.post('/:id/checkout', authorize('staff', 'admin'), billingSessionController.checkoutSession);

/**
 * @swagger
 * /billing-sessions/{id}/void:
 *   post:
 *     summary: Void billing session
 *     tags: [Billing Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Billing session voided successfully
 */
router.post('/:id/void', authorize('staff', 'admin'), billingSessionController.voidSession);

/**
 * @swagger
 * /billing-sessions/hotel/{hotelId}:
 *   get:
 *     summary: Get all billing sessions for a hotel
 *     tags: [Billing Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
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
 *         description: List of billing sessions
 */
router.get('/hotel/:hotelId', billingSessionController.getHotelBillingSessions);

export default router;
