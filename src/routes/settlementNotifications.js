import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import settlementNotificationService from '../services/settlementNotificationService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /settlement-notifications/send-reminder:
 *   post:
 *     summary: Send immediate settlement reminder
 *     tags: [Settlement Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - settlementId
 *             properties:
 *               settlementId:
 *                 type: string
 *               reminderType:
 *                 type: string
 *                 enum: [payment_reminder, final_notice, courtesy_reminder]
 *                 default: payment_reminder
 *     responses:
 *       200:
 *         description: Reminder sent successfully
 */
router.post('/send-reminder', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const { settlementId, reminderType = 'payment_reminder' } = req.body;

  if (!settlementId) {
    throw new ApplicationError('Settlement ID is required', 400);
  }

  const validReminderTypes = ['payment_reminder', 'final_notice', 'courtesy_reminder'];
  if (!validReminderTypes.includes(reminderType)) {
    throw new ApplicationError('Invalid reminder type', 400);
  }

  const result = await settlementNotificationService.sendImmediateReminder(settlementId, reminderType);

  if (!result.success) {
    throw new ApplicationError(result.error || 'Failed to send reminder', 400);
  }

  res.json({
    status: 'success',
    message: result.message,
    data: {
      settlementId,
      reminderType,
      sentAt: new Date()
    }
  });
}));

/**
 * @swagger
 * /settlement-notifications/process-overdue:
 *   post:
 *     summary: Manually trigger overdue settlement processing
 *     tags: [Settlement Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue settlements processed successfully
 */
router.post('/process-overdue', authorize('admin'), catchAsync(async (req, res) => {
  await settlementNotificationService.processOverdueSettlements();

  res.json({
    status: 'success',
    message: 'Overdue settlements processed successfully',
    processedAt: new Date()
  });
}));

/**
 * @swagger
 * /settlement-notifications/process-due-today:
 *   post:
 *     summary: Manually trigger due today settlement processing
 *     tags: [Settlement Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Due today settlements processed successfully
 */
router.post('/process-due-today', authorize('admin'), catchAsync(async (req, res) => {
  await settlementNotificationService.processDueTodaySettlements();

  res.json({
    status: 'success',
    message: 'Due today settlements processed successfully',
    processedAt: new Date()
  });
}));

/**
 * @swagger
 * /settlement-notifications/process-escalations:
 *   post:
 *     summary: Manually trigger settlement escalations
 *     tags: [Settlement Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settlement escalations processed successfully
 */
router.post('/process-escalations', authorize('admin'), catchAsync(async (req, res) => {
  await settlementNotificationService.processEscalationReminders();

  res.json({
    status: 'success',
    message: 'Settlement escalations processed successfully',
    processedAt: new Date()
  });
}));

/**
 * @swagger
 * /settlement-notifications/stats:
 *   get:
 *     summary: Get settlement notification statistics
 *     tags: [Settlement Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settlement statistics retrieved successfully
 */
router.get('/stats', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const stats = await settlementNotificationService.getSettlementStats();

  if (!stats) {
    throw new ApplicationError('Failed to retrieve settlement statistics', 500);
  }

  res.json({
    status: 'success',
    data: {
      statistics: stats,
      retrievedAt: new Date()
    }
  });
}));

/**
 * @swagger
 * /settlement-notifications/bulk-remind:
 *   post:
 *     summary: Send bulk reminders to multiple settlements
 *     tags: [Settlement Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - settlementIds
 *             properties:
 *               settlementIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               reminderType:
 *                 type: string
 *                 enum: [payment_reminder, final_notice, courtesy_reminder]
 *                 default: payment_reminder
 *     responses:
 *       200:
 *         description: Bulk reminders sent successfully
 */
router.post('/bulk-remind', authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const { settlementIds, reminderType = 'payment_reminder' } = req.body;

  if (!settlementIds || !Array.isArray(settlementIds) || settlementIds.length === 0) {
    throw new ApplicationError('Settlement IDs array is required', 400);
  }

  if (settlementIds.length > 50) {
    throw new ApplicationError('Maximum 50 settlements can be processed at once', 400);
  }

  const results = {
    successful: 0,
    failed: 0,
    errors: []
  };

  // Process reminders in parallel (with some concurrency control)
  const batchSize = 5;
  for (let i = 0; i < settlementIds.length; i += batchSize) {
    const batch = settlementIds.slice(i, i + batchSize);

    const batchPromises = batch.map(async (settlementId) => {
      try {
        const result = await settlementNotificationService.sendImmediateReminder(settlementId, reminderType);
        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push({ settlementId, error: result.error });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ settlementId, error: error.message });
      }
    });

    await Promise.all(batchPromises);
  }

  res.json({
    status: 'success',
    message: `Bulk reminders processed: ${results.successful} successful, ${results.failed} failed`,
    data: {
      results,
      reminderType,
      processedAt: new Date()
    }
  });
}));

/**
 * @swagger
 * /settlement-notifications/schedule-status:
 *   get:
 *     summary: Get notification scheduler status
 *     tags: [Settlement Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduler status retrieved successfully
 */
router.get('/schedule-status', authorize('admin'), catchAsync(async (req, res) => {
  const status = {
    isRunning: true, // Since we're using cron-based scheduling
    scheduledTasks: [
      {
        name: 'Overdue Settlements',
        schedule: '0 9 * * *', // 9 AM daily
        description: 'Process overdue settlement notifications'
      },
      {
        name: 'Due Today Settlements',
        schedule: '0 10 * * *', // 10 AM daily
        description: 'Process settlements due today'
      },
      {
        name: 'Escalation Reminders',
        schedule: '0 8 * * MON', // 8 AM every Monday
        description: 'Process settlement escalations'
      }
    ],
    lastHealthCheck: new Date(),
    version: '1.0.0'
  };

  res.json({
    status: 'success',
    data: status
  });
}));

export default router;