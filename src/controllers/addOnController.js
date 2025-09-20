import addOnService from '../services/addOnService.js';
import AddOnService from '../models/AddOnService.js';
import ServiceInclusion from '../models/ServiceInclusion.js';

class AddOnController {
  /**
   * Create a new add-on service
   */
  async createService(req, res) {
    try {
      const serviceData = {
        ...req.body,
        createdBy: req.user?.id
      };
      
      const service = await addOnService.createService(serviceData);
      
      res.status(201).json({
        success: true,
        data: service,
        message: 'Add-on service created successfully'
      });
      
    } catch (error) {
      console.error('Error creating add-on service:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get all services with filtering and pagination
   */
  async getServices(req, res) {
    try {
      const { 
        category, 
        search,
        minPrice,
        maxPrice,
        rating,
        availability,
        tags,
        location,
        page = 1,
        limit = 20,
        sortBy = 'popularity'
      } = req.query;
      
      const filters = {};
      
      if (minPrice || maxPrice) {
        filters.priceRange = {
          min: minPrice ? parseFloat(minPrice) : 0,
          max: maxPrice ? parseFloat(maxPrice) : undefined
        };
      }
      
      if (rating) filters.rating = parseFloat(rating);
      if (availability) filters.availability = availability;
      if (location) filters.location = location;
      if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];
      
      let result;
      
      if (search) {
        result = await addOnService.searchServices(search, filters, { page: parseInt(page), limit: parseInt(limit) });
      } else if (category) {
        const sortOptions = this.getSortOptions(sortBy);
        const services = await addOnService.getServicesByCategory(category, filters, sortOptions);
        result = { services };
      } else {
        // Get all services
        const query = { isActive: true };
        if (filters.priceRange) {
          query['pricing.basePrice'] = {
            $gte: filters.priceRange.min || 0,
            $lte: filters.priceRange.max || Number.MAX_SAFE_INTEGER
          };
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOptions = this.getSortOptions(sortBy);
        
        const [services, totalCount] = await Promise.all([
          AddOnService.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('upselling.complementaryServices', 'name pricing.basePrice category')
            .lean(),
          AddOnService.countDocuments(query)
        ]);
        
        result = {
          services,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalServices: totalCount
          }
        };
      }
      
      res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('Error getting services:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get service by ID
   */
  async getServiceById(req, res) {
    try {
      const { id } = req.params;
      
      const service = await AddOnService.findById(id)
        .populate('upselling.complementaryServices', 'name pricing.basePrice category')
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName');
      
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
      
      res.json({
        success: true,
        data: service
      });
      
    } catch (error) {
      console.error('Error getting service:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Update service
   */
  async updateService(req, res) {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        updatedBy: req.user?.id
      };
      
      const service = await AddOnService.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
      
      res.json({
        success: true,
        data: service,
        message: 'Service updated successfully'
      });
      
    } catch (error) {
      console.error('Error updating service:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Delete service (soft delete)
   */
  async deleteService(req, res) {
    try {
      const { id } = req.params;
      
      const service = await AddOnService.findByIdAndUpdate(
        id,
        { isActive: false, updatedBy: req.user?.id },
        { new: true }
      );
      
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Service deactivated successfully'
      });
      
    } catch (error) {
      console.error('Error deleting service:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get service categories
   */
  async getCategories(req, res) {
    try {
      const categories = await addOnService.getServiceCategories();
      
      res.json({
        success: true,
        data: categories
      });
      
    } catch (error) {
      console.error('Error getting categories:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get upsell recommendations
   */
  async getUpsellRecommendations(req, res) {
    try {
      const {
        roomType,
        totalValue,
        nights,
        guestProfile,
        arrivalDate,
        maxRecommendations = 5
      } = req.query;
      
      const bookingContext = {
        roomType,
        totalValue: totalValue ? parseFloat(totalValue) : 0,
        nights: nights ? parseInt(nights) : 1,
        guestProfile: guestProfile ? JSON.parse(guestProfile) : null,
        arrivalDate
      };
      
      const recommendations = await addOnService.getUpsellRecommendations(
        bookingContext,
        parseInt(maxRecommendations)
      );
      
      res.json({
        success: true,
        data: recommendations
      });
      
    } catch (error) {
      console.error('Error getting upsell recommendations:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Check service availability
   */
  async checkAvailability(req, res) {
    try {
      const { serviceId } = req.params;
      const { date, time, quantity = 1 } = req.query;
      
      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Date is required'
        });
      }
      
      const availability = await addOnService.checkServiceAvailability(
        serviceId,
        date,
        time,
        parseInt(quantity)
      );
      
      res.json({
        success: true,
        data: availability
      });
      
    } catch (error) {
      console.error('Error checking availability:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Book a service
   */
  async bookService(req, res) {
    try {
      const { serviceId } = req.params;
      const bookingDetails = {
        ...req.body,
        guestId: req.user?.id
      };
      
      const booking = await addOnService.bookService(serviceId, bookingDetails);
      
      res.status(201).json({
        success: true,
        data: booking,
        message: 'Service booked successfully'
      });
      
    } catch (error) {
      console.error('Error booking service:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get service pricing
   */
  async getServicePricing(req, res) {
    try {
      const { serviceId } = req.params;
      const { quantity = 1, currency = 'USD', guestProfile } = req.query;
      
      const service = await AddOnService.findOne({ serviceId, isActive: true });
      
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
      
      const profile = guestProfile ? JSON.parse(guestProfile) : null;
      const pricing = service.calculatePrice(parseInt(quantity), profile, currency);
      
      res.json({
        success: true,
        data: {
          serviceId,
          serviceName: service.name,
          quantity: parseInt(quantity),
          currency,
          pricing,
          priceBreakdown: {
            basePrice: service.pricing.basePrice,
            discounts: pricing.totalPrice < (service.pricing.basePrice * parseInt(quantity)) ? 
              (service.pricing.basePrice * parseInt(quantity)) - pricing.totalPrice : 0
          }
        }
      });
      
    } catch (error) {
      console.error('Error getting service pricing:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get service analytics
   */
  async getServiceAnalytics(req, res) {
    try {
      const { serviceId } = req.params;
      const { startDate, endDate } = req.query;
      
      const dateRange = {};
      if (startDate) dateRange.startDate = new Date(startDate);
      if (endDate) dateRange.endDate = new Date(endDate);
      
      const analytics = await addOnService.getServiceAnalytics(serviceId, dateRange);
      
      res.json({
        success: true,
        data: analytics
      });
      
    } catch (error) {
      console.error('Error getting service analytics:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Service Inclusions Management
   */
  
  /**
   * Create service inclusion
   */
  async createInclusion(req, res) {
    try {
      const inclusionData = {
        ...req.body,
        createdBy: req.user?.id
      };
      
      const inclusion = await addOnService.createInclusion(inclusionData);
      
      res.status(201).json({
        success: true,
        data: inclusion,
        message: 'Service inclusion created successfully'
      });
      
    } catch (error) {
      console.error('Error creating service inclusion:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get service inclusions
   */
  async getInclusions(req, res) {
    try {
      const { type, category, packageId, isActive } = req.query;
      
      const filter = {};
      if (type) filter.type = type;
      if (category) filter.category = category;
      if (packageId) filter['eligibility.packageTypes'] = packageId;
      if (isActive !== undefined) filter['availability.isActive'] = isActive === 'true';
      
      const inclusions = await ServiceInclusion.find(filter)
        .populate('bundling.requiredWithServices', 'name category')
        .populate('bundling.compatibleServices.serviceId', 'name category')
        .sort({ 'marketing.displayPriority': -1, createdAt: -1 });
      
      res.json({
        success: true,
        data: inclusions
      });
      
    } catch (error) {
      console.error('Error getting service inclusions:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get package inclusions
   */
  async getPackageInclusions(req, res) {
    try {
      const { packageId } = req.params;
      const bookingContext = req.query;
      
      // Parse guest info if provided
      if (bookingContext.guestInfo) {
        bookingContext.guestInfo = JSON.parse(bookingContext.guestInfo);
      }
      
      // Parse guest ages if provided
      if (bookingContext.guestAges) {
        bookingContext.guestAges = JSON.parse(bookingContext.guestAges);
      }
      
      const inclusions = await addOnService.getPackageInclusions(packageId, bookingContext);
      
      res.json({
        success: true,
        data: inclusions
      });
      
    } catch (error) {
      console.error('Error getting package inclusions:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Update service inclusion
   */
  async updateInclusion(req, res) {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        updatedBy: req.user?.id
      };
      
      const inclusion = await ServiceInclusion.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!inclusion) {
        return res.status(404).json({
          success: false,
          message: 'Service inclusion not found'
        });
      }
      
      res.json({
        success: true,
        data: inclusion,
        message: 'Service inclusion updated successfully'
      });
      
    } catch (error) {
      console.error('Error updating service inclusion:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Process inclusion redemption
   */
  async processRedemption(req, res) {
    try {
      const { id } = req.params;
      const redemptionContext = req.body;
      
      const inclusion = await ServiceInclusion.findById(id);
      
      if (!inclusion) {
        return res.status(404).json({
          success: false,
          message: 'Service inclusion not found'
        });
      }
      
      const redemption = inclusion.processRedemption(redemptionContext);
      await inclusion.save();
      
      res.json({
        success: true,
        data: redemption,
        message: redemption.success ? 'Redemption processed successfully' : 'Redemption failed'
      });
      
    } catch (error) {
      console.error('Error processing redemption:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Bulk operations
   */
  
  /**
   * Bulk create services
   */
  async bulkCreateServices(req, res) {
    try {
      const { services } = req.body;
      
      if (!services || !Array.isArray(services)) {
        return res.status(400).json({
          success: false,
          message: 'Services array is required'
        });
      }
      
      const results = [];
      
      for (const serviceData of services) {
        try {
          const service = await addOnService.createService({
            ...serviceData,
            createdBy: req.user?.id
          });
          results.push({ success: true, data: service });
        } catch (error) {
          results.push({ success: false, error: error.message, data: serviceData });
        }
      }
      
      res.json({
        success: true,
        data: results,
        message: `Processed ${services.length} services`
      });
      
    } catch (error) {
      console.error('Error bulk creating services:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get featured services
   */
  async getFeaturedServices(req, res) {
    try {
      const { limit = 10 } = req.query;
      
      const services = await AddOnService.find({
        isActive: true,
        isFeatured: true
      })
      .sort({ displayOrder: 1, 'analytics.popularityScore': -1 })
      .limit(parseInt(limit))
      .lean();
      
      res.json({
        success: true,
        data: services
      });
      
    } catch (error) {
      console.error('Error getting featured services:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Helper methods
   */
  getSortOptions(sortBy) {
    const sortOptions = {
      popularity: { 'analytics.popularityScore': -1, displayOrder: 1 },
      price_asc: { 'pricing.basePrice': 1 },
      price_desc: { 'pricing.basePrice': -1 },
      rating: { 'analytics.averageRating': -1 },
      name: { name: 1 },
      newest: { createdAt: -1 },
      featured: { isFeatured: -1, displayOrder: 1 }
    };
    
    return sortOptions[sortBy] || sortOptions.popularity;
  }
}

export default new AddOnController();
