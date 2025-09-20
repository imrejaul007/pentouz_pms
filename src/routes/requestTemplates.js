import express from 'express';
import RequestTemplate from '../models/RequestTemplate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/request-templates:
 *   get:
 *     summary: Get request templates
 *     tags: [Request Templates]
 *     parameters:
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 */
router.get('/', catchAsync(async (req, res) => {
  const { department, category, page = 1, limit = 50 } = req.query;
  const { hotelId } = req.user;

  const filter = { hotelId, isActive: true };

  if (department) {
    filter.department = department;
  }

  if (category) {
    filter.category = category;
  }

  const templates = await RequestTemplate.find(filter)
    .populate('createdBy', 'username email')
    .sort({ useCount: -1, createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await RequestTemplate.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    data: {
      templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /api/v1/request-templates/{id}:
 *   get:
 *     summary: Get request template by ID
 *     tags: [Request Templates]
 */
router.get('/:id', catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  const template = await RequestTemplate.findOne({
    _id: req.params.id,
    hotelId,
    isActive: true
  }).populate('createdBy', 'username email');

  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { template }
  });
}));

/**
 * @swagger
 * /api/v1/request-templates:
 *   post:
 *     summary: Create new request template
 *     tags: [Request Templates]
 */
router.post('/', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;

  const templateData = {
    ...req.body,
    hotelId,
    createdBy: userId
  };

  const template = await RequestTemplate.create(templateData);

  res.status(201).json({
    status: 'success',
    data: { template },
    message: 'Template created successfully'
  });
}));

/**
 * @swagger
 * /api/v1/request-templates/{id}:
 *   put:
 *     summary: Update request template
 *     tags: [Request Templates]
 */
router.put('/:id', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;

  const template = await RequestTemplate.findOneAndUpdate(
    { _id: req.params.id, hotelId },
    { ...req.body, updatedBy: userId },
    { new: true, runValidators: true }
  );

  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { template },
    message: 'Template updated successfully'
  });
}));

/**
 * @swagger
 * /api/v1/request-templates/{id}:
 *   delete:
 *     summary: Deactivate request template
 *     tags: [Request Templates]
 */
router.delete('/:id', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  const template = await RequestTemplate.findOneAndUpdate(
    { _id: req.params.id, hotelId },
    { isActive: false },
    { new: true }
  );

  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  res.status(200).json({
    status: 'success',
    message: 'Template deactivated successfully'
  });
}));

/**
 * @swagger
 * /api/v1/request-templates/{id}/use:
 *   post:
 *     summary: Increment template use count
 *     tags: [Request Templates]
 */
router.post('/:id/use', catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  const template = await RequestTemplate.findOneAndUpdate(
    { _id: req.params.id, hotelId, isActive: true },
    { $inc: { useCount: 1 } },
    { new: true }
  );

  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { template }
  });
}));

export default router;