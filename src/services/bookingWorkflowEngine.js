import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import logger from '../utils/logger.js';
import websocketService from './websocketService.js';
import emailService from './emailService.js';
import queueService from './queueService.js';

class BookingWorkflowEngine {
  constructor() {
    this.workflowRules = new Map();
    this.scheduledTasks = new Map();
    this.isRunning = false;
    
    this.initializeWorkflowRules();
  }

  /**
   * Check database connectivity
   */
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Initialize default workflow rules
   */
  initializeWorkflowRules() {
    // Auto-confirm pending bookings after payment
    this.addWorkflowRule('auto_confirm_on_payment', {
      trigger: 'payment_status_change',
      condition: (booking, context) => 
        booking.status === 'pending' && 
        context.newPaymentStatus === 'paid',
      action: async (booking, context) => {
        await booking.changeStatus('confirmed', {
          source: 'system',
          reason: 'Auto-confirmed after payment received',
          automatic: true
        });
        return { success: true, action: 'confirmed' };
      }
    });

    // Auto no-show after grace period
    this.addWorkflowRule('auto_no_show', {
      trigger: 'scheduled_check',
      condition: (booking, context) => {
        if (booking.status !== 'confirmed') return false;
        
        const now = new Date();
        const checkIn = new Date(booking.checkIn);
        const hoursAfterCheckIn = (now - checkIn) / (1000 * 60 * 60);
        
        return hoursAfterCheckIn > 6; // 6 hour grace period
      },
      action: async (booking, context) => {
        await booking.changeStatus('no_show', {
          source: 'system',
          reason: 'Auto no-show after grace period expired',
          automatic: true
        });
        return { success: true, action: 'no_show' };
      }
    });

    // Auto-release expired reservations
    this.addWorkflowRule('auto_release_expired', {
      trigger: 'scheduled_check',
      condition: (booking, context) => {
        if (booking.status !== 'pending') return false;
        
        const now = new Date();
        const reservedUntil = booking.reservedUntil;
        
        return reservedUntil && now > reservedUntil;
      },
      action: async (booking, context) => {
        await booking.changeStatus('cancelled', {
          source: 'system',
          reason: 'Auto-cancelled due to expired reservation',
          automatic: true
        });
        return { success: true, action: 'cancelled' };
      }
    });

    // Auto-confirm modified bookings after amendment approval
    this.addWorkflowRule('auto_confirm_after_amendment', {
      trigger: 'amendment_resolved',
      condition: (booking, context) =>
        booking.status === 'modified' &&
        !booking.amendmentFlags.hasActivePendingAmendments &&
        context.amendmentStatus === 'approved',
      action: async (booking, context) => {
        await booking.changeStatus('confirmed', {
          source: 'system',
          reason: 'Auto-confirmed after amendment approval',
          automatic: true,
          bypassAmendmentCheck: true
        });
        return { success: true, action: 'confirmed' };
      }
    });

    // Auto-sync status changes to OTAs
    this.addWorkflowRule('auto_sync_ota', {
      trigger: 'status_change',
      condition: (booking, context) =>
        booking.source !== 'direct' && 
        ['confirmed', 'cancelled', 'no_show'].includes(context.newStatus),
      action: async (booking, context) => {
        booking.syncStatus.needsSync = true;
        await this.scheduleOTASync(booking, context.newStatus);
        return { success: true, action: 'ota_sync_scheduled' };
      }
    });

    // Send notification on status changes
    this.addWorkflowRule('send_notifications', {
      trigger: 'status_change',
      condition: (booking, context) => 
        !context.skipNotifications,
      action: async (booking, context) => {
        await this.sendStatusChangeNotifications(booking, context);
        return { success: true, action: 'notifications_sent' };
      }
    });
  }

  /**
   * Add a new workflow rule
   */
  addWorkflowRule(id, rule) {
    this.workflowRules.set(id, {
      id,
      ...rule,
      enabled: true,
      createdAt: new Date()
    });
    logger.info(`Added workflow rule: ${id}`);
  }

  /**
   * Remove a workflow rule
   */
  removeWorkflowRule(id) {
    this.workflowRules.delete(id);
    logger.info(`Removed workflow rule: ${id}`);
  }

  /**
   * Start the workflow engine
   */
  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Start periodic checks for scheduled workflows
    this.schedulePeriodicChecks();
    
    logger.info('Booking workflow engine started');
  }

  /**
   * Stop the workflow engine
   */
  stop() {
    this.isRunning = false;
    
    // Clear all scheduled tasks
    this.scheduledTasks.forEach(task => clearInterval(task));
    this.scheduledTasks.clear();
    
    logger.info('Booking workflow engine stopped');
  }

  /**
   * Process workflow triggers
   */
  async processTrigger(triggerType, booking, context = {}) {
    if (!this.isRunning) return;

    try {
      logger.debug(`Processing workflow trigger: ${triggerType}`, {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber
      });

      const applicableRules = Array.from(this.workflowRules.values())
        .filter(rule => rule.enabled && rule.trigger === triggerType);

      const results = [];

      for (const rule of applicableRules) {
        try {
          // Check condition
          const conditionMet = await rule.condition(booking, context);
          
          if (conditionMet) {
            logger.info(`Executing workflow rule: ${rule.id}`, {
              bookingId: booking._id
            });

            // Execute action
            const result = await rule.action(booking, context);
            
            results.push({
              ruleId: rule.id,
              success: result.success,
              action: result.action,
              details: result.details
            });

            // Log workflow execution
            await this.logWorkflowExecution(booking._id, rule.id, result);
          }

        } catch (error) {
          logger.error(`Workflow rule ${rule.id} failed:`, error);
          
          results.push({
            ruleId: rule.id,
            success: false,
            error: error.message
          });
        }
      }

      return results;

    } catch (error) {
      logger.error(`Workflow trigger processing failed:`, error);
      return [];
    }
  }

  /**
   * Schedule periodic checks for time-based workflows
   */
  schedulePeriodicChecks() {
    // Check for expired reservations every 5 minutes
    const expiredReservationsCheck = setInterval(async () => {
      try {
        await this.checkExpiredReservations();
      } catch (error) {
        logger.error('Expired reservations check failed:', error);
      }
    }, 5 * 60 * 1000);

    // Check for no-shows every 30 minutes
    const noShowCheck = setInterval(async () => {
      try {
        await this.checkForNoShows();
      } catch (error) {
        logger.error('No-show check failed:', error);
      }
    }, 30 * 60 * 1000);

    // Check for overdue check-outs every hour
    const checkoutCheck = setInterval(async () => {
      try {
        await this.checkOverdueCheckouts();
      } catch (error) {
        logger.error('Overdue checkout check failed:', error);
      }
    }, 60 * 60 * 1000);

    this.scheduledTasks.set('expired_reservations', expiredReservationsCheck);
    this.scheduledTasks.set('no_show', noShowCheck);
    this.scheduledTasks.set('checkout', checkoutCheck);
  }

  /**
   * Check for expired reservations that need to be cancelled
   */
  async checkExpiredReservations() {
    // Skip if database is not connected
    if (!this.isDbConnected()) {
      logger.debug('Database not connected, skipping expired reservations check');
      return;
    }

    const now = new Date();
    
    const expiredBookings = await Booking.find({
      status: 'pending',
      reservedUntil: { $lt: now }
    }).limit(100);

    for (const booking of expiredBookings) {
      await this.processTrigger('scheduled_check', booking, {
        checkType: 'expired_reservation',
        timestamp: now
      });
      
      if (booking.isModified()) {
        await booking.save();
      }
    }

    if (expiredBookings.length > 0) {
      logger.info(`Processed ${expiredBookings.length} expired reservations`);
    }
  }

  /**
   * Check for bookings that should be marked as no-show
   */
  async checkForNoShows() {
    // Skip if database is not connected
    if (!this.isDbConnected()) {
      logger.debug('Database not connected, skipping no-show check');
      return;
    }

    const now = new Date();
    const graceEndTime = new Date(now.getTime() - (6 * 60 * 60 * 1000)); // 6 hours ago

    const potentialNoShows = await Booking.find({
      status: 'confirmed',
      checkIn: { $lt: graceEndTime }
    }).limit(50);

    for (const booking of potentialNoShows) {
      await this.processTrigger('scheduled_check', booking, {
        checkType: 'no_show',
        timestamp: now
      });
      
      if (booking.isModified()) {
        await booking.save();
      }
    }

    if (potentialNoShows.length > 0) {
      logger.info(`Processed ${potentialNoShows.length} potential no-shows`);
    }
  }

  /**
   * Check for overdue check-outs
   */
  async checkOverdueCheckouts() {
    // Skip if database is not connected
    if (!this.isDbConnected()) {
      logger.debug('Database not connected, skipping overdue checkouts check');
      return;
    }

    const now = new Date();
    const overdueTime = new Date(now.getTime() - (2 * 60 * 60 * 1000)); // 2 hours after checkout time

    const overdueBookings = await Booking.find({
      status: 'checked_in',
      checkOut: { $lt: overdueTime }
    }).limit(50);

    for (const booking of overdueBookings) {
      // Don't auto-checkout, but send alerts
      await this.sendOverdueCheckoutAlert(booking);
    }

    if (overdueBookings.length > 0) {
      logger.info(`Found ${overdueBookings.length} overdue checkouts`);
    }
  }

  /**
   * Schedule OTA synchronization
   */
  async scheduleOTASync(booking, status) {
    try {
      const syncData = {
        bookingId: booking._id,
        channelBookingId: booking.channelBookingId,
        channel: booking.channel,
        status: status,
        timestamp: new Date()
      };

      // Add to queue for OTA sync
      await queueService.add('ota-status-sync', syncData, {
        priority: status === 'cancelled' ? 10 : 5, // Cancellations are high priority
        delay: 1000 // 1 second delay
      });

      logger.info(`Scheduled OTA sync for booking ${booking.bookingNumber}`);

    } catch (error) {
      logger.error('Failed to schedule OTA sync:', error);
    }
  }

  /**
   * Send status change notifications
   */
  async sendStatusChangeNotifications(booking, context) {
    try {
      const notifications = [];

      // Guest notifications
      if (booking.guestInfo.email && context.notifyGuest !== false) {
        const guestNotification = {
          type: 'status_change',
          recipient: booking.guestInfo.email,
          data: {
            bookingNumber: booking.bookingNumber,
            guestName: booking.guestInfo.name,
            oldStatus: context.oldStatus,
            newStatus: context.newStatus,
            reason: context.reason
          }
        };
        notifications.push(guestNotification);
      }

      // Staff notifications via WebSocket
      websocketService.emit('booking_status_changed', {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        guestName: booking.guestInfo.name,
        oldStatus: context.oldStatus,
        newStatus: context.newStatus,
        automatic: context.automatic || false,
        timestamp: new Date()
      }, ['front-desk', 'reservations']);

      // Send email notifications
      for (const notification of notifications) {
        if (notification.type === 'status_change' && notification.recipient) {
          await this.sendStatusChangeEmail(booking, notification.data);
        }
      }

    } catch (error) {
      logger.error('Failed to send status change notifications:', error);
    }
  }

  /**
   * Send status change email to guest
   */
  async sendStatusChangeEmail(booking, data) {
    try {
      let template, subject;

      switch (data.newStatus) {
        case 'confirmed':
          template = 'booking-confirmed';
          subject = `Booking Confirmed - ${booking.bookingNumber}`;
          break;
        case 'cancelled':
          template = 'booking-cancelled';
          subject = `Booking Cancelled - ${booking.bookingNumber}`;
          break;
        case 'modified':
          template = 'booking-modified';
          subject = `Booking Modified - ${booking.bookingNumber}`;
          break;
        case 'no_show':
          template = 'booking-no-show';
          subject = `No-Show Recorded - ${booking.bookingNumber}`;
          break;
        default:
          return; // No email template for this status
      }

      await emailService.sendEmail({
        to: booking.guestInfo.email,
        subject,
        template,
        data: {
          booking,
          ...data
        }
      });

      logger.info(`Status change email sent to ${booking.guestInfo.email}`);

    } catch (error) {
      logger.error('Failed to send status change email:', error);
    }
  }

  /**
   * Send overdue checkout alert
   */
  async sendOverdueCheckoutAlert(booking) {
    try {
      websocketService.emit('overdue_checkout', {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        guestName: booking.guestInfo.name,
        roomNumber: booking.rooms[0]?.roomNumber,
        checkOutTime: booking.checkOut,
        hoursOverdue: Math.floor((new Date() - new Date(booking.checkOut)) / (1000 * 60 * 60))
      }, ['front-desk', 'housekeeping']);

      logger.info(`Overdue checkout alert sent for booking ${booking.bookingNumber}`);

    } catch (error) {
      logger.error('Failed to send overdue checkout alert:', error);
    }
  }

  /**
   * Log workflow execution for audit
   */
  async logWorkflowExecution(bookingId, ruleId, result) {
    try {
      // This could be stored in a separate audit collection
      logger.info('Workflow execution logged', {
        bookingId,
        ruleId,
        result,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to log workflow execution:', error);
    }
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(period = '24h') {
    // This would typically query execution logs
    // For now, return basic stats
    return {
      activeRules: this.workflowRules.size,
      isRunning: this.isRunning,
      scheduledTasks: this.scheduledTasks.size,
      period
    };
  }

  /**
   * Manually trigger workflow for a booking
   */
  async manualTrigger(bookingId, triggerType, context = {}) {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
      }

      const results = await this.processTrigger(triggerType, booking, {
        ...context,
        manual: true,
        triggeredBy: context.userId || 'system'
      });

      if (booking.isModified()) {
        await booking.save();
      }

      return {
        success: true,
        bookingId,
        triggerType,
        results
      };

    } catch (error) {
      logger.error(`Manual workflow trigger failed:`, error);
      throw error;
    }
  }
}

export default new BookingWorkflowEngine();