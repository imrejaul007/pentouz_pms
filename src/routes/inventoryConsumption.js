import express from 'express';
import { authenticate } from '../middleware/auth.js';
import housekeepingInventoryService from '../services/housekeepingInventoryService.js';
import guestInventoryService from '../services/guestInventoryService.js';
import InventoryConsumption from '../models/InventoryConsumption.js';
import InventoryItem from '../models/InventoryItem.js';
import GuestService from '../models/GuestService.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/inventory/consumption:
 *   post:
 *     summary: Track inventory consumption
 *     tags: [Inventory Consumption]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - consumptionType
 *               - consumptions
 *             properties:
 *               consumptionType:
 *                 type: string
 *                 enum: [housekeeping, guest_service]
 *               housekeepingTaskId:
 *                 type: string
 *               guestServiceId:
 *                 type: string
 *               roomId:
 *                 type: string
 *               consumptions:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Consumption tracked successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      consumptionType,
      housekeepingTaskId,
      guestServiceId,
      roomId,
      consumptions
    } = req.body;

    if (!consumptionType || !consumptions || !Array.isArray(consumptions)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: consumptionType and consumptions array'
      });
    }

    let result;

    if (consumptionType === 'housekeeping') {
      if (!housekeepingTaskId || !roomId) {
        return res.status(400).json({
          success: false,
          message: 'housekeepingTaskId and roomId are required for housekeeping consumption'
        });
      }

      result = await housekeepingInventoryService.trackConsumption({
        hotelId: req.user.hotelId,
        housekeepingTaskId,
        roomId,
        staffId: req.user.id,
        consumptions
      });
    } else if (consumptionType === 'guest_service') {
      if (!guestServiceId) {
        return res.status(400).json({
          success: false,
          message: 'guestServiceId is required for guest service consumption'
        });
      }

      // Get guest service details to extract guest and booking info
      const guestService = await GuestService.findById(guestServiceId);
      if (!guestService) {
        return res.status(404).json({
          success: false,
          message: 'Guest service not found'
        });
      }

      result = await guestInventoryService.trackGuestConsumption({
        hotelId: req.user.hotelId,
        guestServiceId,
        guestId: guestService.userId,
        bookingId: guestService.bookingId,
        roomId: roomId || guestService.roomId,
        staffId: req.user.id,
        consumptions
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid consumptionType. Must be "housekeeping" or "guest_service"'
      });
    }

    res.status(201).json(result);

  } catch (error) {
    console.error('Error tracking consumption:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to track consumption'
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/consumption/housekeeping/predict:
 *   post:
 *     summary: Predict housekeeping inventory consumption
 *     tags: [Inventory Consumption]
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
 *             properties:
 *               roomId:
 *                 type: string
 *               taskTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Consumption prediction generated
 */
router.post('/housekeeping/predict', authenticate, async (req, res) => {
  try {
    const { roomId, taskTypes = [] } = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: 'roomId is required'
      });
    }

    const predictions = await housekeepingInventoryService.predictConsumption(
      req.user.hotelId,
      roomId,
      taskTypes
    );

    res.json({
      success: true,
      data: predictions
    });

  } catch (error) {
    console.error('Error predicting consumption:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to predict consumption'
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/consumption/housekeeping/analytics:
 *   get:
 *     summary: Get housekeeping consumption analytics
 *     tags: [Inventory Consumption]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: staffId
 *         schema:
 *           type: string
 *       - in: query
 *         name: roomType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analytics data retrieved
 */
router.get('/housekeeping/analytics', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, staffId, roomType, taskType } = req.query;

    const analytics = await housekeepingInventoryService.getStaffEfficiencyAnalytics(
      req.user.hotelId,
      { startDate, endDate, staffId, roomType, taskType }
    );

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Error getting housekeeping analytics:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get analytics'
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/consumption/housekeeping/trends:
 *   get:
 *     summary: Get housekeeping consumption trends
 *     tags: [Inventory Consumption]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *       - in: query
 *         name: days
 *         schema:
 *           type: number
 *           default: 30
 *       - in: query
 *         name: itemCategory
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trend data retrieved
 */
router.get('/housekeeping/trends', authenticate, async (req, res) => {
  try {
    const { period = 'daily', days = 30, itemCategory, roomType } = req.query;

    const trends = await housekeepingInventoryService.getConsumptionTrends(
      req.user.hotelId,
      { period, itemCategory, roomType, days: parseInt(days) }
    );

    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    console.error('Error getting consumption trends:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get trends'
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/consumption/guest/recommendations:
 *   get:
 *     summary: Get personalized guest recommendations
 *     tags: [Inventory Consumption]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: guestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: serviceType
 *         schema:
 *           type: string
 *           default: room_service
 *     responses:
 *       200:
 *         description: Personalized recommendations retrieved
 */
router.get('/guest/recommendations', authenticate, async (req, res) => {
  try {
    const { guestId, roomId, serviceType = 'room_service' } = req.query;

    if (!guestId || !roomId) {
      return res.status(400).json({
        success: false,
        message: 'guestId and roomId are required'
      });
    }

    const recommendations = await guestInventoryService.getPersonalizedRecommendations(
      guestId,
      req.user.hotelId,
      roomId,
      serviceType
    );

    res.json({
      success: true,
      data: recommendations
    });

  } catch (error) {
    console.error('Error getting guest recommendations:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get recommendations'
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/consumption/guest/analytics:
 *   get:
 *     summary: Get guest consumption analytics
 *     tags: [Inventory Consumption]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: guestId
 *         schema:
 *           type: string
 *       - in: query
 *         name: vipOnly
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Guest analytics retrieved
 */
router.get('/guest/analytics', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, guestId, vipOnly } = req.query;

    const analytics = await guestInventoryService.getGuestConsumptionAnalytics(
      req.user.hotelId,
      {
        startDate,
        endDate,
        guestId,
        vipOnly: vipOnly === 'true'
      }
    );

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Error getting guest analytics:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get guest analytics'
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/consumption/auto/housekeeping:
 *   post:
 *     summary: Auto-consume inventory on housekeeping task completion
 *     tags: [Inventory Consumption]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - housekeepingTaskId
 *             properties:
 *               housekeepingTaskId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Auto-consumption completed
 */
router.post('/auto/housekeeping', authenticate, async (req, res) => {
  try {
    const { housekeepingTaskId } = req.body;

    if (!housekeepingTaskId) {
      return res.status(400).json({
        success: false,
        message: 'housekeepingTaskId is required'
      });
    }

    const result = await housekeepingInventoryService.autoConsumeOnTaskCompletion(housekeepingTaskId);

    res.json(result);

  } catch (error) {
    console.error('Error auto-consuming inventory:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to auto-consume inventory'
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/consumption:
 *   get:
 *     summary: Get inventory consumption records
 *     tags: [Inventory Consumption]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: consumptionType
 *         schema:
 *           type: string
 *       - in: query
 *         name: departmentType
 *         schema:
 *           type: string
 *       - in: query
 *         name: staffId
 *         schema:
 *           type: string
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *     responses:
 *       200:
 *         description: Consumption records retrieved
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      consumptionType,
      departmentType,
      staffId,
      roomId,
      page = 1,
      limit = 20
    } = req.query;

    const query = { hotelId: req.user.hotelId };

    // Build query filters
    if (startDate && endDate) {
      query.consumedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (consumptionType) query.consumptionType = consumptionType;
    if (departmentType) query.departmentType = departmentType;
    if (staffId) query.consumedBy = staffId;
    if (roomId) query.roomId = roomId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [consumptions, total] = await Promise.all([
      InventoryConsumption.find(query)
        .populate('inventoryItemId', 'name category unitPrice')
        .populate('consumedBy', 'name email')
        .populate('consumedFor', 'name email')
        .populate('roomId', 'roomNumber floor')
        .sort({ consumedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      InventoryConsumption.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        consumptions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalRecords: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error getting consumption records:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get consumption records'
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/consumption/stats:
 *   get:
 *     summary: Get consumption statistics
 *     tags: [Inventory Consumption]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Statistics retrieved
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filters = {};
    if (startDate && endDate) {
      filters.consumedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await InventoryConsumption.getConsumptionStats(req.user.hotelId, filters);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting consumption stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get consumption statistics'
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/consumption/{id}:
 *   get:
 *     summary: Get consumption record by ID
 *     tags: [Inventory Consumption]
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
 *         description: Consumption record retrieved
 *       404:
 *         description: Consumption record not found
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const consumption = await InventoryConsumption.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    })
      .populate('inventoryItemId')
      .populate('consumedBy', 'name email')
      .populate('consumedFor', 'name email')
      .populate('roomId', 'roomNumber floor')
      .populate('bookingId', 'bookingNumber checkInDate checkOutDate')
      .populate('guestServiceId', 'serviceType title status')
      .populate('housekeepingTaskId', 'tasks status priority');

    if (!consumption) {
      return res.status(404).json({
        success: false,
        message: 'Consumption record not found'
      });
    }

    res.json({
      success: true,
      data: consumption
    });

  } catch (error) {
    console.error('Error getting consumption record:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get consumption record'
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/consumption/{id}/billing:
 *   put:
 *     summary: Update billing status of consumption record
 *     tags: [Inventory Consumption]
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
 *             properties:
 *               invoiceId:
 *                 type: string
 *               billed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Billing status updated
 *       404:
 *         description: Consumption record not found
 */
router.put('/:id/billing', authenticate, async (req, res) => {
  try {
    const { invoiceId, billed = true } = req.body;

    const consumption = await InventoryConsumption.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    });

    if (!consumption) {
      return res.status(404).json({
        success: false,
        message: 'Consumption record not found'
      });
    }

    if (billed) {
      await consumption.markAsBilled(invoiceId);
    } else {
      consumption.billed = false;
      consumption.billedAt = null;
      consumption.invoiceId = null;
      consumption.status = 'approved';
      await consumption.save();
    }

    res.json({
      success: true,
      data: consumption,
      message: `Consumption ${billed ? 'marked as billed' : 'billing reversed'}`
    });

  } catch (error) {
    console.error('Error updating billing status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update billing status'
    });
  }
});

export default router;
