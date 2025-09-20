import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getSupervisionMeetUps,
  assignStaffToMeetUp,
  getStaffAssignments,
  updateSupervisionStatus,
  getSupervisionStats,
  getUrgentSupervisionTasks,
  processSupervisionAlerts,
  getSupervisionAlertStats
} from '../controllers/staffMeetUpController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(authorize('staff', 'admin'));

/**
 * @swagger
 * components:
 *   schemas:
 *     SupervisionMeetUp:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         title:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, accepted, declined, cancelled, completed]
 *         supervision:
 *           type: object
 *           properties:
 *             priority:
 *               type: object
 *               properties:
 *                 priority:
 *                   type: string
 *                   enum: [high, medium, low]
 *                 color:
 *                   type: string
 *                 label:
 *                   type: string
 *                 score:
 *                   type: number
 *                 factors:
 *                   type: array
 *                   items:
 *                     type: string
 *             safetyLevel:
 *               type: object
 *               properties:
 *                 level:
 *                   type: string
 *                   enum: [high, medium, low]
 *                 color:
 *                   type: string
 *                 label:
 *                   type: string
 *                 score:
 *                   type: number
 *             requiresStaffPresence:
 *               type: boolean
 *             riskFactors:
 *               type: array
 *               items:
 *                 type: string
 */

/**
 * @swagger
 * /api/v1/staff-meetups/supervision:
 *   get:
 *     summary: Get meet-ups requiring supervision
 *     tags: [Staff Meet-ups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, declined, cancelled, completed]
 *         description: Filter by status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [high, medium, low]
 *         description: Filter by supervision priority
 *       - in: query
 *         name: safetyLevel
 *         schema:
 *           type: string
 *           enum: [high, medium, low]
 *         description: Filter by safety level
 *     responses:
 *       200:
 *         description: Supervision meet-ups retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     meetUps:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SupervisionMeetUp'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Staff access required
 */
router.get('/supervision', getSupervisionMeetUps);

/**
 * @swagger
 * /api/v1/staff-meetups/{meetUpId}/assign:
 *   post:
 *     summary: Assign staff member to supervise a meet-up
 *     tags: [Staff Meet-ups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: meetUpId
 *         required: true
 *         schema:
 *           type: string
 *         description: Meet-up ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - staffId
 *             properties:
 *               staffId:
 *                 type: string
 *                 description: ID of staff member to assign
 *               supervisionNotes:
 *                 type: string
 *                 description: Initial supervision notes
 *     responses:
 *       200:
 *         description: Staff assigned successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Meet-up not found
 */
router.post('/:meetUpId/assign', assignStaffToMeetUp);

/**
 * @swagger
 * /api/v1/staff-meetups/my-assignments:
 *   get:
 *     summary: Get current staff member's supervision assignments
 *     tags: [Staff Meet-ups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [not_required, assigned, in_progress, completed]
 *         description: Filter by supervision status
 *     responses:
 *       200:
 *         description: Staff assignments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     assignments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SupervisionMeetUp'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 */
router.get('/my-assignments', getStaffAssignments);

/**
 * @swagger
 * /api/v1/staff-meetups/{meetUpId}/supervision-status:
 *   put:
 *     summary: Update supervision status
 *     tags: [Staff Meet-ups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: meetUpId
 *         required: true
 *         schema:
 *           type: string
 *         description: Meet-up ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supervisionStatus
 *             properties:
 *               supervisionStatus:
 *                 type: string
 *                 enum: [not_required, assigned, in_progress, completed]
 *                 description: New supervision status
 *               supervisionNotes:
 *                 type: string
 *                 description: Updated supervision notes
 *     responses:
 *       200:
 *         description: Supervision status updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Meet-up assignment not found
 */
router.put('/:meetUpId/supervision-status', updateSupervisionStatus);

/**
 * @swagger
 * /api/v1/staff-meetups/stats:
 *   get:
 *     summary: Get supervision statistics
 *     tags: [Staff Meet-ups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d]
 *           default: 7d
 *         description: Statistics period
 *     responses:
 *       200:
 *         description: Supervision statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalMeetUps:
 *                           type: integer
 *                         pendingSupervision:
 *                           type: integer
 *                         completedSupervision:
 *                           type: integer
 *                         highRiskMeetUps:
 *                           type: integer
 *                         staffRequiredMeetUps:
 *                           type: integer
 *                         upcomingSupervised:
 *                           type: integer
 *                     statusBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     period:
 *                       type: string
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', getSupervisionStats);

/**
 * @swagger
 * /api/v1/staff-meetups/urgent:
 *   get:
 *     summary: Get meet-ups requiring immediate attention
 *     tags: [Staff Meet-ups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Urgent supervision tasks retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     urgentTasks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SupervisionMeetUp'
 *                     count:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/urgent', getUrgentSupervisionTasks);

/**
 * @swagger
 * /api/v1/staff-meetups/process-alerts:
 *   post:
 *     summary: Process upcoming meet-ups and create supervision alerts
 *     tags: [Staff Meet-ups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Supervision alerts processed successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/process-alerts', processSupervisionAlerts);

/**
 * @swagger
 * /api/v1/staff-meetups/alert-stats:
 *   get:
 *     summary: Get supervision alert statistics
 *     tags: [Staff Meet-ups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Supervision alert statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/alert-stats', getSupervisionAlertStats);

export default router;