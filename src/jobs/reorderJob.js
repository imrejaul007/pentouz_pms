import cron from 'node-cron';
import reorderService from '../services/reorderService.js';
import Hotel from '../models/Hotel.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

class ReorderJob {
  constructor() {
    this.isRunning = false;
    this.task = null;
    this.lastRun = null;
    this.stats = {
      totalRuns: 0,
      totalHotelsProcessed: 0,
      totalAlertsCreated: 0,
      totalNotificationsSent: 0,
      lastError: null
    };
  }

  /**
   * Start the reorder check job
   * Runs every hour by default (configurable via environment variable)
   */
  start() {
    try {
      // Get cron schedule from environment or default to every hour
      const cronSchedule = process.env.REORDER_CHECK_SCHEDULE || '0 * * * *'; // Every hour at minute 0

      logger.info('Starting reorder check job', { schedule: cronSchedule });

      this.task = cron.schedule(cronSchedule, async () => {
        await this.executeCheck();
      }, {
        scheduled: false, // Don't start immediately
        timezone: process.env.TIMEZONE || 'UTC'
      });

      this.task.start();
      this.isRunning = true;

      logger.info('Reorder check job started successfully', {
        schedule: cronSchedule,
        timezone: process.env.TIMEZONE || 'UTC'
      });

    } catch (error) {
      logger.error('Failed to start reorder check job:', error);
      throw new Error(`Failed to start reorder check job: ${error.message}`);
    }
  }

  /**
   * Stop the reorder check job
   */
  stop() {
    try {
      if (this.task) {
        this.task.stop();
        this.task = null;
      }
      this.isRunning = false;
      logger.info('Reorder check job stopped');
    } catch (error) {
      logger.error('Error stopping reorder check job:', error);
    }
  }

  /**
   * Execute a single reorder check cycle
   */
  async executeCheck() {
    if (this.isExecuting) {
      logger.warn('Reorder check already in progress, skipping this cycle');
      return;
    }

    this.isExecuting = true;
    const startTime = new Date();

    try {
      logger.info('Starting scheduled reorder check cycle');

      // Get all active hotels
      const hotels = await Hotel.find({ isActive: true }).select('_id name');

      if (hotels.length === 0) {
        logger.warn('No active hotels found for reorder check');
        return;
      }

      let totalAlertsCreated = 0;
      let totalNotificationsSent = 0;
      let processedHotels = 0;

      // Process each hotel
      for (const hotel of hotels) {
        try {
          const result = await reorderService.checkHotelReorderPoints(hotel._id);

          totalAlertsCreated += result.alertsCreated;
          totalNotificationsSent += result.notificationsSent;
          processedHotels++;

          logger.debug('Hotel reorder check completed', {
            hotelId: hotel._id,
            hotelName: hotel.name,
            ...result
          });

          // Add small delay between hotels to prevent overwhelming the system
          await this.delay(100);

        } catch (error) {
          logger.error('Error checking reorder points for hotel:', {
            hotelId: hotel._id,
            hotelName: hotel.name,
            error: error.message
          });
          // Continue with other hotels even if one fails
        }
      }

      const duration = new Date() - startTime;

      // Update statistics
      this.stats.totalRuns++;
      this.stats.totalHotelsProcessed += processedHotels;
      this.stats.totalAlertsCreated += totalAlertsCreated;
      this.stats.totalNotificationsSent += totalNotificationsSent;
      this.stats.lastError = null;
      this.lastRun = new Date();

      logger.info('Scheduled reorder check cycle completed successfully', {
        duration: `${duration}ms`,
        hotelsProcessed: processedHotels,
        totalHotels: hotels.length,
        alertsCreated: totalAlertsCreated,
        notificationsSent: totalNotificationsSent,
        totalRuns: this.stats.totalRuns
      });

    } catch (error) {
      this.stats.lastError = {
        message: error.message,
        timestamp: new Date()
      };

      logger.error('Error during scheduled reorder check:', {
        error: error.message,
        stack: error.stack,
        duration: `${new Date() - startTime}ms`
      });

    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Execute an immediate check (manual trigger)
   * @param {string} hotelId - Optional hotel ID to check specific hotel
   */
  async executeImmediateCheck(hotelId = null) {
    try {
      logger.info('Starting immediate reorder check', { hotelId });

      const result = await reorderService.checkReorderPoints(hotelId);

      logger.info('Immediate reorder check completed', result);

      return {
        success: true,
        result
      };

    } catch (error) {
      logger.error('Error during immediate reorder check:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get job status and statistics
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isExecuting: this.isExecuting || false,
      lastRun: this.lastRun,
      stats: this.stats,
      schedule: process.env.REORDER_CHECK_SCHEDULE || '0 * * * *',
      timezone: process.env.TIMEZONE || 'UTC'
    };
  }

  /**
   * Reset job statistics
   */
  resetStats() {
    this.stats = {
      totalRuns: 0,
      totalHotelsProcessed: 0,
      totalAlertsCreated: 0,
      totalNotificationsSent: 0,
      lastError: null
    };
    logger.info('Reorder job statistics reset');
  }

  /**
   * Schedule a weekly summary report
   */
  startWeeklySummary() {
    try {
      // Run every Monday at 9 AM
      const weeklySchedule = process.env.WEEKLY_SUMMARY_SCHEDULE || '0 9 * * 1';

      this.weeklySummaryTask = cron.schedule(weeklySchedule, async () => {
        await this.sendWeeklySummary();
      }, {
        scheduled: true,
        timezone: process.env.TIMEZONE || 'UTC'
      });

      logger.info('Weekly reorder summary scheduled', { schedule: weeklySchedule });

    } catch (error) {
      logger.error('Failed to start weekly summary:', error);
    }
  }

  /**
   * Send weekly reorder summary to hotel managers
   */
  async sendWeeklySummary() {
    try {
      logger.info('Generating weekly reorder summary');

      const hotels = await Hotel.find({ isActive: true }).select('_id name');

      for (const hotel of hotels) {
        try {
          const stats = await reorderService.getReorderStats(hotel._id);

          // Only send summary if there are active alerts or recent activity
          if (stats.activeAlerts > 0 || stats.recentHistory.length > 0) {
            // Get hotel managers for email
            const managers = await User.find({
              hotelId: hotel._id,
              role: { $in: ['admin', 'manager'] },
              isActive: true,
              email: { $exists: true, $ne: '' }
            }).select('email');

            if (managers.length > 0) {
              const recipients = managers.map(m => m.email);

              // Send weekly summary email (implement this in emailService if needed)
              logger.info('Weekly summary prepared for hotel', {
                hotelId: hotel._id,
                hotelName: hotel.name,
                activeAlerts: stats.activeAlerts,
                recipients: recipients.length
              });
            }
          }

          await this.delay(500); // Delay between hotels

        } catch (error) {
          logger.error('Error generating weekly summary for hotel:', {
            hotelId: hotel._id,
            error: error.message
          });
        }
      }

    } catch (error) {
      logger.error('Error during weekly summary generation:', error);
    }
  }

  /**
   * Utility function to add delay
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for the reorder job
   */
  healthCheck() {
    const status = this.getStatus();
    const now = new Date();

    // Check if job is running
    if (!status.isRunning) {
      return {
        healthy: false,
        status: 'Job not running',
        lastRun: status.lastRun
      };
    }

    // Check if last run was recent (within expected interval)
    if (status.lastRun) {
      const hoursSinceLastRun = (now - status.lastRun) / (1000 * 60 * 60);

      // If more than 2 hours since last run, consider unhealthy
      if (hoursSinceLastRun > 2) {
        return {
          healthy: false,
          status: 'Job not executing as expected',
          hoursSinceLastRun: Math.round(hoursSinceLastRun),
          lastRun: status.lastRun
        };
      }
    }

    return {
      healthy: true,
      status: 'Job running normally',
      ...status
    };
  }
}

// Create singleton instance
const reorderJob = new ReorderJob();

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, stopping reorder job');
  reorderJob.stop();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, stopping reorder job');
  reorderJob.stop();
});

export default reorderJob;
