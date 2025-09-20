import RoomFeature from '../models/RoomFeature.js';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import mongoose from 'mongoose';

class RoomFeatureService {
  /**
   * Get features organized by category with filtering
   */
  async getFeaturesByCategories(hotelId, options = {}) {
    const { 
      categories = [], 
      featureTypes = [], 
      isPremium = null,
      isBookable = null,
      includeInactive = false 
    } = options;

    const query = { hotelId };
    
    if (categories.length > 0) {
      query.category = { $in: categories };
    }
    
    if (featureTypes.length > 0) {
      query.featureType = { $in: featureTypes };
    }
    
    if (isPremium !== null) {
      query['pricing.isPremium'] = isPremium;
    }
    
    if (isBookable !== null) {
      query['bookingSettings.isBookable'] = isBookable;
    }
    
    if (!includeInactive) {
      query.status = 'active';
    }

    const features = await RoomFeature.find(query)
      .populate('parentFeatureId', 'featureName featureCode')
      .sort({ category: 1, 'displaySettings.displayOrder': 1, featureName: 1 });

    // Group by category
    const categorizedFeatures = {};
    features.forEach(feature => {
      if (!categorizedFeatures[feature.category]) {
        categorizedFeatures[feature.category] = [];
      }
      categorizedFeatures[feature.category].push(feature);
    });

    return categorizedFeatures;
  }

  /**
   * Build hierarchical feature tree
   */
  async getFeatureHierarchy(hotelId) {
    const features = await RoomFeature.find({
      hotelId,
      status: 'active'
    }).sort({ 'displaySettings.displayOrder': 1, featureName: 1 });

    // Build hierarchy
    const featureMap = new Map();
    const rootFeatures = [];

    features.forEach(feature => {
      featureMap.set(feature._id.toString(), {
        ...feature.toObject(),
        children: []
      });
    });

    featureMap.forEach(feature => {
      if (feature.parentFeatureId) {
        const parent = featureMap.get(feature.parentFeatureId.toString());
        if (parent) {
          parent.children.push(feature);
        }
      } else {
        rootFeatures.push(feature);
      }
    });

    return rootFeatures;
  }

  /**
   * Search features with advanced filters
   */
  async searchFeatures(hotelId, searchCriteria = {}) {
    const {
      searchTerm = '',
      categories = [],
      priceRange = {},
      roomTypes = [],
      tags = [],
      hasImages = null,
      sortBy = 'relevance'
    } = searchCriteria;

    const query = { hotelId, status: 'active' };

    // Text search
    if (searchTerm) {
      query.$or = [
        { featureName: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { 'marketing.searchKeywords': { $in: [new RegExp(searchTerm, 'i')] } },
        { tags: { $in: [new RegExp(searchTerm, 'i')] } }
      ];
    }

    // Category filter
    if (categories.length > 0) {
      query.category = { $in: categories };
    }

    // Price range filter
    if (priceRange.min !== undefined || priceRange.max !== undefined) {
      query['pricing.additionalCharge'] = {};
      if (priceRange.min !== undefined) {
        query['pricing.additionalCharge'].$gte = priceRange.min;
      }
      if (priceRange.max !== undefined) {
        query['pricing.additionalCharge'].$lte = priceRange.max;
      }
    }

    // Room type filter
    if (roomTypes.length > 0) {
      query['assignedRoomTypes.roomTypeId'] = { $in: roomTypes };
    }

    // Tags filter
    if (tags.length > 0) {
      query.tags = { $in: tags };
    }

    // Image filter
    if (hasImages !== null) {
      if (hasImages) {
        query['displaySettings.images'] = { $exists: true, $ne: [] };
      } else {
        query.$or = [
          { 'displaySettings.images': { $exists: false } },
          { 'displaySettings.images': { $size: 0 } }
        ];
      }
    }

    // Determine sort order
    let sortOptions = {};
    switch (sortBy) {
      case 'name':
        sortOptions = { featureName: 1 };
        break;
      case 'price_asc':
        sortOptions = { 'pricing.additionalCharge': 1 };
        break;
      case 'price_desc':
        sortOptions = { 'pricing.additionalCharge': -1 };
        break;
      case 'popularity':
        sortOptions = { 'statistics.totalBookingsWithFeature': -1 };
        break;
      case 'rating':
        sortOptions = { 'statistics.averageRating': -1 };
        break;
      case 'relevance':
      default:
        sortOptions = { 'displaySettings.displayOrder': 1, featureName: 1 };
    }

    const features = await RoomFeature.find(query)
      .populate('parentFeatureId', 'featureName')
      .populate('assignedRoomTypes.roomTypeId', 'typeName')
      .sort(sortOptions);

    return features;
  }

  /**
   * Get features for a specific room
   */
  async getRoomFeatures(roomId) {
    const features = await RoomFeature.find({
      'assignedRooms.roomId': roomId,
      'assignedRooms.isActive': true,
      status: 'active'
    }).sort({ category: 1, 'displaySettings.displayOrder': 1 });

    return features;
  }

  /**
   * Get features for a room type
   */
  async getRoomTypeFeatures(roomTypeId, includeOptional = true) {
    const query = {
      'assignedRoomTypes.roomTypeId': roomTypeId,
      status: 'active'
    };

    if (!includeOptional) {
      query['assignedRoomTypes.isOptional'] = false;
    }

    const features = await RoomFeature.find(query)
      .sort({ 
        'assignedRoomTypes.isStandard': -1, 
        category: 1, 
        'displaySettings.displayOrder': 1 
      });

    return features;
  }

  /**
   * Bulk assign features to rooms
   */
  async bulkAssignFeaturesToRooms(featureIds, roomIds) {
    const results = {
      successful: [],
      failed: [],
      totalProcessed: 0
    };

    for (const featureId of featureIds) {
      const feature = await RoomFeature.findById(featureId);
      if (!feature) {
        results.failed.push({
          featureId,
          error: 'Feature not found'
        });
        continue;
      }

      for (const roomId of roomIds) {
        try {
          await feature.assignToRoom(roomId);
          results.successful.push({ featureId, roomId });
        } catch (error) {
          results.failed.push({
            featureId,
            roomId,
            error: error.message
          });
        }
      }
    }

    results.totalProcessed = results.successful.length + results.failed.length;
    return results;
  }

  /**
   * Calculate total additional charges for features
   */
  async calculateFeatureCharges(featureIds, nights = 1, guestCount = 1) {
    const features = await RoomFeature.find({
      _id: { $in: featureIds },
      status: 'active'
    });

    let totalCharge = 0;
    const breakdown = [];

    for (const feature of features) {
      const charge = feature.calculatePricing(nights);
      if (charge > 0) {
        totalCharge += charge;
        breakdown.push({
          featureId: feature._id,
          featureName: feature.featureName,
          charge,
          chargeType: feature.pricing.chargeType
        });
      }
    }

    return {
      totalCharge,
      breakdown,
      nights,
      guestCount
    };
  }

  /**
   * Get feature availability for date range
   */
  async checkFeatureAvailability(featureId, startDate, endDate) {
    const feature = await RoomFeature.findById(featureId);
    
    if (!feature) {
      throw new Error('Feature not found');
    }

    if (!feature.isCurrentlyAvailable) {
      return {
        available: false,
        reason: 'Feature is not currently available'
      };
    }

    // Check minimum stay requirement
    const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    if (feature.availability.minimumStayRequired > nights) {
      return {
        available: false,
        reason: `Minimum stay of ${feature.availability.minimumStayRequired} nights required`
      };
    }

    // Check advance booking requirement
    const daysInAdvance = Math.ceil((startDate - new Date()) / (1000 * 60 * 60 * 24));
    if (feature.bookingSettings.advanceBookingDays > 0 && 
        daysInAdvance < feature.bookingSettings.advanceBookingDays) {
      return {
        available: false,
        reason: `Must be booked at least ${feature.bookingSettings.advanceBookingDays} days in advance`
      };
    }

    return {
      available: true,
      feature: feature.toObject(),
      pricing: feature.calculatePricing(nights)
    };
  }

  /**
   * Get premium features with revenue data
   */
  async getPremiumFeaturesWithRevenue(hotelId, dateRange = {}) {
    const query = {
      hotelId,
      'pricing.isPremium': true,
      status: 'active'
    };

    if (dateRange.startDate && dateRange.endDate) {
      query['statistics.lastUsedDate'] = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate)
      };
    }

    const features = await RoomFeature.find(query)
      .sort({ 'statistics.revenueGenerated': -1 })
      .limit(20);

    // Calculate ROI for each feature
    const featuresWithROI = features.map(feature => {
      const roi = feature.statistics.totalBookingsWithFeature > 0
        ? (feature.statistics.revenueGenerated / feature.statistics.totalBookingsWithFeature)
        : 0;

      return {
        ...feature.toObject(),
        calculatedROI: roi,
        performanceScore: (feature.statistics.averageRating * 20) + 
                         (feature.statistics.conversionRate / 2)
      };
    });

    return featuresWithROI;
  }

  /**
   * Generate feature recommendations for a room type
   */
  async generateFeatureRecommendations(roomTypeId) {
    const roomType = await RoomType.findById(roomTypeId);
    if (!roomType) {
      throw new Error('Room type not found');
    }

    // Get current features for this room type
    const currentFeatures = await this.getRoomTypeFeatures(roomTypeId);
    const currentFeatureIds = currentFeatures.map(f => f._id.toString());

    // Get all available features for the hotel
    const allFeatures = await RoomFeature.find({
      hotelId: roomType.hotelId,
      status: 'active',
      _id: { $nin: currentFeatureIds }
    });

    // Score features based on various factors
    const recommendations = [];
    
    for (const feature of allFeatures) {
      let score = 0;
      
      // Popularity score
      score += feature.statistics.totalBookingsWithFeature * 0.3;
      
      // Rating score
      score += feature.statistics.averageRating * 20;
      
      // Revenue score
      if (feature.statistics.revenueGenerated > 0) {
        score += Math.log10(feature.statistics.revenueGenerated) * 10;
      }
      
      // Conversion rate score
      score += feature.statistics.conversionRate;
      
      // Category diversity bonus
      const hasCategory = currentFeatures.some(f => f.category === feature.category);
      if (!hasCategory) {
        score += 25; // Bonus for adding diversity
      }
      
      recommendations.push({
        feature: feature.toObject(),
        recommendationScore: score,
        reasons: this.generateRecommendationReasons(feature, currentFeatures)
      });
    }

    // Sort by recommendation score and return top 10
    recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);
    return recommendations.slice(0, 10);
  }

  /**
   * Generate recommendation reasons
   */
  generateRecommendationReasons(feature, currentFeatures) {
    const reasons = [];
    
    if (feature.statistics.averageRating >= 4.5) {
      reasons.push('Highly rated by guests');
    }
    
    if (feature.statistics.conversionRate > 50) {
      reasons.push('High conversion rate');
    }
    
    if (feature.pricing.isPremium) {
      reasons.push('Premium feature with revenue potential');
    }
    
    const hasCategory = currentFeatures.some(f => f.category === feature.category);
    if (!hasCategory) {
      reasons.push(`Adds ${feature.category} category diversity`);
    }
    
    if (feature.statistics.totalBookingsWithFeature > 100) {
      reasons.push('Popular with guests');
    }
    
    return reasons;
  }

  /**
   * Update feature statistics for all features
   */
  async updateAllFeatureStatistics(hotelId) {
    const features = await RoomFeature.find({ hotelId });
    const results = [];
    
    for (const feature of features) {
      try {
        await feature.updateStatistics();
        results.push({
          featureId: feature._id,
          success: true,
          stats: feature.statistics
        });
      } catch (error) {
        results.push({
          featureId: feature._id,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Clone features from one room type to another
   */
  async cloneRoomTypeFeatures(sourceRoomTypeId, targetRoomTypeId, options = {}) {
    const { 
      includeOptional = true, 
      includePremium = true,
      overwriteExisting = false 
    } = options;

    // Get source features
    let sourceFeatures = await this.getRoomTypeFeatures(sourceRoomTypeId, includeOptional);
    
    if (!includePremium) {
      sourceFeatures = sourceFeatures.filter(f => !f.pricing.isPremium);
    }

    // Get existing target features
    const targetFeatures = await this.getRoomTypeFeatures(targetRoomTypeId);
    const targetFeatureIds = targetFeatures.map(f => f._id.toString());

    const results = {
      added: [],
      skipped: [],
      updated: []
    };

    for (const sourceFeature of sourceFeatures) {
      const isExisting = targetFeatureIds.includes(sourceFeature._id.toString());
      
      if (isExisting && !overwriteExisting) {
        results.skipped.push(sourceFeature.featureName);
        continue;
      }

      try {
        const sourceAssignment = sourceFeature.assignedRoomTypes.find(
          a => a.roomTypeId.toString() === sourceRoomTypeId.toString()
        );

        await sourceFeature.assignToRoomType(
          targetRoomTypeId,
          sourceAssignment?.isStandard || false,
          sourceAssignment?.isOptional || false
        );

        if (isExisting) {
          results.updated.push(sourceFeature.featureName);
        } else {
          results.added.push(sourceFeature.featureName);
        }
      } catch (error) {
        console.error(`Error cloning feature ${sourceFeature.featureName}:`, error);
      }
    }

    return results;
  }

  /**
   * Get feature analytics
   */
  async getFeatureAnalytics(hotelId, options = {}) {
    const { startDate, endDate, groupBy = 'category' } = options;

    const matchStage = { hotelId: mongoose.Types.ObjectId(hotelId) };
    
    if (startDate && endDate) {
      matchStage['statistics.lastUsedDate'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const analytics = await RoomFeature.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: `$${groupBy}`,
          totalFeatures: { $sum: 1 },
          activeFeatures: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          premiumFeatures: {
            $sum: { $cond: ['$pricing.isPremium', 1, 0] }
          },
          totalRevenue: { $sum: '$statistics.revenueGenerated' },
          totalBookings: { $sum: '$statistics.totalBookingsWithFeature' },
          averageRating: { $avg: '$statistics.averageRating' },
          averageConversionRate: { $avg: '$statistics.conversionRate' },
          totalRoomsAssigned: { $sum: '$statistics.totalRoomsAssigned' }
        }
      },
      {
        $project: {
          group: '$_id',
          totalFeatures: 1,
          activeFeatures: 1,
          premiumFeatures: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalBookings: 1,
          averageRating: { $round: ['$averageRating', 2] },
          averageConversionRate: { $round: ['$averageConversionRate', 2] },
          totalRoomsAssigned: 1,
          revenuePerBooking: {
            $round: [
              { $divide: ['$totalRevenue', { $max: ['$totalBookings', 1] }] },
              2
            ]
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    return analytics;
  }
}

export default new RoomFeatureService();