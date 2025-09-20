import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import GuestService from '../models/GuestService.js';
import InventoryItem from '../models/InventoryItem.js';

class DashboardController {
  // Get real-time dashboard counts
  async getDashboardCounts(req, res) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Front Desk Counts
      const checkInsToday = await Booking.countDocuments({
        checkIn: { $gte: today, $lt: tomorrow },
        status: { $in: ['confirmed', 'checked_in'] }
      });

      const checkOutsToday = await Booking.countDocuments({
        checkOut: { $gte: today, $lt: tomorrow },
        status: 'checked_in'
      });

      // Total reservations (active bookings)
      const totalReservations = await Booking.countDocuments({
        status: { $in: ['confirmed', 'checked_in', 'pending'] },
        checkOut: { $gte: today }
      });

      // Housekeeping tasks
      const housekeepingTasks = await Room.countDocuments({
        status: { $in: ['dirty', 'maintenance', 'out_of_order'] }
      });

      // Guest services pending
      const pendingGuestServices = await GuestService.countDocuments({
        status: { $in: ['pending', 'in_progress'] }
      });

      // VIP guests currently in house
      const vipGuests = await Booking.countDocuments({
        status: 'checked_in',
        checkOut: { $gte: today },
        totalAmount: { $gte: 15000 } // VIP threshold
      });

      // Corporate bookings
      const corporateBookings = await Booking.countDocuments({
        'corporateBooking.corporateCompanyId': { $exists: true, $ne: null },
        status: { $in: ['confirmed', 'checked_in'] },
        checkOut: { $gte: today }
      });

      // Maintenance requests
      const maintenanceRequests = await Room.countDocuments({
        status: { $in: ['maintenance', 'out_of_order'] }
      });

      // Low stock items
      const lowStockItems = await InventoryItem.countDocuments({
        $expr: { $lte: ['$quantity', '$minStockLevel'] }
      });

      const dashboardCounts = {
        frontDesk: {
          total: checkInsToday + checkOutsToday,
          checkIn: checkInsToday,
          checkOut: checkOutsToday
        },
        reservations: {
          total: totalReservations,
          confirmed: await Booking.countDocuments({
            status: 'confirmed',
            checkOut: { $gte: today }
          }),
          pending: await Booking.countDocuments({
            status: 'pending',
            checkOut: { $gte: today }
          }),
          checkedIn: await Booking.countDocuments({
            status: 'checked_in'
          })
        },
        housekeeping: {
          total: housekeepingTasks,
          dirty: await Room.countDocuments({ status: 'dirty' }),
          maintenance: maintenanceRequests,
          outOfOrder: await Room.countDocuments({ status: 'out_of_order' })
        },
        guestServices: {
          total: pendingGuestServices,
          pending: await GuestService.countDocuments({ status: 'pending' }),
          inProgress: await GuestService.countDocuments({ status: 'in_progress' }),
          vipGuests,
          corporate: corporateBookings
        },
        maintenance: {
          total: maintenanceRequests,
          urgent: await Room.countDocuments({
            status: 'out_of_order'
          }),
          scheduled: await Room.countDocuments({
            status: 'maintenance'
          })
        },
        inventory: {
          total: lowStockItems,
          critical: await InventoryItem.countDocuments({
            quantity: { $eq: 0 }
          }),
          lowStock: lowStockItems
        }
      };

      res.json({
        success: true,
        data: dashboardCounts,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Dashboard counts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard counts',
        error: error.message
      });
    }
  }

  // Get room status summary
  async getRoomStatusSummary(req, res) {
    try {
      const roomSummary = await Room.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const summary = {
        total: await Room.countDocuments({ isActive: true }),
        byStatus: roomSummary.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        occupancyRate: 0
      };

      // Calculate occupancy rate
      const occupiedRooms = (summary.byStatus.occupied || 0);
      const totalRooms = summary.total;
      
      if (totalRooms > 0) {
        summary.occupancyRate = Math.round((occupiedRooms / totalRooms) * 100);
      }

      res.json({
        success: true,
        data: summary
      });

    } catch (error) {
      console.error('Room status summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch room status summary',
        error: error.message
      });
    }
  }

  // Get recent activities for dashboard
  async getRecentActivities(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      
      // Get recent bookings
      const recentBookings = await Booking.find({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
      .populate('userId', 'name email')
      .populate('rooms.roomId', 'roomNumber')
      .sort({ createdAt: -1 })
      .limit(limit / 2);

      // Get recent guest services
      const recentServices = await GuestService.find({
        updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
      .populate('guestId', 'name')
      .populate('roomId', 'roomNumber')
      .sort({ updatedAt: -1 })
      .limit(limit / 2);

      const activities = [
        ...recentBookings.map(booking => ({
          id: booking._id,
          type: 'booking',
          title: `New booking: ${booking.userId?.name}`,
          description: `Room ${booking.rooms[0]?.roomId?.roomNumber} - ${booking.status}`,
          timestamp: booking.createdAt,
          status: booking.status
        })),
        ...recentServices.map(service => ({
          id: service._id,
          type: 'service',
          title: `${service.serviceType}: ${service.guestId?.name}`,
          description: `Room ${service.roomId?.roomNumber} - ${service.status}`,
          timestamp: service.updatedAt,
          status: service.status
        }))
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

      res.json({
        success: true,
        data: activities
      });

    } catch (error) {
      console.error('Recent activities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recent activities',
        error: error.message
      });
    }
  }
}

export default new DashboardController();
