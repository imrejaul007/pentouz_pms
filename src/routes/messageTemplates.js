import express from 'express';
import MessageTemplate from '../models/MessageTemplate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /message-templates:
 *   post:
 *     summary: Create a new message template
 *     tags: [Message Templates]
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
 *               - type
 *               - category
 *               - subject
 *               - content
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [email, sms, push, in_app, whatsapp]
 *               category:
 *                 type: string
 *                 enum: [welcome, confirmation, reminder, follow_up, marketing, announcement, transactional]
 *               subject:
 *                 type: string
 *               content:
 *                 type: string
 *               htmlContent:
 *                 type: string
 *               variables:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     required:
 *                       type: boolean
 *                     defaultValue:
 *                       type: string
 *               design:
 *                 type: object
 *               triggers:
 *                 type: array
 *     responses:
 *       201:
 *         description: Template created successfully
 */
router.post('/', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const templateData = {
    ...req.body,
    hotelId: req.user.role === 'staff' ? req.user.hotelId : req.body.hotelId,
    createdBy: req.user._id
  };

  if (req.user.role === 'admin' && !req.body.hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const template = await MessageTemplate.create(templateData);
  
  await template.populate([
    { path: 'hotelId', select: 'name' },
    { path: 'createdBy', select: 'name' }
  ]);

  res.status(201).json({
    status: 'success',
    data: { template }
  });
}));

/**
 * @swagger
 * /message-templates:
 *   get:
 *     summary: Get message templates
 *     tags: [Message Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of templates
 */
router.get('/', catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    category,
    isActive,
    search,
    popular
  } = req.query;

  const query = {};

  // Role-based filtering
  if (req.user.role === 'staff') {
    query.hotelId = req.user.hotelId;
  } else if (req.user.role === 'admin' && req.query.hotelId) {
    query.hotelId = req.query.hotelId;
  }

  // Apply filters
  if (type) query.type = type;
  if (category) query.category = category;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } }
    ];
  }

  let sortOption = '-createdAt';
  if (popular === 'true') {
    sortOption = '-usageCount -lastUsed';
  }

  const skip = (page - 1) * limit;
  
  const [templates, total] = await Promise.all([
    MessageTemplate.find(query)
      .populate('hotelId', 'name')
      .populate('createdBy', 'name')
      .populate('lastModifiedBy', 'name')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit)),
    MessageTemplate.countDocuments(query)
  ]);

  res.json({
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
 * /message-templates/{id}:
 *   get:
 *     summary: Get specific template
 *     tags: [Message Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template details
 */
router.get('/:id', catchAsync(async (req, res) => {
  const template = await MessageTemplate.findById(req.params.id)
    .populate('hotelId', 'name')
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name')
    .populate('approvedBy', 'name');

  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && template.hotelId._id.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only view templates for your hotel', 403);
  }

  res.json({
    status: 'success',
    data: { template }
  });
}));

/**
 * @swagger
 * /message-templates/{id}:
 *   patch:
 *     summary: Update template
 *     tags: [Message Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               description:
 *                 type: string
 *               subject:
 *                 type: string
 *               content:
 *                 type: string
 *               htmlContent:
 *                 type: string
 *               variables:
 *                 type: array
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Template updated successfully
 */
router.patch('/:id', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const template = await MessageTemplate.findById(req.params.id);
  
  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && template.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only update templates for your hotel', 403);
  }

  const allowedUpdates = [
    'name', 'description', 'subject', 'content', 'htmlContent', 
    'plainTextContent', 'variables', 'design', 'localization',
    'triggers', 'abTesting', 'isActive', 'tags', 'notes'
  ];

  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  // Set last modified by
  updates.lastModifiedBy = req.user._id;

  Object.assign(template, updates);
  await template.save();

  await template.populate([
    { path: 'lastModifiedBy', select: 'name' }
  ]);

  res.json({
    status: 'success',
    data: { template }
  });
}));

/**
 * @swagger
 * /message-templates/{id}:
 *   delete:
 *     summary: Delete template
 *     tags: [Message Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Template deleted successfully
 */
router.delete('/:id', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const template = await MessageTemplate.findById(req.params.id);
  
  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && template.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only delete templates for your hotel', 403);
  }

  // Don't allow deletion if template is actively used
  if (template.usageCount > 0 && template.isActive) {
    throw new ApplicationError('Cannot delete actively used template. Deactivate it first.', 400);
  }

  await MessageTemplate.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
}));

/**
 * @swagger
 * /message-templates/{id}/render:
 *   post:
 *     summary: Render template with variables
 *     tags: [Message Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               variables:
 *                 type: object
 *               language:
 *                 type: string
 *                 default: en
 *     responses:
 *       200:
 *         description: Template rendered successfully
 */
router.post('/:id/render', catchAsync(async (req, res) => {
  const { variables = {}, language = 'en' } = req.body;
  
  const template = await MessageTemplate.findById(req.params.id);
  
  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && template.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only render templates for your hotel', 403);
  }

  try {
    const rendered = template.render(variables, language);
    
    res.json({
      status: 'success',
      data: {
        rendered,
        variables: template.variableNames,
        requiredVariables: template.requiredVariables
      }
    });
  } catch (error) {
    throw new ApplicationError(error.message, 400);
  }
}));

/**
 * @swagger
 * /message-templates/{id}/clone:
 *   post:
 *     summary: Clone template
 *     tags: [Message Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Template cloned successfully
 */
router.post('/:id/clone', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { name } = req.body;
  
  const template = await MessageTemplate.findById(req.params.id);
  
  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && template.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only clone templates for your hotel', 403);
  }

  const clonedTemplate = await template.clone(name, req.user._id);
  
  await clonedTemplate.populate([
    { path: 'hotelId', select: 'name' },
    { path: 'createdBy', select: 'name' }
  ]);

  res.status(201).json({
    status: 'success',
    data: { template: clonedTemplate }
  });
}));

/**
 * @swagger
 * /message-templates/{id}/ab-test:
 *   post:
 *     summary: Create A/B test variant
 *     tags: [Message Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - name
 *               - subject
 *               - content
 *             properties:
 *               name:
 *                 type: string
 *               subject:
 *                 type: string
 *               content:
 *                 type: string
 *               htmlContent:
 *                 type: string
 *               weight:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: A/B test variant created successfully
 */
router.post('/:id/ab-test', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { name, subject, content, htmlContent, weight = 50 } = req.body;
  
  const template = await MessageTemplate.findById(req.params.id);
  
  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && template.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only create A/B tests for templates in your hotel', 403);
  }

  await template.createABVariant({
    name,
    subject,
    content,
    htmlContent,
    weight
  });

  res.json({
    status: 'success',
    message: 'A/B test variant created successfully',
    data: { template }
  });
}));

/**
 * @swagger
 * /message-templates/popular:
 *   get:
 *     summary: Get popular templates
 *     tags: [Message Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Popular templates
 */
router.get('/popular', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { type, limit = 10 } = req.query;
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const popularTemplates = await MessageTemplate.getPopularTemplates(hotelId, type, parseInt(limit));

  res.json({
    status: 'success',
    data: { templates: popularTemplates }
  });
}));

/**
 * @swagger
 * /message-templates/by-trigger/{event}:
 *   get:
 *     summary: Get templates by trigger event
 *     tags: [Message Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: event
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Templates for trigger event
 */
router.get('/by-trigger/:event', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { event } = req.params;
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const templates = await MessageTemplate.getByTrigger(hotelId, event);

  res.json({
    status: 'success',
    data: { templates }
  });
}));

/**
 * @swagger
 * /message-templates/stats:
 *   get:
 *     summary: Get template performance statistics
 *     tags: [Message Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Template performance statistics
 */
router.get('/stats', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const [performanceStats, popularTemplates] = await Promise.all([
    MessageTemplate.getPerformanceStats(hotelId, startDate, endDate),
    MessageTemplate.getPopularTemplates(hotelId, null, 5)
  ]);

  // Get overall template summary
  const overallStats = await MessageTemplate.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        ...(startDate && endDate ? {
          lastUsed: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        } : {})
      }
    },
    {
      $group: {
        _id: null,
        totalTemplates: { $sum: 1 },
        activeTemplates: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        totalUsage: { $sum: '$usageCount' },
        avgUsage: { $avg: '$usageCount' },
        totalRevenue: { $sum: '$performance.revenue' }
      }
    }
  ]);

  res.json({
    status: 'success',
    data: {
      overall: overallStats[0] || {},
      performance: performanceStats,
      popular: popularTemplates
    }
  });
}));

export default router;
