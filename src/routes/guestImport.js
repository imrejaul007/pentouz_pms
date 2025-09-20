import express from 'express';
import * as guestImportController from '../controllers/guestImportController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Admin/Staff routes only
router.use(authorize('admin', 'manager', 'staff'));

// File upload route
router.post('/upload', 
  guestImportController.upload.single('file'),
  guestImportController.uploadFile
);

// Import guests
router.post('/import', guestImportController.importGuests);

// Validate guest data
router.post('/validate', guestImportController.validateGuestData);

// Get import template
router.get('/template', guestImportController.getImportTemplate);

// Download template
router.get('/template/download', guestImportController.downloadTemplate);

// Get import statistics
router.get('/statistics', guestImportController.getImportStatistics);

// Get supported formats
router.get('/formats', guestImportController.getSupportedFormats);

export default router;
