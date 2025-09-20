import { BookingWidget, PromoCode, GuestCRM, EmailCampaign, LoyaltyProgram, LandingPage, ReviewManagement } from '../models/BookingEngine.js';
import BookingEngineService from '../services/bookingEngineService.js';
import WidgetTracking from '../models/WidgetTracking.js';
import { v4 as uuidv4 } from 'uuid';

const bookingEngineService = new BookingEngineService();

// Booking Widget Management
export const createBookingWidget = async (req, res) => {
  try {
    const widgetData = {
      ...req.body,
      widgetId: uuidv4()
    };
    
    const widget = new BookingWidget(widgetData);
    await widget.save();
    
    // Generate widget code
    const widgetCode = bookingEngineService.generateWidgetCode(widget.widgetId, widget.config);
    
    res.status(201).json({
      success: true,
      data: {
        widget,
        widgetCode
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getBookingWidgets = async (req, res) => {
  try {
    const widgets = await BookingWidget.find({ isActive: true })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: widgets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateBookingWidget = async (req, res) => {
  try {
    const widget = await BookingWidget.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!widget) {
      return res.status(404).json({
        success: false,
        message: 'Widget not found'
      });
    }
    
    // Regenerate widget code with updated config
    const widgetCode = bookingEngineService.generateWidgetCode(widget.widgetId, widget.config);
    
    res.json({
      success: true,
      data: {
        widget,
        widgetCode
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getWidgetCode = async (req, res) => {
  try {
    const { widgetId } = req.params;
    const { theme, language, currency } = req.query;
    
    const widget = await BookingWidget.findOne({ widgetId });
    if (!widget) {
      return res.status(404).json({
        success: false,
        message: 'Widget not found'
      });
    }
    
    const options = { theme, language, currency };
    const widgetCode = bookingEngineService.generateWidgetCode(widgetId, options);
    
    res.json({
      success: true,
      data: widgetCode
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Promo Code Management
export const createPromoCode = async (req, res) => {
  try {
    const {
      code, name, description, type, discountValue, maxAmount, minBookingValue,
      minNights, maxNights, applicableRoomTypes, firstTimeGuests, maxUsagePerGuest,
      combinableWithOtherOffers, startDate, endDate, totalUsageLimit, guestSegments,
      channels, isActive
    } = req.body;

    const promoData = {
      codeId: req.body.codeId || uuidv4(),
      code: code.toUpperCase(),
      name,
      description,
      type,
      discount: {
        value: discountValue,
        maxAmount
      },
      conditions: {
        minBookingValue,
        minNights,
        maxNights,
        applicableRoomTypes: applicableRoomTypes || [],
        firstTimeGuests: firstTimeGuests || false,
        maxUsagePerGuest: maxUsagePerGuest || 1,
        combinableWithOtherOffers: combinableWithOtherOffers || false
      },
      validity: {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      },
      usage: {
        totalUsageLimit,
        currentUsage: 0
      },
      targeting: {
        guestSegments: guestSegments || [],
        channels: channels || []
      },
      isActive: isActive !== false
    };

    const promoCode = new PromoCode(promoData);
    await promoCode.save();
    
    res.status(201).json({
      success: true,
      data: promoCode
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getPromoCodes = async (req, res) => {
  try {
    const { isActive, type } = req.query;
    const filter = {};
    
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (type) filter.type = type;
    
    const promoCodes = await PromoCode.find(filter)
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: promoCodes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const validatePromoCode = async (req, res) => {
  try {
    const { code, bookingValue, checkInDate, checkOutDate } = req.body;
    
    const validation = await bookingEngineService.validatePromoCode(
      code,
      bookingValue,
      new Date(checkInDate),
      new Date(checkOutDate)
    );
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updatePromoCode = async (req, res) => {
  try {
    const promoCode = await PromoCode.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }
    
    res.json({
      success: true,
      data: promoCode
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Guest CRM
export const getGuestCRM = async (req, res) => {
  try {
    const { segment, search, sortBy = 'lifetimeValue' } = req.query;
    const filter = {};
    
    if (segment) filter['segmentation.segment'] = segment;
    
    if (search) {
      filter.$or = [
        { 'profile.firstName': new RegExp(search, 'i') },
        { 'profile.lastName': new RegExp(search, 'i') },
        { 'profile.email': new RegExp(search, 'i') }
      ];
    }
    
    const sortOptions = {};
    sortOptions[`segmentation.${sortBy}`] = -1;
    
    const guests = await GuestCRM.find(filter)
      .sort(sortOptions)
      .limit(100);
    
    res.json({
      success: true,
      data: guests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getGuestProfile = async (req, res) => {
  try {
    const guest = await GuestCRM.findById(req.params.id);
    
    if (!guest) {
      return res.status(404).json({
        success: false,
        message: 'Guest not found'
      });
    }
    
    res.json({
      success: true,
      data: guest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateGuestProfile = async (req, res) => {
  try {
    const guest = await GuestCRM.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!guest) {
      return res.status(404).json({
        success: false,
        message: 'Guest not found'
      });
    }
    
    res.json({
      success: true,
      data: guest
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Email Campaign Management
export const createEmailCampaign = async (req, res) => {
  try {
    const campaignData = {
      ...req.body,
      campaignId: uuidv4()
    };
    
    const campaign = new EmailCampaign(campaignData);
    await campaign.save();
    
    res.status(201).json({
      success: true,
      data: campaign
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getEmailCampaigns = async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (type) filter.type = type;
    
    const campaigns = await EmailCampaign.find(filter)
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: campaigns
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const sendEmailCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { testEmail } = req.body;
    
    const results = await bookingEngineService.sendEmailCampaign(campaignId, testEmail);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getCampaignAnalytics = async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    
    const analytics = {
      ...campaign.tracking,
      openRate: campaign.tracking.sent > 0 ? (campaign.tracking.opens / campaign.tracking.sent) * 100 : 0,
      clickRate: campaign.tracking.sent > 0 ? (campaign.tracking.clicks / campaign.tracking.sent) * 100 : 0,
      conversionRate: campaign.tracking.sent > 0 ? (campaign.tracking.conversions / campaign.tracking.sent) * 100 : 0,
      bounceRate: campaign.tracking.sent > 0 ? (campaign.tracking.bounces / campaign.tracking.sent) * 100 : 0
    };
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Loyalty Program Management
export const createLoyaltyProgram = async (req, res) => {
  try {
    const programData = {
      ...req.body,
      programId: uuidv4()
    };
    
    const program = new LoyaltyProgram(programData);
    await program.save();
    
    res.status(201).json({
      success: true,
      data: program
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getLoyaltyPrograms = async (req, res) => {
  try {
    const programs = await LoyaltyProgram.find({ isActive: true })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: programs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const processLoyaltyPoints = async (req, res) => {
  try {
    const { guestId, action, bookingAmount } = req.body;
    
    const points = await bookingEngineService.generateLoyaltyPoints(
      guestId,
      action,
      bookingAmount
    );
    
    res.json({
      success: true,
      data: { pointsEarned: points }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Landing Page Management
export const createLandingPage = async (req, res) => {
  try {
    const pageData = {
      ...req.body,
      pageId: uuidv4()
    };
    
    // Generate SEO content
    pageData.seo = bookingEngineService.generateSEOContent(pageData);
    
    const page = new LandingPage(pageData);
    await page.save();
    
    res.status(201).json({
      success: true,
      data: page
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getLandingPages = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    const filter = {};
    
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const pages = await LandingPage.find(filter)
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: pages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getLandingPageAnalytics = async (req, res) => {
  try {
    const page = await LandingPage.findById(req.params.id);
    
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Landing page not found'
      });
    }
    
    res.json({
      success: true,
      data: page.analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Review Management
export const createReview = async (req, res) => {
  try {
    const review = await bookingEngineService.processReview(req.body);
    
    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getReviews = async (req, res) => {
  try {
    const { platform, rating, sentiment } = req.query;
    const filter = {};
    
    if (platform) filter.platform = platform;
    if (rating) filter['content.rating'] = { $gte: parseInt(rating) };
    if (sentiment) filter['sentiment.label'] = sentiment;
    
    const reviews = await ReviewManagement.find(filter)
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({
      success: true,
      data: reviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const respondToReview = async (req, res) => {
  try {
    const { response } = req.body;
    
    const review = await ReviewManagement.findByIdAndUpdate(
      req.params.id,
      {
        response: {
          content: response,
          respondedBy: req.user.id, // Assuming user is attached by auth middleware
          respondedAt: new Date(),
          approved: false
        }
      },
      { new: true }
    );
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const moderateReview = async (req, res) => {
  try {
    const { status, reason } = req.body;
    
    const review = await ReviewManagement.findByIdAndUpdate(
      req.params.id,
      {
        'moderation.status': status,
        'moderation.moderatedBy': req.user.id,
        'moderation.moderatedAt': new Date(),
        'moderation.reason': reason
      },
      { new: true }
    );
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Analytics and Dashboard
export const getMarketingDashboard = async (req, res) => {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    // Widget performance
    const widgets = await BookingWidget.find({ isActive: true });
    const widgetStats = widgets.reduce((acc, widget) => {
      acc.totalImpressions += widget.performance.impressions || 0;
      acc.totalClicks += widget.performance.clicks || 0;
      acc.totalConversions += widget.performance.conversions || 0;
      return acc;
    }, { totalImpressions: 0, totalClicks: 0, totalConversions: 0 });
    
    // Email campaign stats
    const campaigns = await EmailCampaign.find({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    const emailStats = campaigns.reduce((acc, campaign) => {
      acc.totalSent += campaign.tracking.sent || 0;
      acc.totalOpens += campaign.tracking.opens || 0;
      acc.totalClicks += campaign.tracking.clicks || 0;
      acc.totalConversions += campaign.tracking.conversions || 0;
      return acc;
    }, { totalSent: 0, totalOpens: 0, totalClicks: 0, totalConversions: 0 });
    
    // Guest segmentation
    const guestSegments = await GuestCRM.aggregate([
      {
        $group: {
          _id: '$segmentation.segment',
          count: { $sum: 1 },
          averageLTV: { $avg: '$segmentation.lifetimeValue' }
        }
      }
    ]);
    
    // Review summary
    const reviewStats = await ReviewManagement.aggregate([
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$content.rating' },
          positiveReviews: {
            $sum: { $cond: [{ $eq: ['$sentiment.label', 'positive'] }, 1, 0] }
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        widgetPerformance: {
          ...widgetStats,
          conversionRate: widgetStats.totalClicks > 0 ? (widgetStats.totalConversions / widgetStats.totalClicks) * 100 : 0
        },
        emailMarketing: {
          ...emailStats,
          openRate: emailStats.totalSent > 0 ? (emailStats.totalOpens / emailStats.totalSent) * 100 : 0,
          clickRate: emailStats.totalSent > 0 ? (emailStats.totalClicks / emailStats.totalSent) * 100 : 0
        },
        guestSegmentation: guestSegments,
        reviewSummary: reviewStats[0] || { totalReviews: 0, averageRating: 0, positiveReviews: 0 },
        totalWidgets: widgets.length,
        activeCampaigns: campaigns.filter(c => c.status === 'sending').length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Booking processing from widget
export const processWidgetBooking = async (req, res) => {
  try {
    const { widgetId } = req.params;

    const booking = await bookingEngineService.processWidgetBooking(req.body, widgetId);

    res.status(201).json({
      success: true,
      data: booking
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Widget Tracking Endpoints
export const trackWidgetEvent = async (req, res) => {
  try {
    const {
      widgetId,
      sessionId,
      event,
      url,
      referrer,
      userAgent,
      screenResolution,
      viewportSize,
      eventData,
      bookingData
    } = req.body;

    // Parse user agent for device information
    const deviceInfo = parseUserAgent(userAgent);

    // Parse URL parameters for UTM tracking
    const urlParams = url ? new URL(url) : null;
    const utmParams = urlParams ? {
      source: urlParams.searchParams.get('utm_source'),
      medium: urlParams.searchParams.get('utm_medium'),
      campaign: urlParams.searchParams.get('utm_campaign'),
      term: urlParams.searchParams.get('utm_term'),
      content: urlParams.searchParams.get('utm_content')
    } : {};

    // Create tracking record
    const tracking = new WidgetTracking({
      trackingId: uuidv4(),
      widgetId,
      sessionId,
      event,
      url,
      referrer,
      userAgent,
      ip: req.ip || req.connection.remoteAddress,
      screenResolution,
      viewportSize,
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      eventData: eventData || {},
      bookingData: bookingData || {},
      utmParams,
      isConversion: event === 'conversion',
      conversionValue: bookingData?.estimatedValue || 0,
      timestamp: new Date()
    });

    await tracking.save();

    // Update widget performance in real-time
    if (event === 'impression' || event === 'click' || event === 'conversion') {
      await updateWidgetPerformanceMetrics(widgetId, event, bookingData?.estimatedValue);
    }

    res.json({
      success: true,
      trackingId: tracking.trackingId
    });

  } catch (error) {
    console.error('Widget tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Tracking failed'
    });
  }
};

// Get widget analytics
export const getWidgetAnalytics = async (req, res) => {
  try {
    const { widgetId } = req.params;
    const { dateRange = 7 } = req.query;

    // Get basic performance metrics
    const performance = await WidgetTracking.getWidgetPerformance(widgetId, parseInt(dateRange));

    // Get conversion funnel
    const funnel = await WidgetTracking.getConversionFunnel(widgetId, parseInt(dateRange));

    // Get time-series data for charts
    const timeSeriesData = await getWidgetTimeSeriesData(widgetId, parseInt(dateRange));

    // Get geographic data
    const geoData = await getWidgetGeographicData(widgetId, parseInt(dateRange));

    // Get device/browser breakdown
    const deviceData = await getWidgetDeviceData(widgetId, parseInt(dateRange));

    res.json({
      success: true,
      data: {
        performance,
        funnel,
        timeSeries: timeSeriesData,
        geographic: geoData,
        devices: deviceData
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all widgets performance summary
export const getWidgetsPerformanceSummary = async (req, res) => {
  try {
    const { dateRange = 30 } = req.query;

    const topWidgets = await WidgetTracking.getTopPerformingWidgets(10, parseInt(dateRange));

    // Get overall metrics
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(dateRange));

    const overallMetrics = await WidgetTracking.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$event',
          count: { $sum: 1 },
          totalValue: { $sum: '$conversionValue' }
        }
      }
    ]);

    const summary = {
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: 0,
      overallConversionRate: 0
    };

    overallMetrics.forEach(metric => {
      switch (metric._id) {
        case 'impression':
          summary.totalImpressions = metric.count;
          break;
        case 'click':
          summary.totalClicks = metric.count;
          break;
        case 'conversion':
          summary.totalConversions = metric.count;
          summary.totalRevenue = metric.totalValue || 0;
          break;
      }
    });

    if (summary.totalClicks > 0) {
      summary.overallConversionRate = (summary.totalConversions / summary.totalClicks) * 100;
    }

    res.json({
      success: true,
      data: {
        summary,
        topWidgets
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper functions
function parseUserAgent(userAgent) {
  if (!userAgent) return { deviceType: 'unknown', browser: 'unknown', os: 'unknown' };

  const ua = userAgent.toLowerCase();

  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipod|blackberry|iemobile/.test(ua)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad/.test(ua)) {
    deviceType = 'tablet';
  }

  let browser = 'unknown';
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';

  let os = 'unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios')) os = 'iOS';

  return { deviceType, browser, os };
}

async function updateWidgetPerformanceMetrics(widgetId, event, value = 0) {
  try {
    const updateField = {};
    updateField[`performance.${event}s`] = 1;

    if (event === 'conversion' && value > 0) {
      // Update average booking value as well
      const widget = await BookingWidget.findOne({ widgetId });
      if (widget) {
        const currentTotal = (widget.performance.averageBookingValue || 0) * (widget.performance.conversions || 0);
        const newTotal = currentTotal + value;
        const newConversions = (widget.performance.conversions || 0) + 1;
        updateField['performance.averageBookingValue'] = newTotal / newConversions;
      }
    }

    await BookingWidget.findOneAndUpdate(
      { widgetId },
      { $inc: updateField },
      { new: true }
    );

    // Recalculate conversion rate
    const widget = await BookingWidget.findOne({ widgetId });
    if (widget && widget.performance.clicks > 0) {
      widget.performance.conversionRate =
        (widget.performance.conversions / widget.performance.clicks) * 100;
      await widget.save();
    }
  } catch (error) {
    console.error('Error updating widget metrics:', error);
  }
}

async function getWidgetTimeSeriesData(widgetId, days) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await WidgetTracking.aggregate([
    {
      $match: {
        widgetId,
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          event: '$event'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        events: {
          $push: {
            event: '$_id.event',
            count: '$count'
          }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
}

async function getWidgetGeographicData(widgetId, days) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await WidgetTracking.aggregate([
    {
      $match: {
        widgetId,
        timestamp: { $gte: startDate },
        country: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: '$country',
        impressions: { $sum: { $cond: [{ $eq: ['$event', 'impression'] }, 1, 0] } },
        conversions: { $sum: { $cond: [{ $eq: ['$event', 'conversion'] }, 1, 0] } }
      }
    },
    { $sort: { impressions: -1 } },
    { $limit: 10 }
  ]);
}

async function getWidgetDeviceData(widgetId, days) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await WidgetTracking.aggregate([
    {
      $match: {
        widgetId,
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          deviceType: '$deviceType',
          browser: '$browser'
        },
        impressions: { $sum: { $cond: [{ $eq: ['$event', 'impression'] }, 1, 0] } },
        conversions: { $sum: { $cond: [{ $eq: ['$event', 'conversion'] }, 1, 0] } }
      }
    },
    { $sort: { impressions: -1 } }
  ]);
}

export default {
  createBookingWidget,
  getBookingWidgets,
  updateBookingWidget,
  getWidgetCode,
  createPromoCode,
  getPromoCodes,
  validatePromoCode,
  updatePromoCode,
  getGuestCRM,
  getGuestProfile,
  updateGuestProfile,
  createEmailCampaign,
  getEmailCampaigns,
  sendEmailCampaign,
  getCampaignAnalytics,
  createLoyaltyProgram,
  getLoyaltyPrograms,
  processLoyaltyPoints,
  createLandingPage,
  getLandingPages,
  getLandingPageAnalytics,
  createReview,
  getReviews,
  respondToReview,
  moderateReview,
  getMarketingDashboard,
  processWidgetBooking,
  trackWidgetEvent,
  getWidgetAnalytics,
  getWidgetsPerformanceSummary
};
