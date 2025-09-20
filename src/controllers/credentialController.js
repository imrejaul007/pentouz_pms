import credentialManagerService from '../services/credentialManagerService.js';
import logger from '../utils/logger.js';
import { ValidationError, NotFoundError, UnauthorizedError } from '../middleware/errorHandler.js';

export const storeCredential = async (req, res, next) => {
  try {
    const { service, environment, credentialData, metadata } = req.body;

    if (!service || !credentialData) {
      throw new ValidationError('Service and credential data are required');
    }

    const credential = await credentialManagerService.storeCredential(
      service,
      environment || 'production',
      credentialData,
      {
        ...metadata,
        createdBy: req.user.id,
        createdByRole: req.user.role
      }
    );

    logger.info('Credential stored', {
      service,
      environment,
      credentialId: credential.id,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: {
        id: credential.id,
        service: credential.service,
        environment: credential.environment,
        keyId: credential.keyId,
        createdAt: credential.createdAt,
        expiresAt: credential.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getCredential = async (req, res, next) => {
  try {
    const { service, environment = 'production' } = req.params;

    const credential = await credentialManagerService.getCredential(service, environment);
    
    if (!credential) {
      throw new NotFoundError('Credential not found');
    }

    // Return decrypted credential data
    res.json({
      success: true,
      data: {
        service: credential.service,
        environment: credential.environment,
        credentials: credential.decryptedData,
        metadata: credential.metadata,
        lastUsed: credential.lastUsed,
        expiresAt: credential.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const listCredentials = async (req, res, next) => {
  try {
    const { service, environment, includeInactive } = req.query;
    
    const credentials = await credentialManagerService.listCredentials({
      service,
      environment,
      includeInactive: includeInactive === 'true'
    });

    // Return list without sensitive credential data
    const credentialList = credentials.map(cred => ({
      id: cred.id,
      service: cred.service,
      environment: cred.environment,
      keyId: cred.keyId,
      status: cred.status,
      createdAt: cred.createdAt,
      updatedAt: cred.updatedAt,
      expiresAt: cred.expiresAt,
      lastUsed: cred.lastUsed,
      metadata: {
        description: cred.metadata?.description,
        createdBy: cred.metadata?.createdBy
      }
    }));

    res.json({
      success: true,
      data: {
        credentials: credentialList,
        total: credentialList.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateCredential = async (req, res, next) => {
  try {
    const { service, environment = 'production' } = req.params;
    const { credentialData, metadata } = req.body;

    if (!credentialData) {
      throw new ValidationError('Credential data is required');
    }

    const updatedCredential = await credentialManagerService.updateCredential(
      service,
      environment,
      credentialData,
      {
        ...metadata,
        updatedBy: req.user.id,
        updatedByRole: req.user.role
      }
    );

    logger.info('Credential updated', {
      service,
      environment,
      credentialId: updatedCredential.id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        id: updatedCredential.id,
        service: updatedCredential.service,
        environment: updatedCredential.environment,
        updatedAt: updatedCredential.updatedAt,
        expiresAt: updatedCredential.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCredential = async (req, res, next) => {
  try {
    const { service, environment = 'production' } = req.params;
    const { force } = req.query;

    await credentialManagerService.deleteCredential(service, environment, force === 'true');

    logger.info('Credential deleted', {
      service,
      environment,
      deletedBy: req.user.id,
      forced: force === 'true'
    });

    res.json({
      success: true,
      message: 'Credential deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const rotateCredential = async (req, res, next) => {
  try {
    const { service, environment = 'production' } = req.params;
    const { newCredentialData } = req.body;

    if (!newCredentialData) {
      throw new ValidationError('New credential data is required for rotation');
    }

    const rotatedCredential = await credentialManagerService.rotateCredential(
      service,
      environment,
      newCredentialData,
      {
        rotatedBy: req.user.id,
        rotatedByRole: req.user.role,
        rotationReason: req.body.reason || 'Manual rotation'
      }
    );

    logger.info('Credential rotated', {
      service,
      environment,
      newCredentialId: rotatedCredential.id,
      rotatedBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        id: rotatedCredential.id,
        service: rotatedCredential.service,
        environment: rotatedCredential.environment,
        rotatedAt: rotatedCredential.updatedAt,
        expiresAt: rotatedCredential.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const generateToken = async (req, res, next) => {
  try {
    const { service, permissions, expiresIn } = req.body;

    if (!service) {
      throw new ValidationError('Service is required');
    }

    const tokenData = await credentialManagerService.generateToken(service, {
      permissions: permissions || ['read'],
      expiresIn: expiresIn || '1h',
      issuedBy: req.user.id,
      issuedByRole: req.user.role
    });

    logger.info('Token generated', {
      service,
      tokenId: tokenData.id,
      permissions,
      expiresIn,
      issuedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: {
        token: tokenData.token,
        tokenId: tokenData.id,
        service: service,
        permissions: tokenData.permissions,
        issuedAt: tokenData.issuedAt,
        expiresAt: tokenData.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const validateToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new ValidationError('Token is required');
    }

    const validation = await credentialManagerService.validateToken(token);

    res.json({
      success: true,
      data: {
        valid: validation.valid,
        service: validation.service,
        permissions: validation.permissions,
        expiresAt: validation.expiresAt,
        issuedAt: validation.issuedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const revokeToken = async (req, res, next) => {
  try {
    const { tokenId } = req.params;
    const { reason } = req.body;

    await credentialManagerService.revokeToken(tokenId, {
      revokedBy: req.user.id,
      reason: reason || 'Manual revocation'
    });

    logger.info('Token revoked', {
      tokenId,
      revokedBy: req.user.id,
      reason
    });

    res.json({
      success: true,
      message: 'Token revoked successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getCredentialUsage = async (req, res, next) => {
  try {
    const { service, environment, days = 30 } = req.query;

    const usage = await credentialManagerService.getUsageStats({
      service,
      environment,
      days: parseInt(days)
    });

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    next(error);
  }
};

export const getSecurityAudit = async (req, res, next) => {
  try {
    const { service, days = 30 } = req.query;

    const audit = await credentialManagerService.getSecurityAudit({
      service,
      days: parseInt(days)
    });

    res.json({
      success: true,
      data: audit
    });
  } catch (error) {
    next(error);
  }
};

export const healthCheck = async (req, res, next) => {
  try {
    const health = await credentialManagerService.healthCheck();

    res.json({
      success: true,
      data: {
        status: health.status,
        timestamp: new Date().toISOString(),
        checks: health.checks
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  storeCredential,
  getCredential,
  listCredentials,
  updateCredential,
  deleteCredential,
  rotateCredential,
  generateToken,
  validateToken,
  revokeToken,
  getCredentialUsage,
  getSecurityAudit,
  healthCheck
};
