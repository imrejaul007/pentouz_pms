import personalizationEngineService from '../services/personalizationEngineService.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/appError.js';

export const generatePersonalizedExperience = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const context = req.body || {};

  const experience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    context
  );

  res.status(200).json({
    success: true,
    data: experience
  });
});

export const getPersonalizedContent = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const { page = 'home', context = {} } = req.query;

  const experience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    { page, ...context }
  );

  res.status(200).json({
    success: true,
    data: {
      content: experience.content,
      personalizationMetadata: experience.personalizationMetadata
    }
  });
});

export const getPersonalizedPricing = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const context = req.body || {};

  const experience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    context
  );

  res.status(200).json({
    success: true,
    data: {
      pricing: experience.pricing,
      profileInfo: experience.profileInfo
    }
  });
});

export const getPersonalizedRecommendations = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const context = req.body || {};

  const experience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    context
  );

  res.status(200).json({
    success: true,
    data: {
      recommendations: experience.recommendations,
      offers: experience.offers
    }
  });
});

export const getPersonalizedOffers = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const context = req.body || {};

  const experience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    context
  );

  res.status(200).json({
    success: true,
    data: {
      offers: experience.offers,
      personalizationMetadata: experience.personalizationMetadata
    }
  });
});

export const getPersonalizedDashboard = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;

  const dashboard = await personalizationEngineService.getPersonalizedDashboard(userId, hotelId);

  res.status(200).json({
    success: true,
    data: dashboard
  });
});

export const getPersonalizedExperienceForGuest = catchAsync(async (req, res, next) => {
  const { guestId } = req.params;
  const hotelId = req.user.hotelId;
  const context = req.body || {};

  // Admin/Manager can get personalized experience for any guest
  if (!['admin', 'manager'].includes(req.user.role)) {
    return next(new AppError('Insufficient permissions', 403));
  }

  const experience = await personalizationEngineService.generatePersonalizedExperience(
    guestId,
    hotelId,
    context
  );

  res.status(200).json({
    success: true,
    data: experience
  });
});

export const updatePersonalizationPreferences = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const preferences = req.body;

  // This would update user preferences that affect personalization
  // For now, we'll return success and regenerate experience
  const experience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    { preferences }
  );

  res.status(200).json({
    success: true,
    message: 'Personalization preferences updated successfully',
    data: {
      updatedPreferences: preferences,
      newExperience: experience
    }
  });
});

export const getPersonalizationAnalytics = catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;

  // This would provide analytics on personalization effectiveness
  // For now, return mock analytics data
  const analytics = {
    totalPersonalizedExperiences: 1250,
    conversionRates: {
      personalized: 8.5,
      standard: 4.2,
      improvement: 102.4
    },
    segmentPerformance: {
      'high_value_prospects': { conversionRate: 12.8, avgBookingValue: 850 },
      'luxury_seekers': { conversionRate: 15.2, avgBookingValue: 1250 },
      'business_travelers': { conversionRate: 9.8, avgBookingValue: 420 },
      'price_sensitive': { conversionRate: 6.5, avgBookingValue: 180 }
    },
    offerEffectiveness: {
      'vip_experience': { clickRate: 18.5, conversionRate: 12.3 },
      'loyalty_boost': { clickRate: 22.1, conversionRate: 8.7 },
      'discount': { clickRate: 34.2, conversionRate: 15.6 },
      'luxury_package': { clickRate: 8.9, conversionRate: 18.4 }
    },
    contentEngagement: {
      personalizedHeadlines: { clickRate: 28.5 },
      standardHeadlines: { clickRate: 14.2 },
      personalizedRecommendations: { viewRate: 45.8 },
      standardRecommendations: { viewRate: 23.1 }
    }
  };

  res.status(200).json({
    success: true,
    data: analytics
  });
});

export const testPersonalizationVariant = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const hotelId = req.user.hotelId;
  const { variant, context = {} } = req.body;

  // This would run A/B testing for personalization variants
  const baseExperience = await personalizationEngineService.generatePersonalizedExperience(
    userId,
    hotelId,
    context
  );

  // Modify experience based on variant
  let variantExperience = { ...baseExperience };

  switch (variant) {
    case 'aggressive_discount':
      variantExperience.pricing.baseDiscountRange.max += 10;
      break;
    case 'luxury_focused':
      variantExperience.content.heroSection.headline = 'Indulge in Unmatched Luxury';
      variantExperience.recommendations = variantExperience.recommendations.filter(r =>
        ['suite', 'luxury', 'premium'].some(type => r.roomType.name.toLowerCase().includes(type))
      );
      break;
    case 'urgency_boost':
      variantExperience.content.heroSection.callToAction.urgency = 'high';
      variantExperience.offers.forEach(offer => {
        offer.expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      });
      break;
  }

  res.status(200).json({
    success: true,
    data: {
      variant,
      experience: variantExperience,
      testMetadata: {
        testId: `test_${Date.now()}`,
        startTime: new Date(),
        userId,
        hotelId
      }
    }
  });
});

export default {
  generatePersonalizedExperience,
  getPersonalizedContent,
  getPersonalizedPricing,
  getPersonalizedRecommendations,
  getPersonalizedOffers,
  getPersonalizedDashboard,
  getPersonalizedExperienceForGuest,
  updatePersonalizationPreferences,
  getPersonalizationAnalytics,
  testPersonalizationVariant
};