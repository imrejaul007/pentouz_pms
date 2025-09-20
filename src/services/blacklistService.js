import GuestBlacklist from '../models/GuestBlacklist.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

class BlacklistService {
  /**
   * Check if a guest is blacklisted
   */
  async checkGuestBlacklist(guestId, hotelId) {
    try {
      const blacklistEntry = await GuestBlacklist.isGuestBlacklisted(guestId, hotelId);
      return blacklistEntry;
    } catch (error) {
      throw new ApplicationError('Failed to check guest blacklist status', 500);
    }
  }

  /**
   * Add guest to blacklist
   */
  async addToBlacklist(blacklistData, createdBy, hotelId) {
    try {
      // Check if guest is already blacklisted
      const existingBlacklist = await GuestBlacklist.findOne({
        guestId: blacklistData.guestId,
        hotelId,
        isActive: true
      });

      if (existingBlacklist) {
        throw new ApplicationError('Guest is already blacklisted', 400);
      }

      // Validate guest exists
      const guest = await User.findById(blacklistData.guestId);
      if (!guest || guest.role !== 'guest') {
        throw new ApplicationError('Guest not found', 404);
      }

      // Create blacklist entry
      const blacklistEntry = await GuestBlacklist.create({
        ...blacklistData,
        hotelId,
        createdBy
      });

      await blacklistEntry.populate([
        { path: 'guestId', select: 'name email phone' },
        { path: 'createdBy', select: 'name email' }
      ]);

      return blacklistEntry;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to add guest to blacklist', 500);
    }
  }

  /**
   * Remove guest from blacklist
   */
  async removeFromBlacklist(blacklistId, updatedBy, reason) {
    try {
      const blacklistEntry = await GuestBlacklist.findById(blacklistId);
      
      if (!blacklistEntry) {
        throw new ApplicationError('Blacklist entry not found', 404);
      }

      blacklistEntry.isActive = false;
      blacklistEntry.updatedBy = updatedBy;
      if (reason) {
        blacklistEntry.appealNotes = reason;
      }
      
      await blacklistEntry.save();

      await blacklistEntry.populate([
        { path: 'guestId', select: 'name email phone' },
        { path: 'updatedBy', select: 'name email' }
      ]);

      return blacklistEntry;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to remove guest from blacklist', 500);
    }
  }

  /**
   * Update blacklist entry
   */
  async updateBlacklist(blacklistId, updateData, updatedBy) {
    try {
      const blacklistEntry = await GuestBlacklist.findByIdAndUpdate(
        blacklistId,
        { ...updateData, updatedBy },
        { new: true, runValidators: true }
      );

      if (!blacklistEntry) {
        throw new ApplicationError('Blacklist entry not found', 404);
      }

      await blacklistEntry.populate([
        { path: 'guestId', select: 'name email phone' },
        { path: 'updatedBy', select: 'name email' }
      ]);

      return blacklistEntry;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to update blacklist entry', 500);
    }
  }

  /**
   * Get blacklist entries with filtering
   */
  async getBlacklistEntries(filters = {}, options = {}) {
    try {
      const {
        hotelId,
        isActive,
        type,
        category,
        appealStatus,
        search,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      const query = { hotelId };

      if (isActive !== undefined) query.isActive = isActive;
      if (type) query.type = type;
      if (category) query.category = category;
      if (appealStatus) query.appealStatus = appealStatus;

      // Search functionality
      if (search) {
        const guestIds = await User.find({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } }
          ],
          role: 'guest'
        }).distinct('_id');

        query.guestId = { $in: guestIds };
      }

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const blacklistEntries = await GuestBlacklist.find(query)
        .populate('guestId', 'name email phone')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('reviewedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const total = await GuestBlacklist.countDocuments(query);

      return {
        entries: blacklistEntries,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        }
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch blacklist entries', 500);
    }
  }

  /**
   * Get blacklist statistics
   */
  async getBlacklistStatistics(hotelId) {
    try {
      const stats = await GuestBlacklist.getBlacklistStats(hotelId);
      return stats;
    } catch (error) {
      throw new ApplicationError('Failed to fetch blacklist statistics', 500);
    }
  }

  /**
   * Submit appeal for blacklist entry
   */
  async submitAppeal(blacklistId, appealNotes) {
    try {
      const blacklistEntry = await GuestBlacklist.findById(blacklistId);
      
      if (!blacklistEntry) {
        throw new ApplicationError('Blacklist entry not found', 404);
      }

      if (blacklistEntry.appealStatus === 'pending') {
        throw new ApplicationError('Appeal is already pending', 400);
      }

      if (blacklistEntry.appealStatus === 'approved') {
        throw new ApplicationError('Appeal has already been approved', 400);
      }

      await blacklistEntry.submitAppeal(appealNotes);

      await blacklistEntry.populate([
        { path: 'guestId', select: 'name email phone' }
      ]);

      return blacklistEntry;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to submit appeal', 500);
    }
  }

  /**
   * Review appeal
   */
  async reviewAppeal(blacklistId, status, reviewedBy, notes) {
    try {
      const blacklistEntry = await GuestBlacklist.findById(blacklistId);
      
      if (!blacklistEntry) {
        throw new ApplicationError('Blacklist entry not found', 404);
      }

      if (blacklistEntry.appealStatus !== 'pending') {
        throw new ApplicationError('No pending appeal found', 400);
      }

      await blacklistEntry.reviewAppeal(status, reviewedBy, notes);

      await blacklistEntry.populate([
        { path: 'guestId', select: 'name email phone' },
        { path: 'reviewedBy', select: 'name email' }
      ]);

      return blacklistEntry;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to review appeal', 500);
    }
  }

  /**
   * Auto-expire temporary blacklists
   */
  async autoExpireBlacklists(hotelId) {
    try {
      const expiredCount = await GuestBlacklist.autoExpireBlacklists(hotelId);
      return expiredCount;
    } catch (error) {
      throw new ApplicationError('Failed to auto-expire blacklists', 500);
    }
  }

  /**
   * Get expired blacklists
   */
  async getExpiredBlacklists(hotelId) {
    try {
      const expiredBlacklists = await GuestBlacklist.getExpiredBlacklists(hotelId);
      return expiredBlacklists;
    } catch (error) {
      throw new ApplicationError('Failed to fetch expired blacklists', 500);
    }
  }

  /**
   * Validate booking against blacklist
   */
  async validateBooking(guestId, hotelId, bookingData) {
    try {
      const blacklistEntry = await this.checkGuestBlacklist(guestId, hotelId);
      
      if (blacklistEntry) {
        return {
          isBlacklisted: true,
          blacklistEntry,
          canProceed: false,
          message: `Guest is blacklisted: ${blacklistEntry.reason}`
        };
      }

      return {
        isBlacklisted: false,
        canProceed: true,
        message: 'Guest is not blacklisted'
      };
    } catch (error) {
      throw new ApplicationError('Failed to validate booking against blacklist', 500);
    }
  }

  /**
   * Get blacklist history for a guest
   */
  async getGuestBlacklistHistory(guestId, hotelId) {
    try {
      const history = await GuestBlacklist.find({
        guestId,
        hotelId
      })
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 });

      return history;
    } catch (error) {
      throw new ApplicationError('Failed to fetch guest blacklist history', 500);
    }
  }

  /**
   * Bulk operations on blacklist
   */
  async bulkUpdateBlacklist(blacklistIds, updateData, updatedBy) {
    try {
      const result = await GuestBlacklist.updateMany(
        { _id: { $in: blacklistIds } },
        { ...updateData, updatedBy }
      );

      return {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      };
    } catch (error) {
      throw new ApplicationError('Failed to perform bulk update', 500);
    }
  }

  /**
   * Export blacklist data
   */
  async exportBlacklist(hotelId, format = 'csv') {
    try {
      const blacklistEntries = await GuestBlacklist.find({ hotelId })
        .populate('guestId', 'name email phone')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

      if (format === 'csv') {
        const csvHeader = 'Guest Name,Guest Email,Guest Phone,Reason,Type,Category,Incident Date,Expiry Date,Status,Appeal Status,Created By,Created At\n';
        const csvData = blacklistEntries.map(entry => {
          return [
            entry.guestId?.name || '',
            entry.guestId?.email || '',
            entry.guestId?.phone || '',
            entry.reason,
            entry.type,
            entry.category,
            entry.incidentDate?.toISOString().split('T')[0] || '',
            entry.expiryDate?.toISOString().split('T')[0] || '',
            entry.isActive ? 'Active' : 'Inactive',
            entry.appealStatus,
            entry.createdBy?.name || '',
            entry.createdAt.toISOString()
          ].join(',');
        }).join('\n');

        return csvHeader + csvData;
      }

      return blacklistEntries;
    } catch (error) {
      throw new ApplicationError('Failed to export blacklist data', 500);
    }
  }
}

export default new BlacklistService();
