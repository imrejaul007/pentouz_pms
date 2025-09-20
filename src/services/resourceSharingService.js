import mongoose from 'mongoose';
import SharedResource from '../models/SharedResource.js';
import PropertyGroup from '../models/PropertyGroup.js';
import Hotel from '../models/Hotel.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import cacheService from './cacheService.js';
import eventPublisher from './eventPublisher.js';

/**
 * Resource Sharing Service
 * Handles cross-property resource sharing, scheduling, and management
 */

class ResourceSharingService {
  constructor() {
    this.cacheExpiry = 900; // 15 minutes cache for resource data
  }

  /**
   * Create a new shared resource
   * @param {Object} resourceData - Resource data
   * @param {string} userId - User creating the resource
   */
  async createSharedResource(resourceData, userId) {
    try {
      // Validate property group membership
      const property = await Hotel.findById(resourceData.ownerPropertyId)
        .populate('propertyGroupId');
      
      if (!property || !property.propertyGroupId) {
        throw new Error('Property must belong to a property group to share resources');
      }

      // Create resource
      const resource = new SharedResource({
        ...resourceData,
        propertyGroupId: property.propertyGroupId._id,
        location: {
          currentPropertyId: resourceData.ownerPropertyId,
          specificLocation: resourceData.location?.specificLocation,
          isPortable: resourceData.location?.isPortable || false,
          transportationCost: resourceData.location?.transportationCost || 0,
          transportationTime: resourceData.location?.transportationTime || 0
        },
        createdBy: userId
      });

      await resource.save();

      // Publish resource creation event
      await eventPublisher.publishResourceEvent({
        type: 'resource_created',
        resourceId: resource._id,
        resourceType: resource.type,
        propertyGroupId: resource.propertyGroupId,
        ownerPropertyId: resource.ownerPropertyId,
        createdBy: userId
      });

      logger.info(`Shared resource created: ${resource._id}`, {
        resourceType: resource.type,
        ownerPropertyId: resource.ownerPropertyId,
        createdBy: userId
      });

      return {
        success: true,
        message: 'Shared resource created successfully',
        data: await resource.populate([
          { path: 'ownerPropertyId', select: 'name address.city' },
          { path: 'propertyGroupId', select: 'name' },
          { path: 'createdBy', select: 'name email' }
        ])
      };

    } catch (error) {
      logger.error('Error creating shared resource:', error);
      throw new Error(`Failed to create shared resource: ${error.message}`);
    }
  }

  /**
   * Get accessible resources for a property
   * @param {string} propertyId - Property ID
   * @param {Object} filters - Resource filters
   */
  async getAccessibleResources(propertyId, filters = {}) {
    const cacheKey = `accessible-resources:${propertyId}:${JSON.stringify(filters)}`;

    try {
      const cachedResources = await cacheService.get(cacheKey);
      if (cachedResources) {
        return cachedResources;
      }

      const resources = await SharedResource.findAccessibleByProperty(propertyId, filters);

      // Enrich with accessibility information
      const enrichedResources = resources.map(resource => ({
        ...resource.toObject(),
        accessLevel: this.getAccessLevel(resource, propertyId),
        isOwner: resource.ownerPropertyId._id.toString() === propertyId.toString(),
        currentDistance: this.calculateDistance(resource, propertyId),
        estimatedCost: this.calculateEstimatedCost(resource, propertyId),
        nextAvailable: this.getNextAvailableSlot(resource)
      }));

      await cacheService.set(cacheKey, enrichedResources, this.cacheExpiry);

      return enrichedResources;

    } catch (error) {
      logger.error('Error getting accessible resources:', error);
      throw new Error(`Failed to get accessible resources: ${error.message}`);
    }
  }

  /**
   * Request access to a shared resource
   * @param {string} resourceId - Resource ID
   * @param {string} requestingPropertyId - Requesting property ID
   * @param {string} userId - User making the request
   * @param {Object} requestDetails - Request details
   */
  async requestResourceAccess(resourceId, requestingPropertyId, userId, requestDetails) {
    try {
      const resource = await SharedResource.findById(resourceId)
        .populate('ownerPropertyId', 'name');

      if (!resource) {
        throw new Error('Resource not found');
      }

      // Check if already has access
      if (resource.canBeAccessedBy(requestingPropertyId, 'view')) {
        throw new Error('Property already has access to this resource');
      }

      // Create access request
      await resource.requestAccess(requestingPropertyId, userId, requestDetails.requestType || 'access');

      // Notify owner property
      await this.notifyResourceOwner(resource, requestingPropertyId, userId, requestDetails);

      // Publish access request event
      await eventPublisher.publishResourceEvent({
        type: 'access_requested',
        resourceId: resource._id,
        requestingPropertyId,
        ownerPropertyId: resource.ownerPropertyId,
        requestedBy: userId,
        requestDetails
      });

      logger.info(`Resource access requested: ${resourceId}`, {
        requestingPropertyId,
        userId,
        requestType: requestDetails.requestType
      });

      return {
        success: true,
        message: 'Access request submitted successfully',
        requestId: resource.approvalWorkflow[resource.approvalWorkflow.length - 1]._id
      };

    } catch (error) {
      logger.error('Error requesting resource access:', error);
      throw new Error(`Failed to request resource access: ${error.message}`);
    }
  }

  /**
   * Approve or reject resource access request
   * @param {string} resourceId - Resource ID
   * @param {string} requestId - Request ID
   * @param {string} action - 'approve' or 'reject'
   * @param {string} userId - User making the decision
   * @param {Object} options - Additional options
   */
  async processAccessRequest(resourceId, requestId, action, userId, options = {}) {
    try {
      const resource = await SharedResource.findById(resourceId);
      if (!resource) {
        throw new Error('Resource not found');
      }

      const request = resource.approvalWorkflow.find(req => req._id.toString() === requestId);
      if (!request) {
        throw new Error('Access request not found');
      }

      if (request.status !== 'pending') {
        throw new Error('Request has already been processed');
      }

      // Update request status
      request.status = action === 'approve' ? 'approved' : 'rejected';
      request.approvedBy = userId;
      request.approvedAt = new Date();

      if (action === 'reject') {
        request.rejectionReason = options.rejectionReason || 'No reason provided';
      }

      // If approved, add to shared resources
      if (action === 'approve') {
        const existingShare = resource.sharedWith.find(share => 
          share.propertyId.toString() === request.requestingPropertyId.toString()
        );

        if (existingShare) {
          existingShare.status = 'active';
          existingShare.approvedBy = userId;
          existingShare.approvedAt = new Date();
        } else {
          resource.sharedWith.push({
            propertyId: request.requestingPropertyId,
            permissions: options.permissions || ['view', 'book'],
            approvedBy: userId,
            approvedAt: new Date(),
            status: 'active'
          });
        }
      }

      await resource.save();

      // Clear cache for affected properties
      await this.clearResourceCache(resourceId, [resource.ownerPropertyId, request.requestingPropertyId]);

      // Notify requesting property
      await this.notifyRequestingProperty(resource, request, action, options);

      // Publish approval event
      await eventPublisher.publishResourceEvent({
        type: `access_${action}ed`,
        resourceId,
        requestingPropertyId: request.requestingPropertyId,
        ownerPropertyId: resource.ownerPropertyId,
        processedBy: userId,
        permissions: options.permissions
      });

      logger.info(`Resource access request ${action}ed: ${resourceId}`, {
        requestId,
        requestingPropertyId: request.requestingPropertyId,
        processedBy: userId
      });

      return {
        success: true,
        message: `Access request ${action}ed successfully`,
        resource: await resource.populate([
          { path: 'ownerPropertyId', select: 'name' },
          { path: 'sharedWith.propertyId', select: 'name' }
        ])
      };

    } catch (error) {
      logger.error('Error processing access request:', error);
      throw new Error(`Failed to process access request: ${error.message}`);
    }
  }

  /**
   * Schedule resource usage
   * @param {string} resourceId - Resource ID
   * @param {string} propertyId - Property using the resource
   * @param {string} userId - User making the booking
   * @param {Object} bookingDetails - Booking details
   */
  async scheduleResourceUsage(resourceId, propertyId, userId, bookingDetails) {
    try {
      const resource = await SharedResource.findById(resourceId)
        .populate('ownerPropertyId', 'name')
        .populate('location.currentPropertyId', 'name address');

      if (!resource) {
        throw new Error('Resource not found');
      }

      // Check access permissions
      if (!resource.canBeAccessedBy(propertyId, 'book')) {
        throw new Error('Property does not have booking permission for this resource');
      }

      // Validate booking details
      const { startDate, endDate, purpose, notes } = bookingDetails;
      
      if (new Date(startDate) >= new Date(endDate)) {
        throw new Error('End date must be after start date');
      }

      if (new Date(startDate) < new Date()) {
        throw new Error('Cannot schedule usage in the past');
      }

      // Schedule the usage
      await resource.scheduleUsage(propertyId, userId, new Date(startDate), new Date(endDate), purpose, notes);

      // Calculate estimated cost
      const estimatedCost = this.calculateBookingCost(resource, propertyId, startDate, endDate);

      // If resource needs to be transported, create logistics plan
      let logisticsPlan = null;
      if (resource.location.currentPropertyId.toString() !== propertyId.toString() && resource.location.isPortable) {
        logisticsPlan = await this.createLogisticsPlan(resource, propertyId, startDate);
      }

      // Notify relevant parties
      await this.notifyResourceBooking(resource, propertyId, userId, bookingDetails, estimatedCost);

      // Publish booking event
      await eventPublisher.publishResourceEvent({
        type: 'resource_booked',
        resourceId,
        propertyId,
        userId,
        startDate,
        endDate,
        estimatedCost,
        logisticsPlan
      });

      logger.info(`Resource usage scheduled: ${resourceId}`, {
        propertyId,
        userId,
        startDate,
        endDate,
        estimatedCost
      });

      return {
        success: true,
        message: 'Resource usage scheduled successfully',
        bookingId: resource.availability.schedule[resource.availability.schedule.length - 1]._id,
        estimatedCost,
        logisticsPlan,
        resource: await resource.populate('availability.schedule.propertyId', 'name')
      };

    } catch (error) {
      logger.error('Error scheduling resource usage:', error);
      throw new Error(`Failed to schedule resource usage: ${error.message}`);
    }
  }

  /**
   * Start resource usage
   * @param {string} resourceId - Resource ID
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User starting the usage
   */
  async startResourceUsage(resourceId, bookingId, userId) {
    try {
      const resource = await SharedResource.findById(resourceId);
      if (!resource) {
        throw new Error('Resource not found');
      }

      const booking = resource.availability.schedule.find(b => b._id.toString() === bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'confirmed' && booking.status !== 'scheduled') {
        throw new Error('Booking is not in a valid state to start');
      }

      // Update booking status
      booking.status = 'in_progress';

      // Update resource availability
      resource.availability.status = 'in_use';
      resource.availability.currentlyUsedBy = {
        propertyId: booking.propertyId,
        userId,
        startTime: new Date(),
        estimatedEndTime: booking.endDate
      };

      await resource.save();

      // Clear cache
      await this.clearResourceCache(resourceId);

      // Publish usage start event
      await eventPublisher.publishResourceEvent({
        type: 'resource_usage_started',
        resourceId,
        propertyId: booking.propertyId,
        userId,
        bookingId
      });

      logger.info(`Resource usage started: ${resourceId}`, {
        bookingId,
        propertyId: booking.propertyId,
        userId
      });

      return {
        success: true,
        message: 'Resource usage started successfully',
        startTime: new Date()
      };

    } catch (error) {
      logger.error('Error starting resource usage:', error);
      throw new Error(`Failed to start resource usage: ${error.message}`);
    }
  }

  /**
   * End resource usage and record usage data
   * @param {string} resourceId - Resource ID
   * @param {string} userId - User ending the usage
   * @param {Object} usageData - Usage completion data
   */
  async endResourceUsage(resourceId, userId, usageData = {}) {
    try {
      const resource = await SharedResource.findById(resourceId);
      if (!resource) {
        throw new Error('Resource not found');
      }

      if (resource.availability.status !== 'in_use') {
        throw new Error('Resource is not currently in use');
      }

      const currentUsage = resource.availability.currentlyUsedBy;
      if (!currentUsage) {
        throw new Error('No current usage found');
      }

      const endTime = new Date();
      const startTime = currentUsage.startTime;
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000); // minutes

      // Calculate actual cost
      const actualCost = this.calculateActualCost(resource, currentUsage.propertyId, startTime, endTime);

      // Add usage entry
      await resource.addUsageEntry(
        currentUsage.propertyId,
        currentUsage.userId,
        startTime,
        endTime,
        {
          cost: actualCost,
          rating: usageData.rating,
          feedback: usageData.feedback,
          status: 'completed'
        }
      );

      // Update booking status
      const activeBooking = resource.availability.schedule.find(booking =>
        booking.propertyId.toString() === currentUsage.propertyId.toString() &&
        booking.status === 'in_progress'
      );

      if (activeBooking) {
        activeBooking.status = 'completed';
      }

      // Update resource condition if provided
      if (usageData.condition) {
        resource.condition.status = usageData.condition;
        resource.condition.lastInspection = new Date();
      }

      await resource.save();

      // Clear cache
      await this.clearResourceCache(resourceId);

      // Generate invoice if needed
      if (actualCost > 0) {
        await this.generateResourceUsageInvoice(resource, currentUsage.propertyId, actualCost, duration);
      }

      // Publish usage end event
      await eventPublisher.publishResourceEvent({
        type: 'resource_usage_ended',
        resourceId,
        propertyId: currentUsage.propertyId,
        userId,
        duration,
        actualCost,
        rating: usageData.rating
      });

      logger.info(`Resource usage ended: ${resourceId}`, {
        propertyId: currentUsage.propertyId,
        duration,
        actualCost,
        userId
      });

      return {
        success: true,
        message: 'Resource usage ended successfully',
        usageData: {
          duration,
          actualCost,
          startTime,
          endTime,
          rating: usageData.rating
        }
      };

    } catch (error) {
      logger.error('Error ending resource usage:', error);
      throw new Error(`Failed to end resource usage: ${error.message}`);
    }
  }

  /**
   * Transfer resource to another property
   * @param {string} resourceId - Resource ID
   * @param {string} targetPropertyId - Target property ID
   * @param {string} userId - User initiating transfer
   * @param {Object} transferDetails - Transfer details
   */
  async transferResource(resourceId, targetPropertyId, userId, transferDetails = {}) {
    try {
      const resource = await SharedResource.findById(resourceId)
        .populate('ownerPropertyId', 'name address')
        .populate('location.currentPropertyId', 'name address');

      if (!resource) {
        throw new Error('Resource not found');
      }

      // Verify transfer permissions
      if (!resource.canBeAccessedBy(targetPropertyId, 'transfer')) {
        throw new Error('Target property does not have transfer permission');
      }

      // Check if resource is portable
      if (!resource.location.isPortable) {
        throw new Error('Resource is not portable and cannot be transferred');
      }

      // Check if resource is currently available
      if (resource.availability.status !== 'available') {
        throw new Error('Resource is not available for transfer');
      }

      const currentPropertyId = resource.location.currentPropertyId._id;
      
      // Calculate transfer logistics
      const transferPlan = {
        fromProperty: resource.location.currentPropertyId,
        toProperty: targetPropertyId,
        estimatedCost: resource.location.transportationCost || 0,
        estimatedTime: resource.location.transportationTime || 60,
        scheduledDate: transferDetails.scheduledDate || new Date(),
        reason: transferDetails.reason || 'Resource transfer',
        requestedBy: userId
      };

      // Update resource location
      resource.location.currentPropertyId = targetPropertyId;
      resource.location.specificLocation = transferDetails.specificLocation || '';

      // Add transfer record
      if (!resource.transferHistory) {
        resource.transferHistory = [];
      }
      
      resource.transferHistory.push({
        fromPropertyId: currentPropertyId,
        toPropertyId: targetPropertyId,
        transferredAt: new Date(),
        transferredBy: userId,
        reason: transferDetails.reason || 'Resource transfer',
        cost: transferPlan.estimatedCost,
        notes: transferDetails.notes
      });

      await resource.save();

      // Clear cache for both properties
      await this.clearResourceCache(resourceId, [currentPropertyId, targetPropertyId]);

      // Notify both properties
      await this.notifyResourceTransfer(resource, currentPropertyId, targetPropertyId, userId, transferPlan);

      // Publish transfer event
      await eventPublisher.publishResourceEvent({
        type: 'resource_transferred',
        resourceId,
        fromPropertyId: currentPropertyId,
        toPropertyId: targetPropertyId,
        transferredBy: userId,
        transferPlan
      });

      logger.info(`Resource transferred: ${resourceId}`, {
        fromPropertyId: currentPropertyId,
        toPropertyId: targetPropertyId,
        transferredBy: userId
      });

      return {
        success: true,
        message: 'Resource transferred successfully',
        transferPlan,
        resource: await resource.populate('location.currentPropertyId', 'name address')
      };

    } catch (error) {
      logger.error('Error transferring resource:', error);
      throw new Error(`Failed to transfer resource: ${error.message}`);
    }
  }

  /**
   * Generate usage report for property group
   * @param {string} propertyGroupId - Property group ID
   * @param {Object} options - Report options
   */
  async generateUsageReport(propertyGroupId, options = {}) {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      resourceType = null,
      includeFinancials = true
    } = options;

    const cacheKey = `usage-report:${propertyGroupId}:${startDate.getTime()}:${endDate.getTime()}:${resourceType}`;

    try {
      const cachedReport = await cacheService.get(cacheKey);
      if (cachedReport) {
        return cachedReport;
      }

      // Get usage report from model
      const usageData = await SharedResource.getUsageReport(propertyGroupId, startDate, endDate);

      // Filter by resource type if specified
      const filteredData = resourceType 
        ? usageData.filter(item => item.resourceType === resourceType)
        : usageData;

      // Calculate summary statistics
      const summary = {
        totalResources: filteredData.length,
        totalUsages: filteredData.reduce((sum, item) => sum + item.totalUsages, 0),
        totalDuration: filteredData.reduce((sum, item) => sum + (item.totalDuration || 0), 0),
        totalCost: includeFinancials ? filteredData.reduce((sum, item) => sum + (item.totalCost || 0), 0) : null,
        averageRating: filteredData.length > 0 
          ? filteredData.reduce((sum, item) => sum + (item.averageRating || 0), 0) / filteredData.length 
          : 0,
        period: {
          startDate,
          endDate,
          days: Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
        }
      };

      // Group by resource type
      const byResourceType = {};
      filteredData.forEach(item => {
        if (!byResourceType[item.resourceType]) {
          byResourceType[item.resourceType] = {
            count: 0,
            totalUsages: 0,
            totalCost: 0,
            resources: []
          };
        }
        
        byResourceType[item.resourceType].count++;
        byResourceType[item.resourceType].totalUsages += item.totalUsages;
        byResourceType[item.resourceType].totalCost += item.totalCost || 0;
        byResourceType[item.resourceType].resources.push(item);
      });

      // Top performers
      const topResources = filteredData
        .sort((a, b) => b.totalUsages - a.totalUsages)
        .slice(0, 10);

      const topUsers = await this.getTopResourceUsers(propertyGroupId, startDate, endDate);

      const report = {
        propertyGroupId,
        reportType: 'resource_usage',
        summary,
        data: filteredData,
        byResourceType,
        topResources,
        topUsers,
        generatedAt: new Date()
      };

      await cacheService.set(cacheKey, report, this.cacheExpiry);

      logger.info(`Usage report generated: ${propertyGroupId}`, {
        totalResources: summary.totalResources,
        totalUsages: summary.totalUsages,
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
      });

      return report;

    } catch (error) {
      logger.error('Error generating usage report:', error);
      throw new Error(`Failed to generate usage report: ${error.message}`);
    }
  }

  // Helper methods

  getAccessLevel(resource, propertyId) {
    if (resource.ownerPropertyId._id.toString() === propertyId.toString()) {
      return 'owner';
    }

    if (resource.sharingPolicy === 'open') {
      return 'open';
    }

    const shareEntry = resource.sharedWith.find(share => 
      share.propertyId.toString() === propertyId.toString() &&
      share.status === 'active'
    );

    if (shareEntry) {
      return shareEntry.permissions.join(',');
    }

    return 'none';
  }

  calculateDistance(resource, propertyId) {
    // Simplified distance calculation - in real implementation, would use actual coordinates
    if (resource.location.currentPropertyId._id.toString() === propertyId.toString()) {
      return 0;
    }
    return resource.location.transportationTime || 60; // Default to 1 hour
  }

  calculateEstimatedCost(resource, propertyId) {
    if (resource.ownerPropertyId._id.toString() === propertyId.toString()) {
      return 0; // Owner doesn't pay
    }

    const baseCost = resource.costSharing?.baseCost || 0;
    const transportationCost = resource.location.currentPropertyId._id.toString() !== propertyId.toString()
      ? (resource.location.transportationCost || 0)
      : 0;

    return baseCost + transportationCost;
  }

  getNextAvailableSlot(resource) {
    const now = new Date();
    const activeBookings = resource.availability.schedule
      .filter(booking => booking.endDate > now && booking.status !== 'cancelled')
      .sort((a, b) => a.startDate - b.startDate);

    if (activeBookings.length === 0) {
      return now;
    }

    // Find gap between bookings
    for (let i = 0; i < activeBookings.length - 1; i++) {
      const currentEnd = activeBookings[i].endDate;
      const nextStart = activeBookings[i + 1].startDate;
      
      if (nextStart.getTime() - currentEnd.getTime() > 60 * 60 * 1000) { // 1 hour gap
        return currentEnd;
      }
    }

    // Return after last booking
    return activeBookings[activeBookings.length - 1].endDate;
  }

  calculateBookingCost(resource, propertyId, startDate, endDate) {
    const duration = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60); // hours
    const baseCost = resource.costSharing?.baseCost || 0;
    
    let totalCost = 0;

    switch (resource.costSharing?.model) {
      case 'usage_based':
        totalCost = baseCost * duration;
        break;
      case 'equal_split':
        totalCost = baseCost / (resource.sharedWith.length + 1); // +1 for owner
        break;
      case 'owner_pays':
        totalCost = 0;
        break;
      default:
        totalCost = baseCost;
    }

    // Add transportation cost if needed
    if (resource.location.currentPropertyId.toString() !== propertyId.toString()) {
      totalCost += resource.location.transportationCost || 0;
    }

    return Math.round(totalCost * 100) / 100; // Round to 2 decimal places
  }

  calculateActualCost(resource, propertyId, startTime, endTime) {
    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // hours
    return this.calculateBookingCost(resource, propertyId, startTime, endTime);
  }

  async createLogisticsPlan(resource, targetPropertyId, requiredBy) {
    try {
      const targetProperty = await Hotel.findById(targetPropertyId).select('name address');
      const currentProperty = await Hotel.findById(resource.location.currentPropertyId).select('name address');

      return {
        resourceId: resource._id,
        resourceName: resource.name,
        fromProperty: currentProperty,
        toProperty: targetProperty,
        estimatedTime: resource.location.transportationTime || 60,
        estimatedCost: resource.location.transportationCost || 0,
        requiredBy,
        status: 'planned',
        instructions: `Transport ${resource.name} from ${currentProperty.name} to ${targetProperty.name}`,
        contactInfo: {
          origin: currentProperty.contact,
          destination: targetProperty.contact
        }
      };
    } catch (error) {
      logger.error('Error creating logistics plan:', error);
      return null;
    }
  }

  async notifyResourceOwner(resource, requestingPropertyId, userId, requestDetails) {
    // Implementation would send notification to resource owner
    logger.info(`Notification sent to resource owner`, {
      resourceId: resource._id,
      ownerPropertyId: resource.ownerPropertyId,
      requestingPropertyId
    });
  }

  async notifyRequestingProperty(resource, request, action, options) {
    // Implementation would notify requesting property of decision
    logger.info(`Notification sent to requesting property`, {
      resourceId: resource._id,
      requestingPropertyId: request.requestingPropertyId,
      action
    });
  }

  async notifyResourceBooking(resource, propertyId, userId, bookingDetails, estimatedCost) {
    // Implementation would notify relevant parties of booking
    logger.info(`Booking notification sent`, {
      resourceId: resource._id,
      propertyId,
      estimatedCost
    });
  }

  async notifyResourceTransfer(resource, fromPropertyId, toPropertyId, userId, transferPlan) {
    // Implementation would notify both properties of transfer
    logger.info(`Transfer notification sent`, {
      resourceId: resource._id,
      fromPropertyId,
      toPropertyId
    });
  }

  async generateResourceUsageInvoice(resource, propertyId, cost, duration) {
    // Implementation would generate invoice for resource usage
    logger.info(`Invoice generated for resource usage`, {
      resourceId: resource._id,
      propertyId,
      cost,
      duration
    });
  }

  async getTopResourceUsers(propertyGroupId, startDate, endDate) {
    try {
      return await SharedResource.aggregate([
        {
          $match: {
            propertyGroupId: new mongoose.Types.ObjectId(propertyGroupId),
            'usageHistory.startTime': { $gte: startDate, $lte: endDate }
          }
        },
        { $unwind: '$usageHistory' },
        {
          $match: {
            'usageHistory.startTime': { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$usageHistory.userId',
            totalUsages: { $sum: 1 },
            totalDuration: { $sum: '$usageHistory.duration' },
            totalCost: { $sum: '$usageHistory.cost' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        {
          $project: {
            userId: '$_id',
            userName: { $arrayElemAt: ['$userInfo.name', 0] },
            totalUsages: 1,
            totalDuration: 1,
            totalCost: 1
          }
        },
        { $sort: { totalUsages: -1 } },
        { $limit: 10 }
      ]);
    } catch (error) {
      logger.error('Error getting top users:', error);
      return [];
    }
  }

  async clearResourceCache(resourceId, propertyIds = []) {
    try {
      const patterns = [
        `accessible-resources:*`,
        `usage-report:*`,
        `resource:${resourceId}:*`
      ];

      // Add property-specific patterns
      propertyIds.forEach(propertyId => {
        patterns.push(`accessible-resources:${propertyId}:*`);
      });

      let totalCleared = 0;
      for (const pattern of patterns) {
        const cleared = await cacheService.delPattern(pattern);
        totalCleared += cleared;
      }

      logger.debug(`Cleared ${totalCleared} cache entries for resource: ${resourceId}`);
      return totalCleared;

    } catch (error) {
      logger.error('Error clearing resource cache:', error);
    }
  }
}

// Create singleton instance
const resourceSharingService = new ResourceSharingService();

export default resourceSharingService;