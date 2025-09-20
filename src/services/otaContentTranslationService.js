import ChannelConfiguration from '../models/ChannelConfiguration.js';
import Content from '../models/Content.js';
import Translation from '../models/Translation.js';
import translationService from './translationService.js';
import logger from '../utils/logger.js';
import { EventEmitter } from 'events';

class OTAContentTranslationService extends EventEmitter {
  constructor() {
    super();
    this.translationQueue = new Map();
    this.processingQueue = false;
    this.batchSize = 10;
    this.maxRetries = 3;
    
    // Channel-specific content requirements
    this.channelRequirements = {
      booking_com: {
        maxDescriptionLength: 2000,
        maxAmenityLength: 100,
        requiredFields: ['hotel_description', 'amenities', 'policies'],
        imageRequirements: { min: 5, max: 20 },
        supportedLanguages: ['EN', 'ES', 'FR', 'DE', 'IT', 'PT', 'RU', 'ZH', 'JA'],
        contentOptimization: {
          includeKeywords: true,
          emphasizeUniqueFeatures: true,
          localizeLocationReferences: true
        }
      },
      expedia: {
        maxDescriptionLength: 1500,
        maxAmenityLength: 80,
        requiredFields: ['hotel_description', 'amenities'],
        imageRequirements: { min: 3, max: 15 },
        supportedLanguages: ['EN', 'ES', 'FR', 'DE', 'IT', 'ZH', 'JA', 'KO'],
        contentOptimization: {
          includeKeywords: false,
          emphasizeUniqueFeatures: true,
          localizeLocationReferences: true
        }
      },
      airbnb: {
        maxDescriptionLength: 500,
        maxAmenityLength: 50,
        requiredFields: ['property_description', 'house_rules'],
        imageRequirements: { min: 5, max: 30 },
        supportedLanguages: ['EN', 'ES', 'FR', 'DE', 'IT', 'PT', 'ZH', 'JA', 'KO', 'RU'],
        contentOptimization: {
          includeKeywords: false,
          emphasizeUniqueFeatures: true,
          localizeLocationReferences: true,
          personalizedTone: true
        }
      },
      agoda: {
        maxDescriptionLength: 1800,
        maxAmenityLength: 120,
        requiredFields: ['hotel_description', 'amenities', 'location_info'],
        imageRequirements: { min: 4, max: 25 },
        supportedLanguages: ['EN', 'ZH', 'JA', 'KO', 'TH', 'VI', 'ID', 'MY'],
        contentOptimization: {
          includeKeywords: true,
          emphasizeUniqueFeatures: true,
          localizeLocationReferences: true,
          culturalAdaptation: true
        }
      }
    };

    // Start queue processor
    this.startQueueProcessor();
  }

  /**
   * Translate hotel content for all configured OTA channels
   */
  async translateHotelContent(hotelId, contentData, options = {}) {
    try {
      logger.info(`Starting OTA content translation for hotel ${hotelId}`);

      // Get all active channel configurations
      const channelConfigs = await ChannelConfiguration.getActiveChannelsForHotel(hotelId);
      
      if (!channelConfigs.length) {
        throw new Error(`No active channels found for hotel ${hotelId}`);
      }

      const translationResults = {
        hotelId,
        channels: {},
        summary: {
          totalChannels: channelConfigs.length,
          successfulChannels: 0,
          failedChannels: 0,
          totalTranslations: 0
        }
      };

      // Process each channel
      for (const channelConfig of channelConfigs) {
        try {
          const channelResult = await this.translateContentForChannel(
            hotelId,
            contentData,
            channelConfig,
            options
          );

          translationResults.channels[channelConfig.channelId] = channelResult;
          translationResults.summary.successfulChannels++;
          translationResults.summary.totalTranslations += channelResult.translatedContent.length;

        } catch (error) {
          logger.error(`Failed to translate content for ${channelConfig.channelId}:`, error);
          translationResults.channels[channelConfig.channelId] = {
            success: false,
            error: error.message,
            translatedContent: []
          };
          translationResults.summary.failedChannels++;
        }
      }

      // Emit completion event
      this.emit('translationComplete', translationResults);

      return translationResults;

    } catch (error) {
      logger.error('OTA content translation failed:', error);
      throw error;
    }
  }

  /**
   * Translate content for a specific OTA channel
   */
  async translateContentForChannel(hotelId, contentData, channelConfig, options = {}) {
    const channelId = channelConfig.channelId;
    const requirements = this.channelRequirements[channelId] || this.channelRequirements.booking_com;

    logger.info(`Translating content for ${channelId}`, {
      hotelId,
      supportedLanguages: channelConfig.activeSupportedLanguages.length
    });

    const translatedContent = [];
    const errors = [];

    // Process each supported language
    for (const languageConfig of channelConfig.activeSupportedLanguages) {
      const targetLanguage = languageConfig.languageCode;
      
      // Skip if this is the base language
      if (targetLanguage === channelConfig.languageSettings.primaryLanguage) {
        continue;
      }

      try {
        const languageContent = await this.translateContentToLanguage(
          contentData,
          targetLanguage,
          channelConfig,
          requirements,
          options
        );

        translatedContent.push({
          language: targetLanguage,
          channelLanguageCode: languageConfig.channelLanguageCode || targetLanguage,
          content: languageContent,
          translationQuality: languageConfig.translationQuality,
          optimized: true
        });

      } catch (error) {
        logger.error(`Failed to translate to ${targetLanguage} for ${channelId}:`, error);
        errors.push({
          language: targetLanguage,
          error: error.message
        });
      }
    }

    return {
      channelId,
      success: errors.length === 0,
      translatedContent,
      errors: errors.length > 0 ? errors : undefined,
      processedAt: new Date()
    };
  }

  /**
   * Translate content to a specific language with channel optimization
   */
  async translateContentToLanguage(contentData, targetLanguage, channelConfig, requirements, options) {
    const sourceLanguage = channelConfig.languageSettings.primaryLanguage;
    const optimizedContent = {};

    // Process each content field
    for (const [fieldName, fieldValue] of Object.entries(contentData)) {
      if (!fieldValue || typeof fieldValue !== 'string') {
        continue;
      }

      try {
        // Check if field is required for this channel
        if (requirements.requiredFields && !requirements.requiredFields.includes(fieldName)) {
          continue;
        }

        // Optimize content for channel before translation
        const optimizedText = await this.optimizeContentForChannel(
          fieldValue,
          fieldName,
          channelConfig.channelId,
          requirements
        );

        // Translate the optimized content
        const translatedText = await this.translateWithQualityCheck(
          optimizedText,
          sourceLanguage,
          targetLanguage,
          fieldName,
          channelConfig
        );

        // Post-process and validate translated content
        const finalContent = await this.postProcessTranslation(
          translatedText,
          fieldName,
          targetLanguage,
          requirements
        );

        optimizedContent[fieldName] = finalContent;

      } catch (error) {
        logger.warn(`Failed to translate field ${fieldName} to ${targetLanguage}:`, error);
        // Use fallback or original content
        optimizedContent[fieldName] = fieldValue;
      }
    }

    return optimizedContent;
  }

  /**
   * Optimize content for specific OTA channel before translation
   */
  async optimizeContentForChannel(content, fieldName, channelId, requirements) {
    let optimized = content;

    // Apply channel-specific optimizations
    const optimization = requirements.contentOptimization || {};

    // Trim to maximum length
    const maxLength = this.getMaxLengthForField(fieldName, requirements);
    if (maxLength && optimized.length > maxLength) {
      optimized = this.intelligentTrim(optimized, maxLength);
    }

    // Include SEO keywords if required
    if (optimization.includeKeywords && fieldName === 'hotel_description') {
      optimized = await this.addSEOKeywords(optimized, channelId);
    }

    // Emphasize unique features
    if (optimization.emphasizeUniqueFeatures) {
      optimized = await this.emphasizeUniqueFeatures(optimized, channelId);
    }

    // Apply channel-specific tone
    if (optimization.personalizedTone && channelId === 'airbnb') {
      optimized = await this.applyPersonalizedTone(optimized);
    }

    return optimized;
  }

  /**
   * Translate text with quality checking and retries
   */
  async translateWithQualityCheck(text, sourceLanguage, targetLanguage, fieldName, channelConfig) {
    let attempts = 0;
    let bestTranslation = null;
    let highestConfidence = 0;

    while (attempts < this.maxRetries) {
      try {
        const translation = await translationService.translateText(
          text,
          sourceLanguage,
          targetLanguage,
          {
            namespace: 'ota_content',
            context: `${channelConfig.channelId}_${fieldName}`,
            quality: channelConfig.languageSettings.supportedLanguages.find(
              l => l.languageCode === targetLanguage
            )?.translationQuality || 'automatic'
          }
        );

        // Quality check
        const confidence = await this.calculateTranslationConfidence(
          text,
          translation.translatedText,
          sourceLanguage,
          targetLanguage
        );

        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          bestTranslation = translation.translatedText;
        }

        // If we got a good enough translation, use it
        if (confidence > 0.8) {
          break;
        }

        attempts++;
      } catch (error) {
        logger.warn(`Translation attempt ${attempts + 1} failed:`, error);
        attempts++;
        
        if (attempts >= this.maxRetries) {
          throw error;
        }
      }
    }

    if (!bestTranslation) {
      throw new Error('All translation attempts failed');
    }

    return bestTranslation;
  }

  /**
   * Post-process translated content
   */
  async postProcessTranslation(translatedText, fieldName, targetLanguage, requirements) {
    let processed = translatedText;

    // Apply language-specific formatting
    processed = await this.applyLanguageFormatting(processed, targetLanguage);

    // Apply cultural adaptations
    if (requirements.contentOptimization?.culturalAdaptation) {
      processed = await this.applyCulturalAdaptations(processed, targetLanguage);
    }

    // Final length check
    const maxLength = this.getMaxLengthForField(fieldName, requirements);
    if (maxLength && processed.length > maxLength) {
      processed = this.intelligentTrim(processed, maxLength);
    }

    // Clean up and validate
    processed = this.cleanupText(processed);
    
    return processed;
  }

  /**
   * Calculate translation confidence score
   */
  async calculateTranslationConfidence(originalText, translatedText, sourceLanguage, targetLanguage) {
    try {
      // Basic heuristics for translation quality
      let confidence = 0.7; // Base confidence

      // Length similarity (translated text shouldn't be too different in length)
      const lengthRatio = translatedText.length / originalText.length;
      if (lengthRatio >= 0.5 && lengthRatio <= 2.0) {
        confidence += 0.1;
      } else {
        confidence -= 0.2;
      }

      // Check for untranslated segments (same words in both languages)
      const originalWords = originalText.toLowerCase().split(/\s+/);
      const translatedWords = translatedText.toLowerCase().split(/\s+/);
      const untranslatedCount = originalWords.filter(word => 
        word.length > 3 && translatedWords.includes(word)
      ).length;
      
      if (untranslatedCount / originalWords.length < 0.3) {
        confidence += 0.1;
      } else {
        confidence -= 0.2;
      }

      // Language-specific checks
      confidence += await this.performLanguageSpecificChecks(
        translatedText, 
        targetLanguage
      );

      return Math.max(0, Math.min(1, confidence));

    } catch (error) {
      logger.warn('Failed to calculate translation confidence:', error);
      return 0.5; // Default confidence
    }
  }

  /**
   * Add SEO keywords for channel optimization
   */
  async addSEOKeywords(content, channelId) {
    const keywords = {
      booking_com: ['hotel', 'accommodation', 'booking', 'reserve'],
      expedia: ['travel', 'vacation', 'stay', 'hotel'],
      airbnb: ['home', 'unique', 'local', 'experience'],
      agoda: ['hotel', 'resort', 'accommodation', 'stay']
    };

    const channelKeywords = keywords[channelId] || keywords.booking_com;
    
    // Intelligently integrate keywords without making content awkward
    let enhanced = content;
    
    // Add keywords naturally in the first paragraph if possible
    const sentences = content.split('. ');
    if (sentences.length > 0) {
      const firstSentence = sentences[0];
      const hasKeyword = channelKeywords.some(keyword => 
        firstSentence.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (!hasKeyword) {
        const keyword = channelKeywords[0];
        enhanced = `${firstSentence.replace(/^This/, `This ${keyword}`)}. ${sentences.slice(1).join('. ')}`;
      }
    }
    
    return enhanced;
  }

  /**
   * Emphasize unique features in content
   */
  async emphasizeUniqueFeatures(content, channelId) {
    // Look for feature keywords and emphasize them
    const featureKeywords = [
      'unique', 'exclusive', 'luxury', 'premium', 'boutique',
      'historic', 'modern', 'contemporary', 'traditional',
      'oceanfront', 'mountain', 'downtown', 'beachfront'
    ];

    let enhanced = content;
    
    // Add emphasis to feature words (but don't overdo it)
    featureKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      if (enhanced.match(regex) && enhanced.match(regex).length === 1) {
        enhanced = enhanced.replace(regex, match => match);
      }
    });

    return enhanced;
  }

  /**
   * Apply personalized tone for platforms like Airbnb
   */
  async applyPersonalizedTone(content) {
    // Make content more personal and welcoming
    let personalized = content;
    
    // Replace formal language with more personal language
    const replacements = {
      'The hotel': 'Our place',
      'Guests will': 'You\'ll',
      'The property': 'This home',
      'Facilities include': 'You\'ll have access to',
      'The accommodation': 'Your stay'
    };

    Object.entries(replacements).forEach(([formal, personal]) => {
      personalized = personalized.replace(new RegExp(formal, 'g'), personal);
    });

    return personalized;
  }

  /**
   * Apply cultural adaptations for specific languages/regions
   */
  async applyCulturalAdaptations(content, targetLanguage) {
    let adapted = content;

    // Language-specific cultural adaptations
    switch (targetLanguage) {
      case 'JA': // Japanese
        // Be more formal and detailed
        adapted = adapted.replace(/\./g, '。').replace(/,/g, '、');
        break;
      case 'ZH': // Chinese
        // Emphasize harmony and balance
        break;
      case 'AR': // Arabic
        // Consider right-to-left reading patterns
        break;
      case 'DE': // German
        // Germans appreciate detailed information
        break;
    }

    return adapted;
  }

  /**
   * Apply language-specific formatting
   */
  async applyLanguageFormatting(content, targetLanguage) {
    let formatted = content;

    // Apply language-specific punctuation and formatting rules
    switch (targetLanguage) {
      case 'FR': // French
        // Add non-breaking spaces before colons, semicolons, etc.
        formatted = formatted.replace(/\s*:/g, ' :');
        formatted = formatted.replace(/\s*;/g, ' ;');
        break;
      case 'ES': // Spanish
        // Add inverted question/exclamation marks
        formatted = formatted.replace(/(\w+\?)/g, '¿$1');
        formatted = formatted.replace(/(\w+!)/g, '¡$1');
        break;
    }

    return formatted;
  }

  /**
   * Perform language-specific quality checks
   */
  async performLanguageSpecificChecks(text, language) {
    let bonus = 0;

    // Check for proper character encoding
    if (/[\u00C0-\u017F]/.test(text) && ['FR', 'ES', 'DE'].includes(language)) {
      bonus += 0.05; // Proper accents for European languages
    }

    // Check for proper CJK characters
    if (/[\u4E00-\u9FFF]/.test(text) && ['ZH', 'JA'].includes(language)) {
      bonus += 0.05; // Contains CJK characters
    }

    return bonus;
  }

  /**
   * Get maximum length for a specific field and channel
   */
  getMaxLengthForField(fieldName, requirements) {
    switch (fieldName) {
      case 'hotel_description':
      case 'property_description':
        return requirements.maxDescriptionLength;
      case 'amenities':
        return requirements.maxAmenityLength;
      default:
        return requirements.maxDescriptionLength;
    }
  }

  /**
   * Intelligently trim content to fit length requirements
   */
  intelligentTrim(content, maxLength) {
    if (content.length <= maxLength) {
      return content;
    }

    // Try to trim at sentence boundaries
    const sentences = content.split('. ');
    let trimmed = '';
    
    for (const sentence of sentences) {
      if ((trimmed + sentence + '. ').length <= maxLength) {
        trimmed += sentence + '. ';
      } else {
        break;
      }
    }

    // If no complete sentences fit, trim at word boundaries
    if (trimmed.length < maxLength * 0.5) {
      const words = content.split(' ');
      trimmed = '';
      
      for (const word of words) {
        if ((trimmed + word + ' ').length <= maxLength - 3) {
          trimmed += word + ' ';
        } else {
          break;
        }
      }
      
      trimmed = trimmed.trim() + '...';
    }

    return trimmed.trim();
  }

  /**
   * Clean up translated text
   */
  cleanupText(text) {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\s+([.!?])/g, '$1') // Fix punctuation spacing
      .trim();
  }

  /**
   * Start the translation queue processor
   */
  startQueueProcessor() {
    setInterval(async () => {
      if (!this.processingQueue && this.translationQueue.size > 0) {
        await this.processTranslationQueue();
      }
    }, 5000); // Process queue every 5 seconds
  }

  /**
   * Process queued translation requests
   */
  async processTranslationQueue() {
    if (this.processingQueue) return;
    
    this.processingQueue = true;
    
    try {
      const batch = Array.from(this.translationQueue.entries()).slice(0, this.batchSize);
      
      for (const [key, request] of batch) {
        try {
          const result = await this.translateHotelContent(
            request.hotelId,
            request.contentData,
            request.options
          );
          
          if (request.callback) {
            request.callback(null, result);
          }
          
          this.translationQueue.delete(key);
        } catch (error) {
          if (request.callback) {
            request.callback(error);
          }
          this.translationQueue.delete(key);
        }
      }
    } catch (error) {
      logger.error('Translation queue processing failed:', error);
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Queue translation request for batch processing
   */
  queueTranslation(hotelId, contentData, options = {}, callback = null) {
    const key = `${hotelId}-${Date.now()}`;
    this.translationQueue.set(key, {
      hotelId,
      contentData,
      options,
      callback,
      queuedAt: new Date()
    });
    
    return key;
  }
}

export default new OTAContentTranslationService();