import Salutation from '../models/Salutation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

// Get all salutations
export const getAllSalutations = catchAsync(async (req, res) => {
  const { hotelId, category, gender, language, region, isActive } = req.query;
  
  // Build query
  const query = {};
  
  if (hotelId) {
    query.$or = [
      { hotelId: hotelId },
      { hotelId: null } // Include global salutations
    ];
  } else {
    query.hotelId = null; // Only global salutations
  }
  
  if (category) query.category = category;
  if (gender) {
    query.$or = [
      { gender: gender },
      { gender: 'any' }
    ];
  }
  if (language) query.language = language;
  if (region) query.region = region;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const salutations = await Salutation.find(query)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .sort({ sortOrder: 1, title: 1 });

  res.json({
    status: 'success',
    results: salutations.length,
    data: { salutations }
  });
});

// Get salutation by ID
export const getSalutation = catchAsync(async (req, res) => {
  const salutation = await Salutation.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!salutation) {
    throw new ApplicationError('Salutation not found', 404);
  }

  res.json({
    status: 'success',
    data: { salutation }
  });
});

// Create new salutation
export const createSalutation = catchAsync(async (req, res) => {
  const salutationData = {
    ...req.body,
    createdBy: req.user._id,
    hotelId: req.user.hotelId || null
  };

  const salutation = await Salutation.create(salutationData);

  await salutation.populate('createdBy', 'name email');

  res.status(201).json({
    status: 'success',
    data: { salutation }
  });
});

// Update salutation
export const updateSalutation = catchAsync(async (req, res) => {
  const salutation = await Salutation.findById(req.params.id);

  if (!salutation) {
    throw new ApplicationError('Salutation not found', 404);
  }

  // Check if user can update this salutation
  if (salutation.hotelId && salutation.hotelId.toString() !== req.user.hotelId?.toString()) {
    throw new ApplicationError('You can only update salutations for your hotel', 403);
  }

  const updatedSalutation = await Salutation.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user._id },
    { new: true, runValidators: true }
  ).populate('createdBy', 'name email')
   .populate('updatedBy', 'name email');

  res.json({
    status: 'success',
    data: { salutation: updatedSalutation }
  });
});

// Delete salutation
export const deleteSalutation = catchAsync(async (req, res) => {
  const salutation = await Salutation.findById(req.params.id);

  if (!salutation) {
    throw new ApplicationError('Salutation not found', 404);
  }

  // Check if user can delete this salutation
  if (salutation.hotelId && salutation.hotelId.toString() !== req.user.hotelId?.toString()) {
    throw new ApplicationError('You can only delete salutations for your hotel', 403);
  }

  // Don't allow deletion of global salutations
  if (!salutation.hotelId) {
    throw new ApplicationError('Cannot delete global salutations', 403);
  }

  await Salutation.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Bulk create salutations
export const bulkCreateSalutations = catchAsync(async (req, res) => {
  const { salutations } = req.body;

  if (!Array.isArray(salutations) || salutations.length === 0) {
    throw new ApplicationError('Salutations array is required', 400);
  }

  const salutationData = salutations.map(sal => ({
    ...sal,
    createdBy: req.user._id,
    hotelId: req.user.hotelId || null
  }));

  const createdSalutations = await Salutation.insertMany(salutationData);

  res.status(201).json({
    status: 'success',
    results: createdSalutations.length,
    data: { salutations: createdSalutations }
  });
});

// Get salutations by category
export const getSalutationsByCategory = catchAsync(async (req, res) => {
  const { category } = req.params;
  const { hotelId } = req.query;

  const salutations = await Salutation.getByCategory(category, hotelId);

  res.json({
    status: 'success',
    results: salutations.length,
    data: { salutations }
  });
});

// Get salutations by gender
export const getSalutationsByGender = catchAsync(async (req, res) => {
  const { gender } = req.params;
  const { hotelId } = req.query;

  const salutations = await Salutation.getByGender(gender, hotelId);

  res.json({
    status: 'success',
    results: salutations.length,
    data: { salutations }
  });
});

// Seed default salutations
export const seedDefaultSalutations = catchAsync(async (req, res) => {
  const result = await Salutation.seedDefaultSalutations(req.user._id);

  res.json({
    status: 'success',
    message: result.message,
    data: { count: result.count }
  });
});

// Toggle salutation status
export const toggleSalutationStatus = catchAsync(async (req, res) => {
  const salutation = await Salutation.findById(req.params.id);

  if (!salutation) {
    throw new ApplicationError('Salutation not found', 404);
  }

  // Check if user can update this salutation
  if (salutation.hotelId && salutation.hotelId.toString() !== req.user.hotelId?.toString()) {
    throw new ApplicationError('You can only update salutations for your hotel', 403);
  }

  salutation.isActive = !salutation.isActive;
  salutation.updatedBy = req.user._id;
  await salutation.save();

  await salutation.populate('createdBy', 'name email');
  await salutation.populate('updatedBy', 'name email');

  res.json({
    status: 'success',
    data: { salutation }
  });
});

// Get salutation statistics
export const getSalutationStats = catchAsync(async (req, res) => {
  const { hotelId } = req.query;

  const query = {};
  if (hotelId) {
    query.$or = [
      { hotelId: hotelId },
      { hotelId: null }
    ];
  } else {
    query.hotelId = null;
  }

  const stats = await Salutation.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
        byCategory: {
          $push: {
            category: '$category',
            isActive: '$isActive'
          }
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return res.json({
      status: 'success',
      data: {
        total: 0,
        active: 0,
        inactive: 0,
        byCategory: {}
      }
    });
  }

  const result = stats[0];
  
  // Calculate category breakdown
  const categoryStats = {};
  result.byCategory.forEach(item => {
    if (!categoryStats[item.category]) {
      categoryStats[item.category] = { total: 0, active: 0, inactive: 0 };
    }
    categoryStats[item.category].total++;
    if (item.isActive) {
      categoryStats[item.category].active++;
    } else {
      categoryStats[item.category].inactive++;
    }
  });

  res.json({
    status: 'success',
    data: {
      total: result.total,
      active: result.active,
      inactive: result.inactive,
      byCategory: categoryStats
    }
  });
});

export default {
  getAllSalutations,
  getSalutation,
  createSalutation,
  updateSalutation,
  deleteSalutation,
  bulkCreateSalutations,
  getSalutationsByCategory,
  getSalutationsByGender,
  seedDefaultSalutations,
  toggleSalutationStatus,
  getSalutationStats
};
