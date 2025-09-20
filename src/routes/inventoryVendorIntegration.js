import express from 'express';
import inventoryVendorIntegrationService from '../services/inventoryVendorIntegrationService.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/inventory-vendor-integration/auto-purchase-orders:
 *   post:
 *     summary: Generate purchase orders from reorder alerts
 *     tags: [Inventory Vendor Integration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Purchase orders generated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/auto-purchase-orders',
  authorize(['admin', 'manager']),
  async (req, res) => {
    try {
      const { hotelId } = req.user;

      const result = await inventoryVendorIntegrationService.generateAutoPurchaseOrders(hotelId);

      res.json({
        success: true,
        data: result,
        message: result.message
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/inventory-vendor-integration/vendor-recommendations:
 *   post:
 *     summary: Get vendor recommendations for inventory items
 *     tags: [Inventory Vendor Integration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inventoryItemIds
 *             properties:
 *               inventoryItemIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Vendor recommendations retrieved successfully
 *       400:
 *         description: Validation error
 */
router.post('/vendor-recommendations',
  authorize(['admin', 'manager', 'staff']),
  [
    body('inventoryItemIds').isArray({ min: 1 }).withMessage('At least one inventory item ID is required'),
    body('inventoryItemIds.*').isMongoId().withMessage('Invalid inventory item ID')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { hotelId } = req.user;
      const { inventoryItemIds } = req.body;

      const recommendations = await inventoryVendorIntegrationService.getVendorRecommendations(
        hotelId,
        inventoryItemIds
      );

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/inventory-vendor-integration/performance-analysis:
 *   get:
 *     summary: Analyze vendor performance for inventory categories
 *     tags: [Inventory Vendor Integration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance analysis retrieved successfully
 */
router.get('/performance-analysis',
  authorize(['admin', 'manager']),
  async (req, res) => {
    try {
      const { hotelId } = req.user;

      const analysis = await inventoryVendorIntegrationService.analyzeVendorPerformanceForInventory(hotelId);

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/inventory-vendor-integration/set-preferred-vendors:
 *   post:
 *     summary: Set preferred vendors for inventory categories
 *     tags: [Inventory Vendor Integration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryVendorMappings
 *             properties:
 *               categoryVendorMappings:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     category:
 *                       type: string
 *                     vendorId:
 *                       type: string
 *                     reason:
 *                       type: string
 *     responses:
 *       200:
 *         description: Preferred vendors set successfully
 */
router.post('/set-preferred-vendors',
  authorize(['admin', 'manager']),
  [
    body('categoryVendorMappings').isArray({ min: 1 }).withMessage('At least one mapping is required'),
    body('categoryVendorMappings.*.category').trim().isLength({ min: 1 }).withMessage('Category is required'),
    body('categoryVendorMappings.*.vendorId').isMongoId().withMessage('Valid vendor ID is required'),
    body('categoryVendorMappings.*.reason').optional().trim().isLength({ max: 500 }).withMessage('Reason too long')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { hotelId } = req.user;
      const { categoryVendorMappings } = req.body;

      const results = await inventoryVendorIntegrationService.setPreferredVendorsForCategories(
        hotelId,
        categoryVendorMappings
      );

      res.json({
        success: true,
        data: results,
        message: 'Preferred vendors updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/inventory-vendor-integration/restocking-report:
 *   get:
 *     summary: Generate inventory restocking report with vendor recommendations
 *     tags: [Inventory Vendor Integration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Restocking report generated successfully
 */
router.get('/restocking-report',
  authorize(['admin', 'manager', 'staff']),
  async (req, res) => {
    try {
      const { hotelId } = req.user;

      const report = await inventoryVendorIntegrationService.generateRestockingReport(hotelId);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/inventory-vendor-integration/update-inventory-from-po/{poId}:
 *   post:
 *     summary: Update inventory levels from received purchase order
 *     tags: [Inventory Vendor Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: poId
 *         required: true
 *         schema:
 *           type: string
 *         description: Purchase order ID
 *     responses:
 *       200:
 *         description: Inventory updated successfully
 *       404:
 *         description: Purchase order not found
 */
router.post('/update-inventory-from-po/:poId',
  authorize(['admin', 'manager', 'staff']),
  [param('poId').isMongoId().withMessage('Invalid purchase order ID')],
  validateRequest,
  async (req, res) => {
    try {
      const { poId } = req.params;

      const updates = await inventoryVendorIntegrationService.updateInventoryFromPO(poId);

      res.json({
        success: true,
        data: updates,
        message: 'Inventory levels updated successfully'
      });
    } catch (error) {
      if (error.message === 'Purchase order not found') {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message
        });
      }
    }
  }
);

/**
 * @swagger
 * /api/v1/inventory-vendor-integration/preferred-vendor/{category}:
 *   get:
 *     summary: Get preferred vendor for a specific category
 *     tags: [Inventory Vendor Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *         description: Item category
 *     responses:
 *       200:
 *         description: Preferred vendor retrieved successfully
 *       404:
 *         description: No preferred vendor found
 */
router.get('/preferred-vendor/:category',
  authorize(['admin', 'manager', 'staff']),
  [param('category').trim().isLength({ min: 1 }).withMessage('Category is required')],
  validateRequest,
  async (req, res) => {
    try {
      const { hotelId } = req.user;
      const { category } = req.params;

      const vendor = await inventoryVendorIntegrationService.getPreferredVendorForCategory(
        hotelId,
        category
      );

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'No preferred vendor found for this category'
        });
      }

      res.json({
        success: true,
        data: vendor
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

export default router;
