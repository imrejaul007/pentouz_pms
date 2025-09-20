import TapeChartService from '../services/tapeChartService.js';

const tapeChartService = new TapeChartService();

class TapeChartController {
  // Room Configuration Management
  async createRoomConfiguration(req, res) {
    try {
      const config = await tapeChartService.createRoomConfiguration(req.body);
      res.status(201).json({ success: true, data: config });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getRoomConfigurations(req, res) {
    try {
      const { floor, building, wing, isActive } = req.query;
      const filters = {};
      
      if (floor) filters.floor = parseInt(floor);
      if (building) filters.building = building;
      if (wing) filters.wing = wing;
      if (isActive !== undefined) filters.isActive = isActive === 'true';

      const configs = await tapeChartService.getRoomConfigurations(filters);
      res.json({ success: true, data: configs });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateRoomConfiguration(req, res) {
    try {
      const config = await tapeChartService.updateRoomConfiguration(req.params.id, req.body);
      if (!config) {
        return res.status(404).json({ success: false, message: 'Configuration not found' });
      }
      res.json({ success: true, data: config });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteRoomConfiguration(req, res) {
    try {
      const config = await tapeChartService.updateRoomConfiguration(req.params.id, { isActive: false });
      res.json({ success: true, message: 'Configuration deactivated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Room Status Management
  async updateRoomStatus(req, res) {
    try {
      const { roomId } = req.params;
      const result = await tapeChartService.updateRoomStatus(roomId, req.body, req.user.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getRoomStatusHistory(req, res) {
    try {
      const { roomId } = req.params;
      const { startDate, endDate } = req.query;

      const dateRange = {};
      if (startDate) dateRange.startDate = startDate;
      if (endDate) dateRange.endDate = endDate;

      const history = await tapeChartService.getRoomStatusHistory(roomId, dateRange);
      res.json({ success: true, data: history });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getAvailableRooms(req, res) {
    try {
      const hotelId = req.user.hotelId;
      const { checkIn, checkOut, roomType, floor, guestCount } = req.query;

      const filters = {
        checkIn,
        checkOut,
        roomType,
        floor: floor ? parseInt(floor) : undefined,
        guestCount: guestCount ? parseInt(guestCount) : undefined
      };

      const availableRooms = await tapeChartService.getAvailableRooms(hotelId, filters);
      res.json({ success: true, data: availableRooms });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Room Block Management
  async createRoomBlock(req, res) {
    try {
      const block = await tapeChartService.createRoomBlock(req.body, req.user.id);
      res.status(201).json({ success: true, data: block });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getRoomBlocks(req, res) {
    try {
      const { status, eventType, startDate, endDate } = req.query;
      const filters = {};
      
      if (status) filters.status = status;
      if (eventType) filters.eventType = eventType;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const blocks = await tapeChartService.getRoomBlocks(filters);
      res.json({ success: true, data: blocks });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getRoomBlock(req, res) {
    try {
      const blocks = await tapeChartService.getRoomBlocks({ _id: req.params.id });
      if (blocks.length === 0) {
        return res.status(404).json({ success: false, message: 'Room block not found' });
      }
      res.json({ success: true, data: blocks[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateRoomBlock(req, res) {
    try {
      const block = await tapeChartService.updateRoomBlock(req.params.id, req.body);
      if (!block) {
        return res.status(404).json({ success: false, message: 'Room block not found' });
      }
      res.json({ success: true, data: block });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async releaseRoomBlock(req, res) {
    try {
      const block = await tapeChartService.releaseRoomBlock(req.params.id, req.user.id);
      res.json({ success: true, data: block });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Advanced Reservation Management
  async createAdvancedReservation(req, res) {
    try {
      const reservation = await tapeChartService.createAdvancedReservation(req.body);
      res.status(201).json({ success: true, data: reservation });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getAdvancedReservations(req, res) {
    try {
      const { reservationType, priority, vipStatus } = req.query;
      const filters = {};
      
      if (reservationType) filters.reservationType = reservationType;
      if (priority) filters.priority = priority;
      if (vipStatus) filters.vipStatus = vipStatus;

      const reservations = await tapeChartService.getAdvancedReservations(filters);
      res.json({ success: true, data: reservations });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getAdvancedReservation(req, res) {
    try {
      const reservations = await tapeChartService.getAdvancedReservations({ _id: req.params.id });
      if (reservations.length === 0) {
        return res.status(404).json({ success: false, message: 'Reservation not found' });
      }
      res.json({ success: true, data: reservations[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async assignRoom(req, res) {
    try {
      const { reservationId } = req.params;
      const reservation = await tapeChartService.assignRoom(reservationId, req.body, req.user.id);
      res.json({ success: true, data: reservation });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async autoAssignRooms(req, res) {
    try {
      const { reservationId } = req.params;
      const room = await tapeChartService.autoAssignRooms(reservationId);
      res.json({ success: true, data: room });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async processUpgrade(req, res) {
    try {
      const { reservationId } = req.params;
      const reservation = await tapeChartService.processUpgrade(reservationId, req.body, req.user.id);
      res.json({ success: true, data: reservation });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Tape Chart View Management
  async createTapeChartView(req, res) {
    try {
      const view = await tapeChartService.createTapeChartView(req.body, req.user.id);
      res.status(201).json({ success: true, data: view });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getTapeChartViews(req, res) {
    try {
      const views = await tapeChartService.getTapeChartViews(req.user.id);
      res.json({ success: true, data: views });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateTapeChartView(req, res) {
    try {
      const view = await tapeChartService.updateTapeChartView(req.params.id, req.body);
      if (!view) {
        return res.status(404).json({ success: false, message: 'View not found' });
      }
      res.json({ success: true, data: view });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteTapeChartView(req, res) {
    try {
      await tapeChartService.deleteTapeChartView(req.params.id);
      res.json({ success: true, message: 'View deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Generate Tape Chart Data
  async generateTapeChartData(req, res) {
    try {
      const { viewId, startDate, endDate } = req.query;
      
      if (!viewId || !startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'viewId, startDate, and endDate are required' 
        });
      }

      const chartData = await tapeChartService.generateTapeChartData(
        viewId, 
        { startDate, endDate }
      );
      
      res.json({ success: true, data: chartData });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Room Assignment Rules
  async createAssignmentRule(req, res) {
    try {
      const rule = await tapeChartService.createAssignmentRule(req.body, req.user.id);
      res.status(201).json({ success: true, data: rule });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getAssignmentRules(req, res) {
    try {
      const { isActive } = req.query;
      const filters = {};
      if (isActive !== undefined) filters.isActive = isActive === 'true';

      const rules = await tapeChartService.getAssignmentRules(filters);
      res.json({ success: true, data: rules });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateAssignmentRule(req, res) {
    try {
      const rule = await tapeChartService.updateAssignmentRule(req.params.id, {
        ...req.body,
        lastModifiedBy: req.user.id
      });
      if (!rule) {
        return res.status(404).json({ success: false, message: 'Rule not found' });
      }
      res.json({ success: true, data: rule });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteAssignmentRule(req, res) {
    try {
      const rule = await tapeChartService.updateAssignmentRule(req.params.id, { isActive: false });
      res.json({ success: true, message: 'Rule deactivated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Waitlist Management
  async addToWaitlist(req, res) {
    try {
      const { reservationId } = req.params;
      const reservation = await tapeChartService.addToWaitlist(reservationId, req.body);
      res.json({ success: true, data: reservation });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async processWaitlist(req, res) {
    try {
      const processed = await tapeChartService.processWaitlist();
      res.json({ success: true, data: processed });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getWaitlist(req, res) {
    try {
      const reservations = await tapeChartService.getAdvancedReservations({
        'waitlistInfo.waitlistPosition': { $exists: true, $ne: null }
      });
      res.json({ success: true, data: reservations });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Analytics and Reporting
  async getOccupancyReport(req, res) {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'startDate and endDate are required' 
        });
      }

      const report = await tapeChartService.generateOccupancyReport(
        { startDate, endDate },
        groupBy
      );
      
      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getRoomUtilizationStats(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const stats = await tapeChartService.getRoomUtilizationStats({ startDate, endDate });
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getRevenueByRoomType(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const revenue = await tapeChartService.getRevenueByRoomType({ startDate, endDate });
      res.json({ success: true, data: revenue });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Dashboard Data
  async getTapeChartDashboard(req, res) {
    try {
      const hotelId = req.user.hotelId;
      const dashboard = await tapeChartService.generateTapeChartDashboard(hotelId);
      res.json({ success: true, data: dashboard });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Real-time Updates
  async getRoomStatusUpdates(req, res) {
    try {
      const { since } = req.query;
      const updates = await tapeChartService.getRoomStatusUpdates(since);
      res.json({ success: true, data: updates });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Bulk Operations
  async bulkUpdateRoomStatus(req, res) {
    try {
      const { updates } = req.body;
      const results = await tapeChartService.bulkUpdateRoomStatus(updates, req.user.id);
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async bulkRoomAssignment(req, res) {
    try {
      const { assignments } = req.body;
      const results = await tapeChartService.bulkRoomAssignment(assignments, req.user.id);
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

export default new TapeChartController();
