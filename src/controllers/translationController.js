import Translation from '../models/Translation.js';
import Language from '../models/Language.js';
import translationService from '../services/translationService.js';
import logger from '../utils/logger.js';

/**
 * Translation Controller
 * 
 * Handles translation management operations for the frontend localization system
 */
class TranslationController {
  
  /**
   * Get translation namespaces
   */
  async getNamespaces(req, res) {
    try {
      const namespaces = await Translation.aggregate([
        { $match: { isActive: true } },
        { $group: { 
            _id: '$namespace',
            keyCount: { $sum: 1 },
            languages: { $addToSet: '$translations.language' },
            lastUpdated: { $max: '$updatedAt' }
          }
        },
        { $project: {
            name: '$_id',
            keyCount: 1,
            languages: { $reduce: {
              input: '$languages',
              initialValue: [],
              in: { $setUnion: ['$$value', '$$this'] }
            }},
            lastUpdated: 1,
            _id: 0
          }
        },
        { $sort: { name: 1 } }
      ]);

      // Calculate completeness for each namespace
      const namespacesWithCompleteness = await Promise.all(
        namespaces.map(async (ns) => {
          const completeness = {};
          
          for (const language of ns.languages) {
            const total = ns.keyCount;
            const translated = await Translation.countDocuments({
              namespace: ns.name,
              'translations.language': language,
              'translations.status': { $in: ['approved', 'published'] },
              isActive: true
            });
            
            completeness[language] = total > 0 ? Math.round((translated / total) * 100) : 0;
          }
          
          return {
            ...ns,
            completeness
          };
        })
      );

      res.json({
        success: true,
        data: namespacesWithCompleteness,
        meta: { total: namespacesWithCompleteness.length }
      });
    } catch (error) {
      logger.error('Error getting translation namespaces', { error: error.message });
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get translations for namespace and language
   */
  async getTranslations(req, res) {
    try {
      const { namespace, language } = req.params;
      const { includeStatus, includeMeta, context } = req.query;

      const query = {
        namespace,
        isActive: true
      };

      if (context) {
        query.contexts = context;
      }

      const translations = await Translation.find(query).lean();
      
      const result = {};
      let keyCount = 0;
      let completeness = 0;
      let approvedCount = 0;

      translations.forEach(translation => {
        const langTranslation = translation.translations.find(t => 
          t.language === language.toUpperCase()
        );

        keyCount++;
        
        if (langTranslation) {
          if (includeStatus === 'true' || includeMeta === 'true') {
            result[translation.key] = {
              text: langTranslation.text,
              status: langTranslation.status,
              sourceText: translation.sourceText,
              confidence: langTranslation.confidence,
              provider: langTranslation.provider,
              translatedAt: langTranslation.translatedAt
            };
          } else {
            result[translation.key] = langTranslation.text;
          }

          if (langTranslation.status === 'approved' || langTranslation.status === 'published') {
            approvedCount++;
          }
        } else {
          // Return source text as fallback
          if (includeStatus === 'true' || includeMeta === 'true') {
            result[translation.key] = {
              text: translation.sourceText,
              status: 'pending',
              sourceText: translation.sourceText,
              confidence: 0
            };
          } else {
            result[translation.key] = translation.sourceText;
          }
        }
      });

      completeness = keyCount > 0 ? Math.round((approvedCount / keyCount) * 100) : 0;

      res.json({
        success: true,
        data: result,
        meta: {
          namespace,
          language: language.toUpperCase(),
          keyCount,
          completeness
        }
      });
    } catch (error) {
      logger.error('Error getting translations', { error: error.message });
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get batch translations
   */
  async getBatchTranslations(req, res) {
    try {
      const { keys, language, namespace } = req.body;

      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Keys array is required'
        });
      }

      const translations = await Translation.find({
        namespace: namespace || 'common',
        key: { $in: keys },
        isActive: true
      }).lean();

      const result = {};
      const missing = [];

      keys.forEach(key => {
        const translation = translations.find(t => t.key === key);
        
        if (translation) {
          const langTranslation = translation.translations.find(t => 
            t.language === language.toUpperCase()
          );
          
          result[key] = langTranslation ? langTranslation.text : translation.sourceText;
        } else {
          result[key] = key; // Fallback to key itself
          missing.push(key);
        }
      });

      res.json({
        success: true,
        data: result,
        meta: {
          found: Object.keys(result).length - missing.length,
          missing
        }
      });
    } catch (error) {
      logger.error('Error getting batch translations', { error: error.message });
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Translate text
   */
  async translateText(req, res) {
    try {
      const { text, fromLanguage, toLanguage, context, namespace, key, options = {} } = req.body;

      if (!text || !toLanguage) {
        return res.status(400).json({
          success: false,
          message: 'Text and target language are required'
        });
      }

      const result = await translationService.translateText(
        text,
        fromLanguage || 'EN',
        toLanguage,
        options
      );

      // Save translation if key and namespace provided
      if (key && namespace) {
        try {
          const existingTranslation = await Translation.findOne({ key, namespace });
          
          if (existingTranslation) {
            // Update existing translation
            const langIndex = existingTranslation.translations.findIndex(t => 
              t.language === toLanguage.toUpperCase()
            );
            
            if (langIndex >= 0) {
              existingTranslation.translations[langIndex] = {
                ...existingTranslation.translations[langIndex],
                text: result.translatedText,
                confidence: result.confidence,
                provider: result.provider,
                translatedAt: new Date(),
                status: 'translated'
              };
            } else {
              existingTranslation.translations.push({
                language: toLanguage.toUpperCase(),
                text: result.translatedText,
                confidence: result.confidence,
                provider: result.provider,
                translatedAt: new Date(),
                status: 'translated'
              });
            }
            
            await existingTranslation.save();
          } else {
            // Create new translation
            const newTranslation = new Translation({
              key,
              namespace,
              context: context || '',
              sourceLanguage: fromLanguage || 'EN',
              sourceText: text,
              translations: [{
                language: toLanguage.toUpperCase(),
                text: result.translatedText,
                confidence: result.confidence,
                provider: result.provider,
                translatedAt: new Date(),
                status: 'translated'
              }],
              priority: options.priority || 'medium',
              isActive: true
            });
            
            await newTranslation.save();
          }
        } catch (saveError) {
          logger.warn('Failed to save translation', { error: saveError.message });
        }
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error translating text', { error: error.message });
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Batch translate
   */
  async batchTranslate(req, res) {
    try {
      const { items, fromLanguage, toLanguages, options = {} } = req.body;

      if (!items || !Array.isArray(items) || !toLanguages || !Array.isArray(toLanguages)) {
        return res.status(400).json({
          success: false,
          message: 'Items and target languages arrays are required'
        });
      }

      const results = [];
      let successful = 0;
      let failed = 0;

      for (const item of items) {
        try {
          const itemResults = {
            key: item.key,
            originalText: item.text,
            translations: {}
          };

          for (const toLanguage of toLanguages) {
            try {
              const result = await translationService.translateText(
                item.text,
                fromLanguage || 'EN',
                toLanguage,
                options
              );

              itemResults.translations[toLanguage] = {
                text: result.translatedText,
                confidence: result.confidence,
                provider: result.provider
              };

              successful++;
            } catch (langError) {
              itemResults.translations[toLanguage] = {
                error: langError.message
              };
              failed++;
            }
          }

          results.push(itemResults);
        } catch (itemError) {
          results.push({
            key: item.key,
            originalText: item.text,
            error: itemError.message
          });
          failed++;
        }
      }

      res.json({
        success: true,
        data: {
          results,
          summary: {
            total: items.length * toLanguages.length,
            successful,
            failed
          }
        }
      });
    } catch (error) {
      logger.error('Error batch translating', { error: error.message });
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Save translation
   */
  async saveTranslation(req, res) {
    try {
      const { key, namespace, sourceText, translations, context, tags, priority, autoApprove } = req.body;

      if (!key || !namespace || !sourceText) {
        return res.status(400).json({
          success: false,
          message: 'Key, namespace, and source text are required'
        });
      }

      let translation = await Translation.findOne({ key, namespace });

      if (translation) {
        // Update existing translation
        translation.sourceText = sourceText;
        translation.context = context || translation.context;
        translation.tags = tags || translation.tags;
        translation.priority = priority || translation.priority;

        // Update translations
        Object.entries(translations).forEach(([language, text]) => {
          const langIndex = translation.translations.findIndex(t => 
            t.language === language.toUpperCase()
          );

          if (langIndex >= 0) {
            translation.translations[langIndex] = {
              ...translation.translations[langIndex],
              text,
              status: autoApprove ? 'approved' : 'translated',
              translatedAt: new Date()
            };
          } else {
            translation.translations.push({
              language: language.toUpperCase(),
              text,
              status: autoApprove ? 'approved' : 'translated',
              translatedAt: new Date(),
              confidence: 1.0,
              provider: 'manual'
            });
          }
        });

        await translation.save();
      } else {
        // Create new translation
        const translationData = {
          key,
          namespace,
          context: context || '',
          sourceLanguage: 'EN',
          sourceText,
          translations: Object.entries(translations).map(([language, text]) => ({
            language: language.toUpperCase(),
            text,
            status: autoApprove ? 'approved' : 'translated',
            confidence: 1.0,
            provider: 'manual',
            translatedAt: new Date()
          })),
          tags: tags || [],
          priority: priority || 'medium',
          isActive: true
        };

        translation = new Translation(translationData);
        await translation.save();
      }

      res.json({
        success: true,
        data: translation,
        message: 'Translation saved successfully'
      });
    } catch (error) {
      logger.error('Error saving translation', { error: error.message });
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Delete translation
   */
  async deleteTranslation(req, res) {
    try {
      const { namespace, key } = req.params;

      const translation = await Translation.findOneAndDelete({ 
        namespace, 
        key,
        isActive: true 
      });

      if (!translation) {
        return res.status(404).json({
          success: false,
          message: 'Translation not found'
        });
      }

      res.json({
        success: true,
        message: 'Translation deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting translation', { error: error.message });
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Approve translation
   */
  async approveTranslation(req, res) {
    try {
      const { namespace, key } = req.params;
      const { language, reviewerId } = req.body;

      const translation = await Translation.findOne({ 
        namespace, 
        key,
        isActive: true 
      });

      if (!translation) {
        return res.status(404).json({
          success: false,
          message: 'Translation not found'
        });
      }

      const langTranslation = translation.translations.find(t => 
        t.language === language.toUpperCase()
      );

      if (!langTranslation) {
        return res.status(404).json({
          success: false,
          message: 'Language translation not found'
        });
      }

      langTranslation.status = 'approved';
      langTranslation.reviewedBy = reviewerId || req.user?.id;
      langTranslation.reviewedAt = new Date();

      await translation.save();

      res.json({
        success: true,
        message: 'Translation approved successfully'
      });
    } catch (error) {
      logger.error('Error approving translation', { error: error.message });
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get translation statistics
   */
  async getTranslationStats(req, res) {
    try {
      const { namespace, language, startDate, endDate } = req.query;

      const matchQuery = { isActive: true };
      if (namespace) matchQuery.namespace = namespace;

      const dateFilter = {};
      if (startDate || endDate) {
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);
        matchQuery.updatedAt = dateFilter;
      }

      // Overall statistics
      const [overallStats] = await Translation.aggregate([
        { $match: matchQuery },
        { $group: {
            _id: null,
            totalKeys: { $sum: 1 },
            totalTranslations: { 
              $sum: { $size: '$translations' }
            },
            lastUpdated: { $max: '$updatedAt' }
          }
        }
      ]);

      // By language statistics
      const languageStats = await Translation.aggregate([
        { $match: matchQuery },
        { $unwind: '$translations' },
        ...(language ? [{ $match: { 'translations.language': language.toUpperCase() } }] : []),
        { $group: {
            _id: '$translations.language',
            keyCount: { $sum: 1 },
            pendingCount: { 
              $sum: { $cond: [{ $eq: ['$translations.status', 'pending'] }, 1, 0] }
            },
            translatedCount: { 
              $sum: { $cond: [{ $eq: ['$translations.status', 'translated'] }, 1, 0] }
            },
            approvedCount: { 
              $sum: { $cond: [{ $eq: ['$translations.status', 'approved'] }, 1, 0] }
            },
            publishedCount: { 
              $sum: { $cond: [{ $eq: ['$translations.status', 'published'] }, 1, 0] }
            }
          }
        }
      ]);

      // By namespace statistics
      const namespaceStats = await Translation.aggregate([
        { $match: matchQuery },
        { $group: {
            _id: '$namespace',
            keyCount: { $sum: 1 },
            lastUpdated: { $max: '$updatedAt' }
          }
        }
      ]);

      // Calculate completeness
      const totalKeys = overallStats?.totalKeys || 0;
      const approvedTranslations = languageStats.reduce((sum, stat) => 
        sum + (stat.approvedCount || 0) + (stat.publishedCount || 0), 0
      );
      const completeness = totalKeys > 0 ? (approvedTranslations / (totalKeys * languageStats.length)) * 100 : 0;

      // Format results
      const byLanguage = {};
      languageStats.forEach(stat => {
        const total = stat.keyCount;
        byLanguage[stat._id] = {
          keyCount: total,
          completeness: total > 0 ? ((stat.approvedCount + stat.publishedCount) / total) * 100 : 0,
          pendingCount: stat.pendingCount,
          approvedCount: stat.approvedCount + stat.publishedCount
        };
      });

      const byNamespace = {};
      namespaceStats.forEach(stat => {
        byNamespace[stat._id] = {
          keyCount: stat.keyCount,
          completeness: 0, // Would need separate calculation
          lastUpdated: stat.lastUpdated
        };
      });

      res.json({
        success: true,
        data: {
          overview: {
            totalKeys: totalKeys,
            totalTranslations: overallStats?.totalTranslations || 0,
            completeness: Math.round(completeness),
            lastUpdated: overallStats?.lastUpdated || new Date()
          },
          byLanguage,
          byNamespace
        }
      });
    } catch (error) {
      logger.error('Error getting translation stats', { error: error.message });
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new TranslationController();
