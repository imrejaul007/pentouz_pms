import express from 'express';
import * as salutationController from '../controllers/salutationController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Public routes (for guest forms, etc.)
router.get('/public', salutationController.getAllSalutations);
router.get('/public/category/:category', salutationController.getSalutationsByCategory);
router.get('/public/gender/:gender', salutationController.getSalutationsByGender);

// Admin/Staff routes
router.use(authorize('admin', 'manager', 'staff'));

// CRUD operations
router.route('/')
  .get(salutationController.getAllSalutations)
  .post(salutationController.createSalutation);

router.route('/bulk')
  .post(salutationController.bulkCreateSalutations);

router.route('/stats')
  .get(salutationController.getSalutationStats);

router.route('/seed-defaults')
  .post(salutationController.seedDefaultSalutations);

router.route('/category/:category')
  .get(salutationController.getSalutationsByCategory);

router.route('/gender/:gender')
  .get(salutationController.getSalutationsByGender);

router.route('/:id')
  .get(salutationController.getSalutation)
  .patch(salutationController.updateSalutation)
  .delete(salutationController.deleteSalutation);

router.route('/:id/toggle-status')
  .patch(salutationController.toggleSalutationStatus);

export default router;
