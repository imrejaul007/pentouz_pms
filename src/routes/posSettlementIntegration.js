import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import posSettlementIntegrationService from '../services/posSettlementIntegrationService.js';
import BillingSession from '../models/BillingSession.js';
import CheckoutInventory from '../models/CheckoutInventory.js';
import Settlement from '../models/Settlement.js';

const router = express.Router();

/**
 * @swagger
 * /pos-settlements/create-from-session:
 *   post:
 *     summary: Create settlement from POS billing session (Admin/Staff only)
 *     tags: [POS Settlement Integration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - billingSessionId
 *             properties:
 *               billingSessionId:
 *                 type: string
 *                 description: Billing session ID
 *               autoIntegrate:
 *                 type: boolean
 *                 default: true
 *                 description: Automatically integrate with existing settlement if found
 *     responses:
 *       201:
 *         description: Settlement created/updated successfully
 *       400:
 *         description: Invalid billing session or already integrated
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Billing session not found
 */
router.post('/create-from-session',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const { billingSessionId, autoIntegrate = true } = req.body;

    if (!billingSessionId) {
      throw new ApplicationError('Billing session ID is required', 400);
    }

    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    const result = await posSettlementIntegrationService.createSettlementFromBillingSession(
      billingSessionId,
      userContext
    );

    res.status(201).json({
      status: 'success',
      data: {
        ...result,
        message: result.integration.type === 'new_settlement_created'
          ? 'New settlement created from POS billing session'
          : 'POS charges added to existing settlement'
      }
    });
  })
);

/**
 * @swagger
 * /pos-settlements/add-checkout-to-settlement:
 *   post:
 *     summary: Add checkout inventory to settlement (Admin/Staff only)
 *     tags: [POS Settlement Integration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - checkoutInventoryId
 *             properties:
 *               checkoutInventoryId:
 *                 type: string
 *                 description: Checkout inventory ID
 *               settlementId:
 *                 type: string
 *                 description: Specific settlement ID (optional)
 *     responses:
 *       200:
 *         description: Checkout charges added to settlement successfully
 *       400:
 *         description: Invalid checkout inventory or no chargeable items
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Checkout inventory not found
 */
router.post('/add-checkout-to-settlement',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const { checkoutInventoryId, settlementId = null } = req.body;

    if (!checkoutInventoryId) {
      throw new ApplicationError('Checkout inventory ID is required', 400);
    }

    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    const result = await posSettlementIntegrationService.addCheckoutInventoryToSettlement(
      checkoutInventoryId,
      settlementId,
      userContext
    );

    res.json({
      status: 'success',
      data: {
        ...result,
        message: 'Checkout charges added to settlement successfully'
      }
    });
  })
);

/**
 * @swagger
 * /pos-settlements/{settlementId}/unified-payment:
 *   post:
 *     summary: Process unified payment across POS and Settlement systems (Admin/Staff only)
 *     tags: [POS Settlement Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: settlementId
 *         required: true
 *         schema:
 *           type: string
 *         description: Settlement ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - method
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 description: Payment amount
 *               method:
 *                 type: string
 *                 enum: [cash, card, upi, bank_transfer, online_portal]
 *                 description: Payment method
 *               reference:
 *                 type: string
 *                 description: Payment reference
 *               notes:
 *                 type: string
 *                 description: Payment notes
 *               updateRelatedSystems:
 *                 type: boolean
 *                 default: true
 *                 description: Update related POS and checkout systems
 *     responses:
 *       200:
 *         description: Payment processed successfully across all systems
 *       400:
 *         description: Invalid payment data
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Settlement not found
 */
router.post('/:settlementId/unified-payment',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const { settlementId } = req.params;
    const { updateRelatedSystems = true, ...paymentData } = req.body;

    if (!paymentData.amount || paymentData.amount <= 0 || !paymentData.method) {
      throw new ApplicationError('Valid amount and payment method are required', 400);
    }

    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    const result = await posSettlementIntegrationService.processUnifiedPayment(
      settlementId,
      paymentData,
      userContext
    );

    res.json({
      status: 'success',
      data: {
        ...result,
        message: 'Payment processed successfully across all systems'
      }
    });
  })
);

/**
 * @swagger
 * /pos-settlements/preview/{bookingId}:
 *   get:
 *     summary: Get settlement preview for booking (Admin/Staff only)
 *     tags: [POS Settlement Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Settlement preview generated successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.get('/preview/:bookingId',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const { bookingId } = req.params;

    const preview = await posSettlementIntegrationService.getSettlementPreview(bookingId);

    res.json({
      status: 'success',
      data: {
        preview,
        message: 'Settlement preview generated successfully'
      }
    });
  })
);

/**
 * @swagger
 * /pos-settlements/sync-guest-data/{bookingId}:
 *   post:
 *     summary: Sync guest data across POS and Settlement systems (Admin/Staff only)
 *     tags: [POS Settlement Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Guest data synchronized successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.post('/sync-guest-data/:bookingId',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const { bookingId } = req.params;

    const result = await posSettlementIntegrationService.syncGuestDataAcrossSystems(bookingId);

    res.json({
      status: 'success',
      data: {
        ...result,
        message: 'Guest data synchronized successfully across all systems'
      }
    });
  })
);

/**
 * @swagger
 * /pos-settlements/ready-for-integration:
 *   get:
 *     summary: Get POS sessions and checkouts ready for settlement integration (Admin/Staff only)
 *     tags: [POS Settlement Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bookingId
 *         schema:
 *           type: string
 *         description: Filter by specific booking ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Number of items to return
 *     responses:
 *       200:
 *         description: Integration-ready items retrieved successfully
 *       403:
 *         description: Access denied - admin/staff only
 */
router.get('/ready-for-integration',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;
    const { bookingId, limit = 50 } = req.query;

    // Get POS billing sessions ready for integration
    const readyBillingSessions = await BillingSession.findReadyForSettlement(
      hotelId,
      bookingId
    ).limit(parseInt(limit));

    // Get checkout inventories ready for integration
    const readyCheckouts = await CheckoutInventory.findReadyForSettlement(
      hotelId,
      bookingId
    );

    res.json({
      status: 'success',
      data: {
        billingSessions: {
          count: readyBillingSessions.length,
          items: readyBillingSessions.map(session => session.getSettlementSummary())
        },
        checkoutInventories: {
          count: readyCheckouts.length,
          items: readyCheckouts.map(checkout => checkout.getSettlementSummary())
        },
        summary: {
          totalItemsReady: readyBillingSessions.length + readyCheckouts.length,
          totalPOSAmount: readyBillingSessions.reduce((sum, session) => sum + session.grandTotal, 0),
          totalCheckoutCharges: readyCheckouts.reduce((sum, checkout) => sum + checkout.totalAmount, 0)
        }
      }
    });
  })
);

/**
 * @swagger
 * /pos-settlements/integration-stats:
 *   get:
 *     summary: Get POS-Settlement integration statistics (Admin/Staff only)
 *     tags: [POS Settlement Integration]
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
 *         description: Integration statistics retrieved successfully
 *       403:
 *         description: Access denied - admin/staff only
 */
router.get('/integration-stats',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;
    const { startDate, endDate } = req.query;

    const dateRange = {};
    if (startDate) dateRange.start = startDate;
    if (endDate) dateRange.end = endDate;

    // Get statistics from both systems
    const [posStats, checkoutStats] = await Promise.all([
      BillingSession.getSettlementIntegrationStats(hotelId, dateRange),
      CheckoutInventory.getCheckoutIntegrationStats(hotelId, dateRange)
    ]);

    res.json({
      status: 'success',
      data: {
        posIntegration: posStats[0] || {
          byStatus: [],
          totalSessions: 0,
          totalValue: 0
        },
        checkoutIntegration: checkoutStats[0] || {
          byStatus: [],
          totalCheckouts: 0,
          totalCharges: 0
        },
        dateRange,
        generatedAt: new Date()
      }
    });
  })
);

/**
 * @swagger
 * /pos-settlements/bulk-integrate:
 *   post:
 *     summary: Bulk integrate multiple POS sessions and checkouts to settlements (Admin only)
 *     tags: [POS Settlement Integration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               billingSessionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of billing session IDs
 *               checkoutInventoryIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of checkout inventory IDs
 *               createNewSettlements:
 *                 type: boolean
 *                 default: true
 *                 description: Create new settlements if none exist
 *     responses:
 *       200:
 *         description: Bulk integration completed successfully
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Access denied - admin only
 */
router.post('/bulk-integrate',
  authenticate,
  authorize(['admin']),
  catchAsync(async (req, res) => {
    const { billingSessionIds = [], checkoutInventoryIds = [], createNewSettlements = true } = req.body;

    if (billingSessionIds.length === 0 && checkoutInventoryIds.length === 0) {
      throw new ApplicationError('At least one billing session or checkout inventory ID is required', 400);
    }

    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    const results = {
      billingSessions: [],
      checkoutInventories: [],
      errors: [],
      summary: {
        successCount: 0,
        errorCount: 0,
        totalAmount: 0
      }
    };

    // Process billing sessions
    for (const sessionId of billingSessionIds) {
      try {
        const result = await posSettlementIntegrationService.createSettlementFromBillingSession(
          sessionId,
          userContext
        );
        results.billingSessions.push({
          sessionId,
          success: true,
          settlement: result.settlement,
          integration: result.integration
        });
        results.summary.successCount++;
        results.summary.totalAmount += result.billingSession.grandTotal;
      } catch (error) {
        results.billingSessions.push({
          sessionId,
          success: false,
          error: error.message
        });
        results.errors.push(`Billing session ${sessionId}: ${error.message}`);
        results.summary.errorCount++;
      }
    }

    // Process checkout inventories
    for (const checkoutId of checkoutInventoryIds) {
      try {
        const result = await posSettlementIntegrationService.addCheckoutInventoryToSettlement(
          checkoutId,
          null,
          userContext
        );
        results.checkoutInventories.push({
          checkoutId,
          success: true,
          settlement: result.settlement,
          integration: result.integration
        });
        results.summary.successCount++;
        results.summary.totalAmount += result.checkoutInventory.totalAmount;
      } catch (error) {
        results.checkoutInventories.push({
          checkoutId,
          success: false,
          error: error.message
        });
        results.errors.push(`Checkout inventory ${checkoutId}: ${error.message}`);
        results.summary.errorCount++;
      }
    }

    res.json({
      status: 'success',
      data: {
        ...results,
        message: `Bulk integration completed: ${results.summary.successCount} successful, ${results.summary.errorCount} failed`
      }
    });
  })
);

export default router;