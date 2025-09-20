import MeetUpRequest from '../models/MeetUpRequest.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';
import meetUpSupervisionAlertService from '../services/meetUpSupervisionAlertService.js';

/**
 * Get meet-ups requiring staff supervision
 * Filters based on safety levels and supervision needs
 */
export const getSupervisionMeetUps = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20, status, priority, safetyLevel } = req.query;
  const { hotelId } = req.user;

  // Build query for meet-ups that require supervision
  const query = {
    hotelId,
    status: { $in: ['pending', 'accepted'] },
    proposedDate: { $gt: new Date() }
  };

  // Apply filters
  if (status) query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Fetch meet-ups
  let meetUps = await MeetUpRequest.find(query)
    .populate('requesterId', 'name email avatar')
    .populate('targetUserId', 'name email avatar')
    .populate('hotelId', 'name address')
    .populate('assignedStaff', 'name email')
    .sort({ proposedDate: 1, createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Apply post-query filters for supervision priority
  if (priority || safetyLevel) {
    meetUps = meetUps.filter(meetUp => {
      const supervisionPriority = calculateSupervisionPriority(meetUp);
      const safetyAssessment = calculateSafetyLevel(meetUp);

      if (priority && supervisionPriority.priority !== priority) return false;
      if (safetyLevel && safetyAssessment.level !== safetyLevel) return false;

      return true;
    });
  }

  // Calculate supervision metadata for each meet-up
  const meetUpsWithSupervision = meetUps.map(meetUp => {
    const supervisionData = {
      priority: calculateSupervisionPriority(meetUp),
      safetyLevel: calculateSafetyLevel(meetUp),
      requiresStaffPresence: meetUp.safety?.hotelStaffPresent || false,
      riskFactors: identifyRiskFactors(meetUp)
    };

    return {
      ...meetUp.toJSON(),
      supervision: supervisionData
    };
  });

  const totalCount = await MeetUpRequest.countDocuments(query);
  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.status(200).json({
    success: true,
    message: 'Supervision meet-ups retrieved successfully',
    data: {
      meetUps: meetUpsWithSupervision,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalCount,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    }
  });
});

/**
 * Assign staff member to supervise a meet-up
 */
export const assignStaffToMeetUp = catchAsync(async (req, res, next) => {
  const { meetUpId } = req.params;
  const { staffId, supervisionNotes } = req.body;
  const { hotelId } = req.user;

  const meetUp = await MeetUpRequest.findOne({
    _id: meetUpId,
    hotelId
  });

  if (!meetUp) {
    return next(new ApplicationError('Meet-up not found', 404));
  }

  // Update meet-up with staff assignment
  meetUp.assignedStaff = staffId;
  meetUp.supervisionStatus = 'assigned';
  meetUp.supervisionNotes = supervisionNotes || '';

  await meetUp.save();

  // Update related alert
  try {
    await meetUpSupervisionAlertService.updateAlertOnSupervisionChange(
      meetUpId,
      'assigned',
      staffId
    );
  } catch (error) {
    logger.warn('Failed to update supervision alert', { meetUpId, error: error.message });
  }

  // Populate the updated meet-up
  await meetUp.populate('assignedStaff', 'name email');

  res.status(200).json({
    success: true,
    message: 'Staff assigned to meet-up successfully',
    data: meetUp
  });
});

/**
 * Get staff member's supervision assignments
 */
export const getStaffAssignments = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20, status } = req.query;
  const { _id: staffId, hotelId } = req.user;

  const query = {
    hotelId,
    assignedStaff: staffId
  };

  if (status) query.supervisionStatus = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const assignments = await MeetUpRequest.find(query)
    .populate('requesterId', 'name email avatar')
    .populate('targetUserId', 'name email avatar')
    .populate('hotelId', 'name address')
    .sort({ proposedDate: 1, createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const assignmentsWithSupervision = assignments.map(meetUp => {
    const supervisionData = {
      priority: calculateSupervisionPriority(meetUp),
      safetyLevel: calculateSafetyLevel(meetUp),
      requiresStaffPresence: meetUp.safety?.hotelStaffPresent || false,
      riskFactors: identifyRiskFactors(meetUp)
    };

    return {
      ...meetUp.toJSON(),
      supervision: supervisionData
    };
  });

  const totalCount = await MeetUpRequest.countDocuments(query);
  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.status(200).json({
    success: true,
    message: 'Staff assignments retrieved successfully',
    data: {
      assignments: assignmentsWithSupervision,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalCount,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    }
  });
});

/**
 * Update supervision status
 */
export const updateSupervisionStatus = catchAsync(async (req, res, next) => {
  const { meetUpId } = req.params;
  const { supervisionStatus, supervisionNotes } = req.body;
  const { _id: staffId, hotelId } = req.user;

  const meetUp = await MeetUpRequest.findOne({
    _id: meetUpId,
    hotelId,
    assignedStaff: staffId
  });

  if (!meetUp) {
    return next(new ApplicationError('Meet-up assignment not found', 404));
  }

  // Update supervision status
  meetUp.supervisionStatus = supervisionStatus;
  if (supervisionNotes) meetUp.supervisionNotes = supervisionNotes;

  if (supervisionStatus === 'completed') {
    meetUp.supervisionCompletedAt = new Date();
  }

  await meetUp.save();

  // Update related alert
  try {
    await meetUpSupervisionAlertService.updateAlertOnSupervisionChange(
      meetUpId,
      supervisionStatus,
      staffId
    );
  } catch (error) {
    logger.warn('Failed to update supervision alert', { meetUpId, error: error.message });
  }

  res.status(200).json({
    success: true,
    message: 'Supervision status updated successfully',
    data: meetUp
  });
});

/**
 * Get supervision statistics for staff dashboard
 */
export const getSupervisionStats = catchAsync(async (req, res, next) => {
  const { hotelId } = req.user;
  const { period = '7d' } = req.query;

  // Calculate date range based on period
  const now = new Date();
  const startDate = new Date();

  switch (period) {
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }

  const stats = await MeetUpRequest.aggregate([
    {
      $match: {
        hotelId,
        createdAt: { $gte: startDate, $lte: now }
      }
    },
    {
      $group: {
        _id: null,
        totalMeetUps: { $sum: 1 },
        pendingSupervision: {
          $sum: { $cond: [{ $eq: ['$supervisionStatus', 'assigned'] }, 1, 0] }
        },
        completedSupervision: {
          $sum: { $cond: [{ $eq: ['$supervisionStatus', 'completed'] }, 1, 0] }
        },
        highRiskMeetUps: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$safety.publicLocation', false] },
                  { $eq: ['$safety.hotelStaffPresent', true] },
                  { $gt: ['$participants.maxParticipants', 4] }
                ]
              },
              1,
              0
            ]
          }
        },
        staffRequiredMeetUps: {
          $sum: { $cond: [{ $eq: ['$safety.hotelStaffPresent', true] }, 1, 0] }
        }
      }
    }
  ]);

  const baseStats = stats[0] || {
    totalMeetUps: 0,
    pendingSupervision: 0,
    completedSupervision: 0,
    highRiskMeetUps: 0,
    staffRequiredMeetUps: 0
  };

  // Get supervision status breakdown
  const statusBreakdown = await MeetUpRequest.aggregate([
    {
      $match: {
        hotelId,
        createdAt: { $gte: startDate, $lte: now },
        assignedStaff: { $exists: true }
      }
    },
    {
      $group: {
        _id: '$supervisionStatus',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get upcoming supervised meet-ups
  const upcomingSupervised = await MeetUpRequest.countDocuments({
    hotelId,
    proposedDate: { $gt: now },
    assignedStaff: { $exists: true },
    supervisionStatus: { $in: ['assigned', 'in_progress'] }
  });

  res.status(200).json({
    success: true,
    message: 'Supervision statistics retrieved successfully',
    data: {
      summary: {
        ...baseStats,
        upcomingSupervised
      },
      statusBreakdown,
      period,
      generatedAt: new Date().toISOString()
    }
  });
});

/**
 * Get meet-ups requiring immediate attention
 */
export const getUrgentSupervisionTasks = catchAsync(async (req, res, next) => {
  const { hotelId } = req.user;
  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const urgentMeetUps = await MeetUpRequest.find({
    hotelId,
    proposedDate: { $gte: now, $lte: next24Hours },
    $or: [
      { 'safety.hotelStaffPresent': true },
      { 'safety.publicLocation': false },
      { 'participants.maxParticipants': { $gt: 4 } },
      { assignedStaff: { $exists: false } }
    ]
  })
    .populate('requesterId', 'name email')
    .populate('targetUserId', 'name email')
    .populate('assignedStaff', 'name email')
    .sort({ proposedDate: 1 });

  const urgentWithPriority = urgentMeetUps.map(meetUp => ({
    ...meetUp.toJSON(),
    supervision: {
      priority: calculateSupervisionPriority(meetUp),
      safetyLevel: calculateSafetyLevel(meetUp),
      requiresStaffPresence: meetUp.safety?.hotelStaffPresent || false,
      riskFactors: identifyRiskFactors(meetUp)
    }
  }));

  res.status(200).json({
    success: true,
    message: 'Urgent supervision tasks retrieved successfully',
    data: {
      urgentTasks: urgentWithPriority,
      count: urgentWithPriority.length
    }
  });
});

/**
 * Process upcoming meet-ups and create supervision alerts
 */
export const processSupervisionAlerts = catchAsync(async (req, res, next) => {
  const { hotelId } = req.user;

  try {
    const alertsCreated = await meetUpSupervisionAlertService.processUpcomingMeetUps(hotelId);

    res.status(200).json({
      success: true,
      message: 'Supervision alerts processed successfully',
      data: {
        alertsCreated: alertsCreated.length,
        alerts: alertsCreated.map(alert => ({
          id: alert._id,
          type: alert.type,
          priority: alert.priority,
          title: alert.title,
          meetUpId: alert.source.id,
          createdAt: alert.createdAt
        }))
      }
    });
  } catch (error) {
    logger.error('Error processing supervision alerts', { hotelId, error: error.message });
    return next(new ApplicationError('Failed to process supervision alerts', 500));
  }
});

/**
 * Get supervision alert statistics
 */
export const getSupervisionAlertStats = catchAsync(async (req, res, next) => {
  const { hotelId } = req.user;

  try {
    const stats = await meetUpSupervisionAlertService.getSupervisionAlertStats(hotelId);

    res.status(200).json({
      success: true,
      message: 'Supervision alert statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    logger.error('Error getting supervision alert statistics', { hotelId, error: error.message });
    return next(new ApplicationError('Failed to get supervision alert statistics', 500));
  }
});

// Utility functions
function calculateSupervisionPriority(meetUp) {
  let priorityScore = 0;
  const factors = [];

  // Safety factors
  if (!meetUp.safety?.publicLocation) {
    priorityScore += 3;
    factors.push('Private location');
  }
  if (meetUp.safety?.hotelStaffPresent) {
    priorityScore += 2;
    factors.push('Staff presence required');
  }
  if (!meetUp.safety?.verifiedOnly) {
    priorityScore += 1;
    factors.push('Unverified users allowed');
  }

  // Time factors
  const meetUpHour = new Date(meetUp.proposedDate).getHours();
  if (meetUpHour < 6 || meetUpHour > 22) {
    priorityScore += 2;
    factors.push('Late/early hours');
  }

  // Group size
  if (meetUp.participants.maxParticipants > 4) {
    priorityScore += 1;
    factors.push('Large group');
  }

  // Location factors
  if (meetUp.location.type === 'other' || meetUp.location.type === 'outdoor') {
    priorityScore += 1;
    factors.push('Non-standard location');
  }

  // Determine priority level
  let priority, color, label;
  if (priorityScore >= 5) {
    priority = 'high';
    color = 'bg-red-100 text-red-800';
    label = 'High Priority';
  } else if (priorityScore >= 2) {
    priority = 'medium';
    color = 'bg-yellow-100 text-yellow-800';
    label = 'Medium Priority';
  } else {
    priority = 'low';
    color = 'bg-green-100 text-green-800';
    label = 'Low Priority';
  }

  return {
    priority,
    color,
    label,
    score: priorityScore,
    factors
  };
}

function calculateSafetyLevel(meetUp) {
  let safetyScore = 0;

  if (meetUp.safety?.publicLocation) safetyScore += 2;
  if (meetUp.safety?.hotelStaffPresent) safetyScore += 2;
  if (meetUp.safety?.verifiedOnly) safetyScore += 1;

  let level, color, label;
  if (safetyScore >= 4) {
    level = 'high';
    color = 'bg-green-100 text-green-800';
    label = 'High Safety';
  } else if (safetyScore >= 2) {
    level = 'medium';
    color = 'bg-yellow-100 text-yellow-800';
    label = 'Standard';
  } else {
    level = 'low';
    color = 'bg-red-100 text-red-800';
    label = 'Requires Attention';
  }

  return {
    level,
    color,
    label,
    score: safetyScore
  };
}

function identifyRiskFactors(meetUp) {
  const risks = [];

  if (!meetUp.safety?.publicLocation) risks.push('Private location');
  if (!meetUp.safety?.verifiedOnly) risks.push('Unverified users');

  const meetUpHour = new Date(meetUp.proposedDate).getHours();
  if (meetUpHour < 6 || meetUpHour > 22) risks.push('Outside normal hours');

  if (meetUp.participants.maxParticipants > 4) risks.push('Large group size');
  if (meetUp.location.type === 'other') risks.push('Unspecified location');
  if (meetUp.location.type === 'outdoor') risks.push('Outdoor location');

  return risks;
}
