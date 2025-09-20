import { dashboardUpdateService } from '../services/dashboardUpdateService.js';
import logger from '../utils/logger.js';

/**
 * Middleware to log user activities for admin dashboard
 */
export const activityLogger = (action, getDetails = () => ({})) => {
  return async (req, res, next) => {
    // Store original response methods
    const originalSend = res.send;
    const originalJson = res.json;

    // Override response methods to capture success responses
    res.send = function(body) {
      logActivity(req, action, getDetails(req, res, body));
      return originalSend.call(this, body);
    };

    res.json = function(body) {
      logActivity(req, action, getDetails(req, res, body));
      return originalJson.call(this, body);
    };

    next();
  };
};

/**
 * Log activity asynchronously to avoid blocking response
 */
async function logActivity(req, action, details) {
  try {
    // Only log for successful responses (2xx status codes)
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      setImmediate(async () => {
        try {
          await dashboardUpdateService.logUserActivity(
            req.user, 
            action, 
            {
              ...details,
              method: req.method,
              path: req.path,
              ip: req.ip,
              userAgent: req.get('User-Agent'),
              timestamp: new Date()
            }
          );
        } catch (error) {
          logger.error('Activity logging failed:', error);
        }
      });
    }
  } catch (error) {
    logger.error('Activity logging setup failed:', error);
  }
}

/**
 * Quick activity loggers for common actions
 */
export const logBookingCreation = activityLogger(
  'created a booking',
  (req, res, body) => ({
    hotelId: req.body.hotelId,
    amount: req.body.totalAmount,
    roomCount: req.body.roomIds?.length || 0
  })
);

export const logBookingUpdate = activityLogger(
  'updated a booking',
  (req) => ({
    hotelId: req.body.hotelId,
    bookingId: req.params.id,
    updates: Object.keys(req.body)
  })
);

export const logBookingCancellation = activityLogger(
  'cancelled a booking',
  (req) => ({
    bookingId: req.params.id,
    reason: req.body.reason
  })
);

export const logUserRegistration = activityLogger(
  'registered as a new user',
  (req) => ({
    email: req.body.email,
    role: req.body.role || 'guest'
  })
);

export const logUserLogin = activityLogger(
  'logged in',
  (req) => ({
    email: req.body.email,
    loginTime: new Date()
  })
);

export const logProfileUpdate = activityLogger(
  'updated profile',
  (req) => ({
    updatedFields: Object.keys(req.body)
  })
);

export const logServiceRequest = activityLogger(
  'requested a service',
  (req) => ({
    hotelId: req.body.hotelId,
    serviceType: req.body.serviceType,
    priority: req.body.priority
  })
);

export const logReviewCreation = activityLogger(
  'left a review',
  (req) => ({
    hotelId: req.body.hotelId,
    rating: req.body.rating,
    bookingId: req.body.bookingId
  })
);
