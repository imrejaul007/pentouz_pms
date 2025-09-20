import Counter from '../models/Counter.js';
import ArrivalDepartureMode from '../models/ArrivalDepartureMode.js';
import LostFound from '../models/LostFound.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

class OperationalManagementService {
  // Counter Management
  async createCounter(counterData, userId) {
    try {
      const counter = new Counter({
        ...counterData,
        createdBy: userId
      });

      await counter.save();

      // Log counter creation
      await AuditLog.logAction('counter_created', userId, {
        source: 'operational_management_service',
        counterId: counter._id,
        counterName: counter.name,
        counterType: counter.type
      });

      return counter;
    } catch (error) {
      console.error('Error creating counter:', error);
      throw error;
    }
  }

  async updateCounter(counterId, updateData, userId) {
    try {
      const counter = await Counter.findById(counterId);
      if (!counter) {
        throw new ApplicationError('Counter not found', 404);
      }

      Object.assign(counter, updateData);
      counter.updatedBy = userId;
      await counter.save();

      // Log counter update
      await AuditLog.logAction('counter_updated', userId, {
        source: 'operational_management_service',
        counterId: counter._id,
        counterName: counter.name,
        changes: updateData
      });

      return counter;
    } catch (error) {
      console.error('Error updating counter:', error);
      throw error;
    }
  }

  async getCounters(hotelId, type = null) {
    try {
      const filter = { hotelId, isActive: true };
      if (type) {
        filter.type = type;
      }

      return await Counter.find(filter)
        .sort({ type: 1, name: 1 })
        .populate('createdBy updatedBy', 'name email');
    } catch (error) {
      console.error('Error getting counters:', error);
      throw error;
    }
  }

  async updateCounterStatus(counterId, status, userId) {
    try {
      const counter = await Counter.findById(counterId);
      if (!counter) {
        throw new ApplicationError('Counter not found', 404);
      }

      const oldStatus = counter.status;
      counter.status = status;
      counter.updatedBy = userId;
      await counter.save();

      // Log status change
      await AuditLog.logAction('counter_status_updated', userId, {
        source: 'operational_management_service',
        counterId: counter._id,
        counterName: counter.name,
        oldStatus,
        newStatus: status
      });

      return counter;
    } catch (error) {
      console.error('Error updating counter status:', error);
      throw error;
    }
  }

  async deleteCounter(counterId, userId) {
    try {
      const counter = await Counter.findById(counterId);
      if (!counter) {
        throw new ApplicationError('Counter not found', 404);
      }

      counter.isActive = false;
      counter.updatedBy = userId;
      await counter.save();

      // Log counter deletion
      await AuditLog.logAction('counter_deleted', userId, {
        source: 'operational_management_service',
        counterId: counter._id,
        counterName: counter.name
      });

      return counter;
    } catch (error) {
      console.error('Error deleting counter:', error);
      throw error;
    }
  }

  // Arrival/Departure Mode Management
  async createArrivalDepartureMode(modeData, userId) {
    try {
      const mode = new ArrivalDepartureMode({
        ...modeData,
        createdBy: userId
      });

      await mode.save();

      // Log mode creation
      await AuditLog.logAction('arrival_departure_mode_created', userId, {
        source: 'operational_management_service',
        modeId: mode._id,
        modeName: mode.name,
        modeType: mode.type
      });

      return mode;
    } catch (error) {
      console.error('Error creating arrival/departure mode:', error);
      throw error;
    }
  }

  async updateArrivalDepartureMode(modeId, updateData, userId) {
    try {
      const mode = await ArrivalDepartureMode.findById(modeId);
      if (!mode) {
        throw new ApplicationError('Arrival/Departure mode not found', 404);
      }

      Object.assign(mode, updateData);
      mode.updatedBy = userId;
      await mode.save();

      // Log mode update
      await AuditLog.logAction('arrival_departure_mode_updated', userId, {
        source: 'operational_management_service',
        modeId: mode._id,
        modeName: mode.name,
        changes: updateData
      });

      return mode;
    } catch (error) {
      console.error('Error updating arrival/departure mode:', error);
      throw error;
    }
  }

  async getArrivalDepartureModes(hotelId, type = null, category = null) {
    try {
      const filter = { hotelId, isActive: true };
      if (type) {
        filter.type = type;
      }
      if (category) {
        filter.category = category;
      }

      return await ArrivalDepartureMode.find(filter)
        .sort({ category: 1, displayOrder: 1, name: 1 })
        .populate('createdBy updatedBy', 'name email');
    } catch (error) {
      console.error('Error getting arrival/departure modes:', error);
      throw error;
    }
  }

  async deleteArrivalDepartureMode(modeId, userId) {
    try {
      const mode = await ArrivalDepartureMode.findById(modeId);
      if (!mode) {
        throw new ApplicationError('Arrival/Departure mode not found', 404);
      }

      mode.isActive = false;
      mode.updatedBy = userId;
      await mode.save();

      // Log mode deletion
      await AuditLog.logAction('arrival_departure_mode_deleted', userId, {
        source: 'operational_management_service',
        modeId: mode._id,
        modeName: mode.name
      });

      return mode;
    } catch (error) {
      console.error('Error deleting arrival/departure mode:', error);
      throw error;
    }
  }

  // Lost & Found Management
  async createLostFoundItem(itemData, userId) {
    try {
      const item = new LostFound({
        ...itemData,
        createdBy: userId,
        'people.foundBy': userId
      });

      await item.save();

      // Log item creation
      await AuditLog.logAction('lost_found_item_created', userId, {
        source: 'operational_management_service',
        itemId: item._id,
        itemName: item.itemName,
        category: item.category
      });

      return item;
    } catch (error) {
      console.error('Error creating lost & found item:', error);
      throw error;
    }
  }

  async updateLostFoundItem(itemId, updateData, userId) {
    try {
      const item = await LostFound.findById(itemId);
      if (!item) {
        throw new ApplicationError('Lost & Found item not found', 404);
      }

      Object.assign(item, updateData);
      item.updatedBy = userId;
      await item.save();

      // Log item update
      await AuditLog.logAction('lost_found_item_updated', userId, {
        source: 'operational_management_service',
        itemId: item._id,
        itemName: item.itemName,
        changes: updateData
      });

      return item;
    } catch (error) {
      console.error('Error updating lost & found item:', error);
      throw error;
    }
  }

  async getLostFoundItems(hotelId, filters = {}) {
    try {
      const query = { hotelId };
      
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.category) {
        query.category = filters.category;
      }
      if (filters.priority) {
        query.priority = filters.priority;
      }
      if (filters.search) {
        query.$text = { $search: filters.search };
      }

      return await LostFound.find(query)
        .sort({ 'dates.foundDate': -1 })
        .populate('people.foundBy people.claimedBy people.reportedBy', 'name email')
        .populate('guest.guestId', 'name email phone');
    } catch (error) {
      console.error('Error getting lost & found items:', error);
      throw error;
    }
  }

  async claimLostFoundItem(itemId, claimedBy, notes, userId) {
    try {
      const item = await LostFound.findById(itemId);
      if (!item) {
        throw new ApplicationError('Lost & Found item not found', 404);
      }

      if (item.status !== 'found') {
        throw new ApplicationError('Item cannot be claimed in current status', 400);
      }

      await item.claimItem(claimedBy, notes);

      // Log item claim
      await AuditLog.logAction('lost_found_item_claimed', userId, {
        source: 'operational_management_service',
        itemId: item._id,
        itemName: item.itemName,
        claimedBy: claimedBy
      });

      return item;
    } catch (error) {
      console.error('Error claiming lost & found item:', error);
      throw error;
    }
  }

  async disposeLostFoundItem(itemId, notes, userId) {
    try {
      const item = await LostFound.findById(itemId);
      if (!item) {
        throw new ApplicationError('Lost & Found item not found', 404);
      }

      await item.disposeItem(userId, notes);

      // Log item disposal
      await AuditLog.logAction('lost_found_item_disposed', userId, {
        source: 'operational_management_service',
        itemId: item._id,
        itemName: item.itemName
      });

      return item;
    } catch (error) {
      console.error('Error disposing lost & found item:', error);
      throw error;
    }
  }

  async updateLostFoundItemLocation(itemId, newLocation, notes, userId) {
    try {
      const item = await LostFound.findById(itemId);
      if (!item) {
        throw new ApplicationError('Lost & Found item not found', 404);
      }

      await item.updateLocation(newLocation, userId, notes);

      // Log location update
      await AuditLog.logAction('lost_found_item_moved', userId, {
        source: 'operational_management_service',
        itemId: item._id,
        itemName: item.itemName,
        newLocation
      });

      return item;
    } catch (error) {
      console.error('Error updating lost & found item location:', error);
      throw error;
    }
  }

  // Analytics and Reporting
  async getOperationalOverview(hotelId) {
    try {
      const [counterStats, modeStats, lostFoundStats] = await Promise.all([
        Counter.countDocuments({ hotelId, isActive: true }),
        ArrivalDepartureMode.countDocuments({ hotelId, isActive: true }),
        LostFound.countDocuments({ hotelId })
      ]);

      const [availableCounters, foundItems, claimedItems] = await Promise.all([
        Counter.countDocuments({ hotelId, isActive: true, status: 'available' }),
        LostFound.countDocuments({ hotelId, status: 'found' }),
        LostFound.countDocuments({ hotelId, status: 'claimed' })
      ]);

      return {
        summary: {
          totalCounters: counterStats,
          availableCounters,
          totalModes: modeStats,
          totalLostFoundItems: lostFoundStats,
          foundItems,
          claimedItems
        }
      };
    } catch (error) {
      console.error('Error getting operational overview:', error);
      throw error;
    }
  }

  async getCounterAnalytics(hotelId, dateRange) {
    try {
      return await Counter.getCounterAnalytics(hotelId, dateRange);
    } catch (error) {
      console.error('Error getting counter analytics:', error);
      throw error;
    }
  }

  async getModeAnalytics(hotelId, dateRange) {
    try {
      return await ArrivalDepartureMode.getModeAnalytics(hotelId, dateRange);
    } catch (error) {
      console.error('Error getting mode analytics:', error);
      throw error;
    }
  }

  async getLostFoundAnalytics(hotelId, dateRange) {
    try {
      return await LostFound.getLostFoundAnalytics(hotelId, dateRange);
    } catch (error) {
      console.error('Error getting lost & found analytics:', error);
      throw error;
    }
  }

  async getExpiredLostFoundItems(hotelId) {
    try {
      return await LostFound.getExpiredItems(hotelId);
    } catch (error) {
      console.error('Error getting expired lost & found items:', error);
      throw error;
    }
  }

  async getValuableLostFoundItems(hotelId) {
    try {
      return await LostFound.getValuableItems(hotelId);
    } catch (error) {
      console.error('Error getting valuable lost & found items:', error);
      throw error;
    }
  }

  // Bulk Operations
  async bulkUpdateCounterStatus(updates, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const results = [];

      for (const update of updates) {
        const { counterId, status } = update;
        const counter = await Counter.findByIdAndUpdate(
          counterId,
          { status, updatedBy: userId },
          { new: true, session }
        );

        if (counter) {
          results.push(counter);

          // Log status update
          await AuditLog.logAction('counter_status_updated', userId, {
            source: 'operational_management_service',
            counterId: counter._id,
            counterName: counter.name,
            newStatus: status
          });
        }
      }

      await session.commitTransaction();
      return results;
    } catch (error) {
      await session.abortTransaction();
      console.error('Error bulk updating counter status:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async bulkDisposeExpiredItems(notes, userId) {
    try {
      const expiredItems = await LostFound.getExpiredItems(userId);
      const results = [];

      for (const item of expiredItems) {
        await item.disposeItem(userId, notes);
        results.push(item);

        // Log disposal
        await AuditLog.logAction('lost_found_item_disposed', userId, {
          source: 'operational_management_service',
          itemId: item._id,
          itemName: item.itemName,
          reason: 'Expired'
        });
      }

      return results;
    } catch (error) {
      console.error('Error bulk disposing expired items:', error);
      throw error;
    }
  }
}

export const operationalManagementService = new OperationalManagementService();
