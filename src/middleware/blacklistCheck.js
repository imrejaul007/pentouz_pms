import blacklistService from '../services/blacklistService.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

/**
 * Middleware to check if a guest is blacklisted before allowing booking
 */
export const checkBlacklistForBooking = catchAsync(async (req, res, next) => {
  const { userId, guestId } = req.body;
  const guestToCheck = userId || guestId;

  if (!guestToCheck) {
    return next();
  }

  try {
    const validation = await blacklistService.validateBooking(
      guestToCheck,
      req.user.hotelId,
      req.body
    );

    if (validation.isBlacklisted) {
      return res.status(403).json({
        status: 'error',
        message: 'Booking not allowed - Guest is blacklisted',
        data: {
          blacklistEntry: validation.blacklistEntry,
          reason: validation.message
        }
      });
    }

    // Add blacklist validation to request for logging
    req.blacklistValidation = validation;
    next();
  } catch (error) {
    // If blacklist check fails, log error but don't block booking
    console.error('Blacklist check failed:', error);
    next();
  }
});

/**
 * Middleware to check blacklist status and add to response
 */
export const addBlacklistStatus = catchAsync(async (req, res, next) => {
  const guestId = req.params.guestId || req.params.id;

  if (!guestId) {
    return next();
  }

  try {
    const blacklistEntry = await blacklistService.checkGuestBlacklist(
      guestId,
      req.user.hotelId
    );

    // Add blacklist status to response locals
    res.locals.blacklistStatus = {
      isBlacklisted: !!blacklistEntry,
      blacklistEntry
    };

    next();
  } catch (error) {
    console.error('Failed to check blacklist status:', error);
    next();
  }
});

/**
 * Middleware to enforce blacklist restrictions
 */
export const enforceBlacklistRestrictions = (options = {}) => {
  const { allowOverride = false, requireApproval = false } = options;

  return catchAsync(async (req, res, next) => {
    const guestId = req.body.userId || req.body.guestId || req.params.guestId;

    if (!guestId) {
      return next();
    }

    try {
      const validation = await blacklistService.validateBooking(
        guestId,
        req.user.hotelId,
        req.body
      );

      if (validation.isBlacklisted) {
        // Check if override is allowed
        if (allowOverride && req.body.overrideBlacklist) {
          // Log the override
          console.log(`Blacklist override used for guest ${guestId} by user ${req.user._id}`);
          req.blacklistOverride = true;
          return next();
        }

        // Check if approval is required
        if (requireApproval && req.body.blacklistApproval) {
          // Verify user has approval permissions
          if (!['admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({
              status: 'error',
              message: 'Insufficient permissions to override blacklist',
              data: {
                blacklistEntry: validation.blacklistEntry
              }
            });
          }
          req.blacklistApproval = true;
          return next();
        }

        return res.status(403).json({
          status: 'error',
          message: 'Action not allowed - Guest is blacklisted',
          data: {
            blacklistEntry: validation.blacklistEntry,
            reason: validation.message,
            canOverride: allowOverride,
            requiresApproval: requireApproval
          }
        });
      }

      next();
    } catch (error) {
      console.error('Blacklist enforcement failed:', error);
      next();
    }
  });
};

/**
 * Middleware to log blacklist violations
 */
export const logBlacklistViolations = catchAsync(async (req, res, next) => {
  const originalSend = res.send;

  res.send = function(data) {
    // Check if this was a blacklist-related response
    if (res.statusCode === 403 && data) {
      try {
        const responseData = JSON.parse(data);
        if (responseData.data && responseData.data.blacklistEntry) {
          // Log blacklist violation
          console.log('Blacklist violation detected:', {
            guestId: responseData.data.blacklistEntry.guestId,
            reason: responseData.data.blacklistEntry.reason,
            attemptedAction: req.method + ' ' + req.originalUrl,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    originalSend.call(this, data);
  };

  next();
});

/**
 * Middleware to check blacklist status for guest lookup
 */
export const checkBlacklistForGuestLookup = catchAsync(async (req, res, next) => {
  const guestId = req.params.guestId || req.params.id;

  if (!guestId) {
    return next();
  }

  try {
    const blacklistEntry = await blacklistService.checkGuestBlacklist(
      guestId,
      req.user.hotelId
    );

    if (blacklistEntry) {
      // Add warning to response
      res.locals.blacklistWarning = {
        message: 'Guest is currently blacklisted',
        blacklistEntry: {
          reason: blacklistEntry.reason,
          type: blacklistEntry.type,
          category: blacklistEntry.category,
          incidentDate: blacklistEntry.incidentDate,
          expiryDate: blacklistEntry.expiryDate
        }
      };
    }

    next();
  } catch (error) {
    console.error('Failed to check blacklist for guest lookup:', error);
    next();
  }
});

export default {
  checkBlacklistForBooking,
  addBlacklistStatus,
  enforceBlacklistRestrictions,
  logBlacklistViolations,
  checkBlacklistForGuestLookup
};
