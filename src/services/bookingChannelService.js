import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';

class BookingChannelService {
  async getChannelPerformanceAnalytics(filters = {}) {
    try {
      const { dateRange, channel } = filters;
      const matchCriteria = {};

      // Date range filter
      if (dateRange && dateRange.startDate && dateRange.endDate) {
        matchCriteria.checkInDate = {
          $gte: new Date(dateRange.startDate),
          $lte: new Date(dateRange.endDate)
        };
      }

      // Channel filter
      if (channel && channel !== 'all') {
        matchCriteria.bookingSource = channel;
      }

      // Aggregate channel performance metrics
      const channelMetrics = await Booking.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$bookingSource',
            bookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            totalNights: { $sum: { $subtract: ['$checkOutDate', '$checkInDate'] } },
            confirmedBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
            },
            cancelledBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            completedBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            totalCommission: { $sum: '$commission' },
            averageRating: { $avg: '$rating' }
          }
        },
        {
          $addFields: {
            averageBookingValue: { $divide: ['$totalRevenue', '$bookings'] },
            conversionRate: { $divide: ['$confirmedBookings', '$bookings'] },
            cancellationRate: { $divide: ['$cancelledBookings', '$bookings'] },
            averageNightsPerBooking: { $divide: ['$totalNights', '$bookings'] },
            commissionRate: { $divide: ['$totalCommission', '$totalRevenue'] }
          }
        },
        {
          $project: {
            channel: '$_id',
            bookings: 1,
            revenue: '$totalRevenue',
            nights: '$totalNights',
            commission: '$totalCommission',
            averageBookingValue: { $round: ['$averageBookingValue', 2] },
            conversionRate: { $round: ['$conversionRate', 4] },
            cancellationRate: { $round: ['$cancellationRate', 4] },
            averageNightsPerBooking: { $round: ['$averageNightsPerBooking', 1] },
            commissionRate: { $round: ['$commissionRate', 4] },
            averageRating: { $round: ['$averageRating', 1] },
            _id: 0
          }
        },
        { $sort: { revenue: -1 } }
      ]);

      // Channel performance over time (daily trends)
      const channelTrends = await Booking.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$checkInDate' } },
              channel: '$bookingSource'
            },
            bookings: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
            nights: { $sum: { $subtract: ['$checkOutDate', '$checkInDate'] } }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            channels: {
              $push: {
                channel: '$_id.channel',
                bookings: '$bookings',
                revenue: '$revenue',
                nights: '$nights'
              }
            },
            totalBookings: { $sum: '$bookings' },
            totalRevenue: { $sum: '$revenue' }
          }
        },
        {
          $project: {
            date: '$_id',
            direct: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: '$channels',
                    cond: { $eq: ['$$this.channel', 'direct'] }
                  }
                },
                0
              ]
            },
            ota: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: '$channels',
                    cond: { $eq: ['$$this.channel', 'ota'] }
                  }
                },
                0
              ]
            },
            corporate: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: '$channels',
                    cond: { $eq: ['$$this.channel', 'corporate'] }
                  }
                },
                0
              ]
            },
            walkin: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: '$channels',
                    cond: { $eq: ['$$this.channel', 'walkin'] }
                  }
                },
                0
              ]
            },
            totalBookings: 1,
            totalRevenue: 1,
            _id: 0
          }
        },
        {
          $addFields: {
            direct: { $ifNull: ['$direct.bookings', 0] },
            ota: { $ifNull: ['$ota.bookings', 0] },
            corporate: { $ifNull: ['$corporate.bookings', 0] },
            walkin: { $ifNull: ['$walkin.bookings', 0] }
          }
        },
        { $sort: { date: 1 } }
      ]);

      // Channel comparison metrics
      const channelComparison = await this.getChannelComparisonMetrics(matchCriteria);

      // OTA-specific metrics
      const otaMetrics = await this.getOTAPerformanceMetrics(matchCriteria);

      // Revenue distribution by channel
      const revenueDistribution = channelMetrics.map(channel => ({
        channel: channel.channel,
        revenue: channel.revenue,
        percentage: 0 // Will be calculated after getting total
      }));

      const totalRevenue = revenueDistribution.reduce((sum, ch) => sum + ch.revenue, 0);
      revenueDistribution.forEach(ch => {
        ch.percentage = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0;
      });

      return {
        success: true,
        data: {
          channels: channelMetrics,
          trends: channelTrends,
          comparison: channelComparison,
          otaMetrics: otaMetrics,
          revenueDistribution: revenueDistribution,
          summary: {
            totalChannels: channelMetrics.length,
            totalBookings: channelMetrics.reduce((sum, ch) => sum + ch.bookings, 0),
            totalRevenue: channelMetrics.reduce((sum, ch) => sum + ch.revenue, 0),
            totalCommission: channelMetrics.reduce((sum, ch) => sum + ch.commission, 0),
            bestPerformingChannel: channelMetrics[0]?.channel || 'N/A',
            avgConversionRate: channelMetrics.reduce((sum, ch) => sum + ch.conversionRate, 0) / channelMetrics.length || 0
          }
        }
      };
    } catch (error) {
      console.error('Error in getChannelPerformanceAnalytics:', error);
      return {
        success: false,
        message: 'Failed to fetch channel performance analytics',
        error: error.message
      };
    }
  }

  async getChannelComparisonMetrics(matchCriteria) {
    try {
      const comparison = await Booking.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$bookingSource',
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            averageBookingValue: { $avg: '$totalAmount' },
            totalCommission: { $sum: '$commission' },
            averageLeadTime: {
              $avg: {
                $divide: [
                  { $subtract: ['$checkInDate', '$createdAt'] },
                  1000 * 60 * 60 * 24 // Convert to days
                ]
              }
            },
            noShowRate: {
              $avg: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] }
            },
            cancellationRate: {
              $avg: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            channel: '$_id',
            totalBookings: 1,
            totalRevenue: 1,
            averageBookingValue: { $round: ['$averageBookingValue', 2] },
            totalCommission: 1,
            commissionRate: {
              $round: [{ $divide: ['$totalCommission', '$totalRevenue'] }, 4]
            },
            averageLeadTime: { $round: ['$averageLeadTime', 1] },
            noShowRate: { $round: ['$noShowRate', 4] },
            cancellationRate: { $round: ['$cancellationRate', 4] },
            _id: 0
          }
        }
      ]);

      return comparison;
    } catch (error) {
      console.error('Error in getChannelComparisonMetrics:', error);
      return [];
    }
  }

  async getOTAPerformanceMetrics(matchCriteria) {
    try {
      // Add OTA-specific criteria
      const otaCriteria = { ...matchCriteria, bookingSource: 'ota' };

      const otaMetrics = await Booking.aggregate([
        { $match: otaCriteria },
        {
          $group: {
            _id: '$otaPartner',
            bookings: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
            commission: { $sum: '$commission' },
            averageRating: { $avg: '$rating' },
            cancellations: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            }
          }
        },
        {
          $addFields: {
            averageBookingValue: { $divide: ['$revenue', '$bookings'] },
            commissionRate: { $divide: ['$commission', '$revenue'] },
            cancellationRate: { $divide: ['$cancellations', '$bookings'] }
          }
        },
        {
          $project: {
            partner: '$_id',
            bookings: 1,
            revenue: 1,
            commission: 1,
            averageBookingValue: { $round: ['$averageBookingValue', 2] },
            commissionRate: { $round: ['$commissionRate', 4] },
            cancellationRate: { $round: ['$cancellationRate', 4] },
            averageRating: { $round: ['$averageRating', 1] },
            _id: 0
          }
        },
        { $sort: { revenue: -1 } }
      ]);

      return otaMetrics;
    } catch (error) {
      console.error('Error in getOTAPerformanceMetrics:', error);
      return [];
    }
  }

  async getChannelROIAnalysis(filters = {}) {
    try {
      const { dateRange } = filters;
      const matchCriteria = {};

      if (dateRange && dateRange.startDate && dateRange.endDate) {
        matchCriteria.checkInDate = {
          $gte: new Date(dateRange.startDate),
          $lte: new Date(dateRange.endDate)
        };
      }

      const roiAnalysis = await Booking.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$bookingSource',
            totalRevenue: { $sum: '$totalAmount' },
            totalCommission: { $sum: '$commission' },
            totalBookings: { $sum: 1 },
            marketingCost: { $sum: '$marketingCost' } // Assuming this field exists
          }
        },
        {
          $addFields: {
            netRevenue: { $subtract: ['$totalRevenue', '$totalCommission'] },
            totalCost: { $add: ['$totalCommission', '$marketingCost'] },
            roi: {
              $divide: [
                { $subtract: ['$totalRevenue', { $add: ['$totalCommission', '$marketingCost'] }] },
                { $add: ['$totalCommission', '$marketingCost'] }
              ]
            },
            profitMargin: {
              $divide: [
                { $subtract: ['$totalRevenue', { $add: ['$totalCommission', '$marketingCost'] }] },
                '$totalRevenue'
              ]
            }
          }
        },
        {
          $project: {
            channel: '$_id',
            totalRevenue: 1,
            netRevenue: 1,
            totalCommission: 1,
            marketingCost: 1,
            totalCost: 1,
            roi: { $round: ['$roi', 4] },
            profitMargin: { $round: ['$profitMargin', 4] },
            costPerBooking: { $divide: ['$totalCost', '$totalBookings'] },
            revenuePerBooking: { $divide: ['$totalRevenue', '$totalBookings'] },
            _id: 0
          }
        },
        { $sort: { roi: -1 } }
      ]);

      return {
        success: true,
        data: roiAnalysis
      };
    } catch (error) {
      console.error('Error in getChannelROIAnalysis:', error);
      return {
        success: false,
        message: 'Failed to fetch channel ROI analysis',
        error: error.message
      };
    }
  }

  async getChannelForecast(filters = {}) {
    try {
      const { dateRange } = filters;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(endDate.getMonth() - 12); // Last 12 months of data

      const historicalData = await Booking.aggregate([
        {
          $match: {
            checkInDate: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              month: { $month: '$checkInDate' },
              year: { $year: '$checkInDate' },
              channel: '$bookingSource'
            },
            bookings: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        },
        {
          $group: {
            _id: '$_id.channel',
            monthlyData: {
              $push: {
                month: '$_id.month',
                year: '$_id.year',
                bookings: '$bookings',
                revenue: '$revenue'
              }
            }
          }
        },
        {
          $project: {
            channel: '$_id',
            forecast: {
              $map: {
                input: { $range: [1, 4] }, // Next 3 months
                as: 'futureMonth',
                in: {
                  month: '$$futureMonth',
                  predictedBookings: { $avg: '$monthlyData.bookings' },
                  predictedRevenue: { $avg: '$monthlyData.revenue' }
                }
              }
            },
            _id: 0
          }
        }
      ]);

      return {
        success: true,
        data: historicalData
      };
    } catch (error) {
      console.error('Error in getChannelForecast:', error);
      return {
        success: false,
        message: 'Failed to generate channel forecast',
        error: error.message
      };
    }
  }

  async getChannelCustomerSegmentation(filters = {}) {
    try {
      const { dateRange, channel } = filters;
      const matchCriteria = {};

      if (dateRange && dateRange.startDate && dateRange.endDate) {
        matchCriteria.checkInDate = {
          $gte: new Date(dateRange.startDate),
          $lte: new Date(dateRange.endDate)
        };
      }

      if (channel && channel !== 'all') {
        matchCriteria.bookingSource = channel;
      }

      const segmentation = await Booking.aggregate([
        { $match: matchCriteria },
        {
          $lookup: {
            from: 'users',
            localField: 'guestId',
            foreignField: '_id',
            as: 'guest'
          }
        },
        { $unwind: { path: '$guest', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            customerType: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ['$guest.bookingHistory', []] } }, 5] },
                'VIP',
                {
                  $cond: [
                    { $gt: [{ $size: { $ifNull: ['$guest.bookingHistory', []] } }, 1] },
                    'Returning',
                    'New'
                  ]
                }
              ]
            },
            spendingTier: {
              $cond: [
                { $gt: ['$totalAmount', 10000] },
                'High',
                {
                  $cond: [
                    { $gt: ['$totalAmount', 5000] },
                    'Medium',
                    'Low'
                  ]
                }
              ]
            }
          }
        },
        {
          $group: {
            _id: {
              channel: '$bookingSource',
              customerType: '$customerType',
              spendingTier: '$spendingTier'
            },
            count: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            averageBookingValue: { $avg: '$totalAmount' }
          }
        },
        {
          $group: {
            _id: '$_id.channel',
            segments: {
              $push: {
                customerType: '$_id.customerType',
                spendingTier: '$_id.spendingTier',
                count: '$count',
                revenue: '$totalRevenue',
                averageBookingValue: '$averageBookingValue'
              }
            }
          }
        },
        {
          $project: {
            channel: '$_id',
            segments: 1,
            _id: 0
          }
        }
      ]);

      return {
        success: true,
        data: segmentation
      };
    } catch (error) {
      console.error('Error in getChannelCustomerSegmentation:', error);
      return {
        success: false,
        message: 'Failed to fetch channel customer segmentation',
        error: error.message
      };
    }
  }

  async exportChannelReport(filters = {}) {
    try {
      const analytics = await this.getChannelPerformanceAnalytics(filters);
      const roi = await this.getChannelROIAnalysis(filters);
      const segmentation = await this.getChannelCustomerSegmentation(filters);

      return {
        success: true,
        data: {
          analytics: analytics.data,
          roi: roi.data,
          segmentation: segmentation.data,
          exportTimestamp: new Date().toISOString(),
          filters
        }
      };
    } catch (error) {
      console.error('Error in exportChannelReport:', error);
      return {
        success: false,
        message: 'Failed to export channel report',
        error: error.message
      };
    }
  }
}

export default new BookingChannelService();