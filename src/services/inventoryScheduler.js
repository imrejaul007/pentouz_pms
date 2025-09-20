import cron from 'node-cron';
import mongoose from 'mongoose';
import InventoryItem from '../models/InventoryItem.js';
import inventoryNotificationService from './inventoryNotificationService.js';
import logger from '../utils/logger.js';

/**
 * Inventory Scheduler Service
 * Handles automated inventory checks and notifications
 */
class InventoryScheduler {
  constructor() {
    this.tasks = new Map();
    this.isRunning = false;
  }

  /**
   * Start all scheduled tasks
   */
  start() {
    if (this.isRunning) {
      logger.warn('Inventory scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting inventory scheduler');

    // Check for low stock every hour
    this.scheduleLowStockCheck();
    
    // Daily inventory audit at 2 AM
    this.scheduleInventoryAudit();
    
    // Weekly inventory report on Mondays at 9 AM
    this.scheduleWeeklyInventoryReport();
    
    logger.info('Inventory scheduler started successfully');
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Inventory scheduler is not running');
      return;
    }

    this.tasks.forEach((task, taskName) => {
      task.stop();
      logger.info(`Stopped task: ${taskName}`);
    });
    
    this.tasks.clear();
    this.isRunning = false;
    logger.info('Inventory scheduler stopped');
  }

  /**
   * Schedule low stock checks every hour
   */
  scheduleLowStockCheck() {
    const task = cron.schedule('0 */1 * * *', async () => {
      try {
        logger.info('Running scheduled low stock check');
        await this.checkLowStockItems();
      } catch (error) {
        logger.error('Error in scheduled low stock check:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.tasks.set('lowStockCheck', task);
    task.start();
    logger.info('Scheduled low stock check to run every hour');
  }

  /**
   * Schedule daily inventory audit at 2 AM
   */
  scheduleInventoryAudit() {
    const task = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('Running daily inventory audit');
        await this.performDailyInventoryAudit();
      } catch (error) {
        logger.error('Error in daily inventory audit:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.tasks.set('dailyAudit', task);
    task.start();
    logger.info('Scheduled daily inventory audit at 2 AM UTC');
  }

  /**
   * Schedule weekly inventory report on Mondays at 9 AM
   */
  scheduleWeeklyInventoryReport() {
    const task = cron.schedule('0 9 * * 1', async () => {
      try {
        logger.info('Running weekly inventory report');
        await this.generateWeeklyInventoryReport();
      } catch (error) {
        logger.error('Error in weekly inventory report:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.tasks.set('weeklyReport', task);
    task.start();
    logger.info('Scheduled weekly inventory report on Mondays at 9 AM UTC');
  }

  /**
   * Check database connectivity before operations
   */
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Check for low stock items across all hotels
   */
  async checkLowStockItems() {
    try {
      // Skip if database is not connected
      if (!this.isDbConnected()) {
        logger.debug('Database not connected, skipping low stock check');
        return { totalNotifications: 0, hotelCount: 0 };
      }

      // Get all hotels that have inventory
      const hotelIds = await InventoryItem.distinct('hotelId');
      
      let totalNotifications = 0;
      
      for (const hotelId of hotelIds) {
        try {
          // Get low stock items for this hotel
          const lowStockItems = await InventoryItem.getLowStockItems(hotelId);
          
          if (lowStockItems.length > 0) {
            logger.info(`Found ${lowStockItems.length} low stock items for hotel ${hotelId}`);
            
            // Create low stock notifications
            const notificationCount = await inventoryNotificationService.notifyLowStock(hotelId, lowStockItems);
            totalNotifications += notificationCount;
            
            // Log critical items (stock = 0)
            const criticalItems = lowStockItems.filter(item => item.currentStock === 0);
            if (criticalItems.length > 0) {
              logger.warn(`CRITICAL: ${criticalItems.length} items are completely out of stock for hotel ${hotelId}:`, 
                criticalItems.map(item => `${item.name} (${item.category})`));
            }
          }
        } catch (error) {
          logger.error(`Error checking low stock for hotel ${hotelId}:`, error);
        }
      }
      
      logger.info(`Low stock check completed. Created ${totalNotifications} notifications across ${hotelIds.length} hotels`);
      return { totalNotifications, hotelCount: hotelIds.length };
      
    } catch (error) {
      logger.error('Error in checkLowStockItems:', error);
      throw error;
    }
  }

  /**
   * Perform daily inventory audit
   */
  async performDailyInventoryAudit() {
    try {
      // Skip if database is not connected
      if (!this.isDbConnected()) {
        logger.debug('Database not connected, skipping daily inventory audit');
        return;
      }

      const hotelIds = await InventoryItem.distinct('hotelId');
      
      for (const hotelId of hotelIds) {
        try {
          // Get inventory statistics
          const stats = await InventoryItem.aggregate([
            { $match: { hotelId, isActive: true } },
            {
              $group: {
                _id: '$category',
                totalItems: { $sum: 1 },
                totalStock: { $sum: '$currentStock' },
                totalValue: { $sum: { $multiply: ['$currentStock', '$unitPrice'] } },
                lowStockCount: {
                  $sum: {
                    $cond: [{ $lte: ['$currentStock', '$stockThreshold'] }, 1, 0]
                  }
                },
                outOfStockCount: {
                  $sum: {
                    $cond: [{ $eq: ['$currentStock', 0] }, 1, 0]
                  }
                }
              }
            }
          ]);

          // Log audit results
          logger.info(`Daily inventory audit for hotel ${hotelId}:`, {
            categories: stats.map(stat => ({
              category: stat._id,
              items: stat.totalItems,
              stock: stat.totalStock,
              value: stat.totalValue.toFixed(2),
              lowStock: stat.lowStockCount,
              outOfStock: stat.outOfStockCount
            }))
          });

          // Create summary notification for admins if there are significant issues
          const totalLowStock = stats.reduce((sum, stat) => sum + stat.lowStockCount, 0);
          const totalOutOfStock = stats.reduce((sum, stat) => sum + stat.outOfStockCount, 0);
          
          if (totalLowStock > 0 || totalOutOfStock > 0) {
            await inventoryNotificationService.notifyInventoryAuditResults(hotelId, {
              lowStockCount: totalLowStock,
              outOfStockCount: totalOutOfStock,
              categories: stats
            });
          }

        } catch (error) {
          logger.error(`Error in daily audit for hotel ${hotelId}:`, error);
        }
      }
      
      logger.info('Daily inventory audit completed');
      
    } catch (error) {
      logger.error('Error in performDailyInventoryAudit:', error);
      throw error;
    }
  }

  /**
   * Generate weekly inventory report
   */
  async generateWeeklyInventoryReport() {
    try {
      // Skip if database is not connected
      if (!this.isDbConnected()) {
        logger.debug('Database not connected, skipping weekly inventory report');
        return;
      }

      const hotelIds = await InventoryItem.distinct('hotelId');
      
      for (const hotelId of hotelIds) {
        try {
          // Get week-over-week inventory changes
          const weeklyStats = await this.getWeeklyInventoryStats(hotelId);
          
          // Create weekly report notification
          await inventoryNotificationService.notifyWeeklyInventoryReport(hotelId, weeklyStats);
          
          logger.info(`Weekly inventory report generated for hotel ${hotelId}`, weeklyStats);
          
        } catch (error) {
          logger.error(`Error generating weekly report for hotel ${hotelId}:`, error);
        }
      }
      
      logger.info('Weekly inventory report generation completed');
      
    } catch (error) {
      logger.error('Error in generateWeeklyInventoryReport:', error);
      throw error;
    }
  }

  /**
   * Get weekly inventory statistics
   */
  async getWeeklyInventoryStats(hotelId) {
    // Skip if database is not connected
    if (!this.isDbConnected()) {
      return {
        totalItems: 0,
        totalStock: 0,
        totalValue: 0,
        lowStockItems: 0,
        categories: []
      };
    }

    // This would typically compare current stock levels with previous week
    // For now, return current stats
    const stats = await InventoryItem.aggregate([
      { $match: { hotelId, isActive: true } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalStock: { $sum: '$currentStock' },
          totalValue: { $sum: { $multiply: ['$currentStock', '$unitPrice'] } },
          lowStockItems: {
            $sum: {
              $cond: [{ $lte: ['$currentStock', '$stockThreshold'] }, 1, 0]
            }
          },
          categories: {
            $push: {
              category: '$category',
              count: 1,
              stock: '$currentStock'
            }
          }
        }
      }
    ]);

    return stats[0] || {
      totalItems: 0,
      totalStock: 0,
      totalValue: 0,
      lowStockItems: 0,
      categories: []
    };
  }

  /**
   * Manually trigger low stock check (for testing)
   */
  async triggerLowStockCheck() {
    logger.info('Manually triggering low stock check');
    return await this.checkLowStockItems();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.tasks.keys()),
      nextExecution: {
        lowStockCheck: this.getNextExecution('0 */1 * * *'),
        dailyAudit: this.getNextExecution('0 2 * * *'),
        weeklyReport: this.getNextExecution('0 9 * * 1')
      }
    };
  }

  /**
   * Calculate next execution time for a cron expression
   */
  getNextExecution(cronExpression) {
    try {
      const task = cron.schedule(cronExpression, () => {}, { scheduled: false });
      // This is a simplified calculation - in reality you'd use a proper cron parser
      return 'Next execution time calculation not implemented';
    } catch (error) {
      return 'Invalid cron expression';
    }
  }
}

// Create singleton instance
const inventoryScheduler = new InventoryScheduler();

export default inventoryScheduler;