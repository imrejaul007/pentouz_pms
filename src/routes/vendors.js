import express from 'express';
import { vendorController } from '../controllers/vendorController.js';
import vendorService from '../services/vendorService.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();

// Express-validator validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// All routes require authentication
router.use(authenticate);

// Enhanced validation schemas
const createVendorValidation = [
  body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Vendor name is required and must be under 200 characters'),
  body('contactInfo.email').isEmail().withMessage('Valid email is required'),
  body('contactInfo.phone').trim().isLength({ min: 1 }).withMessage('Phone number is required'),
  body('categories').isArray({ min: 1 }).withMessage('At least one category is required'),
  body('categories.*').isIn([
    'linens', 'toiletries', 'cleaning_supplies', 'maintenance_supplies',
    'food_beverage', 'electronics', 'furniture', 'hvac', 'plumbing',
    'electrical', 'safety_equipment', 'office_supplies', 'laundry_supplies',
    'guest_amenities', 'kitchen_equipment', 'other'
  ]).withMessage('Invalid category')
];

const updateVendorValidation = [
  param('id').isMongoId().withMessage('Invalid vendor ID'),
  body('name').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Vendor name must be under 200 characters'),
  body('contactInfo.email').optional().isEmail().withMessage('Valid email required'),
  body('categories').optional().isArray().withMessage('Categories must be an array'),
  body('status').optional().isIn(['active', 'inactive', 'blacklisted', 'preferred', 'pending_approval', 'suspended']).withMessage('Invalid status')
];

/**
 * @swagger
 * /vendors:
 *   get:
 *     summary: Get enhanced vendor list with filters and pagination
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, blacklisted, preferred, pending_approval, suspended]
 *         description: Filter by vendor status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in vendor name, email, or contact person
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *         description: Minimum performance rating
 *       - in: query
 *         name: preferred
 *         schema:
 *           type: boolean
 *         description: Filter preferred vendors
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, performance, rating, lastOrderDate]
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Enhanced vendor list retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', async (req, res) => {
  try {
    // Use enhanced service if modern parameters are present
    const hasEnhancedParams = req.query.status || req.query.categories || req.query.rating;

    if (hasEnhancedParams || req.query.enhanced === 'true') {
      const { hotelId } = req.user;
      const filters = {
        status: req.query.status,
        category: req.query.category,
        categories: req.query.categories ? req.query.categories.split(',') : undefined,
        search: req.query.search,
        rating: req.query.rating ? parseFloat(req.query.rating) : undefined,
        preferred: req.query.preferred === 'true' ? true : req.query.preferred === 'false' ? false : undefined,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
        contractExpiring: req.query.contractExpiring ? parseInt(req.query.contractExpiring) : undefined,
        tags: req.query.tags ? req.query.tags.split(',') : undefined
      };

      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sortBy: req.query.sortBy || 'name',
        sortOrder: req.query.sortOrder || 'asc',
        populate: req.query.populate !== 'false'
      };

      const result = await vendorService.getVendorList(hotelId, filters, options);

      res.json({
        success: true,
        data: result.vendors,
        pagination: result.pagination,
        enhanced: true
      });
    } else {
      // Fall back to legacy controller for backward compatibility
      return vendorController.getVendors(req, res);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /vendors/statistics:
 *   get:
 *     summary: Get vendor statistics
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vendor statistics
 */
router.get('/statistics', vendorController.getVendorStatistics);

/**
 * @swagger
 * /vendors/performance:
 *   get:
 *     summary: Get vendor performance analytics
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vendor performance data
 */
router.get('/performance', vendorController.getVendorPerformance);

/**
 * @swagger
 * /vendors/top-performers:
 *   get:
 *     summary: Get top performing vendors
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Top performing vendors
 */
router.get('/top-performers', vendorController.getTopPerformers);

/**
 * @swagger
 * /vendors/contracts/expiring:
 *   get:
 *     summary: Get vendors with expiring contracts
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: daysAhead
 *         schema:
 *           type: integer
 *           default: 30
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vendors with expiring contracts
 */
router.get('/contracts/expiring', authorize('admin', 'manager'), vendorController.getExpiringContracts);

/**
 * @swagger
 * /vendors/search:
 *   get:
 *     summary: Advanced vendor search
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *       - in: query
 *         name: categories
 *         schema:
 *           type: string
 *           description: Comma-separated list of categories
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxDeliveryTime
 *         schema:
 *           type: integer
 *       - in: query
 *         name: isPreferred
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: hasContract
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', vendorController.searchVendors);

/**
 * @swagger
 * /vendors/by-category/{category}:
 *   get:
 *     summary: Get vendors by category
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vendors in category
 */
router.get('/by-category/:category', vendorController.getVendorsByCategory);

/**
 * @swagger
 * /vendors/{id}:
 *   get:
 *     summary: Get specific vendor
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vendor details
 */
router.get('/:id', vendorController.getVendor);

/**
 * @swagger
 * /vendors:
 *   post:
 *     summary: Create new vendor
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - contactPerson
 *               - email
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [cleaning, general, food_beverage, maintenance, electronics, textiles, other]
 *               contactPerson:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   country:
 *                     type: string
 *                   zipCode:
 *                     type: string
 *               paymentTerms:
 *                 type: string
 *                 enum: [Net 15, Net 30, Net 45, Net 60, COD, Advance Payment]
 *               deliveryTime:
 *                 type: string
 *               minOrderValue:
 *                 type: number
 *               specializations:
 *                 type: array
 *                 items:
 *                   type: string
 *               isPreferred:
 *                 type: boolean
 *               hotelId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Vendor created successfully
 */
// Enhanced create vendor route
router.post('/',
  authorize('admin', 'manager'),
  createVendorValidation,
  validateRequest,
  async (req, res) => {
    try {
      // Use enhanced service if new structure is present
      if (req.body.contactInfo || req.body.categories) {
        const { hotelId, _id: userId } = req.user;
        const vendorData = {
          ...req.body,
          hotelId
        };

        const vendor = await vendorService.createVendor(vendorData, userId);

        res.status(201).json({
          success: true,
          data: vendor,
          message: 'Vendor created successfully',
          enhanced: true
        });
      } else {
        // Fall back to legacy controller for backward compatibility
        return vendorController.createVendor(req, res);
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Legacy create route for backward compatibility
router.post('/legacy', authorize('admin', 'manager'), vendorController.createVendor);

/**
 * @swagger
 * /vendors/{id}:
 *   put:
 *     summary: Update vendor
 *     tags: [Vendors]
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
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               contactPerson:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               isPreferred:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Vendor updated successfully
 */
router.put('/:id', authorize('admin', 'manager'), vendorController.updateVendor);

/**
 * @swagger
 * /vendors/{id}:
 *   delete:
 *     summary: Delete vendor (soft delete)
 *     tags: [Vendors]
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
 *         description: Vendor deleted successfully
 */
router.delete('/:id', authorize('admin', 'manager'), vendorController.deleteVendor);

/**
 * @swagger
 * /vendors/{id}/performance:
 *   post:
 *     summary: Update vendor performance metrics
 *     tags: [Vendors]
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
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *               deliveredOnTime:
 *                 type: boolean
 *               deliveryTime:
 *                 type: number
 *                 description: Delivery time in days
 *               qualityRating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *     responses:
 *       200:
 *         description: Performance updated successfully
 */
router.post('/:id/performance', authorize('admin', 'manager'), vendorController.updateVendorPerformance);

/**
 * @swagger
 * /vendors/{id}/payment:
 *   post:
 *     summary: Add payment record
 *     tags: [Vendors]
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
 *               - amount
 *               - method
 *             properties:
 *               amount:
 *                 type: number
 *               method:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [paid, pending, overdue]
 *               date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Payment record added successfully
 */
router.post('/:id/payment', authorize('admin', 'manager'), vendorController.addPaymentRecord);

// Enhanced vendor routes
/**
 * @swagger
 * /vendors/enhanced/analytics:
 *   get:
 *     summary: Get enhanced vendor analytics dashboard data
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [weekly, monthly, quarterly, yearly]
 *         description: Analytics period
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: Enhanced vendor analytics retrieved successfully
 */
router.get('/enhanced/analytics',
  authorize(['admin', 'manager']),
  async (req, res) => {
    try {
      const { hotelId } = req.user;
      const period = req.query.period || 'monthly';
      const filters = {
        category: req.query.category,
        status: req.query.status ? req.query.status.split(',') : undefined,
        dateRange: req.query.startDate && req.query.endDate ? {
          start: req.query.startDate,
          end: req.query.endDate
        } : undefined
      };

      const analytics = await vendorService.getVendorAnalytics(hotelId, period, filters);

      res.json({
        success: true,
        data: analytics,
        enhanced: true
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
 * /vendors/enhanced/comparison:
 *   post:
 *     summary: Compare multiple vendors with enhanced metrics
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vendorIds
 *             properties:
 *               vendorIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 2
 *     responses:
 *       200:
 *         description: Enhanced vendor comparison data retrieved successfully
 */
router.post('/enhanced/comparison',
  authorize(['admin', 'manager']),
  [
    body('vendorIds').isArray({ min: 2 }).withMessage('At least 2 vendors required for comparison'),
    body('vendorIds.*').isMongoId().withMessage('Invalid vendor ID')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { hotelId } = req.user;
      const { vendorIds } = req.body;

      const comparison = await vendorService.compareVendors(hotelId, vendorIds);

      res.json({
        success: true,
        data: comparison,
        enhanced: true
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /vendors/enhanced/preferred:
 *   get:
 *     summary: Get preferred vendors with enhanced data
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: Enhanced preferred vendors retrieved successfully
 */
router.get('/enhanced/preferred',
  authorize(['admin', 'manager', 'staff']),
  async (req, res) => {
    try {
      const { hotelId } = req.user;
      const category = req.query.category;

      const vendors = await vendorService.getPreferredVendors(hotelId, category);

      res.json({
        success: true,
        data: vendors,
        enhanced: true
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
 * /vendors/{id}/enhanced/details:
 *   get:
 *     summary: Get enhanced vendor details with performance data
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: Enhanced vendor details retrieved successfully
 */
router.get('/:id/enhanced/details',
  authorize(['admin', 'manager', 'staff']),
  [param('id').isMongoId().withMessage('Invalid vendor ID')],
  validateRequest,
  async (req, res) => {
    try {
      const { hotelId } = req.user;
      const { id } = req.params;

      const result = await vendorService.getVendorDetails(id, hotelId);

      res.json({
        success: true,
        data: result,
        enhanced: true
      });
    } catch (error) {
      if (error.message === 'Vendor not found') {
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
 * /vendors/{id}/enhanced/performance-update:
 *   post:
 *     summary: Update vendor performance with enhanced ratings
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vendor ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               delivery:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               quality:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               service:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               price:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *     responses:
 *       200:
 *         description: Enhanced performance evaluation added successfully
 */
router.post('/:id/enhanced/performance-update',
  authorize(['admin', 'manager']),
  [
    param('id').isMongoId().withMessage('Invalid vendor ID'),
    body('delivery').optional().isFloat({ min: 1, max: 5 }).withMessage('Delivery rating must be between 1 and 5'),
    body('quality').optional().isFloat({ min: 1, max: 5 }).withMessage('Quality rating must be between 1 and 5'),
    body('service').optional().isFloat({ min: 1, max: 5 }).withMessage('Service rating must be between 1 and 5'),
    body('price').optional().isFloat({ min: 1, max: 5 }).withMessage('Price rating must be between 1 and 5')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { hotelId } = req.user;
      const { id } = req.params;
      const ratings = req.body;

      // Get vendor and update performance ratings
      const vendor = await vendorService.getVendorDetails(id, hotelId);
      if (!vendor.vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      await vendor.vendor.updatePerformanceRating(ratings);

      res.json({
        success: true,
        message: 'Enhanced performance evaluation added successfully',
        enhanced: true
      });
    } catch (error) {
      if (error.message === 'Vendor not found') {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: error.message
        });
      }
    }
  }
);

export default router;