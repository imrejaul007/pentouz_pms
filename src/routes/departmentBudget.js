import express from 'express';
import mongoose from 'mongoose';
import DepartmentBudget from '../models/DepartmentBudget.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /department-budget/{department}:
 *   get:
 *     summary: Get department budget information
 *     tags: [Department Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department
 *         required: true
 *         schema:
 *           type: string
 *           enum: [housekeeping, maintenance, front_desk, food_beverage, spa, laundry, kitchen, bar, other]
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           default: 2025
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Department budget information
 */
router.get('/:department', catchAsync(async (req, res) => {
  const { department } = req.params;
  const { year = new Date().getFullYear(), month } = req.query;
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Validate department
  const validDepartments = ['housekeeping', 'maintenance', 'front_desk', 'food_beverage', 'spa', 'laundry', 'kitchen', 'bar', 'other'];
  if (!validDepartments.includes(department)) {
    throw new ApplicationError('Invalid department', 400);
  }

  const budget = await DepartmentBudget.getOrCreateBudget(
    hotelId,
    department,
    parseInt(year),
    month ? parseInt(month) : null
  );

  res.json({
    status: 'success',
    data: budget
  });
}));

/**
 * @swagger
 * /department-budget/{department}/alerts:
 *   get:
 *     summary: Get budget alerts for department
 *     tags: [Department Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Budget alerts
 */
router.get('/:department/alerts', catchAsync(async (req, res) => {
  const { department } = req.params;
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const budget = await DepartmentBudget.findOne({
    hotelId,
    department,
    'budgetPeriod.year': new Date().getFullYear(),
    'budgetPeriod.month': new Date().getMonth() + 1,
    status: 'active'
  });

  const alerts = budget ? budget.getAlerts() : [];

  res.json({
    status: 'success',
    data: alerts
  });
}));

/**
 * @swagger
 * /department-budget/summary:
 *   get:
 *     summary: Get budget summary for all departments
 *     tags: [Department Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Budget summary across departments
 */
router.get('/summary', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { year = new Date().getFullYear(), month } = req.query;
  const hotelId = req.user.role === 'manager' ? req.user.hotelId : req.query.hotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const summary = await DepartmentBudget.getDepartmentSummary(
    hotelId,
    parseInt(year),
    month ? parseInt(month) : null
  );

  res.json({
    status: 'success',
    data: summary
  });
}));

/**
 * @swagger
 * /department-budget/{department}/trends:
 *   get:
 *     summary: Get spending trends for department
 *     tags: [Department Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 6
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Spending trends
 */
router.get('/:department/trends', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { department } = req.params;
  const { months = 6 } = req.query;
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const trends = await DepartmentBudget.getSpendingTrends(
    hotelId,
    department,
    parseInt(months)
  );

  res.json({
    status: 'success',
    data: trends
  });
}));

/**
 * @swagger
 * /department-budget/{department}:
 *   post:
 *     summary: Create or update department budget
 *     tags: [Department Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department
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
 *               year:
 *                 type: integer
 *               month:
 *                 type: integer
 *               allocations:
 *                 type: object
 *                 properties:
 *                   supply_requests:
 *                     type: number
 *                   equipment:
 *                     type: number
 *                   maintenance:
 *                     type: number
 *                   other:
 *                     type: number
 *     responses:
 *       201:
 *         description: Budget created successfully
 */
router.post('/:department', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { department } = req.params;
  const { year, month, allocations } = req.body;
  const hotelId = req.user.role === 'manager' ? req.user.hotelId : req.body.hotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Check if budget already exists
  const existingBudget = await DepartmentBudget.findOne({
    hotelId,
    department,
    'budgetPeriod.year': year,
    'budgetPeriod.month': month || null
  });

  if (existingBudget) {
    // Update existing budget
    existingBudget.allocations = {
      ...existingBudget.allocations,
      ...allocations
    };
    existingBudget.updatedBy = req.user._id;
    await existingBudget.save();

    res.json({
      status: 'success',
      message: 'Budget updated successfully',
      data: existingBudget
    });
  } else {
    // Create new budget
    const budget = await DepartmentBudget.create({
      hotelId,
      department,
      budgetPeriod: { year, month },
      allocations: {
        total: allocations.supply_requests || 0,
        supply_requests: allocations.supply_requests || 0,
        equipment: allocations.equipment || 0,
        maintenance: allocations.maintenance || 0,
        other: allocations.other || 0
      },
      createdBy: req.user._id
    });

    res.status(201).json({
      status: 'success',
      message: 'Budget created successfully',
      data: budget
    });
  }
}));

/**
 * @swagger
 * /department-budget/{department}/spending:
 *   post:
 *     summary: Update department spending
 *     tags: [Department Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department
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
 *               amount:
 *                 type: number
 *               category:
 *                 type: string
 *                 default: supply_requests
 *               year:
 *                 type: integer
 *               month:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Spending updated successfully
 */
router.post('/:department/spending', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { department } = req.params;
  const { amount, category = 'supply_requests', year = new Date().getFullYear(), month } = req.body;
  const hotelId = req.user.role === 'manager' ? req.user.hotelId : req.body.hotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const budget = await DepartmentBudget.getOrCreateBudget(hotelId, department, year, month);
  await budget.updateSpending(amount, category);

  res.json({
    status: 'success',
    message: 'Spending updated successfully',
    data: budget
  });
}));

/**
 * @swagger
 * /department-budget/{department}/commitments:
 *   post:
 *     summary: Update budget commitments
 *     tags: [Department Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department
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
 *               amount:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [pending_approvals, approved_orders]
 *               year:
 *                 type: integer
 *               month:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Commitments updated successfully
 */
router.post('/:department/commitments', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { department } = req.params;
  const { amount, type = 'pending_approvals', year = new Date().getFullYear(), month } = req.body;
  const hotelId = req.user.role === 'manager' ? req.user.hotelId : req.body.hotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const budget = await DepartmentBudget.getOrCreateBudget(hotelId, department, year, month);
  await budget.updateCommitments(amount, type);

  res.json({
    status: 'success',
    message: 'Commitments updated successfully',
    data: budget
  });
}));

/**
 * @swagger
 * /department-budget/{department}/check-availability:
 *   post:
 *     summary: Check if department can spend amount
 *     tags: [Department Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department
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
 *               amount:
 *                 type: number
 *               category:
 *                 type: string
 *                 default: supply_requests
 *               year:
 *                 type: integer
 *               month:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Budget availability check
 */
router.post('/:department/check-availability', catchAsync(async (req, res) => {
  const { department } = req.params;
  const { amount, category = 'supply_requests', year = new Date().getFullYear(), month } = req.body;
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.body.hotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const budget = await DepartmentBudget.getOrCreateBudget(hotelId, department, year, month);
  const canSpend = budget.canSpend(amount, category);

  res.json({
    status: 'success',
    data: {
      canSpend,
      requestedAmount: amount,
      availableBudget: budget.availableBudget,
      utilizationPercentage: budget.utilizationPercentage,
      alerts: canSpend ? [] : [{
        type: 'insufficient_budget',
        message: `Insufficient budget. Requested: ₹${amount}, Available: ₹${budget.availableBudget}`
      }]
    }
  });
}));

export default router;
