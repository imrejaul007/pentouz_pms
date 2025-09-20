import mongoose from 'mongoose';
import Hotel from '../models/Hotel.js';
import PropertyGroup from '../models/PropertyGroup.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import cacheService from '../services/cacheService.js';

/**
 * Multi-Tenant Security Middleware
 * Ensures data isolation and access control for multi-property systems
 */

/**
 * Property isolation middleware - ensures users can only access data from their properties
 */
export const enforcePropertyIsolation = (options = {}) => {
  const { 
    skipForSuperAdmin = true,
    allowCrossPropertyAccess = false,
    propertyIdParam = 'hotelId',
    resourceType = 'generic'
  } = options;

  return async (req, res, next) => {
    try {
      // Skip for super admin if configured
      if (skipForSuperAdmin && req.user?.role === 'super_admin') {
        return next();
      }

      // Get user's accessible properties
      const userProperties = await getUserAccessibleProperties(req.user._id);
      
      if (!userProperties || userProperties.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No accessible properties found for user'
        });
      }

      // Check if accessing specific property data
      const requestedPropertyId = req.params[propertyIdParam] || req.body[propertyIdParam] || req.query[propertyIdParam];
      
      if (requestedPropertyId) {
        // Verify user has access to the requested property
        const hasAccess = userProperties.some(property => 
          property._id.toString() === requestedPropertyId.toString()
        );

        if (!hasAccess) {
          logger.warn('Unauthorized property access attempted', {
            userId: req.user._id,
            requestedPropertyId,
            userProperties: userProperties.map(p => p._id),
            resourceType,
            path: req.path
          });

          return res.status(403).json({
            success: false,
            message: 'Access denied to requested property'
          });
        }
      }

      // Add property filter to request for database queries
      req.propertyFilter = {
        [propertyIdParam]: { $in: userProperties.map(p => p._id) }
      };
      
      req.userProperties = userProperties;

      logger.debug('Property isolation enforced', {
        userId: req.user._id,
        accessibleProperties: userProperties.length,
        requestedProperty: requestedPropertyId,
        resourceType
      });

      next();

    } catch (error) {
      logger.error('Property isolation middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error in access control'
      });
    }
  };
};

/**
 * Property group isolation middleware - ensures users can only access data from their property groups
 */
export const enforcePropertyGroupIsolation = (options = {}) => {
  const { 
    skipForSuperAdmin = true,
    propertyGroupIdParam = 'propertyGroupId',
    resourceType = 'group_resource'
  } = options;

  return async (req, res, next) => {
    try {
      if (skipForSuperAdmin && req.user?.role === 'super_admin') {
        return next();
      }

      // Get user's accessible property groups
      const userPropertyGroups = await getUserAccessiblePropertyGroups(req.user._id);
      
      if (!userPropertyGroups || userPropertyGroups.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No accessible property groups found for user'
        });
      }

      // Check if accessing specific property group data
      const requestedGroupId = req.params[propertyGroupIdParam] || req.body[propertyGroupIdParam] || req.query[propertyGroupIdParam];
      
      if (requestedGroupId) {
        const hasAccess = userPropertyGroups.some(group => 
          group._id.toString() === requestedGroupId.toString()
        );

        if (!hasAccess) {
          logger.warn('Unauthorized property group access attempted', {
            userId: req.user._id,
            requestedGroupId,
            userPropertyGroups: userPropertyGroups.map(g => g._id),
            resourceType,
            path: req.path
          });

          return res.status(403).json({
            success: false,
            message: 'Access denied to requested property group'
          });
        }
      }

      req.propertyGroupFilter = {
        [propertyGroupIdParam]: { $in: userPropertyGroups.map(g => g._id) }
      };
      
      req.userPropertyGroups = userPropertyGroups;

      next();

    } catch (error) {
      logger.error('Property group isolation middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error in group access control'
      });
    }
  };
};

/**
 * Resource sharing access control middleware
 */
export const enforceResourceSharingAccess = (permission = 'view') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.resourceId || req.params.id;
      
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: 'Resource ID is required'
        });
      }

      // Import SharedResource model
      const SharedResource = mongoose.model('SharedResource');
      
      const resource = await SharedResource.findById(resourceId);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      // Get user's properties
      const userProperties = await getUserAccessibleProperties(req.user._id);
      const userPropertyIds = userProperties.map(p => p._id.toString());

      // Check if user has access to any property that can access this resource
      const hasAccess = userPropertyIds.some(propertyId => 
        resource.canBeAccessedBy(propertyId, permission)
      );

      if (!hasAccess) {
        logger.warn('Unauthorized resource access attempted', {
          userId: req.user._id,
          resourceId,
          requiredPermission: permission,
          userProperties: userPropertyIds,
          resourceOwner: resource.ownerPropertyId
        });

        return res.status(403).json({
          success: false,
          message: `Access denied: insufficient ${permission} permission for this resource`
        });
      }

      req.accessibleResource = resource;
      req.resourcePermission = permission;

      next();

    } catch (error) {
      logger.error('Resource sharing access control error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error in resource access control'
      });
    }
  };
};

/**
 * Cross-property data access middleware (for consolidated reporting)
 */
export const allowCrossPropertyAccess = (requiredRole = 'manager') => {
  return async (req, res, next) => {
    try {
      // Check if user has required role
      if (!req.user?.role || !hasRequiredRole(req.user.role, requiredRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient privileges for cross-property access'
        });
      }

      // For property group requests, ensure user owns or manages the group
      const propertyGroupId = req.params.propertyGroupId || req.params.id;
      
      if (propertyGroupId) {
        const propertyGroup = await PropertyGroup.findById(propertyGroupId);
        
        if (!propertyGroup) {
          return res.status(404).json({
            success: false,
            message: 'Property group not found'
          });
        }

        // Check ownership or management access
        if (req.user.role !== 'super_admin' && propertyGroup.ownerId.toString() !== req.user._id.toString()) {
          // Check if user manages any properties in this group
          const managedProperties = await Hotel.find({
            propertyGroupId,
            $or: [
              { ownerId: req.user._id },
              { 'staff.userId': req.user._id, 'staff.role': 'manager' }
            ]
          });

          if (managedProperties.length === 0) {
            return res.status(403).json({
              success: false,
              message: 'Access denied to this property group'
            });
          }
        }

        req.authorizedPropertyGroup = propertyGroup;
      }

      logger.debug('Cross-property access granted', {
        userId: req.user._id,
        userRole: req.user.role,
        propertyGroupId,
        path: req.path
      });

      next();

    } catch (error) {
      logger.error('Cross-property access middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error in cross-property access control'
      });
    }
  };
};

/**
 * Data sanitization middleware - removes sensitive data based on user access level
 */
export const sanitizeResponseData = (sensitivityLevel = 'standard') => {
  return (req, res, next) => {
    const originalJson = res.json;

    res.json = function(data) {
      try {
        const sanitizedData = applySanitization(data, req.user, sensitivityLevel);
        return originalJson.call(this, sanitizedData);
      } catch (error) {
        logger.error('Data sanitization error:', error);
        return originalJson.call(this, data); // Return original data if sanitization fails
      }
    };

    next();
  };
};

/**
 * Rate limiting based on property and user
 */
export const multiTenantRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequestsPerProperty = 1000,
    maxRequestsPerUser = 100
  } = options;

  return async (req, res, next) => {
    try {
      const userId = req.user?._id;
      const userProperties = req.userProperties || await getUserAccessibleProperties(userId);
      
      if (!userId || !userProperties.length) {
        return next();
      }

      const windowStart = Date.now() - windowMs;
      
      // Check per-property rate limits
      for (const property of userProperties) {
        const propertyKey = `rate_limit:property:${property._id}:${Math.floor(Date.now() / windowMs)}`;
        const propertyCount = await cacheService.get(propertyKey) || 0;
        
        if (propertyCount >= maxRequestsPerProperty) {
          logger.warn('Property rate limit exceeded', {
            propertyId: property._id,
            userId,
            count: propertyCount,
            limit: maxRequestsPerProperty
          });

          return res.status(429).json({
            success: false,
            message: 'Property rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil(windowMs / 1000)
          });
        }

        await cacheService.set(propertyKey, propertyCount + 1, Math.ceil(windowMs / 1000));
      }

      // Check per-user rate limits
      const userKey = `rate_limit:user:${userId}:${Math.floor(Date.now() / windowMs)}`;
      const userCount = await cacheService.get(userKey) || 0;
      
      if (userCount >= maxRequestsPerUser) {
        logger.warn('User rate limit exceeded', {
          userId,
          count: userCount,
          limit: maxRequestsPerUser
        });

        return res.status(429).json({
          success: false,
          message: 'User rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      await cacheService.set(userKey, userCount + 1, Math.ceil(windowMs / 1000));

      next();

    } catch (error) {
      logger.error('Multi-tenant rate limiting error:', error);
      next(); // Continue on error
    }
  };
};

/**
 * Audit logging middleware for multi-tenant operations
 */
export const auditMultiTenantAccess = (options = {}) => {
  const { logSensitiveOperations = true, logReadOperations = false } = options;

  return (req, res, next) => {
    const originalJson = res.json;
    const startTime = Date.now();

    res.json = function(data) {
      try {
        const duration = Date.now() - startTime;
        const shouldLog = logReadOperations || 
                         (req.method !== 'GET') || 
                         (logSensitiveOperations && isSensitiveOperation(req));

        if (shouldLog) {
          logMultiTenantAccess(req, res, data, duration);
        }
      } catch (error) {
        logger.error('Audit logging error:', error);
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

// Helper functions

/**
 * Get user's accessible properties (with caching)
 */
async function getUserAccessibleProperties(userId) {
  const cacheKey = `user_properties:${userId}`;
  
  try {
    let userProperties = await cacheService.get(cacheKey);
    
    if (!userProperties) {
      // Get properties owned by user
      const ownedProperties = await Hotel.find({ ownerId: userId, isActive: true })
        .select('_id name address.city propertyGroupId')
        .lean();

      // Get properties where user has management access
      const managedProperties = await Hotel.find({
        'staff.userId': userId,
        'staff.role': { $in: ['manager', 'admin'] },
        isActive: true
      }).select('_id name address.city propertyGroupId').lean();

      // Combine and deduplicate
      const allProperties = [...ownedProperties, ...managedProperties];
      userProperties = allProperties.filter((property, index, self) =>
        index === self.findIndex(p => p._id.toString() === property._id.toString())
      );

      await cacheService.set(cacheKey, userProperties, 1800); // Cache for 30 minutes
    }

    return userProperties;

  } catch (error) {
    logger.error('Error getting user accessible properties:', error);
    return [];
  }
}

/**
 * Get user's accessible property groups (with caching)
 */
async function getUserAccessiblePropertyGroups(userId) {
  const cacheKey = `user_property_groups:${userId}`;
  
  try {
    let userPropertyGroups = await cacheService.get(cacheKey);
    
    if (!userPropertyGroups) {
      // Get property groups owned by user
      userPropertyGroups = await PropertyGroup.find({ ownerId: userId, status: 'active' })
        .select('_id name groupType')
        .lean();

      await cacheService.set(cacheKey, userPropertyGroups, 1800); // Cache for 30 minutes
    }

    return userPropertyGroups;

  } catch (error) {
    logger.error('Error getting user accessible property groups:', error);
    return [];
  }
}

/**
 * Check if user has required role
 */
function hasRequiredRole(userRole, requiredRole) {
  const roleHierarchy = {
    'guest': 0,
    'staff': 1,
    'manager': 2,
    'admin': 3,
    'super_admin': 4
  };

  return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
}

/**
 * Apply data sanitization based on user role and sensitivity level
 */
function applySanitization(data, user, sensitivityLevel) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = getSensitiveFields(sensitivityLevel);
  const userRole = user?.role || 'guest';

  return sanitizeObject(data, sensitiveFields, userRole);
}

/**
 * Get sensitive fields based on sensitivity level
 */
function getSensitiveFields(sensitivityLevel) {
  const fieldSets = {
    'low': ['password', 'salt', 'resetToken'],
    'standard': ['password', 'salt', 'resetToken', 'email', 'phone', 'ssn', 'bankAccount'],
    'high': ['password', 'salt', 'resetToken', 'email', 'phone', 'ssn', 'bankAccount', 'address', 'personalInfo', 'financialInfo']
  };

  return fieldSets[sensitivityLevel] || fieldSets.standard;
}

/**
 * Recursively sanitize object
 */
function sanitizeObject(obj, sensitiveFields, userRole) {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, sensitiveFields, userRole));
  }

  if (obj && typeof obj === 'object') {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveFields.includes(key) && !canAccessSensitiveData(userRole)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(value, sensitiveFields, userRole);
      }
    }
    
    return sanitized;
  }

  return obj;
}

/**
 * Check if user role can access sensitive data
 */
function canAccessSensitiveData(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if operation is sensitive
 */
function isSensitiveOperation(req) {
  const sensitivePaths = ['/users', '/auth', '/payments', '/financial'];
  const sensitiveMethods = ['POST', 'PUT', 'DELETE'];
  
  return sensitivePaths.some(path => req.path.includes(path)) ||
         sensitiveMethods.includes(req.method);
}

/**
 * Log multi-tenant access for audit purposes
 */
function logMultiTenantAccess(req, res, data, duration) {
  const auditData = {
    userId: req.user?._id,
    userRole: req.user?.role,
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date(),
    propertyAccess: {
      requestedProperties: req.userProperties?.map(p => p._id) || [],
      accessedResources: req.accessibleResource ? [req.accessibleResource._id] : [],
      crossPropertyAccess: !!req.authorizedPropertyGroup
    }
  };

  logger.info('Multi-tenant access audit', auditData);
}

/**
 * Clear user access cache (call when user permissions change)
 */
export async function clearUserAccessCache(userId) {
  try {
    const patterns = [
      `user_properties:${userId}`,
      `user_property_groups:${userId}`,
      `rate_limit:user:${userId}:*`
    ];

    let totalCleared = 0;
    for (const pattern of patterns) {
      const cleared = await cacheService.delPattern(pattern);
      totalCleared += cleared;
    }

    logger.debug(`Cleared ${totalCleared} cache entries for user: ${userId}`);
    return totalCleared;

  } catch (error) {
    logger.error('Error clearing user access cache:', error);
  }
}

export default {
  enforcePropertyIsolation,
  enforcePropertyGroupIsolation,
  enforceResourceSharingAccess,
  allowCrossPropertyAccess,
  sanitizeResponseData,
  multiTenantRateLimit,
  auditMultiTenantAccess,
  clearUserAccessCache
};
