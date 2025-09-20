import mongoose from 'mongoose';
import logger from '../utils/logger.js';

class ServiceNotificationService {
  /**
   * Send notification when staff is assigned to a service request
   */
  async notifyStaffAssignment(serviceRequest, staffMember) {
    try {
      const Notification = mongoose.model('Notification');

      // Create in-app notification
      const notification = await Notification.create({
        userId: staffMember._id,
        hotelId: serviceRequest.hotelId,
        title: 'New Service Request Assigned',
        message: `You have been assigned a ${serviceRequest.serviceType.replace('_', ' ')} request: ${serviceRequest.title || serviceRequest.serviceVariation}`,
        type: 'service_assignment',
        channels: ['in_app'],
        priority: this.getPriorityLevel(serviceRequest.priority),
        status: 'sent',
        metadata: {
          serviceRequestId: serviceRequest._id,
          serviceType: serviceRequest.serviceType,
          category: 'service_management'
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        sentAt: new Date()
      });

      logger.info(`Service assignment notification sent to staff ${staffMember._id} for request ${serviceRequest._id}`);
      return notification;
    } catch (error) {
      logger.error('Failed to send staff assignment notification:', error);
      throw error;
    }
  }

  /**
   * Send notification when service request status changes
   */
  async notifyStatusChange(serviceRequest, oldStatus, newStatus, updatedBy) {
    try {
      const Notification = mongoose.model('Notification');
      const User = mongoose.model('User');

      // Notify the guest about status changes
      if (oldStatus !== newStatus && ['assigned', 'in_progress', 'completed', 'cancelled'].includes(newStatus)) {
        const guest = await User.findById(serviceRequest.userId);

        if (guest) {
          const statusMessages = {
            'assigned': 'Your service request has been assigned to our staff',
            'in_progress': 'Your service request is now being processed',
            'completed': 'Your service request has been completed',
            'cancelled': 'Your service request has been cancelled'
          };

          await Notification.create({
            userId: guest._id,
            hotelId: serviceRequest.hotelId,
            title: 'Service Request Update',
            message: `${statusMessages[newStatus]}: ${serviceRequest.title || serviceRequest.serviceVariation}`,
            type: 'service_update',
            channels: ['in_app'],
            priority: newStatus === 'completed' ? 'medium' : 'low',
            status: 'sent',
            metadata: {
              serviceRequestId: serviceRequest._id,
              oldStatus,
              newStatus,
              category: 'service_management'
            },
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            sentAt: new Date()
          });

          logger.info(`Service status notification sent to guest ${guest._id} for request ${serviceRequest._id}`);
        }
      }

      // Notify staff about urgent status changes
      if (serviceRequest.assignedTo && newStatus === 'cancelled' && updatedBy.toString() !== serviceRequest.assignedTo.toString()) {
        await Notification.create({
          userId: serviceRequest.assignedTo,
          hotelId: serviceRequest.hotelId,
          title: 'Service Request Cancelled',
          message: `Service request has been cancelled: ${serviceRequest.title || serviceRequest.serviceVariation}`,
          type: 'service_cancellation',
          channels: ['in_app'],
          priority: 'medium',
          status: 'sent',
          metadata: {
            serviceRequestId: serviceRequest._id,
            cancelledBy: updatedBy,
            category: 'service_management'
          },
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          sentAt: new Date()
        });

        logger.info(`Service cancellation notification sent to staff ${serviceRequest.assignedTo} for request ${serviceRequest._id}`);
      }
    } catch (error) {
      logger.error('Failed to send status change notification:', error);
      throw error;
    }
  }

  /**
   * Send notification for overdue service requests
   */
  async notifyOverdueRequests() {
    try {
      const GuestService = mongoose.model('GuestService');
      const User = mongoose.model('User');
      const Notification = mongoose.model('Notification');

      // Find overdue requests (scheduled time passed and still not completed)
      const overdueRequests = await GuestService.find({
        scheduledTime: { $lt: new Date() },
        status: { $in: ['assigned', 'in_progress'] }
      }).populate('assignedTo', 'name email')
        .populate('hotelId', 'name');

      for (const request of overdueRequests) {
        if (request.assignedTo) {
          // Check if we haven't sent an overdue notification in the last 2 hours
          const recentNotification = await Notification.findOne({
            userId: request.assignedTo._id,
            'metadata.serviceRequestId': request._id,
            type: 'service_overdue',
            createdAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }
          });

          if (!recentNotification) {
            await Notification.create({
              userId: request.assignedTo._id,
              hotelId: request.hotelId._id,
              title: 'Overdue Service Request',
              message: `Service request is overdue: ${request.title || request.serviceVariation}`,
              type: 'service_overdue',
              channels: ['in_app'],
              priority: 'high',
              status: 'sent',
              metadata: {
                serviceRequestId: request._id,
                overdueBy: Math.floor((Date.now() - request.scheduledTime.getTime()) / (1000 * 60)), // minutes
                category: 'service_management'
              },
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              sentAt: new Date()
            });

            logger.info(`Overdue notification sent for request ${request._id} to staff ${request.assignedTo._id}`);
          }
        }
      }

      return overdueRequests.length;
    } catch (error) {
      logger.error('Failed to send overdue notifications:', error);
      throw error;
    }
  }

  /**
   * Send daily summary to hotel service managers
   */
  async sendDailySummary(hotelId) {
    try {
      const GuestService = mongoose.model('GuestService');
      const HotelService = mongoose.model('HotelService');
      const User = mongoose.model('User');
      const Notification = mongoose.model('Notification');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's service request statistics
      const todayStats = await GuestService.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: today, $lt: tomorrow }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get pending and overdue requests
      const pendingCount = await GuestService.countDocuments({
        hotelId,
        status: { $in: ['pending', 'assigned'] }
      });

      const overdueCount = await GuestService.countDocuments({
        hotelId,
        scheduledTime: { $lt: new Date() },
        status: { $in: ['assigned', 'in_progress'] }
      });

      // Find service managers and admins
      const managers = await User.find({
        hotelId,
        role: { $in: ['admin', 'manager'] },
        isActive: true
      });

      const statsMessage = this.formatDailySummary(todayStats, pendingCount, overdueCount);

      for (const manager of managers) {
        await Notification.create({
          userId: manager._id,
          hotelId,
          title: 'Daily Service Summary',
          message: statsMessage,
          type: 'daily_summary',
          channels: ['in_app'],
          priority: 'low',
          status: 'sent',
          metadata: {
            todayStats,
            pendingCount,
            overdueCount,
            category: 'service_management'
          },
          expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          sentAt: new Date()
        });
      }

      logger.info(`Daily service summary sent to ${managers.length} managers for hotel ${hotelId}`);
    } catch (error) {
      logger.error('Failed to send daily summary:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  getPriorityLevel(requestPriority) {
    const priorityMap = {
      'urgent': 'high',
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
      'later': 'low',
      'now': 'medium'
    };
    return priorityMap[requestPriority] || 'medium';
  }

  formatDailySummary(todayStats, pendingCount, overdueCount) {
    const statsMap = {};
    todayStats.forEach(stat => {
      statsMap[stat._id] = stat.count;
    });

    const completed = statsMap.completed || 0;
    const cancelled = statsMap.cancelled || 0;
    const total = Object.values(statsMap).reduce((sum, count) => sum + count, 0);

    let message = `Today's Service Summary: ${total} total requests`;
    if (completed > 0) message += `, ${completed} completed`;
    if (cancelled > 0) message += `, ${cancelled} cancelled`;
    if (pendingCount > 0) message += `. ${pendingCount} pending assignments`;
    if (overdueCount > 0) message += `. ⚠️ ${overdueCount} overdue requests`;

    return message;
  }
}

export const serviceNotificationService = new ServiceNotificationService();