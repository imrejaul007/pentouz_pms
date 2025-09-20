import RoomLock from '../models/RoomLock.js';
import Room from '../models/Room.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

// Lock durations in milliseconds
const LOCK_DURATIONS = {
  viewing: 2 * 60 * 1000,    // 2 minutes
  editing: 5 * 60 * 1000,    // 5 minutes
  assigning: 10 * 60 * 1000  // 10 minutes
};

// Create or update room lock
export const lockRoom = catchAsync(async (req, res, next) => {
  const { roomId } = req.params;
  const { action, extend = false } = req.body;

  // Validate action
  if (!['viewing', 'editing', 'assigning'].includes(action)) {
    return next(new ApplicationError('Invalid action. Must be viewing, editing, or assigning', 400));
  }

  // Check if room exists
  const room = await Room.findById(roomId);
  if (!room) {
    return next(new ApplicationError('Room not found', 404));
  }

  // Check if room is already locked by someone else
  const existingLock = await RoomLock.isRoomLocked(roomId, req.user.id);
  if (existingLock) {
    return res.status(409).json({
      success: false,
      message: `Room is already locked for ${existingLock.action} by ${existingLock.userId.name}`,
      lockedBy: existingLock.userId.name,
      lockedUntil: existingLock.expiresAt,
      lockAction: existingLock.action,
      remainingTime: existingLock.remainingTime
    });
  }

  // Get lock duration for this action
  const duration = LOCK_DURATIONS[action];

  try {
    // Create or update lock
    const lock = await RoomLock.createOrUpdateLock(
      roomId,
      req.user.id,
      action,
      duration
    );

    // Populate user and room details
    await lock.populate([
      { path: 'userId', select: 'name email role' },
      { path: 'roomId', select: 'roomNumber type floor' }
    ]);

    const statusCode = lock.createdAt.getTime() === lock.updatedAt.getTime() ? 201 : 200;

    res.status(statusCode).json({
      success: true,
      message: statusCode === 201 ? 'Room locked successfully' : 'Lock updated successfully',
      data: {
        lockId: lock.lockId,
        roomId: lock.roomId._id,
        roomNumber: lock.roomId.roomNumber,
        userId: lock.userId._id,
        userName: lock.userId.name,
        action: lock.action,
        timestamp: lock.timestamp,
        expiresAt: lock.expiresAt,
        remainingTime: lock.remainingTime,
        status: lock.status
      }
    });

  } catch (error) {
    return next(new ApplicationError('Failed to lock room: ' + error.message, 500));
  }
});

// Release room lock
export const unlockRoom = catchAsync(async (req, res, next) => {
  const { roomId } = req.params;
  const { force = false } = req.body;

  // Check if room exists
  const room = await Room.findById(roomId);
  if (!room) {
    return next(new ApplicationError('Room not found', 404));
  }

  // Only admins can force unlock
  const canForceUnlock = req.user.role === 'admin' && force;

  try {
    const releasedLock = await RoomLock.releaseLock(
      roomId,
      canForceUnlock ? null : req.user.id,
      canForceUnlock
    );

    if (!releasedLock) {
      if (canForceUnlock) {
        return res.status(404).json({
          success: false,
          message: 'No active lock found on this room'
        });
      } else {
        // Check if lock exists but belongs to someone else
        const existingLock = await RoomLock.isRoomLocked(roomId);
        if (existingLock) {
          return res.status(403).json({
            success: false,
            message: 'You are not authorized to unlock this room',
            lockedBy: existingLock.userId.name,
            lockAction: existingLock.action
          });
        } else {
          return res.status(404).json({
            success: false,
            message: 'No active lock found on this room'
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: canForceUnlock ? 'Room force unlocked successfully' : 'Room unlocked successfully',
      data: {
        roomId: roomId,
        roomNumber: room.roomNumber,
        unlockedBy: req.user.name,
        timestamp: new Date()
      }
    });

  } catch (error) {
    return next(new ApplicationError('Failed to unlock room: ' + error.message, 500));
  }
});

// Get all active locks
export const getActiveLocks = catchAsync(async (req, res, next) => {
  const { roomId, userId, action, page = 1, limit = 50 } = req.query;

  // Build filters
  const filters = {};
  if (roomId) filters.roomId = roomId;
  if (userId) filters.userId = userId;
  if (action) filters.action = action;

  try {
    const locks = await RoomLock.getActiveLocks(filters)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await RoomLock.countDocuments({
      expiresAt: { $gt: new Date() },
      ...filters
    });

    res.status(200).json({
      success: true,
      data: locks.map(lock => ({
        lockId: lock.lockId,
        roomId: lock.roomId._id,
        roomNumber: lock.roomId.roomNumber,
        roomType: lock.roomId.type,
        floor: lock.roomId.floor,
        user: {
          id: lock.userId._id,
          name: lock.userId.name,
          email: lock.userId.email,
          role: lock.userId.role
        },
        action: lock.action,
        timestamp: lock.timestamp,
        expiresAt: lock.expiresAt,
        remainingTime: lock.remainingTime,
        status: lock.status
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    return next(new ApplicationError('Failed to retrieve locks: ' + error.message, 500));
  }
});

// Extend lock duration
export const extendLock = catchAsync(async (req, res, next) => {
  const { roomId } = req.params;
  const { additionalTime = 300000 } = req.body; // Default 5 minutes

  // Find user's active lock on this room
  const lock = await RoomLock.findOne({
    roomId: roomId,
    userId: req.user.id,
    expiresAt: { $gt: new Date() }
  }).populate([
    { path: 'userId', select: 'name email role' },
    { path: 'roomId', select: 'roomNumber type floor' }
  ]);

  if (!lock) {
    return next(new ApplicationError('No active lock found for this room', 404));
  }

  // Validate additional time (max 30 minutes)
  if (additionalTime > 30 * 60 * 1000) {
    return next(new ApplicationError('Cannot extend lock by more than 30 minutes', 400));
  }

  try {
    await lock.extend(additionalTime);

    res.status(200).json({
      success: true,
      message: 'Lock extended successfully',
      data: {
        lockId: lock.lockId,
        roomId: lock.roomId._id,
        roomNumber: lock.roomId.roomNumber,
        expiresAt: lock.expiresAt,
        remainingTime: lock.remainingTime,
        extendedBy: additionalTime
      }
    });

  } catch (error) {
    return next(new ApplicationError('Failed to extend lock: ' + error.message, 500));
  }
});

// Get lock status for specific room
export const getRoomLockStatus = catchAsync(async (req, res, next) => {
  const { roomId } = req.params;

  // Check if room exists
  const room = await Room.findById(roomId);
  if (!room) {
    return next(new ApplicationError('Room not found', 404));
  }

  const lock = await RoomLock.isRoomLocked(roomId);

  if (!lock) {
    return res.status(200).json({
      success: true,
      locked: false,
      data: {
        roomId: roomId,
        roomNumber: room.roomNumber,
        status: 'available'
      }
    });
  }

  res.status(200).json({
    success: true,
    locked: true,
    data: {
      lockId: lock.lockId,
      roomId: roomId,
      roomNumber: room.roomNumber,
      lockedBy: {
        id: lock.userId._id,
        name: lock.userId.name,
        role: lock.userId.role
      },
      action: lock.action,
      timestamp: lock.timestamp,
      expiresAt: lock.expiresAt,
      remainingTime: lock.remainingTime,
      status: lock.status,
      isOwnLock: lock.userId._id.toString() === req.user.id
    }
  });
});

// Cleanup expired locks (for cron job or manual trigger)
export const cleanupExpiredLocks = catchAsync(async (req, res, next) => {
  try {
    const deletedCount = await RoomLock.cleanupExpiredLocks();

    res.status(200).json({
      success: true,
      message: `Cleaned up ${deletedCount} expired locks`,
      data: {
        deletedCount: deletedCount,
        timestamp: new Date()
      }
    });

  } catch (error) {
    return next(new ApplicationError('Failed to cleanup locks: ' + error.message, 500));
  }
});

// Bulk unlock rooms (admin only)
export const bulkUnlockRooms = catchAsync(async (req, res, next) => {
  const { roomIds } = req.body;

  if (!Array.isArray(roomIds) || roomIds.length === 0) {
    return next(new ApplicationError('Room IDs array is required', 400));
  }

  // Only admins can bulk unlock
  if (req.user.role !== 'admin') {
    return next(new ApplicationError('Only admins can perform bulk unlock operations', 403));
  }

  try {
    const result = await RoomLock.deleteMany({
      roomId: { $in: roomIds },
      expiresAt: { $gt: new Date() }
    });

    res.status(200).json({
      success: true,
      message: `Unlocked ${result.deletedCount} rooms`,
      data: {
        roomIds: roomIds,
        unlockedCount: result.deletedCount,
        timestamp: new Date(),
        unlockedBy: req.user.name
      }
    });

  } catch (error) {
    return next(new ApplicationError('Failed to bulk unlock rooms: ' + error.message, 500));
  }
});

export default {
  lockRoom,
  unlockRoom,
  getActiveLocks,
  extendLock,
  getRoomLockStatus,
  cleanupExpiredLocks,
  bulkUnlockRooms
};
