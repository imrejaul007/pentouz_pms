import mongoose from 'mongoose';
import Vendor from '../models/Vendor.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

export const vendorController = {
  // GET /vendors - List vendors with filtering
  getVendors: catchAsync(async (req, res) => {
    const {
      category,
      isPreferred,
      isActive = true,
      page = 1,
      limit = 20,
      sortBy = 'rating',
      sortOrder = 'desc',
      search
    } = req.query;

    const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;

    if (!hotelId) {
      throw new ApplicationError('Hotel ID is required', 400);
    }

    // Build query
    const query = { hotelId };

    if (category) query.category = category;
    if (isPreferred !== undefined) query.isPreferred = isPreferred === 'true';
    if (isActive !== undefined) query.isActive = isActive === 'true';

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { specializations: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Build sort
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [vendors, total] = await Promise.all([
      Vendor.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Vendor.countDocuments(query)
    ]);

    res.json({
      status: 'success',
      data: {
        vendors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  }),

  // GET /vendors/:id - Get specific vendor
  getVendor: catchAsync(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      throw new ApplicationError('Vendor not found', 404);
    }

    // Check access permissions
    const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
    if (vendor.hotelId.toString() !== hotelId.toString()) {
      throw new ApplicationError('You can only access vendors for your hotel', 403);
    }

    res.json({
      status: 'success',
      data: vendor
    });
  }),

  // POST /vendors - Create vendor (admin only)
  createVendor: catchAsync(async (req, res) => {
    const hotelId = req.user.role === 'manager' ? req.user.hotelId : req.body.hotelId;

    if (!hotelId) {
      throw new ApplicationError('Hotel ID is required', 400);
    }

    const vendorData = {
      ...req.body,
      hotelId,
      createdBy: req.user._id
    };

    // Check for duplicate email within hotel
    const existingVendor = await Vendor.findOne({
      hotelId,
      email: vendorData.email
    });

    if (existingVendor) {
      throw new ApplicationError('Vendor with this email already exists for this hotel', 400);
    }

    const vendor = await Vendor.create(vendorData);

    res.status(201).json({
      status: 'success',
      message: 'Vendor created successfully',
      data: vendor
    });
  }),

  // PUT /vendors/:id - Update vendor
  updateVendor: catchAsync(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      throw new ApplicationError('Vendor not found', 404);
    }

    // Check access permissions
    const hotelId = req.user.role === 'manager' ? req.user.hotelId : req.body.hotelId;
    if (vendor.hotelId.toString() !== hotelId.toString()) {
      throw new ApplicationError('You can only update vendors for your hotel', 403);
    }

    // Update fields
    const allowedUpdates = [
      'name', 'category', 'contactPerson', 'email', 'phone', 'address',
      'paymentTerms', 'deliveryTime', 'minOrderValue', 'specializations',
      'isPreferred', 'isActive', 'contract', 'financial', 'notes', 'tags'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    updates.updatedBy = req.user._id;

    Object.assign(vendor, updates);
    await vendor.save();

    res.json({
      status: 'success',
      message: 'Vendor updated successfully',
      data: vendor
    });
  }),

  // DELETE /vendors/:id - Delete vendor (soft delete)
  deleteVendor: catchAsync(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      throw new ApplicationError('Vendor not found', 404);
    }

    // Check access permissions
    const hotelId = req.user.role === 'manager' ? req.user.hotelId : req.body.hotelId;
    if (vendor.hotelId.toString() !== hotelId.toString()) {
      throw new ApplicationError('You can only delete vendors for your hotel', 403);
    }

    // Soft delete by setting isActive to false
    vendor.isActive = false;
    vendor.updatedBy = req.user._id;
    await vendor.save();

    res.json({
      status: 'success',
      message: 'Vendor deleted successfully'
    });
  }),

  // GET /vendors/performance - Vendor performance analytics
  getVendorPerformance: catchAsync(async (req, res) => {
    const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;

    if (!hotelId) {
      throw new ApplicationError('Hotel ID is required', 400);
    }

    const performance = await Vendor.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          isActive: true,
          'performance.orderCount': { $gt: 0 }
        }
      },
      {
        $addFields: {
          reliabilityScore: {
            $add: [
              { $multiply: [{ $divide: ['$performance.onTimeDelivery', 100] }, 30] },
              { $multiply: [{ $divide: ['$performance.qualityRating', 5] }, 25] },
              { $multiply: [{ $divide: ['$performance.completionRate', 100] }, 20] },
              { $multiply: [{ $min: [{ $divide: ['$performance.orderCount', 50] }, 1] }, 15] },
              { $multiply: [{ $divide: ['$rating', 5] }, 10] }
            ]
          },
          averageOrderValue: {
            $cond: [
              { $eq: ['$performance.orderCount', 0] },
              0,
              { $divide: ['$totalOrderValue', '$performance.orderCount'] }
            ]
          }
        }
      },
      {
        $project: {
          name: 1,
          category: 1,
          rating: 1,
          performance: 1,
          totalOrderValue: 1,
          averageOrderValue: 1,
          reliabilityScore: { $round: ['$reliabilityScore', 1] },
          isPreferred: 1
        }
      },
      { $sort: { reliabilityScore: -1 } }
    ]);

    res.json({
      status: 'success',
      data: performance
    });
  }),

  // GET /vendors/statistics - Vendor statistics
  getVendorStatistics: catchAsync(async (req, res) => {
    const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;

    if (!hotelId) {
      throw new ApplicationError('Hotel ID is required', 400);
    }

    const statistics = await Vendor.getVendorStatistics(hotelId);

    res.json({
      status: 'success',
      data: statistics
    });
  }),

  // GET /vendors/top-performers - Top performing vendors
  getTopPerformers: catchAsync(async (req, res) => {
    const { limit = 10 } = req.query;
    const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;

    if (!hotelId) {
      throw new ApplicationError('Hotel ID is required', 400);
    }

    const topPerformers = await Vendor.getTopPerformers(hotelId, parseInt(limit));

    res.json({
      status: 'success',
      data: topPerformers
    });
  }),

  // GET /vendors/by-category/:category - Vendors by category
  getVendorsByCategory: catchAsync(async (req, res) => {
    const { category } = req.params;
    const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;

    if (!hotelId) {
      throw new ApplicationError('Hotel ID is required', 400);
    }

    const vendors = await Vendor.getVendorsByCategory(hotelId, category);

    res.json({
      status: 'success',
      data: vendors
    });
  }),

  // GET /vendors/contracts/expiring - Vendors with expiring contracts
  getExpiringContracts: catchAsync(async (req, res) => {
    const { daysAhead = 30 } = req.query;
    const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;

    if (!hotelId) {
      throw new ApplicationError('Hotel ID is required', 400);
    }

    const expiringContracts = await Vendor.getExpiredContracts(hotelId, parseInt(daysAhead));

    res.json({
      status: 'success',
      data: expiringContracts
    });
  }),

  // POST /vendors/:id/performance - Update vendor performance
  updateVendorPerformance: catchAsync(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      throw new ApplicationError('Vendor not found', 404);
    }

    // Check access permissions
    const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.body.hotelId;
    if (vendor.hotelId.toString() !== hotelId.toString()) {
      throw new ApplicationError('You can only update vendors for your hotel', 403);
    }

    const orderData = {
      amount: req.body.amount,
      deliveredOnTime: req.body.deliveredOnTime,
      deliveryTime: req.body.deliveryTime, // in days
      qualityRating: req.body.qualityRating
    };

    await vendor.updatePerformance(orderData);

    res.json({
      status: 'success',
      message: 'Vendor performance updated successfully',
      data: vendor
    });
  }),

  // POST /vendors/:id/payment - Add payment record
  addPaymentRecord: catchAsync(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      throw new ApplicationError('Vendor not found', 404);
    }

    // Check access permissions
    const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.body.hotelId;
    if (vendor.hotelId.toString() !== hotelId.toString()) {
      throw new ApplicationError('You can only update vendors for your hotel', 403);
    }

    const paymentData = {
      date: req.body.date || new Date(),
      amount: req.body.amount,
      method: req.body.method,
      status: req.body.status || 'paid'
    };

    await vendor.addPayment(paymentData);

    res.json({
      status: 'success',
      message: 'Payment record added successfully',
      data: vendor
    });
  }),

  // GET /vendors/search - Advanced vendor search
  searchVendors: catchAsync(async (req, res) => {
    const {
      query: searchQuery,
      categories,
      minRating,
      maxDeliveryTime,
      isPreferred,
      hasContract,
      page = 1,
      limit = 20
    } = req.query;

    const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;

    if (!hotelId) {
      throw new ApplicationError('Hotel ID is required', 400);
    }

    const matchQuery = {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isActive: true
    };

    // Add search criteria
    if (searchQuery) {
      matchQuery.$or = [
        { name: { $regex: searchQuery, $options: 'i' } },
        { contactPerson: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
        { specializations: { $in: [new RegExp(searchQuery, 'i')] } }
      ];
    }

    if (categories) {
      const categoryArray = categories.split(',');
      matchQuery.category = { $in: categoryArray };
    }

    if (minRating) {
      matchQuery.rating = { $gte: parseFloat(minRating) };
    }

    if (maxDeliveryTime) {
      matchQuery['performance.averageDeliveryTime'] = { $lte: parseInt(maxDeliveryTime) };
    }

    if (isPreferred !== undefined) {
      matchQuery.isPreferred = isPreferred === 'true';
    }

    if (hasContract !== undefined) {
      matchQuery['contract.hasContract'] = hasContract === 'true';
    }

    const skip = (page - 1) * limit;

    const vendors = await Vendor.aggregate([
      { $match: matchQuery },
      {
        $addFields: {
          reliabilityScore: {
            $add: [
              { $multiply: [{ $divide: ['$performance.onTimeDelivery', 100] }, 30] },
              { $multiply: [{ $divide: ['$performance.qualityRating', 5] }, 25] },
              { $multiply: [{ $divide: ['$performance.completionRate', 100] }, 20] },
              { $multiply: [{ $min: [{ $divide: ['$performance.orderCount', 50] }, 1] }, 15] },
              { $multiply: [{ $divide: ['$rating', 5] }, 10] }
            ]
          }
        }
      },
      { $sort: { reliabilityScore: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    const total = await Vendor.countDocuments(matchQuery);

    res.json({
      status: 'success',
      data: {
        vendors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  })
};
