import Language from '../models/Language.js';
import Translation from '../models/Translation.js';
import Content from '../models/Content.js';
import translationService from '../services/translationService.js';
import logger from './logger.js';

/**
 * Localization Utilities
 * 
 * Helper functions for multi-language support, content localization, and translation management
 * Used throughout the application for consistent localization handling
 */

/**
 * Get translated content for a specific language
 * @param {string} resourceType - Type of resource
 * @param {string} resourceId - Resource ID
 * @param {string} fieldName - Field name to translate
 * @param {string} targetLanguage - Target language code
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Translated content or original if not found
 */
export async function getTranslatedContent(resourceType, resourceId, fieldName, targetLanguage, options = {}) {
  try {
    const translation = await Translation.getFieldTranslation(
      resourceType,
      resourceId,
      fieldName,
      targetLanguage,
      options
    );

    if (translation && translation.translatedText) {
      // Track usage
      await translation.trackUsage(options.context);
      return translation.translatedText;
    }

    // Fallback to default language or original content
    if (options.fallbackToDefault !== false) {
      const defaultLanguage = await Language.getDefaultLanguage();
      if (defaultLanguage && defaultLanguage.code !== targetLanguage.toUpperCase()) {
        const defaultTranslation = await Translation.getFieldTranslation(
          resourceType,
          resourceId,
          fieldName,
          defaultLanguage.code,
          options
        );
        
        if (defaultTranslation) {
          return defaultTranslation.translatedText;
        }
      }
    }

    return options.originalText || '';

  } catch (error) {
    logger.error('Failed to get translated content', {
      resourceType,
      resourceId,
      fieldName,
      targetLanguage,
      error: error.message
    });
    return options.originalText || '';
  }
}

/**
 * Get localized content by content key
 * @param {string} contentKey - Content key
 * @param {string} language - Language code
 * @param {Object} variables - Template variables
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Localized content
 */
export async function getLocalizedContent(contentKey, language, variables = {}, options = {}) {
  try {
    // Get base content
    const content = await Content.getByKey(contentKey, language, options);
    if (!content) {
      logger.warn('Content not found', { contentKey, language });
      return contentKey; // Return key as fallback
    }

    // Check if we have a translation for this language
    if (language && language.toUpperCase() !== content.baseLanguage) {
      const translation = await Translation.getFieldTranslation(
        'content',
        content._id,
        'defaultContent',
        language,
        options
      );

      if (translation) {
        // Render translated content with variables
        const translatedContent = content.render(variables, options.variation);
        return typeof translatedContent === 'string' ? 
          replaceVariables(translation.translatedText, variables) :
          translatedContent;
      }
    }

    // Render original content with variables
    return content.render(variables, options.variation);

  } catch (error) {
    logger.error('Failed to get localized content', {
      contentKey,
      language,
      error: error.message
    });
    return contentKey; // Return key as fallback
  }
}

/**
 * Translate and store content
 * @param {string} resourceType - Resource type
 * @param {string} resourceId - Resource ID
 * @param {string} fieldName - Field name
 * @param {string} originalText - Original text to translate
 * @param {string} sourceLanguage - Source language
 * @param {Array} targetLanguages - Target languages
 * @param {Object} options - Translation options
 * @returns {Promise<Array>} Translation results
 */
export async function translateAndStore(resourceType, resourceId, fieldName, originalText, sourceLanguage, targetLanguages, options = {}) {
  try {
    const results = [];

    for (const targetLanguage of targetLanguages) {
      try {
        // Check if translation already exists
        const existingTranslation = await Translation.getFieldTranslation(
          resourceType,
          resourceId,
          fieldName,
          targetLanguage,
          { approvedOnly: false }
        );

        if (existingTranslation && !options.forceRetranslate) {
          results.push({
            language: targetLanguage,
            status: 'exists',
            translation: existingTranslation
          });
          continue;
        }

        // Translate the text
        const translationResult = await translationService.translateText(
          originalText,
          sourceLanguage,
          targetLanguage,
          options
        );

        // Store the translation
        const translationData = {
          resourceType,
          resourceId,
          fieldName,
          sourceLanguage: sourceLanguage.toUpperCase(),
          targetLanguage: targetLanguage.toUpperCase(),
          originalText,
          translatedText: translationResult.translatedText,
          translationMethod: translationResult.provider === 'manual' ? 'manual' : 'automatic',
          provider: translationResult.provider,
          quality: {
            confidence: translationResult.confidence || 0.8,
            reviewStatus: options.autoApprove ? 'approved' : 'pending'
          },
          context: options.context || {},
          createdBy: options.userId
        };

        let translation;
        if (existingTranslation) {
          // Create new version
          translation = await existingTranslation.createNewVersion(
            translationResult.translatedText,
            options.userId
          );
        } else {
          // Create new translation
          translation = new Translation(translationData);
          await translation.save();
        }

        results.push({
          language: targetLanguage,
          status: 'translated',
          translation,
          confidence: translationResult.confidence
        });

      } catch (error) {
        logger.error('Failed to translate individual language', {
          resourceType,
          resourceId,
          fieldName,
          targetLanguage,
          error: error.message
        });

        results.push({
          language: targetLanguage,
          status: 'error',
          error: error.message
        });
      }
    }

    return results;

  } catch (error) {
    logger.error('Failed to translate and store content', {
      resourceType,
      resourceId,
      fieldName,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get available languages for a resource
 * @param {string} resourceType - Resource type
 * @param {string} resourceId - Resource ID
 * @param {Object} options - Options
 * @returns {Promise<Array>} Available languages
 */
export async function getAvailableLanguages(resourceType, resourceId, options = {}) {
  try {
    const pipeline = [
      {
        $match: {
          resourceType,
          resourceId: resourceId,
          isActive: true
        }
      },
      {
        $group: {
          _id: '$targetLanguage',
          count: { $sum: 1 },
          approved: {
            $sum: {
              $cond: [{ $eq: ['$quality.reviewStatus', 'approved'] }, 1, 0]
            }
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$quality.reviewStatus', 'pending'] }, 1, 0]
            }
          },
          lastUpdated: { $max: '$updatedAt' }
        }
      },
      {
        $lookup: {
          from: 'languages',
          localField: '_id',
          foreignField: 'code',
          as: 'languageInfo'
        }
      },
      {
        $project: {
          code: '$_id',
          name: { $arrayElemAt: ['$languageInfo.name', 0] },
          nativeName: { $arrayElemAt: ['$languageInfo.nativeName', 0] },
          totalTranslations: '$count',
          approvedTranslations: '$approved',
          pendingTranslations: '$pending',
          completeness: { 
            $multiply: [
              { $divide: ['$approved', '$count'] }, 
              100
            ]
          },
          lastUpdated: '$lastUpdated'
        }
      },
      { $sort: { completeness: -1, name: 1 } }
    ];

    if (options.approvedOnly) {
      pipeline[0].$match['quality.reviewStatus'] = 'approved';
    }

    return await Translation.aggregate(pipeline);

  } catch (error) {
    logger.error('Failed to get available languages', {
      resourceType,
      resourceId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Format text according to language preferences
 * @param {string} text - Text to format
 * @param {string} languageCode - Language code
 * @param {Object} options - Formatting options
 * @returns {Promise<string>} Formatted text
 */
export async function formatByLanguage(text, languageCode, options = {}) {
  try {
    const language = await Language.getLanguageByCode(languageCode);
    if (!language) {
      return text;
    }

    let formattedText = text;

    // Apply text direction
    if (language.direction === 'rtl' && options.includeDirection) {
      formattedText = `<span dir="rtl">${formattedText}</span>`;
    }

    // Apply text transformations based on formatting preferences
    if (options.transform) {
      switch (options.transform) {
        case 'uppercase':
          formattedText = formattedText.toUpperCase();
          break;
        case 'lowercase':
          formattedText = formattedText.toLowerCase();
          break;
        case 'capitalize':
          formattedText = formattedText.charAt(0).toUpperCase() + formattedText.slice(1).toLowerCase();
          break;
        case 'title':
          formattedText = formattedText.replace(/\w\S*/g, (txt) =>
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
          );
          break;
      }
    }

    return formattedText;

  } catch (error) {
    logger.error('Failed to format by language', {
      text: text?.substring(0, 100),
      languageCode,
      error: error.message
    });
    return text;
  }
}

/**
 * Get language-specific date format
 * @param {Date} date - Date to format
 * @param {string} languageCode - Language code
 * @param {string} format - Format type (short, medium, long, full)
 * @returns {Promise<string>} Formatted date
 */
export async function formatDateByLanguage(date, languageCode, format = 'medium') {
  try {
    const language = await Language.getLanguageByCode(languageCode);
    if (!language) {
      return date.toLocaleDateString();
    }

    // Use language-specific locale for formatting
    return date.toLocaleDateString(language.locale, {
      year: 'numeric',
      month: format === 'short' ? '2-digit' : 'long',
      day: 'numeric',
      ...(format === 'full' && { weekday: 'long' })
    });

  } catch (error) {
    logger.error('Failed to format date by language', {
      date,
      languageCode,
      format,
      error: error.message
    });
    return date.toLocaleDateString();
  }
}

/**
 * Get language-specific number format
 * @param {number} number - Number to format
 * @param {string} languageCode - Language code
 * @param {Object} options - Formatting options
 * @returns {Promise<string>} Formatted number
 */
export async function formatNumberByLanguage(number, languageCode, options = {}) {
  try {
    const language = await Language.getLanguageByCode(languageCode);
    if (!language) {
      return number.toLocaleString();
    }

    return number.toLocaleString(language.locale, {
      minimumFractionDigits: options.minimumFractionDigits || 0,
      maximumFractionDigits: options.maximumFractionDigits || 2,
      style: options.style || 'decimal',
      currency: options.currency
    });

  } catch (error) {
    logger.error('Failed to format number by language', {
      number,
      languageCode,
      error: error.message
    });
    return number.toLocaleString();
  }
}

/**
 * Validate if language is supported
 * @param {string} languageCode - Language code to validate
 * @param {string} context - Optional context (website, email, etc.)
 * @returns {Promise<boolean>} True if supported
 */
export async function isLanguageSupported(languageCode, context = null) {
  try {
    if (context) {
      const languages = await Language.getLanguagesByContext(context);
      return languages.some(lang => lang.code === languageCode.toUpperCase());
    }

    const language = await Language.getLanguageByCode(languageCode);
    return !!language;

  } catch (error) {
    logger.error('Failed to validate language support', {
      languageCode,
      context,
      error: error.message
    });
    return false;
  }
}

/**
 * Get translation workflow status
 * @param {string} resourceType - Resource type
 * @param {string} resourceId - Resource ID
 * @param {string} targetLanguage - Target language
 * @returns {Promise<Object>} Workflow status
 */
export async function getTranslationWorkflowStatus(resourceType, resourceId, targetLanguage) {
  try {
    const translations = await Translation.getResourceTranslations(
      resourceType,
      resourceId,
      { targetLanguage }
    );

    const stats = {
      total: translations.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      needsReview: 0,
      completeness: 0
    };

    translations.forEach(translation => {
      switch (translation.quality.reviewStatus) {
        case 'pending':
          stats.pending++;
          break;
        case 'approved':
          stats.approved++;
          break;
        case 'rejected':
          stats.rejected++;
          break;
        case 'needs_review':
          stats.needsReview++;
          break;
      }
    });

    stats.completeness = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;

    return stats;

  } catch (error) {
    logger.error('Failed to get translation workflow status', {
      resourceType,
      resourceId,
      targetLanguage,
      error: error.message
    });
    throw error;
  }
}

/**
 * Replace variables in text
 * @param {string} text - Text with variables
 * @param {Object} variables - Variable values
 * @returns {string} Text with replaced variables
 */
export function replaceVariables(text, variables = {}) {
  if (typeof text !== 'string') return text;

  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] !== undefined ? variables[varName] : match;
  });
}

/**
 * Extract translatable fields from object
 * @param {Object} obj - Object to extract fields from
 * @param {Array} fieldConfig - Field configuration
 * @returns {Array} Translatable field data
 */
export function extractTranslatableFields(obj, fieldConfig = []) {
  const fields = [];

  fieldConfig.forEach(config => {
    const value = getNestedValue(obj, config.path);
    if (value && typeof value === 'string' && value.trim()) {
      fields.push({
        fieldName: config.name || config.path,
        originalText: value,
        maxLength: config.maxLength,
        context: config.context,
        priority: config.priority || 'medium'
      });
    }
  });

  return fields;
}

/**
 * Get nested object value by path
 * @param {Object} obj - Object to search
 * @param {string} path - Dot-notation path
 * @returns {*} Value at path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Set nested object value by path
 * @param {Object} obj - Object to modify
 * @param {string} path - Dot-notation path
 * @param {*} value - Value to set
 */
export function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    return current[key];
  }, obj);
  target[lastKey] = value;
}

/**
 * Detect language preferences from request
 * @param {Object} req - Express request object
 * @returns {Array} Preferred languages in order
 */
export function detectLanguagePreferences(req) {
  const preferences = [];

  // Check query parameter
  if (req.query.lang || req.query.language) {
    preferences.push((req.query.lang || req.query.language).toUpperCase());
  }

  // Check header parameter
  if (req.headers['x-language']) {
    preferences.push(req.headers['x-language'].toUpperCase());
  }

  // Check Accept-Language header
  if (req.headers['accept-language']) {
    const languages = req.headers['accept-language']
      .split(',')
      .map(lang => lang.split(';')[0].trim().split('-')[0].toUpperCase())
      .filter(lang => lang.length >= 2);
    
    preferences.push(...languages);
  }

  // Remove duplicates and return
  return [...new Set(preferences)];
}

export default {
  getTranslatedContent,
  getLocalizedContent,
  translateAndStore,
  getAvailableLanguages,
  formatByLanguage,
  formatDateByLanguage,
  formatNumberByLanguage,
  isLanguageSupported,
  getTranslationWorkflowStatus,
  replaceVariables,
  extractTranslatableFields,
  setNestedValue,
  detectLanguagePreferences
};