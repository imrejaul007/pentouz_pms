import RoomAvailability from '../models/RoomAvailability.js';
import RoomType from '../models/RoomType.js';
import AuditLog from '../models/AuditLog.js';
import Room from '../models/Room.js';

class InventoryController {
  /**
   * Get inventory for a specific date range
   */
  async getInventory(req, res) {
    try {
      const { 
        hotelId, 
        roomTypeId, 
        startDate, 
        endDate, 
        channel 
      } = req.query;

      if (!hotelId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID, start date, and end date are required'
        });
      }

      const filter = {
        hotelId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      if (roomTypeId) {
        filter.roomTypeId = roomTypeId;
      }

      let inventory = await RoomAvailability.find(filter)
        .populate('roomTypeId', 'name code basePrice')
        .sort({ date: 1, 'roomTypeId.name': 1 });

      if (channel) {
        inventory = inventory.map(item => {
          const channelData = item.channelInventory?.find(
            ch => ch.channel.toString() === channel
          );
          return {
            ...item.toObject(),
            channelSpecific: channelData || null
          };
        });
      }

      res.json({
        success: true,
        data: inventory
      });

    } catch (error) {
      console.error('Error getting inventory:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update inventory for specific dates
   */
  async updateInventory(req, res) {
    try {
      const { 
        hotelId, 
        roomTypeId, 
        date, 
        availableRooms, 
        baseRate, 
        sellingRate,
        restrictions = {},
        channel 
      } = req.body;

      if (!hotelId || !roomTypeId || !date) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID, room type ID, and date are required'
        });
      }

      let inventory = await RoomAvailability.findOne({
        hotelId,
        roomTypeId,
        date: new Date(date)
      });

      const oldValues = inventory ? inventory.toObject() : null;

      if (inventory) {
        if (availableRooms !== undefined) inventory.availableRooms = availableRooms;
        if (baseRate !== undefined) inventory.baseRate = baseRate;
        if (sellingRate !== undefined) inventory.sellingRate = sellingRate;
        
        Object.assign(inventory, restrictions);
        inventory.needsSync = true;
        inventory.lastModified = new Date();

        if (channel) {
          const channelIndex = inventory.channelInventory.findIndex(
            ch => ch.channel.toString() === channel
          );
          
          if (channelIndex >= 0) {
            inventory.channelInventory[channelIndex].availableRooms = availableRooms;
            inventory.channelInventory[channelIndex].rate = sellingRate || baseRate;
            inventory.channelInventory[channelIndex].restrictions = restrictions;
          } else {
            inventory.channelInventory.push({
              channel,
              availableRooms,
              rate: sellingRate || baseRate,
              restrictions
            });
          }
        }

        await inventory.save();
      } else {
        const roomType = await RoomType.findById(roomTypeId);
        if (!roomType) {
          return res.status(404).json({
            success: false,
            message: 'Room type not found'
          });
        }

        const totalRooms = await Room.countDocuments({
          hotelId,
          roomTypeId,
          isActive: true
        });

        inventory = new RoomAvailability({
          hotelId,
          roomTypeId,
          date: new Date(date),
          totalRooms,
          availableRooms: availableRooms !== undefined ? availableRooms : totalRooms,
          soldRooms: 0,
          blockedRooms: 0,
          baseRate: baseRate || roomType.basePrice,
          sellingRate: sellingRate || baseRate || roomType.basePrice,
          currency: 'INR',
          needsSync: true,
          ...restrictions
        });

        if (channel) {
          inventory.channelInventory.push({
            channel,
            availableRooms: availableRooms !== undefined ? availableRooms : totalRooms,
            rate: sellingRate || baseRate || roomType.basePrice,
            restrictions
          });
        }

        await inventory.save();
      }

      await AuditLog.logChange({
        hotelId,
        tableName: 'RoomAvailability',
        recordId: inventory._id,
        changeType: oldValues ? 'update' : 'create',
        oldValues,
        newValues: inventory.toObject(),
        userId: req.user?.id,
        userEmail: req.user?.email,
        source: 'manual',
        metadata: {
          date: date,
          channel: channel || 'direct',
          tags: ['inventory_management']
        }
      });

      res.json({
        success: true,
        data: inventory,
        message: 'Inventory updated successfully'
      });

    } catch (error) {
      console.error('Error updating inventory:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Bulk update inventory for multiple dates
   */
  async bulkUpdateInventory(req, res) {
    try {
      const { 
        hotelId, 
        roomTypeId, 
        updates, // Array of { date, availableRooms, baseRate, sellingRate, restrictions }
        channel 
      } = req.body;

      if (!hotelId || !roomTypeId || !Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID, room type ID, and updates array are required'
        });
      }

      const results = [];
      const auditLogs = [];

      for (const update of updates) {
        try {
          const { date, availableRooms, baseRate, sellingRate, restrictions = {} } = update;

          let inventory = await RoomAvailability.findOne({
            hotelId,
            roomTypeId,
            date: new Date(date)
          });

          const oldValues = inventory ? inventory.toObject() : null;

          if (inventory) {
            if (availableRooms !== undefined) inventory.availableRooms = availableRooms;
            if (baseRate !== undefined) inventory.baseRate = baseRate;
            if (sellingRate !== undefined) inventory.sellingRate = sellingRate;
            
            Object.assign(inventory, restrictions);
            inventory.needsSync = true;
            inventory.lastModified = new Date();

            if (channel) {
              const channelIndex = inventory.channelInventory.findIndex(
                ch => ch.channel.toString() === channel
              );
              
              if (channelIndex >= 0) {
                inventory.channelInventory[channelIndex].availableRooms = availableRooms;
                inventory.channelInventory[channelIndex].rate = sellingRate || baseRate;
                inventory.channelInventory[channelIndex].restrictions = restrictions;
              } else {
                inventory.channelInventory.push({
                  channel,
                  availableRooms,
                  rate: sellingRate || baseRate,
                  restrictions
                });
              }
            }

            await inventory.save();
          } else {
            const roomType = await RoomType.findById(roomTypeId);
            if (!roomType) {
              results.push({
                date,
                status: 'failed',
                error: 'Room type not found'
              });
              continue;
            }

            const totalRooms = await Room.countDocuments({
              hotelId,
              roomTypeId,
              isActive: true
            });

            inventory = new RoomAvailability({
              hotelId,
              roomTypeId,
              date: new Date(date),
              totalRooms,
              availableRooms: availableRooms !== undefined ? availableRooms : totalRooms,
              soldRooms: 0,
              blockedRooms: 0,
              baseRate: baseRate || roomType.basePrice,
              sellingRate: sellingRate || baseRate || roomType.basePrice,
              currency: 'INR',
              needsSync: true,
              ...restrictions
            });

            if (channel) {
              inventory.channelInventory.push({
                channel,
                availableRooms: availableRooms !== undefined ? availableRooms : totalRooms,
                rate: sellingRate || baseRate || roomType.basePrice,
                restrictions
              });
            }

            await inventory.save();
          }

          auditLogs.push({
            hotelId,
            tableName: 'RoomAvailability',
            recordId: inventory._id,
            changeType: oldValues ? 'update' : 'create',
            oldValues,
            newValues: inventory.toObject(),
            userId: req.user?.id,
            userEmail: req.user?.email,
            source: 'bulk_update',
            metadata: {
              date: date,
              channel: channel || 'direct',
              tags: ['bulk_inventory_update']
            }
          });

          results.push({
            date,
            status: 'success',
            inventoryId: inventory._id
          });

        } catch (error) {
          results.push({
            date: update.date,
            status: 'failed',
            error: error.message
          });
        }
      }

      for (const auditData of auditLogs) {
        await AuditLog.logChange(auditData);
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      res.json({
        success: true,
        data: {
          totalUpdates: updates.length,
          successCount,
          failedCount,
          results
        },
        message: `Bulk update completed: ${successCount} successful, ${failedCount} failed`
      });

    } catch (error) {
      console.error('Error in bulk update inventory:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Set stop sell for specific dates
   */
  async setStopSell(req, res) {
    try {
      const { 
        hotelId, 
        roomTypeId, 
        startDate, 
        endDate, 
        stopSell = true, 
        channel,
        reason 
      } = req.body;

      if (!hotelId || !roomTypeId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID, room type ID, start date, and end date are required'
        });
      }

      const filter = {
        hotelId,
        roomTypeId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      const updateData = {
        stopSellFlag: stopSell,
        needsSync: true,
        lastModified: new Date()
      };

      if (channel) {
        const inventories = await RoomAvailability.find(filter);
        
        for (const inventory of inventories) {
          const channelIndex = inventory.channelInventory.findIndex(
            ch => ch.channel.toString() === channel
          );
          
          if (channelIndex >= 0) {
            inventory.channelInventory[channelIndex].restrictions.stopSell = stopSell;
          } else if (stopSell) {
            inventory.channelInventory.push({
              channel,
              availableRooms: 0,
              rate: inventory.sellingRate,
              restrictions: { stopSell: true }
            });
          }
          
          await inventory.save();
        }
      } else {
        await RoomAvailability.updateMany(filter, updateData);
      }

      await AuditLog.logChange({
        hotelId,
        tableName: 'RoomAvailability',
        recordId: `STOP_SELL_${Date.now()}`,
        changeType: 'update',
        newValues: {
          roomTypeId,
          startDate,
          endDate,
          stopSell,
          channel: channel || 'all',
          reason
        },
        userId: req.user?.id,
        userEmail: req.user?.email,
        source: 'stop_sell',
        metadata: {
          dateRange: `${startDate} to ${endDate}`,
          tags: ['stop_sell', 'inventory_restriction']
        }
      });

      const updatedCount = await RoomAvailability.countDocuments(filter);

      res.json({
        success: true,
        data: {
          updatedRecords: updatedCount,
          stopSell,
          dateRange: { startDate, endDate }
        },
        message: `Stop sell ${stopSell ? 'enabled' : 'disabled'} for ${updatedCount} inventory records`
      });

    } catch (error) {
      console.error('Error setting stop sell:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get inventory calendar view
   */
  async getInventoryCalendar(req, res) {
    try {
      const { hotelId, roomTypeId, year, month } = req.query;

      if (!hotelId || !year || !month) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID, year, and month are required'
        });
      }

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const filter = {
        hotelId,
        date: {
          $gte: startDate,
          $lte: endDate
        }
      };

      if (roomTypeId) {
        filter.roomTypeId = roomTypeId;
      }

      const inventory = await RoomAvailability.find(filter)
        .populate('roomTypeId', 'name code')
        .sort({ date: 1 });

      const calendar = {};
      
      for (const item of inventory) {
        const dateKey = item.date.toISOString().split('T')[0];
        const roomTypeKey = item.roomTypeId.code;

        if (!calendar[dateKey]) {
          calendar[dateKey] = {};
        }

        calendar[dateKey][roomTypeKey] = {
          totalRooms: item.totalRooms,
          availableRooms: item.availableRooms,
          soldRooms: item.soldRooms,
          blockedRooms: item.blockedRooms,
          baseRate: item.baseRate,
          sellingRate: item.sellingRate,
          stopSellFlag: item.stopSellFlag,
          closedToArrival: item.closedToArrival,
          closedToDeparture: item.closedToDeparture,
          minimumStay: item.minimumStay,
          maximumStay: item.maximumStay,
          occupancyRate: item.totalRooms > 0 ? 
            ((item.soldRooms + item.blockedRooms) / item.totalRooms * 100).toFixed(1) : 0
        };
      }

      res.json({
        success: true,
        data: {
          year: parseInt(year),
          month: parseInt(month),
          calendar
        }
      });

    } catch (error) {
      console.error('Error getting inventory calendar:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get inventory summary statistics
   */
  async getInventorySummary(req, res) {
    try {
      const { hotelId, roomTypeId, startDate, endDate } = req.query;

      if (!hotelId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID, start date, and end date are required'
        });
      }

      const filter = {
        hotelId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      if (roomTypeId) {
        filter.roomTypeId = roomTypeId;
      }

      const summary = await RoomAvailability.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalInventoryDays: { $sum: 1 },
            totalRoomNights: { $sum: '$totalRooms' },
            totalAvailable: { $sum: '$availableRooms' },
            totalSold: { $sum: '$soldRooms' },
            totalBlocked: { $sum: '$blockedRooms' },
            averageRate: { $avg: '$sellingRate' },
            stopSellDays: {
              $sum: { $cond: ['$stopSellFlag', 1, 0] }
            }
          }
        }
      ]);

      const stats = summary[0] || {
        totalInventoryDays: 0,
        totalRoomNights: 0,
        totalAvailable: 0,
        totalSold: 0,
        totalBlocked: 0,
        averageRate: 0,
        stopSellDays: 0
      };

      stats.occupancyRate = stats.totalRoomNights > 0 ? 
        ((stats.totalSold + stats.totalBlocked) / stats.totalRoomNights * 100).toFixed(2) : 0;
      
      stats.availabilityRate = stats.totalRoomNights > 0 ? 
        (stats.totalAvailable / stats.totalRoomNights * 100).toFixed(2) : 0;

      res.json({
        success: true,
        data: {
          summary: stats,
          dateRange: { startDate, endDate }
        }
      });

    } catch (error) {
      console.error('Error getting inventory summary:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Create inventory for date range
   */
  async createInventoryRange(req, res) {
    try {
      const { 
        hotelId, 
        roomTypeId, 
        startDate, 
        endDate, 
        baseRate,
        createMode = 'skip_existing' // 'skip_existing' | 'overwrite'
      } = req.body;

      if (!hotelId || !roomTypeId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID, room type ID, start date, and end date are required'
        });
      }

      const roomType = await RoomType.findById(roomTypeId);
      if (!roomType) {
        return res.status(404).json({
          success: false,
          message: 'Room type not found'
        });
      }

      const totalRooms = await Room.countDocuments({
        hotelId,
        roomTypeId,
        isActive: true
      });

      const inventoryRecords = [];
      const currentDate = new Date(startDate);
      const end = new Date(endDate);

      while (currentDate <= end) {
        const existing = await RoomAvailability.findOne({
          hotelId,
          roomTypeId,
          date: new Date(currentDate)
        });

        if (!existing || createMode === 'overwrite') {
          if (existing && createMode === 'overwrite') {
            await RoomAvailability.findByIdAndDelete(existing._id);
          }

          inventoryRecords.push({
            hotelId,
            roomTypeId,
            date: new Date(currentDate),
            totalRooms,
            availableRooms: totalRooms,
            soldRooms: 0,
            blockedRooms: 0,
            baseRate: baseRate || roomType.basePrice,
            sellingRate: baseRate || roomType.basePrice,
            currency: 'INR',
            needsSync: false
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (inventoryRecords.length > 0) {
        await RoomAvailability.insertMany(inventoryRecords);
      }

      await AuditLog.logChange({
        hotelId,
        tableName: 'RoomAvailability',
        recordId: `BULK_CREATE_${Date.now()}`,
        changeType: 'create',
        newValues: {
          roomTypeId,
          startDate,
          endDate,
          recordsCreated: inventoryRecords.length,
          createMode
        },
        userId: req.user?.id,
        userEmail: req.user?.email,
        source: 'bulk_create',
        metadata: {
          dateRange: `${startDate} to ${endDate}`,
          tags: ['inventory_creation', 'bulk_operation']
        }
      });

      res.json({
        success: true,
        data: {
          recordsCreated: inventoryRecords.length,
          roomTypeId,
          dateRange: { startDate, endDate },
          totalRooms,
          baseRate: baseRate || roomType.basePrice
        },
        message: `Created ${inventoryRecords.length} inventory records`
      });

    } catch (error) {
      console.error('Error creating inventory range:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new InventoryController();
