import Language from '../models/Language.js';
import logger from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';

/**
 * Translation Service
 * 
 * Handles automated translation, content management, and localization
 * Supports multiple translation providers with fallback mechanisms
 */
class TranslationService {
  constructor() {
    this.providers = {
      google: {
        name: 'Google Translate',
        url: 'https://translation.googleapis.com/language/translate/v2',
        apiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
        maxCharacters: 5000,
        priority: 1,
        supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar']
      },
      deepl: {
        name: 'DeepL',
        url: 'https://api-free.deepl.com/v2/translate',
        apiKey: process.env.DEEPL_API_KEY,
        maxCharacters: 3000,
        priority: 2,
        supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja']
      },
      azure: {
        name: 'Azure Translator',
        url: 'https://api.cognitive.microsofttranslator.com/translate',
        apiKey: process.env.AZURE_TRANSLATOR_KEY,
        region: process.env.AZURE_TRANSLATOR_REGION,
        maxCharacters: 4000,
        priority: 3,
        supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi']
      }
    };
    
    this.redis = null;
    this.cacheKeyPrefix = 'translations:';
    this.defaultCacheTTL = 86400; // 24 hours cache
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      this.redis = getRedisClient();
      logger.info('Translation service initialized');
    } catch (error) {
      logger.warn('Redis not available for translation caching', { error: error.message });
    }
  }

  /**
   * Translate text from one language to another
   * @param {string} text - Text to translate
   * @param {string} fromLanguage - Source language code
   * @param {string} toLanguage - Target language code
   * @param {Object} options - Translation options
   * @returns {Promise<Object>} Translation result
   */
  async translateText(text, fromLanguage, toLanguage, options = {}) {
    try {
      // Skip translation if source and target are the same
      if (fromLanguage.toLowerCase() === toLanguage.toLowerCase()) {
        return {
          originalText: text,
          translatedText: text,
          fromLanguage,
          toLanguage,
          confidence: 1.0,
          provider: 'none',
          cached: false
        };
      }

      // Check cache first
      const cacheKey = `${this.cacheKeyPrefix}${fromLanguage}_${toLanguage}_${this.hashText(text)}`;
      const cachedTranslation = await this.getCachedTranslation(cacheKey);
      
      if (cachedTranslation) {
        logger.debug('Using cached translation', { fromLanguage, toLanguage });
        return { ...cachedTranslation, cached: true };
      }

      // Get preferred provider or use automatic selection
      const provider = options.provider || await this.selectBestProvider(fromLanguage, toLanguage, text.length);
      
      let translation = await this.translateWithProvider(provider, text, fromLanguage, toLanguage, options);
      
      // Fallback to other providers if preferred fails
      if (!translation) {
        const providers = Object.keys(this.providers)
          .filter(p => p !== provider)
          .sort((a, b) => this.providers[a].priority - this.providers[b].priority);
        
        for (const fallbackProvider of providers) {
          try {
            translation = await this.translateWithProvider(fallbackProvider, text, fromLanguage, toLanguage, options);
            if (translation) {
              logger.info('Used fallback provider for translation', { 
                fallbackProvider, 
                fromLanguage, 
                toLanguage 
              });
              break;
            }
          } catch (error) {
            logger.warn('Fallback provider failed', { 
              provider: fallbackProvider, 
              error: error.message 
            });
            continue;
          }
        }
      }

      if (!translation) {
        throw new Error('All translation providers failed');
      }

      // Cache the result
      await this.cacheTranslation(cacheKey, translation);

      return { ...translation, cached: false };

    } catch (error) {
      logger.error('Translation failed', {
        fromLanguage,
        toLanguage,
        textLength: text?.length || 0,
        error: error.message
      });
      
      // Return original text as fallback
      return {
        originalText: text,
        translatedText: text,
        fromLanguage,
        toLanguage,
        confidence: 0,
        provider: 'fallback',
        error: error.message,
        cached: false
      };
    }
  }

  /**
   * Translate with a specific provider
   * @param {string} provider - Provider name
   * @param {string} text - Text to translate
   * @param {string} fromLanguage - Source language
   * @param {string} toLanguage - Target language
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Translation result
   */
  async translateWithProvider(provider, text, fromLanguage, toLanguage, options = {}) {
    const config = this.providers[provider];
    if (!config || !config.apiKey) {
      throw new Error(`Provider ${provider} not configured`);
    }

    try {
      let result;
      
      switch (provider) {
        case 'google':
          result = await this.translateWithGoogle(text, fromLanguage, toLanguage, config);
          break;
        case 'deepl':
          result = await this.translateWithDeepL(text, fromLanguage, toLanguage, config);
          break;
        case 'azure':
          result = await this.translateWithAzure(text, fromLanguage, toLanguage, config);
          break;
        default:
          throw new Error(`Provider ${provider} not implemented`);
      }

      logger.info('Translation completed', {
        provider,
        fromLanguage,
        toLanguage,
        textLength: text.length,
        confidence: result.confidence
      });

      return result;

    } catch (error) {
      logger.error('Provider translation failed', {
        provider,
        fromLanguage,
        toLanguage,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Translate with Google Translate
   */
  async translateWithGoogle(text, fromLanguage, toLanguage, config) {
    const response = await fetch(`${config.url}?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: fromLanguage.toLowerCase(),
        target: toLanguage.toLowerCase(),
        format: 'text'
      })
    });

    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.data || !data.data.translations || data.data.translations.length === 0) {
      throw new Error('Invalid response from Google Translate');
    }

    return {
      originalText: text,
      translatedText: data.data.translations[0].translatedText,
      fromLanguage,
      toLanguage,
      confidence: 0.9, // Google doesn't provide confidence scores
      provider: 'google'
    };
  }

  /**
   * Translate with DeepL
   */
  async translateWithDeepL(text, fromLanguage, toLanguage, config) {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${config.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: text,
        source_lang: fromLanguage.toUpperCase(),
        target_lang: toLanguage.toUpperCase(),
        preserve_formatting: '1'
      })
    });

    if (!response.ok) {
      throw new Error(`DeepL API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.translations || data.translations.length === 0) {
      throw new Error('Invalid response from DeepL');
    }

    return {
      originalText: text,
      translatedText: data.translations[0].text,
      fromLanguage,
      toLanguage,
      confidence: 0.95, // DeepL is generally high quality
      provider: 'deepl',
      detectedSourceLanguage: data.translations[0].detected_source_language
    };
  }

  /**
   * Translate with Azure Translator
   */
  async translateWithAzure(text, fromLanguage, toLanguage, config) {
    const response = await fetch(`${config.url}?api-version=3.0&from=${fromLanguage}&to=${toLanguage}`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.apiKey,
        'Ocp-Apim-Subscription-Region': config.region,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ text: text }])
    });

    if (!response.ok) {
      throw new Error(`Azure Translator API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || data.length === 0 || !data[0].translations || data[0].translations.length === 0) {
      throw new Error('Invalid response from Azure Translator');
    }

    const translation = data[0].translations[0];

    return {
      originalText: text,
      translatedText: translation.text,
      fromLanguage,
      toLanguage,
      confidence: translation.confidence || 0.8,
      provider: 'azure'
    };
  }

  /**
   * Batch translate multiple texts
   * @param {Array} texts - Array of texts to translate
   * @param {string} fromLanguage - Source language
   * @param {string} toLanguage - Target language
   * @param {Object} options - Translation options
   * @returns {Promise<Array>} Array of translation results
   */
  async batchTranslate(texts, fromLanguage, toLanguage, options = {}) {
    try {
      const results = [];
      const batchSize = options.batchSize || 10;

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchPromises = batch.map((text, index) => 
          this.translateText(text.text, fromLanguage, toLanguage, options)
            .then(result => ({ ...result, identifier: text.identifier || index + i }))
            .catch(error => ({
              identifier: text.identifier || index + i,
              originalText: text.text,
              translatedText: text.text,
              fromLanguage,
              toLanguage,
              confidence: 0,
              error: error.message,
              success: false
            }))
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add delay between batches to respect rate limits
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return results;

    } catch (error) {
      logger.error('Batch translation failed', {
        fromLanguage,
        toLanguage,
        textCount: texts.length,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Select the best provider for translation
   */
  async selectBestProvider(fromLanguage, toLanguage, textLength) {
    const availableProviders = Object.entries(this.providers)
      .filter(([name, config]) => {
        return config.apiKey &&
               config.supportedLanguages.includes(fromLanguage.toLowerCase()) &&
               config.supportedLanguages.includes(toLanguage.toLowerCase()) &&
               textLength <= config.maxCharacters;
      })
      .sort(([, a], [, b]) => a.priority - b.priority);

    if (availableProviders.length === 0) {
      throw new Error('No suitable translation provider found');
    }

    return availableProviders[0][0];
  }

  /**
   * Detect language of text
   * @param {string} text - Text to analyze
   * @returns {Promise<Object>} Detection result
   */
  async detectLanguage(text) {
    try {
      // Try Google Detect API first
      const googleConfig = this.providers.google;
      if (googleConfig.apiKey) {
        const response = await fetch(`https://translation.googleapis.com/language/translate/v2/detect?key=${googleConfig.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q: text })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.detections && data.data.detections.length > 0) {
            return {
              language: data.data.detections[0][0].language,
              confidence: data.data.detections[0][0].confidence,
              provider: 'google'
            };
          }
        }
      }

      // Fallback to basic language detection (implement using a library like franc)
      return {
        language: 'en', // Default fallback
        confidence: 0.5,
        provider: 'fallback'
      };

    } catch (error) {
      logger.error('Language detection failed', { error: error.message });
      return {
        language: 'en',
        confidence: 0,
        error: error.message,
        provider: 'fallback'
      };
    }
  }

  /**
   * Get translation quality score
   */
  async getTranslationQuality(originalText, translatedText, fromLanguage, toLanguage) {
    try {
      // Implement quality assessment logic
      // This could include:
      // - Length comparison
      // - Back-translation verification
      // - Language-specific quality metrics
      
      const lengthRatio = translatedText.length / originalText.length;
      const lengthScore = lengthRatio > 0.5 && lengthRatio < 2.0 ? 1.0 : 0.5;
      
      // Basic quality score calculation
      const qualityScore = lengthScore * 0.8; // Placeholder calculation
      
      return {
        overallScore: qualityScore,
        metrics: {
          lengthRatio,
          lengthScore
        },
        recommendation: qualityScore > 0.7 ? 'accept' : 'review'
      };

    } catch (error) {
      logger.error('Quality assessment failed', { error: error.message });
      return {
        overallScore: 0.5,
        metrics: {},
        recommendation: 'review',
        error: error.message
      };
    }
  }

  /**
   * Cache translation result
   */
  async cacheTranslation(cacheKey, translation) {
    if (!this.redis) return;

    try {
      await this.redis.setex(
        cacheKey,
        this.defaultCacheTTL,
        JSON.stringify(translation)
      );
    } catch (error) {
      logger.warn('Failed to cache translation', { error: error.message });
    }
  }

  /**
   * Get cached translation
   */
  async getCachedTranslation(cacheKey) {
    if (!this.redis) return null;

    try {
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Failed to get cached translation', { error: error.message });
      return null;
    }
  }

  /**
   * Generate hash for text (for caching)
   */
  hashText(text) {
    // Simple hash function for caching keys
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get provider health status
   */
  async getProviderHealthStatus() {
    const results = {};

    for (const [providerName, config] of Object.entries(this.providers)) {
      try {
        if (!config.apiKey) {
          results[providerName] = {
            status: 'not_configured',
            message: 'API key not provided'
          };
          continue;
        }

        const startTime = Date.now();
        
        // Test translation with a simple phrase
        await this.translateWithProvider(providerName, 'Hello', 'en', 'es');
        
        const responseTime = Date.now() - startTime;

        results[providerName] = {
          status: 'healthy',
          responseTime,
          lastCheck: new Date()
        };
      } catch (error) {
        results[providerName] = {
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date()
        };
      }
    }

    return results;
  }

  /**
   * Get supported languages for all providers
   */
  getSupportedLanguages() {
    const allLanguages = new Set();
    
    Object.values(this.providers).forEach(config => {
      config.supportedLanguages.forEach(lang => allLanguages.add(lang));
    });

    return Array.from(allLanguages).sort();
  }
}

// Create singleton instance
const translationService = new TranslationService();

export default translationService;