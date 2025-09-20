import express from 'express';
import auditTrailController from '../controllers/auditTrailController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All audit trail routes require authentication
router.use(authenticate);

// Get all audit logs with filtering and pagination
router.get('/', authorize(['admin']), auditTrailController.getAuditLogs);

// Get audit statistics and analytics
router.get('/stats', authorize(['admin']), auditTrailController.getAuditStats);

// Get audit trail for specific entity
router.get('/entity/:entityType/:entityId', authorize(['admin', 'staff']), auditTrailController.getEntityAuditTrail);

// Get specific audit log by ID
router.get('/:id', authorize(['admin']), auditTrailController.getAuditLogById);

// Create manual audit log entry (admin only)
router.post('/', authorize(['admin']), auditTrailController.createAuditLog);

// Clean up old audit logs (admin only)
router.delete('/cleanup', authorize(['admin']), auditTrailController.cleanupAuditLogs);

// Mark audit log as reconciled
router.put('/:id/reconcile', authorize(['admin']), auditTrailController.reconcileAuditLog);

export default router;
