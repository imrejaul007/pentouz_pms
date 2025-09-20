import HotelService from '../models/HotelService.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/services';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'service-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new ApplicationError('Only image files are allowed', 400), false);
  }
};

export const uploadImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).array('images', 5); // Allow up to 5 images

/**
 * @swagger
 * /admin/hotel-services:
 *   get:
 *     summary: Get all hotel services (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *     responses:
 *       200:
 *         description: List of hotel services with pagination
 */
export const getAllServices = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    search,
    status,
    hotelId
  } = req.query;

  const query = {};

  // Admin can filter by specific hotel or default to their hotel
  if (hotelId) {
    query.hotelId = hotelId;
  } else if (req.user.hotelId) {
    query.hotelId = req.user.hotelId;
  }

  if (type) query.type = type;

  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;

  let servicesQuery;

  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [
      { name: regex },
      { description: regex },
      { tags: regex }
    ];
  }

  const skip = (page - 1) * limit;

  const [services, total] = await Promise.all([
    HotelService.find(query)
      .populate('hotelId', 'name address')
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    HotelService.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      services,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}:
 *   get:
 *     summary: Get specific hotel service (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hotel service details
 *       404:
 *         description: Service not found
 */
export const getServiceById = catchAsync(async (req, res) => {
  const service = await HotelService.findById(req.params.id)
    .populate('hotelId', 'name address contact');

  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  // Check if admin has access to this service's hotel
  if (req.user.role === 'admin' && req.user.hotelId &&
      service.hotelId._id.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('Access denied to this service', 403);
  }

  res.json({
    status: 'success',
    data: service
  });
});

/**
 * @swagger
 * /admin/hotel-services:
 *   post:
 *     summary: Create new hotel service (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - type
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [dining, spa, gym, transport, entertainment, business, wellness, recreation]
 *               price:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: INR
 *               duration:
 *                 type: number
 *               capacity:
 *                 type: number
 *               location:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Service created successfully
 */
export const createService = catchAsync(async (req, res) => {
  const {
    name,
    description,
    type,
    price,
    currency = 'INR',
    duration,
    capacity,
    location,
    specialInstructions,
    amenities,
    tags,
    featured = false,
    isActive = true
  } = req.body;

  // Parse arrays from form data
  const parsedAmenities = amenities ?
    (Array.isArray(amenities) ? amenities : amenities.split(',').map(a => a.trim())) : [];
  const parsedTags = tags ?
    (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [];

  // Handle uploaded images
  const images = req.files ? req.files.map(file => `/uploads/services/${file.filename}`) : [];

  // Parse operating hours if provided
  let operatingHours;
  if (req.body.operatingHoursOpen && req.body.operatingHoursClose) {
    operatingHours = {
      open: req.body.operatingHoursOpen,
      close: req.body.operatingHoursClose
    };
  }

  // Parse contact info if provided
  let contactInfo = {};
  if (req.body.contactPhone) contactInfo.phone = req.body.contactPhone;
  if (req.body.contactEmail) contactInfo.email = req.body.contactEmail;

  const serviceData = {
    hotelId: req.user.hotelId,
    name,
    description,
    type,
    price: parseFloat(price),
    currency,
    duration: duration ? parseInt(duration) : undefined,
    capacity: capacity ? parseInt(capacity) : undefined,
    location,
    specialInstructions,
    amenities: parsedAmenities,
    tags: parsedTags,
    featured: featured === 'true' || featured === true,
    isActive: isActive === 'true' || isActive === true,
    images,
    operatingHours,
    contactInfo: Object.keys(contactInfo).length > 0 ? contactInfo : undefined,
    rating: {
      average: 0,
      count: 0
    }
  };

  const service = await HotelService.create(serviceData);

  await service.populate('hotelId', 'name');

  res.status(201).json({
    status: 'success',
    data: service
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}:
 *   put:
 *     summary: Update hotel service (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *               price:
 *                 type: number
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Service updated successfully
 */
export const updateService = catchAsync(async (req, res) => {
  const service = await HotelService.findById(req.params.id);

  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  // Check if admin has access to this service's hotel
  if (req.user.role === 'admin' && req.user.hotelId &&
      service.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('Access denied to this service', 403);
  }

  const {
    name,
    description,
    type,
    price,
    currency,
    duration,
    capacity,
    location,
    specialInstructions,
    amenities,
    tags,
    featured,
    isActive
  } = req.body;

  // Parse arrays from form data
  const parsedAmenities = amenities ?
    (Array.isArray(amenities) ? amenities : amenities.split(',').map(a => a.trim())) : undefined;
  const parsedTags = tags ?
    (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : undefined;

  // Handle new uploaded images
  if (req.files && req.files.length > 0) {
    // Add new images to existing ones
    const newImages = req.files.map(file => `/uploads/services/${file.filename}`);
    service.images = [...service.images, ...newImages];
  }

  // Parse operating hours if provided
  if (req.body.operatingHoursOpen && req.body.operatingHoursClose) {
    service.operatingHours = {
      open: req.body.operatingHoursOpen,
      close: req.body.operatingHoursClose
    };
  }

  // Parse contact info if provided
  if (req.body.contactPhone || req.body.contactEmail) {
    service.contactInfo = service.contactInfo || {};
    if (req.body.contactPhone) service.contactInfo.phone = req.body.contactPhone;
    if (req.body.contactEmail) service.contactInfo.email = req.body.contactEmail;
  }

  // Update fields
  if (name !== undefined) service.name = name;
  if (description !== undefined) service.description = description;
  if (type !== undefined) service.type = type;
  if (price !== undefined) service.price = parseFloat(price);
  if (currency !== undefined) service.currency = currency;
  if (duration !== undefined) service.duration = parseInt(duration);
  if (capacity !== undefined) service.capacity = parseInt(capacity);
  if (location !== undefined) service.location = location;
  if (specialInstructions !== undefined) service.specialInstructions = specialInstructions;
  if (parsedAmenities !== undefined) service.amenities = parsedAmenities;
  if (parsedTags !== undefined) service.tags = parsedTags;
  if (featured !== undefined) service.featured = featured === 'true' || featured === true;
  if (isActive !== undefined) service.isActive = isActive === 'true' || isActive === true;

  await service.save();
  await service.populate('hotelId', 'name');

  res.json({
    status: 'success',
    data: service
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}:
 *   delete:
 *     summary: Delete hotel service (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service deleted successfully
 */
export const deleteService = catchAsync(async (req, res) => {
  const service = await HotelService.findById(req.params.id);

  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  // Check if admin has access to this service's hotel
  if (req.user.role === 'admin' && req.user.hotelId &&
      service.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('Access denied to this service', 403);
  }

  // Delete service images from filesystem
  if (service.images && service.images.length > 0) {
    service.images.forEach(imagePath => {
      const fullPath = path.join(process.cwd(), imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
  }

  await HotelService.findByIdAndDelete(req.params.id);

  res.json({
    status: 'success',
    message: 'Service deleted successfully'
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}/toggle-status:
 *   patch:
 *     summary: Toggle service active status (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service status updated successfully
 */
export const toggleServiceStatus = catchAsync(async (req, res) => {
  const service = await HotelService.findById(req.params.id);

  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  // Check if admin has access to this service's hotel
  if (req.user.role === 'admin' && req.user.hotelId &&
      service.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('Access denied to this service', 403);
  }

  service.isActive = !service.isActive;
  await service.save();

  await service.populate('hotelId', 'name');

  res.json({
    status: 'success',
    data: service,
    message: `Service ${service.isActive ? 'activated' : 'deactivated'} successfully`
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}/images/{imageIndex}:
 *   delete:
 *     summary: Delete specific service image (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: imageIndex
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Image deleted successfully
 */
export const deleteServiceImage = catchAsync(async (req, res) => {
  const { id, imageIndex } = req.params;
  const service = await HotelService.findById(id);

  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  // Check if admin has access to this service's hotel
  if (req.user.role === 'admin' && req.user.hotelId &&
      service.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('Access denied to this service', 403);
  }

  const index = parseInt(imageIndex);
  if (index < 0 || index >= service.images.length) {
    throw new ApplicationError('Invalid image index', 400);
  }

  // Delete image file from filesystem
  const imagePath = service.images[index];
  const fullPath = path.join(process.cwd(), imagePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  // Remove image from array
  service.images.splice(index, 1);
  await service.save();

  res.json({
    status: 'success',
    message: 'Image deleted successfully',
    data: service
  });
});

/**
 * @swagger
 * /admin/hotel-services/bulk-operations:
 *   post:
 *     summary: Perform bulk operations on services (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operation
 *               - serviceIds
 *             properties:
 *               operation:
 *                 type: string
 *                 enum: [activate, deactivate, delete, feature, unfeature]
 *               serviceIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Bulk operation completed successfully
 */
export const bulkOperations = catchAsync(async (req, res) => {
  const { operation, serviceIds } = req.body;

  if (!operation || !serviceIds || !Array.isArray(serviceIds)) {
    throw new ApplicationError('Operation and serviceIds array are required', 400);
  }

  const services = await HotelService.find({
    _id: { $in: serviceIds },
    ...(req.user.hotelId && { hotelId: req.user.hotelId })
  });

  if (services.length !== serviceIds.length) {
    throw new ApplicationError('Some services not found or access denied', 404);
  }

  let updateData = {};
  let message = '';

  switch (operation) {
    case 'activate':
      updateData = { isActive: true };
      message = 'Services activated successfully';
      break;
    case 'deactivate':
      updateData = { isActive: false };
      message = 'Services deactivated successfully';
      break;
    case 'feature':
      updateData = { featured: true };
      message = 'Services featured successfully';
      break;
    case 'unfeature':
      updateData = { featured: false };
      message = 'Services unfeatured successfully';
      break;
    case 'delete':
      // Delete images from filesystem
      for (const service of services) {
        if (service.images && service.images.length > 0) {
          service.images.forEach(imagePath => {
            const fullPath = path.join(process.cwd(), imagePath);
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
            }
          });
        }
      }
      await HotelService.deleteMany({ _id: { $in: serviceIds } });
      return res.json({
        status: 'success',
        message: 'Services deleted successfully'
      });
    default:
      throw new ApplicationError('Invalid operation', 400);
  }

  await HotelService.updateMany(
    { _id: { $in: serviceIds } },
    updateData
  );

  res.json({
    status: 'success',
    message
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}/staff:
 *   get:
 *     summary: Get assigned staff for a service (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of assigned staff
 */
export const getServiceStaff = catchAsync(async (req, res) => {
  const service = await HotelService.findById(req.params.id)
    .populate('assignedStaff.staffId', 'name email phone department');

  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  // Check if admin has access to this service's hotel
  if (req.user.role === 'admin' && req.user.hotelId &&
      service.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('Access denied to this service', 403);
  }

  const activeStaff = service.getActiveStaff();

  res.json({
    status: 'success',
    data: {
      serviceId: service._id,
      serviceName: service.name,
      assignedStaff: activeStaff,
      staffingStatus: {
        isAdequatelyStaffed: service.hasAdequateStaffing(),
        minimumRequired: service.staffRequirements?.minimumStaff || 1,
        currentStaffCount: activeStaff.length
      }
    }
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}/staff:
 *   post:
 *     summary: Assign staff to a service (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - staffId
 *             properties:
 *               staffId:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [manager, supervisor, attendant, specialist]
 *               primaryContact:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Staff assigned successfully
 */
export const assignStaffToService = catchAsync(async (req, res) => {
  const { staffId, role = 'attendant', primaryContact = false } = req.body;

  const service = await HotelService.findById(req.params.id);
  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  // Check if admin has access to this service's hotel
  if (req.user.role === 'admin' && req.user.hotelId &&
      service.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('Access denied to this service', 403);
  }

  // Verify staff member exists and belongs to the same hotel
  const User = mongoose.model('User');
  const staffMember = await User.findOne({
    _id: staffId,
    hotelId: service.hotelId,
    role: 'staff',
    isActive: true
  });

  if (!staffMember) {
    throw new ApplicationError('Staff member not found or not active', 404);
  }

  // Assign staff to service
  service.assignStaff(staffId, role, primaryContact);
  await service.save();

  // Populate the updated service
  await service.populate('assignedStaff.staffId', 'name email department');

  res.json({
    status: 'success',
    message: 'Staff assigned successfully',
    data: {
      service,
      assignedStaff: service.getActiveStaff()
    }
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}/staff/{staffId}:
 *   delete:
 *     summary: Remove staff assignment from service (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Staff assignment removed successfully
 */
export const removeStaffFromService = catchAsync(async (req, res) => {
  const { id: serviceId, staffId } = req.params;

  const service = await HotelService.findById(serviceId);
  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  // Check if admin has access to this service's hotel
  if (req.user.role === 'admin' && req.user.hotelId &&
      service.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('Access denied to this service', 403);
  }

  service.unassignStaff(staffId);
  await service.save();

  await service.populate('assignedStaff.staffId', 'name email department');

  res.json({
    status: 'success',
    message: 'Staff assignment removed successfully',
    data: {
      service,
      assignedStaff: service.getActiveStaff()
    }
  });
});

/**
 * @swagger
 * /admin/hotel-services/available-staff:
 *   get:
 *     summary: Get available staff for service assignment (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available staff members
 */
export const getAvailableStaff = catchAsync(async (req, res) => {
  const User = mongoose.model('User');

  let hotelId;
  if (req.user.role === 'admin') {
    hotelId = req.user.hotelId;
  }

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const availableStaff = await User.find({
    hotelId: hotelId,
    role: 'staff',
    isActive: true
  }).select('_id name email phone department specializations')
    .sort({ name: 1 });

  res.json({
    status: 'success',
    data: availableStaff
  });
});
