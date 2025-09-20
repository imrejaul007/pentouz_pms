import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { guestManagementService } from '../services/guestManagementService.js';
import AccountAttribute from '../models/AccountAttribute.js';
import GuestType from '../models/GuestType.js';
import IdentificationType from '../models/IdentificationType.js';

// Account Attributes Controllers
export const createAccountAttribute = catchAsync(async (req, res, next) => {
  const attribute = await guestManagementService.createAccountAttribute(
    req.body,
    req.user._id
  );

  res.status(201).json({
    status: 'success',
    data: {
      attribute
    }
  });
});

export const getAccountAttributes = catchAsync(async (req, res, next) => {
  const { category } = req.query;
  const attributes = await guestManagementService.getAccountAttributes(
    req.user.hotelId,
    category
  );

  res.status(200).json({
    status: 'success',
    results: attributes.length,
    data: {
      attributes
    }
  });
});

export const getAccountAttribute = catchAsync(async (req, res, next) => {
  const attribute = await AccountAttribute.findById(req.params.id)
    .populate('createdBy updatedBy', 'name email');

  if (!attribute) {
    return next(new ApplicationError('Account attribute not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      attribute
    }
  });
});

export const updateAccountAttribute = catchAsync(async (req, res, next) => {
  const attribute = await guestManagementService.updateAccountAttribute(
    req.params.id,
    req.body,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      attribute
    }
  });
});

export const deleteAccountAttribute = catchAsync(async (req, res, next) => {
  await guestManagementService.deleteAccountAttribute(
    req.params.id,
    req.user._id
  );

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Guest Types Controllers
export const createGuestType = catchAsync(async (req, res, next) => {
  const guestType = await guestManagementService.createGuestType(
    req.body,
    req.user._id
  );

  res.status(201).json({
    status: 'success',
    data: {
      guestType
    }
  });
});

export const getGuestTypes = catchAsync(async (req, res, next) => {
  const { category } = req.query;
  const guestTypes = await guestManagementService.getGuestTypes(
    req.user.hotelId,
    category
  );

  res.status(200).json({
    status: 'success',
    results: guestTypes.length,
    data: {
      guestTypes
    }
  });
});

export const getGuestType = catchAsync(async (req, res, next) => {
  const guestType = await GuestType.findById(req.params.id)
    .populate('createdBy updatedBy', 'name email');

  if (!guestType) {
    return next(new ApplicationError('Guest type not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      guestType
    }
  });
});

export const updateGuestType = catchAsync(async (req, res, next) => {
  const guestType = await guestManagementService.updateGuestType(
    req.params.id,
    req.body,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      guestType
    }
  });
});

export const deleteGuestType = catchAsync(async (req, res, next) => {
  await guestManagementService.deleteGuestType(
    req.params.id,
    req.user._id
  );

  res.status(204).json({
    status: 'success',
    data: null
  });
});

export const duplicateGuestType = catchAsync(async (req, res, next) => {
  const { newName } = req.body;
  
  if (!newName) {
    return next(new ApplicationError('New name is required for duplication', 400));
  }

  const guestType = await guestManagementService.duplicateGuestType(
    req.params.id,
    newName,
    req.user._id
  );

  res.status(201).json({
    status: 'success',
    data: {
      guestType
    }
  });
});

// Identification Types Controllers
export const createIdentificationType = catchAsync(async (req, res, next) => {
  const identificationType = await guestManagementService.createIdentificationType(
    req.body,
    req.user._id
  );

  res.status(201).json({
    status: 'success',
    data: {
      identificationType
    }
  });
});

export const getIdentificationTypes = catchAsync(async (req, res, next) => {
  const { category } = req.query;
  const identificationTypes = await guestManagementService.getIdentificationTypes(
    req.user.hotelId,
    category
  );

  res.status(200).json({
    status: 'success',
    results: identificationTypes.length,
    data: {
      identificationTypes
    }
  });
});

export const getIdentificationType = catchAsync(async (req, res, next) => {
  const identificationType = await IdentificationType.findById(req.params.id)
    .populate('createdBy updatedBy', 'name email');

  if (!identificationType) {
    return next(new ApplicationError('Identification type not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      identificationType
    }
  });
});

export const updateIdentificationType = catchAsync(async (req, res, next) => {
  const identificationType = await guestManagementService.updateIdentificationType(
    req.params.id,
    req.body,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      identificationType
    }
  });
});

export const deleteIdentificationType = catchAsync(async (req, res, next) => {
  await guestManagementService.deleteIdentificationType(
    req.params.id,
    req.user._id
  );

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Utility Controllers
export const validateGuestData = catchAsync(async (req, res, next) => {
  const validation = await guestManagementService.validateGuestData(
    req.user.hotelId,
    req.body
  );

  res.status(200).json({
    status: 'success',
    data: {
      validation
    }
  });
});

export const getGuestManagementOverview = catchAsync(async (req, res, next) => {
  const overview = await guestManagementService.getGuestManagementOverview(
    req.user.hotelId
  );

  res.status(200).json({
    status: 'success',
    data: {
      overview
    }
  });
});

export const bulkUpdateDisplayOrder = catchAsync(async (req, res, next) => {
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return next(new ApplicationError('Updates array is required', 400));
  }

  const results = await guestManagementService.bulkUpdateDisplayOrder(
    req.user.hotelId,
    updates,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      results
    }
  });
});

// Analytics Controllers
export const getAccountAttributeAnalytics = catchAsync(async (req, res, next) => {
  const { category, dateRange } = req.query;
  
  const pipeline = [
    { $match: { hotelId: req.user.hotelId, isActive: true } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        requiredCount: {
          $sum: { $cond: ['$isRequired', 1, 0] }
        },
        systemCount: {
          $sum: { $cond: ['$isSystem', 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ];

  if (category) {
    pipeline[0].$match.category = category;
  }

  const analytics = await AccountAttribute.aggregate(pipeline);

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

export const getGuestTypeAnalytics = catchAsync(async (req, res, next) => {
  const { category, dateRange } = req.query;
  
  const pipeline = [
    { $match: { hotelId: req.user.hotelId, isActive: true } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgDiscount: { $avg: '$benefits.discountPercentage' },
        priorityCheckinCount: {
          $sum: { $cond: ['$benefits.priorityCheckin', 1, 0] }
        },
        upgradeEligibleCount: {
          $sum: { $cond: ['$benefits.roomUpgrade', 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ];

  if (category) {
    pipeline[0].$match.category = category;
  }

  const analytics = await GuestType.aggregate(pipeline);

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

export const getIdentificationTypeAnalytics = catchAsync(async (req, res, next) => {
  const { category, dateRange } = req.query;
  
  const pipeline = [
    { $match: { hotelId: req.user.hotelId, isActive: true } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        requiredCount: {
          $sum: { $cond: ['$requirements.isRequired', 1, 0] }
        },
        expiryRequiredCount: {
          $sum: { $cond: ['$requirements.expiryRequired', 1, 0] }
        },
        photoRequiredCount: {
          $sum: { $cond: ['$requirements.photoRequired', 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ];

  if (category) {
    pipeline[0].$match.category = category;
  }

  const analytics = await IdentificationType.aggregate(pipeline);

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

export const guestManagementController = {
  // Account Attributes
  createAccountAttribute,
  getAccountAttributes,
  getAccountAttribute,
  updateAccountAttribute,
  deleteAccountAttribute,
  
  // Guest Types
  createGuestType,
  getGuestTypes,
  getGuestType,
  updateGuestType,
  deleteGuestType,
  duplicateGuestType,
  
  // Identification Types
  createIdentificationType,
  getIdentificationTypes,
  getIdentificationType,
  updateIdentificationType,
  deleteIdentificationType,
  
  // Utilities
  validateGuestData,
  getGuestManagementOverview,
  bulkUpdateDisplayOrder,
  
  // Analytics
  getAccountAttributeAnalytics,
  getGuestTypeAnalytics,
  getIdentificationTypeAnalytics
};
