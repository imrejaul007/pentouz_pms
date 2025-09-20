import express from 'express';
import { body, param, query } from 'express-validator';
import hotelAreaController from '../controllers/hotelAreaController.js';
import { authenticate } from '../middleware/auth.js';
import hotelMiddleware from '../middleware/hotelMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';

const router = express.Router();

// Authentication middleware for all routes
router.use(authenticate);

// Validation schemas
const createAreaValidation = [
  param('hotelId')
    .isMongoId()
    .withMessage('Invalid hotel ID format'),

  body('areaName')
    .notEmpty()
    .withMessage('Area name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Area name must be between 2 and 100 characters')
    .trim(),

  body('areaCode')
    .notEmpty()
    .withMessage('Area code is required')
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('Area code must contain only uppercase letters, numbers, underscores, and hyphens')
    .isLength({ min: 2, max: 20 })
    .withMessage('Area code must be between 2 and 20 characters')
    .trim(),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
    .trim(),

  body('areaType')
    .isIn(['building', 'wing', 'floor', 'section', 'block', 'tower', 'annex', 'pavilion'])
    .withMessage('Invalid area type'),

  body('parentAreaId')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent area ID format'),

  body('floorNumber')
    .optional()
    .isInt()
    .withMessage('Floor number must be an integer'),

  body('totalSqft')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total square feet must be a positive number'),

  body('location.coordinates.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  body('location.coordinates.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),

  body('location.address.street')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Street address cannot exceed 200 characters')
    .trim(),

  body('location.address.city')
    .optional()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters')
    .trim(),

  body('location.address.state')
    .optional()
    .isLength({ max: 100 })
    .withMessage('State cannot exceed 100 characters')
    .trim(),

  body('location.address.zipCode')
    .optional()
    .matches(/^[A-Z0-9\s-]{2,20}$/i)
    .withMessage('Invalid zip code format')
    .trim(),

  body('location.address.country')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters')
    .trim(),

  body('accessPoints')
    .optional()
    .isArray()
    .withMessage('Access points must be an array'),

  body('accessPoints.*.name')
    .optional()
    .notEmpty()
    .withMessage('Access point name is required')
    .isLength({ max: 100 })
    .withMessage('Access point name cannot exceed 100 characters'),

  body('accessPoints.*.type')
    .optional()
    .isIn(['main_entrance', 'side_entrance', 'emergency_exit', 'service_entrance', 'elevator', 'stairs'])
    .withMessage('Invalid access point type'),

  body('accessPoints.*.keyCardRequired')
    .optional()
    .isBoolean()
    .withMessage('Key card required must be a boolean'),

  body('amenities')
    .optional()
    .isArray()
    .withMessage('Amenities must be an array'),

  body('amenities.*')
    .optional()
    .isIn([
      'elevator', 'stairs', 'handicap_accessible', 'vending_machines',
      'ice_machines', 'laundry', 'fitness_center', 'business_center',
      'meeting_rooms', 'restaurant', 'bar', 'pool', 'spa', 'parking',
      'wifi', 'concierge', 'room_service', 'housekeeping_station',
      'maintenance_room', 'storage', 'gift_shop', 'atm', 'safe_deposit'
    ])
    .withMessage('Invalid amenity type'),

  body('specialFeatures')
    .optional()
    .isArray()
    .withMessage('Special features must be an array'),

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'under_renovation', 'under_construction', 'closed'])
    .withMessage('Invalid status'),

  body('assignedStaff')
    .optional()
    .isArray()
    .withMessage('Assigned staff must be an array'),

  body('assignedStaff.*.staffId')
    .optional()
    .isMongoId()
    .withMessage('Invalid staff ID format'),

  body('assignedStaff.*.role')
    .optional()
    .isIn(['manager', 'supervisor', 'housekeeping', 'maintenance', 'security', 'concierge'])
    .withMessage('Invalid staff role'),

  body('assignedStaff.*.shift')
    .optional()
    .isIn(['morning', 'afternoon', 'evening', 'night', 'all_day'])
    .withMessage('Invalid staff shift'),

  body('roomNumberRange.startNumber')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Start number must be a positive integer'),

  body('roomNumberRange.endNumber')
    .optional()
    .isInt({ min: 1 })
    .withMessage('End number must be a positive integer'),

  body('securitySettings.requiresKeyCard')
    .optional()
    .isBoolean()
    .withMessage('Requires key card must be a boolean'),

  body('securitySettings.cameraCount')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Camera count must be a non-negative integer'),

  body('securitySettings.alarmSystem')
    .optional()
    .isBoolean()
    .withMessage('Alarm system must be a boolean'),

  body('displaySettings.color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color code'),

  body('displaySettings.icon')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Icon cannot exceed 50 characters'),

  body('displaySettings.displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),

  body('displaySettings.showInPublicAreas')
    .optional()
    .isBoolean()
    .withMessage('Show in public areas must be a boolean'),

  body('notes')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Notes cannot exceed 2000 characters')
    .trim(),

  body('internalNotes')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Internal notes cannot exceed 2000 characters')
    .trim()
];

const updateAreaValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid area ID format'),

  ...createAreaValidation.slice(1) // Remove hotelId param validation
];

const bulkUpdateValidation = [
  param('hotelId')
    .isMongoId()
    .withMessage('Invalid hotel ID format'),

  body('areaIds')
    .isArray({ min: 1 })
    .withMessage('Area IDs array is required and must not be empty'),

  body('areaIds.*')
    .isMongoId()
    .withMessage('Invalid area ID format'),

  body('status')
    .isIn(['active', 'inactive', 'under_renovation', 'under_construction', 'closed'])
    .withMessage('Invalid status')
];

const assignStaffValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid area ID format'),

  body('staffAssignments')
    .isArray()
    .withMessage('Staff assignments must be an array'),

  body('staffAssignments.*.staffId')
    .isMongoId()
    .withMessage('Invalid staff ID format'),

  body('staffAssignments.*.role')
    .isIn(['manager', 'supervisor', 'housekeeping', 'maintenance', 'security', 'concierge'])
    .withMessage('Invalid staff role'),

  body('staffAssignments.*.shift')
    .isIn(['morning', 'afternoon', 'evening', 'night', 'all_day'])
    .withMessage('Invalid staff shift'),

  body('staffAssignments.*.isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean')
];

const paramValidation = [
  param('hotelId')
    .isMongoId()
    .withMessage('Invalid hotel ID format')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('areaType')
    .optional()
    .isIn(['building', 'wing', 'floor', 'section', 'block', 'tower', 'annex', 'pavilion'])
    .withMessage('Invalid area type'),

  query('status')
    .optional()
    .isIn(['active', 'inactive', 'under_renovation', 'under_construction', 'closed'])
    .withMessage('Invalid status'),

  query('parentAreaId')
    .optional()
    .custom((value) => {
      if (value === 'null') return true;
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Invalid parent area ID format');
      }
      return true;
    }),

  query('includeHierarchy')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Include hierarchy must be true or false'),

  query('includeStats')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Include stats must be true or false'),

  query('includeChildren')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Include children must be true or false'),

  query('includeRooms')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Include rooms must be true or false'),

  query('sortBy')
    .optional()
    .isIn(['areaName', 'areaCode', 'areaType', 'status', 'hierarchyLevel', 'displaySettings.displayOrder', 'totalRooms', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

// Routes

// Get all hotel areas for a hotel
router.get(
  '/:hotelId/areas',
  paramValidation,
  queryValidation,
  hotelMiddleware,
  roleMiddleware(['admin', 'manager', 'front_desk', 'housekeeping']),
  hotelAreaController.getAllAreas
);

// Get hotel area statistics
router.get(
  '/:hotelId/areas/statistics',
  paramValidation,
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('areaType').optional().isIn(['building', 'wing', 'floor', 'section', 'block', 'tower', 'annex', 'pavilion']),
  hotelMiddleware,
  roleMiddleware(['admin', 'manager']),
  hotelAreaController.getAreaStatistics
);

// Get areas by type
router.get(
  '/:hotelId/areas/type/:areaType',
  param('hotelId').isMongoId(),
  param('areaType').isIn(['building', 'wing', 'floor', 'section', 'block', 'tower', 'annex', 'pavilion']),
  hotelMiddleware,
  roleMiddleware(['admin', 'manager', 'front_desk', 'housekeeping']),
  hotelAreaController.getAreasByType
);

// Get single hotel area by ID
router.get(
  '/areas/:id',
  param('id').isMongoId(),
  queryValidation,
  roleMiddleware(['admin', 'manager', 'front_desk', 'housekeeping']),
  hotelAreaController.getAreaById
);

// Get area hierarchy tree
router.get(
  '/areas/:id/tree',
  param('id').isMongoId(),
  roleMiddleware(['admin', 'manager', 'front_desk']),
  hotelAreaController.getAreaTree
);

// Create new hotel area
router.post(
  '/:hotelId/areas',
  createAreaValidation,
  hotelMiddleware,
  roleMiddleware(['admin', 'manager']),
  hotelAreaController.createArea
);

// Update hotel area
router.put(
  '/areas/:id',
  updateAreaValidation,
  roleMiddleware(['admin', 'manager']),
  hotelAreaController.updateArea
);

// Delete hotel area
router.delete(
  '/areas/:id',
  param('id').isMongoId(),
  roleMiddleware(['admin']),
  hotelAreaController.deleteArea
);

// Bulk update area status
router.patch(
  '/:hotelId/areas/bulk-status',
  bulkUpdateValidation,
  hotelMiddleware,
  roleMiddleware(['admin', 'manager']),
  hotelAreaController.bulkUpdateStatus
);

// Update area room counts
router.patch(
  '/areas/:id/room-counts',
  param('id').isMongoId(),
  roleMiddleware(['admin', 'manager', 'housekeeping']),
  hotelAreaController.updateRoomCounts
);

// Update area statistics
router.patch(
  '/areas/:id/statistics',
  param('id').isMongoId(),
  roleMiddleware(['admin', 'manager']),
  hotelAreaController.updateAreaStatistics
);

// Assign staff to area
router.patch(
  '/areas/:id/assign-staff',
  assignStaffValidation,
  roleMiddleware(['admin', 'manager']),
  hotelAreaController.assignStaff
);

// Error handling middleware for this router
router.use((error, req, res, next) => {
  console.error('Hotel Areas Router Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error in hotel areas module',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

export default router;
