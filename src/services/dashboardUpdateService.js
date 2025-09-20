import Notification from '../models/Notification.js';
import logger from '../utils/logger.js';

/**
 * Service for updating admin dashboard when user actions occur
 */
class DashboardUpdateService {
  
  /**
   * Notify admin when a new booking is created
   */
  async notifyNewBooking(booking, user) {
    try {
      // Create admin notification
      await Notification.create({
        userId: booking.hotelId, // This should be admin user ID, but we'll use hotelId for now
        hotelId: booking.hotelId,
        title: 'New Booking Created',
        message: `${user.name} created a new booking for ${booking.nights} nights`,
        type: 'booking_created',
        channels: ['in_app'],
        priority: 'medium',
        status: 'sent',
        metadata: {
          category: 'booking',
          bookingId: booking._id,
          guestId: user._id,
          amount: booking.totalAmount,
          currency: booking.currency
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      logger.info(`Admin notification created for new booking: ${booking.bookingNumber}`);
    } catch (error) {
      logger.error('Failed to notify admin of new booking:', error);
    }
  }

  /**
   * Notify admin when booking payment status changes
   */
  async notifyPaymentUpdate(booking, oldPaymentStatus, newPaymentStatus, user) {
    try {
      if (oldPaymentStatus === newPaymentStatus) return;

      const statusMessage = {
        'paid': 'completed payment',
        'pending': 'has payment pending',
        'failed': 'payment failed',
        'refunded': 'received refund'
      };

      await Notification.create({
        userId: booking.hotelId,
        hotelId: booking.hotelId,
        title: 'Payment Status Updated',
        message: `${user.name} ${statusMessage[newPaymentStatus] || 'updated payment status'} for booking ${booking.bookingNumber}`,
        type: 'payment_update',
        channels: ['in_app'],
        priority: newPaymentStatus === 'paid' ? 'high' : 'medium',
        status: 'sent',
        metadata: {
          category: 'payment',
          bookingId: booking._id,
          guestId: user._id,
          amount: booking.totalAmount,
          currency: booking.currency,
          oldStatus: oldPaymentStatus,
          newStatus: newPaymentStatus
        }
      });

      logger.info(`Admin notification created for payment update: ${booking.bookingNumber} ${oldPaymentStatus} -> ${newPaymentStatus}`);
    } catch (error) {
      logger.error('Failed to notify admin of payment update:', error);
    }
  }

  /**
   * Notify admin when booking is cancelled
   */
  async notifyBookingCancellation(booking, user, reason) {
    try {
      await Notification.create({
        userId: booking.hotelId,
        hotelId: booking.hotelId,
        title: 'Booking Cancelled',
        message: `${user.name} cancelled booking ${booking.bookingNumber}${reason ? `: ${reason}` : ''}`,
        type: 'booking_cancelled',
        channels: ['in_app'],
        priority: 'high',
        status: 'sent',
        metadata: {
          category: 'booking',
          bookingId: booking._id,
          guestId: user._id,
          amount: booking.totalAmount,
          currency: booking.currency,
          cancellationReason: reason
        }
      });

      logger.info(`Admin notification created for booking cancellation: ${booking.bookingNumber}`);
    } catch (error) {
      logger.error('Failed to notify admin of booking cancellation:', error);
    }
  }

  /**
   * Notify admin when new user registers
   */
  async notifyNewUserRegistration(user, hotelId) {
    try {
      await Notification.create({
        userId: hotelId,
        hotelId: hotelId,
        title: 'New Guest Registration',
        message: `${user.name} (${user.email}) registered as a new guest`,
        type: 'user_registration',
        channels: ['in_app'],
        priority: 'low',
        status: 'sent',
        metadata: {
          category: 'user',
          guestId: user._id,
          guestEmail: user.email,
          loyaltyTier: user.loyalty?.tier || 'bronze'
        }
      });

      logger.info(`Admin notification created for new user registration: ${user.email}`);
    } catch (error) {
      logger.error('Failed to notify admin of new user registration:', error);
    }
  }

  /**
   * Notify admin when guest service request is created
   */
  async notifyServiceRequest(serviceRequest, user) {
    try {
      await Notification.create({
        userId: serviceRequest.hotelId,
        hotelId: serviceRequest.hotelId,
        title: 'New Service Request',
        message: `${user.name} requested ${serviceRequest.serviceType} service`,
        type: 'service_request',
        channels: ['in_app'],
        priority: serviceRequest.priority === 'urgent' ? 'high' : 'medium',
        status: 'sent',
        metadata: {
          category: 'service',
          serviceRequestId: serviceRequest._id,
          guestId: user._id,
          serviceType: serviceRequest.serviceType,
          priority: serviceRequest.priority
        }
      });

      logger.info(`Admin notification created for service request: ${serviceRequest._id}`);
    } catch (error) {
      logger.error('Failed to notify admin of service request:', error);
    }
  }

  /**
   * Notify admin when guest leaves a review
   */
  async notifyNewReview(review, user) {
    try {
      const priority = review.rating <= 2 ? 'high' : review.rating >= 4 ? 'medium' : 'low';
      
      await Notification.create({
        userId: review.hotelId,
        hotelId: review.hotelId,
        title: `New ${review.rating}-Star Review`,
        message: `${user.name} left a ${review.rating}-star review: "${review.title}"`,
        type: 'review_created',
        channels: ['in_app'],
        priority: priority,
        status: 'sent',
        metadata: {
          category: 'review',
          reviewId: review._id,
          guestId: user._id,
          rating: review.rating,
          title: review.title
        }
      });

      logger.info(`Admin notification created for new review: ${review._id} (${review.rating} stars)`);
    } catch (error) {
      logger.error('Failed to notify admin of new review:', error);
    }
  }

  /**
   * Log user activity for admin tracking
   */
  async logUserActivity(user, action, details = {}) {
    try {
      // Create activity log notification for admin
      await Notification.create({
        userId: details.hotelId,
        hotelId: details.hotelId,
        title: 'User Activity',
        message: `${user.name} ${action}`,
        type: 'user_activity',
        channels: ['in_app'],
        priority: 'low',
        status: 'sent',
        metadata: {
          category: 'activity',
          guestId: user._id,
          action: action,
          details: details,
          timestamp: new Date()
        }
      });

      logger.info(`User activity logged: ${user.email} ${action}`);
    } catch (error) {
      logger.error('Failed to log user activity:', error);
    }
  }

  /**
   * Trigger dashboard data refresh
   */
  async triggerDashboardRefresh(hotelId, dataType = 'all') {
    try {
      // In a real-world scenario, this would emit to WebSocket clients
      // For now, we'll just log it
      logger.info(`Dashboard refresh triggered for hotel ${hotelId}, data type: ${dataType}`);
      
      // Could also send a special notification to admin clients to refresh data
      await Notification.create({
        userId: hotelId,
        hotelId: hotelId,
        title: 'Data Updated',
        message: `Dashboard data has been updated (${dataType})`,
        type: 'data_refresh',
        channels: ['in_app'],
        priority: 'low',
        status: 'sent',
        metadata: {
          category: 'system',
          dataType: dataType,
          timestamp: new Date()
        },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      });
    } catch (error) {
      logger.error('Failed to trigger dashboard refresh:', error);
    }
  }
}

export const dashboardUpdateService = new DashboardUpdateService();