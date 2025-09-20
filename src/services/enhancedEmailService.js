import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { EmailCampaign, GuestCRM } from '../models/BookingEngine.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

class EnhancedEmailService {
  constructor() {
    this.transporter = this.createTransporter();
    this.trackingDomain = process.env.EMAIL_TRACKING_DOMAIN || 'http://localhost:4000';
    this.unsubscribeUrl = process.env.EMAIL_UNSUBSCRIBE_URL || 'http://localhost:3000/unsubscribe';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  createTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn('SMTP credentials not configured. Email functionality will be disabled.');
      return null;
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /**
   * Send email campaign to targeted recipients
   */
  async sendCampaign(campaignId, testEmail = null) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not configured');
      }

      const campaign = await EmailCampaign.findOne({ campaignId });
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      console.log(`📧 Starting email campaign: ${campaign.name}`);

      let recipients = [];

      if (testEmail) {
        // Test mode - send only to specified email
        recipients = [{
          email: testEmail,
          name: 'Test User',
          guestId: null,
          preferences: {},
          bookingHistory: {}
        }];
      } else {
        // Get recipients based on targeting criteria
        recipients = await this.getCampaignRecipients(campaign);
      }

      console.log(`👥 Found ${recipients.length} recipients`);

      const results = {
        campaignId,
        sent: 0,
        failed: 0,
        errors: [],
        trackingIds: []
      };

      // Process recipients in batches to avoid overwhelming SMTP
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < recipients.length; i += batchSize) {
        batches.push(recipients.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`📤 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} emails)`);

        const batchPromises = batch.map(async (recipient) => {
          try {
            const emailResult = await this.sendEmailToRecipient(campaign, recipient);
            results.sent++;
            results.trackingIds.push(emailResult.trackingId);

            // Track email send event
            await this.trackEmailEvent(campaignId, recipient.email, 'sent', emailResult.trackingId);

          } catch (error) {
            results.failed++;
            results.errors.push({
              email: recipient.email,
              error: error.message
            });
            logger.error(`Failed to send email to ${recipient.email}:`, error);
          }
        });

        await Promise.all(batchPromises);

        // Add delay between batches to respect rate limits
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update campaign stats
      campaign.tracking.sent += results.sent;
      campaign.status = 'sent';
      campaign.lastSentAt = new Date();
      await campaign.save();

      console.log(`✅ Campaign completed: ${results.sent} sent, ${results.failed} failed`);
      return results;

    } catch (error) {
      logger.error('Campaign send failed:', error);
      throw error;
    }
  }

  /**
   * Send email to individual recipient with personalization and tracking
   */
  async sendEmailToRecipient(campaign, recipient) {
    const trackingId = uuidv4();

    // Personalize content
    const personalizedContent = this.personalizeContent(campaign.content, recipient);

    // Add tracking pixels and links
    const htmlWithTracking = this.addEmailTracking(personalizedContent.htmlContent, campaign.campaignId, recipient.email, trackingId);

    const mailOptions = {
      from: process.env.FROM_EMAIL || `"THE PENTOUZ Hotels" <${process.env.SMTP_USER}>`,
      to: recipient.email,
      subject: personalizedContent.subject,
      html: htmlWithTracking,
      text: personalizedContent.textContent,
      headers: {
        'X-Campaign-ID': campaign.campaignId,
        'X-Tracking-ID': trackingId,
        'List-Unsubscribe': `<${this.unsubscribeUrl}?email=${encodeURIComponent(recipient.email)}&campaign=${campaign.campaignId}>`
      }
    };

    const info = await this.transporter.sendMail(mailOptions);

    return {
      messageId: info.messageId,
      trackingId: trackingId,
      recipient: recipient.email
    };
  }

  /**
   * Get campaign recipients based on targeting criteria
   */
  async getCampaignRecipients(campaign) {
    try {
      const matchConditions = {
        'profile.email': { $exists: true, $ne: null }
      };

      // Apply segment targeting
      if (campaign.targeting.segments && campaign.targeting.segments.length > 0) {
        matchConditions['segmentation.segment'] = { $in: campaign.targeting.segments };
      }

      // Apply criteria targeting
      if (campaign.targeting.criteria) {
        const criteria = campaign.targeting.criteria;

        // Last booking date filter
        if (criteria.lastBookingDays) {
          const daysAgo = new Date();
          daysAgo.setDate(daysAgo.getDate() - criteria.lastBookingDays);
          matchConditions['bookingHistory.lastBookingDate'] = { $gte: daysAgo };
        }

        // Spending amount filter
        if (criteria.spentAmount) {
          if (criteria.spentAmount.min) {
            matchConditions['bookingHistory.totalSpent'] = {
              $gte: criteria.spentAmount.min
            };
          }
          if (criteria.spentAmount.max) {
            matchConditions['bookingHistory.totalSpent'] = {
              ...matchConditions['bookingHistory.totalSpent'],
              $lte: criteria.spentAmount.max
            };
          }
        }

        // Location filter
        if (criteria.location && criteria.location.length > 0) {
          matchConditions['profile.country'] = { $in: criteria.location };
        }

        // Age group filter
        if (criteria.ageGroup && criteria.ageGroup.length > 0) {
          matchConditions['demographics.ageGroup'] = { $in: criteria.ageGroup };
        }
      }

      // Exclude unsubscribed users
      if (campaign.targeting.excludeUnsubscribed) {
        matchConditions['engagement.emailEngagement.unsubscribed'] = { $ne: true };
      }

      // Exclude users who received emails recently
      if (campaign.targeting.excludeRecent) {
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - campaign.targeting.excludeRecent);
        matchConditions['engagement.emailEngagement.lastSent'] = { $lt: recentDate };
      }

      const recipients = await GuestCRM.find(matchConditions).limit(10000); // Safety limit

      return recipients.map(guest => ({
        email: guest.profile.email,
        name: `${guest.profile.firstName || ''} ${guest.profile.lastName || ''}`.trim() || 'Guest',
        guestId: guest._id,
        preferences: guest.preferences || {},
        bookingHistory: guest.bookingHistory || {},
        segmentation: guest.segmentation || {}
      }));

    } catch (error) {
      logger.error('Error getting campaign recipients:', error);
      return [];
    }
  }

  /**
   * Personalize email content with recipient data
   */
  personalizeContent(content, recipient) {
    let personalizedSubject = content.subject;
    let personalizedHtml = content.htmlContent || this.getDefaultHtmlTemplate();
    let personalizedText = content.textContent || 'This email requires HTML support.';

    // Define replacement variables
    const replacements = {
      '{{firstName}}': recipient.name.split(' ')[0] || 'Guest',
      '{{fullName}}': recipient.name || 'Guest',
      '{{email}}': recipient.email,
      '{{lastBookingDate}}': recipient.bookingHistory?.lastBookingDate
        ? new Date(recipient.bookingHistory.lastBookingDate).toLocaleDateString()
        : 'N/A',
      '{{totalBookings}}': recipient.bookingHistory?.totalBookings?.toString() || '0',
      '{{totalSpent}}': recipient.bookingHistory?.totalSpent
        ? `₹${recipient.bookingHistory.totalSpent.toLocaleString()}`
        : '₹0',
      '{{loyaltyTier}}': recipient.segmentation?.loyaltyTier || 'Bronze',
      '{{segment}}': recipient.segmentation?.segment || 'new',
      '{{currentYear}}': new Date().getFullYear().toString(),
      '{{hotelName}}': 'THE PENTOUZ',
      '{{websiteUrl}}': this.frontendUrl,
      '{{supportEmail}}': process.env.SMTP_USER || 'support@thepentouz.com'
    };

    // Apply replacements
    Object.entries(replacements).forEach(([placeholder, value]) => {
      const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
      personalizedSubject = personalizedSubject.replace(regex, value);
      personalizedHtml = personalizedHtml.replace(regex, value);
      personalizedText = personalizedText.replace(regex, value);
    });

    return {
      subject: personalizedSubject,
      htmlContent: personalizedHtml,
      textContent: personalizedText
    };
  }

  /**
   * Add email tracking pixels and link tracking
   */
  addEmailTracking(htmlContent, campaignId, email, trackingId) {
    // Add tracking pixel (1x1 transparent image)
    const trackingPixel = `<img src="${this.trackingDomain}/api/v1/email/track/open?campaign=${campaignId}&email=${encodeURIComponent(email)}&tracking=${trackingId}" width="1" height="1" style="display:none;" alt="">`;

    // Add unsubscribe link if not present
    if (!htmlContent.includes('unsubscribe')) {
      const unsubscribeLink = `<div style="text-align: center; margin: 20px 0; padding: 10px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
        If you no longer wish to receive these emails, you can <a href="${this.unsubscribeUrl}?email=${encodeURIComponent(email)}&campaign=${campaignId}" style="color: #3b82f6; text-decoration: none;">unsubscribe here</a>.
      </div>`;

      htmlContent = htmlContent.replace('</body>', unsubscribeLink + '</body>');
    }

    // Add tracking pixel before closing body tag
    htmlContent = htmlContent.replace('</body>', trackingPixel + '</body>');

    // Track clicks on links (add click tracking to existing links)
    htmlContent = htmlContent.replace(
      /<a\s+href="([^"]*)"([^>]*)>/gi,
      (match, url, attributes) => {
        if (url.startsWith('http') && !url.includes('/email/track/')) {
          const trackingUrl = `${this.trackingDomain}/api/v1/email/track/click?campaign=${campaignId}&email=${encodeURIComponent(email)}&tracking=${trackingId}&url=${encodeURIComponent(url)}`;
          return `<a href="${trackingUrl}"${attributes}>`;
        }
        return match;
      }
    );

    return htmlContent;
  }

  /**
   * Track email events (opens, clicks, bounces, unsubscribes)
   */
  async trackEmailEvent(campaignId, email, event, trackingId, data = {}) {
    try {
      const campaign = await EmailCampaign.findOne({ campaignId });
      if (!campaign) return;

      // Update campaign tracking stats
      switch (event) {
        case 'sent':
          // Already handled in sendCampaign
          break;
        case 'open':
          campaign.tracking.opens += 1;
          break;
        case 'click':
          campaign.tracking.clicks += 1;
          break;
        case 'bounce':
          campaign.tracking.bounces += 1;
          break;
        case 'unsubscribe':
          campaign.tracking.unsubscribes += 1;
          // Update guest CRM
          await GuestCRM.updateOne(
            { 'profile.email': email },
            {
              'engagement.emailEngagement.unsubscribed': true,
              'engagement.emailEngagement.unsubscribedAt': new Date()
            }
          );
          break;
        case 'conversion':
          campaign.tracking.conversions += 1;
          if (data.revenue) {
            campaign.tracking.revenue += data.revenue;
          }
          break;
      }

      await campaign.save();

      // Update guest engagement metrics
      if (event === 'open' || event === 'click') {
        await GuestCRM.updateOne(
          { 'profile.email': email },
          {
            $inc: {
              [`engagement.emailEngagement.${event}s`]: 1
            },
            $set: {
              'engagement.emailEngagement.lastOpened': new Date(),
              'engagement.emailEngagement.lastSent': new Date()
            }
          }
        );
      }

      logger.info(`Email ${event} tracked: ${email} - Campaign: ${campaignId}`);

    } catch (error) {
      logger.error('Error tracking email event:', error);
    }
  }

  /**
   * Send automated emails (booking confirmations, password resets, etc.)
   */
  async sendTransactionalEmail(type, recipient, data = {}) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not configured');
      }

      const templates = {
        booking_confirmation: {
          subject: '✅ Booking Confirmation - {{bookingNumber}}',
          template: 'booking-confirmation'
        },
        password_reset: {
          subject: '🔐 Reset Your Password - THE PENTOUZ',
          template: 'password-reset'
        },
        welcome: {
          subject: '🏨 Welcome to THE PENTOUZ!',
          template: 'welcome'
        },
        booking_reminder: {
          subject: '📅 Your Stay is Tomorrow - {{bookingNumber}}',
          template: 'booking-reminder'
        }
      };

      const emailTemplate = templates[type];
      if (!emailTemplate) {
        throw new Error(`Unknown email template: ${type}`);
      }

      const htmlContent = await this.getEmailTemplate(emailTemplate.template, data);
      const personalizedSubject = this.personalizeString(emailTemplate.subject, data);

      const mailOptions = {
        from: process.env.FROM_EMAIL || `"THE PENTOUZ Hotels" <${process.env.SMTP_USER}>`,
        to: recipient,
        subject: personalizedSubject,
        html: htmlContent,
        headers: {
          'X-Email-Type': type,
          'X-Tracking-ID': uuidv4()
        }
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Transactional email sent: ${type} to ${recipient}`);

      return {
        messageId: info.messageId,
        type: type,
        recipient: recipient
      };

    } catch (error) {
      logger.error(`Failed to send ${type} email to ${recipient}:`, error);
      throw error;
    }
  }

  /**
   * Get default HTML template for emails
   */
  getDefaultHtmlTemplate() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{hotelName}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">🏨 {{hotelName}}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Luxury & Comfort Redefined</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
            <h2 style="color: #1f2937; margin-top: 0;">Hello {{firstName}}!</h2>

            <p style="color: #4b5563; line-height: 1.6;">
                Thank you for being a valued guest of THE PENTOUZ. We have exciting updates and exclusive offers just for you!
            </p>

            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #1e40af; margin-top: 0;">🎯 Personalized for You</h3>
                <ul style="color: #1e40af; margin: 0;">
                    <li><strong>Loyalty Tier:</strong> {{loyaltyTier}}</li>
                    <li><strong>Total Bookings:</strong> {{totalBookings}}</li>
                    <li><strong>Total Spent:</strong> {{totalSpent}}</li>
                </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{websiteUrl}}" style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                    Visit Our Website
                </a>
            </div>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
                THE PENTOUZ Hotels | Luxury & Comfort Redefined
            </p>
            <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 12px;">
                Contact us: {{supportEmail}} | Visit: {{websiteUrl}}
            </p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Get specific email template
   */
  async getEmailTemplate(templateName, data = {}) {
    try {
      // For now, return default template with customizations based on type
      let template = this.getDefaultHtmlTemplate();

      // Customize based on template type
      switch (templateName) {
        case 'booking-confirmation':
          template = template.replace(
            'Thank you for being a valued guest of THE PENTOUZ. We have exciting updates and exclusive offers just for you!',
            `Your booking has been confirmed! We look forward to welcoming you on ${data.checkinDate || 'your arrival date'}.`
          );
          break;
        case 'welcome':
          template = template.replace(
            'Thank you for being a valued guest of THE PENTOUZ. We have exciting updates and exclusive offers just for you!',
            'Welcome to THE PENTOUZ family! We\'re excited to have you join us and look forward to providing you with exceptional hospitality.'
          );
          break;
        case 'password-reset':
          template = template.replace(
            'Thank you for being a valued guest of THE PENTOUZ. We have exciting updates and exclusive offers just for you!',
            `We received a request to reset your password. Click the link below to create a new password: <a href="${data.resetUrl || '#'}">Reset Password</a>`
          );
          break;
      }

      return template;
    } catch (error) {
      logger.error(`Error loading email template ${templateName}:`, error);
      return this.getDefaultHtmlTemplate();
    }
  }

  /**
   * Personalize a single string with data
   */
  personalizeString(string, data) {
    let result = string;
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    });
    return result;
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection() {
    if (!this.transporter) {
      throw new Error('Email transporter not configured');
    }

    return await this.transporter.verify();
  }

  /**
   * Get email statistics
   */
  async getEmailStats(dateRange = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const campaigns = await EmailCampaign.find({
        updatedAt: { $gte: startDate }
      });

      const stats = {
        totalCampaigns: campaigns.length,
        totalSent: campaigns.reduce((sum, c) => sum + (c.tracking?.sent || 0), 0),
        totalOpens: campaigns.reduce((sum, c) => sum + (c.tracking?.opens || 0), 0),
        totalClicks: campaigns.reduce((sum, c) => sum + (c.tracking?.clicks || 0), 0),
        totalBounces: campaigns.reduce((sum, c) => sum + (c.tracking?.bounces || 0), 0),
        totalUnsubscribes: campaigns.reduce((sum, c) => sum + (c.tracking?.unsubscribes || 0), 0),
        totalConversions: campaigns.reduce((sum, c) => sum + (c.tracking?.conversions || 0), 0),
        totalRevenue: campaigns.reduce((sum, c) => sum + (c.tracking?.revenue || 0), 0)
      };

      stats.openRate = stats.totalSent > 0 ? (stats.totalOpens / stats.totalSent) * 100 : 0;
      stats.clickRate = stats.totalSent > 0 ? (stats.totalClicks / stats.totalSent) * 100 : 0;
      stats.bounceRate = stats.totalSent > 0 ? (stats.totalBounces / stats.totalSent) * 100 : 0;
      stats.unsubscribeRate = stats.totalSent > 0 ? (stats.totalUnsubscribes / stats.totalSent) * 100 : 0;
      stats.conversionRate = stats.totalSent > 0 ? (stats.totalConversions / stats.totalSent) * 100 : 0;

      return stats;
    } catch (error) {
      logger.error('Error getting email stats:', error);
      return {};
    }
  }
}

const enhancedEmailService = new EnhancedEmailService();

export { enhancedEmailService };
export default EnhancedEmailService;