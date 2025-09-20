import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
// import RoomBlock from '../models/RoomBlock.js'; // Temporarily disabled
import RoomLock from '../models/RoomLock.js';
import AuditLog from '../models/AuditLog.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage for batch operation progress (in production, use Redis)
const batchOperations = new Map();

// Helper function to update batch progress
const updateBatchProgress = (batchId, updates) => {
  const existing = batchOperations.get(batchId) || {};
  batchOperations.set(batchId, { ...existing, ...updates });
};

// Bulk update room status
const bulkUpdateRoomStatus = catchAsync(async (req, res, next) => {
  const {
    roomIds,
    status,
    reason,
    async = false,
    confirmOverrides = false
  } = req.body;

  // Validation
  if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
    return next(new ApplicationError('Room IDs array is required and must not be empty', 400));
  }

  if (roomIds.length > 100) {
    return next(new ApplicationError('Cannot update more than 100 rooms at once', 400));
  }

  const validStatuses = ['vacant', 'occupied', 'maintenance', 'clean', 'dirty', 'blocked'];
  if (!validStatuses.includes(status)) {
    return next(new ApplicationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400));
  }

  const hotelId = req.user.hotelId;
  const batchId = uuidv4();

  if (async) {
    // Start async processing
    updateBatchProgress(batchId, {
      status: 'processing',
      progress: 0,
      total: roomIds.length,
      startTime: new Date()
    });

    // Process in background
    processBulkStatusUpdate(batchId, roomIds, status, reason, req.user, hotelId, confirmOverrides);

    return res.status(202).json({
      success: true,
      message: 'Bulk status update started',
      data: {
        batchId,
        status: 'processing',
        total: roomIds.length
      }
    });
  }

  // Synchronous processing
  const results = await processBulkStatusUpdateSync(roomIds, status, reason, req.user, hotelId, confirmOverrides);

  res.status(200).json({
    success: true,
    message: `Successfully updated ${results.updatedCount} room(s)`,
    data: results
  });
});

// Synchronous bulk status update
const processBulkStatusUpdateSync = async (roomIds, status, reason, user, hotelId, confirmOverrides) => {
  const successfulUpdates = [];
  const failedUpdates = [];
  const conflicts = [];

  for (const roomId of roomIds) {
    try {
      // Check if room exists and belongs to hotel
      const room = await Room.findOne({ _id: roomId, hotelId });
      if (!room) {
        failedUpdates.push({
          roomId,
          error: 'Room not found or access denied'
        });
        continue;
      }

      // Check for conflicts
      if (!confirmOverrides) {
        if (room.status === 'occupied' && status !== 'occupied') {
          conflicts.push({
            roomId,
            roomNumber: room.roomNumber,
            currentStatus: room.status,
            requestedStatus: status,
            reason: 'Room is currently occupied'
          });
          continue;
        }

        // Check for active locks
        const activeLock = await RoomLock.isRoomLocked(roomId);
        if (activeLock && activeLock.userId.toString() !== user._id.toString()) {
          conflicts.push({
            roomId,
            roomNumber: room.roomNumber,
            reason: `Room is locked by ${activeLock.userId.name} for ${activeLock.action}`
          });
          continue;
        }
      }

      // Store old values for audit
      const oldValues = room.toObject();

      // Update room status
      room.status = status;
      if (reason) {
        room.statusReason = reason;
        room.statusUpdatedAt = new Date();
        room.statusUpdatedBy = user._id;
      }

      await room.save();

      // Log audit trail
      await AuditLog.logChange({
        hotelId,
        tableName: 'Room',
        recordId: roomId,
        changeType: 'update',
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        source: 'manual',
        oldValues: { status: oldValues.status },
        newValues: { status, reason },
        metadata: {
          batchOperation: true,
          priority: 'medium',
          tags: ['bulk_operation', 'status_update']
        }
      });

      successfulUpdates.push({
        roomId,
        roomNumber: room.roomNumber,
        previousStatus: oldValues.status,
        newStatus: status
      });

    } catch (error) {
      failedUpdates.push({
        roomId,
        error: error.message
      });
    }
  }

  return {
    updatedCount: successfulUpdates.length,
    successfulUpdates,
    failedUpdates,
    conflicts,
    total: roomIds.length
  };
};

// Asynchronous bulk status update
const processBulkStatusUpdate = async (batchId, roomIds, status, reason, user, hotelId, confirmOverrides) => {
  try {
    const total = roomIds.length;
    let processed = 0;

    const results = await processBulkStatusUpdateSync(roomIds, status, reason, user, hotelId, confirmOverrides);

    updateBatchProgress(batchId, {
      status: 'completed',
      progress: 100,
      processed: total,
      results,
      completedTime: new Date()
    });

  } catch (error) {
    updateBatchProgress(batchId, {
      status: 'failed',
      error: error.message,
      completedTime: new Date()
    });
  }
};

// Bulk room assignment
const bulkRoomAssignment = catchAsync(async (req, res, next) => {
  const {
    assignments,
    confirmOverrides = false,
    async = false
  } = req.body;

  // Validation
  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return next(new ApplicationError('Assignments array is required and must not be empty', 400));
  }

  if (assignments.length > 50) {
    return next(new ApplicationError('Cannot assign more than 50 rooms at once', 400));
  }

  // Validate assignment structure
  for (const assignment of assignments) {
    if (!assignment.roomId || !assignment.bookingId) {
      return next(new ApplicationError('Each assignment must have roomId and bookingId', 400));
    }
  }

  const hotelId = req.user.hotelId;
  const batchId = uuidv4();

  if (async) {
    updateBatchProgress(batchId, {
      status: 'processing',
      progress: 0,
      total: assignments.length,
      startTime: new Date()
    });

    processBulkAssignment(batchId, assignments, req.user, hotelId, confirmOverrides);

    return res.status(202).json({
      success: true,
      message: 'Bulk room assignment started',
      data: {
        batchId,
        status: 'processing',
        total: assignments.length
      }
    });
  }

  // Synchronous processing
  const results = await processBulkAssignmentSync(assignments, req.user, hotelId, confirmOverrides);

  res.status(200).json({
    success: true,
    message: `Successfully assigned ${results.assignedCount} room(s)`,
    data: results
  });
});

// Synchronous bulk assignment processing
const processBulkAssignmentSync = async (assignments, user, hotelId, confirmOverrides) => {
  const successfulAssignments = [];
  const failedAssignments = [];
  const conflicts = [];

  for (const assignment of assignments) {
    try {
      const { roomId, bookingId } = assignment;

      // Validate room and booking
      const [room, booking] = await Promise.all([
        Room.findOne({ _id: roomId, hotelId }),
        Booking.findOne({ _id: bookingId, hotelId })
      ]);

      if (!room) {
        failedAssignments.push({
          roomId,
          bookingId,
          error: 'Room not found'
        });
        continue;
      }

      if (!booking) {
        failedAssignments.push({
          roomId,
          bookingId,
          error: 'Booking not found'
        });
        continue;
      }

      // Check for conflicts
      if (!confirmOverrides) {
        if (room.status === 'occupied' || room.status === 'blocked') {
          conflicts.push({
            roomId,
            bookingId,
            roomNumber: room.roomNumber,
            currentStatus: room.status,
            reason: `Room is ${room.status}`
          });
          continue;
        }

        // Check if booking already has a room
        if (booking.roomId) {
          conflicts.push({
            roomId,
            bookingId,
            bookingNumber: booking.bookingNumber,
            reason: 'Booking already has a room assigned'
          });
          continue;
        }
      }

      // Perform assignment
      booking.roomId = roomId;
      booking.roomAssignedAt = new Date();
      booking.roomAssignedBy = user._id;
      room.status = 'occupied';

      await Promise.all([booking.save(), room.save()]);

      // Log audit trail
      await AuditLog.logChange({
        hotelId,
        tableName: 'Booking',
        recordId: bookingId,
        changeType: 'update',
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        source: 'manual',
        newValues: {
          roomId,
          roomAssigned: true,
          assignedRoom: room.roomNumber
        },
        metadata: {
          batchOperation: true,
          priority: 'high',
          tags: ['bulk_operation', 'room_assignment']
        }
      });

      successfulAssignments.push({
        roomId,
        bookingId,
        roomNumber: room.roomNumber,
        bookingNumber: booking.bookingNumber
      });

    } catch (error) {
      failedAssignments.push({
        roomId: assignment.roomId,
        bookingId: assignment.bookingId,
        error: error.message
      });
    }
  }

  return {
    assignedCount: successfulAssignments.length,
    successfulAssignments,
    failedAssignments,
    conflicts,
    total: assignments.length
  };
};

// Bulk room blocking
const bulkRoomBlock = catchAsync(async (req, res, next) => {
  const {
    roomIds,
    blockData
  } = req.body;

  // Only admins can create bulk blocks
  if (req.user.role !== 'admin') {
    return next(new ApplicationError('Only administrators can create bulk room blocks', 403));
  }

  // Validation
  if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
    return next(new ApplicationError('Room IDs array is required', 400));
  }

  if (!blockData || !blockData.blockName || !blockData.startDate || !blockData.endDate) {
    return next(new ApplicationError('Block data with name, start date, and end date is required', 400));
  }

  // Validate dates
  const startDate = new Date(blockData.startDate);
  const endDate = new Date(blockData.endDate);

  if (endDate <= startDate) {
    return next(new ApplicationError('End date must be after start date', 400));
  }

  const hotelId = req.user.hotelId;

  try {
    // Verify all rooms exist and are available
    const rooms = await Room.find({
      _id: { $in: roomIds },
      hotelId
    });

    if (rooms.length !== roomIds.length) {
      return next(new ApplicationError('One or more rooms not found', 404));
    }

    // Create room block - TEMPORARILY DISABLED
    /*const roomBlock = await RoomBlock.create({
      hotelId,
      blockName: blockData.blockName,
      groupName: blockData.groupName || blockData.blockName,
      startDate,
      endDate,
      totalRooms: roomIds.length,
      contactPerson: {
        name: req.user.name,
        email: req.user.email
      },
      roomIds,
      reason: blockData.reason,
      createdBy: req.user._id
    });*/

    // Mock room block for now
    const roomBlock = {
      _id: 'mock-block-id',
      blockName: blockData.blockName
    };

    // Update room status to blocked
    await Room.updateMany(
      { _id: { $in: roomIds } },
      {
        status: 'blocked',
        blockId: roomBlock._id,
        statusUpdatedAt: new Date(),
        statusUpdatedBy: req.user._id
      }
    );

    // Log audit trail
    await AuditLog.logChange({
      hotelId,
      tableName: 'RoomBlock',
      recordId: roomBlock._id,
      changeType: 'create',
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      source: 'manual',
      newValues: {
        blockName: blockData.blockName,
        roomCount: roomIds.length,
        startDate,
        endDate
      },
      metadata: {
        batchOperation: true,
        priority: 'high',
        tags: ['bulk_operation', 'room_block']
      }
    });

    res.status(200).json({
      success: true,
      message: `Successfully blocked ${roomIds.length} rooms`,
      data: {
        blockedCount: roomIds.length,
        blockId: roomBlock._id,
        blockName: roomBlock.blockName,
        roomIds
      }
    });

  } catch (error) {
    return next(new ApplicationError(`Failed to create room block: ${error.message}`, 500));
  }
});

// Bulk room release
const bulkRoomRelease = catchAsync(async (req, res, next) => {
  const {
    roomIds,
    releaseReason
  } = req.body;

  // Validation
  if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
    return next(new ApplicationError('Room IDs array is required', 400));
  }

  const hotelId = req.user.hotelId;

  try {
    // Find blocked rooms
    const rooms = await Room.find({
      _id: { $in: roomIds },
      hotelId,
      status: 'blocked'
    });

    if (rooms.length === 0) {
      return next(new ApplicationError('No blocked rooms found to release', 404));
    }

    // Release rooms
    const releasedCount = await Room.updateMany(
      { _id: { $in: rooms.map(r => r._id) } },
      {
        status: 'vacant',
        blockId: null,
        statusUpdatedAt: new Date(),
        statusUpdatedBy: req.user._id,
        releaseReason
      }
    );

    // Log audit trail for each room
    for (const room of rooms) {
      await AuditLog.logChange({
        hotelId,
        tableName: 'Room',
        recordId: room._id,
        changeType: 'update',
        userId: req.user._id,
        userEmail: req.user.email,
        userRole: req.user.role,
        source: 'manual',
        oldValues: { status: 'blocked' },
        newValues: { status: 'vacant', releaseReason },
        metadata: {
          batchOperation: true,
          priority: 'medium',
          tags: ['bulk_operation', 'room_release']
        }
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully released ${releasedCount.modifiedCount} room(s)`,
      data: {
        releasedCount: releasedCount.modifiedCount,
        roomIds: rooms.map(r => r._id)
      }
    });

  } catch (error) {
    return next(new ApplicationError(`Failed to release rooms: ${error.message}`, 500));
  }
});

// Get bulk operation progress
const getBulkOperationProgress = catchAsync(async (req, res, next) => {
  const { batchId } = req.params;

  const operation = batchOperations.get(batchId);

  if (!operation) {
    return next(new ApplicationError('Bulk operation not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      batchId,
      ...operation
    }
  });
});

// Get active bulk operations
const getActiveBulkOperations = catchAsync(async (req, res, next) => {
  const activeOperations = Array.from(batchOperations.entries())
    .map(([batchId, operation]) => ({
      batchId,
      ...operation
    }))
    .filter(op => op.status === 'processing');

  res.status(200).json({
    success: true,
    data: {
      operations: activeOperations,
      count: activeOperations.length
    }
  });
});

// Asynchronous bulk assignment processing
const processBulkAssignment = async (batchId, assignments, user, hotelId, confirmOverrides) => {
  try {
    const results = await processBulkAssignmentSync(assignments, user, hotelId, confirmOverrides);

    updateBatchProgress(batchId, {
      status: 'completed',
      progress: 100,
      results,
      completedTime: new Date()
    });

  } catch (error) {
    updateBatchProgress(batchId, {
      status: 'failed',
      error: error.message,
      completedTime: new Date()
    });
  }
};

export default {
  bulkUpdateRoomStatus,
  bulkRoomAssignment,
  bulkRoomBlock,
  bulkRoomRelease,
  getBulkOperationProgress,
  getActiveBulkOperations
};
