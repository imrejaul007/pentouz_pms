import Language from '../models/Language.js';
import Translation from '../models/Translation.js';
import Content from '../models/Content.js';
import translationService from '../services/translationService.js';
import localizationUtils from '../utils/localizationUtils.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Language Management Controller
 * 
 * Handles language CRUD operations, translation management, and localization features
 */
class LanguageController {
  /**
   * Get all languages with filtering and pagination
   */
  getLanguages = catchAsync(async (req, res, next) => {
    const {
      isActive,
      context,
      channel,
      page = 1,
      limit = 50,
      includeStats = false
    } = req.query;

    let query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';

    let languages;
    
    if (context) {
      languages = await Language.getLanguagesByContext(context);
    } else if (channel) {
      languages = await Language.getLanguagesByChannel(channel);
    } else {
      languages = await Language.getActiveLanguages(query);
    }

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedLanguages = languages.slice(skip, skip + parseInt(limit));

    // Include statistics if requested
    if (includeStats === 'true') {
      for (const language of paginatedLanguages) {
        const stats = await Translation.getTranslationStats({ 
          targetLanguage: language.code 
        });
        language.translationStats = stats;
      }
    }

    res.status(200).json({
      status: 'success',
      results: paginatedLanguages.length,
      total: languages.length,
      currentPage: parseInt(page),
      totalPages: Math.ceil(languages.length / limit),
      data: {
        languages: paginatedLanguages
      }
    });
  });

  /**
   * Get language by code
   */
  getLanguage = catchAsync(async (req, res, next) => {
    const { code } = req.params;
    const { includeStats = false } = req.query;

    const language = await Language.getLanguageByCode(code);
    if (!language) {
      return next(new ApplicationError('Language not found', 404));
    }

    if (includeStats === 'true') {
      const stats = await Translation.getTranslationStats({ 
        targetLanguage: language.code 
      });
      language.translationStats = stats;
    }

    res.status(200).json({
      status: 'success',
      data: {
        language
      }
    });
  });

  /**
   * Create new language
   */
  createLanguage = catchAsync(async (req, res, next) => {
    const {
      code,
      name,
      nativeName,
      locale,
      direction = 'ltr',
      formatting = {},
      translation = {},
      otaChannels = [],
      contexts = [],
      isDefault = false
    } = req.body;

    // Validate required fields
    if (!code || !name || !nativeName || !locale) {
      return next(new ApplicationError('Code, name, nativeName, and locale are required', 400));
    }

    // Check if language already exists
    const existingLanguage = await Language.findOne({ code: code.toUpperCase() });
    if (existingLanguage) {
      return next(new ApplicationError('Language already exists', 409));
    }

    // If this is set as default, ensure no other default exists
    if (isDefault) {
      await Language.ensureSingleDefault();
    }

    const language = await Language.create({
      code: code.toUpperCase(),
      name,
      nativeName,
      locale: locale.toLowerCase(),
      direction,
      formatting: {
        dateFormat: {
          short: 'MM/DD/YYYY',
          medium: 'MMM D, YYYY',
          long: 'MMMM D, YYYY',
          full: 'dddd, MMMM D, YYYY',
          ...formatting.dateFormat
        },
        timeFormat: {
          short: 'HH:mm',
          medium: 'HH:mm:ss',
          long: 'HH:mm:ss z',
          ...formatting.timeFormat
        },
        numberFormat: {
          decimalSeparator: '.',
          thousandsSeparator: ',',
          currencyPosition: 'before',
          ...formatting.numberFormat
        },
        addressFormat: formatting.addressFormat || '{street}\n{city}, {state} {postalCode}\n{country}'
      },
      translation,
      otaChannels,
      contexts,
      isDefault,
      createdBy: req.user._id
    });

    logger.info('Language created', {
      code: language.code,
      name: language.name,
      isDefault: language.isDefault,
      userId: req.user._id
    });

    res.status(201).json({
      status: 'success',
      data: {
        language
      }
    });
  });

  /**
   * Update language
   */
  updateLanguage = catchAsync(async (req, res, next) => {
    const { code } = req.params;
    const updates = { ...req.body };

    // Prevent code changes
    delete updates.code;

    // Handle default language changes
    if (updates.isDefault === true) {
      await Language.ensureSingleDefault();
    }

    const language = await Language.findOneAndUpdate(
      { code: code.toUpperCase() },
      { ...updates, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );

    if (!language) {
      return next(new ApplicationError('Language not found', 404));
    }

    logger.info('Language updated', {
      code: language.code,
      updates: Object.keys(updates),
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        language
      }
    });
  });

  /**
   * Delete language (soft delete - deactivate)
   */
  deleteLanguage = catchAsync(async (req, res, next) => {
    const { code } = req.params;

    const language = await Language.findOne({ code: code.toUpperCase() });
    if (!language) {
      return next(new ApplicationError('Language not found', 404));
    }

    if (language.isDefault) {
      return next(new ApplicationError('Cannot delete default language', 400));
    }

    language.isActive = false;
    await language.save();

    logger.info('Language deactivated', {
      code: language.code,
      userId: req.user._id
    });

    res.status(204).json({
      status: 'success',
      data: null
    });
  });

  /**
   * Get translations for a resource
   */
  getResourceTranslations = catchAsync(async (req, res, next) => {
    const { resourceType, resourceId } = req.params;
    const { 
      targetLanguage, 
      approvedOnly = true,
      includeHistory = false 
    } = req.query;

    const options = { 
      approvedOnly: approvedOnly === 'true',
      targetLanguage
    };

    const translations = await Translation.getResourceTranslations(
      resourceType,
      resourceId,
      options
    );

    if (includeHistory === 'true') {
      // Include translation history for each field
      for (const translation of translations) {
        const history = await Translation.find({
          resourceType,
          resourceId,
          fieldName: translation.fieldName,
          targetLanguage: translation.targetLanguage
        })
        .sort({ version: -1 })
        .populate('createdBy updatedBy quality.reviewedBy', 'name email');
        
        translation.history = history;
      }
    }

    res.status(200).json({
      status: 'success',
      results: translations.length,
      data: {
        resourceType,
        resourceId,
        translations
      }
    });
  });

  /**
   * Translate resource content
   */
  translateResource = catchAsync(async (req, res, next) => {
    const { resourceType, resourceId } = req.params;
    const { 
      fieldName,
      originalText,
      sourceLanguage = 'EN',
      targetLanguages,
      provider,
      autoApprove = false,
      context = {}
    } = req.body;

    if (!fieldName || !originalText || !targetLanguages || !Array.isArray(targetLanguages)) {
      return next(new ApplicationError('fieldName, originalText, and targetLanguages array are required', 400));
    }

    const options = {
      provider,
      autoApprove,
      context,
      userId: req.user._id
    };

    const results = await localizationUtils.translateAndStore(
      resourceType,
      resourceId,
      fieldName,
      originalText,
      sourceLanguage,
      targetLanguages,
      options
    );

    logger.info('Resource translation requested', {
      resourceType,
      resourceId,
      fieldName,
      sourceLanguage,
      targetLanguages: targetLanguages.length,
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        results
      }
    });
  });

  /**
   * Approve translation
   */
  approveTranslation = catchAsync(async (req, res, next) => {
    const { translationId } = req.params;
    const { notes = '' } = req.body;

    const translation = await Translation.findById(translationId);
    if (!translation) {
      return next(new ApplicationError('Translation not found', 404));
    }

    await translation.approve(req.user._id, notes);

    logger.info('Translation approved', {
      translationId,
      resourceType: translation.resourceType,
      targetLanguage: translation.targetLanguage,
      reviewerId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        translation
      }
    });
  });

  /**
   * Reject translation
   */
  rejectTranslation = catchAsync(async (req, res, next) => {
    const { translationId } = req.params;
    const { notes = '' } = req.body;

    const translation = await Translation.findById(translationId);
    if (!translation) {
      return next(new ApplicationError('Translation not found', 404));
    }

    await translation.reject(req.user._id, notes);

    logger.info('Translation rejected', {
      translationId,
      resourceType: translation.resourceType,
      targetLanguage: translation.targetLanguage,
      reviewerId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        translation
      }
    });
  });

  /**
   * Get pending translations for review
   */
  getPendingTranslations = catchAsync(async (req, res, next) => {
    const {
      assignedTo,
      targetLanguage,
      priority,
      limit = 50
    } = req.query;

    const options = {
      assignedTo: assignedTo || req.user._id,
      targetLanguage,
      priority,
      limit: parseInt(limit)
    };

    const translations = await Translation.getPendingTranslations(options);

    res.status(200).json({
      status: 'success',
      results: translations.length,
      data: {
        translations
      }
    });
  });

  /**
   * Bulk approve/reject translations
   */
  bulkUpdateTranslations = catchAsync(async (req, res, next) => {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return next(new ApplicationError('Updates array is required', 400));
    }

    const processedUpdates = updates.map(update => ({
      id: update.id,
      data: {
        'quality.reviewStatus': update.action,
        'quality.reviewedBy': req.user._id,
        'quality.reviewedAt': new Date(),
        'quality.reviewNotes': update.notes || '',
        'workflow.stage': update.action === 'approved' ? 'approved' : 'translation'
      }
    }));

    const result = await Translation.bulkUpdateTranslations(processedUpdates, req.user._id);

    logger.info('Bulk translation update completed', {
      count: updates.length,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        updates: updates.length
      }
    });
  });

  /**
   * Get translation statistics
   */
  getTranslationStats = catchAsync(async (req, res, next) => {
    const { 
      resourceType,
      targetLanguage,
      dateFrom,
      dateTo 
    } = req.query;

    const filters = {};
    if (resourceType) filters.resourceType = resourceType;
    if (targetLanguage) filters.targetLanguage = targetLanguage.toUpperCase();
    if (dateFrom || dateTo) {
      filters.createdAt = {};
      if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filters.createdAt.$lte = new Date(dateTo);
    }

    const stats = await Translation.getTranslationStats(filters);

    // Get provider health status
    const providerStatus = await translationService.getProviderHealthStatus();

    res.status(200).json({
      status: 'success',
      data: {
        translationStats: stats,
        providerStatus
      }
    });
  });

  /**
   * Add channel support to language
   */
  addChannelSupport = catchAsync(async (req, res, next) => {
    const { code } = req.params;
    const { 
      channel, 
      channelLanguageCode,
      isDefault = false, 
      formatting = {} 
    } = req.body;

    if (!channel) {
      return next(new ApplicationError('Channel is required', 400));
    }

    const language = await Language.findOne({ code: code.toUpperCase() });
    if (!language) {
      return next(new ApplicationError('Language not found', 404));
    }

    await language.addChannelSupport(channel, {
      channelLanguageCode,
      isDefault,
      formatting
    });

    logger.info('Channel support added to language', {
      code: language.code,
      channel,
      isDefault,
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        language
      }
    });
  });

  /**
   * Detect text language
   */
  detectLanguage = catchAsync(async (req, res, next) => {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return next(new ApplicationError('Text is required', 400));
    }

    const detection = await translationService.detectLanguage(text);

    res.status(200).json({
      status: 'success',
      data: detection
    });
  });

  /**
   * Get supported languages for translation
   */
  getSupportedLanguages = catchAsync(async (req, res, next) => {
    const supportedLanguages = translationService.getSupportedLanguages();
    
    // Get language details for each supported code
    const languageDetails = await Promise.all(
      supportedLanguages.map(async (code) => {
        const language = await Language.getLanguageByCode(code.toUpperCase());
        return language || { code: code.toUpperCase(), name: code, supported: true };
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        supportedLanguages: languageDetails
      }
    });
  });

  /**
   * Get translation workflow status
   */
  getWorkflowStatus = catchAsync(async (req, res, next) => {
    const { resourceType, resourceId, targetLanguage } = req.params;

    const status = await localizationUtils.getTranslationWorkflowStatus(
      resourceType,
      resourceId,
      targetLanguage
    );

    res.status(200).json({
      status: 'success',
      data: {
        workflowStatus: status
      }
    });
  });

  /**
   * Format content by language
   */
  formatContent = catchAsync(async (req, res, next) => {
    const { text, languageCode, options = {} } = req.body;

    if (!text || !languageCode) {
      return next(new ApplicationError('Text and languageCode are required', 400));
    }

    const formattedText = await localizationUtils.formatByLanguage(
      text, 
      languageCode, 
      options
    );

    res.status(200).json({
      status: 'success',
      data: {
        originalText: text,
        formattedText,
        languageCode,
        options
      }
    });
  });
}

export default new LanguageController();
