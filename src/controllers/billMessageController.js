import BillMessage from '../models/BillMessage.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Bill Message Controller
 * 
 * Handles bill message management operations including:
 * - Message CRUD operations
 * - Message processing and rendering
 * - Multi-language support
 * - Message analytics and reporting
 */

class BillMessageController {
  /**
   * Create a new bill message
   */
  createMessage = catchAsync(async (req, res, next) => {
    const {
      name,
      title,
      description,
      messageType,
      content,
      htmlContent,
      variables,
      displayConfig,
      conditions,
      scheduling,
      localization,
      category,
      sortOrder,
      priority,
      posIntegration,
      metadata
    } = req.body;

    // Validate required fields
    if (!name || !title || !messageType || !content) {
      return next(new ApplicationError('Name, title, message type, and content are required', 400));
    }

    // Check for duplicate message name in the same hotel
    const existingMessage = await BillMessage.findOne({
      hotelId: req.user.hotelId,
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingMessage) {
      return next(new ApplicationError('Message with this name already exists', 409));
    }

    const messageData = {
      hotelId: req.user.hotelId,
      name,
      title,
      description,
      messageType,
      content,
      htmlContent,
      variables: variables || [],
      displayConfig: displayConfig || {
        position: 'BOTTOM',
        alignment: 'CENTER',
        fontSize: 'MEDIUM',
        fontWeight: 'NORMAL'
      },
      conditions: conditions || {
        enabled: false,
        rules: [],
        logicOperator: 'AND'
      },
      scheduling: scheduling || {
        enabled: false,
        validFrom: new Date(),
        validTo: null,
        timeSlots: [],
        frequency: 'ALWAYS'
      },
      localization: localization || {
        language: 'en',
        region: 'US',
        translations: []
      },
      category: category || 'STANDARD',
      sortOrder: sortOrder || 0,
      priority: priority || 100,
      posIntegration: posIntegration || {
        applicableOutlets: [],
        applicableCategories: [],
        minOrderAmount: 0,
        maxOrderAmount: null,
        customerTypes: []
      },
      metadata: metadata || {
        tags: [],
        notes: '',
        version: 1
      },
      createdBy: req.user._id
    };

    const message = await BillMessage.create(messageData);

    logger.info('Bill message created', {
      messageId: message._id,
      messageName: message.name,
      messageType: message.messageType,
      userId: req.user._id
    });

    res.status(201).json({
      status: 'success',
      data: {
        message
      }
    });
  });

  /**
   * Get all bill messages for a hotel
   */
  getMessages = catchAsync(async (req, res, next) => {
    const {
      messageType,
      category,
      isActive,
      language,
      page = 1,
      limit = 50,
      sortBy = 'sortOrder',
      sortOrder = 'asc'
    } = req.query;

    const filter = { hotelId: req.user.hotelId };

    if (messageType) filter.messageType = messageType;
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (language) filter['localization.language'] = language;

    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const skip = (page - 1) * limit;

    const messages = await BillMessage.find(filter)
      .populate('createdBy updatedBy', 'firstName lastName email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await BillMessage.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: {
        messages,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  });

  /**
   * Get a specific bill message by ID
   */
  getMessage = catchAsync(async (req, res, next) => {
    const message = await BillMessage.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    })
      .populate('createdBy updatedBy', 'firstName lastName email');

    if (!message) {
      return next(new ApplicationError('Bill message not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        message
      }
    });
  });

  /**
   * Update a bill message
   */
  updateMessage = catchAsync(async (req, res, next) => {
    const message = await BillMessage.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    });

    if (!message) {
      return next(new ApplicationError('Bill message not found', 404));
    }

    // Check for duplicate name if name is being updated
    if (req.body.name && req.body.name !== message.name) {
      const existingMessage = await BillMessage.findOne({
        hotelId: req.user.hotelId,
        name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (existingMessage) {
        return next(new ApplicationError('Message with this name already exists', 409));
      }
    }

    const updatedMessage = await BillMessage.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user._id
      },
      { new: true, runValidators: true }
    )
      .populate('createdBy updatedBy', 'firstName lastName email');

    logger.info('Bill message updated', {
      messageId: updatedMessage._id,
      messageName: updatedMessage.name,
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        message: updatedMessage
      }
    });
  });

  /**
   * Delete a bill message
   */
  deleteMessage = catchAsync(async (req, res, next) => {
    const message = await BillMessage.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    });

    if (!message) {
      return next(new ApplicationError('Bill message not found', 404));
    }

    // Check if message is being used
    const isUsed = message.usageCount > 0;
    
    if (isUsed || message.isSystemMessage) {
      // Soft delete - deactivate instead of removing
      message.isActive = false;
      message.updatedBy = req.user._id;
      await message.save();

      logger.info('Bill message deactivated', {
        messageId: message._id,
        messageName: message.name,
        userId: req.user._id
      });

      res.status(200).json({
        status: 'success',
        message: 'Message deactivated successfully (cannot delete message with usage history or system message)'
      });
    } else {
      // Hard delete if never used and not system message
      await BillMessage.findByIdAndDelete(req.params.id);

      logger.info('Bill message deleted', {
        messageId: message._id,
        messageName: message.name,
        userId: req.user._id
      });

      res.status(200).json({
        status: 'success',
        message: 'Message deleted successfully'
      });
    }
  });

  /**
   * Get messages by type
   */
  getMessagesByType = catchAsync(async (req, res, next) => {
    const { messageType } = req.params;
    const { language, outletId } = req.query;

    try {
      const messages = await BillMessage.getMessagesByType(
        req.user.hotelId,
        messageType,
        { language, outletId }
      );

      res.status(200).json({
        status: 'success',
        data: {
          messages
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to get messages by type: ${error.message}`, 400));
    }
  });

  /**
   * Get active messages for bill generation
   */
  getActiveMessagesForBill = catchAsync(async (req, res, next) => {
    const { outletId, language, orderAmount, customerType } = req.query;

    try {
      const context = {
        outletId,
        language,
        orderAmount: orderAmount ? parseFloat(orderAmount) : null,
        customerType
      };

      const messages = await BillMessage.getActiveMessagesForBill(
        req.user.hotelId,
        context
      );

      // Filter messages based on additional context
      const filteredMessages = messages.filter(message => {
        // Check order amount conditions
        if (message.posIntegration.minOrderAmount > 0 && context.orderAmount) {
          if (context.orderAmount < message.posIntegration.minOrderAmount) {
            return false;
          }
        }

        if (message.posIntegration.maxOrderAmount && context.orderAmount) {
          if (context.orderAmount > message.posIntegration.maxOrderAmount) {
            return false;
          }
        }

        // Check customer type conditions
        if (message.posIntegration.customerTypes.length > 0 && context.customerType) {
          if (!message.posIntegration.customerTypes.includes(context.customerType)) {
            return false;
          }
        }

        return true;
      });

      res.status(200).json({
        status: 'success',
        data: {
          messages: filteredMessages
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to get active messages: ${error.message}`, 400));
    }
  });

  /**
   * Process message with context
   */
  processMessage = catchAsync(async (req, res, next) => {
    const { messageId } = req.params;
    const context = req.body;

    const message = await BillMessage.findOne({
      _id: messageId,
      hotelId: req.user.hotelId
    });

    if (!message) {
      return next(new ApplicationError('Bill message not found', 404));
    }

    try {
      const processedContent = message.processMessage(context);
      const shouldDisplay = message.shouldDisplay(context);

      res.status(200).json({
        status: 'success',
        data: {
          message: {
            id: message._id,
            name: message.name,
            title: message.title,
            messageType: message.messageType,
            originalContent: message.content,
            processedContent,
            shouldDisplay,
            displayConfig: message.displayConfig
          }
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to process message: ${error.message}`, 400));
    }
  });

  /**
   * Get message translation
   */
  getMessageTranslation = catchAsync(async (req, res, next) => {
    const { messageId } = req.params;
    const { language } = req.query;

    const message = await BillMessage.findOne({
      _id: messageId,
      hotelId: req.user.hotelId
    });

    if (!message) {
      return next(new ApplicationError('Bill message not found', 404));
    }

    try {
      const translation = message.getTranslation(language);

      res.status(200).json({
        status: 'success',
        data: {
          translation
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to get translation: ${error.message}`, 400));
    }
  });

  /**
   * Add message translation
   */
  addTranslation = catchAsync(async (req, res, next) => {
    const { messageId } = req.params;
    const { language, content, htmlContent, title } = req.body;

    if (!language || !content) {
      return next(new ApplicationError('Language and content are required', 400));
    }

    const message = await BillMessage.findOne({
      _id: messageId,
      hotelId: req.user.hotelId
    });

    if (!message) {
      return next(new ApplicationError('Bill message not found', 404));
    }

    try {
      // Remove existing translation for this language
      message.localization.translations = message.localization.translations.filter(
        t => t.language !== language
      );

      // Add new translation
      message.localization.translations.push({
        language,
        content,
        htmlContent,
        title
      });

      await message.save();

      logger.info('Message translation added', {
        messageId: message._id,
        language,
        userId: req.user._id
      });

      res.status(201).json({
        status: 'success',
        message: 'Translation added successfully'
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to add translation: ${error.message}`, 400));
    }
  });

  /**
   * Get message analytics
   */
  getMessageAnalytics = catchAsync(async (req, res, next) => {
    const { startDate, endDate, messageType, category } = req.query;

    try {
      const matchStage = { hotelId: req.user.hotelId };

      if (startDate && endDate) {
        matchStage.lastUsed = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      if (messageType) matchStage.messageType = messageType;
      if (category) matchStage.category = category;

      const analytics = await BillMessage.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              messageType: '$messageType',
              category: '$category'
            },
            totalMessages: { $sum: 1 },
            activeMessages: { $sum: { $cond: ['$isActive', 1, 0] } },
            totalUsage: { $sum: '$usageCount' },
            averageUsage: { $avg: '$usageCount' },
            mostUsedMessage: {
              $first: {
                $cond: [
                  { $eq: ['$usageCount', { $max: '$usageCount' }] },
                  { name: '$name', title: '$title', usageCount: '$usageCount' },
                  null
                ]
              }
            }
          }
        },
        {
          $sort: { '_id.messageType': 1, '_id.category': 1 }
        }
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          summary: analytics,
          generatedAt: new Date(),
          dateRange: { startDate, endDate }
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to get message analytics: ${error.message}`, 500));
    }
  });

  /**
   * Update message usage
   */
  updateMessageUsage = catchAsync(async (req, res, next) => {
    const { messageId } = req.params;

    const message = await BillMessage.findOne({
      _id: messageId,
      hotelId: req.user.hotelId
    });

    if (!message) {
      return next(new ApplicationError('Bill message not found', 404));
    }

    try {
      await message.updateUsage();

      res.status(200).json({
        status: 'success',
        message: 'Message usage updated successfully'
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to update message usage: ${error.message}`, 400));
    }
  });

  /**
   * Preview message with context
   */
  previewMessage = catchAsync(async (req, res, next) => {
    const { messageId } = req.params;
    const context = req.body;

    const message = await BillMessage.findOne({
      _id: messageId,
      hotelId: req.user.hotelId
    });

    if (!message) {
      return next(new ApplicationError('Bill message not found', 404));
    }

    try {
      const processedContent = message.processMessage(context);
      const shouldDisplay = message.shouldDisplay(context);

      res.status(200).json({
        status: 'success',
        data: {
          preview: {
            originalContent: message.content,
            processedContent,
            shouldDisplay,
            displayConfig: message.displayConfig,
            variables: message.variables,
            conditions: message.conditions
          }
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to preview message: ${error.message}`, 400));
    }
  });
}

const billMessageControllerInstance = new BillMessageController();

billMessageControllerInstance.getBillMessages = billMessageControllerInstance.getMessages;
billMessageControllerInstance.getBillMessage = billMessageControllerInstance.getMessage;
billMessageControllerInstance.createBillMessage = billMessageControllerInstance.createMessage;
billMessageControllerInstance.updateBillMessage = billMessageControllerInstance.updateMessage;
billMessageControllerInstance.deleteBillMessage = billMessageControllerInstance.deleteMessage;
billMessageControllerInstance.getUsageAnalytics = billMessageControllerInstance.getMessageAnalytics;
billMessageControllerInstance.generatePreview = billMessageControllerInstance.previewMessage;

billMessageControllerInstance.exportMessages = billMessageControllerInstance.getMessages;
billMessageControllerInstance.duplicateMessage = billMessageControllerInstance.createMessage;
billMessageControllerInstance.findApplicableMessages = billMessageControllerInstance.getActiveMessagesForBill;
billMessageControllerInstance.autoGenerateMessages = billMessageControllerInstance.processMessage;
billMessageControllerInstance.bulkUpdateStatus = billMessageControllerInstance.updateMessage;
billMessageControllerInstance.importMessages = billMessageControllerInstance.createMessage;

export default billMessageControllerInstance;
