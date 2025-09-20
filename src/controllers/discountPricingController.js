import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { discountPricingService } from '../services/discountPricingService.js';
import SpecialDiscount from '../models/SpecialDiscount.js';
import DynamicPricing from '../models/DynamicPricing.js';
import MarketSegment from '../models/MarketSegment.js';
import JobType from '../models/JobType.js';

// Special Discount Controllers
export const createSpecialDiscount = catchAsync(async (req, res) => {
  const discount = await discountPricingService.createSpecialDiscount(
    req.body,
    req.user._id
  );

  res.status(201).json({
    status: 'success',
    data: {
      discount
    }
  });
});

export const getSpecialDiscounts = catchAsync(async (req, res) => {
  const filters = {
    type: req.query.type,
    category: req.query.category,
    isActive: req.query.isActive,
    search: req.query.search
  };

  const discounts = await discountPricingService.getSpecialDiscounts(
    req.user.hotelId,
    filters
  );

  res.status(200).json({
    status: 'success',
    results: discounts.length,
    data: {
      discounts
    }
  });
});

export const getSpecialDiscount = catchAsync(async (req, res, next) => {
  const discount = await SpecialDiscount.findById(req.params.id)
    .populate('createdBy updatedBy', 'name email');

  if (!discount) {
    return next(new ApplicationError('Special discount not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      discount
    }
  });
});

export const updateSpecialDiscount = catchAsync(async (req, res) => {
  const discount = await discountPricingService.updateSpecialDiscount(
    req.params.id,
    req.body,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      discount
    }
  });
});

export const deleteSpecialDiscount = catchAsync(async (req, res) => {
  await discountPricingService.deleteSpecialDiscount(
    req.params.id,
    req.user._id
  );

  res.status(204).json({
    status: 'success',
    data: null
  });
});

export const getApplicableDiscounts = catchAsync(async (req, res) => {
  const { bookingData } = req.body;
  const discounts = await discountPricingService.getApplicableDiscounts(
    req.user.hotelId,
    bookingData
  );

  res.status(200).json({
    status: 'success',
    results: discounts.length,
    data: {
      discounts
    }
  });
});

// Dynamic Pricing Controllers
export const createDynamicPricing = catchAsync(async (req, res) => {
  const pricing = await discountPricingService.createDynamicPricing(
    req.body,
    req.user._id
  );

  res.status(201).json({
    status: 'success',
    data: {
      pricing
    }
  });
});

export const getDynamicPricingRules = catchAsync(async (req, res) => {
  const filters = {
    algorithm: req.query.algorithm,
    category: req.query.category,
    isActive: req.query.isActive,
    search: req.query.search
  };

  const pricingRules = await discountPricingService.getDynamicPricingRules(
    req.user.hotelId,
    filters
  );

  res.status(200).json({
    status: 'success',
    results: pricingRules.length,
    data: {
      pricingRules
    }
  });
});

export const getDynamicPricing = catchAsync(async (req, res, next) => {
  const pricing = await DynamicPricing.findById(req.params.id)
    .populate('createdBy updatedBy', 'name email');

  if (!pricing) {
    return next(new ApplicationError('Dynamic pricing rule not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      pricing
    }
  });
});

export const updateDynamicPricing = catchAsync(async (req, res) => {
  const pricing = await discountPricingService.updateDynamicPricing(
    req.params.id,
    req.body,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      pricing
    }
  });
});

export const deleteDynamicPricing = catchAsync(async (req, res) => {
  await discountPricingService.deleteDynamicPricing(
    req.params.id,
    req.user._id
  );

  res.status(204).json({
    status: 'success',
    data: null
  });
});

export const calculateDynamicPrice = catchAsync(async (req, res) => {
  const { context } = req.body;
  const price = await discountPricingService.calculateDynamicPrice(
    req.params.id,
    context
  );

  res.status(200).json({
    status: 'success',
    data: {
      price
    }
  });
});

// Market Segment Controllers
export const createMarketSegment = catchAsync(async (req, res) => {
  const segment = await discountPricingService.createMarketSegment(
    req.body,
    req.user._id
  );

  res.status(201).json({
    status: 'success',
    data: {
      segment
    }
  });
});

export const getMarketSegments = catchAsync(async (req, res) => {
  const filters = {
    category: req.query.category,
    isActive: req.query.isActive,
    search: req.query.search
  };

  const segments = await discountPricingService.getMarketSegments(
    req.user.hotelId,
    filters
  );

  res.status(200).json({
    status: 'success',
    results: segments.length,
    data: {
      segments
    }
  });
});

export const getMarketSegment = catchAsync(async (req, res, next) => {
  const segment = await MarketSegment.findById(req.params.id)
    .populate('createdBy updatedBy', 'name email');

  if (!segment) {
    return next(new ApplicationError('Market segment not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      segment
    }
  });
});

export const updateMarketSegment = catchAsync(async (req, res) => {
  const segment = await discountPricingService.updateMarketSegment(
    req.params.id,
    req.body,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      segment
    }
  });
});

export const deleteMarketSegment = catchAsync(async (req, res) => {
  await discountPricingService.deleteMarketSegment(
    req.params.id,
    req.user._id
  );

  res.status(204).json({
    status: 'success',
    data: null
  });
});

export const findMatchingSegments = catchAsync(async (req, res) => {
  const { guestProfile } = req.body;
  const segments = await discountPricingService.findMatchingSegments(
    req.user.hotelId,
    guestProfile
  );

  res.status(200).json({
    status: 'success',
    results: segments.length,
    data: {
      segments
    }
  });
});

// Job Type Controllers
export const createJobType = catchAsync(async (req, res) => {
  const jobType = await discountPricingService.createJobType(
    req.body,
    req.user._id
  );

  res.status(201).json({
    status: 'success',
    data: {
      jobType
    }
  });
});

export const getJobTypes = catchAsync(async (req, res) => {
  const filters = {
    category: req.query.category,
    level: req.query.level,
    isActive: req.query.isActive,
    isRemote: req.query.isRemote,
    search: req.query.search
  };

  const jobTypes = await discountPricingService.getJobTypes(
    req.user.hotelId,
    filters
  );

  res.status(200).json({
    status: 'success',
    results: jobTypes.length,
    data: {
      jobTypes
    }
  });
});

export const getJobType = catchAsync(async (req, res, next) => {
  const jobType = await JobType.findById(req.params.id)
    .populate('createdBy updatedBy', 'name email')
    .populate('department', 'name code');

  if (!jobType) {
    return next(new ApplicationError('Job type not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      jobType
    }
  });
});

export const updateJobType = catchAsync(async (req, res) => {
  const jobType = await discountPricingService.updateJobType(
    req.params.id,
    req.body,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      jobType
    }
  });
});

export const deleteJobType = catchAsync(async (req, res) => {
  await discountPricingService.deleteJobType(
    req.params.id,
    req.user._id
  );

  res.status(204).json({
    status: 'success',
    data: null
  });
});

export const searchJobTypes = catchAsync(async (req, res) => {
  const jobTypes = await discountPricingService.searchJobTypes(
    req.user.hotelId,
    req.query
  );

  res.status(200).json({
    status: 'success',
    results: jobTypes.length,
    data: {
      jobTypes
    }
  });
});

// Utility Controllers
export const getAdvancedFeaturesOverview = catchAsync(async (req, res) => {
  const overview = await discountPricingService.getAdvancedFeaturesOverview(
    req.user.hotelId
  );

  res.status(200).json({
    status: 'success',
    data: {
      overview
    }
  });
});

export const bulkUpdateDiscountStatus = catchAsync(async (req, res, next) => {
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return next(new ApplicationError('Updates array is required', 400));
  }

  const results = await discountPricingService.bulkUpdateDiscountStatus(
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

export const bulkUpdatePricingStatus = catchAsync(async (req, res, next) => {
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return next(new ApplicationError('Updates array is required', 400));
  }

  const results = await discountPricingService.bulkUpdatePricingStatus(
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
export const getDiscountAnalytics = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  const analytics = await discountPricingService.getDiscountAnalytics(
    req.user.hotelId,
    dateRange
  );

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

export const getPricingAnalytics = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  const analytics = await discountPricingService.getPricingAnalytics(
    req.user.hotelId,
    dateRange
  );

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

export const getMarketSegmentAnalytics = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  const analytics = await discountPricingService.getMarketSegmentAnalytics(
    req.user.hotelId,
    dateRange
  );

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

export const getJobTypeAnalytics = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  const analytics = await discountPricingService.getJobTypeAnalytics(
    req.user.hotelId,
    dateRange
  );

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});



export default discountPricingController;
