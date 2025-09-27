import mongoose from 'mongoose';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import PropertyGroup from '../models/PropertyGroup.js';
import logger from '../utils/logger.js';

/**
 * Property Room Service - Handles integrated property and room management
 */
class PropertyRoomService {
  /**
   * Create a property with associated rooms in a single transaction
   * Supports PropertyGroup integration for multi-property management
   */
  async createPropertyWithRooms(propertyData, roomsConfig) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      logger.info('Starting property creation with rooms', {
        propertyName: propertyData.name,
        propertyGroupId: propertyData.propertyGroupId,
        roomsConfig
      });

      // 1. Validate PropertyGroup if provided
      if (propertyData.propertyGroupId) {
        const propertyGroup = await PropertyGroup.findById(propertyData.propertyGroupId).session(session);
        if (!propertyGroup) {
          throw new Error('Property Group not found');
        }
        logger.info('Property will be added to group', {
          groupId: propertyGroup._id,
          groupName: propertyGroup.name
        });
      }

      // 2. Prepare property data with PropertyGroup integration
      const hotelData = {
        ...propertyData,
        roomCount: this.calculateTotalRooms(roomsConfig)
      };

      // Set PropertyGroup settings inheritance if applicable
      if (propertyData.propertyGroupId) {
        hotelData.groupSettings = {
          inheritSettings: true,
          lastSyncAt: new Date(),
          version: new Date()
        };
      }

      // 3. Create the property (hotel)
      const property = await Hotel.create([hotelData], { session });

      const propertyId = property[0]._id;
      logger.info('Property created', {
        propertyId,
        name: property[0].name,
        propertyGroupId: property[0].propertyGroupId
      });

      // 4. Generate rooms based on configuration
      if (roomsConfig && Object.keys(roomsConfig.roomTypes || {}).length > 0) {
        const rooms = await this.generateRooms(propertyId, roomsConfig);

        if (rooms.length > 0) {
          await Room.insertMany(rooms, { session });
          logger.info('Rooms created', {
            propertyId,
            roomCount: rooms.length,
            roomTypes: Object.keys(roomsConfig.roomTypes)
          });
        }
      }

      // 5. Update PropertyGroup metrics if property belongs to a group
      if (propertyData.propertyGroupId) {
        const propertyGroup = await PropertyGroup.findById(propertyData.propertyGroupId).session(session);
        if (propertyGroup) {
          // Update metrics without awaiting to avoid blocking transaction
          setImmediate(async () => {
            try {
              await propertyGroup.updateMetrics();
              logger.info('PropertyGroup metrics updated', {
                groupId: propertyGroup._id,
                newPropertyId: propertyId
              });
            } catch (error) {
              logger.warn('Failed to update PropertyGroup metrics', {
                groupId: propertyGroup._id,
                error: error.message
              });
            }
          });
        }
      }

      await session.commitTransaction();
      logger.info('Property and rooms created successfully', {
        propertyId,
        propertyGroupId: propertyData.propertyGroupId
      });

      return {
        property: property[0],
        roomsCreated: this.calculateTotalRooms(roomsConfig)
      };

    } catch (error) {
      await session.abortTransaction();
      logger.error('Error creating property with rooms', {
        error: error.message,
        propertyData: propertyData.name
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Generate room records based on configuration
   */
  async generateRooms(propertyId, roomsConfig) {
    const {
      roomTypes = {},
      numberingPattern = 'sequential',
      startingNumber = 100,
      floorPlan = null
    } = roomsConfig;

    const rooms = [];
    let currentNumber = startingNumber;

    // Get room type templates for default configurations
    const roomTypeTemplates = await this.getRoomTypeTemplates();

    for (const [typeName, typeConfig] of Object.entries(roomTypes)) {
      const { count, basePrice, amenities = [], size = 0 } = typeConfig;

      // Get or create room type
      const roomType = await this.getOrCreateRoomType(propertyId, typeName, {
        basePrice,
        amenities,
        size
      });

      // Generate individual rooms
      for (let i = 0; i < count; i++) {
        const roomNumber = this.generateRoomNumber(
          currentNumber,
          numberingPattern,
          floorPlan,
          typeName
        );

        rooms.push({
          hotelId: propertyId,
          roomNumber: roomNumber,
          roomTypeId: roomType._id,
          type: this.mapRoomTypeToEnum(typeName),
          status: 'vacant',
          baseRate: basePrice || 0,
          currentRate: basePrice || 0,
          amenities: amenities || [],
          capacity: this.getDefaultCapacity(typeName),
          floor: this.extractFloor(roomNumber, numberingPattern),
          isActive: true,
          description: `${typeName} room ${roomNumber}`
        });

        currentNumber++;
      }
    }

    return rooms;
  }

  /**
   * Create bulk rooms for an existing property
   */
  async createBulkRooms(propertyId, roomsConfig) {
    try {
      logger.info('Creating bulk rooms for property', { propertyId, roomsConfig });

      // Validate property exists
      const property = await Hotel.findById(propertyId);
      if (!property) {
        throw new Error('Property not found');
      }

      // Generate rooms
      const rooms = await this.generateRooms(propertyId, roomsConfig);

      if (rooms.length === 0) {
        return { rooms: [], message: 'No rooms to create' };
      }

      // Create rooms
      const createdRooms = await Room.insertMany(rooms);

      // Update property room count
      await Hotel.findByIdAndUpdate(propertyId, {
        $inc: { roomCount: rooms.length }
      });

      logger.info('Bulk rooms created successfully', {
        propertyId,
        roomsCreated: createdRooms.length
      });

      return {
        rooms: createdRooms,
        message: `Successfully created ${createdRooms.length} rooms`
      };

    } catch (error) {
      logger.error('Error creating bulk rooms', {
        propertyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all rooms for a property with detailed information
   */
  async getPropertyRooms(propertyId, filters = {}) {
    try {
      const {
        status = null,
        type = null,
        floor = null,
        available = null,
        page = 1,
        limit = 50
      } = filters;

      const query = { hotelId: propertyId };

      // Apply filters
      if (status) query.status = status;
      if (type) query.type = type;
      if (floor) query.floor = floor;
      if (available !== null) {
        query.effectiveStatus = available ? 'available' : { $ne: 'available' };
      }

      const rooms = await Room.find(query)
        .populate('type', 'name basePrice amenities')
        .sort({ number: 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await Room.countDocuments(query);

      return {
        rooms,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      };

    } catch (error) {
      logger.error('Error fetching property rooms', {
        propertyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update multiple rooms at once
   */
  async updateBulkRooms(propertyId, updates) {
    try {
      const { roomIds, updateData } = updates;

      if (!roomIds || roomIds.length === 0) {
        throw new Error('No rooms specified for update');
      }

      const result = await Room.updateMany(
        {
          _id: { $in: roomIds },
          hotelId: propertyId
        },
        updateData
      );

      logger.info('Bulk room update completed', {
        propertyId,
        roomsUpdated: result.modifiedCount,
        updateData
      });

      return {
        modifiedCount: result.modifiedCount,
        message: `Updated ${result.modifiedCount} rooms`
      };

    } catch (error) {
      logger.error('Error updating bulk rooms', {
        propertyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get property room statistics
   */
  async getPropertyRoomStats(propertyId) {
    try {
      const stats = await Room.aggregate([
        { $match: { hotelId: new mongoose.Types.ObjectId(propertyId) } },
        {
          $group: {
            _id: null,
            totalRooms: { $sum: 1 },
            availableRooms: {
              $sum: { $cond: [{ $eq: ['$effectiveStatus', 'available'] }, 1, 0] }
            },
            occupiedRooms: {
              $sum: { $cond: [{ $eq: ['$effectiveStatus', 'occupied'] }, 1, 0] }
            },
            maintenanceRooms: {
              $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] }
            },
            outOfOrderRooms: {
              $sum: { $cond: [{ $eq: ['$status', 'out-of-order'] }, 1, 0] }
            }
          }
        }
      ]);

      const roomTypeStats = await Room.aggregate([
        { $match: { hotelId: new mongoose.Types.ObjectId(propertyId) } },
        {
          $lookup: {
            from: 'roomtypes',
            localField: 'type',
            foreignField: '_id',
            as: 'typeInfo'
          }
        },
        { $unwind: '$typeInfo' },
        {
          $group: {
            _id: '$typeInfo.name',
            count: { $sum: 1 },
            available: {
              $sum: { $cond: [{ $eq: ['$effectiveStatus', 'available'] }, 1, 0] }
            },
            occupied: {
              $sum: { $cond: [{ $eq: ['$effectiveStatus', 'occupied'] }, 1, 0] }
            }
          }
        }
      ]);

      return {
        overall: stats[0] || {
          totalRooms: 0,
          availableRooms: 0,
          occupiedRooms: 0,
          maintenanceRooms: 0,
          outOfOrderRooms: 0
        },
        byType: roomTypeStats
      };

    } catch (error) {
      logger.error('Error fetching property room stats', {
        propertyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get available property groups for the user
   */
  async getAvailablePropertyGroups(userId) {
    try {
      const propertyGroups = await PropertyGroup.find({
        $or: [
          { ownerId: userId },
          { 'permissions.allowNewProperties': true }
        ],
        status: 'active'
      }).select('name description groupType settings.brandGuidelines').lean();

      logger.info('Retrieved property groups for user', {
        userId,
        groupCount: propertyGroups.length
      });

      return propertyGroups;
    } catch (error) {
      logger.error('Error fetching property groups', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  // Helper methods

  calculateTotalRooms(roomsConfig) {
    if (!roomsConfig || !roomsConfig.roomTypes) return 0;

    return Object.values(roomsConfig.roomTypes)
      .reduce((total, config) => total + (config.count || 0), 0);
  }

  generateRoomNumber(currentNumber, pattern, floorPlan, roomType) {
    switch (pattern) {
      case 'floor-based':
        // Generate numbers like 101, 102, 201, 202, etc.
        const floor = Math.floor((currentNumber - 100) / 10) + 1;
        const roomOnFloor = ((currentNumber - 100) % 10) + 1;
        return `${floor}${roomOnFloor.toString().padStart(2, '0')}`;

      case 'type-based':
        // Generate numbers with type prefix: S101, D201, ST301
        const typePrefix = this.getTypePrefix(roomType);
        return `${typePrefix}${currentNumber}`;

      case 'custom':
        // Custom pattern based on floor plan
        if (floorPlan && floorPlan.pattern) {
          return floorPlan.pattern.replace('{number}', currentNumber);
        }
        return currentNumber.toString();

      case 'sequential':
      default:
        return currentNumber.toString();
    }
  }

  getTypePrefix(roomType) {
    const prefixes = {
      single: 'S',
      double: 'D',
      suite: 'ST',
      deluxe: 'DX',
      executive: 'EX',
      presidential: 'PS'
    };
    return prefixes[roomType.toLowerCase()] || 'R';
  }

  mapRoomTypeToEnum(typeName) {
    const mapping = {
      'standard': 'single',
      'single': 'single',
      'double': 'double',
      'deluxe': 'deluxe',
      'suite': 'suite',
      'executive': 'suite',
      'presidential': 'suite'
    };
    return mapping[typeName.toLowerCase()] || 'double';
  }

  extractFloor(roomNumber, pattern) {
    if (pattern === 'floor-based') {
      return parseInt(roomNumber.toString().charAt(0)) || 1;
    }
    // Default floor extraction for other patterns
    return Math.floor(parseInt(roomNumber) / 100) || 1;
  }

  getDefaultCapacity(roomType) {
    const capacities = {
      single: 1,
      double: 2,
      suite: 4,
      deluxe: 2,
      executive: 3,
      presidential: 6
    };
    return capacities[roomType.toLowerCase()] || 2;
  }

  getDefaultSize(roomType) {
    const sizes = {
      single: 25,
      double: 35,
      suite: 65,
      deluxe: 45,
      executive: 55,
      presidential: 120
    };
    return sizes[roomType.toLowerCase()] || 30;
  }

  async getOrCreateRoomType(hotelId, typeName, config) {
    try {
      // Try to find existing room type
      let roomType = await RoomType.findOne({
        hotelId,
        name: { $regex: new RegExp(`^${typeName}$`, 'i') }
      });

      if (!roomType) {
        // Create room type code - make it unique by including hotel prefix
        const hotelPrefix = hotelId.toString().slice(-4); // Last 4 chars of hotel ID
        const typeCode = typeName.toUpperCase().replace(/\s+/g, '_').substring(0, 15);
        const code = `${hotelPrefix}_${typeCode}`.substring(0, 20);

        // Prepare amenities in the correct format
        const amenities = (config.amenities || []).map(amenity => ({
          code: amenity.toUpperCase().replace(/\s+/g, '_'),
          name: amenity,
          category: 'comfort',
          isHighlight: false
        }));

        // Create new room type with all required fields
        roomType = await RoomType.create({
          hotelId,
          code: code,
          name: typeName,
          description: `${typeName} room type`,
          specifications: {
            maxOccupancy: this.getDefaultCapacity(typeName),
            bedType: 'double',
            bedCount: 1,
            roomSize: config.size || this.getDefaultSize(typeName),
            smokingPolicy: 'non_smoking'
          },
          amenities: amenities,
          totalRooms: config.count || 1,
          baseRate: config.basePrice || 0,
          baseCurrency: 'INR',
          isActive: true
        });

        logger.info('Created new room type', {
          hotelId,
          roomTypeName: typeName,
          roomTypeId: roomType._id,
          code: code
        });
      }

      return roomType;
    } catch (error) {
      logger.error('Error getting or creating room type', {
        hotelId,
        typeName,
        error: error.message
      });
      throw error;
    }
  }

  async getRoomTypeTemplates() {
    // Default room type templates
    return {
      single: {
        capacity: 1,
        size: 25,
        amenities: ['WiFi', 'AC', 'TV', 'Desk']
      },
      double: {
        capacity: 2,
        size: 35,
        amenities: ['WiFi', 'AC', 'TV', 'Desk', 'Mini Fridge']
      },
      suite: {
        capacity: 4,
        size: 65,
        amenities: ['WiFi', 'AC', 'TV', 'Desk', 'Mini Fridge', 'Sofa', 'Balcony']
      },
      deluxe: {
        capacity: 2,
        size: 45,
        amenities: ['WiFi', 'AC', 'TV', 'Desk', 'Mini Fridge', 'Premium Bedding']
      }
    };
  }
}

export default new PropertyRoomService();