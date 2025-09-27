import express from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';

// Legacy imports for backwards compatibility
import UserPreference from '../models/UserPreference.js';
import HotelSettings from '../models/HotelSettings.js';
import User from '../models/User.js';
import { ApplicationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// ========================================
// NEW UNIFIED SETTINGS API - SPECIFIC ROUTES ONLY
// ========================================

// Get all settings or specific category - SPECIFIC CATEGORIES ONLY
router.get('/', settingsController.getSettings);
router.get('/general', settingsController.getSettings);
router.get('/security', settingsController.getSettings);
router.get('/billing', settingsController.getSettings);
router.get('/notifications', settingsController.getSettings);
router.get('/integrations', settingsController.getSettings);
router.get('/hotel-policies', settingsController.getSettings);
router.get('/system', settingsController.getSettings);

// Update settings (category or all) - SPECIFIC CATEGORIES ONLY
router.put('/', settingsController.updateSettings);
router.put('/general', settingsController.updateSettings);
router.put('/security', settingsController.updateSettings);
router.put('/billing', settingsController.updateSettings);
router.put('/notifications', settingsController.updateSettings);
router.put('/integrations', settingsController.updateSettings);
router.put('/hotel-policies', settingsController.updateSettings);
router.put('/system', settingsController.updateSettings);

// Reset settings to defaults - SPECIFIC CATEGORIES ONLY
router.post('/reset', settingsController.resetSettings);
router.post('/reset/general', settingsController.resetSettings);
router.post('/reset/security', settingsController.resetSettings);
router.post('/reset/billing', settingsController.resetSettings);
router.post('/reset/notifications', settingsController.resetSettings);
router.post('/reset/integrations', settingsController.resetSettings);
router.post('/reset/hotel-policies', settingsController.resetSettings);
router.post('/reset/system', settingsController.resetSettings);

// Export/Import settings
router.get('/export', settingsController.exportSettings);
router.post('/import', settingsController.importSettings);

// Hotel settings (Admin only)
router.get('/hotel/settings', authorize(['admin']), settingsController.getHotelSettings);
router.put('/hotel/settings', authorize(['admin']), settingsController.updateHotelSettings);
router.get('/hotel/policies', authorize(['admin']), settingsController.getHotelPolicies);
router.put('/hotel/policies', authorize(['admin']), settingsController.updateHotelPolicies);

// Notification preferences
router.get('/notifications/preferences', settingsController.getNotificationPreferences);
router.put('/notifications/preferences', settingsController.updateNotificationPreferences);

// Settings analytics (Admin only)
router.get('/analytics/stats', authorize(['admin']), settingsController.getSettingsStats);

// ========================================
// LEGACY API ROUTES (for backwards compatibility)
// ========================================

// POST /api/v1/users/profile - Update user profile (from frontend ProfileSettings)
router.put('/users/profile', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { name, email, phone, timezone, language, avatar } = req.body;

  // Update User model
  const updatedUser = await User.findByIdAndUpdate(userId, {
    name,
    email,
    phone,
    timezone,
    language,
    avatar
  }, { new: true });

  if (!updatedUser) {
    return next(new ApplicationError('User not found', 404));
  }

  // Update preferences
  await UserPreference.updatePreferences(userId, {
    'profile.timezone': timezone,
    'profile.language': language,
    'profile.avatar': avatar
  });

  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: { user: updatedUser }
  });
}));

// PUT /api/v1/users/notification-preferences - Update notification preferences
router.put('/users/notification-preferences', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const preferences = await UserPreference.updatePreferences(userId, {
    'notifications': req.body
  });

  res.status(200).json({
    status: 'success',
    message: 'Notification preferences updated successfully',
    data: { preferences }
  });
}));

// GET /api/v1/users/display-preferences - Get display preferences
router.get('/users/display-preferences', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const preferences = await UserPreference.getOrCreateForUser(userId);

  res.status(200).json({
    status: 'success',
    data: {
      preferences: preferences.display || {
        theme: 'light',
        sidebarCollapsed: false,
        compactView: false,
        highContrastMode: false,
        language: 'English',
        currency: 'Indian Rupee (₹)',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24 Hour'
      }
    }
  });
}));

// PUT /api/v1/users/display-preferences - Update display preferences
router.put('/users/display-preferences', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const preferences = await UserPreference.updatePreferences(userId, {
    'display': req.body
  });

  res.status(200).json({
    status: 'success',
    message: 'Display preferences updated successfully',
    data: { preferences }
  });
}));

// Staff-specific routes
// PUT /api/v1/staff/profile - Update staff profile
router.put('/staff/profile', authorize(['staff']), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { name, email, phone, department, employeeId, avatar } = req.body;

  // Update User model
  const updatedUser = await User.findByIdAndUpdate(userId, {
    name,
    email,
    phone,
    department,
    employeeId,
    avatar
  }, { new: true });

  // Update preferences
  await UserPreference.updatePreferences(userId, {
    'staff.department': department,
    'staff.employeeId': employeeId,
    'profile.avatar': avatar
  });

  res.status(200).json({
    status: 'success',
    message: 'Staff profile updated successfully',
    data: { user: updatedUser }
  });
}));

// PUT /api/v1/staff/notification-preferences - Update staff notification preferences
router.put('/staff/notification-preferences', authorize(['staff']), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const preferences = await UserPreference.updatePreferences(userId, {
    'notifications': req.body
  });

  res.status(200).json({
    status: 'success',
    message: 'Staff notification preferences updated successfully',
    data: { preferences }
  });
}));

// PUT /api/v1/staff/display-preferences - Update staff display preferences
router.put('/staff/display-preferences', authorize(['staff']), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const preferences = await UserPreference.updatePreferences(userId, {
    'display': req.body,
    'staff.quickActions': req.body.quickActions
  });

  res.status(200).json({
    status: 'success',
    message: 'Staff display preferences updated successfully',
    data: { preferences }
  });
}));

// PUT /api/v1/staff/availability - Update staff availability
router.put('/staff/availability', authorize(['staff']), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const preferences = await UserPreference.updatePreferences(userId, {
    'staff.availability': req.body
  });

  res.status(200).json({
    status: 'success',
    message: 'Staff availability updated successfully',
    data: { preferences }
  });
}));

// Guest-specific routes
// PUT /api/v1/guest/settings - Update guest settings (single endpoint for all guest settings)
router.put('/guest/settings', authorize(['guest', 'travel_agent']), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const {
    name, email, phone, dateOfBirth, nationality, avatar,
    roomType, floor, bedType, smoking, dietaryRestrictions,
    bookingUpdates, serviceAlerts, promotions, loyaltyUpdates, reviewRequests,
    language, preferredChannel, marketingConsent,
    dataSharing, locationTracking, analyticsTracking
  } = req.body;

  // Update User model
  const userUpdates = {
    name, email, phone, dateOfBirth, nationality, avatar, language
  };
  const updatedUser = await User.findByIdAndUpdate(userId, userUpdates, { new: true });

  // Update preferences
  const preferences = await UserPreference.updatePreferences(userId, {
    'profile.language': language,
    'profile.avatar': avatar,
    'guest.stayPreferences': {
      roomType, floor, bedType, smoking, dietaryRestrictions
    },
    'notifications.categories': {
      bookingUpdates,
      serviceAlerts,
      promotions,
      loyaltyUpdates,
      reviewRequests
    },
    'guest.communication': {
      preferredChannel,
      marketingConsent
    },
    'guest.privacy': {
      dataSharing,
      locationTracking,
      analyticsTracking
    }
  });

  res.status(200).json({
    status: 'success',
    message: 'Guest settings updated successfully',
    data: { user: updatedUser, preferences }
  });
}));

// Hotel settings routes (Admin only)
// PUT /api/v1/hotels/settings - Update hotel settings
router.put('/hotels/settings', authorize(['admin']), catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const settings = await HotelSettings.updateHotelSettings(hotelId, req.body);

  res.status(200).json({
    status: 'success',
    message: 'Hotel settings updated successfully',
    data: { settings }
  });
}));

// System settings routes (Admin only)
// PUT /api/v1/system/settings - Update system settings
router.put('/system/settings', authorize(['admin']), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const preferences = await UserPreference.updatePreferences(userId, {
    'system': req.body
  });

  res.status(200).json({
    status: 'success',
    message: 'System settings updated successfully',
    data: { preferences }
  });
}));

// Integration settings routes (Admin only)
// PUT /api/v1/integrations/settings - Update integration settings
router.put('/integrations/settings', authorize(['admin']), catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  if (!hotelId) {
    return next(new ApplicationError('User not associated with any hotel', 400));
  }

  const settings = await HotelSettings.updateHotelSettings(hotelId, {
    'integrations': req.body
  });

  res.status(200).json({
    status: 'success',
    message: 'Integration settings updated successfully',
    data: { settings }
  });
}));

export default router;