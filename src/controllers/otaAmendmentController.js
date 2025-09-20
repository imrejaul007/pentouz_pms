import otaAmendmentService from '../services/otaAmendmentService.js';
import Booking from '../models/Booking.js';
import logger from '../utils/logger.js';

/**
 * Handle incoming OTA amendment webhook
 */
export const handleOTAAmendmentWebhook = async (req, res) => {
  try {
    const { bookingId, amendmentData } = req.body;
    
    // Validate required fields
    if (!bookingId) {
      return res.status(400).json({
        status: 'error',
        message: 'Booking ID is required'
      });
    }

    if (!amendmentData || !amendmentData.type) {
      return res.status(400).json({
        status: 'error',
        message: 'Amendment data and type are required'
      });
    }

    logger.info(`Received OTA amendment webhook`, {
      bookingId,
      amendmentType: amendmentData.type,
      channel: amendmentData.channel
    });

    // Process the amendment
    const result = await otaAmendmentService.processIncomingAmendment(bookingId, {
      ...amendmentData,
      channel: amendmentData.channel || req.headers['x-channel-id'],
      receivedAt: new Date()
    });

    res.status(200).json({
      status: 'success',
      data: result
    });

  } catch (error) {
    logger.error('OTA amendment webhook failed:', error);
    
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Get pending amendments for review dashboard
 */
export const getPendingAmendments = async (req, res) => {
  try {
    const { channel, priority, limit, offset } = req.query;

    const filters = {
      channel,
      priority: priority ? parseInt(priority) : undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    };

    const pendingAmendments = await otaAmendmentService.getPendingAmendments(filters);

    res.status(200).json({
      status: 'success',
      data: {
        amendments: pendingAmendments,
        total: pendingAmendments.length,
        filters
      }
    });

  } catch (error) {
    logger.error('Failed to get pending amendments:', error);
    
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Approve a pending amendment
 */
export const approveAmendment = async (req, res) => {
  try {
    const { bookingId, amendmentId } = req.params;
    const { reason, partialChanges, bypassValidation } = req.body;

    if (!bookingId || !amendmentId) {
      return res.status(400).json({
        status: 'error',
        message: 'Booking ID and Amendment ID are required'
      });
    }

    const approverInfo = {
      userId: req.user?.id,
      userName: req.user?.name || 'Admin',
      reason,
      partialChanges,
      bypassValidation: bypassValidation || false,
      approvedAt: new Date()
    };

    const result = await otaAmendmentService.approveAmendment(
      bookingId,
      amendmentId,
      approverInfo
    );

    res.status(200).json({
      status: 'success',
      data: result
    });

  } catch (error) {
    logger.error('Failed to approve amendment:', error);
    
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Reject a pending amendment
 */
export const rejectAmendment = async (req, res) => {
  try {
    const { bookingId, amendmentId } = req.params;
    const { rejectionReason, notifyGuest } = req.body;

    if (!bookingId || !amendmentId) {
      return res.status(400).json({
        status: 'error',
        message: 'Booking ID and Amendment ID are required'
      });
    }

    if (!rejectionReason) {
      return res.status(400).json({
        status: 'error',
        message: 'Rejection reason is required'
      });
    }

    const rejectionInfo = {
      userId: req.user?.id,
      userName: req.user?.name || 'Admin',
      rejectionReason,
      notifyGuest: notifyGuest !== false,
      rejectedAt: new Date()
    };

    const result = await otaAmendmentService.rejectAmendment(
      bookingId,
      amendmentId,
      rejectionInfo
    );

    res.status(200).json({
      status: 'success',
      data: result
    });

  } catch (error) {
    logger.error('Failed to reject amendment:', error);
    
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Get amendment details for a specific booking
 */
export const getBookingAmendments = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, limit } = req.query;

    const booking = await Booking.findById(bookingId)
      .select('bookingNumber guestInfo.name otaAmendments amendmentFlags statusHistory channel')
      .lean();

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    let amendments = booking.otaAmendments || [];

    // Filter by status if provided
    if (status) {
      amendments = amendments.filter(a => a.amendmentStatus === status);
    }

    // Limit results if specified
    if (limit) {
      amendments = amendments.slice(0, parseInt(limit));
    }

    // Sort by most recent first
    amendments.sort((a, b) => new Date(b.requestedBy.timestamp) - new Date(a.requestedBy.timestamp));

    res.status(200).json({
      status: 'success',
      data: {
        booking: {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          guestName: booking.guestInfo.name,
          channel: booking.channel
        },
        amendments,
        amendmentFlags: booking.amendmentFlags,
        totalAmendments: amendments.length
      }
    });

  } catch (error) {
    logger.error('Failed to get booking amendments:', error);
    
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Manually change booking status with validation
 */
export const changeBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { newStatus, reason, bypassValidation, notifyChannels } = req.body;

    if (!bookingId || !newStatus) {
      return res.status(400).json({
        status: 'error',
        message: 'Booking ID and new status are required'
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    const context = {
      source: 'admin',
      userId: req.user?.id,
      userName: req.user?.name || 'Admin',
      reason: reason || `Status changed to ${newStatus}`,
      bypassValidation: bypassValidation || false,
      notifyChannels: notifyChannels !== false
    };

    // Use the model's built-in status transition method
    await booking.changeStatus(newStatus, context);
    await booking.save();

    res.status(200).json({
      status: 'success',
      data: {
        bookingId: booking._id,
        oldStatus: context.previousStatus,
        newStatus: booking.status,
        lastStatusChange: booking.lastStatusChange
      }
    });

  } catch (error) {
    logger.error('Failed to change booking status:', error);
    
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Get booking status history
 */
export const getBookingStatusHistory = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { limit } = req.query;

    const booking = await Booking.findById(bookingId)
      .select('bookingNumber guestInfo.name status statusHistory lastStatusChange')
      .lean();

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    let statusHistory = booking.statusHistory || [];

    // Sort by most recent first
    statusHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit results if specified
    if (limit) {
      statusHistory = statusHistory.slice(0, parseInt(limit));
    }

    res.status(200).json({
      status: 'success',
      data: {
        booking: {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          guestName: booking.guestInfo.name,
          currentStatus: booking.status
        },
        statusHistory,
        lastStatusChange: booking.lastStatusChange,
        totalTransitions: statusHistory.length
      }
    });

  } catch (error) {
    logger.error('Failed to get booking status history:', error);
    
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Process bulk amendment approvals/rejections
 */
export const processBulkAmendments = async (req, res) => {
  try {
    const { amendments, action, reason } = req.body;

    if (!amendments || !Array.isArray(amendments) || amendments.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Amendments array is required'
      });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        status: 'error',
        message: 'Action must be either "approve" or "reject"'
      });
    }

    const results = [];
    const errors = [];

    for (const amendment of amendments) {
      try {
        const { bookingId, amendmentId } = amendment;
        
        const actionInfo = {
          userId: req.user?.id,
          userName: req.user?.name || 'Admin',
          reason: reason || `Bulk ${action}ed`,
          bulkAction: true
        };

        let result;
        if (action === 'approve') {
          result = await otaAmendmentService.approveAmendment(bookingId, amendmentId, actionInfo);
        } else {
          actionInfo.rejectionReason = reason || 'Bulk rejected';
          result = await otaAmendmentService.rejectAmendment(bookingId, amendmentId, actionInfo);
        }

        results.push({
          bookingId,
          amendmentId,
          success: true,
          action,
          result
        });

      } catch (error) {
        errors.push({
          bookingId: amendment.bookingId,
          amendmentId: amendment.amendmentId,
          error: error.message
        });
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        processed: results.length,
        errors: errors.length,
        results,
        errors
      }
    });

  } catch (error) {
    logger.error('Failed to process bulk amendments:', error);
    
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Get amendment statistics and metrics
 */
export const getAmendmentMetrics = async (req, res) => {
  try {
    const { startDate, endDate, channel } = req.query;

    // Build aggregation pipeline
    const matchStage = {};
    
    if (startDate || endDate) {
      matchStage['otaAmendments.requestedBy.timestamp'] = {};
      if (startDate) matchStage['otaAmendments.requestedBy.timestamp'].$gte = new Date(startDate);
      if (endDate) matchStage['otaAmendments.requestedBy.timestamp'].$lte = new Date(endDate);
    }
    
    if (channel) {
      matchStage.channel = channel;
    }

    const metrics = await Booking.aggregate([
      { $match: matchStage },
      { $unwind: '$otaAmendments' },
      {
        $group: {
          _id: null,
          totalAmendments: { $sum: 1 },
          pendingAmendments: {
            $sum: { $cond: [{ $eq: ['$otaAmendments.amendmentStatus', 'pending'] }, 1, 0] }
          },
          approvedAmendments: {
            $sum: { $cond: [{ $eq: ['$otaAmendments.amendmentStatus', 'approved'] }, 1, 0] }
          },
          rejectedAmendments: {
            $sum: { $cond: [{ $eq: ['$otaAmendments.amendmentStatus', 'rejected'] }, 1, 0] }
          },
          amendmentsByType: {
            $push: '$otaAmendments.amendmentType'
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalAmendments: 1,
          pendingAmendments: 1,
          approvedAmendments: 1,
          rejectedAmendments: 1,
          approvalRate: {
            $multiply: [
              { $divide: ['$approvedAmendments', { $add: ['$approvedAmendments', '$rejectedAmendments'] }] },
              100
            ]
          },
          amendmentsByType: 1
        }
      }
    ]);

    const result = metrics[0] || {
      totalAmendments: 0,
      pendingAmendments: 0,
      approvedAmendments: 0,
      rejectedAmendments: 0,
      approvalRate: 0,
      amendmentsByType: []
    };

    // Count amendment types
    const typeCount = {};
    result.amendmentsByType.forEach(type => {
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    result.amendmentsByType = typeCount;

    res.status(200).json({
      status: 'success',
      data: {
        metrics: result,
        period: {
          startDate,
          endDate,
          channel
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get amendment metrics:', error);
    
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
