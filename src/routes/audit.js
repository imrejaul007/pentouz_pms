import express from 'express';
import {
  getOTAPayloads,
  getOTAPayload,
  getPayloadAudit,
  getBookingPayloads,
  getPayloadStats,
  generateComplianceReport,
  reconcileBookingData,
  getAuditLogs,
  getAuditByCorrelation,
  getRetentionStats,
  triggerManualCleanup,
  exportAuditData
} from '../controllers/auditController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/validation.js';

const router = express.Router();

// Apply authentication to all audit routes
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     OTAPayload:
 *       type: object
 *       properties:
 *         payloadId:
 *           type: string
 *           description: Unique payload identifier
 *         direction:
 *           type: string
 *           enum: [inbound, outbound]
 *         channel:
 *           type: string
 *           enum: [booking_com, expedia, airbnb, agoda, direct, other]
 *         endpoint:
 *           type: object
 *           properties:
 *             url:
 *               type: string
 *             method:
 *               type: string
 *             path:
 *               type: string
 *         parsedPayload:
 *           type: object
 *           description: Key extracted fields for indexing
 *         processingStatus:
 *           type: string
 *           enum: [received, processing, processed, failed, ignored]
 *         businessContext:
 *           type: object
 *           properties:
 *             operation:
 *               type: string
 *             priority:
 *               type: string
 *               enum: [low, medium, high, critical]
 *         classification:
 *           type: object
 *           properties:
 *             containsPII:
 *               type: boolean
 *             containsPaymentData:
 *               type: boolean
 *             dataLevel:
 *               type: string
 *               enum: [public, internal, confidential, restricted]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/audit/ota-payloads:
 *   get:
 *     summary: Get OTA payloads with filtering and pagination
 *     tags: [Audit & Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *           enum: [booking_com, expedia, airbnb, agoda, direct, other]
 *         description: Filter by channel
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [inbound, outbound]
 *         description: Filter by direction
 *       - in: query
 *         name: operation
 *         schema:
 *           type: string
 *         description: Filter by business operation
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [received, processing, processed, failed, ignored]
 *         description: Filter by processing status
 *       - in: query
 *         name: bookingId
 *         schema:
 *           type: string
 *         description: Filter by related booking ID
 *       - in: query
 *         name: correlationId
 *         schema:
 *           type: string
 *         description: Filter by correlation ID
 *       - in: query
 *         name: searchText
 *         schema:
 *           type: string
 *         description: Search in guest name, booking ID, reservation ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter from date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter to date
 *       - in: query
 *         name: includeData
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include decompressed payload data (admin only)
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
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: OTA payloads retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     payloads:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OTAPayload'
 *                     pagination:
 *                       type: object
 *                     filters:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/ota-payloads', authorize('admin', 'audit', 'compliance'), getOTAPayloads);

/**
 * @swagger
 * /api/v1/audit/ota-payloads/{payloadId}:
 *   get:
 *     summary: Get specific OTA payload with full details
 *     tags: [Audit & Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payloadId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique payload identifier
 *       - in: query
 *         name: includeRawData
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include raw payload data (admin only)
 *     responses:
 *       200:
 *         description: Payload details retrieved
 *       404:
 *         description: Payload not found
 */
router.get('/ota-payloads/:payloadId', authorize('admin', 'audit', 'compliance'), getOTAPayload);

/**
 * @swagger
 * /api/v1/audit/ota-payloads/{payloadId}/audit:
 *   get:
 *     summary: Get comprehensive audit results for a payload
 *     tags: [Audit & Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payloadId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payload ID to audit
 *     responses:
 *       200:
 *         description: Audit results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     payloadId:
 *                       type: string
 *                     auditTimestamp:
 *                       type: string
 *                       format: date-time
 *                     checks:
 *                       type: object
 *                       properties:
 *                         validation:
 *                           type: object
 *                         integrity:
 *                           type: object
 *                         security:
 *                           type: object
 *                         performance:
 *                           type: object
 *                         compliance:
 *                           type: object
 *                         crossReference:
 *                           type: object
 *                     overallScore:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                     riskLevel:
 *                       type: string
 *                       enum: [minimal, low, medium, high]
 *       400:
 *         description: Invalid payload ID or audit failed
 */
router.get('/ota-payloads/:payloadId/audit', authorize('admin', 'audit'), getPayloadAudit);

/**
 * @swagger
 * /api/v1/audit/bookings/{bookingId}/payloads:
 *   get:
 *     summary: Get all OTA payloads for a specific booking
 *     tags: [Audit & Logging]
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
 *         name: includeData
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include decompressed payload data
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [inbound, outbound]
 *         description: Filter by direction
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *         description: Filter by channel
 *     responses:
 *       200:
 *         description: Booking payloads retrieved
 */
router.get('/bookings/:bookingId/payloads', validateObjectId('bookingId'), authorize('admin', 'audit', 'front-desk'), getBookingPayloads);

/**
 * @swagger
 * /api/v1/audit/bookings/{bookingId}/reconcile:
 *   post:
 *     summary: Reconcile OTA data with internal booking records
 *     tags: [Audit & Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID to reconcile
 *     responses:
 *       200:
 *         description: Reconciliation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookingId:
 *                       type: string
 *                     reconciledAt:
 *                       type: string
 *                       format: date-time
 *                     payloadsFound:
 *                       type: number
 *                     discrepancies:
 *                       type: array
 *                       items:
 *                         type: object
 *                     consistencyScore:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 */
router.post('/bookings/:bookingId/reconcile', validateObjectId('bookingId'), authorize('admin', 'audit'), reconcileBookingData);

/**
 * @swagger
 * /api/v1/audit/stats:
 *   get:
 *     summary: Get payload statistics and metrics
 *     tags: [Audit & Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *         description: Filter by channel
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [inbound, outbound]
 *         description: Filter by direction
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
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [hour, day]
 *           default: day
 *         description: Time grouping for time series
 *     responses:
 *       200:
 *         description: Statistics retrieved
 */
router.get('/stats', authorize('admin', 'audit', 'management'), getPayloadStats);

/**
 * @swagger
 * /api/v1/audit/compliance/report:
 *   get:
 *     summary: Generate compliance report
 *     tags: [Audit & Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Report start date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Report end date
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *         description: Filter by channel
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [inbound, outbound]
 *         description: Filter by direction
 *     responses:
 *       200:
 *         description: Compliance report generated
 *       400:
 *         description: Missing required parameters
 */
router.get('/compliance/report', authorize('admin', 'compliance'), generateComplianceReport);

/**
 * @swagger
 * /api/v1/audit/logs:
 *   get:
 *     summary: Get audit logs with filtering
 *     tags: [Audit & Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tableName
 *         schema:
 *           type: string
 *         description: Filter by table/entity name
 *       - in: query
 *         name: recordId
 *         schema:
 *           type: string
 *         description: Filter by record ID
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: changeType
 *         schema:
 *           type: string
 *           enum: [create, update, delete, sync, booking, cancellation, audit, reconciliation, archive]
 *         description: Filter by change type
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *         description: Filter by source system
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
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
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Audit logs retrieved
 */
router.get('/logs', authorize('admin', 'audit'), getAuditLogs);

/**
 * @swagger
 * /api/v1/audit/correlations/{correlationId}:
 *   get:
 *     summary: Get all audit data by correlation ID
 *     tags: [Audit & Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: correlationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Correlation ID to search
 *     responses:
 *       200:
 *         description: Correlated audit data retrieved
 */
router.get('/correlations/:correlationId', authorize('admin', 'audit'), getAuditByCorrelation);

/**
 * @swagger
 * /api/v1/audit/retention/stats:
 *   get:
 *     summary: Get payload retention statistics
 *     tags: [Audit & Logging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Retention statistics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     retentionService:
 *                       type: object
 *                       properties:
 *                         lastRun:
 *                           type: string
 *                           format: date-time
 *                         payloadsProcessed:
 *                           type: number
 *                         payloadsArchived:
 *                           type: number
 *                         payloadsDeleted:
 *                           type: number
 *                         spaceReclaimed:
 *                           type: number
 *                     database:
 *                       type: object
 *                       properties:
 *                         totalPayloads:
 *                           type: number
 *                         archivedPayloads:
 *                           type: number
 *                         activePayloads:
 *                           type: number
 *                         overduePayloads:
 *                           type: number
 *                         archivePercentage:
 *                           type: string
 */
router.get('/retention/stats', authorize('admin', 'audit'), getRetentionStats);

/**
 * @swagger
 * /api/v1/audit/retention/cleanup:
 *   post:
 *     summary: Manually trigger payload cleanup
 *     tags: [Audit & Logging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channel:
 *                 type: string
 *                 description: Cleanup specific channel
 *               olderThanDays:
 *                 type: number
 *                 minimum: 1
 *                 description: Cleanup payloads older than X days
 *               operation:
 *                 type: string
 *                 description: Cleanup specific operation type
 *               limit:
 *                 type: number
 *                 maximum: 1000
 *                 default: 100
 *                 description: Maximum payloads to process
 *     responses:
 *       200:
 *         description: Cleanup completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     processed:
 *                       type: number
 *                     archived:
 *                       type: number
 *                     deleted:
 *                       type: number
 *                     errors:
 *                       type: array
 */
router.post('/retention/cleanup', authorize('admin'), triggerManualCleanup);

/**
 * @swagger
 * /api/v1/audit/export:
 *   get:
 *     summary: Export audit data for compliance
 *     tags: [Audit & Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Export start date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Export end date
 *       - in: query
 *         name: tableName
 *         schema:
 *           type: string
 *         description: Filter by table name
 *       - in: query
 *         name: includePayloads
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include related payload data
 *     responses:
 *       200:
 *         description: Export data ready for download
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Missing required parameters
 */
router.get('/export', authorize('admin', 'compliance'), exportAuditData);

export default router;
