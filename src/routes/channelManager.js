import express from 'express';
import channelController from '../controllers/channelManagerController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Channel Management Routes
router.post('/channels', authenticate, authorize(['admin', 'channel_manager']), channelController.createChannel);
router.get('/channels', authenticate, authorize(['admin', 'channel_manager', 'manager']), channelController.getChannels);
router.get('/channels/:id', authenticate, authorize(['admin', 'channel_manager', 'manager']), channelController.getChannel);
router.put('/channels/:id', authenticate, authorize(['admin', 'channel_manager']), channelController.updateChannel);
router.delete('/channels/:id', authenticate, authorize(['admin', 'channel_manager']), channelController.deleteChannel);
router.post('/channels/:channelId/test-connection', authenticate, authorize(['admin', 'channel_manager']), channelController.testChannelConnection);

// Synchronization Routes
router.post('/sync/channel/:channelId', authenticate, authorize(['admin', 'channel_manager']), channelController.syncToChannel);
router.post('/sync/all-channels', authenticate, authorize(['admin', 'channel_manager']), channelController.syncToAllChannels);
router.get('/sync/history', authenticate, authorize(['admin', 'channel_manager', 'manager']), channelController.getSyncHistory);

// Reservation Management Routes
router.post('/reservations/pull/:channelId', authenticate, authorize(['admin', 'channel_manager']), channelController.pullReservations);
router.get('/reservations/mappings', authenticate, authorize(['admin', 'channel_manager', 'manager']), channelController.getReservationMappings);

// Rate Parity Routes
router.post('/rate-parity/monitor', authenticate, authorize(['admin', 'channel_manager']), channelController.monitorRateParity);
router.get('/rate-parity/logs', authenticate, authorize(['admin', 'channel_manager', 'manager']), channelController.getRateParityLogs);

// Performance Routes
router.get('/performance/:channelId', authenticate, authorize(['admin', 'channel_manager', 'manager']), channelController.getChannelPerformance);
router.get('/performance', authenticate, authorize(['admin', 'channel_manager', 'manager']), channelController.getAllChannelsPerformance);

// Overbooking Protection Routes
router.post('/overbooking/check', authenticate, authorize(['admin', 'channel_manager']), channelController.checkOverbooking);
router.post('/overbooking/rules', authenticate, authorize(['admin', 'channel_manager']), channelController.createOverbookingRule);
router.get('/overbooking/rules', authenticate, authorize(['admin', 'channel_manager', 'manager']), channelController.getOverbookingRules);

// Dashboard and Analytics Routes
router.get('/dashboard/stats', authenticate, authorize(['admin', 'channel_manager', 'manager']), channelController.getDashboardStats);
router.get('/analytics', authenticate, authorize(['admin', 'channel_manager', 'manager']), channelController.getChannelAnalytics);

export default router;
