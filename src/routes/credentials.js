import express from 'express';
import credentialController from '../controllers/credentialController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const storeCredentialSchema = Joi.object({
  service: Joi.string().valid(
    'OTA_BOOKING_COM',
    'OTA_EXPEDIA',
    'OTA_AIRBNB',
    'PAYMENT_STRIPE',
    'PAYMENT_PAYPAL',
    'EMAIL_SENDGRID',
    'SMS_TWILIO',
    'CLOUD_AWS',
    'CLOUD_AZURE',
    'ANALYTICS_GOOGLE',
    'OTHER'
  ).required(),
  environment: Joi.string().valid('development', 'staging', 'production').optional(),
  credentialData: Joi.object().required(),
  metadata: Joi.object({
    description: Joi.string().optional(),
    contactEmail: Joi.string().email().optional(),
    environment: Joi.string().optional(),
    notes: Joi.string().optional()
  }).optional()
});

const updateCredentialSchema = Joi.object({
  credentialData: Joi.object().required(),
  metadata: Joi.object({
    description: Joi.string().optional(),
    contactEmail: Joi.string().email().optional(),
    environment: Joi.string().optional(),
    notes: Joi.string().optional()
  }).optional()
});

const rotateCredentialSchema = Joi.object({
  newCredentialData: Joi.object().required(),
  reason: Joi.string().optional()
});

const generateTokenSchema = Joi.object({
  service: Joi.string().required(),
  permissions: Joi.array().items(Joi.string().valid('read', 'write', 'admin')).optional(),
  expiresIn: Joi.string().optional()
});

const validateTokenSchema = Joi.object({
  token: Joi.string().required()
});

const revokeTokenSchema = Joi.object({
  reason: Joi.string().optional()
});

// Authentication required for all credential routes
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     CredentialData:
 *       type: object
 *       properties:
 *         service:
 *           type: string
 *           enum: [OTA_BOOKING_COM, OTA_EXPEDIA, OTA_AIRBNB, PAYMENT_STRIPE, PAYMENT_PAYPAL, EMAIL_SENDGRID, SMS_TWILIO, CLOUD_AWS, CLOUD_AZURE, ANALYTICS_GOOGLE, OTHER]
 *         environment:
 *           type: string
 *           enum: [development, staging, production]
 *           default: production
 *         credentialData:
 *           type: object
 *           description: Service-specific credential information
 *         metadata:
 *           type: object
 *           properties:
 *             description:
 *               type: string
 *             contactEmail:
 *               type: string
 *               format: email
 *             notes:
 *               type: string
 */

/**
 * @swagger
 * /credentials:
 *   post:
 *     summary: Store new credential
 *     description: Store encrypted credentials for a service
 *     tags: [Credentials]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CredentialData'
 *     responses:
 *       201:
 *         description: Credential stored successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 */
router.post('/',
  authorize(['admin', 'manager']),
  validate(storeCredentialSchema),
  credentialController.storeCredential
);

/**
 * @swagger
 * /credentials:
 *   get:
 *     summary: List all credentials
 *     description: Get list of stored credentials (without sensitive data)
 *     tags: [Credentials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: service
 *         schema:
 *           type: string
 *         description: Filter by service type
 *       - in: query
 *         name: environment
 *         schema:
 *           type: string
 *           enum: [development, staging, production]
 *         description: Filter by environment
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Include inactive credentials
 *     responses:
 *       200:
 *         description: Credentials list retrieved
 */
router.get('/',
  authorize(['admin', 'manager', 'staff']),
  credentialController.listCredentials
);

/**
 * @swagger
 * /credentials/{service}/{environment}:
 *   get:
 *     summary: Get specific credential
 *     description: Retrieve and decrypt credentials for a service
 *     tags: [Credentials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: service
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: environment
 *         schema:
 *           type: string
 *           enum: [development, staging, production]
 *           default: production
 *     responses:
 *       200:
 *         description: Credential retrieved successfully
 *       404:
 *         description: Credential not found
 */
router.get('/:service/:environment?',
  authorize(['admin', 'manager']),
  credentialController.getCredential
);

/**
 * @swagger
 * /credentials/{service}/{environment}:
 *   put:
 *     summary: Update credential
 *     description: Update existing credential data
 *     tags: [Credentials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: service
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: environment
 *         schema:
 *           type: string
 *           default: production
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - credentialData
 *             properties:
 *               credentialData:
 *                 type: object
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Credential updated successfully
 */
router.put('/:service/:environment?',
  authorize(['admin', 'manager']),
  validate(updateCredentialSchema),
  credentialController.updateCredential
);

/**
 * @swagger
 * /credentials/{service}/{environment}:
 *   delete:
 *     summary: Delete credential
 *     description: Delete stored credentials for a service
 *     tags: [Credentials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: service
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: environment
 *         schema:
 *           type: string
 *           default: production
 *       - in: query
 *         name: force
 *         schema:
 *           type: boolean
 *         description: Force delete even if credential is in use
 *     responses:
 *       200:
 *         description: Credential deleted successfully
 */
router.delete('/:service/:environment?',
  authorize(['admin']),
  credentialController.deleteCredential
);

/**
 * @swagger
 * /credentials/{service}/{environment}/rotate:
 *   post:
 *     summary: Rotate credential
 *     description: Rotate credentials for a service (keeps old version temporarily)
 *     tags: [Credentials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: service
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: environment
 *         schema:
 *           type: string
 *           default: production
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newCredentialData
 *             properties:
 *               newCredentialData:
 *                 type: object
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Credential rotated successfully
 */
router.post('/:service/:environment?/rotate',
  authorize(['admin', 'manager']),
  validate(rotateCredentialSchema),
  credentialController.rotateCredential
);

// Token Management Endpoints

/**
 * @swagger
 * /credentials/tokens/generate:
 *   post:
 *     summary: Generate access token
 *     description: Generate temporary access token for service credentials
 *     tags: [Credential Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - service
 *             properties:
 *               service:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [read, write, admin]
 *               expiresIn:
 *                 type: string
 *                 description: Token expiration time (e.g., '1h', '30m', '7d')
 *     responses:
 *       201:
 *         description: Token generated successfully
 */
router.post('/tokens/generate',
  authorize(['admin', 'manager', 'staff']),
  validate(generateTokenSchema),
  credentialController.generateToken
);

/**
 * @swagger
 * /credentials/tokens/validate:
 *   post:
 *     summary: Validate access token
 *     description: Validate and get information about an access token
 *     tags: [Credential Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token validation result
 */
router.post('/tokens/validate',
  authorize(['admin', 'manager', 'staff']),
  validate(validateTokenSchema),
  credentialController.validateToken
);

/**
 * @swagger
 * /credentials/tokens/{tokenId}/revoke:
 *   post:
 *     summary: Revoke access token
 *     description: Revoke an active access token
 *     tags: [Credential Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token revoked successfully
 */
router.post('/tokens/:tokenId/revoke',
  authorize(['admin', 'manager']),
  validate(revokeTokenSchema),
  credentialController.revokeToken
);

// Analytics and Monitoring Endpoints

/**
 * @swagger
 * /credentials/usage:
 *   get:
 *     summary: Get credential usage statistics
 *     description: Retrieve usage analytics for credentials
 *     tags: [Credential Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: service
 *         schema:
 *           type: string
 *       - in: query
 *         name: environment
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Usage statistics retrieved
 */
router.get('/usage',
  authorize(['admin', 'manager']),
  credentialController.getCredentialUsage
);

/**
 * @swagger
 * /credentials/audit:
 *   get:
 *     summary: Get security audit report
 *     description: Retrieve security audit information for credentials
 *     tags: [Credential Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: service
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Security audit report retrieved
 */
router.get('/audit',
  authorize(['admin']),
  credentialController.getSecurityAudit
);

/**
 * @swagger
 * /credentials/health:
 *   get:
 *     summary: Health check for credential system
 *     description: Check the health status of the credential management system
 *     tags: [Credential System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health check completed
 */
router.get('/health',
  authorize(['admin', 'manager']),
  credentialController.healthCheck
);

export default router;
