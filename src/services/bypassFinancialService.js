import BypassFinancialImpact from '../models/BypassFinancialImpact.js';
import AdminBypassAudit from '../models/AdminBypassAudit.js';
import BypassApprovalWorkflow from '../models/BypassApprovalWorkflow.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import inventoryIntegrationService from './inventoryIntegrationService.js';
import {
    sendNotification
} from './notificationService.js';

class BypassFinancialService {
    constructor() {
        this.costRates = this.initializeCostRates();
        this.budgetThresholds = this.initializeBudgetThresholds();
    }

    /**
     * Initialize standard cost rates for calculations
     */
    initializeCostRates() {
        return {
            // Labor rates (per hour)
            labor: {
                admin: 25.00,
                manager: 45.00,
                housekeeping: 15.00,
                maintenance: 20.00,
                supervisor: 35.00
            },

            // Processing fees
            processing: {
                adminFee: 10.00,
                systemOverrideFee: 25.00,
                complianceFee: 50.00,
                auditFee: 75.00,
                escalationFee: 100.00
            },

            // Emergency procurement premiums
            emergency: {
                standardPremium: 0.25, // 25% premium
                urgentPremium: 0.50, // 50% premium
                criticalPremium: 1.00 // 100% premium
            },

            // Guest satisfaction compensation
            guestSatisfaction: {
                minorInconvenience: 25.00,
                moderateInconvenience: 75.00,
                majorInconvenience: 150.00,
                severeInconvenience: 300.00
            }
        };
    }

    /**
     * Initialize budget alert thresholds
     */
    initializeBudgetThresholds() {
        return {
            // Department budget thresholds
            departments: {
                housekeeping: {
                    warning: 0.8,
                    critical: 0.95
                },
                maintenance: {
                    warning: 0.8,
                    critical: 0.95
                },
                frontdesk: {
                    warning: 0.85,
                    critical: 0.98
                },
                management: {
                    warning: 0.9,
                    critical: 1.0
                }
            },

            // Financial impact thresholds
            impact: {
                low: 100,
                medium: 500,
                high: 1000,
                severe: 5000,
                critical: 10000
            },

            // Revenue impact thresholds (percentage)
            revenue: {
                minimal: 1, // 1%
                low: 5, // 5%
                moderate: 10, // 10%
                high: 20, // 20%
                severe: 50 // 50%
            }
        };
    }

    /**
     * Create comprehensive financial impact record for a bypass
     */
    async createFinancialImpact(bypassAuditId, additionalData = {}) {
        try {
            // Get bypass audit record with related data
            const auditRecord = await AdminBypassAudit.findById(bypassAuditId)
                .populate('bookingId')
                .populate('adminId')
                .populate('hotelId');

            if (!auditRecord) {
                throw new Error('Bypass audit record not found');
            }

            // Get booking details
            const booking = auditRecord.bookingId;
            const room = await Room.findById(booking.rooms[0]?.roomId);

            // Calculate financial impact
            const impactData = await this.calculateFinancialImpact(auditRecord, booking, room, additionalData);

            // Create financial impact record
            const financialImpact = await BypassFinancialImpact.createFinancialImpact({
                hotelId: auditRecord.hotelId,
                bypassAuditId: auditRecord._id,
                approvalWorkflowId: additionalData.approvalWorkflowId,
                bookingContext: {
                    bookingId: booking._id,
                    bookingNumber: booking.bookingNumber,
                    roomId: room?._id,
                    roomNumber: room?.roomNumber,
                    roomType: room?.type,
                    guestName: booking.userId?.name || 'Unknown',
                    stayDuration: this.calculateStayDuration(booking),
                    roomRate: booking.totalAmount / this.calculateStayDuration(booking),
                    totalBookingValue: booking.totalAmount,
                    currency: booking.currency || 'USD'
                },
                ...impactData
            });

            // Check for budget alerts
            await this.checkBudgetAlerts(financialImpact);

            // Process inventory integration
            try {
                const inventoryItems = this.extractInventoryItems(impactData.directCosts.inventoryItems);
                if (inventoryItems.length > 0) {
                    const inventoryResults = await inventoryIntegrationService.processBypassInventoryImpact(
                        auditRecord._id,
                        inventoryItems
                    );
                    console.log(`Inventory integration completed: ${inventoryResults.processed.length} items processed, ${inventoryResults.reordersCreated.length} reorders created`);
                }
            } catch (inventoryError) {
                console.error('Inventory integration failed:', inventoryError);
                // Don't fail the financial impact creation if inventory integration fails
            }

            // Log financial impact creation
            await AuditLog.logChange({
                hotelId: auditRecord.hotelId,
                tableName: 'BypassFinancialImpact',
                recordId: financialImpact._id,
                changeType: 'financial_impact_created',
                userId: auditRecord.adminId,
                source: 'bypass_financial_service',
                newValues: {
                    impactId: financialImpact.impactId,
                    totalDirectCost: financialImpact.directCosts.totalDirectCost,
                    totalIndirectCost: financialImpact.indirectCosts.totalIndirectCost,
                    netRevenueImpact: financialImpact.revenueImpact.netRevenueImpact
                },
                metadata: {
                    severity: financialImpact.budgetImpactSeverity,
                    totalImpact: financialImpact.totalFinancialImpact,
                    tags: ['financial_tracking', 'bypass_operation']
                }
            });

            return financialImpact;
        } catch (error) {
            console.error('Failed to create financial impact:', error);
            throw error;
        }
    }

    /**
     * Calculate comprehensive financial impact
     */
    async calculateFinancialImpact(auditRecord, booking, room, additionalData) {
        const reasonCategory = auditRecord.reason.category;
        const urgencyLevel = auditRecord.reason.urgencyLevel || 'medium';
        const riskScore = auditRecord.securityMetadata.riskScore || 0;
        const estimatedLoss = auditRecord.financialImpact.estimatedLoss || 0;

        // Calculate direct costs
        const directCosts = await this.calculateDirectCosts(auditRecord, booking, room, additionalData);

        // Calculate indirect costs
        const indirectCosts = await this.calculateIndirectCosts(auditRecord, booking, room, reasonCategory, urgencyLevel, riskScore);

        // Calculate revenue impact
        const revenueImpact = await this.calculateRevenueImpact(auditRecord, booking, room, estimatedLoss);

        // Calculate budget impact
        const budgetImpact = await this.calculateBudgetImpact(auditRecord, directCosts, indirectCosts, revenueImpact);

        // Perform analytics
        const analytics = await this.performFinancialAnalytics(auditRecord, directCosts.totalDirectCost + indirectCosts.totalIndirectCost);

        return {
            directCosts,
            indirectCosts,
            revenueImpact,
            budgetImpact,
            analytics,
            reconciliation: {
                status: 'pending',
                reconciledDirectCost: directCosts.totalDirectCost,
                reconciledIndirectCost: indirectCosts.totalIndirectCost,
                reconciledRevenueImpact: revenueImpact.netRevenueImpact,
                totalReconciledImpact: directCosts.totalDirectCost + indirectCosts.totalIndirectCost + Math.abs(revenueImpact.netRevenueImpact)
            },
            recovery: {
                recoveredAmount: 0,
                recoveryPercentage: 0,
                outstandingAmount: directCosts.totalDirectCost + indirectCosts.totalIndirectCost + Math.abs(revenueImpact.netRevenueImpact)
            }
        };
    }

    /**
     * Calculate direct costs
     */
    async calculateDirectCosts(auditRecord, booking, room, additionalData) {
        const reasonCategory = auditRecord.reason.category;
        const urgencyLevel = auditRecord.reason.urgencyLevel || 'medium';

        // Calculate inventory costs (if inventory items were bypassed)
        const inventoryItems = await this.calculateInventoryCosts(auditRecord, additionalData.bypassedItems || []);

        // Calculate labor costs
        const laborCosts = this.calculateLaborCosts(reasonCategory, urgencyLevel, auditRecord.operationStatus.duration);

        // Calculate processing fees
        const processingFees = this.calculateProcessingFees(auditRecord, urgencyLevel);

        // Calculate emergency procurement costs
        const emergencyProcurement = await this.calculateEmergencyProcurementCosts(auditRecord, additionalData.emergencyItems || []);

        return {
            inventoryItems,
            laborCosts,
            processingFees,
            emergencyProcurement,
            totalDirectCost: 0 // Will be calculated in pre-save middleware
        };
    }

    /**
     * Calculate inventory costs for bypassed items
     */
    async calculateInventoryCosts(auditRecord, bypassedItems) {
        const inventoryItems = [];

        // If specific items provided, calculate their costs
        for (const item of bypassedItems) {
            inventoryItems.push({
                itemId: item.itemId,
                itemName: item.itemName || 'Unknown Item',
                category: item.category || 'General',
                quantity: item.quantity || 1,
                unitCost: item.unitCost || 0,
                totalCost: (item.unitCost || 0) * (item.quantity || 1),
                supplierCost: item.supplierCost || item.unitCost || 0,
                replacementCost: item.replacementCost || (item.unitCost || 0) * 1.1,
                wasBypassed: true,
                bypassReason: auditRecord.reason.category,
                alternativeProvided: item.alternativeProvided || false,
                alternativeCost: item.alternativeCost || 0
            });
        }

        // If no specific items, estimate based on bypass category
        if (inventoryItems.length === 0) {
            const estimatedCost = this.estimateInventoryCostByCategory(auditRecord.reason.category);
            if (estimatedCost > 0) {
                inventoryItems.push({
                    itemName: `Estimated ${auditRecord.reason.category} items`,
                    category: auditRecord.reason.category,
                    quantity: 1,
                    unitCost: estimatedCost,
                    totalCost: estimatedCost,
                    supplierCost: estimatedCost * 0.7,
                    replacementCost: estimatedCost * 1.1,
                    wasBypassed: true,
                    bypassReason: auditRecord.reason.category,
                    alternativeProvided: false,
                    alternativeCost: 0
                });
            }
        }

        return inventoryItems;
    }

    /**
     * Estimate inventory cost by bypass category
     */
    estimateInventoryCostByCategory(category) {
        const categoryEstimates = {
            'inventory_unavailable': 75,
            'system_failure': 25,
            'guest_complaint': 50,
            'staff_shortage': 30,
            'technical_issue': 40,
            'emergency_medical': 100,
            'management_override': 150,
            'compliance_requirement': 60,
            'other': 80
        };

        return categoryEstimates[category] || 50;
    }

    /**
     * Calculate labor costs based on bypass processing
     */
    calculateLaborCosts(reasonCategory, urgencyLevel, operationDuration) {
        const rates = this.costRates.labor;
        const baseTime = this.getBaseLaborTime(reasonCategory, urgencyLevel);
        const actualTime = operationDuration ? operationDuration / (60 * 60 * 1000) : baseTime; // Convert ms to hours

        return {
            adminTime: {
                hours: actualTime,
                hourlyRate: rates.admin,
                totalCost: actualTime * rates.admin
            },
            managerTime: {
                hours: urgencyLevel === 'critical' ? actualTime * 0.5 : actualTime * 0.2,
                hourlyRate: rates.manager,
                totalCost: (urgencyLevel === 'critical' ? actualTime * 0.5 : actualTime * 0.2) * rates.manager
            },
            housekeepingTime: {
                hours: reasonCategory === 'inventory_unavailable' ? actualTime * 0.3 : 0,
                hourlyRate: rates.housekeeping,
                totalCost: (reasonCategory === 'inventory_unavailable' ? actualTime * 0.3 : 0) * rates.housekeeping
            },
            maintenanceTime: {
                hours: reasonCategory === 'technical_issue' ? actualTime * 0.5 : 0,
                hourlyRate: rates.maintenance,
                totalCost: (reasonCategory === 'technical_issue' ? actualTime * 0.5 : 0) * rates.maintenance
            }
        };
    }

    /**
     * Get base labor time estimate for different categories
     */
    getBaseLaborTime(reasonCategory, urgencyLevel) {
        const baseTimeByCategory = {
            'emergency_medical': 0.5,
            'system_failure': 1.0,
            'inventory_unavailable': 0.75,
            'guest_complaint': 1.5,
            'staff_shortage': 2.0,
            'technical_issue': 1.25,
            'management_override': 0.25,
            'compliance_requirement': 1.0,
            'other': 1.0
        };

        const urgencyMultipliers = {
            'low': 0.8,
            'medium': 1.0,
            'high': 1.3,
            'critical': 1.8
        };

        const baseTime = baseTimeByCategory[reasonCategory] || 1.0;
        const multiplier = urgencyMultipliers[urgencyLevel] || 1.0;

        return baseTime * multiplier;
    }

    /**
     * Calculate processing fees
     */
    calculateProcessingFees(auditRecord, urgencyLevel) {
        const fees = this.costRates.processing;
        const riskScore = auditRecord.securityMetadata.riskScore || 0;
        const hasApproval = auditRecord.approvalChain && auditRecord.approvalChain.length > 0;

        return {
            adminFee: fees.adminFee,
            systemOverrideFee: fees.systemOverrideFee,
            complianceFee: riskScore >= 60 ? fees.complianceFee : 0,
            auditFee: riskScore >= 80 ? fees.auditFee : 0,
            escalationFee: hasApproval ? fees.escalationFee : 0
        };
    }

    /**
     * Calculate emergency procurement costs
     */
    async calculateEmergencyProcurementCosts(auditRecord, emergencyItems) {
        const urgencyLevel = auditRecord.reason.urgencyLevel || 'medium';
        const premiumRates = this.costRates.emergency;

        let totalEmergencyCost = 0;
        let totalStandardCost = 0;
        const items = [];

        for (const item of emergencyItems) {
            const standardRate = item.standardRate || 0;
            let premiumMultiplier = 1;

            switch (urgencyLevel) {
                case 'critical':
                    premiumMultiplier = 1 + premiumRates.criticalPremium;
                    break;
                case 'high':
                    premiumMultiplier = 1 + premiumRates.urgentPremium;
                    break;
                default:
                    premiumMultiplier = 1 + premiumRates.standardPremium;
            }

            const emergencyRate = standardRate * premiumMultiplier;
            const quantity = item.quantity || 1;
            const itemEmergencyCost = emergencyRate * quantity;
            const itemStandardCost = standardRate * quantity;

            items.push({
                itemName: item.itemName,
                quantity,
                emergencyRate,
                standardRate,
                premiumPaid: itemEmergencyCost - itemStandardCost,
                supplier: item.supplier || 'Emergency Vendor',
                procurementTime: item.procurementTime || 1
            });

            totalEmergencyCost += itemEmergencyCost;
            totalStandardCost += itemStandardCost;
        }

        return {
            items,
            totalEmergencyCost,
            totalStandardCost,
            totalPremium: totalEmergencyCost - totalStandardCost
        };
    }

    /**
     * Calculate indirect costs
     */
    async calculateIndirectCosts(auditRecord, booking, room, reasonCategory, urgencyLevel, riskScore) {
        // Guest satisfaction impact
        const guestSatisfaction = this.calculateGuestSatisfactionCosts(reasonCategory, urgencyLevel, booking);

        // Operational disruption
        const operationalDisruption = this.calculateOperationalDisruptionCosts(reasonCategory, urgencyLevel, riskScore);

        // Compliance costs
        const compliance = this.calculateComplianceCosts(riskScore, auditRecord);

        // Risk impact
        const riskImpact = this.calculateRiskImpactCosts(riskScore, reasonCategory);

        return {
            guestSatisfaction,
            operationalDisruption,
            compliance,
            riskImpact,
            totalIndirectCost: 0 // Will be calculated in pre-save middleware
        };
    }

    /**
     * Calculate guest satisfaction costs
     */
    calculateGuestSatisfactionCosts(reasonCategory, urgencyLevel, booking) {
        const rates = this.costRates.guestSatisfaction;
        let compensationLevel = 'minorInconvenience';

        // Determine compensation level based on category and urgency
        if (reasonCategory === 'guest_complaint' || urgencyLevel === 'critical') {
            compensationLevel = 'severeInconvenience';
        } else if (reasonCategory === 'inventory_unavailable' || urgencyLevel === 'high') {
            compensationLevel = 'majorInconvenience';
        } else if (urgencyLevel === 'medium') {
            compensationLevel = 'moderateInconvenience';
        }

        const baseCompensation = rates[compensationLevel];
        const bookingValue = booking.totalAmount || 0;

        return {
            compensationProvided: baseCompensation,
            discountGiven: reasonCategory === 'guest_complaint' ? bookingValue * 0.1 : 0,
            freeServicesProvided: baseCompensation * 0.5,
            loyaltyPointsAwarded: baseCompensation * 10, // Points valued at $0.01 each
            estimatedFutureRevenueLoss: reasonCategory === 'guest_complaint' ? bookingValue * 2 : bookingValue * 0.1,
            reputationImpact: this.getReputationImpact(reasonCategory, urgencyLevel)
        };
    }

    /**
     * Get reputation impact level
     */
    getReputationImpact(reasonCategory, urgencyLevel) {
        if (reasonCategory === 'guest_complaint' && urgencyLevel === 'critical') {
            return 'severe';
        } else if (reasonCategory === 'guest_complaint' || urgencyLevel === 'high') {
            return 'significant';
        } else if (urgencyLevel === 'medium') {
            return 'moderate';
        } else {
            return 'minimal';
        }
    }

    /**
     * Calculate operational disruption costs
     */
    calculateOperationalDisruptionCosts(reasonCategory, urgencyLevel, riskScore) {
        const baseCost = 50; // Base operational cost
        const urgencyMultipliers = {
            low: 0.5,
            medium: 1.0,
            high: 1.5,
            critical: 2.0
        };
        const multiplier = urgencyMultipliers[urgencyLevel] || 1.0;

        return {
            delayedCheckouts: reasonCategory === 'system_failure' ? baseCost * multiplier : baseCost * 0.2,
            staffReallocation: baseCost * 0.5 * multiplier,
            systemDowntime: reasonCategory === 'system_failure' ? baseCost * 2 * multiplier : 0,
            processInefficiency: baseCost * 0.3 * multiplier,
            communicationOverhead: riskScore >= 60 ? baseCost * 0.4 * multiplier : baseCost * 0.1
        };
    }

    /**
     * Calculate compliance costs
     */
    calculateComplianceCosts(riskScore, auditRecord) {
        const baseCost = 25;
        const hasApproval = auditRecord.approvalChain && auditRecord.approvalChain.length > 0;

        return {
            additionalAuditTime: riskScore >= 60 ? baseCost * 2 : baseCost,
            complianceReviewCost: riskScore >= 80 ? baseCost * 3 : baseCost * 0.5,
            documentationCost: baseCost * 0.5,
            reportingCost: hasApproval ? baseCost * 1.5 : baseCost * 0.3,
            regulatoryRiskCost: riskScore >= 90 ? baseCost * 4 : 0
        };
    }

    /**
     * Calculate risk impact costs
     */
    calculateRiskImpactCosts(riskScore, reasonCategory) {
        const baseCost = 30;
        const riskMultiplier = riskScore / 100;

        return {
            insurancePremiumIncrease: baseCost * riskMultiplier * 0.1,
            securityRiskCost: baseCost * riskMultiplier,
            fraudRiskCost: reasonCategory === 'management_override' ? baseCost * riskMultiplier * 2 : baseCost * riskMultiplier * 0.5,
            operationalRiskCost: baseCost * riskMultiplier * 0.8,
            reputationalRiskCost: reasonCategory === 'guest_complaint' ? baseCost * riskMultiplier * 1.5 : baseCost * riskMultiplier * 0.3
        };
    }

    /**
     * Calculate revenue impact
     */
    async calculateRevenueImpact(auditRecord, booking, room, estimatedLoss) {
        const bookingValue = booking.totalAmount || 0;
        const reasonCategory = auditRecord.reason.category;

        // Calculate lost revenue
        const lostRevenue = {
            inventoryCharges: estimatedLoss * 0.3, // Assume 30% of estimated loss is inventory charges
            serviceCharges: reasonCategory === 'inventory_unavailable' ? bookingValue * 0.05 : 0,
            upsellOpportunities: bookingValue * 0.15, // Missed upsell opportunities
            crossSellOpportunities: bookingValue * 0.08, // Missed cross-sell opportunities
            futureBookingsLost: reasonCategory === 'guest_complaint' ? bookingValue * 1.5 : bookingValue * 0.1
        };

        // Calculate recovery efforts
        const recoveryEfforts = {
            alternativeServicesProvided: estimatedLoss * 0.5,
            compensatoryRevenue: 0, // Will be updated based on alternatives provided
            retentionIncentives: reasonCategory === 'guest_complaint' ? bookingValue * 0.1 : 0,
            loyaltyRecovery: bookingValue * 0.02 // Loyalty program recovery value
        };

        return {
            lostRevenue,
            recoveryEfforts,
            netRevenueImpact: 0, // Will be calculated in pre-save middleware
            revenueImpactPercentage: 0 // Will be calculated in pre-save middleware
        };
    }

    /**
     * Calculate budget impact
     */
    async calculateBudgetImpact(auditRecord, directCosts, indirectCosts, revenueImpact) {
        const currentDate = new Date();
        const fiscalYear = currentDate.getFullYear();
        const fiscalQuarter = Math.ceil((currentDate.getMonth() + 1) / 3);
        const fiscalMonth = currentDate.getMonth() + 1;

        const totalImpact = directCosts.totalDirectCost + indirectCosts.totalIndirectCost;

        // Simulate department budget data (in production, this would come from actual budget system)
        const affectedDepartments = await this.getAffectedDepartments(auditRecord.reason.category, totalImpact);

        // Create fiscal impact
        const fiscalImpact = {
            fiscalYear,
            fiscalQuarter,
            fiscalMonth,
            quarterlyBudgetImpact: totalImpact,
            annualBudgetImpact: totalImpact,
            budgetUtilizationIncrease: this.calculateBudgetUtilizationIncrease(totalImpact)
        };

        // Create cost center attribution
        const costCenters = this.createCostCenterAttribution(auditRecord.reason.category, totalImpact);

        return {
            affectedDepartments,
            fiscalImpact,
            costCenters,
            budgetAlerts: [] // Will be populated by checkBudgetAlerts
        };
    }

    /**
     * Get affected departments based on bypass category
     */
    async getAffectedDepartments(reasonCategory, totalImpact) {
        const departments = [];

        // Determine which departments are affected based on reason category
        const departmentMapping = {
            'inventory_unavailable': ['housekeeping', 'frontdesk'],
            'system_failure': ['frontdesk', 'maintenance'],
            'guest_complaint': ['frontdesk', 'management'],
            'staff_shortage': ['frontdesk', 'housekeeping'],
            'technical_issue': ['maintenance', 'frontdesk'],
            'emergency_medical': ['frontdesk', 'management'],
            'management_override': ['management'],
            'compliance_requirement': ['management', 'frontdesk'],
            'other': ['frontdesk']
        };

        const affectedDepts = departmentMapping[reasonCategory] || ['frontdesk'];

        for (const deptName of affectedDepts) {
            // Simulate department budget data (in production, fetch from budget system)
            const deptBudget = await this.getDepartmentBudget(deptName);
            const impactAmount = totalImpact / affectedDepts.length; // Distribute impact evenly

            departments.push({
                departmentId: `dept_${deptName}`,
                departmentName: deptName,
                budgetCode: `BUDGET_${deptName.toUpperCase()}`,
                allocatedBudget: deptBudget.allocated,
                spentAmount: deptBudget.spent + impactAmount,
                impactAmount,
                impactPercentage: 0, // Will be calculated in pre-save middleware
                budgetVariance: 0, // Will be calculated in pre-save middleware
                isOverBudget: false // Will be calculated in pre-save middleware
            });
        }

        return departments;
    }

    /**
     * Simulate department budget data
     */
    async getDepartmentBudget(departmentName) {
        // In production, this would fetch from actual budget system
        const budgets = {
            housekeeping: {
                allocated: 50000,
                spent: 35000
            },
            frontdesk: {
                allocated: 75000,
                spent: 55000
            },
            maintenance: {
                allocated: 40000,
                spent: 28000
            },
            management: {
                allocated: 100000,
                spent: 70000
            }
        };

        return budgets[departmentName] || {
            allocated: 25000,
            spent: 15000
        };
    }

    /**
     * Calculate budget utilization increase
     */
    calculateBudgetUtilizationIncrease(totalImpact) {
        // Simplified calculation - in production would be more sophisticated
        return totalImpact / 100000; // Assume $100k total budget for calculation
    }

    /**
     * Create cost center attribution
     */
    createCostCenterAttribution(reasonCategory, totalImpact) {
        const costCenters = [];

        // Define cost center allocation rules
        const allocationRules = {
            'inventory_unavailable': [{
                    code: 'CC_HOUSEKEEPING',
                    name: 'Housekeeping Operations',
                    percentage: 0.7
                },
                {
                    code: 'CC_PROCUREMENT',
                    name: 'Procurement',
                    percentage: 0.3
                }
            ],
            'system_failure': [{
                    code: 'CC_IT',
                    name: 'Information Technology',
                    percentage: 0.8
                },
                {
                    code: 'CC_OPERATIONS',
                    name: 'Operations',
                    percentage: 0.2
                }
            ],
            'guest_complaint': [{
                    code: 'CC_GUEST_SERVICES',
                    name: 'Guest Services',
                    percentage: 0.6
                },
                {
                    code: 'CC_MANAGEMENT',
                    name: 'Management',
                    percentage: 0.4
                }
            ]
        };

        const rules = allocationRules[reasonCategory] || [{
            code: 'CC_OPERATIONS',
            name: 'Operations',
            percentage: 1.0
        }];

        for (const rule of rules) {
            costCenters.push({
                costCenterCode: rule.code,
                costCenterName: rule.name,
                attributedCost: totalImpact * rule.percentage,
                costType: 'direct',
                allocationMethod: 'category_based',
                allocationPercentage: rule.percentage * 100
            });
        }

        return costCenters;
    }

    /**
     * Perform financial analytics
     */
    async performFinancialAnalytics(auditRecord, totalCost) {
        const hotelId = auditRecord.hotelId;
        const reasonCategory = auditRecord.reason.category;

        // Check for recurring patterns
        const frequencyPattern = await this.analyzeFrequencyPattern(hotelId, reasonCategory);

        // Analyze cost trends
        const costTrends = await this.analyzeCostTrends(hotelId, totalCost);

        // Perform comparative analysis
        const comparativeAnalysis = await this.performComparativeAnalysis(hotelId, totalCost);

        // Generate predictive indicators
        const predictiveIndicators = await this.generatePredictiveIndicators(hotelId, reasonCategory, totalCost);

        return {
            frequencyPattern,
            costTrends,
            comparativeAnalysis,
            predictiveIndicators
        };
    }

    /**
     * Analyze frequency patterns
     */
    async analyzeFrequencyPattern(hotelId, reasonCategory) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Count similar bypasses in the last 30 days
        const similarBypasses = await AdminBypassAudit.countDocuments({
            hotelId,
            'reason.category': reasonCategory,
            createdAt: {
                $gte: thirtyDaysAgo
            }
        });

        // Get all bypasses for this category to calculate intervals
        const allBypasses = await AdminBypassAudit.find({
            hotelId,
            'reason.category': reasonCategory,
            createdAt: {
                $gte: thirtyDaysAgo
            }
        }).sort({
            createdAt: 1
        }).select('createdAt');

        let averageInterval = 0;
        let isRecurring = false;

        if (allBypasses.length > 1) {
            let totalInterval = 0;
            for (let i = 1; i < allBypasses.length; i++) {
                const interval = allBypasses[i].createdAt - allBypasses[i - 1].createdAt;
                totalInterval += interval;
            }
            averageInterval = totalInterval / (allBypasses.length - 1);
            averageInterval = averageInterval / (24 * 60 * 60 * 1000); // Convert to days

            // Consider recurring if more than 3 occurrences with average interval < 10 days
            isRecurring = allBypasses.length >= 3 && averageInterval < 10;
        }

        return {
            isRecurring,
            recurrenceInterval: Math.round(averageInterval),
            similarBypassesCount: similarBypasses,
            patternConfidence: Math.min(similarBypasses / 10, 1.0) // Max confidence at 10 occurrences
        };
    }

    /**
     * Analyze cost trends
     */
    async analyzeCostTrends(hotelId, currentCost) {
        // Get cost data for the last 12 months
        const costData = await BypassFinancialImpact.getCostTrends(hotelId, 12);

        if (costData.length < 2) {
            return {
                monthlyTrend: 'stable',
                quarterlyTrend: 'stable',
                yearlyTrend: 'stable',
                trendConfidence: 0,
                projectedMonthlyCost: currentCost,
                projectedQuarterlyCost: currentCost * 3,
                projectedYearlyCost: currentCost * 12
            };
        }

        // Calculate trends
        const recentCosts = costData.slice(-3); // Last 3 months
        const monthlyTrend = this.calculateTrend(recentCosts.map(d => d.totalCost));

        const quarterlyData = this.groupByQuarter(costData);
        const quarterlyTrend = quarterlyData.length > 1 ?
            this.calculateTrend(quarterlyData.slice(-2).map(d => d.totalCost)) : 'stable';

        const yearlyTrend = costData.length >= 12 ?
            this.calculateTrend([costData.slice(0, 6).reduce((sum, d) => sum + d.totalCost, 0),
                costData.slice(-6).reduce((sum, d) => sum + d.totalCost, 0)
            ]) : 'stable';

        // Project future costs based on trends
        const avgMonthlyCost = costData.reduce((sum, d) => sum + d.totalCost, 0) / costData.length;
        const trendMultiplier = monthlyTrend === 'increasing' ? 1.1 : monthlyTrend === 'decreasing' ? 0.9 : 1.0;

        return {
            monthlyTrend,
            quarterlyTrend,
            yearlyTrend,
            trendConfidence: Math.min(costData.length / 12, 1.0),
            projectedMonthlyCost: avgMonthlyCost * trendMultiplier,
            projectedQuarterlyCost: avgMonthlyCost * trendMultiplier * 3,
            projectedYearlyCost: avgMonthlyCost * trendMultiplier * 12
        };
    }

    /**
     * Calculate trend direction
     */
    calculateTrend(values) {
        if (values.length < 2) return 'stable';

        const firstHalf = values.slice(0, Math.ceil(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));

        const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

        const change = (secondAvg - firstAvg) / firstAvg;

        if (change > 0.1) return 'increasing';
        if (change < -0.1) return 'decreasing';
        return 'stable';
    }

    /**
     * Group cost data by quarter
     */
    groupByQuarter(costData) {
        const quarters = {};

        costData.forEach(data => {
            const quarter = `${data._id.year}-Q${Math.ceil(data._id.month / 3)}`;
            if (!quarters[quarter]) {
                quarters[quarter] = {
                    totalCost: 0,
                    count: 0
                };
            }
            quarters[quarter].totalCost += data.totalCost;
            quarters[quarter].count += data.bypassCount;
        });

        return Object.values(quarters);
    }

    /**
     * Perform comparative analysis
     */
    async performComparativeAnalysis(hotelId, currentCost) {
        // Get average cost per bypass for this hotel
        const summary = await BypassFinancialImpact.getHotelFinancialSummary(hotelId, 90);
        const averageCost = summary.averageImpactPerBypass || 0;

        // Calculate percentile ranking
        const allCosts = await BypassFinancialImpact.find({
                hotelId
            })
            .select('directCosts.totalDirectCost indirectCosts.totalIndirectCost')
            .lean();

        const totalCosts = allCosts.map(impact =>
            (impact.directCosts?.totalDirectCost || 0) + (impact.indirectCosts?.totalIndirectCost || 0)
        ).sort((a, b) => a - b);

        let percentileRanking = 50; // Default to median
        if (totalCosts.length > 0) {
            const position = totalCosts.findIndex(cost => cost >= currentCost);
            percentileRanking = position === -1 ? 100 : (position / totalCosts.length) * 100;
        }

        const costVariance = currentCost - averageCost;
        const isOutlier = Math.abs(costVariance) > averageCost * 2; // More than 2x average

        return {
            averageCostPerBypass: averageCost,
            percentileRanking: Math.round(percentileRanking),
            costVarianceFromAverage: costVariance,
            isOutlier,
            outlierReason: isOutlier ? (costVariance > 0 ? 'Exceptionally high cost' : 'Exceptionally low cost') : null
        };
    }

    /**
     * Generate predictive indicators
     */
    async generatePredictiveIndicators(hotelId, reasonCategory, currentCost) {
        // Analyze historical patterns
        const historicalData = await AdminBypassAudit.find({
            hotelId,
            'reason.category': reasonCategory,
            createdAt: {
                $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            }
        }).sort({
            createdAt: 1
        });

        const likelyToRecur = historicalData.length >= 3;
        const recurrenceProbability = Math.min(historicalData.length / 10, 0.9); // Max 90% probability

        // Predict next occurrence
        let nextOccurrencePrediction = null;
        if (likelyToRecur && historicalData.length > 1) {
            const intervals = [];
            for (let i = 1; i < historicalData.length; i++) {
                intervals.push(historicalData[i].createdAt - historicalData[i - 1].createdAt);
            }
            const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
            nextOccurrencePrediction = new Date(Date.now() + avgInterval);
        }

        // Generate recommendations
        const preventionRecommendations = this.generatePreventionRecommendations(reasonCategory, historicalData.length);
        const riskMitigationSuggestions = this.generateRiskMitigationSuggestions(reasonCategory, currentCost);

        return {
            likelyToRecur,
            recurrenceProbability,
            nextOccurrencePrediction,
            preventionRecommendations,
            riskMitigationSuggestions
        };
    }

    /**
     * Generate prevention recommendations
     */
    generatePreventionRecommendations(reasonCategory, frequency) {
        const recommendations = {
            'inventory_unavailable': [
                'Implement automated inventory reorder points',
                'Increase safety stock levels for critical items',
                'Set up supplier backup agreements'
            ],
            'system_failure': [
                'Implement system redundancy and failover',
                'Increase system monitoring and alerting',
                'Create manual backup procedures'
            ],
            'guest_complaint': [
                'Enhance staff training on guest service',
                'Implement proactive guest communication',
                'Review and improve service standards'
            ],
            'staff_shortage': [
                'Cross-train staff for multiple roles',
                'Implement flexible scheduling system',
                'Create on-call staff pool'
            ]
        };

        let baseRecommendations = recommendations[reasonCategory] || [
            'Review and improve operational procedures',
            'Implement preventive measures',
            'Enhance staff training'
        ];

        // Add frequency-based recommendations
        if (frequency >= 5) {
            baseRecommendations.push('Conduct root cause analysis');
            baseRecommendations.push('Consider process redesign');
        }

        return baseRecommendations;
    }

    /**
     * Generate risk mitigation suggestions
     */
    generateRiskMitigationSuggestions(reasonCategory, currentCost) {
        const suggestions = [
            'Implement early warning systems',
            'Create contingency plans',
            'Establish clear escalation procedures'
        ];

        if (currentCost > 1000) {
            suggestions.push('Require additional approvals for high-cost bypasses');
            suggestions.push('Implement cost-benefit analysis for alternatives');
        }

        if (reasonCategory === 'guest_complaint') {
            suggestions.push('Implement guest satisfaction monitoring');
            suggestions.push('Create guest recovery protocols');
        }

        return suggestions;
    }

    /**
     * Check and create budget alerts
     */
    async checkBudgetAlerts(financialImpact) {
        const totalImpact = financialImpact.getTotalFinancialImpact();
        const thresholds = this.budgetThresholds;

        // Check impact level alerts
        if (totalImpact >= thresholds.impact.critical) {
            financialImpact.addBudgetAlert(
                'threshold_exceeded',
                thresholds.impact.critical,
                totalImpact,
                `Critical financial impact threshold exceeded: $${totalImpact.toLocaleString()}`
            );
        }

        // Check department budget alerts
        for (const dept of financialImpact.budgetImpact.affectedDepartments) {
            const utilization = dept.spentAmount / dept.allocatedBudget;
            const deptThresholds = thresholds.departments[dept.departmentName] || thresholds.departments.frontdesk;

            if (utilization >= deptThresholds.critical) {
                financialImpact.addBudgetAlert(
                    'budget_overrun',
                    deptThresholds.critical,
                    utilization,
                    `Department ${dept.departmentName} budget overrun: ${(utilization * 100).toFixed(1)}%`
                );
            } else if (utilization >= deptThresholds.warning) {
                financialImpact.addBudgetAlert(
                    'threshold_exceeded',
                    deptThresholds.warning,
                    utilization,
                    `Department ${dept.departmentName} approaching budget limit: ${(utilization * 100).toFixed(1)}%`
                );
            }
        }

        // Send notifications for critical alerts
        const criticalAlerts = financialImpact.budgetImpact.budgetAlerts.filter(alert => alert.alertLevel === 'critical');
        if (criticalAlerts.length > 0) {
            await this.sendBudgetAlertNotifications(financialImpact, criticalAlerts);
        }
    }

    /**
     * Send budget alert notifications
     */
    async sendBudgetAlertNotifications(financialImpact, alerts) {
        try {
            // Get hotel managers for notifications
            const managers = await User.find({
                hotelId: financialImpact.hotelId,
                role: {
                    $in: ['manager', 'admin']
                },
                status: 'active'
            });

            for (const manager of managers) {
                if (manager.email) {
                    await sendNotification({
                        type: 'email',
                        recipient: manager.email,
                        subject: 'Critical Budget Alert - Bypass Operation',
                        message: `Critical budget alerts have been triggered for bypass operation ${financialImpact.impactId}:
            
${alerts.map(alert => `• ${alert.alertMessage}`).join('\n')}

Total Financial Impact: $${financialImpact.getTotalFinancialImpact().toLocaleString()}
Bypass ID: ${financialImpact.bypassAuditId}

Please review the financial impact and take appropriate action.`,
                        metadata: {
                            impactId: financialImpact.impactId,
                            totalImpact: financialImpact.getTotalFinancialImpact(),
                            alertCount: alerts.length,
                            urgency: 'high'
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Failed to send budget alert notifications:', error);
        }
    }

    /**
     * Extract inventory items for integration
     */
    extractInventoryItems(inventoryItems) {
        return inventoryItems.map(item => ({
            itemId: item.itemId || this.generateItemId(item.itemName),
            itemName: item.itemName,
            category: item.category,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
            wasBypassed: item.wasBypassed,
            bypassReason: item.bypassReason,
            alternativeProvided: item.alternativeProvided,
            alternativeCost: item.alternativeCost
        }));
    }

    /**
     * Generate item ID from name (fallback)
     */
    generateItemId(itemName) {
        if (!itemName) return 'unknown';
        return itemName.toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    /**
     * Calculate stay duration
     */
    calculateStayDuration(booking) {
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        const diffTime = Math.abs(checkOut - checkIn);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(diffDays, 1); // Minimum 1 day
    }

    /**
     * Update financial impact with actual costs
     */
    async updateFinancialImpact(impactId, updateData) {
        const financialImpact = await BypassFinancialImpact.findOne({
            impactId
        });
        if (!financialImpact) {
            throw new Error('Financial impact record not found');
        }

        // Update the record with new data
        Object.assign(financialImpact, updateData);
        await financialImpact.save();

        return financialImpact;
    }

    /**
     * Get financial summary for a hotel
     */
    async getHotelFinancialSummary(hotelId, timeRange = 30) {
        return await BypassFinancialImpact.getHotelFinancialSummary(hotelId, timeRange);
    }

    /**
     * Get cost trends for a hotel
     */
    async getCostTrends(hotelId, months = 12) {
        return await BypassFinancialImpact.getCostTrends(hotelId, months);
    }

    /**
     * Get top cost drivers
     */
    async getTopCostDrivers(hotelId, limit = 10) {
        return await BypassFinancialImpact.getTopCostDrivers(hotelId, limit);
    }
}

export default new BypassFinancialService();