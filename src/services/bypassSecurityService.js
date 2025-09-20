import rateLimit from 'express-rate-limit';
import AdminBypassAudit from '../models/AdminBypassAudit.js';
import AuditLog from '../models/AuditLog.js';
import crypto from 'crypto';

class BypassSecurityService {
  constructor() {
    this.suspiciousPatterns = new Map();
    this.sessionTimeouts = new Map();
    this.encryptionKey = process.env.BYPASS_ENCRYPTION_KEY || 'default-bypass-encryption-key';
  }

  /**
   * Create rate limiter for bypass operations
   * Max 5 bypasses per hour per admin
   */
  createBypassRateLimiter() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // Limit each admin to 5 bypass operations per windowMs
      keyGenerator: (req) => {
        return `bypass_${req.user._id}_${req.user.hotelId}`;
      },
      message: {
        error: 'Too many bypass operations',
        message: 'Maximum 5 bypass operations allowed per hour. Please contact your supervisor for emergency access.',
        retryAfter: '1 hour',
        code: 'BYPASS_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: async (req, res) => {
        // Log rate limit violation
        await this.logSecurityEvent({
          hotelId: req.user.hotelId,
          adminId: req.user._id,
          eventType: 'rate_limit_exceeded',
          severity: 'warning',
          details: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            windowMs: 60 * 60 * 1000,
            limit: 5
          }
        });

        res.status(429).json({
          error: 'Too many bypass operations',
          message: 'Maximum 5 bypass operations allowed per hour. Please contact your supervisor for emergency access.',
          retryAfter: 3600,
          code: 'BYPASS_RATE_LIMIT_EXCEEDED'
        });
      }
    });
  }

  /**
   * Advanced security validation middleware
   */
  validateBypassSecurity() {
    return async (req, res, next) => {
      try {
        const { bookingId, reason, financialImpact } = req.body;
        const adminId = req.user._id;
        const hotelId = req.user.hotelId;

        // Create security metadata
        const securityMetadata = this.createSecurityMetadata(req);

        // Perform security checks
        const securityChecks = await this.performSecurityChecks({
          adminId,
          hotelId,
          bookingId,
          reason,
          financialImpact,
          securityMetadata
        });

        // Add security results to request
        req.bypassSecurity = {
          metadata: securityMetadata,
          checks: securityChecks,
          riskScore: securityChecks.riskScore,
          requiresApproval: securityChecks.requiresApproval,
          securityFlags: securityChecks.flags
        };

        // Block if risk score is too high
        if (securityChecks.riskScore >= 90) {
          await this.logSecurityEvent({
            hotelId,
            adminId,
            eventType: 'high_risk_bypass_blocked',
            severity: 'critical',
            details: {
              riskScore: securityChecks.riskScore,
              flags: securityChecks.flags,
              ...securityMetadata
            }
          });

          return res.status(403).json({
            error: 'Bypass operation blocked',
            message: 'This bypass operation has been flagged as high risk and requires supervisor approval.',
            riskScore: securityChecks.riskScore,
            code: 'HIGH_RISK_BYPASS_BLOCKED'
          });
        }

        next();
      } catch (error) {
        console.error('Bypass security validation error:', error);
        next(error);
      }
    };
  }

  /**
   * Create comprehensive security metadata
   */
  createSecurityMetadata(req) {
    const now = new Date();

    return {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || 'Unknown',
      deviceFingerprint: this.generateDeviceFingerprint(req),
      sessionId: req.sessionID || req.user.sessionId,
      timestamp: now,
      loginTimestamp: req.user.lastLogin || now,
      lastActivity: now,
      requestHeaders: {
        accept: req.get('Accept'),
        acceptLanguage: req.get('Accept-Language'),
        acceptEncoding: req.get('Accept-Encoding'),
        origin: req.get('Origin'),
        referer: req.get('Referer')
      },
      geolocation: this.extractGeolocation(req),
      networkInfo: {
        forwardedFor: req.get('X-Forwarded-For'),
        realIp: req.get('X-Real-IP'),
        cloudflareIp: req.get('CF-Connecting-IP')
      }
    };
  }

  /**
   * Generate device fingerprint for tracking
   */
  generateDeviceFingerprint(req) {
    const components = [
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || '',
      req.ip || '',
      req.get('DNT') || '',
      (req.connection.localPort || '').toString()
    ];

    const fingerprint = crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex')
      .substring(0, 16);

    return fingerprint;
  }

  /**
   * Extract geolocation from request headers (if available)
   */
  extractGeolocation(req) {
    // CloudFlare headers
    const cfCountry = req.get('CF-IPCountry');
    const cfCity = req.get('CF-IPCity');

    // Generic geolocation headers
    const geoCountry = req.get('X-Country-Code');
    const geoCity = req.get('X-City');
    const geoLat = req.get('X-Latitude');
    const geoLon = req.get('X-Longitude');

    return {
      country: cfCountry || geoCountry || null,
      city: cfCity || geoCity || null,
      latitude: geoLat ? parseFloat(geoLat) : null,
      longitude: geoLon ? parseFloat(geoLon) : null,
      accuracy: null,
      source: cfCountry ? 'cloudflare' : (geoCountry ? 'proxy' : 'unknown')
    };
  }

  /**
   * Perform comprehensive security checks
   */
  async performSecurityChecks({ adminId, hotelId, bookingId, reason, financialImpact, securityMetadata }) {
    const checks = {
      riskScore: 0,
      flags: [],
      requiresApproval: false,
      analysis: {}
    };

    // Check 1: Time-based analysis
    const timeAnalysis = await this.analyzeTimingPatterns(adminId, hotelId);
    checks.analysis.timing = timeAnalysis;
    checks.riskScore += timeAnalysis.riskScore;
    checks.flags.push(...timeAnalysis.flags);

    // Check 2: Frequency analysis
    const frequencyAnalysis = await this.analyzeBypassFrequency(adminId, hotelId);
    checks.analysis.frequency = frequencyAnalysis;
    checks.riskScore += frequencyAnalysis.riskScore;
    checks.flags.push(...frequencyAnalysis.flags);

    // Check 3: Financial impact analysis
    const financialAnalysis = this.analyzeFinancialImpact(financialImpact, reason);
    checks.analysis.financial = financialAnalysis;
    checks.riskScore += financialAnalysis.riskScore;
    checks.flags.push(...financialAnalysis.flags);

    // Check 4: Behavioral analysis
    const behaviorAnalysis = await this.analyzeBehaviorPatterns(adminId, securityMetadata);
    checks.analysis.behavior = behaviorAnalysis;
    checks.riskScore += behaviorAnalysis.riskScore;
    checks.flags.push(...behaviorAnalysis.flags);

    // Check 5: Contextual analysis
    const contextAnalysis = await this.analyzeContextualFactors(hotelId, reason);
    checks.analysis.context = contextAnalysis;
    checks.riskScore += contextAnalysis.riskScore;
    checks.flags.push(...contextAnalysis.flags);

    // Check 6: Historical pattern analysis
    const historicalAnalysis = await this.analyzeHistoricalPatterns(adminId, hotelId, reason);
    checks.analysis.historical = historicalAnalysis;
    checks.riskScore += historicalAnalysis.riskScore;
    checks.flags.push(...historicalAnalysis.flags);

    // Determine if approval is required
    checks.requiresApproval = this.determineApprovalRequirement(checks);

    // Cap risk score at 100
    checks.riskScore = Math.min(checks.riskScore, 100);

    return checks;
  }

  /**
   * Analyze timing patterns for suspicious activity
   */
  async analyzeTimingPatterns(adminId, hotelId) {
    const analysis = { riskScore: 0, flags: [], details: {} };
    const now = new Date();
    const hour = now.getHours();
    const isWeekend = [0, 6].includes(now.getDay());

    // Check business hours
    const isBusinessHours = hour >= 8 && hour <= 18 && !isWeekend;
    if (!isBusinessHours) {
      analysis.riskScore += 15;
      analysis.flags.push({
        type: 'suspicious_timing',
        severity: 'warning',
        message: 'Bypass operation outside business hours',
        details: { hour, isWeekend }
      });
    }

    // Check for night operations (high risk)
    if (hour >= 23 || hour <= 5) {
      analysis.riskScore += 25;
      analysis.flags.push({
        type: 'suspicious_timing',
        severity: 'critical',
        message: 'Bypass operation during night hours',
        details: { hour }
      });
    }

    // Check recent bypass frequency
    const recentBypasses = await AdminBypassAudit.countDocuments({
      adminId,
      hotelId,
      createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) } // Last hour
    });

    if (recentBypasses >= 3) {
      analysis.riskScore += 30;
      analysis.flags.push({
        type: 'rapid_succession',
        severity: 'critical',
        message: 'Multiple bypass operations in short succession',
        details: { count: recentBypasses, timeframe: '1 hour' }
      });
    }

    analysis.details = {
      currentHour: hour,
      isBusinessHours,
      isWeekend,
      recentBypassCount: recentBypasses
    };

    return analysis;
  }

  /**
   * Analyze bypass frequency patterns
   */
  async analyzeBypassFrequency(adminId, hotelId) {
    const analysis = { riskScore: 0, flags: [], details: {} };
    const now = new Date();

    // Get bypass counts for different time periods
    const counts = await Promise.all([
      // Today
      AdminBypassAudit.countDocuments({
        adminId,
        hotelId,
        createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
      }),
      // This week
      AdminBypassAudit.countDocuments({
        adminId,
        hotelId,
        createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
      }),
      // This month
      AdminBypassAudit.countDocuments({
        adminId,
        hotelId,
        createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) }
      })
    ]);

    const [todayCount, weekCount, monthCount] = counts;

    // Analyze daily frequency
    if (todayCount >= 3) {
      analysis.riskScore += 20;
      analysis.flags.push({
        type: 'high_frequency',
        severity: 'warning',
        message: 'High bypass frequency today',
        details: { count: todayCount, period: 'day' }
      });
    }

    // Analyze weekly frequency
    if (weekCount >= 10) {
      analysis.riskScore += 25;
      analysis.flags.push({
        type: 'high_frequency',
        severity: 'critical',
        message: 'Excessive bypass frequency this week',
        details: { count: weekCount, period: 'week' }
      });
    }

    // Analyze monthly frequency
    if (monthCount >= 30) {
      analysis.riskScore += 30;
      analysis.flags.push({
        type: 'pattern_anomaly',
        severity: 'critical',
        message: 'Abnormal monthly bypass pattern',
        details: { count: monthCount, period: 'month' }
      });
    }

    analysis.details = {
      todayCount,
      weekCount,
      monthCount,
      thresholds: { daily: 3, weekly: 10, monthly: 30 }
    };

    return analysis;
  }

  /**
   * Analyze financial impact for risk assessment
   */
  analyzeFinancialImpact(financialImpact, reason) {
    const analysis = { riskScore: 0, flags: [], details: {} };
    const estimatedLoss = financialImpact?.estimatedLoss || 0;

    // High value thresholds
    if (estimatedLoss > 10000) {
      analysis.riskScore += 40;
      analysis.flags.push({
        type: 'high_value',
        severity: 'critical',
        message: 'High financial impact bypass',
        details: { amount: estimatedLoss, currency: financialImpact?.currency }
      });
    } else if (estimatedLoss > 5000) {
      analysis.riskScore += 25;
      analysis.flags.push({
        type: 'high_value',
        severity: 'warning',
        message: 'Significant financial impact',
        details: { amount: estimatedLoss, currency: financialImpact?.currency }
      });
    } else if (estimatedLoss > 1000) {
      analysis.riskScore += 15;
    }

    // Reason category risk assessment
    const categoryRisks = {
      'emergency_medical': 5,
      'system_failure': 10,
      'inventory_unavailable': 15,
      'guest_complaint': 20,
      'staff_shortage': 25,
      'technical_issue': 15,
      'management_override': 35,
      'compliance_requirement': 5,
      'other': 40
    };

    const categoryRisk = categoryRisks[reason?.category] || 40;
    analysis.riskScore += categoryRisk;

    if (reason?.category === 'other' || reason?.category === 'management_override') {
      analysis.flags.push({
        type: 'suspicious_reason',
        severity: 'warning',
        message: 'High-risk reason category requires additional scrutiny',
        details: { category: reason.category }
      });
    }

    analysis.details = {
      estimatedLoss,
      currency: financialImpact?.currency || 'USD',
      category: reason?.category,
      categoryRiskScore: categoryRisk
    };

    return analysis;
  }

  /**
   * Analyze behavioral patterns
   */
  async analyzeBehaviorPatterns(adminId, securityMetadata) {
    const analysis = { riskScore: 0, flags: [], details: {} };

    // Location analysis
    if (securityMetadata.geolocation) {
      // Check if location is unusual (simplified - in production would use historical data)
      const { country, city } = securityMetadata.geolocation;

      // Get recent locations for this admin
      const recentAudits = await AdminBypassAudit.find({
        adminId,
        'securityMetadata.geolocation.country': { $exists: true },
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }).limit(10);

      const recentCountries = recentAudits.map(a => a.securityMetadata.geolocation.country).filter(Boolean);
      const isUnusualLocation = country && !recentCountries.includes(country);

      if (isUnusualLocation) {
        analysis.riskScore += 20;
        analysis.flags.push({
          type: 'unusual_location',
          severity: 'warning',
          message: 'Bypass from unusual geographic location',
          details: { country, city, recentCountries }
        });
      }
    }

    // Device fingerprint analysis
    const deviceFingerprint = securityMetadata.deviceFingerprint;
    if (deviceFingerprint) {
      const recentDevices = await AdminBypassAudit.distinct('securityMetadata.deviceFingerprint', {
        adminId,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });

      const isNewDevice = !recentDevices.includes(deviceFingerprint);
      if (isNewDevice) {
        analysis.riskScore += 15;
        analysis.flags.push({
          type: 'new_device',
          severity: 'info',
          message: 'Bypass from new or unrecognized device',
          details: { deviceFingerprint }
        });
      }
    }

    analysis.details = {
      geolocation: securityMetadata.geolocation,
      deviceFingerprint: securityMetadata.deviceFingerprint,
      ipAddress: securityMetadata.ipAddress
    };

    return analysis;
  }

  /**
   * Analyze contextual factors
   */
  async analyzeContextualFactors(hotelId, reason) {
    const analysis = { riskScore: 0, flags: [], details: {} };

    // Check hotel-wide bypass frequency
    const hotelBypassCount = await AdminBypassAudit.countDocuments({
      hotelId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    if (hotelBypassCount >= 10) {
      analysis.riskScore += 20;
      analysis.flags.push({
        type: 'hotel_wide_pattern',
        severity: 'warning',
        message: 'High bypass frequency across hotel',
        details: { count: hotelBypassCount, period: '24 hours' }
      });
    }

    // Urgency level assessment
    if (reason?.urgencyLevel === 'critical') {
      analysis.riskScore += 10; // Higher urgency = slightly higher risk for verification
    } else if (reason?.urgencyLevel === 'low') {
      analysis.riskScore += 20; // Low urgency bypasses are more suspicious
      analysis.flags.push({
        type: 'low_urgency_bypass',
        severity: 'info',
        message: 'Low urgency bypass requires justification',
        details: { urgency: reason.urgencyLevel }
      });
    }

    analysis.details = {
      hotelBypassCount,
      urgencyLevel: reason?.urgencyLevel
    };

    return analysis;
  }

  /**
   * Analyze historical patterns
   */
  async analyzeHistoricalPatterns(adminId, hotelId, reason) {
    const analysis = { riskScore: 0, flags: [], details: {} };

    // Get admin's historical pattern
    const historicalData = await AdminBypassAudit.aggregate([
      {
        $match: {
          adminId: new mongoose.Types.ObjectId(adminId),
          hotelId: new mongoose.Types.ObjectId(hotelId),
          createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$reason.category',
          count: { $sum: 1 },
          avgRiskScore: { $avg: '$securityMetadata.riskScore' },
          avgFinancialImpact: { $avg: '$financialImpact.estimatedLoss' }
        }
      }
    ]);

    // Check if this reason category is unusual for this admin
    const currentCategory = reason?.category;
    const categoryHistory = historicalData.find(h => h._id === currentCategory);
    const totalHistoricalBypasses = historicalData.reduce((sum, h) => sum + h.count, 0);

    if (!categoryHistory && totalHistoricalBypasses > 5) {
      analysis.riskScore += 15;
      analysis.flags.push({
        type: 'unusual_category',
        severity: 'info',
        message: 'Bypass reason category not used before by this admin',
        details: { category: currentCategory, historicalCount: 0 }
      });
    }

    // Check for escalating pattern
    const recentHighRisk = await AdminBypassAudit.countDocuments({
      adminId,
      hotelId,
      'securityMetadata.riskScore': { $gte: 60 },
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    if (recentHighRisk >= 3) {
      analysis.riskScore += 25;
      analysis.flags.push({
        type: 'escalating_risk',
        severity: 'critical',
        message: 'Pattern of high-risk bypass operations',
        details: { recentHighRiskCount: recentHighRisk, period: '7 days' }
      });
    }

    analysis.details = {
      historicalCategories: historicalData,
      totalHistoricalBypasses,
      recentHighRiskCount: recentHighRisk
    };

    return analysis;
  }

  /**
   * Determine if approval is required based on risk assessment
   */
  determineApprovalRequirement(checks) {
    // High risk score requires approval
    if (checks.riskScore >= 60) return true;

    // Critical flags require approval
    const criticalFlags = checks.flags.filter(f => f.severity === 'critical');
    if (criticalFlags.length > 0) return true;

    // High financial impact requires approval
    const highValueFlag = checks.flags.find(f => f.type === 'high_value');
    if (highValueFlag) return true;

    // Multiple warning flags require approval
    const warningFlags = checks.flags.filter(f => f.severity === 'warning');
    if (warningFlags.length >= 3) return true;

    return false;
  }

  /**
   * Log security events
   */
  async logSecurityEvent({ hotelId, adminId, eventType, severity, details }) {
    try {
      await AuditLog.create({
        hotelId,
        tableName: 'AdminBypassAudit',
        recordId: adminId,
        changeType: 'security_event',
        userId: adminId,
        source: 'bypass_security_service',
        metadata: {
          eventType,
          severity,
          details,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Session timeout management
   */
  setSessionTimeout(sessionId, timeoutMs = 5 * 60 * 1000) { // 5 minutes default
    const timeout = setTimeout(() => {
      this.sessionTimeouts.delete(sessionId);
    }, timeoutMs);

    this.sessionTimeouts.set(sessionId, timeout);
  }

  clearSessionTimeout(sessionId) {
    const timeout = this.sessionTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(sessionId);
    }
  }

  checkSessionTimeout(sessionId) {
    return this.sessionTimeouts.has(sessionId);
  }

  /**
   * Password re-confirmation for high-risk operations
   */
  requirePasswordConfirmation() {
    return async (req, res, next) => {
      const { confirmPassword } = req.body;
      const riskScore = req.bypassSecurity?.riskScore || 0;

      // Require password confirmation for high-risk operations
      if (riskScore >= 70) {
        if (!confirmPassword) {
          return res.status(400).json({
            error: 'Password confirmation required',
            message: 'This high-risk operation requires password confirmation.',
            code: 'PASSWORD_CONFIRMATION_REQUIRED'
          });
        }

        // Verify password (implement based on your auth system)
        const isValidPassword = await this.verifyAdminPassword(req.user._id, confirmPassword);
        if (!isValidPassword) {
          await this.logSecurityEvent({
            hotelId: req.user.hotelId,
            adminId: req.user._id,
            eventType: 'password_confirmation_failed',
            severity: 'warning',
            details: {
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              riskScore
            }
          });

          return res.status(401).json({
            error: 'Invalid password',
            message: 'Password confirmation failed.',
            code: 'INVALID_PASSWORD_CONFIRMATION'
          });
        }
      }

      next();
    };
  }

  /**
   * Verify admin password (implement based on your auth system)
   */
  async verifyAdminPassword(adminId, password) {
    // This should integrate with your existing auth system
    // For now, returning true as placeholder
    // In production, this should verify the password against the user model
    return true;
  }
}

export default new BypassSecurityService();