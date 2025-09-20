import GuestCRMProfile from '../models/GuestCRMProfile.js';
import GuestBehavior from '../models/GuestBehavior.js';
import crmAutomationService from '../services/crmAutomationService.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/appError.js';

export const getGuestProfile = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const hotelId = req.user.hotelId;

  const profile = await GuestCRMProfile.findOne({ userId, hotelId })
    .populate('userId', 'firstName lastName email phone')
    .populate('hotelId', 'name');

  if (!profile) {
    return next(new AppError('Guest profile not found', 404));
  }

  res.status(200).json({
    success: true,
    data: { profile }
  });
});

export const getGuestInsights = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const hotelId = req.user.hotelId;

  const insights = await crmAutomationService.getGuestInsights(userId, hotelId);

  if (!insights) {
    return next(new AppError('Guest insights not found', 404));
  }

  res.status(200).json({
    success: true,
    data: insights
  });
});

export const updateGuestProfile = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const hotelId = req.user.hotelId;

  const profile = await crmAutomationService.createOrUpdateGuestProfile(userId, hotelId, req.body);

  res.status(200).json({
    success: true,
    data: { profile }
  });
});

export const getGuestBehaviorAnalytics = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { timeRange = 30 } = req.query;

  const analytics = await GuestBehavior.getBehaviorAnalytics(userId, parseInt(timeRange));

  res.status(200).json({
    success: true,
    data: { analytics }
  });
});

export const trackGuestBehavior = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const hotelId = req.user.hotelId;

  const behavior = await crmAutomationService.trackBehavior(userId, hotelId, req.body);

  res.status(201).json({
    success: true,
    data: { behavior }
  });
});

export const getSegmentedGuests = catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const {
    segment,
    lifecycleStage,
    minLoyaltyScore,
    maxLoyaltyScore,
    page = 1,
    limit = 50
  } = req.query;

  const filter = { hotelId };

  if (segment) filter['rfmAnalysis.segment'] = segment;
  if (lifecycleStage) filter.lifecycleStage = lifecycleStage;
  if (minLoyaltyScore) filter['loyaltyMetrics.score'] = { $gte: parseInt(minLoyaltyScore) };
  if (maxLoyaltyScore) {
    filter['loyaltyMetrics.score'] = {
      ...filter['loyaltyMetrics.score'],
      $lte: parseInt(maxLoyaltyScore)
    };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [profiles, total] = await Promise.all([
    GuestCRMProfile.find(filter)
      .populate('userId', 'firstName lastName email phone')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ 'loyaltyMetrics.score': -1 }),
    GuestCRMProfile.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: {
      profiles,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalResults: total,
        limit: parseInt(limit)
      }
    }
  });
});

export const getCRMAnalytics = catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;

  // Get segment distribution
  const segmentStats = await GuestCRMProfile.aggregate([
    { $match: { hotelId } },
    {
      $group: {
        _id: '$rfmAnalysis.segment',
        count: { $sum: 1 },
        avgLoyaltyScore: { $avg: '$loyaltyMetrics.score' },
        totalSpending: { $sum: '$engagementMetrics.totalSpending' }
      }
    }
  ]);

  // Get lifecycle stage distribution
  const lifecycleStats = await GuestCRMProfile.aggregate([
    { $match: { hotelId } },
    {
      $group: {
        _id: '$lifecycleStage',
        count: { $sum: 1 },
        avgBookings: { $avg: '$engagementMetrics.totalBookings' }
      }
    }
  ]);

  // Get top customers
  const topCustomers = await GuestCRMProfile.find({ hotelId })
    .populate('userId', 'firstName lastName email')
    .sort({ 'engagementMetrics.totalSpending': -1 })
    .limit(10);

  // Get recent activity
  const recentActivity = await GuestBehavior.find({ hotelId })
    .populate('userId', 'firstName lastName')
    .sort({ timestamp: -1 })
    .limit(20);

  // Calculate overall metrics
  const overallMetrics = await GuestCRMProfile.aggregate([
    { $match: { hotelId } },
    {
      $group: {
        _id: null,
        totalGuests: { $sum: 1 },
        totalRevenue: { $sum: '$engagementMetrics.totalSpending' },
        avgLoyaltyScore: { $avg: '$loyaltyMetrics.score' },
        totalBookings: { $sum: '$engagementMetrics.totalBookings' }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      overallMetrics: overallMetrics[0] || {},
      segmentDistribution: segmentStats,
      lifecycleDistribution: lifecycleStats,
      topCustomers,
      recentActivity
    }
  });
});

export const refreshGuestMetrics = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const hotelId = req.user.hotelId;

  const profile = await GuestCRMProfile.findOne({ userId, hotelId });
  if (!profile) {
    return next(new AppError('Guest profile not found', 404));
  }

  await crmAutomationService.updateGuestMetrics(profile);
  await profile.save();

  res.status(200).json({
    success: true,
    data: { profile }
  });
});

export const bulkUpdateMetrics = catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;

  const profiles = await GuestCRMProfile.find({ hotelId });

  let updated = 0;
  for (const profile of profiles) {
    try {
      await crmAutomationService.updateGuestMetrics(profile);
      await profile.save();
      updated++;
    } catch (error) {
      console.error(`Error updating profile ${profile._id}:`, error);
    }
  }

  res.status(200).json({
    success: true,
    data: {
      message: `Updated ${updated} out of ${profiles.length} profiles`,
      totalProfiles: profiles.length,
      updatedProfiles: updated
    }
  });
});

export const getPersonalizationData = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const hotelId = req.user.hotelId;

  const profile = await GuestCRMProfile.findOne({ userId, hotelId });
  if (!profile) {
    return next(new AppError('Guest profile not found', 404));
  }

  // Get recent behaviors for personalization
  const recentBehaviors = await GuestBehavior.find({
    userId,
    hotelId,
    timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  }).sort({ timestamp: -1 }).limit(50);

  // Extract personalization insights
  const roomTypePreferences = {};
  const timePreferences = {};
  const deviceUsage = {};

  recentBehaviors.forEach(behavior => {
    if (behavior.interactionData.roomType) {
      roomTypePreferences[behavior.interactionData.roomType] =
        (roomTypePreferences[behavior.interactionData.roomType] || 0) + 1;
    }

    const hour = behavior.timestamp.getHours();
    timePreferences[hour] = (timePreferences[hour] || 0) + 1;

    deviceUsage[behavior.deviceType] = (deviceUsage[behavior.deviceType] || 0) + 1;
  });

  const personalizationData = {
    profile: {
      segment: profile.rfmAnalysis.segment,
      lifecycleStage: profile.lifecycleStage,
      loyaltyScore: profile.loyaltyMetrics.score,
      preferences: profile.preferences
    },
    insights: {
      preferredRoomTypes: Object.entries(roomTypePreferences)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3),
      activeHours: Object.entries(timePreferences)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3),
      preferredDevice: Object.entries(deviceUsage)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'desktop'
    },
    recommendations: {
      nextBestAction: await crmAutomationService.getNextBestAction(profile),
      predictedValue: await crmAutomationService.getPredictedLifetimeValue(profile),
      communicationChannel: profile.communicationPreferences.email ? 'email' : 'sms',
      optimalContactTime: Object.entries(timePreferences)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 12
    }
  };

  res.status(200).json({
    success: true,
    data: personalizationData
  });
});

export default {
  getGuestProfile,
  getGuestInsights,
  updateGuestProfile,
  getGuestBehaviorAnalytics,
  trackGuestBehavior,
  getSegmentedGuests,
  getCRMAnalytics,
  refreshGuestMetrics,
  bulkUpdateMetrics,
  getPersonalizationData
};