import personalizationEngineService from '../services/personalizationEngineService.js';
import GuestCRMProfile from '../models/GuestCRMProfile.js';

export const injectPersonalization = (options = {}) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const hotelId = req.user?.hotelId;

      if (!userId || !hotelId) {
        return next();
      }

      // Store original res.json to intercept response
      const originalJson = res.json;
      res.json = async function(data) {
        try {
          // Only personalize successful responses
          if (data.success && options.personalizeResponse) {
            const personalizedExperience = await personalizationEngineService
              .generatePersonalizedExperience(userId, hotelId, req.body || {});

            // Inject personalization data into response
            data.personalization = {
              userSegment: personalizedExperience.personalizationMetadata.segments[0],
              recommendations: personalizedExperience.recommendations.slice(0, 3),
              personalizedOffers: personalizedExperience.offers.slice(0, 2),
              contentPersonalization: {
                tone: personalizedExperience.content.messaging.tone,
                preferredDevice: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop'
              }
            };
          }

          return originalJson.call(this, data);
        } catch (error) {
          console.error('Personalization injection error:', error);
          return originalJson.call(this, data);
        }
      };

      next();
    } catch (error) {
      console.error('Personalization middleware error:', error);
      next();
    }
  };
};

export const personalizeContent = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const hotelId = req.user?.hotelId;

    if (!userId || !hotelId) {
      return next();
    }

    // Add personalization context to request
    const profile = await GuestCRMProfile.findOne({ userId, hotelId });

    if (profile) {
      req.personalizationContext = {
        userSegment: profile.rfmAnalysis.segment,
        loyaltyTier: profile.loyaltyMetrics.tier,
        preferences: profile.preferences,
        isReturningCustomer: profile.engagementMetrics.totalBookings > 0,
        lifetimeValue: profile.engagementMetrics.totalSpending,
        lastBookingDays: profile.rfmAnalysis.recency.value
      };
    }

    next();
  } catch (error) {
    console.error('Content personalization middleware error:', error);
    next();
  }
};

export const addPersonalizedHeaders = (req, res, next) => {
  const context = req.personalizationContext;

  if (context) {
    res.setHeader('X-User-Segment', context.userSegment || 'unknown');
    res.setHeader('X-Loyalty-Tier', context.loyaltyTier || 'Bronze');
    res.setHeader('X-Customer-Type', context.isReturningCustomer ? 'returning' : 'new');
    res.setHeader('X-Personalization-Enabled', 'true');
  }

  next();
};

export const dynamicPricingMiddleware = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const hotelId = req.user?.hotelId;

    if (!userId || !hotelId) {
      return next();
    }

    // Store original res.json to modify pricing data
    const originalJson = res.json;
    res.json = async function(data) {
      try {
        if (data.success && data.data && (data.data.rooms || data.data.pricing)) {
          const personalizedExperience = await personalizationEngineService
            .generatePersonalizedExperience(userId, hotelId, req.body || {});

          // Apply personalized pricing
          if (data.data.rooms) {
            data.data.rooms = data.data.rooms.map(room => ({
              ...room,
              personalizedPrice: applyPersonalizedDiscount(
                room.price,
                personalizedExperience.pricing
              ),
              loyaltyDiscount: personalizedExperience.pricing.loyaltyDiscount,
              eligibleOffers: personalizedExperience.offers.filter(offer =>
                offer.type === 'discount' || offer.type === 'upgrade'
              )
            }));
          }

          if (data.data.pricing) {
            data.data.pricing.personalized = personalizedExperience.pricing;
            data.data.pricing.dynamicAdjustments = {
              loyaltyDiscount: personalizedExperience.pricing.loyaltyDiscount,
              segmentDiscount: calculateSegmentDiscount(personalizedExperience.profileInfo.segment),
              totalSavings: calculateTotalSavings(data.data.pricing, personalizedExperience.pricing)
            };
          }
        }

        return originalJson.call(this, data);
      } catch (error) {
        console.error('Dynamic pricing error:', error);
        return originalJson.call(this, data);
      }
    };

    next();
  } catch (error) {
    console.error('Dynamic pricing middleware error:', error);
    next();
  }
};

function applyPersonalizedDiscount(basePrice, pricingData) {
  const discountRange = pricingData.baseDiscountRange;
  const loyaltyDiscount = pricingData.loyaltyDiscount;

  // Apply average of discount range plus loyalty discount
  const avgDiscount = (discountRange.min + discountRange.max) / 2;
  const totalDiscountPercent = avgDiscount + loyaltyDiscount;

  return Math.round(basePrice * (1 - totalDiscountPercent / 100));
}

function calculateSegmentDiscount(segment) {
  const segmentDiscounts = {
    'Champions': 8,
    'Loyal Customers': 6,
    'Potential Loyalists': 4,
    'New Customers': 3,
    'At Risk': 10,
    'Cannot Lose Them': 12
  };

  return segmentDiscounts[segment] || 0;
}

function calculateTotalSavings(originalPricing, personalizedPricing) {
  const basePrice = originalPricing.basePrice || 0;
  const loyaltyDiscount = personalizedPricing.loyaltyDiscount || 0;
  const avgSegmentDiscount = (personalizedPricing.baseDiscountRange.min + personalizedPricing.baseDiscountRange.max) / 2;

  const totalDiscountPercent = loyaltyDiscount + avgSegmentDiscount;
  return Math.round(basePrice * (totalDiscountPercent / 100));
}

export default {
  injectPersonalization,
  personalizeContent,
  addPersonalizedHeaders,
  dynamicPricingMiddleware
};