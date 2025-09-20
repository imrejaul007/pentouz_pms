import logger from '../utils/logger.js';
import RoomAvailability from '../models/RoomAvailability.js';
import StopSellRule from '../models/StopSellRule.js';
import websocketService from './websocketService.js';

/**
 * Inventory Alert Service
 * 
 * Monitors inventory in real-time and sends alerts for:
 * - Low inventory warnings
 * - Overbooking alerts
 * - Stop sell violations
 * - Inventory threshold breaches
 */

class InventoryAlertService {
  constructor() {
    this.alertThresholds = {
      lowInventory: 0.1, // 10% of total rooms
      criticalInventory: 0.05, // 5% of total rooms
      overbookingThreshold: 1.0, // 100% of total rooms
      stopSellViolation: true
    };
    
    this.alertChannels = {
      websocket: true,
      email: false, // TODO: Implement email alerts
      slack: false, // TODO: Implement Slack alerts
      database: true
    };
    
    this.activeAlerts = new Map(); // Track active alerts to prevent duplicates
    this.alertHistory = []; // Store alert history
  }

  /**
   * Check inventory for a specific date range and send alerts
   */
  async checkInventoryAndAlert(hotelId, startDate, endDate) {
    try {
      logger.info(`Checking inventory for hotel ${hotelId} from ${startDate} to ${endDate}`);
      
      // Get all inventory records for the date range
      const inventoryRecords = await RoomAvailability.find({
        hotelId,
        date: { $gte: startDate, $lte: endDate }
      }).populate('roomTypeId', 'name totalRooms');
      
      const alerts = [];
      
      for (const record of inventoryRecords) {
        const recordAlerts = await this.analyzeInventoryRecord(record);
        alerts.push(...recordAlerts);
      }
      
      // Send alerts
      await this.sendAlerts(alerts);
      
      return alerts;
      
    } catch (error) {
      logger.error(`Error checking inventory and alerting: ${error.message}`, {
        hotelId,
        startDate,
        endDate,
        error: error.stack
      });
      throw error;
    }
  }

  /**
   * Analyze a single inventory record for potential issues
   */
  async analyzeInventoryRecord(record) {
    const alerts = [];
    const alertKey = `${record._id}_${record.date.toISOString().split('T')[0]}`;
    
    // Check if we already have an active alert for this record
    if (this.activeAlerts.has(alertKey)) {
      return alerts; // Skip if alert already active
    }
    
    // Calculate inventory percentages
    const totalRooms = record.totalRooms || 0;
    const availableRooms = record.availableRooms || 0;
    const soldRooms = record.soldRooms || 0;
    const blockedRooms = record.blockedRooms || 0;
    
    if (totalRooms === 0) return alerts;
    
    const occupancyRate = (soldRooms + blockedRooms) / totalRooms;
    const availabilityRate = availableRooms / totalRooms;
    
    // Check for overbooking
    if (soldRooms + blockedRooms > totalRooms) {
      const alert = this.createAlert('overbooking', {
        severity: 'critical',
        hotelId: record.hotelId,
        roomTypeId: record.roomTypeId,
        date: record.date,
        details: {
          totalRooms,
          soldRooms,
          blockedRooms,
          overbookedBy: (soldRooms + blockedRooms) - totalRooms
        }
      });
      
      alerts.push(alert);
      this.activeAlerts.set(alertKey, alert);
    }
    
    // Check for low inventory
    if (availabilityRate <= this.alertThresholds.criticalInventory) {
      const alert = this.createAlert('critical_inventory', {
        severity: 'critical',
        hotelId: record.hotelId,
        roomTypeId: record.roomTypeId,
        date: record.date,
        details: {
          totalRooms,
          availableRooms,
          availabilityRate: Math.round(availabilityRate * 100),
          threshold: Math.round(this.alertThresholds.criticalInventory * 100)
        }
      });
      
      alerts.push(alert);
      this.activeAlerts.set(alertKey, alert);
      
    } else if (availabilityRate <= this.alertThresholds.lowInventory) {
      const alert = this.createAlert('low_inventory', {
        severity: 'warning',
        hotelId: record.hotelId,
        roomTypeId: record.roomTypeId,
        date: record.date,
        details: {
          totalRooms,
          availableRooms,
          availabilityRate: Math.round(availabilityRate * 100),
          threshold: Math.round(this.alertThresholds.lowInventory * 100)
        }
      });
      
      alerts.push(alert);
      this.activeAlerts.set(alertKey, alert);
    }
    
    // Check stop sell rules
    if (this.alertThresholds.stopSellViolation) {
      const stopSellAlerts = await this.checkStopSellRules(record);
      alerts.push(...stopSellAlerts);
    }
    
    // Check for unusual patterns
    const patternAlerts = this.checkUnusualPatterns(record);
    alerts.push(...patternAlerts);
    
    return alerts;
  }

  /**
   * Check if stop sell rules are being violated
   */
  async checkStopSellRules(record) {
    const alerts = [];
    
    try {
      // Get active stop sell rules for this hotel and date
      const rules = await StopSellRule.find({
        hotelId: record.hotelId,
        isActive: true,
        'dateRange.startDate': { $lte: record.date },
        'dateRange.endDate': { $gte: record.date }
      });
      
      for (const rule of rules) {
        // Check if rule applies to this room type
        if (!rule.allRoomTypes && rule.roomTypes.length > 0) {
          if (!rule.roomTypes.some(rt => rt.toString() === record.roomTypeId.toString())) {
            continue; // Rule doesn't apply to this room type
          }
        }
        
        // Check if rule actions are being violated
        if (rule.actions.stopSell && record.availableRooms > 0) {
          const alert = this.createAlert('stop_sell_violation', {
            severity: 'warning',
            hotelId: record.hotelId,
            roomTypeId: record.roomTypeId,
            date: record.date,
            details: {
              ruleId: rule.ruleId,
              ruleName: rule.name,
              ruleType: rule.ruleType,
              availableRooms: record.availableRooms,
              message: `Stop sell rule active but rooms still available`
            }
          });
          
          alerts.push(alert);
        }
        
        if (rule.actions.closedToArrival && record.availableRooms > 0) {
          const alert = this.createAlert('closed_to_arrival_violation', {
            severity: 'warning',
            hotelId: record.hotelId,
            roomTypeId: record.roomTypeId,
            date: record.date,
            details: {
              ruleId: rule.ruleId,
              ruleName: rule.name,
              ruleType: rule.ruleType,
              availableRooms: record.availableRooms,
              message: `Closed to arrival rule active but rooms still available`
            }
          });
          
          alerts.push(alert);
        }
      }
      
    } catch (error) {
      logger.error(`Error checking stop sell rules: ${error.message}`, {
        recordId: record._id,
        error: error.stack
      });
    }
    
    return alerts;
  }

  /**
   * Check for unusual inventory patterns
   */
  checkUnusualPatterns(record) {
    const alerts = [];
    
    // Check for sudden inventory drops
    if (record.availableRooms > 0 && record.soldRooms > 0) {
      const soldPercentage = record.soldRooms / record.totalRooms;
      
      // Alert if more than 80% sold in a single day (might indicate bulk booking)
      if (soldPercentage > 0.8) {
        const alert = this.createAlert('bulk_booking_detected', {
          severity: 'info',
          hotelId: record.hotelId,
          roomTypeId: record.roomTypeId,
          date: record.date,
          details: {
            totalRooms: record.totalRooms,
            soldRooms: record.soldRooms,
            soldPercentage: Math.round(soldPercentage * 100),
            message: 'High percentage of rooms sold in single day - possible bulk booking'
          }
        });
        
        alerts.push(alert);
      }
    }
    
    // Check for blocked rooms without clear reason
    if (record.blockedRooms > 0 && record.blockedRooms > record.totalRooms * 0.3) {
      const alert = this.createAlert('high_blocked_rooms', {
        severity: 'warning',
        hotelId: record.hotelId,
        roomTypeId: record.roomTypeId,
        date: record.date,
        details: {
          totalRooms: record.totalRooms,
          blockedRooms: record.blockedRooms,
          blockedPercentage: Math.round((record.blockedRooms / record.totalRooms) * 100),
          message: 'High percentage of rooms blocked - review maintenance/cleaning schedules'
        }
      });
      
      alerts.push(alert);
    }
    
    return alerts;
  }

  /**
   * Create an alert object
   */
  createAlert(type, data) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity: data.severity || 'info',
      timestamp: new Date(),
      hotelId: data.hotelId,
      roomTypeId: data.roomTypeId,
      date: data.date,
      details: data.details,
      status: 'active',
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null
    };
    
    // Add to alert history
    this.alertHistory.push(alert);
    
    // Keep only last 1000 alerts in memory
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }
    
    return alert;
  }

  /**
   * Send alerts through configured channels
   */
  async sendAlerts(alerts) {
    if (alerts.length === 0) return;
    
    logger.info(`Sending ${alerts.length} inventory alerts`);
    
    try {
      // Send via WebSocket for real-time updates
      if (this.alertChannels.websocket) {
        await this.sendWebSocketAlerts(alerts);
      }
      
      // Store in database
      if (this.alertChannels.database) {
        await this.storeAlertsInDatabase(alerts);
      }
      
      // TODO: Send email alerts
      if (this.alertChannels.email) {
        // await this.sendEmailAlerts(alerts);
      }
      
      // TODO: Send Slack alerts
      if (this.alertChannels.slack) {
        // await this.sendSlackAlerts(alerts);
      }
      
    } catch (error) {
      logger.error(`Error sending alerts: ${error.message}`, {
        alertCount: alerts.length,
        error: error.stack
      });
    }
  }

  /**
   * Send alerts via WebSocket for real-time updates
   */
  async sendWebSocketAlerts(alerts) {
    try {
      // Group alerts by hotel for efficient broadcasting
      const alertsByHotel = {};
      
      alerts.forEach(alert => {
        if (!alertsByHotel[alert.hotelId]) {
          alertsByHotel[alert.hotelId] = [];
        }
        alertsByHotel[alert.hotelId].push(alert);
      });
      
      // Send to each hotel's admin users
      for (const [hotelId, hotelAlerts] of Object.entries(alertsByHotel)) {
        await websocketService.broadcastToHotel(hotelId, 'inventory_alert', {
          type: 'inventory_alerts',
          alerts: hotelAlerts,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      logger.error(`Error sending WebSocket alerts: ${error.message}`, {
        error: error.stack
      });
    }
  }

  /**
   * Store alerts in database for persistence
   */
  async storeAlertsInDatabase(alerts) {
    try {
      // TODO: Implement Alert model and database storage
      // For now, we'll just log them
      logger.info(`Storing ${alerts.length} alerts in database`);
      
      // This would typically store in an Alert collection
      // await Alert.insertMany(alerts);
      
    } catch (error) {
      logger.error(`Error storing alerts in database: ${error.message}`, {
        error: error.stack
      });
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId, userId) {
    const alert = this.alertHistory.find(a => a.id === alertId);
    
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
      alert.status = 'acknowledged';
      
      // Remove from active alerts
      const alertKey = `${alert.roomTypeId}_${alert.date.toISOString().split('T')[0]}`;
      this.activeAlerts.delete(alertKey);
      
      logger.info(`Alert ${alertId} acknowledged by user ${userId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Get active alerts for a hotel
   */
  getActiveAlerts(hotelId) {
    return this.alertHistory.filter(alert => 
      alert.hotelId.toString() === hotelId.toString() && 
      alert.status === 'active'
    );
  }

  /**
   * Get alert history for a hotel
   */
  getAlertHistory(hotelId, limit = 100) {
    return this.alertHistory
      .filter(alert => alert.hotelId.toString() === hotelId.toString())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Clear resolved alerts
   */
  clearResolvedAlerts() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Remove alerts older than 24 hours
    this.alertHistory = this.alertHistory.filter(alert => 
      alert.timestamp > oneDayAgo || alert.status === 'active'
    );
    
    // Clear old active alerts
    for (const [key, alert] of this.activeAlerts.entries()) {
      if (alert.timestamp < oneDayAgo) {
        this.activeAlerts.delete(key);
      }
    }
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(newThresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
    logger.info('Inventory alert thresholds updated', { newThresholds });
  }

  /**
   * Update alert channels
   */
  updateAlertChannels(newChannels) {
    this.alertChannels = { ...this.alertChannels, ...newChannels };
    logger.info('Alert channels updated', { newChannels });
  }
}

// Export singleton instance
export default new InventoryAlertService();
