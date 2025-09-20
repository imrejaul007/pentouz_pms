import rolePermissionService from '../services/rolePermissionService.js';
import logger from '../utils/logger.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';

// Role Management

export const getAllRoles = async (req, res, next) => {
  try {
    const { includeSystem = true, includeCustom = true } = req.query;
    
    const roles = [];
    
    if (includeSystem === 'true') {
      const systemRoles = rolePermissionService.getSystemRoles();
      Object.entries(systemRoles).forEach(([id, role]) => {
        roles.push({
          id,
          ...role,
          effectivePermissions: rolePermissionService.getEffectivePermissions(role)
        });
      });
    }

    if (includeCustom === 'true') {
      rolePermissionService.customRoles.forEach((role, id) => {
        roles.push({
          ...role,
          effectivePermissions: rolePermissionService.getEffectivePermissions(role)
        });
      });
    }

    // Sort by level (highest first)
    roles.sort((a, b) => b.level - a.level);

    res.json({
      success: true,
      data: {
        roles,
        total: roles.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getRoleById = async (req, res, next) => {
  try {
    const { roleId } = req.params;
    
    const role = rolePermissionService.getRole(roleId);
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    const roleWithPermissions = {
      ...role,
      effectivePermissions: rolePermissionService.getEffectivePermissions(role)
    };

    res.json({
      success: true,
      data: roleWithPermissions
    });
  } catch (error) {
    next(error);
  }
};

export const createRole = async (req, res, next) => {
  try {
    const { name, level, inheritsFrom, permissions, description, canManageRoles, canManageUsers } = req.body;

    if (!name || !permissions) {
      throw new ValidationError('Name and permissions are required');
    }

    // Validate permissions
    const validation = rolePermissionService.validateRolePermissions(permissions);
    if (!validation.valid) {
      throw new ValidationError(`Invalid permissions: ${validation.invalidPermissions.join(', ')}`);
    }

    const roleData = {
      name,
      level: level || 20,
      inheritsFrom: inheritsFrom || [],
      permissions,
      description: description || '',
      canManageRoles: canManageRoles || false,
      canManageUsers: canManageUsers || false,
      createdBy: req.user.id
    };

    const role = rolePermissionService.createRole(roleData);

    logger.info('Role created', {
      roleId: role.id,
      roleName: role.name,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: role
    });
  } catch (error) {
    next(error);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const { roleId } = req.params;
    const updates = req.body;

    // Validate permissions if provided
    if (updates.permissions) {
      const validation = rolePermissionService.validateRolePermissions(updates.permissions);
      if (!validation.valid) {
        throw new ValidationError(`Invalid permissions: ${validation.invalidPermissions.join(', ')}`);
      }
    }

    updates.updatedBy = req.user.id;
    const updatedRole = rolePermissionService.updateRole(roleId, updates);

    res.json({
      success: true,
      data: updatedRole
    });
  } catch (error) {
    next(error);
  }
};

export const deleteRole = async (req, res, next) => {
  try {
    const { roleId } = req.params;
    
    await rolePermissionService.deleteRole(roleId, req.user.id);

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Permission Management

export const getAllPermissions = async (req, res, next) => {
  try {
    const permissions = rolePermissionService.getAllPermissions();
    
    // Group permissions by category
    const categorized = {};
    Object.entries(permissions).forEach(([perm, description]) => {
      const [category] = perm.split(':');
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push({
        permission: perm,
        description
      });
    });

    res.json({
      success: true,
      data: {
        permissions,
        categorized,
        totalPermissions: Object.keys(permissions).length
      }
    });
  } catch (error) {
    next(error);
  }
};

// User Role Assignment

export const assignUserRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { roleId } = req.body;

    if (!roleId) {
      throw new ValidationError('Role ID is required');
    }

    const assignment = rolePermissionService.assignRole(userId, roleId, req.user.id);

    res.json({
      success: true,
      data: assignment
    });
  } catch (error) {
    next(error);
  }
};

export const removeUserRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    await rolePermissionService.removeRole(userId, req.user.id);

    res.json({
      success: true,
      message: 'Role removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getUserRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const userRole = rolePermissionService.getUserRole(userId);
    if (!userRole) {
      throw new NotFoundError('No role assigned to user');
    }

    res.json({
      success: true,
      data: userRole
    });
  } catch (error) {
    next(error);
  }
};

// Permission Checking

export const checkUserPermission = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { permission, resource } = req.body;

    if (!permission) {
      throw new ValidationError('Permission is required');
    }

    const hasPermission = rolePermissionService.hasPermission(userId, permission, resource);

    res.json({
      success: true,
      data: {
        userId,
        permission,
        resource,
        hasPermission,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

export const checkMultiplePermissions = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { permissions, checkType = 'any' } = req.body; // 'any' or 'all'

    if (!permissions || !Array.isArray(permissions)) {
      throw new ValidationError('Permissions array is required');
    }

    const results = {};
    let hasAccess = false;

    if (checkType === 'all') {
      hasAccess = rolePermissionService.hasAllPermissions(userId, permissions);
      permissions.forEach(perm => {
        results[perm] = rolePermissionService.hasPermission(userId, perm);
      });
    } else {
      hasAccess = rolePermissionService.hasAnyPermission(userId, permissions);
      permissions.forEach(perm => {
        results[perm] = rolePermissionService.hasPermission(userId, perm);
      });
    }

    res.json({
      success: true,
      data: {
        userId,
        permissions,
        checkType,
        hasAccess,
        individualResults: results,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

// Role Hierarchy and Analytics

export const getRoleHierarchy = async (req, res, next) => {
  try {
    const hierarchy = rolePermissionService.getRoleHierarchy();

    res.json({
      success: true,
      data: hierarchy
    });
  } catch (error) {
    next(error);
  }
};

export const getUsersByRole = async (req, res, next) => {
  try {
    const { roleId } = req.params;
    
    const role = rolePermissionService.getRole(roleId);
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    const userIds = rolePermissionService.getUsersByRole(roleId);

    res.json({
      success: true,
      data: {
        roleId,
        roleName: role.name,
        userIds,
        userCount: userIds.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getPermissionAnalytics = async (req, res, next) => {
  try {
    const analytics = rolePermissionService.getPermissionAnalytics();

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    next(error);
  }
};

// Validation and Utilities

export const validateRolePermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      throw new ValidationError('Permissions array is required');
    }

    const validation = rolePermissionService.validateRolePermissions(permissions);

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    next(error);
  }
};

export const getMyRole = async (req, res, next) => {
  try {
    const userRole = rolePermissionService.getUserRole(req.user.id);
    if (!userRole) {
      throw new NotFoundError('No role assigned');
    }

    res.json({
      success: true,
      data: userRole
    });
  } catch (error) {
    next(error);
  }
};

export const getMyPermissions = async (req, res, next) => {
  try {
    const userRole = rolePermissionService.getUserRole(req.user.id);
    if (!userRole) {
      throw new NotFoundError('No role assigned');
    }

    const permissions = userRole.effectivePermissions.map(perm => ({
      permission: perm,
      description: rolePermissionService.permissions[perm] || 'Custom permission'
    }));

    res.json({
      success: true,
      data: {
        userId: req.user.id,
        role: {
          id: userRole.id,
          name: userRole.name,
          level: userRole.level
        },
        permissions,
        totalPermissions: permissions.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// Bulk Operations

export const bulkAssignRoles = async (req, res, next) => {
  try {
    const { assignments } = req.body; // Array of { userId, roleId }

    if (!assignments || !Array.isArray(assignments)) {
      throw new ValidationError('Assignments array is required');
    }

    const results = {
      successful: [],
      failed: []
    };

    for (const assignment of assignments) {
      try {
        const result = rolePermissionService.assignRole(
          assignment.userId, 
          assignment.roleId, 
          req.user.id
        );
        results.successful.push(result);
      } catch (error) {
        results.failed.push({
          userId: assignment.userId,
          roleId: assignment.roleId,
          error: error.message
        });
      }
    }

    logger.info('Bulk role assignment completed', {
      successful: results.successful.length,
      failed: results.failed.length,
      assignedBy: req.user.id
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getAllPermissions,
  assignUserRole,
  removeUserRole,
  getUserRole,
  checkUserPermission,
  checkMultiplePermissions,
  getRoleHierarchy,
  getUsersByRole,
  getPermissionAnalytics,
  validateRolePermissions,
  getMyRole,
  getMyPermissions,
  bulkAssignRoles
};
