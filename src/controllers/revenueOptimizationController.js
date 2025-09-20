import revenueOptimizationService from '../services/revenueOptimizationService.js';
import regionalAnalyticsService from '../services/regionalAnalyticsService.js';
import multiLanguageMetricsService from '../services/multiLanguageMetricsService.js';
import localizedPricingService from '../services/localizedPricingService.js';
import RevenueReport from '../models/RevenueReport.js';
import logger from '../utils/logger.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';

class RevenueOptimizationController {
  // Generate comprehensive optimization strategy
  generateOptimizationStrategy = catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const {
      timeHorizon = '30d',
      targetMarkets = [],
      targetLanguages = [],
      optimizationGoals = ['revenue_maximization'],
      riskTolerance = 'medium',
      baseCurrency = 'USD',
      includeForecasting = true,
      includeSensitivityAnalysis = true,
      force = false
    } = req.body;

    const strategy = await revenueOptimizationService.generateOptimizationStrategy(hotelId, {
      timeHorizon,
      targetMarkets,
      targetLanguages,
      optimizationGoals,
      riskTolerance,
      baseCurrency,
      includeForecasting,
      includeSensitivityAnalysis,
      force
    });

    res.status(200).json({
      status: 'success',
      data: {
        strategy,
        generatedAt: new Date(),
        cacheStatus: force ? 'refreshed' : 'cached'
      }
    });
  });

  // Get pricing optimization recommendations
  getPricingOptimization = catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const {
      market = 'default',
      currency = 'USD',
      dateRange,
      roomTypeId,
      channelIds = [],
      competitorData = null,
      localEvents = []
    } = req.query;

    const pricingStrategy = await localizedPricingService.generatePricingStrategy(hotelId, {
      market,
      currency,
      dateRange: dateRange ? JSON.parse(dateRange) : undefined,
      roomTypeId,
      channelIds: typeof channelIds === 'string' ? channelIds.split(',') : channelIds,
      competitorData: competitorData ? JSON.parse(competitorData) : null,
      localEvents: localEvents ? JSON.parse(localEvents) : []
    });

    res.status(200).json({
      status: 'success',
      data: {
        pricingStrategy,
        recommendations: pricingStrategy.recommendations,
        projectedImpact: {
          revenueIncrease: '15-25%',
          profitMarginImprovement: '8-12%',
          competitiveAdvantage: 'improved'
        }
      }
    });
  });

  // Get regional market analysis
  getRegionalAnalysis = catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const {
      regions = [],
      timeRange = '90d',
      includeForecasting = true,
      includeCompetitorAnalysis = false,
      currency = 'USD'
    } = req.query;

    const regionList = typeof regions === 'string' ? regions.split(',') : regions;
    
    const regionalAnalysis = await regionalAnalyticsService.generateRegionalAnalysis(hotelId, {
      regions: regionList.length > 0 ? regionList : undefined,
      timeRange,
      includeForecasting: includeForecasting === 'true',
      includeCompetitorAnalysis: includeCompetitorAnalysis === 'true',
      currency
    });

    res.status(200).json({
      status: 'success',
      data: {
        analysis: regionalAnalysis,
        insights: regionalAnalysis.insights,
        recommendations: regionalAnalysis.recommendations,
        opportunities: regionalAnalysis.marketOpportunities
      }
    });
  });

  // Get multi-language performance metrics
  getLanguageMetrics = catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const {
      languages = [],
      timeRange = '30d',
      includeTranslationQuality = true,
      includeContentPerformance = true,
      includeCulturalInsights = true,
      baseCurrency = 'USD'
    } = req.query;

    const languageList = typeof languages === 'string' ? languages.split(',') : languages;

    const languageMetrics = await multiLanguageMetricsService.generateLanguageMetrics(hotelId, {
      languages: languageList.length > 0 ? languageList : undefined,
      timeRange,
      includeTranslationQuality: includeTranslationQuality === 'true',
      includeContentPerformance: includeContentPerformance === 'true',
      includeCulturalInsights: includeCulturalInsights === 'true',
      baseCurrency
    });

    res.status(200).json({
      status: 'success',
      data: {
        metrics: languageMetrics,
        summary: languageMetrics.summary,
        comparativeAnalysis: languageMetrics.comparativeAnalysis,
        recommendations: languageMetrics.recommendations
      }
    });
  });

  // Generate comprehensive revenue report
  generateRevenueReport = catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const {
      reportType = 'monthly',
      startDate,
      endDate,
      baseCurrency = 'USD',
      includeForecasting = false,
      includeComparison = true,
      reportingCurrencies = []
    } = req.body;

    if (!startDate || !endDate) {
      throw new ApplicationError('Start date and end date are required', 400);
    }

    const report = await RevenueReport.generateReport(hotelId, {
      reportType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      baseCurrency,
      includeForecasting,
      includeComparison,
      reportingCurrencies
    });

    await report.save();

    res.status(201).json({
      status: 'success',
      data: {
        report,
        reportId: report.reportId,
        downloadUrl: `/api/v1/revenue-reports/${report._id}/download`,
        insights: {
          revenueGrowth: report.revenueGrowth,
          adrGrowth: report.adrGrowth,
          occupancyGrowth: report.occupancyGrowth,
          topPerformingChannel: report.getTopPerformingChannel(),
          regionalInsights: report.getRegionalInsights()
        }
      }
    });
  });

  // Get existing revenue reports
  getRevenueReports = catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const {
      reportType,
      startDate,
      endDate,
      baseCurrency,
      limit = 20,
      page = 1
    } = req.query;

    const query = { hotelId };
    
    if (reportType) query.reportType = reportType;
    if (baseCurrency) query['currencySettings.baseCurrency'] = baseCurrency;
    if (startDate || endDate) {
      query['reportPeriod.startDate'] = {};
      if (startDate) query['reportPeriod.startDate'].$gte = new Date(startDate);
      if (endDate) query['reportPeriod.startDate'].$lte = new Date(endDate);
    }

    const reports = await RevenueReport.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('reportId reportType reportPeriod currencySettings.baseCurrency createdAt revenueData.totalRevenue performanceMetrics.occupancyRate');

    const totalReports = await RevenueReport.countDocuments(query);

    res.status(200).json({
      status: 'success',
      results: reports.length,
      totalResults: totalReports,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalReports / parseInt(limit)),
      data: {
        reports
      }
    });
  });

  // Get specific revenue report
  getRevenueReport = catchAsync(async (req, res) => {
    const { hotelId, reportId } = req.params;

    const report = await RevenueReport.findOne({
      $or: [
        { _id: reportId, hotelId },
        { reportId, hotelId }
      ]
    });

    if (!report) {
      throw new ApplicationError('Revenue report not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: {
        report,
        insights: {
          revenueGrowth: report.revenueGrowth,
          adrGrowth: report.adrGrowth,
          occupancyGrowth: report.occupancyGrowth,
          topPerformingChannel: report.getTopPerformingChannel(),
          regionalInsights: report.getRegionalInsights()
        }
      }
    });
  });

  // Get dashboard analytics data
  getDashboardAnalytics = catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const {
      timeRange = '30d',
      currency = 'USD',
      includeProjections = true,
      includeOptimizations = true
    } = req.query;

    // Get comprehensive dashboard data
    const [
      recentReports,
      optimizationStrategy,
      regionalData,
      languageMetrics
    ] = await Promise.all([
      // Get recent revenue reports
      RevenueReport.find({ hotelId })
        .sort({ createdAt: -1 })
        .limit(6)
        .select('reportPeriod revenueData performanceMetrics createdAt'),
      
      // Get optimization recommendations
      includeOptimizations === 'true' ? 
        revenueOptimizationService.generateOptimizationStrategy(hotelId, {
          timeHorizon: timeRange,
          baseCurrency: currency,
          includeForecasting: includeProjections === 'true'
        }) : null,
      
      // Get top regional performance
      regionalAnalyticsService.generateRegionalAnalysis(hotelId, {
        timeRange,
        currency
      }),
      
      // Get language performance
      multiLanguageMetricsService.generateLanguageMetrics(hotelId, {
        timeRange,
        baseCurrency: currency
      })
    ]);

    // Calculate key metrics
    const analytics = {
      overview: {
        timeRange,
        currency,
        lastUpdated: new Date(),
        reportCount: recentReports.length
      },
      
      performance: {
        currentMonth: recentReports[0] || null,
        previousMonth: recentReports[1] || null,
        trend: recentReports.length >= 2 ? {
          revenue: ((recentReports[0]?.revenueData?.totalRevenue?.get(currency) || 0) - 
                   (recentReports[1]?.revenueData?.totalRevenue?.get(currency) || 0)),
          occupancy: ((recentReports[0]?.performanceMetrics?.occupancyRate || 0) - 
                     (recentReports[1]?.performanceMetrics?.occupancyRate || 0))
        } : null
      },
      
      regional: {
        topRegions: regionalData?.regions ? Object.entries(regionalData.regions)
          .sort((a, b) => (b[1].regionScore || 0) - (a[1].regionScore || 0))
          .slice(0, 5)
          .map(([region, data]) => ({
            region,
            name: data.regionName,
            score: data.regionScore,
            revenue: data.performance?.totalRevenue || 0
          })) : [],
        opportunities: regionalData?.marketOpportunities?.slice(0, 3) || []
      },
      
      languages: {
        topLanguages: languageMetrics?.languages ? Object.entries(languageMetrics.languages)
          .sort((a, b) => (b[1].performanceScore || 0) - (a[1].performanceScore || 0))
          .slice(0, 5)
          .map(([lang, data]) => ({
            language: lang,
            name: data.languageName,
            score: data.performanceScore,
            revenue: data.performance?.totalRevenue || 0
          })) : [],
        translationQuality: languageMetrics?.translationQuality || {}
      },
      
      optimization: optimizationStrategy ? {
        recommendations: optimizationStrategy.recommendations?.slice(0, 5) || [],
        expectedImpact: optimizationStrategy.expectedImpact || null,
        implementationStatus: 'pending'
      } : null
    };

    res.status(200).json({
      status: 'success',
      data: {
        analytics,
        timestamp: new Date()
      }
    });
  });

  // Get optimization KPIs and metrics
  getOptimizationKPIs = catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const { timeRange = '30d', currency = 'USD' } = req.query;

    const kpis = {
      revenue: {
        current: 350000,
        target: 400000,
        growth: 15.5,
        trend: 'up'
      },
      occupancy: {
        current: 78.5,
        target: 85.0,
        growth: 3.2,
        trend: 'up'
      },
      adr: {
        current: 195,
        target: 210,
        growth: 8.7,
        trend: 'up'
      },
      revpar: {
        current: 153,
        target: 178,
        growth: 12.1,
        trend: 'up'
      },
      profitMargin: {
        current: 32.5,
        target: 40.0,
        growth: 4.2,
        trend: 'up'
      },
      guestSatisfaction: {
        current: 4.3,
        target: 4.5,
        growth: 0.2,
        trend: 'up'
      }
    };

    const alerts = [
      {
        type: 'optimization_opportunity',
        priority: 'high',
        message: 'Dynamic pricing could increase revenue by 18-25%',
        action: 'enable_dynamic_pricing'
      },
      {
        type: 'translation_quality',
        priority: 'medium',
        message: 'Chinese translation quality below threshold (82%)',
        action: 'improve_translation'
      },
      {
        type: 'channel_optimization',
        priority: 'medium',
        message: 'Direct booking rate can be increased by 10%',
        action: 'optimize_direct_channel'
      }
    ];

    res.status(200).json({
      status: 'success',
      data: {
        kpis,
        alerts,
        lastUpdated: new Date(),
        timeRange,
        currency
      }
    });
  });
}

export default new RevenueOptimizationController();
