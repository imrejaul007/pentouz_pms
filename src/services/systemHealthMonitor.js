import os from 'os';
import mongoose from 'mongoose';
import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import GuestService from '../models/GuestService.js';
import MaintenanceTask from '../models/MaintenanceTask.js';

class SystemHealthMonitor {
  constructor() {
    this.redis = getRedisClient();
    this.isMonitoring = false;
    this.alerts = new Map();
    this.metrics = {
      cpu: { current: 0, history: [] },
      memory: { current: 0, history: [] },
      disk: { current: 0, history: [] },
      database: { responseTime: 0, connections: 0 },
      redis: { responseTime: 0, memory: 0 },
      api: { responseTime: 0, errorRate: 0 }
    };
  }

  async start() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    logger.info('🔄 Starting system health monitoring...');

    // Run initial health check
    await this.performHealthCheck();

    // Schedule periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000); // Every 30 seconds

    // Schedule alert cleanup
    this.alertCleanupInterval = setInterval(() => {
      this.cleanupOldAlerts();
    }, 300000); // Every 5 minutes

    logger.info('✅ System health monitoring started');
  }

  stop() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.alertCleanupInterval) {
      clearInterval(this.alertCleanupInterval);
    }

    logger.info('System health monitoring stopped');
  }

  async performHealthCheck() {
    try {
      const healthData = {
        timestamp: new Date(),
        system: await this.getSystemMetrics(),
        database: await this.getDatabaseMetrics(),
        redis: await this.getRedisMetrics(),
        application: await this.getApplicationMetrics(),
        services: await this.getServiceHealth()
      };

      // Update metrics history
      this.updateMetricsHistory(healthData);

      // Check for alerts
      await this.checkAlerts(healthData);

      // Store in Redis for quick access
      if (this.redis && this.redis.isReady) {
        await this.redis.setEx('system:health', 300, JSON.stringify(healthData));
      }

      return healthData;
    } catch (error) {
      logger.error('Health check failed:', error);
      return null;
    }
  }

  async getSystemMetrics() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Calculate CPU usage (simplified)
    const cpuUsage = Math.round(os.loadavg()[0] / cpus.length * 100);

    return {
      cpu: {
        usage: Math.min(100, cpuUsage),
        cores: cpus.length,
        loadAverage: os.loadavg()
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usage: Math.round((usedMem / totalMem) * 100)
      },
      uptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch()
    };
  }

  async getDatabaseMetrics() {
    const startTime = Date.now();

    try {
      // Test database connectivity and measure response time
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - startTime;

      // Get connection statistics
      const stats = await mongoose.connection.db.stats();

      return {
        connected: mongoose.connection.readyState === 1,
        responseTime,
        connections: mongoose.connections.length,
        dbSize: stats.dataSize,
        collections: stats.collections,
        objects: stats.objects,
        indexes: stats.indexes
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  async getRedisMetrics() {
    if (!this.redis || !this.redis.isReady) {
      return {
        connected: false,
        responseTime: null,
        error: 'Redis not connected'
      };
    }

    const startTime = Date.now();

    try {
      await this.redis.ping();
      const responseTime = Date.now() - startTime;

      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const usedMemory = memoryMatch ? parseInt(memoryMatch[1]) : 0;

      return {
        connected: true,
        responseTime,
        memory: usedMemory,
        status: 'healthy'
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  async getApplicationMetrics() {
    const startTime = Date.now();

    try {
      // Get recent activity metrics
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      const [recentBookings, activeUsers, activeServices] = await Promise.all([
        Booking.countDocuments({
          createdAt: { $gte: thirtyMinutesAgo }
        }),
        User.countDocuments({
          lastLogin: { $gte: thirtyMinutesAgo }
        }),
        GuestService.countDocuments({
          status: 'in_progress'
        })
      ]);

      return {
        responseTime: Date.now() - startTime,
        recentBookings,
        activeUsers,
        activeServices,
        processUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version
      };
    } catch (error) {
      return {
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  async getServiceHealth() {
    const services = {
      authentication: { status: 'healthy', responseTime: 0 },
      booking: { status: 'healthy', responseTime: 0 },
      payment: { status: 'healthy', responseTime: 0 },
      notifications: { status: 'healthy', responseTime: 0 }
    };

    // Test critical services
    for (const [serviceName, service] of Object.entries(services)) {
      const startTime = Date.now();

      try {
        switch (serviceName) {
          case 'booking':
            await Booking.findOne().limit(1);
            break;
          case 'authentication':
            await User.findOne().limit(1);
            break;
          default:
            // For other services, just measure basic response time
            break;
        }

        service.responseTime = Date.now() - startTime;
        service.status = service.responseTime > 5000 ? 'degraded' : 'healthy';
      } catch (error) {
        service.status = 'unhealthy';
        service.error = error.message;
        service.responseTime = Date.now() - startTime;
      }
    }

    return services;
  }

  updateMetricsHistory(healthData) {
    const maxHistoryLength = 100;

    // Update CPU history
    this.metrics.cpu.current = healthData.system.cpu.usage;
    this.metrics.cpu.history.push({
      timestamp: healthData.timestamp,
      value: healthData.system.cpu.usage
    });
    if (this.metrics.cpu.history.length > maxHistoryLength) {
      this.metrics.cpu.history.shift();
    }

    // Update memory history
    this.metrics.memory.current = healthData.system.memory.usage;
    this.metrics.memory.history.push({
      timestamp: healthData.timestamp,
      value: healthData.system.memory.usage
    });
    if (this.metrics.memory.history.length > maxHistoryLength) {
      this.metrics.memory.history.shift();
    }

    // Update database metrics
    this.metrics.database.responseTime = healthData.database.responseTime;
    this.metrics.database.connections = healthData.database.connections;

    // Update Redis metrics
    if (healthData.redis.connected) {
      this.metrics.redis.responseTime = healthData.redis.responseTime;
      this.metrics.redis.memory = healthData.redis.memory;
    }

    // Update API metrics
    this.metrics.api.responseTime = healthData.application.responseTime;
  }

  async checkAlerts(healthData) {
    const alerts = [];

    // CPU usage alert
    if (healthData.system.cpu.usage > 85) {
      alerts.push({
        id: 'high_cpu',
        type: 'system',
        severity: healthData.system.cpu.usage > 95 ? 'critical' : 'warning',
        title: 'High CPU Usage',
        message: `CPU usage is at ${healthData.system.cpu.usage}%`,
        metric: healthData.system.cpu.usage,
        threshold: 85,
        timestamp: healthData.timestamp
      });
    }

    // Memory usage alert
    if (healthData.system.memory.usage > 80) {
      alerts.push({
        id: 'high_memory',
        type: 'system',
        severity: healthData.system.memory.usage > 90 ? 'critical' : 'warning',
        title: 'High Memory Usage',
        message: `Memory usage is at ${healthData.system.memory.usage}%`,
        metric: healthData.system.memory.usage,
        threshold: 80,
        timestamp: healthData.timestamp
      });
    }

    // Database response time alert
    if (healthData.database.responseTime > 1000) {
      alerts.push({
        id: 'slow_database',
        type: 'database',
        severity: healthData.database.responseTime > 5000 ? 'critical' : 'warning',
        title: 'Slow Database Response',
        message: `Database response time is ${healthData.database.responseTime}ms`,
        metric: healthData.database.responseTime,
        threshold: 1000,
        timestamp: healthData.timestamp
      });
    }

    // Database connection alert
    if (!healthData.database.connected) {
      alerts.push({
        id: 'database_disconnected',
        type: 'database',
        severity: 'critical',
        title: 'Database Disconnected',
        message: 'Unable to connect to MongoDB database',
        timestamp: healthData.timestamp
      });
    }

    // Redis connection alert
    if (!healthData.redis.connected) {
      alerts.push({
        id: 'redis_disconnected',
        type: 'cache',
        severity: 'warning',
        title: 'Redis Disconnected',
        message: 'Unable to connect to Redis cache',
        timestamp: healthData.timestamp
      });
    }

    // Check for high maintenance load
    try {
      const urgentMaintenance = await MaintenanceTask.countDocuments({
        priority: 'urgent',
        status: { $in: ['pending', 'in_progress'] }
      });

      if (urgentMaintenance > 10) {
        alerts.push({
          id: 'high_maintenance_load',
          type: 'operational',
          severity: urgentMaintenance > 20 ? 'critical' : 'warning',
          title: 'High Maintenance Load',
          message: `${urgentMaintenance} urgent maintenance tasks require attention`,
          metric: urgentMaintenance,
          threshold: 10,
          timestamp: healthData.timestamp
        });
      }
    } catch (error) {
      logger.error('Error checking maintenance load:', error);
    }

    // Store new alerts
    alerts.forEach(alert => {
      this.alerts.set(alert.id, alert);
    });

    // Log critical alerts
    alerts.filter(a => a.severity === 'critical').forEach(alert => {
      logger.error(`CRITICAL ALERT: ${alert.title} - ${alert.message}`);
    });
  }

  cleanupOldAlerts() {
    const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoffTime) {
        this.alerts.delete(id);
      }
    }
  }

  getAlerts() {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getMetrics() {
    return this.metrics;
  }

  async getHealthSummary() {
    try {
      const healthData = await this.performHealthCheck();
      const alerts = this.getAlerts();
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      const warningAlerts = alerts.filter(a => a.severity === 'warning');

      return {
        overall: criticalAlerts.length > 0 ? 'critical' :
                warningAlerts.length > 0 ? 'warning' : 'healthy',
        timestamp: new Date(),
        alerts: {
          total: alerts.length,
          critical: criticalAlerts.length,
          warning: warningAlerts.length
        },
        metrics: this.metrics,
        services: healthData?.services || {},
        uptime: process.uptime()
      };
    } catch (error) {
      logger.error('Error generating health summary:', error);
      return {
        overall: 'unknown',
        timestamp: new Date(),
        error: error.message
      };
    }
  }
}

// Create singleton instance
const systemHealthMonitor = new SystemHealthMonitor();

export default systemHealthMonitor;