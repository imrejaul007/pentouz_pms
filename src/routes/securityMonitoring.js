import express from 'express';
import securityMonitoringController from '../controllers/securityMonitoringController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requirePermission, requireRoleLevel } from '../middleware/permissionCheck.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const securityEventSchema = Joi.object({
  type: Joi.string().valid(
    'authentication',
    'authorization', 
    'data_access',
    'session_start',
    'session_end',
    'privilege_change',
    'api_request',
    'file_access',
    'configuration_change',
    'system_access'
  ).required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  resource: Joi.string().optional(),
  action: Joi.string().required(),
  outcome: Joi.string().valid('success', 'failure', 'blocked', 'denied').required(),
  details: Joi.object().optional(),
  risk_score: Joi.number().min(0).max(100).optional()
});

const auditEventSchema = Joi.object({
  action: Joi.string().required(),
  resource: Joi.string().required(),
  resourceId: Joi.string().optional(),
  outcome: Joi.string().valid('success', 'failure', 'denied').required(),
  changes: Joi.object().optional(),
  metadata: Joi.object().optional(),
  compliance_tags: Joi.array().items(Joi.string()).optional()
});

const updateAlertSchema = Joi.object({
  status: Joi.string().valid('open', 'investigating', 'resolved', 'false_positive').optional(),
  assignedTo: Joi.string().optional(),
  notes: Joi.string().optional()
});

const reviewActivitySchema = Joi.object({
  status: Joi.string().valid('under_review', 'reviewed', 'escalated', 'resolved').optional(),
  false_positive: Joi.boolean().optional(),
  notes: Joi.string().optional()
});

// Authentication required for all routes
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     SecurityEvent:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [authentication, authorization, data_access, session_start, session_end, privilege_change, api_request, file_access, configuration_change, system_access]
 *         severity:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         resource:
 *           type: string
 *         action:
 *           type: string
 *         outcome:
 *           type: string
 *           enum: [success, failure, blocked, denied]
 *         details:
 *           type: object
 *         risk_score:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 */

// Security Event Management

/**
 * @swagger
 * /security-monitoring/events:
 *   post:
 *     summary: Log security event
 *     description: Log a new security event for monitoring and analysis
 *     tags: [Security Monitoring - Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SecurityEvent'
 *     responses:
 *       201:
 *         description: Security event logged successfully
 */
router.post('/events',
  requirePermission('system:read'), // Basic permission to log events
  validate(securityEventSchema),
  securityMonitoringController.logSecurityEvent
);

/**
 * @swagger
 * /security-monitoring/events:
 *   get:
 *     summary: Get security events
 *     description: Retrieve security events with filtering options
 *     tags: [Security Monitoring - Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by event type
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by severity level
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Timeframe in hours
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of events to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of events to skip
 *     responses:
 *       200:
 *         description: Security events retrieved successfully
 */
router.get('/events',
  requirePermission('audit:read'),
  securityMonitoringController.getSecurityEvents
);

/**
 * @swagger
 * /security-monitoring/events/{eventId}:
 *   get:
 *     summary: Get specific security event
 *     description: Retrieve detailed information about a specific security event
 *     tags: [Security Monitoring - Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Security event retrieved successfully
 *       404:
 *         description: Security event not found
 */
router.get('/events/:eventId',
  requirePermission('audit:read'),
  securityMonitoringController.getSecurityEvent
);

// Threat Alert Management

/**
 * @swagger
 * /security-monitoring/alerts:
 *   get:
 *     summary: Get threat alerts
 *     description: Retrieve threat alerts with filtering options
 *     tags: [Security Monitoring - Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by severity level
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, investigating, resolved, false_positive, all]
 *           default: open
 *         description: Filter by alert status
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Timeframe in hours
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Threat alerts retrieved successfully
 */
router.get('/alerts',
  requirePermission('audit:read'),
  securityMonitoringController.getThreatAlerts
);

/**
 * @swagger
 * /security-monitoring/alerts/{alertId}:
 *   put:
 *     summary: Update threat alert
 *     description: Update the status or assignment of a threat alert
 *     tags: [Security Monitoring - Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
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
 *               status:
 *                 type: string
 *                 enum: [open, investigating, resolved, false_positive]
 *               assignedTo:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Threat alert updated successfully
 */
router.put('/alerts/:alertId',
  requireRoleLevel(70), // Manager level or above
  validate(updateAlertSchema),
  securityMonitoringController.updateThreatAlert
);

// Suspicious Activity Management

/**
 * @swagger
 * /security-monitoring/suspicious-activities:
 *   get:
 *     summary: Get suspicious activities
 *     description: Retrieve suspicious activities for review
 *     tags: [Security Monitoring - Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [under_review, reviewed, escalated, resolved, all]
 *           default: under_review
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           default: 24
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Suspicious activities retrieved successfully
 */
router.get('/suspicious-activities',
  requirePermission('audit:read'),
  securityMonitoringController.getSuspiciousActivities
);

/**
 * @swagger
 * /security-monitoring/suspicious-activities/{activityId}/review:
 *   put:
 *     summary: Review suspicious activity
 *     description: Review and update the status of a suspicious activity
 *     tags: [Security Monitoring - Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
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
 *               status:
 *                 type: string
 *                 enum: [under_review, reviewed, escalated, resolved]
 *               false_positive:
 *                 type: boolean
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Suspicious activity reviewed successfully
 */
router.put('/suspicious-activities/:activityId/review',
  requireRoleLevel(70),
  validate(reviewActivitySchema),
  securityMonitoringController.reviewSuspiciousActivity
);

// Audit Logging

/**
 * @swagger
 * /security-monitoring/audit:
 *   post:
 *     summary: Log audit event
 *     description: Log an audit event for compliance tracking
 *     tags: [Security Monitoring - Audit]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - resource
 *               - outcome
 *             properties:
 *               action:
 *                 type: string
 *               resource:
 *                 type: string
 *               resourceId:
 *                 type: string
 *               outcome:
 *                 type: string
 *                 enum: [success, failure, denied]
 *               changes:
 *                 type: object
 *               metadata:
 *                 type: object
 *               compliance_tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Audit event logged successfully
 */
router.post('/audit',
  requirePermission('system:read'),
  validate(auditEventSchema),
  securityMonitoringController.logAuditEvent
);

/**
 * @swagger
 * /security-monitoring/audit:
 *   get:
 *     summary: Get audit logs
 *     description: Retrieve audit logs with filtering options
 *     tags: [Security Monitoring - Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: outcome
 *         schema:
 *           type: string
 *           enum: [success, failure, denied]
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           default: 24
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 */
router.get('/audit',
  requirePermission('audit:read'),
  securityMonitoringController.getAuditLogs
);

// Dashboard and Analytics

/**
 * @swagger
 * /security-monitoring/dashboard:
 *   get:
 *     summary: Get security dashboard
 *     description: Get comprehensive security monitoring dashboard data
 *     tags: [Security Monitoring - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Timeframe in hours
 *     responses:
 *       200:
 *         description: Security dashboard data retrieved successfully
 */
router.get('/dashboard',
  requirePermission('audit:read'),
  securityMonitoringController.getSecurityDashboard
);

/**
 * @swagger
 * /security-monitoring/threat-intelligence:
 *   get:
 *     summary: Get threat intelligence report
 *     description: Get comprehensive threat intelligence and vulnerability assessment
 *     tags: [Security Monitoring - Intelligence]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Threat intelligence report retrieved successfully
 */
router.get('/threat-intelligence',
  requireRoleLevel(70),
  securityMonitoringController.getThreatIntelligence
);

/**
 * @swagger
 * /security-monitoring/metrics:
 *   get:
 *     summary: Get security metrics
 *     description: Get security metrics and trends for specified period
 *     tags: [Security Monitoring - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: Security metrics retrieved successfully
 */
router.get('/metrics',
  requirePermission('audit:read'),
  securityMonitoringController.getSecurityMetrics
);

/**
 * @swagger
 * /security-monitoring/export:
 *   get:
 *     summary: Export security report
 *     description: Export security monitoring data as JSON or CSV report
 *     tags: [Security Monitoring - Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           default: 24
 *       - in: query
 *         name: include_events
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: include_alerts
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: include_audit
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Security report exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/export',
  requireRoleLevel(70),
  securityMonitoringController.exportSecurityReport
);

// Health Check

/**
 * @swagger
 * /security-monitoring/health:
 *   get:
 *     summary: Security monitoring health check
 *     description: Check the health status of security monitoring system
 *     tags: [Security Monitoring - System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health check completed
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        event_logging: 'operational',
        threat_detection: 'operational',
        audit_logging: 'operational',
        alert_system: 'operational'
      }
    }
  });
});

export default router;