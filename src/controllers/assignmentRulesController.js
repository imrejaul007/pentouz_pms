import TapeChartModels from '../models/TapeChart.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import { validationResult } from 'express-validator';

const { RoomAssignmentRules } = TapeChartModels;

class AssignmentRulesController {
  // Create a new assignment rule
  async createAssignmentRule(req, res) {
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
        ruleName,
        priority,
        conditions,
        actions,
        restrictions
      } = req.body;

      // Create assignment rule
      const assignmentRule = new RoomAssignmentRules({
        ruleName,
        priority: priority || 1,
        conditions: conditions || {},
        actions: actions || {},
        restrictions: restrictions || {},
        isActive: true,
        createdBy: req.user._id
      });

      await assignmentRule.save();

      // Populate the created rule
      const populatedRule = await RoomAssignmentRules.findById(assignmentRule._id)
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email');

      res.status(201).json({
        success: true,
        message: 'Assignment rule created successfully',
        data: populatedRule
      });

    } catch (error) {
      console.error('Create assignment rule error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create assignment rule',
        error: error.message
      });
    }
  }

  // Get all assignment rules
  async getAssignmentRules(req, res) {
    try {
      const {
        isActive,
        priority,
        page = 1,
        limit = 20,
        sortBy = 'priority',
        sortOrder = 'asc'
      } = req.query;

      const query = {};
      
      if (isActive !== undefined) query.isActive = isActive === 'true';
      if (priority) query.priority = parseInt(priority);

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [assignmentRules, total] = await Promise.all([
        RoomAssignmentRules.find(query)
          .populate('createdBy', 'name email')
          .populate('lastModifiedBy', 'name email')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        RoomAssignmentRules.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: assignmentRules,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      });

    } catch (error) {
      console.error('Get assignment rules error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch assignment rules',
        error: error.message
      });
    }
  }

  // Get assignment rule by ID
  async getAssignmentRule(req, res) {
    try {
      const { id } = req.params;

      const assignmentRule = await RoomAssignmentRules.findById(id)
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email');

      if (!assignmentRule) {
        return res.status(404).json({
          success: false,
          message: 'Assignment rule not found'
        });
      }

      res.json({
        success: true,
        data: assignmentRule
      });

    } catch (error) {
      console.error('Get assignment rule error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch assignment rule',
        error: error.message
      });
    }
  }

  // Update assignment rule
  async updateAssignmentRule(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const assignmentRule = await RoomAssignmentRules.findById(id);
      if (!assignmentRule) {
        return res.status(404).json({
          success: false,
          message: 'Assignment rule not found'
        });
      }

      // Update allowed fields
      const allowedUpdates = [
        'ruleName', 'priority', 'isActive', 'conditions', 
        'actions', 'restrictions'
      ];

      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          assignmentRule[field] = updates[field];
        }
      });

      assignmentRule.lastModifiedBy = req.user._id;
      await assignmentRule.save();

      const updatedRule = await RoomAssignmentRules.findById(id)
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email');

      res.json({
        success: true,
        message: 'Assignment rule updated successfully',
        data: updatedRule
      });

    } catch (error) {
      console.error('Update assignment rule error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update assignment rule',
        error: error.message
      });
    }
  }

  // Delete assignment rule
  async deleteAssignmentRule(req, res) {
    try {
      const { id } = req.params;

      const assignmentRule = await RoomAssignmentRules.findByIdAndDelete(id);
      if (!assignmentRule) {
        return res.status(404).json({
          success: false,
          message: 'Assignment rule not found'
        });
      }

      res.json({
        success: true,
        message: 'Assignment rule deleted successfully'
      });

    } catch (error) {
      console.error('Delete assignment rule error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete assignment rule',
        error: error.message
      });
    }
  }

  // Get assignment rules statistics
  async getAssignmentRulesStats(req, res) {
    try {
      const stats = await RoomAssignmentRules.aggregate([
        {
          $group: {
            _id: '$isActive',
            count: { $sum: 1 },
            avgPriority: { $avg: '$priority' }
          }
        }
      ]);

      const priorityStats = await RoomAssignmentRules.aggregate([
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const recentRules = await RoomAssignmentRules.find()
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(5);

      res.json({
        success: true,
        data: {
          statusStats: stats,
          priorityStats,
          recentRules
        }
      });

    } catch (error) {
      console.error('Get assignment rules stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch assignment rules statistics',
        error: error.message
      });
    }
  }

  // Test assignment rule against booking criteria
  async testAssignmentRule(req, res) {
    try {
      const { id } = req.params;
      const { testCriteria } = req.body;

      const assignmentRule = await RoomAssignmentRules.findById(id);
      if (!assignmentRule) {
        return res.status(404).json({
          success: false,
          message: 'Assignment rule not found'
        });
      }

      // Simple rule matching logic (in real system this would be more complex)
      const matches = this.evaluateRuleConditions(assignmentRule.conditions, testCriteria);

      res.json({
        success: true,
        data: {
          ruleId: id,
          ruleName: assignmentRule.ruleName,
          matches,
          applicableActions: matches ? assignmentRule.actions : null,
          testCriteria
        }
      });

    } catch (error) {
      console.error('Test assignment rule error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test assignment rule',
        error: error.message
      });
    }
  }

  // Auto-assign rooms based on assignment rules
  async autoAssignRooms(req, res) {
    try {
      const hotelId = req.user.hotelId;
      const { criteria = {} } = req.body;
      const { guestType, roomType, priority, maxBookings = 50 } = criteria;

      // Get active assignment rules ordered by priority
      const assignmentRules = await RoomAssignmentRules.find({
        isActive: true
      }).sort({ priority: 1 }).limit(20);

      if (assignmentRules.length === 0) {
        return res.json({
          success: true,
          message: 'No active assignment rules found',
          data: {
            assigned: 0,
            failed: 0,
            skipped: 0,
            details: []
          }
        });
      }

      // Find unassigned bookings that need room assignment
      const bookingQuery = {
        hotelId,
        status: { $in: ['confirmed', 'pending'] },
        'rooms.0': { $exists: false }, // No rooms assigned yet
        checkIn: { $gte: new Date() } // Future bookings only
      };

      // Apply criteria filters
      if (guestType) {
        bookingQuery.guestType = guestType;
      }
      if (roomType) {
        bookingQuery.roomType = roomType;
      }

      const unassignedBookings = await Booking.find(bookingQuery)
        .populate('userId', 'name email loyaltyStatus')
        .limit(maxBookings)
        .sort({ createdAt: 1 });

      const results = {
        assigned: 0,
        failed: 0,
        skipped: 0,
        details: []
      };

      // Process each booking
      for (const booking of unassignedBookings) {
        try {
          const bookingCriteria = {
            guestType: this.determineGuestType(booking),
            roomType: booking.roomType,
            lengthOfStay: this.calculateLengthOfStay(booking.checkIn, booking.checkOut),
            reservationType: booking.reservationType || 'standard',
            advanceBooking: Math.ceil((new Date(booking.checkIn) - new Date()) / (1000 * 60 * 60 * 24))
          };

          // Find applicable rules for this booking
          const applicableRules = assignmentRules.filter(rule =>
            this.evaluateRuleConditions(rule.conditions, bookingCriteria)
          );

          if (applicableRules.length === 0) {
            results.skipped++;
            results.details.push({
              bookingId: booking._id,
              bookingNumber: booking.bookingNumber,
              guestName: booking.userId?.name || 'Unknown',
              status: 'skipped',
              reason: 'No matching assignment rules'
            });
            continue;
          }

          // Apply the highest priority rule
          const selectedRule = applicableRules[0];
          const assignedRoom = await this.findAndAssignRoom(booking, selectedRule, hotelId);

          if (assignedRoom) {
            // Update booking with assigned room
            await Booking.findByIdAndUpdate(booking._id, {
              $push: {
                rooms: {
                  roomId: assignedRoom._id,
                  rate: assignedRoom.basePrice || booking.totalAmount
                }
              },
              assignedRoom: assignedRoom._id,
              assignmentRuleUsed: selectedRule._id,
              lastModified: new Date()
            });

            results.assigned++;
            results.details.push({
              bookingId: booking._id,
              bookingNumber: booking.bookingNumber,
              guestName: booking.userId?.name || 'Unknown',
              assignedRoom: assignedRoom.roomNumber,
              roomType: assignedRoom.roomType,
              rule: selectedRule.ruleName,
              status: 'assigned'
            });
          } else {
            results.failed++;
            results.details.push({
              bookingId: booking._id,
              bookingNumber: booking.bookingNumber,
              guestName: booking.userId?.name || 'Unknown',
              status: 'failed',
              reason: 'No available rooms matching criteria'
            });
          }

        } catch (bookingError) {
          console.error(`Error processing booking ${booking._id}:`, bookingError);
          results.failed++;
          results.details.push({
            bookingId: booking._id,
            bookingNumber: booking.bookingNumber,
            guestName: booking.userId?.name || 'Unknown',
            status: 'failed',
            reason: 'Processing error: ' + bookingError.message
          });
        }
      }

      res.json({
        success: true,
        message: `Auto-assignment completed. ${results.assigned} assigned, ${results.failed} failed, ${results.skipped} skipped.`,
        data: results
      });

    } catch (error) {
      console.error('Auto-assign rooms error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to auto-assign rooms',
        error: error.message
      });
    }
  }

  // Helper method to determine guest type from booking
  determineGuestType(booking) {
    if (booking.userId?.loyaltyStatus) {
      const loyaltyMap = {
        'platinum': 'vip',
        'gold': 'loyalty_member',
        'silver': 'loyalty_member'
      };
      return loyaltyMap[booking.userId.loyaltyStatus] || 'standard';
    }

    if (booking.guestType) return booking.guestType;
    if (booking.reservationType === 'corporate') return 'corporate';
    if (booking.reservationType === 'group') return 'group';

    return 'standard';
  }

  // Helper method to calculate length of stay
  calculateLengthOfStay(checkIn, checkOut) {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((new Date(checkOut) - new Date(checkIn)) / msPerDay);
  }

  // Helper method to find and assign a room based on rule actions
  async findAndAssignRoom(booking, rule, hotelId) {
    const roomQuery = {
      hotelId,
      isActive: true,
      status: 'available'
    };

    // Apply room type preference
    if (booking.roomType) {
      roomQuery.roomType = booking.roomType;
    } else if (rule.conditions.roomTypes && rule.conditions.roomTypes.length > 0) {
      roomQuery.roomType = { $in: rule.conditions.roomTypes };
    }

    // Apply rule-based room preferences
    if (rule.actions.preferredRoomNumbers && rule.actions.preferredRoomNumbers.length > 0) {
      roomQuery.roomNumber = { $in: rule.actions.preferredRoomNumbers };
    }

    if (rule.actions.avoidRoomNumbers && rule.actions.avoidRoomNumbers.length > 0) {
      roomQuery.roomNumber = { $nin: rule.actions.avoidRoomNumbers };
    }

    if (rule.actions.preferredFloors && rule.actions.preferredFloors.length > 0) {
      roomQuery.floor = { $in: rule.actions.preferredFloors };
    }

    // Check for existing bookings in the date range
    const conflictingBookings = await Booking.find({
      hotelId,
      status: { $in: ['confirmed', 'checked_in'] },
      $or: [
        {
          checkIn: { $lt: booking.checkOut },
          checkOut: { $gt: booking.checkIn }
        }
      ]
    }).select('rooms.roomId');

    const occupiedRoomIds = conflictingBookings.flatMap(b =>
      b.rooms.map(r => r.roomId?.toString()).filter(Boolean)
    );

    if (occupiedRoomIds.length > 0) {
      roomQuery._id = { $nin: occupiedRoomIds };
    }

    // Find available rooms
    let availableRooms = await Room.find(roomQuery).sort({
      floor: 1,
      roomNumber: 1
    });

    if (availableRooms.length === 0) {
      return null;
    }

    // Apply upgrade logic if eligible
    if (rule.actions.upgradeEligible && rule.actions.upgradeToTypes && rule.actions.upgradeToTypes.length > 0) {
      const upgradeRooms = availableRooms.filter(room =>
        rule.actions.upgradeToTypes.includes(room.roomType)
      );

      if (upgradeRooms.length > 0) {
        availableRooms = upgradeRooms;
      }
    }

    // Return the first available room
    return availableRooms[0];
  }

  // Helper method to evaluate rule conditions
  evaluateRuleConditions(conditions, criteria) {
    // Simple evaluation logic - in a real system this would be more sophisticated
    if (!conditions || !criteria) return false;

    // Check guest type match
    if (conditions.guestType && conditions.guestType.length > 0) {
      if (!conditions.guestType.includes(criteria.guestType)) return false;
    }

    // Check room types match
    if (conditions.roomTypes && conditions.roomTypes.length > 0) {
      if (!conditions.roomTypes.includes(criteria.roomType)) return false;
    }

    // Check length of stay
    if (conditions.lengthOfStay) {
      const { min, max } = conditions.lengthOfStay;
      if (min && criteria.lengthOfStay < min) return false;
      if (max && criteria.lengthOfStay > max) return false;
    }

    // Check advance booking period
    if (conditions.advanceBooking) {
      const { min, max } = conditions.advanceBooking;
      if (min && criteria.advanceBooking < min) return false;
      if (max && criteria.advanceBooking > max) return false;
    }

    return true;
  }
}

export default new AssignmentRulesController();
