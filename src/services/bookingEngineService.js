import { BookingWidget, PromoCode, GuestCRM, EmailCampaign, LoyaltyProgram, LandingPage, ReviewManagement } from '../models/BookingEngine.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Room from '../models/Room.js';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

class BookingEngineService {
  constructor() {
    this.emailTransporter = this.setupEmailTransporter();
  }

  setupEmailTransporter() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /**
   * Generate booking widget code
   */
  generateWidgetCode(widgetId, options = {}) {
    const baseUrl = process.env.FRONTEND_URL || 'https://yourhotel.com';
    const config = {
      widgetId,
      theme: options.theme || 'default',
      language: options.language || 'en',
      currency: options.currency || 'INR',
      ...options
    };

    const scriptUrl = `${baseUrl}/widget.js`;
    const widgetCode = `
<!-- Hotel Booking Widget -->
<div id="booking-widget-${widgetId}"></div>
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${scriptUrl}';
    script.async = true;
    script.onload = function() {
      HotelBookingWidget.init(${JSON.stringify(config)});
    };
    document.head.appendChild(script);
  })();
</script>
<!-- End Hotel Booking Widget -->`;

    return {
      code: widgetCode,
      config,
      previewUrl: `${baseUrl}/widget-preview/${widgetId}`
    };
  }

  /**
   * Process booking from widget
   */
  async processWidgetBooking(bookingData, widgetId) {
    try {
      // Validate promo code if provided
      let discount = 0;
      if (bookingData.promoCode) {
        const promoValidation = await this.validatePromoCode(
          bookingData.promoCode,
          bookingData.totalAmount,
          bookingData.checkInDate,
          bookingData.checkOutDate
        );
        
        if (promoValidation.valid) {
          discount = promoValidation.discount;
          bookingData.totalAmount -= discount;
        }
      }

      // Create booking
      const booking = new Booking({
        bookingId: uuidv4(),
        ...bookingData,
        source: 'website_widget',
        widgetId,
        discount,
        status: 'pending'
      });

      await booking.save();

      // Update widget performance
      await this.updateWidgetPerformance(widgetId, 'conversion');

      // Send confirmation email
      await this.sendBookingConfirmationEmail(booking);

      // Update guest CRM profile
      await this.updateGuestCRM(booking.guest, booking);

      return booking;
    } catch (error) {
      console.error('Error processing widget booking:', error);
      throw error;
    }
  }

  /**
   * Validate promo code
   */
  async validatePromoCode(code, bookingValue, checkInDate, checkOutDate) {
    const promoCode = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true,
      'validity.startDate': { $lte: new Date() },
      'validity.endDate': { $gte: new Date() }
    });

    if (!promoCode) {
      return { valid: false, message: 'Invalid or expired promo code' };
    }

    // Check usage limits
    if (promoCode.usage.totalUsageLimit && promoCode.usage.currentUsage >= promoCode.usage.totalUsageLimit) {
      return { valid: false, message: 'Promo code usage limit reached' };
    }

    // Check conditions
    const conditions = promoCode.conditions;
    
    if (conditions.minBookingValue && bookingValue < conditions.minBookingValue) {
      return { valid: false, message: `Minimum booking value of ${conditions.minBookingValue} required` };
    }

    const nights = Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24));
    
    if (conditions.minNights && nights < conditions.minNights) {
      return { valid: false, message: `Minimum ${conditions.minNights} nights required` };
    }

    if (conditions.maxNights && nights > conditions.maxNights) {
      return { valid: false, message: `Maximum ${conditions.maxNights} nights allowed` };
    }

    // Calculate discount
    let discount = 0;
    switch (promoCode.type) {
      case 'percentage':
        discount = (bookingValue * promoCode.discount.value) / 100;
        if (promoCode.discount.maxAmount) {
          discount = Math.min(discount, promoCode.discount.maxAmount);
        }
        break;
      case 'fixed_amount':
        discount = promoCode.discount.value;
        break;
      case 'free_night':
        // Calculate one night's average rate
        discount = bookingValue / nights;
        break;
      default:
        discount = 0;
    }

    return {
      valid: true,
      discount,
      promoCode
    };
  }

  /**
   * Update guest CRM profile
   */
  async updateGuestCRM(guestData, booking) {
    try {
      let guestCRM = await GuestCRM.findOne({ 
        $or: [
          { 'profile.email': guestData.email },
          { guestId: guestData.userId }
        ]
      });

      if (!guestCRM) {
        guestCRM = new GuestCRM({
          guestId: guestData.userId,
          profile: {
            firstName: guestData.firstName,
            lastName: guestData.lastName,
            email: guestData.email,
            phone: guestData.phone
          },
          bookingHistory: {
            totalBookings: 0,
            totalSpent: 0
          }
        });
      }

      // Update booking history
      guestCRM.bookingHistory.totalBookings += 1;
      guestCRM.bookingHistory.totalSpent += booking.totalAmount;
      guestCRM.bookingHistory.averageBookingValue = 
        guestCRM.bookingHistory.totalSpent / guestCRM.bookingHistory.totalBookings;
      guestCRM.bookingHistory.lastBookingDate = new Date();

      // Update segmentation
      guestCRM.segmentation.lifetimeValue = guestCRM.bookingHistory.totalSpent;
      
      if (guestCRM.bookingHistory.totalSpent > 50000) {
        guestCRM.segmentation.segment = 'vip';
      } else if (guestCRM.bookingHistory.totalBookings > 3) {
        guestCRM.segmentation.segment = 'frequent';
      } else if (guestCRM.bookingHistory.totalBookings > 1) {
        guestCRM.segmentation.segment = 'potential';
      }

      await guestCRM.save();
      return guestCRM;
    } catch (error) {
      console.error('Error updating guest CRM:', error);
    }
  }

  /**
   * Send email campaign
   */
  async sendEmailCampaign(campaignId, testEmail = null) {
    try {
      const campaign = await EmailCampaign.findById(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      let recipients = [];
      
      if (testEmail) {
        recipients = [{ email: testEmail, name: 'Test User' }];
      } else {
        // Get recipients based on targeting criteria
        recipients = await this.getCampaignRecipients(campaign);
      }

      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      for (const recipient of recipients) {
        try {
          const personalizedContent = this.personalizeEmailContent(campaign.content, recipient);
          
          await this.emailTransporter.sendMail({
            from: process.env.FROM_EMAIL || 'noreply@yourhotel.com',
            to: recipient.email,
            subject: personalizedContent.subject,
            html: personalizedContent.htmlContent,
            text: personalizedContent.textContent
          });

          results.sent++;

          // Track email send
          await this.trackEmailEvent(campaignId, recipient.email, 'sent');
        } catch (error) {
          results.failed++;
          results.errors.push({
            email: recipient.email,
            error: error.message
          });
        }
      }

      // Update campaign stats
      campaign.tracking.sent += results.sent;
      campaign.status = 'sent';
      await campaign.save();

      return results;
    } catch (error) {
      console.error('Error sending email campaign:', error);
      throw error;
    }
  }

  /**
   * Get campaign recipients based on targeting
   */
  async getCampaignRecipients(campaign) {
    const pipeline = [];
    const matchStage = {
      'profile.email': { $exists: true, $ne: null }
    };

    // Apply targeting criteria
    if (campaign.targeting.segments && campaign.targeting.segments.length > 0) {
      matchStage['segmentation.segment'] = { $in: campaign.targeting.segments };
    }

    if (campaign.targeting.criteria.lastBookingDays) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - campaign.targeting.criteria.lastBookingDays);
      matchStage['bookingHistory.lastBookingDate'] = { $gte: daysAgo };
    }

    if (campaign.targeting.criteria.spentAmount) {
      if (campaign.targeting.criteria.spentAmount.min) {
        matchStage['bookingHistory.totalSpent'] = { 
          $gte: campaign.targeting.criteria.spentAmount.min 
        };
      }
      if (campaign.targeting.criteria.spentAmount.max) {
        matchStage['bookingHistory.totalSpent'] = {
          ...matchStage['bookingHistory.totalSpent'],
          $lte: campaign.targeting.criteria.spentAmount.max
        };
      }
    }

    pipeline.push({ $match: matchStage });

    const recipients = await GuestCRM.aggregate(pipeline);
    
    return recipients.map(guest => ({
      email: guest.profile.email,
      name: `${guest.profile.firstName} ${guest.profile.lastName}`,
      guestId: guest._id,
      preferences: guest.preferences,
      bookingHistory: guest.bookingHistory
    }));
  }

  /**
   * Personalize email content
   */
  personalizeEmailContent(content, recipient) {
    let personalizedSubject = content.subject;
    let personalizedHtml = content.htmlContent;
    let personalizedText = content.textContent;

    // Replace placeholders
    const replacements = {
      '{{firstName}}': recipient.name.split(' ')[0],
      '{{fullName}}': recipient.name,
      '{{lastBookingDate}}': recipient.bookingHistory?.lastBookingDate 
        ? new Date(recipient.bookingHistory.lastBookingDate).toLocaleDateString() 
        : 'N/A'
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      personalizedSubject = personalizedSubject.replace(placeholder, value);
      personalizedHtml = personalizedHtml.replace(new RegExp(placeholder, 'g'), value);
      personalizedText = personalizedText.replace(new RegExp(placeholder, 'g'), value);
    });

    return {
      subject: personalizedSubject,
      htmlContent: personalizedHtml,
      textContent: personalizedText
    };
  }

  /**
   * Track email events
   */
  async trackEmailEvent(campaignId, email, event, data = {}) {
    try {
      const campaign = await EmailCampaign.findById(campaignId);
      if (!campaign) return;

      switch (event) {
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
            { 'engagement.emailEngagement.unsubscribed': true }
          );
          break;
      }

      await campaign.save();

      // Update guest engagement
      if (event === 'open' || event === 'click') {
        await GuestCRM.updateOne(
          { 'profile.email': email },
          {
            $inc: {
              [`engagement.emailEngagement.${event}s`]: 1
            },
            $set: {
              'engagement.emailEngagement.lastOpened': new Date()
            }
          }
        );
      }
    } catch (error) {
      console.error('Error tracking email event:', error);
    }
  }

  /**
   * Generate loyalty points
   */
  async generateLoyaltyPoints(guestId, action, bookingAmount = 0) {
    try {
      const loyaltyProgram = await LoyaltyProgram.findOne({ isActive: true });
      if (!loyaltyProgram) return 0;

      const rule = loyaltyProgram.pointsRules.earningRates.find(r => r.action === action);
      if (!rule) return 0;

      let points = 0;
      if (rule.fixedPoints) {
        points = rule.fixedPoints;
      } else if (rule.pointsPerDollar && bookingAmount) {
        points = Math.floor(bookingAmount * rule.pointsPerDollar);
      }

      if (rule.multiplier) {
        points *= rule.multiplier;
      }

      // Update guest loyalty points
      await GuestCRM.updateOne(
        { guestId },
        { $inc: { 'loyaltyPoints': points } }
      );

      return points;
    } catch (error) {
      console.error('Error generating loyalty points:', error);
      return 0;
    }
  }

  /**
   * Process review and sentiment analysis
   */
  async processReview(reviewData) {
    try {
      // Create review
      const review = new ReviewManagement({
        reviewId: uuidv4(),
        ...reviewData,
        sentiment: await this.analyzeSentiment(reviewData.content.review),
        moderation: {
          status: 'pending'
        }
      });

      await review.save();

      // Update guest CRM with review
      if (reviewData.guest.email) {
        await GuestCRM.updateOne(
          { 'profile.email': reviewData.guest.email },
          {
            $push: {
              'feedback.reviews': {
                platform: reviewData.platform,
                rating: reviewData.content.rating,
                comment: reviewData.content.review,
                date: new Date()
              }
            },
            $set: {
              'feedback.averageRating': await this.calculateAverageRating(reviewData.guest.email)
            }
          }
        );
      }

      return review;
    } catch (error) {
      console.error('Error processing review:', error);
      throw error;
    }
  }

  /**
   * Simple sentiment analysis
   */
  async analyzeSentiment(text) {
    const positiveWords = ['excellent', 'amazing', 'wonderful', 'great', 'fantastic', 'perfect', 'love', 'best', 'outstanding'];
    const negativeWords = ['terrible', 'awful', 'horrible', 'worst', 'hate', 'bad', 'poor', 'disappointing', 'dirty'];

    const words = text.toLowerCase().split(/\s+/);
    let score = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) score += 1;
      if (negativeWords.includes(word)) score -= 1;
    });

    const normalizedScore = score / words.length;
    let label = 'neutral';
    
    if (normalizedScore > 0.1) label = 'positive';
    else if (normalizedScore < -0.1) label = 'negative';

    return {
      score: normalizedScore,
      label,
      confidence: Math.abs(normalizedScore)
    };
  }

  /**
   * Calculate average rating for a guest
   */
  async calculateAverageRating(email) {
    const reviews = await ReviewManagement.find({
      'guest.email': email,
      'moderation.status': 'approved'
    });

    if (reviews.length === 0) return 0;

    const totalRating = reviews.reduce((sum, review) => sum + review.content.rating, 0);
    return totalRating / reviews.length;
  }

  /**
   * Generate SEO optimized content for landing pages
   */
  generateSEOContent(pageData) {
    const { name, type, content } = pageData;
    
    const seoContent = {
      metaTitle: `${content.title || name} | Luxury Hotel Booking`,
      metaDescription: content.description || `Book your stay at our luxury hotel. ${content.subtitle || ''}`,
      keywords: [
        'hotel booking',
        'luxury accommodation',
        name.toLowerCase(),
        type,
        'best rates',
        'direct booking'
      ],
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Hotel",
        "name": name,
        "description": content.description,
        "image": content.heroImage,
        "address": {
          "@type": "PostalAddress"
          // Hotel address would be populated from hotel settings
        },
        "amenityFeature": content.features?.map(feature => ({
          "@type": "LocationFeatureSpecification",
          "name": feature
        })) || []
      }
    };

    return seoContent;
  }

  /**
   * Update widget performance
   */
  async updateWidgetPerformance(widgetId, action) {
    const updateField = {};
    updateField[`performance.${action}s`] = 1;

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
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmationEmail(booking) {
    try {
      const htmlContent = `
        <h1>Booking Confirmation</h1>
        <p>Dear ${booking.guest.firstName},</p>
        <p>Your booking has been confirmed!</p>
        <div>
          <h3>Booking Details:</h3>
          <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
          <p><strong>Check-in:</strong> ${new Date(booking.checkInDate).toLocaleDateString()}</p>
          <p><strong>Check-out:</strong> ${new Date(booking.checkOutDate).toLocaleDateString()}</p>
          <p><strong>Total Amount:</strong> ₹${booking.totalAmount}</p>
        </div>
        <p>We look forward to welcoming you!</p>
      `;

      await this.emailTransporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@yourhotel.com',
        to: booking.guest.email,
        subject: 'Booking Confirmation - Your Stay is Confirmed!',
        html: htmlContent
      });
    } catch (error) {
      console.error('Error sending booking confirmation:', error);
    }
  }

  /**
   * Generate automated email campaigns based on guest behavior
   */
  async generateAutomatedCampaigns() {
    try {
      // Abandoned booking campaign
      const abandonedBookings = await this.findAbandonedBookings();
      for (const booking of abandonedBookings) {
        await this.sendAbandonedBookingEmail(booking);
      }

      // Post-stay review request
      const recentCheckouts = await this.findRecentCheckouts();
      for (const checkout of recentCheckouts) {
        await this.sendReviewRequestEmail(checkout);
      }

      // Birthday campaigns
      const birthdayGuests = await this.findBirthdayGuests();
      for (const guest of birthdayGuests) {
        await this.sendBirthdayEmail(guest);
      }
    } catch (error) {
      console.error('Error generating automated campaigns:', error);
    }
  }

  async findAbandonedBookings() {
    // Find incomplete bookings from last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    return await Booking.find({
      status: 'pending',
      createdAt: { $gte: yesterday, $lte: new Date() }
    });
  }

  async findRecentCheckouts() {
    // Find guests who checked out in the last 2 days
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    return await Booking.find({
      status: 'checked_out',
      checkOutDate: { $gte: twoDaysAgo, $lte: new Date() }
    });
  }

  async findBirthdayGuests() {
    const today = new Date();
    const monthDay = `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    
    return await GuestCRM.find({
      'profile.dateOfBirth': {
        $regex: `-${monthDay}$`
      }
    });
  }
}

export default BookingEngineService;