import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import translationService from './translationService.js';
import regionalAnalyticsService from './regionalAnalyticsService.js';
import { getRedisClient } from '../config/redis.js';

class MultiLanguageMetricsService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 20 * 60 * 1000; // 20 minutes
    this.supportedLanguages = [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko',
      'ar', 'hi', 'th', 'vi', 'tr', 'pl', 'nl', 'sv', 'da', 'no'
    ];
    this.metricCategories = [
      'revenue', 'occupancy', 'satisfaction', 'booking_behavior',
      'channel_performance', 'market_penetration', 'service_quality'
    ];
  }

  // Generate comprehensive multi-language performance metrics
  async generateLanguageMetrics(hotelId, options = {}) {
    try {
      const {
        languages = this.supportedLanguages,
        timeRange = '30d',
        includeTranslationQuality = true,
        includeContentPerformance = true,
        includeCulturalInsights = true,
        baseCurrency = 'USD'
      } = options;

      const cacheKey = `language_metrics:${hotelId}:${languages.join(',')}:${timeRange}`;
      const cached = await this.getCachedMetrics(cacheKey);
      
      if (cached && !options.force) {
        return cached;
      }

      const metrics = {
        hotelId,
        generatedAt: new Date(),
        timeRange,
        baseCurrency,
        summary: await this.generateLanguageSummary(hotelId, languages, timeRange),
        languages: {},
        comparativeAnalysis: {},
        insights: [],
        recommendations: []
      };

      // Analyze each language individually
      for (const language of languages) {
        try {
          metrics.languages[language] = await this.analyzeLanguagePerformance(
            hotelId, 
            language, 
            {
              timeRange,
              baseCurrency,
              includeTranslationQuality,
              includeContentPerformance,
              includeCulturalInsights
            }
          );

          // Generate language-specific insights
          const languageInsights = await this.generateLanguageInsights(
            hotelId, 
            language, 
            metrics.languages[language]
          );
          metrics.insights.push(...languageInsights);

        } catch (error) {
          logger.warn(`Failed to analyze language ${language}:`, error);
          metrics.languages[language] = this.getDefaultLanguageData(language);
        }
      }

      // Cross-language comparative analysis
      metrics.comparativeAnalysis = await this.performComparativeAnalysis(metrics.languages);
      metrics.recommendations = await this.generateLanguageRecommendations(metrics);
      
      // Translation quality analysis
      if (includeTranslationQuality) {
        metrics.translationQuality = await this.analyzeTranslationQuality(hotelId, languages);
      }

      // Content localization effectiveness
      if (includeContentPerformance) {
        metrics.contentPerformance = await this.analyzeContentPerformance(hotelId, languages);
      }

      // Cache the metrics
      await this.cacheMetrics(cacheKey, metrics);
      
      logger.info(`Generated language metrics for hotel ${hotelId} covering ${languages.length} languages`);
      return metrics;

    } catch (error) {
      logger.error('Error generating language metrics:', error);
      throw new Error(`Failed to generate language metrics: ${error.message}`);
    }
  }

  // Analyze performance for specific language
  async analyzeLanguagePerformance(hotelId, language, options = {}) {
    const { timeRange, baseCurrency, includeTranslationQuality, includeContentPerformance } = options;

    const languageData = {
      languageCode: language,
      languageName: this.getLanguageName(language),
      nativeName: this.getNativeName(language),
      analysisDate: new Date(),
      
      // Core performance metrics
      performance: await this.getLanguagePerformanceMetrics(hotelId, language, timeRange),
      
      // Booking behavior by language
      bookingBehavior: await this.analyzeBookingBehavior(hotelId, language, timeRange),
      
      // Guest satisfaction by language
      satisfaction: await this.analyzeSatisfactionMetrics(hotelId, language, timeRange),
      
      // Channel effectiveness by language
      channelPerformance: await this.analyzeChannelEffectiveness(hotelId, language, timeRange),
      
      // Communication preferences
      communicationPreferences: await this.analyzeCommunicationPreferences(hotelId, language),
      
      // Content engagement metrics
      contentEngagement: await this.analyzeContentEngagement(hotelId, language, timeRange),
      
      // Cultural adaptation indicators
      culturalAdaptation: await this.assessCulturalAdaptation(hotelId, language),
      
      // Market penetration in language markets
      marketPenetration: await this.analyzeMarketPenetration(hotelId, language, timeRange)
    };

    // Optional detailed analyses
    if (includeTranslationQuality) {
      languageData.translationMetrics = await this.getTranslationMetrics(hotelId, language);
    }

    if (includeContentPerformance) {
      languageData.contentPerformance = await this.getContentPerformanceMetrics(hotelId, language);
    }

    // Calculate language performance score
    languageData.performanceScore = this.calculateLanguageScore(languageData);
    languageData.optimizationPotential = this.assessOptimizationPotential(languageData);

    return languageData;
  }

  // Get core performance metrics for language
  async getLanguagePerformanceMetrics(hotelId, language, timeRange) {
    try {
      // This would typically query booking data filtered by guest language preference
      // For now, returning simulated performance data based on language popularity
      
      const metrics = {
        totalRevenue: await this.calculateLanguageRevenue(hotelId, language, timeRange),
        bookingCount: await this.getLanguageBookingCount(hotelId, language, timeRange),
        guestCount: await this.getLanguageGuestCount(hotelId, language, timeRange),
        roomNights: await this.getLanguageRoomNights(hotelId, language, timeRange),
        averageDailyRate: 0,
        revenuePerGuest: 0,
        conversionRate: await this.getLanguageConversionRate(hotelId, language),
        repeatGuestRate: await this.getRepeatGuestRate(hotelId, language),
        cancellationRate: await this.getCancellationRate(hotelId, language),
        noShowRate: await this.getNoShowRate(hotelId, language),
        averageStayLength: 0,
        earlyBookingRate: await this.getEarlyBookingRate(hotelId, language),
        lastMinuteBookingRate: await this.getLastMinuteBookingRate(hotelId, language),
        averageLeadTime: await this.getAverageLeadTime(hotelId, language),
        seasonalVariation: await this.getSeasonalVariation(hotelId, language)
      };

      // Calculate derived metrics
      if (metrics.roomNights > 0) {
        metrics.averageDailyRate = metrics.totalRevenue / metrics.roomNights;
      }
      if (metrics.guestCount > 0) {
        metrics.revenuePerGuest = metrics.totalRevenue / metrics.guestCount;
        metrics.averageStayLength = metrics.roomNights / metrics.guestCount;
      }

      return metrics;

    } catch (error) {
      logger.error(`Error getting language performance metrics for ${language}:`, error);
      return this.getDefaultPerformanceMetrics();
    }
  }

  // Analyze booking behavior patterns by language
  async analyzeBookingBehavior(hotelId, language, timeRange) {
    return {
      preferredBookingChannels: await this.getPreferredChannels(hotelId, language),
      bookingTimePatterns: await this.getBookingTimePatterns(hotelId, language),
      devicePreferences: await this.getDevicePreferences(hotelId, language),
      paymentMethodPreferences: await this.getPaymentPreferences(hotelId, language),
      roomTypePreferences: await this.getRoomTypePreferences(hotelId, language),
      amenityPreferences: await this.getAmenityPreferences(hotelId, language),
      serviceUtilization: await this.getServiceUtilization(hotelId, language),
      groupBookingTendency: await this.getGroupBookingTendency(hotelId, language),
      advanceBookingBehavior: {
        averageLeadTime: await this.getAverageLeadTime(hotelId, language),
        earlyBirdRate: await this.getEarlyBookingRate(hotelId, language),
        lastMinuteRate: await this.getLastMinuteBookingRate(hotelId, language),
        spontaneousBookingRate: await this.getSpontaneousBookingRate(hotelId, language)
      },
      pricesensitivity: await this.analyzePriceSensitivity(hotelId, language),
      loyaltyEngagement: await this.analyzeLoyaltyEngagement(hotelId, language)
    };
  }

  // Analyze satisfaction metrics by language
  async analyzeSatisfactionMetrics(hotelId, language, timeRange) {
    return {
      overallSatisfaction: await this.getOverallSatisfaction(hotelId, language),
      categoryRatings: {
        serviceQuality: await this.getServiceRating(hotelId, language),
        roomQuality: await this.getRoomRating(hotelId, language),
        cleanliness: await this.getCleanlinessRating(hotelId, language),
        location: await this.getLocationRating(hotelId, language),
        valueForMoney: await this.getValueRating(hotelId, language),
        amenities: await this.getAmenityRating(hotelId, language),
        staff: await this.getStaffRating(hotelId, language)
      },
      reviewMetrics: {
        reviewFrequency: await this.getReviewFrequency(hotelId, language),
        averageReviewLength: await this.getAverageReviewLength(hotelId, language),
        positiveReviewRate: await this.getPositiveReviewRate(hotelId, language),
        responseRate: await this.getReviewResponseRate(hotelId, language),
        sentimentScore: await this.getSentimentScore(hotelId, language)
      },
      complaintAnalysis: {
        complaintRate: await this.getComplaintRate(hotelId, language),
        complaintCategories: await this.getComplaintCategories(hotelId, language),
        resolutionTime: await this.getResolutionTime(hotelId, language),
        resolutionSatisfaction: await this.getResolutionSatisfaction(hotelId, language)
      },
      nps: await this.getNetPromoterScore(hotelId, language),
      culturalSatisfactionFactors: await this.getCulturalSatisfactionFactors(language)
    };
  }

  // Analyze channel effectiveness by language
  async analyzeChannelEffectiveness(hotelId, language, timeRange) {
    const channels = ['direct', 'booking_com', 'expedia', 'agoda', 'airbnb', 'others'];
    const effectiveness = {};

    for (const channel of channels) {
      effectiveness[channel] = {
        revenue: await this.getChannelRevenue(hotelId, language, channel, timeRange),
        bookings: await this.getChannelBookings(hotelId, language, channel, timeRange),
        conversionRate: await this.getChannelConversion(hotelId, language, channel),
        averageRate: 0,
        marketShare: 0,
        customerSatisfaction: await this.getChannelSatisfaction(hotelId, language, channel),
        repeatBookingRate: await this.getChannelRepeatRate(hotelId, language, channel),
        cancellationRate: await this.getChannelCancellationRate(hotelId, language, channel),
        profitability: await this.calculateChannelProfitability(hotelId, language, channel),
        languageSupport: await this.assessLanguageSupport(channel, language),
        localizedContent: await this.assessContentLocalization(hotelId, channel, language)
      };

      // Calculate derived metrics
      if (effectiveness[channel].bookings > 0) {
        effectiveness[channel].averageRate = effectiveness[channel].revenue / effectiveness[channel].bookings;
      }
    }

    // Calculate market shares
    const totalRevenue = Object.values(effectiveness).reduce((sum, ch) => sum + ch.revenue, 0);
    if (totalRevenue > 0) {
      for (const channel of channels) {
        effectiveness[channel].marketShare = (effectiveness[channel].revenue / totalRevenue) * 100;
      }
    }

    return effectiveness;
  }

  // Analyze translation quality metrics
  async analyzeTranslationQuality(hotelId, languages) {
    const qualityMetrics = {};

    for (const language of languages) {
      if (language === 'en') continue; // Skip English (source language)

      qualityMetrics[language] = {
        overallQuality: await this.getTranslationQualityScore(hotelId, language),
        contentCategories: {
          roomDescriptions: await this.getCategoryQuality(hotelId, language, 'rooms'),
          amenityDescriptions: await this.getCategoryQuality(hotelId, language, 'amenities'),
          hotelDescriptions: await this.getCategoryQuality(hotelId, language, 'hotel'),
          policies: await this.getCategoryQuality(hotelId, language, 'policies'),
          services: await this.getCategoryQuality(hotelId, language, 'services')
        },
        automaticVsHuman: {
          automaticTranslationQuality: await this.getAutomaticQuality(hotelId, language),
          humanTranslationQuality: await this.getHumanQuality(hotelId, language),
          reviewedTranslationQuality: await this.getReviewedQuality(hotelId, language)
        },
        qualityImprovementTrends: await this.getQualityTrends(hotelId, language),
        guestFeedbackOnTranslation: await this.getTranslationFeedback(hotelId, language),
        businessImpact: {
          bookingImpactScore: await this.calculateBookingImpact(hotelId, language),
          satisfactionCorrelation: await this.getTranslationSatisfactionCorr(hotelId, language),
          conversionImpact: await this.getTranslationConversionImpact(hotelId, language)
        }
      };
    }

    return qualityMetrics;
  }

  // Perform cross-language comparative analysis
  async performComparativeAnalysis(languageData) {
    const analysis = {
      topPerformingLanguages: [],
      underperformingLanguages: [],
      revenueDistribution: {},
      conversionRateComparison: {},
      satisfactionComparison: {},
      channelPreferencePatterns: {},
      culturalInsights: {},
      optimizationOpportunities: []
    };

    // Sort languages by performance score
    const sortedLanguages = Object.entries(languageData).sort((a, b) => 
      (b[1].performanceScore || 0) - (a[1].performanceScore || 0)
    );

    analysis.topPerformingLanguages = sortedLanguages.slice(0, 5).map(([lang, data]) => ({
      language: lang,
      languageName: data.languageName,
      score: data.performanceScore,
      keyMetrics: {
        revenue: data.performance?.totalRevenue || 0,
        conversionRate: data.performance?.conversionRate || 0,
        satisfaction: data.satisfaction?.overallSatisfaction || 0
      }
    }));

    analysis.underperformingLanguages = sortedLanguages.slice(-3).map(([lang, data]) => ({
      language: lang,
      languageName: data.languageName,
      score: data.performanceScore,
      improvementAreas: this.identifyLanguageImprovementAreas(data)
    }));

    // Revenue distribution analysis
    const totalRevenue = Object.values(languageData).reduce((sum, data) => 
      sum + (data.performance?.totalRevenue || 0), 0);

    for (const [lang, data] of Object.entries(languageData)) {
      analysis.revenueDistribution[lang] = {
        percentage: totalRevenue > 0 ? ((data.performance?.totalRevenue || 0) / totalRevenue) * 100 : 0,
        amount: data.performance?.totalRevenue || 0
      };
    }

    // Conversion rate comparison
    for (const [lang, data] of Object.entries(languageData)) {
      analysis.conversionRateComparison[lang] = data.performance?.conversionRate || 0;
    }

    // Cultural insights
    analysis.culturalInsights = await this.generateCulturalInsights(languageData);

    return analysis;
  }

  // Generate language-specific recommendations
  async generateLanguageRecommendations(metrics) {
    const recommendations = [];

    for (const [language, data] of Object.entries(metrics.languages)) {
      // Translation quality recommendations
      if (data.translationMetrics?.overallQuality < 70) {
        recommendations.push({
          type: 'translation_improvement',
          language,
          priority: 'high',
          title: `Improve ${data.languageName} translation quality`,
          description: 'Low translation quality may be impacting bookings and satisfaction',
          currentScore: data.translationMetrics.overallQuality,
          targetScore: 85,
          estimatedImpact: 'conversion_increase_10_15_percent'
        });
      }

      // Content localization recommendations
      if (data.contentEngagement?.engagementRate < 30) {
        recommendations.push({
          type: 'content_localization',
          language,
          priority: 'medium',
          title: `Enhance ${data.languageName} content localization`,
          description: 'Improve cultural adaptation and local relevance',
          suggestedActions: ['review_cultural_elements', 'add_local_context', 'optimize_imagery']
        });
      }

      // Channel optimization recommendations
      if (data.channelPerformance) {
        const bestChannel = Object.entries(data.channelPerformance)
          .sort((a, b) => (b[1].conversionRate || 0) - (a[1].conversionRate || 0))[0];
        
        if (bestChannel && bestChannel[1].marketShare < 40) {
          recommendations.push({
            type: 'channel_optimization',
            language,
            priority: 'medium',
            title: `Optimize ${bestChannel[0]} for ${data.languageName}`,
            description: 'High-performing channel with expansion potential',
            currentShare: bestChannel[1].marketShare,
            potentialIncrease: '25-35%'
          });
        }
      }

      // Market penetration recommendations
      if (data.performanceScore > 70 && data.marketPenetration?.penetrationRate < 20) {
        recommendations.push({
          type: 'market_expansion',
          language,
          priority: 'high',
          title: `Expand in ${data.languageName} markets`,
          description: 'High performance with low market penetration indicates opportunity',
          recommendedActions: ['increase_marketing_budget', 'expand_channel_presence', 'localize_promotions']
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priority = { high: 3, medium: 2, low: 1 };
      return priority[b.priority] - priority[a.priority];
    });
  }

  // Calculate language performance score
  calculateLanguageScore(languageData) {
    let score = 0;
    let factors = 0;

    // Revenue contribution (25% weight)
    if (languageData.performance?.totalRevenue) {
      score += Math.min(25, languageData.performance.totalRevenue / 5000);
      factors += 25;
    }

    // Conversion rate (20% weight)
    if (languageData.performance?.conversionRate) {
      score += languageData.performance.conversionRate * 20;
      factors += 20;
    }

    // Guest satisfaction (20% weight)
    if (languageData.satisfaction?.overallSatisfaction) {
      score += (languageData.satisfaction.overallSatisfaction / 5) * 20;
      factors += 20;
    }

    // Translation quality (15% weight)
    if (languageData.translationMetrics?.overallQuality) {
      score += (languageData.translationMetrics.overallQuality / 100) * 15;
      factors += 15;
    }

    // Content engagement (10% weight)
    if (languageData.contentEngagement?.engagementRate) {
      score += (languageData.contentEngagement.engagementRate / 100) * 10;
      factors += 10;
    }

    // Cultural adaptation (10% weight)
    if (languageData.culturalAdaptation?.adaptationScore) {
      score += (languageData.culturalAdaptation.adaptationScore / 100) * 10;
      factors += 10;
    }

    return factors > 0 ? Math.round((score / factors) * 100) : 50;
  }

  // Helper methods for data simulation (would be replaced with real database queries)
  async calculateLanguageRevenue(hotelId, language, timeRange) {
    // Simulate revenue based on language popularity
    const languageWeights = {
      'en': 1.0, 'es': 0.7, 'fr': 0.6, 'de': 0.8, 'zh': 0.5,
      'ja': 0.4, 'pt': 0.3, 'it': 0.4, 'ru': 0.3, 'ar': 0.2
    };
    
    const baseRevenue = Math.random() * 30000 + 5000;
    const weight = languageWeights[language] || 0.1;
    return Math.round(baseRevenue * weight * 100) / 100;
  }

  getLanguageName(code) {
    const names = {
      'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
      'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'zh': 'Chinese',
      'ja': 'Japanese', 'ko': 'Korean', 'ar': 'Arabic', 'hi': 'Hindi'
    };
    return names[code] || code;
  }

  getNativeName(code) {
    const nativeNames = {
      'en': 'English', 'es': 'Español', 'fr': 'Français', 'de': 'Deutsch',
      'it': 'Italiano', 'pt': 'Português', 'ru': 'Русский', 'zh': '中文',
      'ja': '日本語', 'ko': '한국어', 'ar': 'العربية', 'hi': 'हिन्दी'
    };
    return nativeNames[code] || code;
  }

  // Cache management
  async getCachedMetrics(cacheKey) {
    try {
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          return cached.data;
        }
        this.cache.delete(cacheKey);
      }

      const redisClient = getRedisClient();
      if (redisClient && redisClient.isReady) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting cached metrics:', error);
      return null;
    }
  }

  async cacheMetrics(cacheKey, metrics) {
    try {
      this.cache.set(cacheKey, {
        data: metrics,
        timestamp: Date.now()
      });

      const redisClient = getRedisClient();
      if (redisClient && redisClient.isReady) {
        await redisClient.setex(cacheKey, 1200, JSON.stringify(metrics)); // 20 minutes
      }
    } catch (error) {
      logger.error('Error caching metrics:', error);
    }
  }

  // Default data generators
  getDefaultLanguageData(language) {
    return {
      languageCode: language,
      languageName: this.getLanguageName(language),
      error: 'Failed to load language data',
      performanceScore: 50,
      optimizationPotential: 'medium'
    };
  }

  getDefaultPerformanceMetrics() {
    return {
      totalRevenue: 0,
      bookingCount: 0,
      guestCount: 0,
      roomNights: 0,
      conversionRate: 0,
      repeatGuestRate: 0
    };
  }
}

export default new MultiLanguageMetricsService();