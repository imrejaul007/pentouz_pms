import DayUseSlot from '../models/DayUseSlot.js';
import DayUseBooking from '../models/DayUseBooking.js';
import seasonalPricingService from './seasonalPricingService.js';
import addOnService from './addOnService.js';
import mongoose from 'mongoose';

class DayUseService {
  
  // Slot Management
  
  async createSlot(slotData) {
    try {
      // Validate time slot format and duration
      this.validateTimeSlot(slotData.timeSlot);
      
      // Check for overlapping slots for the same room type
      const overlapping = await this.checkSlotOverlap(
        slotData.roomType,
        slotData.timeSlot.startTime,
        slotData.timeSlot.endTime,
        slotData.operationalDays
      );
      
      if (overlapping.length > 0) {
        throw new Error(`Overlapping slot found: ${overlapping[0].slotName}`);
      }
      
      // Generate unique slot ID
      slotData.slotId = `${slotData.roomType.replace(/\s+/g, '_').toUpperCase()}_${slotData.timeSlot.startTime.replace(':', '')}_${Date.now()}`;
      
      const slot = new DayUseSlot(slotData);
      await slot.save();
      
      return slot;
    } catch (error) {
      throw new Error(`Failed to create slot: ${error.message}`);
    }
  }
  
  async updateSlot(slotId, updateData) {
    try {
      const slot = await DayUseSlot.findById(slotId);
      if (!slot) {
        throw new Error('Slot not found');
      }
      
      // Check if updating time slot
      if (updateData.timeSlot) {
        this.validateTimeSlot(updateData.timeSlot);
        
        // Check for future bookings if changing time
        const futureBookings = await this.getFutureBookingsForSlot(slotId);
        if (futureBookings.length > 0) {
          throw new Error('Cannot modify slot time - existing future bookings');
        }
      }
      
      Object.assign(slot, updateData);
      slot.updatedBy = updateData.updatedBy;
      
      await slot.save();
      return slot;
    } catch (error) {
      throw new Error(`Failed to update slot: ${error.message}`);
    }
  }
  
  async getSlots(filters = {}) {
    try {
      const query = { isActive: true };
      
      if (filters.roomType) query.roomType = filters.roomType;
      if (filters.category) query.category = filters.category;
      if (filters.isAvailable !== undefined) query['availability.isAvailable'] = filters.isAvailable;
      
      // Filter by operational days
      if (filters.dayOfWeek) {
        const dayIndex = this.getDayIndex(filters.dayOfWeek);
        query[`operationalDays.${dayIndex}.enabled`] = true;
      }
      
      // Filter by time range
      if (filters.timeRange) {
        const { start, end } = filters.timeRange;
        query.$and = [
          { 'timeSlot.startTime': { $gte: start } },
          { 'timeSlot.endTime': { $lte: end } }
        ];
      }
      
      const slots = await DayUseSlot.find(query)
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName')
        .sort({ 'timeSlot.startTime': 1, roomType: 1 });
      
      return slots;
    } catch (error) {
      throw new Error(`Failed to get slots: ${error.message}`);
    }
  }
  
  async getAvailableSlots(date, filters = {}) {
    try {
      const dayOfWeek = new Date(date).getDay();
      const slots = await this.getSlots({
        ...filters,
        isAvailable: true
      });
      
      // Filter by operational day
      const availableSlots = slots.filter(slot => {
        return slot.operationalDays[dayOfWeek]?.enabled;
      });
      
      // Check availability against existing bookings
      const slotsWithAvailability = await Promise.all(
        availableSlots.map(async slot => {
          const availability = await this.getSlotAvailability(slot._id, date);
          return {
            ...slot.toJSON(),
            availability
          };
        })
      );
      
      return slotsWithAvailability.filter(slot => slot.availability.isAvailable);
    } catch (error) {
      throw new Error(`Failed to get available slots: ${error.message}`);
    }
  }
  
  async getSlotAvailability(slotId, date) {
    try {
      const slot = await DayUseSlot.findById(slotId);
      if (!slot) {
        throw new Error('Slot not found');
      }
      
      // Get existing bookings for this slot and date
      const bookings = await DayUseBooking.find({
        'bookingDetails.slotId': slotId,
        'bookingDetails.bookingDate': new Date(date),
        'status.bookingStatus': { $nin: ['cancelled', 'no_show'] }
      });
      
      const totalBooked = bookings.reduce((sum, booking) => sum + booking.guestInfo.totalGuests, 0);
      const availableCapacity = Math.max(0, slot.capacity.maxGuests - totalBooked);
      
      // Calculate dynamic pricing
      const occupancyRate = totalBooked / slot.capacity.maxGuests;
      const pricing = this.calculateSlotPricing(slot, date, occupancyRate);
      
      return {
        isAvailable: availableCapacity > 0,
        availableCapacity,
        totalCapacity: slot.capacity.maxGuests,
        occupancyRate: Math.round(occupancyRate * 100),
        currentBookings: bookings.length,
        pricing,
        restrictions: slot.restrictions,
        inclusions: slot.inclusions
      };
    } catch (error) {
      throw new Error(`Failed to get slot availability: ${error.message}`);
    }
  }
  
  // Booking Management
  
  async createBooking(bookingData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Validate slot availability
      const availability = await this.getSlotAvailability(
        bookingData.bookingDetails.slotId,
        bookingData.bookingDetails.bookingDate
      );
      
      if (!availability.isAvailable) {
        throw new Error('Slot not available');
      }
      
      if (bookingData.guestInfo.totalGuests > availability.availableCapacity) {
        throw new Error(`Insufficient capacity. Available: ${availability.availableCapacity}`);
      }
      
      // Get slot details
      const slot = await DayUseSlot.findById(bookingData.bookingDetails.slotId).session(session);
      
      // Calculate pricing
      const pricing = await this.calculateBookingPricing(bookingData, slot);
      bookingData.pricing = pricing;
      
      // Set time slot details
      bookingData.bookingDetails.timeSlot = {
        startTime: slot.timeSlot.startTime,
        endTime: slot.timeSlot.endTime,
        duration: slot.timeSlot.duration
      };
      
      // Create booking
      const booking = new DayUseBooking(bookingData);
      await booking.save({ session });
      
      // Update slot analytics
      await this.updateSlotAnalytics(slot._id, {
        totalBookings: 1,
        totalRevenue: pricing.totalAmount,
        averageGuestCount: bookingData.guestInfo.totalGuests
      }, session);
      
      await session.commitTransaction();
      
      // Populate and return
      await booking.populate([
        { path: 'bookingDetails.slotId', select: 'slotName roomType timeSlot' },
        { path: 'guestInfo.primaryGuest.guestId', select: 'firstName lastName email phone' }
      ]);
      
      return booking;
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to create booking: ${error.message}`);
    } finally {
      session.endSession();
    }
  }
  
  async updateBooking(bookingId, updateData) {
    try {
      const booking = await DayUseBooking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      // Check if booking can be modified
      if (!booking.canModify) {
        throw new Error('Booking cannot be modified at this time');
      }
      
      // Handle slot change
      if (updateData.bookingDetails?.slotId && 
          updateData.bookingDetails.slotId !== booking.bookingDetails.slotId.toString()) {
        
        const availability = await this.getSlotAvailability(
          updateData.bookingDetails.slotId,
          updateData.bookingDetails.bookingDate
        );
        
        if (!availability.isAvailable) {
          throw new Error('New slot not available');
        }
      }
      
      // Recalculate pricing if necessary
      if (updateData.guestInfo?.totalGuests || updateData.bookingDetails?.slotId) {
        const slot = await DayUseSlot.findById(
          updateData.bookingDetails?.slotId || booking.bookingDetails.slotId
        );
        const pricing = await this.calculateBookingPricing(
          { ...booking.toObject(), ...updateData },
          slot
        );
        updateData.pricing = pricing;
      }
      
      Object.assign(booking, updateData);
      booking.updatedBy = updateData.updatedBy;
      
      await booking.save();
      return booking;
    } catch (error) {
      throw new Error(`Failed to update booking: ${error.message}`);
    }
  }
  
  async cancelBooking(bookingId, reason, staffId) {
    try {
      const booking = await DayUseBooking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (!booking.canCancel) {
        throw new Error('Booking cannot be cancelled');
      }
      
      // Calculate refund
      const refundAmount = booking.calculateRefund();
      
      // Update booking status
      await booking.updateStatus('cancelled');
      
      // Add cancellation note
      await booking.addNote(`Cancelled: ${reason}. Refund: $${refundAmount}`, staffId, 'operational');
      
      // Process refund if applicable
      if (refundAmount > 0) {
        booking.payment.refunds.push({
          amount: refundAmount,
          reason: reason,
          processedDate: new Date(),
          status: 'processing'
        });
        await booking.save();
      }
      
      return {
        booking,
        refundAmount,
        message: 'Booking cancelled successfully'
      };
    } catch (error) {
      throw new Error(`Failed to cancel booking: ${error.message}`);
    }
  }
  
  async checkInBooking(bookingId, roomAssignment, staffId) {
    try {
      const booking = await DayUseBooking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (booking.status.bookingStatus !== 'confirmed') {
        throw new Error('Booking must be confirmed before check-in');
      }
      
      // Validate check-in time
      const now = new Date();
      const bookingDate = new Date(booking.bookingDetails.bookingDate);
      const [hours, minutes] = booking.bookingDetails.timeSlot.startTime.split(':');
      const checkInTime = new Date(bookingDate);
      checkInTime.setHours(parseInt(hours), parseInt(minutes));
      
      // Allow check-in 30 minutes early
      const earlyCheckIn = new Date(checkInTime.getTime() - 30 * 60000);
      
      if (now < earlyCheckIn) {
        throw new Error('Too early for check-in');
      }
      
      // Assign room
      if (roomAssignment) {
        booking.bookingDetails.assignedRooms = roomAssignment;
      }
      
      // Process check-in
      await booking.processCheckIn();
      
      // Add note
      await booking.addNote(`Checked in by ${staffId}`, staffId, 'operational');
      
      return booking;
    } catch (error) {
      throw new Error(`Failed to check in booking: ${error.message}`);
    }
  }
  
  async checkOutBooking(bookingId, staffId) {
    try {
      const booking = await DayUseBooking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (booking.status.bookingStatus !== 'checked_in' && booking.status.bookingStatus !== 'in_use') {
        throw new Error('Booking must be checked in before check-out');
      }
      
      // Process check-out
      await booking.processCheckOut();
      
      // Add note
      await booking.addNote(`Checked out by ${staffId}`, staffId, 'operational');
      
      return booking;
    } catch (error) {
      throw new Error(`Failed to check out booking: ${error.message}`);
    }
  }
  
  // Analytics and Reporting
  
  async getSlotPerformance(slotId, dateRange) {
    try {
      const { startDate, endDate } = dateRange;
      
      const bookings = await DayUseBooking.find({
        'bookingDetails.slotId': slotId,
        'bookingDetails.bookingDate': { $gte: startDate, $lte: endDate },
        'status.bookingStatus': { $nin: ['cancelled'] }
      });
      
      const slot = await DayUseSlot.findById(slotId);
      
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const totalCapacity = slot.capacity.maxGuests * totalDays;
      const totalGuests = bookings.reduce((sum, b) => sum + b.guestInfo.totalGuests, 0);
      const totalRevenue = bookings.reduce((sum, b) => sum + b.pricing.totalAmount, 0);
      
      return {
        slotInfo: {
          slotId: slot.slotId,
          slotName: slot.slotName,
          roomType: slot.roomType,
          timeSlot: slot.timeSlot
        },
        performance: {
          totalBookings: bookings.length,
          totalGuests,
          totalRevenue,
          occupancyRate: Math.round((totalGuests / totalCapacity) * 100),
          averageRevenuePerBooking: bookings.length > 0 ? totalRevenue / bookings.length : 0,
          averageGuestsPerBooking: bookings.length > 0 ? totalGuests / bookings.length : 0
        },
        trends: await this.calculateSlotTrends(slotId, startDate, endDate)
      };
    } catch (error) {
      throw new Error(`Failed to get slot performance: ${error.message}`);
    }
  }
  
  async getDayUseAnalytics(dateRange) {
    try {
      const { startDate, endDate } = dateRange;
      
      const [bookings, slots] = await Promise.all([
        DayUseBooking.find({
          'bookingDetails.bookingDate': { $gte: startDate, $lte: endDate }
        }),
        DayUseSlot.find({ isActive: true })
      ]);
      
      const analytics = {
        overview: {
          totalBookings: bookings.length,
          confirmedBookings: bookings.filter(b => b.status.bookingStatus === 'confirmed').length,
          cancelledBookings: bookings.filter(b => b.status.bookingStatus === 'cancelled').length,
          totalRevenue: bookings.reduce((sum, b) => sum + b.pricing.totalAmount, 0),
          totalGuests: bookings.reduce((sum, b) => sum + b.guestInfo.totalGuests, 0)
        },
        byRoomType: this.groupAnalyticsByRoomType(bookings),
        byTimeSlot: this.groupAnalyticsByTimeSlot(bookings),
        bySource: this.groupAnalyticsBySource(bookings),
        trends: await this.calculateOverallTrends(startDate, endDate)
      };
      
      return analytics;
    } catch (error) {
      throw new Error(`Failed to get day use analytics: ${error.message}`);
    }
  }
  
  // Pricing Calculations
  
  async calculateBookingPricing(bookingData, slot) {
    try {
      const basePrice = slot.pricing.basePrice;
      const guestCount = bookingData.guestInfo.totalGuests;
      const bookingDate = new Date(bookingData.bookingDetails.bookingDate);
      
      let priceBreakdown = {
        slotPrice: basePrice,
        guestCharges: 0,
        seasonalAdjustment: 0,
        specialPeriodAdjustment: 0,
        addOnServices: 0,
        taxes: 0,
        discounts: 0
      };
      
      // Apply guest charges
      if (guestCount > slot.capacity.includedGuests) {
        const extraGuests = guestCount - slot.capacity.includedGuests;
        priceBreakdown.guestCharges = extraGuests * slot.pricing.perGuestCharge;
      }
      
      // Apply seasonal adjustments
      if (seasonalPricingService) {
        const seasonalAdjustment = await seasonalPricingService.calculateAdjustment(
          bookingDate,
          slot.roomType,
          basePrice
        );
        priceBreakdown.seasonalAdjustment = seasonalAdjustment;
      }
      
      // Apply dynamic pricing based on demand
      const occupancyRate = await this.getHistoricalOccupancy(slot._id, bookingDate);
      const demandMultiplier = this.calculateDemandMultiplier(occupancyRate);
      priceBreakdown.slotPrice = basePrice * demandMultiplier;
      
      // Calculate taxes (assuming 10% service tax)
      const subtotal = Object.values(priceBreakdown).reduce((sum, val) => sum + val, 0) - priceBreakdown.taxes;
      priceBreakdown.taxes = subtotal * 0.1;
      
      const totalAmount = Object.values(priceBreakdown).reduce((sum, val) => sum + val, 0);
      
      return {
        basePrice,
        priceBreakdown,
        totalAmount,
        currency: 'USD',
        paidAmount: 0,
        refundableAmount: totalAmount
      };
    } catch (error) {
      throw new Error(`Failed to calculate pricing: ${error.message}`);
    }
  }
  
  calculateSlotPricing(slot, date, occupancyRate) {
    const basePrice = slot.pricing.basePrice;
    const demandMultiplier = this.calculateDemandMultiplier(occupancyRate);
    const dynamicPrice = basePrice * demandMultiplier;
    
    return {
      basePrice,
      dynamicPrice,
      demandMultiplier,
      occupancyRate,
      priceChange: dynamicPrice - basePrice,
      priceChangePercent: Math.round(((dynamicPrice - basePrice) / basePrice) * 100)
    };
  }
  
  calculateDemandMultiplier(occupancyRate) {
    if (occupancyRate < 0.3) return 0.9;        // Low demand discount
    if (occupancyRate < 0.6) return 1.0;        // Normal pricing
    if (occupancyRate < 0.8) return 1.1;        // High demand premium
    return 1.2;                                  // Peak demand premium
  }
  
  // Helper Methods
  
  validateTimeSlot(timeSlot) {
    const { startTime, endTime, duration } = timeSlot;
    
    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      throw new Error('Invalid time format. Use HH:MM format.');
    }
    
    // Validate duration matches time difference
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startMinutesTotal = startHours * 60 + startMinutes;
    const endMinutesTotal = endHours * 60 + endMinutes;
    const calculatedDuration = endMinutesTotal - startMinutesTotal;
    
    if (calculatedDuration !== duration) {
      throw new Error('Duration does not match time slot difference');
    }
    
    if (duration < 60 || duration > 720) {
      throw new Error('Duration must be between 1 and 12 hours');
    }
  }
  
  async checkSlotOverlap(roomType, startTime, endTime, operationalDays) {
    const existingSlots = await DayUseSlot.find({
      roomType,
      isActive: true,
      $or: [
        {
          'timeSlot.startTime': { $lt: endTime },
          'timeSlot.endTime': { $gt: startTime }
        }
      ]
    });
    
    // Check if any operational days overlap
    return existingSlots.filter(slot => {
      for (let i = 0; i < 7; i++) {
        if (slot.operationalDays[i]?.enabled && operationalDays[i]?.enabled) {
          return true;
        }
      }
      return false;
    });
  }
  
  getDayIndex(dayName) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days.indexOf(dayName.toLowerCase());
  }
  
  async getFutureBookingsForSlot(slotId) {
    const today = new Date();
    return DayUseBooking.find({
      'bookingDetails.slotId': slotId,
      'bookingDetails.bookingDate': { $gte: today },
      'status.bookingStatus': { $nin: ['cancelled', 'no_show'] }
    });
  }
  
  async updateSlotAnalytics(slotId, updates, session = null) {
    const updateQuery = {};
    
    if (updates.totalBookings) {
      updateQuery['$inc'] = updateQuery['$inc'] || {};
      updateQuery['$inc']['analytics.totalBookings'] = updates.totalBookings;
    }
    
    if (updates.totalRevenue) {
      updateQuery['$inc'] = updateQuery['$inc'] || {};
      updateQuery['$inc']['analytics.totalRevenue'] = updates.totalRevenue;
    }
    
    const options = session ? { session } : {};
    return DayUseSlot.updateOne({ _id: slotId }, updateQuery, options);
  }
  
  async getHistoricalOccupancy(slotId, date) {
    // Get occupancy for the same day of week in the past 4 weeks
    const dayOfWeek = date.getDay();
    const pastDates = [];
    
    for (let i = 1; i <= 4; i++) {
      const pastDate = new Date(date);
      pastDate.setDate(pastDate.getDate() - (i * 7));
      pastDates.push(pastDate);
    }
    
    const bookings = await DayUseBooking.find({
      'bookingDetails.slotId': slotId,
      'bookingDetails.bookingDate': { $in: pastDates },
      'status.bookingStatus': { $nin: ['cancelled', 'no_show'] }
    });
    
    if (bookings.length === 0) return 0;
    
    const slot = await DayUseSlot.findById(slotId);
    const totalGuests = bookings.reduce((sum, b) => sum + b.guestInfo.totalGuests, 0);
    const totalCapacity = slot.capacity.maxGuests * pastDates.length;
    
    return totalGuests / totalCapacity;
  }
  
  groupAnalyticsByRoomType(bookings) {
    const grouped = {};
    bookings.forEach(booking => {
      const roomType = booking.bookingDetails.roomType;
      if (!grouped[roomType]) {
        grouped[roomType] = {
          totalBookings: 0,
          totalRevenue: 0,
          totalGuests: 0
        };
      }
      grouped[roomType].totalBookings++;
      grouped[roomType].totalRevenue += booking.pricing.totalAmount;
      grouped[roomType].totalGuests += booking.guestInfo.totalGuests;
    });
    return grouped;
  }
  
  groupAnalyticsByTimeSlot(bookings) {
    const grouped = {};
    bookings.forEach(booking => {
      const timeSlot = `${booking.bookingDetails.timeSlot.startTime}-${booking.bookingDetails.timeSlot.endTime}`;
      if (!grouped[timeSlot]) {
        grouped[timeSlot] = {
          totalBookings: 0,
          totalRevenue: 0,
          totalGuests: 0
        };
      }
      grouped[timeSlot].totalBookings++;
      grouped[timeSlot].totalRevenue += booking.pricing.totalAmount;
      grouped[timeSlot].totalGuests += booking.guestInfo.totalGuests;
    });
    return grouped;
  }
  
  groupAnalyticsBySource(bookings) {
    const grouped = {};
    bookings.forEach(booking => {
      const source = booking.operational.source;
      if (!grouped[source]) {
        grouped[source] = {
          totalBookings: 0,
          totalRevenue: 0,
          totalGuests: 0
        };
      }
      grouped[source].totalBookings++;
      grouped[source].totalRevenue += booking.pricing.totalAmount;
      grouped[source].totalGuests += booking.guestInfo.totalGuests;
    });
    return grouped;
  }
  
  async calculateSlotTrends(slotId, startDate, endDate) {
    // Implementation for trend calculations would go here
    // This would typically involve daily/weekly comparisons
    return {
      occupancyTrend: 'stable',
      revenueTrend: 'increasing',
      guestCountTrend: 'stable'
    };
  }
  
  async calculateOverallTrends(startDate, endDate) {
    // Implementation for overall trend calculations
    return {
      bookingsTrend: 'increasing',
      revenueTrend: 'stable',
      occupancyTrend: 'increasing'
    };
  }
}

export default new DayUseService();