import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import propertyRoomService from '../services/propertyRoomService.js';
import { authenticate as protect, authorize as restrictTo } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Property Rooms
 *   description: Property room management endpoints
 */

/**
 * @swagger
 * /api/v1/property-rooms/property-groups:
 *   get:
 *     summary: Get available property groups for the user
 *     tags: [Property Rooms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Property groups retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/property-groups',
  protect,
  async (req, res) => {
    try {
      const propertyGroups = await propertyRoomService.getAvailablePropertyGroups(req.user._id);

      res.status(200).json({
        success: true,
        data: propertyGroups
      });

    } catch (error) {
      logger.error('Error in get property groups endpoint', {
        error: error.message,
        userId: req.user._id
      });

      res.status(400).json({
        success: false,
        message: error.message || 'Failed to retrieve property groups'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/property-rooms/create-with-rooms:
 *   post:
 *     summary: Create property with rooms in one operation
 *     tags: [Property Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               property:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   address:
 *                     type: object
 *                   contact:
 *                     type: object
 *               roomsConfig:
 *                 type: object
 *                 properties:
 *                   roomTypes:
 *                     type: object
 *                   numberingPattern:
 *                     type: string
 *                     enum: [sequential, floor-based, type-based, custom]
 *                   startingNumber:
 *                     type: number
 *     responses:
 *       201:
 *         description: Property and rooms created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/create-with-rooms',
  protect,
  restrictTo('admin', 'staff'),
  [
    body('property.name')
      .notEmpty()
      .withMessage('Property name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Property name must be between 2 and 100 characters'),

    body('property.address.street')
      .notEmpty()
      .withMessage('Street address is required'),

    body('property.address.city')
      .notEmpty()
      .withMessage('City is required'),

    body('property.contact.email')
      .isEmail()
      .withMessage('Valid email is required'),

    body('roomsConfig.roomTypes')
      .optional()
      .isObject()
      .withMessage('Room types must be an object'),

    body('roomsConfig.numberingPattern')
      .optional()
      .isIn(['sequential', 'floor-based', 'type-based', 'custom'])
      .withMessage('Invalid numbering pattern'),

    body('roomsConfig.startingNumber')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Starting number must be a positive integer')
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { property, roomsConfig } = req.body;

      // Add user context
      property.ownerId = req.user._id;
      if (req.user.hotelId) {
        property.hotelId = req.user.hotelId;
      }

      logger.info('Creating property with rooms', {
        propertyName: property.name,
        userId: req.user._id,
        roomsConfig: roomsConfig ? Object.keys(roomsConfig.roomTypes || {}) : 'none'
      });

      const result = await propertyRoomService.createPropertyWithRooms(property, roomsConfig);

      res.status(201).json({
        success: true,
        message: 'Property and rooms created successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error in create property with rooms endpoint', {
        error: error.message,
        userId: req.user._id
      });

      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create property with rooms'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/property-rooms/{propertyId}/rooms/bulk:
 *   post:
 *     summary: Create bulk rooms for existing property
 *     tags: [Property Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
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
 *               roomTypes:
 *                 type: object
 *               numberingPattern:
 *                 type: string
 *               startingNumber:
 *                 type: number
 *     responses:
 *       201:
 *         description: Rooms created successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Property not found
 */
router.post('/:propertyId/rooms/bulk',
  protect,
  restrictTo('admin', 'staff'),
  [
    param('propertyId')
      .isMongoId()
      .withMessage('Invalid property ID'),

    body('roomTypes')
      .isObject()
      .withMessage('Room types configuration is required'),

    body('numberingPattern')
      .optional()
      .isIn(['sequential', 'floor-based', 'type-based', 'custom'])
      .withMessage('Invalid numbering pattern'),

    body('startingNumber')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Starting number must be a positive integer')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { propertyId } = req.params;
      const roomsConfig = req.body;

      logger.info('Creating bulk rooms for property', {
        propertyId,
        userId: req.user._id,
        roomTypes: Object.keys(roomsConfig.roomTypes || {})
      });

      const result = await propertyRoomService.createBulkRooms(propertyId, roomsConfig);

      res.status(201).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error in bulk room creation endpoint', {
        propertyId: req.params.propertyId,
        error: error.message,
        userId: req.user._id
      });

      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create bulk rooms'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/property-rooms/{propertyId}/rooms:
 *   get:
 *     summary: Get all rooms for a property
 *     tags: [Property Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: floor
 *         schema:
 *           type: number
 *       - in: query
 *         name: available
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *     responses:
 *       200:
 *         description: Rooms retrieved successfully
 *       404:
 *         description: Property not found
 */
router.get('/:propertyId/rooms',
  protect,
  [
    param('propertyId')
      .isMongoId()
      .withMessage('Invalid property ID'),

    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { propertyId } = req.params;
      const filters = {
        status: req.query.status,
        type: req.query.type,
        floor: req.query.floor ? parseInt(req.query.floor) : null,
        available: req.query.available ? req.query.available === 'true' : null,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50
      };

      const result = await propertyRoomService.getPropertyRooms(propertyId, filters);

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error in get property rooms endpoint', {
        propertyId: req.params.propertyId,
        error: error.message,
        userId: req.user._id
      });

      res.status(400).json({
        success: false,
        message: error.message || 'Failed to retrieve rooms'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/property-rooms/{propertyId}/rooms/stats:
 *   get:
 *     summary: Get room statistics for a property
 *     tags: [Property Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room statistics retrieved successfully
 *       404:
 *         description: Property not found
 */
router.get('/:propertyId/rooms/stats',
  protect,
  [
    param('propertyId')
      .isMongoId()
      .withMessage('Invalid property ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { propertyId } = req.params;

      const stats = await propertyRoomService.getPropertyRoomStats(propertyId);

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error in get property room stats endpoint', {
        propertyId: req.params.propertyId,
        error: error.message,
        userId: req.user._id
      });

      res.status(400).json({
        success: false,
        message: error.message || 'Failed to retrieve room statistics'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/property-rooms/{propertyId}/rooms/bulk-update:
 *   patch:
 *     summary: Update multiple rooms at once
 *     tags: [Property Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
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
 *               roomIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               updateData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Rooms updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Property not found
 */
router.patch('/:propertyId/rooms/bulk-update',
  protect,
  restrictTo('admin', 'staff'),
  [
    param('propertyId')
      .isMongoId()
      .withMessage('Invalid property ID'),

    body('roomIds')
      .isArray({ min: 1 })
      .withMessage('At least one room ID is required'),

    body('roomIds.*')
      .isMongoId()
      .withMessage('Invalid room ID format'),

    body('updateData')
      .isObject()
      .withMessage('Update data is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { propertyId } = req.params;
      const { roomIds, updateData } = req.body;

      logger.info('Bulk updating rooms', {
        propertyId,
        roomCount: roomIds.length,
        userId: req.user._id,
        updateData
      });

      const result = await propertyRoomService.updateBulkRooms(propertyId, {
        roomIds,
        updateData
      });

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error in bulk room update endpoint', {
        propertyId: req.params.propertyId,
        error: error.message,
        userId: req.user._id
      });

      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update rooms'
      });
    }
  }
);

export default router;