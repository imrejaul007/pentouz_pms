import seasonalPricingService from '../services/seasonalPricingService.js';
import Season from '../models/Season.js';
import SpecialPeriod from '../models/SpecialPeriod.js';

class SeasonalPricingController {
  /**
   * Get seasonal adjustment for a specific date and room type
   */
  async getSeasonalAdjustment(req, res) {
    try {
      const { roomType, date, ratePlanId } = req.query;
      
      if (!roomType || !date) {
        return res.status(400).json({
          success: false,
          message: 'Room type and date are required'
        });
      }
      
      const adjustment = await seasonalPricingService.calculateSeasonalAdjustment(
        roomType,
        date,
        ratePlanId
      );
      
      res.json({
        success: true,
        data: adjustment
      });
      
    } catch (error) {
      console.error('Error getting seasonal adjustment:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Check if booking is allowed for date range
   */
  async checkBookingAvailability(req, res) {
    try {
      const { arrivalDate, departureDate, roomType } = req.query;
      
      if (!arrivalDate || !departureDate || !roomType) {
        return res.status(400).json({
          success: false,
          message: 'Arrival date, departure date, and room type are required'
        });
      }
      
      const availability = await seasonalPricingService.isBookingAllowed(
        arrivalDate,
        departureDate,
        roomType
      );
      
      res.json({
        success: true,
        data: availability
      });
      
    } catch (error) {
      console.error('Error checking booking availability:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get pricing calendar for a date range
   */
  async getPricingCalendar(req, res) {
    try {
      const { startDate, endDate, roomType = 'all' } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }
      
      const calendar = await seasonalPricingService.getPricingCalendar(
        startDate,
        endDate,
        roomType
      );
      
      res.json({
        success: true,
        data: calendar
      });
      
    } catch (error) {
      console.error('Error getting pricing calendar:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Create a new season
   */
  async createSeason(req, res) {
    try {
      const seasonData = {
        ...req.body,
        createdBy: req.user?.id
      };
      
      const season = await seasonalPricingService.createSeason(seasonData);
      
      res.status(201).json({
        success: true,
        data: season,
        message: 'Season created successfully'
      });
      
    } catch (error) {
      console.error('Error creating season:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get all seasons
   */
  async getSeasons(req, res) {
    try {
      const { type, isActive, year } = req.query;
      const filter = {};
      
      if (type) filter.type = type;
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      
      if (year) {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31);
        filter.$or = [
          { startDate: { $gte: startOfYear, $lte: endOfYear } },
          { endDate: { $gte: startOfYear, $lte: endOfYear } },
          { startDate: { $lte: startOfYear }, endDate: { $gte: endOfYear } }
        ];
      }
      
      const seasons = await Season.find(filter)
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName')
        .sort({ startDate: 1 });
      
      res.json({
        success: true,
        data: seasons
      });
      
    } catch (error) {
      console.error('Error getting seasons:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get a specific season by ID
   */
  async getSeasonById(req, res) {
    try {
      const { id } = req.params;
      
      const season = await Season.findById(id)
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName');
      
      if (!season) {
        return res.status(404).json({
          success: false,
          message: 'Season not found'
        });
      }
      
      res.json({
        success: true,
        data: season
      });
      
    } catch (error) {
      console.error('Error getting season:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Update a season
   */
  async updateSeason(req, res) {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        updatedBy: req.user?.id
      };
      
      const season = await Season.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!season) {
        return res.status(404).json({
          success: false,
          message: 'Season not found'
        });
      }
      
      res.json({
        success: true,
        data: season,
        message: 'Season updated successfully'
      });
      
    } catch (error) {
      console.error('Error updating season:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Delete a season (soft delete)
   */
  async deleteSeason(req, res) {
    try {
      const { id } = req.params;
      
      const season = await Season.findByIdAndUpdate(
        id,
        { isActive: false, updatedBy: req.user?.id },
        { new: true }
      );
      
      if (!season) {
        return res.status(404).json({
          success: false,
          message: 'Season not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Season deactivated successfully'
      });
      
    } catch (error) {
      console.error('Error deleting season:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Create a new special period
   */
  async createSpecialPeriod(req, res) {
    try {
      const periodData = {
        ...req.body,
        createdBy: req.user?.id
      };
      
      const period = await seasonalPricingService.createSpecialPeriod(periodData);
      
      res.status(201).json({
        success: true,
        data: period,
        message: 'Special period created successfully'
      });
      
    } catch (error) {
      console.error('Error creating special period:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get all special periods
   */
  async getSpecialPeriods(req, res) {
    try {
      const { type, isActive, year } = req.query;
      const filter = {};
      
      if (type) filter.type = type;
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      
      if (year) {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31);
        filter.$or = [
          { startDate: { $gte: startOfYear, $lte: endOfYear } },
          { endDate: { $gte: startOfYear, $lte: endOfYear } },
          { startDate: { $lte: startOfYear }, endDate: { $gte: endOfYear } }
        ];
      }
      
      const periods = await SpecialPeriod.find(filter)
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName')
        .sort({ startDate: 1 });
      
      res.json({
        success: true,
        data: periods
      });
      
    } catch (error) {
      console.error('Error getting special periods:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get a specific special period by ID
   */
  async getSpecialPeriodById(req, res) {
    try {
      const { id } = req.params;
      
      const period = await SpecialPeriod.findById(id)
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName');
      
      if (!period) {
        return res.status(404).json({
          success: false,
          message: 'Special period not found'
        });
      }
      
      res.json({
        success: true,
        data: period
      });
      
    } catch (error) {
      console.error('Error getting special period:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Update a special period
   */
  async updateSpecialPeriod(req, res) {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        updatedBy: req.user?.id
      };
      
      const period = await SpecialPeriod.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!period) {
        return res.status(404).json({
          success: false,
          message: 'Special period not found'
        });
      }
      
      res.json({
        success: true,
        data: period,
        message: 'Special period updated successfully'
      });
      
    } catch (error) {
      console.error('Error updating special period:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Delete a special period (soft delete)
   */
  async deleteSpecialPeriod(req, res) {
    try {
      const { id } = req.params;
      
      const period = await SpecialPeriod.findByIdAndUpdate(
        id,
        { isActive: false, updatedBy: req.user?.id },
        { new: true }
      );
      
      if (!period) {
        return res.status(404).json({
          success: false,
          message: 'Special period not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Special period deactivated successfully'
      });
      
    } catch (error) {
      console.error('Error deleting special period:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get seasons by date range
   */
  async getSeasonsByDateRange(req, res) {
    try {
      const { startDate, endDate, includeInactive = false } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }
      
      const seasons = await seasonalPricingService.getSeasonsByDateRange(
        new Date(startDate),
        new Date(endDate),
        includeInactive === 'true'
      );
      
      res.json({
        success: true,
        data: seasons
      });
      
    } catch (error) {
      console.error('Error getting seasons by date range:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get special periods by date range
   */
  async getSpecialPeriodsByDateRange(req, res) {
    try {
      const { startDate, endDate, includeInactive = false } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }
      
      const periods = await seasonalPricingService.getSpecialPeriodsByDateRange(
        new Date(startDate),
        new Date(endDate),
        includeInactive === 'true'
      );
      
      res.json({
        success: true,
        data: periods
      });
      
    } catch (error) {
      console.error('Error getting special periods by date range:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get seasonal analytics
   */
  async getSeasonalAnalytics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }
      
      const analytics = await seasonalPricingService.getSeasonalAnalytics(
        new Date(startDate),
        new Date(endDate)
      );
      
      res.json({
        success: true,
        data: analytics
      });
      
    } catch (error) {
      console.error('Error getting seasonal analytics:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Bulk create special periods
   */
  async bulkCreateSpecialPeriods(req, res) {
    try {
      const { periods } = req.body;
      
      if (!periods || !Array.isArray(periods)) {
        return res.status(400).json({
          success: false,
          message: 'Periods array is required'
        });
      }
      
      const results = [];
      
      for (const periodData of periods) {
        try {
          const period = await seasonalPricingService.createSpecialPeriod({
            ...periodData,
            createdBy: req.user?.id
          });
          results.push({ success: true, data: period });
        } catch (error) {
          results.push({ success: false, error: error.message, data: periodData });
        }
      }
      
      res.json({
        success: true,
        data: results,
        message: `Processed ${periods.length} special periods`
      });
      
    } catch (error) {
      console.error('Error bulk creating special periods:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get upcoming special periods requiring alerts
   */
  async getUpcomingAlerts(req, res) {
    try {
      const { days = 30 } = req.query;
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parseInt(days));
      
      const periods = await SpecialPeriod.find({
        isActive: true,
        startDate: { $gte: new Date(), $lte: futureDate },
        'alerts.emailNotification': true
      }).sort({ startDate: 1 });
      
      const alerts = periods.filter(period => period.shouldTriggerAlert());
      
      res.json({
        success: true,
        data: alerts
      });
      
    } catch (error) {
      console.error('Error getting upcoming alerts:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new SeasonalPricingController();
