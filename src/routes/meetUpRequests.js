import express from 'express';
import MeetUpRequest from '../models/MeetUpRequest.js';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import ServiceBooking from '../models/ServiceBooking.js';
import { authenticate } from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Get all meet-up requests for the authenticated user
router.get('/', catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status, type, filter } = req.query;
  const skip = (page - 1) * limit;
  
  let query = {
    $or: [
      { requesterId: req.user._id },
      { targetUserId: req.user._id },
      { 'participants.confirmedParticipants.userId': req.user._id }
    ]
  };
  
  if (status) query.status = status;
  if (type) query.type = type;
  
  // Filter by role (sent vs received)
  if (filter === 'sent') {
    query = { requesterId: req.user._id };
  } else if (filter === 'received') {
    query = { targetUserId: req.user._id };
  } else if (filter === 'participating') {
    query = { 'participants.confirmedParticipants.userId': req.user._id };
  }
  
  const meetUps = await MeetUpRequest.find(query)
    .populate('requesterId', 'name email avatar')
    .populate('targetUserId', 'name email avatar')
    .populate('hotelId', 'name address')
    .populate('meetingRoomBooking.roomId', 'number type')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await MeetUpRequest.countDocuments(query);
  
  res.json({
    success: true,
    data: {
      meetUps,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + meetUps.length < total,
        hasPrev: page > 1
      }
    }
  });
}));

// Get pending requests (requests sent to the user)
router.get('/pending', catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  
  const pendingRequests = await MeetUpRequest.getPendingRequests(req.user._id)
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await MeetUpRequest.countDocuments({
    targetUserId: req.user._id,
    status: 'pending'
  });
  
  res.json({
    success: true,
    data: {
      pendingRequests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + pendingRequests.length < total,
        hasPrev: page > 1
      }
    }
  });
}));

// Get upcoming meet-ups
router.get('/upcoming', catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  
  const upcomingMeetUps = await MeetUpRequest.getUpcomingMeetUps(req.user._id)
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await MeetUpRequest.countDocuments({
    $or: [
      { requesterId: req.user._id },
      { targetUserId: req.user._id },
      { 'participants.confirmedParticipants.userId': req.user._id }
    ],
    status: 'accepted',
    proposedDate: { $gt: new Date() }
  });
  
  res.json({
    success: true,
    data: {
      upcomingMeetUps,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + upcomingMeetUps.length < total,
        hasPrev: page > 1
      }
    }
  });
}));

// Create a new meet-up request
router.post('/', validate(schemas.createMeetUpRequest), catchAsync(async (req, res) => {
  const {
    targetUserId,
    hotelId,
    type,
    title,
    description,
    proposedDate,
    proposedTime,
    location,
    meetingRoomBooking,
    participants,
    preferences,
    communication,
    activity,
    safety,
    metadata
  } = req.body;
  
  // Verify target user exists
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new ApplicationError('Target user not found', 404);
  }
  
  // Verify hotel exists
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) {
    throw new ApplicationError('Hotel not found', 404);
  }
  
  // Check if meeting room booking is required and valid
  if (meetingRoomBooking && meetingRoomBooking.isRequired) {
    if (!meetingRoomBooking.roomId) {
      throw new ApplicationError('Meeting room is required', 400);
    }
    
    const room = await Room.findById(meetingRoomBooking.roomId);
    if (!room) {
      throw new ApplicationError('Meeting room not found', 404);
    }
  }
  
  // Check if user is trying to meet with themselves
  if (targetUserId === req.user._id) {
    throw new ApplicationError('Cannot create meet-up request with yourself', 400);
  }
  
  // Check if there's already a pending request between these users
  const existingRequest = await MeetUpRequest.findOne({
    $or: [
      { requesterId: req.user._id, targetUserId },
      { requesterId: targetUserId, targetUserId: req.user._id }
    ],
    status: 'pending'
  });
  
  if (existingRequest) {
    throw new ApplicationError('A pending meet-up request already exists between these users', 400);
  }
  
  const meetUpRequest = new MeetUpRequest({
    requesterId: req.user._id,
    targetUserId,
    hotelId,
    type,
    title,
    description,
    proposedDate: new Date(proposedDate),
    proposedTime,
    location,
    meetingRoomBooking,
    participants: {
      maxParticipants: participants?.maxParticipants || 2,
      confirmedParticipants: []
    },
    preferences,
    communication,
    activity,
    safety,
    metadata
  });
  
  await meetUpRequest.save();
  
  // Populate references for response
  await meetUpRequest.populate([
    { path: 'requesterId', select: 'name email avatar' },
    { path: 'targetUserId', select: 'name email avatar' },
    { path: 'hotelId', select: 'name address' },
    { path: 'meetingRoomBooking.roomId', select: 'number type' }
  ]);
  
  res.status(201).json({
    success: true,
    message: 'Meet-up request created successfully',
    data: meetUpRequest
  });
}));

// Get a specific meet-up request
router.get('/:requestId', catchAsync(async (req, res) => {
  const meetUpRequest = await MeetUpRequest.findOne({
    _id: req.params.requestId,
    $or: [
      { requesterId: req.user._id },
      { targetUserId: req.user._id },
      { 'participants.confirmedParticipants.userId': req.user._id }
    ]
  })
  .populate('requesterId', 'name email avatar')
  .populate('targetUserId', 'name email avatar')
  .populate('hotelId', 'name address')
  .populate('meetingRoomBooking.roomId', 'number type')
  .populate('participants.confirmedParticipants.userId', 'name email avatar');
  
  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found', 404);
  }
  
  res.json({
    success: true,
    data: meetUpRequest
  });
}));

// Accept a meet-up request
router.post('/:requestId/accept', validate(schemas.respondToMeetUpRequest), catchAsync(async (req, res) => {
  const { message } = req.body;
  
  const meetUpRequest = await MeetUpRequest.findOne({
    _id: req.params.requestId,
    targetUserId: req.user._id,
    status: 'pending'
  });
  
  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot be accepted', 404);
  }
  
  await meetUpRequest.acceptRequest(message);
  
  // Populate references for response
  await meetUpRequest.populate([
    { path: 'requesterId', select: 'name email avatar' },
    { path: 'targetUserId', select: 'name email avatar' },
    { path: 'hotelId', select: 'name address' }
  ]);
  
  res.json({
    success: true,
    message: 'Meet-up request accepted successfully',
    data: meetUpRequest
  });
}));

// Decline a meet-up request
router.post('/:requestId/decline', validate(schemas.respondToMeetUpRequest), catchAsync(async (req, res) => {
  const { message } = req.body;
  
  const meetUpRequest = await MeetUpRequest.findOne({
    _id: req.params.requestId,
    targetUserId: req.user._id,
    status: 'pending'
  });
  
  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot be declined', 404);
  }
  
  await meetUpRequest.declineRequest(message);
  
  // Populate references for response
  await meetUpRequest.populate([
    { path: 'requesterId', select: 'name email avatar' },
    { path: 'targetUserId', select: 'name email avatar' },
    { path: 'hotelId', select: 'name address' }
  ]);
  
  res.json({
    success: true,
    message: 'Meet-up request declined successfully',
    data: meetUpRequest
  });
}));

// Cancel a meet-up request
router.post('/:requestId/cancel', catchAsync(async (req, res) => {
  const meetUpRequest = await MeetUpRequest.findOne({
    _id: req.params.requestId,
    requesterId: req.user._id,
    status: { $in: ['pending', 'accepted'] }
  });
  
  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot be cancelled', 404);
  }
  
  await meetUpRequest.cancelRequest();
  
  res.json({
    success: true,
    message: 'Meet-up request cancelled successfully'
  });
}));

// Complete a meet-up request
router.post('/:requestId/complete', catchAsync(async (req, res) => {
  const meetUpRequest = await MeetUpRequest.findOne({
    _id: req.params.requestId,
    $or: [
      { requesterId: req.user._id },
      { targetUserId: req.user._id }
    ],
    status: 'accepted'
  });
  
  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot be completed', 404);
  }
  
  await meetUpRequest.completeRequest();
  
  res.json({
    success: true,
    message: 'Meet-up request marked as completed'
  });
}));

// Add participant to a meet-up
router.post('/:requestId/participants', validate(schemas.addParticipant), catchAsync(async (req, res) => {
  const { userId, name, email } = req.body;
  
  const meetUpRequest = await MeetUpRequest.findOne({
    _id: req.params.requestId,
    $or: [
      { requesterId: req.user._id },
      { targetUserId: req.user._id }
    ],
    status: 'accepted'
  });
  
  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot add participants', 404);
  }
  
  await meetUpRequest.addParticipant(userId, name, email);
  
  res.json({
    success: true,
    message: 'Participant added successfully'
  });
}));

// Remove participant from a meet-up
router.delete('/:requestId/participants/:userId', catchAsync(async (req, res) => {
  const meetUpRequest = await MeetUpRequest.findOne({
    _id: req.params.requestId,
    $or: [
      { requesterId: req.user._id },
      { targetUserId: req.user._id }
    ],
    status: 'accepted'
  });
  
  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot remove participants', 404);
  }
  
  await meetUpRequest.removeParticipant(req.params.userId);
  
  res.json({
    success: true,
    message: 'Participant removed successfully'
  });
}));

// Suggest alternative time/date
router.post('/:requestId/suggest-alternative', validate(schemas.suggestAlternative), catchAsync(async (req, res) => {
  const { date, time } = req.body;
  
  const meetUpRequest = await MeetUpRequest.findOne({
    _id: req.params.requestId,
    targetUserId: req.user._id,
    status: 'pending'
  });
  
  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot suggest alternative', 404);
  }
  
  await meetUpRequest.suggestAlternative(new Date(date), time);
  
  res.json({
    success: true,
    message: 'Alternative time suggested successfully'
  });
}));

// Search for potential meet-up partners
router.get('/search/partners', catchAsync(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    interests, 
    languages, 
    ageGroup, 
    gender,
    hotelId 
  } = req.query;
  const skip = (page - 1) * limit;
  
  let query = {
    _id: { $ne: req.user._id }, // Exclude current user
    role: 'guest'
  };
  
  if (hotelId) {
    // Find users who have bookings at this hotel
    query.hotelId = hotelId;
  }
  
  if (interests) {
    query.interests = { $in: interests.split(',') };
  }
  
  if (languages) {
    query.languages = { $in: languages.split(',') };
  }
  
  if (ageGroup && ageGroup !== 'any') {
    query.ageGroup = ageGroup;
  }
  
  if (gender && gender !== 'any') {
    query.gender = gender;
  }
  
  const users = await User.find(query)
    .select('name email avatar interests languages ageGroup gender')
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await User.countDocuments(query);
  
  res.json({
    success: true,
    data: {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + users.length < total,
        hasPrev: page > 1
      }
    }
  });
}));

// Get meet-up statistics
router.get('/stats/overview', catchAsync(async (req, res) => {
  const stats = await MeetUpRequest.getMeetUpStats(req.user._id);
  
  const [
    totalRequests,
    pendingRequests,
    acceptedRequests,
    completedRequests,
    upcomingMeetUps
  ] = await Promise.all([
    MeetUpRequest.countDocuments({
      $or: [
        { requesterId: req.user._id },
        { targetUserId: req.user._id }
      ]
    }),
    MeetUpRequest.countDocuments({
      targetUserId: req.user._id,
      status: 'pending'
    }),
    MeetUpRequest.countDocuments({
      $or: [
        { requesterId: req.user._id },
        { targetUserId: req.user._id }
      ],
      status: 'accepted'
    }),
    MeetUpRequest.countDocuments({
      $or: [
        { requesterId: req.user._id },
        { targetUserId: req.user._id }
      ],
      status: 'completed'
    }),
    MeetUpRequest.countDocuments({
      $or: [
        { requesterId: req.user._id },
        { targetUserId: req.user._id }
      ],
      status: 'accepted',
      proposedDate: { $gt: new Date() }
    })
  ]);
  
  res.json({
    success: true,
    data: {
      totalRequests,
      pendingRequests,
      acceptedRequests,
      completedRequests,
      upcomingMeetUps,
      statusBreakdown: stats
    }
  });
}));

// ============= ADMIN ROUTES =============
// Admin: Get all meet-up requests across the system
router.get('/admin/all', adminAuth, catchAsync(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    status, 
    type, 
    hotelId,
    dateFrom,
    dateTo,
    search
  } = req.query;
  const skip = (page - 1) * limit;
  
  let query = {};
  
  // Filter by status
  if (status && status !== 'all') query.status = status;
  
  // Filter by type
  if (type && type !== 'all') query.type = type;
  
  // Filter by hotel
  if (hotelId && hotelId !== 'all') query.hotelId = hotelId;
  
  // Filter by date range
  if (dateFrom || dateTo) {
    query.proposedDate = {};
    if (dateFrom) query.proposedDate.$gte = new Date(dateFrom);
    if (dateTo) query.proposedDate.$lte = new Date(dateTo);
  }
  
  // Search in title, description, or user names
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  const meetUps = await MeetUpRequest.find(query)
    .populate('requesterId', 'name email avatar role')
    .populate('targetUserId', 'name email avatar role')
    .populate('hotelId', 'name address')
    .populate('meetingRoomBooking.roomId', 'number type')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await MeetUpRequest.countDocuments(query);
  
  res.json({
    success: true,
    data: {
      meetUps,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + meetUps.length < total,
        hasPrev: page > 1
      }
    }
  });
}));

// Admin: Get comprehensive analytics
router.get('/admin/analytics', adminAuth, catchAsync(async (req, res) => {
  const { period = '30d', hotelId } = req.query;
  
  // Calculate date range based on period
  const periodMap = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '365d': 365
  };
  
  const days = periodMap[period] || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  let baseQuery = { createdAt: { $gte: startDate } };
  if (hotelId && hotelId !== 'all') {
    baseQuery.hotelId = hotelId;
  }
  
  // Parallel execution of analytics queries
  const [
    totalRequests,
    statusStats,
    typeStats,
    hotelStats,
    dailyTrends,
    topUsers,
    responseTimeStats,
    completionRate,
    popularLocations,
    peakTimes
  ] = await Promise.all([
    // Total requests in period
    MeetUpRequest.countDocuments(baseQuery),
    
    // Status breakdown
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    
    // Type breakdown
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    
    // Hotel breakdown
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$hotelId', count: { $sum: 1 } } },
      { $lookup: { from: 'hotels', localField: '_id', foreignField: '_id', as: 'hotel' } },
      { $project: { hotelName: { $arrayElemAt: ['$hotel.name', 0] }, count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    
    // Daily trends
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          requests: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      },
      { $sort: { '_id': 1 } }
    ]),
    
    // Top active users
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$requesterId',
          requestsSent: { $sum: 1 }
        }
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $project: { userName: { $arrayElemAt: ['$user.name', 0] }, requestsSent: 1 } },
      { $sort: { requestsSent: -1 } },
      { $limit: 10 }
    ]),
    
    // Response time statistics
    MeetUpRequest.aggregate([
      {
        $match: {
          ...baseQuery,
          'response.respondedAt': { $exists: true }
        }
      },
      {
        $project: {
          responseTime: {
            $divide: [
              { $subtract: ['$response.respondedAt', '$createdAt'] },
              3600000 // Convert to hours
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' },
          minResponseTime: { $min: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' }
        }
      }
    ]),
    
    // Completion rate
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          declined: { $sum: { $cond: [{ $eq: ['$status', 'declined'] }, 1, 0] } }
        }
      }
    ]),
    
    // Popular locations
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$location.type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]),
    
    // Peak times analysis
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      {
        $project: {
          hour: { $hour: '$createdAt' },
          dayOfWeek: { $dayOfWeek: '$createdAt' }
        }
      },
      {
        $group: {
          _id: { hour: '$hour', dayOfWeek: '$dayOfWeek' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  ]);
  
  // Calculate rates
  const completionStats = completionRate[0] || { total: 0, accepted: 0, completed: 0, declined: 0 };
  const acceptanceRate = completionStats.total > 0 ? (completionStats.accepted / completionStats.total * 100) : 0;
  const declineRate = completionStats.total > 0 ? (completionStats.declined / completionStats.total * 100) : 0;
  const completionRatePercent = completionStats.accepted > 0 ? (completionStats.completed / completionStats.accepted * 100) : 0;
  
  res.json({
    success: true,
    data: {
      summary: {
        totalRequests,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        declineRate: Math.round(declineRate * 100) / 100,
        completionRate: Math.round(completionRatePercent * 100) / 100,
        avgResponseTime: responseTimeStats[0]?.avgResponseTime || 0
      },
      breakdown: {
        status: statusStats,
        type: typeStats,
        hotels: hotelStats,
        locations: popularLocations
      },
      trends: {
        daily: dailyTrends,
        peakTimes: peakTimes
      },
      users: {
        topRequesters: topUsers
      },
      period,
      generatedAt: new Date()
    }
  });
}));

// Admin: Force cancel any meet-up request
router.post('/admin/:requestId/force-cancel', adminAuth, catchAsync(async (req, res) => {
  const { reason } = req.body;
  
  const meetUpRequest = await MeetUpRequest.findById(req.params.requestId);
  
  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found', 404);
  }
  
  // Add admin cancellation info
  meetUpRequest.status = 'cancelled';
  meetUpRequest.adminAction = {
    action: 'force_cancelled',
    adminId: req.user._id,
    reason: reason || 'Cancelled by administrator',
    timestamp: new Date()
  };
  
  await meetUpRequest.save();
  
  // Populate for response
  await meetUpRequest.populate([
    { path: 'requesterId', select: 'name email' },
    { path: 'targetUserId', select: 'name email' },
    { path: 'hotelId', select: 'name' }
  ]);
  
  res.json({
    success: true,
    message: 'Meet-up request forcefully cancelled',
    data: meetUpRequest
  });
}));

// Admin: Get system-wide meet-up insights
router.get('/admin/insights', adminAuth, catchAsync(async (req, res) => {
  const { hotelId } = req.query;
  
  let baseQuery = {};
  if (hotelId && hotelId !== 'all') {
    baseQuery.hotelId = hotelId;
  }
  
  // Get various insights
  const [
    totalUsers,
    activeUsers,
    riskMeetUps,
    frequentRequesters,
    underperformingHotels,
    safetyStats
  ] = await Promise.all([
    // Total users who have used meet-up feature
    MeetUpRequest.distinct('requesterId', baseQuery).then(ids => ids.length),
    
    // Active users (last 30 days)
    MeetUpRequest.distinct('requesterId', {
      ...baseQuery,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).then(ids => ids.length),
    
    // Potentially risky meet-ups (declined multiple times, safety concerns)
    MeetUpRequest.find({
      ...baseQuery,
      $or: [
        { status: 'declined' },
        { 'safety.verifiedOnly': false, 'safety.publicLocation': false }
      ]
    }).populate('requesterId', 'name email').populate('targetUserId', 'name email'),
    
    // Users with excessive requests
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$requesterId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 10 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $project: { userName: { $arrayElemAt: ['$user.name', 0] }, requestCount: '$count' } },
      { $sort: { requestCount: -1 } }
    ]),
    
    // Hotels with low acceptance rates
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$hotelId',
          total: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } }
        }
      },
      {
        $project: {
          total: 1,
          accepted: 1,
          acceptanceRate: { $divide: ['$accepted', '$total'] }
        }
      },
      { $match: { total: { $gt: 5 }, acceptanceRate: { $lt: 0.5 } } },
      { $lookup: { from: 'hotels', localField: '_id', foreignField: '_id', as: 'hotel' } },
      { $project: { hotelName: { $arrayElemAt: ['$hotel.name', 0] }, acceptanceRate: 1, total: 1 } }
    ]),
    
    // Safety preferences statistics
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          verifiedOnly: { $sum: { $cond: ['$safety.verifiedOnly', 1, 0] } },
          publicLocation: { $sum: { $cond: ['$safety.publicLocation', 1, 0] } },
          hotelStaffPresent: { $sum: { $cond: ['$safety.hotelStaffPresent', 1, 0] } }
        }
      }
    ])
  ]);
  
  res.json({
    success: true,
    data: {
      userEngagement: {
        totalUsers,
        activeUsers,
        engagementRate: totalUsers > 0 ? (activeUsers / totalUsers * 100) : 0
      },
      riskAssessment: {
        potentiallyRiskyMeetUps: riskMeetUps.length,
        frequentRequesters: frequentRequesters.length,
        riskyMeetUpDetails: riskMeetUps.slice(0, 10) // Limit to 10 for performance
      },
      hotelPerformance: {
        underperformingHotels
      },
      safetyInsights: safetyStats[0] || {
        totalRequests: 0,
        verifiedOnly: 0,
        publicLocation: 0,
        hotelStaffPresent: 0
      }
    }
  });
}));

export default router;
