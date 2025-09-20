import departmentService from '../services/departmentService.js';
import { catchAsync } from '../utils/catchAsync.js';

// Create a new department
export const createDepartment = catchAsync(async (req, res) => {
  const departmentData = {
    ...req.body,
    hotelId: req.user.hotelId // Assuming user has hotelId
  };

  const department = await departmentService.createDepartment(departmentData, req.user._id);

  res.status(201).json({
    success: true,
    message: 'Department created successfully',
    data: department
  });
});

// Get all departments for a hotel
export const getDepartments = catchAsync(async (req, res) => {
  const { 
    status,
    departmentType,
    includeHierarchy,
    page,
    limit 
  } = req.query;

  const options = {
    status,
    departmentType,
    includeHierarchy: includeHierarchy === 'true',
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50
  };

  const result = await departmentService.getDepartmentsByHotel(req.user.hotelId, options);

  res.json({
    success: true,
    data: result
  });
});

// Get department by ID
export const getDepartmentById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { populate, includeStats } = req.query;

  const options = {
    populate: populate === 'true',
    includeStats: includeStats === 'true'
  };

  const department = await departmentService.getDepartmentById(id, options);

  res.json({
    success: true,
    data: department
  });
});

// Update department
export const updateDepartment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const department = await departmentService.updateDepartment(id, updateData, req.user._id);

  res.json({
    success: true,
    message: 'Department updated successfully',
    data: department
  });
});

// Delete department
export const deleteDepartment = catchAsync(async (req, res) => {
  const { id } = req.params;

  await departmentService.deleteDepartment(id, req.user._id);

  res.json({
    success: true,
    message: 'Department deleted successfully'
  });
});

// Get department hierarchy
export const getDepartmentHierarchy = catchAsync(async (req, res) => {
  const hierarchy = await departmentService.getDepartmentHierarchy(req.user.hotelId);

  res.json({
    success: true,
    data: hierarchy
  });
});

// Assign staff to department
export const assignStaff = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { staffIds } = req.body;

  if (!staffIds || !Array.isArray(staffIds)) {
    return res.status(400).json({
      success: false,
      message: 'Staff IDs array is required'
    });
  }

  const department = await departmentService.assignStaffToDepartment(id, staffIds, req.user._id);

  res.json({
    success: true,
    message: 'Staff assigned successfully',
    data: department
  });
});

// Update department analytics
export const updateAnalytics = catchAsync(async (req, res) => {
  const { id } = req.params;
  const analyticsData = req.body;

  const department = await departmentService.updateDepartmentAnalytics(id, analyticsData);

  res.json({
    success: true,
    message: 'Analytics updated successfully',
    data: department
  });
});

// Get department metrics
export const getDepartmentMetrics = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { period = '30d' } = req.query;

  const metrics = await departmentService.getDepartmentMetrics(id, period);

  res.json({
    success: true,
    data: metrics
  });
});

// Bulk update departments
export const bulkUpdateDepartments = catchAsync(async (req, res) => {
  const { updates } = req.body;

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({
      success: false,
      message: 'Updates array is required'
    });
  }

  const results = await departmentService.bulkUpdateDepartments(
    req.user.hotelId, 
    updates, 
    req.user._id
  );

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  res.json({
    success: true,
    message: `Bulk update completed: ${successCount} successful, ${failureCount} failed`,
    data: results
  });
});

// Search departments
export const searchDepartments = catchAsync(async (req, res) => {
  const { q: searchQuery } = req.query;

  if (!searchQuery) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }

  const { status, limit } = req.query;
  const options = { status, limit: parseInt(limit) || 20 };

  const departments = await departmentService.searchDepartments(
    req.user.hotelId, 
    searchQuery, 
    options
  );

  res.json({
    success: true,
    data: departments
  });
});

// Export departments
export const exportDepartments = catchAsync(async (req, res) => {
  const { format = 'json' } = req.query;

  const data = await departmentService.exportDepartments(req.user.hotelId, format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="departments.csv"');
    res.send(data);
  } else {
    res.json({
      success: true,
      data
    });
  }
});

// Get department summary
export const getDepartmentSummary = catchAsync(async (req, res) => {
  const summary = await departmentService.getDepartmentSummary(req.user.hotelId);

  res.json({
    success: true,
    data: summary
  });
});

// Get department audit log
export const getDepartmentAuditLog = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const department = await departmentService.getDepartmentById(id);
  
  if (!department) {
    return res.status(404).json({
      success: false,
      message: 'Department not found'
    });
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const auditLog = department.auditLog
    .sort((a, b) => b.performedAt - a.performedAt)
    .slice(skip, skip + parseInt(limit));

  // Populate user information for audit log
  const populatedLog = await department.populate({
    path: 'auditLog.performedBy',
    select: 'name email'
  });

  res.json({
    success: true,
    data: {
      auditLog: populatedLog.auditLog.slice(skip, skip + parseInt(limit)),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: department.auditLog.length,
        totalPages: Math.ceil(department.auditLog.length / parseInt(limit))
      }
    }
  });
});

// Update department KPIs
export const updateDepartmentKPIs = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { kpis } = req.body;

  if (!kpis || !Array.isArray(kpis)) {
    return res.status(400).json({
      success: false,
      message: 'KPIs array is required'
    });
  }

  const department = await departmentService.updateDepartment(
    id, 
    { kpis }, 
    req.user._id
  );

  res.json({
    success: true,
    message: 'Department KPIs updated successfully',
    data: department
  });
});

// Update department budget
export const updateDepartmentBudget = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { budget } = req.body;

  const department = await departmentService.updateDepartment(
    id, 
    { budget }, 
    req.user._id
  );

  res.json({
    success: true,
    message: 'Department budget updated successfully',
    data: department
  });
});

// Get department staff
export const getDepartmentStaff = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    // This would integrate with User model when available
    const User = mongoose.model('User');
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [staff, total] = await Promise.all([
      User.find({ departmentId: id })
        .select('name email role status')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ name: 1 }),
      User.countDocuments({ departmentId: id })
    ]);

    res.json({
      success: true,
      data: {
        staff,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    // If User model doesn't exist, return empty staff list
    res.json({
      success: true,
      data: {
        staff: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0
        }
      }
    });
  }
});

// Update department status
export const updateDepartmentStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  const validStatuses = ['active', 'inactive', 'suspended', 'archived'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
    });
  }

  const department = await departmentService.updateDepartment(
    id, 
    { status }, 
    req.user._id
  );

  // Add audit entry for status change
  await department.addAuditEntry(
    'status_changed',
    req.user._id,
    { newStatus: status, reason },
    req.ip,
    req.get('User-Agent')
  );

  res.json({
    success: true,
    message: `Department status updated to ${status}`,
    data: department
  });
});

// Clone department
export const cloneDepartment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { newName, newCode } = req.body;

  if (!newName || !newCode) {
    return res.status(400).json({
      success: false,
      message: 'New name and code are required for cloning'
    });
  }

  const originalDepartment = await departmentService.getDepartmentById(id);
  
  if (!originalDepartment) {
    return res.status(404).json({
      success: false,
      message: 'Original department not found'
    });
  }

  // Create new department data by copying from original
  const newDepartmentData = {
    ...originalDepartment.toObject(),
    name: newName,
    code: newCode,
    parentDepartment: null, // Reset parent for cloned department
    // Reset analytics and audit data
    analytics: {
      totalTasks: 0,
      completedTasks: 0,
      avgTaskCompletionTime: 0,
      totalRevenue: 0,
      totalExpenses: 0,
      efficiency: 0,
      lastCalculated: new Date()
    },
    auditLog: []
  };

  // Remove fields that shouldn't be cloned
  delete newDepartmentData._id;
  delete newDepartmentData.createdAt;
  delete newDepartmentData.updatedAt;
  delete newDepartmentData.__v;

  const clonedDepartment = await departmentService.createDepartment(
    newDepartmentData, 
    req.user._id
  );

  res.status(201).json({
    success: true,
    message: 'Department cloned successfully',
    data: clonedDepartment
  });
});
