import webOptimizationService from '../services/webOptimizationService.js';
import WebConfiguration from '../models/WebConfiguration.js';
import { validationResult, body, param, query } from 'express-validator';

class WebOptimizationController {
  
  // A/B Testing Endpoints
  async createABTest(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }
      
      const { hotelId } = req.params;
      const testData = req.body;
      const createdBy = req.user.id;
      
      const abTest = await webOptimizationService.createABTest(hotelId, testData, createdBy);
      
      res.status(201).json({
        success: true,
        message: 'A/B test created successfully',
        data: abTest
      });
      
    } catch (error) {
      console.error('Error creating A/B test:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create A/B test'
      });
    }
  }
  
  async getABTests(req, res) {
    try {
      const { hotelId } = req.params;
      const { status, testType, page = 1, limit = 10 } = req.query;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      let tests = config.abTesting.tests;
      
      // Apply filters
      if (status) {
        tests = tests.filter(test => test.status === status);
      }
      if (testType) {
        tests = tests.filter(test => test.testType === testType);
      }
      
      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedTests = tests.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: {
          tests: paginatedTests,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(tests.length / limit),
            total: tests.length,
            limit: parseInt(limit)
          }
        }
      });
      
    } catch (error) {
      console.error('Error fetching A/B tests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch A/B tests'
      });
    }
  }
  
  async getABTest(req, res) {
    try {
      const { hotelId, testId } = req.params;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      const test = config.abTesting.tests.find(t => t.testId === testId);
      if (!test) {
        return res.status(404).json({
          success: false,
          message: 'A/B test not found'
        });
      }
      
      res.json({
        success: true,
        data: test
      });
      
    } catch (error) {
      console.error('Error fetching A/B test:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch A/B test'
      });
    }
  }
  
  async updateABTest(req, res) {
    try {
      const { hotelId, testId } = req.params;
      const updates = req.body;
      const userId = req.user.id;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      const testIndex = config.abTesting.tests.findIndex(t => t.testId === testId);
      if (testIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'A/B test not found'
        });
      }
      
      // Update test fields
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          config.abTesting.tests[testIndex][key] = updates[key];
        }
      });
      
      config.auditInfo.updatedBy = userId;
      config.auditInfo.changeLog.push({
        action: 'UPDATE_AB_TEST',
        changedBy: userId,
        changes: { testId, updates }
      });
      
      await config.save();
      
      res.json({
        success: true,
        message: 'A/B test updated successfully',
        data: config.abTesting.tests[testIndex]
      });
      
    } catch (error) {
      console.error('Error updating A/B test:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update A/B test'
      });
    }
  }
  
  async deleteABTest(req, res) {
    try {
      const { hotelId, testId } = req.params;
      const userId = req.user.id;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      const testIndex = config.abTesting.tests.findIndex(t => t.testId === testId);
      if (testIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'A/B test not found'
        });
      }
      
      const deletedTest = config.abTesting.tests[testIndex];
      config.abTesting.tests.splice(testIndex, 1);
      
      config.auditInfo.updatedBy = userId;
      config.auditInfo.changeLog.push({
        action: 'DELETE_AB_TEST',
        changedBy: userId,
        changes: { testId, testName: deletedTest.testName }
      });
      
      await config.save();
      
      res.json({
        success: true,
        message: 'A/B test deleted successfully'
      });
      
    } catch (error) {
      console.error('Error deleting A/B test:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete A/B test'
      });
    }
  }
  
  async startABTest(req, res) {
    try {
      const { hotelId, testId } = req.params;
      const userId = req.user.id;
      
      const test = await webOptimizationService.startABTest(hotelId, testId, userId);
      
      res.json({
        success: true,
        message: 'A/B test started successfully',
        data: test
      });
      
    } catch (error) {
      console.error('Error starting A/B test:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to start A/B test'
      });
    }
  }
  
  async stopABTest(req, res) {
    try {
      const { hotelId, testId } = req.params;
      const userId = req.user.id;
      
      const test = await webOptimizationService.stopABTest(hotelId, testId, userId);
      
      res.json({
        success: true,
        message: 'A/B test stopped successfully',
        data: test
      });
      
    } catch (error) {
      console.error('Error stopping A/B test:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to stop A/B test'
      });
    }
  }
  
  async getABTestResults(req, res) {
    try {
      const { hotelId, testId } = req.params;
      
      const report = await webOptimizationService.getABTestReport(hotelId, testId);
      
      res.json({
        success: true,
        data: report
      });
      
    } catch (error) {
      console.error('Error generating A/B test results:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate A/B test results'
      });
    }
  }
  
  async recordABTestConversion(req, res) {
    try {
      const { hotelId, testId } = req.params;
      const { variantId, sessionId, conversionValue = 1 } = req.body;
      
      const success = await webOptimizationService.recordTestInteraction(
        hotelId, testId, variantId, sessionId, 'conversion', conversionValue
      );
      
      res.json({
        success,
        message: success ? 'Conversion recorded successfully' : 'Failed to record conversion'
      });
      
    } catch (error) {
      console.error('Error recording A/B test conversion:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record conversion'
      });
    }
  }
  
  async recordTestInteraction(req, res) {
    try {
      const { hotelId, testId, variantId } = req.params;
      const { sessionId, interactionType, value } = req.body;
      
      const success = await webOptimizationService.recordTestInteraction(
        hotelId, testId, variantId, sessionId, interactionType, value
      );
      
      res.json({
        success,
        message: success ? 'Interaction recorded successfully' : 'Failed to record interaction'
      });
      
    } catch (error) {
      console.error('Error recording test interaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record test interaction'
      });
    }
  }
  
  // Performance Monitoring Endpoints
  async recordPerformanceMetric(req, res) {
    try {
      const { hotelId } = req.params;
      const metricData = req.body;
      
      const metric = await webOptimizationService.recordPerformanceMetric(hotelId, metricData);
      
      res.status(201).json({
        success: true,
        message: 'Performance metric recorded successfully',
        data: metric
      });
      
    } catch (error) {
      console.error('Error recording performance metric:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to record performance metric'
      });
    }
  }
  
  async getPerformanceReport(req, res) {
    try {
      const { hotelId } = req.params;
      const { timeframe = 30 } = req.query;
      
      const report = await webOptimizationService.getPerformanceReport(hotelId, parseInt(timeframe));
      
      res.json({
        success: true,
        data: report
      });
      
    } catch (error) {
      console.error('Error generating performance report:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate performance report'
      });
    }
  }
  
  async getWebVitals(req, res) {
    try {
      const { hotelId } = req.params;
      const { page, device, startDate, endDate } = req.query;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      let metrics = config.performance.metrics;
      
      // Filter web vitals metrics
      const webVitalTypes = ['first_contentful_paint', 'largest_contentful_paint', 'cumulative_layout_shift', 'first_input_delay'];
      metrics = metrics.filter(m => webVitalTypes.includes(m.metricType));
      
      // Apply additional filters
      if (page) {
        metrics = metrics.filter(m => m.page === page);
      }
      if (device) {
        metrics = metrics.filter(m => m.device === device);
      }
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        metrics = metrics.filter(m => m.timestamp >= start && m.timestamp <= end);
      }
      
      // Calculate averages for each metric type
      const vitals = {};
      webVitalTypes.forEach(type => {
        const typeMetrics = metrics.filter(m => m.metricType === type);
        if (typeMetrics.length > 0) {
          vitals[type] = {
            average: typeMetrics.reduce((sum, m) => sum + m.value, 0) / typeMetrics.length,
            count: typeMetrics.length,
            min: Math.min(...typeMetrics.map(m => m.value)),
            max: Math.max(...typeMetrics.map(m => m.value))
          };
        }
      });
      
      res.json({
        success: true,
        data: {
          webVitals: vitals,
          totalMetrics: metrics.length
        }
      });
      
    } catch (error) {
      console.error('Error fetching web vitals:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch web vitals'
      });
    }
  }
  
  async getPerformanceMetrics(req, res) {
    try {
      const { hotelId } = req.params;
      const { metricType, startDate, endDate, device, page } = req.query;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      let metrics = config.performance.metrics;
      
      // Apply filters
      if (metricType) {
        metrics = metrics.filter(m => m.metricType === metricType);
      }
      if (device) {
        metrics = metrics.filter(m => m.device === device);
      }
      if (page) {
        metrics = metrics.filter(m => m.page === page);
      }
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        metrics = metrics.filter(m => m.timestamp >= start && m.timestamp <= end);
      }
      
      res.json({
        success: true,
        data: {
          metrics,
          count: metrics.length
        }
      });
      
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch performance metrics'
      });
    }
  }
  
  // User Behavior Tracking Endpoints
  async recordUserBehavior(req, res) {
    try {
      const { hotelId } = req.params;
      const sessionData = req.body;
      
      const result = await webOptimizationService.recordUserBehavior(hotelId, sessionData);
      
      res.status(201).json({
        success: true,
        message: 'User behavior recorded successfully',
        data: result
      });
      
    } catch (error) {
      console.error('Error recording user behavior:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to record user behavior'
      });
    }
  }
  
  async getHeatmapData(req, res) {
    try {
      const { hotelId } = req.params;
      const { page, startDate, endDate, device } = req.query;
      
      // For now, return mock heatmap data as this would typically require
      // integration with external heatmap services like Hotjar or Crazy Egg
      const heatmapData = {
        clicks: [],
        mouseMoves: [],
        scrollEvents: [],
        page,
        device,
        dateRange: {
          start: startDate,
          end: endDate
        },
        summary: {
          totalClicks: 0,
          totalSessions: 0,
          avgScrollDepth: 0
        }
      };
      
      res.json({
        success: true,
        data: heatmapData,
        message: 'Heatmap data retrieved successfully'
      });
      
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch heatmap data'
      });
    }
  }
  
  async getUserBehaviorAnalytics(req, res) {
    try {
      const { hotelId } = req.params;
      const { timeframe = 30, segment } = req.query;
      
      // For now, return mock analytics data
      const analytics = {
        overview: {
          totalSessions: 0,
          uniqueVisitors: 0,
          avgSessionDuration: 0,
          bounceRate: 0,
          pageViews: 0
        },
        topPages: [],
        userFlow: [],
        deviceBreakdown: {
          desktop: 0,
          mobile: 0,
          tablet: 0
        },
        trafficSources: {
          direct: 0,
          search: 0,
          social: 0,
          referral: 0
        },
        timeframe: parseInt(timeframe),
        segment
      };
      
      res.json({
        success: true,
        data: analytics
      });
      
    } catch (error) {
      console.error('Error fetching user behavior analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user behavior analytics'
      });
    }
  }
  
  // Conversion Funnel Endpoints
  async createConversionFunnel(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }
      
      const { hotelId } = req.params;
      const funnelData = req.body;
      const createdBy = req.user.id;
      
      const funnel = await webOptimizationService.createConversionFunnel(hotelId, funnelData, createdBy);
      
      res.status(201).json({
        success: true,
        message: 'Conversion funnel created successfully',
        data: funnel
      });
      
    } catch (error) {
      console.error('Error creating conversion funnel:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create conversion funnel'
      });
    }
  }
  
  async getConversionFunnels(req, res) {
    try {
      const { hotelId } = req.params;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      res.json({
        success: true,
        data: config.conversionFunnels
      });
      
    } catch (error) {
      console.error('Error fetching conversion funnels:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch conversion funnels'
      });
    }
  }
  
  async getConversionFunnelReport(req, res) {
    try {
      const { hotelId, funnelId } = req.params;
      const { timeframe = 30 } = req.query;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      const funnel = config.conversionFunnels.find(f => f.funnelId === funnelId);
      if (!funnel) {
        return res.status(404).json({
          success: false,
          message: 'Conversion funnel not found'
        });
      }
      
      // Calculate funnel metrics
      const report = {
        funnel: {
          id: funnel.funnelId,
          name: funnel.funnelName,
          description: funnel.description,
          steps: funnel.steps.length
        },
        analytics: funnel.analytics,
        stepAnalysis: funnel.analytics.stepAnalytics.map((step, index) => ({
          stepId: step.stepId,
          stepName: funnel.steps[index]?.stepName || `Step ${index + 1}`,
          entrances: step.entrances,
          exits: step.exits,
          dropoffRate: step.dropoffRate,
          conversionRate: step.entrances > 0 ? ((step.entrances - step.exits) / step.entrances * 100) : 0,
          avgTimeSpent: step.avgTimeSpent
        })),
        overallConversionRate: funnel.analytics.conversionRate,
        timeframe: parseInt(timeframe)
      };
      
      res.json({
        success: true,
        data: report
      });
      
    } catch (error) {
      console.error('Error generating funnel report:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate funnel report'
      });
    }
  }
  
  async trackFunnelStep(req, res) {
    try {
      const { hotelId, funnelId, stepId } = req.params;
      const { sessionId } = req.body;
      
      const success = await webOptimizationService.trackFunnelStep(hotelId, funnelId, stepId, sessionId);
      
      res.json({
        success,
        message: success ? 'Funnel step tracked successfully' : 'Failed to track funnel step'
      });
      
    } catch (error) {
      console.error('Error tracking funnel step:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track funnel step'
      });
    }
  }
  
  // Personalization Endpoints
  async createPersonalizationRule(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }
      
      const { hotelId } = req.params;
      const ruleData = req.body;
      const createdBy = req.user.id;
      
      const rule = await webOptimizationService.createPersonalizationRule(hotelId, ruleData, createdBy);
      
      res.status(201).json({
        success: true,
        message: 'Personalization rule created successfully',
        data: rule
      });
      
    } catch (error) {
      console.error('Error creating personalization rule:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create personalization rule'
      });
    }
  }
  
  async getPersonalizationRules(req, res) {
    try {
      const { hotelId } = req.params;
      const { status } = req.query;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      let rules = config.personalization.rules;
      
      if (status) {
        rules = rules.filter(rule => rule.status === status);
      }
      
      res.json({
        success: true,
        data: rules
      });
      
    } catch (error) {
      console.error('Error fetching personalization rules:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch personalization rules'
      });
    }
  }
  
  async updatePersonalizationRule(req, res) {
    try {
      const { hotelId, ruleId } = req.params;
      const updates = req.body;
      const userId = req.user.id;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      const ruleIndex = config.personalization.rules.findIndex(r => r.ruleId === ruleId);
      if (ruleIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Personalization rule not found'
        });
      }
      
      // Update rule fields
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          config.personalization.rules[ruleIndex][key] = updates[key];
        }
      });
      
      config.auditInfo.updatedBy = userId;
      config.auditInfo.changeLog.push({
        action: 'UPDATE_PERSONALIZATION_RULE',
        changedBy: userId,
        changes: { ruleId, updates }
      });
      
      await config.save();
      
      res.json({
        success: true,
        message: 'Personalization rule updated successfully',
        data: config.personalization.rules[ruleIndex]
      });
      
    } catch (error) {
      console.error('Error updating personalization rule:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update personalization rule'
      });
    }
  }
  
  async deletePersonalizationRule(req, res) {
    try {
      const { hotelId, ruleId } = req.params;
      const userId = req.user.id;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      const ruleIndex = config.personalization.rules.findIndex(r => r.ruleId === ruleId);
      if (ruleIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Personalization rule not found'
        });
      }
      
      const deletedRule = config.personalization.rules[ruleIndex];
      config.personalization.rules.splice(ruleIndex, 1);
      
      config.auditInfo.updatedBy = userId;
      config.auditInfo.changeLog.push({
        action: 'DELETE_PERSONALIZATION_RULE',
        changedBy: userId,
        changes: { ruleId, ruleName: deletedRule.ruleName }
      });
      
      await config.save();
      
      res.json({
        success: true,
        message: 'Personalization rule deleted successfully'
      });
      
    } catch (error) {
      console.error('Error deleting personalization rule:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete personalization rule'
      });
    }
  }
  
  async executePersonalization(req, res) {
    try {
      const { hotelId } = req.params;
      const userProfile = req.body;
      
      const personalization = await webOptimizationService.getPersonalizationForUser(hotelId, userProfile);
      
      res.json({
        success: true,
        data: personalization
      });
      
    } catch (error) {
      console.error('Error executing personalization:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to execute personalization'
      });
    }
  }
  
  async getPersonalizationForUser(req, res) {
    try {
      const { hotelId } = req.params;
      const userProfile = req.body;
      
      const personalization = await webOptimizationService.getPersonalizationForUser(hotelId, userProfile);
      
      res.json({
        success: true,
        data: personalization
      });
      
    } catch (error) {
      console.error('Error getting personalization:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get personalization'
      });
    }
  }
  
  // Integration Endpoints
  async configureIntegration(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }
      
      const { hotelId } = req.params;
      const integrationData = req.body;
      const userId = req.user.id;
      
      const integration = await webOptimizationService.configureIntegration(hotelId, integrationData, userId);
      
      res.status(201).json({
        success: true,
        message: 'Integration configured successfully',
        data: integration
      });
      
    } catch (error) {
      console.error('Error configuring integration:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to configure integration'
      });
    }
  }
  
  async getIntegrations(req, res) {
    try {
      const { hotelId } = req.params;
      const { integrationType, status } = req.query;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      let integrations = config.integrations;
      
      if (integrationType) {
        integrations = integrations.filter(i => i.integrationType === integrationType);
      }
      if (status) {
        integrations = integrations.filter(i => i.status === status);
      }
      
      res.json({
        success: true,
        data: integrations
      });
      
    } catch (error) {
      console.error('Error fetching integrations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch integrations'
      });
    }
  }
  
  // Configuration Management Endpoints
  async getWebConfiguration(req, res) {
    try {
      const { hotelId } = req.params;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      res.json({
        success: true,
        data: config
      });
      
    } catch (error) {
      console.error('Error fetching web configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch web configuration'
      });
    }
  }
  
  async updateWebConfiguration(req, res) {
    try {
      const { hotelId } = req.params;
      const updates = req.body;
      const userId = req.user.id;
      
      let config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        config = new WebConfiguration({
          hotelId,
          configurationName: 'Default Web Optimization Configuration',
          auditInfo: { createdBy: userId }
        });
      }
      
      // Update configuration
      Object.keys(updates).forEach(key => {
        if (key !== 'auditInfo' && updates[key] !== undefined) {
          config[key] = updates[key];
        }
      });
      
      config.auditInfo.updatedBy = userId;
      config.auditInfo.changeLog.push({
        action: 'UPDATE_CONFIGURATION',
        changedBy: userId,
        changes: updates
      });
      
      await config.save();
      
      res.json({
        success: true,
        message: 'Web configuration updated successfully',
        data: config
      });
      
    } catch (error) {
      console.error('Error updating web configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update web configuration'
      });
    }
  }
  
  // Analytics and Reporting Endpoints
  async getOptimizationReport(req, res) {
    try {
      const { hotelId } = req.params;
      
      const report = await webOptimizationService.getOptimizationReport(hotelId);
      
      res.json({
        success: true,
        data: report
      });
      
    } catch (error) {
      console.error('Error generating optimization report:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate optimization report'
      });
    }
  }
  
  async getOptimizationRecommendations(req, res) {
    try {
      const { hotelId } = req.params;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      const recommendations = [];
      
      // A/B Test Recommendations
      const runningTests = config.abTesting.tests.filter(t => t.status === 'running');
      const completedTests = config.abTesting.tests.filter(t => t.status === 'completed');
      
      if (runningTests.length === 0) {
        recommendations.push({
          type: 'ab_testing',
          priority: 'medium',
          title: 'Start A/B Testing',
          description: 'No active A/B tests found. Consider testing key pages to improve conversions.',
          action: 'Create and launch A/B tests for homepage, booking flow, or checkout process'
        });
      }
      
      // Performance Recommendations
      const recentMetrics = config.performance.metrics.slice(-100);
      const avgLoadTime = recentMetrics
        .filter(m => m.metricType === 'page_load_time')
        .reduce((sum, m) => sum + m.value, 0) / recentMetrics.length || 0;
      
      if (avgLoadTime > 3000) {
        recommendations.push({
          type: 'performance',
          priority: 'high',
          title: 'Improve Page Load Speed',
          description: `Average page load time is ${Math.round(avgLoadTime)}ms, which exceeds the recommended 3 seconds.`,
          action: 'Optimize images, enable compression, and implement CDN'
        });
      }
      
      // Personalization Recommendations
      const activeRules = config.personalization.rules.filter(r => r.status === 'active');
      if (activeRules.length === 0 && config.personalization.isEnabled) {
        recommendations.push({
          type: 'personalization',
          priority: 'medium',
          title: 'Create Personalization Rules',
          description: 'Personalization is enabled but no active rules found.',
          action: 'Create personalization rules for different user segments'
        });
      }
      
      // Funnel Recommendations
      if (config.conversionFunnels.length === 0) {
        recommendations.push({
          type: 'conversion',
          priority: 'low',
          title: 'Set Up Conversion Funnels',
          description: 'Track user journey through key conversion paths.',
          action: 'Create funnels for booking process, registration, and other key conversions'
        });
      }
      
      res.json({
        success: true,
        data: {
          recommendations,
          summary: {
            totalRecommendations: recommendations.length,
            highPriority: recommendations.filter(r => r.priority === 'high').length,
            mediumPriority: recommendations.filter(r => r.priority === 'medium').length,
            lowPriority: recommendations.filter(r => r.priority === 'low').length
          }
        }
      });
      
    } catch (error) {
      console.error('Error generating optimization recommendations:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate optimization recommendations'
      });
    }
  }
  
  async getDashboardData(req, res) {
    try {
      const { hotelId } = req.params;
      
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Web configuration not found'
        });
      }
      
      const dashboardData = {
        overview: {
          totalABTests: config.abTesting.tests.length,
          runningABTests: config.abTesting.tests.filter(t => t.status === 'running').length,
          completedABTests: config.abTesting.tests.filter(t => t.status === 'completed').length,
          activePersonalizationRules: config.personalization.rules.filter(r => r.status === 'active').length,
          activeFunnels: config.conversionFunnels.filter(f => f.isActive).length,
          connectedIntegrations: config.integrations.filter(i => i.status === 'connected').length
        },
        recentActivity: [
          ...config.auditInfo.changeLog.slice(-5).map(log => ({
            type: 'system',
            action: log.action,
            timestamp: log.changedAt,
            details: log.changes
          }))
        ],
        performanceSummary: config.getPerformanceReport(7),
        quickStats: {
          avgPageLoadTime: 0, // Would be calculated from recent metrics
          avgConversionRate: 0, // Would be calculated from all active tests
          totalVisitors: 0, // Would be calculated from user behavior data
          totalConversions: 0 // Would be calculated from funnel data
        }
      };
      
      res.json({
        success: true,
        data: dashboardData
      });
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard data'
      });
    }
  }
  
  // Statistical Analysis Endpoints
  async calculateStatisticalSignificance(req, res) {
    try {
      const { hotelId, testId } = req.params;
      
      const significance = await webOptimizationService.calculateStatisticalSignificance(hotelId, testId);
      
      res.json({
        success: true,
        data: significance
      });
      
    } catch (error) {
      console.error('Error calculating statistical significance:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to calculate statistical significance'
      });
    }
  }
}

// Validation middleware
export const abTestValidation = [
  body('testName').notEmpty().withMessage('Test name is required'),
  body('testType').isIn(['page', 'element', 'form', 'content', 'design', 'pricing', 'flow']).withMessage('Invalid test type'),
  body('variants').isArray({ min: 2 }).withMessage('At least 2 variants are required')
];

export const funnelValidation = [
  body('funnelName').notEmpty().withMessage('Funnel name is required'),
  body('steps').isArray({ min: 2 }).withMessage('At least 2 steps are required')
];

export const personalizationValidation = [
  body('ruleName').notEmpty().withMessage('Rule name is required'),
  body('targetAudience').notEmpty().withMessage('Target audience is required'),
  body('personalization').notEmpty().withMessage('Personalization configuration is required')
];

export const integrationValidation = [
  body('integrationType').isIn(['analytics', 'heatmap', 'chat', 'email', 'crm', 'payment', 'social', 'advertising', 'webhook']).withMessage('Invalid integration type'),
  body('provider').notEmpty().withMessage('Provider is required')
];

export default new WebOptimizationController();
