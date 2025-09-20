import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    trim: true,
    maxLength: [100, 'Department name cannot exceed 100 characters'],
    index: true
  },
  description: {
    type: String,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  code: {
    type: String,
    required: [true, 'Department code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxLength: [10, 'Department code cannot exceed 10 characters'],
    match: [/^[A-Z0-9_]+$/, 'Department code can only contain letters, numbers and underscores']
  },
  
  // Department hierarchy
  parentDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  level: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  hierarchyPath: {
    type: String,
    index: true
  },
  
  // Department configuration
  departmentType: {
    type: String,
    enum: [
      'front_office', 'housekeeping', 'food_beverage', 'maintenance', 
      'security', 'finance', 'hr', 'marketing', 'management', 
      'spa_wellness', 'concierge', 'business_center', 'other'
    ],
    required: true,
    default: 'other'
  },
  
  // Operational settings
  isOperational: {
    type: Boolean,
    default: true
  },
  isRevenueCenter: {
    type: Boolean,
    default: false
  },
  isCostCenter: {
    type: Boolean,
    default: true
  },
  
  // Working hours
  workingHours: {
    isActive: {
      type: Boolean,
      default: true
    },
    schedule: [{
      day: {
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        required: true
      },
      isWorking: {
        type: Boolean,
        default: true
      },
      startTime: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      },
      endTime: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      },
      breakStart: String,
      breakEnd: String
    }],
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  
  // Budget and financial settings
  budget: {
    annual: {
      revenue: { type: Number, default: 0 },
      expenses: { type: Number, default: 0 }
    },
    monthly: {
      revenue: { type: Number, default: 0 },
      expenses: { type: Number, default: 0 }
    },
    currency: {
      type: String,
      default: 'USD',
      maxLength: 3
    },
    budgetYear: {
      type: Number,
      default: () => new Date().getFullYear()
    }
  },
  
  // Contact information
  contact: {
    phone: {
      type: String,
      match: [/^[\d\s\-\+\(\)]+$/, 'Invalid phone number format']
    },
    extension: String,
    email: {
      type: String,
      match: [/^[\w\.-]+@[\w\.-]+\.\w+$/, 'Invalid email format'],
      lowercase: true
    },
    location: {
      building: String,
      floor: String,
      room: String,
      address: String
    }
  },
  
  // Staff management
  staffing: {
    headOfDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    totalPositions: {
      type: Number,
      default: 0,
      min: 0
    },
    currentStaff: {
      type: Number,
      default: 0,
      min: 0
    },
    shifts: [{
      name: String,
      startTime: String,
      endTime: String,
      staffRequired: Number
    }]
  },
  
  // Performance metrics
  kpis: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    targetValue: Number,
    currentValue: {
      type: Number,
      default: 0
    },
    unit: String,
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Department permissions and access
  permissions: {
    accessLevel: {
      type: String,
      enum: ['public', 'restricted', 'private'],
      default: 'restricted'
    },
    allowedRoles: [{
      type: String,
      enum: ['admin', 'manager', 'supervisor', 'staff', 'guest']
    }],
    specialPermissions: [{
      action: String,
      roles: [String],
      conditions: mongoose.Schema.Types.Mixed
    }]
  },
  
  // Department settings
  settings: {
    autoAssignment: {
      type: Boolean,
      default: false
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    notificationSettings: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      internal: { type: Boolean, default: true }
    },
    integrations: [{
      system: String,
      isEnabled: { type: Boolean, default: false },
      configuration: mongoose.Schema.Types.Mixed
    }]
  },
  
  // Status and metadata
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'archived'],
    default: 'active',
    index: true
  },
  
  // Hotel association
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Analytics and tracking
  analytics: {
    totalTasks: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 },
    avgTaskCompletionTime: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    efficiency: { type: Number, default: 0 },
    lastCalculated: { type: Date, default: Date.now }
  },
  
  // Audit log
  auditLog: [{
    action: {
      type: String,
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    changes: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String
  }]
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
departmentSchema.index({ hotelId: 1, status: 1 });
departmentSchema.index({ departmentType: 1, status: 1 });
departmentSchema.index({ parentDepartment: 1 });
departmentSchema.index({ hierarchyPath: 1 });
departmentSchema.index({ name: 'text', description: 'text' });
departmentSchema.index({ code: 1 }, { unique: true });
departmentSchema.index({ createdAt: -1 });

// Virtual for subdepartments
departmentSchema.virtual('subdepartments', {
  ref: 'Department',
  localField: '_id',
  foreignField: 'parentDepartment'
});

// Virtual for staff count
departmentSchema.virtual('staffCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'departmentId',
  count: true
});

// Virtual for department path
departmentSchema.virtual('fullPath').get(function() {
  return this.hierarchyPath ? this.hierarchyPath.replace(/\//g, ' > ') : this.name;
});

// Virtual for completion rate
departmentSchema.virtual('completionRate').get(function() {
  if (this.analytics.totalTasks === 0) return 0;
  return (this.analytics.completedTasks / this.analytics.totalTasks * 100).toFixed(2);
});

// Methods
departmentSchema.methods.updateHierarchyPath = async function() {
  if (!this.parentDepartment) {
    this.hierarchyPath = `/${this.name}`;
    this.level = 0;
  } else {
    const parent = await this.constructor.findById(this.parentDepartment);
    if (parent) {
      this.hierarchyPath = `${parent.hierarchyPath}/${this.name}`;
      this.level = parent.level + 1;
    }
  }
  return this.save();
};

departmentSchema.methods.addAuditEntry = function(action, performedBy, changes, ipAddress, userAgent) {
  this.auditLog.push({
    action,
    performedBy,
    changes,
    ipAddress,
    userAgent
  });
  
  // Keep only last 100 audit entries
  if (this.auditLog.length > 100) {
    this.auditLog = this.auditLog.slice(-100);
  }
  
  return this.save();
};

departmentSchema.methods.updateAnalytics = async function() {
  // Update analytics based on related data
  // This would integrate with task, booking, and performance systems
  this.analytics.lastCalculated = new Date();
  return this.save();
};

departmentSchema.methods.calculateEfficiency = function() {
  const completionRate = this.analytics.totalTasks > 0 
    ? this.analytics.completedTasks / this.analytics.totalTasks 
    : 0;
  
  const budgetEfficiency = this.budget.annual.expenses > 0
    ? this.analytics.totalRevenue / this.budget.annual.expenses
    : 0;
    
  this.analytics.efficiency = ((completionRate * 0.6) + (budgetEfficiency * 0.4)) * 100;
  return this.analytics.efficiency;
};

// Static methods
departmentSchema.statics.findByHotel = function(hotelId, options = {}) {
  const { status = 'active', includeSubdepartments = false } = options;
  
  let query = this.find({ hotelId, status });
  
  if (includeSubdepartments) {
    query = query.populate('subdepartments');
  }
  
  return query.sort({ level: 1, name: 1 });
};

departmentSchema.statics.buildHierarchy = async function(hotelId) {
  const departments = await this.find({ hotelId, status: 'active' })
    .sort({ level: 1, name: 1 });
    
  const hierarchy = [];
  const departmentMap = new Map();
  
  departments.forEach(dept => {
    departmentMap.set(dept._id.toString(), {
      ...dept.toObject(),
      children: []
    });
  });
  
  departments.forEach(dept => {
    const deptObj = departmentMap.get(dept._id.toString());
    if (dept.parentDepartment) {
      const parent = departmentMap.get(dept.parentDepartment.toString());
      if (parent) {
        parent.children.push(deptObj);
      }
    } else {
      hierarchy.push(deptObj);
    }
  });
  
  return hierarchy;
};

departmentSchema.statics.getDepartmentStats = async function(departmentId) {
  const department = await this.findById(departmentId)
    .populate('subdepartments')
    .populate('staffCount');
    
  if (!department) {
    throw new Error('Department not found');
  }
  
  // Calculate comprehensive stats
  const stats = {
    basic: {
      name: department.name,
      code: department.code,
      type: department.departmentType,
      level: department.level
    },
    staffing: {
      totalPositions: department.staffing.totalPositions,
      currentStaff: department.staffCount || 0,
      occupancyRate: department.staffing.totalPositions > 0 
        ? (department.staffCount / department.staffing.totalPositions * 100).toFixed(2)
        : 0
    },
    performance: {
      completionRate: department.completionRate,
      efficiency: department.analytics.efficiency,
      totalTasks: department.analytics.totalTasks,
      avgCompletionTime: department.analytics.avgTaskCompletionTime
    },
    financial: {
      totalRevenue: department.analytics.totalRevenue,
      totalExpenses: department.analytics.totalExpenses,
      budgetUtilization: department.budget.annual.expenses > 0
        ? (department.analytics.totalExpenses / department.budget.annual.expenses * 100).toFixed(2)
        : 0
    },
    hierarchy: {
      subdepartments: department.subdepartments?.length || 0,
      hasParent: !!department.parentDepartment,
      fullPath: department.fullPath
    }
  };
  
  return stats;
};

// Pre-save middleware
departmentSchema.pre('save', async function(next) {
  if (this.isModified('parentDepartment') || this.isModified('name')) {
    await this.updateHierarchyPath();
  }
  
  if (this.isModified('analytics')) {
    this.calculateEfficiency();
  }
  
  next();
});

// Post-save middleware
departmentSchema.post('save', async function(doc) {
  // Update all subdepartments' hierarchy paths
  if (this.isModified('name') || this.isModified('parentDepartment')) {
    const subdepartments = await this.constructor.find({ parentDepartment: doc._id });
    await Promise.all(subdepartments.map(sub => sub.updateHierarchyPath()));
  }
});

// Pre-remove middleware
departmentSchema.pre('remove', async function(next) {
  // Check for subdepartments
  const subdepartments = await this.constructor.find({ parentDepartment: this._id });
  if (subdepartments.length > 0) {
    const error = new Error('Cannot delete department with subdepartments');
    error.code = 'DEPARTMENT_HAS_SUBDEPARTMENTS';
    return next(error);
  }
  
  // Check for staff assignments
  const User = mongoose.model('User');
  const staffCount = await User.countDocuments({ departmentId: this._id });
  if (staffCount > 0) {
    const error = new Error('Cannot delete department with assigned staff');
    error.code = 'DEPARTMENT_HAS_STAFF';
    return next(error);
  }
  
  next();
});

export default mongoose.model('Department', departmentSchema);
