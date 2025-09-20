import mongoose from 'mongoose';
import moment from 'moment';
import logger from '../utils/logger.js';
import StaffTask from '../models/StaffTask.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import RoomInventory from '../models/RoomInventory.js';

class StaffProductivityService {
  // Housekeeping Efficiency Metrics
  async getHousekeepingEfficiency(filters = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate(),
        staffId,
        roomType,
        department = 'housekeeping'
      } = filters;

      const matchCriteria = {
        createdAt: { $gte: startDate, $lte: endDate },
        category: 'housekeeping',
        ...(staffId && { assignedTo: new mongoose.Types.ObjectId(staffId) })
      };

      // Get housekeeping tasks and completion data
      const taskMetrics = await StaffTask.aggregate([
        { $match: matchCriteria },
        {
          $lookup: {
            from: 'users',
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'staff'
          }
        },
        { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'rooms',
            localField: 'roomId',
            foreignField: '_id',
            as: 'room'
          }
        },
        { $unwind: { path: '$room', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              staffId: '$assignedTo',
              staffName: '$staff.name',
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
            },
            totalTasks: { $sum: 1 },
            completedTasks: { 
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } 
            },
            averageCompletionTime: {
              $avg: {
                $cond: [
                  { $and: [
                    { $ne: ['$completedAt', null] },
                    { $ne: ['$startedAt', null] }
                  ]},
                  { $divide: [
                    { $subtract: ['$completedAt', '$startedAt'] },
                    1000 * 60 // Convert to minutes
                  ]},
                  null
                ]
              }
            },
            roomsServiced: { $addToSet: '$roomId' },
            taskTypes: { $addToSet: '$taskType' },
            priority: {
              $push: {
                $cond: [
                  { $eq: ['$priority', 'high'] }, 3,
                  { $cond: [{ $eq: ['$priority', 'medium'] }, 2, 1] }
                ]
              }
            },
            qualityScores: { $push: '$qualityScore' }
          }
        },
        {
          $addFields: {
            completionRate: { 
              $multiply: [
                { $divide: ['$completedTasks', '$totalTasks'] },
                100
              ]
            },
            roomsServicedCount: { $size: '$roomsServiced' },
            averagePriorityHandled: { $avg: '$priority' },
            averageQualityScore: { $avg: '$qualityScores' }
          }
        },
        {
          $group: {
            _id: '$_id.staffId',
            staffName: { $first: '$_id.staffName' },
            dailyMetrics: {
              $push: {
                date: '$_id.date',
                totalTasks: '$totalTasks',
                completedTasks: '$completedTasks',
                completionRate: '$completionRate',
                averageCompletionTime: '$averageCompletionTime',
                roomsServiced: '$roomsServicedCount',
                averageQualityScore: '$averageQualityScore'
              }
            },
            totalTasks: { $sum: '$totalTasks' },
            totalCompleted: { $sum: '$completedTasks' },
            avgCompletionTime: { $avg: '$averageCompletionTime' },
            avgQualityScore: { $avg: '$averageQualityScore' },
            totalRoomsServiced: { $sum: '$roomsServicedCount' }
          }
        },
        {
          $addFields: {
            overallCompletionRate: {
              $multiply: [
                { $divide: ['$totalCompleted', '$totalTasks'] },
                100
              ]
            },
            efficiencyScore: {
              $multiply: [
                { $add: [
                  { $multiply: ['$overallCompletionRate', 0.4] }, // 40% weight on completion rate
                  { $multiply: [
                    { $cond: [
                      { $gt: ['$avgCompletionTime', 0] },
                      { $divide: [60, '$avgCompletionTime'] }, // Faster is better
                      0
                    ]}, 0.3
                  ]}, // 30% weight on speed
                  { $multiply: [{ $ifNull: ['$avgQualityScore', 0] }, 20] }, // 30% weight on quality (score * 20 to scale to 100)
                ]},
                1
              ]
            }
          }
        },
        { $sort: { efficiencyScore: -1 } }
      ]);

      // Get room status change efficiency
      const roomStatusChanges = await RoomInventory.aggregate([
        {
          $match: {
            updatedAt: { $gte: startDate, $lte: endDate },
            'statusHistory.0': { $exists: true }
          }
        },
        { $unwind: '$statusHistory' },
        {
          $match: {
            'statusHistory.timestamp': { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              userId: '$statusHistory.updatedBy',
              fromStatus: '$statusHistory.from',
              toStatus: '$statusHistory.to'
            },
            count: { $sum: 1 },
            avgTimeInStatus: { $avg: '$statusHistory.timeInPreviousStatus' }
          }
        }
      ]);

      // Calculate department-wide metrics
      const departmentMetrics = {
        totalStaff: taskMetrics.length,
        averageCompletionRate: taskMetrics.reduce((sum, staff) => sum + staff.overallCompletionRate, 0) / taskMetrics.length || 0,
        averageEfficiencyScore: taskMetrics.reduce((sum, staff) => sum + staff.efficiencyScore, 0) / taskMetrics.length || 0,
        totalTasksHandled: taskMetrics.reduce((sum, staff) => sum + staff.totalTasks, 0),
        totalRoomsServiced: taskMetrics.reduce((sum, staff) => sum + staff.totalRoomsServiced, 0)
      };

      return {
        success: true,
        data: {
          staffMetrics: taskMetrics,
          roomStatusMetrics: roomStatusChanges,
          departmentSummary: departmentMetrics,
          dateRange: { startDate, endDate }
        }
      };

    } catch (error) {
      logger.error('Error getting housekeeping efficiency:', error);
      return {
        success: false,
        error: 'Failed to retrieve housekeeping efficiency metrics'
      };
    }
  }

  // Front Desk Performance KPIs
  async getFrontDeskPerformance(filters = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate(),
        staffId
      } = filters;

      const matchCriteria = {
        createdAt: { $gte: startDate, $lte: endDate },
        ...(staffId && { 
          $or: [
            { createdBy: new mongoose.Types.ObjectId(staffId) },
            { 'checkIn.handledBy': new mongoose.Types.ObjectId(staffId) },
            { 'checkOut.handledBy': new mongoose.Types.ObjectId(staffId) }
          ]
        })
      };

      // Get booking handling metrics
      const bookingMetrics = await Booking.aggregate([
        { $match: matchCriteria },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'createdByUser'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'checkIn.handledBy',
            foreignField: '_id',
            as: 'checkInHandler'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'checkOut.handledBy',
            foreignField: '_id',
            as: 'checkOutHandler'
          }
        },
        {
          $addFields: {
            checkInTime: {
              $cond: [
                { $and: [
                  { $ne: ['$checkIn.actualTime', null] },
                  { $ne: ['$checkIn.expectedTime', null] }
                ]},
                { $subtract: ['$checkIn.actualTime', '$checkIn.expectedTime'] },
                null
              ]
            },
            checkOutTime: {
              $cond: [
                { $and: [
                  { $ne: ['$checkOut.actualTime', null] },
                  { $ne: ['$checkOut.expectedTime', null] }
                ]},
                { $subtract: ['$checkOut.actualTime', '$checkOut.expectedTime'] },
                null
              ]
            },
            bookingToCheckInTime: {
              $cond: [
                { $and: [
                  { $ne: ['$checkIn.actualTime', null] },
                  { $ne: ['$createdAt', null] }
                ]},
                { $subtract: ['$checkIn.actualTime', '$createdAt'] },
                null
              ]
            }
          }
        },
        {
          $facet: {
            byCreator: [
              { $unwind: { path: '$createdByUser', preserveNullAndEmptyArrays: true } },
              {
                $group: {
                  _id: '$createdBy',
                  staffName: { $first: '$createdByUser.name' },
                  bookingsCreated: { $sum: 1 },
                  averageBookingValue: { $avg: '$totalAmount' },
                  bookingTypes: { $addToSet: '$bookingType' },
                  paymentMethods: { $addToSet: '$paymentMethod' },
                  corporateBookings: {
                    $sum: { $cond: [{ $eq: ['$bookingType', 'corporate'] }, 1, 0] }
                  },
                  walkInBookings: {
                    $sum: { $cond: [{ $eq: ['$bookingSource', 'walk-in'] }, 1, 0] }
                  },
                  onlineBookings: {
                    $sum: { $cond: [{ $eq: ['$bookingSource', 'online'] }, 1, 0] }
                  }
                }
              }
            ],
            byCheckInHandler: [
              { $match: { 'checkIn.handledBy': { $exists: true } } },
              { $unwind: { path: '$checkInHandler', preserveNullAndEmptyArrays: true } },
              {
                $group: {
                  _id: '$checkIn.handledBy',
                  staffName: { $first: '$checkInHandler.name' },
                  checkInsHandled: { $sum: 1 },
                  averageCheckInTime: { $avg: '$checkInTime' },
                  earlyCheckIns: {
                    $sum: { $cond: [{ $lt: ['$checkInTime', 0] }, 1, 0] }
                  },
                  lateCheckIns: {
                    $sum: { $cond: [{ $gt: ['$checkInTime', 0] }, 1, 0] }
                  },
                  averageProcessingTime: { $avg: '$bookingToCheckInTime' }
                }
              }
            ],
            byCheckOutHandler: [
              { $match: { 'checkOut.handledBy': { $exists: true } } },
              { $unwind: { path: '$checkOutHandler', preserveNullAndEmptyArrays: true } },
              {
                $group: {
                  _id: '$checkOut.handledBy',
                  staffName: { $first: '$checkOutHandler.name' },
                  checkOutsHandled: { $sum: 1 },
                  averageCheckOutTime: { $avg: '$checkOutTime' },
                  earlyCheckOuts: {
                    $sum: { $cond: [{ $lt: ['$checkOutTime', 0] }, 1, 0] }
                  },
                  lateCheckOuts: {
                    $sum: { $cond: [{ $gt: ['$checkOutTime', 0] }, 1, 0] }
                  }
                }
              }
            ]
          }
        }
      ]);

      // Get guest service metrics
      const guestServiceMetrics = await StaffTask.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            category: { $in: ['guest_service', 'front_desk', 'concierge'] },
            ...(staffId && { assignedTo: new mongoose.Types.ObjectId(staffId) })
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'staff'
          }
        },
        { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$assignedTo',
            staffName: { $first: '$staff.name' },
            totalRequests: { $sum: 1 },
            completedRequests: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            averageResponseTime: {
              $avg: {
                $cond: [
                  { $and: [
                    { $ne: ['$startedAt', null] },
                    { $ne: ['$createdAt', null] }
                  ]},
                  { $divide: [
                    { $subtract: ['$startedAt', '$createdAt'] },
                    1000 * 60 // Convert to minutes
                  ]},
                  null
                ]
              }
            },
            averageResolutionTime: {
              $avg: {
                $cond: [
                  { $and: [
                    { $ne: ['$completedAt', null] },
                    { $ne: ['$startedAt', null] }
                  ]},
                  { $divide: [
                    { $subtract: ['$completedAt', '$startedAt'] },
                    1000 * 60 // Convert to minutes
                  ]},
                  null
                ]
              }
            },
            guestSatisfactionRating: { $avg: '$guestRating' },
            urgentRequests: {
              $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] }
            },
            requestTypes: { $addToSet: '$taskType' }
          }
        },
        {
          $addFields: {
            completionRate: {
              $multiply: [
                { $divide: ['$completedRequests', '$totalRequests'] },
                100
              ]
            },
            serviceScore: {
              $multiply: [
                { $add: [
                  { $multiply: ['$completionRate', 0.3] }, // 30% completion rate
                  { $multiply: [
                    { $cond: [
                      { $gt: ['$averageResponseTime', 0] },
                      { $divide: [30, '$averageResponseTime'] }, // 30 minutes target response time
                      0
                    ]}, 25
                  ]}, // 25% response time (scaled to 100)
                  { $multiply: [
                    { $cond: [
                      { $gt: ['$averageResolutionTime', 0] },
                      { $divide: [120, '$averageResolutionTime'] }, // 2 hours target resolution
                      0
                    ]}, 25
                  ]}, // 25% resolution time
                  { $multiply: [{ $ifNull: ['$guestSatisfactionRating', 0] }, 20] } // 20% guest satisfaction (1-5 scale * 20)
                ]},
                1
              ]
            }
          }
        },
        { $sort: { serviceScore: -1 } }
      ]);

      return {
        success: true,
        data: {
          bookingMetrics: bookingMetrics[0],
          guestServiceMetrics,
          dateRange: { startDate, endDate }
        }
      };

    } catch (error) {
      logger.error('Error getting front desk performance:', error);
      return {
        success: false,
        error: 'Failed to retrieve front desk performance metrics'
      };
    }
  }

  // Task Completion Rates
  async getTaskCompletionRates(filters = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate(),
        department,
        staffId,
        taskType
      } = filters;

      const matchCriteria = {
        createdAt: { $gte: startDate, $lte: endDate },
        ...(department && { category: department }),
        ...(staffId && { assignedTo: new mongoose.Types.ObjectId(staffId) }),
        ...(taskType && { taskType })
      };

      const completionMetrics = await StaffTask.aggregate([
        { $match: matchCriteria },
        {
          $lookup: {
            from: 'users',
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'staff'
          }
        },
        { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              category: '$category',
              taskType: '$taskType'
            },
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            pendingTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            inProgressTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
            },
            overdueTasks: {
              $sum: {
                $cond: [
                  { $and: [
                    { $ne: ['$dueDate', null] },
                    { $lt: ['$dueDate', new Date()] },
                    { $ne: ['$status', 'completed'] }
                  ]},
                  1, 0
                ]
              }
            },
            averageTimeToComplete: {
              $avg: {
                $cond: [
                  { $and: [
                    { $ne: ['$completedAt', null] },
                    { $ne: ['$createdAt', null] }
                  ]},
                  { $divide: [
                    { $subtract: ['$completedAt', '$createdAt'] },
                    1000 * 60 * 60 // Convert to hours
                  ]},
                  null
                ]
              }
            }
          }
        },
        {
          $addFields: {
            completionRate: {
              $multiply: [
                { $divide: ['$completedTasks', '$totalTasks'] },
                100
              ]
            },
            overdueRate: {
              $multiply: [
                { $divide: ['$overdueTasks', '$totalTasks'] },
                100
              ]
            }
          }
        },
        {
          $group: {
            _id: '$_id.category',
            taskTypes: {
              $push: {
                taskType: '$_id.taskType',
                date: '$_id.date',
                totalTasks: '$totalTasks',
                completedTasks: '$completedTasks',
                completionRate: '$completionRate',
                overdueRate: '$overdueRate',
                averageTimeToComplete: '$averageTimeToComplete'
              }
            },
            totalTasksInCategory: { $sum: '$totalTasks' },
            totalCompletedInCategory: { $sum: '$completedTasks' },
            avgCompletionRate: { $avg: '$completionRate' },
            avgOverdueRate: { $avg: '$overdueRate' }
          }
        },
        { $sort: { avgCompletionRate: -1 } }
      ]);

      // Get staff individual performance
      const staffPerformance = await StaffTask.aggregate([
        { $match: matchCriteria },
        {
          $lookup: {
            from: 'users',
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'staff'
          }
        },
        { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$assignedTo',
            staffName: { $first: '$staff.name' },
            department: { $first: '$staff.department' },
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            averageTimeToComplete: {
              $avg: {
                $cond: [
                  { $and: [
                    { $ne: ['$completedAt', null] },
                    { $ne: ['$createdAt', null] }
                  ]},
                  { $divide: [
                    { $subtract: ['$completedAt', '$createdAt'] },
                    1000 * 60 * 60 // Convert to hours
                  ]},
                  null
                ]
              }
            }
          }
        },
        {
          $addFields: {
            completionRate: {
              $multiply: [
                { $divide: ['$completedTasks', '$totalTasks'] },
                100
              ]
            }
          }
        },
        { $sort: { completionRate: -1 } }
      ]);

      return {
        success: true,
        data: {
          categoryMetrics: completionMetrics,
          staffPerformance,
          dateRange: { startDate, endDate }
        }
      };

    } catch (error) {
      logger.error('Error getting task completion rates:', error);
      return {
        success: false,
        error: 'Failed to retrieve task completion rates'
      };
    }
  }

  // Staff Scheduling Optimization
  async getSchedulingOptimization(filters = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate(),
        department
      } = filters;

      // Get workload distribution by time and department
      const workloadAnalysis = await StaffTask.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            ...(department && { category: department })
          }
        },
        {
          $addFields: {
            hourOfDay: { $hour: '$createdAt' },
            dayOfWeek: { $dayOfWeek: '$createdAt' },
            weekOfYear: { $week: '$createdAt' }
          }
        },
        {
          $group: {
            _id: {
              hour: '$hourOfDay',
              dayOfWeek: '$dayOfWeek',
              category: '$category'
            },
            taskCount: { $sum: 1 },
            averageUrgency: {
              $avg: {
                $cond: [
                  { $eq: ['$priority', 'urgent'] }, 3,
                  { $cond: [{ $eq: ['$priority', 'high'] }, 2, 1] }
                ]
              }
            },
            taskTypes: { $addToSet: '$taskType' }
          }
        },
        {
          $group: {
            _id: '$_id.category',
            hourlyDistribution: {
              $push: {
                hour: '$_id.hour',
                dayOfWeek: '$_id.dayOfWeek',
                taskCount: '$taskCount',
                averageUrgency: '$averageUrgency'
              }
            },
            peakHours: { $max: '$taskCount' },
            totalTasks: { $sum: '$taskCount' }
          }
        }
      ]);

      // Get staff availability vs demand
      const staffDemandAnalysis = await User.aggregate([
        {
          $match: {
            role: { $in: ['housekeeper', 'front_desk', 'maintenance', 'concierge'] },
            isActive: true
          }
        },
        {
          $lookup: {
            from: 'stafftasks',
            let: { userId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$assignedTo', '$$userId'] },
                  createdAt: { $gte: startDate, $lte: endDate }
                }
              }
            ],
            as: 'assignedTasks'
          }
        },
        {
          $addFields: {
            totalTasksAssigned: { $size: '$assignedTasks' },
            completedTasks: {
              $size: {
                $filter: {
                  input: '$assignedTasks',
                  as: 'task',
                  cond: { $eq: ['$$task.status', 'completed'] }
                }
              }
            },
            averageTasksPerDay: {
              $divide: [
                { $size: '$assignedTasks' },
                { $divide: [
                  { $subtract: [endDate, startDate] },
                  1000 * 60 * 60 * 24
                ]}
              ]
            }
          }
        },
        {
          $group: {
            _id: '$department',
            staffCount: { $sum: 1 },
            totalTasksHandled: { $sum: '$totalTasksAssigned' },
            avgTasksPerStaff: { $avg: '$totalTasksAssigned' },
            avgTasksPerDay: { $avg: '$averageTasksPerDay' },
            staffDetails: {
              $push: {
                name: '$name',
                tasksAssigned: '$totalTasksAssigned',
                tasksCompleted: '$completedTasks',
                dailyAverage: '$averageTasksPerDay'
              }
            }
          }
        }
      ]);

      // Generate scheduling recommendations
      const recommendations = [];
      
      workloadAnalysis.forEach(categoryData => {
        const peakHours = categoryData.hourlyDistribution
          .sort((a, b) => b.taskCount - a.taskCount)
          .slice(0, 3);
          
        recommendations.push({
          department: categoryData._id,
          peakHours: peakHours.map(h => h.hour),
          recommendation: `Increase ${categoryData._id} staff during hours ${peakHours.map(h => h.hour).join(', ')} for optimal coverage`,
          urgencyLevel: peakHours[0]?.averageUrgency || 1
        });
      });

      return {
        success: true,
        data: {
          workloadAnalysis,
          staffDemandAnalysis,
          recommendations,
          dateRange: { startDate, endDate }
        }
      };

    } catch (error) {
      logger.error('Error getting scheduling optimization:', error);
      return {
        success: false,
        error: 'Failed to retrieve scheduling optimization data'
      };
    }
  }

  // Generate comprehensive staff productivity report
  async generateProductivityReport(filters = {}) {
    try {
      const [
        housekeepingData,
        frontDeskData,
        taskCompletionData,
        schedulingData
      ] = await Promise.all([
        this.getHousekeepingEfficiency(filters),
        this.getFrontDeskPerformance(filters),
        this.getTaskCompletionRates(filters),
        this.getSchedulingOptimization(filters)
      ]);

      return {
        success: true,
        data: {
          housekeeping: housekeepingData.data,
          frontDesk: frontDeskData.data,
          taskCompletion: taskCompletionData.data,
          scheduling: schedulingData.data,
          generatedAt: new Date(),
          filters
        }
      };

    } catch (error) {
      logger.error('Error generating productivity report:', error);
      return {
        success: false,
        error: 'Failed to generate productivity report'
      };
    }
  }
}

export default new StaffProductivityService();