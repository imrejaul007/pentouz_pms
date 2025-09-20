import express from 'express';
import RequestCategory from '../models/RequestCategory.js';
import RequestTemplate from '../models/RequestTemplate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/request-categories:
 *   get:
 *     summary: Get request categories
 *     tags: [Request Categories]
 *     parameters:
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department
 */
router.get('/', catchAsync(async (req, res) => {
  const { department, page = 1, limit = 50 } = req.query;
  const { hotelId } = req.user;

  const filter = { hotelId, isActive: true };

  if (department) {
    filter.department = department;
  }

  const categories = await RequestCategory.find(filter)
    .populate('createdBy', 'username email')
    .sort({ sortOrder: 1, name: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  // Get template counts for each category
  const categoriesWithTemplates = await Promise.all(
    categories.map(async (category) => {
      const templateCount = await RequestTemplate.countDocuments({
        hotelId,
        category: category.name.toLowerCase(),
        isActive: true
      });

      return {
        ...category.toObject(),
        templateCount
      };
    })
  );

  const total = await RequestCategory.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    data: {
      categories: categoriesWithTemplates,
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
 * /api/v1/request-categories/{id}:
 *   get:
 *     summary: Get request category by ID
 *     tags: [Request Categories]
 */
router.get('/:id', catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  const category = await RequestCategory.findOne({
    _id: req.params.id,
    hotelId,
    isActive: true
  }).populate('createdBy', 'username email');

  if (!category) {
    throw new ApplicationError('Category not found', 404);
  }

  // Get templates for this category
  const templates = await RequestTemplate.find({
    hotelId,
    category: category.name.toLowerCase(),
    isActive: true
  }).select('name description estimatedBudget useCount');

  res.status(200).json({
    status: 'success',
    data: {
      category: {
        ...category.toObject(),
        templates
      }
    }
  });
}));

/**
 * @swagger
 * /api/v1/request-categories:
 *   post:
 *     summary: Create new request category
 *     tags: [Request Categories]
 */
router.post('/', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;

  const categoryData = {
    ...req.body,
    hotelId,
    createdBy: userId
  };

  const category = await RequestCategory.create(categoryData);

  res.status(201).json({
    status: 'success',
    data: { category },
    message: 'Category created successfully'
  });
}));

/**
 * @swagger
 * /api/v1/request-categories/{id}:
 *   put:
 *     summary: Update request category
 *     tags: [Request Categories]
 */
router.put('/:id', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;

  const category = await RequestCategory.findOneAndUpdate(
    { _id: req.params.id, hotelId },
    { ...req.body, updatedBy: userId },
    { new: true, runValidators: true }
  );

  if (!category) {
    throw new ApplicationError('Category not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { category },
    message: 'Category updated successfully'
  });
}));

/**
 * @swagger
 * /api/v1/request-categories/{id}:
 *   delete:
 *     summary: Deactivate request category
 *     tags: [Request Categories]
 */
router.delete('/:id', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  const category = await RequestCategory.findOneAndUpdate(
    { _id: req.params.id, hotelId },
    { isActive: false },
    { new: true }
  );

  if (!category) {
    throw new ApplicationError('Category not found', 404);
  }

  res.status(200).json({
    status: 'success',
    message: 'Category deactivated successfully'
  });
}));

/**
 * @swagger
 * /api/v1/request-categories/{id}/budget:
 *   put:
 *     summary: Update category budget
 *     tags: [Request Categories]
 */
router.put('/:id/budget', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { budgetAllocated, budgetUsed } = req.body;

  const category = await RequestCategory.findOneAndUpdate(
    { _id: req.params.id, hotelId },
    { budgetAllocated, budgetUsed },
    { new: true, runValidators: true }
  );

  if (!category) {
    throw new ApplicationError('Category not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { category },
    message: 'Category budget updated successfully'
  });
}));

export default router;