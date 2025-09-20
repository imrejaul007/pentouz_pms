import userAnalyticsService from '../services/userAnalyticsService.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import mongoose from 'mongoose';

// Get comprehensive user analytics
export const getUserAnalytics = catchAsync(async (req, res) => {
  const { dateRange, groupBy } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (groupBy) options.groupBy = groupBy;

  const analytics = await userAnalyticsService.getUserAnalytics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: analytics
  });
});

// Get user activity metrics
export const getUserActivityMetrics = catchAsync(async (req, res) => {
  const { dateRange, userId } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (userId) options.userId = userId;

  const metrics = await userAnalyticsService.getUserActivityMetrics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: metrics
  });
});

// Get user performance metrics
export const getUserPerformanceMetrics = catchAsync(async (req, res) => {
  const { dateRange, userId } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (userId) options.userId = userId;

  const metrics = await userAnalyticsService.getUserPerformanceMetrics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: metrics
  });
});

// Get user segmentation
export const getUserSegmentation = catchAsync(async (req, res) => {
  const { segmentBy = 'role' } = req.query;
  
  const options = { segmentBy };
  const segmentation = await userAnalyticsService.getUserSegmentation(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: segmentation
  });
});

// Get user engagement metrics
export const getUserEngagementMetrics = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const metrics = await userAnalyticsService.getUserEngagementMetrics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: metrics
  });
});

// Get advanced user list with analytics
export const getAdvancedUserList = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    role,
    isActive,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    dateRange,
    segmentBy
  } = req.query;

  const query = {
    $or: [
      { role: 'guest' },
      { hotelId: req.user.hotelId }
    ]
  };

  // Apply filters
  if (role && role !== 'all') query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  
  if (search) {
    query.$and = [
      { $or: query.$or },
      {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }
    ];
    delete query.$or;
  }

  // Date range filter
  if (dateRange) {
    try {
      const range = JSON.parse(dateRange);
      query.createdAt = {
        $gte: new Date(range.start),
        $lte: new Date(range.end)
      };
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  // Get users with activity data
  const pipeline = [
    { $match: query },
    {
      $lookup: {
        from: 'auditlogs',
        localField: '_id',
        foreignField: 'user._id',
        as: 'activities'
      }
    },
    {
      $addFields: {
        activityCount: { $size: '$activities' },
        lastActivity: { $max: '$activities.timestamp' },
        loginCount: {
          $size: {
            $filter: {
              input: '$activities',
              cond: { $eq: ['$$this.action', 'login'] }
            }
          }
        },
        daysSinceLastActivity: {
          $cond: [
            { $gt: [{ $size: '$activities' }, 0] },
            {
              $divide: [
                { $subtract: [new Date(), { $max: '$activities.timestamp' }] },
                1000 * 60 * 60 * 24
              ]
            },
            null
          ]
        }
      }
    },
    { $sort: sort },
    { $skip: skip },
    { $limit: parseInt(limit) },
    {
      $project: {
        password: 0,
        passwordResetToken: 0,
        passwordResetExpires: 0
      }
    }
  ];

  const [users, total] = await Promise.all([
    User.aggregate(pipeline),
    User.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    results: users.length,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      limit: parseInt(limit)
    },
    data: { users }
  });
});

// Bulk user operations
export const bulkUserOperations = catchAsync(async (req, res) => {
  const { operation, userIds, data } = req.body;

  if (!operation || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new ApplicationError('Operation, userIds array, and data are required', 400);
  }

  let result;
  const validUserIds = userIds.map(id => new mongoose.Types.ObjectId(id));

  switch (operation) {
    case 'activate':
      result = await User.updateMany(
        { _id: { $in: validUserIds }, hotelId: req.user.hotelId },
        { $set: { isActive: true } }
      );
      break;

    case 'deactivate':
      result = await User.updateMany(
        { _id: { $in: validUserIds }, hotelId: req.user.hotelId },
        { $set: { isActive: false } }
      );
      break;

    case 'updateRole':
      if (!data.role) {
        throw new ApplicationError('Role is required for updateRole operation', 400);
      }
      result = await User.updateMany(
        { _id: { $in: validUserIds }, hotelId: req.user.hotelId },
        { $set: { role: data.role } }
      );
      break;

    case 'updateHotel':
      if (!data.hotelId) {
        throw new ApplicationError('Hotel ID is required for updateHotel operation', 400);
      }
      result = await User.updateMany(
        { _id: { $in: validUserIds } },
        { $set: { hotelId: new mongoose.Types.ObjectId(data.hotelId) } }
      );
      break;

    case 'delete':
      result = await User.deleteMany({
        _id: { $in: validUserIds },
        hotelId: req.user.hotelId
      });
      break;

    default:
      throw new ApplicationError('Invalid operation', 400);
  }

  res.json({
    status: 'success',
    data: {
      operation,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      deletedCount: result.deletedCount
    }
  });
});

// Import users from CSV/Excel
export const importUsers = catchAsync(async (req, res) => {
  const { usersData } = req.body;

  if (!Array.isArray(usersData) || usersData.length === 0) {
    throw new ApplicationError('Users data array is required', 400);
  }

  const results = {
    created: 0,
    updated: 0,
    errors: []
  };

  for (const userData of usersData) {
    try {
      // Validate required fields
      if (!userData.email || !userData.name) {
        results.errors.push({
          email: userData.email || 'unknown',
          error: 'Email and name are required'
        });
        continue;
      }

      // Check if user exists
      const existingUser = await User.findOne({ email: userData.email });

      if (existingUser) {
        // Update existing user
        const updateData = {
          name: userData.name,
          phone: userData.phone,
          role: userData.role || existingUser.role,
          isActive: userData.isActive !== undefined ? userData.isActive : existingUser.isActive
        };

        if (userData.role === 'staff' || userData.role === 'admin') {
          updateData.hotelId = req.user.hotelId;
        }

        await User.findByIdAndUpdate(existingUser._id, updateData);
        results.updated++;
      } else {
        // Create new user
        const newUserData = {
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          password: userData.password || 'defaultPassword123',
          role: userData.role || 'guest',
          isActive: userData.isActive !== undefined ? userData.isActive : true
        };

        if (userData.role === 'staff' || userData.role === 'admin') {
          newUserData.hotelId = req.user.hotelId;
        }

        await User.create(newUserData);
        results.created++;
      }
    } catch (error) {
      results.errors.push({
        email: userData.email,
        error: error.message
      });
    }
  }

  res.json({
    status: 'success',
    data: results
  });
});

// Export users to CSV/Excel
export const exportUsers = catchAsync(async (req, res) => {
  const { format = 'json', filters = {} } = req.query;
  
  const query = {
    $or: [
      { role: 'guest' },
      { hotelId: req.user.hotelId }
    ]
  };

  // Apply filters
  if (filters.role && filters.role !== 'all') query.role = filters.role;
  if (filters.isActive !== undefined) query.isActive = filters.isActive === 'true';

  const users = await User.find(query)
    .select('-password -passwordResetToken -passwordResetExpires')
    .populate('hotelId', 'name')
    .sort({ createdAt: -1 });

  if (format === 'csv') {
    const csvData = convertUsersToCSV(users);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.send(csvData);
  } else {
    res.json({
      status: 'success',
      results: users.length,
      data: { users }
    });
  }
});

// Get user activity timeline
export const getUserActivityTimeline = catchAsync(async (req, res) => {
  const { userId, dateRange, limit = 50 } = req.query;

  if (!userId) {
    throw new ApplicationError('User ID is required', 400);
  }

  const matchStage = {
    'user._id': new mongoose.Types.ObjectId(userId)
  };

  if (dateRange) {
    try {
      const range = JSON.parse(dateRange);
      matchStage.timestamp = {
        $gte: new Date(range.start),
        $lte: new Date(range.end)
      };
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const activities = await AuditLog.find(matchStage)
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .populate('user', 'name email role');

  res.json({
    status: 'success',
    results: activities.length,
    data: { activities }
  });
});

// Get user performance report
export const getUserPerformanceReport = catchAsync(async (req, res) => {
  const { userId, dateRange } = req.query;

  if (!userId) {
    throw new ApplicationError('User ID is required', 400);
  }

  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const [user, performanceMetrics, activityTimeline] = await Promise.all([
    User.findById(userId).select('-password'),
    userAnalyticsService.getUserPerformanceMetrics(req.user.hotelId, { ...options, userId }),
    getUserActivityTimeline(req, res)
  ]);

  if (!user) {
    throw new ApplicationError('User not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      user,
      performanceMetrics,
      activityTimeline: activityTimeline.data.activities
    }
  });
});

// Get user health monitoring
export const getUserHealthMonitoring = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const pipeline = [
    {
      $match: {
        $or: [
          { role: 'guest' },
          { hotelId: req.user.hotelId }
        ]
      }
    },
    {
      $lookup: {
        from: 'auditlogs',
        localField: '_id',
        foreignField: 'user._id',
        as: 'activities'
      }
    },
    {
      $addFields: {
        lastActivity: { $max: '$activities.timestamp' },
        daysSinceLastActivity: {
          $cond: [
            { $gt: [{ $size: '$activities' }, 0] },
            {
              $divide: [
                { $subtract: [new Date(), { $max: '$activities.timestamp' }] },
                1000 * 60 * 60 * 24
              ]
            },
            null
          ]
        },
        activityCount: { $size: '$activities' }
      }
    },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        inactiveUsers: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } },
        usersWithNoActivity: { $sum: { $cond: [{ $eq: ['$activityCount', 0] }, 1, 0] } },
        usersWithOldActivity: { $sum: { $cond: [{ $gt: ['$daysSinceLastActivity', 30] }, 1, 0] } },
        usersWithRecentActivity: { $sum: { $cond: [{ $lt: ['$daysSinceLastActivity', 7] }, 1, 0] } },
        healthIssues: {
          $push: {
            $cond: [
              {
                $or: [
                  { $eq: ['$isActive', false] },
                  { $eq: ['$activityCount', 0] },
                  { $gt: ['$daysSinceLastActivity', 30] }
                ]
              },
              {
                userId: '$_id',
                name: '$name',
                email: '$email',
                role: '$role',
                isActive: '$isActive',
                activityCount: '$activityCount',
                daysSinceLastActivity: '$daysSinceLastActivity',
                lastActivity: '$lastActivity'
              },
              null
            ]
          }
        }
      }
    }
  ];

  const result = await User.aggregate(pipeline);
  const healthData = result[0] || {
    totalUsers: 0,
    inactiveUsers: 0,
    usersWithNoActivity: 0,
    usersWithOldActivity: 0,
    usersWithRecentActivity: 0,
    healthIssues: []
  };

  // Filter out null values from health issues
  healthData.healthIssues = healthData.healthIssues.filter(issue => issue !== null);

  res.json({
    status: 'success',
    data: healthData
  });
});

// Helper function to convert users to CSV
function convertUsersToCSV(users) {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'Role',
    'Hotel',
    'Active',
    'Created At',
    'Last Login'
  ];
  
  const rows = users.map(user => [
    user.name,
    user.email,
    user.phone || '',
    user.role,
    user.hotelId?.name || '',
    user.isActive ? 'Yes' : 'No',
    user.createdAt.toISOString(),
    user.lastLogin ? user.lastLogin.toISOString() : ''
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

export default {
  getUserAnalytics,
  getUserActivityMetrics,
  getUserPerformanceMetrics,
  getUserSegmentation,
  getUserEngagementMetrics,
  getAdvancedUserList,
  bulkUserOperations,
  importUsers,
  exportUsers,
  getUserActivityTimeline,
  getUserPerformanceReport,
  getUserHealthMonitoring
};
