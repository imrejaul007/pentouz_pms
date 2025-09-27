import UserSettings from '../models/UserSettings.js';
import User from '../models/User.js';
import { AppError } from '../utils/appError.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';

// Get user settings
export const getSettings = catchAsync(async (req, res, next) => {
  const { category } = req.params;
  const userId = req.user._id;

  let settings = await UserSettings.findOne({ userId }).populate('userId', 'name email role');

  // Create default settings if none exist
  if (!settings) {
    settings = await UserSettings.createDefaultSettings(userId, req.user.role);
  }

  // Return specific category or all settings
  const responseData = category ? settings.getSettingsByCategory(category) : settings;

  res.status(200).json({
    status: 'success',
    data: {
      settings: responseData,
      lastModified: settings.lastModified,
      version: settings.version
    }
  });
});

// Update settings (category or all)
export const updateSettings = catchAsync(async (req, res, next) => {
  const { category } = req.params;
  const userId = req.user._id;
  const updateData = req.body;

  let settings = await UserSettings.findOne({ userId });

  // Create default settings if none exist
  if (!settings) {
    settings = await UserSettings.createDefaultSettings(userId, req.user.role);
  }

  // Validate role-based permissions
  if (!validateRolePermissions(req.user.role, category, updateData)) {
    return next(new AppError('Insufficient permissions to update these settings', 403));
  }

  // Update specific category or merge all settings
  if (category) {
    settings.updateCategory(category, updateData);
  } else {
    Object.keys(updateData).forEach(key => {
      if (settings.schema.paths[key]) {
        settings[key] = { ...settings[key]?.toObject?.() || settings[key], ...updateData[key] };
      }
    });
    settings.lastModified = new Date();
    settings.version += 1;
  }

  await settings.save();

  // Log the settings update
  logger.info(`Settings updated for user ${userId}`, {
    userId,
    category: category || 'all',
    role: req.user.role,
    changes: Object.keys(updateData)
  });

  res.status(200).json({
    status: 'success',
    data: {
      settings: category ? settings.getSettingsByCategory(category) : settings,
      lastModified: settings.lastModified,
      version: settings.version
    }
  });
});

// Reset settings to defaults
export const resetSettings = catchAsync(async (req, res, next) => {
  const { category } = req.params;
  const userId = req.user._id;

  let settings = await UserSettings.findOne({ userId });

  if (!settings) {
    return next(new AppError('Settings not found', 404));
  }

  const defaultSettings = UserSettings.getDefaultSettings(req.user.role);

  if (category) {
    // Reset specific category
    if (!defaultSettings[category]) {
      return next(new AppError(`Invalid settings category: ${category}`, 400));
    }
    settings[category] = defaultSettings[category];
  } else {
    // Reset all settings
    Object.keys(defaultSettings).forEach(key => {
      settings[key] = defaultSettings[key];
    });
  }

  settings.lastModified = new Date();
  settings.version += 1;

  await settings.save();

  logger.info(`Settings reset for user ${userId}`, {
    userId,
    category: category || 'all',
    role: req.user.role
  });

  res.status(200).json({
    status: 'success',
    data: {
      settings: category ? settings.getSettingsByCategory(category) : settings,
      message: `Settings ${category ? `for ${category}` : ''} reset to defaults`
    }
  });
});

// Export settings
export const exportSettings = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { format = 'json' } = req.query;

  const settings = await UserSettings.findOne({ userId }).populate('userId', 'name email role');

  if (!settings) {
    return next(new AppError('Settings not found', 404));
  }

  // Remove sensitive data
  const exportData = settings.toObject();
  delete exportData.system?.apiKeys;
  delete exportData.integrations?.payment;

  if (format === 'json') {
    res.status(200).json({
      status: 'success',
      data: {
        settings: exportData,
        exportedAt: new Date(),
        version: settings.version
      }
    });
  } else if (format === 'csv') {
    // Convert settings to CSV format
    const csvData = convertSettingsToCSV(exportData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=settings-${userId}-${Date.now()}.csv`);
    res.status(200).send(csvData);
  } else {
    return next(new AppError('Invalid export format. Use json or csv', 400));
  }
});

// Import settings
export const importSettings = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const importData = req.body;

  // Validate import data
  if (!importData || typeof importData !== 'object') {
    return next(new AppError('Invalid import data', 400));
  }

  let settings = await UserSettings.findOne({ userId });

  if (!settings) {
    settings = new UserSettings({
      userId,
      role: req.user.role,
      ...importData
    });
  } else {
    // Merge imported settings with existing ones
    Object.keys(importData).forEach(key => {
      if (settings.schema.paths[key] && validateRolePermissions(req.user.role, key, importData[key])) {
        settings[key] = { ...settings[key]?.toObject?.() || settings[key], ...importData[key] };
      }
    });
  }

  settings.lastModified = new Date();
  settings.version += 1;

  await settings.save();

  logger.info(`Settings imported for user ${userId}`, {
    userId,
    role: req.user.role,
    importedKeys: Object.keys(importData)
  });

  res.status(200).json({
    status: 'success',
    data: {
      settings,
      message: 'Settings imported successfully'
    }
  });
});

// Get hotel settings (Admin only)
export const getHotelSettings = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('Only admins can access hotel settings', 403));
  }

  const userId = req.user._id;
  let settings = await UserSettings.findOne({ userId });

  if (!settings || !settings.hotel) {
    return next(new AppError('Hotel settings not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      hotel: settings.hotel,
      lastModified: settings.lastModified
    }
  });
});

// Update hotel settings (Admin only)
export const updateHotelSettings = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('Only admins can update hotel settings', 403));
  }

  const userId = req.user._id;
  const hotelData = req.body;

  let settings = await UserSettings.findOne({ userId });

  if (!settings) {
    settings = await UserSettings.createDefaultSettings(userId, 'admin');
  }

  settings.hotel = { ...settings.hotel?.toObject?.() || settings.hotel, ...hotelData };
  settings.lastModified = new Date();
  settings.version += 1;

  await settings.save();

  logger.info(`Hotel settings updated by admin ${userId}`, {
    userId,
    changes: Object.keys(hotelData)
  });

  res.status(200).json({
    status: 'success',
    data: {
      hotel: settings.hotel,
      message: 'Hotel settings updated successfully'
    }
  });
});

// Get hotel policies (Admin only)
export const getHotelPolicies = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('Only admins can access hotel policies', 403));
  }

  const userId = req.user._id;
  const settings = await UserSettings.findOne({ userId });

  if (!settings || !settings.hotel?.policies) {
    return next(new AppError('Hotel policies not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      policies: settings.hotel.policies,
      lastModified: settings.lastModified
    }
  });
});

// Update hotel policies (Admin only)
export const updateHotelPolicies = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('Only admins can update hotel policies', 403));
  }

  const userId = req.user._id;
  const policyData = req.body;

  let settings = await UserSettings.findOne({ userId });

  if (!settings) {
    settings = await UserSettings.createDefaultSettings(userId, 'admin');
  }

  if (!settings.hotel) {
    settings.hotel = {};
  }

  settings.hotel.policies = { ...settings.hotel.policies?.toObject?.() || settings.hotel.policies, ...policyData };
  settings.lastModified = new Date();
  settings.version += 1;

  await settings.save();

  logger.info(`Hotel policies updated by admin ${userId}`, {
    userId,
    changes: Object.keys(policyData)
  });

  res.status(200).json({
    status: 'success',
    data: {
      policies: settings.hotel.policies,
      message: 'Hotel policies updated successfully'
    }
  });
});

// Get user's notification preferences
export const getNotificationPreferences = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  let settings = await UserSettings.findOne({ userId });

  if (!settings) {
    settings = await UserSettings.createDefaultSettings(userId, req.user.role);
  }

  res.status(200).json({
    status: 'success',
    data: {
      preferences: settings.notifications,
      role: req.user.role,
      lastModified: settings.lastModified
    }
  });
});

// Update notification preferences
export const updateNotificationPreferences = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const preferences = req.body;

  let settings = await UserSettings.findOne({ userId });

  if (!settings) {
    settings = await UserSettings.createDefaultSettings(userId, req.user.role);
  }

  settings.notifications = { ...settings.notifications?.toObject?.() || settings.notifications, ...preferences };
  settings.lastModified = new Date();
  settings.version += 1;

  await settings.save();

  logger.info(`Notification preferences updated for user ${userId}`, {
    userId,
    role: req.user.role,
    changes: Object.keys(preferences)
  });

  res.status(200).json({
    status: 'success',
    data: {
      preferences: settings.notifications,
      message: 'Notification preferences updated successfully'
    }
  });
});

// Get settings statistics (Admin only)
export const getSettingsStats = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('Only admins can access settings statistics', 403));
  }

  const stats = await UserSettings.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        avgVersion: { $avg: '$version' },
        lastModified: { $max: '$lastModified' }
      }
    },
    {
      $project: {
        role: '$_id',
        count: 1,
        avgVersion: { $round: ['$avgVersion', 2] },
        lastModified: 1,
        _id: 0
      }
    }
  ]);

  const totalUsers = await UserSettings.countDocuments();

  res.status(200).json({
    status: 'success',
    data: {
      totalUsers,
      roleBreakdown: stats,
      generatedAt: new Date()
    }
  });
});

// Utility Functions
function validateRolePermissions(role, category, data) {
  const permissions = {
    admin: ['profile', 'hotel', 'notifications', 'display', 'system', 'integrations'],
    staff: ['profile', 'notifications', 'display', 'availability'],
    guest: ['profile', 'notifications', 'display', 'communication', 'privacy'],
    travel_agent: ['profile', 'notifications', 'display', 'communication', 'travelAgent']
  };

  if (category && !permissions[role]?.includes(category)) {
    return false;
  }

  // Additional validation for sensitive data
  if (category === 'system' && role !== 'admin') {
    return false;
  }

  if (category === 'integrations' && role !== 'admin') {
    return false;
  }

  if (category === 'hotel' && role !== 'admin') {
    return false;
  }

  return true;
}

function convertSettingsToCSV(settings) {
  const flattenObject = (obj, prefix = '') => {
    const flattened = {};
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(flattened, flattenObject(obj[key], `${prefix}${key}.`));
      } else {
        flattened[`${prefix}${key}`] = Array.isArray(obj[key]) ? obj[key].join(';') : obj[key];
      }
    }
    return flattened;
  };

  const flattened = flattenObject(settings);
  const headers = Object.keys(flattened).join(',');
  const values = Object.values(flattened).map(val =>
    typeof val === 'string' && val.includes(',') ? `"${val}"` : val
  ).join(',');

  return `${headers}\n${values}`;
}