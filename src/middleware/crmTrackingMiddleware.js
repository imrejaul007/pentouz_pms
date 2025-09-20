import crmAutomationService from '../services/crmAutomationService.js';
import GuestBehavior from '../models/GuestBehavior.js';

export const crmTrackingMiddleware = (behaviorType) => {
  return async (req, res, next) => {
    try {
      // Extract user and hotel information
      const userId = req.user?.id;
      const hotelId = req.user?.hotelId;

      if (!userId || !hotelId) {
        return next();
      }

      // Collect behavior data from request
      const behaviorData = {
        behaviorType,
        sessionId: req.sessionID || req.headers['x-session-id'] || `session_${Date.now()}`,
        pageUrl: req.originalUrl,
        referrerUrl: req.headers.referer || req.headers.referrer,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection.remoteAddress,
        deviceType: detectDeviceType(req.headers['user-agent']),
        source: req.query.utm_source || req.headers['x-marketing-source'] || 'direct',
        medium: req.query.utm_medium || req.headers['x-marketing-medium'],
        campaign: req.query.utm_campaign || req.headers['x-marketing-campaign'],
        utmParameters: {
          source: req.query.utm_source,
          medium: req.query.utm_medium,
          campaign: req.query.utm_campaign,
          term: req.query.utm_term,
          content: req.query.utm_content
        },
        localTime: new Date(),
        timezone: req.headers['x-timezone'] || 'UTC',
        interactionData: extractInteractionData(req, behaviorType),
        metadata: {
          endpoint: req.route?.path,
          method: req.method,
          responseTime: Date.now() - req.startTime
        }
      };

      // Track behavior asynchronously (don't block request)
      setImmediate(async () => {
        try {
          await crmAutomationService.trackBehavior(userId, hotelId, behaviorData);
        } catch (error) {
          console.error('CRM tracking error:', error);
        }
      });

      next();
    } catch (error) {
      console.error('CRM middleware error:', error);
      next(); // Don't block request on tracking errors
    }
  };
};

export const bookingCompletionMiddleware = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const hotelId = req.user?.hotelId;

    if (!userId || !hotelId) {
      return next();
    }

    // Store original res.json to intercept response
    const originalJson = res.json;
    res.json = function(data) {
      // Check if booking was successful
      if (data.success && data.booking) {
        setImmediate(async () => {
          try {
            // Track booking completion behavior
            await crmAutomationService.trackBehavior(userId, hotelId, {
              behaviorType: 'booking_complete',
              sessionId: req.sessionID || `session_${Date.now()}`,
              pageUrl: req.originalUrl,
              transactionValue: data.booking.totalAmount || 0,
              currency: data.booking.currency || 'USD',
              interactionData: {
                bookingId: data.booking._id,
                roomType: data.booking.roomType,
                checkInDate: data.booking.checkInDate,
                checkOutDate: data.booking.checkOutDate,
                guests: data.booking.guests,
                duration: data.booking.duration
              }
            });

            // Create or update CRM profile
            await crmAutomationService.createOrUpdateGuestProfile(userId, hotelId, {
              preferences: {
                roomType: data.booking.roomType,
                specialRequests: data.booking.specialRequests || []
              }
            });
          } catch (error) {
            console.error('Booking completion CRM tracking error:', error);
          }
        });
      }

      // Call original res.json
      return originalJson.call(this, data);
    };

    next();
  } catch (error) {
    console.error('Booking completion middleware error:', error);
    next();
  }
};

export const profileUpdateMiddleware = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const hotelId = req.user?.hotelId;

    if (!userId || !hotelId) {
      return next();
    }

    // Store original res.json to intercept response
    const originalJson = res.json;
    res.json = function(data) {
      if (data.success) {
        setImmediate(async () => {
          try {
            // Track profile update behavior
            await crmAutomationService.trackBehavior(userId, hotelId, {
              behaviorType: 'profile_update',
              sessionId: req.sessionID || `session_${Date.now()}`,
              pageUrl: req.originalUrl,
              interactionData: {
                updatedFields: Object.keys(req.body)
              }
            });

            // Update CRM profile with new data
            await crmAutomationService.createOrUpdateGuestProfile(userId, hotelId, {
              preferences: req.body.preferences,
              communicationPreferences: req.body.communicationPreferences
            });
          } catch (error) {
            console.error('Profile update CRM tracking error:', error);
          }
        });
      }

      return originalJson.call(this, data);
    };

    next();
  } catch (error) {
    console.error('Profile update middleware error:', error);
    next();
  }
};

function detectDeviceType(userAgent) {
  if (!userAgent) return 'desktop';

  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }
  return 'desktop';
}

function extractInteractionData(req, behaviorType) {
  const data = {};

  switch (behaviorType) {
    case 'room_search':
      data.checkInDate = req.query.checkIn || req.body.checkIn;
      data.checkOutDate = req.query.checkOut || req.body.checkOut;
      data.guests = req.query.guests || req.body.guests;
      data.roomType = req.query.roomType || req.body.roomType;
      data.priceRange = {
        min: req.query.minPrice || req.body.minPrice,
        max: req.query.maxPrice || req.body.maxPrice
      };
      data.filters = req.query.filters || req.body.filters;
      break;

    case 'room_view':
      data.roomType = req.params.roomType || req.query.roomType;
      data.duration = req.headers['x-page-duration'];
      data.scrollDepth = req.headers['x-scroll-depth'];
      break;

    case 'add_to_cart':
      data.roomType = req.body.roomType;
      data.checkInDate = req.body.checkInDate;
      data.checkOutDate = req.body.checkOutDate;
      data.guests = req.body.guests;
      break;

    case 'checkout_start':
      data.roomType = req.body.roomType;
      data.totalAmount = req.body.totalAmount;
      data.paymentMethod = req.body.paymentMethod;
      break;

    case 'support_contact':
      data.contactMethod = req.body.method || 'form';
      data.category = req.body.category;
      data.priority = req.body.priority;
      break;

    case 'email_open':
      data.campaignId = req.params.campaignId;
      data.emailType = req.query.type;
      break;

    case 'email_click':
      data.campaignId = req.params.campaignId;
      data.linkId = req.params.linkId;
      data.linkUrl = req.query.url;
      break;

    default:
      break;
  }

  return data;
}

export default {
  crmTrackingMiddleware,
  bookingCompletionMiddleware,
  profileUpdateMiddleware
};