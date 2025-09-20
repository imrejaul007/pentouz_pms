import SpecialDiscount from '../models/SpecialDiscount.js';
import DynamicPricing from '../models/DynamicPricing.js';
import MarketSegment from '../models/MarketSegment.js';
import JobType from '../models/JobType.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

class DiscountPricingService {
  // Special Discount Management
  async createSpecialDiscount(discountData, userId) {
    try {
      const discount = new SpecialDiscount({
        ...discountData,
        createdBy: userId
      });

      await discount.save();

      // Log discount creation
      await AuditLog.logAction('special_discount_created', userId, {
        source: 'discount_pricing_service',
        discountId: discount._id,
        discountName: discount.name,
        discountType: discount.type
      });

      return discount;
    } catch (error) {
      console.error('Error creating special discount:', error);
      throw error;
    }
  }

  async updateSpecialDiscount(discountId, updateData, userId) {
    try {
      const discount = await SpecialDiscount.findById(discountId);
      if (!discount) {
        throw new ApplicationError('Special discount not found', 404);
      }

      Object.assign(discount, updateData);
      discount.updatedBy = userId;
      await discount.save();

      // Log discount update
      await AuditLog.logAction('special_discount_updated', userId, {
        source: 'discount_pricing_service',
        discountId: discount._id,
        discountName: discount.name,
        changes: updateData
      });

      return discount;
    } catch (error) {
      console.error('Error updating special discount:', error);
      throw error;
    }
  }

  async getSpecialDiscounts(hotelId, filters = {}) {
    try {
      const query = { hotelId };
      
      if (filters.type) {
        query.type = filters.type;
      }
      if (filters.category) {
        query.category = filters.category;
      }
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { code: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }

      return await SpecialDiscount.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .populate('createdBy updatedBy', 'name email');
    } catch (error) {
      console.error('Error getting special discounts:', error);
      throw error;
    }
  }

  async getApplicableDiscounts(hotelId, bookingData) {
    try {
      return await SpecialDiscount.getApplicableDiscounts(hotelId, bookingData);
    } catch (error) {
      console.error('Error getting applicable discounts:', error);
      throw error;
    }
  }

  async deleteSpecialDiscount(discountId, userId) {
    try {
      const discount = await SpecialDiscount.findById(discountId);
      if (!discount) {
        throw new ApplicationError('Special discount not found', 404);
      }

      discount.isActive = false;
      discount.updatedBy = userId;
      await discount.save();

      // Log discount deletion
      await AuditLog.logAction('special_discount_deleted', userId, {
        source: 'discount_pricing_service',
        discountId: discount._id,
        discountName: discount.name
      });

      return discount;
    } catch (error) {
      console.error('Error deleting special discount:', error);
      throw error;
    }
  }

  // Dynamic Pricing Management
  async createDynamicPricing(pricingData, userId) {
    try {
      const pricing = new DynamicPricing({
        ...pricingData,
        createdBy: userId
      });

      await pricing.save();

      // Log pricing rule creation
      await AuditLog.logAction('dynamic_pricing_created', userId, {
        source: 'discount_pricing_service',
        pricingId: pricing._id,
        pricingName: pricing.name,
        algorithm: pricing.algorithm
      });

      return pricing;
    } catch (error) {
      console.error('Error creating dynamic pricing:', error);
      throw error;
    }
  }

  async updateDynamicPricing(pricingId, updateData, userId) {
    try {
      const pricing = await DynamicPricing.findById(pricingId);
      if (!pricing) {
        throw new ApplicationError('Dynamic pricing rule not found', 404);
      }

      Object.assign(pricing, updateData);
      pricing.updatedBy = userId;
      await pricing.save();

      // Log pricing rule update
      await AuditLog.logAction('dynamic_pricing_updated', userId, {
        source: 'discount_pricing_service',
        pricingId: pricing._id,
        pricingName: pricing.name,
        changes: updateData
      });

      return pricing;
    } catch (error) {
      console.error('Error updating dynamic pricing:', error);
      throw error;
    }
  }

  async getDynamicPricingRules(hotelId, filters = {}) {
    try {
      const query = { hotelId };
      
      if (filters.algorithm) {
        query.algorithm = filters.algorithm;
      }
      if (filters.category) {
        query.category = filters.category;
      }
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }

      return await DynamicPricing.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .populate('createdBy updatedBy', 'name email');
    } catch (error) {
      console.error('Error getting dynamic pricing rules:', error);
      throw error;
    }
  }

  async calculateDynamicPrice(pricingId, context) {
    try {
      const pricing = await DynamicPricing.findById(pricingId);
      if (!pricing) {
        throw new ApplicationError('Dynamic pricing rule not found', 404);
      }

      if (!pricing.isApplicable(context)) {
        throw new ApplicationError('Pricing rule is not applicable to the given context', 400);
      }

      return pricing.calculatePrice(context);
    } catch (error) {
      console.error('Error calculating dynamic price:', error);
      throw error;
    }
  }

  async deleteDynamicPricing(pricingId, userId) {
    try {
      const pricing = await DynamicPricing.findById(pricingId);
      if (!pricing) {
        throw new ApplicationError('Dynamic pricing rule not found', 404);
      }

      pricing.isActive = false;
      pricing.updatedBy = userId;
      await pricing.save();

      // Log pricing rule deletion
      await AuditLog.logAction('dynamic_pricing_deleted', userId, {
        source: 'discount_pricing_service',
        pricingId: pricing._id,
        pricingName: pricing.name
      });

      return pricing;
    } catch (error) {
      console.error('Error deleting dynamic pricing:', error);
      throw error;
    }
  }

  // Market Segment Management
  async createMarketSegment(segmentData, userId) {
    try {
      const segment = new MarketSegment({
        ...segmentData,
        createdBy: userId
      });

      await segment.save();

      // Log segment creation
      await AuditLog.logAction('market_segment_created', userId, {
        source: 'discount_pricing_service',
        segmentId: segment._id,
        segmentName: segment.name,
        category: segment.category
      });

      return segment;
    } catch (error) {
      console.error('Error creating market segment:', error);
      throw error;
    }
  }

  async updateMarketSegment(segmentId, updateData, userId) {
    try {
      const segment = await MarketSegment.findById(segmentId);
      if (!segment) {
        throw new ApplicationError('Market segment not found', 404);
      }

      Object.assign(segment, updateData);
      segment.updatedBy = userId;
      await segment.save();

      // Log segment update
      await AuditLog.logAction('market_segment_updated', userId, {
        source: 'discount_pricing_service',
        segmentId: segment._id,
        segmentName: segment.name,
        changes: updateData
      });

      return segment;
    } catch (error) {
      console.error('Error updating market segment:', error);
      throw error;
    }
  }

  async getMarketSegments(hotelId, filters = {}) {
    try {
      const query = { hotelId };
      
      if (filters.category) {
        query.category = filters.category;
      }
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { code: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }

      return await MarketSegment.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .populate('createdBy updatedBy', 'name email');
    } catch (error) {
      console.error('Error getting market segments:', error);
      throw error;
    }
  }

  async findMatchingSegments(hotelId, guestProfile) {
    try {
      return await MarketSegment.findMatchingSegments(hotelId, guestProfile);
    } catch (error) {
      console.error('Error finding matching segments:', error);
      throw error;
    }
  }

  async deleteMarketSegment(segmentId, userId) {
    try {
      const segment = await MarketSegment.findById(segmentId);
      if (!segment) {
        throw new ApplicationError('Market segment not found', 404);
      }

      segment.isActive = false;
      segment.updatedBy = userId;
      await segment.save();

      // Log segment deletion
      await AuditLog.logAction('market_segment_deleted', userId, {
        source: 'discount_pricing_service',
        segmentId: segment._id,
        segmentName: segment.name
      });

      return segment;
    } catch (error) {
      console.error('Error deleting market segment:', error);
      throw error;
    }
  }

  // Job Type Management
  async createJobType(jobTypeData, userId) {
    try {
      const jobType = new JobType({
        ...jobTypeData,
        createdBy: userId
      });

      await jobType.save();

      // Log job type creation
      await AuditLog.logAction('job_type_created', userId, {
        source: 'discount_pricing_service',
        jobTypeId: jobType._id,
        jobTypeName: jobType.name,
        category: jobType.category
      });

      return jobType;
    } catch (error) {
      console.error('Error creating job type:', error);
      throw error;
    }
  }

  async updateJobType(jobTypeId, updateData, userId) {
    try {
      const jobType = await JobType.findById(jobTypeId);
      if (!jobType) {
        throw new ApplicationError('Job type not found', 404);
      }

      Object.assign(jobType, updateData);
      jobType.updatedBy = userId;
      await jobType.save();

      // Log job type update
      await AuditLog.logAction('job_type_updated', userId, {
        source: 'discount_pricing_service',
        jobTypeId: jobType._id,
        jobTypeName: jobType.name,
        changes: updateData
      });

      return jobType;
    } catch (error) {
      console.error('Error updating job type:', error);
      throw error;
    }
  }

  async getJobTypes(hotelId, filters = {}) {
    try {
      const query = { hotelId };
      
      if (filters.category) {
        query.category = filters.category;
      }
      if (filters.level) {
        query.level = filters.level;
      }
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      if (filters.isRemote !== undefined) {
        query.isRemote = filters.isRemote;
      }
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { code: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }

      return await JobType.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .populate('createdBy updatedBy', 'name email')
        .populate('department', 'name code');
    } catch (error) {
      console.error('Error getting job types:', error);
      throw error;
    }
  }

  async searchJobTypes(hotelId, searchCriteria) {
    try {
      return await JobType.searchJobTypes(hotelId, searchCriteria);
    } catch (error) {
      console.error('Error searching job types:', error);
      throw error;
    }
  }

  async deleteJobType(jobTypeId, userId) {
    try {
      const jobType = await JobType.findById(jobTypeId);
      if (!jobType) {
        throw new ApplicationError('Job type not found', 404);
      }

      jobType.isActive = false;
      jobType.updatedBy = userId;
      await jobType.save();

      // Log job type deletion
      await AuditLog.logAction('job_type_deleted', userId, {
        source: 'discount_pricing_service',
        jobTypeId: jobType._id,
        jobTypeName: jobType.name
      });

      return jobType;
    } catch (error) {
      console.error('Error deleting job type:', error);
      throw error;
    }
  }

  // Analytics and Reporting
  async getDiscountAnalytics(hotelId, dateRange) {
    try {
      return await SpecialDiscount.getDiscountAnalytics(hotelId, dateRange);
    } catch (error) {
      console.error('Error getting discount analytics:', error);
      throw error;
    }
  }

  async getPricingAnalytics(hotelId, dateRange) {
    try {
      return await DynamicPricing.getPricingAnalytics(hotelId, dateRange);
    } catch (error) {
      console.error('Error getting pricing analytics:', error);
      throw error;
    }
  }

  async getMarketSegmentAnalytics(hotelId, dateRange) {
    try {
      return await MarketSegment.getSegmentAnalytics(hotelId, dateRange);
    } catch (error) {
      console.error('Error getting market segment analytics:', error);
      throw error;
    }
  }

  async ayx(){
    return ;
  }

  async getJobTypeAnalytics(hotelId, dateRange) {
    try {
      return await JobType.getJobTypeAnalytics(hotelId, dateRange);
    } catch (error) {
      console.error('Error getting job type analytics:', error);
      throw error;
    }
  }

  async getAdvancedFeaturesOverview(hotelId) {
    try {
      const [discountStats, pricingStats, segmentStats, jobTypeStats] = await Promise.all([
        SpecialDiscount.countDocuments({ hotelId, isActive: true }),
        DynamicPricing.countDocuments({ hotelId, isActive: true }),
        MarketSegment.countDocuments({ hotelId, isActive: true }),
        JobType.countDocuments({ hotelId, isActive: true })
      ]);

      const [activeDiscounts, activePricingRules, topSegments, remoteJobs] = await Promise.all([
        SpecialDiscount.countDocuments({ hotelId, isActive: true, 'dates.startDate': { $lte: new Date() }, 'dates.endDate': { $gte: new Date() } }),
        DynamicPricing.countDocuments({ hotelId, isActive: true }),
        MarketSegment.getTopPerformingSegments(hotelId, 3),
        JobType.countDocuments({ hotelId, isActive: true, isRemote: true })
      ]);

      return {
        summary: {
          totalDiscounts: discountStats,
          activeDiscounts,
          totalPricingRules: pricingStats,
          activePricingRules,
          totalMarketSegments: segmentStats,
          totalJobTypes: jobTypeStats,
          remoteEligibleJobs: remoteJobs
        },
        topSegments
      };
    } catch (error) {
      console.error('Error getting advanced features overview:', error);
      throw error;
    }
  }

  // Bulk Operations
  async bulkUpdateDiscountStatus(updates, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const results = [];

      for (const update of updates) {
        const { discountId, isActive } = update;
        const discount = await SpecialDiscount.findByIdAndUpdate(
          discountId,
          { isActive, updatedBy: userId },
          { new: true, session }
        );

        if (discount) {
          results.push(discount);

          // Log status update
          await AuditLog.logAction('discount_status_updated', userId, {
            source: 'discount_pricing_service',
            discountId: discount._id,
            discountName: discount.name,
            newStatus: isActive ? 'active' : 'inactive'
          });
        }
      }

      await session.commitTransaction();
      return results;
    } catch (error) {
      await session.abortTransaction();
      console.error('Error bulk updating discount status:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async bulkUpdatePricingStatus(updates, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const results = [];

      for (const update of updates) {
        const { pricingId, isActive } = update;
        const pricing = await DynamicPricing.findByIdAndUpdate(
          pricingId,
          { isActive, updatedBy: userId },
          { new: true, session }
        );

        if (pricing) {
          results.push(pricing);

          // Log status update
          await AuditLog.logAction('pricing_status_updated', userId, {
            source: 'discount_pricing_service',
            pricingId: pricing._id,
            pricingName: pricing.name,
            newStatus: isActive ? 'active' : 'inactive'
          });
        }
      }

      await session.commitTransaction();
      return results;
    } catch (error) {
      await session.abortTransaction();
      console.error('Error bulk updating pricing status:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export const discountPricingService = new DiscountPricingService();
