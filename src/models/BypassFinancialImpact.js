import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * @swagger
 * components:
 *   schemas:
 *     BypassFinancialImpact:
 *       type: object
 *       required:
 *         - hotelId
 *         - bypassAuditId
 *         - impactId
 *       properties:
 *         _id:
 *           type: string
 *         impactId:
 *           type: string
 *           description: Unique financial impact identifier
 *         hotelId:
 *           type: string
 *           description: Hotel ID for multi-tenant isolation
 *         bypassAuditId:
 *           type: string
 *           description: Reference to the bypass audit record
 *         directCosts:
 *           type: object
 *           description: Direct financial costs from bypass
 *         indirectCosts:
 *           type: object
 *           description: Indirect and opportunity costs
 *         revenueImpact:
 *           type: object
 *           description: Revenue impact analysis
 *         budgetImpact:
 *           type: object
 *           description: Budget and cost center impact
 */

const bypassFinancialImpactSchema = new mongoose.Schema({
    // Unique financial impact identifier
    impactId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Multi-tenant support
    hotelId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Hotel',
        required: true,
        index: true
    },

    // Reference to bypass audit record
    bypassAuditId: {
        type: mongoose.Schema.ObjectId,
        ref: 'AdminBypassAudit',
        required: true,
        index: true
    },

    // Reference to approval workflow (if exists)
    approvalWorkflowId: {
        type: mongoose.Schema.ObjectId,
        ref: 'BypassApprovalWorkflow'
    },

    // Booking and room context
    bookingContext: {
        bookingId: {
            type: mongoose.Schema.ObjectId,
            ref: 'Booking',
            required: true
        },
        bookingNumber: String,
        roomId: {
            type: mongoose.Schema.ObjectId,
            ref: 'Room'
        },
        roomNumber: String,
        roomType: String,
        guestName: String,
        stayDuration: Number, // nights
        roomRate: Number,
        totalBookingValue: Number,
        currency: {
            type: String,
            default: 'USD'
        }
    },

    // Direct financial costs
    directCosts: {
        // Bypassed inventory items and their costs
        inventoryItems: [{
            itemId: {
                type: mongoose.Schema.ObjectId,
                ref: 'InventoryItem'
            },
            itemName: String,
            category: String,
            quantity: {
                type: Number,
                default: 1
            },
            unitCost: Number,
            totalCost: Number,
            supplierCost: Number,
            replacementCost: Number,
            wasBypassed: {
                type: Boolean,
                default: true
            },
            bypassReason: String,
            alternativeProvided: Boolean,
            alternativeCost: Number
        }],

        // Labor costs for manual processing
        laborCosts: {
            adminTime: {
                hours: Number,
                hourlyRate: Number,
                totalCost: Number
            },
            managerTime: {
                hours: Number,
                hourlyRate: Number,
                totalCost: Number
            },
            housekeepingTime: {
                hours: Number,
                hourlyRate: Number,
                totalCost: Number
            },
            maintenanceTime: {
                hours: Number,
                hourlyRate: Number,
                totalCost: Number
            }
        },

        // Service and processing fees
        processingFees: {
            adminFee: Number,
            systemOverrideFee: Number,
            complianceFee: Number,
            auditFee: Number,
            escalationFee: Number
        },

        // Emergency procurement costs
        emergencyProcurement: {
            items: [{
                itemName: String,
                quantity: Number,
                emergencyRate: Number,
                standardRate: Number,
                premiumPaid: Number,
                supplier: String,
                procurementTime: Number
            }],
            totalEmergencyCost: Number,
            totalStandardCost: Number,
            totalPremium: Number
        },

        // Total direct costs
        totalDirectCost: {
            type: Number
        }
    },

    // Indirect and opportunity costs
    indirectCosts: {
        // Guest satisfaction impact
        guestSatisfaction: {
            compensationProvided: Number,
            discountGiven: Number,
            freeServicesProvided: Number,
            loyaltyPointsAwarded: Number,
            estimatedFutureRevenueLoss: Number,
            reputationImpact: {
                type: String,
                enum: ['none', 'minimal', 'moderate', 'significant', 'severe']
            }
        },

        // Operational disruption
        operationalDisruption: {
            delayedCheckouts: Number,
            staffReallocation: Number,
            systemDowntime: Number,
            processInefficiency: Number,
            communicationOverhead: Number
        },

        // Compliance and audit costs
        compliance: {
            additionalAuditTime: Number,
            complianceReviewCost: Number,
            documentationCost: Number,
            reportingCost: Number,
            regulatoryRiskCost: Number
        },

        // Risk and insurance impact
        riskImpact: {
            insurancePremiumIncrease: Number,
            securityRiskCost: Number,
            fraudRiskCost: Number,
            operationalRiskCost: Number,
            reputationalRiskCost: Number
        },

        // Total indirect costs
        totalIndirectCost: {
            type: Number
        }
    },

    // Revenue impact analysis
    revenueImpact: {
        // Lost revenue opportunities
        lostRevenue: {
            inventoryCharges: Number,
            serviceCharges: Number,
            upsellOpportunities: Number,
            crossSellOpportunities: Number,
            futureBookingsLost: Number
        },

        // Revenue recovery efforts
        recoveryEfforts: {
            alternativeServicesProvided: Number,
            compensatoryRevenue: Number,
            retentionIncentives: Number,
            loyaltyRecovery: Number
        },

        // Net revenue impact
        netRevenueImpact: {
            type: Number
        },

        // Revenue impact percentage
        revenueImpactPercentage: {
            type: Number,
            default: 0
        }
    },

    // Budget and cost center impact
    budgetImpact: {
        // Affected departments
        affectedDepartments: [{
            departmentId: String,
            departmentName: String,
            budgetCode: String,
            allocatedBudget: Number,
            spentAmount: Number,
            impactAmount: Number,
            impactPercentage: Number,
            budgetVariance: Number,
            isOverBudget: Boolean
        }],

        // Fiscal period impact
        fiscalImpact: {
            fiscalYear: Number,
            fiscalQuarter: Number,
            fiscalMonth: Number,
            quarterlyBudgetImpact: Number,
            annualBudgetImpact: Number,
            budgetUtilizationIncrease: Number
        },

        // Cost center attribution
        costCenters: [{
            costCenterCode: String,
            costCenterName: String,
            attributedCost: Number,
            costType: {
                type: String,
                enum: ['direct', 'indirect', 'allocated', 'overhead']
            },
            allocationMethod: String,
            allocationPercentage: Number
        }],

        // Budget alerts and thresholds
        budgetAlerts: [{
            alertType: {
                type: String,
                enum: ['threshold_exceeded', 'budget_overrun', 'variance_high', 'forecast_exceeded']
            },
            alertLevel: {
                type: String,
                enum: ['info', 'warning', 'critical']
            },
            threshold: Number,
            actualValue: Number,
            alertMessage: String,
            alertedAt: {
                type: Date,
                default: Date.now
            },
            acknowledged: {
                type: Boolean,
                default: false
            },
            acknowledgedBy: {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            }
        }]
    },

    // Financial reconciliation
    reconciliation: {
        // Reconciliation status
        status: {
            type: String,
            enum: ['pending', 'in_progress', 'completed', 'disputed', 'approved'],
            default: 'pending'
        },

        // Reconciliation details
        reconciledBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        reconciledAt: Date,
        reconciliationNotes: String,

        // Financial adjustments
        adjustments: [{
            adjustmentType: {
                type: String,
                enum: ['cost_correction', 'revenue_adjustment', 'budget_reallocation', 'write_off']
            },
            amount: Number,
            reason: String,
            approvedBy: {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            },
            adjustedAt: {
                type: Date,
                default: Date.now
            }
        }],

        // Final reconciled amounts
        reconciledDirectCost: Number,
        reconciledIndirectCost: Number,
        reconciledRevenueImpact: Number,
        totalReconciledImpact: Number
    },

    // Recovery and mitigation
    recovery: {
        // Recovery plan
        recoveryPlan: {
            planCreated: Boolean,
            planCreatedBy: {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            },
            planCreatedAt: Date,
            targetRecoveryAmount: Number,
            expectedRecoveryDate: Date,
            recoveryMethods: [String]
        },

        // Recovery actions
        recoveryActions: [{
            actionType: {
                type: String,
                enum: ['inventory_restock', 'process_improvement', 'staff_training', 'system_upgrade', 'policy_change']
            },
            description: String,
            assignedTo: {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            },
            targetDate: Date,
            completedDate: Date,
            status: {
                type: String,
                enum: ['planned', 'in_progress', 'completed', 'cancelled'],
                default: 'planned'
            },
            costToImplement: Number,
            expectedSavings: Number,
            actualSavings: Number
        }],

        // Recovery tracking
        recoveredAmount: {
            type: Number,
            default: 0
        },
        recoveryPercentage: {
            type: Number,
            default: 0
        },
        outstandingAmount: {
            type: Number,
            default: 0
        }
    },

    // Trend and pattern analysis
    analytics: {
        // Frequency patterns
        frequencyPattern: {
            isRecurring: Boolean,
            recurrenceInterval: Number, // days
            similarBypassesCount: Number,
            patternConfidence: Number // 0-1
        },

        // Cost trends
        costTrends: {
            monthlyTrend: String, // 'increasing', 'decreasing', 'stable'
            quarterlyTrend: String,
            yearlyTrend: String,
            trendConfidence: Number,
            projectedMonthlyCost: Number,
            projectedQuarterlyCost: Number,
            projectedYearlyCost: Number
        },

        // Comparative analysis
        comparativeAnalysis: {
            averageCostPerBypass: Number,
            percentileRanking: Number, // 0-100
            costVarianceFromAverage: Number,
            isOutlier: Boolean,
            outlierReason: String
        },

        // Predictive indicators
        predictiveIndicators: {
            likelyToRecur: Boolean,
            recurrenceProbability: Number, // 0-1
            nextOccurrencePrediction: Date,
            preventionRecommendations: [String],
            riskMitigationSuggestions: [String]
        }
    },

    // Audit and compliance
    auditTrail: {
        // Financial audit requirements
        auditRequired: {
            type: Boolean,
            default: false
        },
        auditScheduled: Boolean,
        auditCompletedAt: Date,
        auditedBy: String,
        auditFindings: String,
        auditRecommendations: [String],

        // Compliance tracking
        complianceRequirements: [{
            requirement: String,
            status: {
                type: String,
                enum: ['pending', 'compliant', 'non_compliant', 'under_review']
            },
            dueDate: Date,
            completedDate: Date,
            evidence: String,
            reviewer: {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            }
        }],

        // Document retention
        retentionPeriod: {
            type: Number,
            default: 2557 // 7 years in days
        },
        archiveDate: Date,
        dataClassification: {
            type: String,
            enum: ['public', 'internal', 'confidential', 'restricted'],
            default: 'confidential'
        }
    },

    // Reporting and notifications
    reporting: {
        // Report generation
        reportsGenerated: [{
            reportType: String,
            generatedAt: Date,
            generatedBy: {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            },
            reportFormat: String,
            reportPath: String,
            recipientList: [String]
        }],

        // Notification history
        notificationsSent: [{
            notificationType: String,
            recipient: String,
            sentAt: Date,
            deliveryStatus: String,
            content: String
        }],

        // Escalation tracking
        escalations: [{
            escalationLevel: Number,
            escalatedTo: {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            },
            escalatedAt: Date,
            escalationReason: String,
            resolved: Boolean,
            resolvedAt: Date
        }]
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true
    },
    toObject: {
        virtuals: true
    }
});

// Indexes for performance
bypassFinancialImpactSchema.index({
    hotelId: 1,
    createdAt: -1
});
bypassFinancialImpactSchema.index({
    bypassAuditId: 1
});
bypassFinancialImpactSchema.index({
    'bookingContext.bookingId': 1
});
bypassFinancialImpactSchema.index({
    'directCosts.totalDirectCost': -1
});
bypassFinancialImpactSchema.index({
    'indirectCosts.totalIndirectCost': -1
});
bypassFinancialImpactSchema.index({
    'revenueImpact.netRevenueImpact': -1
});
bypassFinancialImpactSchema.index({
    'reconciliation.status': 1
});

// Compound indexes for common queries
bypassFinancialImpactSchema.index({
    hotelId: 1,
    'budgetImpact.fiscalImpact.fiscalYear': 1,
    createdAt: -1
});
bypassFinancialImpactSchema.index({
    hotelId: 1,
    'reconciliation.status': 1,
    createdAt: -1
});
bypassFinancialImpactSchema.index({
    'analytics.frequencyPattern.isRecurring': 1,
    hotelId: 1
});

// TTL index for data retention
bypassFinancialImpactSchema.index({
    createdAt: 1
}, {
    expireAfterSeconds: 220752000 // 7 years in seconds
});

// Pre-save middleware
bypassFinancialImpactSchema.pre('save', async function(next) {
    // Generate unique impact ID if not provided
    if (!this.impactId) {
        const timestamp = Date.now().toString();
        const random = crypto.randomBytes(4).toString('hex');
        this.impactId = `IMPACT_${timestamp}_${random.toUpperCase()}`;
    }

    // Calculate total direct costs
    this.calculateTotalDirectCosts();

    // Calculate total indirect costs
    this.calculateTotalIndirectCosts();

    // Calculate net revenue impact
    this.calculateNetRevenueImpact();

    // Update budget impact percentages
    this.updateBudgetImpactPercentages();

    // Update recovery percentage
    this.updateRecoveryPercentage();

    next();
});

// Instance methods
bypassFinancialImpactSchema.methods.calculateTotalDirectCosts = function() {
    let total = 0;

    // Sum inventory items
    if (this.directCosts.inventoryItems) {
        total += this.directCosts.inventoryItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    }

    // Sum labor costs
    if (this.directCosts.laborCosts) {
        const labor = this.directCosts.laborCosts;
        total += (labor.adminTime?.totalCost || 0) +
            (labor.managerTime?.totalCost || 0) +
            (labor.housekeepingTime?.totalCost || 0) +
            (labor.maintenanceTime?.totalCost || 0);
    }

    // Sum processing fees
    if (this.directCosts.processingFees) {
        const fees = this.directCosts.processingFees;
        total += (fees.adminFee || 0) +
            (fees.systemOverrideFee || 0) +
            (fees.complianceFee || 0) +
            (fees.auditFee || 0) +
            (fees.escalationFee || 0);
    }

    // Sum emergency procurement
    if (this.directCosts.emergencyProcurement) {
        total += this.directCosts.emergencyProcurement.totalEmergencyCost || 0;
    }

    this.directCosts.totalDirectCost = total;
};

bypassFinancialImpactSchema.methods.calculateTotalIndirectCosts = function() {
    let total = 0;

    // Sum guest satisfaction costs
    if (this.indirectCosts.guestSatisfaction) {
        const guest = this.indirectCosts.guestSatisfaction;
        total += (guest.compensationProvided || 0) +
            (guest.discountGiven || 0) +
            (guest.freeServicesProvided || 0) +
            (guest.estimatedFutureRevenueLoss || 0);
    }

    // Sum operational disruption costs
    if (this.indirectCosts.operationalDisruption) {
        const ops = this.indirectCosts.operationalDisruption;
        total += (ops.delayedCheckouts || 0) +
            (ops.staffReallocation || 0) +
            (ops.systemDowntime || 0) +
            (ops.processInefficiency || 0) +
            (ops.communicationOverhead || 0);
    }

    // Sum compliance costs
    if (this.indirectCosts.compliance) {
        const compliance = this.indirectCosts.compliance;
        total += (compliance.additionalAuditTime || 0) +
            (compliance.complianceReviewCost || 0) +
            (compliance.documentationCost || 0) +
            (compliance.reportingCost || 0) +
            (compliance.regulatoryRiskCost || 0);
    }

    // Sum risk impact costs
    if (this.indirectCosts.riskImpact) {
        const risk = this.indirectCosts.riskImpact;
        total += (risk.insurancePremiumIncrease || 0) +
            (risk.securityRiskCost || 0) +
            (risk.fraudRiskCost || 0) +
            (risk.operationalRiskCost || 0) +
            (risk.reputationalRiskCost || 0);
    }

    this.indirectCosts.totalIndirectCost = total;
};

bypassFinancialImpactSchema.methods.calculateNetRevenueImpact = function() {
    const lost = this.revenueImpact.lostRevenue || {};
    const recovery = this.revenueImpact.recoveryEfforts || {};

    const totalLost = (lost.inventoryCharges || 0) +
        (lost.serviceCharges || 0) +
        (lost.upsellOpportunities || 0) +
        (lost.crossSellOpportunities || 0) +
        (lost.futureBookingsLost || 0);

    const totalRecovery = (recovery.alternativeServicesProvided || 0) +
        (recovery.compensatoryRevenue || 0) +
        (recovery.retentionIncentives || 0) +
        (recovery.loyaltyRecovery || 0);

    this.revenueImpact.netRevenueImpact = totalLost - totalRecovery;

    // Calculate percentage impact
    if (this.bookingContext.totalBookingValue > 0) {
        this.revenueImpact.revenueImpactPercentage =
            (this.revenueImpact.netRevenueImpact / this.bookingContext.totalBookingValue) * 100;
    }
};

bypassFinancialImpactSchema.methods.updateBudgetImpactPercentages = function() {
    if (this.budgetImpact.affectedDepartments) {
        this.budgetImpact.affectedDepartments.forEach(dept => {
            if (dept.allocatedBudget > 0) {
                dept.impactPercentage = (dept.impactAmount / dept.allocatedBudget) * 100;
                dept.budgetVariance = dept.spentAmount - dept.allocatedBudget;
                dept.isOverBudget = dept.spentAmount > dept.allocatedBudget;
            }
        });
    }
};

bypassFinancialImpactSchema.methods.updateRecoveryPercentage = function() {
    const totalImpact = this.getTotalFinancialImpact();
    if (totalImpact > 0) {
        this.recovery.recoveryPercentage = (this.recovery.recoveredAmount / totalImpact) * 100;
        this.recovery.outstandingAmount = totalImpact - this.recovery.recoveredAmount;
    }
};

bypassFinancialImpactSchema.methods.getTotalFinancialImpact = function() {
    return (this.directCosts.totalDirectCost || 0) +
        (this.indirectCosts.totalIndirectCost || 0) +
        Math.abs(this.revenueImpact.netRevenueImpact || 0);
};

bypassFinancialImpactSchema.methods.addBudgetAlert = function(alertType, threshold, actualValue, message) {
    const alertLevel = actualValue > threshold * 1.5 ? 'critical' :
        actualValue > threshold * 1.2 ? 'warning' : 'info';

    this.budgetImpact.budgetAlerts.push({
        alertType,
        alertLevel,
        threshold,
        actualValue,
        alertMessage: message
    });
};

bypassFinancialImpactSchema.methods.addRecoveryAction = function(actionType, description, assignedTo, targetDate, costToImplement, expectedSavings) {
    this.recovery.recoveryActions.push({
        actionType,
        description,
        assignedTo,
        targetDate,
        costToImplement,
        expectedSavings,
        status: 'planned'
    });
};

bypassFinancialImpactSchema.methods.completeRecoveryAction = function(actionId, actualSavings) {
    const action = this.recovery.recoveryActions.id(actionId);
    if (action) {
        action.status = 'completed';
        action.completedDate = new Date();
        action.actualSavings = actualSavings;
    }
};

// Static methods
bypassFinancialImpactSchema.statics.createFinancialImpact = async function(impactData) {
    const impact = new this(impactData);
    return await impact.save();
};

bypassFinancialImpactSchema.statics.getHotelFinancialSummary = async function(hotelId, timeRange = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRange);

    const matchQuery = {
        createdAt: {
            $gte: startDate
        }
    };
    
    // Only add hotelId filter if hotelId is provided and valid
    if (hotelId && mongoose.Types.ObjectId.isValid(hotelId)) {
        matchQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
    }

    const summary = await this.aggregate([{
            $match: matchQuery
        },
        {
            $group: {
                _id: null,
                totalImpacts: {
                    $sum: 1
                },
                totalDirectCosts: {
                    $sum: '$directCosts.totalDirectCost'
                },
                totalIndirectCosts: {
                    $sum: '$indirectCosts.totalIndirectCost'
                },
                totalRevenueImpact: {
                    $sum: '$revenueImpact.netRevenueImpact'
                },
                averageImpactPerBypass: {
                    $avg: {
                        $add: ['$directCosts.totalDirectCost', '$indirectCosts.totalIndirectCost']
                    }
                },
                totalRecoveredAmount: {
                    $sum: '$recovery.recoveredAmount'
                },
                byCategory: {
                    $push: {
                        category: '$analytics.frequencyPattern.isRecurring',
                        cost: {
                            $add: ['$directCosts.totalDirectCost', '$indirectCosts.totalIndirectCost']
                        }
                    }
                }
            }
        }
    ]);

    return summary[0] || {
        totalImpacts: 0,
        totalDirectCosts: 0,
        totalIndirectCosts: 0,
        totalRevenueImpact: 0,
        averageImpactPerBypass: 0,
        totalRecoveredAmount: 0,
        byCategory: []
    };
};

bypassFinancialImpactSchema.statics.getCostTrends = async function(hotelId, months = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const matchQuery = {
        createdAt: {
            $gte: startDate
        }
    };
    
    // Only add hotelId filter if hotelId is provided and valid
    if (hotelId && mongoose.Types.ObjectId.isValid(hotelId)) {
        matchQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
    }

    return await this.aggregate([{
            $match: matchQuery
        },
        {
            $group: {
                _id: {
                    year: {
                        $year: '$createdAt'
                    },
                    month: {
                        $month: '$createdAt'
                    }
                },
                totalCost: {
                    $sum: {
                        $add: ['$directCosts.totalDirectCost', '$indirectCosts.totalIndirectCost']
                    }
                },
                bypassCount: {
                    $sum: 1
                },
                averageCost: {
                    $avg: {
                        $add: ['$directCosts.totalDirectCost', '$indirectCosts.totalIndirectCost']
                    }
                }
            }
        },
        {
            $sort: {
                '_id.year': 1,
                '_id.month': 1
            }
        }
    ]);
};

bypassFinancialImpactSchema.statics.getTopCostDrivers = async function(hotelId, limit = 10) {
    const matchQuery = {};
    
    // Only add hotelId filter if hotelId is provided and valid
    if (hotelId && mongoose.Types.ObjectId.isValid(hotelId)) {
        matchQuery.hotelId = new mongoose.Types.ObjectId(hotelId);
    }

    return await this.aggregate([{
            $match: matchQuery
        },
        {
            $unwind: '$directCosts.inventoryItems'
        },
        {
            $group: {
                _id: '$directCosts.inventoryItems.itemName',
                totalCost: {
                    $sum: '$directCosts.inventoryItems.totalCost'
                },
                frequency: {
                    $sum: 1
                },
                averageCost: {
                    $avg: '$directCosts.inventoryItems.totalCost'
                }
            }
        },
        {
            $sort: {
                totalCost: -1
            }
        },
        {
            $limit: limit
        }
    ]);
};

// Virtual for total financial impact
bypassFinancialImpactSchema.virtual('totalFinancialImpact').get(function() {
    return this.getTotalFinancialImpact();
});

// Virtual for recovery status
bypassFinancialImpactSchema.virtual('recoveryStatus').get(function() {
    const percentage = this.recovery.recoveryPercentage || 0;
    if (percentage >= 90) return 'fully_recovered';
    if (percentage >= 50) return 'partially_recovered';
    if (percentage > 0) return 'recovery_in_progress';
    return 'no_recovery';
});

// Virtual for budget impact severity
bypassFinancialImpactSchema.virtual('budgetImpactSeverity').get(function() {
    const totalImpact = this.getTotalFinancialImpact();
    if (totalImpact >= 10000) return 'severe';
    if (totalImpact >= 5000) return 'high';
    if (totalImpact >= 1000) return 'moderate';
    if (totalImpact >= 100) return 'low';
    return 'minimal';
});

export default mongoose.model('BypassFinancialImpact', bypassFinancialImpactSchema);
