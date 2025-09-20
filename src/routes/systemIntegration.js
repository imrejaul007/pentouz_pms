import express from 'express';
import {
    authenticate,
    authorize
} from '../middleware/auth.js';
import inventoryIntegrationService from '../services/inventoryIntegrationService.js';
import workflowAutomationService from '../services/workflowAutomationService.js';
import {
    sendNotification
} from '../services/notificationService.js';
import {
    catchAsync
} from '../utils/catchAsync.js';
import {
    ApplicationError
} from '../middleware/errorHandler.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(authorize('admin', 'manager'));

/**
 * Get system integration health status
 */
router.get('/health', catchAsync(async (req, res) => {
    const [
        inventoryHealth,
        automationHealth
    ] = await Promise.all([
        inventoryIntegrationService.getIntegrationHealth(),
        workflowAutomationService.getAutomationHealth()
    ]);

    const overallHealth = {
        status: 'healthy',
        timestamp: new Date(),
        services: {
            inventory: inventoryHealth,
            automation: automationHealth,
            notifications: {
                status: 'healthy',
                channels: ['email', 'sms', 'push', 'webhook', 'inApp'],
                enabled: true
            }
        }
    };

    // Determine overall status
    const serviceStatuses = [
        inventoryHealth.status,
        automationHealth.status
    ];

    if (serviceStatuses.includes('critical')) {
        overallHealth.status = 'critical';
    } else if (serviceStatuses.includes('degraded')) {
        overallHealth.status = 'degraded';
    }

    res.status(200).json({
        status: 'success',
        data: overallHealth
    });
}));

/**
 * Trigger inventory reconciliation
 */
router.post('/inventory/reconciliation', catchAsync(async (req, res) => {
    const {
        timeRange = 24
    } = req.body;
    const hotelId = req.user.hotelId;

    const reconciliationResults = await inventoryIntegrationService.performInventoryReconciliation(
        hotelId,
        timeRange
    );

    res.status(200).json({
        status: 'success',
        message: 'Inventory reconciliation completed',
        data: reconciliationResults
    });
}));

/**
 * Test inventory integration
 */
router.post('/inventory/test', catchAsync(async (req, res) => {
    const {
        itemId = 'test_item', quantity = 1
    } = req.body;
    const hotelId = req.user.hotelId;

    // Create test inventory impact
    const testItems = [{
        itemId,
        itemName: 'Test Item',
        category: 'Test',
        quantity,
        unitCost: 10,
        totalCost: 10 * quantity,
        wasBypassed: true,
        bypassReason: 'integration_test'
    }];

    const testResults = await inventoryIntegrationService.processBypassInventoryImpact(
        'test_bypass_id',
        testItems
    );

    res.status(200).json({
        status: 'success',
        message: 'Inventory integration test completed',
        data: testResults
    });
}));

/**
 * Get automation rules
 */
router.get('/automation/rules', catchAsync(async (req, res) => {
    const automationHealth = await workflowAutomationService.getAutomationHealth();

    res.status(200).json({
        status: 'success',
        data: {
            enabled: automationHealth.enabled,
            rules: automationHealth.rules,
            templates: automationHealth.templates,
            metrics: automationHealth.metrics
        }
    });
}));

/**
 * Update automation rule
 */
router.put('/automation/rules/:ruleType/:ruleName', catchAsync(async (req, res) => {
    const {
        ruleType,
        ruleName
    } = req.params;
    const ruleConfig = req.body;

    const updateResult = await workflowAutomationService.updateAutomationRules(
        ruleType,
        ruleName,
        ruleConfig
    );

    res.status(200).json({
        status: 'success',
        message: 'Automation rule updated successfully',
        data: updateResult
    });
}));

/**
 * Test workflow automation
 */
router.post('/automation/test', catchAsync(async (req, res) => {
    const {
        bypassAuditId
    } = req.body;

    if (!bypassAuditId) {
        throw new ApplicationError('Bypass audit ID is required', 400);
    }

    const automationResult = await workflowAutomationService.processAutomatedBypass(bypassAuditId);

    res.status(200).json({
        status: 'success',
        message: 'Workflow automation test completed',
        data: automationResult
    });
}));

/**
 * Test notification system
 */
router.post('/notifications/test', catchAsync(async (req, res) => {
    const {
        type = 'email',
            recipient = req.user.email,
            subject = 'Test Notification',
            message = 'This is a test notification from the bypass system.',
            channels = ['email']
    } = req.body;

    const notificationResult = await sendNotification({
        type: 'custom',
        recipient,
        channels,
        priority: 'medium',
        data: {
            subject,
            message,
            testNotification: true,
            timestamp: new Date().toISOString()
        }
    });

    res.status(200).json({
        status: 'success',
        message: 'Test notification sent',
        data: notificationResult
    });
}));

/**
 * Get system integration metrics
 */
router.get('/metrics', catchAsync(async (req, res) => {
    const {
        timeRange = 24
    } = req.query;
    const hotelId = req.user.hotelId;

    // Simulate metrics collection
    // In production, these would come from actual monitoring systems
    const metrics = {
        timeRange: `${timeRange} hours`,
        inventory: {
            totalIntegrations: 45,
            successfulIntegrations: 43,
            failedIntegrations: 2,
            averageResponseTime: 250, // ms
            reordersCreated: 12,
            stockAdjustments: 38,
            reconciliationAccuracy: 98.5 // %
        },
        automation: {
            totalWorkflows: 67,
            automatedWorkflows: 52,
            manualWorkflows: 15,
            autoApprovalRate: 35, // %
            averageProcessingTime: 180, // seconds
            errorRate: 2.3 // %
        },
        notifications: {
            totalNotifications: 156,
            emailNotifications: 98,
            smsNotifications: 23,
            pushNotifications: 35,
            deliverySuccessRate: 97.4, // %
            averageDeliveryTime: 3.2 // seconds
        },
        financial: {
            totalImpactsTracked: 67,
            averageImpactValue: 245.50,
            budgetAlertsTriggered: 8,
            recoveryActionsCreated: 23,
            recoveryRate: 78.5 // %
        }
    };

    res.status(200).json({
        status: 'success',
        data: metrics
    });
}));

/**
 * Trigger system sync
 */
router.post('/sync', catchAsync(async (req, res) => {
    const {
        services = ['inventory', 'automation', 'notifications']
    } = req.body;
    const hotelId = req.user.hotelId;

    const syncResults = {
        timestamp: new Date(),
        services: {},
        overallSuccess: true
    };

    // Sync inventory system
    if (services.includes('inventory')) {
        try {
            const reconciliation = await inventoryIntegrationService.performInventoryReconciliation(hotelId, 1);
            syncResults.services.inventory = {
                success: true,
                itemsReconciled: reconciliation.itemsReconciled,
                discrepancies: reconciliation.discrepancies.length,
                timestamp: new Date()
            };
        } catch (error) {
            syncResults.services.inventory = {
                success: false,
                error: error.message,
                timestamp: new Date()
            };
            syncResults.overallSuccess = false;
        }
    }

    // Sync automation system
    if (services.includes('automation')) {
        try {
            const health = await workflowAutomationService.getAutomationHealth();
            syncResults.services.automation = {
                success: true,
                enabled: health.enabled,
                rulesCount: health.metrics.totalRules,
                timestamp: new Date()
            };
        } catch (error) {
            syncResults.services.automation = {
                success: false,
                error: error.message,
                timestamp: new Date()
            };
            syncResults.overallSuccess = false;
        }
    }

    // Sync notification system
    if (services.includes('notifications')) {
        try {
            // Test notification system
            await sendNotification({
                type: 'email',
                recipient: req.user.email,
                channels: ['email'],
                data: {
                    subject: 'System Sync Test',
                    message: 'System sync completed successfully',
                    timestamp: new Date().toISOString()
                }
            });

            syncResults.services.notifications = {
                success: true,
                testNotificationSent: true,
                timestamp: new Date()
            };
        } catch (error) {
            syncResults.services.notifications = {
                success: false,
                error: error.message,
                timestamp: new Date()
            };
            syncResults.overallSuccess = false;
        }
    }

    res.status(syncResults.overallSuccess ? 200 : 207).json({
        status: syncResults.overallSuccess ? 'success' : 'partial_success',
        message: syncResults.overallSuccess ? 'System sync completed successfully' : 'System sync completed with some errors',
        data: syncResults
    });
}));

/**
 * Get integration logs
 */
router.get('/logs', catchAsync(async (req, res) => {
    const {
        limit = 50,
            offset = 0,
            service = 'all',
            level = 'all',
            timeRange = 24
    } = req.query;

    // Simulate log retrieval
    // In production, this would query actual log storage (ELK, CloudWatch, etc.)
    const logs = [];
    const logTypes = ['inventory', 'automation', 'notification', 'financial'];
    const logLevels = ['info', 'warn', 'error'];

    for (let i = 0; i < parseInt(limit); i++) {
        const logType = logTypes[Math.floor(Math.random() * logTypes.length)];
        const logLevel = logLevels[Math.floor(Math.random() * logLevels.length)];

        if (service !== 'all' && logType !== service) continue;
        if (level !== 'all' && logLevel !== level) continue;

        logs.push({
            id: `log_${Date.now()}_${i}`,
            timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
            service: logType,
            level: logLevel,
            message: `Sample ${logType} ${logLevel} message ${i}`,
            metadata: {
                hotelId: req.user.hotelId,
                userId: req.user._id,
                component: `${logType}_service`
            }
        });
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json({
        status: 'success',
        data: {
            logs: logs.slice(parseInt(offset), parseInt(offset) + parseInt(limit)),
            pagination: {
                total: logs.length,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: logs.length > parseInt(offset) + parseInt(limit)
            },
            filters: {
                service,
                level,
                timeRange: `${timeRange} hours`
            }
        }
    });
}));

/**
 * Configure system integration settings
 */
router.put('/settings', catchAsync(async (req, res) => {
    const settings = req.body;
    const hotelId = req.user.hotelId;

    // Validate settings
    const validSettings = {
        inventory: {
            autoAdjustEnabled: Boolean(settings.inventory?.autoAdjustEnabled),
            autoReorderEnabled: Boolean(settings.inventory?.autoReorderEnabled),
            reconciliationInterval: parseInt(settings.inventory?.reconciliationInterval) || 24
        },
        automation: {
            enabled: Boolean(settings.automation?.enabled),
            autoApprovalEnabled: Boolean(settings.automation?.autoApprovalEnabled),
            autoEscalationEnabled: Boolean(settings.automation?.autoEscalationEnabled)
        },
        notifications: {
            emailEnabled: Boolean(settings.notifications?.emailEnabled ?? true),
            smsEnabled: Boolean(settings.notifications?.smsEnabled),
            pushEnabled: Boolean(settings.notifications?.pushEnabled),
            webhookEnabled: Boolean(settings.notifications?.webhookEnabled)
        }
    };

    // In production, save settings to database
    console.log(`Updating integration settings for hotel ${hotelId}:`, validSettings);

    res.status(200).json({
        status: 'success',
        message: 'Integration settings updated successfully',
        data: {
            hotelId,
            settings: validSettings,
            updatedAt: new Date()
        }
    });
}));

/**
 * Get system integration settings
 */
router.get('/settings', catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;

    // In production, retrieve from database
    const settings = {
        hotelId,
        inventory: {
            autoAdjustEnabled: true,
            autoReorderEnabled: true,
            reconciliationInterval: 24
        },
        automation: {
            enabled: true,
            autoApprovalEnabled: true,
            autoEscalationEnabled: true
        },
        notifications: {
            emailEnabled: true,
            smsEnabled: false,
            pushEnabled: true,
            webhookEnabled: false
        },
        updatedAt: new Date(),
        version: '1.0.0'
    };

    res.status(200).json({
        status: 'success',
        data: settings
    });
}));

export default router;