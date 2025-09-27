import express from 'express';
import UserSettings from '../models/UserSettings.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(authorize('admin', 'manager'));

// Encryption key for sensitive data (in production, this should be in environment variables)
const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

/**
 * Encrypt sensitive data like API keys and secrets
 */
function encryptSensitiveData(text) {
  if (!text) return text;
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/**
 * Decrypt sensitive data
 */
function decryptSensitiveData(text) {
  if (!text) return text;
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    logger.warn('Failed to decrypt sensitive data', { error: error.message });
    return text; // Return as-is if decryption fails (might be unencrypted legacy data)
  }
}

/**
 * GET /api/v1/integrations/settings
 * Get integration settings for the current user/hotel
 */
router.get('/settings', catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  // Get user settings
  let settings = await UserSettings.findOne({ userId }).populate('userId', 'name email role');

  // Create default settings if none exist
  if (!settings) {
    settings = await UserSettings.createDefaultSettings(userId, req.user.role);
    // Ensure integrations field exists
    settings.integrations = {
      payment: {
        stripe: { enabled: false, publicKey: '', secretKey: '' },
        razorpay: { enabled: false, keyId: '', keySecret: '' }
      },
      ota: {
        booking: { enabled: false, apiKey: '', hotelId: '' },
        expedia: { enabled: false, apiKey: '', hotelId: '' }
      },
      analytics: {
        googleAnalytics: { enabled: false, trackingId: '' },
        mixpanel: { enabled: false, token: '' }
      }
    };
    await settings.save();
  }

  // Initialize integrations field if it doesn't exist
  if (!settings.integrations) {
    settings.integrations = {
      payment: {
        stripe: { enabled: false, publicKey: '', secretKey: '' },
        razorpay: { enabled: false, keyId: '', keySecret: '' }
      },
      ota: {
        booking: { enabled: false, apiKey: '', hotelId: '' },
        expedia: { enabled: false, apiKey: '', hotelId: '' }
      },
      analytics: {
        googleAnalytics: { enabled: false, trackingId: '' },
        mixpanel: { enabled: false, token: '' }
      }
    };
    await settings.save();
  }

  // Extract integration settings
  const integrations = settings.integrations || {};

  // Decrypt sensitive data for response (but don't return actual secrets in production)
  const responseData = {
    payment: {
      stripe: {
        enabled: integrations.payment?.stripe?.enabled || false,
        publicKey: integrations.payment?.stripe?.publicKey || '',
        secretKey: integrations.payment?.stripe?.secretKey ? '••••••••' : '' // Mask secret key
      },
      razorpay: {
        enabled: integrations.payment?.razorpay?.enabled || false,
        keyId: integrations.payment?.razorpay?.keyId || '',
        keySecret: integrations.payment?.razorpay?.keySecret ? '••••••••' : '' // Mask secret
      }
    },
    ota: {
      booking: {
        enabled: integrations.ota?.booking?.enabled || false,
        apiKey: integrations.ota?.booking?.apiKey ? '••••••••' : '',
        hotelId: integrations.ota?.booking?.hotelId || ''
      },
      expedia: {
        enabled: integrations.ota?.expedia?.enabled || false,
        apiKey: integrations.ota?.expedia?.apiKey ? '••••••••' : '',
        hotelId: integrations.ota?.expedia?.hotelId || ''
      }
    },
    analytics: {
      googleAnalytics: {
        enabled: integrations.analytics?.googleAnalytics?.enabled || false,
        trackingId: integrations.analytics?.googleAnalytics?.trackingId || ''
      },
      mixpanel: {
        enabled: integrations.analytics?.mixpanel?.enabled || false,
        token: integrations.analytics?.mixpanel?.token ? '••••••••' : ''
      }
    }
  };

  logger.info(`Integration settings retrieved for user ${userId}`, {
    userId,
    role: req.user.role,
    enabledIntegrations: Object.keys(responseData).filter(key =>
      Object.values(responseData[key] || {}).some(integration => integration.enabled)
    )
  });

  res.status(200).json({
    status: 'success',
    data: responseData,
    meta: {
      lastModified: settings.lastModified,
      version: settings.version
    }
  });
}));

/**
 * PUT /api/v1/integrations/settings
 * Update integration settings
 */
router.put('/settings', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const integrationData = req.body;

  // Validate the integration data structure
  if (!integrationData || typeof integrationData !== 'object') {
    return next(new ApplicationError('Invalid integration data provided', 400));
  }

  // Get existing settings
  let settings = await UserSettings.findOne({ userId });

  // Create default settings if none exist
  if (!settings) {
    settings = await UserSettings.createDefaultSettings(userId, req.user.role);
    // Ensure integrations field exists
    settings.integrations = {
      payment: {
        stripe: { enabled: false, publicKey: '', secretKey: '' },
        razorpay: { enabled: false, keyId: '', keySecret: '' }
      },
      ota: {
        booking: { enabled: false, apiKey: '', hotelId: '' },
        expedia: { enabled: false, apiKey: '', hotelId: '' }
      },
      analytics: {
        googleAnalytics: { enabled: false, trackingId: '' },
        mixpanel: { enabled: false, token: '' }
      }
    };
    await settings.save();
  }

  // Validate role permissions (only admin/manager can update integrations)
  if (!['admin', 'manager'].includes(req.user.role)) {
    return next(new ApplicationError('Insufficient permissions to update integration settings', 403));
  }

  // Initialize integrations object if it doesn't exist
  if (!settings.integrations) {
    settings.integrations = {
      payment: {
        stripe: { enabled: false, publicKey: '', secretKey: '' },
        razorpay: { enabled: false, keyId: '', keySecret: '' }
      },
      ota: {
        booking: { enabled: false, apiKey: '', hotelId: '' },
        expedia: { enabled: false, apiKey: '', hotelId: '' }
      },
      analytics: {
        googleAnalytics: { enabled: false, trackingId: '' },
        mixpanel: { enabled: false, token: '' }
      }
    };
  }

  // Process payment integrations
  if (integrationData.payment) {
    if (!settings.integrations.payment) {
      settings.integrations.payment = {};
    }

    // Stripe integration
    if (integrationData.payment.stripe) {
      const stripeData = integrationData.payment.stripe;
      if (!settings.integrations.payment.stripe) {
        settings.integrations.payment.stripe = {};
      }

      settings.integrations.payment.stripe.enabled = Boolean(stripeData.enabled);
      if (stripeData.publicKey) {
        settings.integrations.payment.stripe.publicKey = stripeData.publicKey;
      }
      if (stripeData.secretKey && stripeData.secretKey !== '••••••••') {
        // Only update if a new secret key is provided (not masked)
        settings.integrations.payment.stripe.secretKey = encryptSensitiveData(stripeData.secretKey);
      }
    }

    // Razorpay integration
    if (integrationData.payment.razorpay) {
      const razorpayData = integrationData.payment.razorpay;
      if (!settings.integrations.payment.razorpay) {
        settings.integrations.payment.razorpay = {};
      }

      settings.integrations.payment.razorpay.enabled = Boolean(razorpayData.enabled);
      if (razorpayData.keyId) {
        settings.integrations.payment.razorpay.keyId = razorpayData.keyId;
      }
      if (razorpayData.keySecret && razorpayData.keySecret !== '••••••••') {
        settings.integrations.payment.razorpay.keySecret = encryptSensitiveData(razorpayData.keySecret);
      }
    }
  }

  // Process OTA integrations
  if (integrationData.ota) {
    if (!settings.integrations.ota) {
      settings.integrations.ota = {};
    }

    // Booking.com integration
    if (integrationData.ota.booking) {
      const bookingData = integrationData.ota.booking;
      if (!settings.integrations.ota.booking) {
        settings.integrations.ota.booking = {};
      }

      settings.integrations.ota.booking.enabled = Boolean(bookingData.enabled);
      if (bookingData.hotelId) {
        settings.integrations.ota.booking.hotelId = bookingData.hotelId;
      }
      if (bookingData.apiKey && bookingData.apiKey !== '••••••••') {
        settings.integrations.ota.booking.apiKey = encryptSensitiveData(bookingData.apiKey);
      }
    }

    // Expedia integration
    if (integrationData.ota.expedia) {
      const expediaData = integrationData.ota.expedia;
      if (!settings.integrations.ota.expedia) {
        settings.integrations.ota.expedia = {};
      }

      settings.integrations.ota.expedia.enabled = Boolean(expediaData.enabled);
      if (expediaData.hotelId) {
        settings.integrations.ota.expedia.hotelId = expediaData.hotelId;
      }
      if (expediaData.apiKey && expediaData.apiKey !== '••••••••') {
        settings.integrations.ota.expedia.apiKey = encryptSensitiveData(expediaData.apiKey);
      }
    }
  }

  // Process analytics integrations
  if (integrationData.analytics) {
    if (!settings.integrations.analytics) {
      settings.integrations.analytics = {};
    }

    // Google Analytics
    if (integrationData.analytics.googleAnalytics) {
      const gaData = integrationData.analytics.googleAnalytics;
      if (!settings.integrations.analytics.googleAnalytics) {
        settings.integrations.analytics.googleAnalytics = {};
      }

      settings.integrations.analytics.googleAnalytics.enabled = Boolean(gaData.enabled);
      if (gaData.trackingId) {
        settings.integrations.analytics.googleAnalytics.trackingId = gaData.trackingId;
      }
    }

    // Mixpanel
    if (integrationData.analytics.mixpanel) {
      const mixpanelData = integrationData.analytics.mixpanel;
      if (!settings.integrations.analytics.mixpanel) {
        settings.integrations.analytics.mixpanel = {};
      }

      settings.integrations.analytics.mixpanel.enabled = Boolean(mixpanelData.enabled);
      if (mixpanelData.token && mixpanelData.token !== '••••••••') {
        settings.integrations.analytics.mixpanel.token = encryptSensitiveData(mixpanelData.token);
      }
    }
  }

  // Update metadata
  settings.lastModified = new Date();
  settings.version += 1;

  // Save settings
  await settings.save();

  // Log the update
  logger.info(`Integration settings updated for user ${userId}`, {
    userId,
    role: req.user.role,
    updatedIntegrations: Object.keys(integrationData),
    timestamp: new Date().toISOString()
  });

  // Return success response (with masked sensitive data)
  const responseData = {
    payment: {
      stripe: {
        enabled: settings.integrations.payment?.stripe?.enabled || false,
        publicKey: settings.integrations.payment?.stripe?.publicKey || '',
        secretKey: settings.integrations.payment?.stripe?.secretKey ? '••••••••' : ''
      },
      razorpay: {
        enabled: settings.integrations.payment?.razorpay?.enabled || false,
        keyId: settings.integrations.payment?.razorpay?.keyId || '',
        keySecret: settings.integrations.payment?.razorpay?.keySecret ? '••••••••' : ''
      }
    },
    ota: {
      booking: {
        enabled: settings.integrations.ota?.booking?.enabled || false,
        apiKey: settings.integrations.ota?.booking?.apiKey ? '••••••••' : '',
        hotelId: settings.integrations.ota?.booking?.hotelId || ''
      },
      expedia: {
        enabled: settings.integrations.ota?.expedia?.enabled || false,
        apiKey: settings.integrations.ota?.expedia?.apiKey ? '••••••••' : '',
        hotelId: settings.integrations.ota?.expedia?.hotelId || ''
      }
    },
    analytics: {
      googleAnalytics: {
        enabled: settings.integrations.analytics?.googleAnalytics?.enabled || false,
        trackingId: settings.integrations.analytics?.googleAnalytics?.trackingId || ''
      },
      mixpanel: {
        enabled: settings.integrations.analytics?.mixpanel?.enabled || false,
        token: settings.integrations.analytics?.mixpanel?.token ? '••••••••' : ''
      }
    }
  };

  res.status(200).json({
    status: 'success',
    message: 'Integration settings updated successfully',
    data: responseData,
    meta: {
      lastModified: settings.lastModified,
      version: settings.version
    }
  });
}));

/**
 * GET /api/v1/integrations/health
 * Check the health status of all integrations
 */
router.get('/health', catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const settings = await UserSettings.findOne({ userId });

  if (!settings || !settings.integrations) {
    return res.status(200).json({
      status: 'success',
      data: {
        overall: 'no_integrations',
        integrations: {}
      }
    });
  }

  const healthStatus = {
    overall: 'healthy',
    integrations: {},
    lastChecked: new Date().toISOString()
  };

  // Check payment integrations
  if (settings.integrations.payment) {
    healthStatus.integrations.payment = {};

    if (settings.integrations.payment.stripe?.enabled) {
      healthStatus.integrations.payment.stripe = {
        enabled: true,
        status: settings.integrations.payment.stripe.publicKey && settings.integrations.payment.stripe.secretKey ? 'configured' : 'incomplete',
        message: settings.integrations.payment.stripe.publicKey && settings.integrations.payment.stripe.secretKey ? 'Ready' : 'Missing API keys'
      };
    }

    if (settings.integrations.payment.razorpay?.enabled) {
      healthStatus.integrations.payment.razorpay = {
        enabled: true,
        status: settings.integrations.payment.razorpay.keyId && settings.integrations.payment.razorpay.keySecret ? 'configured' : 'incomplete',
        message: settings.integrations.payment.razorpay.keyId && settings.integrations.payment.razorpay.keySecret ? 'Ready' : 'Missing API credentials'
      };
    }
  }

  // Check analytics integrations
  if (settings.integrations.analytics) {
    healthStatus.integrations.analytics = {};

    if (settings.integrations.analytics.googleAnalytics?.enabled) {
      healthStatus.integrations.analytics.googleAnalytics = {
        enabled: true,
        status: settings.integrations.analytics.googleAnalytics.trackingId ? 'configured' : 'incomplete',
        message: settings.integrations.analytics.googleAnalytics.trackingId ? 'Ready' : 'Missing tracking ID'
      };
    }
  }

  res.status(200).json({
    status: 'success',
    data: healthStatus
  });
}));

export default router;