import express from 'express';
import posController from '../controllers/posController.js';
import posTaxRoutes from './posTax.js';
import measurementUnitRoutes from './measurementUnits.js';
import posAttributeRoutes from './posAttributes.js';
import billMessageRoutes from './billMessages.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Outlet routes
router.post('/outlets', authenticate, authorize(['admin', 'manager']), posController.createOutlet);
router.get('/outlets', authenticate, posController.getOutlets);
router.put('/outlets/:id', authenticate, authorize(['admin', 'manager']), posController.updateOutlet);

// Menu routes
router.post('/menus', authenticate, authorize(['admin', 'manager']), posController.createMenu);
router.get('/menus/outlet/:outletId', authenticate, posController.getMenusByOutlet);
router.post('/menus/:menuId/items', authenticate, authorize(['admin', 'manager']), posController.addMenuItem);

// Order routes
router.post('/orders', authenticate, posController.createOrder);
router.get('/orders', authenticate, posController.getOrders);
router.put('/orders/:id/status', authenticate, posController.updateOrderStatus);
router.put('/orders/:id/payment', authenticate, posController.processPayment);

// Dashboard routes
router.get('/dashboard/stats', authenticate, posController.getDashboardStats);

// Calculation routes
router.post('/calculate/order-totals', authenticate, posController.calculateOrderTotals);
router.post('/calculate/billing-totals', authenticate, posController.calculateBillingTotals);

// Reporting routes
router.get('/reports/sales', authenticate, authorize(['admin', 'manager']), posController.getSalesReport);

// Tax management routes
router.use('/taxes', posTaxRoutes);

// Measurement unit routes
router.use('/measurement-units', measurementUnitRoutes);

// POS attribute routes
router.use('/attributes', posAttributeRoutes);

// Bill message routes
router.use('/bill-messages', billMessageRoutes);

export default router;