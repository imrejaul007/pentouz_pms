import RoomType from '../models/RoomType.js';
import Translation from '../models/Translation.js';
import Language from '../models/Language.js';
import translationService from './translationService.js';
import logger from '../utils/logger.js';

/**
 * Room Type Translation Service
 * 
 * Handles multilingual content management for room types and amenities
 * Integrates with the existing translation infrastructure
 */
class RoomTypeTranslationService {
  
  /**
   * Initialize translations for a new room type
   */
  async initializeRoomTypeTranslations(roomTypeId, targetLanguages = [], userId) {
    try {
      const roomType = await RoomType.findById(roomTypeId);
      if (!roomType) {
        throw new Error('Room type not found');
      }

      // Get all active languages if no target languages specified
      if (targetLanguages.length === 0) {
        const activeLanguages = await Language.getActiveLanguages();
        targetLanguages = activeLanguages
          .filter(lang => lang.code !== roomType.content.baseLanguage)
          .map(lang => lang.code);
      }

      // Create translation entries
      const translations = await RoomType.createTranslations(roomType, targetLanguages, userId);

      // Queue automatic translations if enabled
      if (roomType.content.autoTranslate) {
        await this.queueAutomaticTranslations(roomType, targetLanguages);
      }

      // Update room type translation status
      for (const language of targetLanguages) {
        await roomType.updateTranslationStatus(language, 'pending', 0);
      }

      logger.info('Room type translations initialized', {
        roomTypeId,
        targetLanguages,
        translationsCount: translations.length
      });

      return {
        roomTypeId,
        targetLanguages,
        translationsCreated: translations.length,
        translations
      };

    } catch (error) {
      logger.error('Failed to initialize room type translations', {
        roomTypeId,
        targetLanguages,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Automatically translate room type content
   */
  async queueAutomaticTranslations(roomType, targetLanguages) {
    try {
      const baseLanguage = roomType.content.baseLanguage;

      for (const targetLanguage of targetLanguages) {
        // Queue name translation
        if (roomType.name) {
          await translationService.queueTranslation({
            resourceType: 'room_type',
            resourceId: roomType._id,
            fieldName: 'name',
            sourceLanguage: baseLanguage,
            targetLanguage,
            originalText: roomType.name,
            priority: roomType.content.translationPriority || 'medium'
          });
        }

        // Queue description translation
        if (roomType.description) {
          await translationService.queueTranslation({
            resourceType: 'room_type',
            resourceId: roomType._id,
            fieldName: 'description',
            sourceLanguage: baseLanguage,
            targetLanguage,
            originalText: roomType.description,
            priority: roomType.content.translationPriority || 'medium'
          });
        }

        // Queue short description translation
        if (roomType.shortDescription) {
          await translationService.queueTranslation({
            resourceType: 'room_type',
            resourceId: roomType._id,
            fieldName: 'shortDescription',
            sourceLanguage: baseLanguage,
            targetLanguage,
            originalText: roomType.shortDescription,
            priority: roomType.content.translationPriority || 'medium'
          });
        }

        // Queue image caption translations
        if (roomType.images && roomType.images.length > 0) {
          roomType.images.forEach((image, index) => {
            if (image.caption) {
              translationService.queueTranslation({
                resourceType: 'room_type',
                resourceId: roomType._id,
                fieldName: `image_caption_${index}`,
                sourceLanguage: baseLanguage,
                targetLanguage,
                originalText: image.caption,
                priority: 'low' // Lower priority for image captions
              });
            }
          });
        }
      }

      logger.info('Automatic translations queued for room type', {
        roomTypeId: roomType._id,
        targetLanguages
      });

    } catch (error) {
      logger.error('Failed to queue automatic translations', {
        roomTypeId: roomType._id,
        targetLanguages,
        error: error.message
      });
      // Don't throw here - translations can be done manually
    }
  }

  /**
   * Get room type with localized content
   */
  async getLocalizedRoomType(roomTypeId, language = 'EN') {
    try {
      const roomType = await RoomType.findById(roomTypeId);
      if (!roomType) {
        throw new Error('Room type not found');
      }

      const localized = await RoomType.getLocalizedContent(roomType.toObject(), language);
      return localized;

    } catch (error) {
      logger.error('Failed to get localized room type', {
        roomTypeId,
        language,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get room types for hotel with localization
   */
  async getHotelRoomTypes(hotelId, language = 'EN', options = {}) {
    try {
      return await RoomType.getLocalizedRoomTypes(hotelId, language, options);
    } catch (error) {
      logger.error('Failed to get localized hotel room types', {
        hotelId,
        language,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update room type translation
   */
  async updateTranslation(translationId, translatedText, userId) {
    try {
      const translation = await Translation.findById(translationId);
      if (!translation) {
        throw new Error('Translation not found');
      }

      // Create new version if translation exists
      if (translation.translatedText !== translatedText) {
        const newTranslation = await translation.createNewVersion(translatedText, userId);
        
        logger.info('Room type translation updated', {
          translationId,
          newTranslationId: newTranslation._id,
          resourceType: translation.resourceType,
          fieldName: translation.fieldName,
          language: translation.targetLanguage
        });

        return newTranslation;
      }

      return translation;

    } catch (error) {
      logger.error('Failed to update room type translation', {
        translationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Approve room type translation
   */
  async approveTranslation(translationId, reviewerId, notes = '') {
    try {
      const translation = await Translation.findById(translationId);
      if (!translation) {
        throw new Error('Translation not found');
      }

      await translation.approve(reviewerId, notes);

      // Update room type translation status
      if (translation.resourceType === 'room_type') {
        const roomType = await RoomType.findById(translation.resourceId);
        if (roomType) {
          // Calculate completeness for this language
          const languageTranslations = await Translation.find({
            resourceType: 'room_type',
            resourceId: translation.resourceId,
            targetLanguage: translation.targetLanguage,
            isActive: true
          });

          const approvedTranslations = languageTranslations.filter(
            t => t.quality.reviewStatus === 'approved'
          );

          const completeness = Math.round(
            (approvedTranslations.length / languageTranslations.length) * 100
          );

          await roomType.updateTranslationStatus(
            translation.targetLanguage,
            'approved',
            completeness
          );
        }
      }

      logger.info('Room type translation approved', {
        translationId,
        resourceType: translation.resourceType,
        fieldName: translation.fieldName,
        language: translation.targetLanguage,
        reviewerId
      });

      return translation;

    } catch (error) {
      logger.error('Failed to approve room type translation', {
        translationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get translation progress for room type
   */
  async getTranslationProgress(roomTypeId, language = null) {
    try {
      const roomType = await RoomType.findById(roomTypeId);
      if (!roomType) {
        throw new Error('Room type not found');
      }

      const query = {
        resourceType: 'room_type',
        resourceId: roomTypeId,
        isActive: true
      };

      if (language) {
        query.targetLanguage = language;
      }

      const translations = await Translation.find(query);
      
      const progress = {
        total: translations.length,
        pending: translations.filter(t => t.quality.reviewStatus === 'pending').length,
        approved: translations.filter(t => t.quality.reviewStatus === 'approved').length,
        rejected: translations.filter(t => t.quality.reviewStatus === 'rejected').length,
        byLanguage: {}
      };

      // Group by language
      translations.forEach(translation => {
        const lang = translation.targetLanguage;
        if (!progress.byLanguage[lang]) {
          progress.byLanguage[lang] = {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            completeness: 0
          };
        }
        
        progress.byLanguage[lang].total++;
        progress.byLanguage[lang][translation.quality.reviewStatus]++;
      });

      // Calculate completeness for each language
      Object.keys(progress.byLanguage).forEach(lang => {
        const langProgress = progress.byLanguage[lang];
        langProgress.completeness = Math.round(
          (langProgress.approved / langProgress.total) * 100
        );
      });

      return progress;

    } catch (error) {
      logger.error('Failed to get translation progress', {
        roomTypeId,
        language,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Initialize amenity translations
   */
  async initializeAmenityTranslations(amenityCode, amenityName, targetLanguages = [], userId) {
    try {
      // Get all active languages if no target languages specified
      if (targetLanguages.length === 0) {
        const activeLanguages = await Language.getActiveLanguages();
        targetLanguages = activeLanguages
          .filter(lang => lang.code !== 'EN') // Assume English is base
          .map(lang => lang.code);
      }

      const translations = [];

      for (const targetLanguage of targetLanguages) {
        const amenityTranslation = new Translation({
          resourceType: 'room_amenity',
          resourceId: amenityCode, // Using amenity code as resource ID
          fieldName: 'name',
          sourceLanguage: 'EN',
          targetLanguage,
          originalText: amenityName,
          translatedText: amenityName, // Will be updated by translation service
          translationMethod: 'automatic',
          provider: 'pending',
          createdBy: userId
        });
        translations.push(amenityTranslation);
      }

      // Save all translations
      if (translations.length > 0) {
        await Translation.insertMany(translations);
        
        // Queue automatic translations
        await this.queueAmenityTranslations(amenityCode, amenityName, targetLanguages);
        
        logger.info('Amenity translations initialized', {
          amenityCode,
          amenityName,
          targetLanguages,
          translationsCount: translations.length
        });
      }

      return translations;

    } catch (error) {
      logger.error('Failed to initialize amenity translations', {
        amenityCode,
        amenityName,
        targetLanguages,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Queue automatic amenity translations
   */
  async queueAmenityTranslations(amenityCode, amenityName, targetLanguages) {
    try {
      for (const targetLanguage of targetLanguages) {
        await translationService.queueTranslation({
          resourceType: 'room_amenity',
          resourceId: amenityCode,
          fieldName: 'name',
          sourceLanguage: 'EN',
          targetLanguage,
          originalText: amenityName,
          priority: 'medium'
        });
      }

      logger.info('Amenity translations queued', {
        amenityCode,
        targetLanguages
      });

    } catch (error) {
      logger.error('Failed to queue amenity translations', {
        amenityCode,
        targetLanguages,
        error: error.message
      });
      // Don't throw - can be done manually
    }
  }

  /**
   * Get localized amenities
   */
  async getLocalizedAmenities(amenityCodes, language = 'EN') {
    try {
      if (language === 'EN') {
        // Return original amenity names for English
        return amenityCodes;
      }

      const translations = await Translation.find({
        resourceType: 'room_amenity',
        resourceId: { $in: amenityCodes.map(a => a.code || a) },
        fieldName: 'name',
        targetLanguage: language,
        'quality.reviewStatus': 'approved',
        isActive: true
      }).lean();

      // Map translations back to amenities
      const localizedAmenities = amenityCodes.map(amenity => {
        const amenityCode = typeof amenity === 'string' ? amenity : amenity.code;
        const translation = translations.find(t => t.resourceId === amenityCode);
        
        if (typeof amenity === 'string') {
          return translation ? translation.translatedText : amenity;
        } else {
          return {
            ...amenity,
            name: translation ? translation.translatedText : amenity.name
          };
        }
      });

      return localizedAmenities;

    } catch (error) {
      logger.error('Failed to get localized amenities', {
        amenityCodes: amenityCodes.length,
        language,
        error: error.message
      });
      // Return original amenities as fallback
      return amenityCodes;
    }
  }

  /**
   * Bulk create translations for multiple room types
   */
  async bulkInitializeTranslations(roomTypeIds, targetLanguages, userId) {
    try {
      const results = [];

      for (const roomTypeId of roomTypeIds) {
        try {
          const result = await this.initializeRoomTypeTranslations(
            roomTypeId,
            targetLanguages,
            userId
          );
          results.push({
            roomTypeId,
            success: true,
            ...result
          });
        } catch (error) {
          results.push({
            roomTypeId,
            success: false,
            error: error.message
          });
        }
      }

      logger.info('Bulk translation initialization completed', {
        roomTypeIds: roomTypeIds.length,
        targetLanguages,
        results: results.length
      });

      return results;

    } catch (error) {
      logger.error('Failed to bulk initialize translations', {
        roomTypeIds: roomTypeIds.length,
        targetLanguages,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all room types with translation status
   */
  async getRoomTypesWithTranslationStatus(hotelId, options = {}) {
    try {
      const roomTypes = await RoomType.find({
        hotelId,
        isActive: true,
        ...options.filter
      })
      .populate('createdBy updatedBy', 'name email')
      .sort({ rank: 1, category: 1, name: 1 })
      .lean();

      // Get translation statistics for each room type
      const roomTypesWithStatus = await Promise.all(
        roomTypes.map(async (roomType) => {
          const progress = await this.getTranslationProgress(roomType._id);
          return {
            ...roomType,
            translationProgress: progress,
            translationCompleteness: roomType.content?.translations?.length > 0 ? 
              Math.round(progress.approved / progress.total * 100) : 0
          };
        })
      );

      return roomTypesWithStatus;

    } catch (error) {
      logger.error('Failed to get room types with translation status', {
        hotelId,
        error: error.message
      });
      throw error;
    }
  }
}

// Create singleton instance
const roomTypeTranslationService = new RoomTypeTranslationService();

export default roomTypeTranslationService;