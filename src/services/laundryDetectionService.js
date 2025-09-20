import LaundryTemplate from '../models/LaundryTemplate.js';
import RoomInventory from '../models/RoomInventory.js';
import InventoryItem from '../models/InventoryItem.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import logger from '../utils/logger.js';

/**
 * Laundry Detection Service
 * 
 * Enhanced service for automatically detecting and processing laundry items
 * during checkout. Uses templates and intelligent algorithms to determine
 * appropriate laundry quantities and processing requirements.
 */
class LaundryDetectionService {
  constructor() {
    this.seasonalMultipliers = {
      summer: { towels: 1.3, bedding: 1.1, bathrobes: 1.2 },
      winter: { towels: 1.1, bedding: 1.3, bathrobes: 1.4 },
      monsoon: { towels: 1.4, bedding: 1.2, bathrobes: 1.3 },
      normal: { towels: 1.0, bedding: 1.0, bathrobes: 1.0 }
    };
  }

  /**
   * Detect laundry items for a booking using templates and intelligent algorithms
   * @param {string} bookingId - Booking ID
   * @param {Object} options - Detection options
   */
  async detectLaundryItems(bookingId, options = {}) {
    try {
      logger.info('Starting laundry detection', { bookingId, options });

      const booking = await Booking.findById(bookingId).populate('rooms.roomId');
      if (!booking) {
        throw new Error('Booking not found');
      }

      const results = [];
      
      for (const roomBooking of booking.rooms) {
        const roomId = roomBooking.roomId._id;
        const roomType = roomBooking.roomId.type;
        
        try {
          const roomResult = await this.detectLaundryForRoom(
            roomId,
            roomType,
            booking,
            options
          );
          
          results.push({
            roomId,
            roomNumber: roomBooking.roomId.roomNumber,
            roomType,
            success: true,
            ...roomResult
          });
        } catch (error) {
          logger.error('Laundry detection failed for room', {
            roomId,
            bookingId,
            error: error.message
          });
          
          results.push({
            roomId,
            roomNumber: roomBooking.roomId.roomNumber,
            roomType,
            success: false,
            error: error.message
          });
        }
      }

      const overallSuccess = results.every(r => r.success);
      
      logger.info('Laundry detection completed', {
        bookingId,
        success: overallSuccess,
        totalRooms: results.length,
        successfulRooms: results.filter(r => r.success).length
      });

      return {
        success: overallSuccess,
        bookingId,
        results,
        summary: this.generateSummary(results)
      };

    } catch (error) {
      logger.error('Laundry detection failed', {
        bookingId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Detect laundry items for a specific room
   * @param {string} roomId - Room ID
   * @param {string} roomType - Room type
   * @param {Object} booking - Booking object
   * @param {Object} options - Detection options
   */
  async detectLaundryForRoom(roomId, roomType, booking, options = {}) {
    // Get laundry template for room type
    const template = await LaundryTemplate.getForRoomType(booking.hotelId, roomType);
    
    if (!template) {
      logger.warn('No laundry template found for room type', {
        roomType,
        hotelId: booking.hotelId
      });
      return this.fallbackDetection(roomId, roomType, booking, options);
    }

    // Get room inventory to check current items
    const roomInventory = await RoomInventory.findOne({ roomId });
    
    // Determine guest count for this room
    const guestCount = this.calculateGuestCountForRoom(booking, roomId);
    
    // Determine season and room condition
    const season = this.determineSeason();
    const roomCondition = await this.assessRoomCondition(roomId, roomInventory, options);
    
    // Calculate laundry items using template
    const templateItems = template.calculateLaundryItems(guestCount, season, roomCondition);
    
    // Enhance with room inventory data
    const enhancedItems = await this.enhanceWithInventoryData(templateItems, roomInventory);
    
    // Apply intelligent adjustments
    const finalItems = await this.applyIntelligentAdjustments(
      enhancedItems,
      booking,
      roomId,
      options
    );

    // Calculate costs and timing
    const costAnalysis = this.calculateCostAnalysis(finalItems);
    const timingAnalysis = this.calculateTimingAnalysis(finalItems, template);

    // Update template usage statistics
    await template.updateUsageStats(0.5); // Assume 30 minutes processing time

    return {
      templateUsed: template.templateName,
      guestCount,
      season,
      roomCondition,
      items: finalItems,
      costAnalysis,
      timingAnalysis,
      detectionMethod: 'template_based'
    };
  }

  /**
   * Fallback detection when no template is available
   * @param {string} roomId - Room ID
   * @param {string} roomType - Room type
   * @param {Object} booking - Booking object
   * @param {Object} options - Detection options
   */
  async fallbackDetection(roomId, roomType, booking, options = {}) {
    logger.info('Using fallback laundry detection', { roomId, roomType });

    const roomInventory = await RoomInventory.findOne({ roomId });
    const guestCount = this.calculateGuestCountForRoom(booking, roomId);
    
    // Use default quantities based on room type and guest count
    const defaultItems = this.getDefaultLaundryItems(roomType, guestCount);
    
    // Enhance with actual room inventory
    const enhancedItems = await this.enhanceWithInventoryData(defaultItems, roomInventory);
    
    return {
      templateUsed: 'Fallback Detection',
      guestCount,
      season: 'normal',
      roomCondition: 'normal',
      items: enhancedItems,
      costAnalysis: this.calculateCostAnalysis(enhancedItems),
      timingAnalysis: this.calculateTimingAnalysis(enhancedItems),
      detectionMethod: 'fallback'
    };
  }

  /**
   * Calculate guest count for a specific room
   * @param {Object} booking - Booking object
   * @param {string} roomId - Room ID
   */
  calculateGuestCountForRoom(booking, roomId) {
    // For now, distribute guests evenly across rooms
    // In a more sophisticated system, this could be based on room assignments
    const totalGuests = booking.guestDetails.adults + booking.guestDetails.children;
    const totalRooms = booking.rooms.length;
    
    return Math.ceil(totalGuests / totalRooms);
  }

  /**
   * Determine current season for seasonal adjustments
   */
  determineSeason() {
    const month = new Date().getMonth() + 1; // 1-12
    
    if (month >= 3 && month <= 5) {
      return 'summer';
    } else if (month >= 6 && month <= 9) {
      return 'monsoon';
    } else if (month >= 10 && month <= 2) {
      return 'winter';
    }
    
    return 'normal';
  }

  /**
   * Assess room condition based on inventory and usage
   * @param {string} roomId - Room ID
   * @param {Object} roomInventory - Room inventory data
   * @param {Object} options - Assessment options
   */
  async assessRoomCondition(roomId, roomInventory, options = {}) {
    // Default to normal condition
    let condition = 'normal';
    
    if (roomInventory) {
      // Check for damaged or missing items
      const damagedItems = roomInventory.items.filter(item => 
        item.condition === 'damaged' || item.condition === 'missing'
      );
      
      const wornItems = roomInventory.items.filter(item => 
        item.condition === 'worn'
      );
      
      if (damagedItems.length > 0) {
        condition = 'damaged';
      } else if (wornItems.length > 2) {
        condition = 'dirty';
      }
    }
    
    // Override with options if provided
    if (options.roomCondition) {
      condition = options.roomCondition;
    }
    
    return condition;
  }

  /**
   * Get default laundry items when no template is available
   * @param {string} roomType - Room type
   * @param {number} guestCount - Number of guests
   */
  getDefaultLaundryItems(roomType, guestCount) {
    const baseItems = {
      standard: [
        { category: 'bedding', baseQuantity: 2, guestMultiplier: 1 },
        { category: 'towels', baseQuantity: 4, guestMultiplier: 1.5 }
      ],
      deluxe: [
        { category: 'bedding', baseQuantity: 3, guestMultiplier: 1 },
        { category: 'towels', baseQuantity: 6, guestMultiplier: 1.5 },
        { category: 'bathrobes', baseQuantity: 2, guestMultiplier: 1 }
      ],
      suite: [
        { category: 'bedding', baseQuantity: 4, guestMultiplier: 1 },
        { category: 'towels', baseQuantity: 8, guestMultiplier: 1.5 },
        { category: 'bathrobes', baseQuantity: 4, guestMultiplier: 1 },
        { category: 'curtains', baseQuantity: 1, guestMultiplier: 1 }
      ],
      presidential: [
        { category: 'bedding', baseQuantity: 6, guestMultiplier: 1 },
        { category: 'towels', baseQuantity: 12, guestMultiplier: 1.5 },
        { category: 'bathrobes', baseQuantity: 6, guestMultiplier: 1 },
        { category: 'curtains', baseQuantity: 2, guestMultiplier: 1 }
      ]
    };

    const items = baseItems[roomType] || baseItems.standard;
    
    return items.map(item => {
      const quantity = Math.ceil(item.baseQuantity * item.guestMultiplier * Math.max(1, guestCount / 2));
      
      return {
        itemName: `${item.category.charAt(0).toUpperCase() + item.category.slice(1)}`,
        category: item.category,
        quantity: Math.max(1, quantity),
        baseQuantity: item.baseQuantity,
        guestMultiplier: item.guestMultiplier,
        isRequired: true,
        defaultReturnDays: 1,
        priority: 'medium',
        estimatedCost: 0
      };
    });
  }

  /**
   * Enhance template items with actual room inventory data
   * @param {Array} templateItems - Items from template
   * @param {Object} roomInventory - Room inventory data
   */
  async enhanceWithInventoryData(templateItems, roomInventory) {
    if (!roomInventory) {
      return templateItems;
    }

    const enhancedItems = [];
    
    for (const templateItem of templateItems) {
      // Find corresponding item in room inventory
      const inventoryItem = roomInventory.items.find(item => 
        item.itemId.category === templateItem.category
      );
      
      if (inventoryItem) {
        // Get item details from inventory
        const itemDetails = await InventoryItem.findById(inventoryItem.itemId);
        
        enhancedItems.push({
          ...templateItem,
          itemId: inventoryItem.itemId._id,
          itemName: itemDetails?.name || templateItem.itemName,
          currentQuantity: inventoryItem.currentQuantity,
          expectedQuantity: inventoryItem.expectedQuantity,
          condition: inventoryItem.condition,
          needsReplacement: inventoryItem.needsReplacement,
          replacementReason: inventoryItem.replacementReason,
          costPerItem: itemDetails?.unitPrice || 0,
          estimatedCost: (itemDetails?.unitPrice || 0) * templateItem.quantity
        });
      } else {
        // Keep template item as-is if not found in inventory
        enhancedItems.push(templateItem);
      }
    }
    
    return enhancedItems;
  }

  /**
   * Apply intelligent adjustments based on booking context
   * @param {Array} items - Laundry items
   * @param {Object} booking - Booking object
   * @param {string} roomId - Room ID
   * @param {Object} options - Adjustment options
   */
  async applyIntelligentAdjustments(items, booking, roomId, options = {}) {
    const adjustedItems = [...items];
    
    // Adjust based on length of stay
    const stayLength = this.calculateStayLength(booking);
    if (stayLength > 7) {
      // Longer stays may need more frequent laundry
      adjustedItems.forEach(item => {
        if (item.category === 'towels' || item.category === 'bedding') {
          item.quantity = Math.ceil(item.quantity * 1.2);
        }
      });
    }
    
    // Adjust based on special requests
    if (booking.guestDetails.specialRequests) {
      const specialRequests = booking.guestDetails.specialRequests.toLowerCase();
      
      if (specialRequests.includes('extra towels') || specialRequests.includes('additional towels')) {
        adjustedItems.forEach(item => {
          if (item.category === 'towels') {
            item.quantity = Math.ceil(item.quantity * 1.5);
            item.specialInstructions = (item.specialInstructions || '') + ' Extra towels requested by guest.';
          }
        });
      }
      
      if (specialRequests.includes('allergy') || specialRequests.includes('sensitive')) {
        adjustedItems.forEach(item => {
          item.specialInstructions = (item.specialInstructions || '') + ' Guest has allergies - use hypoallergenic detergent.';
          item.priority = 'high';
        });
      }
    }
    
    // Adjust based on room condition
    if (options.roomCondition === 'very_dirty') {
      adjustedItems.forEach(item => {
        item.quantity = Math.ceil(item.quantity * 1.3);
        item.specialInstructions = (item.specialInstructions || '') + ' Room requires deep cleaning.';
      });
    }
    
    return adjustedItems;
  }

  /**
   * Calculate stay length in days
   * @param {Object} booking - Booking object
   */
  calculateStayLength(booking) {
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    return Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate cost analysis for laundry items
   * @param {Array} items - Laundry items
   */
  calculateCostAnalysis(items) {
    const totalCost = items.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    
    return {
      totalCost,
      itemCount,
      averageCostPerItem: itemCount > 0 ? totalCost / itemCount : 0,
      costBreakdown: items.map(item => ({
        category: item.category,
        quantity: item.quantity,
        costPerItem: item.costPerItem || 0,
        totalCost: item.estimatedCost || 0
      }))
    };
  }

  /**
   * Calculate timing analysis for laundry processing
   * @param {Array} items - Laundry items
   * @param {Object} template - Laundry template (optional)
   */
  calculateTimingAnalysis(items, template = null) {
    const urgentItems = items.filter(item => item.priority === 'urgent');
    const highPriorityItems = items.filter(item => item.priority === 'high');
    const standardItems = items.filter(item => item.priority === 'medium' || !item.priority);
    
    // Calculate processing time based on item count and priority
    let estimatedHours = 0;
    estimatedHours += urgentItems.length * 0.5; // 30 minutes per urgent item
    estimatedHours += highPriorityItems.length * 0.25; // 15 minutes per high priority item
    estimatedHours += standardItems.length * 0.1; // 6 minutes per standard item
    
    // Minimum processing time
    estimatedHours = Math.max(0.5, estimatedHours);
    
    return {
      estimatedProcessingHours: estimatedHours,
      estimatedProcessingMinutes: Math.ceil(estimatedHours * 60),
      urgentItemsCount: urgentItems.length,
      highPriorityItemsCount: highPriorityItems.length,
      standardItemsCount: standardItems.length,
      recommendedReturnDays: this.calculateRecommendedReturnDays(items, template)
    };
  }

  /**
   * Calculate recommended return days based on items and template
   * @param {Array} items - Laundry items
   * @param {Object} template - Laundry template (optional)
   */
  calculateRecommendedReturnDays(items, template = null) {
    if (template && template.items.length > 0) {
      // Use template's default return days
      const maxReturnDays = Math.max(...template.items.map(item => item.defaultReturnDays));
      return maxReturnDays;
    }
    
    // Calculate based on item categories
    const categoryReturnDays = {
      bedding: 1,
      towels: 1,
      bathrobes: 2,
      curtains: 3,
      carpets: 5
    };
    
    const maxReturnDays = Math.max(...items.map(item => 
      categoryReturnDays[item.category] || 1
    ));
    
    return maxReturnDays;
  }

  /**
   * Generate summary of detection results
   * @param {Array} results - Detection results for all rooms
   */
  generateSummary(results) {
    const successfulResults = results.filter(r => r.success);
    const totalItems = successfulResults.reduce((sum, r) => sum + (r.items?.length || 0), 0);
    const totalCost = successfulResults.reduce((sum, r) => sum + (r.costAnalysis?.totalCost || 0), 0);
    const totalProcessingTime = successfulResults.reduce((sum, r) => sum + (r.timingAnalysis?.estimatedProcessingHours || 0), 0);
    
    return {
      totalRooms: results.length,
      successfulRooms: successfulResults.length,
      failedRooms: results.length - successfulResults.length,
      totalItems,
      totalCost,
      totalProcessingTimeHours: totalProcessingTime,
      totalProcessingTimeMinutes: Math.ceil(totalProcessingTime * 60),
      averageItemsPerRoom: successfulResults.length > 0 ? totalItems / successfulResults.length : 0,
      averageCostPerRoom: successfulResults.length > 0 ? totalCost / successfulResults.length : 0
    };
  }

  /**
   * Get laundry detection statistics for a hotel
   * @param {string} hotelId - Hotel ID
   * @param {Object} dateRange - Date range for statistics
   */
  async getDetectionStatistics(hotelId, dateRange = {}) {
    // This would typically query the CheckoutAutomationLog for statistics
    // For now, return basic template usage statistics
    
    const templates = await LaundryTemplate.find({ hotelId, isActive: true });
    
    const statistics = {
      totalTemplates: templates.length,
      templatesByRoomType: {},
      averageUsage: 0,
      mostUsedTemplate: null
    };
    
    let totalUsage = 0;
    let maxUsage = 0;
    
    templates.forEach(template => {
      const usage = template.usageStats.timesUsed || 0;
      totalUsage += usage;
      
      if (usage > maxUsage) {
        maxUsage = usage;
        statistics.mostUsedTemplate = template.templateName;
      }
      
      if (!statistics.templatesByRoomType[template.roomType]) {
        statistics.templatesByRoomType[template.roomType] = 0;
      }
      statistics.templatesByRoomType[template.roomType] += usage;
    });
    
    statistics.averageUsage = templates.length > 0 ? totalUsage / templates.length : 0;
    
    return statistics;
  }
}

export default new LaundryDetectionService();
