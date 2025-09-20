import WebConfiguration from '../models/WebConfiguration.js';

class WebOptimizationService {
  
  // A/B Testing Methods
  async createABTest(hotelId, testData, createdBy) {
    try {
      let config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      
      if (!config) {
        config = new WebConfiguration({
          hotelId,
          configurationName: 'Default Web Optimization Configuration',
          auditInfo: { createdBy }
        });
      }
      
      // Generate unique test ID
      const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const abTest = {
        testId,
        testName: testData.testName,
        description: testData.description,
        testType: testData.testType,
        targetPage: testData.targetPage,
        variants: testData.variants.map((variant, index) => ({
          variantId: `variant_${index + 1}`,
          variantName: variant.variantName,
          description: variant.description,
          trafficAllocation: variant.trafficAllocation || 50,
          configuration: variant.configuration || {},
          isControl: variant.isControl || index === 0
        })),
        testSettings: {
          trafficSplit: testData.testSettings?.trafficSplit || 50,
          targetAudience: testData.testSettings?.targetAudience || { segments: ['all'] },
          schedule: testData.testSettings?.schedule || {},
          goals: testData.testSettings?.goals || []
        },
        status: 'draft',
        results: {
          totalVisitors: 0,
          totalConversions: 0,
          conversionRate: 0,
          variantResults: testData.variants.map((_, index) => ({
            variantId: `variant_${index + 1}`,
            visitors: 0,
            conversions: 0,
            conversionRate: 0,
            revenue: 0,
            avgSessionDuration: 0,
            bounceRate: 0
          })),
          statisticalSignificance: {
            isSignificant: false,
            confidenceLevel: 95,
            pValue: null,
            winningVariant: null
          }
        }
      };
      
      config.abTesting.tests.push(abTest);
      config.auditInfo.updatedBy = createdBy;
      config.auditInfo.changeLog.push({
        action: 'CREATE_AB_TEST',
        changedBy: createdBy,
        changes: { testId, testName: testData.testName }
      });
      
      await config.save();
      return abTest;
      
    } catch (error) {
      console.error('Error creating A/B test:', error);
      throw new Error('Failed to create A/B test');
    }
  }
  
  async startABTest(hotelId, testId, userId) {
    try {
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        throw new Error('Web configuration not found');
      }
      
      const test = await config.startABTest(testId);
      config.auditInfo.updatedBy = userId;
      config.auditInfo.changeLog.push({
        action: 'START_AB_TEST',
        changedBy: userId,
        changes: { testId }
      });
      
      await config.save();
      return test;
      
    } catch (error) {
      console.error('Error starting A/B test:', error);
      throw error;
    }
  }
  
  async stopABTest(hotelId, testId, userId) {
    try {
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        throw new Error('Web configuration not found');
      }
      
      const test = await config.stopABTest(testId);
      config.auditInfo.updatedBy = userId;
      config.auditInfo.changeLog.push({
        action: 'STOP_AB_TEST',
        changedBy: userId,
        changes: { testId }
      });
      
      await config.save();
      return test;
      
    } catch (error) {
      console.error('Error stopping A/B test:', error);
      throw error;
    }
  }
  
  async recordTestInteraction(hotelId, testId, variantId, sessionId, interactionType, value = 1) {
    try {
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) return false;
      
      const test = config.abTesting.tests.find(t => t.testId === testId);
      if (!test || test.status !== 'running') return false;
      
      const variant = test.results.variantResults.find(v => v.variantId === variantId);
      if (!variant) return false;
      
      // Update test results based on interaction type
      switch (interactionType) {
        case 'visitor':
          variant.visitors += 1;
          test.results.totalVisitors += 1;
          break;
        case 'conversion':
          variant.conversions += 1;
          test.results.totalConversions += 1;
          break;
        case 'revenue':
          variant.revenue += value;
          break;
        case 'session_duration':
          variant.avgSessionDuration = (variant.avgSessionDuration + value) / 2;
          break;
        case 'bounce':
          variant.bounceRate = (variant.bounceRate + (value ? 1 : 0)) / 2;
          break;
      }
      
      // Recalculate conversion rates
      config.calculateTestResults(testId);
      
      await config.save();
      return true;
      
    } catch (error) {
      console.error('Error recording test interaction:', error);
      return false;
    }
  }
  
  async calculateStatisticalSignificance(hotelId, testId) {
    try {
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        throw new Error('Web configuration not found');
      }
      
      const test = config.abTesting.tests.find(t => t.testId === testId);
      if (!test) {
        throw new Error('Test not found');
      }
      
      const controlVariant = test.results.variantResults.find(v => v.variantId === 'variant_1');
      const testVariant = test.results.variantResults.find(v => v.variantId === 'variant_2');
      
      if (!controlVariant || !testVariant) {
        throw new Error('Required variants not found');
      }
      
      // Simple z-test for statistical significance
      const p1 = controlVariant.conversions / controlVariant.visitors;
      const p2 = testVariant.conversions / testVariant.visitors;
      const pooledP = (controlVariant.conversions + testVariant.conversions) / 
                     (controlVariant.visitors + testVariant.visitors);
      
      const se = Math.sqrt(pooledP * (1 - pooledP) * (1/controlVariant.visitors + 1/testVariant.visitors));
      const zScore = Math.abs(p2 - p1) / se;
      
      // Calculate p-value (simplified)
      const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
      
      test.results.statisticalSignificance.pValue = pValue;
      test.results.statisticalSignificance.isSignificant = pValue < 0.05;
      test.results.statisticalSignificance.winningVariant = p2 > p1 ? 'variant_2' : 'variant_1';
      
      await config.save();
      return test.results.statisticalSignificance;
      
    } catch (error) {
      console.error('Error calculating statistical significance:', error);
      throw error;
    }
  }
  
  // Performance Monitoring Methods
  async recordPerformanceMetric(hotelId, metricData) {
    try {
      let config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      
      if (!config) {
        config = new WebConfiguration({
          hotelId,
          configurationName: 'Default Web Optimization Configuration'
        });
      }
      
      const metric = {
        metricId: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        metricName: metricData.metricName,
        metricType: metricData.metricType,
        value: metricData.value,
        threshold: metricData.threshold,
        page: metricData.page,
        device: metricData.device,
        location: metricData.location
      };
      
      config.performance.metrics.push(metric);
      
      // Keep only recent metrics (last 1000)
      if (config.performance.metrics.length > 1000) {
        config.performance.metrics = config.performance.metrics.slice(-1000);
      }
      
      await config.save();
      return metric;
      
    } catch (error) {
      console.error('Error recording performance metric:', error);
      throw new Error('Failed to record performance metric');
    }
  }
  
  async getPerformanceReport(hotelId, timeframe = 30) {
    try {
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        throw new Error('Web configuration not found');
      }
      
      return config.getPerformanceReport(timeframe);
      
    } catch (error) {
      console.error('Error generating performance report:', error);
      throw error;
    }
  }
  
  // User Behavior Tracking Methods
  async recordUserBehavior(hotelId, sessionData) {
    try {
      let config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      
      if (!config) {
        config = new WebConfiguration({
          hotelId,
          configurationName: 'Default Web Optimization Configuration'
        });
      }
      
      // Find existing session or create new
      const existingSession = await this.findUserSession(sessionData.sessionId);
      
      if (existingSession) {
        // Update existing session
        existingSession.sessionData.pageViews.push(...sessionData.pageViews || []);
        existingSession.sessionData.interactions.push(...sessionData.interactions || []);
        existingSession.sessionData.endTime = new Date();
        existingSession.sessionData.duration = 
          (existingSession.sessionData.endTime - existingSession.sessionData.startTime) / 1000;
        
        await existingSession.save();
        return existingSession;
      } else {
        // Create new session record (would typically be in separate collection)
        // For now, we'll store in the main config for simplicity
        return { success: true, sessionId: sessionData.sessionId };
      }
      
    } catch (error) {
      console.error('Error recording user behavior:', error);
      throw new Error('Failed to record user behavior');
    }
  }
  
  // Conversion Funnel Methods
  async createConversionFunnel(hotelId, funnelData, createdBy) {
    try {
      let config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      
      if (!config) {
        config = new WebConfiguration({
          hotelId,
          configurationName: 'Default Web Optimization Configuration',
          auditInfo: { createdBy }
        });
      }
      
      const funnel = {
        funnelId: `funnel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        funnelName: funnelData.funnelName,
        description: funnelData.description,
        steps: funnelData.steps.map((step, index) => ({
          stepId: `step_${index + 1}`,
          stepName: step.stepName,
          stepType: step.stepType,
          stepOrder: index + 1,
          criteria: step.criteria,
          isRequired: step.isRequired !== false
        })),
        analytics: {
          totalSessions: 0,
          completedSessions: 0,
          conversionRate: 0,
          stepAnalytics: funnelData.steps.map((_, index) => ({
            stepId: `step_${index + 1}`,
            entrances: 0,
            exits: 0,
            dropoffRate: 0,
            avgTimeSpent: 0
          }))
        },
        isActive: true
      };
      
      config.conversionFunnels.push(funnel);
      config.auditInfo.updatedBy = createdBy;
      
      await config.save();
      return funnel;
      
    } catch (error) {
      console.error('Error creating conversion funnel:', error);
      throw new Error('Failed to create conversion funnel');
    }
  }
  
  async trackFunnelStep(hotelId, funnelId, stepId, sessionId) {
    try {
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) return false;
      
      const funnel = config.conversionFunnels.find(f => f.funnelId === funnelId);
      if (!funnel || !funnel.isActive) return false;
      
      const step = funnel.analytics.stepAnalytics.find(s => s.stepId === stepId);
      if (!step) return false;
      
      step.entrances += 1;
      funnel.analytics.totalSessions += 1;
      
      await config.save();
      return true;
      
    } catch (error) {
      console.error('Error tracking funnel step:', error);
      return false;
    }
  }
  
  // Personalization Methods
  async createPersonalizationRule(hotelId, ruleData, createdBy) {
    try {
      let config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      
      if (!config) {
        config = new WebConfiguration({
          hotelId,
          configurationName: 'Default Web Optimization Configuration',
          auditInfo: { createdBy }
        });
      }
      
      const rule = {
        ruleId: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ruleName: ruleData.ruleName,
        description: ruleData.description,
        targetAudience: ruleData.targetAudience,
        personalization: ruleData.personalization,
        status: 'draft',
        performance: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0,
          ctr: 0,
          conversionRate: 0
        },
        schedule: ruleData.schedule || {}
      };
      
      config.personalization.rules.push(rule);
      config.auditInfo.updatedBy = createdBy;
      
      await config.save();
      return rule;
      
    } catch (error) {
      console.error('Error creating personalization rule:', error);
      throw new Error('Failed to create personalization rule');
    }
  }
  
  async getPersonalizationForUser(hotelId, userProfile) {
    try {
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config || !config.personalization.isEnabled) {
        return null;
      }
      
      const applicableRules = config.personalization.rules.filter(rule => {
        if (rule.status !== 'active') return false;
        
        // Check audience targeting
        const matchesSegment = rule.targetAudience.segments.some(segment => {
          switch (segment) {
            case 'new_visitors': return userProfile.isNewVisitor;
            case 'returning_visitors': return !userProfile.isNewVisitor;
            case 'mobile_users': return userProfile.device === 'mobile';
            case 'vip_guests': return userProfile.isVIP;
            case 'corporate_guests': return userProfile.isCorporate;
            default: return true;
          }
        });
        
        if (!matchesSegment) return false;
        
        // Check conditions
        const matchesConditions = rule.targetAudience.conditions.every(condition => {
          const userValue = userProfile[condition.field];
          switch (condition.operator) {
            case 'equals': return userValue === condition.value;
            case 'not_equals': return userValue !== condition.value;
            case 'greater_than': return userValue > condition.value;
            case 'less_than': return userValue < condition.value;
            case 'contains': return userValue && userValue.includes(condition.value);
            case 'in': return condition.value.includes(userValue);
            default: return true;
          }
        });
        
        return matchesConditions;
      });
      
      return applicableRules;
      
    } catch (error) {
      console.error('Error getting personalization:', error);
      return null;
    }
  }
  
  // Integration Methods
  async configureIntegration(hotelId, integrationData, userId) {
    try {
      let config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      
      if (!config) {
        config = new WebConfiguration({
          hotelId,
          configurationName: 'Default Web Optimization Configuration',
          auditInfo: { createdBy: userId }
        });
      }
      
      const integration = {
        integrationId: `integration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        integrationType: integrationData.integrationType,
        provider: integrationData.provider,
        configuration: {
          apiKeys: new Map(Object.entries(integrationData.apiKeys || {})),
          endpoints: new Map(Object.entries(integrationData.endpoints || {})),
          settings: integrationData.settings || {}
        },
        isActive: true,
        status: 'connected'
      };
      
      config.integrations.push(integration);
      config.auditInfo.updatedBy = userId;
      
      await config.save();
      return integration;
      
    } catch (error) {
      console.error('Error configuring integration:', error);
      throw new Error('Failed to configure integration');
    }
  }
  
  // Analytics and Reporting Methods
  async getOptimizationReport(hotelId) {
    try {
      return await WebConfiguration.getOptimizationReport(hotelId);
    } catch (error) {
      console.error('Error generating optimization report:', error);
      throw error;
    }
  }
  
  async getABTestReport(hotelId, testId) {
    try {
      const config = await WebConfiguration.findOne({ hotelId, status: 'active' });
      if (!config) {
        throw new Error('Web configuration not found');
      }
      
      const test = config.abTesting.tests.find(t => t.testId === testId);
      if (!test) {
        throw new Error('Test not found');
      }
      
      return {
        test,
        results: config.calculateTestResults(testId),
        recommendations: await this.generateOptimizationRecommendations(test)
      };
      
    } catch (error) {
      console.error('Error generating A/B test report:', error);
      throw error;
    }
  }
  
  // Helper Methods
  normalCDF(x) {
    // Approximation of the cumulative distribution function for standard normal distribution
    return (1.0 + this.erf(x / Math.sqrt(2.0))) / 2.0;
  }
  
  erf(x) {
    // Approximation of the error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }
  
  async findUserSession(sessionId) {
    // This would typically query a separate user sessions collection
    // For now, return null to create new session
    return null;
  }
  
  async generateOptimizationRecommendations(test) {
    const recommendations = [];
    
    if (test.results.statisticalSignificance.isSignificant) {
      const winningVariant = test.results.variantResults.find(
        v => v.variantId === test.results.statisticalSignificance.winningVariant
      );
      
      if (winningVariant) {
        recommendations.push({
          type: 'winner_found',
          message: `Variant ${winningVariant.variantId} shows significant improvement`,
          action: 'Consider implementing the winning variant'
        });
      }
    } else {
      recommendations.push({
        type: 'continue_test',
        message: 'Test has not reached statistical significance yet',
        action: 'Continue running the test to gather more data'
      });
    }
    
    return recommendations;
  }
}

export default new WebOptimizationService();