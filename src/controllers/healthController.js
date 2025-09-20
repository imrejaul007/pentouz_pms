import healthCheckService from '../services/healthCheckService.js';
import { getPerformanceStats } from '../middleware/performanceMonitoring.js';
import { getErrorStats } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import { NotFoundError } from '../middleware/errorHandler.js';

export const getHealth = async (req, res, next) => {
  try {
    const healthStatus = await healthCheckService.runAllChecks();
    
    // Set appropriate HTTP status based on health
    let httpStatus = 200;
    if (healthStatus.status === 'degraded') {
      httpStatus = 200; // Still OK but with warnings
    } else if (healthStatus.status === 'unhealthy') {
      httpStatus = 503; // Service Unavailable
    }
    
    res.status(httpStatus).json({
      success: healthStatus.status !== 'unhealthy',
      data: healthStatus
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check system failure',
        timestamp: new Date().toISOString()
      }
    });
  }
};

export const getQuickHealth = async (req, res, next) => {
  try {
    const result = await healthCheckService.quickCheck();
    
    const httpStatus = result.status === 'healthy' ? 200 : 503;
    
    res.status(httpStatus).json(result);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      message: 'Quick health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

export const getSpecificCheck = async (req, res, next) => {
  try {
    const { checkName } = req.params;
    
    const result = await healthCheckService.runCheck(checkName);
    
    const httpStatus = result.status === 'healthy' ? 200 : 
                      result.status === 'degraded' ? 200 : 503;
    
    res.status(httpStatus).json({
      success: result.status !== 'unhealthy',
      data: result
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      throw new NotFoundError(`Health check '${req.params.checkName}' not found`);
    }
    next(error);
  }
};

export const getHealthHistory = async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    
    const history = healthCheckService.getHistory(parseInt(limit));
    
    res.json({
      success: true,
      data: {
        history,
        total: history.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getHealthMetrics = async (req, res, next) => {
  try {
    const healthMetrics = healthCheckService.getMetrics();
    const performanceStats = getPerformanceStats();
    const errorStats = getErrorStats();
    
    const combinedMetrics = {
      health: healthMetrics,
      performance: performanceStats,
      errors: errorStats,
      system: healthCheckService.getSystemInfo(),
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: combinedMetrics
    });
  } catch (error) {
    next(error);
  }
};

export const getSystemInfo = async (req, res, next) => {
  try {
    const systemInfo = healthCheckService.getSystemInfo();
    
    res.json({
      success: true,
      data: systemInfo
    });
  } catch (error) {
    next(error);
  }
};

export const getReadiness = async (req, res, next) => {
  try {
    // Readiness check - can we serve traffic?
    const criticalChecks = ['database', 'memory', 'filesystem'];
    const results = {};
    let ready = true;
    
    for (const checkName of criticalChecks) {
      try {
        const result = await healthCheckService.runCheck(checkName);
        results[checkName] = result;
        
        if (result.status === 'unhealthy') {
          ready = false;
        }
      } catch (error) {
        results[checkName] = {
          status: 'unhealthy',
          error: error.message
        };
        ready = false;
      }
    }
    
    const httpStatus = ready ? 200 : 503;
    
    res.status(httpStatus).json({
      ready,
      timestamp: new Date().toISOString(),
      checks: results
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

export const getLiveness = async (req, res, next) => {
  try {
    // Liveness check - is the application alive?
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Basic checks for application liveness
    const alive = uptime > 0 && memoryUsage.heapUsed > 0;
    
    const httpStatus = alive ? 200 : 503;
    
    res.status(httpStatus).json({
      alive,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      pid: process.pid,
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
      }
    });
  } catch (error) {
    res.status(503).json({
      alive: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

export const getVersion = async (req, res, next) => {
  try {
    // Using static values to avoid import assertion syntax issues
    const packageInfo = {
      name: 'hotel-backend',
      version: '1.0.0',
      description: 'Hotel Management System Backend API'
    };
    
    const versionInfo = {
      name: packageInfo.name,
      version: packageInfo.version,
      description: packageInfo.description,
      node: process.version,
      environment: process.env.NODE_ENV || 'development',
      buildTime: process.env.BUILD_TIME || 'unknown',
      commit: process.env.GIT_COMMIT || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: versionInfo
    });
  } catch (error) {
    res.json({
      success: true,
      data: {
        name: 'hotel-backend',
        version: '1.0.0',
        node: process.version,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      }
    });
  }
};

export const getDetailedStatus = async (req, res, next) => {
  try {
    const [
      healthStatus,
      performanceStats,
      errorStats,
      systemInfo
    ] = await Promise.all([
      healthCheckService.runAllChecks(),
      Promise.resolve(getPerformanceStats()),
      Promise.resolve(getErrorStats()),
      Promise.resolve(healthCheckService.getSystemInfo())
    ]);
    
    const detailedStatus = {
      overall: {
        status: healthStatus.status,
        timestamp: healthStatus.timestamp,
        responseTime: healthStatus.responseTime
      },
      health: {
        summary: healthStatus.summary,
        checks: healthStatus.checks
      },
      performance: performanceStats,
      errors: errorStats,
      system: systemInfo,
      uptime: {
        application: Math.floor(process.uptime()),
        system: systemInfo.uptime
      }
    };
    
    // Set HTTP status based on overall health
    let httpStatus = 200;
    if (healthStatus.status === 'unhealthy') {
      httpStatus = 503;
    } else if (healthStatus.status === 'degraded') {
      httpStatus = 200;
    }
    
    res.status(httpStatus).json({
      success: healthStatus.status !== 'unhealthy',
      data: detailedStatus
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboard = async (req, res, next) => {
  try {
    // Get recent health history for trends
    const healthHistory = healthCheckService.getHistory(20);
    const metrics = healthCheckService.getMetrics();
    const performanceStats = getPerformanceStats();
    const errorStats = getErrorStats();
    
    // Calculate trends
    const trends = {
      health: {
        current: healthHistory.length > 0 ? healthHistory[healthHistory.length - 1].status : 'unknown',
        trend: calculateTrend(healthHistory.map(h => h.status))
      },
      performance: {
        averageResponseTime: performanceStats.summary?.averageResponseTime || 0,
        trend: 'stable' // Would calculate from performance history
      },
      errors: {
        errorRate: errorStats.totalErrorCount > 0 ? 
          Math.round((errorStats.totalErrorCount / (errorStats.totalErrorCount + 100)) * 100) : 0,
        trend: errorStats.errors.length > 5 ? 'increasing' : 'stable'
      }
    };
    
    // Recent alerts (from last 24 hours of logs)
    const alerts = healthHistory
      .filter(h => h.status !== 'healthy')
      .slice(-10)
      .map(h => ({
        timestamp: h.timestamp,
        status: h.status,
        message: `System ${h.status}`,
        services: Object.entries(h.checks || {})
          .filter(([, check]) => check.status !== 'healthy')
          .map(([name]) => name)
      }));
    
    const dashboard = {
      overview: {
        status: healthHistory.length > 0 ? healthHistory[healthHistory.length - 1].status : 'unknown',
        uptime: Math.floor(process.uptime()),
        responseTime: metrics.averageResponseTime,
        errorRate: trends.errors.errorRate
      },
      trends,
      alerts: alerts.slice(-5), // Last 5 alerts
      services: healthHistory.length > 0 ? 
        Object.keys(healthHistory[healthHistory.length - 1].checks || {}) : [],
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to calculate trends
function calculateTrend(statusHistory) {
  if (statusHistory.length < 5) return 'insufficient_data';
  
  const recentStatuses = statusHistory.slice(-5);
  const healthyCount = recentStatuses.filter(s => s === 'healthy').length;
  const unhealthyCount = recentStatuses.filter(s => s === 'unhealthy').length;
  
  if (unhealthyCount > healthyCount) return 'degrading';
  if (healthyCount === recentStatuses.length) return 'stable';
  return 'improving';
}

export default {
  getHealth,
  getQuickHealth,
  getSpecificCheck,
  getHealthHistory,
  getHealthMetrics,
  getSystemInfo,
  getReadiness,
  getLiveness,
  getVersion,
  getDetailedStatus,
  getDashboard
};
