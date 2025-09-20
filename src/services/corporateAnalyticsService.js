import mongoose from 'mongoose';
import moment from 'moment';
import logger from '../utils/logger.js';
import Booking from '../models/Booking.js';
import CorporateCredit from '../models/CorporateCredit.js';
import User from '../models/User.js';

class CorporateAnalyticsService {
  // Get corporate booking trends and revenue analysis
  async getCorporateBookingAnalytics(filters = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate(),
        corporateId,
        bookingStatus
      } = filters;

      const matchCriteria = {
        createdAt: { $gte: startDate, $lte: endDate },
        bookingType: 'corporate',
        ...(corporateId && { corporateId: new mongoose.Types.ObjectId(corporateId) }),
        ...(bookingStatus && { status: bookingStatus })
      };

      // Get booking trends and revenue data
      const bookingAnalytics = await Booking.aggregate([
        { $match: matchCriteria },
        {
          $lookup: {
            from: 'corporatecredits',
            localField: 'corporateId',
            foreignField: '_id',
            as: 'corporate'
          }
        },
        { $unwind: { path: '$corporate', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              corporateId: '$corporateId',
              corporateName: '$corporate.companyName',
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }
            },
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            averageBookingValue: { $avg: '$totalAmount' },
            confirmedBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
            },
            cancelledBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            pendingBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            roomNights: { $sum: '$numberOfNights' },
            guestCount: { $sum: '$numberOfGuests' },
            paymentMethods: { $addToSet: '$paymentMethod' },
            bookingSources: { $addToSet: '$bookingSource' }
          }
        },
        {
          $group: {
            _id: '$_id.corporateId',
            corporateName: { $first: '$_id.corporateName' },
            dailyBookings: {
              $push: {
                date: '$_id.date',
                month: '$_id.month',
                totalBookings: '$totalBookings',
                totalRevenue: '$totalRevenue',
                averageBookingValue: '$averageBookingValue',
                confirmedBookings: '$confirmedBookings',
                cancelledBookings: '$cancelledBookings',
                pendingBookings: '$pendingBookings',
                roomNights: '$roomNights',
                guestCount: '$guestCount'
              }
            },
            totalBookings: { $sum: '$totalBookings' },
            totalRevenue: { $sum: '$totalRevenue' },
            avgBookingValue: { $avg: '$averageBookingValue' },
            totalRoomNights: { $sum: '$roomNights' },
            totalGuests: { $sum: '$guestCount' },
            confirmationRate: {
              $multiply: [
                { $divide: [{ $sum: '$confirmedBookings' }, { $sum: '$totalBookings' }] },
                100
              ]
            },
            cancellationRate: {
              $multiply: [
                { $divide: [{ $sum: '$cancelledBookings' }, { $sum: '$totalBookings' }] },
                100
              ]
            }
          }
        },
        { $sort: { totalRevenue: -1 } }
      ]);

      // Get month-over-month growth
      const monthlyGrowth = await Booking.aggregate([
        {
          $match: {
            ...matchCriteria,
            createdAt: { 
              $gte: moment(startDate).subtract(1, 'month').toDate(), 
              $lte: endDate 
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            uniqueCorporates: { $addToSet: '$corporateId' }
          }
        },
        {
          $addFields: {
            uniqueCorporateCount: { $size: '$uniqueCorporates' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      return {
        success: true,
        data: {
          corporateMetrics: bookingAnalytics,
          monthlyGrowth,
          dateRange: { startDate, endDate }
        }
      };

    } catch (error) {
      logger.error('Error getting corporate booking analytics:', error);
      return {
        success: false,
        error: 'Failed to retrieve corporate booking analytics'
      };
    }
  }

  // Track pending dues and payment analysis
  async getCorporatePaymentAnalytics(filters = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate(),
        corporateId
      } = filters;

      // Get corporate credit and payment status
      const paymentAnalytics = await CorporateCredit.aggregate([
        {
          $match: {
            ...(corporateId && { _id: new mongoose.Types.ObjectId(corporateId) })
          }
        },
        {
          $lookup: {
            from: 'bookings',
            let: { corporateId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$corporateId', '$$corporateId'] },
                  bookingType: 'corporate',
                  createdAt: { $gte: startDate, $lte: endDate }
                }
              }
            ],
            as: 'bookings'
          }
        },
        {
          $addFields: {
            totalBookings: { $size: '$bookings' },
            totalBookingAmount: { $sum: '$bookings.totalAmount' },
            paidBookings: {
              $size: {
                $filter: {
                  input: '$bookings',
                  as: 'booking',
                  cond: { $eq: ['$$booking.paymentStatus', 'paid'] }
                }
              }
            },
            pendingPayments: {
              $size: {
                $filter: {
                  input: '$bookings',
                  as: 'booking',
                  cond: { $eq: ['$$booking.paymentStatus', 'pending'] }
                }
              }
            },
            overduePayments: {
              $size: {
                $filter: {
                  input: '$bookings',
                  as: 'booking',
                  cond: {
                    $and: [
                      { $eq: ['$$booking.paymentStatus', 'pending'] },
                      { $lt: ['$$booking.paymentDueDate', new Date()] }
                    ]
                  }
                }
              }
            },
            averagePaymentDelay: {
              $avg: {
                $map: {
                  input: {
                    $filter: {
                      input: '$bookings',
                      as: 'booking',
                      cond: { 
                        $and: [
                          { $eq: ['$$booking.paymentStatus', 'paid'] },
                          { $ne: ['$$booking.paidAt', null] }
                        ]
                      }
                    }
                  },
                  as: 'paidBooking',
                  in: {
                    $divide: [
                      { $subtract: ['$$paidBooking.paidAt', '$$paidBooking.createdAt'] },
                      1000 * 60 * 60 * 24 // Convert to days
                    ]
                  }
                }
              }
            }
          }
        },
        {
          $addFields: {
            creditUtilization: {
              $cond: [
                { $gt: ['$creditLimit', 0] },
                { $multiply: [{ $divide: ['$currentBalance', '$creditLimit'] }, 100] },
                0
              ]
            },
            paymentRate: {
              $cond: [
                { $gt: ['$totalBookings', 0] },
                { $multiply: [{ $divide: ['$paidBookings', '$totalBookings'] }, 100] },
                0
              ]
            },
            riskLevel: {
              $cond: [
                { $gte: ['$overduePayments', 5] }, 'high',
                { $cond: [
                  { $gte: ['$overduePayments', 2] }, 'medium',
                  'low'
                ]}
              ]
            }
          }
        },
        {
          $project: {
            companyName: 1,
            contactPerson: 1,
            email: 1,
            phone: 1,
            creditLimit: 1,
            currentBalance: 1,
            availableCredit: 1,
            totalBookings: 1,
            totalBookingAmount: 1,
            paidBookings: 1,
            pendingPayments: 1,
            overduePayments: 1,
            creditUtilization: 1,
            paymentRate: 1,
            averagePaymentDelay: 1,
            riskLevel: 1,
            lastPaymentDate: 1,
            isActive: 1
          }
        },
        { $sort: { overduePayments: -1, creditUtilization: -1 } }
      ]);

      // Get payment trends over time
      const paymentTrends = await Booking.aggregate([
        {
          $match: {
            bookingType: 'corporate',
            createdAt: { $gte: startDate, $lte: endDate },
            ...(corporateId && { corporateId: new mongoose.Types.ObjectId(corporateId) })
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              paymentStatus: '$paymentStatus'
            },
            count: { $sum: 1 },
            amount: { $sum: '$totalAmount' }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            payments: {
              $push: {
                status: '$_id.paymentStatus',
                count: '$count',
                amount: '$amount'
              }
            },
            totalAmount: { $sum: '$amount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Calculate summary metrics
      const summary = {
        totalCorporates: paymentAnalytics.length,
        totalOutstandingAmount: paymentAnalytics.reduce((sum, corp) => sum + corp.currentBalance, 0),
        totalOverdueBookings: paymentAnalytics.reduce((sum, corp) => sum + corp.overduePayments, 0),
        highRiskCorporates: paymentAnalytics.filter(corp => corp.riskLevel === 'high').length,
        averageCreditUtilization: paymentAnalytics.reduce((sum, corp) => sum + corp.creditUtilization, 0) / paymentAnalytics.length || 0
      };

      return {
        success: true,
        data: {
          corporatePayments: paymentAnalytics,
          paymentTrends,
          summary,
          dateRange: { startDate, endDate }
        }
      };

    } catch (error) {
      logger.error('Error getting corporate payment analytics:', error);
      return {
        success: false,
        error: 'Failed to retrieve corporate payment analytics'
      };
    }
  }

  // Analyze booking channel performance
  async getBookingChannelAnalytics(filters = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate(),
        channelType
      } = filters;

      const matchCriteria = {
        createdAt: { $gte: startDate, $lte: endDate },
        ...(channelType && { bookingSource: channelType })
      };

      // Get channel performance metrics
      const channelMetrics = await Booking.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: {
              source: '$bookingSource',
              channel: '$otaChannel',
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
            },
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            confirmedBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
            },
            cancelledBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            averageBookingValue: { $avg: '$totalAmount' },
            averageLeadTime: {
              $avg: {
                $divide: [
                  { $subtract: ['$checkIn', '$createdAt'] },
                  1000 * 60 * 60 * 24 // Convert to days
                ]
              }
            },
            totalRoomNights: { $sum: '$numberOfNights' },
            uniqueGuests: { $addToSet: '$guestId' }
          }
        },
        {
          $group: {
            _id: {
              source: '$_id.source',
              channel: '$_id.channel'
            },
            dailyMetrics: {
              $push: {
                date: '$_id.date',
                totalBookings: '$totalBookings',
                totalRevenue: '$totalRevenue',
                confirmedBookings: '$confirmedBookings',
                cancelledBookings: '$cancelledBookings',
                averageBookingValue: '$averageBookingValue',
                averageLeadTime: '$averageLeadTime',
                totalRoomNights: '$totalRoomNights'
              }
            },
            totalBookings: { $sum: '$totalBookings' },
            totalRevenue: { $sum: '$totalRevenue' },
            avgBookingValue: { $avg: '$averageBookingValue' },
            avgLeadTime: { $avg: '$averageLeadTime' },
            totalRoomNights: { $sum: '$totalRoomNights' },
            uniqueGuestCount: { $sum: { $size: '$uniqueGuests' } },
            confirmationRate: {
              $multiply: [
                { $divide: [{ $sum: '$confirmedBookings' }, { $sum: '$totalBookings' }] },
                100
              ]
            },
            cancellationRate: {
              $multiply: [
                { $divide: [{ $sum: '$cancelledBookings' }, { $sum: '$totalBookings' }] },
                100
              ]
            }
          }
        },
        {
          $addFields: {
            channelName: {
              $cond: [
                { $ne: ['$_id.channel', null] },
                '$_id.channel',
                '$_id.source'
              ]
            },
            revenuePerBooking: { $divide: ['$totalRevenue', '$totalBookings'] },
            revenuePerRoomNight: { $divide: ['$totalRevenue', '$totalRoomNights'] }
          }
        },
        { $sort: { totalRevenue: -1 } }
      ]);

      // Get commission analysis for OTA channels
      const commissionAnalysis = await Booking.aggregate([
        {
          $match: {
            ...matchCriteria,
            bookingSource: 'ota'
          }
        },
        {
          $group: {
            _id: '$otaChannel',
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            totalCommission: { $sum: '$commissionAmount' },
            averageCommissionRate: { $avg: '$commissionRate' }
          }
        },
        {
          $addFields: {
            netRevenue: { $subtract: ['$totalRevenue', '$totalCommission'] },
            commissionPercentage: {
              $multiply: [
                { $divide: ['$totalCommission', '$totalRevenue'] },
                100
              ]
            }
          }
        },
        { $sort: { totalRevenue: -1 } }
      ]);

      // Get performance comparison
      const channelComparison = channelMetrics.map(channel => ({
        ...channel,
        performance: {
          efficiency: channel.confirmationRate - channel.cancellationRate,
          profitability: channel.revenuePerBooking,
          volume: channel.totalBookings,
          loyalty: channel.uniqueGuestCount / channel.totalBookings
        }
      }));

      return {
        success: true,
        data: {
          channelMetrics,
          commissionAnalysis,
          channelComparison,
          dateRange: { startDate, endDate }
        }
      };

    } catch (error) {
      logger.error('Error getting booking channel analytics:', error);
      return {
        success: false,
        error: 'Failed to retrieve booking channel analytics'
      };
    }
  }

  // Generate comprehensive corporate analytics report
  async generateCorporateReport(filters = {}) {
    try {
      const [
        bookingAnalytics,
        paymentAnalytics,
        channelAnalytics
      ] = await Promise.all([
        this.getCorporateBookingAnalytics(filters),
        this.getCorporatePaymentAnalytics(filters),
        this.getBookingChannelAnalytics(filters)
      ]);

      // Calculate consolidated metrics
      const consolidatedMetrics = {
        totalCorporateRevenue: bookingAnalytics.data?.corporateMetrics?.reduce((sum, corp) => sum + corp.totalRevenue, 0) || 0,
        totalOutstandingAmount: paymentAnalytics.data?.summary?.totalOutstandingAmount || 0,
        totalBookings: bookingAnalytics.data?.corporateMetrics?.reduce((sum, corp) => sum + corp.totalBookings, 0) || 0,
        averageBookingValue: 0,
        topCorporateClients: bookingAnalytics.data?.corporateMetrics?.slice(0, 5) || [],
        highRiskClients: paymentAnalytics.data?.corporatePayments?.filter(corp => corp.riskLevel === 'high') || [],
        topPerformingChannels: channelAnalytics.data?.channelMetrics?.slice(0, 5) || []
      };

      consolidatedMetrics.averageBookingValue = consolidatedMetrics.totalBookings > 0 
        ? consolidatedMetrics.totalCorporateRevenue / consolidatedMetrics.totalBookings 
        : 0;

      return {
        success: true,
        data: {
          bookingAnalytics: bookingAnalytics.data,
          paymentAnalytics: paymentAnalytics.data,
          channelAnalytics: channelAnalytics.data,
          consolidatedMetrics,
          generatedAt: new Date(),
          filters
        }
      };

    } catch (error) {
      logger.error('Error generating corporate report:', error);
      return {
        success: false,
        error: 'Failed to generate corporate analytics report'
      };
    }
  }

  // Get real-time corporate dashboard data
  async getCorporateDashboardData() {
    try {
      const today = moment().startOf('day').toDate();
      const thisMonth = moment().startOf('month').toDate();
      const lastMonth = moment().subtract(1, 'month').startOf('month').toDate();

      const [
        todaysBookings,
        monthlyMetrics,
        urgentPayments,
        channelPerformance
      ] = await Promise.all([
        // Today's corporate bookings
        Booking.countDocuments({
          bookingType: 'corporate',
          createdAt: { $gte: today }
        }),

        // This month vs last month
        Booking.aggregate([
          {
            $match: {
              bookingType: 'corporate',
              createdAt: { $gte: lastMonth }
            }
          },
          {
            $group: {
              _id: {
                month: { $month: '$createdAt' },
                year: { $year: '$createdAt' }
              },
              totalBookings: { $sum: 1 },
              totalRevenue: { $sum: '$totalAmount' }
            }
          }
        ]),

        // Urgent payment notifications
        CorporateCredit.find({
          $or: [
            { currentBalance: { $gte: { $multiply: ['$creditLimit', 0.9] } } }, // 90% credit utilized
            { isActive: false }
          ]
        }).select('companyName currentBalance creditLimit contactPerson email').limit(10),

        // Top performing channels today
        Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: today }
            }
          },
          {
            $group: {
              _id: '$bookingSource',
              count: { $sum: 1 },
              revenue: { $sum: '$totalAmount' }
            }
          },
          { $sort: { revenue: -1 } },
          { $limit: 5 }
        ])
      ]);

      return {
        success: true,
        data: {
          todaysBookings,
          monthlyMetrics,
          urgentPayments,
          channelPerformance,
          lastUpdated: new Date()
        }
      };

    } catch (error) {
      logger.error('Error getting corporate dashboard data:', error);
      return {
        success: false,
        error: 'Failed to retrieve corporate dashboard data'
      };
    }
  }
}

export default new CorporateAnalyticsService();