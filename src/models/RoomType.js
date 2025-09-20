import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import Content from './Content.js';
import Translation from './Translation.js';

/**
 * Enhanced Room Type Schema with Multilingual Support
 * 
 * Supports content localization for OTA channel requirements
 * Integrates with Translation and Content management systems
 */
const roomTypeSchema = new mongoose.Schema({
  // Basic room type information
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    validate: {
      validator: function(code) {
        return /^[A-Z0-9_]{2,20}$/.test(code);
      },
      message: 'Room type code must be 2-20 characters, uppercase letters, numbers, and underscores only'
    },
    index: true
  },

  // Default content (base language)
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },

  shortDescription: {
    type: String,
    trim: true,
    maxlength: 200
  },

  // Room specifications
  specifications: {
    maxOccupancy: {
      type: Number,
      required: true,
      min: 1,
      max: 20
    },
    bedType: {
      type: String,
      enum: ['single', 'double', 'twin', 'queen', 'king', 'sofa_bed', 'bunk_bed'],
      default: 'double'
    },
    bedCount: {
      type: Number,
      min: 1,
      max: 10,
      default: 1
    },
    roomSize: {
      type: Number, // in square meters
      min: 5,
      max: 1000
    },
    floor: {
      min: Number,
      max: Number
    },
    view: {
      type: String,
      enum: ['city', 'sea', 'garden', 'mountain', 'pool', 'courtyard', 'street', 'interior']
    },
    smokingPolicy: {
      type: String,
      enum: ['non_smoking', 'smoking_allowed', 'designated_areas'],
      default: 'non_smoking'
    }
  },

  // Room amenities with multilingual support
  amenities: [{
    code: {
      type: String,
      required: true,
      uppercase: true
    },
    name: String, // Default language name
    category: {
      type: String,
      enum: ['technology', 'comfort', 'bathroom', 'entertainment', 'business', 'accessibility', 'other']
    },
    isHighlight: {
      type: Boolean,
      default: false
    }
  }],

  // Inventory and pricing
  totalRooms: {
    type: Number,
    required: true,
    min: 1
  },

  baseRate: {
    type: Number,
    required: true,
    min: 0
  },

  baseCurrency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'USD',
    ref: 'Currency'
  },

  // Multi-language content configuration
  content: {
    baseLanguage: {
      type: String,
      required: true,
      uppercase: true,
      default: 'EN',
      ref: 'Language'
    },

    // Content keys for localized content
    contentKeys: {
      name: String, // Content key for name translations
      description: String, // Content key for description translations
      shortDescription: String,
      amenities: String // Content key for amenities translations
    },

    // Translation status tracking
    translations: [{
      language: {
        type: String,
        required: true,
        ref: 'Language'
      },
      status: {
        type: String,
        enum: ['pending', 'translated', 'approved', 'published'],
        default: 'pending'
      },
      completeness: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },
      lastUpdated: Date
    }],

    autoTranslate: {
      type: Boolean,
      default: true
    },

    translationPriority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  },

  // OTA Channel configuration
  channels: [{
    channel: {
      type: String,
      enum: ['booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'direct_web'],
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    channelRoomTypeId: String, // External channel room type ID
    
    // Channel-specific content overrides
    name: String,
    description: String,
    
    // Channel-specific amenities mapping
    amenityMapping: [{
      internalCode: String,
      channelCode: String,
      channelName: String
    }],

    // Channel-specific policies
    policies: {
      minStay: Number,
      maxStay: Number,
      maxOccupancy: Number,
      childPolicy: String,
      petPolicy: String
    }
  }],

  // Images and media
  images: [{
    url: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['main', 'bathroom', 'view', 'amenity', 'floor_plan'],
      default: 'main'
    },
    order: {
      type: Number,
      default: 0
    },
    caption: String, // Default language caption
    captionContentKey: String, // Content key for translations
    isActive: {
      type: Boolean,
      default: true
    }
  }],

  // Room type categories and classification
  category: {
    type: String,
    enum: ['standard', 'superior', 'deluxe', 'suite', 'premium', 'executive', 'villa'],
    default: 'standard',
    index: true
  },

  rank: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },

  // Hotel association
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },

  // Overbooking settings
  settings: {
    allowOverbooking: {
      type: Boolean,
      default: false
    },
    overbookingLimit: {
      type: Number,
      default: 0,
      min: 0,
      max: 50
    },
    requiresApproval: {
      type: Boolean,
      default: false
    }
  },

  // System fields
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  isPublished: {
    type: Boolean,
    default: false,
    index: true
  },

  // Audit fields
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
roomTypeSchema.index({ hotelId: 1, code: 1 });
roomTypeSchema.index({ hotelId: 1, isActive: 1, isPublished: 1 });
roomTypeSchema.index({ hotelId: 1, category: 1, rank: 1 });
roomTypeSchema.index({ 'channels.channel': 1, 'channels.isActive': 1 });
roomTypeSchema.index({ 'content.translations.language': 1, 'content.translations.status': 1 });

// Virtual for translation completeness percentage
roomTypeSchema.virtual('translationCompleteness').get(function() {
  if (!this.content.translations || this.content.translations.length === 0) return 0;
  
  const total = this.content.translations.length;
  const published = this.content.translations.filter(t => t.status === 'published').length;
  
  return Math.round((published / total) * 100);
});

// Static methods

/**
 * Get room types with localized content
 */
roomTypeSchema.statics.getLocalizedRoomTypes = async function(hotelId, language = 'EN', options = {}) {
  try {
    const query = {
      hotelId,
      isActive: true,
      ...options.filter
    };

    if (options.published !== false) {
      query.isPublished = true;
    }

    const roomTypes = await this.find(query)
      .sort({ rank: 1, category: 1, name: 1 })
      .populate('createdBy updatedBy', 'name email')
      .lean();

    // Get translations for each room type
    const localizedRoomTypes = await Promise.all(
      roomTypes.map(async (roomType) => {
        const localized = await this.getLocalizedContent(roomType, language);
        return localized;
      })
    );

    return localizedRoomTypes;

  } catch (error) {
    logger.error('Failed to get localized room types', { hotelId, language, error: error.message });
    throw error;
  }
};

/**
 * Get localized content for a room type
 */
roomTypeSchema.statics.getLocalizedContent = async function(roomType, language = 'EN') {
  try {
    const localized = { ...roomType };

    // If requesting base language, return as-is
    if (language === roomType.content?.baseLanguage) {
      return localized;
    }

    // Get translations for name and descriptions
    const translations = await Translation.find({
      resourceType: 'room_type',
      resourceId: roomType._id,
      targetLanguage: language,
      'quality.reviewStatus': 'approved',
      isActive: true
    }).lean();

    // Apply translations
    translations.forEach(translation => {
      switch (translation.fieldName) {
        case 'name':
          localized.name = translation.translatedText;
          break;
        case 'description':
          localized.description = translation.translatedText;
          break;
        case 'shortDescription':
          localized.shortDescription = translation.translatedText;
          break;
      }
    });

    // Get localized amenities
    if (roomType.amenities && roomType.amenities.length > 0) {
      const amenityTranslations = await Translation.find({
        resourceType: 'room_amenity',
        resourceId: { $in: roomType.amenities.map(a => a.code) },
        targetLanguage: language,
        'quality.reviewStatus': 'approved',
        isActive: true
      }).lean();

      localized.amenities = roomType.amenities.map(amenity => {
        const translation = amenityTranslations.find(t => 
          t.resourceId.toString() === amenity.code && t.fieldName === 'name'
        );
        
        return {
          ...amenity,
          name: translation ? translation.translatedText : amenity.name
        };
      });
    }

    // Get localized image captions
    if (roomType.images && roomType.images.length > 0) {
      const imageTranslations = await Translation.find({
        resourceType: 'room_type',
        resourceId: roomType._id,
        fieldName: { $regex: /^image_caption_/ },
        targetLanguage: language,
        'quality.reviewStatus': 'approved',
        isActive: true
      }).lean();

      localized.images = roomType.images.map((image, index) => {
        const translation = imageTranslations.find(t => 
          t.fieldName === `image_caption_${index}`
        );
        
        return {
          ...image,
          caption: translation ? translation.translatedText : image.caption
        };
      });
    }

    return localized;

  } catch (error) {
    logger.error('Failed to get localized content', { roomTypeId: roomType._id, language, error: error.message });
    return roomType; // Return original content as fallback
  }
};

/**
 * Create translations for room type content
 */
roomTypeSchema.statics.createTranslations = async function(roomType, targetLanguages, userId) {
  try {
    const baseLanguage = roomType.content?.baseLanguage || 'EN';
    const translations = [];

    for (const targetLanguage of targetLanguages) {
      if (targetLanguage === baseLanguage) continue;

      // Create translation for name
      if (roomType.name) {
        const nameTranslation = new Translation({
          resourceType: 'room_type',
          resourceId: roomType._id,
          fieldName: 'name',
          sourceLanguage: baseLanguage,
          targetLanguage,
          originalText: roomType.name,
          translatedText: roomType.name, // Will be updated by translation service
          translationMethod: 'automatic',
          provider: 'pending',
          createdBy: userId
        });
        translations.push(nameTranslation);
      }

      // Create translation for description
      if (roomType.description) {
        const descTranslation = new Translation({
          resourceType: 'room_type',
          resourceId: roomType._id,
          fieldName: 'description',
          sourceLanguage: baseLanguage,
          targetLanguage,
          originalText: roomType.description,
          translatedText: roomType.description, // Will be updated by translation service
          translationMethod: 'automatic',
          provider: 'pending',
          createdBy: userId
        });
        translations.push(descTranslation);
      }

      // Create translation for short description
      if (roomType.shortDescription) {
        const shortDescTranslation = new Translation({
          resourceType: 'room_type',
          resourceId: roomType._id,
          fieldName: 'shortDescription',
          sourceLanguage: baseLanguage,
          targetLanguage,
          originalText: roomType.shortDescription,
          translatedText: roomType.shortDescription, // Will be updated by translation service
          translationMethod: 'automatic',
          provider: 'pending',
          createdBy: userId
        });
        translations.push(shortDescTranslation);
      }

      // Create translations for image captions
      if (roomType.images) {
        roomType.images.forEach((image, index) => {
          if (image.caption) {
            const captionTranslation = new Translation({
              resourceType: 'room_type',
              resourceId: roomType._id,
              fieldName: `image_caption_${index}`,
              sourceLanguage: baseLanguage,
              targetLanguage,
              originalText: image.caption,
              translatedText: image.caption, // Will be updated by translation service
              translationMethod: 'automatic',
              provider: 'pending',
              createdBy: userId
            });
            translations.push(captionTranslation);
          }
        });
      }
    }

    // Save all translations
    if (translations.length > 0) {
      await Translation.insertMany(translations);
      
      logger.info('Created room type translations', {
        roomTypeId: roomType._id,
        targetLanguages,
        translationsCount: translations.length
      });
    }

    return translations;

  } catch (error) {
    logger.error('Failed to create room type translations', {
      roomTypeId: roomType._id,
      targetLanguages,
      error: error.message
    });
    throw error;
  }
};

// Instance methods

/**
 * Update translation status for a language
 */
roomTypeSchema.methods.updateTranslationStatus = async function(language, status, completeness = 0) {
  try {
    const translationIndex = this.content.translations.findIndex(
      t => t.language === language
    );

    if (translationIndex >= 0) {
      this.content.translations[translationIndex].status = status;
      this.content.translations[translationIndex].completeness = completeness;
      this.content.translations[translationIndex].lastUpdated = new Date();
    } else {
      this.content.translations.push({
        language,
        status,
        completeness,
        lastUpdated: new Date()
      });
    }

    await this.save();

    logger.info('Room type translation status updated', {
      roomTypeId: this._id,
      language,
      status,
      completeness
    });

  } catch (error) {
    logger.error('Failed to update translation status', {
      roomTypeId: this._id,
      language,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get total number of rooms of this type
 */
roomTypeSchema.methods.getTotalRooms = async function() {
  const Room = mongoose.model('Room');
  return await Room.countDocuments({ 
    hotelId: this.hotelId, 
    type: this.code,
    isActive: true 
  });
};

/**
 * Get channel-specific configuration
 */
roomTypeSchema.methods.getChannelConfig = function(channelName) {
  return this.channels.find(c => c.channel === channelName && c.isActive);
};

/**
 * Add or update channel configuration
 */
roomTypeSchema.methods.updateChannelConfig = async function(channelName, config) {
  try {
    const existingIndex = this.channels.findIndex(c => c.channel === channelName);
    
    if (existingIndex >= 0) {
      this.channels[existingIndex] = { ...this.channels[existingIndex].toObject(), ...config };
    } else {
      this.channels.push({ channel: channelName, ...config });
    }

    await this.save();

    logger.info('Room type channel config updated', {
      roomTypeId: this._id,
      channel: channelName
    });

  } catch (error) {
    logger.error('Failed to update channel config', {
      roomTypeId: this._id,
      channel: channelName,
      error: error.message
    });
    throw error;
  }
};

// Pre-save middleware
roomTypeSchema.pre('save', async function(next) {
  try {
    // Generate content keys if not exists
    if (!this.content.contentKeys.name) {
      this.content.contentKeys.name = `room.type.${this.code.toLowerCase()}.name`;
    }
    if (!this.content.contentKeys.description) {
      this.content.contentKeys.description = `room.type.${this.code.toLowerCase()}.description`;
    }
    if (!this.content.contentKeys.shortDescription) {
      this.content.contentKeys.shortDescription = `room.type.${this.code.toLowerCase()}.short_description`;
    }
    if (!this.content.contentKeys.amenities) {
      this.content.contentKeys.amenities = `room.type.${this.code.toLowerCase()}.amenities`;
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Post-save middleware for audit logging
roomTypeSchema.post('save', function(doc) {
  logger.info('Room type saved', {
    roomTypeId: doc._id,
    code: doc.code,
    name: doc.name,
    hotelId: doc.hotelId,
    isActive: doc.isActive
  });
});

export default mongoose.model('RoomType', roomTypeSchema);
