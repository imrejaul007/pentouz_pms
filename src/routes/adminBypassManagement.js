import express from 'express';
import mongoose from 'mongoose';
import AdminBypassAudit from '../models/AdminBypassAudit.js';
import BypassApprovalWorkflow from '../models/BypassApprovalWorkflow.js';
import Booking from '../models/Booking.js';
import CheckoutInventory from '../models/CheckoutInventory.js';
import AuditLog from '../models/AuditLog.js';
import bypassSecurityService from '../services/bypassSecurityService.js';
import bypassApprovalService from '../services/bypassApprovalService.js';
import {
    authenticate,
    authorize
} from '../middleware/auth.js';
import {
    ApplicationError
} from '../middleware/errorHandler.js';
import {
    catchAsync
} from '../utils/catchAsync.js';
import {
    bypassRateLimit,
    validateBypassSecurity,
    requirePasswordConfirmation,
    validateSession,
    validateAdminRole,
    validateBypassOperation,
    preventDuplicateBypass,
    auditBypassAttempt,
    sanitizeBypassRequest,
    handleBypassErrors
} from '../middleware/bypassSecurityMiddleware.js';

const router = express.Router();

// Apply authentication to all routes (same as other admin routes)
router.use(authenticate);
router.use(authorize('admin', 'manager'));

/**
 * Get security metrics for dashboard
 */
router.get('/security/metrics', catchAsync(async (req, res) => {
    const {
        timeRange = '24h'
    } = req.query;
    const hotelId = req.user.hotelId;

    // Convert time range to date
    const now = new Date();
    let startDate;
    switch (timeRange) {
        case '24h':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const [stats, highRiskCount, activeAlerts] = await Promise.all([
        AdminBypassAudit.getBypassStatistics(hotelId, Math.ceil((now - startDate) / (24 * 60 * 60 * 1000))),
        AdminBypassAudit.countDocuments({
            hotelId: new mongoose.Types.ObjectId(hotelId),
            'securityMetadata.riskScore': {
                $gte: 60
            },
            createdAt: {
                $gte: startDate
            }
        }),
        // Count active alerts (would be implemented based on alert system)
        AuditLog.countDocuments({
            hotelId: new mongoose.Types.ObjectId(hotelId),
            'metadata.eventType': {
                $in: ['high_risk_bypass_blocked', 'rate_limit_exceeded', 'unauthorized_bypass_attempt']
            },
            createdAt: {
                $gte: new Date(now.getTime() - 60 * 60 * 1000)
            } // Last hour
        })
    ]);

    const metrics = {
        totalBypasses: stats.totalBypasses,
        averageRiskScore: stats.averageRiskScore,
        totalFinancialImpact: stats.totalFinancialImpact,
        highRiskCount,
        criticalFlags: stats.byCategory.filter(c => c.riskScore >= 80).length,
        suspiciousPatterns: stats.byShift.filter(s => !s.businessHours).length,
        pendingApprovals: 0, // Will be implemented in Phase 2
        activeAlerts
    };

    res.status(200).json({
        status: 'success',
        data: metrics
    });
}));

/**
 * Get security events with filtering
 */
router.get('/security/events', catchAsync(async (req, res) => {
    const {
        timeRange = '24h',
            riskLevel,
            adminId,
            limit = 50,
            offset = 0
    } = req.query;
    const hotelId = req.user.hotelId;

    // Convert time range to date
    const now = new Date();
    let startDate;
    switch (timeRange) {
        case '24h':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Build query
    const query = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        createdAt: {
            $gte: startDate
        }
    };

    if (adminId) {
        query.adminId = new mongoose.Types.ObjectId(adminId);
    }

    if (riskLevel && riskLevel !== 'all') {
        const riskRanges = {
            'critical': {
                $gte: 80
            },
            'high': {
                $gte: 60,
                $lt: 80
            },
            'medium': {
                $gte: 40,
                $lt: 60
            },
            'low': {
                $gte: 20,
                $lt: 40
            },
            'minimal': {
                $lt: 20
            }
        };

        if (riskRanges[riskLevel]) {
            query['securityMetadata.riskScore'] = riskRanges[riskLevel];
        }
    }

    const events = await AdminBypassAudit.find(query)
        .populate('adminId', 'name email role')
        .populate('bookingId', 'bookingNumber')
        .sort({
            createdAt: -1
        })
        .limit(parseInt(limit))
        .skip(parseInt(offset));

    const total = await AdminBypassAudit.countDocuments(query);

    res.status(200).json({
        status: 'success',
        data: events,
        pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: total > parseInt(offset) + parseInt(limit)
        }
    });
}));

/**
 * Get active security alerts
 */
router.get('/security/alerts', catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;
    const now = new Date();

    // Get recent security events from audit logs
    const recentAlerts = await AuditLog.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        'metadata.eventType': {
            $in: [
                'high_risk_bypass_blocked',
                'rate_limit_exceeded',
                'unauthorized_bypass_attempt',
                'suspended_account_bypass_attempt',
                'password_confirmation_failed',
                'duplicate_bypass_attempt'
            ]
        },
        createdAt: {
            $gte: new Date(now.getTime() - 60 * 60 * 1000)
        } // Last hour
    }).populate('userId', 'name email').sort({
        createdAt: -1
    }).limit(20);

    // Transform to alert format
    const alerts = recentAlerts.map(log => ({
        id: log._id,
        type: log.metadata.eventType,
        severity: log.metadata.eventType.includes('blocked') || log.metadata.eventType.includes('suspended') ? 'critical' : 'warning',
        title: getAlertTitle(log.metadata.eventType),
        message: getAlertMessage(log.metadata.eventType, log.metadata.details),
        timestamp: log.createdAt,
        adminId: log.userId ?._id,
        adminName: log.userId ?.name,
        details: log.metadata.details
    }));

    res.status(200).json({
        status: 'success',
        data: alerts
    });
}));

/**
 * Validate bypass operation before execution
 */
router.post('/security/validate', sanitizeBypassRequest, validateBypassOperation, validateBypassSecurity, catchAsync(async (req, res) => {
    const securityResult = req.bypassSecurity;

    res.status(200).json({
        status: 'success',
        data: {
            allowed: securityResult.riskScore < 90,
            riskScore: securityResult.riskScore,
            riskLevel: bypassSecurityService.getRiskLevel(securityResult.riskScore),
            securityFlags: securityResult.securityFlags,
            requiresApproval: securityResult.requiresApproval,
            requiresPasswordConfirmation: securityResult.riskScore >= 70,
            warnings: securityResult.checks.flags.filter(f => f.severity === 'warning').map(f => f.message),
            recommendations: generateSecurityRecommendations(securityResult)
        }
    });
}));

/**
 * Enhanced bypass checkout with full security tracking
 */
router.post('/enhanced-checkout',
    bypassRateLimit,
    sanitizeBypassRequest,
    validateBypassOperation,
    preventDuplicateBypass,
    validateBypassSecurity,
    requirePasswordConfirmation,
    auditBypassAttempt,
    catchAsync(async (req, res) => {
        const {
            bookingId,
            reason,
            financialImpact = {},
            paymentMethod = 'cash',
            deviceFingerprint,
            geolocation
        } = req.body;

        const adminId = req.user._id;
        const hotelId = req.user.hotelId;
        const securityResult = req.bypassSecurity;

        // Find the booking
        const booking = await Booking.findById(bookingId).populate('userId rooms.roomId');
        if (!booking) {
            throw new ApplicationError('Booking not found', 404);
        }

        // Verify booking is checked in
        if (booking.status !== 'checked_in') {
            throw new ApplicationError('Only checked-in bookings can be checked out', 400);
        }

        try {
            // Create comprehensive audit record first
            const auditData = {
                hotelId,
                bookingId: booking._id,
                adminId,
                reason: {
                    category: reason.category,
                    subcategory: reason.subcategory,
                    description: reason.description,
                    urgencyLevel: reason.urgencyLevel || 'medium',
                    estimatedDuration: reason.estimatedDuration,
                    followUpRequired: reason.followUpRequired || false
                },
                financialImpact: {
                    estimatedLoss: financialImpact.estimatedLoss || 0,
                    currency: financialImpact.currency || 'USD',
                    impactCategory: financialImpact.impactCategory || 'minimal',
                    recoveryPlan: financialImpact.recoveryPlan
                },
                securityMetadata: {
                    ...securityResult.metadata,
                    deviceFingerprint,
                    geolocation,
                    riskScore: securityResult.riskScore,
                    securityFlags: securityResult.securityFlags
                },
                guestContext: {
                    guestId: booking.userId._id,
                    guestName: booking.userId.name,
                    guestEmail: booking.userId.email,
                    vipStatus: booking.userId.vipStatus || false,
                    loyaltyTier: booking.userId.loyaltyTier,
                    previousBypassCount: 0 // Would be calculated
                },
                propertyContext: {
                    roomId: booking.rooms[0].roomId._id,
                    roomNumber: booking.rooms[0].roomId.roomNumber,
                    roomType: booking.rooms[0].roomId.type,
                    occupancyRate: 0 // Would be calculated
                },
                analytics: {
                    // Will be set by pre-save middleware
                }
            };

            // Encrypt sensitive notes if provided
            if (reason.sensitiveNotes) {
                auditData.encryptionKey = process.env.BYPASS_ENCRYPTION_KEY;
                auditData.reason.sensitiveNotes = reason.sensitiveNotes;
            }

            const auditRecord = await AdminBypassAudit.createBypassAudit(auditData);

            // Check if approval is required
            let approvalWorkflow = null;
            const requiresApproval = securityResult.requiresApproval || securityResult.riskScore >= 60;

            if (requiresApproval) {
                // Check for auto-approval first
                const autoApproved = await bypassApprovalService.checkAutoApproval(auditRecord);

                if (!autoApproved) {
                    // Create approval workflow
                    approvalWorkflow = await bypassApprovalService.evaluateApprovalRequirement(auditRecord._id);

                    if (approvalWorkflow) {
                        // Return pending approval response
                        return res.status(202).json({
                            status: 'pending_approval',
                            message: 'Bypass checkout requires approval',
                            data: {
                                bypassId: auditRecord.bypassId,
                                workflowId: approvalWorkflow.workflowId,
                                riskScore: securityResult.riskScore,
                                requiresApproval: true,
                                approvalLevels: approvalWorkflow.approvalChain.length,
                                currentLevel: approvalWorkflow.currentLevel,
                                timeoutAt: approvalWorkflow.timing.timeoutAt,
                                reasons: approvalWorkflow.approvalRules.triggeredBy.map(r => r.rule),
                                booking: {
                                    id: booking._id,
                                    bookingNumber: booking.bookingNumber,
                                    guest: booking.userId.name,
                                    room: booking.rooms[0].roomId.roomNumber
                                }
                            }
                        });
                    }
                }
            }

            // Proceed with immediate bypass (approved or no approval required)
            const checkoutInventory = await CheckoutInventory.create({
                bookingId: booking._id,
                roomId: booking.rooms[0].roomId._id,
                checkedBy: adminId,
                items: [], // No items for bypass checkout
                subtotal: 0,
                tax: 0,
                totalAmount: 0,
                status: 'paid', // Directly mark as paid for bypass
                paymentMethod: paymentMethod,
                paymentStatus: 'paid',
                paidAt: new Date(),
                notes: `ENHANCED ADMIN BYPASS: ${reason.description} | Bypass ID: ${auditRecord.bypassId} | Risk Score: ${securityResult.riskScore}`,
                isAdminBypass: true
            });

            // Update audit record with checkout inventory ID
            auditRecord.checkoutInventoryId = checkoutInventory._id;
            auditRecord.operationStatus.status = 'completed';
            auditRecord.operationStatus.completedAt = new Date();
            await auditRecord.save();

            // Update booking status to checked out
            booking.status = 'checked_out';
            booking.actualCheckOut = new Date();
            await booking.save();

            // Log completion in audit trail
            await AuditLog.logChange({
                hotelId,
                tableName: 'AdminBypassAudit',
                recordId: auditRecord._id,
                changeType: 'bypass_completed',
                userId: adminId,
                source: 'enhanced_bypass_system',
                newValues: {
                    bypassId: auditRecord.bypassId,
                    riskScore: securityResult.riskScore,
                    financialImpact: financialImpact.estimatedLoss || 0
                },
                metadata: {
                    priority: securityResult.riskScore >= 60 ? 'high' : 'medium',
                    tags: ['bypass_operation', 'security_tracked']
                }
            });

            await checkoutInventory.populate([{
                    path: 'bookingId',
                    select: 'bookingNumber'
                },
                {
                    path: 'roomId',
                    select: 'roomNumber'
                },
                {
                    path: 'checkedBy',
                    select: 'name email'
                }
            ]);

            res.status(200).json({
                status: 'success',
                message: 'Enhanced admin bypass checkout completed successfully',
                data: {
                    bypassId: auditRecord.bypassId,
                    riskScore: securityResult.riskScore,
                    booking: {
                        id: booking._id,
                        bookingNumber: booking.bookingNumber,
                        guest: booking.userId.name,
                        room: booking.rooms[0].roomId.roomNumber,
                        status: booking.status,
                        checkedOut: booking.actualCheckOut
                    },
                    checkoutInventory: {
                        id: checkoutInventory._id,
                        totalAmount: checkoutInventory.totalAmount,
                        paymentMethod: checkoutInventory.paymentMethod,
                        notes: checkoutInventory.notes,
                        isAdminBypass: checkoutInventory.isAdminBypass
                    },
                    securitySummary: {
                        riskScore: securityResult.riskScore,
                        riskLevel: bypassSecurityService.getRiskLevel(securityResult.riskScore),
                        flagsCount: securityResult.securityFlags.length,
                        requiresFollowUp: auditRecord.reason.followUpRequired
                    }
                }
            });

        } catch (error) {
            // Update audit record to reflect failure
            if (auditRecord) {
                auditRecord.operationStatus.status = 'failed';
                auditRecord.operationStatus.errorDetails = {
                    code: error.code || 'UNKNOWN_ERROR',
                    message: error.message,
                    recoverable: true
                };
                await auditRecord.save();
            }

            throw error;
        }
    })
);

/**
 * Get high-risk bypass operations
 */
router.get('/security/high-risk', catchAsync(async (req, res) => {
    const {
        threshold = 70
    } = req.query;
    const hotelId = req.user.hotelId;

    const highRiskBypasses = await AdminBypassAudit.getHighRiskBypasses(hotelId, parseInt(threshold));

    res.status(200).json({
        status: 'success',
        data: highRiskBypasses
    });
}));

/**
 * Get bypass operation details
 */
router.get('/security/bypass/:bypassId', catchAsync(async (req, res) => {
    const {
        bypassId
    } = req.params;
    const hotelId = req.user.hotelId;

    const bypass = await AdminBypassAudit.findOne({
            bypassId,
            hotelId: new mongoose.Types.ObjectId(hotelId)
        })
        .populate('adminId', 'name email role')
        .populate('bookingId', 'bookingNumber')
        .populate('checkoutInventoryId');

    if (!bypass) {
        throw new ApplicationError('Bypass operation not found', 404);
    }

    // Decrypt sensitive notes if user has permission
    if (bypass.reason.encryptedNotes && req.user.role === 'admin') {
        bypass.decryptedSensitiveNotes = bypass.decryptSensitiveNotes(process.env.BYPASS_ENCRYPTION_KEY);
    }

    res.status(200).json({
        status: 'success',
        data: bypass
    });
}));

/**
 * Export security report
 */
router.get('/security/export', catchAsync(async (req, res) => {
    const {
        timeRange = '7d', format = 'pdf'
    } = req.query;
    const hotelId = req.user.hotelId;

    // This would integrate with a reporting service
    // For now, return a simple JSON report
    const now = new Date();
    let startDate;
    switch (timeRange) {
        case '24h':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const reportData = await AdminBypassAudit.aggregate([{
            $match: {
                hotelId: new mongoose.Types.ObjectId(hotelId),
                createdAt: {
                    $gte: startDate
                }
            }
        },
        {
            $group: {
                _id: null,
                totalBypasses: {
                    $sum: 1
                },
                averageRiskScore: {
                    $avg: '$securityMetadata.riskScore'
                },
                totalFinancialImpact: {
                    $sum: '$financialImpact.estimatedLoss'
                },
                highRiskCount: {
                    $sum: {
                        $cond: [{
                            $gte: ['$securityMetadata.riskScore', 60]
                        }, 1, 0]
                    }
                },
                byCategory: {
                    $push: {
                        category: '$reason.category',
                        riskScore: '$securityMetadata.riskScore'
                    }
                }
            }
        }
    ]);

    const report = {
        generatedAt: new Date(),
        timeRange,
        hotelId,
        summary: reportData[0] || {},
        disclaimer: 'This report contains sensitive security information and should be handled according to company security policies.'
    };

    if (format === 'pdf') {
        // In production, this would generate an actual PDF
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="bypass_security_report_${timeRange}.json"`);
    }

    res.status(200).json({
        status: 'success',
        data: report
    });
}));

/**
 * Get pending approvals for the current user
 */
router.get('/approvals/pending', catchAsync(async (req, res) => {
    const userId = req.user._id;
    const hotelId = req.user.hotelId;

    const pendingApprovals = await bypassApprovalService.getPendingApprovalsForUser(userId, hotelId);

    res.status(200).json({
        status: 'success',
        data: pendingApprovals,
        count: pendingApprovals.length
    });
}));

/**
 * Process an approval (approve/reject)
 */
router.post('/approvals/:workflowId/process', catchAsync(async (req, res) => {
    const {
        workflowId
    } = req.params;
    const {
        action,
        notes
    } = req.body; // action: 'approved' or 'rejected'
    const approverId = req.user._id;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    // Validate action
    if (!['approved', 'rejected'].includes(action)) {
        throw new ApplicationError('Invalid action. Must be "approved" or "rejected"', 400);
    }

    if (!notes || notes.trim().length < 5) {
        throw new ApplicationError('Approval notes are required (minimum 5 characters)', 400);
    }

    const workflow = await bypassApprovalService.processApproval(
        workflowId,
        approverId,
        action,
        notes.trim(),
        ipAddress,
        userAgent
    );

    // If workflow is completed and approved, execute the bypass
    if (workflow.workflowStatus === 'approved') {
        await executeApprovedBypass(workflow);
    }

    res.status(200).json({
        status: 'success',
        message: `Approval ${action} successfully`,
        data: {
            workflowId: workflow.workflowId,
            status: workflow.workflowStatus,
            currentLevel: workflow.currentLevel,
            completionPercentage: workflow.completionPercentage,
            nextApprover: workflow.currentApprover
        }
    });
}));

/**
 * Delegate an approval to another user
 */
router.post('/approvals/:workflowId/delegate', catchAsync(async (req, res) => {
    const {
        workflowId
    } = req.params;
    const {
        toUserId,
        delegationReason
    } = req.body;
    const fromApproverId = req.user._id;

    if (!toUserId || !delegationReason) {
        throw new ApplicationError('Delegate user ID and delegation reason are required', 400);
    }

    const workflow = await bypassApprovalService.delegateApproval(
        workflowId,
        fromApproverId,
        toUserId,
        delegationReason
    );

    res.status(200).json({
        status: 'success',
        message: 'Approval delegated successfully',
        data: {
            workflowId: workflow.workflowId,
            delegatedTo: toUserId,
            reason: delegationReason
        }
    });
}));

/**
 * Escalate an approval workflow
 */
router.post('/approvals/:workflowId/escalate', catchAsync(async (req, res) => {
    const {
        workflowId
    } = req.params;
    const {
        reason = 'manual_escalation'
    } = req.body;

    const workflow = await bypassApprovalService.escalateWorkflow(workflowId, reason);

    res.status(200).json({
        status: 'success',
        message: 'Approval workflow escalated successfully',
        data: {
            workflowId: workflow.workflowId,
            escalationLevel: workflow.escalation.currentEscalationLevel,
            status: workflow.workflowStatus
        }
    });
}));

/**
 * Get approval statistics (must be before parameterized route)
 */
router.get('/approvals/statistics', catchAsync(async (req, res) => {
    const {
        timeRange = 30
    } = req.query;
    const hotelId = req.user.hotelId;

    try {
        const statistics = await bypassApprovalService.getWorkflowStatistics(hotelId, parseInt(timeRange));
        
        res.status(200).json({
            status: 'success',
            data: statistics
        });
    } catch (error) {
        console.error('Statistics error:', error);
        // Return empty statistics instead of 404
        res.status(200).json({
            status: 'success',
            data: {
                totalWorkflows: 0,
                approvedWorkflows: 0,
                rejectedWorkflows: 0,
                expiredWorkflows: 0,
                averageResponseTime: 0,
                averageTotalDuration: 0,
                escalatedCount: 0
            }
        });
    }
}));

/**
 * Get approval workflow details
 */
router.get('/approvals/:workflowId', catchAsync(async (req, res) => {
    const {
        workflowId
    } = req.params;
    const hotelId = req.user.hotelId;

    const workflow = await BypassApprovalWorkflow.findOne({
            workflowId,
            hotelId
        })
        .populate('bypassAuditId', 'bypassId reason financialImpact securityMetadata')
        .populate('initiatedBy', 'name email')
        .populate('approvalChain.assignedTo', 'name email role')
        .populate('approvalChain.delegatedTo', 'name email role');

    if (!workflow) {
        return res.status(404).json({
            status: 'error',
            message: 'Approval workflow not found',
            code: 'WORKFLOW_NOT_FOUND'
        });
    }

    res.status(200).json({
        status: 'success',
        data: workflow
    });
}));


/**
 * Get workflows by status
 */
router.get('/approvals/status/:status', catchAsync(async (req, res) => {
    const {
        status
    } = req.params;
    const {
        limit = 50
    } = req.query;
    const hotelId = req.user.hotelId;

    const validStatuses = ['pending', 'approved', 'rejected', 'escalated', 'expired', 'cancelled'];
    if (!validStatuses.includes(status)) {
        throw new ApplicationError('Invalid status', 400);
    }

    const workflows = await BypassApprovalWorkflow.getWorkflowsByStatus(hotelId, status, parseInt(limit));

    res.status(200).json({
        status: 'success',
        data: workflows,
        count: workflows.length
    });
}));

/**
 * Execute approved bypass (internal function)
 */
async function executeApprovedBypass(workflow) {
    try {
        const auditRecord = await AdminBypassAudit.findById(workflow.bypassAuditId)
            .populate('bookingId')
            .populate('adminId');

        if (!auditRecord || !auditRecord.bookingId) {
            throw new Error('Invalid audit record or booking not found');
        }

        const booking = auditRecord.bookingId;

        // Create bypass checkout inventory record
        const checkoutInventory = await CheckoutInventory.create({
            bookingId: booking._id,
            roomId: booking.rooms[0].roomId,
            checkedBy: auditRecord.adminId._id,
            items: [], // No items for bypass checkout
            subtotal: 0,
            tax: 0,
            totalAmount: 0,
            status: 'paid', // Directly mark as paid for bypass
            paymentMethod: 'cash', // Default payment method
            paymentStatus: 'paid',
            paidAt: new Date(),
            notes: `APPROVED ADMIN BYPASS: ${auditRecord.reason.description} | Bypass ID: ${auditRecord.bypassId} | Workflow: ${workflow.workflowId}`,
            isAdminBypass: true
        });

        // Update audit record
        auditRecord.checkoutInventoryId = checkoutInventory._id;
        auditRecord.operationStatus.status = 'completed';
        auditRecord.operationStatus.completedAt = new Date();
        await auditRecord.save();

        // Update booking status to checked out
        booking.status = 'checked_out';
        booking.actualCheckOut = new Date();
        await booking.save();

        console.log('Approved bypass executed successfully:', {
            workflowId: workflow.workflowId,
            bypassId: auditRecord.bypassId,
            bookingNumber: booking.bookingNumber
        });

    } catch (error) {
        console.error('Failed to execute approved bypass:', error);

        // Update audit record to reflect failure
        const auditRecord = await AdminBypassAudit.findById(workflow.bypassAuditId);
        if (auditRecord) {
            auditRecord.operationStatus.status = 'failed';
            auditRecord.operationStatus.errorDetails = {
                code: 'EXECUTION_FAILED',
                message: 'Failed to execute approved bypass: ' + error.message,
                recoverable: true
            };
            await auditRecord.save();
        }
    }
}

/**
 * Acknowledge security alert
 */
router.post('/security/alerts/:alertId/acknowledge', catchAsync(async (req, res) => {
    const {
        alertId
    } = req.params;
    const {
        notes
    } = req.body;
    const adminId = req.user._id;

    // Update the audit log entry
    const alert = await AuditLog.findByIdAndUpdate(
        alertId, {
            $set: {
                'metadata.acknowledged': true,
                'metadata.acknowledgedBy': adminId,
                'metadata.acknowledgedAt': new Date(),
                'metadata.acknowledgedNotes': notes
            }
        }, {
            new: true
        }
    );

    if (!alert) {
        throw new ApplicationError('Alert not found', 404);
    }

    res.status(200).json({
        status: 'success',
        message: 'Alert acknowledged successfully',
        data: alert
    });
}));

// Error handling middleware
router.use(handleBypassErrors);

// Helper functions
function getAlertTitle(eventType) {
    const titles = {
        'high_risk_bypass_blocked': 'High Risk Bypass Blocked',
        'rate_limit_exceeded': 'Rate Limit Exceeded',
        'unauthorized_bypass_attempt': 'Unauthorized Access Attempt',
        'suspended_account_bypass_attempt': 'Suspended Account Activity',
        'password_confirmation_failed': 'Password Verification Failed',
        'duplicate_bypass_attempt': 'Duplicate Operation Detected'
    };

    return titles[eventType] || 'Security Event';
}

function getAlertMessage(eventType, details) {
    const messages = {
        'high_risk_bypass_blocked': `High-risk bypass operation blocked. Risk score: ${details?.riskScore || 'unknown'}`,
        'rate_limit_exceeded': `Admin exceeded bypass rate limit (${details?.limit || 5} per hour)`,
        'unauthorized_bypass_attempt': `Unauthorized bypass attempt from user with insufficient permissions`,
        'suspended_account_bypass_attempt': `Bypass attempt from suspended account`,
        'password_confirmation_failed': `Failed password confirmation for high-risk bypass operation`,
        'duplicate_bypass_attempt': `Duplicate bypass operation detected for the same booking`
    };

    return messages[eventType] || 'Security event detected';
}

function generateSecurityRecommendations(securityResult) {
    const recommendations = [];

    if (securityResult.riskScore >= 60) {
        recommendations.push('Consider requesting supervisor approval for this high-risk operation');
    }

    if (securityResult.securityFlags.some(f => f.type === 'suspicious_timing')) {
        recommendations.push('Operation outside normal business hours - verify urgency');
    }

    if (securityResult.securityFlags.some(f => f.type === 'high_value')) {
        recommendations.push('High financial impact - ensure proper documentation');
    }

    if (securityResult.securityFlags.some(f => f.type === 'rapid_succession')) {
        recommendations.push('Multiple recent bypasses detected - review operational procedures');
    }

    return recommendations;
}

export default router;