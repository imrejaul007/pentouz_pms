import Currency from '../models/Currency.js';
import exchangeRateService from '../services/exchangeRateService.js';
import currencyUtils from '../utils/currencyUtils.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Currency Management Controller
 * 
 * Handles currency CRUD operations, exchange rate updates, and conversions
 */
class CurrencyController {
  /**
   * Get all currencies with filtering and pagination
   */
  getCurrencies = catchAsync(async (req, res, next) => {
    const {
      isActive,
      channel,
      page = 1,
      limit = 50,
      includeRates = false
    } = req.query;

    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (channel) filter['supportedChannels.channel'] = channel;

    const skip = (page - 1) * limit;

    let query = Currency.find(filter)
      .sort({ code: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    if (!includeRates) {
      query = query.select('-rateHistory');
    }

    const [currencies, total] = await Promise.all([
      query,
      Currency.countDocuments(filter)
    ]);

    res.status(200).json({
      status: 'success',
      results: currencies.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: {
        currencies
      }
    });
  });

  /**
   * Get currency by code
   */
  getCurrency = catchAsync(async (req, res, next) => {
    const { code } = req.params;
    const { includeHistory = false } = req.query;

    let query = Currency.findOne({ code: code.toUpperCase(), isActive: true });
    
    if (!includeHistory) {
      query = query.select('-rateHistory');
    }

    const currency = await query;

    if (!currency) {
      return next(new ApplicationError('Currency not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        currency
      }
    });
  });

  /**
   * Create new currency
   */
  createCurrency = catchAsync(async (req, res, next) => {
    const {
      code,
      name,
      symbol,
      exchangeRate = 1.0,
      decimalPlaces = 2,
      isBaseCurrency = false,
      supportedChannels = [],
      regions = [],
      displayPreferences = {},
      autoUpdate = {}
    } = req.body;

    // Validate required fields
    if (!code || !name || !symbol) {
      return next(new ApplicationError('Code, name, and symbol are required', 400));
    }

    // Check if currency already exists
    const existingCurrency = await Currency.findOne({ code: code.toUpperCase() });
    if (existingCurrency) {
      return next(new ApplicationError('Currency already exists', 409));
    }

    // If this is set as base currency, ensure no other base currency exists
    if (isBaseCurrency) {
      await Currency.ensureSingleBaseCurrency();
    }

    const currency = await Currency.create({
      code: code.toUpperCase(),
      name,
      symbol,
      exchangeRate: isBaseCurrency ? 1.0 : exchangeRate,
      decimalPlaces,
      isBaseCurrency,
      supportedChannels,
      regions,
      displayPreferences: {
        showSymbolBefore: true,
        spaceBetweenSymbolAndAmount: false,
        groupDigits: true,
        ...displayPreferences
      },
      autoUpdate: {
        enabled: !isBaseCurrency,
        source: 'exchangerate_api',
        updateFrequency: 'daily',
        ...autoUpdate
      }
    });

    logger.info('Currency created', {
      code: currency.code,
      name: currency.name,
      isBaseCurrency: currency.isBaseCurrency,
      userId: req.user?._id
    });

    res.status(201).json({
      status: 'success',
      data: {
        currency
      }
    });
  });

  /**
   * Update currency
   */
  updateCurrency = catchAsync(async (req, res, next) => {
    const { code } = req.params;
    const updates = { ...req.body };

    // Prevent code changes
    delete updates.code;

    // Handle base currency changes
    if (updates.isBaseCurrency === true) {
      await Currency.ensureSingleBaseCurrency();
      updates.exchangeRate = 1.0;
    }

    const currency = await Currency.findOneAndUpdate(
      { code: code.toUpperCase() },
      updates,
      { new: true, runValidators: true }
    );

    if (!currency) {
      return next(new ApplicationError('Currency not found', 404));
    }

    logger.info('Currency updated', {
      code: currency.code,
      updates: Object.keys(updates),
      userId: req.user?._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        currency
      }
    });
  });

  /**
   * Delete currency (soft delete - deactivate)
   */
  deleteCurrency = catchAsync(async (req, res, next) => {
    const { code } = req.params;

    const currency = await Currency.findOne({ code: code.toUpperCase() });
    if (!currency) {
      return next(new ApplicationError('Currency not found', 404));
    }

    if (currency.isBaseCurrency) {
      return next(new ApplicationError('Cannot delete base currency', 400));
    }

    currency.isActive = false;
    await currency.save();

    logger.info('Currency deactivated', {
      code: currency.code,
      userId: req.user?._id
    });

    res.status(204).json({
      status: 'success',
      data: null
    });
  });

  /**
   * Convert currency amount
   */
  convertCurrency = catchAsync(async (req, res, next) => {
    const { amount, from, to } = req.query;

    if (!amount || !from || !to) {
      return next(new ApplicationError('Amount, from, and to currency are required', 400));
    }

    const result = await exchangeRateService.convertCurrency(
      parseFloat(amount),
      from.toUpperCase(),
      to.toUpperCase()
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  });

  /**
   * Update exchange rates
   */
  updateExchangeRates = catchAsync(async (req, res, next) => {
    const { currencies, source = 'manual' } = req.body;

    let result;
    
    if (currencies && Array.isArray(currencies)) {
      // Update specific currencies
      const results = [];
      for (const currencyCode of currencies) {
        try {
          const updateResult = await exchangeRateService.updateCurrencyRate(currencyCode, source);
          results.push({ success: true, ...updateResult });
        } catch (error) {
          results.push({
            success: false,
            currency: currencyCode,
            error: error.message
          });
        }
      }
      result = { currencies: results };
    } else {
      // Update all currencies
      result = await exchangeRateService.updateAllCurrencyRates(source);
    }

    logger.info('Exchange rates updated', {
      type: currencies ? 'specific' : 'bulk',
      userId: req.user?._id,
      source
    });

    res.status(200).json({
      status: 'success',
      data: result
    });
  });

  /**
   * Get exchange rate for specific currency pair
   */
  getExchangeRate = catchAsync(async (req, res, next) => {
    const { from, to } = req.params;

    const [fromCurrency, toCurrency] = await Promise.all([
      Currency.getCurrencyByCode(from),
      Currency.getCurrencyByCode(to)
    ]);

    if (!fromCurrency || !toCurrency) {
      return next(new ApplicationError('One or both currencies not found', 404));
    }

    const rate = toCurrency.exchangeRate / fromCurrency.exchangeRate;

    res.status(200).json({
      status: 'success',
      data: {
        from: fromCurrency.code,
        to: toCurrency.code,
        rate: Number(rate.toFixed(6)),
        lastUpdated: Math.max(
          fromCurrency.autoUpdate.lastUpdated?.getTime() || 0,
          toCurrency.autoUpdate.lastUpdated?.getTime() || 0
        )
      }
    });
  });

  /**
   * Get currencies supported by OTA channel
   */
  getChannelCurrencies = catchAsync(async (req, res, next) => {
    const { channel } = req.params;

    const currencies = await Currency.getCurrenciesByChannel(channel);

    res.status(200).json({
      status: 'success',
      results: currencies.length,
      data: {
        channel,
        currencies
      }
    });
  });

  /**
   * Add channel support to currency
   */
  addChannelSupport = catchAsync(async (req, res, next) => {
    const { code } = req.params;
    const { channel, isDefault = false, formatting = {} } = req.body;

    if (!channel) {
      return next(new ApplicationError('Channel is required', 400));
    }

    const currency = await Currency.findOne({ code: code.toUpperCase() });
    if (!currency) {
      return next(new ApplicationError('Currency not found', 404));
    }

    await currency.addChannelSupport(channel, isDefault, formatting);

    logger.info('Channel support added to currency', {
      code: currency.code,
      channel,
      isDefault,
      userId: req.user?._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        currency
      }
    });
  });

  /**
   * Format amount in currency
   */
  formatAmount = catchAsync(async (req, res, next) => {
    const { amount, currency, channel } = req.query;

    if (!amount || !currency) {
      return next(new ApplicationError('Amount and currency are required', 400));
    }

    const formatted = await currencyUtils.formatCurrency(
      parseFloat(amount),
      currency.toUpperCase(),
      { useChannelFormatting: channel }
    );

    res.status(200).json({
      status: 'success',
      data: {
        amount: parseFloat(amount),
        currency: currency.toUpperCase(),
        formatted,
        channel: channel || null
      }
    });
  });

  /**
   * Get currency statistics
   */
  getCurrencyStats = catchAsync(async (req, res, next) => {
    const [
      totalCurrencies,
      activeCurrencies,
      baseCurrency,
      staleCurrencies,
      channelStats
    ] = await Promise.all([
      Currency.countDocuments(),
      Currency.countDocuments({ isActive: true }),
      Currency.getBaseCurrency(),
      Currency.getStaleCurrencies(),
      Currency.aggregate([
        { $unwind: '$supportedChannels' },
        { $group: { _id: '$supportedChannels.channel', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        total: totalCurrencies,
        active: activeCurrencies,
        inactive: totalCurrencies - activeCurrencies,
        baseCurrency: baseCurrency?.code || null,
        staleCurrencies: staleCurrencies.length,
        channelSupport: channelStats
      }
    });
  });

  /**
   * Batch convert multiple amounts
   */
  batchConvert = catchAsync(async (req, res, next) => {
    const { conversions, targetCurrency } = req.body;

    if (!conversions || !Array.isArray(conversions) || !targetCurrency) {
      return next(new ApplicationError('Conversions array and target currency are required', 400));
    }

    const results = await currencyUtils.batchConvertCurrency(conversions, targetCurrency);

    res.status(200).json({
      status: 'success',
      data: {
        targetCurrency,
        results
      }
    });
  });

  /**
   * Get provider health status
   */
  getProviderStatus = catchAsync(async (req, res, next) => {
    const status = await exchangeRateService.getProviderHealthStatus();

    res.status(200).json({
      status: 'success',
      data: {
        providers: status
      }
    });
  });

  /**
   * Get conversion rates for multiple currencies
   */
  getConversionRates = catchAsync(async (req, res, next) => {
    const { baseCurrency = 'USD', targetCurrencies } = req.query;
    
    if (!targetCurrencies) {
      return next(new ApplicationError('targetCurrencies parameter is required', 400));
    }

    const targetCurrenciesList = targetCurrencies.split(',');
    
    // Validate currencies
    const validCurrencies = await Currency.find({ 
      code: { $in: [baseCurrency, ...targetCurrenciesList] },
      isActive: true 
    });
    
    const validCodes = validCurrencies.map(c => c.code);
    
    if (!validCodes.includes(baseCurrency)) {
      return next(new ApplicationError(`Base currency ${baseCurrency} is not supported`, 400));
    }

    const conversionRates = {};
    
    // Get rates for each target currency
    for (const targetCurrency of targetCurrenciesList) {
      if (validCodes.includes(targetCurrency)) {
        try {
          const rate = await exchangeRateService.getExchangeRate(baseCurrency, targetCurrency);
          conversionRates[targetCurrency] = rate;
        } catch (error) {
          logger.warn(`Failed to get rate for ${baseCurrency} to ${targetCurrency}:`, error.message);
          conversionRates[targetCurrency] = null;
        }
      } else {
        conversionRates[targetCurrency] = null;
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        baseCurrency,
        targetCurrencies: targetCurrenciesList,
        conversionRates,
        timestamp: new Date().toISOString()
      }
    });
  });
}

export default new CurrencyController();
