import rateManagementService from '../services/rateManagementService.js';
import {
  RatePlan,
  SeasonalRate,
  DynamicPricing,
  RateOverride,
  YieldManagement,
  Package
} from '../models/RateManagement.js';
import { v4 as uuidv4 } from 'uuid';
import eventPublisher from '../services/eventPublisher.js';
import currencyUtils from '../utils/currencyUtils.js';

class RateManagementController {
  /**
   * Get the best available rate for a room
   */
  async getBestRate(req, res) {
    try {
      const {
        roomType,
        checkIn,
        checkOut,
        guestCount = 1,
        promoCode,
        currency = 'USD'
      } = req.query;

      if (!roomType || !checkIn || !checkOut) {
        return res.status(400).json({
          success: false,
          message: 'Room type, check-in, and check-out dates are required'
        });
      }

      // Validate currency
      const isValidCurrency = await currencyUtils.validateCurrencyCode(currency);
      if (!isValidCurrency) {
        return res.status(400).json({
          success: false,
          message: `Invalid currency code: ${currency}`
        });
      }

      const bestRate = await rateManagementService.calculateBestRate(
        roomType,
        checkIn,
        checkOut,
        parseInt(guestCount),
        promoCode
      );

      // Convert rate to requested currency if different from base
      if (bestRate && bestRate.finalRate && currency !== bestRate.currency) {
        const convertedRate = await currencyUtils.convertCurrency(
          bestRate.finalRate,
          bestRate.currency || 'USD',
          currency
        );
        
        bestRate.finalRate = convertedRate;
        bestRate.currency = currency;
        bestRate.formattedRate = await currencyUtils.formatCurrency(convertedRate, currency);
      }

      res.json({
        success: true,
        data: bestRate
      });

    } catch (error) {
      console.error('Error getting best rate:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get all available rates for comparison
   */
  async getAllRates(req, res) {
    try {
      const {
        roomType,
        checkIn,
        checkOut,
        includeDetails = false
      } = req.query;

      if (!roomType || !checkIn || !checkOut) {
        return res.status(400).json({
          success: false,
          message: 'Room type, check-in, and check-out dates are required'
        });
      }

      const rates = await rateManagementService.getAllAvailableRates(
        roomType,
        checkIn,
        checkOut,
        includeDetails === 'true'
      );

      res.json({
        success: true,
        data: rates
      });

    } catch (error) {
      console.error('Error getting all rates:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Create or update rate plan
   */
  async createRatePlan(req, res) {
    try {
      // Auto-generate currency rates for active currencies if requested
      if (req.body.autoGenerateCurrencyRates) {
        const activeCurrencies = await currencyUtils.getActiveCurrencies();
        const targetCurrencies = activeCurrencies
          .filter(c => c.code !== (req.body.baseCurrency || 'USD'))
          .map(c => c.code);
        
        if (req.body.baseRates) {
          for (let baseRate of req.body.baseRates) {
            const convertedRates = await currencyUtils.convertRateToMultipleCurrencies({
              rate: baseRate.rate,
              currency: req.body.baseCurrency || 'USD'
            }, targetCurrencies);
            
            baseRate.currencyRates = convertedRates;
          }
        }
      }

      const ratePlan = await rateManagementService.upsertRatePlan(req.body);

      // Publish rate update event to queue for OTA sync
      if (ratePlan.isActive && req.body.publishToOTA !== false) {
        try {
          await eventPublisher.publishRateUpdate({
            hotelId: ratePlan.hotel || req.user.hotel,
            roomTypeId: ratePlan.roomType,
            ratePlanId: ratePlan._id.toString(),
            dateRange: {
              startDate: ratePlan.validFrom || new Date().toISOString().split('T')[0],
              endDate: ratePlan.validTo || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]
            },
            rates: [{
              date: new Date().toISOString().split('T')[0],
              rate: ratePlan.baseRate,
              currency: ratePlan.baseCurrency || 'USD'
            }],
            source: 'rate_plan_creation',
            reason: `Rate plan created: ${ratePlan.name}`
          }, {
            userId: req.user?._id,
            source: 'rate_management'
          });
        } catch (publishError) {
          console.warn('Failed to publish rate update event:', publishError.message);
        }
      }

      res.status(201).json({
        success: true,
        data: ratePlan,
        message: 'Rate plan created successfully'
      });

    } catch (error) {
      console.error('Error creating rate plan:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get all rate plans
   */
  async getRatePlans(req, res) {
    try {
      const { type, isActive } = req.query;
      const filter = {};

      if (type) filter.type = type;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const ratePlans = await RatePlan.find(filter).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: ratePlans
      });

    } catch (error) {
      console.error('Error getting rate plans:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update rate plan
   */
  async updateRatePlan(req, res) {
    try {
      const { id } = req.params;

      const ratePlan = await RatePlan.findByIdAndUpdate(
        id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!ratePlan) {
        return res.status(404).json({
          success: false,
          message: 'Rate plan not found'
        });
      }

      // Publish rate update event to queue for OTA sync
      if (ratePlan.isActive && req.body.publishToOTA !== false) {
        try {
          await eventPublisher.publishRateUpdate({
            hotelId: ratePlan.hotel || req.user.hotel,
            roomTypeId: ratePlan.roomType,
            ratePlanId: ratePlan._id.toString(),
            dateRange: {
              startDate: ratePlan.validFrom || new Date().toISOString().split('T')[0],
              endDate: ratePlan.validTo || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]
            },
            rates: [{
              date: new Date().toISOString().split('T')[0],
              rate: ratePlan.baseRate,
              currency: ratePlan.currency || 'USD'
            }],
            source: 'rate_plan_update',
            reason: `Rate plan updated: ${ratePlan.name}`
          }, {
            userId: req.user?._id,
            source: 'rate_management'
          });
        } catch (publishError) {
          console.warn('Failed to publish rate update event:', publishError.message);
        }
      }

      res.json({
        success: true,
        data: ratePlan,
        message: 'Rate plan updated successfully'
      });

    } catch (error) {
      console.error('Error updating rate plan:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Delete rate plan
   */
  async deleteRatePlan(req, res) {
    try {
      const { id } = req.params;

      const ratePlan = await RatePlan.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );

      if (!ratePlan) {
        return res.status(404).json({
          success: false,
          message: 'Rate plan not found'
        });
      }

      res.json({
        success: true,
        message: 'Rate plan deactivated successfully'
      });

    } catch (error) {
      console.error('Error deleting rate plan:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Create seasonal rate
   */
  async createSeasonalRate(req, res) {
    try {
      const seasonalRate = await rateManagementService.createSeasonalRate(req.body);

      res.status(201).json({
        success: true,
        data: seasonalRate,
        message: 'Seasonal rate created successfully'
      });

    } catch (error) {
      console.error('Error creating seasonal rate:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get seasonal rates
   */
  async getSeasonalRates(req, res) {
    try {
      const { isActive, year } = req.query;
      const filter = {};

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

      const seasonalRates = await SeasonalRate.find(filter).sort({ startDate: 1 });

      res.json({
        success: true,
        data: seasonalRates
      });

    } catch (error) {
      console.error('Error getting seasonal rates:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update seasonal rate
   */
  async updateSeasonalRate(req, res) {
    try {
      const { id } = req.params;

      const seasonalRate = await SeasonalRate.findByIdAndUpdate(
        id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!seasonalRate) {
        return res.status(404).json({
          success: false,
          message: 'Seasonal rate not found'
        });
      }

      res.json({
        success: true,
        data: seasonalRate,
        message: 'Seasonal rate updated successfully'
      });

    } catch (error) {
      console.error('Error updating seasonal rate:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Override rate for specific date
   */
  async overrideRate(req, res) {
    try {
      const override = await rateManagementService.overrideRate({
        ...req.body,
        approvedBy: req.user.id
      });

      // Publish rate update event for the specific override date
      if (override.isActive && req.body.publishToOTA !== false) {
        try {
          await eventPublisher.publishRateUpdate({
            hotelId: req.user.hotel,
            roomTypeId: override.roomType,
            ratePlanId: override.ratePlan?.toString() || 'override',
            dateRange: {
              startDate: new Date(override.date).toISOString().split('T')[0],
              endDate: new Date(override.date).toISOString().split('T')[0]
            },
            rates: [{
              date: new Date(override.date).toISOString().split('T')[0],
              rate: override.rate,
              currency: override.currency || 'USD'
            }],
            source: 'rate_override',
            reason: `Rate override: ${override.reason || 'Manual rate adjustment'}`
          }, {
            userId: req.user?._id,
            source: 'rate_management',
            priority: 2 // Higher priority for overrides
          });
        } catch (publishError) {
          console.warn('Failed to publish rate override event:', publishError.message);
        }
      }

      res.status(201).json({
        success: true,
        data: override,
        message: 'Rate override created successfully'
      });

    } catch (error) {
      console.error('Error creating rate override:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get rate overrides
   */
  async getRateOverrides(req, res) {
    try {
      const { roomType, startDate, endDate, isActive } = req.query;
      const filter = {};

      if (roomType) filter.roomType = roomType;
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      
      if (startDate && endDate) {
        filter.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const overrides = await RateOverride.find(filter)
        .populate('approvedBy', 'firstName lastName')
        .sort({ date: 1 });

      res.json({
        success: true,
        data: overrides
      });

    } catch (error) {
      console.error('Error getting rate overrides:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Delete rate override
   */
  async deleteRateOverride(req, res) {
    try {
      const { id } = req.params;

      const override = await RateOverride.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );

      if (!override) {
        return res.status(404).json({
          success: false,
          message: 'Rate override not found'
        });
      }

      res.json({
        success: true,
        message: 'Rate override removed successfully'
      });

    } catch (error) {
      console.error('Error deleting rate override:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Create dynamic pricing rule
   */
  async createDynamicPricingRule(req, res) {
    try {
      const ruleData = {
        ...req.body,
        ruleId: req.body.ruleId || uuidv4()
      };

      const rule = new DynamicPricing(ruleData);
      await rule.save();

      res.status(201).json({
        success: true,
        data: rule,
        message: 'Dynamic pricing rule created successfully'
      });

    } catch (error) {
      console.error('Error creating dynamic pricing rule:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get dynamic pricing rules
   */
  async getDynamicPricingRules(req, res) {
    try {
      const { type, isActive } = req.query;
      const filter = {};

      if (type) filter.type = type;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const rules = await DynamicPricing.find(filter).sort({ priority: -1 });

      res.json({
        success: true,
        data: rules
      });

    } catch (error) {
      console.error('Error getting dynamic pricing rules:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update yield management metrics
   */
  async updateYieldMetrics(req, res) {
    try {
      const { date, roomType } = req.body;

      if (!date || !roomType) {
        return res.status(400).json({
          success: false,
          message: 'Date and room type are required'
        });
      }

      const metrics = await rateManagementService.updateYieldMetrics(
        new Date(date),
        roomType
      );

      res.json({
        success: true,
        data: metrics,
        message: 'Yield metrics updated successfully'
      });

    } catch (error) {
      console.error('Error updating yield metrics:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get yield management data
   */
  async getYieldData(req, res) {
    try {
      const { startDate, endDate, roomType } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const filter = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      if (roomType) filter.roomType = roomType;

      const yieldData = await YieldManagement.find(filter).sort({ date: 1 });

      res.json({
        success: true,
        data: yieldData
      });

    } catch (error) {
      console.error('Error getting yield data:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get revenue forecast
   */
  async getRevenueForecast(req, res) {
    try {
      const { startDate, endDate, roomType } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const forecast = await rateManagementService.getRevenueForecast(
        startDate,
        endDate,
        roomType
      );

      res.json({
        success: true,
        data: forecast
      });

    } catch (error) {
      console.error('Error getting revenue forecast:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Create package
   */
  async createPackage(req, res) {
    try {
      const packageData = {
        ...req.body,
        packageId: req.body.packageId || uuidv4()
      };

      const pkg = new Package(packageData);
      await pkg.save();

      res.status(201).json({
        success: true,
        data: pkg,
        message: 'Package created successfully'
      });

    } catch (error) {
      console.error('Error creating package:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get packages
   */
  async getPackages(req, res) {
    try {
      const { type, isActive } = req.query;
      const filter = {};

      if (type) filter.type = type;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const packages = await Package.find(filter).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: packages
      });

    } catch (error) {
      console.error('Error getting packages:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update package
   */
  async updatePackage(req, res) {
    try {
      const { id } = req.params;

      const pkg = await Package.findByIdAndUpdate(
        id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!pkg) {
        return res.status(404).json({
          success: false,
          message: 'Package not found'
        });
      }

      res.json({
        success: true,
        data: pkg,
        message: 'Package updated successfully'
      });

    } catch (error) {
      console.error('Error updating package:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get rate comparison across different dates
   */
  async getRateComparison(req, res) {
    try {
      const { roomType, dates } = req.body; // dates should be an array

      if (!roomType || !dates || !Array.isArray(dates)) {
        return res.status(400).json({
          success: false,
          message: 'Room type and dates array are required'
        });
      }

      const comparison = [];

      for (const dateStr of dates) {
        const checkIn = new Date(dateStr);
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + 1);

        const bestRate = await rateManagementService.calculateBestRate(
          roomType,
          checkIn,
          checkOut
        );

        comparison.push({
          date: checkIn,
          rate: bestRate?.finalRate || 0,
          planName: bestRate?.planName || 'N/A'
        });
      }

      res.json({
        success: true,
        data: {
          roomType,
          comparison,
          averageRate: comparison.reduce((sum, item) => sum + item.rate, 0) / comparison.length
        }
      });

    } catch (error) {
      console.error('Error getting rate comparison:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Bulk update rates
   */
  async bulkUpdateRates(req, res) {
    try {
      const { updates } = req.body; // Array of rate updates

      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({
          success: false,
          message: 'Updates array is required'
        });
      }

      const results = [];
      const batchEvents = [];

      for (const update of updates) {
        try {
          const override = await rateManagementService.overrideRate({
            ...update,
            approvedBy: req.user.id
          });
          results.push({ success: true, data: override });

          // Prepare event for batch publishing
          if (override.isActive && req.body.publishToOTA !== false) {
            batchEvents.push({
              type: 'rate_update',
              data: {
                hotelId: req.user.hotel,
                roomTypeId: override.roomType,
                ratePlanId: override.ratePlan?.toString() || 'bulk_override',
                dateRange: {
                  startDate: new Date(override.date).toISOString().split('T')[0],
                  endDate: new Date(override.date).toISOString().split('T')[0]
                },
                rates: [{
                  date: new Date(override.date).toISOString().split('T')[0],
                  rate: override.rate,
                  currency: override.currency || 'USD'
                }],
                source: 'bulk_rate_update',
                reason: `Bulk rate update: ${override.reason || 'Batch rate adjustment'}`
              },
              priority: 3
            });
          }
        } catch (error) {
          results.push({ success: false, error: error.message, update });
        }
      }

      // Publish all rate update events as a batch
      if (batchEvents.length > 0) {
        try {
          await eventPublisher.publishBatch(batchEvents, {
            userId: req.user?._id,
            source: 'bulk_rate_management'
          });
        } catch (publishError) {
          console.warn('Failed to publish bulk rate update events:', publishError.message);
        }
      }

      res.json({
        success: true,
        data: results,
        message: `Processed ${updates.length} rate updates`
      });

    } catch (error) {
      console.error('Error bulk updating rates:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new RateManagementController();
