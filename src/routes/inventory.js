import express from 'express';
import Inventory from '../models/Inventory.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// Get inventory items
router.get('/', authenticate, authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const {
    category,
    lowStock,
    page = 1,
    limit = 10
  } = req.query;

  const query = { isActive: true };
  
  if (req.user.hotelId) {
    query.hotelId = req.user.hotelId;
  }
  
  if (category) query.category = category;
  
  if (lowStock === 'true') {
    query.$expr = { $lte: ['$quantity', '$minimumThreshold'] };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const items = await Inventory.find(query)
    .sort({ name: 1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Inventory.countDocuments(query);

  res.json({
    status: 'success',
    results: items.length,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    },
    data: { items }
  });
}));

// Create inventory item
router.post('/', authenticate, authorize('admin'), catchAsync(async (req, res) => {
  const itemData = {
    ...req.body,
    hotelId: req.user.hotelId
  };

  const item = await Inventory.create(itemData);

  res.status(201).json({
    status: 'success',
    data: { item }
  });
}));

// Update inventory item
router.patch('/:id', authenticate, authorize('admin', 'staff'), catchAsync(async (req, res) => {
  const item = await Inventory.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new ApplicationError('Inventory item not found', 404);
  }

  res.json({
    status: 'success',
    data: { item }
  });
}));

// Create supply request
router.post('/request', authenticate, authorize('staff'), catchAsync(async (req, res) => {
  const { itemId, quantity, reason } = req.body;

  const item = await Inventory.findById(itemId);
  
  if (!item) {
    throw new ApplicationError('Inventory item not found', 404);
  }

  item.requests.push({
    userId: req.user._id,
    quantity,
    reason,
    status: 'pending'
  });

  await item.save();

  res.status(201).json({
    status: 'success',
    data: { 
      item,
      message: 'Supply request submitted successfully' 
    }
  });
}));

// Approve/reject supply request
router.patch('/request/:itemId/:requestId', 
  authenticate, 
  authorize('admin'), 
  catchAsync(async (req, res) => {
    const { itemId, requestId } = req.params;
    const { status } = req.body; // 'approved', 'rejected', 'fulfilled'

    const item = await Inventory.findById(itemId);
    
    if (!item) {
      throw new ApplicationError('Inventory item not found', 404);
    }

    const request = item.requests.id(requestId);
    
    if (!request) {
      throw new ApplicationError('Request not found', 404);
    }

    request.status = status;
    request.approvedBy = req.user._id;
    request.processedAt = new Date();

    // If fulfilled, update inventory quantity
    if (status === 'fulfilled') {
      item.quantity += request.quantity;
    }

    await item.save();

    res.json({
      status: 'success',
      data: { item }
    });
  })
);

export default router;
