import CentralizedRate from '../models/CentralizedRate.js';
import PropertyGroup from '../models/PropertyGroup.js';
import seasonalPricingService from './seasonalPricingService.js';
import mongoose from 'mongoose';

class CentralizedRateService {
  
  // Rate Management
  
  async createRate(rateData, createdBy) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Validate property group exists
      const propertyGroup = await PropertyGroup.findById(rateData.propertyGroup.groupId).session(session);
      if (!propertyGroup) {
        throw new Error('Property group not found');
      }
      
      // Set property group information
      rateData.propertyGroup.groupName = propertyGroup.name;
      rateData.propertyGroup.properties = propertyGroup.properties?.map(p => p.propertyId) || [];
      rateData.audit.createdBy = createdBy;
      
      // Check for conflicting rates
      const conflicts = await this.findConflictingRates(
        rateData.propertyGroup.groupId,
        rateData.validityPeriod.startDate,
        rateData.validityPeriod.endDate,
        rateData.rateType,
        session
      );
      
      if (conflicts.length > 0) {
        rateData.conflictResolution.conflictsWith = conflicts.map(conflict => ({
          rateId: conflict._id,
          rateName: conflict.rateName,
          conflictType: 'overlap',
          resolution: 'alert'
        }));
      }
      
      // Create the rate
      const rate = new CentralizedRate(rateData);
      await rate.save({ session });
      
      // Update property group analytics
      await this.updateGroupAnalytics(propertyGroup._id, session);
      
      await session.commitTransaction();
      
      // Auto-distribute if enabled
      if (propertyGroup.settings?.rateManagement?.autoSync) {
        await rate.distributeToProperties();
      }
      
      return rate;
      
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to create centralized rate: ${error.message}`);
    } finally {
      session.endSession();
    }
  }
  
  async updateRate(rateId, updateData, updatedBy) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const rate = await CentralizedRate.findById(rateId).session(session);
      if (!rate) {
        throw new Error('Rate not found');
      }
      
      // Log changes for audit
      const changes = this.detectChanges(rate.toObject(), updateData);
      if (changes.length > 0) {
        changes.forEach(change => {
          rate.logChange(change.field, change.oldValue, change.newValue, updatedBy, change.reason);
        });
      }
      
      // Update the rate
      Object.assign(rate, updateData);
      rate.audit.updatedBy = updatedBy;
      rate.distributionSettings.syncStatus = 'pending';
      
      // Re-check for conflicts if validity period changed
      if (updateData.validityPeriod) {
        const conflicts = await this.findConflictingRates(
          rate.propertyGroup.groupId,
          rate.validityPeriod.startDate,
          rate.validityPeriod.endDate,
          rate.rateType,
          session
        );
        
        rate.conflictResolution.conflictsWith = conflicts.map(conflict => ({
          rateId: conflict._id,
          rateName: conflict.rateName,
          conflictType: 'overlap',
          resolution: 'alert'
        }));
      }
      
      await rate.save({ session });
      await session.commitTransaction();
      
      // Auto-sync if enabled
      const propertyGroup = await PropertyGroup.findById(rate.propertyGroup.groupId);
      if (propertyGroup?.settings?.rateManagement?.autoSync) {
        await rate.distributeToProperties();
      }
      
      return rate;
      
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to update rate: ${error.message}`);
    } finally {
      session.endSession();
    }
  }
  
  async deleteRate(rateId, deletedBy) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const rate = await CentralizedRate.findById(rateId).session(session);
      if (!rate) {
        throw new Error('Rate not found');
      }
      
      // Soft delete
      rate.isActive = false;
      rate.audit.updatedBy = deletedBy;
      rate.distributionSettings.syncStatus = 'pending';
      
      await rate.save({ session });
      
      // Update group analytics
      await this.updateGroupAnalytics(rate.propertyGroup.groupId, session);
      
      await session.commitTransaction();
      
      return { success: true, message: 'Rate deactivated successfully' };
      
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to delete rate: ${error.message}`);
    } finally {
      session.endSession();
    }
  }
  
  // Rate Distribution
  
  async distributeRate(rateId, options = {}) {
    try {
      const rate = await CentralizedRate.findById(rateId).populate('propertyGroup.groupId');
      if (!rate) {
        throw new Error('Rate not found');
      }
      
      const { forceSync = false, selectedProperties = [] } = options;
      
      // Override distribution settings if specific properties selected
      if (selectedProperties.length > 0) {
        rate.distributionSettings.distributionType = 'selective';
        rate.distributionSettings.targetProperties = selectedProperties;
      }
      
      const results = await rate.distributeToProperties();
      
      // Update group sync statistics
      await this.updateSyncStatistics(rate.propertyGroup.groupId, results);
      
      return results;
      
    } catch (error) {
      throw new Error(`Failed to distribute rate: ${error.message}`);
    }
  }
  
  async bulkDistribute(groupId, rateIds = [], options = {}) {
    try {
      const propertyGroup = await PropertyGroup.findById(groupId);
      if (!propertyGroup) {
        throw new Error('Property group not found');
      }
      
      let rates;
      if (rateIds.length > 0) {
        rates = await CentralizedRate.find({
          _id: { $in: rateIds },
          'propertyGroup.groupId': groupId,
          isActive: true
        });
      } else {
        rates = await CentralizedRate.find({
          'propertyGroup.groupId': groupId,
          isActive: true,
          'audit.approvalStatus': 'approved'
        });
      }
      
      const results = {
        total: rates.length,
        successful: [],
        failed: [],
        summary: {
          totalProperties: propertyGroup.properties?.length || 0,
          totalSynced: 0,
          totalFailed: 0
        }
      };
      
      // Distribute each rate
      for (const rate of rates) {
        try {
          const rateResult = await rate.distributeToProperties();
          results.successful.push({
            rateId: rate.rateId,
            rateName: rate.rateName,
            result: rateResult
          });
          results.summary.totalSynced += rateResult.success.length;
        } catch (error) {
          results.failed.push({
            rateId: rate.rateId,
            rateName: rate.rateName,
            error: error.message
          });
        }
      }
      
      // Update group analytics
      await this.updateSyncStatistics(groupId, results);
      
      return results;
      
    } catch (error) {
      throw new Error(`Failed to bulk distribute: ${error.message}`);
    }
  }
  
  // Conflict Resolution
  
  async findConflictingRates(groupId, startDate, endDate, rateType, session = null) {
    const query = {
      'propertyGroup.groupId': groupId,
      rateType,
      isActive: true,
      $or: [
        {
          'validityPeriod.startDate': { $lte: endDate },
          'validityPeriod.endDate': { $gte: startDate }
        }
      ]
    };
    
    const options = session ? { session } : {};
    return CentralizedRate.find(query, null, options);
  }
  
  async resolveConflict(rateId, conflictId, resolution, resolvedBy) {
    try {
      const rate = await CentralizedRate.findById(rateId);
      if (!rate) {
        throw new Error('Rate not found');
      }
      
      const conflictIndex = rate.conflictResolution.conflictsWith.findIndex(
        c => c.rateId.toString() === conflictId.toString()
      );
      
      if (conflictIndex === -1) {
        throw new Error('Conflict not found');
      }
      
      rate.conflictResolution.conflictsWith[conflictIndex].resolution = resolution;
      
      // Execute resolution
      switch (resolution) {
        case 'override':
          // This rate takes priority
          await this.setPriority(rateId, 10);
          await this.setPriority(conflictId, 1);
          break;
          
        case 'merge':
          // Implement merge logic based on business rules
          await this.mergeRates(rateId, conflictId, resolvedBy);
          break;
          
        case 'ignore':
          // Mark as resolved, no action needed
          break;
          
        default:
          // Alert - no automatic action
          break;
      }
      
      // Log resolution
      rate.audit.changeLog.push({
        field: 'conflict_resolution',
        oldValue: 'unresolved',
        newValue: resolution,
        changedBy: resolvedBy,
        reason: `Resolved conflict with rate ${conflictId}`
      });
      
      await rate.save();
      return rate;
      
    } catch (error) {
      throw new Error(`Failed to resolve conflict: ${error.message}`);
    }
  }
  
  // Property-Specific Rates
  
  async addPropertyOverride(rateId, propertyId, overrides, updatedBy) {
    try {
      const rate = await CentralizedRate.findById(rateId);
      if (!rate) {
        throw new Error('Rate not found');
      }
      
      await rate.addPropertyOverride(propertyId, overrides);
      
      // Log the override
      rate.audit.changeLog.push({
        field: 'property_override',
        oldValue: null,
        newValue: overrides,
        changedBy: updatedBy,
        reason: `Added property-specific override for ${propertyId}`
      });
      
      await rate.save();
      return rate;
      
    } catch (error) {
      throw new Error(`Failed to add property override: ${error.message}`);
    }
  }
  
  async removePropertyOverride(rateId, propertyId, removedBy) {
    try {
      const rate = await CentralizedRate.findById(rateId);
      if (!rate) {
        throw new Error('Rate not found');
      }
      
      const overrideIndex = rate.propertySpecificRates.findIndex(
        psr => psr.propertyId.toString() === propertyId.toString()
      );
      
      if (overrideIndex === -1) {
        throw new Error('Property override not found');
      }
      
      const removedOverride = rate.propertySpecificRates[overrideIndex];
      rate.propertySpecificRates.splice(overrideIndex, 1);
      
      // Log the removal
      rate.audit.changeLog.push({
        field: 'property_override',
        oldValue: removedOverride.overrides,
        newValue: null,
        changedBy: removedBy,
        reason: `Removed property-specific override for ${propertyId}`
      });
      
      await rate.save();
      return rate;
      
    } catch (error) {
      throw new Error(`Failed to remove property override: ${error.message}`);
    }
  }
  
  // Analytics and Reporting
  
  async getGroupAnalytics(groupId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      const query = {
        'propertyGroup.groupId': groupId,
        isActive: true
      };
      
      if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }
      
      const [rateStats, distributionStats] = await Promise.all([
        CentralizedRate.aggregate([
          { $match: query },
          {
            $group: {
              _id: '$rateType',
              count: { $sum: 1 },
              totalBookings: { $sum: '$analytics.totalBookings' },
              totalRevenue: { $sum: '$analytics.totalRevenue' },
              avgADR: { $avg: '$analytics.averageDailyRate' },
              avgOccupancy: { $avg: '$analytics.occupancyRate' }
            }
          }
        ]),
        CentralizedRate.aggregate([
          { $match: query },
          {
            $group: {
              _id: '$distributionSettings.syncStatus',
              count: { $sum: 1 }
            }
          }
        ])
      ]);
      
      const propertyGroup = await PropertyGroup.findById(groupId);
      
      return {
        groupInfo: {
          groupId: propertyGroup.groupId,
          groupName: propertyGroup.name,
          totalProperties: propertyGroup.properties?.length || 0,
          activeProperties: propertyGroup.properties?.filter(p => p.status === 'active').length || 0
        },
        rateStatistics: rateStats,
        distributionStatus: distributionStats,
        overallMetrics: {
          totalRates: rateStats.reduce((sum, stat) => sum + stat.count, 0),
          totalBookings: rateStats.reduce((sum, stat) => sum + stat.totalBookings, 0),
          totalRevenue: rateStats.reduce((sum, stat) => sum + stat.totalRevenue, 0),
          avgADR: rateStats.length > 0 ? 
            rateStats.reduce((sum, stat) => sum + stat.avgADR, 0) / rateStats.length : 0,
          avgOccupancy: rateStats.length > 0 ? 
            rateStats.reduce((sum, stat) => sum + stat.avgOccupancy, 0) / rateStats.length : 0
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to get group analytics: ${error.message}`);
    }
  }
  
  async getDistributionReport(groupId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      const query = {
        'propertyGroup.groupId': groupId,
        isActive: true
      };
      
      if (startDate && endDate) {
        query['distributionSettings.lastSyncDate'] = { 
          $gte: new Date(startDate), 
          $lte: new Date(endDate) 
        };
      }
      
      const rates = await CentralizedRate.find(query)
        .select('rateId rateName distributionSettings propertySpecificRates')
        .populate('propertyGroup.groupId', 'name properties');
      
      const report = rates.map(rate => ({
        rateId: rate.rateId,
        rateName: rate.rateName,
        syncStatus: rate.distributionSettings.syncStatus,
        lastSync: rate.distributionSettings.lastSyncDate,
        totalProperties: rate.propertyGroup.properties.length,
        syncedProperties: rate.propertySpecificRates.filter(psr => psr.syncStatus.status === 'synced').length,
        failedProperties: rate.propertySpecificRates.filter(psr => psr.syncStatus.status === 'failed').length,
        syncProgress: rate.syncProgress,
        errors: rate.distributionSettings.syncErrors
      }));
      
      return {
        summary: {
          totalRates: report.length,
          syncedRates: report.filter(r => r.syncStatus === 'synced').length,
          failedRates: report.filter(r => r.syncStatus === 'failed').length,
          pendingRates: report.filter(r => r.syncStatus === 'pending').length
        },
        rates: report
      };
      
    } catch (error) {
      throw new Error(`Failed to get distribution report: ${error.message}`);
    }
  }
  
  // Rate Calculation with Seasonal Integration
  
  async calculateRate(rateId, propertyId, checkIn, checkOut, roomType, guests = 2) {
    try {
      const rate = await CentralizedRate.findById(rateId);
      if (!rate) {
        throw new Error('Rate not found');
      }
      
      // Check availability
      const availability = rate.checkAvailability(propertyId, roomType, checkIn, checkOut);
      if (!availability.available) {
        return { available: false, reason: availability.reason };
      }
      
      // Calculate base rate
      let calculatedRate = rate.calculateRateForProperty(propertyId, roomType, checkIn, guests);
      
      // Apply seasonal adjustments if available
      if (seasonalPricingService) {
        try {
          const seasonalAdjustment = await seasonalPricingService.calculateAdjustment(
            new Date(checkIn),
            roomType,
            calculatedRate.baseRate
          );
          
          calculatedRate.seasonalAdjustment = seasonalAdjustment;
          calculatedRate.finalRate = calculatedRate.baseRate + seasonalAdjustment;
        } catch (seasonalError) {
          // Continue without seasonal adjustment if service fails
          calculatedRate.finalRate = calculatedRate.baseRate;
          calculatedRate.seasonalAdjustment = 0;
        }
      } else {
        calculatedRate.finalRate = calculatedRate.baseRate;
        calculatedRate.seasonalAdjustment = 0;
      }
      
      return {
        available: true,
        rate: calculatedRate,
        rateInfo: {
          rateId: rate.rateId,
          rateName: rate.rateName,
          rateType: rate.rateType,
          validityPeriod: rate.validityPeriod,
          cancellationPolicy: rate.cancellationPolicy
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to calculate rate: ${error.message}`);
    }
  }
  
  // Helper Methods
  
  detectChanges(original, updates) {
    const changes = [];
    
    Object.keys(updates).forEach(key => {
      if (JSON.stringify(original[key]) !== JSON.stringify(updates[key])) {
        changes.push({
          field: key,
          oldValue: original[key],
          newValue: updates[key],
          reason: 'Rate update'
        });
      }
    });
    
    return changes;
  }
  
  async updateGroupAnalytics(groupId, session = null) {
    const options = session ? { session } : {};
    
    const rateCount = await CentralizedRate.countDocuments({
      'propertyGroup.groupId': groupId,
      isActive: true
    }, options);
    
    await PropertyGroup.findByIdAndUpdate(
      groupId,
      {
        $set: {
          'analytics.totalRates': rateCount,
          'analytics.lastSyncDate': new Date()
        }
      },
      { ...options, new: true }
    );
  }
  
  async updateSyncStatistics(groupId, results) {
    await PropertyGroup.findByIdAndUpdate(
      groupId,
      {
        $set: {
          'analytics.lastSyncDate': new Date(),
          'analytics.syncSuccess': results.failed?.length === 0
        }
      }
    );
  }
  
  async setPriority(rateId, priority) {
    await CentralizedRate.findByIdAndUpdate(
      rateId,
      { $set: { 'conflictResolution.priority': priority } }
    );
  }
  
  async mergeRates(rateId1, rateId2, mergedBy) {
    // Implementation for merging conflicting rates
    // This would depend on specific business rules
    console.log(`Merging rates ${rateId1} and ${rateId2} by ${mergedBy}`);
    // Placeholder implementation
  }
  
  // Validation Methods
  
  validateRateData(rateData) {
    const errors = [];
    
    if (!rateData.rateName) errors.push('Rate name is required');
    if (!rateData.propertyGroup?.groupId) errors.push('Property group is required');
    if (!rateData.basePricing?.basePrice || rateData.basePricing.basePrice <= 0) {
      errors.push('Valid base price is required');
    }
    if (!rateData.validityPeriod?.startDate || !rateData.validityPeriod?.endDate) {
      errors.push('Validity period dates are required');
    }
    if (new Date(rateData.validityPeriod?.startDate) >= new Date(rateData.validityPeriod?.endDate)) {
      errors.push('End date must be after start date');
    }
    
    return errors;
  }
}

export default new CentralizedRateService();