import VIPGuest from '../models/VIPGuest.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

class VIPService {
  /**
   * Check if a guest is VIP
   */
  async checkVIPStatus(guestId, hotelId) {
    try {
      const vipGuest = await VIPGuest.findOne({
        guestId,
        hotelId,
        status: 'active'
      }).populate('guestId', 'name email phone');

      return vipGuest;
    } catch (error) {
      throw new ApplicationError('Failed to check VIP status', 500);
    }
  }

  /**
   * Add guest to VIP program
   */
  async addToVIP(vipData, createdBy, hotelId) {
    try {
      // Check if guest is already VIP
      const existingVIP = await VIPGuest.findOne({
        guestId: vipData.guestId,
        hotelId
      });

      if (existingVIP) {
        throw new ApplicationError('Guest is already in VIP program', 400);
      }

      // Validate guest exists
      const guest = await User.findById(vipData.guestId);
      if (!guest || guest.role !== 'guest') {
        throw new ApplicationError('Guest not found', 404);
      }

      // Auto-calculate VIP level if not provided
      if (!vipData.vipLevel && vipData.qualificationCriteria) {
        const tempVIP = new VIPGuest({ qualificationCriteria: vipData.qualificationCriteria });
        const calculatedLevel = tempVIP.calculateVIPLevel();
        if (calculatedLevel) {
          vipData.vipLevel = calculatedLevel;
        }
      }

      // Create VIP entry
      const vipGuest = await VIPGuest.create({
        ...vipData,
        hotelId,
        createdBy
      });

      await vipGuest.populate([
        { path: 'guestId', select: 'name email phone' },
        { path: 'createdBy', select: 'name email' }
      ]);

      return vipGuest;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to add guest to VIP program', 500);
    }
  }

  /**
   * Update VIP guest information
   */
  async updateVIP(vipId, updateData, updatedBy) {
    try {
      const vipGuest = await VIPGuest.findByIdAndUpdate(
        vipId,
        { ...updateData, updatedBy },
        { new: true, runValidators: true }
      );

      if (!vipGuest) {
        throw new ApplicationError('VIP guest not found', 404);
      }

      await vipGuest.populate([
        { path: 'guestId', select: 'name email phone' },
        { path: 'updatedBy', select: 'name email' },
        { path: 'assignedConcierge', select: 'name email' }
      ]);

      return vipGuest;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to update VIP guest', 500);
    }
  }

  /**
   * Remove guest from VIP program
   */
  async removeFromVIP(vipId, updatedBy, reason) {
    try {
      const vipGuest = await VIPGuest.findByIdAndUpdate(
        vipId,
        { 
          status: 'inactive',
          updatedBy,
          notes: reason ? `${vipGuest?.notes || ''}\nRemoved: ${reason}`.trim() : vipGuest?.notes
        },
        { new: true }
      );

      if (!vipGuest) {
        throw new ApplicationError('VIP guest not found', 404);
      }

      await vipGuest.populate([
        { path: 'guestId', select: 'name email phone' },
        { path: 'updatedBy', select: 'name email' }
      ]);

      return vipGuest;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to remove guest from VIP program', 500);
    }
  }

  /**
   * Get VIP guests with filtering
   */
  async getVIPGuests(filters = {}, options = {}) {
    try {
      const {
        hotelId,
        status,
        vipLevel,
        search,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      const query = { hotelId };

      if (status) query.status = status;
      if (vipLevel) query.vipLevel = vipLevel;

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

      const vipGuests = await VIPGuest.find(query)
        .populate('guestId', 'name email phone')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('assignedConcierge', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const total = await VIPGuest.countDocuments(query);

      return {
        vipGuests,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        }
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch VIP guests', 500);
    }
  }

  /**
   * Get VIP statistics
   */
  async getVIPStatistics(hotelId) {
    try {
      const stats = await VIPGuest.getVIPStatistics(hotelId);
      return stats;
    } catch (error) {
      throw new ApplicationError('Failed to fetch VIP statistics', 500);
    }
  }

  /**
   * Update VIP qualification criteria after stay
   */
  async updateQualificationAfterStay(guestId, hotelId, stayData) {
    try {
      const vipGuest = await VIPGuest.findOne({
        guestId,
        hotelId,
        status: 'active'
      });

      if (!vipGuest) {
        return null; // Guest is not VIP
      }

      await vipGuest.updateQualificationCriteria(stayData);

      // Check if VIP level should be upgraded
      const newLevel = vipGuest.calculateVIPLevel();
      if (newLevel && newLevel !== vipGuest.vipLevel) {
        vipGuest.vipLevel = newLevel;
        await vipGuest.save();
      }

      return vipGuest;
    } catch (error) {
      throw new ApplicationError('Failed to update VIP qualification', 500);
    }
  }

  /**
   * Auto-expire VIP statuses
   */
  async autoExpireVIPs(hotelId) {
    try {
      const expiredCount = await VIPGuest.autoExpireVIPs(hotelId);
      return expiredCount;
    } catch (error) {
      throw new ApplicationError('Failed to auto-expire VIPs', 500);
    }
  }

  /**
   * Get expiring VIPs
   */
  async getExpiringVIPs(hotelId, days = 30) {
    try {
      const expiringVIPs = await VIPGuest.getExpiringVIPs(hotelId, days);
      return expiringVIPs;
    } catch (error) {
      throw new ApplicationError('Failed to fetch expiring VIPs', 500);
    }
  }

  /**
   * Assign concierge to VIP guest
   */
  async assignConcierge(vipId, conciergeId, assignedBy) {
    try {
      // Validate concierge exists and has appropriate role
      const concierge = await User.findOne({
        _id: conciergeId,
        role: { $in: ['admin', 'manager', 'staff'] },
        hotelId: assignedBy.hotelId
      });

      if (!concierge) {
        throw new ApplicationError('Invalid concierge assignment', 400);
      }

      const vipGuest = await VIPGuest.findByIdAndUpdate(
        vipId,
        { 
          assignedConcierge: conciergeId,
          updatedBy: assignedBy._id
        },
        { new: true }
      );

      if (!vipGuest) {
        throw new ApplicationError('VIP guest not found', 404);
      }

      await vipGuest.populate([
        { path: 'guestId', select: 'name email phone' },
        { path: 'assignedConcierge', select: 'name email' }
      ]);

      return vipGuest;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ApplicationError('Failed to assign concierge', 500);
    }
  }

  /**
   * Get VIP benefits for a guest
   */
  async getVIPBenefits(guestId, hotelId) {
    try {
      const vipGuest = await VIPGuest.findOne({
        guestId,
        hotelId,
        status: 'active'
      });

      if (!vipGuest) {
        return null;
      }

      return {
        vipLevel: vipGuest.vipLevel,
        benefits: vipGuest.benefits,
        benefitSummary: vipGuest.getBenefitSummary(),
        assignedConcierge: vipGuest.assignedConcierge,
        specialRequests: vipGuest.specialRequests
      };
    } catch (error) {
      throw new ApplicationError('Failed to get VIP benefits', 500);
    }
  }

  /**
   * Validate VIP booking privileges
   */
  async validateVIPBooking(guestId, hotelId, bookingData) {
    try {
      const vipGuest = await this.checkVIPStatus(guestId, hotelId);
      
      if (!vipGuest) {
        return {
          isVIP: false,
          canProceed: true,
          message: 'Guest is not VIP'
        };
      }

      const benefits = vipGuest.getBenefitSummary();
      
      return {
        isVIP: true,
        vipLevel: vipGuest.vipLevel,
        benefits,
        canProceed: true,
        message: `VIP ${vipGuest.vipLevel} guest - ${benefits.length} benefits available`
      };
    } catch (error) {
      throw new ApplicationError('Failed to validate VIP booking', 500);
    }
  }

  /**
   * Get VIP guest history
   */
  async getVIPGuestHistory(guestId, hotelId) {
    try {
      const history = await VIPGuest.find({
        guestId,
        hotelId
      })
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('assignedConcierge', 'name email')
        .sort({ createdAt: -1 });

      return history;
    } catch (error) {
      throw new ApplicationError('Failed to fetch VIP guest history', 500);
    }
  }

  /**
   * Bulk operations on VIP guests
   */
  async bulkUpdateVIPGuests(vipIds, updateData, updatedBy) {
    try {
      const result = await VIPGuest.updateMany(
        { _id: { $in: vipIds } },
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
   * Export VIP data
   */
  async exportVIPData(hotelId, format = 'csv') {
    try {
      const vipGuests = await VIPGuest.find({ hotelId })
        .populate('guestId', 'name email phone')
        .populate('createdBy', 'name email')
        .populate('assignedConcierge', 'name email')
        .sort({ createdAt: -1 });

      if (format === 'csv') {
        const csvHeader = 'Guest Name,Guest Email,Guest Phone,VIP Level,Status,Total Stays,Total Nights,Total Spent,Average Rating,Assigned Concierge,Anniversary Date,Expiry Date,Created By,Created At\n';
        const csvData = vipGuests.map(vip => {
          return [
            vip.guestId?.name || '',
            vip.guestId?.email || '',
            vip.guestId?.phone || '',
            vip.vipLevel,
            vip.status,
            vip.qualificationCriteria.totalStays,
            vip.qualificationCriteria.totalNights,
            vip.qualificationCriteria.totalSpent,
            vip.qualificationCriteria.averageRating,
            vip.assignedConcierge?.name || '',
            vip.anniversaryDate?.toISOString().split('T')[0] || '',
            vip.expiryDate?.toISOString().split('T')[0] || '',
            vip.createdBy?.name || '',
            vip.createdAt.toISOString()
          ].join(',');
        }).join('\n');

        return csvHeader + csvData;
      }

      return vipGuests;
    } catch (error) {
      throw new ApplicationError('Failed to export VIP data', 500);
    }
  }

  /**
   * Get VIP level requirements
   */
  getVIPLevelRequirements() {
    return {
      bronze: {
        totalSpent: 2000,
        totalStays: 2,
        averageRating: 0,
        benefits: ['Priority Reservation', 'Welcome Amenities']
      },
      silver: {
        totalSpent: 5000,
        totalStays: 5,
        averageRating: 3.0,
        benefits: ['Room Upgrade', 'Late Checkout', '10% Dining Discount']
      },
      gold: {
        totalSpent: 10000,
        totalStays: 10,
        averageRating: 3.5,
        benefits: ['Early Check-in', 'Complimentary Breakfast', '15% Spa Discount']
      },
      platinum: {
        totalSpent: 25000,
        totalStays: 15,
        averageRating: 4.0,
        benefits: ['Spa Access', 'Concierge Service', 'Airport Transfer']
      },
      diamond: {
        totalSpent: 50000,
        totalStays: 20,
        averageRating: 4.5,
        benefits: ['All Benefits', 'Dedicated Concierge', '25% All Discounts']
      }
    };
  }
}

export default new VIPService();
