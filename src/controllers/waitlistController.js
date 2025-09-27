import asyncHandler from 'express-async-handler';
import Waitlist from '../models/Waitlist.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// @desc    Get active waitlist
// @route   GET /api/v1/waitlist
// @access  Private (Staff)
export const getActiveWaitlist = asyncHandler(async (req, res) => {
  const { status, tier, urgency, roomType, page = 1, limit = 10 } = req.query;
  const hotelId = req.user.hotelId;

  const filters = {};
  if (status) filters.status = status;
  if (tier) filters.tier = tier;
  if (urgency) filters.urgency = urgency;
  if (roomType) filters.roomType = roomType;

  const waitlist = await Waitlist.getActiveWaitlist(hotelId, filters);

  const total = waitlist.length;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedResults = waitlist.slice(startIndex, endIndex);

  res.status(200).json({
    status: 'success',
    data: {
      waitlist: paginatedResults,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Create waitlist entry
// @route   POST /api/v1/waitlist
// @access  Private (Staff/Guest)
export const createWaitlistEntry = asyncHandler(async (req, res) => {
  const {
    guestId,
    guestInfo,
    requestedRoomType,
    checkInDate,
    checkOutDate,
    partySize,
    maxPrice,
    urgency,
    preferences,
    specialRequests,
    autoNotify
  } = req.body;

  const hotelId = req.user.hotelId || req.body.hotelId;

  // Check if guest already has active waitlist entry for same dates
  const existingEntry = await Waitlist.findOne({
    hotelId,
    guestId,
    checkInDate: new Date(checkInDate),
    checkOutDate: new Date(checkOutDate),
    status: { $in: ['waiting', 'matched', 'contacted'] },
    isActive: true
  });

  if (existingEntry) {
    return res.status(400).json({
      status: 'error',
      message: 'Guest already has an active waitlist entry for these dates'
    });
  }

  const waitlistEntry = await Waitlist.create({
    hotelId,
    guestId,
    guestInfo,
    requestedRoomType,
    checkInDate: new Date(checkInDate),
    checkOutDate: new Date(checkOutDate),
    partySize,
    maxPrice,
    urgency: urgency || 'medium',
    preferences: preferences || [],
    specialRequests: specialRequests || [],
    autoNotify: autoNotify !== false,
    metadata: {
      source: req.body.source || 'web'
    }
  });

  await waitlistEntry.populate('guestId', 'name email phone');

  res.status(201).json({
    status: 'success',
    data: {
      waitlist: waitlistEntry
    }
  });
});

// @desc    Process waitlist matches
// @route   POST /api/v1/waitlist/process-matches
// @access  Private (Staff)
export const processWaitlistMatches = asyncHandler(async (req, res) => {
  const hotelId = req.user.hotelId;
  const { forceRefresh = false } = req.body;

  // Get all waiting entries
  const waitingEntries = await Waitlist.find({
    hotelId,
    status: 'waiting',
    isActive: true,
    expiryDate: { $gt: new Date() }
  }).sort({ priority: -1, createdAt: 1 });

  const processedMatches = [];

  for (const entry of waitingEntries) {
    // Find available rooms that match criteria
    const availableRooms = await Room.find({
      hotelId,
      isActive: true,
      status: 'available',
      type: new RegExp(entry.requestedRoomType, 'i'),
      capacity: { $gte: entry.partySize }
    });

    for (const room of availableRooms) {
      // Check if room is actually available for the dates
      const conflictingBookings = await Booking.find({
        'rooms.roomId': room._id,
        status: { $in: ['confirmed', 'checked_in'] },
        $or: [
          {
            checkIn: { $lte: entry.checkOutDate },
            checkOut: { $gt: entry.checkInDate }
          }
        ]
      });

      if (conflictingBookings.length === 0) {
        // Calculate match score
        let matchScore = 0;
        const matchReasons = [];

        // Room type match (40 points)
        if (room.type.toLowerCase() === entry.requestedRoomType.toLowerCase()) {
          matchScore += 40;
          matchReasons.push('Exact room type match');
        } else if (room.type.toLowerCase().includes(entry.requestedRoomType.toLowerCase())) {
          matchScore += 25;
          matchReasons.push('Partial room type match');
        }

        // Price match (30 points)
        if (room.baseRate <= entry.maxPrice) {
          matchScore += 30;
          matchReasons.push('Within price range');
        } else if (room.baseRate <= entry.maxPrice * 1.1) {
          matchScore += 15;
          matchReasons.push('Slightly above price range');
        }

        // Capacity match (20 points)
        if (room.capacity === entry.partySize) {
          matchScore += 20;
          matchReasons.push('Perfect capacity match');
        } else if (room.capacity >= entry.partySize) {
          matchScore += 10;
          matchReasons.push('Adequate capacity');
        }

        // Guest tier bonus (10 points)
        const tierBonus = {
          diamond: 10,
          svip: 8,
          vip: 6,
          corporate: 4,
          regular: 2
        };
        matchScore += tierBonus[entry.guestInfo.tier] || 2;
        matchReasons.push(`${entry.guestInfo.tier} tier bonus`);

        // Determine recommended action
        let recommendedAction = 'manual_review';
        if (matchScore >= 80 && entry.guestInfo.tier !== 'regular') {
          recommendedAction = 'auto_confirm';
        } else if (matchScore >= 60) {
          recommendedAction = 'contact_guest';
        }

        // Add match to waitlist entry
        await entry.addMatch(
          room._id,
          room.roomNumber,
          room.type,
          matchScore,
          matchReasons,
          {
            priceMatch: room.baseRate <= entry.maxPrice,
            dateMatch: true,
            typeMatch: room.type.toLowerCase().includes(entry.requestedRoomType.toLowerCase()),
            availabilityConfirmed: true,
            recommendedAction
          }
        );

        processedMatches.push({
          waitlistId: entry._id,
          roomId: room._id,
          matchScore,
          recommendedAction
        });

        // Only add one match per waitlist entry for now
        break;
      }
    }

    // Update last processed time
    entry.lastProcessedAt = new Date();
    await entry.save();
  }

  res.status(200).json({
    status: 'success',
    data: {
      processedMatches,
      message: `Processed ${processedMatches.length} matches from ${waitingEntries.length} waitlist entries`
    }
  });
});

// @desc    Get waitlist analytics
// @route   GET /api/v1/waitlist/analytics
// @access  Private (Staff)
export const getWaitlistAnalytics = asyncHandler(async (req, res) => {
  const hotelId = req.user.hotelId;
  const { period = 'month' } = req.query;

  const analytics = await Waitlist.getWaitlistStats(hotelId, period);

  res.status(200).json({
    status: 'success',
    data: {
      analytics: analytics[0] || {
        totalStats: [{
          totalWaiting: 0,
          totalMatched: 0,
          totalContacted: 0,
          totalConfirmed: 0,
          priorityQueue: 0,
          averageWaitTime: 0
        }],
        periodStats: [{
          processedToday: 0,
          successfulMatches: 0
        }]
      }
    }
  });
});

// @desc    Handle match action
// @route   POST /api/v1/waitlist/:id/match/:matchId/action
// @access  Private (Staff)
export const handleMatchAction = asyncHandler(async (req, res) => {
  const { id, matchId } = req.params;
  const { action, notes } = req.body;
  const staffId = req.user._id;

  const waitlistEntry = await Waitlist.findById(id);
  if (!waitlistEntry) {
    return res.status(404).json({
      status: 'error',
      message: 'Waitlist entry not found'
    });
  }

  await waitlistEntry.processMatch(matchId, action);

  if (action === 'contact' && notes) {
    await waitlistEntry.addContactHistory('email', 'attempted', notes, staffId);
  }

  if (notes) {
    await waitlistEntry.addNote(`Match ${action}: ${notes}`, staffId);
  }

  res.status(200).json({
    status: 'success',
    data: {
      waitlist: waitlistEntry,
      message: `Match ${action} processed successfully`
    }
  });
});

// @desc    Add contact history
// @route   POST /api/v1/waitlist/:id/contact
// @access  Private (Staff)
export const addContactHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { method, status, notes } = req.body;
  const staffId = req.user._id;

  const waitlistEntry = await Waitlist.findById(id);
  if (!waitlistEntry) {
    return res.status(404).json({
      status: 'error',
      message: 'Waitlist entry not found'
    });
  }

  await waitlistEntry.addContactHistory(method, status, notes, staffId);

  res.status(200).json({
    status: 'success',
    data: {
      waitlist: waitlistEntry,
      message: 'Contact history added successfully'
    }
  });
});

// @desc    Update waitlist entry status
// @route   PATCH /api/v1/waitlist/:id
// @access  Private (Staff)
export const updateWaitlistEntry = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes, reason } = req.body;
  const staffId = req.user._id;

  const waitlistEntry = await Waitlist.findById(id);
  if (!waitlistEntry) {
    return res.status(404).json({
      status: 'error',
      message: 'Waitlist entry not found'
    });
  }

  switch (status) {
    case 'confirmed':
      await waitlistEntry.confirm(staffId, notes);
      break;
    case 'declined':
      await waitlistEntry.decline(staffId, reason);
      break;
    case 'cancelled':
      await waitlistEntry.cancel(staffId, reason);
      break;
    default:
      waitlistEntry.status = status;
      if (notes) {
        await waitlistEntry.addNote(notes, staffId);
      }
      await waitlistEntry.save();
  }

  res.status(200).json({
    status: 'success',
    data: {
      waitlist: waitlistEntry,
      message: `Waitlist entry ${status} successfully`
    }
  });
});

// @desc    Find match candidates for room availability
// @route   POST /api/v1/waitlist/find-candidates
// @access  Private (Staff)
export const findMatchCandidates = asyncHandler(async (req, res) => {
  const hotelId = req.user.hotelId;
  const { roomType, checkInDate, checkOutDate, maxPrice, partySize } = req.body;

  const candidates = await Waitlist.findMatchCandidates(hotelId, {
    roomType,
    checkInDate,
    checkOutDate,
    maxPrice,
    partySize
  });

  res.status(200).json({
    status: 'success',
    data: {
      candidates,
      message: `Found ${candidates.length} potential matches`
    }
  });
});

// @desc    Process expired entries
// @route   POST /api/v1/waitlist/process-expired
// @access  Private (Staff)
export const processExpiredEntries = asyncHandler(async (req, res) => {
  const hotelId = req.user.hotelId;

  const result = await Waitlist.processExpiredEntries(hotelId);

  res.status(200).json({
    status: 'success',
    data: {
      modifiedCount: result.modifiedCount,
      message: `Processed ${result.modifiedCount} expired entries`
    }
  });
});

// @desc    Get waitlist entry by ID
// @route   GET /api/v1/waitlist/:id
// @access  Private (Staff)
export const getWaitlistEntry = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const waitlistEntry = await Waitlist.findById(id)
    .populate('guestId', 'name email phone')
    .populate('matchResults.roomId', 'roomNumber type baseRate capacity')
    .populate('contactHistory.contactedBy', 'name')
    .populate('notes.addedBy', 'name')
    .populate('assignedTo', 'name');

  if (!waitlistEntry) {
    return res.status(404).json({
      status: 'error',
      message: 'Waitlist entry not found'
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      waitlist: waitlistEntry
    }
  });
});