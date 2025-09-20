import express from 'express';
import gdprController from '../controllers/gdprController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const consentSchema = Joi.object({
  consents: Joi.object().required(),
  ipAddress: Joi.string().ip().optional(),
  userAgent: Joi.string().optional(),
  method: Joi.string().valid('web_form', 'api', 'email', 'phone').optional()
});

const rectificationSchema = Joi.object({
  corrections: Joi.object().required(),
  reason: Joi.string().required()
});

const erasureSchema = Joi.object({
  reason: Joi.string().valid(
    'consent_withdrawn',
    'purpose_fulfilled',
    'unlawful_processing',
    'compliance_required',
    'object_to_processing'
  ).required(),
  confirmErasure: Joi.boolean().valid(true).required()
});

const portabilitySchema = Joi.object({
  format: Joi.string().valid('json', 'csv', 'xml').optional()
});

const dataRequestProcessSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject', 'process').required(),
  notes: Joi.string().optional()
});

// Authentication required for all GDPR routes
router.use(authenticate);

// User data subject rights endpoints

/**
 * @swagger
 * /gdpr/consent:
 *   post:
 *     summary: Record user consent
 *     description: Record user consent for various data processing purposes
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - consents
 *             properties:
 *               consents:
 *                 type: object
 *                 description: Object with consent types as keys and boolean values
 *               ipAddress:
 *                 type: string
 *               userAgent:
 *                 type: string
 *               method:
 *                 type: string
 *                 enum: [web_form, api, email, phone]
 *     responses:
 *       201:
 *         description: Consent recorded successfully
 */
router.post('/consent', 
  validate(consentSchema),
  gdprController.recordConsent
);

/**
 * @swagger
 * /gdpr/consent/{consentId}:
 *   put:
 *     summary: Update user consent
 *     description: Update existing user consent record
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: consentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - consents
 *             properties:
 *               consents:
 *                 type: object
 *     responses:
 *       200:
 *         description: Consent updated successfully
 */
router.put('/consent/:consentId',
  validate(consentSchema),
  gdprController.updateConsent
);

/**
 * @swagger
 * /gdpr/consent/history:
 *   get:
 *     summary: Get consent history
 *     description: Get user's consent history and current status
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Consent history retrieved successfully
 */
router.get('/consent/history',
  gdprController.getConsentHistory
);

/**
 * @swagger
 * /gdpr/data/access:
 *   post:
 *     summary: Request data access (Right to Access)
 *     description: Request access to all personal data held by the system
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [json, csv, xml]
 *                 default: json
 *               includeMetadata:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Data access request completed
 */
router.post('/data/access',
  gdprController.requestDataAccess
);

/**
 * @swagger
 * /gdpr/data/rectification:
 *   post:
 *     summary: Request data rectification (Right to Rectification)
 *     description: Request correction of inaccurate personal data
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - corrections
 *               - reason
 *             properties:
 *               corrections:
 *                 type: object
 *                 description: Object with field names as keys and corrected values
 *               reason:
 *                 type: string
 *                 description: Reason for requesting corrections
 *     responses:
 *       200:
 *         description: Data rectification request completed
 */
router.post('/data/rectification',
  validate(rectificationSchema),
  gdprController.requestDataRectification
);

/**
 * @swagger
 * /gdpr/data/erasure:
 *   post:
 *     summary: Request data erasure (Right to be Forgotten)
 *     description: Request deletion of personal data
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *               - confirmErasure
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [consent_withdrawn, purpose_fulfilled, unlawful_processing, compliance_required, object_to_processing]
 *               confirmErasure:
 *                 type: boolean
 *                 description: Must be true to confirm erasure request
 *     responses:
 *       200:
 *         description: Data erasure request processed
 */
router.post('/data/erasure',
  validate(erasureSchema),
  gdprController.requestDataErasure
);

/**
 * @swagger
 * /gdpr/data/portability:
 *   post:
 *     summary: Request data portability
 *     description: Request personal data in a portable format
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [json, csv, xml]
 *                 default: json
 *     responses:
 *       200:
 *         description: Portable data export generated
 */
router.post('/data/portability',
  validate(portabilitySchema),
  gdprController.requestDataPortability
);

/**
 * @swagger
 * /gdpr/processing/{dataCategory}/{purpose}:
 *   get:
 *     summary: Check processing lawfulness
 *     description: Check if processing specific data category for a purpose is lawful
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dataCategory
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: purpose
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Processing lawfulness check completed
 */
router.get('/processing/:dataCategory/:purpose',
  gdprController.checkProcessingLawfulness
);

/**
 * @swagger
 * /gdpr/privacy-notice:
 *   get:
 *     summary: Get privacy notice
 *     description: Get the current privacy notice/policy
 *     tags: [GDPR]
 *     parameters:
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           default: en
 *     responses:
 *       200:
 *         description: Privacy notice retrieved
 */
router.get('/privacy-notice',
  gdprController.getPrivacyNotice
);

/**
 * @swagger
 * /gdpr/processing-info:
 *   get:
 *     summary: Get data processing information
 *     description: Get information about how user data is processed
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data processing information retrieved
 */
router.get('/processing-info',
  gdprController.getDataProcessingInfo
);

// Admin endpoints for GDPR management (staff/admin only)

/**
 * @swagger
 * /gdpr/admin/retention-report:
 *   get:
 *     summary: Get data retention report
 *     description: Get report on data retention and cleanup status
 *     tags: [GDPR Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data retention report generated
 */
router.get('/admin/retention-report',
  authorize(['admin', 'staff']),
  gdprController.getDataRetentionReport
);

/**
 * @swagger
 * /gdpr/admin/compliance-report:
 *   get:
 *     summary: Get compliance report
 *     description: Get comprehensive GDPR compliance report
 *     tags: [GDPR Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Compliance report generated
 */
router.get('/admin/compliance-report',
  authorize(['admin', 'staff']),
  gdprController.getComplianceReport
);

/**
 * @swagger
 * /gdpr/admin/data-requests:
 *   get:
 *     summary: Get all data requests
 *     description: Get all GDPR data requests for admin review
 *     tags: [GDPR Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, completed]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [access, rectification, erasure, portability]
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
 *         description: Data requests retrieved
 */
router.get('/admin/data-requests',
  authorize(['admin', 'staff']),
  gdprController.getAllDataRequests
);

/**
 * @swagger
 * /gdpr/admin/data-requests/{requestId}:
 *   get:
 *     summary: Get specific data request
 *     description: Get details of a specific GDPR data request
 *     tags: [GDPR Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Data request details retrieved
 */
router.get('/admin/data-requests/:requestId',
  authorize(['admin', 'staff']),
  gdprController.getDataRequestById
);

/**
 * @swagger
 * /gdpr/admin/data-requests/{requestId}/process:
 *   post:
 *     summary: Process data request
 *     description: Approve, reject, or process a GDPR data request
 *     tags: [GDPR Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject, process]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Data request processed
 */
router.post('/admin/data-requests/:requestId/process',
  authorize(['admin']),
  validate(dataRequestProcessSchema),
  gdprController.processDataRequest
);

/**
 * @swagger
 * /gdpr/admin/bulk-consent-status:
 *   post:
 *     summary: Get bulk consent status
 *     description: Get consent status for multiple users
 *     tags: [GDPR Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Bulk consent status retrieved
 */
router.post('/admin/bulk-consent-status',
  authorize(['admin', 'staff']),
  gdprController.getBulkConsentStatus
);

// Public endpoints (no authentication required)

/**
 * @swagger
 * /gdpr/public/privacy-policy:
 *   get:
 *     summary: Get public privacy policy
 *     description: Get the public-facing privacy policy
 *     tags: [GDPR Public]
 *     responses:
 *       200:
 *         description: Privacy policy retrieved
 */
router.get('/public/privacy-policy', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'Privacy Policy',
      lastUpdated: new Date().toISOString(),
      content: 'This would be the full privacy policy content...',
      contact: {
        email: 'privacy@hotel.com',
        phone: '+1-555-PRIVACY'
      }
    }
  });
});

/**
 * @swagger
 * /gdpr/public/cookie-policy:
 *   get:
 *     summary: Get cookie policy
 *     description: Get information about cookie usage
 *     tags: [GDPR Public]
 *     responses:
 *       200:
 *         description: Cookie policy retrieved
 */
router.get('/public/cookie-policy', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'Cookie Policy',
      lastUpdated: new Date().toISOString(),
      categories: [
        {
          name: 'Essential Cookies',
          description: 'Required for basic website functionality',
          canDisable: false
        },
        {
          name: 'Analytics Cookies', 
          description: 'Help us understand how visitors use our website',
          canDisable: true
        },
        {
          name: 'Marketing Cookies',
          description: 'Used to deliver relevant advertisements',
          canDisable: true
        }
      ]
    }
  });
});

export default router;
