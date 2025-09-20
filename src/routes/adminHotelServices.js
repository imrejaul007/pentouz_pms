import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  toggleServiceStatus,
  deleteServiceImage,
  bulkOperations,
  uploadImages,
  getServiceStaff,
  assignStaffToService,
  removeStaffFromService,
  getAvailableStaff
} from '../controllers/adminHotelServicesController.js';

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(authenticate);
router.use(authorize('admin', 'manager'));

/**
 * @swagger
 * tags:
 *   name: Admin - Hotel Services
 *   description: Admin management of hotel services and experiences
 */

// Bulk operations
router.post('/bulk-operations', bulkOperations);

// Staff management
router.get('/available-staff', getAvailableStaff);

// CRUD operations
router.route('/')
  .get(getAllServices)
  .post(uploadImages, createService);

router.route('/:id')
  .get(getServiceById)
  .put(uploadImages, updateService)
  .delete(deleteService);

// Service status toggle
router.patch('/:id/toggle-status', toggleServiceStatus);

// Staff assignment routes
router.route('/:id/staff')
  .get(getServiceStaff)
  .post(assignStaffToService);

router.delete('/:id/staff/:staffId', removeStaffFromService);

// Image management
router.delete('/:id/images/:imageIndex', deleteServiceImage);

export default router;
