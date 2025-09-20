import EmailCampaign from '../models/EmailCampaign.js';
import { enhancedEmailService } from '../services/enhancedEmailService.js';
import User from '../models/User.js';
import { AppError } from '../utils/appError.js';
import { catchAsync } from '../utils/catchAsync.js';
import cron from 'node-cron';

const scheduledJobs = new Map();

const createCampaign = catchAsync(async (req, res, next) => {
  const {
    name,
    subject,
    content,
    htmlContent,
    segmentCriteria,
    scheduledAt,
    template,
    personalization
  } = req.body;

  const campaign = new EmailCampaign({
    name,
    subject,
    content,
    htmlContent,
    segmentCriteria: segmentCriteria || {},
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    template,
    personalization: personalization || {},
    hotelId: req.user.hotelId,
    createdBy: req.user.id,
    status: scheduledAt ? 'scheduled' : 'draft'
  });

  await campaign.save();

  if (scheduledAt && new Date(scheduledAt) > new Date()) {
    await scheduleEmailCampaign(campaign);
  }

  res.status(201).json({
    success: true,
    message: 'Email campaign created successfully',
    data: { campaign }
  });
});

const getCampaigns = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const filter = { hotelId: req.user.hotelId };

  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } }
    ];
  }

  const campaigns = await EmailCampaign.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate('createdBy', 'name email');

  const total = await EmailCampaign.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: {
      campaigns,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalCampaigns: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  });
});

const getCampaign = catchAsync(async (req, res, next) => {
  const campaign = await EmailCampaign.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  }).populate('createdBy', 'name email');

  if (!campaign) {
    return next(new AppError('Campaign not found', 404));
  }

  res.status(200).json({
    success: true,
    data: { campaign }
  });
});

const updateCampaign = catchAsync(async (req, res, next) => {
  const { scheduledAt, ...updateData } = req.body;

  const campaign = await EmailCampaign.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });

  if (!campaign) {
    return next(new AppError('Campaign not found', 404));
  }

  if (campaign.status === 'sent') {
    return next(new AppError('Cannot update a campaign that has already been sent', 400));
  }

  if (scheduledAt && campaign.scheduledAt && scheduledJobs.has(campaign._id.toString())) {
    const existingJob = scheduledJobs.get(campaign._id.toString());
    existingJob.destroy();
    scheduledJobs.delete(campaign._id.toString());
  }

  Object.assign(campaign, updateData);

  if (scheduledAt) {
    campaign.scheduledAt = new Date(scheduledAt);
    campaign.status = 'scheduled';
    await scheduleEmailCampaign(campaign);
  }

  await campaign.save();

  res.status(200).json({
    success: true,
    message: 'Campaign updated successfully',
    data: { campaign }
  });
});

const sendCampaign = catchAsync(async (req, res, next) => {
  const campaign = await EmailCampaign.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });

  if (!campaign) {
    return next(new AppError('Campaign not found', 404));
  }

  if (campaign.status === 'sent') {
    return next(new AppError('Campaign has already been sent', 400));
  }

  campaign.status = 'sending';
  campaign.sentAt = new Date();
  await campaign.save();

  try {
    const result = await enhancedEmailService.sendCampaign(campaign._id.toString());

    campaign.status = 'sent';
    campaign.analytics.totalSent = result.totalSent;
    campaign.analytics.totalFailed = result.totalFailed;
    await campaign.save();

    if (scheduledJobs.has(campaign._id.toString())) {
      const job = scheduledJobs.get(campaign._id.toString());
      job.destroy();
      scheduledJobs.delete(campaign._id.toString());
    }

    res.status(200).json({
      success: true,
      message: 'Campaign sent successfully',
      data: {
        campaign,
        result: {
          totalSent: result.totalSent,
          totalFailed: result.totalFailed
        }
      }
    });
  } catch (error) {
    campaign.status = 'failed';
    campaign.analytics.lastError = error.message;
    await campaign.save();

    return next(new AppError(`Failed to send campaign: ${error.message}`, 500));
  }
});

const duplicateCampaign = catchAsync(async (req, res, next) => {
  const originalCampaign = await EmailCampaign.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });

  if (!originalCampaign) {
    return next(new AppError('Campaign not found', 404));
  }

  const duplicatedCampaign = new EmailCampaign({
    name: `${originalCampaign.name} (Copy)`,
    subject: originalCampaign.subject,
    content: originalCampaign.content,
    htmlContent: originalCampaign.htmlContent,
    segmentCriteria: originalCampaign.segmentCriteria,
    template: originalCampaign.template,
    personalization: originalCampaign.personalization,
    hotelId: req.user.hotelId,
    createdBy: req.user.id,
    status: 'draft'
  });

  await duplicatedCampaign.save();

  res.status(201).json({
    success: true,
    message: 'Campaign duplicated successfully',
    data: { campaign: duplicatedCampaign }
  });
});

const deleteCampaign = catchAsync(async (req, res, next) => {
  const campaign = await EmailCampaign.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });

  if (!campaign) {
    return next(new AppError('Campaign not found', 404));
  }

  if (campaign.status === 'sending') {
    return next(new AppError('Cannot delete a campaign that is currently being sent', 400));
  }

  if (scheduledJobs.has(campaign._id.toString())) {
    const job = scheduledJobs.get(campaign._id.toString());
    job.destroy();
    scheduledJobs.delete(campaign._id.toString());
  }

  await EmailCampaign.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Campaign deleted successfully'
  });
});

const previewCampaign = catchAsync(async (req, res, next) => {
  const { userId } = req.body;

  const campaign = await EmailCampaign.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });

  if (!campaign) {
    return next(new AppError('Campaign not found', 404));
  }

  let previewUser = null;
  if (userId) {
    previewUser = await User.findById(userId);
  }

  if (!previewUser) {
    previewUser = {
      name: 'John Doe',
      email: 'preview@example.com',
      personalizedData: {
        loyaltyPoints: 1250,
        totalBookings: 5,
        lastBookingDate: new Date(),
        preferredRoomType: 'Deluxe Suite'
      }
    };
  }

  const personalizedContent = await enhancedEmailService.personalizeContent(
    campaign.htmlContent || campaign.content,
    previewUser,
    campaign.personalization
  );

  const personalizedSubject = await enhancedEmailService.personalizeContent(
    campaign.subject,
    previewUser,
    campaign.personalization
  );

  res.status(200).json({
    success: true,
    data: {
      subject: personalizedSubject,
      content: personalizedContent,
      previewUser: {
        name: previewUser.name,
        email: previewUser.email
      }
    }
  });
});

const getAudienceCount = catchAsync(async (req, res, next) => {
  const { segmentCriteria } = req.body;

  const filter = { hotelId: req.user.hotelId };

  if (segmentCriteria) {
    if (segmentCriteria.role) filter.role = segmentCriteria.role;
    if (segmentCriteria.isActive !== undefined) filter.isActive = segmentCriteria.isActive;
    if (segmentCriteria.lastLoginAfter) {
      filter.lastLogin = { $gte: new Date(segmentCriteria.lastLoginAfter) };
    }
    if (segmentCriteria.totalBookingsMin) {
      filter.totalBookings = { $gte: segmentCriteria.totalBookingsMin };
    }
  }

  const count = await User.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: { audienceCount: count }
  });
});

const getCampaignAnalytics = catchAsync(async (req, res, next) => {
  const campaign = await EmailCampaign.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });

  if (!campaign) {
    return next(new AppError('Campaign not found', 404));
  }

  const analytics = {
    ...campaign.analytics.toObject(),
    openRate: campaign.analytics.totalSent > 0
      ? ((campaign.analytics.totalOpened / campaign.analytics.totalSent) * 100).toFixed(2)
      : 0,
    clickRate: campaign.analytics.totalSent > 0
      ? ((campaign.analytics.totalClicked / campaign.analytics.totalSent) * 100).toFixed(2)
      : 0,
    unsubscribeRate: campaign.analytics.totalSent > 0
      ? ((campaign.analytics.totalUnsubscribed / campaign.analytics.totalSent) * 100).toFixed(2)
      : 0
  };

  res.status(200).json({
    success: true,
    data: { analytics }
  });
});

const scheduleEmailCampaign = async (campaign) => {
  const cronTime = getCronExpression(campaign.scheduledAt);

  const job = cron.schedule(cronTime, async () => {
    try {
      const currentCampaign = await EmailCampaign.findById(campaign._id);
      if (currentCampaign && currentCampaign.status === 'scheduled') {
        currentCampaign.status = 'sending';
        currentCampaign.sentAt = new Date();
        await currentCampaign.save();

        const result = await enhancedEmailService.sendCampaign(campaign._id.toString());

        currentCampaign.status = 'sent';
        currentCampaign.analytics.totalSent = result.totalSent;
        currentCampaign.analytics.totalFailed = result.totalFailed;
        await currentCampaign.save();
      }
    } catch (error) {
      console.error('Scheduled campaign failed:', error);
      const currentCampaign = await EmailCampaign.findById(campaign._id);
      if (currentCampaign) {
        currentCampaign.status = 'failed';
        currentCampaign.analytics.lastError = error.message;
        await currentCampaign.save();
      }
    } finally {
      scheduledJobs.delete(campaign._id.toString());
    }
  }, {
    scheduled: false
  });

  job.start();
  scheduledJobs.set(campaign._id.toString(), job);

  console.log(`📅 Campaign "${campaign.name}" scheduled for ${campaign.scheduledAt}`);
};

const getCronExpression = (date) => {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return `${minute} ${hour} ${day} ${month} *`;
};

const getScheduledCampaigns = catchAsync(async (req, res, next) => {
  const scheduledCampaigns = await EmailCampaign.find({
    hotelId: req.user.hotelId,
    status: 'scheduled',
    scheduledAt: { $gte: new Date() }
  }).sort({ scheduledAt: 1 });

  const campaignsWithJobs = scheduledCampaigns.map(campaign => ({
    ...campaign.toObject(),
    isJobActive: scheduledJobs.has(campaign._id.toString())
  }));

  res.status(200).json({
    success: true,
    data: {
      scheduledCampaigns: campaignsWithJobs,
      totalActive: scheduledJobs.size
    }
  });
});

const reinitializeScheduledCampaigns = async () => {
  try {
    const scheduledCampaigns = await EmailCampaign.find({
      status: 'scheduled',
      scheduledAt: { $gte: new Date() }
    });

    for (const campaign of scheduledCampaigns) {
      if (!scheduledJobs.has(campaign._id.toString())) {
        await scheduleEmailCampaign(campaign);
      }
    }

    console.log(`📅 Reinitialized ${scheduledCampaigns.length} scheduled campaigns`);
  } catch (error) {
    console.error('Failed to reinitialize scheduled campaigns:', error);
  }
};

process.on('SIGTERM', () => {
  console.log('🔄 Gracefully shutting down email scheduler...');
  scheduledJobs.forEach((job, campaignId) => {
    job.destroy();
    console.log(`📅 Stopped scheduled job for campaign ${campaignId}`);
  });
  scheduledJobs.clear();
});

setTimeout(reinitializeScheduledCampaigns, 5000);

export {
  createCampaign,
  getCampaigns,
  getCampaign,
  updateCampaign,
  sendCampaign,
  duplicateCampaign,
  deleteCampaign,
  previewCampaign,
  getAudienceCount,
  getCampaignAnalytics,
  getScheduledCampaigns,
  reinitializeScheduledCampaigns
};