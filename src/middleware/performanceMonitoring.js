import logger from '../utils/logger.js';
import { performance } from 'perf_hooks';

// Performance metrics storage
const performanceMetrics = {
  requests: new Map(),
  slowQueries: [],
  resourceUsage: {
    memory: [],
    cpu: []
  }
};

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  SLOW_REQUEST: 1000, // 1 second
  VERY_SLOW_REQUEST: 5000, // 5 seconds
  HIGH_MEMORY_USAGE: 500 * 1024 * 1024, // 500MB
  ENDPOINT_SAMPLES: 1000 // Keep last 1000 samples per endpoint
};

export const performanceMonitoring = (options = {}) => {
  const {
    trackMemory = true,
    trackDatabase = true,
    sampleRate = 1.0, // Sample 100% of requests
    excludePaths = ['/health', '/metrics', '/favicon.ico']
  } = options;

  return (req, res, next) => {
    // Skip monitoring for excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Sampling - only monitor a percentage of requests
    if (Math.random() > sampleRate) {
      return next();
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    const endpoint = `${req.method} ${req.route?.path || req.path}`;

    // Track request start
    req.performanceStart = startTime;
    req.performanceEndpoint = endpoint;

    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const endMemory = process.memoryUsage();

      // Record performance metrics
      recordPerformanceMetrics({
        endpoint,
        method: req.method,
        statusCode: res.statusCode,
        duration,
        startMemory,
        endMemory,
        userAgent: req.headers['user-agent'],
        contentLength: res.get('content-length'),
        timestamp: new Date().toISOString(),
        userId: req.user?.id,
        hotelId: req.user?.hotelId
      });

      // Log slow requests
      if (duration > PERFORMANCE_THRESHOLDS.SLOW_REQUEST) {
        const level = duration > PERFORMANCE_THRESHOLDS.VERY_SLOW_REQUEST ? 'warn' : 'info';
        logger[level]('Slow Request Detected', {
          endpoint,
          duration: `${Math.round(duration)}ms`,
          statusCode: res.statusCode,
          userId: req.user?.id,
          hotelId: req.user?.hotelId,
          memoryUsage: endMemory.heapUsed,
          category: 'performance'
        });
      }

      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
};

function recordPerformanceMetrics(metrics) {
  const { endpoint } = metrics;

  // Initialize endpoint metrics if not exists
  if (!performanceMetrics.requests.has(endpoint)) {
    performanceMetrics.requests.set(endpoint, {
      totalRequests: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      statusCodes: {},
      samples: [],
      last24h: []
    });
  }

  const endpointMetrics = performanceMetrics.requests.get(endpoint);
  
  // Update aggregate metrics
  endpointMetrics.totalRequests++;
  endpointMetrics.totalDuration += metrics.duration;
  endpointMetrics.minDuration = Math.min(endpointMetrics.minDuration, metrics.duration);
  endpointMetrics.maxDuration = Math.max(endpointMetrics.maxDuration, metrics.duration);
  
  // Track status codes
  const statusCode = metrics.statusCode.toString();
  endpointMetrics.statusCodes[statusCode] = (endpointMetrics.statusCodes[statusCode] || 0) + 1;

  // Add sample (keep only recent samples)
  endpointMetrics.samples.push({
    duration: metrics.duration,
    statusCode: metrics.statusCode,
    timestamp: metrics.timestamp,
    memoryDelta: metrics.endMemory.heapUsed - metrics.startMemory.heapUsed,
    userId: metrics.userId
  });

  // Trim samples to keep only recent ones
  if (endpointMetrics.samples.length > PERFORMANCE_THRESHOLDS.ENDPOINT_SAMPLES) {
    endpointMetrics.samples = endpointMetrics.samples.slice(-PERFORMANCE_THRESHOLDS.ENDPOINT_SAMPLES);
  }

  // Track last 24 hours separately for trending
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  endpointMetrics.last24h.push({
    duration: metrics.duration,
    statusCode: metrics.statusCode,
    timestamp: now
  });

  // Clean old 24h data
  endpointMetrics.last24h = endpointMetrics.last24h.filter(sample => sample.timestamp > oneDayAgo);

  // Track memory usage
  performanceMetrics.resourceUsage.memory.push({
    timestamp: metrics.timestamp,
    heapUsed: metrics.endMemory.heapUsed,
    heapTotal: metrics.endMemory.heapTotal,
    external: metrics.endMemory.external,
    rss: metrics.endMemory.rss
  });

  // Keep only last 1000 memory samples
  if (performanceMetrics.resourceUsage.memory.length > 1000) {
    performanceMetrics.resourceUsage.memory = performanceMetrics.resourceUsage.memory.slice(-1000);
  }

  // Check for memory alerts
  if (metrics.endMemory.heapUsed > PERFORMANCE_THRESHOLDS.HIGH_MEMORY_USAGE) {
    logger.warn('High Memory Usage Detected', {
      endpoint,
      heapUsed: `${Math.round(metrics.endMemory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(metrics.endMemory.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(metrics.endMemory.rss / 1024 / 1024)}MB`,
      category: 'performance'
    });
  }
}

// Database query performance tracking
export const trackDatabaseQuery = (operation, model, query) => {
  const startTime = performance.now();

  return {
    end: (resultCount = 0) => {
      const duration = performance.now() - startTime;
      
      // Log slow database queries
      if (duration > 100) { // 100ms threshold
        logger.warn('Slow Database Query', {
          operation,
          model,
          query: typeof query === 'object' ? JSON.stringify(query) : query,
          duration: `${Math.round(duration)}ms`,
          resultCount,
          category: 'database'
        });
      }

      // Store slow query for analysis
      if (duration > 500) { // 500ms threshold for storage
        performanceMetrics.slowQueries.push({
          operation,
          model,
          query,
          duration,
          resultCount,
          timestamp: new Date().toISOString()
        });

        // Keep only last 100 slow queries
        if (performanceMetrics.slowQueries.length > 100) {
          performanceMetrics.slowQueries = performanceMetrics.slowQueries.slice(-100);
        }
      }

      return duration;
    }
  };
};

// Get performance statistics
export const getPerformanceStats = () => {
  const stats = {
    endpoints: {},
    summary: {
      totalRequests: 0,
      averageResponseTime: 0,
      slowestEndpoint: null,
      errorRate: 0
    },
    slowQueries: performanceMetrics.slowQueries.slice(-20), // Last 20 slow queries
    memoryTrend: performanceMetrics.resourceUsage.memory.slice(-50) // Last 50 memory samples
  };

  let totalDuration = 0;
  let totalErrors = 0;
  let slowestEndpoint = { endpoint: null, avgDuration: 0 };

  // Process endpoint metrics
  for (const [endpoint, metrics] of performanceMetrics.requests.entries()) {
    const avgDuration = metrics.totalDuration / metrics.totalRequests;
    const errorCount = Object.entries(metrics.statusCodes)
      .filter(([code]) => code.startsWith('4') || code.startsWith('5'))
      .reduce((sum, [, count]) => sum + count, 0);
    
    const errorRate = (errorCount / metrics.totalRequests) * 100;

    // Calculate percentiles from samples
    const sortedDurations = metrics.samples
      .map(s => s.duration)
      .sort((a, b) => a - b);
    
    const p50 = getPercentile(sortedDurations, 50);
    const p90 = getPercentile(sortedDurations, 90);
    const p95 = getPercentile(sortedDurations, 95);
    const p99 = getPercentile(sortedDurations, 99);

    // Recent performance (last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentSamples = metrics.samples.filter(s => 
      new Date(s.timestamp).getTime() > oneHourAgo
    );

    stats.endpoints[endpoint] = {
      totalRequests: metrics.totalRequests,
      averageResponseTime: Math.round(avgDuration),
      minResponseTime: Math.round(metrics.minDuration),
      maxResponseTime: Math.round(metrics.maxDuration),
      p50: Math.round(p50),
      p90: Math.round(p90),
      p95: Math.round(p95),
      p99: Math.round(p99),
      errorRate: Math.round(errorRate * 100) / 100,
      statusCodes: metrics.statusCodes,
      recentRequests: recentSamples.length,
      trend: calculateTrend(metrics.last24h)
    };

    // Update summary stats
    stats.summary.totalRequests += metrics.totalRequests;
    totalDuration += metrics.totalDuration;
    totalErrors += errorCount;

    if (avgDuration > slowestEndpoint.avgDuration) {
      slowestEndpoint = { endpoint, avgDuration };
    }
  }

  // Calculate summary statistics
  stats.summary.averageResponseTime = stats.summary.totalRequests > 0 
    ? Math.round(totalDuration / stats.summary.totalRequests)
    : 0;
  
  stats.summary.errorRate = stats.summary.totalRequests > 0
    ? Math.round((totalErrors / stats.summary.totalRequests) * 10000) / 100
    : 0;

  stats.summary.slowestEndpoint = slowestEndpoint.endpoint;

  // System resource usage
  const latestMemory = performanceMetrics.resourceUsage.memory.slice(-1)[0];
  if (latestMemory) {
    stats.summary.memoryUsage = {
      heapUsed: `${Math.round(latestMemory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(latestMemory.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(latestMemory.rss / 1024 / 1024)}MB`
    };
  }

  return stats;
};

// Calculate percentile from sorted array
function getPercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)] || 0;
}

// Calculate performance trend (improved/degraded/stable)
function calculateTrend(samples) {
  if (samples.length < 10) return 'insufficient_data';

  const midPoint = Math.floor(samples.length / 2);
  const firstHalf = samples.slice(0, midPoint);
  const secondHalf = samples.slice(midPoint);

  const firstAvg = firstHalf.reduce((sum, s) => sum + s.duration, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, s) => sum + s.duration, 0) / secondHalf.length;

  const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (percentChange > 15) return 'degraded';
  if (percentChange < -15) return 'improved';
  return 'stable';
}

// Clear performance metrics (for maintenance)
export const clearPerformanceMetrics = () => {
  performanceMetrics.requests.clear();
  performanceMetrics.slowQueries.length = 0;
  performanceMetrics.resourceUsage.memory.length = 0;
  performanceMetrics.resourceUsage.cpu.length = 0;
};

// Periodic memory monitoring
let memoryMonitoringInterval;

export const startMemoryMonitoring = (intervalMs = 60000) => {
  if (memoryMonitoringInterval) {
    clearInterval(memoryMonitoringInterval);
  }

  memoryMonitoringInterval = setInterval(() => {
    const memUsage = process.memoryUsage();
    const timestamp = new Date().toISOString();

    performanceMetrics.resourceUsage.memory.push({
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    });

    // Keep only last 1440 samples (24 hours at 1-minute intervals)
    if (performanceMetrics.resourceUsage.memory.length > 1440) {
      performanceMetrics.resourceUsage.memory = performanceMetrics.resourceUsage.memory.slice(-1440);
    }

    // Log memory alerts
    if (memUsage.heapUsed > PERFORMANCE_THRESHOLDS.HIGH_MEMORY_USAGE) {
      logger.warn('High Memory Usage Alert', {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        category: 'system'
      });
    }
  }, intervalMs);
};

export const stopMemoryMonitoring = () => {
  if (memoryMonitoringInterval) {
    clearInterval(memoryMonitoringInterval);
    memoryMonitoringInterval = null;
  }
};

// Request correlation tracking
export const requestCorrelation = (req, res, next) => {
  const startTime = Date.now();
  
  // Add correlation ID if not present
  if (!req.correlationId) {
    req.correlationId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add request ID if not present
  if (!req.requestId) {
    req.requestId = `${req.method}_${startTime}_${Math.random().toString(36).substr(2, 5)}`;
  }

  // Add to response headers for tracking
  res.setHeader('X-Correlation-ID', req.correlationId);
  res.setHeader('X-Request-ID', req.requestId);

  next();
};

export default performanceMonitoring;
