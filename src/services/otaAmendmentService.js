import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import logger from '../utils/logger.js';
import websocketService from './websocketService.js';
import emailService from './emailService.js';
import queueService from './queueService.js';

class OTAAmendmentService {
  constructor() {
    this.processingQueue = [];
    this.autoApprovalRules = new Map();
    this.conflictResolutionStrategies = new Map();
    this.amendmentValidators = new Map();
    
    this.initializeDefaultRules();
  }

  /**
   * Initialize default auto-approval rules and validators
   */
  initializeDefaultRules() {
    // Auto-approval rules for low-risk amendments
    this.autoApprovalRules.set('special_request_change', {
      enabled: true,
      maxValueChange: 0, // No monetary impact
      requiresManualReview: false
    });

    this.autoApprovalRules.set('guest_details_change', {
      enabled: true,
      maxValueChange: 0,
      requiresManualReview: false,
      excludedFields: ['email', 'phone'] // These need verification
    });

    // Validators for different amendment types
    this.amendmentValidators.set('dates_change', this.validateDateChange.bind(this));
    this.amendmentValidators.set('rate_change', this.validateRateChange.bind(this));
    this.amendmentValidators.set('room_change', this.validateRoomChange.bind(this));
    this.amendmentValidators.set('cancellation_request', this.validateCancellation.bind(this));
  }

  /**
   * Process incoming OTA amendment with full workflow
   */
  async processIncomingAmendment(bookingId, amendmentData) {
    try {
      logger.info(`Processing OTA amendment for booking ${bookingId}`, {
        amendmentType: amendmentData.type,
        channel: amendmentData.channel
      });

      // Find and lock the booking
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
      }

      // Validate the amendment request
      await this.validateAmendmentRequest(booking, amendmentData);

      // Check for conflicts with existing amendments
      const conflicts = await this.checkAmendmentConflicts(booking, amendmentData);
      if (conflicts.length > 0) {
        return await this.handleAmendmentConflicts(booking, amendmentData, conflicts);
      }

      // Process the amendment
      const amendmentId = await booking.processOTAAmendment(amendmentData, {
        validateInventory: true,
        checkConflicts: true
      });

      await booking.save();

      // Determine if auto-approval is possible
      const autoApprovalDecision = await this.evaluateAutoApproval(booking, amendmentId);
      
      if (autoApprovalDecision.canAutoApprove) {
        logger.info(`Auto-approving amendment ${amendmentId}`, autoApprovalDecision.reason);
        
        await this.approveAmendment(bookingId, amendmentId, {
          userId: 'system',
          userName: 'Auto-Approval System',
          autoApproved: true,
          approvalReason: autoApprovalDecision.reason
        });
      } else {
        // Queue for manual review
        await this.queueForManualReview(booking, amendmentId, autoApprovalDecision.reason);
      }

      // Send notifications
      await this.sendAmendmentNotifications(booking, amendmentId, amendmentData);

      return {
        success: true,
        amendmentId,
        status: autoApprovalDecision.canAutoApprove ? 'auto_approved' : 'pending_review',
        message: autoApprovalDecision.reason
      };

    } catch (error) {
      logger.error('Failed to process OTA amendment:', error);
      throw error;
    }
  }

  /**
   * Validate amendment request against business rules
   */
  async validateAmendmentRequest(booking, amendmentData) {
    const validator = this.amendmentValidators.get(amendmentData.type);
    if (validator) {
      await validator(booking, amendmentData);
    }

    // General validations
    if (booking.status === 'cancelled') {
      throw new Error('Cannot amend cancelled booking');
    }

    if (booking.status === 'checked_out') {
      throw new Error('Cannot amend completed booking');
    }

    // Check amendment window
    const now = new Date();
    const checkIn = new Date(booking.checkIn);
    const hoursUntilCheckIn = (checkIn - now) / (1000 * 60 * 60);
    
    if (hoursUntilCheckIn < 2 && amendmentData.type !== 'cancellation_request') {
      throw new Error('Amendment window closed - too close to check-in time');
    }

    return true;
  }

  /**
   * Validate date change amendments
   */
  async validateDateChange(booking, amendmentData) {
    const { requestedChanges } = amendmentData;
    
    if (requestedChanges.checkIn) {
      const newCheckIn = new Date(requestedChanges.checkIn);
      const today = new Date();
      
      if (newCheckIn < today) {
        throw new Error('Cannot change check-in to a past date');
      }
    }

    if (requestedChanges.checkOut) {
      const newCheckOut = new Date(requestedChanges.checkOut);
      const checkIn = new Date(requestedChanges.checkIn || booking.checkIn);
      
      if (newCheckOut <= checkIn) {
        throw new Error('Check-out date must be after check-in date');
      }
    }

    // Check room availability for new dates
    if (requestedChanges.checkIn || requestedChanges.checkOut) {
      const roomIds = booking.rooms.map(r => r.roomId);
      const overlapping = await Booking.findOverlapping(
        roomIds,
        requestedChanges.checkIn || booking.checkIn,
        requestedChanges.checkOut || booking.checkOut,
        booking._id
      );

      if (overlapping.length > 0) {
        throw new Error('Room not available for requested dates');
      }
    }

    return true;
  }

  /**
   * Validate rate change amendments
   */
  async validateRateChange(booking, amendmentData) {
    const { requestedChanges } = amendmentData;
    
    if (requestedChanges.totalAmount) {
      const currentAmount = booking.totalAmount;
      const newAmount = requestedChanges.totalAmount;
      const changePercentage = Math.abs((newAmount - currentAmount) / currentAmount) * 100;

      // Flag significant rate changes for manual review
      if (changePercentage > 20) {
        amendmentData.requiresManualApproval = true;
        amendmentData.flagReason = `Significant rate change: ${changePercentage.toFixed(1)}%`;
      }
    }

    return true;
  }

  /**
   * Validate room change amendments
   */
  async validateRoomChange(booking, amendmentData) {
    const { requestedChanges } = amendmentData;
    
    if (requestedChanges.rooms) {
      // Check if requested rooms are available
      const requestedRoomIds = requestedChanges.rooms.map(r => r.roomId);
      const overlapping = await Booking.findOverlapping(
        requestedRoomIds,
        booking.checkIn,
        booking.checkOut,
        booking._id
      );

      if (overlapping.length > 0) {
        throw new Error('Requested rooms are not available');
      }
    }

    return true;
  }

  /**
   * Validate cancellation requests
   */
  async validateCancellation(booking, amendmentData) {
    // Check cancellation policy
    if (!booking.canCancel() && !amendmentData.bypassPolicy) {
      throw new Error('Booking cannot be cancelled due to policy restrictions');
    }

    return true;
  }

  /**
   * Check for conflicts with existing amendments
   */
  async checkAmendmentConflicts(booking, newAmendment) {
    const conflicts = [];
    
    if (!booking.otaAmendments || booking.otaAmendments.length === 0) {
      return conflicts;
    }

    for (const existingAmendment of booking.otaAmendments) {
      if (existingAmendment.amendmentStatus === 'pending') {
        const conflict = this.detectConflict(existingAmendment, newAmendment);
        if (conflict) {
          conflicts.push({
            amendmentId: existingAmendment.amendmentId,
            conflictType: conflict.type,
            description: conflict.description
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect conflicts between amendments
   */
  detectConflict(existingAmendment, newAmendment) {
    const existingChanges = existingAmendment.requestedChanges;
    const newChanges = newAmendment.requestedChanges;

    // Check for field conflicts
    const conflictingFields = Object.keys(existingChanges).filter(
      field => newChanges.hasOwnProperty(field)
    );

    if (conflictingFields.length > 0) {
      return {
        type: 'field_conflict',
        description: `Conflicting changes to: ${conflictingFields.join(', ')}`
      };
    }

    // Check for business logic conflicts
    if (existingAmendment.amendmentType === 'cancellation_request' && 
        newAmendment.type !== 'cancellation_request') {
      return {
        type: 'cancellation_conflict',
        description: 'Cannot modify booking with pending cancellation'
      };
    }

    return null;
  }

  /**
   * Handle amendment conflicts
   */
  async handleAmendmentConflicts(booking, newAmendment, conflicts) {
    logger.warn(`Amendment conflicts detected for booking ${booking._id}`, { conflicts });

    // Auto-resolve simple conflicts if possible
    const resolutionStrategy = this.conflictResolutionStrategies.get(conflicts[0].conflictType);
    
    if (resolutionStrategy) {
      const resolution = await resolutionStrategy(booking, newAmendment, conflicts);
      if (resolution.resolved) {
        return resolution;
      }
    }

    // Queue for manual conflict resolution
    await this.queueConflictResolution(booking, newAmendment, conflicts);

    return {
      success: false,
      status: 'conflict_detected',
      conflicts,
      message: 'Amendment conflicts require manual resolution'
    };
  }

  /**
   * Evaluate if amendment can be auto-approved
   */
  async evaluateAutoApproval(booking, amendmentId) {
    const amendment = booking.otaAmendments.find(a => a.amendmentId === amendmentId);
    if (!amendment) {
      return { canAutoApprove: false, reason: 'Amendment not found' };
    }

    // Check if manual approval is explicitly required
    if (amendment.requiresManualApproval) {
      return { canAutoApprove: false, reason: 'Manual approval required' };
    }

    // Check auto-approval rules
    const rule = this.autoApprovalRules.get(amendment.amendmentType);
    if (!rule || !rule.enabled) {
      return { canAutoApprove: false, reason: 'No auto-approval rule defined' };
    }

    // Calculate value impact
    const valueImpact = await this.calculateAmendmentValueImpact(booking, amendment);
    if (valueImpact > rule.maxValueChange) {
      return { 
        canAutoApprove: false, 
        reason: `Value impact (${valueImpact}) exceeds threshold (${rule.maxValueChange})` 
      };
    }

    // Check booking status
    if (booking.status === 'checked_in') {
      return { canAutoApprove: false, reason: 'Guest is checked in' };
    }

    // Check time constraints
    const now = new Date();
    const checkIn = new Date(booking.checkIn);
    const hoursUntilCheckIn = (checkIn - now) / (1000 * 60 * 60);
    
    if (hoursUntilCheckIn < 24 && amendment.amendmentType === 'dates_change') {
      return { canAutoApprove: false, reason: 'Date changes require manual review within 24 hours' };
    }

    return { canAutoApprove: true, reason: 'Amendment meets auto-approval criteria' };
  }

  /**
   * Calculate the financial impact of an amendment
   */
  async calculateAmendmentValueImpact(booking, amendment) {
    const originalAmount = booking.totalAmount;
    let newAmount = originalAmount;

    // Calculate new amount based on requested changes
    if (amendment.requestedChanges.totalAmount) {
      newAmount = amendment.requestedChanges.totalAmount;
    }

    return Math.abs(newAmount - originalAmount);
  }

  /**
   * Approve an amendment
   */
  async approveAmendment(bookingId, amendmentId, approverInfo) {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
      }

      await booking.resolveAmendment(amendmentId, 'approved', approverInfo);
      await booking.save();

      // Send confirmation to OTA
      await this.sendAmendmentConfirmationToOTA(booking, amendmentId, 'approved');

      // Send notifications
      await this.sendAmendmentApprovalNotifications(booking, amendmentId);

      logger.info(`Amendment ${amendmentId} approved for booking ${bookingId}`);

      return {
        success: true,
        amendmentId,
        status: 'approved'
      };

    } catch (error) {
      logger.error(`Failed to approve amendment ${amendmentId}:`, error);
      throw error;
    }
  }

  /**
   * Reject an amendment
   */
  async rejectAmendment(bookingId, amendmentId, rejectionInfo) {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
      }

      await booking.resolveAmendment(amendmentId, 'rejected', rejectionInfo);
      await booking.save();

      // Send rejection to OTA
      await this.sendAmendmentConfirmationToOTA(booking, amendmentId, 'rejected');

      // Send notifications
      await this.sendAmendmentRejectionNotifications(booking, amendmentId);

      logger.info(`Amendment ${amendmentId} rejected for booking ${bookingId}`);

      return {
        success: true,
        amendmentId,
        status: 'rejected'
      };

    } catch (error) {
      logger.error(`Failed to reject amendment ${amendmentId}:`, error);
      throw error;
    }
  }

  /**
   * Queue amendment for manual review
   */
  async queueForManualReview(booking, amendmentId, reason) {
    const reviewItem = {
      bookingId: booking._id,
      amendmentId,
      channel: booking.channel,
      amendmentType: booking.otaAmendments.find(a => a.amendmentId === amendmentId)?.amendmentType,
      priority: this.calculateReviewPriority(booking),
      reason,
      queuedAt: new Date()
    };

    // Add to queue service for processing
    await queueService.add('amendment-review', reviewItem, {
      priority: reviewItem.priority,
      delay: 0
    });

    // Send to staff dashboard via WebSocket
    websocketService.emit('amendment-review-required', {
      booking: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        guestName: booking.guestInfo.name,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut
      },
      amendment: reviewItem
    });

    logger.info(`Amendment ${amendmentId} queued for manual review`, { reason });
  }

  /**
   * Calculate review priority based on various factors
   */
  calculateReviewPriority(booking) {
    let priority = 5; // Default priority

    // Higher priority for closer check-in dates
    const now = new Date();
    const checkIn = new Date(booking.checkIn);
    const hoursUntilCheckIn = (checkIn - now) / (1000 * 60 * 60);

    if (hoursUntilCheckIn < 24) priority = 10; // Urgent
    else if (hoursUntilCheckIn < 72) priority = 8; // High
    else if (hoursUntilCheckIn < 168) priority = 6; // Medium

    // Higher priority for high-value bookings
    if (booking.totalAmount > 1000) priority += 2;

    // Higher priority for VIP guests
    if (booking.guestInfo.vipStatus) priority += 3;

    return Math.min(priority, 10); // Cap at 10
  }

  /**
   * Send amendment confirmation back to OTA
   */
  async sendAmendmentConfirmationToOTA(booking, amendmentId, decision) {
    const amendment = booking.otaAmendments.find(a => a.amendmentId === amendmentId);
    if (!amendment) return;

    // This would integrate with the specific OTA's API
    const confirmation = {
      channelBookingId: booking.channelBookingId,
      channelAmendmentId: amendment.channelAmendmentId,
      status: decision,
      confirmationId: `CNF-${amendmentId}`,
      timestamp: new Date()
    };

    try {
      // Send to channel-specific service
      const channelService = await this.getChannelService(booking.channel);
      if (channelService) {
        await channelService.sendAmendmentConfirmation(confirmation);
      }
      
      logger.info(`Amendment confirmation sent to ${booking.channel}`, confirmation);
    } catch (error) {
      logger.error('Failed to send amendment confirmation to OTA:', error);
    }
  }

  /**
   * Send amendment notifications to relevant stakeholders
   */
  async sendAmendmentNotifications(booking, amendmentId, amendmentData) {
    const notifications = [];

    // Notify front desk staff
    notifications.push({
      type: 'amendment_received',
      recipients: ['front-desk', 'reservations'],
      data: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        amendmentId,
        amendmentType: amendmentData.type,
        guestName: booking.guestInfo.name,
        channel: amendmentData.channel
      }
    });

    // Send notifications
    for (const notification of notifications) {
      websocketService.emit(notification.type, notification.data, notification.recipients);
    }
  }

  /**
   * Send amendment approval notifications
   */
  async sendAmendmentApprovalNotifications(booking, amendmentId) {
    // Implementation for approval notifications
    websocketService.emit('amendment_approved', {
      bookingId: booking._id,
      amendmentId,
      bookingNumber: booking.bookingNumber
    });
  }

  /**
   * Send amendment rejection notifications  
   */
  async sendAmendmentRejectionNotifications(booking, amendmentId) {
    // Implementation for rejection notifications
    websocketService.emit('amendment_rejected', {
      bookingId: booking._id,
      amendmentId,
      bookingNumber: booking.bookingNumber
    });
  }

  /**
   * Queue conflict resolution
   */
  async queueConflictResolution(booking, newAmendment, conflicts) {
    const conflictItem = {
      bookingId: booking._id,
      newAmendment,
      conflicts,
      priority: 10, // High priority for conflicts
      queuedAt: new Date()
    };

    await queueService.add('amendment-conflict-resolution', conflictItem, {
      priority: 10,
      delay: 0
    });
  }

  /**
   * Get channel-specific service
   */
  async getChannelService(channel) {
    // This would return channel-specific integration services
    // Implementation depends on available channel services
    return null;
  }

  /**
   * Get pending amendments for review dashboard
   */
  async getPendingAmendments(filters = {}) {
    const query = {
      'otaAmendments.amendmentStatus': 'pending'
    };

    if (filters.channel) {
      query.channel = filters.channel;
    }

    if (filters.priority) {
      // This would need to be calculated or stored
    }

    const bookings = await Booking.find(query)
      .populate('rooms.roomId', 'number type')
      .sort({ 'amendmentFlags.lastAmendmentDate': -1 })
      .limit(filters.limit || 50);

    return bookings.map(booking => ({
      booking: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        guestName: booking.guestInfo.name,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        status: booking.status,
        channel: booking.channel
      },
      pendingAmendments: booking.otaAmendments.filter(a => a.amendmentStatus === 'pending')
    }));
  }
}

export default new OTAAmendmentService();