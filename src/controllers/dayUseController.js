import dayUseService from '../services/dayUseService.js';
import DayUseSlot from '../models/DayUseSlot.js';
import DayUseBooking from '../models/DayUseBooking.js';

class DayUseController {
  
  // Slot Management Endpoints
  
  /**
   * Create a new day use slot
   */
  async createSlot(req, res) {
    try {
      const slotData = {
        ...req.body,
        createdBy: req.user?.id
      };
      
      const slot = await dayUseService.createSlot(slotData);
      
      res.status(201).json({
        success: true,
        data: slot,
        message: 'Day use slot created successfully'
      });
      
    } catch (error) {
      console.error('Error creating day use slot:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get all slots with filtering
   */
  async getSlots(req, res) {
    try {
      const filters = {
        roomType: req.query.roomType,
        category: req.query.category,
        isAvailable: req.query.isAvailable === 'true',
        dayOfWeek: req.query.dayOfWeek
      };
      
      // Remove undefined values
      Object.keys(filters).forEach(key => 
        filters[key] === undefined && delete filters[key]
      );
      
      if (req.query.timeStart && req.query.timeEnd) {
        filters.timeRange = {
          start: req.query.timeStart,
          end: req.query.timeEnd
        };
      }
      
      const slots = await dayUseService.getSlots(filters);
      
      res.json({
        success: true,
        data: slots,
        count: slots.length
      });
      
    } catch (error) {
      console.error('Error getting slots:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get available slots for a specific date
   */
  async getAvailableSlots(req, res) {
    try {
      const { date } = req.params;
      const filters = {
        roomType: req.query.roomType,
        category: req.query.category
      };
      
      Object.keys(filters).forEach(key => 
        filters[key] === undefined && delete filters[key]
      );
      
      const slots = await dayUseService.getAvailableSlots(date, filters);
      
      res.json({
        success: true,
        data: slots,
        count: slots.length,
        date: date
      });
      
    } catch (error) {
      console.error('Error getting available slots:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get slot by ID
   */
  async getSlotById(req, res) {
    try {
      const { id } = req.params;
      
      const slot = await DayUseSlot.findById(id)
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName');
      
      if (!slot) {
        return res.status(404).json({
          success: false,
          message: 'Slot not found'
        });
      }
      
      res.json({
        success: true,
        data: slot
      });
      
    } catch (error) {
      console.error('Error getting slot:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Update slot
   */
  async updateSlot(req, res) {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        updatedBy: req.user?.id
      };
      
      const slot = await dayUseService.updateSlot(id, updateData);
      
      res.json({
        success: true,
        data: slot,
        message: 'Slot updated successfully'
      });
      
    } catch (error) {
      console.error('Error updating slot:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Delete slot (soft delete)
   */
  async deleteSlot(req, res) {
    try {
      const { id } = req.params;
      
      const slot = await DayUseSlot.findByIdAndUpdate(
        id,
        { isActive: false, updatedBy: req.user?.id },
        { new: true }
      );
      
      if (!slot) {
        return res.status(404).json({
          success: false,
          message: 'Slot not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Slot deactivated successfully'
      });
      
    } catch (error) {
      console.error('Error deleting slot:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Check slot availability
   */
  async checkSlotAvailability(req, res) {
    try {
      const { slotId } = req.params;
      const { date } = req.query;
      
      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Date is required'
        });
      }
      
      const availability = await dayUseService.getSlotAvailability(slotId, date);
      
      res.json({
        success: true,
        data: availability
      });
      
    } catch (error) {
      console.error('Error checking slot availability:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Booking Management Endpoints
  
  /**
   * Create a new booking
   */
  async createBooking(req, res) {
    try {
      const bookingData = {
        ...req.body,
        createdBy: req.user?.id
      };
      
      // Set operational source if not provided
      if (!bookingData.operational) {
        bookingData.operational = {};
      }
      if (!bookingData.operational.source) {
        bookingData.operational.source = req.user?.role === 'guest' ? 'direct' : 'phone';
      }
      
      const booking = await dayUseService.createBooking(bookingData);
      
      res.status(201).json({
        success: true,
        data: booking,
        message: 'Day use booking created successfully'
      });
      
    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get bookings with filtering
   */
  async getBookings(req, res) {
    try {
      const {
        startDate,
        endDate,
        status,
        roomType,
        guestEmail,
        source,
        page = 1,
        limit = 20
      } = req.query;
      
      const query = {};
      
      if (startDate || endDate) {
        query['bookingDetails.bookingDate'] = {};
        if (startDate) query['bookingDetails.bookingDate'].$gte = new Date(startDate);
        if (endDate) query['bookingDetails.bookingDate'].$lte = new Date(endDate);
      }
      
      if (status) query['status.bookingStatus'] = status;
      if (roomType) query['bookingDetails.roomType'] = roomType;
      if (guestEmail) query['guestInfo.primaryGuest.email'] = new RegExp(guestEmail, 'i');
      if (source) query['operational.source'] = source;
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [bookings, totalCount] = await Promise.all([
        DayUseBooking.find(query)
          .populate('bookingDetails.slotId', 'slotName roomType timeSlot')
          .populate('guestInfo.primaryGuest.guestId', 'firstName lastName email phone')
          .populate('createdBy', 'firstName lastName')
          .sort({ 'timeline.bookedAt': -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        DayUseBooking.countDocuments(query)
      ]);
      
      res.json({
        success: true,
        data: {
          bookings,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalBookings: totalCount,
            hasMore: skip + bookings.length < totalCount
          }
        }
      });
      
    } catch (error) {
      console.error('Error getting bookings:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get booking by ID
   */
  async getBookingById(req, res) {
    try {
      const { id } = req.params;
      
      const booking = await DayUseBooking.findById(id)
        .populate('bookingDetails.slotId')
        .populate('guestInfo.primaryGuest.guestId', 'firstName lastName email phone')
        .populate('addOnServices.serviceId', 'name category')
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      res.json({
        success: true,
        data: booking
      });
      
    } catch (error) {
      console.error('Error getting booking:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Update booking
   */
  async updateBooking(req, res) {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        updatedBy: req.user?.id
      };
      
      const booking = await dayUseService.updateBooking(id, updateData);
      
      res.json({
        success: true,
        data: booking,
        message: 'Booking updated successfully'
      });
      
    } catch (error) {
      console.error('Error updating booking:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Cancel booking
   */
  async cancelBooking(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Cancellation reason is required'
        });
      }
      
      const result = await dayUseService.cancelBooking(id, reason, req.user?.id);
      
      res.json({
        success: true,
        data: result,
        message: result.message
      });
      
    } catch (error) {
      console.error('Error cancelling booking:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Check in booking
   */
  async checkInBooking(req, res) {
    try {
      const { id } = req.params;
      const { roomAssignment } = req.body;
      
      const booking = await dayUseService.checkInBooking(id, roomAssignment, req.user?.id);
      
      res.json({
        success: true,
        data: booking,
        message: 'Booking checked in successfully'
      });
      
    } catch (error) {
      console.error('Error checking in booking:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Check out booking
   */
  async checkOutBooking(req, res) {
    try {
      const { id } = req.params;
      
      const booking = await dayUseService.checkOutBooking(id, req.user?.id);
      
      res.json({
        success: true,
        data: booking,
        message: 'Booking checked out successfully'
      });
      
    } catch (error) {
      console.error('Error checking out booking:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Add note to booking
   */
  async addBookingNote(req, res) {
    try {
      const { id } = req.params;
      const { note, type = 'general' } = req.body;
      
      if (!note) {
        return res.status(400).json({
          success: false,
          message: 'Note content is required'
        });
      }
      
      const booking = await DayUseBooking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      await booking.addNote(note, req.user?.id, type);
      
      res.json({
        success: true,
        message: 'Note added successfully'
      });
      
    } catch (error) {
      console.error('Error adding booking note:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Analytics and Reporting Endpoints
  
  /**
   * Get slot performance analytics
   */
  async getSlotPerformance(req, res) {
    try {
      const { slotId } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }
      
      const dateRange = {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      };
      
      const performance = await dayUseService.getSlotPerformance(slotId, dateRange);
      
      res.json({
        success: true,
        data: performance
      });
      
    } catch (error) {
      console.error('Error getting slot performance:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get overall day use analytics
   */
  async getAnalytics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }
      
      const dateRange = {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      };
      
      const analytics = await dayUseService.getDayUseAnalytics(dateRange);
      
      res.json({
        success: true,
        data: analytics
      });
      
    } catch (error) {
      console.error('Error getting analytics:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get revenue report
   */
  async getRevenueReport(req, res) {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }
      
      const revenue = await DayUseBooking.getRevenueByDateRange(
        new Date(startDate),
        new Date(endDate)
      );
      
      res.json({
        success: true,
        data: {
          revenue,
          period: { startDate, endDate, groupBy }
        }
      });
      
    } catch (error) {
      console.error('Error getting revenue report:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get occupancy report
   */
  async getOccupancyReport(req, res) {
    try {
      const { date } = req.params;
      
      const occupancy = await DayUseBooking.getOccupancyBySlot(new Date(date));
      
      // Get slot details
      const slotIds = occupancy.map(item => item._id);
      const slots = await DayUseSlot.find({ _id: { $in: slotIds } })
        .select('slotId slotName roomType timeSlot capacity');
      
      // Combine data
      const report = occupancy.map(item => {
        const slot = slots.find(s => s._id.toString() === item._id.toString());
        return {
          slot: slot ? {
            slotId: slot.slotId,
            slotName: slot.slotName,
            roomType: slot.roomType,
            timeSlot: slot.timeSlot,
            maxCapacity: slot.capacity.maxGuests
          } : null,
          bookingCount: item.bookingCount,
          totalGuests: item.totalGuests,
          totalRevenue: item.totalRevenue,
          occupancyRate: slot ? Math.round((item.totalGuests / slot.capacity.maxGuests) * 100) : 0
        };
      });
      
      res.json({
        success: true,
        data: {
          date,
          occupancy: report
        }
      });
      
    } catch (error) {
      console.error('Error getting occupancy report:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Get today's schedule
   */
  async getTodaySchedule(req, res) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const bookings = await DayUseBooking.find({
        'bookingDetails.bookingDate': { $gte: today, $lt: tomorrow },
        'status.bookingStatus': { $nin: ['cancelled'] }
      })
      .populate('bookingDetails.slotId', 'slotName roomType timeSlot')
      .populate('guestInfo.primaryGuest.guestId', 'firstName lastName')
      .sort({ 'bookingDetails.timeSlot.startTime': 1 });
      
      const schedule = bookings.map(booking => ({
        bookingId: booking.bookingId,
        guestName: `${booking.guestInfo.primaryGuest.firstName} ${booking.guestInfo.primaryGuest.lastName}`,
        slotName: booking.bookingDetails.slotId.slotName,
        roomType: booking.bookingDetails.roomType,
        timeSlot: booking.bookingDetails.timeSlot,
        guestCount: booking.guestInfo.totalGuests,
        status: booking.status.bookingStatus,
        checkInTime: booking.timeline.checkedInAt,
        checkOutTime: booking.timeline.checkedOutAt
      }));
      
      res.json({
        success: true,
        data: {
          date: today.toDateString(),
          totalBookings: schedule.length,
          schedule
        }
      });
      
    } catch (error) {
      console.error('Error getting today\'s schedule:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new DayUseController();
