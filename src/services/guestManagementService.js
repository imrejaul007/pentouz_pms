import AccountAttribute from '../models/AccountAttribute.js';
import GuestType from '../models/GuestType.js';
import IdentificationType from '../models/IdentificationType.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

class GuestManagementService {
  // Account Attributes Management
  async createAccountAttribute(attributeData, userId) {
    try {
      const attribute = new AccountAttribute({
        ...attributeData,
        createdBy: userId
      });

      await attribute.save();

      // Log attribute creation
      await AuditLog.logAction('account_attribute_created', userId, {
        source: 'guest_management_service',
        attributeId: attribute._id,
        attributeName: attribute.name,
        category: attribute.category
      });

      return attribute;
    } catch (error) {
      console.error('Error creating account attribute:', error);
      throw error;
    }
  }

  async updateAccountAttribute(attributeId, updateData, userId) {
    try {
      const attribute = await AccountAttribute.findById(attributeId);
      if (!attribute) {
        throw new ApplicationError('Account attribute not found', 404);
      }

      Object.assign(attribute, updateData);
      attribute.updatedBy = userId;
      await attribute.save();

      // Log attribute update
      await AuditLog.logAction('account_attribute_updated', userId, {
        source: 'guest_management_service',
        attributeId: attribute._id,
        attributeName: attribute.name,
        changes: updateData
      });

      return attribute;
    } catch (error) {
      console.error('Error updating account attribute:', error);
      throw error;
    }
  }

  async getAccountAttributes(hotelId, category = null) {
    try {
      const filter = { hotelId, isActive: true };
      if (category) {
        filter.category = category;
      }

      return await AccountAttribute.find(filter)
        .sort({ category: 1, displayOrder: 1, name: 1 })
        .populate('createdBy updatedBy', 'name email');
    } catch (error) {
      console.error('Error getting account attributes:', error);
      throw error;
    }
  }

  async deleteAccountAttribute(attributeId, userId) {
    try {
      const attribute = await AccountAttribute.findById(attributeId);
      if (!attribute) {
        throw new ApplicationError('Account attribute not found', 404);
      }

      if (attribute.isSystem) {
        throw new ApplicationError('Cannot delete system-defined attributes', 400);
      }

      attribute.isActive = false;
      attribute.updatedBy = userId;
      await attribute.save();

      // Log attribute deletion
      await AuditLog.logAction('account_attribute_deleted', userId, {
        source: 'guest_management_service',
        attributeId: attribute._id,
        attributeName: attribute.name
      });

      return attribute;
    } catch (error) {
      console.error('Error deleting account attribute:', error);
      throw error;
    }
  }

  // Guest Types Management
  async createGuestType(guestTypeData, userId) {
    try {
      const guestType = new GuestType({
        ...guestTypeData,
        createdBy: userId
      });

      await guestType.save();

      // Log guest type creation
      await AuditLog.logAction('guest_type_created', userId, {
        source: 'guest_management_service',
        guestTypeId: guestType._id,
        guestTypeName: guestType.name,
        category: guestType.category
      });

      return guestType;
    } catch (error) {
      console.error('Error creating guest type:', error);
      throw error;
    }
  }

  async updateGuestType(guestTypeId, updateData, userId) {
    try {
      const guestType = await GuestType.findById(guestTypeId);
      if (!guestType) {
        throw new ApplicationError('Guest type not found', 404);
      }

      Object.assign(guestType, updateData);
      guestType.updatedBy = userId;
      await guestType.save();

      // Log guest type update
      await AuditLog.logAction('guest_type_updated', userId, {
        source: 'guest_management_service',
        guestTypeId: guestType._id,
        guestTypeName: guestType.name,
        changes: updateData
      });

      return guestType;
    } catch (error) {
      console.error('Error updating guest type:', error);
      throw error;
    }
  }

  async getGuestTypes(hotelId, category = null) {
    try {
      const filter = { hotelId, isActive: true };
      if (category) {
        filter.category = category;
      }

      return await GuestType.find(filter)
        .sort({ category: 1, displayOrder: 1, name: 1 })
        .populate('createdBy updatedBy', 'name email');
    } catch (error) {
      console.error('Error getting guest types:', error);
      throw error;
    }
  }

  async deleteGuestType(guestTypeId, userId) {
    try {
      const guestType = await GuestType.findById(guestTypeId);
      if (!guestType) {
        throw new ApplicationError('Guest type not found', 404);
      }

      // Check if guest type is in use
      const usersWithType = await User.countDocuments({ 
        guestType: guestType.code,
        hotelId: guestType.hotelId 
      });

      if (usersWithType > 0) {
        throw new ApplicationError('Cannot delete guest type that is in use', 400);
      }

      guestType.isActive = false;
      guestType.updatedBy = userId;
      await guestType.save();

      // Log guest type deletion
      await AuditLog.logAction('guest_type_deleted', userId, {
        source: 'guest_management_service',
        guestTypeId: guestType._id,
        guestTypeName: guestType.name
      });

      return guestType;
    } catch (error) {
      console.error('Error deleting guest type:', error);
      throw error;
    }
  }

  // Identification Types Management
  async createIdentificationType(identificationTypeData, userId) {
    try {
      const identificationType = new IdentificationType({
        ...identificationTypeData,
        createdBy: userId
      });

      await identificationType.save();

      // Log identification type creation
      await AuditLog.logAction('identification_type_created', userId, {
        source: 'guest_management_service',
        identificationTypeId: identificationType._id,
        identificationTypeName: identificationType.name,
        category: identificationType.category
      });

      return identificationType;
    } catch (error) {
      console.error('Error creating identification type:', error);
      throw error;
    }
  }

  async updateIdentificationType(identificationTypeId, updateData, userId) {
    try {
      const identificationType = await IdentificationType.findById(identificationTypeId);
      if (!identificationType) {
        throw new ApplicationError('Identification type not found', 404);
      }

      Object.assign(identificationType, updateData);
      identificationType.updatedBy = userId;
      await identificationType.save();

      // Log identification type update
      await AuditLog.logAction('identification_type_updated', userId, {
        source: 'guest_management_service',
        identificationTypeId: identificationType._id,
        identificationTypeName: identificationType.name,
        changes: updateData
      });

      return identificationType;
    } catch (error) {
      console.error('Error updating identification type:', error);
      throw error;
    }
  }

  async getIdentificationTypes(hotelId, category = null) {
    try {
      const filter = { hotelId, isActive: true };
      if (category) {
        filter.category = category;
      }

      return await IdentificationType.find(filter)
        .sort({ category: 1, displayOrder: 1, name: 1 })
        .populate('createdBy updatedBy', 'name email');
    } catch (error) {
      console.error('Error getting identification types:', error);
      throw error;
    }
  }

  async deleteIdentificationType(identificationTypeId, userId) {
    try {
      const identificationType = await IdentificationType.findById(identificationTypeId);
      if (!identificationType) {
        throw new ApplicationError('Identification type not found', 404);
      }

      identificationType.isActive = false;
      identificationType.updatedBy = userId;
      await identificationType.save();

      // Log identification type deletion
      await AuditLog.logAction('identification_type_deleted', userId, {
        source: 'guest_management_service',
        identificationTypeId: identificationType._id,
        identificationTypeName: identificationType.name
      });

      return identificationType;
    } catch (error) {
      console.error('Error deleting identification type:', error);
      throw error;
    }
  }

  // Validation and Utility Methods
  async validateGuestData(hotelId, guestData) {
    try {
      const [attributes, guestTypes, identificationTypes] = await Promise.all([
        AccountAttribute.getActiveAttributes(hotelId),
        GuestType.getActiveTypes(hotelId),
        IdentificationType.getActiveTypes(hotelId)
      ]);

      const errors = {};

      // Validate account attributes
      const attributeValidation = AccountAttribute.validateAttributeData(attributes, guestData);
      if (!attributeValidation.isValid) {
        Object.assign(errors, attributeValidation.errors);
      }

      // Validate guest type
      if (guestData.guestType) {
        const guestType = guestTypes.find(gt => gt.code === guestData.guestType);
        if (!guestType) {
          errors.guestType = ['Invalid guest type'];
        } else {
          const bookingErrors = guestType.validateBooking(guestData);
          if (bookingErrors.length > 0) {
            errors.guestType = bookingErrors;
          }
        }
      }

      // Validate identification types
      const identificationValidation = IdentificationType.validateIdentificationData(identificationTypes, guestData);
      if (!identificationValidation.isValid) {
        Object.assign(errors, identificationValidation.errors);
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors
      };
    } catch (error) {
      console.error('Error validating guest data:', error);
      throw error;
    }
  }

  async getGuestManagementOverview(hotelId) {
    try {
      const [attributesCount, guestTypesCount, identificationTypesCount] = await Promise.all([
        AccountAttribute.countDocuments({ hotelId, isActive: true }),
        GuestType.countDocuments({ hotelId, isActive: true }),
        IdentificationType.countDocuments({ hotelId, isActive: true })
      ]);

      const [attributesByCategory, guestTypesByCategory, identificationTypesByCategory] = await Promise.all([
        AccountAttribute.aggregate([
          { $match: { hotelId: new mongoose.Types.ObjectId(hotelId), isActive: true } },
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ]),
        GuestType.aggregate([
          { $match: { hotelId: new mongoose.Types.ObjectId(hotelId), isActive: true } },
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ]),
        IdentificationType.aggregate([
          { $match: { hotelId: new mongoose.Types.ObjectId(hotelId), isActive: true } },
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ])
      ]);

      return {
        summary: {
          totalAttributes: attributesCount,
          totalGuestTypes: guestTypesCount,
          totalIdentificationTypes: identificationTypesCount
        },
        attributesByCategory,
        guestTypesByCategory,
        identificationTypesByCategory
      };
    } catch (error) {
      console.error('Error getting guest management overview:', error);
      throw error;
    }
  }

  async duplicateGuestType(guestTypeId, newName, userId) {
    try {
      const originalGuestType = await GuestType.findById(guestTypeId);
      if (!originalGuestType) {
        throw new ApplicationError('Guest type not found', 404);
      }

      const duplicateData = originalGuestType.toObject();
      delete duplicateData._id;
      delete duplicateData.createdAt;
      delete duplicateData.updatedAt;
      delete duplicateData.__v;

      const newGuestType = new GuestType({
        ...duplicateData,
        name: newName,
        code: `${originalGuestType.code}_COPY_${Date.now()}`,
        createdBy: userId
      });

      await newGuestType.save();

      // Log guest type duplication
      await AuditLog.logAction('guest_type_duplicated', userId, {
        source: 'guest_management_service',
        originalGuestTypeId: originalGuestType._id,
        newGuestTypeId: newGuestType._id,
        newGuestTypeName: newGuestType.name
      });

      return newGuestType;
    } catch (error) {
      console.error('Error duplicating guest type:', error);
      throw error;
    }
  }

  async bulkUpdateDisplayOrder(hotelId, updates, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const results = [];

      for (const update of updates) {
        const { type, id, displayOrder } = update;
        let model, action;

        switch (type) {
          case 'attribute':
            model = AccountAttribute;
            action = 'account_attribute_display_order_updated';
            break;
          case 'guestType':
            model = GuestType;
            action = 'guest_type_display_order_updated';
            break;
          case 'identificationType':
            model = IdentificationType;
            action = 'identification_type_display_order_updated';
            break;
          default:
            throw new ApplicationError(`Invalid type: ${type}`, 400);
        }

        const item = await model.findByIdAndUpdate(
          id,
          { displayOrder, updatedBy: userId },
          { new: true, session }
        );

        if (item) {
          results.push(item);

          // Log display order update
          await AuditLog.logAction(action, userId, {
            source: 'guest_management_service',
            itemId: item._id,
            itemName: item.name,
            newDisplayOrder: displayOrder
          });
        }
      }

      await session.commitTransaction();
      return results;
    } catch (error) {
      await session.abortTransaction();
      console.error('Error bulk updating display order:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export const guestManagementService = new GuestManagementService();
