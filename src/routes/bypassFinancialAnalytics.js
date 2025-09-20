import express from 'express';
import mongoose from 'mongoose';
import BypassFinancialImpact from '../models/BypassFinancialImpact.js';
import AdminBypassAudit from '../models/AdminBypassAudit.js';
import bypassFinancialService from '../services/bypassFinancialService.js';
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

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(authorize('admin', 'manager'));

/**
 * Get financial summary for hotel
 */
router.get('/summary', catchAsync(async (req, res) => {
    const {
        timeRange = 30
    } = req.query;
    const hotelId = req.user.hotelId;

    console.log('🔍 BACKEND: Financial summary route called');
    console.log('🔍 BACKEND: hotelId:', hotelId);
    console.log('🔍 BACKEND: timeRange:', timeRange);

    const summary = await bypassFinancialService.getHotelFinancialSummary(hotelId, parseInt(timeRange));

    console.log('🔍 BACKEND: Summary result:', JSON.stringify(summary, null, 2));

    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    }).status(200).json({
        status: 'success',
        data: summary
    });
}));

/**
 * Get cost trends analysis
 */
router.get('/trends', catchAsync(async (req, res) => {
    const {
        months = 12
    } = req.query;
    const hotelId = req.user.hotelId;

    const trends = await bypassFinancialService.getCostTrends(hotelId, parseInt(months));

    res.status(200).json({
        status: 'success',
        data: trends
    });
}));

/**
 * Get top cost drivers
 */
router.get('/cost-drivers', catchAsync(async (req, res) => {
    const {
        limit = 10
    } = req.query;
    const hotelId = req.user.hotelId;

    const costDrivers = await bypassFinancialService.getTopCostDrivers(hotelId, parseInt(limit));

    res.status(200).json({
        status: 'success',
        data: costDrivers
    });
}));

/**
 * Get financial impact details for a specific bypass
 */
router.get('/impact/:impactId', catchAsync(async (req, res) => {
    const {
        impactId
    } = req.params;
    const hotelId = req.user.hotelId;

    const impact = await BypassFinancialImpact.findOne({
            impactId,
            hotelId
        })
        .populate('bypassAuditId', 'bypassId reason securityMetadata')
        .populate('approvalWorkflowId', 'workflowId workflowStatus')
        .populate('bookingContext.bookingId', 'bookingNumber')
        .populate('bookingContext.roomId', 'roomNumber type');

    if (!impact) {
        throw new ApplicationError('Financial impact record not found', 404);
    }

    res.status(200).json({
        status: 'success',
        data: impact
    });
}));

/**
 * Get all financial impacts with filtering
 */
router.get('/impacts', catchAsync(async (req, res) => {
    const {
        timeRange = 30,
            severity,
            status,
            department,
            limit = 50,
            offset = 0,
            sortBy = 'createdAt',
            sortOrder = 'desc'
    } = req.query;
    const hotelId = req.user.hotelId;

    // Build query
    const query = {};
    
    // Only add hotelId filter if hotelId is provided and valid
    if (hotelId && mongoose.Types.ObjectId.isValid(hotelId)) {
        query.hotelId = new mongoose.Types.ObjectId(hotelId);
    }

    // Time range filter
    if (timeRange) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(timeRange));
        query.createdAt = {
            $gte: startDate
        };
    }

    // Severity filter
    if (severity && severity !== 'all') {
        const severityRanges = {
            'minimal': {
                $lt: 100
            },
            'low': {
                $gte: 100,
                $lt: 500
            },
            'moderate': {
                $gte: 500,
                $lt: 1000
            },
            'high': {
                $gte: 1000,
                $lt: 5000
            },
            'severe': {
                $gte: 5000
            }
        };

        if (severityRanges[severity]) {
            // We need to use aggregation to calculate total cost
            const pipeline = [{
                    $match: query
                },
                {
                    $addFields: {
                        totalCost: {
                            $add: [{
                                    $ifNull: ['$directCosts.totalDirectCost', 0]
                                },
                                {
                                    $ifNull: ['$indirectCosts.totalIndirectCost', 0]
                                }
                            ]
                        }
                    }
                },
                {
                    $match: {
                        totalCost: severityRanges[severity]
                    }
                },
                {
                    $sort: {
                        [sortBy]: sortOrder === 'desc' ? -1 : 1
                    }
                },
                {
                    $skip: parseInt(offset)
                },
                {
                    $limit: parseInt(limit)
                },
                {
                    $lookup: {
                        from: 'adminbypassaudits',
                        localField: 'bypassAuditId',
                        foreignField: '_id',
                        as: 'bypassAudit',
                        pipeline: [{
                            $project: {
                                bypassId: 1,
                                reason: 1,
                                securityMetadata: 1
                            }
                        }]
                    }
                },
                {
                    $lookup: {
                        from: 'bookings',
                        localField: 'bookingContext.bookingId',
                        foreignField: '_id',
                        as: 'booking',
                        pipeline: [{
                            $project: {
                                bookingNumber: 1
                            }
                        }]
                    }
                }
            ];

            const impacts = await BypassFinancialImpact.aggregate(pipeline);
            const total = await BypassFinancialImpact.aggregate([{
                    $match: query
                },
                {
                    $addFields: {
                        totalCost: {
                            $add: [{
                                    $ifNull: ['$directCosts.totalDirectCost', 0]
                                },
                                {
                                    $ifNull: ['$indirectCosts.totalIndirectCost', 0]
                                }
                            ]
                        }
                    }
                },
                {
                    $match: {
                        totalCost: severityRanges[severity]
                    }
                },
                {
                    $count: 'total'
                }
            ]);

            return res.status(200).json({
                status: 'success',
                data: impacts,
                pagination: {
                    total: total[0]?.total || 0,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: (total[0]?.total || 0) > parseInt(offset) + parseInt(limit)
                }
            });
        }
    }

    // Status filter
    if (status && status !== 'all') {
        query['reconciliation.status'] = status;
    }

    // Department filter
    if (department && department !== 'all') {
        query['budgetImpact.affectedDepartments.departmentName'] = department;
    }

    const impacts = await BypassFinancialImpact.find(query)
        .populate('bypassAuditId', 'bypassId reason securityMetadata')
        .populate('bookingContext.bookingId', 'bookingNumber')
        .sort({
            [sortBy]: sortOrder === 'desc' ? -1 : 1
        })
        .limit(parseInt(limit))
        .skip(parseInt(offset));

    const total = await BypassFinancialImpact.countDocuments(query);

    res.status(200).json({
        status: 'success',
        data: impacts,
        pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: total > parseInt(offset) + parseInt(limit)
        }
    });
}));

/**
 * Get budget impact analysis
 */
router.get('/budget-impact', catchAsync(async (req, res) => {
    const {
        fiscalYear,
        fiscalQuarter,
        department
    } = req.query;
    const hotelId = req.user.hotelId;

    const matchQuery = {};
    
    // Only add hotelId filter if hotelId is provided and valid
    if (hotelId && mongoose.Types.ObjectId.isValid(hotelId)) {
        matchQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
    }

    const pipeline = [{
        $match: matchQuery
    }];

    // Add fiscal year filter if provided
    if (fiscalYear) {
        pipeline.push({
            $match: {
                'budgetImpact.fiscalImpact.fiscalYear': parseInt(fiscalYear)
            }
        });
    }

    // Add fiscal quarter filter if provided
    if (fiscalQuarter) {
        pipeline.push({
            $match: {
                'budgetImpact.fiscalImpact.fiscalQuarter': parseInt(fiscalQuarter)
            }
        });
    }

    // Group by department or overall
    if (department && department !== 'all') {
        pipeline.push({
            $unwind: '$budgetImpact.affectedDepartments'
        }, {
            $match: {
                'budgetImpact.affectedDepartments.departmentName': department
            }
        }, {
            $group: {
                _id: '$budgetImpact.affectedDepartments.departmentName',
                totalImpact: {
                    $sum: '$budgetImpact.affectedDepartments.impactAmount'
                },
                totalBudget: {
                    $avg: '$budgetImpact.affectedDepartments.allocatedBudget'
                },
                bypassCount: {
                    $sum: 1
                },
                averageImpact: {
                    $avg: '$budgetImpact.affectedDepartments.impactAmount'
                },
                overBudgetCount: {
                    $sum: {
                        $cond: ['$budgetImpact.affectedDepartments.isOverBudget', 1, 0]
                    }
                }
            }
        });
    } else {
        pipeline.push({
            $unwind: '$budgetImpact.affectedDepartments'
        }, {
            $group: {
                _id: '$budgetImpact.affectedDepartments.departmentName',
                totalImpact: {
                    $sum: '$budgetImpact.affectedDepartments.impactAmount'
                },
                totalBudget: {
                    $avg: '$budgetImpact.affectedDepartments.allocatedBudget'
                },
                bypassCount: {
                    $sum: 1
                },
                averageImpact: {
                    $avg: '$budgetImpact.affectedDepartments.impactAmount'
                },
                overBudgetCount: {
                    $sum: {
                        $cond: ['$budgetImpact.affectedDepartments.isOverBudget', 1, 0]
                    }
                }
            }
        }, {
            $sort: {
                totalImpact: -1
            }
        });
    }

    const budgetImpact = await BypassFinancialImpact.aggregate(pipeline);

    res.status(200).json({
        status: 'success',
        data: budgetImpact
    });
}));

/**
 * Get recovery tracking
 */
router.get('/recovery', catchAsync(async (req, res) => {
    const {
        timeRange = 90
    } = req.query;
    const hotelId = req.user.hotelId;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));

    const recoveryMatchQuery = {
        createdAt: {
            $gte: startDate
        }
    };
    
    // Only add hotelId filter if hotelId is provided and valid
    if (hotelId && mongoose.Types.ObjectId.isValid(hotelId)) {
        recoveryMatchQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
    }

    const recoveryData = await BypassFinancialImpact.aggregate([{
            $match: recoveryMatchQuery
        },
        {
            $group: {
                _id: null,
                totalImpacts: {
                    $sum: 1
                },
                totalOutstanding: {
                    $sum: '$recovery.outstandingAmount'
                },
                totalRecovered: {
                    $sum: '$recovery.recoveredAmount'
                },
                totalRecoveryActions: {
                    $sum: {
                        $size: {
                            $ifNull: ['$recovery.recoveryActions', []]
                        }
                    }
                },
                completedActions: {
                    $sum: {
                        $size: {
                            $filter: {
                                input: {
                                    $ifNull: ['$recovery.recoveryActions', []]
                                },
                                cond: {
                                    $eq: ['$$this.status', 'completed']
                                }
                            }
                        }
                    }
                },
                byStatus: {
                    $push: {
                        status: '$recovery.recoveryStatus',
                        amount: '$recovery.outstandingAmount',
                        percentage: '$recovery.recoveryPercentage'
                    }
                }
            }
        },
        {
            $addFields: {
                totalImpactAmount: {
                    $add: ['$totalOutstanding', '$totalRecovered']
                },
                overallRecoveryPercentage: {
                    $cond: [{
                            $gt: [{
                                $add: ['$totalOutstanding', '$totalRecovered']
                            }, 0]
                        },
                        {
                            $multiply: [{
                                    $divide: [
                                        '$totalRecovered',
                                        {
                                            $add: ['$totalOutstanding', '$totalRecovered']
                                        }
                                    ]
                                },
                                100
                            ]
                        },
                        0
                    ]
                },
                actionCompletionRate: {
                    $cond: [{
                            $gt: ['$totalRecoveryActions', 0]
                        },
                        {
                            $multiply: [{
                                    $divide: ['$completedActions', '$totalRecoveryActions']
                                },
                                100
                            ]
                        },
                        0
                    ]
                }
            }
        }
    ]);

    const result = recoveryData[0] || {
        totalImpacts: 0,
        totalOutstanding: 0,
        totalRecovered: 0,
        totalImpactAmount: 0,
        overallRecoveryPercentage: 0,
        totalRecoveryActions: 0,
        completedActions: 0,
        actionCompletionRate: 0,
        byStatus: []
    };

    res.status(200).json({
        status: 'success',
        data: result
    });
}));

/**
 * Get predictive analytics
 */
router.get('/predictive', catchAsync(async (req, res) => {
    const {
        category,
        months = 6
    } = req.query;
    const hotelId = req.user.hotelId;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const pipeline = [{
            $match: {
                ...(hotelId && mongoose.Types.ObjectId.isValid(hotelId) ? { hotelId: new mongoose.Types.ObjectId(hotelId) } : {}),
                createdAt: {
                    $gte: startDate
                }
            }
        },
        {
            $lookup: {
                from: 'adminbypassaudits',
                localField: 'bypassAuditId',
                foreignField: '_id',
                as: 'audit'
            }
        },
        {
            $unwind: '$audit'
        }
    ];

    // Add category filter if provided
    if (category && category !== 'all') {
        pipeline.push({
            $match: {
                'audit.reason.category': category
            }
        });
    }

    pipeline.push({
        $addFields: {
            totalCost: {
                $add: [{
                        $ifNull: ['$directCosts.totalDirectCost', 0]
                    },
                    {
                        $ifNull: ['$indirectCosts.totalIndirectCost', 0]
                    }
                ]
            },
            month: {
                $month: '$createdAt'
            },
            year: {
                $year: '$createdAt'
            }
        }
    }, {
        $group: {
            _id: {
                category: '$audit.reason.category',
                year: '$year',
                month: '$month'
            },
            count: {
                $sum: 1
            },
            totalCost: {
                $sum: '$totalCost'
            },
            averageCost: {
                $avg: '$totalCost'
            },
            recurringCount: {
                $sum: {
                    $cond: ['$analytics.frequencyPattern.isRecurring', 1, 0]
                }
            }
        }
    }, {
        $group: {
            _id: '$_id.category',
            monthlyData: {
                $push: {
                    year: '$_id.year',
                    month: '$_id.month',
                    count: '$count',
                    totalCost: '$totalCost',
                    averageCost: '$averageCost'
                }
            },
            totalOccurrences: {
                $sum: '$count'
            },
            totalCost: {
                $sum: '$totalCost'
            },
            recurringOccurrences: {
                $sum: '$recurringCount'
            }
        }
    }, {
        $addFields: {
            recurrenceRate: {
                $cond: [{
                        $gt: ['$totalOccurrences', 0]
                    },
                    {
                        $multiply: [{
                                $divide: ['$recurringOccurrences', '$totalOccurrences']
                            },
                            100
                        ]
                    },
                    0
                ]
            },
            averageMonthlyCost: {
                $divide: ['$totalCost', parseInt(months)]
            },
            projectedMonthlyCost: {
                $multiply: [{
                        $divide: ['$totalCost', parseInt(months)]
                    },
                    1.1 // 10% increase projection
                ]
            }
        }
    }, {
        $sort: {
            totalCost: -1
        }
    });

    const predictiveData = await BypassFinancialImpact.aggregate(pipeline);

    res.status(200).json({
        status: 'success',
        data: predictiveData
    });
}));

/**
 * Generate executive report
 */
router.get('/executive-report', catchAsync(async (req, res) => {
    const {
        timeRange = 90, format = 'json'
    } = req.query;
    const hotelId = req.user.hotelId;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));

    // Get comprehensive data for executive report
    const [
        summary,
        trends,
        costDrivers,
        budgetImpact,
        recovery,
        predictive
    ] = await Promise.all([
        bypassFinancialService.getHotelFinancialSummary(hotelId, parseInt(timeRange)),
        bypassFinancialService.getCostTrends(hotelId, Math.ceil(parseInt(timeRange) / 30)),
        bypassFinancialService.getTopCostDrivers(hotelId, 5),
        BypassFinancialImpact.aggregate([{
                $match: {
                    ...(hotelId && mongoose.Types.ObjectId.isValid(hotelId) ? { hotelId: new mongoose.Types.ObjectId(hotelId) } : {}),
                    createdAt: {
                        $gte: startDate
                    }
                }
            },
            {
                $unwind: '$budgetImpact.affectedDepartments'
            },
            {
                $group: {
                    _id: '$budgetImpact.affectedDepartments.departmentName',
                    totalImpact: {
                        $sum: '$budgetImpact.affectedDepartments.impactAmount'
                    },
                    overBudgetCount: {
                        $sum: {
                            $cond: ['$budgetImpact.affectedDepartments.isOverBudget', 1, 0]
                        }
                    }
                }
            },
            {
                $sort: {
                    totalImpact: -1
                }
            }
        ]),
        BypassFinancialImpact.aggregate([{
                $match: {
                    ...(hotelId && mongoose.Types.ObjectId.isValid(hotelId) ? { hotelId: new mongoose.Types.ObjectId(hotelId) } : {}),
                    createdAt: {
                        $gte: startDate
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRecovered: {
                        $sum: '$recovery.recoveredAmount'
                    },
                    totalOutstanding: {
                        $sum: '$recovery.outstandingAmount'
                    },
                    averageRecoveryRate: {
                        $avg: '$recovery.recoveryPercentage'
                    }
                }
            }
        ]),
        BypassFinancialImpact.aggregate([{
                $match: {
                    ...(hotelId && mongoose.Types.ObjectId.isValid(hotelId) ? { hotelId: new mongoose.Types.ObjectId(hotelId) } : {})
                }
            },
            {
                $group: {
                    _id: '$analytics.frequencyPattern.isRecurring',
                    count: {
                        $sum: 1
                    },
                    totalCost: {
                        $sum: {
                            $add: [{
                                    $ifNull: ['$directCosts.totalDirectCost', 0]
                                },
                                {
                                    $ifNull: ['$indirectCosts.totalIndirectCost', 0]
                                }
                            ]
                        }
                    }
                }
            }
        ])
    ]);

    const executiveReport = {
        generatedAt: new Date(),
        timeRange: `${timeRange} days`,
        hotelId,
        summary: {
            totalFinancialImpact: summary.totalDirectCosts + summary.totalIndirectCosts + Math.abs(summary.totalRevenueImpact),
            totalBypasses: summary.totalImpacts,
            averageImpactPerBypass: summary.averageImpactPerBypass,
            recoveryRate: recovery[0]?.averageRecoveryRate || 0
        },
        keyMetrics: {
            directCosts: summary.totalDirectCosts,
            indirectCosts: summary.totalIndirectCosts,
            revenueImpact: summary.totalRevenueImpact,
            recoveredAmount: summary.totalRecoveredAmount
        },
        trends: {
            costTrend: trends.length > 1 ?
                (trends[trends.length - 1].totalCost > trends[0].totalCost ? 'increasing' : 'decreasing') : 'stable',
            monthlyData: trends
        },
        topCostDrivers: costDrivers,
        budgetImpact: budgetImpact,
        recovery: recovery[0] || {
            totalRecovered: 0,
            totalOutstanding: 0,
            averageRecoveryRate: 0
        },
        patterns: {
            recurringBypasses: predictive.find(p => p._id === true)?.count || 0,
            oneTimeBypasses: predictive.find(p => p._id === false)?.count || 0
        },
        recommendations: generateExecutiveRecommendations(summary, trends, costDrivers, budgetImpact)
    };

    if (format === 'pdf') {
        // In production, this would generate an actual PDF
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="executive_report_${timeRange}d.json"`);
    }

    res.status(200).json({
        status: 'success',
        data: executiveReport
    });
}));

/**
 * Update financial impact record
 */
router.put('/impact/:impactId', catchAsync(async (req, res) => {
    const {
        impactId
    } = req.params;
    const hotelId = req.user.hotelId;
    const updateData = req.body;

    // Verify ownership
    const impact = await BypassFinancialImpact.findOne({
        impactId,
        hotelId
    });
    if (!impact) {
        throw new ApplicationError('Financial impact record not found', 404);
    }

    const updatedImpact = await bypassFinancialService.updateFinancialImpact(impactId, updateData);

    res.status(200).json({
        status: 'success',
        message: 'Financial impact updated successfully',
        data: updatedImpact
    });
}));

/**
 * Add recovery action
 */
router.post('/impact/:impactId/recovery-action', catchAsync(async (req, res) => {
    const {
        impactId
    } = req.params;
    const {
        actionType,
        description,
        assignedTo,
        targetDate,
        costToImplement,
        expectedSavings
    } = req.body;
    const hotelId = req.user.hotelId;

    const impact = await BypassFinancialImpact.findOne({
        impactId,
        hotelId
    });
    if (!impact) {
        throw new ApplicationError('Financial impact record not found', 404);
    }

    impact.addRecoveryAction(
        actionType,
        description,
        assignedTo,
        new Date(targetDate),
        costToImplement,
        expectedSavings
    );

    await impact.save();

    res.status(200).json({
        status: 'success',
        message: 'Recovery action added successfully',
        data: impact.recovery.recoveryActions[impact.recovery.recoveryActions.length - 1]
    });
}));

/**
 * Complete recovery action
 */
router.put('/impact/:impactId/recovery-action/:actionId/complete', catchAsync(async (req, res) => {
    const {
        impactId,
        actionId
    } = req.params;
    const {
        actualSavings
    } = req.body;
    const hotelId = req.user.hotelId;

    const impact = await BypassFinancialImpact.findOne({
        impactId,
        hotelId
    });
    if (!impact) {
        throw new ApplicationError('Financial impact record not found', 404);
    }

    impact.completeRecoveryAction(actionId, actualSavings);
    await impact.save();

    res.status(200).json({
        status: 'success',
        message: 'Recovery action completed successfully'
    });
}));

// Helper function to generate executive recommendations
function generateExecutiveRecommendations(summary, trends, costDrivers, budgetImpact) {
    const recommendations = [];

    // Cost-based recommendations
    if (summary.averageImpactPerBypass > 500) {
        recommendations.push({
            category: 'cost_reduction',
            priority: 'high',
            title: 'High Average Impact Cost',
            description: 'Average bypass cost exceeds $500. Consider implementing preventive measures.',
            action: 'Review top cost drivers and implement targeted prevention strategies'
        });
    }

    // Trend-based recommendations
    if (trends.length > 1) {
        const recentTrend = trends[trends.length - 1].totalCost > trends[0].totalCost;
        if (recentTrend) {
            recommendations.push({
                category: 'trend_analysis',
                priority: 'medium',
                title: 'Increasing Cost Trend',
                description: 'Bypass costs are trending upward over the analysis period.',
                action: 'Investigate root causes and implement corrective measures'
            });
        }
    }

    // Budget impact recommendations
    const overBudgetDepts = budgetImpact.filter(dept => dept.overBudgetCount > 0);
    if (overBudgetDepts.length > 0) {
        recommendations.push({
            category: 'budget_management',
            priority: 'high',
            title: 'Budget Overruns Detected',
            description: `${overBudgetDepts.length} departments have exceeded budget due to bypass costs.`,
            action: 'Review budget allocations and implement stricter approval controls'
        });
    }

    // Cost driver recommendations
    if (costDrivers.length > 0 && costDrivers[0].totalCost > 1000) {
        recommendations.push({
            category: 'cost_optimization',
            priority: 'medium',
            title: 'Top Cost Driver Identified',
            description: `${costDrivers[0]._id} accounts for $${costDrivers[0].totalCost.toLocaleString()} in bypass costs.`,
            action: 'Focus prevention efforts on the highest impact items'
        });
    }

    return recommendations;
}

export default router;
