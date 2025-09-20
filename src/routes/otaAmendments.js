import express from 'express';
import {
  handleOTAAmendmentWebhook,
  getPendingAmendments,
  approveAmendment,
  rejectAmendment,
  getBookingAmendments,
  changeBookingStatus,
  getBookingStatusHistory,
  processBulkAmendments,
  getAmendmentMetrics
} from '../controllers/otaAmendmentController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBookingId } from '../middleware/validation.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Amendment:
 *       type: object
 *       properties:
 *         amendmentId:
 *           type: string
 *           description: Unique amendment identifier
 *         channelAmendmentId:
 *           type: string
 *           description: OTA's amendment reference
 *         amendmentType:
 *           type: string
 *           enum: [booking_modification, guest_details_change, dates_change, rate_change, room_change, cancellation_request, special_request_change]
 *         amendmentStatus:
 *           type: string
 *           enum: [pending, approved, rejected, partially_approved]
 *         requestedChanges:
 *           type: object
 *           description: Changes requested by the OTA
 *         originalData:
 *           type: object
 *           description: Original booking data before amendment
 *         requestedBy:
 *           type: object
 *           properties:
 *             channel:
 *               type: string
 *             guestId:
 *               type: string
 *             timestamp:
 *               type: string
 *               format: date-time
 *         requiresManualApproval:
 *           type: boolean
 *         processingNotes:
 *           type: string
 */

/**
 * @swagger
 * /api/v1/ota-amendments/webhook:
 *   post:
 *     summary: Handle incoming OTA amendment webhook
 *     tags: [OTA Amendments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - amendmentData
 *             properties:
 *               bookingId:
 *                 type: string
 *                 description: Booking ID to amend
 *               amendmentData:
 *                 type: object
 *                 required:
 *                   - type
 *                   - requestedChanges
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [booking_modification, guest_details_change, dates_change, rate_change, room_change, cancellation_request, special_request_change]
 *                   channelAmendmentId:
 *                     type: string
 *                   requestedChanges:
 *                     type: object
 *                   originalData:
 *                     type: object
 *                   channel:
 *                     type: string
 *                   guestId:
 *                     type: string
 *                   requiresManualApproval:
 *                     type: boolean
 *                   notes:
 *                     type: string
 *     responses:
 *       200:
 *         description: Amendment processed successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
router.post('/webhook', handleOTAAmendmentWebhook);

// Protected routes - require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/ota-amendments/pending:
 *   get:
 *     summary: Get pending amendments for review
 *     tags: [OTA Amendments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *         description: Filter by channel
 *       - in: query
 *         name: priority
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *         description: Filter by priority level
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Maximum number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: List of pending amendments
 */
router.get('/pending', authorize('admin', 'front-desk', 'reservations'), getPendingAmendments);

/**
 * @swagger
 * /api/v1/ota-amendments/booking/{bookingId}:
 *   get:
 *     summary: Get amendments for a specific booking
 *     tags: [OTA Amendments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, partially_approved]
 *         description: Filter by amendment status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results
 *     responses:
 *       200:
 *         description: Booking amendments retrieved
 *       404:
 *         description: Booking not found
 */
router.get('/booking/:bookingId', validateBookingId, getBookingAmendments);

/**
 * @swagger
 * /api/v1/ota-amendments/booking/{bookingId}/status-history:
 *   get:
 *     summary: Get booking status change history
 *     tags: [OTA Amendments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results
 *     responses:
 *       200:
 *         description: Status history retrieved
 *       404:
 *         description: Booking not found
 */
router.get('/booking/:bookingId/status-history', validateBookingId, getBookingStatusHistory);

/**
 * @swagger
 * /api/v1/ota-amendments/{bookingId}/{amendmentId}/approve:
 *   post:
 *     summary: Approve a pending amendment
 *     tags: [OTA Amendments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: path
 *         name: amendmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Amendment ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for approval
 *               partialChanges:
 *                 type: object
 *                 description: Partial changes if partially approved
 *               bypassValidation:
 *                 type: boolean
 *                 description: Bypass business rule validation
 *     responses:
 *       200:
 *         description: Amendment approved successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Booking or amendment not found
 */
router.post('/:bookingId/:amendmentId/approve', 
  validateBookingId, 
  authorize('admin', 'front-desk', 'reservations'), 
  approveAmendment
);

/**
 * @swagger
 * /api/v1/ota-amendments/{bookingId}/{amendmentId}/reject:
 *   post:
 *     summary: Reject a pending amendment
 *     tags: [OTA Amendments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: path
 *         name: amendmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Amendment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 description: Reason for rejection
 *               notifyGuest:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to notify the guest
 *     responses:
 *       200:
 *         description: Amendment rejected successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Booking or amendment not found
 */
router.post('/:bookingId/:amendmentId/reject', 
  validateBookingId, 
  authorize('admin', 'front-desk', 'reservations'), 
  rejectAmendment
);

/**
 * @swagger
 * /api/v1/ota-amendments/booking/{bookingId}/change-status:
 *   post:
 *     summary: Manually change booking status
 *     tags: [OTA Amendments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newStatus
 *             properties:
 *               newStatus:
 *                 type: string
 *                 enum: [pending, confirmed, modified, checked_in, checked_out, cancelled, no_show]
 *               reason:
 *                 type: string
 *                 description: Reason for status change
 *               bypassValidation:
 *                 type: boolean
 *                 description: Bypass business rule validation
 *               notifyChannels:
 *                 type: boolean
 *                 default: true
 *                 description: Notify connected channels
 *     responses:
 *       200:
 *         description: Status changed successfully
 *       400:
 *         description: Invalid status transition
 *       404:
 *         description: Booking not found
 */
router.post('/booking/:bookingId/change-status', 
  validateBookingId, 
  authorize('admin', 'front-desk'), 
  changeBookingStatus
);

/**
 * @swagger
 * /api/v1/ota-amendments/bulk:
 *   post:
 *     summary: Process multiple amendments in bulk
 *     tags: [OTA Amendments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amendments
 *               - action
 *             properties:
 *               amendments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - bookingId
 *                     - amendmentId
 *                   properties:
 *                     bookingId:
 *                       type: string
 *                     amendmentId:
 *                       type: string
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *               reason:
 *                 type: string
 *                 description: Reason for bulk action
 *     responses:
 *       200:
 *         description: Bulk processing completed
 *       400:
 *         description: Invalid request data
 */
router.post('/bulk', 
  authorize('admin', 'reservations'), 
  processBulkAmendments
);

/**
 * @swagger
 * /api/v1/ota-amendments/metrics:
 *   get:
 *     summary: Get amendment statistics and metrics
 *     tags: [OTA Amendments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for metrics period
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for metrics period
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *         description: Filter by channel
 *     responses:
 *       200:
 *         description: Amendment metrics retrieved
 */
router.get('/metrics', 
  authorize('admin', 'reservations', 'management'), 
  getAmendmentMetrics
);

export default router;