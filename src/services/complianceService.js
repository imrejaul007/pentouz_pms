import ComplianceReport from '../models/ComplianceReport.js';
import InventoryItem from '../models/InventoryItem.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import mongoose from 'mongoose';

/**
 * Compliance Service
 * Provides regulatory compliance monitoring, reporting, and management
 */
class ComplianceService {
  /**
   * Generate comprehensive compliance report
   */
  static async generateComplianceReport(hotelId, reportType, options = {}) {
    try {
      const {
        includePreviousPeriod = true,
        includeRecommendations = true,
        autoScheduleFollowUp = true
      } = options;

      let report;

      switch (reportType) {
        case 'fda':
          report = await ComplianceReport.createFDAReport(hotelId);
          break;
        case 'health_department':
          report = await ComplianceReport.createHealthDepartmentReport(hotelId);
          break;
        case 'general':
          report = await this.createGeneralComplianceReport(hotelId);
          break;
        case 'fire_safety':
          report = await this.createFireSafetyReport(hotelId);
          break;
        case 'environmental':
          report = await this.createEnvironmentalReport(hotelId);
          break;
        case 'osha':
          report = await this.createOSHAReport(hotelId);
          break;
        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      if (includePreviousPeriod) {
        await this.addPreviousPeriodComparison(report);
      }

      if (includeRecommendations) {
        await this.enhanceWithRecommendations(report);
      }

      if (autoScheduleFollowUp) {
        await this.scheduleFollowUpActivities(report);
      }

      return report;
    } catch (error) {
      throw new Error(`Failed to generate compliance report: ${error.message}`);
    }
  }

  /**
   * Monitor compliance status in real-time
   */
  static async monitorComplianceStatus(hotelId, options = {}) {
    try {
      const {
        alertThreshold = 'medium',
        includePreventive = true,
        scope = 'all' // all, critical, operational
      } = options;

      const monitoring = {
        hotelId,
        timestamp: new Date(),
        status: 'monitoring',
        alerts: [],
        preventiveActions: [],
        summary: {}
      };

      // Check for expiring certifications
      const expiringCertifications = await this.checkExpiringCertifications(hotelId, 30);
      if (expiringCertifications.length > 0) {
        monitoring.alerts.push({
          type: 'certification_expiry',
          severity: 'high',
          count: expiringCertifications.length,
          items: expiringCertifications,
          action: 'Schedule certification renewals immediately'
        });
      }

      // Check for overdue corrective actions
      const overdueActions = await this.checkOverdueCorrectiveActions(hotelId);
      if (overdueActions.length > 0) {
        monitoring.alerts.push({
          type: 'overdue_actions',
          severity: 'critical',
          count: overdueActions.length,
          items: overdueActions,
          action: 'Complete overdue corrective actions immediately'
        });
      }

      // Check inventory compliance
      const inventoryCompliance = await this.checkInventoryCompliance(hotelId);
      if (inventoryCompliance.violations.length > 0) {
        monitoring.alerts.push({
          type: 'inventory_compliance',
          severity: 'medium',
          count: inventoryCompliance.violations.length,
          items: inventoryCompliance.violations,
          action: 'Address inventory compliance issues'
        });
      }

      // Check training compliance
      const trainingCompliance = await this.checkTrainingCompliance(hotelId);
      if (trainingCompliance.expired.length > 0) {
        monitoring.alerts.push({
          type: 'training_compliance',
          severity: 'high',
          count: trainingCompliance.expired.length,
          items: trainingCompliance.expired,
          action: 'Schedule mandatory training renewals'
        });
      }

      if (includePreventive) {
        monitoring.preventiveActions = await this.generatePreventiveActions(hotelId, monitoring.alerts);
      }

      monitoring.summary = this.generateMonitoringSummary(monitoring);

      return monitoring;
    } catch (error) {
      throw new Error(`Failed to monitor compliance status: ${error.message}`);
    }
  }

  /**
   * Perform compliance audit
   */
  static async performComplianceAudit(hotelId, auditType = 'comprehensive', options = {}) {
    try {
      const {
        includeEvidence = true,
        generateActionPlan = true,
        assessRisk = true
      } = options;

      const audit = {
        hotelId,
        auditType,
        auditDate: new Date(),
        auditor: options.auditor || 'System Generated',
        scope: [],
        findings: [],
        summary: {},
        actionPlan: [],
        riskAssessment: null
      };

      // Define audit scope based on type
      const auditScopes = await this.defineAuditScope(auditType);
      audit.scope = auditScopes;

      // Perform audit checks for each scope area
      for (const scope of auditScopes) {
        const scopeFindings = await this.auditComplianceArea(hotelId, scope, includeEvidence);
        audit.findings.push(...scopeFindings);
      }

      // Categorize findings by severity
      audit.summary = this.categorizeFindingsBySeverity(audit.findings);

      if (assessRisk) {
        audit.riskAssessment = await this.assessComplianceRisks(audit.findings);
      }

      if (generateActionPlan) {
        audit.actionPlan = await this.generateComplianceActionPlan(audit.findings);
      }

      // Save audit results
      const auditReport = await this.saveAuditResults(hotelId, audit);

      return auditReport;
    } catch (error) {
      throw new Error(`Failed to perform compliance audit: ${error.message}`);
    }
  }

  /**
   * Manage regulatory documents
   */
  static async manageRegulatoryDocuments(hotelId, action, documentData = {}) {
    try {
      const {
        documentType,
        fileName,
        expiryDate,
        certificationBody,
        scope
      } = documentData;

      switch (action) {
        case 'upload':
          return await this.uploadRegulatoryDocument(hotelId, documentData);
        case 'renew':
          return await this.renewCertification(hotelId, documentData);
        case 'verify':
          return await this.verifyDocumentValidity(hotelId, documentData);
        case 'archive':
          return await this.archiveDocument(hotelId, documentData);
        case 'list':
          return await this.listRegulatoryDocuments(hotelId, documentData);
        default:
          throw new Error(`Unsupported document action: ${action}`);
      }
    } catch (error) {
      throw new Error(`Failed to manage regulatory documents: ${error.message}`);
    }
  }

  /**
   * Track corrective actions
   */
  static async trackCorrectiveActions(hotelId, options = {}) {
    try {
      const {
        includeOverdue = true,
        includePending = true,
        includeCompleted = false,
        timeframe = 90 // days
      } = options;

      const startDate = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);

      const pipeline = [
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            reportDate: { $gte: startDate }
          }
        },
        { $unwind: '$complianceAreas' },
        { $unwind: '$complianceAreas.findings' },
        {
          $match: {
            'complianceAreas.findings.correctiveAction': { $exists: true }
          }
        }
      ];

      // Add status filters
      const statusFilters = [];
      if (includeOverdue) statusFilters.push('overdue');
      if (includePending) statusFilters.push('pending', 'in_progress');
      if (includeCompleted) statusFilters.push('completed');

      if (statusFilters.length > 0) {
        pipeline.push({
          $match: {
            'complianceAreas.findings.correctiveAction.status': { $in: statusFilters }
          }
        });
      }

      pipeline.push(
        {
          $project: {
            reportType: 1,
            reportDate: 1,
            area: '$complianceAreas.area',
            finding: '$complianceAreas.findings',
            action: '$complianceAreas.findings.correctiveAction'
          }
        },
        { $sort: { 'action.deadline': 1 } }
      );

      const actions = await ComplianceReport.aggregate(pipeline);

      // Process and categorize actions
      const categorized = this.categorizeCorrectiveActions(actions);

      return {
        hotelId,
        generatedAt: new Date(),
        timeframe,
        summary: {
          total: actions.length,
          overdue: categorized.overdue.length,
          pending: categorized.pending.length,
          inProgress: categorized.inProgress.length,
          completed: categorized.completed.length
        },
        actions: categorized
      };
    } catch (error) {
      throw new Error(`Failed to track corrective actions: ${error.message}`);
    }
  }

  /**
   * Generate compliance dashboard
   */
  static async getComplianceDashboard(hotelId, options = {}) {
    try {
      const {
        period = 90,
        includeForecasting = true,
        includeBenchmarking = false
      } = options;

      const dashboard = {
        hotelId,
        generatedAt: new Date(),
        period,
        summary: {},
        alerts: [],
        recentReports: [],
        upcomingDeadlines: [],
        trends: {},
        recommendations: []
      };

      // Get summary metrics
      dashboard.summary = await this.getComplianceSummaryMetrics(hotelId, period);

      // Get active alerts
      const monitoring = await this.monitorComplianceStatus(hotelId);
      dashboard.alerts = monitoring.alerts;

      // Get recent reports
      dashboard.recentReports = await this.getRecentComplianceReports(hotelId, 5);

      // Get upcoming deadlines
      dashboard.upcomingDeadlines = await this.getUpcomingComplianceDeadlines(hotelId, 60);

      // Get compliance trends
      dashboard.trends = await this.getComplianceTrends(hotelId, period);

      if (includeForecasting) {
        dashboard.forecasting = await this.generateComplianceForecasting(hotelId);
      }

      if (includeBenchmarking) {
        dashboard.benchmarking = await this.getComplianceBenchmarking(hotelId);
      }

      // Generate recommendations
      dashboard.recommendations = await this.generateComplianceRecommendations(dashboard);

      return dashboard;
    } catch (error) {
      throw new Error(`Failed to get compliance dashboard: ${error.message}`);
    }
  }

  // Helper methods for specific compliance reports

  static async createGeneralComplianceReport(hotelId) {
    const complianceAreas = [
      {
        area: 'documentation',
        description: 'Required documentation and record keeping',
        score: 88,
        status: 'compliant',
        findings: []
      },
      {
        area: 'staff_training',
        description: 'Staff training and certification compliance',
        score: 92,
        status: 'compliant',
        findings: []
      },
      {
        area: 'equipment_maintenance',
        description: 'Equipment maintenance and safety checks',
        score: 85,
        status: 'compliant',
        findings: []
      },
      {
        area: 'inventory_tracking',
        description: 'Inventory management and tracking compliance',
        score: 90,
        status: 'compliant',
        findings: []
      }
    ];

    return await ComplianceReport.create({
      hotelId,
      reportType: 'general',
      reportPeriod: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        frequency: 'monthly'
      },
      complianceAreas,
      followUp: {
        nextInspectionDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000)
      }
    });
  }

  static async createFireSafetyReport(hotelId) {
    const complianceAreas = [
      {
        area: 'fire_safety',
        description: 'Fire safety systems and equipment',
        score: 94,
        status: 'compliant',
        findings: [],
        requirements: [
          {
            code: 'NFPA-101',
            description: 'Life Safety Code compliance',
            mandatory: true,
            frequency: 'annually'
          }
        ]
      }
    ];

    return await ComplianceReport.create({
      hotelId,
      reportType: 'fire_safety',
      reportPeriod: {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        frequency: 'quarterly'
      },
      complianceAreas,
      followUp: {
        nextInspectionDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      }
    });
  }

  static async createEnvironmentalReport(hotelId) {
    const complianceAreas = [
      {
        area: 'waste_management',
        description: 'Waste disposal and recycling compliance',
        score: 87,
        status: 'compliant',
        findings: []
      },
      {
        area: 'water_quality',
        description: 'Water quality monitoring and treatment',
        score: 91,
        status: 'compliant',
        findings: []
      }
    ];

    return await ComplianceReport.create({
      hotelId,
      reportType: 'environmental',
      reportPeriod: {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        frequency: 'quarterly'
      },
      complianceAreas,
      followUp: {
        nextInspectionDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
      }
    });
  }

  static async createOSHAReport(hotelId) {
    const complianceAreas = [
      {
        area: 'staff_training',
        description: 'OSHA-required staff safety training',
        score: 89,
        status: 'compliant',
        findings: []
      },
      {
        area: 'equipment_maintenance',
        description: 'Equipment safety and maintenance',
        score: 93,
        status: 'compliant',
        findings: []
      }
    ];

    return await ComplianceReport.create({
      hotelId,
      reportType: 'osha',
      reportPeriod: {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        frequency: 'quarterly'
      },
      complianceAreas,
      followUp: {
        nextInspectionDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      }
    });
  }

  // Helper methods for compliance monitoring

  static async checkExpiringCertifications(hotelId, daysAhead = 30) {
    const cutoffDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

    const reports = await ComplianceReport.find({
      hotelId,
      'regulatoryFramework.certifications.expiryDate': { $lte: cutoffDate },
      'regulatoryFramework.certifications.status': 'active'
    }).select('regulatoryFramework.certifications reportType');

    const expiring = [];
    reports.forEach(report => {
      report.regulatoryFramework.certifications.forEach(cert => {
        if (cert.expiryDate <= cutoffDate && cert.status === 'active') {
          expiring.push({
            reportType: report.reportType,
            certification: cert.name,
            expiryDate: cert.expiryDate,
            daysUntilExpiry: Math.ceil((cert.expiryDate - new Date()) / (1000 * 60 * 60 * 24))
          });
        }
      });
    });

    return expiring;
  }

  static async checkOverdueCorrectiveActions(hotelId) {
    const now = new Date();

    const reports = await ComplianceReport.find({
      hotelId,
      'complianceAreas.findings.correctiveAction.deadline': { $lt: now },
      'complianceAreas.findings.correctiveAction.status': { $in: ['pending', 'in_progress'] }
    }).populate('complianceAreas.findings.correctiveAction.assignedTo', 'name email');

    const overdue = [];
    reports.forEach(report => {
      report.complianceAreas.forEach(area => {
        area.findings.forEach(finding => {
          if (finding.correctiveAction &&
              finding.correctiveAction.deadline < now &&
              ['pending', 'in_progress'].includes(finding.correctiveAction.status)) {
            overdue.push({
              reportType: report.reportType,
              area: area.area,
              description: finding.correctiveAction.description,
              deadline: finding.correctiveAction.deadline,
              assignedTo: finding.correctiveAction.assignedTo,
              daysOverdue: Math.ceil((now - finding.correctiveAction.deadline) / (1000 * 60 * 60 * 24))
            });
          }
        });
      });
    });

    return overdue;
  }

  static async checkInventoryCompliance(hotelId) {
    const items = await InventoryItem.find({ hotelId, isActive: true });
    const violations = [];

    // Check for items without proper documentation
    items.forEach(item => {
      if (!item.supplier?.name) {
        violations.push({
          type: 'missing_supplier_info',
          itemId: item._id,
          itemName: item.name,
          issue: 'Missing supplier information'
        });
      }

      if (item.category === 'minibar' && !item.specifications) {
        violations.push({
          type: 'missing_specifications',
          itemId: item._id,
          itemName: item.name,
          issue: 'Food items missing required specifications'
        });
      }
    });

    return {
      totalItems: items.length,
      compliantItems: items.length - violations.length,
      violations,
      complianceRate: ((items.length - violations.length) / items.length) * 100
    };
  }

  static async checkTrainingCompliance(hotelId) {
    // This would typically integrate with an HR/training system
    // For demonstration, we'll simulate training compliance data
    const requiredTraining = [
      'Food Safety Certification',
      'Fire Safety Training',
      'Chemical Handling Training',
      'Emergency Procedures Training'
    ];

    const expired = [];
    const upcoming = [];

    // Simulate some expired training
    if (Math.random() > 0.7) {
      expired.push({
        training: 'Food Safety Certification',
        staffMember: 'John Smith',
        expiryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        daysExpired: 10
      });
    }

    return {
      requiredTraining,
      expired,
      upcoming,
      complianceRate: ((requiredTraining.length - expired.length) / requiredTraining.length) * 100
    };
  }

  static async generatePreventiveActions(hotelId, alerts) {
    const preventiveActions = [];

    alerts.forEach(alert => {
      switch (alert.type) {
        case 'certification_expiry':
          preventiveActions.push({
            type: 'preventive',
            action: 'Schedule certification renewal meetings',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            priority: 'high'
          });
          break;
        case 'training_compliance':
          preventiveActions.push({
            type: 'preventive',
            action: 'Schedule mandatory training sessions',
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            priority: 'medium'
          });
          break;
      }
    });

    return preventiveActions;
  }

  static generateMonitoringSummary(monitoring) {
    const criticalAlerts = monitoring.alerts.filter(a => a.severity === 'critical').length;
    const highAlerts = monitoring.alerts.filter(a => a.severity === 'high').length;
    const totalAlerts = monitoring.alerts.length;

    let overallStatus = 'good';
    if (criticalAlerts > 0) overallStatus = 'critical';
    else if (highAlerts > 2) overallStatus = 'attention_needed';
    else if (totalAlerts > 5) overallStatus = 'monitoring_required';

    return {
      overallStatus,
      totalAlerts,
      criticalAlerts,
      highAlerts,
      preventiveActionsCount: monitoring.preventiveActions.length
    };
  }

  // Additional helper methods for audit functionality

  static async defineAuditScope(auditType) {
    const scopes = {
      comprehensive: [
        'food_safety', 'fire_safety', 'chemical_storage', 'documentation',
        'staff_training', 'equipment_maintenance', 'waste_management'
      ],
      food_safety: ['food_safety', 'temperature_control', 'allergen_control'],
      safety: ['fire_safety', 'electrical_safety', 'chemical_storage'],
      operational: ['documentation', 'staff_training', 'equipment_maintenance'],
      environmental: ['waste_management', 'water_quality', 'chemical_storage']
    };

    return scopes[auditType] || scopes.comprehensive;
  }

  static async auditComplianceArea(hotelId, area, includeEvidence) {
    // This would perform actual compliance checks
    // For demonstration, we'll return simulated audit findings
    const findings = [];

    // Simulate some random findings
    if (Math.random() > 0.8) {
      findings.push({
        area,
        type: 'observation',
        severity: 'minor',
        description: `Minor observation in ${area} area`,
        location: 'Main kitchen',
        correctiveAction: {
          required: true,
          description: `Address ${area} observation`,
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: 'pending'
        }
      });
    }

    return findings;
  }

  static categorizeFindingsBySeverity(findings) {
    return {
      critical: findings.filter(f => f.severity === 'critical').length,
      major: findings.filter(f => f.severity === 'major').length,
      minor: findings.filter(f => f.severity === 'minor').length,
      total: findings.length
    };
  }

  static async assessComplianceRisks(findings) {
    const criticalFindings = findings.filter(f => f.severity === 'critical').length;
    const majorFindings = findings.filter(f => f.severity === 'major').length;

    let riskLevel = 'low';
    if (criticalFindings > 0) riskLevel = 'high';
    else if (majorFindings > 2) riskLevel = 'medium';

    return {
      overallRiskLevel: riskLevel,
      criticalRisks: criticalFindings,
      majorRisks: majorFindings,
      riskFactors: findings.map(f => f.description)
    };
  }

  static categorizeCorrectiveActions(actions) {
    const now = new Date();

    return {
      overdue: actions.filter(a => a.action.deadline < now && a.action.status !== 'completed'),
      pending: actions.filter(a => a.action.status === 'pending'),
      inProgress: actions.filter(a => a.action.status === 'in_progress'),
      completed: actions.filter(a => a.action.status === 'completed')
    };
  }

  // Additional methods for dashboard functionality

  static async getComplianceSummaryMetrics(hotelId, period) {
    const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

    const recentReports = await ComplianceReport.find({
      hotelId,
      reportDate: { $gte: startDate }
    });

    const totalReports = recentReports.length;
    const averageScore = totalReports > 0 ?
      recentReports.reduce((sum, r) => sum + (r.overallScore || 0), 0) / totalReports : 0;

    const compliantReports = recentReports.filter(r => r.status === 'compliant').length;
    const nonCompliantReports = recentReports.filter(r => r.status === 'non_compliant').length;

    return {
      totalReports,
      averageScore: parseFloat(averageScore.toFixed(1)),
      compliantReports,
      nonCompliantReports,
      complianceRate: totalReports > 0 ? parseFloat(((compliantReports / totalReports) * 100).toFixed(1)) : 0
    };
  }

  static async getRecentComplianceReports(hotelId, limit = 5) {
    return await ComplianceReport.find({ hotelId })
      .sort({ reportDate: -1 })
      .limit(limit)
      .select('reportType reportDate status overallScore')
      .lean();
  }

  static async getUpcomingComplianceDeadlines(hotelId, daysAhead = 60) {
    const cutoffDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

    const reports = await ComplianceReport.find({
      hotelId,
      $or: [
        { 'followUp.nextInspectionDate': { $lte: cutoffDate } },
        { 'regulatoryFramework.certifications.expiryDate': { $lte: cutoffDate } }
      ]
    }).select('reportType followUp.nextInspectionDate regulatoryFramework.certifications');

    const deadlines = [];

    reports.forEach(report => {
      if (report.followUp?.nextInspectionDate && report.followUp.nextInspectionDate <= cutoffDate) {
        deadlines.push({
          type: 'inspection',
          reportType: report.reportType,
          date: report.followUp.nextInspectionDate,
          description: `${report.reportType} inspection due`
        });
      }

      report.regulatoryFramework?.certifications?.forEach(cert => {
        if (cert.expiryDate && cert.expiryDate <= cutoffDate) {
          deadlines.push({
            type: 'certification',
            reportType: report.reportType,
            date: cert.expiryDate,
            description: `${cert.name} certification expires`
          });
        }
      });
    });

    return deadlines.sort((a, b) => a.date - b.date);
  }

  // Placeholder methods for additional functionality
  static async addPreviousPeriodComparison(report) {
    // Add comparison with previous period
  }

  static async enhanceWithRecommendations(report) {
    // Add AI-generated recommendations
  }

  static async scheduleFollowUpActivities(report) {
    // Schedule automatic follow-up activities
  }

  static async generateComplianceActionPlan(findings) {
    // Generate detailed action plan from findings
    return [];
  }

  static async saveAuditResults(hotelId, audit) {
    // Save audit results to database
    return audit;
  }

  static async uploadRegulatoryDocument(hotelId, documentData) {
    // Handle document upload
    return { success: true };
  }

  static async renewCertification(hotelId, documentData) {
    // Handle certification renewal
    return { success: true };
  }

  static async verifyDocumentValidity(hotelId, documentData) {
    // Verify document validity
    return { valid: true };
  }

  static async archiveDocument(hotelId, documentData) {
    // Archive old document
    return { success: true };
  }

  static async listRegulatoryDocuments(hotelId, filters) {
    // List regulatory documents
    return [];
  }

  static async getComplianceTrends(hotelId, period) {
    // Get compliance trends over time
    return {
      trend: 'improving',
      changePercent: 5.2
    };
  }

  static async generateComplianceForecasting(hotelId) {
    // Generate compliance forecasting
    return {
      nextPeriodScore: 92,
      riskAreas: ['training_compliance']
    };
  }

  static async getComplianceBenchmarking(hotelId) {
    // Get industry benchmarking data
    return {
      industryAverage: 87,
      percentile: 75
    };
  }

  static async generateComplianceRecommendations(dashboard) {
    const recommendations = [];

    if (dashboard.alerts.length > 0) {
      const criticalAlerts = dashboard.alerts.filter(a => a.severity === 'critical');
      if (criticalAlerts.length > 0) {
        recommendations.push({
          type: 'critical_alerts',
          priority: 'critical',
          description: `${criticalAlerts.length} critical compliance alerts require immediate attention`,
          action: 'Address critical compliance issues immediately'
        });
      }
    }

    if (dashboard.summary.complianceRate < 85) {
      recommendations.push({
        type: 'compliance_improvement',
        priority: 'high',
        description: 'Overall compliance rate below target',
        action: 'Implement compliance improvement program'
      });
    }

    return recommendations;
  }
}

export default ComplianceService;