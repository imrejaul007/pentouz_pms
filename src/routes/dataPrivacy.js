import express from 'express';
import dataPrivacyController from '../controllers/dataPrivacyController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requirePermission, requireRoleLevel } from '../middleware/permissionCheck.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const recordConsentSchema = Joi.object({
  userId: Joi.string().optional(),
  consents: Joi.object().required(),
  version: Joi.string().optional(),
  method: Joi.string().valid('web_form', 'api', 'email', 'phone', 'preference_update').optional(),
  doubleOptIn: Joi.boolean().optional(),
  validUntil: Joi.date().optional(),
  metadata: Joi.object().optional()
});

const processingAgreementSchema = Joi.object({
  name: Joi.string().required(),
  contact: Joi.string().email().required(),
  purpose: Joi.string().required(),
  dataCategories: Joi.array().items(Joi.string()).required(),
  retentionPeriod: Joi.number().optional(),
  securityMeasures: Joi.array().items(Joi.string()).optional(),
  location: Joi.string().optional(),
  subProcessors: Joi.array().items(Joi.string()).optional(),
  expiryDate: Joi.date().optional(),
  auditFrequency: Joi.string().valid('quarterly', 'biannual', 'annual').optional()
});

const dataMinimizationSchema = Joi.object({
  data: Joi.object().required(),
  purpose: Joi.string().required(),
  userRole: Joi.string().valid('guest', 'staff', 'manager', 'admin').optional()
});

const anonymizationSchema = Joi.object({
  data: Joi.object().required(),
  anonymizationType: Joi.string().valid('hash', 'pseudonym', 'mask', 'generalize').optional()
});

const piaSchema = Joi.object({
  name: Joi.string().required(),
  dataTypes: Joi.array().items(Joi.string()).required(),
  sources: Joi.array().items(Joi.string()).optional(),
  recipients: Joi.array().items(Joi.string()).optional(),
  crossBorderTransfers: Joi.boolean().optional(),
  risks: Joi.array().items(Joi.string()).optional(),
  mitigations: Joi.array().items(Joi.string()).optional(),
  lawfulBasis: Joi.string().valid('consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests').required(),
  specialCategories: Joi.boolean().optional(),
  securityMeasures: Joi.array().items(Joi.string()).optional(),
  retentionPeriod: Joi.number().optional(),
  automaticProcessing: Joi.boolean().optional(),
  largScale: Joi.boolean().optional(),
  vulnerableSubjects: Joi.boolean().optional(),
  newTechnology: Joi.boolean().optional(),
  profiling: Joi.boolean().optional(),
  publicAccess: Joi.boolean().optional(),
  encryptionAtRest: Joi.boolean().optional(),
  encryptionInTransit: Joi.boolean().optional(),
  highRisk: Joi.boolean().optional()
});

const privacyNoticeSchema = Joi.object({
  purpose: Joi.string().required(),
  dataTypes: Joi.array().items(Joi.string()).required(),
  legalBasis: Joi.string().required()
});

const privacyPreferencesSchema = Joi.object({
  marketingEmails: Joi.boolean().optional(),
  marketingSMS: Joi.boolean().optional(),
  analyticsTracking: Joi.boolean().optional(),
  thirdPartySharing: Joi.boolean().optional(),
  locationTracking: Joi.boolean().optional(),
  behavioralAnalytics: Joi.boolean().optional()
});

const validateProcessingSchema = Joi.object({
  purpose: Joi.string().required(),
  dataTypes: Joi.array().items(Joi.string()).required(),
  legalBasis: Joi.string().required(),
  userId: Joi.string().optional()
});

// Authentication required for most routes
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     ConsentRecord:
 *       type: object
 *       properties:
 *         consents:
 *           type: object
 *           description: Object with consent purposes as keys and boolean values
 *         version:
 *           type: string
 *           default: "1.0"
 *         method:
 *           type: string
 *           enum: [web_form, api, email, phone, preference_update]
 *         doubleOptIn:
 *           type: boolean
 *           default: false
 *         validUntil:
 *           type: string
 *           format: date-time
 *         metadata:
 *           type: object
 */

// Consent Management

/**
 * @swagger
 * /data-privacy/consent:
 *   post:
 *     summary: Record user consent
 *     description: Record consent for data processing purposes
 *     tags: [Data Privacy - Consent]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConsentRecord'
 *     responses:
 *       201:
 *         description: Consent recorded successfully
 */
router.post('/consent',
  validate(recordConsentSchema),
  dataPrivacyController.recordConsent
);

/**
 * @swagger
 * /data-privacy/consent/{userId}/check:
 *   get:
 *     summary: Check user consent
 *     description: Check if user has given consent for a specific purpose
 *     tags: [Data Privacy - Consent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: purpose
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Consent check completed
 */
router.get('/consent/:userId/check',
  requirePermission('user:read'),
  dataPrivacyController.checkConsent
);

/**
 * @swagger
 * /data-privacy/consent/{userId}/history:
 *   get:
 *     summary: Get consent history
 *     description: Retrieve consent history for a user
 *     tags: [Data Privacy - Consent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Consent history retrieved
 */
router.get('/consent/:userId/history',
  requirePermission('user:read'),
  dataPrivacyController.getConsentHistory
);

// Data Processing Agreements

/**
 * @swagger
 * /data-privacy/processing-agreements:
 *   post:
 *     summary: Create processing agreement
 *     description: Create a data processing agreement with a third party
 *     tags: [Data Privacy - Agreements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - contact
 *               - purpose
 *               - dataCategories
 *             properties:
 *               name:
 *                 type: string
 *               contact:
 *                 type: string
 *                 format: email
 *               purpose:
 *                 type: string
 *               dataCategories:
 *                 type: array
 *                 items:
 *                   type: string
 *               retentionPeriod:
 *                 type: number
 *               securityMeasures:
 *                 type: array
 *                 items:
 *                   type: string
 *               location:
 *                 type: string
 *               subProcessors:
 *                 type: array
 *                 items:
 *                   type: string
 *               expiryDate:
 *                 type: string
 *                 format: date
 *               auditFrequency:
 *                 type: string
 *                 enum: [quarterly, biannual, annual]
 *     responses:
 *       201:
 *         description: Processing agreement created
 */
router.post('/processing-agreements',
  requireRoleLevel(70),
  validate(processingAgreementSchema),
  dataPrivacyController.createProcessingAgreement
);

/**
 * @swagger
 * /data-privacy/processing-agreements:
 *   get:
 *     summary: Get processing agreements
 *     description: Retrieve all data processing agreements
 *     tags: [Data Privacy - Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, expired, suspended]
 *       - in: query
 *         name: expiringSoon
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Processing agreements retrieved
 */
router.get('/processing-agreements',
  requirePermission('audit:read'),
  dataPrivacyController.getProcessingAgreements
);

// Data Minimization and Anonymization

/**
 * @swagger
 * /data-privacy/minimize:
 *   post:
 *     summary: Minimize data
 *     description: Apply data minimization principles to a dataset
 *     tags: [Data Privacy - Processing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *               - purpose
 *             properties:
 *               data:
 *                 type: object
 *               purpose:
 *                 type: string
 *               userRole:
 *                 type: string
 *                 enum: [guest, staff, manager, admin]
 *     responses:
 *       200:
 *         description: Data minimized successfully
 */
router.post('/minimize',
  requirePermission('user:read'),
  validate(dataMinimizationSchema),
  dataPrivacyController.minimizeData
);

/**
 * @swagger
 * /data-privacy/anonymize:
 *   post:
 *     summary: Anonymize data
 *     description: Anonymize data for analytics or research purposes
 *     tags: [Data Privacy - Processing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: object
 *               anonymizationType:
 *                 type: string
 *                 enum: [hash, pseudonym, mask, generalize]
 *     responses:
 *       200:
 *         description: Data anonymized successfully
 */
router.post('/anonymize',
  requirePermission('analytics:read'),
  validate(anonymizationSchema),
  dataPrivacyController.anonymizeData
);

// Compliance and Assessment

/**
 * @swagger
 * /data-privacy/retention-compliance:
 *   get:
 *     summary: Check retention compliance
 *     description: Check compliance with data retention policies
 *     tags: [Data Privacy - Compliance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Retention compliance check completed
 */
router.get('/retention-compliance',
  requirePermission('audit:read'),
  dataPrivacyController.checkRetentionCompliance
);

/**
 * @swagger
 * /data-privacy/privacy-impact-assessment:
 *   post:
 *     summary: Generate Privacy Impact Assessment
 *     description: Generate a GDPR-compliant Privacy Impact Assessment
 *     tags: [Data Privacy - Assessment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - dataTypes
 *               - lawfulBasis
 *             properties:
 *               name:
 *                 type: string
 *               dataTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *               sources:
 *                 type: array
 *                 items:
 *                   type: string
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *               crossBorderTransfers:
 *                 type: boolean
 *               risks:
 *                 type: array
 *                 items:
 *                   type: string
 *               mitigations:
 *                 type: array
 *                 items:
 *                   type: string
 *               lawfulBasis:
 *                 type: string
 *                 enum: [consent, contract, legal_obligation, vital_interests, public_task, legitimate_interests]
 *               specialCategories:
 *                 type: boolean
 *               securityMeasures:
 *                 type: array
 *                 items:
 *                   type: string
 *               retentionPeriod:
 *                 type: number
 *               automaticProcessing:
 *                 type: boolean
 *               largScale:
 *                 type: boolean
 *               vulnerableSubjects:
 *                 type: boolean
 *               newTechnology:
 *                 type: boolean
 *               profiling:
 *                 type: boolean
 *               publicAccess:
 *                 type: boolean
 *               encryptionAtRest:
 *                 type: boolean
 *               encryptionInTransit:
 *                 type: boolean
 *               highRisk:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Privacy Impact Assessment generated
 */
router.post('/privacy-impact-assessment',
  requireRoleLevel(70),
  validate(piaSchema),
  dataPrivacyController.generatePrivacyImpactAssessment
);

// Privacy Notices and Preferences

/**
 * @swagger
 * /data-privacy/privacy-notice:
 *   post:
 *     summary: Create privacy notice
 *     description: Create a purpose-specific privacy notice
 *     tags: [Data Privacy - Notices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - purpose
 *               - dataTypes
 *               - legalBasis
 *             properties:
 *               purpose:
 *                 type: string
 *               dataTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *               legalBasis:
 *                 type: string
 *     responses:
 *       201:
 *         description: Privacy notice created
 */
router.post('/privacy-notice',
  requirePermission('user:update'),
  validate(privacyNoticeSchema),
  dataPrivacyController.createPrivacyNotice
);

/**
 * @swagger
 * /data-privacy/preferences/{userId}:
 *   get:
 *     summary: Get privacy preferences
 *     description: Get user's privacy preferences
 *     tags: [Data Privacy - Preferences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Privacy preferences retrieved
 */
router.get('/preferences/:userId',
  requirePermission('profile:read'),
  dataPrivacyController.getPrivacyPreferences
);

/**
 * @swagger
 * /data-privacy/preferences/{userId}:
 *   put:
 *     summary: Update privacy preferences
 *     description: Update user's privacy preferences
 *     tags: [Data Privacy - Preferences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               marketingEmails:
 *                 type: boolean
 *               marketingSMS:
 *                 type: boolean
 *               analyticsTracking:
 *                 type: boolean
 *               thirdPartySharing:
 *                 type: boolean
 *               locationTracking:
 *                 type: boolean
 *               behavioralAnalytics:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Privacy preferences updated
 */
router.put('/preferences/:userId',
  requirePermission('profile:update'),
  validate(privacyPreferencesSchema),
  dataPrivacyController.updatePrivacyPreferences
);

// Self-service endpoints (no specific permissions required beyond authentication)

/**
 * @swagger
 * /data-privacy/my-preferences:
 *   get:
 *     summary: Get my privacy preferences
 *     description: Get current user's privacy preferences
 *     tags: [Data Privacy - Self Service]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Privacy preferences retrieved
 */
router.get('/my-preferences',
  dataPrivacyController.getPrivacyPreferences
);

/**
 * @swagger
 * /data-privacy/my-preferences:
 *   put:
 *     summary: Update my privacy preferences
 *     description: Update current user's privacy preferences
 *     tags: [Data Privacy - Self Service]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               marketingEmails:
 *                 type: boolean
 *               marketingSMS:
 *                 type: boolean
 *               analyticsTracking:
 *                 type: boolean
 *               thirdPartySharing:
 *                 type: boolean
 *               locationTracking:
 *                 type: boolean
 *               behavioralAnalytics:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Privacy preferences updated
 */
router.put('/my-preferences',
  validate(privacyPreferencesSchema),
  dataPrivacyController.updatePrivacyPreferences
);

// Admin and Analytics Endpoints

/**
 * @swagger
 * /data-privacy/compliance-dashboard:
 *   get:
 *     summary: Get compliance dashboard
 *     description: Get privacy compliance dashboard data
 *     tags: [Data Privacy - Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Compliance dashboard data retrieved
 */
router.get('/compliance-dashboard',
  requirePermission('audit:read'),
  dataPrivacyController.getComplianceDashboard
);

/**
 * @swagger
 * /data-privacy/retention-rules:
 *   get:
 *     summary: Get retention rules
 *     description: Get all data retention rules
 *     tags: [Data Privacy - Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Retention rules retrieved
 */
router.get('/retention-rules',
  requirePermission('audit:read'),
  dataPrivacyController.getRetentionRules
);

/**
 * @swagger
 * /data-privacy/validate-processing:
 *   post:
 *     summary: Validate data processing
 *     description: Validate if data processing is compliant with privacy rules
 *     tags: [Data Privacy - Validation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - purpose
 *               - dataTypes
 *               - legalBasis
 *             properties:
 *               purpose:
 *                 type: string
 *               dataTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *               legalBasis:
 *                 type: string
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Data processing validation completed
 */
router.post('/validate-processing',
  requirePermission('user:read'),
  validate(validateProcessingSchema),
  dataPrivacyController.validateDataProcessing
);

export default router;
