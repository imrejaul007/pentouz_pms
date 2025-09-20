import StaffAlert from '../models/StaffAlert.js';
import MeetUpRequest from '../models/MeetUpRequest.js';
import logger from '../utils/logger.js';
import websocketService from './websocketService.js';

class MeetUpSupervisionAlertService {
  /**
   * Create supervision alert for a meet-up
   */
  async createSupervisionAlert(meetUpId, alertType = 'meetup_supervision_required', customData = {}) {
    try {
      const meetUp = await MeetUpRequest.findById(meetUpId)
        .populate('requesterId', 'name email')
        .populate('targetUserId', 'name email')
        .populate('hotelId', 'name');

      if (!meetUp) {
        throw new Error('Meet-up not found');
      }

      const supervisionData = this.assessSupervisionNeeds(meetUp);
      const alertPriority = this.determineAlertPriority(supervisionData);

      const alertData = {
        type: alertType,
        priority: alertPriority,
        title: this.generateAlertTitle(alertType, meetUp),
        message: this.generateAlertMessage(alertType, meetUp, supervisionData),
        category: 'safety',
        hotelId: meetUp.hotelId._id || meetUp.hotelId,
        createdBy: meetUp.requesterId._id || meetUp.requesterId,
        source: {
          type: 'meetup',
          id: meetUpId,
          details: {
            meetUpTitle: meetUp.title,
            requesterId: meetUp.requesterId._id || meetUp.requesterId,
            targetUserId: meetUp.targetUserId._id || meetUp.targetUserId,
            proposedDate: meetUp.proposedDate,
            location: meetUp.location,
            supervisionData
          }
        },
        metadata: {
          meetUpTitle: meetUp.title,
          meetUpDate: meetUp.proposedDate.toISOString(),
          meetUpLocation: meetUp.location.name,
          requesterName: meetUp.requesterId.name,
          targetUserName: meetUp.targetUserId.name,
          riskFactors: supervisionData.riskFactors,
          safetyLevel: supervisionData.safetyLevel.level,
          priorityScore: supervisionData.priorityScore,
          staffRequired: meetUp.safety?.hotelStaffPresent || false,
          ...customData
        },
        actionUrl: `/staff/meetup-supervision`,
        actionText: 'Review Meet-up'
      };

      // Assign to appropriate staff if possible
      if (supervisionData.priority === 'high') {
        // For high priority, assign to available supervisory staff
        const availableStaff = await this.findAvailableSupervisionStaff(meetUp.hotelId._id || meetUp.hotelId);
        if (availableStaff) {
          alertData.assignedTo = availableStaff._id;
        }
      }

      const alert = await StaffAlert.create(alertData);
      await alert.populate(['assignedTo', 'createdBy'], 'name email role');

      // Send WebSocket notification
      if (websocketService.isInitialized()) {
        const notificationData = {
          type: 'staff_alert',
          alert: {
            _id: alert._id,
            type: alert.type,
            priority: alert.priority,
            title: alert.title,
            message: alert.message,
            category: alert.category,
            metadata: alert.metadata,
            actionUrl: alert.actionUrl,
            actionText: alert.actionText,
            createdAt: alert.createdAt
          }
        };

        // Send to specific user if assigned, otherwise to all staff
        if (alert.assignedTo) {
          websocketService.sendToUser(alert.assignedTo._id, 'staff_notification', notificationData);
        } else {
          websocketService.sendToHotel(meetUp.hotelId._id || meetUp.hotelId, 'staff_notification', notificationData);
        }
      }

      logger.info('Meet-up supervision alert created', {
        alertId: alert._id,
        meetUpId,
        type: alertType,
        priority: alertPriority,
        hotelId: meetUp.hotelId._id || meetUp.hotelId
      });

      return alert;
    } catch (error) {
      logger.error('Error creating meet-up supervision alert', {
        meetUpId,
        alertType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Assess supervision needs for a meet-up
   */
  assessSupervisionNeeds(meetUp) {
    const riskFactors = [];
    let priorityScore = 0;

    // Safety assessment
    if (!meetUp.safety?.publicLocation) {
      riskFactors.push('Private location');
      priorityScore += 3;
    }

    if (meetUp.safety?.hotelStaffPresent) {
      riskFactors.push('Staff presence required');
      priorityScore += 2;
    }

    if (!meetUp.safety?.verifiedOnly) {
      riskFactors.push('Unverified users allowed');
      priorityScore += 1;
    }

    // Time-based risks
    const meetUpHour = new Date(meetUp.proposedDate).getHours();
    if (meetUpHour < 6 || meetUpHour > 22) {
      riskFactors.push('Outside normal hours');
      priorityScore += 2;
    }

    // Group size risks
    if (meetUp.participants.maxParticipants > 4) {
      riskFactors.push('Large group size');
      priorityScore += 1;
    }

    if (meetUp.participants.maxParticipants > 8) {
      riskFactors.push('Very large group');
      priorityScore += 2;
    }

    // Location-based risks
    if (meetUp.location.type === 'other') {
      riskFactors.push('Unspecified location type');
      priorityScore += 1;
    }

    if (meetUp.location.type === 'outdoor') {
      riskFactors.push('Outdoor location');
      priorityScore += 1;
    }

    // Activity-based risks
    if (meetUp.activity?.cost > 100) {
      riskFactors.push('High-cost activity');
      priorityScore += 1;
    }

    if (meetUp.activity?.type === 'other') {
      riskFactors.push('Unspecified activity');
      priorityScore += 1;
    }

    // User history risks (could be enhanced with actual data)
    // For now, we'll simulate this
    if (Math.random() > 0.9) { // 10% chance for demonstration
      riskFactors.push('Previous safety incidents');
      priorityScore += 2;
    }

    // Determine overall priority
    let priority, safetyLevel;
    if (priorityScore >= 6) {
      priority = 'high';
      safetyLevel = { level: 'low', label: 'High Risk' };
    } else if (priorityScore >= 3) {
      priority = 'medium';
      safetyLevel = { level: 'medium', label: 'Medium Risk' };
    } else {
      priority = 'low';
      safetyLevel = { level: 'high', label: 'Low Risk' };
    }

    return {
      priority,
      safetyLevel,
      priorityScore,
      riskFactors,
      requiresSupervision: priorityScore >= 2 || meetUp.safety?.hotelStaffPresent,
      requiresStaffPresence: meetUp.safety?.hotelStaffPresent || priorityScore >= 5
    };
  }

  /**
   * Determine alert priority based on supervision assessment
   */
  determineAlertPriority(supervisionData) {
    if (supervisionData.priorityScore >= 6) return 'urgent';
    if (supervisionData.priorityScore >= 4) return 'high';
    if (supervisionData.priorityScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Generate alert title
   */
  generateAlertTitle(alertType, meetUp) {
    const titles = {
      meetup_supervision_required: `Meet-up Supervision Required: ${meetUp.title}`,
      meetup_high_risk: `High-Risk Meet-up Alert: ${meetUp.title}`,
      meetup_safety_concern: `Safety Concern for Meet-up: ${meetUp.title}`,
      meetup_staff_required: `Staff Presence Required: ${meetUp.title}`
    };

    return titles[alertType] || `Meet-up Alert: ${meetUp.title}`;
  }

  /**
   * Generate alert message
   */
  generateAlertMessage(alertType, meetUp, supervisionData) {
    const formatDate = (date) => new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formatTime = (time) => `${time.start} - ${time.end}`;

    const baseMessage = `Meet-up "${meetUp.title}" between ${meetUp.requesterId.name} and ${meetUp.targetUserId.name} on ${formatDate(meetUp.proposedDate)} at ${formatTime(meetUp.proposedTime)} in ${meetUp.location.name}`;

    const messages = {
      meetup_supervision_required: `${baseMessage}. Risk factors identified: ${supervisionData.riskFactors.join(', ')}. Please review and assign appropriate supervision.`,
      meetup_high_risk: `${baseMessage} has been flagged as high-risk. Risk factors: ${supervisionData.riskFactors.join(', ')}. Immediate supervision assignment required.`,
      meetup_safety_concern: `${baseMessage} has safety concerns that require attention. Risk factors: ${supervisionData.riskFactors.join(', ')}.`,
      meetup_staff_required: `${baseMessage} requires staff presence during the meet-up. Please ensure appropriate staff coverage is arranged.`
    };

    return messages[alertType] || baseMessage;
  }

  /**
   * Find available supervision staff
   */
  async findAvailableSupervisionStaff(hotelId) {
    // This is a simplified version - in a real system, you'd check staff schedules,
    // workload, and availability
    try {
      const User = (await import('../models/User.js')).default;

      const availableStaff = await User.findOne({
        hotelId,
        role: { $in: ['staff', 'admin'] },
        // Add additional filters for availability if needed
      }).select('_id name email role');

      return availableStaff;
    } catch (error) {
      logger.error('Error finding available supervision staff', { error: error.message });
      return null;
    }
  }

  /**
   * Process upcoming meet-ups for supervision alerts
   */
  async processUpcomingMeetUps(hotelId = null) {
    try {
      const query = {
        status: { $in: ['pending', 'accepted'] },
        proposedDate: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next 24 hours
        }
      };

      if (hotelId) {
        query.hotelId = hotelId;
      }

      const upcomingMeetUps = await MeetUpRequest.find(query)
        .populate('requesterId', 'name email')
        .populate('targetUserId', 'name email')
        .populate('hotelId', 'name');

      const alertsCreated = [];

      for (const meetUp of upcomingMeetUps) {
        const supervisionData = this.assessSupervisionNeeds(meetUp);

        // Only create alerts for meet-ups that require supervision
        if (supervisionData.requiresSupervision) {
          // Check if we already have an alert for this meet-up
          const existingAlert = await StaffAlert.findOne({
            'source.id': meetUp._id.toString(),
            'source.type': 'meetup',
            status: { $in: ['active', 'acknowledged', 'in_progress'] }
          });

          if (!existingAlert) {
            let alertType = 'meetup_supervision_required';

            if (supervisionData.requiresStaffPresence) {
              alertType = 'meetup_staff_required';
            } else if (supervisionData.priority === 'high') {
              alertType = 'meetup_high_risk';
            } else if (supervisionData.riskFactors.length > 2) {
              alertType = 'meetup_safety_concern';
            }

            const alert = await this.createSupervisionAlert(meetUp._id, alertType);
            alertsCreated.push(alert);
          }
        }
      }

      logger.info('Processed upcoming meet-ups for supervision', {
        hotelId,
        meetUpsProcessed: upcomingMeetUps.length,
        alertsCreated: alertsCreated.length
      });

      return alertsCreated;
    } catch (error) {
      logger.error('Error processing upcoming meet-ups for supervision', {
        hotelId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update alert when meet-up supervision status changes
   */
  async updateAlertOnSupervisionChange(meetUpId, newStatus, staffId) {
    try {
      const alert = await StaffAlert.findOne({
        'source.id': meetUpId.toString(),
        'source.type': 'meetup',
        status: { $in: ['active', 'acknowledged', 'in_progress'] }
      });

      if (alert) {
        let newAlertStatus = alert.status;

        switch (newStatus) {
          case 'assigned':
            newAlertStatus = 'acknowledged';
            alert.acknowledgedBy = staffId;
            alert.assignedTo = staffId;
            break;
          case 'in_progress':
            newAlertStatus = 'in_progress';
            break;
          case 'completed':
            newAlertStatus = 'resolved';
            alert.resolvedBy = staffId;
            break;
        }

        alert.status = newAlertStatus;
        alert.lastUpdatedBy = staffId;

        await alert.save();

        logger.info('Updated supervision alert status', {
          alertId: alert._id,
          meetUpId,
          oldStatus: alert.status,
          newStatus: newAlertStatus
        });

        return alert;
      }

      return null;
    } catch (error) {
      logger.error('Error updating supervision alert', {
        meetUpId,
        newStatus,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get supervision alert statistics
   */
  async getSupervisionAlertStats(hotelId) {
    try {
      const stats = await StaffAlert.aggregate([
        {
          $match: {
            hotelId,
            type: {
              $in: [
                'meetup_supervision_required',
                'meetup_high_risk',
                'meetup_safety_concern',
                'meetup_staff_required'
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            acknowledged: { $sum: { $cond: [{ $eq: ['$status', 'acknowledged'] }, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            critical: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } },
            high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } }
          }
        }
      ]);

      return stats[0] || {
        total: 0,
        active: 0,
        acknowledged: 0,
        inProgress: 0,
        resolved: 0,
        critical: 0,
        high: 0
      };
    } catch (error) {
      logger.error('Error getting supervision alert statistics', {
        hotelId,
        error: error.message
      });
      throw error;
    }
  }
}

export default new MeetUpSupervisionAlertService();