import WaitingList from '../models/WaitingList.js';
import Room from '../models/Room.js';
import Hotel from '../models/Hotel.js';
import User from '../models/User.js';
import { validationResult } from 'express-validator';

class WaitingListController {
  // Get all waiting list entries with filters
  async getWaitingList(req, res) {
    try {
      const {
        status,
        priority,
        roomType,
        vipStatus,
        search,
        page = 1,
        limit = 20,
        sortBy = 'priority_score',
        sortOrder = 'desc'
      } = req.query;

      // Get hotel from user context
      const hotel = await Hotel.findOne();
      if (!hotel) {
        return res.status(404).json({
          success: false,
          message: 'Hotel not found'
        });
      }

      // Build query
      const query = { hotelId: hotel._id };

      if (status && status !== 'all') {
        query.status = status;
      }

      if (priority && priority !== 'all') {
        query.priority = priority;
      }

      if (roomType && roomType !== 'all') {
        query.roomType = roomType;
      }

      if (vipStatus === 'true') {
        query.vipStatus = true;
      }

      // Search functionality
      if (search) {
        query.$or = [
          { guestName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { waitlistId: { $regex: search, $options: 'i' } }
        ];
      }

      // Sorting
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // If sorting by priority_score, add secondary sort by addedDate
      if (sortBy === 'priority_score') {
        sortOptions.addedDate = 1;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [waitingListEntries, total] = await Promise.all([
        WaitingList.find(query)
          .populate('notes.createdBy', 'name email')
          .populate('contactHistory.contactedBy', 'name email')
          .populate('convertedToBooking.bookingId', 'bookingNumber')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        WaitingList.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: waitingListEntries,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      });

    } catch (error) {
      console.error('Get waiting list error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch waiting list',
        error: error.message
      });
    }
  }

  // Get single waiting list entry
  async getWaitingListEntry(req, res) {
    try {
      const { id } = req.params;

      const entry = await WaitingList.findById(id)
        .populate('notes.createdBy', 'name email')
        .populate('contactHistory.contactedBy', 'name email')
        .populate('convertedToBooking.bookingId', 'bookingNumber guestName')
        .populate('convertedToBooking.convertedBy', 'name email');

      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Waiting list entry not found'
        });
      }

      res.json({
        success: true,
        data: entry
      });

    } catch (error) {
      console.error('Get waiting list entry error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch waiting list entry',
        error: error.message
      });
    }
  }

  // Create new waiting list entry
  async createWaitingListEntry(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const {
        guestName,
        email,
        phone,
        roomType,
        preferredDates,
        alternativeDates,
        guests,
        priority,
        vipStatus,
        loyaltyTier,
        specialRequests,
        contactPreference,
        maxRate,
        source,
        notificationPreferences
      } = req.body;

      // Get hotel
      const hotel = await Hotel.findOne();
      if (!hotel) {
        return res.status(404).json({
          success: false,
          message: 'Hotel not found'
        });
      }

      // Check if guest is already on waitlist for same dates
      const existingEntry = await WaitingList.findOne({
        email: email.toLowerCase(),
        hotelId: hotel._id,
        status: { $in: ['active', 'contacted'] },
        'preferredDates.checkIn': preferredDates.checkIn,
        'preferredDates.checkOut': preferredDates.checkOut
      });

      if (existingEntry) {
        return res.status(409).json({
          success: false,
          message: 'Guest already on waiting list for these dates'
        });
      }

      // Create new entry
      const waitingListEntry = new WaitingList({
        guestName,
        email: email.toLowerCase(),
        phone,
        roomType,
        hotelId: hotel._id,
        preferredDates,
        alternativeDates: alternativeDates || [],
        guests: guests || 2,
        priority: priority || 'medium',
        vipStatus: vipStatus || false,
        loyaltyTier,
        specialRequests,
        contactPreference: contactPreference || 'email',
        maxRate,
        source: source || 'direct',
        notificationPreferences: notificationPreferences || {
          email: true,
          sms: false,
          phone: false
        }
      });

      // Add initial note
      waitingListEntry.notes.push({
        content: `Waiting list entry created via ${source || 'direct'}`,
        createdBy: req.user._id,
        isInternal: true
      });

      await waitingListEntry.save();

      // Populate the created entry
      const populatedEntry = await WaitingList.findById(waitingListEntry._id)
        .populate('notes.createdBy', 'name email');

      res.status(201).json({
        success: true,
        message: 'Waiting list entry created successfully',
        data: populatedEntry
      });

    } catch (error) {
      console.error('Create waiting list entry error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create waiting list entry',
        error: error.message
      });
    }
  }

  // Update waiting list entry
  async updateWaitingListEntry(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const entry = await WaitingList.findById(id);
      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Waiting list entry not found'
        });
      }

      // Allowed updates
      const allowedUpdates = [
        'guestName', 'email', 'phone', 'roomType', 'preferredDates',
        'alternativeDates', 'guests', 'priority', 'vipStatus', 'loyaltyTier',
        'specialRequests', 'contactPreference', 'maxRate', 'notificationPreferences'
      ];

      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          entry[field] = updates[field];
        }
      });

      // Add update note
      entry.notes.push({
        content: `Entry updated by ${req.user.name}`,
        createdBy: req.user._id,
        isInternal: true
      });

      await entry.save();

      const updatedEntry = await WaitingList.findById(id)
        .populate('notes.createdBy', 'name email')
        .populate('contactHistory.contactedBy', 'name email');

      res.json({
        success: true,
        message: 'Waiting list entry updated successfully',
        data: updatedEntry
      });

    } catch (error) {
      console.error('Update waiting list entry error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update waiting list entry',
        error: error.message
      });
    }
  }

  // Update entry status
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, note } = req.body;

      const entry = await WaitingList.findById(id);
      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Waiting list entry not found'
        });
      }

      await entry.updateStatus(status, req.user._id);

      if (note) {
        await entry.addNote(note, req.user._id);
      }

      const updatedEntry = await WaitingList.findById(id)
        .populate('notes.createdBy', 'name email')
        .populate('contactHistory.contactedBy', 'name email');

      res.json({
        success: true,
        message: `Status updated to ${status}`,
        data: updatedEntry
      });

    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update status',
        error: error.message
      });
    }
  }

  // Update priority
  async updatePriority(req, res) {
    try {
      const { id } = req.params;
      const { priority } = req.body;

      const entry = await WaitingList.findById(id);
      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Waiting list entry not found'
        });
      }

      const oldPriority = entry.priority;
      entry.priority = priority;

      entry.notes.push({
        content: `Priority changed from ${oldPriority} to ${priority}`,
        createdBy: req.user._id,
        isInternal: true
      });

      await entry.save();

      res.json({
        success: true,
        message: `Priority updated to ${priority}`,
        data: entry
      });

    } catch (error) {
      console.error('Update priority error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update priority',
        error: error.message
      });
    }
  }

  // Add note to entry
  async addNote(req, res) {
    try {
      const { id } = req.params;
      const { content, isInternal = true } = req.body;

      const entry = await WaitingList.findById(id);
      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Waiting list entry not found'
        });
      }

      await entry.addNote(content, req.user._id, isInternal);

      const updatedEntry = await WaitingList.findById(id)
        .populate('notes.createdBy', 'name email');

      res.json({
        success: true,
        message: 'Note added successfully',
        data: updatedEntry
      });

    } catch (error) {
      console.error('Add note error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add note',
        error: error.message
      });
    }
  }

  // Record contact
  async recordContact(req, res) {
    try {
      const { id } = req.params;
      const { method, message } = req.body;

      const entry = await WaitingList.findById(id);
      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Waiting list entry not found'
        });
      }

      await entry.addContact(method, message, req.user._id);

      // If not already contacted, update status
      if (entry.status === 'active') {
        await entry.updateStatus('contacted', req.user._id);
      }

      const updatedEntry = await WaitingList.findById(id)
        .populate('contactHistory.contactedBy', 'name email');

      res.json({
        success: true,
        message: 'Contact recorded successfully',
        data: updatedEntry
      });

    } catch (error) {
      console.error('Record contact error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record contact',
        error: error.message
      });
    }
  }

  // Delete waiting list entry
  async deleteWaitingListEntry(req, res) {
    try {
      const { id } = req.params;

      const entry = await WaitingList.findById(id);
      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Waiting list entry not found'
        });
      }

      await WaitingList.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Waiting list entry deleted successfully'
      });

    } catch (error) {
      console.error('Delete waiting list entry error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete waiting list entry',
        error: error.message
      });
    }
  }

  // Get room availability for waitlist
  async getRoomAvailability(req, res) {
    try {
      const { checkIn, checkOut } = req.query;

      // Get hotel
      const hotel = await Hotel.findOne();
      if (!hotel) {
        return res.status(404).json({
          success: false,
          message: 'Hotel not found'
        });
      }

      // Get all rooms grouped by type
      const roomTypes = await Room.aggregate([
        { $match: { hotelId: hotel._id } },
        {
          $group: {
            _id: '$roomType',
            total: { $sum: 1 },
            available: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'available'] },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $project: {
            roomType: '$_id',
            total: 1,
            available: 1,
            nextAvailable: new Date() // This should be calculated based on booking data
          }
        }
      ]);

      // Transform to match frontend interface
      const roomAvailability = roomTypes.map(room => ({
        roomType: room.roomType,
        available: room.available,
        total: room.total,
        nextAvailable: room.nextAvailable.toISOString().split('T')[0]
      }));

      res.json({
        success: true,
        data: roomAvailability
      });

    } catch (error) {
      console.error('Get room availability error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch room availability',
        error: error.message
      });
    }
  }

  // Get waitlist statistics
  async getWaitlistStats(req, res) {
    try {
      // Get hotel
      const hotel = await Hotel.findOne();
      if (!hotel) {
        return res.status(404).json({
          success: false,
          message: 'Hotel not found'
        });
      }

      const stats = await WaitingList.getWaitlistStats(hotel._id);

      // Get additional metrics
      const [totalActive, vipCount, urgentCount, recentEntries] = await Promise.all([
        WaitingList.countDocuments({
          hotelId: hotel._id,
          status: { $in: ['active', 'contacted'] }
        }),
        WaitingList.countDocuments({
          hotelId: hotel._id,
          vipStatus: true,
          status: { $in: ['active', 'contacted'] }
        }),
        WaitingList.countDocuments({
          hotelId: hotel._id,
          priority: 'high',
          status: { $in: ['active', 'contacted'] }
        }),
        WaitingList.find({
          hotelId: hotel._id
        })
          .sort({ addedDate: -1 })
          .limit(5)
          .select('waitlistId guestName roomType priority addedDate status')
      ]);

      res.json({
        success: true,
        data: {
          statusBreakdown: stats,
          totalActive,
          vipCount,
          urgentCount,
          recentEntries
        }
      });

    } catch (error) {
      console.error('Get waitlist stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch waitlist statistics',
        error: error.message
      });
    }
  }

  // Send notification to guest about room availability
  async sendAvailabilityNotification(req, res) {
    try {
      const { id } = req.params;
      const { message } = req.body;

      const entry = await WaitingList.findById(id);
      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Waiting list entry not found'
        });
      }

      // Record the notification in contact history
      await entry.addContact(
        entry.contactPreference,
        message || 'Room availability notification sent',
        req.user._id
      );

      // Here you would integrate with actual notification service
      // For now, we'll just simulate it

      res.json({
        success: true,
        message: `Notification sent to ${entry.guestName} via ${entry.contactPreference}`,
        data: {
          method: entry.contactPreference,
          recipient: entry.contactPreference === 'email' ? entry.email : entry.phone,
          message: message || 'A room matching your preferences is now available!'
        }
      });

    } catch (error) {
      console.error('Send notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send notification',
        error: error.message
      });
    }
  }
}

export default new WaitingListController();
