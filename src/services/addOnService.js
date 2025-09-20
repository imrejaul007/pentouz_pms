import AddOnService from '../models/AddOnService.js';
import ServiceInclusion from '../models/ServiceInclusion.js';
import { v4 as uuidv4 } from 'uuid';

class AddOnServiceManager {
  /**
   * Create a new add-on service
   */
  async createService(serviceData) {
    try {
      const service = new AddOnService({
        ...serviceData,
        serviceId: serviceData.serviceId || uuidv4()
      });
      
      await service.save();
      return service;
      
    } catch (error) {
      console.error('Error creating add-on service:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing add-on service
   */
  async updateService(serviceId, updateData) {
    try {
      const service = await AddOnService.findOneAndUpdate(
        { serviceId },
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!service) {
        throw new Error('Service not found');
      }
      
      return service;
      
    } catch (error) {
      console.error('Error updating add-on service:', error);
      throw error;
    }
  }
  
  /**
   * Get services by category with filtering and sorting
   */
  async getServicesByCategory(category, filters = {}, sort = {}) {
    try {
      const query = { category, isActive: true };
      
      // Apply filters
      if (filters.priceRange) {
        query['pricing.basePrice'] = {
          $gte: filters.priceRange.min || 0,
          $lte: filters.priceRange.max || Number.MAX_SAFE_INTEGER
        };
      }
      
      if (filters.rating) {
        query['analytics.averageRating'] = { $gte: filters.rating };
      }
      
      if (filters.availability === 'available') {
        query['availability.isAvailable'] = true;
      }
      
      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      }
      
      if (filters.location) {
        if (filters.location === 'onsite') {
          query['location.isOffsite'] = false;
        } else if (filters.location === 'offsite') {
          query['location.isOffsite'] = true;
        }
      }
      
      // Default sorting
      const sortOptions = {
        displayOrder: 1,
        isFeatured: -1,
        'analytics.popularityScore': -1,
        ...sort
      };
      
      const services = await AddOnService.find(query)
        .sort(sortOptions)
        .populate('upselling.complementaryServices', 'name pricing.basePrice category')
        .lean();
      
      return services;
      
    } catch (error) {
      console.error('Error getting services by category:', error);
      throw error;
    }
  }
  
  /**
   * Get upsell recommendations based on booking context
   */
  async getUpsellRecommendations(bookingContext, maxRecommendations = 5) {
    try {
      const { roomType, totalValue, nights, guestProfile, arrivalDate } = bookingContext;
      
      // Get all active upsell services
      const upsellServices = await AddOnService.find({
        isActive: true,
        'upselling.isUpsellItem': true
      }).lean();
      
      const recommendations = [];
      
      for (const service of upsellServices) {
        const serviceRecommendations = this.evaluateUpsellTriggers(service, bookingContext);
        recommendations.push(...serviceRecommendations);
      }
      
      // Sort by priority and popularity
      recommendations.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return b.service.analytics.popularityScore - a.service.analytics.popularityScore;
      });
      
      // Get complementary services for top recommendations
      const topRecommendations = recommendations.slice(0, maxRecommendations);
      
      for (const rec of topRecommendations) {
        if (rec.service.upselling.complementaryServices.length > 0) {
          const complementary = await AddOnService.find({
            _id: { $in: rec.service.upselling.complementaryServices },
            isActive: true
          }).select('name pricing.basePrice category').lean();
          
          rec.complementaryServices = complementary;
        }
        
        // Calculate bundle offers
        rec.bundles = this.calculateBundleOffers(rec.service, bookingContext);
      }
      
      return topRecommendations;
      
    } catch (error) {
      console.error('Error getting upsell recommendations:', error);
      throw error;
    }
  }
  
  /**
   * Evaluate upsell triggers for a service
   */
  evaluateUpsellTriggers(service, bookingContext) {
    const recommendations = [];
    const { roomType, totalValue, nights, guestProfile, arrivalDate } = bookingContext;
    
    for (const trigger of service.upselling.upsellTriggers) {
      let shouldRecommend = false;
      let confidence = 0;
      
      switch (trigger.condition) {
        case 'room_type':
          shouldRecommend = roomType === trigger.value;
          confidence = 90;
          break;
          
        case 'booking_value':
          const triggerValue = parseFloat(trigger.value);
          shouldRecommend = totalValue >= triggerValue;
          confidence = Math.min(90, 50 + ((totalValue - triggerValue) / triggerValue) * 40);
          break;
          
        case 'length_of_stay':
          const triggerNights = parseInt(trigger.value);
          shouldRecommend = nights >= triggerNights;
          confidence = Math.min(90, 60 + ((nights - triggerNights) / triggerNights) * 30);
          break;
          
        case 'guest_profile':
          shouldRecommend = guestProfile && guestProfile.type === trigger.value;
          confidence = 85;
          break;
          
        case 'season':
          if (arrivalDate) {
            const month = new Date(arrivalDate).getMonth() + 1;
            const seasonMonths = trigger.value.split(',').map(m => parseInt(m.trim()));
            shouldRecommend = seasonMonths.includes(month);
            confidence = 75;
          }
          break;
          
        case 'special_event':
          // This would integrate with the special periods from Phase 1
          shouldRecommend = this.checkSpecialEventPeriod(arrivalDate, trigger.value);
          confidence = 80;
          break;
      }
      
      if (shouldRecommend) {
        recommendations.push({
          service,
          trigger: trigger.condition,
          priority: trigger.priority,
          confidence,
          reason: `Recommended based on ${trigger.condition}`,
          pricing: service.calculatePrice(1, guestProfile)
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Calculate bundle offers for a service
   */
  calculateBundleOffers(service, bookingContext) {
    const bundles = [];
    
    for (const bundleOffer of service.upselling.bundleOffers) {
      if (bundleOffer.validUntil && new Date() > bundleOffer.validUntil) {
        continue;
      }
      
      const bundlePrice = this.calculateBundlePrice(bundleOffer, bookingContext);
      if (bundlePrice) {
        bundles.push({
          name: bundleOffer.name,
          serviceIds: bundleOffer.serviceIds,
          originalPrice: bundlePrice.originalPrice,
          bundlePrice: bundleOffer.bundlePrice,
          savings: bundlePrice.originalPrice - bundleOffer.bundlePrice,
          savingsPercentage: ((bundlePrice.originalPrice - bundleOffer.bundlePrice) / bundlePrice.originalPrice) * 100
        });
      }
    }
    
    return bundles;
  }
  
  /**
   * Calculate bundle pricing
   */
  async calculateBundlePrice(bundleOffer, bookingContext) {
    try {
      const services = await AddOnService.find({
        serviceId: { $in: bundleOffer.serviceIds },
        isActive: true
      }).lean();
      
      if (services.length !== bundleOffer.serviceIds.length) {
        return null;
      }
      
      let originalPrice = 0;
      for (const service of services) {
        const pricing = service.calculatePrice(1, bookingContext.guestProfile);
        originalPrice += pricing.totalPrice;
      }
      
      return {
        originalPrice,
        services: services.map(s => ({
          id: s.serviceId,
          name: s.name,
          price: s.pricing.basePrice
        }))
      };
      
    } catch (error) {
      console.error('Error calculating bundle price:', error);
      return null;
    }
  }
  
  /**
   * Check service availability for specific date and time
   */
  async checkServiceAvailability(serviceId, requestedDate, requestedTime = null, quantity = 1) {
    try {
      const service = await AddOnService.findOne({ serviceId, isActive: true });
      
      if (!service) {
        return { available: false, reason: 'Service not found or inactive' };
      }
      
      return service.checkAvailability(requestedDate, requestedTime, quantity);
      
    } catch (error) {
      console.error('Error checking service availability:', error);
      throw error;
    }
  }
  
  /**
   * Book an add-on service
   */
  async bookService(serviceId, bookingDetails) {
    try {
      const service = await AddOnService.findOne({ serviceId, isActive: true });
      
      if (!service) {
        throw new Error('Service not found or inactive');
      }
      
      // Check availability
      const availability = service.checkAvailability(
        bookingDetails.requestedDate,
        bookingDetails.requestedTime,
        bookingDetails.quantity
      );
      
      if (!availability.available) {
        throw new Error(availability.reason);
      }
      
      // Calculate pricing
      const pricing = service.calculatePrice(
        bookingDetails.quantity,
        bookingDetails.guestProfile,
        bookingDetails.currency
      );
      
      // Create booking record (this would integrate with the main booking system)
      const booking = {
        bookingId: uuidv4(),
        serviceId: service.serviceId,
        serviceName: service.name,
        guestId: bookingDetails.guestId,
        bookingDate: new Date(),
        serviceDate: bookingDetails.requestedDate,
        serviceTime: bookingDetails.requestedTime,
        quantity: bookingDetails.quantity,
        pricing,
        status: 'confirmed',
        specialRequests: bookingDetails.specialRequests || [],
        fulfillmentInstructions: service.fulfillment.instructions
      };
      
      // Update service analytics
      service.updateAnalytics({
        totalAmount: pricing.totalPrice,
        bookingDate: new Date()
      });
      
      await service.save();
      
      return {
        booking,
        confirmation: {
          confirmationNumber: booking.bookingId,
          serviceName: service.name,
          serviceDate: bookingDetails.requestedDate,
          serviceTime: bookingDetails.requestedTime,
          totalAmount: pricing.totalPrice,
          currency: bookingDetails.currency || 'USD',
          instructions: service.fulfillment.instructions,
          contactInfo: service.fulfillment.contactInfo || service.staff
        }
      };
      
    } catch (error) {
      console.error('Error booking service:', error);
      throw error;
    }
  }
  
  /**
   * Get service inclusions for a package
   */
  async getPackageInclusions(packageId, bookingContext = {}) {
    try {
      const inclusions = await ServiceInclusion.find({
        'eligibility.packageTypes': packageId,
        'availability.isActive': true
      }).lean();
      
      const eligibleInclusions = [];
      
      for (const inclusion of inclusions) {
        const eligibility = inclusion.checkEligibility(bookingContext);
        
        if (eligibility.eligible) {
          const quantity = inclusion.calculateQuantity(bookingContext);
          
          eligibleInclusions.push({
            ...inclusion,
            eligibleQuantity: quantity,
            displayValue: inclusion.value.showValue ? inclusion.value.basePrice : null,
            voucher: inclusion.fulfillment.deliveryMethod === 'voucher' ? 
              inclusion.generateVoucher(bookingContext.guestInfo) : null
          });
        }
      }
      
      // Sort by display priority
      eligibleInclusions.sort((a, b) => b.marketing.displayPriority - a.marketing.displayPriority);
      
      return eligibleInclusions;
      
    } catch (error) {
      console.error('Error getting package inclusions:', error);
      throw error;
    }
  }
  
  /**
   * Create service inclusion
   */
  async createInclusion(inclusionData) {
    try {
      const inclusion = new ServiceInclusion({
        ...inclusionData,
        inclusionId: inclusionData.inclusionId || uuidv4()
      });
      
      await inclusion.save();
      return inclusion;
      
    } catch (error) {
      console.error('Error creating service inclusion:', error);
      throw error;
    }
  }
  
  /**
   * Get service analytics
   */
  async getServiceAnalytics(serviceId, dateRange = {}) {
    try {
      const service = await AddOnService.findOne({ serviceId }).lean();
      
      if (!service) {
        throw new Error('Service not found');
      }
      
      // This would integrate with the booking system to get actual booking data
      const analytics = {
        service: {
          id: service.serviceId,
          name: service.name,
          category: service.category
        },
        performance: {
          totalBookings: service.analytics.totalBookings,
          totalRevenue: service.analytics.totalRevenue,
          averageRating: service.analytics.averageRating,
          reviewCount: service.analytics.reviewCount,
          popularityScore: service.analytics.popularityScore,
          averageDailyBookings: service.averageDailyBookings
        },
        trends: {
          // This would be calculated from actual booking data
          bookingTrend: 'increasing', // placeholder
          revenueTrend: 'stable',     // placeholder
          seasonalPatterns: []        // placeholder
        },
        recommendations: {
          // AI-powered recommendations would go here
          suggestedPriceAdjustment: null,
          marketingRecommendations: [],
          operationalImprovements: []
        }
      };
      
      return analytics;
      
    } catch (error) {
      console.error('Error getting service analytics:', error);
      throw error;
    }
  }
  
  /**
   * Get all service categories with counts
   */
  async getServiceCategories() {
    try {
      const categories = await AddOnService.aggregate([
        { $match: { isActive: true } },
        { 
          $group: { 
            _id: '$category',
            count: { $sum: 1 },
            avgPrice: { $avg: '$pricing.basePrice' },
            avgRating: { $avg: '$analytics.averageRating' },
            totalRevenue: { $sum: '$analytics.totalRevenue' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      return categories.map(cat => ({
        category: cat._id,
        serviceCount: cat.count,
        averagePrice: Math.round(cat.avgPrice * 100) / 100,
        averageRating: Math.round(cat.avgRating * 10) / 10,
        totalRevenue: cat.totalRevenue,
        displayName: this.getCategoryDisplayName(cat._id)
      }));
      
    } catch (error) {
      console.error('Error getting service categories:', error);
      throw error;
    }
  }
  
  /**
   * Search services with advanced filtering
   */
  async searchServices(searchTerm, filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 20 } = pagination;
      const skip = (page - 1) * limit;
      
      const query = {
        isActive: true,
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { tags: { $in: [new RegExp(searchTerm, 'i')] } }
        ]
      };
      
      // Apply filters
      if (filters.category) {
        query.category = filters.category;
      }
      
      if (filters.priceRange) {
        query['pricing.basePrice'] = {
          $gte: filters.priceRange.min || 0,
          $lte: filters.priceRange.max || Number.MAX_SAFE_INTEGER
        };
      }
      
      if (filters.rating) {
        query['analytics.averageRating'] = { $gte: filters.rating };
      }
      
      if (filters.availability) {
        query['availability.isAvailable'] = filters.availability === 'available';
      }
      
      const [services, totalCount] = await Promise.all([
        AddOnService.find(query)
          .sort({ 'analytics.popularityScore': -1, displayOrder: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AddOnService.countDocuments(query)
      ]);
      
      return {
        services,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalServices: totalCount,
          hasNext: skip + services.length < totalCount,
          hasPrev: page > 1
        }
      };
      
    } catch (error) {
      console.error('Error searching services:', error);
      throw error;
    }
  }
  
  /**
   * Helper methods
   */
  getCategoryDisplayName(category) {
    const displayNames = {
      dining: 'Dining & Restaurants',
      spa: 'Spa & Wellness',
      fitness: 'Fitness & Recreation',
      transportation: 'Transportation',
      entertainment: 'Entertainment',
      business: 'Business Services',
      laundry: 'Laundry & Dry Cleaning',
      childcare: 'Childcare & Kids Services',
      pet_services: 'Pet Services',
      concierge: 'Concierge Services',
      tours: 'Tours & Excursions',
      shopping: 'Shopping & Retail',
      medical: 'Medical & Health',
      technology: 'Technology Services',
      other: 'Other Services'
    };
    
    return displayNames[category] || category.replace('_', ' ').toUpperCase();
  }
  
  checkSpecialEventPeriod(date, eventType) {
    // This would integrate with the SpecialPeriod model from Phase 1
    // For now, return false as placeholder
    return false;
  }
}

export default new AddOnServiceManager();