import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';

class AIPricingRecommendationService {
  constructor() {
    this.pricingModels = new Map();
    this.elasticityCache = new Map();
    this.competitorData = new Map();
    this.lastModelUpdate = new Date();
  }

  async generatePricingRecommendations(filters = {}) {
    try {
      const { hotelId, roomTypeId, dateRange, targetOccupancy } = filters;
      const startDate = new Date(dateRange?.startDate || new Date());
      const endDate = new Date(dateRange?.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

      // Get historical pricing and performance data
      const historicalData = await this.getHistoricalPricingData(hotelId, roomTypeId);
      const demandForecast = await this.generateDemandForecast(hotelId, roomTypeId, startDate, endDate);
      const competitorPricing = await this.getCompetitorPricing(hotelId, roomTypeId);
      const priceElasticity = await this.calculatePriceElasticity(hotelId, roomTypeId);

      // Generate AI-powered recommendations
      const recommendations = await this.generateAIRecommendations({
        historicalData,
        demandForecast,
        competitorPricing,
        priceElasticity,
        targetOccupancy: targetOccupancy || 75
      });

      // Calculate revenue impact
      const revenueImpact = await this.calculateRevenueImpact(recommendations, demandForecast);

      return {
        success: true,
        data: {
          recommendations,
          revenueImpact,
          demandForecast,
          priceElasticity,
          competitorAnalysis: competitorPricing,
          confidence: recommendations.confidence,
          validityPeriod: {
            startDate,
            endDate
          },
          lastUpdated: new Date(),
          aiModel: {
            version: '2.1',
            accuracy: recommendations.modelAccuracy || 0.82,
            dataPoints: historicalData.length
          }
        }
      };
    } catch (error) {
      console.error('Error in generatePricingRecommendations:', error);
      return {
        success: false,
        message: 'Failed to generate pricing recommendations',
        error: error.message
      };
    }
  }

  async getHistoricalPricingData(hotelId, roomTypeId) {
    try {
      const matchCriteria = {
        'rooms.rate': { $gt: 0 },
        status: { $in: ['confirmed', 'checked_in', 'checked_out', 'completed'] },
        checkInDate: { 
          $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
        }
      };

      if (hotelId) matchCriteria.hotelId = hotelId;
      if (roomTypeId) matchCriteria['rooms.roomType'] = roomTypeId;

      const historicalData = await Booking.aggregate([
        { $match: matchCriteria },
        { $unwind: '$rooms' },
        {
          $addFields: {
            bookingDate: '$createdAt',
            rate: '$rooms.rate',
            dayOfWeek: { $dayOfWeek: '$checkInDate' },
            month: { $month: '$checkInDate' },
            year: { $year: '$checkInDate' },
            isWeekend: { $in: [{ $dayOfWeek: '$checkInDate' }, [1, 7]] },
            leadTime: {
              $divide: [
                { $subtract: ['$checkInDate', '$createdAt'] },
                1000 * 60 * 60 * 24 // Convert to days
              ]
            },
            seasonCategory: {
              $switch: {
                branches: [
                  { case: { $in: [{ $month: '$checkInDate' }, [6, 7, 8]] }, then: 'summer' },
                  { case: { $in: [{ $month: '$checkInDate' }, [12, 1, 2]] }, then: 'winter' },
                  { case: { $in: [{ $month: '$checkInDate' }, [3, 4, 5]] }, then: 'spring' },
                  { case: { $in: [{ $month: '$checkInDate' }, [9, 10, 11]] }, then: 'fall' }
                ],
                default: 'unknown'
              }
            }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$checkInDate' } },
              dayOfWeek: '$dayOfWeek',
              month: '$month',
              year: '$year',
              season: '$seasonCategory'
            },
            avgRate: { $avg: '$rate' },
            minRate: { $min: '$rate' },
            maxRate: { $max: '$rate' },
            bookingCount: { $sum: 1 },
            avgLeadTime: { $avg: '$leadTime' },
            isWeekend: { $first: '$isWeekend' },
            totalRevenue: { $sum: '$rate' }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);

      return historicalData.map(item => ({
        date: item._id.date,
        avgRate: Math.round(item.avgRate * 100) / 100,
        minRate: item.minRate,
        maxRate: item.maxRate,
        bookingCount: item.bookingCount,
        avgLeadTime: Math.round(item.avgLeadTime * 10) / 10,
        isWeekend: item.isWeekend,
        season: item._id.season,
        month: item._id.month,
        dayOfWeek: item._id.dayOfWeek,
        totalRevenue: item.totalRevenue,
        occupancyProxy: Math.min(100, (item.bookingCount / 10) * 100) // Simplified occupancy calculation
      }));
    } catch (error) {
      console.error('Error getting historical pricing data:', error);
      return [];
    }
  }

  async generateDemandForecast(hotelId, roomTypeId, startDate, endDate) {
    try {
      // Use historical patterns to forecast demand
      const historicalPatterns = await this.getSeasonalDemandPatterns(hotelId, roomTypeId);
      const trendAnalysis = await this.calculateDemandTrends(hotelId, roomTypeId);
      
      const forecast = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const month = currentDate.getMonth() + 1;
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // Get historical pattern for this period
        const seasonalPattern = historicalPatterns.find(p => p.month === month) || 
                              { avgDemand: 50, volatility: 0.15 };
        
        // Apply trend and seasonal adjustments
        let predictedDemand = seasonalPattern.avgDemand;
        predictedDemand *= (1 + trendAnalysis.monthlyGrowthRate);
        
        // Weekend adjustment
        if (isWeekend) {
          predictedDemand *= 1.25; // 25% boost for weekends
        }
        
        // Add some realistic volatility
        const volatility = seasonalPattern.volatility * (Math.random() - 0.5);
        predictedDemand *= (1 + volatility);
        
        forecast.push({
          date: new Date(currentDate).toISOString().split('T')[0],
          predictedDemand: Math.round(Math.max(0, Math.min(100, predictedDemand))),
          confidence: 0.75 + Math.random() * 0.2, // Random confidence between 75-95%
          demandCategory: this.categorizeDemand(predictedDemand),
          factors: {
            seasonal: seasonalPattern.avgDemand,
            trend: trendAnalysis.monthlyGrowthRate,
            weekend: isWeekend,
            volatility: volatility
          }
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return forecast;
    } catch (error) {
      console.error('Error generating demand forecast:', error);
      return [];
    }
  }

  async getSeasonalDemandPatterns(hotelId, roomTypeId) {
    try {
      const matchCriteria = {
        status: { $in: ['confirmed', 'checked_in', 'checked_out', 'completed'] },
        checkInDate: { 
          $gte: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000) // Last 2 years
        }
      };

      if (hotelId) matchCriteria.hotelId = hotelId;
      if (roomTypeId) matchCriteria['rooms.roomType'] = roomTypeId;

      const seasonalPatterns = await Booking.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: { $month: '$checkInDate' },
            totalBookings: { $sum: 1 },
            avgRevenue: { $avg: '$totalAmount' },
            bookingDates: { $push: '$checkInDate' }
          }
        },
        {
          $addFields: {
            month: '$_id',
            avgDemand: { $multiply: ['$totalBookings', 3.33] }, // Convert to approximate percentage
            volatility: 0.15 // Placeholder for volatility calculation
          }
        },
        { $sort: { month: 1 } }
      ]);

      return seasonalPatterns;
    } catch (error) {
      console.error('Error getting seasonal patterns:', error);
      return [];
    }
  }

  async calculateDemandTrends(hotelId, roomTypeId) {
    try {
      const matchCriteria = {
        status: { $in: ['confirmed', 'checked_in', 'checked_out', 'completed'] },
        checkInDate: { 
          $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
        }
      };

      if (hotelId) matchCriteria.hotelId = hotelId;
      if (roomTypeId) matchCriteria['rooms.roomType'] = roomTypeId;

      const monthlyData = await Booking.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: {
              year: { $year: '$checkInDate' },
              month: { $month: '$checkInDate' }
            },
            bookingCount: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      if (monthlyData.length < 2) {
        return { monthlyGrowthRate: 0.02, confidence: 0.3 }; // Default 2% growth
      }

      // Calculate month-over-month growth rate
      const growthRates = [];
      for (let i = 1; i < monthlyData.length; i++) {
        const current = monthlyData[i].bookingCount;
        const previous = monthlyData[i - 1].bookingCount;
        if (previous > 0) {
          growthRates.push((current - previous) / previous);
        }
      }

      const avgGrowthRate = growthRates.length > 0 ? 
        growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 0;

      return {
        monthlyGrowthRate: avgGrowthRate,
        confidence: Math.min(0.9, 0.5 + (growthRates.length / 24)), // Higher confidence with more data
        trendDirection: avgGrowthRate > 0.01 ? 'increasing' : avgGrowthRate < -0.01 ? 'decreasing' : 'stable'
      };
    } catch (error) {
      console.error('Error calculating demand trends:', error);
      return { monthlyGrowthRate: 0, confidence: 0.3 };
    }
  }

  async getCompetitorPricing(hotelId, roomTypeId) {
    try {
      // In a real implementation, this would integrate with competitor intelligence APIs
      // For now, we'll simulate competitor data
      const competitorData = [
        {
          competitorId: 'comp_001',
          name: 'Competitor Hotel A',
          avgRate: 180 + Math.random() * 40,
          occupancyRate: 65 + Math.random() * 20,
          distance: '0.5km',
          starRating: 4,
          lastUpdated: new Date()
        },
        {
          competitorId: 'comp_002',
          name: 'Competitor Hotel B',
          avgRate: 160 + Math.random() * 60,
          occupancyRate: 70 + Math.random() * 25,
          distance: '0.8km',
          starRating: 4,
          lastUpdated: new Date()
        },
        {
          competitorId: 'comp_003',
          name: 'Competitor Hotel C',
          avgRate: 200 + Math.random() * 50,
          occupancyRate: 60 + Math.random() * 30,
          distance: '1.2km',
          starRating: 5,
          lastUpdated: new Date()
        }
      ];

      const marketAverage = competitorData.reduce((sum, comp) => sum + comp.avgRate, 0) / competitorData.length;
      const marketOccupancy = competitorData.reduce((sum, comp) => sum + comp.occupancyRate, 0) / competitorData.length;

      return {
        competitors: competitorData,
        marketBenchmarks: {
          averageRate: Math.round(marketAverage * 100) / 100,
          averageOccupancy: Math.round(marketOccupancy * 100) / 100,
          priceRange: {
            min: Math.min(...competitorData.map(c => c.avgRate)),
            max: Math.max(...competitorData.map(c => c.avgRate))
          }
        },
        positioningAnalysis: {
          pricePosition: 'competitive', // This would be calculated based on hotel's current rates
          recommendedRange: {
            min: marketAverage * 0.9,
            max: marketAverage * 1.15
          }
        }
      };
    } catch (error) {
      console.error('Error getting competitor pricing:', error);
      return {
        competitors: [],
        marketBenchmarks: { averageRate: 150, averageOccupancy: 70 },
        positioningAnalysis: { pricePosition: 'unknown' }
      };
    }
  }

  async calculatePriceElasticity(hotelId, roomTypeId) {
    try {
      const historicalData = await this.getHistoricalPricingData(hotelId, roomTypeId);
      
      if (historicalData.length < 10) {
        return {
          coefficient: -1.2, // Industry average
          interpretation: 'Insufficient data - using industry average',
          confidence: 0.3,
          priceResponse: 'moderate'
        };
      }

      // Calculate price elasticity using simplified regression
      const priceChanges = [];
      const demandChanges = [];

      for (let i = 1; i < historicalData.length; i++) {
        const currentPrice = historicalData[i].avgRate;
        const previousPrice = historicalData[i - 1].avgRate;
        const currentDemand = historicalData[i].occupancyProxy;
        const previousDemand = historicalData[i - 1].occupancyProxy;

        if (previousPrice > 0 && previousDemand > 0) {
          const priceChange = (currentPrice - previousPrice) / previousPrice;
          const demandChange = (currentDemand - previousDemand) / previousDemand;
          
          if (Math.abs(priceChange) > 0.01) { // Only consider significant price changes
            priceChanges.push(priceChange);
            demandChanges.push(demandChange);
          }
        }
      }

      if (priceChanges.length < 5) {
        return {
          coefficient: -1.2,
          interpretation: 'Insufficient price variation data',
          confidence: 0.4,
          priceResponse: 'moderate'
        };
      }

      // Calculate correlation coefficient (simplified elasticity)
      const avgPriceChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
      const avgDemandChange = demandChanges.reduce((a, b) => a + b, 0) / demandChanges.length;

      let numerator = 0;
      let denomPriceSum = 0;
      let denomDemandSum = 0;

      for (let i = 0; i < priceChanges.length; i++) {
        const priceDeviation = priceChanges[i] - avgPriceChange;
        const demandDeviation = demandChanges[i] - avgDemandChange;
        
        numerator += priceDeviation * demandDeviation;
        denomPriceSum += priceDeviation * priceDeviation;
        denomDemandSum += demandDeviation * demandDeviation;
      }

      const correlation = numerator / Math.sqrt(denomPriceSum * denomDemandSum);
      const elasticity = correlation * (avgDemandChange / avgPriceChange);

      const interpretElasticity = (elasticity) => {
        if (elasticity < -2) return { interpretation: 'Highly elastic - price sensitive', priceResponse: 'high' };
        if (elasticity < -1) return { interpretation: 'Elastic - moderately price sensitive', priceResponse: 'moderate' };
        if (elasticity < -0.5) return { interpretation: 'Moderately elastic', priceResponse: 'low' };
        return { interpretation: 'Inelastic - low price sensitivity', priceResponse: 'very_low' };
      };

      const elasticityInterpretation = interpretElasticity(elasticity);

      return {
        coefficient: Math.round(elasticity * 1000) / 1000,
        ...elasticityInterpretation,
        confidence: Math.min(0.9, 0.5 + (priceChanges.length / 50)),
        dataPoints: priceChanges.length,
        recommendation: elasticity < -1.5 ? 
          'Small price changes can significantly impact demand' :
          'Moderate price adjustments are feasible'
      };
    } catch (error) {
      console.error('Error calculating price elasticity:', error);
      return {
        coefficient: -1.2,
        interpretation: 'Error in calculation - using default',
        confidence: 0.3,
        priceResponse: 'moderate'
      };
    }
  }

  async generateAIRecommendations(data) {
    try {
      const { historicalData, demandForecast, competitorPricing, priceElasticity, targetOccupancy } = data;

      const recommendations = [];
      const currentMarketRate = competitorPricing.marketBenchmarks.averageRate;
      
      // Analyze demand forecast for pricing opportunities
      demandForecast.forEach(forecast => {
        let recommendedRate = currentMarketRate;
        let strategy = 'maintain';
        let confidence = forecast.confidence;
        
        // High demand periods - premium pricing
        if (forecast.predictedDemand >= 80) {
          recommendedRate = currentMarketRate * 1.15;
          strategy = 'premium_pricing';
          confidence *= 0.95;
        }
        // Low demand periods - promotional pricing
        else if (forecast.predictedDemand <= 40) {
          recommendedRate = currentMarketRate * 0.90;
          strategy = 'promotional_pricing';
          confidence *= 0.85;
        }
        // Medium demand - competitive pricing
        else if (forecast.predictedDemand >= 60) {
          recommendedRate = currentMarketRate * 1.05;
          strategy = 'competitive_pricing';
          confidence *= 0.90;
        }
        else {
          recommendedRate = currentMarketRate * 0.95;
          strategy = 'value_pricing';
          confidence *= 0.80;
        }

        // Apply elasticity adjustments
        if (priceElasticity.coefficient < -2) {
          // Highly elastic - be more conservative with price increases
          if (recommendedRate > currentMarketRate) {
            recommendedRate = currentMarketRate * 1.05; // Cap at 5% increase
          }
        } else if (priceElasticity.coefficient > -0.5) {
          // Inelastic - can be more aggressive with pricing
          if (forecast.predictedDemand >= 70) {
            recommendedRate *= 1.10; // Additional 10% bump
          }
        }

        // Weekend premium
        const date = new Date(forecast.date);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        if (isWeekend) {
          recommendedRate *= 1.08; // 8% weekend premium
          strategy += '_weekend';
        }

        recommendations.push({
          date: forecast.date,
          currentRate: currentMarketRate,
          recommendedRate: Math.round(recommendedRate * 100) / 100,
          strategy: strategy,
          confidence: Math.round(confidence * 1000) / 1000,
          predictedDemand: forecast.predictedDemand,
          demandCategory: forecast.demandCategory,
          priceChange: ((recommendedRate - currentMarketRate) / currentMarketRate * 100).toFixed(1),
          reasoning: this.generatePricingReasoning(strategy, forecast.predictedDemand, isWeekend),
          riskLevel: this.assessPricingRisk(recommendedRate, currentMarketRate, priceElasticity),
          expectedOccupancy: this.calculateExpectedOccupancy(recommendedRate, currentMarketRate, forecast.predictedDemand, priceElasticity)
        });
      });

      // Calculate overall recommendation confidence
      const overallConfidence = recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length;

      return {
        recommendations: recommendations,
        confidence: Math.round(overallConfidence * 1000) / 1000,
        modelAccuracy: 0.82 + Math.random() * 0.15, // Simulated model accuracy
        summary: this.generateRecommendationSummary(recommendations, priceElasticity),
        riskAssessment: this.generateRiskAssessment(recommendations, priceElasticity),
        strategicInsights: this.generateStrategicInsights(recommendations, demandForecast, competitorPricing)
      };
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
      return {
        recommendations: [],
        confidence: 0.3,
        error: error.message
      };
    }
  }

  generatePricingReasoning(strategy, demand, isWeekend) {
    const reasons = [];
    
    switch (strategy.replace('_weekend', '')) {
      case 'premium_pricing':
        reasons.push(`High predicted demand (${demand}%) justifies premium pricing`);
        break;
      case 'promotional_pricing':
        reasons.push(`Low predicted demand (${demand}%) requires promotional rates to drive bookings`);
        break;
      case 'competitive_pricing':
        reasons.push(`Strong demand (${demand}%) allows for competitive market positioning`);
        break;
      case 'value_pricing':
        reasons.push(`Moderate demand (${demand}%) suggests value-focused pricing strategy`);
        break;
    }
    
    if (isWeekend) {
      reasons.push('Weekend premium applied due to higher leisure demand');
    }
    
    return reasons.join('. ');
  }

  assessPricingRisk(recommendedRate, currentRate, elasticity) {
    const priceChangePercent = Math.abs((recommendedRate - currentRate) / currentRate);
    
    if (priceChangePercent > 0.2) return 'high';
    if (priceChangePercent > 0.1) return 'medium';
    if (Math.abs(elasticity.coefficient) > 2) return 'medium'; // Elastic demand = higher risk
    return 'low';
  }

  calculateExpectedOccupancy(recommendedRate, currentRate, baseDemand, elasticity) {
    const priceChange = (recommendedRate - currentRate) / currentRate;
    const demandImpact = elasticity.coefficient * priceChange;
    const adjustedDemand = baseDemand * (1 + demandImpact);
    
    return Math.round(Math.max(0, Math.min(100, adjustedDemand)));
  }

  generateRecommendationSummary(recommendations, elasticity) {
    const avgRateChange = recommendations.reduce((sum, r) => sum + parseFloat(r.priceChange), 0) / recommendations.length;
    const highDemandDays = recommendations.filter(r => r.predictedDemand >= 70).length;
    const lowDemandDays = recommendations.filter(r => r.predictedDemand <= 40).length;

    return {
      averageRateChange: `${avgRateChange.toFixed(1)}%`,
      highDemandDays: highDemandDays,
      lowDemandDays: lowDemandDays,
      priceElasticity: elasticity.interpretation,
      overallStrategy: avgRateChange > 5 ? 'Aggressive growth' : 
                      avgRateChange > 0 ? 'Moderate optimization' : 
                      'Market penetration',
      keyInsights: [
        `${highDemandDays} days identified for premium pricing opportunities`,
        `${lowDemandDays} days require promotional strategies`,
        `Market shows ${elasticity.priceResponse} price sensitivity`
      ]
    };
  }

  generateRiskAssessment(recommendations, elasticity) {
    const highRiskDays = recommendations.filter(r => r.riskLevel === 'high').length;
    const majorPriceChanges = recommendations.filter(r => Math.abs(parseFloat(r.priceChange)) > 15).length;

    return {
      overallRisk: highRiskDays > recommendations.length * 0.3 ? 'high' : 
                  highRiskDays > recommendations.length * 0.1 ? 'medium' : 'low',
      highRiskPeriods: highRiskDays,
      majorPriceChanges: majorPriceChanges,
      riskFactors: [
        elasticity.coefficient < -2 ? 'High price sensitivity detected' : null,
        majorPriceChanges > 5 ? 'Significant rate changes recommended' : null,
        'Market volatility may impact accuracy'
      ].filter(Boolean),
      mitigation: [
        'Monitor booking pace closely after rate changes',
        'Prepare backup promotional rates for high-risk periods',
        'Consider gradual price adjustments rather than sharp changes'
      ]
    };
  }

  generateStrategicInsights(recommendations, forecast, competitors) {
    const insights = [];
    
    // Market positioning insight
    const avgRecommendedRate = recommendations.reduce((sum, r) => sum + r.recommendedRate, 0) / recommendations.length;
    const marketRate = competitors.marketBenchmarks.averageRate;
    
    if (avgRecommendedRate > marketRate * 1.1) {
      insights.push('Recommendations position you as a premium option in the market');
    } else if (avgRecommendedRate < marketRate * 0.9) {
      insights.push('Recommendations focus on competitive value positioning');
    } else {
      insights.push('Recommendations maintain competitive market positioning');
    }

    // Demand pattern insights
    const peakDemandPeriods = recommendations.filter(r => r.predictedDemand >= 80).length;
    if (peakDemandPeriods > recommendations.length * 0.2) {
      insights.push(`Strong demand periods (${peakDemandPeriods} days) present significant revenue opportunities`);
    }

    // Revenue optimization insight
    const potentialRevenueLift = recommendations.reduce((sum, r) => {
      return sum + (parseFloat(r.priceChange) * r.expectedOccupancy / 100);
    }, 0) / recommendations.length;

    if (potentialRevenueLift > 5) {
      insights.push(`Implementing these recommendations could increase revenue by approximately ${potentialRevenueLift.toFixed(1)}%`);
    }

    return insights;
  }

  categorizeDemand(demand) {
    if (demand >= 80) return 'peak';
    if (demand >= 60) return 'high';
    if (demand >= 40) return 'medium';
    return 'low';
  }

  async calculateRevenueImpact(recommendations, forecast) {
    try {
      const baselineRevenue = recommendations.reduce((sum, rec) => {
        return sum + (rec.currentRate * (rec.predictedDemand / 100) * 30); // Assuming 30 rooms
      }, 0);

      const optimizedRevenue = recommendations.reduce((sum, rec) => {
        return sum + (rec.recommendedRate * (rec.expectedOccupancy / 100) * 30);
      }, 0);

      const revenueImpact = optimizedRevenue - baselineRevenue;
      const impactPercentage = (revenueImpact / baselineRevenue) * 100;

      return {
        baseline: Math.round(baselineRevenue),
        optimized: Math.round(optimizedRevenue),
        impact: Math.round(revenueImpact),
        impactPercentage: Math.round(impactPercentage * 100) / 100,
        averageDailyImpact: Math.round(revenueImpact / recommendations.length),
        riskAdjustedImpact: Math.round(revenueImpact * 0.85), // 15% risk adjustment
        projectionPeriod: `${recommendations.length} days`
      };
    } catch (error) {
      console.error('Error calculating revenue impact:', error);
      return {
        baseline: 0,
        optimized: 0,
        impact: 0,
        impactPercentage: 0,
        error: error.message
      };
    }
  }

  async exportPricingReport(filters = {}) {
    try {
      const recommendations = await this.generatePricingRecommendations(filters);
      
      if (!recommendations.success) {
        return recommendations;
      }

      const reportData = {
        ...recommendations.data,
        exportMetadata: {
          generatedAt: new Date().toISOString(),
          filters,
          reportType: 'ai_pricing_recommendations',
          version: '1.0'
        }
      };

      return {
        success: true,
        data: reportData,
        downloadUrl: `/api/v1/analytics/pricing/download/${Date.now()}` // Placeholder
      };
    } catch (error) {
      console.error('Error exporting pricing report:', error);
      return {
        success: false,
        message: 'Failed to export pricing report',
        error: error.message
      };
    }
  }
}

export default new AIPricingRecommendationService();