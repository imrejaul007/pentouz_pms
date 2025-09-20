import Department from '../models/Department.js';
import mongoose from 'mongoose';

class DepartmentService {
  
  // Create a new department
  async createDepartment(departmentData, userId) {
    try {
      const department = new Department({
        ...departmentData,
        createdBy: userId
      });

      // Validate department code uniqueness
      const existingDepartment = await Department.findOne({ 
        code: departmentData.code,
        hotelId: departmentData.hotelId 
      });

      if (existingDepartment) {
        throw new Error('Department code already exists for this hotel');
      }

      // Validate parent department if specified
      if (departmentData.parentDepartment) {
        const parentDept = await Department.findById(departmentData.parentDepartment);
        if (!parentDept || parentDept.hotelId.toString() !== departmentData.hotelId) {
          throw new Error('Invalid parent department');
        }

        // Check for circular dependency
        if (await this.wouldCreateCircularDependency(departmentData.parentDepartment, department._id)) {
          throw new Error('Cannot create circular department hierarchy');
        }
      }

      await department.save();
      
      // Add audit entry
      await department.addAuditEntry(
        'department_created',
        userId,
        { departmentData },
        null,
        null
      );

      return await this.getDepartmentById(department._id, { populate: true });
    } catch (error) {
      throw new Error(`Failed to create department: ${error.message}`);
    }
  }

  // Get department by ID
  async getDepartmentById(departmentId, options = {}) {
    try {
      const { populate = false, includeStats = false } = options;

      let query = Department.findById(departmentId);

      if (populate) {
        query = query
          .populate('parentDepartment', 'name code')
          .populate('subdepartments', 'name code departmentType')
          .populate('staffing.headOfDepartment', 'name email')
          .populate('createdBy', 'name email')
          .populate('updatedBy', 'name email');
      }

      const department = await query.exec();

      if (!department) {
        throw new Error('Department not found');
      }

      if (includeStats) {
        const stats = await Department.getDepartmentStats(departmentId);
        return {
          department: department.toObject(),
          stats
        };
      }

      return department;
    } catch (error) {
      throw new Error(`Failed to get department: ${error.message}`);
    }
  }

  // Get all departments for a hotel
  async getDepartmentsByHotel(hotelId, options = {}) {
    try {
      const {
        status = 'active',
        departmentType,
        includeHierarchy = false,
        page = 1,
        limit = 50
      } = options;

      const filter = { hotelId };
      
      if (status) filter.status = status;
      if (departmentType) filter.departmentType = departmentType;

      if (includeHierarchy) {
        return await Department.buildHierarchy(hotelId);
      }

      const skip = (page - 1) * limit;

      const [departments, total] = await Promise.all([
        Department.find(filter)
          .populate('parentDepartment', 'name code')
          .populate('staffing.headOfDepartment', 'name email')
          .sort({ level: 1, name: 1 })
          .skip(skip)
          .limit(limit),
        Department.countDocuments(filter)
      ]);

      return {
        departments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get departments: ${error.message}`);
    }
  }

  // Update department
  async updateDepartment(departmentId, updateData, userId) {
    try {
      const department = await Department.findById(departmentId);

      if (!department) {
        throw new Error('Department not found');
      }

      // Validate parent department change
      if (updateData.parentDepartment && updateData.parentDepartment !== department.parentDepartment?.toString()) {
        if (await this.wouldCreateCircularDependency(updateData.parentDepartment, departmentId)) {
          throw new Error('Cannot create circular department hierarchy');
        }
      }

      // Store original data for audit
      const originalData = department.toObject();

      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt') {
          department[key] = updateData[key];
        }
      });

      department.updatedBy = userId;
      await department.save();

      // Add audit entry
      await department.addAuditEntry(
        'department_updated',
        userId,
        {
          before: originalData,
          after: updateData
        },
        null,
        null
      );

      return await this.getDepartmentById(departmentId, { populate: true });
    } catch (error) {
      throw new Error(`Failed to update department: ${error.message}`);
    }
  }

  // Delete department
  async deleteDepartment(departmentId, userId) {
    try {
      const department = await Department.findById(departmentId);

      if (!department) {
        throw new Error('Department not found');
      }

      // Check for subdepartments
      const subdepartments = await Department.find({ parentDepartment: departmentId });
      if (subdepartments.length > 0) {
        throw new Error('Cannot delete department with subdepartments');
      }

      // Check for staff assignments (if User model exists)
      try {
        const User = mongoose.model('User');
        const staffCount = await User.countDocuments({ departmentId });
        if (staffCount > 0) {
          throw new Error('Cannot delete department with assigned staff');
        }
      } catch (modelError) {
        // User model might not exist, continue with deletion
      }

      // Add final audit entry
      await department.addAuditEntry(
        'department_deleted',
        userId,
        { departmentName: department.name, departmentCode: department.code },
        null,
        null
      );

      await Department.findByIdAndDelete(departmentId);
      return { message: 'Department deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete department: ${error.message}`);
    }
  }

  // Get department hierarchy
  async getDepartmentHierarchy(hotelId) {
    try {
      return await Department.buildHierarchy(hotelId);
    } catch (error) {
      throw new Error(`Failed to get department hierarchy: ${error.message}`);
    }
  }

  // Assign staff to department
  async assignStaffToDepartment(departmentId, staffIds, userId) {
    try {
      const department = await Department.findById(departmentId);
      
      if (!department) {
        throw new Error('Department not found');
      }

      // Update staff assignments (this would integrate with User model)
      try {
        const User = mongoose.model('User');
        await User.updateMany(
          { _id: { $in: staffIds } },
          { departmentId: departmentId }
        );

        // Update department staff count
        const newStaffCount = await User.countDocuments({ departmentId });
        department.staffing.currentStaff = newStaffCount;
        await department.save();

      } catch (modelError) {
        // User model might not exist, just log the assignment
        console.log(`Staff assignment logged for department ${departmentId}`);
      }

      // Add audit entry
      await department.addAuditEntry(
        'staff_assigned',
        userId,
        { staffIds, count: staffIds.length },
        null,
        null
      );

      return await this.getDepartmentById(departmentId, { populate: true });
    } catch (error) {
      throw new Error(`Failed to assign staff: ${error.message}`);
    }
  }

  // Update department analytics
  async updateDepartmentAnalytics(departmentId, analyticsData) {
    try {
      const department = await Department.findById(departmentId);
      
      if (!department) {
        throw new Error('Department not found');
      }

      // Update analytics
      department.analytics = {
        ...department.analytics,
        ...analyticsData,
        lastCalculated: new Date()
      };

      // Recalculate efficiency
      department.calculateEfficiency();
      
      await department.save();
      return department;
    } catch (error) {
      throw new Error(`Failed to update analytics: ${error.message}`);
    }
  }

  // Get department performance metrics
  async getDepartmentMetrics(departmentId, period = '30d') {
    try {
      const department = await Department.findById(departmentId);
      
      if (!department) {
        throw new Error('Department not found');
      }

      const stats = await Department.getDepartmentStats(departmentId);
      
      // Additional metrics based on period
      const metrics = {
        basic: stats,
        period,
        kpis: department.kpis.filter(kpi => kpi.isActive).map(kpi => ({
          name: kpi.name,
          target: kpi.targetValue,
          current: kpi.currentValue,
          achievement: kpi.targetValue > 0 ? (kpi.currentValue / kpi.targetValue * 100).toFixed(2) : 0,
          unit: kpi.unit
        })),
        trends: {
          efficiency: department.analytics.efficiency,
          completionRate: department.completionRate,
          budgetUtilization: stats.financial.budgetUtilization
        }
      };

      return metrics;
    } catch (error) {
      throw new Error(`Failed to get department metrics: ${error.message}`);
    }
  }

  // Bulk operations
  async bulkUpdateDepartments(hotelId, updates, userId) {
    try {
      const results = [];

      for (const update of updates) {
        try {
          const result = await this.updateDepartment(update.departmentId, update.data, userId);
          results.push({ success: true, departmentId: update.departmentId, data: result });
        } catch (error) {
          results.push({ 
            success: false, 
            departmentId: update.departmentId, 
            error: error.message 
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to perform bulk updates: ${error.message}`);
    }
  }

  // Search departments
  async searchDepartments(hotelId, searchQuery, options = {}) {
    try {
      const { status = 'active', limit = 20 } = options;

      const searchRegex = new RegExp(searchQuery, 'i');
      
      const departments = await Department.find({
        hotelId,
        status,
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { code: searchRegex }
        ]
      })
      .populate('parentDepartment', 'name code')
      .limit(limit)
      .sort({ name: 1 });

      return departments;
    } catch (error) {
      throw new Error(`Failed to search departments: ${error.message}`);
    }
  }

  // Export departments
  async exportDepartments(hotelId, format = 'json') {
    try {
      const departments = await Department.find({ hotelId })
        .populate('parentDepartment', 'name code')
        .populate('staffing.headOfDepartment', 'name email')
        .sort({ level: 1, name: 1 });

      if (format === 'csv') {
        return this.convertToCSV(departments);
      }

      return departments;
    } catch (error) {
      throw new Error(`Failed to export departments: ${error.message}`);
    }
  }

  // Helper methods
  async wouldCreateCircularDependency(parentId, childId) {
    if (parentId === childId) return true;

    const parent = await Department.findById(parentId);
    if (!parent || !parent.parentDepartment) return false;

    return await this.wouldCreateCircularDependency(parent.parentDepartment, childId);
  }

  convertToCSV(departments) {
    const headers = [
      'ID', 'Name', 'Code', 'Type', 'Status', 'Parent Department', 
      'Level', 'Head of Department', 'Staff Count', 'Efficiency'
    ];

    const rows = departments.map(dept => [
      dept._id,
      dept.name,
      dept.code,
      dept.departmentType,
      dept.status,
      dept.parentDepartment?.name || '',
      dept.level,
      dept.staffing.headOfDepartment?.name || '',
      dept.staffing.currentStaff,
      dept.analytics.efficiency.toFixed(2)
    ]);

    return [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  }

  // Get department summary
  async getDepartmentSummary(hotelId) {
    try {
      const summary = await Department.aggregate([
        { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalStaff: { $sum: '$staffing.currentStaff' },
            totalPositions: { $sum: '$staffing.totalPositions' },
            avgEfficiency: { $avg: '$analytics.efficiency' }
          }
        }
      ]);

      const typeBreakdown = await Department.aggregate([
        { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
        {
          $group: {
            _id: '$departmentType',
            count: { $sum: 1 },
            totalStaff: { $sum: '$staffing.currentStaff' }
          }
        }
      ]);

      return {
        statusSummary: summary,
        typeSummary: typeBreakdown,
        generatedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to get department summary: ${error.message}`);
    }
  }
}

export default new DepartmentService();