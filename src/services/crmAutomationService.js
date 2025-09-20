import GuestCRMProfile from '../models/GuestCRMProfile.js';
import GuestBehavior from '../models/GuestBehavior.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import { enhancedEmailService } from './enhancedEmailService.js';

class CRMAutomationService {
  async createOrUpdateGuestProfile(userId, hotelId, data = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      let profile = await GuestCRMProfile.findOne({ userId, hotelId });

      if (!profile) {
        profile = new GuestCRMProfile({
          userId,
          hotelId,
          personalInfo: {
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email,
            phone: user.phone || '',
            dateOfBirth: user.dateOfBirth,
            nationality: user.nationality || ''
          },
          preferences: {
            roomType: data.preferredRoomType || 'standard',
            bedType: data.preferredBedType || 'double',
            smokingPreference: data.smokingPreference || 'non-smoking',
            floorPreference: data.floorPreference || 'any',
            specialRequests: data.specialRequests || []
          },
          communicationPreferences: {
            email: true,
            sms: false,
            push: true,
            phone: false,
            language: user.language || 'en',
            timezone: user.timezone || 'UTC'
          },
          lifecycleStage: 'prospect',
          tags: ['new-guest']
        });
      }

      // Update existing profile with new data
      if (data.preferences) {
        profile.preferences = { ...profile.preferences, ...data.preferences };
      }
      if (data.communicationPreferences) {
        profile.communicationPreferences = { ...profile.communicationPreferences, ...data.communicationPreferences };
      }

      // Calculate RFM and update metrics
      await this.updateGuestMetrics(profile);
      await profile.save();

      return profile;
    } catch (error) {
      console.error('Error creating/updating guest profile:', error);
      throw error;
    }
  }

  async updateGuestMetrics(profile) {
    try {
      const userId = profile.userId;
      const hotelId = profile.hotelId;

      // Get booking data for RFM analysis
      const bookings = await Booking.find({
        userId,
        hotelId,
        status: { $in: ['confirmed', 'checked-in', 'checked-out'] }
      }).sort({ createdAt: -1 });

      const now = new Date();

      // Calculate Recency (days since last booking)
      let recency = 365; // default to 1 year if no bookings
      if (bookings.length > 0) {
        const lastBooking = bookings[0];
        recency = Math.floor((now - lastBooking.createdAt) / (1000 * 60 * 60 * 24));
      }

      // Calculate Frequency (number of bookings)
      const frequency = bookings.length;

      // Calculate Monetary (total spending)
      const monetary = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);

      // Score RFM components (1-5 scale)
      const recencyScore = this.calculateRecencyScore(recency);
      const frequencyScore = this.calculateFrequencyScore(frequency);
      const monetaryScore = this.calculateMonetaryScore(monetary);

      // Determine RFM segment
      const segment = this.determineRFMSegment(recencyScore, frequencyScore, monetaryScore);

      // Update profile
      profile.rfmAnalysis = {
        recency: { value: recency, score: recencyScore },
        frequency: { value: frequency, score: frequencyScore },
        monetary: { value: monetary, score: monetaryScore },
        segment,
        lastCalculated: now
      };

      profile.engagementMetrics.totalBookings = frequency;
      profile.engagementMetrics.totalSpending = monetary;
      profile.engagementMetrics.averageBookingValue = frequency > 0 ? monetary / frequency : 0;

      // Update lifecycle stage based on behavior
      profile.lifecycleStage = this.determineLifecycleStage(recency, frequency, monetary);

      // Calculate loyalty score
      profile.loyaltyMetrics.score = this.calculateLoyaltyScore(recencyScore, frequencyScore, monetaryScore);

      return profile;
    } catch (error) {
      console.error('Error updating guest metrics:', error);
      throw error;
    }
  }

  calculateRecencyScore(recency) {
    if (recency <= 30) return 5;
    if (recency <= 90) return 4;
    if (recency <= 180) return 3;
    if (recency <= 365) return 2;
    return 1;
  }

  calculateFrequencyScore(frequency) {
    if (frequency >= 10) return 5;
    if (frequency >= 5) return 4;
    if (frequency >= 3) return 3;
    if (frequency >= 2) return 2;
    return 1;
  }

  calculateMonetaryScore(monetary) {
    if (monetary >= 5000) return 5;
    if (monetary >= 2000) return 4;
    if (monetary >= 1000) return 3;
    if (monetary >= 500) return 2;
    return 1;
  }

  determineRFMSegment(recencyScore, frequencyScore, monetaryScore) {
    const totalScore = recencyScore + frequencyScore + monetaryScore;
    const avgScore = totalScore / 3;

    if (recencyScore >= 4 && frequencyScore >= 4 && monetaryScore >= 4) {
      return 'Champions';
    } else if (recencyScore >= 3 && frequencyScore >= 4 && monetaryScore >= 3) {
      return 'Loyal Customers';
    } else if (recencyScore >= 4 && frequencyScore <= 2 && monetaryScore >= 3) {
      return 'Potential Loyalists';
    } else if (recencyScore >= 4 && frequencyScore <= 2 && monetaryScore <= 2) {
      return 'New Customers';
    } else if (recencyScore >= 3 && frequencyScore <= 3 && monetaryScore >= 3) {
      return 'Promising';
    } else if (recencyScore <= 3 && frequencyScore >= 3 && monetaryScore >= 3) {
      return 'Need Attention';
    } else if (recencyScore <= 2 && frequencyScore >= 3 && monetaryScore >= 3) {
      return 'About to Sleep';
    } else if (recencyScore <= 2 && frequencyScore >= 2 && monetaryScore >= 4) {
      return 'At Risk';
    } else if (recencyScore <= 2 && frequencyScore >= 4 && monetaryScore >= 4) {
      return 'Cannot Lose Them';
    } else if (recencyScore <= 2 && frequencyScore <= 2 && monetaryScore <= 2) {
      return 'Hibernating';
    } else {
      return 'Lost';
    }
  }

  determineLifecycleStage(recency, frequency, monetary) {
    if (frequency === 0) return 'prospect';
    if (frequency === 1 && recency <= 30) return 'new_customer';
    if (frequency >= 2 && recency <= 90) return 'active';
    if (frequency >= 3 && monetary >= 1000) return 'loyal';
    if (frequency >= 5 && monetary >= 2000) return 'champion';
    if (recency > 180) return 'at_risk';
    return 'lost';
  }

  calculateLoyaltyScore(recencyScore, frequencyScore, monetaryScore) {
    return Math.round(((recencyScore * 0.3) + (frequencyScore * 0.4) + (monetaryScore * 0.3)) * 20);
  }

  async trackBehavior(userId, hotelId, behaviorData) {
    try {
      const behavior = new GuestBehavior({
        userId,
        hotelId,
        sessionId: behaviorData.sessionId || `session_${Date.now()}`,
        behaviorType: behaviorData.behaviorType,
        pageUrl: behaviorData.pageUrl,
        referrerUrl: behaviorData.referrerUrl,
        userAgent: behaviorData.userAgent,
        ipAddress: behaviorData.ipAddress,
        deviceType: behaviorData.deviceType || 'desktop',
        interactionData: behaviorData.interactionData || {},
        transactionValue: behaviorData.transactionValue || 0,
        currency: behaviorData.currency || 'USD',
        source: behaviorData.source || 'direct',
        medium: behaviorData.medium,
        campaign: behaviorData.campaign,
        utmParameters: behaviorData.utmParameters || {},
        localTime: behaviorData.localTime || new Date(),
        timezone: behaviorData.timezone || 'UTC',
        metadata: behaviorData.metadata || {},
        tags: behaviorData.tags || []
      });

      // Calculate engagement score
      behavior.calculateEngagementScore();
      await behavior.save();

      // Update CRM profile engagement metrics
      await this.updateEngagementMetrics(userId, hotelId, behavior);

      // Trigger automated actions based on behavior
      await this.triggerAutomatedActions(userId, hotelId, behavior);

      return behavior;
    } catch (error) {
      console.error('Error tracking behavior:', error);
      throw error;
    }
  }

  async updateEngagementMetrics(userId, hotelId, behavior) {
    try {
      const profile = await GuestCRMProfile.findOne({ userId, hotelId });
      if (!profile) return;

      // Update engagement metrics
      profile.engagementMetrics.totalPageViews += behavior.behaviorType === 'page_view' ? 1 : 0;
      profile.engagementMetrics.totalEmailOpens += behavior.behaviorType === 'email_open' ? 1 : 0;
      profile.engagementMetrics.totalEmailClicks += behavior.behaviorType === 'email_click' ? 1 : 0;
      profile.engagementMetrics.lastEngagement = new Date();

      // Calculate average engagement score
      const recentBehaviors = await GuestBehavior.find({
        userId,
        hotelId,
        timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });

      if (recentBehaviors.length > 0) {
        const totalScore = recentBehaviors.reduce((sum, b) => sum + b.engagementScore, 0);
        profile.engagementMetrics.averageEngagementScore = totalScore / recentBehaviors.length;
      }

      await profile.save();
    } catch (error) {
      console.error('Error updating engagement metrics:', error);
    }
  }

  async triggerAutomatedActions(userId, hotelId, behavior) {
    try {
      const profile = await GuestCRMProfile.findOne({ userId, hotelId });
      if (!profile) return;

      // Trigger based on behavior type
      switch (behavior.behaviorType) {
        case 'booking_complete':
          await this.handleBookingComplete(profile, behavior);
          break;
        case 'checkout_start':
          await this.handleAbandonedCart(profile, behavior);
          break;
        case 'email_open':
          await this.handleEmailEngagement(profile, behavior);
          break;
        case 'support_contact':
          await this.handleSupportContact(profile, behavior);
          break;
        default:
          break;
      }

      // Check for segment changes and trigger campaigns
      const oldSegment = profile.rfmAnalysis.segment;
      await this.updateGuestMetrics(profile);

      if (profile.rfmAnalysis.segment !== oldSegment) {
        await this.triggerSegmentChangeActions(profile, oldSegment);
      }
    } catch (error) {
      console.error('Error triggering automated actions:', error);
    }
  }

  async handleBookingComplete(profile, behavior) {
    // Send booking confirmation
    // Update loyalty status
    // Schedule follow-up communications
    profile.engagementMetrics.totalBookings += 1;
    profile.engagementMetrics.totalSpending += behavior.transactionValue;

    // Add tags
    if (!profile.tags.includes('recent-booker')) {
      profile.tags.push('recent-booker');
    }

    await profile.save();
  }

  async handleAbandonedCart(profile, behavior) {
    // Schedule abandoned cart email
    setTimeout(async () => {
      try {
        if (profile.communicationPreferences.email) {
          await enhancedEmailService.sendEmail({
            to: profile.personalInfo.email,
            subject: 'Complete Your Booking',
            template: 'abandoned_cart',
            data: {
              firstName: profile.personalInfo.firstName,
              hotelName: 'THE PENTOUZ',
              bookingUrl: behavior.pageUrl
            }
          });
        }
      } catch (error) {
        console.error('Error sending abandoned cart email:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes delay
  }

  async handleEmailEngagement(profile, behavior) {
    // Track email engagement
    profile.engagementMetrics.totalEmailOpens += 1;
    profile.engagementMetrics.lastEngagement = new Date();
    await profile.save();
  }

  async handleSupportContact(profile, behavior) {
    // Flag for support team attention
    if (!profile.tags.includes('needs-attention')) {
      profile.tags.push('needs-attention');
      await profile.save();
    }
  }

  async triggerSegmentChangeActions(profile, oldSegment) {
    const newSegment = profile.rfmAnalysis.segment;

    // Trigger segment-specific campaigns
    if (newSegment === 'Champions' && oldSegment !== 'Champions') {
      // Send VIP welcome email
      if (profile.communicationPreferences.email) {
        await enhancedEmailService.sendEmail({
          to: profile.personalInfo.email,
          subject: 'Welcome to Our VIP Program!',
          template: 'vip_welcome',
          data: {
            firstName: profile.personalInfo.firstName,
            segment: newSegment
          }
        });
      }
    } else if (newSegment === 'At Risk' && oldSegment !== 'At Risk') {
      // Send win-back campaign
      if (profile.communicationPreferences.email) {
        await enhancedEmailService.sendEmail({
          to: profile.personalInfo.email,
          subject: 'We Miss You!',
          template: 'winback',
          data: {
            firstName: profile.personalInfo.firstName,
            specialOffer: '20% off your next stay'
          }
        });
      }
    }
  }

  async getGuestInsights(userId, hotelId) {
    try {
      const profile = await GuestCRMProfile.findOne({ userId, hotelId });
      if (!profile) return null;

      const behaviorAnalytics = await GuestBehavior.getBehaviorAnalytics(userId, 90); // Last 90 days
      const bookings = await Booking.find({
        userId,
        hotelId,
        status: { $in: ['confirmed', 'checked-in', 'checked-out'] }
      }).sort({ createdAt: -1 }).limit(10);

      return {
        profile,
        behaviorAnalytics,
        recentBookings: bookings,
        insights: {
          segment: profile.rfmAnalysis.segment,
          lifecycleStage: profile.lifecycleStage,
          loyaltyScore: profile.loyaltyMetrics.score,
          nextBestAction: await this.getNextBestAction(profile),
          predictedValue: await this.getPredictedLifetimeValue(profile)
        }
      };
    } catch (error) {
      console.error('Error getting guest insights:', error);
      throw error;
    }
  }

  async getNextBestAction(profile) {
    const segment = profile.rfmAnalysis.segment;
    const daysSinceLastBooking = profile.rfmAnalysis.recency.value;

    switch (segment) {
      case 'Champions':
        return 'Offer exclusive VIP experiences or early access to new rooms';
      case 'Loyal Customers':
        return 'Provide loyalty rewards and referral incentives';
      case 'Potential Loyalists':
        return 'Engage with personalized offers to increase frequency';
      case 'New Customers':
        return 'Nurture with welcome series and onboarding content';
      case 'At Risk':
        return 'Send win-back campaign with special discount';
      case 'Cannot Lose Them':
        return 'Urgent intervention - personal outreach from management';
      default:
        return 'Re-engage with targeted promotional offers';
    }
  }

  async getPredictedLifetimeValue(profile) {
    const avgBookingValue = profile.engagementMetrics.averageBookingValue;
    const frequency = profile.rfmAnalysis.frequency.value;
    const loyaltyScore = profile.loyaltyMetrics.score;

    // Simple CLV prediction based on current metrics
    const yearlyBookings = Math.max(1, frequency * (loyaltyScore / 50));
    const predictedAnnualValue = avgBookingValue * yearlyBookings;
    const customerLifespan = Math.max(1, loyaltyScore / 10); // Years

    return predictedAnnualValue * customerLifespan;
  }
}

export default new CRMAutomationService();