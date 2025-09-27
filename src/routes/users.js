import express from 'express';
import * as userManagementController from '../controllers/userManagementController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// User profile routes (guests can access their own, staff/admin can access any in their hotel)
router.route('/:userId/profile')
  .get(userManagementController.getUserBillingDetails)
  .put(userManagementController.updateUserProfile);

// User billing details routes
router.route('/:userId/billing')
  .get(userManagementController.getUserBillingDetails)
  .put(userManagementController.updateUserBillingDetails);

// GST validation utility
router.route('/validate-gst')
  .post(userManagementController.validateGSTNumber);

export default router;