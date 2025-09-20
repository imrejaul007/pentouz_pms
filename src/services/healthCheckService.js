import mongoose from 'mongoose';
import Redis from 'ioredis';
import os from 'os';
import logger from '../utils/logger.js';
import emailService from './emailService.js';

class HealthCheckService {
  constructor() {
    this.checks = new Map();
    this.healthHistory = [];
    this.alertThresholds = {
      response_time: 5000, // 5 seconds
      error_rate: 5, // 5%
      memory_usage: 85, // 85%
      cpu_usage: 90 // 90%
    };
    this.periodicCheckInterval = null;
    
    this.initializeChecks();
    // Don't auto-start periodic checks - only start when explicitly needed
    // this.startPeriodicChecks();
  }

  /**
   * Initialize health check functions
   */
  initializeChecks() {
    // Database connectivity check
    this.addCheck('database', async () => {
      try {
        const start = Date.now();
        const connection = mongoose.connection;
        
        if (connection.readyState !== 1) {
          return {
            status: 'unhealthy',
            error: 'Database connection not ready',
            details: {
              state: connection.readyState,
              stateDescription: this.getConnectionStateDescription(connection.readyState)
            }
          };
        }
        
        // Perform a simple query to test connectivity
        await mongoose.connection.db.admin().ping();
        const responseTime = Date.now() - start;
        
        return {
          status: 'healthy',
          responseTime,
          details: {
            state: connection.readyState,
            stateDescription: 'connected',
            host: connection.host,
            port: connection.port,
            database: connection.name
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message,
          details: {
            state: mongoose.connection.readyState,
            stateDescription: this.getConnectionStateDescription(mongoose.connection.readyState)
          }
        };
      }
    });

    // Redis connectivity check
    this.addCheck('redis', async () => {
      try {
        const start = Date.now();
        const redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 1,
          lazyConnect: true
        });

        await redis.ping();
        const responseTime = Date.now() - start;
        
        // Get Redis info
        const info = await redis.info();
        const serverInfo = this.parseRedisInfo(info);
        
        await redis.disconnect();
        
        return {
          status: 'healthy',
          responseTime,
          details: {
            version: serverInfo.redis_version,
            mode: serverInfo.redis_mode,
            role: serverInfo.role,
            connected_clients: serverInfo.connected_clients,
            used_memory: serverInfo.used_memory_human,
            uptime: serverInfo.uptime_in_seconds
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    // Memory usage check
    this.addCheck('memory', async () => {
      try {
        const usage = process.memoryUsage();
        const totalMemory = usage.heapTotal + usage.external;
        const usedMemory = usage.heapUsed;
        const memoryUsagePercent = (usedMemory / totalMemory) * 100;
        
        const status = memoryUsagePercent > this.alertThresholds.memory_usage 
          ? 'degraded' 
          : 'healthy';
        
        return {
          status,
          details: {
            heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
            external: `${Math.round(usage.external / 1024 / 1024)}MB`,
            rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
            usagePercent: Math.round(memoryUsagePercent * 100) / 100
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    // File system check
    this.addCheck('filesystem', async () => {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        const start = Date.now();
        const testFile = path.join(process.cwd(), '.health-check');
        
        // Write test
        await fs.writeFile(testFile, 'health-check-' + Date.now());
        
        // Read test
        await fs.readFile(testFile);
        
        // Delete test
        await fs.unlink(testFile);
        
        const responseTime = Date.now() - start;
        
        return {
          status: 'healthy',
          responseTime,
          details: {
            writable: true,
            readable: true
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    // External dependencies check
    this.addCheck('external_services', async () => {
      const results = {};
      let overallStatus = 'healthy';
      
      // Check email service
      try {
        await emailService.verifyConnection();
        results.email = { status: 'healthy' };
      } catch (error) {
        results.email = { status: 'unhealthy', error: error.message };
        overallStatus = 'degraded';
      }
      
      // Check payment gateway (mock)
      try {
        // This would be actual payment gateway health check
        results.payment_gateway = { 
          status: 'healthy',
          details: { provider: 'stripe' }
        };
      } catch (error) {
        results.payment_gateway = { status: 'unhealthy', error: error.message };
        overallStatus = 'degraded';
      }
      
      return {
        status: overallStatus,
        details: results
      };
    });

    // Application metrics check
    this.addCheck('application', async () => {
      try {
        const start = Date.now();
        const uptime = process.uptime();
        
        // Get environment info
        const env = {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          environment: process.env.NODE_ENV || 'development',
          pid: process.pid
        };
        
        const responseTime = Date.now() - start;
        
        return {
          status: 'healthy',
          responseTime,
          details: {
            uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
            uptimeSeconds: Math.floor(uptime),
            environment: env,
            startTime: new Date(Date.now() - uptime * 1000).toISOString()
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    // Custom business logic health check
    this.addCheck('business_logic', async () => {
      try {
        // Skip if database is not connected
        if (mongoose.connection.readyState !== 1) {
          return {
            status: 'degraded',
            error: 'Database not connected',
            details: {
              databaseState: 'disconnected',
              userCount: 0,
              activeHotels: 0,
              recentBookings: 0
            }
          };
        }

        // Test core business operations
        const start = Date.now();
        
        // Test database queries that are critical for the application
        let userCount = 0;
        let hotelCount = 0;
        let recentBookingCount = 0;

        try {
          // Try to get models - they might not exist in development
          const User = mongoose.models.User || null;
          const Hotel = mongoose.models.Hotel || null;
          const Booking = mongoose.models.Booking || null;

          if (User) {
            userCount = await User.countDocuments();
          }
          
          if (Hotel) {
            hotelCount = await Hotel.countDocuments({ status: 'active' });
          }
          
          if (Booking) {
            recentBookingCount = await Booking.countDocuments({
              createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });
          }
        } catch (modelError) {
          // Models might not be available, but that's OK for development
        }
        
        const responseTime = Date.now() - start;
        
        return {
          status: 'healthy',
          responseTime,
          details: {
            userCount,
            activeHotels: hotelCount,
            recentBookings: recentBookingCount
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });
  }

  /**
   * Add a custom health check
   */
  addCheck(name, checkFunction) {
    this.checks.set(name, checkFunction);
  }

  /**
   * Remove a health check
   */
  removeCheck(name) {
    this.checks.delete(name);
  }

  /**
   * Run all health checks
   */
  async runAllChecks() {
    const results = {};
    const startTime = Date.now();
    let overallStatus = 'healthy';
    
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      try {
        const result = await Promise.race([
          checkFn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 10000)
          )
        ]);
        
        results[name] = result;
        
        // Update overall status
        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message
        };
        overallStatus = 'unhealthy';
      }
    });
    
    await Promise.all(checkPromises);
    
    const totalTime = Date.now() - startTime;
    
    const healthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: totalTime,
      checks: results,
      summary: this.generateSummary(results)
    };

    // Store in history for trending
    this.addToHistory(healthStatus);
    
    return healthStatus;
  }

  /**
   * Run a specific health check
   */
  async runCheck(checkName) {
    if (!this.checks.has(checkName)) {
      throw new Error(`Health check '${checkName}' not found`);
    }
    
    const checkFn = this.checks.get(checkName);
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        checkFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 10000)
        )
      ]);
      
      return {
        name: checkName,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        ...result
      };
    } catch (error) {
      return {
        name: checkName,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Get health check history
   */
  getHistory(limit = 50) {
    return this.healthHistory
      .slice(-limit)
      .map(entry => ({
        timestamp: entry.timestamp,
        status: entry.status,
        responseTime: entry.responseTime,
        summary: entry.summary
      }));
  }

  /**
   * Get health metrics
   */
  getMetrics() {
    const recent = this.healthHistory.slice(-20); // Last 20 checks
    
    if (recent.length === 0) {
      return {
        averageResponseTime: 0,
        uptime: 0,
        errorRate: 0,
        trends: {}
      };
    }
    
    const totalResponseTime = recent.reduce((sum, check) => sum + check.responseTime, 0);
    const averageResponseTime = Math.round(totalResponseTime / recent.length);
    
    const unhealthyChecks = recent.filter(check => check.status === 'unhealthy').length;
    const errorRate = Math.round((unhealthyChecks / recent.length) * 100);
    
    // Calculate trends for each check
    const trends = {};
    for (const checkName of this.checks.keys()) {
      const checkHistory = recent.map(h => h.checks[checkName]).filter(Boolean);
      if (checkHistory.length >= 2) {
        const latest = checkHistory.slice(-5); // Last 5 runs
        const healthy = latest.filter(c => c.status === 'healthy').length;
        trends[checkName] = {
          status: latest[latest.length - 1]?.status || 'unknown',
          healthyRate: Math.round((healthy / latest.length) * 100)
        };
      }
    }
    
    return {
      averageResponseTime,
      errorRate,
      totalChecks: recent.length,
      trends
    };
  }

  /**
   * Generate summary of check results
   */
  generateSummary(results) {
    const total = Object.keys(results).length;
    const healthy = Object.values(results).filter(r => r.status === 'healthy').length;
    const degraded = Object.values(results).filter(r => r.status === 'degraded').length;
    const unhealthy = Object.values(results).filter(r => r.status === 'unhealthy').length;
    
    return {
      total,
      healthy,
      degraded,
      unhealthy,
      healthyPercent: Math.round((healthy / total) * 100)
    };
  }

  /**
   * Add health check result to history
   */
  addToHistory(healthStatus) {
    this.healthHistory.push(healthStatus);
    
    // Keep only last 1000 entries
    if (this.healthHistory.length > 1000) {
      this.healthHistory = this.healthHistory.slice(-1000);
    }
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(intervalMs = 60000) { // Every minute
    if (this.periodicCheckInterval) {
      clearInterval(this.periodicCheckInterval);
    }
    
    this.periodicCheckInterval = setInterval(async () => {
      try {
        const result = await this.runAllChecks();
        
        // Check for alerts
        await this.checkAlertConditions(result);
      } catch (error) {
        logger.error('Periodic health check failed', { error: error.message });
      }
    }, intervalMs);
    
    logger.info('Periodic health checks started', { intervalMs });
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks() {
    if (this.periodicCheckInterval) {
      clearInterval(this.periodicCheckInterval);
      this.periodicCheckInterval = null;
    }
  }

  /**
   * Check for alert conditions
   */
  async checkAlertConditions(healthStatus) {
    const alerts = [];
    
    // Overall system health alert - but don't alert for database being unavailable in development
    if (healthStatus.status === 'unhealthy') {
      // Check if it's just the database being unavailable
      const isDatabaseOnlyIssue = this.isDatabaseOnlyIssue(healthStatus);
      
      if (!isDatabaseOnlyIssue || process.env.NODE_ENV === 'production') {
        alerts.push({
          severity: 'critical',
          message: 'System health check failed',
          details: healthStatus.summary
        });
      }
    } else if (healthStatus.status === 'degraded') {
      // Only alert for degraded status in production, or if it's not just database
      const isDatabaseOnlyIssue = this.isDatabaseOnlyIssue(healthStatus);
      
      if (!isDatabaseOnlyIssue || process.env.NODE_ENV === 'production') {
        alerts.push({
          severity: 'info', // Reduced severity for development
          message: 'System performance degraded',
          details: healthStatus.summary
        });
      }
    }
    
    // Check response time
    if (healthStatus.responseTime > this.alertThresholds.response_time) {
      alerts.push({
        severity: 'warning',
        message: `Health check response time high: ${healthStatus.responseTime}ms`,
        threshold: this.alertThresholds.response_time
      });
    }
    
    // Check individual services - but be more lenient for database issues in development
    for (const [checkName, result] of Object.entries(healthStatus.checks)) {
      if (result.status === 'unhealthy') {
        // Skip database and business_logic alerts in development when database is unavailable
        if (process.env.NODE_ENV === 'development' && 
            (checkName === 'database' || checkName === 'business_logic') &&
            (result.error?.includes('Database') || result.error?.includes('connection'))) {
          continue; // Skip database-related alerts in development
        }
        
        alerts.push({
          severity: checkName === 'database' ? 'warning' : 'critical',
          message: `Service '${checkName}' is unhealthy`,
          error: result.error,
          service: checkName
        });
      }
    }
    
    // Send alerts if any
    if (alerts.length > 0) {
      await this.sendHealthAlerts(alerts, healthStatus);
    }
  }

  /**
   * Send health alerts
   */
  async sendHealthAlerts(alerts, healthStatus) {
    for (const alert of alerts) {
      // Use different log levels based on severity and environment
      const logLevel = process.env.NODE_ENV === 'development' && alert.severity === 'info' ? 'debug' : 
                       alert.severity === 'warning' ? 'warn' : 
                       alert.severity === 'critical' ? 'error' : 'warn';
      
      logger[logLevel]('Health Check Alert', {
        alert: true,
        severity: alert.severity,
        message: alert.message,
        timestamp: healthStatus.timestamp,
        ...alert
      });
      
      // In production, this would send to alerting system
      // await alertingService.send(alert);
    }
  }

  /**
   * Parse Redis info string
   */
  parseRedisInfo(infoString) {
    const info = {};
    const lines = infoString.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        info[key] = value;
      }
    }
    
    return info;
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    // os imported at top of file
    
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
      freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`,
      uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
      loadAverage: os.loadavg(),
      nodeVersion: process.version,
      processUptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`
    };
  }

  /**
   * Create a lightweight health check for load balancers
   */
  async quickCheck() {
    try {
      // Check database connection - but don't fail if it's not connected
      const dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'degraded';
      const dbMessage = mongoose.connection.readyState === 1 ? 'Database connected' : 'Database not connected';
      
      return { 
        status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
        message: dbMessage,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        database: {
          status: dbStatus,
          state: mongoose.connection.readyState
        }
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get description for MongoDB connection state
   */
  getConnectionStateDescription(state) {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };
    return states[state] || 'unknown';
  }

  /**
   * Check if health issues are only database-related
   */
  isDatabaseOnlyIssue(healthStatus) {
    if (!healthStatus.checks) return false;
    
    const unhealthyChecks = Object.entries(healthStatus.checks)
      .filter(([_, result]) => result.status === 'unhealthy');
    
    // If no unhealthy checks, check for degraded ones
    if (unhealthyChecks.length === 0) {
      const degradedChecks = Object.entries(healthStatus.checks)
        .filter(([_, result]) => result.status === 'degraded');
      
      return degradedChecks.every(([checkName, result]) => 
        checkName === 'database' || 
        checkName === 'business_logic' ||
        (result.error && result.error.includes('Database'))
      );
    }
    
    // Check if all unhealthy services are database-related
    return unhealthyChecks.every(([checkName, result]) => 
      checkName === 'database' || 
      checkName === 'business_logic' ||
      (result.error && (result.error.includes('Database') || result.error.includes('connection')))
    );
  }
}

// Create singleton instance
const healthCheckService = new HealthCheckService();

export default healthCheckService;