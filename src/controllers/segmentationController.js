import smartSegmentationService from '../services/smartSegmentationService.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/appError.js';

export const performAdvancedSegmentation = catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const options = req.body || {};

  const segmentation = await smartSegmentationService.performAdvancedSegmentation(hotelId, options);

  res.status(200).json({
    success: true,
    data: segmentation
  });
});

export const getSegmentInsights = catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const { segmentId } = req.params;

  const insights = await smartSegmentationService.getSegmentInsights(hotelId, segmentId);

  res.status(200).json({
    success: true,
    data: insights
  });
});

export const getAvailableSegments = catchAsync(async (req, res, next) => {
  const segmentRules = Array.from(smartSegmentationService.segmentationRules.entries()).map(([id, rule]) => ({
    id,
    name: rule.name,
    description: rule.description,
    actions: rule.actions
  }));

  res.status(200).json({
    success: true,
    data: {
      segments: segmentRules,
      totalRules: segmentRules.length
    }
  });
});

export const getSegmentationSummary = catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;

  const segmentation = await smartSegmentationService.performAdvancedSegmentation(hotelId);

  const summary = {
    totalProfiles: segmentation.totalProfiles,
    totalSegments: Object.keys(segmentation.segments).length,
    distribution: segmentation.segmentDistribution,
    topRecommendations: segmentation.recommendations.slice(0, 5),
    insights: {
      largestSegment: Object.entries(segmentation.segmentDistribution)
        .sort(([,a], [,b]) => b.count - a.count)[0],
      highestValueSegments: segmentation.recommendations
        .filter(r => ['high_value_prospects', 'luxury_seekers', 'vip_potential'].includes(r.segment))
        .slice(0, 3),
      atRiskSegments: segmentation.recommendations
        .filter(r => ['churn_risk'].includes(r.segment))
    }
  };

  res.status(200).json({
    success: true,
    data: summary
  });
});

export const getSegmentMembers = catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const { segmentId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const segmentation = await smartSegmentationService.performAdvancedSegmentation(hotelId);
  const segment = segmentation.segments[segmentId];

  if (!segment) {
    return next(new AppError(`Segment ${segmentId} not found`, 404));
  }

  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginatedMembers = segment.slice(startIndex, endIndex);

  res.status(200).json({
    success: true,
    data: {
      members: paginatedMembers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(segment.length / parseInt(limit)),
        totalMembers: segment.length,
        limit: parseInt(limit)
      },
      segmentInfo: smartSegmentationService.segmentationRules.get(segmentId) || { name: segmentId }
    }
  });
});

export const analyzeCustomerJourney = catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const { userId } = req.params;

  // Get segmentation for this specific user
  const segmentation = await smartSegmentationService.performAdvancedSegmentation(hotelId);

  // Find user in segments
  const userSegments = [];
  Object.entries(segmentation.segments).forEach(([segmentId, members]) => {
    const userInSegment = members.find(member =>
      member.profile.userId.toString() === userId
    );
    if (userInSegment) {
      userSegments.push({
        segmentId,
        segmentName: smartSegmentationService.segmentationRules.get(segmentId)?.name || segmentId,
        confidence: userInSegment.confidence,
        analytics: userInSegment.analytics
      });
    }
  });

  if (userSegments.length === 0) {
    return next(new AppError('User not found in any segments', 404));
  }

  const journey = {
    userId,
    currentSegments: userSegments,
    recommendations: userSegments.flatMap(segment =>
      smartSegmentationService.getSegmentSpecificRecommendations(segment.segmentId, [])
    ),
    nextBestActions: userSegments.map(segment => ({
      segment: segment.segmentId,
      actions: smartSegmentationService.segmentationRules.get(segment.segmentId)?.actions || []
    }))
  };

  res.status(200).json({
    success: true,
    data: journey
  });
});

export default {
  performAdvancedSegmentation,
  getSegmentInsights,
  getAvailableSegments,
  getSegmentationSummary,
  getSegmentMembers,
  analyzeCustomerJourney
};