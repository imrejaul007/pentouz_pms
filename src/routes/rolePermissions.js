import express from 'express';
import rolePermissionController from '../controllers/rolePermissionController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requirePermission, requireRoleLevel } from '../middleware/permissionCheck.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const createRoleSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  level: Joi.number().min(1).max(99).optional(),
  inheritsFrom: Joi.array().items(Joi.string()).optional(),
  permissions: Joi.array().items(Joi.string()).required(),
  description: Joi.string().max(200).optional(),
  canManageRoles: Joi.boolean().optional(),
  canManageUsers: Joi.boolean().optional()
});

const updateRoleSchema = Joi.object({
  name: Joi.string().min(3).max(50).optional(),
  level: Joi.number().min(1).max(99).optional(),
  inheritsFrom: Joi.array().items(Joi.string()).optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
  description: Joi.string().max(200).optional(),
  canManageRoles: Joi.boolean().optional(),
  canManageUsers: Joi.boolean().optional()
});

const assignRoleSchema = Joi.object({
  roleId: Joi.string().required()
});

const checkPermissionSchema = Joi.object({
  permission: Joi.string().required(),
  resource: Joi.string().optional()
});

const checkMultiplePermissionsSchema = Joi.object({
  permissions: Joi.array().items(Joi.string()).required(),
  checkType: Joi.string().valid('any', 'all').optional()
});

const validatePermissionsSchema = Joi.object({
  permissions: Joi.array().items(Joi.string()).required()
});

const bulkAssignSchema = Joi.object({
  assignments: Joi.array().items(
    Joi.object({
      userId: Joi.string().required(),
      roleId: Joi.string().required()
    })
  ).required()
});

// Authentication required for all routes
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     Role:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         level:
 *           type: integer
 *         inheritsFrom:
 *           type: array
 *           items:
 *             type: string
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *         description:
 *           type: string
 *         canManageRoles:
 *           type: boolean
 *         canManageUsers:
 *           type: boolean
 *         systemRole:
 *           type: boolean
 *         effectivePermissions:
 *           type: array
 *           items:
 *             type: string
 */

// Role Management Routes

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: Get all roles
 *     description: Retrieve all system and custom roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeSystem
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include system roles
 *       - in: query
 *         name: includeCustom
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include custom roles
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
 */
router.get('/',
  requirePermission('user:read'),
  rolePermissionController.getAllRoles
);

/**
 * @swagger
 * /roles/{roleId}:
 *   get:
 *     summary: Get role by ID
 *     description: Retrieve detailed information about a specific role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role retrieved successfully
 *       404:
 *         description: Role not found
 */
router.get('/:roleId',
  requirePermission('user:read'),
  rolePermissionController.getRoleById
);

/**
 * @swagger
 * /roles:
 *   post:
 *     summary: Create new role
 *     description: Create a custom role with specified permissions
 *     tags: [Roles]
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
 *               - permissions
 *             properties:
 *               name:
 *                 type: string
 *               level:
 *                 type: integer
 *               inheritsFrom:
 *                 type: array
 *                 items:
 *                   type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               description:
 *                 type: string
 *               canManageRoles:
 *                 type: boolean
 *               canManageUsers:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Validation error
 */
router.post('/',
  requireRoleLevel(90), // Only admin level can create roles
  validate(createRoleSchema),
  rolePermissionController.createRole
);

/**
 * @swagger
 * /roles/{roleId}:
 *   put:
 *     summary: Update role
 *     description: Update an existing custom role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
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
 *               name:
 *                 type: string
 *               level:
 *                 type: integer
 *               inheritsFrom:
 *                 type: array
 *                 items:
 *                   type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               description:
 *                 type: string
 *               canManageRoles:
 *                 type: boolean
 *               canManageUsers:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Role updated successfully
 */
router.put('/:roleId',
  requireRoleLevel(90),
  validate(updateRoleSchema),
  rolePermissionController.updateRole
);

/**
 * @swagger
 * /roles/{roleId}:
 *   delete:
 *     summary: Delete role
 *     description: Delete a custom role (cannot delete system roles)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role deleted successfully
 */
router.delete('/:roleId',
  requireRoleLevel(100), // Only super admin can delete roles
  rolePermissionController.deleteRole
);

// Permission Management Routes

/**
 * @swagger
 * /roles/permissions/all:
 *   get:
 *     summary: Get all available permissions
 *     description: Retrieve all system permissions grouped by category
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 */
router.get('/permissions/all',
  requirePermission('user:read'),
  rolePermissionController.getAllPermissions
);

/**
 * @swagger
 * /roles/permissions/validate:
 *   post:
 *     summary: Validate role permissions
 *     description: Check if provided permissions are valid
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissions
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Validation completed
 */
router.post('/permissions/validate',
  requirePermission('user:read'),
  validate(validatePermissionsSchema),
  rolePermissionController.validateRolePermissions
);

// User Role Assignment Routes

/**
 * @swagger
 * /roles/users/{userId}/assign:
 *   post:
 *     summary: Assign role to user
 *     description: Assign a specific role to a user
 *     tags: [User Roles]
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
 *             required:
 *               - roleId
 *             properties:
 *               roleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role assigned successfully
 */
router.post('/users/:userId/assign',
  requirePermission('user:update'),
  validate(assignRoleSchema),
  rolePermissionController.assignUserRole
);

/**
 * @swagger
 * /roles/users/{userId}/remove:
 *   delete:
 *     summary: Remove role from user
 *     description: Remove the current role assignment from a user
 *     tags: [User Roles]
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
 *         description: Role removed successfully
 */
router.delete('/users/:userId/remove',
  requirePermission('user:update'),
  rolePermissionController.removeUserRole
);

/**
 * @swagger
 * /roles/users/{userId}/role:
 *   get:
 *     summary: Get user's role
 *     description: Retrieve the role assigned to a specific user
 *     tags: [User Roles]
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
 *         description: User role retrieved successfully
 */
router.get('/users/:userId/role',
  requirePermission('user:read'),
  rolePermissionController.getUserRole
);

// Permission Checking Routes

/**
 * @swagger
 * /roles/users/{userId}/check-permission:
 *   post:
 *     summary: Check user permission
 *     description: Check if a user has a specific permission
 *     tags: [Permission Checks]
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
 *             required:
 *               - permission
 *             properties:
 *               permission:
 *                 type: string
 *               resource:
 *                 type: string
 *     responses:
 *       200:
 *         description: Permission check completed
 */
router.post('/users/:userId/check-permission',
  requirePermission('user:read'),
  validate(checkPermissionSchema),
  rolePermissionController.checkUserPermission
);

/**
 * @swagger
 * /roles/users/{userId}/check-permissions:
 *   post:
 *     summary: Check multiple permissions
 *     description: Check if a user has multiple permissions (any or all)
 *     tags: [Permission Checks]
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
 *             required:
 *               - permissions
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               checkType:
 *                 type: string
 *                 enum: [any, all]
 *                 default: any
 *     responses:
 *       200:
 *         description: Multiple permission check completed
 */
router.post('/users/:userId/check-permissions',
  requirePermission('user:read'),
  validate(checkMultiplePermissionsSchema),
  rolePermissionController.checkMultiplePermissions
);

// Analytics and Hierarchy Routes

/**
 * @swagger
 * /roles/hierarchy:
 *   get:
 *     summary: Get role hierarchy
 *     description: Retrieve the complete role hierarchy with inheritance relationships
 *     tags: [Role Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role hierarchy retrieved successfully
 */
router.get('/hierarchy',
  requirePermission('user:read'),
  rolePermissionController.getRoleHierarchy
);

/**
 * @swagger
 * /roles/{roleId}/users:
 *   get:
 *     summary: Get users by role
 *     description: Get all users assigned to a specific role
 *     tags: [Role Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
router.get('/:roleId/users',
  requirePermission('user:read'),
  rolePermissionController.getUsersByRole
);

/**
 * @swagger
 * /roles/analytics:
 *   get:
 *     summary: Get permission analytics
 *     description: Retrieve analytics about role and permission usage
 *     tags: [Role Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 */
router.get('/analytics',
  requireRoleLevel(70),
  rolePermissionController.getPermissionAnalytics
);

// Personal Routes (My Role/Permissions)

/**
 * @swagger
 * /roles/me/role:
 *   get:
 *     summary: Get my role
 *     description: Get the current user's role information
 *     tags: [My Role]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User role retrieved successfully
 */
router.get('/me/role',
  rolePermissionController.getMyRole
);

/**
 * @swagger
 * /roles/me/permissions:
 *   get:
 *     summary: Get my permissions
 *     description: Get all effective permissions for the current user
 *     tags: [My Role]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User permissions retrieved successfully
 */
router.get('/me/permissions',
  rolePermissionController.getMyPermissions
);

// Bulk Operations

/**
 * @swagger
 * /roles/users/bulk-assign:
 *   post:
 *     summary: Bulk assign roles
 *     description: Assign roles to multiple users in a single operation
 *     tags: [Bulk Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assignments
 *             properties:
 *               assignments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - userId
 *                     - roleId
 *                   properties:
 *                     userId:
 *                       type: string
 *                     roleId:
 *                       type: string
 *     responses:
 *       200:
 *         description: Bulk assignment completed
 */
router.post('/users/bulk-assign',
  requireRoleLevel(90),
  validate(bulkAssignSchema),
  rolePermissionController.bulkAssignRoles
);

export default router;