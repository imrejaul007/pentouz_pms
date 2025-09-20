import express from 'express';
import apiManagementController from '../controllers/apiManagementController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Rate limiting for API management operations
const apiManagementRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many API management requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// router.use(apiManagementRateLimit); // Disabled to prevent crashes

// API Keys Management
router.route('/api-keys')
  .get(authorize('admin', 'manager'), apiManagementController.getAPIKeys)
  .post(authorize('admin'), validate(schemas.createAPIKey), apiManagementController.createAPIKey);

router.route('/api-keys/:id')
  .put(authorize('admin'), validate(schemas.updateAPIKey), apiManagementController.updateAPIKey)
  .delete(authorize('admin'), apiManagementController.deleteAPIKey);

router.patch('/api-keys/:id/toggle', 
  authorize('admin'), 
  apiManagementController.toggleAPIKeyStatus
);

// Webhook Management
router.route('/webhooks')
  .get(authorize('admin', 'manager'), apiManagementController.getWebhooks)
  .post(authorize('admin'), validate(schemas.createWebhook), apiManagementController.createWebhook);

router.route('/webhooks/:id')
  .put(authorize('admin'), validate(schemas.updateWebhook), apiManagementController.updateWebhook)
  .delete(authorize('admin'), apiManagementController.deleteWebhook);

router.post('/webhooks/:id/test', 
  authorize('admin'), 
  apiManagementController.testWebhook
);

router.post('/webhooks/:id/regenerate-secret', 
  authorize('admin'), 
  apiManagementController.regenerateWebhookSecret
);

// API Endpoints Catalog
router.get('/endpoints',
  authorize('admin', 'manager'),
  apiManagementController.getAllEndpoints
);

// Metrics and Analytics
router.get('/metrics',
  authorize('admin', 'manager'),
  apiManagementController.getMetrics
);

router.get('/metrics/endpoints',
  authorize('admin', 'manager'),
  apiManagementController.getTopEndpoints
);

router.get('/metrics/endpoints/:endpoint', 
  authorize('admin', 'manager'), 
  apiManagementController.getEndpointMetrics
);

router.get('/metrics/api-keys', 
  authorize('admin', 'manager'), 
  apiManagementController.getAPIKeyUsage
);

router.get('/metrics/webhooks', 
  authorize('admin', 'manager'), 
  apiManagementController.getWebhookStats
);

// Export functionality
router.get('/export/logs',
  authorize('admin'),
  apiManagementController.exportLogs
);

// API Documentation
router.get('/documentation',
  authorize('admin', 'manager'),
  apiManagementController.getAPIDocumentation
);

export default router;