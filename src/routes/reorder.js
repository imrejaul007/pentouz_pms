import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';
import { validateObjectId } from '../middleware/validation.js';
import reorderService from '../services/reorderService.js';
import ReorderAlert from '../models/ReorderAlert.js';
import InventoryItem from '../models/InventoryItem.js';
import logger from '../utils/logger.js';
import { ApplicationError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ReorderConfiguration:
 *       type: object
 *       properties:
 *         autoReorderEnabled:
 *           type: boolean
 *           description: Enable automatic reorder alerts
 *         reorderPoint:
 *           type: number
 *           description: Stock level that triggers reorder
 *         reorderQuantity:
 *           type: number
 *           description: Quantity to reorder
 *         preferredSupplier:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             contact:
 *               type: string
 *             email:
 *               type: string
 *             leadTime:
 *               type: number
 */

/**
 * @swagger
 * /api/v1/reorder/alerts:
 *   get:
 *     summary: Get reorder alerts for the hotel
 *     tags: [Reorder Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, acknowledged, resolved, dismissed]
 *         description: Filter by alert status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by priority level
 *       - in: query
 *         name: alertType
 *         schema:
 *           type: string
 *           enum: [low_stock, critical_stock, reorder_needed]
 *         description: Filter by alert type
 *     responses:
 *       200:
 *         description: Reorder alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     alerts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ReorderAlert'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         byPriority:
 *                           type: object
 *                         byStatus:
 *                           type: object
 */
router.get('/alerts', authenticate, requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const { status, priority, alertType } = req.query;
    const hotelId = req.user.hotelId;

    const options = {};
    if (priority) options.priority = priority;
    if (alertType) options.alertType = alertType;

    let alerts;
    if (status) {
      alerts = await ReorderAlert.getAlertsByStatus(hotelId, status);
    } else {
      alerts = await ReorderAlert.getActiveAlerts(hotelId, options);
    }

    // Get summary statistics
    const summary = {
      total: alerts.length,
      byPriority: {
        critical: alerts.filter(a => a.priority === 'critical').length,
        high: alerts.filter(a => a.priority === 'high').length,
        medium: alerts.filter(a => a.priority === 'medium').length,
        low: alerts.filter(a => a.priority === 'low').length
      },
      byStatus: {
        active: alerts.filter(a => a.status === 'active').length,
        acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
        resolved: alerts.filter(a => a.status === 'resolved').length,
        dismissed: alerts.filter(a => a.status === 'dismissed').length
      }
    };

    res.status(200).json({
      status: 'success',
      data: {
        alerts,
        summary
      }
    });

  } catch (error) {
    logger.error('Error fetching reorder alerts:', error);
    next(new ApplicationError('Failed to fetch reorder alerts', 500));
  }
});

/**
 * @swagger
 * /api/v1/reorder/configure/{itemId}:
 *   post:
 *     summary: Configure reorder settings for an inventory item
 *     tags: [Reorder Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReorderConfiguration'
 *     responses:
 *       200:
 *         description: Reorder settings configured successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Inventory item not found
 */
router.post('/configure/:itemId',
  authenticate,
  requireRole(['admin', 'manager']),
  validateObjectId('itemId'),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const { autoReorderEnabled, reorderPoint, reorderQuantity, preferredSupplier } = req.body;
      const hotelId = req.user.hotelId;

      // Verify item exists and belongs to hotel
      const item = await InventoryItem.findOne({ _id: itemId, hotelId });
      if (!item) {
        return next(new ApplicationError('Inventory item not found', 404));
      }

      // Validate reorder settings
      if (autoReorderEnabled) {
        if (!reorderPoint || reorderPoint < 0) {
          return next(new ApplicationError('Valid reorder point is required when auto-reorder is enabled', 400));
        }
        if (!reorderQuantity || reorderQuantity < 1) {
          return next(new ApplicationError('Valid reorder quantity is required when auto-reorder is enabled', 400));
        }
      }

      // Configure reorder settings
      const reorderSettings = {
        autoReorderEnabled: Boolean(autoReorderEnabled),
        reorderPoint: autoReorderEnabled ? Number(reorderPoint) : undefined,
        reorderQuantity: autoReorderEnabled ? Number(reorderQuantity) : undefined,
        preferredSupplier: preferredSupplier || {}
      };

      await item.configureReorder(reorderSettings);

      logger.info('Reorder settings configured', {
        itemId,
        hotelId,
        userId: req.user._id,
        settings: reorderSettings
      });

      res.status(200).json({
        status: 'success',
        message: 'Reorder settings configured successfully',
        data: {
          item: {
            _id: item._id,
            name: item.name,
            reorderSettings: item.reorderSettings
          }
        }
      });

    } catch (error) {
      logger.error('Error configuring reorder settings:', error);
      next(new ApplicationError('Failed to configure reorder settings', 500));
    }
  }
);

/**
 * @swagger
 * /api/v1/reorder/check:
 *   post:
 *     summary: Manually trigger reorder point check
 *     tags: [Reorder Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reorder check completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       description: Check results summary
 */
router.post('/check', authenticate, requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const hotelId = req.user.hotelId;

    // Trigger manual reorder check for this hotel
    const summary = await reorderService.checkReorderPoints(hotelId);

    logger.info('Manual reorder check completed', {
      hotelId,
      userId: req.user._id,
      summary
    });

    res.status(200).json({
      status: 'success',
      message: 'Reorder check completed successfully',
      data: { summary }
    });

  } catch (error) {
    logger.error('Error during manual reorder check:', error);
    next(new ApplicationError('Failed to complete reorder check', 500));
  }
});

/**
 * @swagger
 * /api/v1/reorder/approve/{alertId}:
 *   post:
 *     summary: Approve a reorder request
 *     tags: [Reorder Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Reorder alert ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: Action to take on the reorder request
 *               quantity:
 *                 type: number
 *                 description: Approved quantity (for approve action)
 *               supplier:
 *                 type: string
 *                 description: Selected supplier
 *               actualCost:
 *                 type: number
 *                 description: Actual quoted cost
 *               expectedDeliveryDate:
 *                 type: string
 *                 format: date
 *                 description: Expected delivery date
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       200:
 *         description: Reorder request processed successfully
 *       400:
 *         description: Invalid action or missing required data
 *       404:
 *         description: Alert not found
 */
router.post('/approve/:alertId',
  authenticate,
  requireRole(['admin', 'manager']),
  validateObjectId('alertId'),
  async (req, res, next) => {
    try {
      const { alertId } = req.params;
      const { action, quantity, supplier, actualCost, expectedDeliveryDate, notes } = req.body;
      const userId = req.user._id;
      const hotelId = req.user.hotelId;

      // Verify alert exists and belongs to hotel
      const alert = await ReorderAlert.findOne({ _id: alertId, hotelId });
      if (!alert) {
        return next(new ApplicationError('Reorder alert not found', 404));
      }

      if (action === 'approve') {
        // Create reorder request first
        const reorderData = {
          quantity: quantity || alert.suggestedQuantity,
          supplier: supplier || alert.supplierInfo?.name,
          estimatedCost: actualCost || alert.estimatedCost,
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : alert.expectedDeliveryDate,
          notes
        };

        await reorderService.createReorderRequest(alertId, userId, reorderData);

        // Then approve it
        await reorderService.processReorderRequest(alertId, userId, 'approve', {
          actualCost,
          notes
        });

      } else if (action === 'reject') {
        await reorderService.processReorderRequest(alertId, userId, 'reject', { notes });
      } else {
        return next(new ApplicationError('Invalid action. Must be "approve" or "reject"', 400));
      }

      logger.info('Reorder request processed', {
        alertId,
        action,
        userId,
        hotelId
      });

      res.status(200).json({
        status: 'success',
        message: `Reorder request ${action}ed successfully`,
        data: { action, alertId }
      });

    } catch (error) {
      logger.error('Error processing reorder request:', error);
      next(new ApplicationError('Failed to process reorder request', 500));
    }
  }
);

/**
 * @swagger
 * /api/v1/reorder/acknowledge/{alertId}:
 *   post:
 *     summary: Acknowledge a reorder alert
 *     tags: [Reorder Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Reorder alert ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Optional notes
 *     responses:
 *       200:
 *         description: Alert acknowledged successfully
 *       404:
 *         description: Alert not found
 */
router.post('/acknowledge/:alertId',
  authenticate,
  requireRole(['admin', 'manager', 'staff']),
  validateObjectId('alertId'),
  async (req, res, next) => {
    try {
      const { alertId } = req.params;
      const { notes } = req.body;
      const userId = req.user._id;
      const hotelId = req.user.hotelId;

      // Verify alert exists and belongs to hotel
      const alert = await ReorderAlert.findOne({ _id: alertId, hotelId });
      if (!alert) {
        return next(new ApplicationError('Reorder alert not found', 404));
      }

      if (alert.status !== 'active') {
        return next(new ApplicationError('Alert is not in active state', 400));
      }

      await alert.acknowledge(userId, notes);

      logger.info('Reorder alert acknowledged', {
        alertId,
        userId,
        hotelId
      });

      res.status(200).json({
        status: 'success',
        message: 'Alert acknowledged successfully',
        data: { alert }
      });

    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      next(new ApplicationError('Failed to acknowledge alert', 500));
    }
  }
);

/**
 * @swagger
 * /api/v1/reorder/dismiss/{alertId}:
 *   post:
 *     summary: Dismiss a reorder alert
 *     tags: [Reorder Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Reorder alert ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for dismissal
 *     responses:
 *       200:
 *         description: Alert dismissed successfully
 *       404:
 *         description: Alert not found
 */
router.post('/dismiss/:alertId',
  authenticate,
  requireRole(['admin', 'manager']),
  validateObjectId('alertId'),
  async (req, res, next) => {
    try {
      const { alertId } = req.params;
      const { reason } = req.body;
      const userId = req.user._id;
      const hotelId = req.user.hotelId;

      // Verify alert exists and belongs to hotel
      const alert = await ReorderAlert.findOne({ _id: alertId, hotelId });
      if (!alert) {
        return next(new ApplicationError('Reorder alert not found', 404));
      }

      await alert.dismiss(userId, reason);

      logger.info('Reorder alert dismissed', {
        alertId,
        userId,
        hotelId,
        reason
      });

      res.status(200).json({
        status: 'success',
        message: 'Alert dismissed successfully',
        data: { alert }
      });

    } catch (error) {
      logger.error('Error dismissing alert:', error);
      next(new ApplicationError('Failed to dismiss alert', 500));
    }
  }
);

/**
 * @swagger
 * /api/v1/reorder/history:
 *   get:
 *     summary: Get reorder history
 *     tags: [Reorder Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: itemId
 *         schema:
 *           type: string
 *         description: Filter by specific item ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, ordered, received, cancelled, rejected]
 *         description: Filter by reorder status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for date range filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for date range filter
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Maximum number of records to return
 *     responses:
 *       200:
 *         description: Reorder history retrieved successfully
 */
router.get('/history', authenticate, requireRole(['admin', 'manager', 'staff']), async (req, res, next) => {
  try {
    const { itemId, status, startDate, endDate, limit } = req.query;
    const hotelId = req.user.hotelId;

    const options = {
      hotelId,
      itemId,
      status,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : 50
    };

    const history = await reorderService.getReorderHistory(options);

    res.status(200).json({
      status: 'success',
      data: {
        history,
        total: history.length
      }
    });

  } catch (error) {
    logger.error('Error fetching reorder history:', error);
    next(new ApplicationError('Failed to fetch reorder history', 500));
  }
});

/**
 * @swagger
 * /api/v1/reorder/stats:
 *   get:
 *     summary: Get comprehensive reorder statistics
 *     tags: [Reorder Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reorder statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       type: object
 *                       description: Comprehensive reorder statistics
 */
router.get('/stats', authenticate, requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const hotelId = req.user.hotelId;

    const stats = await reorderService.getReorderStats(hotelId);

    res.status(200).json({
      status: 'success',
      data: { stats }
    });

  } catch (error) {
    logger.error('Error fetching reorder stats:', error);
    next(new ApplicationError('Failed to fetch reorder statistics', 500));
  }
});

/**
 * @swagger
 * /api/v1/reorder/items-needing-reorder:
 *   get:
 *     summary: Get items that currently need reordering
 *     tags: [Reorder Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Items needing reorder retrieved successfully
 */
router.get('/items-needing-reorder', authenticate, requireRole(['admin', 'manager', 'staff']), async (req, res, next) => {
  try {
    const hotelId = req.user.hotelId;

    const items = await InventoryItem.getItemsNeedingReorder(hotelId);

    // Add virtual properties for urgency assessment
    const itemsWithUrgency = items.map(item => ({
      ...item.toObject(),
      needsReorder: item.needsReorder,
      reorderUrgency: item.reorderUrgency,
      estimatedReorderCost: item.estimatedReorderCost,
      isUrgentReorder: item.isUrgentReorder()
    }));

    res.status(200).json({
      status: 'success',
      data: {
        items: itemsWithUrgency,
        total: itemsWithUrgency.length
      }
    });

  } catch (error) {
    logger.error('Error fetching items needing reorder:', error);
    next(new ApplicationError('Failed to fetch items needing reorder', 500));
  }
});

/**
 * @swagger
 * /api/v1/reorder/bulk-configure:
 *   post:
 *     summary: Configure reorder settings for multiple items
 *     tags: [Reorder Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     autoReorderEnabled:
 *                       type: boolean
 *                     reorderPoint:
 *                       type: number
 *                     reorderQuantity:
 *                       type: number
 *                     preferredSupplier:
 *                       type: object
 *     responses:
 *       200:
 *         description: Bulk configuration completed successfully
 */
router.post('/bulk-configure', authenticate, requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const { items } = req.body;
    const hotelId = req.user.hotelId;

    if (!Array.isArray(items) || items.length === 0) {
      return next(new ApplicationError('Items array is required and cannot be empty', 400));
    }

    const results = {
      success: [],
      failed: []
    };

    for (const itemConfig of items) {
      try {
        const { itemId, autoReorderEnabled, reorderPoint, reorderQuantity, preferredSupplier } = itemConfig;

        // Verify item exists and belongs to hotel
        const item = await InventoryItem.findOne({ _id: itemId, hotelId });
        if (!item) {
          results.failed.push({ itemId, error: 'Item not found' });
          continue;
        }

        // Configure reorder settings
        const reorderSettings = {
          autoReorderEnabled: Boolean(autoReorderEnabled),
          reorderPoint: autoReorderEnabled ? Number(reorderPoint) : undefined,
          reorderQuantity: autoReorderEnabled ? Number(reorderQuantity) : undefined,
          preferredSupplier: preferredSupplier || {}
        };

        await item.configureReorder(reorderSettings);
        results.success.push({ itemId, itemName: item.name });

      } catch (error) {
        results.failed.push({ itemId: itemConfig.itemId, error: error.message });
      }
    }

    logger.info('Bulk reorder configuration completed', {
      hotelId,
      userId: req.user._id,
      totalItems: items.length,
      successCount: results.success.length,
      failedCount: results.failed.length
    });

    res.status(200).json({
      status: 'success',
      message: 'Bulk configuration completed',
      data: results
    });

  } catch (error) {
    logger.error('Error in bulk reorder configuration:', error);
    next(new ApplicationError('Failed to complete bulk configuration', 500));
  }
});

export default router;