import express from 'express';
import InventoryItem from '../models/InventoryItem.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Vendor from '../models/Vendor.js';
import { authenticateToken } from '../middleware/auth.js';
import { validationResult, body, query, param } from 'express-validator';
import mongoose from 'mongoose';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for image uploads (for inventory verification photos)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * @swagger
 * /api/v1/inventory/mobile/quick-stock-check:
 *   get:
 *     summary: Quick stock check for mobile app
 *     description: Get current stock levels for critical items
 *     tags: [Inventory Mobile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: lowStockOnly
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Stock check data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           category:
 *                             type: string
 *                           currentStock:
 *                             type: number
 *                           stockThreshold:
 *                             type: number
 *                           isLowStock:
 *                             type: boolean
 *                           unitPrice:
 *                             type: number
 *                           imageUrl:
 *                             type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalItems:
 *                           type: number
 *                         lowStockCount:
 *                           type: number
 *                         totalValue:
 *                           type: number
 */
router.get('/quick-stock-check', [
  authenticateToken,
  query('hotelId').notEmpty().withMessage('Hotel ID is required'),
  query('category').optional().isString(),
  query('lowStockOnly').optional().isBoolean(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { hotelId, category, lowStockOnly = false, limit = 20 } = req.query;

    // Build query
    const filter = {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isActive: true
    };

    if (category) {
      filter.category = category;
    }

    if (lowStockOnly === 'true') {
      filter.$expr = { $lte: ['$currentStock', '$stockThreshold'] };
    }

    // Get items with minimal fields for mobile optimization
    const items = await InventoryItem.find(filter)
      .select('name category currentStock stockThreshold unitPrice imageUrl')
      .sort({ currentStock: 1, name: 1 })
      .limit(parseInt(limit));

    // Calculate summary
    const totalItems = await InventoryItem.countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isActive: true
    });

    const lowStockCount = await InventoryItem.countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isActive: true,
      $expr: { $lte: ['$currentStock', '$stockThreshold'] }
    });

    const totalValueAggregate = await InventoryItem.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$currentStock', '$unitPrice'] } }
        }
      }
    ]);

    const totalValue = totalValueAggregate[0]?.totalValue || 0;

    // Add computed fields
    const enrichedItems = items.map(item => ({
      _id: item._id,
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      stockThreshold: item.stockThreshold,
      isLowStock: item.currentStock <= item.stockThreshold,
      unitPrice: item.unitPrice,
      totalValue: item.currentStock * item.unitPrice,
      imageUrl: item.imageUrl || null,
      stockStatus: item.currentStock === 0 ? 'out_of_stock' :
                   item.currentStock <= item.stockThreshold ? 'low_stock' : 'in_stock'
    }));

    res.json({
      success: true,
      data: {
        items: enrichedItems,
        summary: {
          totalItems,
          lowStockCount,
          totalValue: Math.round(totalValue),
          queryCount: items.length
        }
      }
    });

  } catch (error) {
    console.error('Error in quick stock check:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/mobile/stock-update:
 *   post:
 *     summary: Quick stock update from mobile
 *     description: Update stock levels with mobile-optimized payload
 *     tags: [Inventory Mobile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotelId
 *               - itemId
 *               - movementType
 *               - quantity
 *               - reason
 *             properties:
 *               hotelId:
 *                 type: string
 *               itemId:
 *                 type: string
 *               movementType:
 *                 type: string
 *                 enum: [IN, OUT, ADJUSTMENT]
 *               quantity:
 *                 type: number
 *                 minimum: 0
 *               reason:
 *                 type: string
 *               location:
 *                 type: string
 *               notes:
 *                 type: string
 *               photo:
 *                 type: string
 *                 description: Base64 encoded photo (optional)
 *     responses:
 *       200:
 *         description: Stock updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Item not found
 */
router.post('/stock-update', [
  authenticateToken,
  body('hotelId').notEmpty().withMessage('Hotel ID is required'),
  body('itemId').notEmpty().withMessage('Item ID is required'),
  body('movementType').isIn(['IN', 'OUT', 'ADJUSTMENT']).withMessage('Invalid movement type'),
  body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
  body('reason').notEmpty().withMessage('Reason is required'),
  body('location').optional().isString(),
  body('notes').optional().isString(),
  body('photo').optional().isString()
], async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { hotelId, itemId, movementType, quantity, reason, location, notes, photo } = req.body;
    const userId = req.user.id;

    // Find the inventory item
    const item = await InventoryItem.findOne({
      _id: itemId,
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isActive: true
    }).session(session);

    if (!item) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    const previousStock = item.currentStock;
    let newStock = previousStock;

    // Calculate new stock based on movement type
    switch (movementType) {
      case 'IN':
        newStock = previousStock + quantity;
        break;
      case 'OUT':
        newStock = Math.max(0, previousStock - quantity);
        if (previousStock < quantity) {
          console.warn(`Warning: Attempting to remove ${quantity} units from ${item.name} but only ${previousStock} available`);
        }
        break;
      case 'ADJUSTMENT':
        newStock = quantity; // Direct set to quantity
        break;
      default:
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Invalid movement type'
        });
    }

    // Update item stock
    await InventoryItem.findByIdAndUpdate(
      itemId,
      { currentStock: newStock },
      { session }
    );

    // Handle photo upload if provided
    let photoUrl = null;
    if (photo) {
      try {
        // Convert base64 to buffer
        const base64Data = photo.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Process image with Sharp
        const processedImage = await sharp(imageBuffer)
          .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();

        // Save to uploads directory
        const fileName = `inventory_${itemId}_${Date.now()}.jpg`;
        const filePath = path.join(process.cwd(), 'uploads', 'inventory', fileName);

        // Ensure directory exists
        const uploadDir = path.dirname(filePath);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        fs.writeFileSync(filePath, processedImage);
        photoUrl = `/uploads/inventory/${fileName}`;

      } catch (photoError) {
        console.error('Error processing photo:', photoError);
        // Continue without photo if processing fails
      }
    }

    // Create inventory transaction record
    const transaction = new InventoryTransaction({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      inventoryItemId: new mongoose.Types.ObjectId(itemId),
      itemName: item.name,
      movementType,
      quantity: movementType === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity),
      previousStock,
      newStock,
      unitPrice: item.unitPrice,
      totalValue: Math.abs(quantity) * item.unitPrice,
      reason,
      location: location || 'Mobile App',
      performedBy: new mongoose.Types.ObjectId(userId),
      notes: notes || `Mobile stock update: ${movementType}`,
      metadata: {
        source: 'mobile_app',
        hasPhoto: !!photoUrl,
        photoUrl
      }
    });

    await transaction.save({ session });

    await session.commitTransaction();

    // Prepare response
    const response = {
      success: true,
      message: 'Stock updated successfully',
      data: {
        item: {
          _id: item._id,
          name: item.name,
          category: item.category,
          previousStock,
          newStock,
          change: newStock - previousStock,
          unitPrice: item.unitPrice,
          totalValue: newStock * item.unitPrice,
          isLowStock: newStock <= item.stockThreshold,
          stockStatus: newStock === 0 ? 'out_of_stock' :
                      newStock <= item.stockThreshold ? 'low_stock' : 'in_stock'
        },
        transaction: {
          _id: transaction._id,
          movementType,
          quantity: Math.abs(quantity),
          reason,
          location: transaction.location,
          timestamp: transaction.createdAt,
          photoUrl
        }
      }
    };

    res.json(response);

  } catch (error) {
    await session.abortTransaction();
    console.error('Error in stock update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stock',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    session.endSession();
  }
});

/**
 * @swagger
 * /api/v1/inventory/mobile/barcode-lookup/{barcode}:
 *   get:
 *     summary: Lookup item by barcode
 *     description: Find inventory item using barcode scan
 *     tags: [Inventory Mobile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: barcode
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item found
 *       404:
 *         description: Item not found
 */
router.get('/barcode-lookup/:barcode', [
  authenticateToken,
  param('barcode').notEmpty().withMessage('Barcode is required'),
  query('hotelId').notEmpty().withMessage('Hotel ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { barcode } = req.params;
    const { hotelId } = req.query;

    // Look for item by barcode in various fields
    const item = await InventoryItem.findOne({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isActive: true,
      $or: [
        { 'metadata.barcode': barcode },
        { 'specifications.barcode': barcode },
        { name: new RegExp(barcode, 'i') }, // Fallback: search by name
        { _id: mongoose.Types.ObjectId.isValid(barcode) ? barcode : null }
      ]
    }).select('name category currentStock stockThreshold unitPrice imageUrl');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found for the given barcode'
      });
    }

    // Get recent transactions for this item (last 5)
    const recentTransactions = await InventoryTransaction.find({
      inventoryItemId: item._id,
      hotelId: new mongoose.Types.ObjectId(hotelId)
    })
      .select('movementType quantity previousStock newStock createdAt performedBy reason')
      .populate('performedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        item: {
          _id: item._id,
          name: item.name,
          category: item.category,
          currentStock: item.currentStock,
          stockThreshold: item.stockThreshold,
          unitPrice: item.unitPrice,
          totalValue: item.currentStock * item.unitPrice,
          isLowStock: item.currentStock <= item.stockThreshold,
          imageUrl: item.imageUrl || null,
          stockStatus: item.currentStock === 0 ? 'out_of_stock' :
                      item.currentStock <= item.stockThreshold ? 'low_stock' : 'in_stock'
        },
        recentTransactions: recentTransactions.map(t => ({
          _id: t._id,
          type: t.movementType,
          quantity: Math.abs(t.quantity),
          previousStock: t.previousStock,
          newStock: t.newStock,
          reason: t.reason,
          performedBy: t.performedBy ? `${t.performedBy.firstName} ${t.performedBy.lastName}` : 'System',
          timestamp: t.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Error in barcode lookup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to lookup item',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/mobile/photo-upload:
 *   post:
 *     summary: Upload inventory verification photo
 *     description: Upload and process photo for inventory verification
 *     tags: [Inventory Mobile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - photo
 *               - hotelId
 *               - itemId
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *               hotelId:
 *                 type: string
 *               itemId:
 *                 type: string
 *               purpose:
 *                 type: string
 *                 enum: [stock_verification, damage_report, quality_check]
 *               notes:
 *                 type: string
 */
router.post('/photo-upload', [
  authenticateToken,
  upload.single('photo'),
  body('hotelId').notEmpty().withMessage('Hotel ID is required'),
  body('itemId').notEmpty().withMessage('Item ID is required'),
  body('purpose').optional().isIn(['stock_verification', 'damage_report', 'quality_check']),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Photo file is required'
      });
    }

    const { hotelId, itemId, purpose = 'stock_verification', notes } = req.body;
    const userId = req.user.id;

    // Verify item exists
    const item = await InventoryItem.findOne({
      _id: itemId,
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isActive: true
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Process image
    const processedImage = await sharp(req.file.buffer)
      .resize(1200, 900, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Save file
    const fileName = `inventory_${itemId}_${purpose}_${Date.now()}.jpg`;
    const uploadDir = path.join(process.cwd(), 'uploads', 'inventory', 'photos');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, processedImage);

    const photoUrl = `/uploads/inventory/photos/${fileName}`;

    // Create photo record (you might want to create a separate Photos model)
    const photoRecord = {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      inventoryItemId: new mongoose.Types.ObjectId(itemId),
      purpose,
      fileName,
      filePath: photoUrl,
      uploadedBy: new mongoose.Types.ObjectId(userId),
      uploadedAt: new Date(),
      notes: notes || '',
      metadata: {
        originalName: req.file.originalname,
        size: processedImage.length,
        mimetype: 'image/jpeg'
      }
    };

    // You could save this to a Photos collection if you have one
    // For now, we'll just return the URL

    res.json({
      success: true,
      message: 'Photo uploaded successfully',
      data: {
        photoUrl,
        fileName,
        purpose,
        item: {
          _id: item._id,
          name: item.name,
          category: item.category
        },
        uploadedAt: photoRecord.uploadedAt,
        size: processedImage.length
      }
    });

  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload photo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/mobile/offline-sync:
 *   post:
 *     summary: Sync offline mobile data
 *     description: Process multiple operations that were queued offline
 *     tags: [Inventory Mobile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotelId
 *               - operations
 *             properties:
 *               hotelId:
 *                 type: string
 *               operations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - type
 *                     - data
 *                     - clientId
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [stock_update, photo_upload]
 *                     data:
 *                       type: object
 *                     clientId:
 *                       type: string
 *                       description: Client-generated unique ID for deduplication
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 */
router.post('/offline-sync', [
  authenticateToken,
  body('hotelId').notEmpty().withMessage('Hotel ID is required'),
  body('operations').isArray({ min: 1 }).withMessage('Operations array is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { hotelId, operations } = req.body;
    const userId = req.user.id;
    const results = [];

    // Process each operation
    for (const operation of operations) {
      try {
        const { type, data, clientId, timestamp } = operation;

        // Check for duplicate operations using clientId
        // You might want to implement a deduplication mechanism here

        let result = {
          clientId,
          type,
          success: false,
          message: '',
          data: null
        };

        switch (type) {
          case 'stock_update':
            try {
              // Validate required fields for stock update
              const { itemId, movementType, quantity, reason } = data;

              if (!itemId || !movementType || quantity === undefined || !reason) {
                result.message = 'Missing required fields for stock update';
                break;
              }

              // Find item
              const item = await InventoryItem.findOne({
                _id: itemId,
                hotelId: new mongoose.Types.ObjectId(hotelId),
                isActive: true
              });

              if (!item) {
                result.message = 'Item not found';
                break;
              }

              // Perform stock update
              const previousStock = item.currentStock;
              let newStock = previousStock;

              switch (movementType) {
                case 'IN':
                  newStock = previousStock + quantity;
                  break;
                case 'OUT':
                  newStock = Math.max(0, previousStock - quantity);
                  break;
                case 'ADJUSTMENT':
                  newStock = quantity;
                  break;
                default:
                  result.message = 'Invalid movement type';
                  break;
              }

              if (result.message) break; // Skip if validation failed

              // Update item
              await InventoryItem.findByIdAndUpdate(itemId, { currentStock: newStock });

              // Create transaction
              const transaction = new InventoryTransaction({
                hotelId: new mongoose.Types.ObjectId(hotelId),
                inventoryItemId: new mongoose.Types.ObjectId(itemId),
                itemName: item.name,
                movementType,
                quantity: movementType === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity),
                previousStock,
                newStock,
                unitPrice: item.unitPrice,
                totalValue: Math.abs(quantity) * item.unitPrice,
                reason,
                location: data.location || 'Mobile App (Offline)',
                performedBy: new mongoose.Types.ObjectId(userId),
                notes: data.notes || 'Offline sync',
                metadata: {
                  source: 'mobile_app_offline',
                  clientId,
                  originalTimestamp: timestamp
                }
              });

              await transaction.save();

              result.success = true;
              result.message = 'Stock updated successfully';
              result.data = {
                itemName: item.name,
                previousStock,
                newStock,
                change: newStock - previousStock,
                transactionId: transaction._id
              };

            } catch (stockError) {
              result.message = `Stock update failed: ${stockError.message}`;
            }
            break;

          case 'photo_upload':
            // Handle photo upload sync
            // This would be more complex as you'd need to handle base64 images
            result.message = 'Photo upload sync not yet implemented';
            break;

          default:
            result.message = `Unknown operation type: ${type}`;
        }

        results.push(result);

      } catch (operationError) {
        results.push({
          clientId: operation.clientId,
          type: operation.type,
          success: false,
          message: `Operation failed: ${operationError.message}`,
          data: null
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    res.json({
      success: true,
      message: `Sync completed: ${successCount} successful, ${failureCount} failed`,
      data: {
        summary: {
          totalOperations: results.length,
          successful: successCount,
          failed: failureCount
        },
        results
      }
    });

  } catch (error) {
    console.error('Error in offline sync:', error);
    res.status(500).json({
      success: false,
      message: 'Offline sync failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/mobile/push-notifications:
 *   post:
 *     summary: Register for push notifications
 *     description: Register mobile device for inventory-related push notifications
 *     tags: [Inventory Mobile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceToken
 *               - platform
 *             properties:
 *               deviceToken:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [ios, android]
 *               hotelId:
 *                 type: string
 *               notificationTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [low_stock, reorder_alerts, stock_updates]
 */
router.post('/push-notifications', [
  authenticateToken,
  body('deviceToken').notEmpty().withMessage('Device token is required'),
  body('platform').isIn(['ios', 'android']).withMessage('Platform must be ios or android'),
  body('hotelId').optional().isString(),
  body('notificationTypes').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { deviceToken, platform, hotelId, notificationTypes = ['low_stock', 'reorder_alerts'] } = req.body;
    const userId = req.user.id;

    // Store device token for push notifications
    // You would typically save this to a DeviceTokens collection
    const deviceRegistration = {
      userId: new mongoose.Types.ObjectId(userId),
      hotelId: hotelId ? new mongoose.Types.ObjectId(hotelId) : null,
      deviceToken,
      platform,
      notificationTypes,
      registeredAt: new Date(),
      isActive: true
    };

    // Mock response - in real implementation, save to database
    console.log('Device registered for push notifications:', deviceRegistration);

    res.json({
      success: true,
      message: 'Device registered for push notifications',
      data: {
        deviceId: `device_${userId}_${Date.now()}`,
        notificationTypes,
        registeredAt: deviceRegistration.registeredAt
      }
    });

  } catch (error) {
    console.error('Error registering for push notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register for push notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/mobile/categories:
 *   get:
 *     summary: Get inventory categories for mobile
 *     description: Get simplified category list optimized for mobile UI
 *     tags: [Inventory Mobile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categories with item counts
 */
router.get('/categories', [
  authenticateToken,
  query('hotelId').notEmpty().withMessage('Hotel ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { hotelId } = req.query;

    // Aggregate categories with counts
    const categories = await InventoryItem.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          isActive: true
        }
      },
      {
        $group: {
          _id: '$category',
          itemCount: { $sum: 1 },
          lowStockCount: {
            $sum: {
              $cond: [{ $lte: ['$currentStock', '$stockThreshold'] }, 1, 0]
            }
          },
          totalValue: { $sum: { $multiply: ['$currentStock', '$unitPrice'] } },
          avgUnitPrice: { $avg: '$unitPrice' }
        }
      },
      {
        $sort: { itemCount: -1 }
      }
    ]);

    // Format for mobile
    const formattedCategories = categories.map(cat => ({
      category: cat._id,
      displayName: cat._id.charAt(0).toUpperCase() + cat._id.slice(1),
      itemCount: cat.itemCount,
      lowStockCount: cat.lowStockCount,
      totalValue: Math.round(cat.totalValue || 0),
      avgUnitPrice: Math.round(cat.avgUnitPrice || 0),
      hasLowStock: cat.lowStockCount > 0
    }));

    res.json({
      success: true,
      data: {
        categories: formattedCategories,
        summary: {
          totalCategories: formattedCategories.length,
          totalItems: formattedCategories.reduce((sum, cat) => sum + cat.itemCount, 0),
          totalLowStock: formattedCategories.reduce((sum, cat) => sum + cat.lowStockCount, 0)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
