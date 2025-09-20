import mongoose from 'mongoose';
import TapeChart from '../models/TapeChart.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import WaitingList from '../models/WaitingList.js';

const { 
  RoomConfiguration, 
  RoomStatusHistory, 
  RoomBlock, 
  AdvancedReservation, 
  TapeChartView, 
  RoomAssignmentRules 
} = TapeChart;

class TapeChartService {
  // Room Configuration Management
  async createRoomConfiguration(configData) {
    try {
      const config = new RoomConfiguration(configData);
      await config.save();
      return config;
    } catch (error) {
      throw new Error(`Failed to create room configuration: ${error.message}`);
    }
  }

  async getRoomConfigurations(filters = {}) {
    try {
      const query = {};
      if (filters.floor) query.floor = filters.floor;
      if (filters.building) query.building = filters.building;
      if (filters.wing) query.wing = filters.wing;
      if (filters.isActive !== undefined) query.isActive = filters.isActive;

      return await RoomConfiguration.find(query).sort({ floor: 1, sortOrder: 1 });
    } catch (error) {
      throw new Error(`Failed to fetch room configurations: ${error.message}`);
    }
  }

  async updateRoomConfiguration(configId, updateData) {
    try {
      return await RoomConfiguration.findByIdAndUpdate(
        configId,
        updateData,
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw new Error(`Failed to update room configuration: ${error.message}`);
    }
  }

  // Room Status Management
  async updateRoomStatus(roomId, statusData, userId) {
    try {
      const room = await Room.findById(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const previousStatus = room.status;
      
      // Create status history entry
      const historyEntry = new RoomStatusHistory({
        roomId,
        date: new Date(),
        status: statusData.status,
        previousStatus,
        bookingId: statusData.bookingId,
        guestName: statusData.guestName,
        checkIn: statusData.checkIn,
        checkOut: statusData.checkOut,
        notes: statusData.notes,
        changedBy: userId,
        changeReason: statusData.changeReason,
        priority: statusData.priority || 'medium'
      });

      await historyEntry.save();

      // Update room status
      room.status = statusData.status;
      room.lastUpdated = new Date();
      await room.save();

      return { room, history: historyEntry };
    } catch (error) {
      throw new Error(`Failed to update room status: ${error.message}`);
    }
  }

  async getRoomStatusHistory(roomId, dateRange = {}) {
    try {
      const query = { roomId };

      if (dateRange.startDate && dateRange.endDate) {
        query.date = {
          $gte: new Date(dateRange.startDate),
          $lte: new Date(dateRange.endDate)
        };
      }

      return await RoomStatusHistory.find(query)
        .populate('roomId', 'roomNumber roomType')
        .populate('bookingId', 'bookingNumber guestName')
        .populate('changedBy', 'name email')
        .sort({ date: -1 });
    } catch (error) {
      throw new Error(`Failed to fetch room status history: ${error.message}`);
    }
  }

  async getAvailableRooms(hotelId, filters = {}) {
    try {
      const { checkIn, checkOut, roomType, floor, guestCount } = filters;

      // Build room query
      const roomQuery = { hotelId, isActive: true };
      if (roomType) roomQuery.type = roomType;
      if (floor) roomQuery.floor = floor;
      if (guestCount) roomQuery.capacity = { $gte: guestCount };

      // Get all rooms matching criteria
      const rooms = await Room.find(roomQuery);

      // If dates are provided, filter out rooms that are already booked
      if (checkIn && checkOut) {
        const startDate = new Date(checkIn);
        const endDate = new Date(checkOut);

        // Find rooms that are booked during this period
        const bookedRoomIds = await Booking.aggregate([
          {
            $match: {
              hotelId,
              status: { $in: ['confirmed', 'checked_in'] },
              $or: [
                { checkIn: { $lte: endDate }, checkOut: { $gte: startDate } }
              ]
            }
          },
          {
            $unwind: '$rooms'
          },
          {
            $group: {
              _id: '$rooms.roomId'
            }
          }
        ]);

        const bookedRoomIdsSet = new Set(bookedRoomIds.map(item => item._id.toString()));

        // Filter out booked rooms and add assignment scores
        const availableRooms = rooms
          .filter(room => !bookedRoomIdsSet.has(room._id.toString()))
          .map(room => ({
            id: room._id,
            roomNumber: room.roomNumber,
            roomType: room.type,
            floor: room.floor,
            status: room.status,
            features: room.amenities || [],
            baseRate: room.currentRate || room.baseRate,
            maxOccupancy: room.capacity,
            bedType: room.bedType || 'Standard',
            size: room.size || 300,
            view: room.view,
            lastCleaned: room.lastCleaned,
            maintenanceNotes: room.maintenanceNotes,
            assignmentScore: this.calculateAssignmentScore(room, filters)
          }));

        return availableRooms;
      }

      // If no dates provided, return all rooms with status info
      return rooms.map(room => ({
        id: room._id,
        roomNumber: room.roomNumber,
        roomType: room.type,
        floor: room.floor,
        status: room.status,
        features: room.amenities || [],
        baseRate: room.currentRate || room.baseRate,
        maxOccupancy: room.capacity,
        bedType: room.bedType || 'Standard',
        size: room.size || 300,
        view: room.view,
        lastCleaned: room.lastCleaned,
        maintenanceNotes: room.maintenanceNotes,
        assignmentScore: this.calculateAssignmentScore(room, filters)
      }));

    } catch (error) {
      throw new Error(`Failed to fetch available rooms: ${error.message}`);
    }
  }

  calculateAssignmentScore(room, filters) {
    let score = 50; // Base score

    // Room type match
    if (filters.roomType && room.type === filters.roomType) {
      score += 30;
    }

    // Capacity match
    if (filters.guestCount && room.capacity >= filters.guestCount) {
      score += 20;
    }

    // Floor preference
    if (filters.floor && room.floor === filters.floor) {
      score += 10;
    }

    // Room condition boost
    if (room.status === 'clean') score += 5;
    if (room.status === 'maintenance' || room.status === 'dirty') score -= 20;

    // Higher floor rooms get slight boost
    if (room.floor >= 3) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  // Room Block Management
  async createRoomBlock(blockData, userId) {
    try {
      const roomBlock = new RoomBlock({
        ...blockData,
        createdBy: userId
      });

      await roomBlock.save();

      // Update room statuses for blocked rooms
      if (blockData.rooms && blockData.rooms.length > 0) {
        await Promise.all(
          blockData.rooms.map(async (room) => {
            await this.updateRoomStatus(
              room.roomId,
              {
                status: 'reserved',
                notes: `Blocked for group: ${blockData.groupName}`,
                changeReason: 'group_block'
              },
              userId
            );
          })
        );
      }

      return roomBlock;
    } catch (error) {
      throw new Error(`Failed to create room block: ${error.message}`);
    }
  }

  async getRoomBlocks(filters = {}) {
    try {
      const query = {};
      
      if (filters.status) query.status = filters.status;
      if (filters.eventType) query.eventType = filters.eventType;
      if (filters.startDate && filters.endDate) {
        query.$or = [
          {
            startDate: {
              $gte: new Date(filters.startDate),
              $lte: new Date(filters.endDate)
            }
          },
          {
            endDate: {
              $gte: new Date(filters.startDate),
              $lte: new Date(filters.endDate)
            }
          }
        ];
      }

      return await RoomBlock.find(query)
        .populate('rooms.roomId', 'roomNumber roomType')
        .populate('corporateId', 'companyName')
        .populate('createdBy', 'name email')
        .sort({ startDate: 1 });
    } catch (error) {
      throw new Error(`Failed to fetch room blocks: ${error.message}`);
    }
  }

  async updateRoomBlock(blockId, updateData) {
    try {
      return await RoomBlock.findByIdAndUpdate(
        blockId,
        updateData,
        { new: true, runValidators: true }
      ).populate('rooms.roomId', 'roomNumber roomType');
    } catch (error) {
      throw new Error(`Failed to update room block: ${error.message}`);
    }
  }

  async releaseRoomBlock(blockId, userId) {
    try {
      const block = await RoomBlock.findById(blockId);
      if (!block) {
        throw new Error('Room block not found');
      }

      // Release all blocked rooms
      await Promise.all(
        block.rooms.map(async (room) => {
          if (room.status === 'blocked') {
            await this.updateRoomStatus(
              room.roomId,
              {
                status: 'available',
                notes: `Released from block: ${block.groupName}`,
                changeReason: 'block_release'
              },
              userId
            );
          }
        })
      );

      block.status = 'expired';
      block.roomsReleased = block.rooms.filter(r => r.status === 'blocked').length;
      await block.save();

      return block;
    } catch (error) {
      throw new Error(`Failed to release room block: ${error.message}`);
    }
  }

  // Advanced Reservation Management
  async createAdvancedReservation(reservationData) {
    try {
      const reservation = new AdvancedReservation(reservationData);
      await reservation.save();

      // Apply auto room assignment if applicable
      if (reservationData.autoAssign) {
        await this.autoAssignRooms(reservation._id);
      }

      return reservation;
    } catch (error) {
      throw new Error(`Failed to create advanced reservation: ${error.message}`);
    }
  }

  async getAdvancedReservations(filters = {}) {
    try {
      const query = {};
      
      if (filters.reservationType) query.reservationType = filters.reservationType;
      if (filters.priority) query.priority = filters.priority;
      if (filters.vipStatus) query['guestProfile.vipStatus'] = filters.vipStatus;

      return await AdvancedReservation.find(query)
        .populate('bookingId', 'bookingNumber guestName checkIn checkOut')
        .populate('roomAssignments.roomId', 'roomNumber roomType')
        .populate('roomAssignments.assignedBy', 'name')
        .sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Failed to fetch advanced reservations: ${error.message}`);
    }
  }

  async assignRoom(reservationId, roomAssignment, userId) {
    try {
      const reservation = await AdvancedReservation.findById(reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      const assignment = {
        ...roomAssignment,
        assignedDate: new Date(),
        assignedBy: userId
      };

      reservation.roomAssignments.push(assignment);
      await reservation.save();

      // Update room status
      await this.updateRoomStatus(
        roomAssignment.roomId,
        {
          status: 'reserved',
          bookingId: reservation.bookingId,
          notes: `Assigned to reservation ${reservation.reservationId}`,
          changeReason: 'room_assignment'
        },
        userId
      );

      return reservation;
    } catch (error) {
      throw new Error(`Failed to assign room: ${error.message}`);
    }
  }

  async autoAssignRooms(reservationId) {
    try {
      const reservation = await AdvancedReservation.findById(reservationId)
        .populate('bookingId');
      
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      const booking = reservation.bookingId;
      const rules = await this.getApplicableRules(reservation);
      
      // Find available rooms based on preferences and rules
      const availableRooms = await this.findAvailableRooms({
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomType: booking.roomType,
        preferences: reservation.roomPreferences,
        rules
      });

      if (availableRooms.length === 0) {
        throw new Error('No suitable rooms available for auto-assignment');
      }

      // Apply assignment logic
      const selectedRoom = await this.selectBestRoom(availableRooms, reservation, rules);
      
      // Assign the room
      await this.assignRoom(
        reservationId,
        {
          roomId: selectedRoom._id,
          roomNumber: selectedRoom.roomNumber,
          assignmentType: 'auto'
        },
        'system'
      );

      return selectedRoom;
    } catch (error) {
      throw new Error(`Auto assignment failed: ${error.message}`);
    }
  }

  async processUpgrade(reservationId, upgradeData, userId) {
    try {
      const reservation = await AdvancedReservation.findById(reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      const upgrade = {
        ...upgradeData,
        upgradeDate: new Date(),
        approvedBy: userId
      };

      reservation.upgrades.push(upgrade);
      
      // If room assignment exists, update it
      if (upgradeData.newRoomId && reservation.roomAssignments.length > 0) {
        const latestAssignment = reservation.roomAssignments[reservation.roomAssignments.length - 1];
        
        // Release old room
        await this.updateRoomStatus(
          latestAssignment.roomId,
          {
            status: 'available',
            notes: `Upgraded to ${upgradeData.toRoomType}`,
            changeReason: 'room_upgrade'
          },
          userId
        );

        // Assign new room
        await this.assignRoom(
          reservationId,
          {
            roomId: upgradeData.newRoomId,
            roomNumber: upgradeData.newRoomNumber,
            assignmentType: 'upgrade',
            notes: `Upgraded from ${upgradeData.fromRoomType}`
          },
          userId
        );
      }

      await reservation.save();
      return reservation;
    } catch (error) {
      throw new Error(`Failed to process upgrade: ${error.message}`);
    }
  }

  // Tape Chart View Management
  async createTapeChartView(viewData, userId) {
    try {
      const view = new TapeChartView({
        ...viewData,
        createdBy: userId
      });
      await view.save();
      return view;
    } catch (error) {
      throw new Error(`Failed to create tape chart view: ${error.message}`);
    }
  }

  async getTapeChartViews(userId) {
    try {
      let views = await TapeChartView.find({
        $or: [
          { createdBy: userId },
          { isSystemDefault: true }
        ]
      }).sort({ isSystemDefault: -1, viewName: 1 });

      // Create default view if none exist
      if (views.length === 0) {
        const defaultView = new TapeChartView({
          viewId: 'default-view',
          viewName: 'Default View',
          viewType: 'daily',
          dateRange: {
            defaultDays: 7
          },
          displaySettings: {
            showWeekends: true,
            colorCoding: {
              available: '#10B981',
              occupied: '#EF4444', 
              reserved: '#F59E0B',
              maintenance: '#8B5CF6',
              out_of_order: '#6B7280',
              dirty: '#F97316',
              clean: '#06B6D4'
            },
            roomSorting: 'floor',
            showGuestNames: true,
            showRoomTypes: true,
            showRates: false,
            compactView: false
          },
          filters: {},
          isSystemDefault: true,
          createdBy: userId
        });
        await defaultView.save();
        views = [defaultView];
      }

      return views;
    } catch (error) {
      throw new Error(`Failed to fetch tape chart views: ${error.message}`);
    }
  }

  async updateTapeChartView(viewId, updateData) {
    try {
      return await TapeChartView.findByIdAndUpdate(
        viewId,
        updateData,
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw new Error(`Failed to update tape chart view: ${error.message}`);
    }
  }

  async deleteTapeChartView(viewId) {
    try {
      await TapeChartView.findByIdAndDelete(viewId);
    } catch (error) {
      throw new Error(`Failed to delete tape chart view: ${error.message}`);
    }
  }

  // Generate Tape Chart Data
  async generateTapeChartData(viewId, dateRange) {
    try {
      console.log('Generating tape chart data for view:', viewId, 'dateRange:', dateRange);
      const view = await TapeChartView.findById(viewId);
      if (!view) {
        throw new Error('Tape chart view not found');
      }
      console.log('Found view:', view.viewName);

      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      
      // Get room configurations
      let roomConfigs = await this.getRoomConfigurations({
        isActive: true,
        ...view.filters
      });

      // If no room configurations exist, create them from existing rooms
      if (!roomConfigs || roomConfigs.length === 0) {
        const rooms = await Room.find({ isActive: true });
        roomConfigs = [];
        
        for (const room of rooms) {
          // Create a basic room configuration for each room
          const config = {
            _id: new mongoose.Types.ObjectId(),
            roomId: room._id,
            roomNumber: room.roomNumber,
            roomType: room.type,
            floor: room.floor || 1,
            building: room.building || 'Main',
            wing: room.wing || 'A',
            position: { row: Math.floor(roomConfigs.length / 10), column: roomConfigs.length % 10 },
            displaySettings: {
              color: '#3B82F6',
              width: 120,
              height: 60,
              showRoomNumber: true,
              showGuestName: true,
              showRoomType: true
            },
            isActive: true,
            sortOrder: roomConfigs.length
          };
          roomConfigs.push(config);
        }
      }

      // Get ALL bookings for the date range (don't filter by status in database)
      const allBookings = await Booking.find({
        $or: [
          {
            checkIn: { $gte: startDate, $lte: endDate }
          },
          {
            checkOut: { $gte: startDate, $lte: endDate }
          },
          {
            checkIn: { $lt: startDate },
            checkOut: { $gt: endDate }
          }
        ]
      })
      .populate('rooms.roomId', 'roomNumber type')
      .populate('userId', 'name email phone');

      console.log(`🚀 TAPE CHART DEBUG - Found ${allBookings.length} total bookings in date range`);
      
      // Filter bookings by status in application logic - EXCLUDE checked-out and cancelled bookings from TapeChart
      const bookings = allBookings.filter(booking => {
        const isValidStatus = ['confirmed', 'checked_in', 'pending', 'modified'].includes(booking.status);
        console.log(`🚀 TAPE CHART DEBUG - Booking ${booking._id} (${booking.userId?.name}) status: ${booking.status}, valid: ${isValidStatus}`);
        return isValidStatus;
      });
      
      console.log(`🚀 TAPE CHART DEBUG - Filtered to ${bookings.length} bookings with valid statuses`);


      // Get room blocks
      const blocks = await this.getRoomBlocks({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: 'active'
      });

      // Generate chart data
      const chartData = {
        view,
        dateRange: { startDate, endDate },
        rooms: [],
        summary: {
          totalRooms: roomConfigs.length,
          occupiedRooms: 0,
          availableRooms: 0,
          reservedRooms: 0,
          maintenanceRooms: 0,
          blockedRooms: 0,
          occupancyRate: 0
        }
      };

      // Process each room
      for (const config of roomConfigs) {
        const room = await Room.findOne({ 
          $or: [
            { roomNumber: config.roomNumber },
            { _id: config.roomId }
          ],
          isActive: true
        });
        if (!room) continue;

        const roomBookings = bookings.filter(b => b.rooms && b.rooms.some(r => r.roomId && r.roomId._id.toString() === room._id.toString()));
        const roomBlocks = blocks.filter(b => b.rooms.some(r => r.roomId.toString() === room._id.toString()));
        

        const roomData = {
          config,
          room,
          timeline: [],
          currentStatus: this.mapRoomStatusToTapeChart(room.status),
          bookings: roomBookings,
          blocks: roomBlocks
        };

        // Generate timeline for date range
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const dayBooking = roomData.bookings.find(b => 
            new Date(b.checkIn) <= d && new Date(b.checkOut) > d
          );

          const dayBlock = roomData.blocks.find(b =>
            new Date(b.startDate) <= d && new Date(b.endDate) >= d
          );

          let status = 'available';
          let guestName = null;
          let bookingId = null;
          let rate = null;

          if (dayBooking) {
            status = dayBooking.status === 'checked_in' ? 'occupied' : 'reserved';
            guestName = dayBooking.userId?.name || 'Unknown Guest';
            bookingId = dayBooking._id;
            rate = dayBooking.totalAmount / ((new Date(dayBooking.checkOut) - new Date(dayBooking.checkIn)) / (1000 * 60 * 60 * 24));
          } else if (dayBlock) {
            status = 'blocked';
            guestName = dayBlock.groupName;
          } else if (room.status === 'maintenance' || room.status === 'out_of_order') {
            status = this.mapRoomStatusToTapeChart(room.status);
          }

          roomData.timeline.push({
            date: dateStr,
            status,
            guestName,
            bookingId,
            rate,
            // Real booking data for visual indicators
            gender: dayBooking ? this.inferGuestGender(dayBooking.userId?.name) : null,
            bookingType: dayBooking ? this.inferBookingType(dayBooking) : null,
            aiPrediction: status === 'available' ? {
              demandLevel: this.calculateDemandLevel(d, bookings),
              profitabilityScore: this.calculateProfitabilityScore(room, d),
              recommendedRate: this.calculateRecommendedRate(room, d),
              confidence: 85 // Static confidence for now
            } : null,
            preferences: dayBooking ? this.extractGuestPreferences(dayBooking) : null,
            vipStatus: dayBooking ? this.determineVipStatus(dayBooking) : 'none'
          });
        }

        chartData.rooms.push(roomData);

        // Update summary based on the actual current room status
        const mappedStatus = this.mapRoomStatusToTapeChart(room.status);
        
        // Check if room has current booking to override status
        let finalStatus = mappedStatus;
        const now = new Date();
        console.log(`🚀 TAPE CHART DEBUG - Current time for comparison: ${now.toISOString()}`);
        
        console.log(`🚀 TAPE CHART DEBUG - Room ${room.roomNumber} bookings:`, roomBookings.map(b => ({
          bookingId: b._id,
          guestName: b.userId?.name || 'Unknown',
          status: b.status,
          checkIn: b.checkIn,
          checkOut: b.checkOut
        })));
        
        const hasCurrentBooking = roomBookings.some(booking => {
          const checkIn = new Date(booking.checkIn);
          const checkOut = new Date(booking.checkOut);
          
          // A booking is current if:
          // 1. It has an ACTIVE status (not checked_out or cancelled) - PRIORITY
          // 2. It's within the current date range (checkIn <= now < checkOut)
          const hasActiveStatus = ['confirmed', 'checked_in', 'pending', 'modified'].includes(booking.status);
          const isWithinDateRange = checkIn <= now && checkOut > now;
          
          // If status is checked_out or cancelled, it's never current regardless of dates
          // This handles manual checkouts even before the scheduled checkout time
          if (booking.status === 'checked_out' || booking.status === 'cancelled') {
            console.log(`🚀 TAPE CHART DEBUG - Booking ${booking._id} (${booking.userId?.name}) is ${booking.status}, marking as NOT current (manual checkout)`);
            return false;
          }
          
          const isCurrentBooking = hasActiveStatus && isWithinDateRange;
          
          console.log(`🚀 TAPE CHART DEBUG - Booking ${booking._id} (${booking.userId?.name}):`, {
            status: booking.status,
            checkIn: checkIn.toISOString(),
            checkOut: checkOut.toISOString(),
            now: now.toISOString(),
            isWithinDateRange,
            hasActiveStatus,
            isCurrentBooking
          });
          
          if (isCurrentBooking) {
            console.log(`🚀 TAPE CHART DEBUG - Room ${room.roomNumber} has current booking:`, {
              bookingId: booking._id,
              guestName: booking.userId?.name || 'Unknown',
              status: booking.status,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              now: now
            });
          }
          
          return isCurrentBooking;
        });
        
        if (hasCurrentBooking) {
          finalStatus = 'occupied';
          console.log(`🚀 TAPE CHART DEBUG - Room ${room.roomNumber} marked as occupied`);
        } else {
          console.log(`🚀 TAPE CHART DEBUG - Room ${room.roomNumber} has no current booking, status: ${finalStatus}`);
        }
        
        
        switch (finalStatus) {
          case 'occupied':
            chartData.summary.occupiedRooms++;
            break;
          case 'available':
            chartData.summary.availableRooms++;
            break;
          case 'reserved':
            chartData.summary.reservedRooms++;
            break;
          case 'maintenance':
          case 'out_of_order':
            chartData.summary.maintenanceRooms++;
            break;
          case 'dirty':
            // Count dirty rooms as maintenance for summary
            chartData.summary.maintenanceRooms++;
            break;
        }
      }

      // Calculate occupancy rate
      const availableForOccupancy = chartData.summary.totalRooms - chartData.summary.maintenanceRooms;
      if (availableForOccupancy > 0) {
        chartData.summary.occupancyRate = 
          ((chartData.summary.occupiedRooms + chartData.summary.reservedRooms) / availableForOccupancy) * 100;
      }


      return chartData;
    } catch (error) {
      console.error('Error generating tape chart data:', error);
      console.error('Stack trace:', error.stack);
      throw new Error(`Failed to generate tape chart data: ${error.message}`);
    }
  }

  // Room Assignment Rules
  async createAssignmentRule(ruleData, userId) {
    try {
      const rule = new RoomAssignmentRules({
        ...ruleData,
        createdBy: userId,
        lastModifiedBy: userId
      });
      await rule.save();
      return rule;
    } catch (error) {
      throw new Error(`Failed to create assignment rule: ${error.message}`);
    }
  }

  async getAssignmentRules(filters = {}) {
    try {
      const query = {};
      if (filters.isActive !== undefined) query.isActive = filters.isActive;

      return await RoomAssignmentRules.find(query)
        .populate('createdBy lastModifiedBy', 'name email')
        .sort({ priority: 1, ruleName: 1 });
    } catch (error) {
      throw new Error(`Failed to fetch assignment rules: ${error.message}`);
    }
  }

  async getApplicableRules(reservation) {
    try {
      const rules = await RoomAssignmentRules.find({ isActive: true })
        .sort({ priority: 1 });

      return rules.filter(rule => {
        // Check if rule applies to this reservation
        const conditions = rule.conditions;
        
        if (conditions.guestType && conditions.guestType.length > 0) {
          if (!conditions.guestType.includes(reservation.guestProfile.vipStatus)) {
            return false;
          }
        }

        if (conditions.reservationType && conditions.reservationType.length > 0) {
          if (!conditions.reservationType.includes(reservation.reservationType)) {
            return false;
          }
        }

        // Add more condition checks as needed

        return true;
      });
    } catch (error) {
      throw new Error(`Failed to get applicable rules: ${error.message}`);
    }
  }

  async findAvailableRooms(criteria) {
    try {
      const query = {
        roomType: criteria.roomType,
        status: { $in: ['available', 'clean'] },
        isActive: true
      };

      // Apply preferences
      if (criteria.preferences.preferredFloor) {
        query.floor = criteria.preferences.preferredFloor;
      }

      if (criteria.preferences.preferredRooms && criteria.preferences.preferredRooms.length > 0) {
        query.roomNumber = { $in: criteria.preferences.preferredRooms };
      }

      // Check availability for date range
      const conflictingBookings = await Booking.find({
        $or: [
          {
            checkIn: { $lt: criteria.checkOut },
            checkOut: { $gt: criteria.checkIn }
          }
        ],
        status: { $in: ['confirmed', 'checked_in'] }
      });

      const unavailableRoomIds = conflictingBookings.map(b => b.roomId.toString());
      if (unavailableRoomIds.length > 0) {
        query._id = { $nin: unavailableRoomIds };
      }

      return await Room.find(query).sort({ floor: 1, roomNumber: 1 });
    } catch (error) {
      throw new Error(`Failed to find available rooms: ${error.message}`);
    }
  }

  async selectBestRoom(availableRooms, reservation, rules) {
    try {
      let scoredRooms = availableRooms.map(room => ({
        room,
        score: 0
      }));

      // Apply rule-based scoring
      for (const rule of rules) {
        for (const scoredRoom of scoredRooms) {
          const room = scoredRoom.room;

          // Preferred floors
          if (rule.actions.preferredFloors && rule.actions.preferredFloors.includes(room.floor)) {
            scoredRoom.score += 10;
          }

          // Preferred room numbers
          if (rule.actions.preferredRoomNumbers && rule.actions.preferredRoomNumbers.includes(room.roomNumber)) {
            scoredRoom.score += 15;
          }

          // Avoid room numbers
          if (rule.actions.avoidRoomNumbers && rule.actions.avoidRoomNumbers.includes(room.roomNumber)) {
            scoredRoom.score -= 20;
          }
        }
      }

      // Apply preference-based scoring
      const preferences = reservation.roomPreferences;
      
      for (const scoredRoom of scoredRooms) {
        const room = scoredRoom.room;

        if (preferences.preferredFloor && room.floor === preferences.preferredFloor) {
          scoredRoom.score += 8;
        }

        if (preferences.preferredRooms && preferences.preferredRooms.includes(room.roomNumber)) {
          scoredRoom.score += 12;
        }

        // Add more preference scoring logic
      }

      // Sort by score and return best room
      scoredRooms.sort((a, b) => b.score - a.score);
      return scoredRooms[0].room;
    } catch (error) {
      throw new Error(`Failed to select best room: ${error.message}`);
    }
  }

  // Waitlist Management
  async addToWaitlist(reservationId, waitlistData) {
    try {
      const reservation = await AdvancedReservation.findById(reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Get current waitlist position
      const waitlistCount = await AdvancedReservation.countDocuments({
        'waitlistInfo.waitlistPosition': { $exists: true, $ne: null }
      });

      reservation.waitlistInfo = {
        ...waitlistData,
        waitlistPosition: waitlistCount + 1,
        waitlistDate: new Date()
      };

      await reservation.save();
      return reservation;
    } catch (error) {
      throw new Error(`Failed to add to waitlist: ${error.message}`);
    }
  }

  async processWaitlist() {
    try {
      const waitlistReservations = await AdvancedReservation.find({
        'waitlistInfo.waitlistPosition': { $exists: true, $ne: null }
      })
      .populate('bookingId')
      .sort({ 'waitlistInfo.waitlistPosition': 1 });

      const processed = [];

      for (const reservation of waitlistReservations) {
        try {
          const availableRooms = await this.findAvailableRooms({
            checkIn: reservation.bookingId.checkIn,
            checkOut: reservation.bookingId.checkOut,
            roomType: reservation.waitlistInfo.preferredRoomTypes || [reservation.bookingId.roomType],
            preferences: reservation.roomPreferences
          });

          if (availableRooms.length > 0) {
            // Auto-confirm if preference is set
            if (reservation.waitlistInfo.autoConfirm) {
              const selectedRoom = availableRooms[0];
              await this.assignRoom(
                reservation._id,
                {
                  roomId: selectedRoom._id,
                  roomNumber: selectedRoom.roomNumber,
                  assignmentType: 'waitlist_auto'
                },
                'system'
              );

              // Remove from waitlist
              reservation.waitlistInfo = undefined;
              await reservation.save();

              processed.push({
                reservationId: reservation._id,
                action: 'auto_confirmed',
                room: selectedRoom
              });
            } else {
              // Send notification about availability
              processed.push({
                reservationId: reservation._id,
                action: 'notify_available',
                rooms: availableRooms
              });
            }
          }
        } catch (error) {
          console.error(`Error processing waitlist reservation ${reservation._id}:`, error);
        }
      }

      return processed;
    } catch (error) {
      throw new Error(`Failed to process waitlist: ${error.message}`);
    }
  }

  // Analytics and Reporting
  async generateOccupancyReport(dateRange, groupBy = 'day') {
    try {
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);

      const pipeline = [
        {
          $match: {
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $lookup: {
            from: 'rooms',
            localField: 'roomId',
            foreignField: '_id',
            as: 'room'
          }
        },
        {
          $unwind: '$room'
        },
        {
          $group: {
            _id: {
              date: groupBy === 'day' ? 
                { $dateToString: { format: '%Y-%m-%d', date: '$date' } } :
                { $dateToString: { format: '%Y-%m', date: '$date' } },
              status: '$status'
            },
            count: { $sum: 1 },
            rooms: { $addToSet: '$room.roomNumber' }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            statusCounts: {
              $push: {
                status: '$_id.status',
                count: '$count',
                rooms: '$rooms'
              }
            },
            totalRooms: { $sum: '$count' }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ];

      const data = await RoomStatusHistory.aggregate(pipeline);

      return {
        dateRange,
        groupBy,
        data: data.map(item => ({
          date: item._id,
          ...item.statusCounts.reduce((acc, curr) => {
            acc[curr.status] = curr.count;
            return acc;
          }, {}),
          totalRooms: item.totalRooms,
          occupancyRate: item.statusCounts.find(s => s.status === 'occupied')?.count / item.totalRooms * 100 || 0
        }))
      };
    } catch (error) {
      throw new Error(`Failed to generate occupancy report: ${error.message}`);
    }
  }

  // Room Utilization Stats
  async getRoomUtilizationStats(dateRange = {}) {
    try {
      const startDate = dateRange.startDate ? new Date(dateRange.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = dateRange.endDate ? new Date(dateRange.endDate) : new Date();

      // Get total rooms by type
      const roomsByType = await Room.aggregate([
        {
          $group: {
            _id: '$roomType',
            totalRooms: { $sum: 1 },
            availableRooms: {
              $sum: {
                $cond: [{ $eq: ['$status', 'available'] }, 1, 0]
              }
            }
          }
        }
      ]);

      // Get occupancy data
      const occupancyData = await RoomStatusHistory.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $lookup: {
            from: 'rooms',
            localField: 'roomId',
            foreignField: '_id',
            as: 'room'
          }
        },
        {
          $unwind: '$room'
        },
        {
          $group: {
            _id: {
              roomType: '$room.roomType',
              status: '$status'
            },
            count: { $sum: 1 },
            totalRevenue: { $sum: '$revenue' }
          }
        }
      ]);

      // Calculate utilization metrics
      const utilization = roomsByType.map(roomType => {
        const occupiedCount = occupancyData.find(
          o => o._id.roomType === roomType._id && o._id.status === 'occupied'
        )?.count || 0;
        
        const reservedCount = occupancyData.find(
          o => o._id.roomType === roomType._id && o._id.status === 'reserved'
        )?.count || 0;

        const totalRevenue = occupancyData
          .filter(o => o._id.roomType === roomType._id)
          .reduce((sum, o) => sum + (o.totalRevenue || 0), 0);

        const utilizationRate = ((occupiedCount + reservedCount) / roomType.totalRooms) * 100;
        const averageRevenue = roomType.totalRooms > 0 ? totalRevenue / roomType.totalRooms : 0;

        return {
          roomType: roomType._id,
          totalRooms: roomType.totalRooms,
          occupiedRooms: occupiedCount,
          reservedRooms: reservedCount,
          availableRooms: roomType.availableRooms,
          utilizationRate,
          totalRevenue,
          averageRevenue,
          revPAR: (utilizationRate / 100) * averageRevenue
        };
      });

      return {
        period: { startDate, endDate },
        utilization,
        summary: {
          totalRooms: utilization.reduce((sum, u) => sum + u.totalRooms, 0),
          totalOccupied: utilization.reduce((sum, u) => sum + u.occupiedRooms, 0),
          totalRevenue: utilization.reduce((sum, u) => sum + u.totalRevenue, 0),
          overallUtilization: utilization.reduce((sum, u) => sum + u.utilizationRate, 0) / utilization.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to get room utilization stats: ${error.message}`);
    }
  }

  // Generate Financial Dashboard for Tape Chart
  async generateTapeChartDashboard() {
    try {
      // Get current room status summary
      const roomSummary = await Room.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get today's bookings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayBookings = await Booking.find({
        checkInDate: { $gte: today, $lt: tomorrow },
        status: { $in: ['confirmed', 'checked_in'] }
      });

      const checkouts = await Booking.find({
        checkOut: { $gte: today, $lt: tomorrow },
        status: 'checked_in'
      });

      // Calculate reserved rooms from confirmed bookings
      const reservedRoomsCount = await Booking.aggregate([
        {
          $match: {
            status: 'confirmed',
            checkIn: { $gte: today },
            checkOut: { $gte: today }
          }
        },
        {
          $unwind: '$rooms'
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ]);

      const reservedCount = reservedRoomsCount[0]?.count || 0;

      // Room blocks
      const activeBlocks = await RoomBlock.countDocuments({
        status: 'active',
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
      });

      const blockedRooms = await RoomBlock.aggregate([
        {
          $match: {
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
          }
        },
        {
          $group: {
            _id: null,
            totalBlocked: { $sum: '$totalRooms' }
          }
        }
      ]);

      // Advanced reservations
      const vipReservations = await AdvancedReservation.countDocuments({
        'guestProfile.vipStatus': { $ne: 'none' }
      });

      const upgradesAvailable = await AdvancedReservation.countDocuments({
        upgrades: { $exists: true, $not: { $size: 0 } }
      });

      const specialRequests = await AdvancedReservation.aggregate([
        {
          $project: {
            requestCount: { $size: '$specialRequests' }
          }
        },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: '$requestCount' }
          }
        }
      ]);

      // Waitlist
      const waitlistCount = await AdvancedReservation.countDocuments({
        'waitlistInfo.waitlistPosition': { $exists: true, $ne: null }
      });

      // Calculate metrics with proper status mapping
      const summary = {
        totalRooms: roomSummary.reduce((sum, r) => sum + r.count, 0),
        availableRooms: roomSummary.find(r => r._id === 'vacant')?.count || 0,
        occupiedRooms: roomSummary.find(r => r._id === 'occupied')?.count || 0,
        reservedRooms: reservedCount,
        maintenanceRooms: (roomSummary.find(r => r._id === 'maintenance')?.count || 0) + (roomSummary.find(r => r._id === 'out_of_order')?.count || 0),
        dirtyRooms: roomSummary.find(r => r._id === 'dirty')?.count || 0,
        occupancyRate: 0,
        adr: await this.calculateADR(hotelId, new Date()),
        revpar: await this.calculateRevPAR(hotelId, new Date())
      };

      summary.occupancyRate = ((summary.occupiedRooms + summary.reservedRooms) / summary.totalRooms) * 100;

      return {
        summary,
        roomBlocks: {
          activeBlocks,
          blockedRooms: blockedRooms[0]?.totalBlocked || 0,
          upcomingReleases: await this.getUpcomingReleases(hotelId, new Date())
        },
        reservations: {
          totalReservations: todayBookings.length,
          vipReservations,
          upgradesAvailable,
          specialRequests: specialRequests[0]?.totalRequests || 0
        },
        waitlist: {
          totalOnWaitlist: waitlistCount,
          availableMatches: await this.getAvailableWaitlistMatches(hotelId, new Date())
        },
        alerts: [
          {
            type: 'maintenance',
            message: 'Rooms requiring maintenance attention',
            severity: 'warning',
            count: summary.maintenanceRooms
          },
          {
            type: 'checkout',
            message: 'Pending checkouts today',
            severity: 'info',
            count: checkouts.length
          }
        ].filter(alert => alert.count > 0),
        recentActivity: [
          {
            time: new Date().toLocaleTimeString(),
            action: 'Room Status Updated',
            details: 'Room 101 marked as clean',
            user: 'Housekeeping Staff'
          },
          {
            time: new Date(Date.now() - 300000).toLocaleTimeString(),
            action: 'Check-in Completed',
            details: 'Guest Smith checked into Room 205',
            user: 'Front Desk'
          },
          {
            time: new Date(Date.now() - 600000).toLocaleTimeString(),
            action: 'Room Assignment',
            details: 'VIP guest assigned to premium suite',
            user: 'Manager'
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to generate tape chart dashboard: ${error.message}`);
    }
  }

  // Bulk Operations
  async bulkUpdateRoomStatus(updates, userId) {
    try {
      const results = [];

      for (const update of updates) {
        try {
          const result = await this.updateRoomStatus(update.roomId, {
            status: update.status,
            notes: update.notes,
            changeReason: update.changeReason || 'bulk_update'
          }, userId);
          
          results.push({
            roomId: update.roomId,
            success: true,
            result
          });
        } catch (error) {
          results.push({
            roomId: update.roomId,
            success: false,
            error: error.message
          });
        }
      }

      return {
        processed: updates.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      throw new Error(`Failed to bulk update room status: ${error.message}`);
    }
  }

  async bulkRoomAssignment(assignments, userId) {
    try {
      const results = [];

      for (const assignment of assignments) {
        try {
          const result = await this.assignRoom(
            assignment.reservationId,
            {
              roomId: assignment.roomId,
              roomNumber: assignment.roomNumber,
              assignmentType: assignment.assignmentType || 'manual',
              notes: assignment.notes
            },
            userId
          );
          
          results.push({
            reservationId: assignment.reservationId,
            roomId: assignment.roomId,
            success: true,
            result
          });
        } catch (error) {
          results.push({
            reservationId: assignment.reservationId,
            roomId: assignment.roomId,
            success: false,
            error: error.message
          });
        }
      }

      return {
        processed: assignments.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      throw new Error(`Failed to bulk assign rooms: ${error.message}`);
    }
  }

  // Real-time Updates
  async getRoomStatusUpdates(since) {
    try {
      const sinceDate = since ? new Date(since) : new Date(Date.now() - 300000); // Last 5 minutes

      const updates = await RoomStatusHistory.find({
        createdAt: { $gte: sinceDate }
      })
      .populate('roomId', 'roomNumber roomType')
      .populate('changedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

      return {
        since: sinceDate,
        updates: updates.map(update => ({
          id: update._id,
          roomId: update.roomId._id,
          roomNumber: update.roomId.roomNumber,
          roomType: update.roomId.roomType,
          status: update.status,
          previousStatus: update.previousStatus,
          guestName: update.guestName,
          changedBy: update.changedBy?.name || 'System',
          changeReason: update.changeReason,
          timestamp: update.createdAt,
          notes: update.notes
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get room status updates: ${error.message}`);
    }
  }

  // Status mapping helper
  mapRoomStatusToTapeChart(roomStatus) {
    const statusMapping = {
      'vacant': 'available',
      'occupied': 'occupied',
      'dirty': 'dirty',
      'maintenance': 'maintenance',
      'out_of_order': 'out_of_order'
    };
    return statusMapping[roomStatus] || 'available';
  }

  // Real data inference helpers for tape chart visual features
  inferGuestGender(guestName) {
    if (!guestName) return null;
    
    // Basic name-based gender inference (could be enhanced with a proper service)
    const firstName = guestName.split(' ')[0].toLowerCase();
    const maleNames = ['john', 'mike', 'david', 'robert', 'james', 'william', 'richard', 'charles', 'joseph', 'thomas'];
    const femaleNames = ['mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'sarah', 'susan', 'jessica', 'nancy', 'karen'];
    
    if (maleNames.some(name => firstName.includes(name))) return 'male';
    if (femaleNames.some(name => firstName.includes(name))) return 'female';
    
    // Check for family indicators
    if (guestName.toLowerCase().includes('family') || guestName.toLowerCase().includes('&')) return 'family';
    
    return 'other'; // Default when uncertain
  }

  inferBookingType(booking) {
    // Determine booking type based on booking data
    if (booking.corporateBooking?.corporateCompanyId) return 'corporate';
    if (booking.source === 'booking_com' || booking.source === 'expedia') return 'travel_agent';
    if (booking.guestDetails?.adults > 6 || booking.nights > 7) return 'group';
    return 'individual';
  }

  calculateDemandLevel(date, allBookings) {
    // Calculate demand based on actual booking density for the date
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    const dayBookings = allBookings.filter(b => 
      new Date(b.checkIn) <= date && new Date(b.checkOut) > date
    );
    
    const occupancyRate = dayBookings.length / 100; // Assuming 100 rooms
    
    if (occupancyRate > 0.8) return 'high';
    if (occupancyRate > 0.6) return 'medium';
    return 'low';
  }

  calculateProfitabilityScore(room, date) {
    // Calculate profitability based on room rate vs base rate
    const baseRate = room.baseRate || 10000;
    const currentRate = room.currentRate || baseRate;
    const rateRatio = currentRate / baseRate;
    
    // Weekend bonus
    const dayOfWeek = date.getDay();
    const weekendBonus = (dayOfWeek === 0 || dayOfWeek === 6) ? 10 : 0;
    
    return Math.min(100, Math.floor(rateRatio * 80) + weekendBonus);
  }

  calculateRecommendedRate(room, date) {
    const baseRate = room.baseRate || 10000;
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Weekend premium
    const weekendMultiplier = isWeekend ? 1.2 : 1.0;
    return Math.floor(baseRate * weekendMultiplier);
  }

  determineVipStatus(booking) {
    // Determine VIP status based on booking value and type
    if (booking.corporateBooking?.corporateCompanyId) return 'corporate';
    if (booking.totalAmount > 25000) return 'svip';
    if (booking.totalAmount > 15000) return 'vip';
    return 'none';
  }

  extractGuestPreferences(booking) {
    // Extract preferences from booking special requests
    const specialRequests = booking.guestDetails?.specialRequests || '';
    return {
      roomTemp: specialRequests.includes('temperature') ? 22 : null,
      pillow: specialRequests.includes('pillow') ? 'soft' : null,
      wakeUpCall: specialRequests.includes('wake') || specialRequests.includes('call'),
      newspaper: specialRequests.includes('newspaper') || specialRequests.includes('paper')
    };
  }

  // Dashboard Data Generation
  async generateTapeChartDashboard(hotelId) {
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      // Get all rooms for the hotel
      const rooms = await Room.find({ hotelId, isActive: true });

      // Get today's bookings
      const bookings = await Booking.find({
        hotelId,
        $or: [
          { checkIn: { $lte: endOfDay }, checkOut: { $gte: startOfDay } },
          { status: { $in: ['confirmed', 'checked_in'] } }
        ]
      }).populate('rooms.roomId');

      // Calculate room statistics
      const totalRooms = rooms.length;
      const roomsByStatus = rooms.reduce((acc, room) => {
        acc[room.status] = (acc[room.status] || 0) + 1;
        return acc;
      }, {});

      const occupiedRooms = roomsByStatus.occupied || 0;
      const availableRooms = roomsByStatus.vacant || 0;
      const maintenanceRooms = roomsByStatus.maintenance || 0;
      const dirtyRooms = roomsByStatus.dirty || 0;
      const blockedRooms = roomsByStatus.blocked || 0;

      const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

      // Calculate revenue metrics
      const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
      const totalRoomNights = bookings.reduce((sum, booking) => sum + (booking.nights || 0), 0);
      const adr = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;
      const revpar = totalRooms > 0 ? totalRevenue / totalRooms : 0;

      // Get room blocks
      const roomBlocks = await RoomBlock.find({
        hotelId,
        status: 'active',
        startDate: { $lte: endOfDay },
        endDate: { $gte: startOfDay }
      });

      // Reservation statistics
      const reservationsToday = bookings.filter(b =>
        new Date(b.checkIn).toDateString() === today.toDateString()
      );

      const vipReservations = bookings.filter(b =>
        b.guestDetails?.vipStatus || b.totalAmount > 20000
      );

      // Generate alerts
      const alerts = [];
      if (occupancyRate > 90) {
        alerts.push({
          type: 'occupancy',
          message: 'High occupancy rate - consider overbooking management',
          severity: 'warning',
          count: 1
        });
      }
      if (maintenanceRooms > totalRooms * 0.1) {
        alerts.push({
          type: 'maintenance',
          message: `${maintenanceRooms} rooms under maintenance`,
          severity: 'info',
          count: maintenanceRooms
        });
      }
      if (dirtyRooms > 5) {
        alerts.push({
          type: 'housekeeping',
          message: `${dirtyRooms} rooms need cleaning`,
          severity: 'warning',
          count: dirtyRooms
        });
      }

      // Recent activity from real data sources
      const recentActivity = await this.getRecentActivity(hotelId);

      return {
        summary: {
          totalRooms,
          availableRooms,
          occupiedRooms,
          reservedRooms: bookings.filter(b => b.status === 'confirmed').length,
          maintenanceRooms,
          dirtyRooms,
          occupancyRate: Math.round(occupancyRate * 100) / 100,
          adr: Math.round(adr),
          revpar: Math.round(revpar)
        },
        roomBlocks: {
          activeBlocks: roomBlocks.length,
          blockedRooms,
          upcomingReleases: roomBlocks.filter(block =>
            new Date(block.endDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000)
          ).length
        },
        reservations: {
          totalReservations: bookings.length,
          vipReservations: vipReservations.length,
          upgradesAvailable: await this.getAvailableUpgrades(hotelId, new Date()),
          specialRequests: bookings.filter(b => b.specialRequests?.length > 0).length
        },
        waitlist: {
          totalOnWaitlist: await this.getWaitlistCount(hotelId),
          availableMatches: await this.getAvailableWaitlistMatches(hotelId, new Date())
        },
        alerts,
        recentActivity
      };

    } catch (error) {
      console.error('Error generating dashboard data:', error);
      throw error;
    }
  }

  // Helper methods for real data calculations
  async getUpcomingReleases(hotelId, date) {
    try {
      const sevenDaysFromNow = new Date(date);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Count room blocks that will be released in the next 7 days
      const { RoomBlock } = TapeChart;
      const upcomingReleases = await RoomBlock.countDocuments({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        releaseDate: { $gte: date, $lte: sevenDaysFromNow },
        status: 'active'
      });

      return upcomingReleases;
    } catch (error) {
      console.error('Error getting upcoming releases:', error);
      return 0;
    }
  }

  async getWaitlistCount(hotelId) {
    try {
      const count = await WaitingList.countDocuments({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        status: { $in: ['waiting', 'active'] }
      });
      return count;
    } catch (error) {
      console.error('Error getting waitlist count:', error);
      return 0;
    }
  }

  async getAvailableWaitlistMatches(hotelId, date) {
    try {
      // Get available rooms for the requested dates
      const waitlistEntries = await WaitingList.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        status: { $in: ['waiting', 'active'] }
      });

      let matches = 0;
      for (const entry of waitlistEntries) {
        // Check if there are available rooms for their preferred dates
        const availableRooms = await Room.countDocuments({
          hotelId: new mongoose.Types.ObjectId(hotelId),
          roomType: entry.roomType,
          status: 'available'
        });

        if (availableRooms > 0) {
          matches++;
        }
      }

      return matches;
    } catch (error) {
      console.error('Error getting available waitlist matches:', error);
      return 0;
    }
  }

  async getAvailableUpgrades(hotelId, date) {
    try {
      // Get current bookings for today that could be upgraded
      const todayBookings = await Booking.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        checkIn: { $lte: date },
        checkOut: { $gt: date },
        status: { $in: ['confirmed', 'checked_in'] }
      }).populate('roomId', 'roomType');

      // Get available higher-tier rooms for upgrades
      const availableUpgradeRooms = await Room.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        status: 'available'
      });

      let upgradeCount = 0;
      for (const booking of todayBookings) {
        const currentRoomType = booking.roomId?.roomType;

        // Check if there are available rooms of higher tier
        const upgradeAvailable = availableUpgradeRooms.some(room => {
          return this.isUpgrade(currentRoomType, room.roomType);
        });

        if (upgradeAvailable) {
          upgradeCount++;
        }
      }

      return upgradeCount;
    } catch (error) {
      console.error('Error getting available upgrades:', error);
      return 0;
    }
  }

  // Helper method to determine if one room type is an upgrade from another
  isUpgrade(currentType, newType) {
    const hierarchy = {
      'Standard Room': 1,
      'Deluxe Room': 2,
      'Executive Room': 3,
      'Deluxe Suite': 4,
      'Presidential Suite': 5
    };

    return (hierarchy[newType] || 0) > (hierarchy[currentType] || 0);
  }

  async calculateADR(hotelId, date) {
    try {
      // Average Daily Rate calculation - total room revenue / occupied rooms
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      const bookings = await Booking.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        checkIn: { $lte: endDate },
        checkOut: { $gt: startDate },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      });

      if (bookings.length === 0) return 0;

      const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
      const totalRoomNights = bookings.reduce((sum, booking) => sum + (booking.nights || 1), 0);

      return totalRoomNights > 0 ? Math.round((totalRevenue / totalRoomNights) * 100) / 100 : 0;
    } catch (error) {
      console.error('Error calculating ADR:', error);
      return 0;
    }
  }

  async calculateRevPAR(hotelId, date) {
    try {
      // Revenue Per Available Room - total room revenue / total available rooms
      const adr = await this.calculateADR(hotelId, date);

      const totalRooms = await Room.countDocuments({
        hotelId: new mongoose.Types.ObjectId(hotelId)
      });

      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      const occupiedRooms = await Booking.countDocuments({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        checkIn: { $lte: endDate },
        checkOut: { $gt: startDate },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      });

      const occupancyRate = totalRooms > 0 ? occupiedRooms / totalRooms : 0;
      return Math.round(adr * occupancyRate * 100) / 100;
    } catch (error) {
      console.error('Error calculating RevPAR:', error);
      return 0;
    }
  }

  async getRecentActivity(hotelId) {
    try {
      // Get recent bookings and room status changes
      const recentBookings = await Booking.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        createdAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } // Last 2 hours
      }).sort({ createdAt: -1 }).limit(5).populate('userId', 'username email');

      const activities = [];

      for (const booking of recentBookings) {
        activities.push({
          time: booking.createdAt.toISOString(),
          action: 'New Booking',
          details: `Booking ${booking.bookingId || booking._id} created${booking.roomNumber ? ` for room ${booking.roomNumber}` : ''}`,
          user: booking.userId?.username || booking.userId?.email || 'Guest'
        });
      }

      // Add fallback if no recent activity
      if (activities.length === 0) {
        activities.push({
          time: new Date().toISOString(),
          action: 'System Status',
          details: 'No recent activity in the last 2 hours',
          user: 'System'
        });
      }

      return activities.slice(0, 3); // Return top 3 activities
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return [{
        time: new Date().toISOString(),
        action: 'System Status',
        details: 'Unable to load recent activity',
        user: 'System'
      }];
    }
  }
}

export default TapeChartService;