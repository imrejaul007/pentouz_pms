import express from 'express';
import * as customFieldController from '../controllers/customFieldController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Admin/Manager routes only
router.use(authorize('admin', 'manager'));

// CRUD operations
router.route('/')
  .get(customFieldController.getAllCustomFields)
  .post(customFieldController.createCustomField);

router.route('/statistics')
  .get(customFieldController.getFieldStatistics);

router.route('/export')
  .get(customFieldController.exportCustomFields);

router.route('/import')
  .post(customFieldController.importCustomFields);

router.route('/bulk-update')
  .patch(customFieldController.bulkUpdateCustomFields);

router.route('/reorder')
  .patch(customFieldController.reorderCustomFields);

router.route('/active')
  .get(customFieldController.getActiveFields);

router.route('/form-configuration')
  .get(customFieldController.getFormConfiguration);

router.route('/validate')
  .post(customFieldController.validateFieldValue);

router.route('/analytics')
  .get(customFieldController.getCustomDataAnalytics);

router.route('/category/:category')
  .get(customFieldController.getFieldsByCategory);

router.route('/:id')
  .get(customFieldController.getCustomField)
  .patch(customFieldController.updateCustomField)
  .delete(customFieldController.deleteCustomField);

router.route('/:id/usage-stats')
  .get(customFieldController.getFieldUsageStats);

// Guest custom data routes
router.route('/guest/:guestId/data')
  .get(customFieldController.getGuestCustomData)
  .patch(customFieldController.bulkUpdateGuestCustomData);

router.route('/guest/:guestId/data/:fieldId')
  .patch(customFieldController.updateGuestCustomData);

export default router;
