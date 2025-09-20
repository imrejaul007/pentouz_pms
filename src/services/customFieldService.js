import CustomField from '../models/CustomField.js';
import GuestCustomData from '../models/GuestCustomData.js';
import User from '../models/User.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

class CustomFieldService {
  /**
   * Create a new custom field
   */
  async createCustomField(fieldData, createdBy, hotelId) {
    try {
      // Check if field name already exists
      const existingField = await CustomField.findOne({
        name: fieldData.name,
        hotelId
      });

      if (existingField) {
        throw new ApplicationError('Field name already exists', 400);
      }

      // Create the custom field
      const customField = await CustomField.create({
        ...fieldData,
        hotelId,
        createdBy
      });

      await customField.populate('createdBy', 'name email');

      return customField;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to create custom field', 500);
    }
  }

  /**
   * Update a custom field
   */
  async updateCustomField(fieldId, updateData, updatedBy) {
    try {
      const customField = await CustomField.findByIdAndUpdate(
        fieldId,
        { ...updateData, updatedBy },
        { new: true, runValidators: true }
      );

      if (!customField) {
        throw new ApplicationError('Custom field not found', 404);
      }

      await customField.populate('updatedBy', 'name email');

      return customField;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to update custom field', 500);
    }
  }

  /**
   * Delete a custom field
   */
  async deleteCustomField(fieldId, hotelId) {
    try {
      const customField = await CustomField.findOneAndDelete({
        _id: fieldId,
        hotelId
      });

      if (!customField) {
        throw new ApplicationError('Custom field not found', 404);
      }

      // Delete all associated guest data
      await GuestCustomData.deleteMany({
        fieldId,
        hotelId
      });

      return customField;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to delete custom field', 500);
    }
  }

  /**
   * Get custom fields with filtering
   */
  async getCustomFields(filters = {}, options = {}) {
    try {
      const {
        hotelId,
        category,
        type,
        isActive,
        search,
        page = 1,
        limit = 20,
        sortBy = 'displayOrder',
        sortOrder = 'asc'
      } = filters;

      const query = { hotelId };

      if (category) query.category = category;
      if (type) query.type = type;
      if (isActive !== undefined) query.isActive = isActive;

      // Search functionality
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { label: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const customFields = await CustomField.find(query)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const total = await CustomField.countDocuments(query);

      return {
        customFields,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        }
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch custom fields', 500);
    }
  }

  /**
   * Get custom field by ID
   */
  async getCustomFieldById(fieldId, hotelId) {
    try {
      const customField = await CustomField.findOne({
        _id: fieldId,
        hotelId
      }).populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      if (!customField) {
        throw new ApplicationError('Custom field not found', 404);
      }

      return customField;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to fetch custom field', 500);
    }
  }

  /**
   * Get active fields for forms
   */
  async getActiveFields(hotelId, options = {}) {
    try {
      const fields = await CustomField.getActiveFields(hotelId, options);
      return fields;
    } catch (error) {
      throw new ApplicationError('Failed to fetch active fields', 500);
    }
  }

  /**
   * Get fields by category
   */
  async getFieldsByCategory(hotelId, category) {
    try {
      const fields = await CustomField.getFieldsByCategory(hotelId, category);
      return fields;
    } catch (error) {
      throw new ApplicationError('Failed to fetch fields by category', 500);
    }
  }

  /**
   * Get custom field statistics
   */
  async getFieldStatistics(hotelId) {
    try {
      const stats = await CustomField.getFieldStatistics(hotelId);
      return stats;
    } catch (error) {
      throw new ApplicationError('Failed to fetch field statistics', 500);
    }
  }

  /**
   * Validate field value
   */
  async validateFieldValue(fieldId, value, hotelId) {
    try {
      const field = await CustomField.findOne({
        _id: fieldId,
        hotelId
      });

      if (!field) {
        throw new ApplicationError('Custom field not found', 404);
      }

      return field.validateValue(value);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to validate field value', 500);
    }
  }

  /**
   * Get guest custom data
   */
  async getGuestCustomData(guestId, hotelId, options = {}) {
    try {
      const { category, includeInactive = false } = options;
      
      let data;
      if (category) {
        data = await GuestCustomData.getGuestDataByCategory(guestId, hotelId, category);
      } else {
        data = await GuestCustomData.getGuestCustomData(guestId, hotelId);
      }

      // Filter out inactive data if requested
      if (!includeInactive) {
        data = data.filter(item => item.isActive);
      }

      return data;
    } catch (error) {
      throw new ApplicationError('Failed to fetch guest custom data', 500);
    }
  }

  /**
   * Update guest custom data
   */
  async updateGuestCustomData(guestId, fieldId, value, updatedBy, hotelId) {
    try {
      // Validate guest exists
      const guest = await User.findById(guestId);
      if (!guest || guest.role !== 'guest') {
        throw new ApplicationError('Guest not found', 404);
      }

      // Get field for validation
      const field = await CustomField.findOne({
        _id: fieldId,
        hotelId
      });

      if (!field) {
        throw new ApplicationError('Custom field not found', 404);
      }

      // Validate value
      const validationErrors = field.validateValue(value);
      if (validationErrors.length > 0) {
        throw new ApplicationError(validationErrors.join(', '), 400);
      }

      // Update or create guest custom data
      const guestData = await GuestCustomData.findOneAndUpdate(
        {
          guestId,
          fieldId,
          hotelId
        },
        {
          value: value.toString(),
          rawValue: value,
          lastUpdatedBy: updatedBy,
          isActive: true
        },
        {
          new: true,
          upsert: true,
          runValidators: true
        }
      );

      await guestData.populate([
        { path: 'fieldId', select: 'name label type category' },
        { path: 'lastUpdatedBy', select: 'name email' }
      ]);

      return guestData;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to update guest custom data', 500);
    }
  }

  /**
   * Bulk update guest custom data
   */
  async bulkUpdateGuestCustomData(guestId, dataUpdates, updatedBy, hotelId) {
    try {
      // Validate guest exists
      const guest = await User.findById(guestId);
      if (!guest || guest.role !== 'guest') {
        throw new ApplicationError('Guest not found', 404);
      }

      // Validate all fields and values
      const fieldIds = Object.keys(dataUpdates);
      const fields = await CustomField.find({
        _id: { $in: fieldIds },
        hotelId
      });

      if (fields.length !== fieldIds.length) {
        throw new ApplicationError('One or more custom fields not found', 404);
      }

      // Validate all values
      for (const field of fields) {
        const value = dataUpdates[field._id.toString()];
        const validationErrors = field.validateValue(value);
        if (validationErrors.length > 0) {
          throw new ApplicationError(`Field ${field.label}: ${validationErrors.join(', ')}`, 400);
        }
      }

      // Perform bulk update
      const result = await GuestCustomData.bulkUpdateGuestData(
        guestId,
        hotelId,
        dataUpdates,
        updatedBy
      );

      return result;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to bulk update guest custom data', 500);
    }
  }

  /**
   * Get field usage statistics
   */
  async getFieldUsageStats(fieldId, hotelId) {
    try {
      const stats = await GuestCustomData.getFieldUsageStats(fieldId, hotelId);
      return stats;
    } catch (error) {
      throw new ApplicationError('Failed to fetch field usage statistics', 500);
    }
  }

  /**
   * Get custom data analytics
   */
  async getCustomDataAnalytics(hotelId, options = {}) {
    try {
      const analytics = await GuestCustomData.getDataAnalytics(hotelId, options);
      return analytics;
    } catch (error) {
      throw new ApplicationError('Failed to fetch custom data analytics', 500);
    }
  }

  /**
   * Export custom fields configuration
   */
  async exportCustomFields(hotelId, format = 'json') {
    try {
      const fields = await CustomField.find({ hotelId })
        .populate('createdBy', 'name email')
        .sort({ displayOrder: 1, name: 1 });

      if (format === 'csv') {
        const csvHeader = 'Name,Label,Type,Category,Required,Active,Visible,Editable,Default Value,Help Text,Group,Display Order,Created By,Created At\n';
        const csvData = fields.map(field => {
          return [
            field.name,
            field.label,
            field.type,
            field.category,
            field.isRequired ? 'Yes' : 'No',
            field.isActive ? 'Yes' : 'No',
            field.isVisible ? 'Yes' : 'No',
            field.isEditable ? 'Yes' : 'No',
            field.defaultValue || '',
            field.helpText || '',
            field.group || '',
            field.displayOrder,
            field.createdBy?.name || '',
            field.createdAt.toISOString()
          ].join(',');
        }).join('\n');

        return csvHeader + csvData;
      }

      return fields;
    } catch (error) {
      throw new ApplicationError('Failed to export custom fields', 500);
    }
  }

  /**
   * Import custom fields configuration
   */
  async importCustomFields(fieldsData, createdBy, hotelId) {
    try {
      const results = {
        created: 0,
        updated: 0,
        errors: []
      };

      for (const fieldData of fieldsData) {
        try {
          // Check if field already exists
          const existingField = await CustomField.findOne({
            name: fieldData.name,
            hotelId
          });

          if (existingField) {
            // Update existing field
            await CustomField.findByIdAndUpdate(
              existingField._id,
              { ...fieldData, updatedBy: createdBy },
              { runValidators: true }
            );
            results.updated++;
          } else {
            // Create new field
            await CustomField.create({
              ...fieldData,
              hotelId,
              createdBy
            });
            results.created++;
          }
        } catch (error) {
          results.errors.push({
            field: fieldData.name,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      throw new ApplicationError('Failed to import custom fields', 500);
    }
  }

  /**
   * Get form configuration for guest forms
   */
  async getFormConfiguration(hotelId, options = {}) {
    try {
      const { category, isVisible = true, isEditable = true } = options;
      
      const fields = await this.getActiveFields(hotelId, {
        category,
        isVisible,
        isEditable
      });

      // Group fields by category and group
      const groupedFields = {};
      
      fields.forEach(field => {
        const groupKey = field.group || 'default';
        const categoryKey = field.category;
        
        if (!groupedFields[categoryKey]) {
          groupedFields[categoryKey] = {};
        }
        
        if (!groupedFields[categoryKey][groupKey]) {
          groupedFields[categoryKey][groupKey] = [];
        }
        
        groupedFields[categoryKey][groupKey].push(field.getFormConfig());
      });

      return groupedFields;
    } catch (error) {
      throw new ApplicationError('Failed to get form configuration', 500);
    }
  }
}

export default new CustomFieldService();
