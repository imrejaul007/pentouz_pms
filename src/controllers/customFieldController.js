import customFieldService from '../services/customFieldService.js';
import CustomField from '../models/CustomField.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

// Get all custom fields
export const getAllCustomFields = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    category,
    type,
    isActive,
    search,
    sortBy = 'displayOrder',
    sortOrder = 'asc'
  } = req.query;

  const filters = {
    hotelId: req.user.hotelId,
    category,
    type,
    isActive,
    search,
    page: parseInt(page),
    limit: parseInt(limit),
    sortBy,
    sortOrder
  };

  const result = await customFieldService.getCustomFields(filters);

  res.json({
    status: 'success',
    results: result.customFields.length,
    pagination: result.pagination,
    data: { customFields: result.customFields }
  });
});

// Get custom field by ID
export const getCustomField = catchAsync(async (req, res) => {
  const customField = await customFieldService.getCustomFieldById(
    req.params.id,
    req.user.hotelId
  );

  res.json({
    status: 'success',
    data: { customField }
  });
});

// Create custom field
export const createCustomField = catchAsync(async (req, res) => {
  const customField = await customFieldService.createCustomField(
    req.body,
    req.user._id,
    req.user.hotelId
  );

  res.status(201).json({
    status: 'success',
    data: { customField }
  });
});

// Update custom field
export const updateCustomField = catchAsync(async (req, res) => {
  const customField = await customFieldService.updateCustomField(
    req.params.id,
    req.body,
    req.user._id
  );

  res.json({
    status: 'success',
    data: { customField }
  });
});

// Delete custom field
export const deleteCustomField = catchAsync(async (req, res) => {
  await customFieldService.deleteCustomField(
    req.params.id,
    req.user.hotelId
  );

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get active fields for forms
export const getActiveFields = catchAsync(async (req, res) => {
  const { category, type, isVisible, isEditable } = req.query;

  const options = {};
  if (category) options.category = category;
  if (type) options.type = type;
  if (isVisible !== undefined) options.isVisible = isVisible === 'true';
  if (isEditable !== undefined) options.isEditable = isEditable === 'true';

  const fields = await customFieldService.getActiveFields(req.user.hotelId, options);

  res.json({
    status: 'success',
    results: fields.length,
    data: { fields }
  });
});

// Get fields by category
export const getFieldsByCategory = catchAsync(async (req, res) => {
  const { category } = req.params;

  const fields = await customFieldService.getFieldsByCategory(req.user.hotelId, category);

  res.json({
    status: 'success',
    results: fields.length,
    data: { fields }
  });
});

// Get custom field statistics
export const getFieldStatistics = catchAsync(async (req, res) => {
  const stats = await customFieldService.getFieldStatistics(req.user.hotelId);

  res.json({
    status: 'success',
    data: stats
  });
});

// Validate field value
export const validateFieldValue = catchAsync(async (req, res) => {
  const { fieldId, value } = req.body;

  if (!fieldId || value === undefined) {
    throw new ApplicationError('Field ID and value are required', 400);
  }

  const errors = await customFieldService.validateFieldValue(
    fieldId,
    value,
    req.user.hotelId
  );

  res.json({
    status: 'success',
    data: {
      isValid: errors.length === 0,
      errors
    }
  });
});

// Get guest custom data
export const getGuestCustomData = catchAsync(async (req, res) => {
  const { guestId } = req.params;
  const { category, includeInactive } = req.query;

  const options = {};
  if (category) options.category = category;
  if (includeInactive === 'true') options.includeInactive = true;

  const data = await customFieldService.getGuestCustomData(
    guestId,
    req.user.hotelId,
    options
  );

  res.json({
    status: 'success',
    results: data.length,
    data: { customData: data }
  });
});

// Update guest custom data
export const updateGuestCustomData = catchAsync(async (req, res) => {
  const { guestId, fieldId } = req.params;
  const { value } = req.body;

  if (value === undefined) {
    throw new ApplicationError('Value is required', 400);
  }

  const guestData = await customFieldService.updateGuestCustomData(
    guestId,
    fieldId,
    value,
    req.user._id,
    req.user.hotelId
  );

  res.json({
    status: 'success',
    data: { guestData }
  });
});

// Bulk update guest custom data
export const bulkUpdateGuestCustomData = catchAsync(async (req, res) => {
  const { guestId } = req.params;
  const { dataUpdates } = req.body;

  if (!dataUpdates || typeof dataUpdates !== 'object') {
    throw new ApplicationError('Data updates object is required', 400);
  }

  const result = await customFieldService.bulkUpdateGuestCustomData(
    guestId,
    dataUpdates,
    req.user._id,
    req.user.hotelId
  );

  res.json({
    status: 'success',
    data: {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount
    }
  });
});

// Get field usage statistics
export const getFieldUsageStats = catchAsync(async (req, res) => {
  const { fieldId } = req.params;

  const stats = await customFieldService.getFieldUsageStats(
    fieldId,
    req.user.hotelId
  );

  res.json({
    status: 'success',
    data: stats
  });
});

// Get custom data analytics
export const getCustomDataAnalytics = catchAsync(async (req, res) => {
  const { category, fieldType, dateRange } = req.query;

  const options = {};
  if (category) options.category = category;
  if (fieldType) options.fieldType = fieldType;
  if (dateRange) {
    try {
      const range = JSON.parse(dateRange);
      options.dateRange = range;
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const analytics = await customFieldService.getCustomDataAnalytics(
    req.user.hotelId,
    options
  );

  res.json({
    status: 'success',
    data: analytics
  });
});

// Export custom fields
export const exportCustomFields = catchAsync(async (req, res) => {
  const { format = 'json' } = req.query;

  const data = await customFieldService.exportCustomFields(req.user.hotelId, format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=custom_fields.csv');
    res.send(data);
  } else {
    res.json({
      status: 'success',
      results: data.length,
      data: { customFields: data }
    });
  }
});

// Import custom fields
export const importCustomFields = catchAsync(async (req, res) => {
  const { fieldsData } = req.body;

  if (!Array.isArray(fieldsData)) {
    throw new ApplicationError('Fields data must be an array', 400);
  }

  const result = await customFieldService.importCustomFields(
    fieldsData,
    req.user._id,
    req.user.hotelId
  );

  res.json({
    status: 'success',
    data: result
  });
});

// Get form configuration
export const getFormConfiguration = catchAsync(async (req, res) => {
  const { category, isVisible, isEditable } = req.query;

  const options = {};
  if (category) options.category = category;
  if (isVisible !== undefined) options.isVisible = isVisible === 'true';
  if (isEditable !== undefined) options.isEditable = isEditable === 'true';

  const configuration = await customFieldService.getFormConfiguration(
    req.user.hotelId,
    options
  );

  res.json({
    status: 'success',
    data: { configuration }
  });
});

// Bulk update custom fields
export const bulkUpdateCustomFields = catchAsync(async (req, res) => {
  const { fieldIds, updateData } = req.body;

  if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
    throw new ApplicationError('Field IDs array is required', 400);
  }

  const result = await CustomField.updateMany(
    { 
      _id: { $in: fieldIds },
      hotelId: req.user.hotelId
    },
    { 
      ...updateData, 
      updatedBy: req.user._id 
    }
  );

  res.json({
    status: 'success',
    data: {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    }
  });
});

// Reorder custom fields
export const reorderCustomFields = catchAsync(async (req, res) => {
  const { fieldOrders } = req.body;

  if (!Array.isArray(fieldOrders)) {
    throw new ApplicationError('Field orders array is required', 400);
  }

  const operations = fieldOrders.map(({ fieldId, displayOrder }) => ({
    updateOne: {
      filter: {
        _id: fieldId,
        hotelId: req.user.hotelId
      },
      update: {
        $set: {
          displayOrder,
          updatedBy: req.user._id
        }
      }
    }
  }));

  const result = await CustomField.bulkWrite(operations);

  res.json({
    status: 'success',
    data: {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    }
  });
});

export default {
  getAllCustomFields,
  getCustomField,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  getActiveFields,
  getFieldsByCategory,
  getFieldStatistics,
  validateFieldValue,
  getGuestCustomData,
  updateGuestCustomData,
  bulkUpdateGuestCustomData,
  getFieldUsageStats,
  getCustomDataAnalytics,
  exportCustomFields,
  importCustomFields,
  getFormConfiguration,
  bulkUpdateCustomFields,
  reorderCustomFields
};
