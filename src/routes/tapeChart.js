import express from 'express';
import tapeChartController from '../controllers/tapeChartController.js';
import roomLockController from '../controllers/roomLockController.js';
import searchController from '../controllers/searchController.js';
import bulkOperationsController from '../controllers/bulkOperationsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Room Configuration Routes
router.post('/room-config', authenticate, authorize(['admin', 'staff']), tapeChartController.createRoomConfiguration);
router.get('/room-config', authenticate, authorize(['admin', 'staff']), tapeChartController.getRoomConfigurations);
router.put('/room-config/:id', authenticate, authorize(['admin']), tapeChartController.updateRoomConfiguration);
router.delete('/room-config/:id', authenticate, authorize(['admin']), tapeChartController.deleteRoomConfiguration);

// Room Status Management Routes
router.put('/rooms/:roomId/status', authenticate, authorize(['admin', 'staff']), tapeChartController.updateRoomStatus);
router.get('/rooms/:roomId/status-history', authenticate, authorize(['admin', 'staff']), tapeChartController.getRoomStatusHistory);
router.get('/rooms/available', authenticate, authorize(['admin', 'staff']), tapeChartController.getAvailableRooms);

// Room Block Management Routes
router.post('/room-blocks', authenticate, authorize(['admin', 'staff']), tapeChartController.createRoomBlock);
router.get('/room-blocks', authenticate, authorize(['admin', 'staff']), tapeChartController.getRoomBlocks);
router.get('/room-blocks/:id', authenticate, authorize(['admin', 'staff']), tapeChartController.getRoomBlock);
router.put('/room-blocks/:id', authenticate, authorize(['admin', 'staff']), tapeChartController.updateRoomBlock);
router.post('/room-blocks/:id/release', authenticate, authorize(['admin', 'staff']), tapeChartController.releaseRoomBlock);

// Advanced Reservation Management Routes
router.post('/reservations', authenticate, authorize(['admin', 'staff']), tapeChartController.createAdvancedReservation);
router.get('/reservations', authenticate, authorize(['admin', 'staff']), tapeChartController.getAdvancedReservations);
router.get('/reservations/:id', authenticate, authorize(['admin', 'staff']), tapeChartController.getAdvancedReservation);
router.post('/reservations/:reservationId/assign-room', authenticate, authorize(['admin', 'staff']), tapeChartController.assignRoom);
router.post('/reservations/:reservationId/auto-assign', authenticate, authorize(['admin', 'staff']), tapeChartController.autoAssignRooms);
router.post('/reservations/:reservationId/upgrade', authenticate, authorize(['admin', 'staff']), tapeChartController.processUpgrade);

// Tape Chart View Management Routes
router.post('/views', authenticate, authorize(['admin', 'staff']), tapeChartController.createTapeChartView);
router.get('/views', authenticate, authorize(['admin', 'staff']), tapeChartController.getTapeChartViews);
router.put('/views/:id', authenticate, authorize(['admin', 'staff']), tapeChartController.updateTapeChartView);
router.delete('/views/:id', authenticate, authorize(['admin', 'staff']), tapeChartController.deleteTapeChartView);

// Generate Tape Chart Data
router.get('/chart-data', authenticate, authorize(['admin', 'staff']), tapeChartController.generateTapeChartData);

// Room Assignment Rules Routes
router.post('/assignment-rules', authenticate, authorize(['admin']), tapeChartController.createAssignmentRule);
router.get('/assignment-rules', authenticate, authorize(['admin', 'staff']), tapeChartController.getAssignmentRules);
router.put('/assignment-rules/:id', authenticate, authorize(['admin']), tapeChartController.updateAssignmentRule);
router.delete('/assignment-rules/:id', authenticate, authorize(['admin']), tapeChartController.deleteAssignmentRule);

// Waitlist Management Routes
router.post('/reservations/:reservationId/waitlist', authenticate, authorize(['admin', 'staff']), tapeChartController.addToWaitlist);
router.post('/waitlist/process', authenticate, authorize(['admin', 'staff']), tapeChartController.processWaitlist);
router.get('/waitlist', authenticate, authorize(['admin', 'staff']), tapeChartController.getWaitlist);

// Analytics and Reporting Routes
router.get('/reports/occupancy', authenticate, authorize(['admin', 'staff']), tapeChartController.getOccupancyReport);
router.get('/reports/room-utilization', authenticate, authorize(['admin']), tapeChartController.getRoomUtilizationStats);
router.get('/reports/revenue-by-room-type', authenticate, authorize(['admin']), tapeChartController.getRevenueByRoomType);

// Dashboard Routes
router.get('/dashboard', authenticate, authorize(['admin', 'staff']), tapeChartController.getTapeChartDashboard);

// Real-time Updates Routes
router.get('/room-status-updates', authenticate, authorize(['admin', 'staff']), tapeChartController.getRoomStatusUpdates);

// Bulk Operations Routes
router.post('/bulk/room-status', authenticate, authorize(['admin', 'staff']), tapeChartController.bulkUpdateRoomStatus);
router.post('/bulk/room-assignment', authenticate, authorize(['admin', 'staff']), tapeChartController.bulkRoomAssignment);

// Room Lock Management Routes
router.post('/rooms/:roomId/lock', authenticate, authorize(['admin', 'staff']), roomLockController.lockRoom);
router.delete('/rooms/:roomId/unlock', authenticate, authorize(['admin', 'staff']), roomLockController.unlockRoom);
router.get('/rooms/:roomId/lock-status', authenticate, authorize(['admin', 'staff']), roomLockController.getRoomLockStatus);
router.put('/rooms/:roomId/lock/extend', authenticate, authorize(['admin', 'staff']), roomLockController.extendLock);
router.get('/rooms/locks', authenticate, authorize(['admin', 'staff']), roomLockController.getActiveLocks);
router.delete('/rooms/locks/cleanup', authenticate, authorize(['admin']), roomLockController.cleanupExpiredLocks);
router.post('/rooms/locks/bulk-unlock', authenticate, authorize(['admin']), roomLockController.bulkUnlockRooms);

// Advanced Search and Filtering Routes
router.post('/search', authenticate, authorize(['admin', 'staff']), searchController.advancedSearch);
router.post('/filter', authenticate, authorize(['admin', 'staff']), searchController.advancedFilter);
router.get('/search/suggestions', authenticate, authorize(['admin', 'staff']), searchController.getSearchSuggestions);
router.get('/search/filters', authenticate, authorize(['admin', 'staff']), searchController.getFilterOptions);

// Bulk Operations Routes
router.post('/bulk/room-status', authenticate, authorize(['admin', 'staff']), bulkOperationsController.bulkUpdateRoomStatus);
router.post('/bulk/room-assignment', authenticate, authorize(['admin', 'staff']), bulkOperationsController.bulkRoomAssignment);
router.post('/bulk/room-block', authenticate, authorize(['admin']), bulkOperationsController.bulkRoomBlock);
router.post('/bulk/room-release', authenticate, authorize(['admin', 'staff']), bulkOperationsController.bulkRoomRelease);
router.get('/bulk/progress/:batchId', authenticate, authorize(['admin', 'staff']), bulkOperationsController.getBulkOperationProgress);
router.get('/bulk/active', authenticate, authorize(['admin', 'staff']), bulkOperationsController.getActiveBulkOperations);

export default router;