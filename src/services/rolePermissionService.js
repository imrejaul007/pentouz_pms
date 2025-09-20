import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

class RolePermissionService {
  constructor() {
    // Define system roles with hierarchical permissions
    this.systemRoles = {
      SUPER_ADMIN: {
        name: 'Super Administrator',
        level: 100,
        inheritsFrom: [],
        permissions: ['*'], // All permissions
        description: 'Full system access with all privileges',
        canManageRoles: true,
        canManageUsers: true,
        systemRole: true
      },
      ADMIN: {
        name: 'Administrator',
        level: 90,
        inheritsFrom: [],
        permissions: [
          'user:*',
          'booking:*',
          'room:*',
          'rate:*',
          'inventory:*',
          'payment:*',
          'report:*',
          'system:read',
          'audit:read'
        ],
        description: 'Hotel administration with full operational control',
        canManageRoles: false,
        canManageUsers: true,
        systemRole: true
      },
      MANAGER: {
        name: 'Manager',
        level: 70,
        inheritsFrom: ['STAFF'],
        permissions: [
          'booking:create',
          'booking:read',
          'booking:update',
          'booking:cancel',
          'room:read',
          'room:update',
          'rate:read',
          'rate:update',
          'inventory:read',
          'inventory:update',
          'guest:*',
          'report:read',
          'staff:read'
        ],
        description: 'Hotel management with operational oversight',
        canManageRoles: false,
        canManageUsers: false,
        systemRole: true
      },
      REVENUE_MANAGER: {
        name: 'Revenue Manager',
        level: 65,
        inheritsFrom: ['STAFF'],
        permissions: [
          'rate:*',
          'inventory:*',
          'pricing:*',
          'revenue:*',
          'analytics:*',
          'forecast:*',
          'competitor:read',
          'report:revenue',
          'report:occupancy',
          'booking:read'
        ],
        description: 'Revenue and pricing management specialist',
        canManageRoles: false,
        canManageUsers: false,
        systemRole: true
      },
      FRONT_DESK: {
        name: 'Front Desk Staff',
        level: 50,
        inheritsFrom: ['STAFF'],
        permissions: [
          'booking:create',
          'booking:read',
          'booking:update',
          'booking:checkin',
          'booking:checkout',
          'guest:create',
          'guest:read',
          'guest:update',
          'room:read',
          'room:status',
          'payment:process',
          'invoice:create'
        ],
        description: 'Front desk operations and guest services',
        canManageRoles: false,
        canManageUsers: false,
        systemRole: true
      },
      HOUSEKEEPING: {
        name: 'Housekeeping Staff',
        level: 40,
        inheritsFrom: ['STAFF'],
        permissions: [
          'room:read',
          'room:status',
          'room:maintenance',
          'housekeeping:*',
          'inventory:housekeeping',
          'booking:read'
        ],
        description: 'Housekeeping and room maintenance',
        canManageRoles: false,
        canManageUsers: false,
        systemRole: true
      },
      MAINTENANCE: {
        name: 'Maintenance Staff',
        level: 35,
        inheritsFrom: ['STAFF'],
        permissions: [
          'room:read',
          'room:maintenance',
          'maintenance:*',
          'inventory:maintenance',
          'facility:*'
        ],
        description: 'Property maintenance and facilities',
        canManageRoles: false,
        canManageUsers: false,
        systemRole: true
      },
      STAFF: {
        name: 'General Staff',
        level: 30,
        inheritsFrom: [],
        permissions: [
          'dashboard:read',
          'profile:read',
          'profile:update',
          'notification:read'
        ],
        description: 'Base staff permissions',
        canManageRoles: false,
        canManageUsers: false,
        systemRole: true
      },
      GUEST: {
        name: 'Guest',
        level: 10,
        inheritsFrom: [],
        permissions: [
          'booking:own:read',
          'booking:own:update',
          'profile:own:read',
          'profile:own:update',
          'invoice:own:read'
        ],
        description: 'Guest portal access',
        canManageRoles: false,
        canManageUsers: false,
        systemRole: true
      }
    };

    // Define granular permissions
    this.permissions = {
      // User management
      'user:create': 'Create new users',
      'user:read': 'View user information',
      'user:update': 'Update user information',
      'user:delete': 'Delete users',
      'user:*': 'All user permissions',

      // Booking management
      'booking:create': 'Create new bookings',
      'booking:read': 'View booking information',
      'booking:update': 'Update booking details',
      'booking:cancel': 'Cancel bookings',
      'booking:checkin': 'Check-in guests',
      'booking:checkout': 'Check-out guests',
      'booking:own:read': 'View own bookings only',
      'booking:own:update': 'Update own bookings only',
      'booking:*': 'All booking permissions',

      // Room management
      'room:create': 'Create new rooms',
      'room:read': 'View room information',
      'room:update': 'Update room details',
      'room:delete': 'Delete rooms',
      'room:status': 'Change room status',
      'room:maintenance': 'Manage room maintenance',
      'room:*': 'All room permissions',

      // Rate management
      'rate:create': 'Create rate plans',
      'rate:read': 'View rates',
      'rate:update': 'Update rates and pricing',
      'rate:delete': 'Delete rate plans',
      'rate:*': 'All rate permissions',

      // Inventory management
      'inventory:read': 'View inventory',
      'inventory:update': 'Update inventory levels',
      'inventory:create': 'Create inventory items',
      'inventory:housekeeping': 'Housekeeping inventory access',
      'inventory:maintenance': 'Maintenance inventory access',
      'inventory:*': 'All inventory permissions',

      // Guest management
      'guest:create': 'Create guest profiles',
      'guest:read': 'View guest information',
      'guest:update': 'Update guest profiles',
      'guest:delete': 'Delete guest profiles',
      'guest:*': 'All guest permissions',

      // Payment management
      'payment:process': 'Process payments',
      'payment:read': 'View payment information',
      'payment:refund': 'Process refunds',
      'payment:*': 'All payment permissions',

      // Revenue and pricing
      'pricing:read': 'View pricing strategies',
      'pricing:update': 'Update pricing rules',
      'pricing:create': 'Create pricing strategies',
      'pricing:*': 'All pricing permissions',

      'revenue:read': 'View revenue reports',
      'revenue:forecast': 'Access revenue forecasting',
      'revenue:*': 'All revenue permissions',

      // Analytics
      'analytics:read': 'View analytics dashboards',
      'analytics:export': 'Export analytics data',
      'analytics:*': 'All analytics permissions',

      // Reports
      'report:read': 'View general reports',
      'report:revenue': 'View revenue reports',
      'report:occupancy': 'View occupancy reports',
      'report:guest': 'View guest reports',
      'report:*': 'All reporting permissions',

      // Housekeeping
      'housekeeping:schedule': 'Manage cleaning schedules',
      'housekeeping:assign': 'Assign housekeeping tasks',
      'housekeeping:complete': 'Mark tasks as completed',
      'housekeeping:*': 'All housekeeping permissions',

      // Maintenance
      'maintenance:create': 'Create maintenance requests',
      'maintenance:assign': 'Assign maintenance tasks',
      'maintenance:complete': 'Complete maintenance tasks',
      'maintenance:*': 'All maintenance permissions',

      // Facility management
      'facility:read': 'View facility information',
      'facility:update': 'Update facility details',
      'facility:*': 'All facility permissions',

      // System and profile
      'system:read': 'View system information',
      'dashboard:read': 'Access dashboard',
      'profile:read': 'View profile',
      'profile:update': 'Update profile',
      'profile:own:read': 'View own profile only',
      'profile:own:update': 'Update own profile only',

      // Staff management
      'staff:read': 'View staff information',
      'staff:schedule': 'Manage staff schedules',

      // Notifications
      'notification:read': 'View notifications',
      'notification:send': 'Send notifications',

      // Invoicing
      'invoice:create': 'Create invoices',
      'invoice:read': 'View invoices',
      'invoice:own:read': 'View own invoices only',

      // Audit and compliance
      'audit:read': 'View audit logs',

      // Competitors
      'competitor:read': 'View competitor data',

      // Forecasting
      'forecast:read': 'View forecasts',
      'forecast:create': 'Create forecasts'
    };

    // Custom roles storage (in-memory for demo, use database in production)
    this.customRoles = new Map();
    this.roleAssignments = new Map(); // userId -> roleId mapping
  }

  /**
   * Get all available permissions
   */
  getAllPermissions() {
    return this.permissions;
  }

  /**
   * Get all system roles
   */
  getSystemRoles() {
    return this.systemRoles;
  }

  /**
   * Get role by ID or name
   */
  getRole(roleIdentifier) {
    // Check system roles first
    if (this.systemRoles[roleIdentifier]) {
      return {
        id: roleIdentifier,
        ...this.systemRoles[roleIdentifier]
      };
    }

    // Check custom roles
    return this.customRoles.get(roleIdentifier);
  }

  /**
   * Create a custom role
   */
  createRole(roleData) {
    try {
      const roleId = uuidv4();
      const role = {
        id: roleId,
        name: roleData.name,
        level: roleData.level || 20,
        inheritsFrom: roleData.inheritsFrom || [],
        permissions: roleData.permissions || [],
        description: roleData.description || '',
        canManageRoles: roleData.canManageRoles || false,
        canManageUsers: roleData.canManageUsers || false,
        systemRole: false,
        createdAt: new Date(),
        createdBy: roleData.createdBy
      };

      // Validate permissions
      const invalidPermissions = role.permissions.filter(perm => 
        !this.permissions[perm] && perm !== '*'
      );
      
      if (invalidPermissions.length > 0) {
        throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }

      this.customRoles.set(roleId, role);

      logger.info('Custom role created', {
        roleId,
        roleName: role.name,
        createdBy: role.createdBy
      });

      return role;
    } catch (error) {
      logger.error('Failed to create role', { error: error.message, roleData });
      throw error;
    }
  }

  /**
   * Update a custom role
   */
  updateRole(roleId, updates) {
    try {
      const role = this.customRoles.get(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      if (role.systemRole) {
        throw new Error('Cannot update system roles');
      }

      // Validate permissions if provided
      if (updates.permissions) {
        const invalidPermissions = updates.permissions.filter(perm => 
          !this.permissions[perm] && perm !== '*'
        );
        
        if (invalidPermissions.length > 0) {
          throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
        }
      }

      const updatedRole = {
        ...role,
        ...updates,
        updatedAt: new Date(),
        updatedBy: updates.updatedBy
      };

      this.customRoles.set(roleId, updatedRole);

      logger.info('Role updated', {
        roleId,
        roleName: updatedRole.name,
        updatedBy: updates.updatedBy
      });

      return updatedRole;
    } catch (error) {
      logger.error('Failed to update role', { error: error.message, roleId, updates });
      throw error;
    }
  }

  /**
   * Delete a custom role
   */
  deleteRole(roleId, deletedBy) {
    try {
      const role = this.customRoles.get(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      if (role.systemRole) {
        throw new Error('Cannot delete system roles');
      }

      // Check if role is assigned to any users
      const assignedUsers = Array.from(this.roleAssignments.entries())
        .filter(([userId, userRoleId]) => userRoleId === roleId)
        .map(([userId]) => userId);

      if (assignedUsers.length > 0) {
        throw new Error(`Cannot delete role: assigned to ${assignedUsers.length} users`);
      }

      this.customRoles.delete(roleId);

      logger.info('Role deleted', {
        roleId,
        roleName: role.name,
        deletedBy
      });

      return true;
    } catch (error) {
      logger.error('Failed to delete role', { error: error.message, roleId, deletedBy });
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  assignRole(userId, roleId, assignedBy) {
    try {
      const role = this.getRole(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      this.roleAssignments.set(userId, roleId);

      logger.info('Role assigned', {
        userId,
        roleId,
        roleName: role.name,
        assignedBy
      });

      return {
        userId,
        roleId,
        roleName: role.name,
        assignedAt: new Date(),
        assignedBy
      };
    } catch (error) {
      logger.error('Failed to assign role', { error: error.message, userId, roleId, assignedBy });
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  removeRole(userId, removedBy) {
    try {
      const currentRoleId = this.roleAssignments.get(userId);
      if (!currentRoleId) {
        throw new Error('User has no role assigned');
      }

      this.roleAssignments.delete(userId);

      logger.info('Role removed', {
        userId,
        previousRoleId: currentRoleId,
        removedBy
      });

      return true;
    } catch (error) {
      logger.error('Failed to remove role', { error: error.message, userId, removedBy });
      throw error;
    }
  }

  /**
   * Get user's role and effective permissions
   */
  getUserRole(userId) {
    const roleId = this.roleAssignments.get(userId);
    if (!roleId) {
      return null;
    }

    const role = this.getRole(roleId);
    if (!role) {
      return null;
    }

    return {
      ...role,
      effectivePermissions: this.getEffectivePermissions(role)
    };
  }

  /**
   * Get effective permissions for a role (including inherited)
   */
  getEffectivePermissions(role) {
    const permissions = new Set(role.permissions);

    // Add inherited permissions
    if (role.inheritsFrom && role.inheritsFrom.length > 0) {
      for (const parentRoleId of role.inheritsFrom) {
        const parentRole = this.getRole(parentRoleId);
        if (parentRole) {
          const parentPermissions = this.getEffectivePermissions(parentRole);
          parentPermissions.forEach(perm => permissions.add(perm));
        }
      }
    }

    return Array.from(permissions);
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(userId, permission, resource = null) {
    try {
      const userRole = this.getUserRole(userId);
      if (!userRole) {
        return false;
      }

      const effectivePermissions = userRole.effectivePermissions;

      // Check for wildcard permission
      if (effectivePermissions.includes('*')) {
        return true;
      }

      // Check for exact permission match
      if (effectivePermissions.includes(permission)) {
        return true;
      }

      // Check for wildcard category permissions (e.g., 'user:*' matches 'user:read')
      const [category] = permission.split(':');
      if (effectivePermissions.includes(`${category}:*`)) {
        return true;
      }

      // Check resource-specific permissions (e.g., 'booking:own:read')
      if (resource && permission.includes(':own:')) {
        // This would need additional logic to verify ownership
        return this.checkResourceOwnership(userId, resource, permission);
      }

      return false;
    } catch (error) {
      logger.error('Permission check failed', { error: error.message, userId, permission, resource });
      return false;
    }
  }

  /**
   * Check multiple permissions (AND operation)
   */
  hasAllPermissions(userId, permissions) {
    return permissions.every(permission => this.hasPermission(userId, permission));
  }

  /**
   * Check multiple permissions (OR operation)
   */
  hasAnyPermission(userId, permissions) {
    return permissions.some(permission => this.hasPermission(userId, permission));
  }

  /**
   * Get all users with a specific role
   */
  getUsersByRole(roleId) {
    return Array.from(this.roleAssignments.entries())
      .filter(([userId, userRoleId]) => userRoleId === roleId)
      .map(([userId]) => userId);
  }

  /**
   * Check resource ownership for 'own' permissions
   */
  checkResourceOwnership(userId, resource, permission) {
    // This would integrate with your resource models to check ownership
    // For now, return false as placeholder
    return false;
  }

  /**
   * Get role hierarchy
   */
  getRoleHierarchy() {
    const hierarchy = {};
    
    // Build hierarchy from system roles
    Object.entries(this.systemRoles).forEach(([roleId, role]) => {
      hierarchy[roleId] = {
        ...role,
        id: roleId,
        children: []
      };
    });

    // Add custom roles
    this.customRoles.forEach((role, roleId) => {
      hierarchy[roleId] = {
        ...role,
        children: []
      };
    });

    // Build parent-child relationships
    Object.values(hierarchy).forEach(role => {
      if (role.inheritsFrom && role.inheritsFrom.length > 0) {
        role.inheritsFrom.forEach(parentId => {
          if (hierarchy[parentId]) {
            hierarchy[parentId].children.push(role.id);
          }
        });
      }
    });

    return hierarchy;
  }

  /**
   * Validate role permissions
   */
  validateRolePermissions(permissions) {
    const invalidPermissions = permissions.filter(perm => {
      if (perm === '*') return false;
      if (this.permissions[perm]) return false;
      
      // Check for wildcard permissions
      if (perm.endsWith(':*')) {
        const category = perm.slice(0, -2);
        return !Object.keys(this.permissions).some(p => p.startsWith(category + ':'));
      }
      
      return true;
    });

    return {
      valid: invalidPermissions.length === 0,
      invalidPermissions
    };
  }

  /**
   * Get permission analytics
   */
  getPermissionAnalytics() {
    const analytics = {
      totalRoles: Object.keys(this.systemRoles).length + this.customRoles.size,
      systemRoles: Object.keys(this.systemRoles).length,
      customRoles: this.customRoles.size,
      totalPermissions: Object.keys(this.permissions).length,
      totalUsers: this.roleAssignments.size,
      roleDistribution: {}
    };

    // Count users per role
    this.roleAssignments.forEach((roleId) => {
      analytics.roleDistribution[roleId] = (analytics.roleDistribution[roleId] || 0) + 1;
    });

    return analytics;
  }
}

// Create singleton instance
const rolePermissionService = new RolePermissionService();

export default rolePermissionService;