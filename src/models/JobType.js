import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     JobType:
 *       type: object
 *       required:
 *         - name
 *         - code
 *         - category
 *         - isActive
 *       properties:
 *         _id:
 *           type: string
 *           description: Job type ID
 *         name:
 *           type: string
 *           description: Job type name
 *         code:
 *           type: string
 *           description: Unique code for the job type
 *         description:
 *           type: string
 *           description: Job type description
 *         category:
 *           type: string
 *           enum: [hospitality, management, maintenance, security, food_beverage, housekeeping, front_desk, sales_marketing, finance, human_resources, other]
 *           description: Job type category
 *         subcategory:
 *           type: string
 *           description: Job type subcategory
 *         requirements:
 *           type: object
 *           properties:
 *             education:
 *               type: string
 *               enum: [high_school, associate, bachelor, master, doctorate, certification, none]
 *             experience:
 *               type: string
 *               enum: [entry_level, 1_2_years, 3_5_years, 5_10_years, 10_plus_years]
 *             skills:
 *               type: array
 *               items:
 *                 type: string
 *             certifications:
 *               type: array
 *               items:
 *                 type: string
 *             languages:
 *               type: array
 *               items:
 *                 type: string
 *         compensation:
 *           type: object
 *           properties:
 *             salaryRange:
 *               type: object
 *               properties:
 *                 min:
 *                   type: number
 *                 max:
 *                   type: number
 *             hourlyRate:
 *               type: object
 *               properties:
 *                 min:
 *                   type: number
 *                 max:
 *                   type: number
 *             benefits:
 *               type: array
 *               items:
 *                 type: string
 *             commission:
 *               type: number
 *         schedule:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [full_time, part_time, contract, seasonal, temporary, internship]
 *             hoursPerWeek:
 *               type: number
 *             shiftPattern:
 *               type: string
 *               enum: [day, night, rotating, flexible, on_call]
 *             workingDays:
 *               type: array
 *               items:
 *                 type: string
 *                 enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday]
 *         responsibilities:
 *           type: array
 *           items:
 *             type: string
 *         qualifications:
 *           type: array
 *           items:
 *             type: string
 *         department:
 *           type: string
 *           description: Department this job type belongs to
 *         level:
 *           type: string
 *           enum: [entry, junior, mid, senior, lead, manager, director, executive]
 *           description: Job level
 *         isRemote:
 *           type: boolean
 *           description: Whether this job can be done remotely
 *         isActive:
 *           type: boolean
 *           description: Whether the job type is active
 *         priority:
 *           type: number
 *           description: Priority for hiring (higher = more urgent)
 *         hotelId:
 *           type: string
 *           description: Hotel ID this job type belongs to
 *         createdBy:
 *           type: string
 *           description: User who created this job type
 *         updatedBy:
 *           type: string
 *           description: User who last updated this job type
 */

const jobTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Job type name is required'],
    trim: true,
    maxLength: [200, 'Job type name cannot exceed 200 characters'],
    index: true
  },
  code: {
    type: String,
    required: [true, 'Job type code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxLength: [20, 'Job type code cannot exceed 20 characters'],
    match: [/^[A-Z0-9_-]+$/, 'Job type code can only contain letters, numbers, underscores and hyphens']
  },
  description: {
    type: String,
    maxLength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Job type category is required'],
    enum: [
      'hospitality', 'management', 'maintenance', 'security', 'food_beverage', 
      'housekeeping', 'front_desk', 'sales_marketing', 'finance', 'human_resources', 'other'
    ],
    index: true
  },
  subcategory: {
    type: String,
    trim: true,
    maxLength: [100, 'Subcategory cannot exceed 100 characters']
  },
  requirements: {
    education: {
      type: String,
      enum: ['high_school', 'associate', 'bachelor', 'master', 'doctorate', 'certification', 'none']
    },
    experience: {
      type: String,
      enum: ['entry_level', '1_2_years', '3_5_years', '5_10_years', '10_plus_years']
    },
    skills: [{
      type: String,
      trim: true,
      maxLength: [100, 'Skill name cannot exceed 100 characters']
    }],
    certifications: [{
      type: String,
      trim: true,
      maxLength: [100, 'Certification name cannot exceed 100 characters']
    }],
    languages: [{
      type: String,
      trim: true,
      maxLength: [50, 'Language name cannot exceed 50 characters']
    }]
  },
  compensation: {
    salaryRange: {
      min: {
        type: Number,
        min: [0, 'Minimum salary cannot be negative']
      },
      max: {
        type: Number,
        min: [0, 'Maximum salary cannot be negative']
      }
    },
    hourlyRate: {
      min: {
        type: Number,
        min: [0, 'Minimum hourly rate cannot be negative']
      },
      max: {
        type: Number,
        min: [0, 'Maximum hourly rate cannot be negative']
      }
    },
    benefits: [{
      type: String,
      trim: true,
      maxLength: [100, 'Benefit name cannot exceed 100 characters']
    }],
    commission: {
      type: Number,
      min: [0, 'Commission cannot be negative'],
      max: [100, 'Commission cannot exceed 100%']
    }
  },
  schedule: {
    type: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'seasonal', 'temporary', 'internship']
    },
    hoursPerWeek: {
      type: Number,
      min: [1, 'Hours per week must be at least 1'],
      max: [80, 'Hours per week cannot exceed 80']
    },
    shiftPattern: {
      type: String,
      enum: ['day', 'night', 'rotating', 'flexible', 'on_call']
    },
    workingDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }]
  },
  responsibilities: [{
    type: String,
    trim: true,
    maxLength: [500, 'Responsibility cannot exceed 500 characters']
  }],
  qualifications: [{
    type: String,
    trim: true,
    maxLength: [500, 'Qualification cannot exceed 500 characters']
  }],
  department: {
    type: mongoose.Schema.ObjectId,
    ref: 'Department'
  },
  level: {
    type: String,
    enum: ['entry', 'junior', 'mid', 'senior', 'lead', 'manager', 'director', 'executive']
  },
  isRemote: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  priority: {
    type: Number,
    default: 0,
    index: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
jobTypeSchema.index({ hotelId: 1, category: 1 });
jobTypeSchema.index({ hotelId: 1, isActive: 1 });
jobTypeSchema.index({ hotelId: 1, priority: -1 });
jobTypeSchema.index({ hotelId: 1, level: 1 });

// Ensure unique job type codes per hotel
jobTypeSchema.index({ hotelId: 1, code: 1 }, { unique: true });

// Virtual for salary range summary
jobTypeSchema.virtual('salaryRangeSummary').get(function() {
  if (!this.compensation.salaryRange) return 'Not specified';
  const { min, max } = this.compensation.salaryRange;
  if (min && max) {
    return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
  } else if (min) {
    return `$${min.toLocaleString()}+`;
  } else if (max) {
    return `Up to $${max.toLocaleString()}`;
  }
  return 'Not specified';
});

// Virtual for hourly rate summary
jobTypeSchema.virtual('hourlyRateSummary').get(function() {
  if (!this.compensation.hourlyRate) return 'Not specified';
  const { min, max } = this.compensation.hourlyRate;
  if (min && max) {
    return `$${min} - $${max}/hour`;
  } else if (min) {
    return `$${min}+/hour`;
  } else if (max) {
    return `Up to $${max}/hour`;
  }
  return 'Not specified';
});

// Virtual for requirements summary
jobTypeSchema.virtual('requirementsSummary').get(function() {
  const requirements = [];
  
  if (this.requirements.education && this.requirements.education !== 'none') {
    requirements.push(this.requirements.education.replace('_', ' '));
  }
  
  if (this.requirements.experience) {
    requirements.push(this.requirements.experience.replace('_', ' '));
  }
  
  if (this.requirements.skills.length > 0) {
    requirements.push(`${this.requirements.skills.length} skills required`);
  }
  
  return requirements.join(', ') || 'No specific requirements';
});

// Virtual for schedule summary
jobTypeSchema.virtual('scheduleSummary').get(function() {
  const schedule = [];
  
  if (this.schedule.type) {
    schedule.push(this.schedule.type.replace('_', ' '));
  }
  
  if (this.schedule.hoursPerWeek) {
    schedule.push(`${this.schedule.hoursPerWeek} hours/week`);
  }
  
  if (this.schedule.shiftPattern) {
    schedule.push(this.schedule.shiftPattern.replace('_', ' '));
  }
  
  return schedule.join(', ') || 'Schedule not specified';
});

// Instance methods
jobTypeSchema.methods.getCompensationSummary = function() {
  if (this.compensation.salaryRange && (this.compensation.salaryRange.min || this.compensation.salaryRange.max)) {
    return this.salaryRangeSummary;
  } else if (this.compensation.hourlyRate && (this.compensation.hourlyRate.min || this.compensation.hourlyRate.max)) {
    return this.hourlyRateSummary;
  } else if (this.compensation.commission) {
    return `${this.compensation.commission}% commission`;
  }
  return 'Compensation not specified';
};

jobTypeSchema.methods.isRemoteEligible = function() {
  // Define which job types can be remote
  const remoteEligibleCategories = ['management', 'sales_marketing', 'finance', 'human_resources'];
  return this.isRemote && remoteEligibleCategories.includes(this.category);
};

jobTypeSchema.methods.getRequiredSkillsCount = function() {
  return this.requirements.skills.length;
};

jobTypeSchema.methods.getRequiredCertificationsCount = function() {
  return this.requirements.certifications.length;
};

jobTypeSchema.methods.getRequiredLanguagesCount = function() {
  return this.requirements.languages.length;
};

// Static methods
jobTypeSchema.statics.getByCategory = function(hotelId, category) {
  return this.find({ hotelId, category, isActive: true })
    .sort({ priority: -1, createdAt: -1 })
    .populate('createdBy updatedBy', 'name email')
    .populate('department', 'name code');
};

jobTypeSchema.statics.getByLevel = function(hotelId, level) {
  return this.find({ hotelId, level, isActive: true })
    .sort({ priority: -1, createdAt: -1 })
    .populate('createdBy updatedBy', 'name email')
    .populate('department', 'name code');
};

jobTypeSchema.statics.getActiveJobTypes = function(hotelId) {
  return this.find({ hotelId, isActive: true })
    .sort({ priority: -1, createdAt: -1 })
    .populate('createdBy updatedBy', 'name email')
    .populate('department', 'name code');
};

jobTypeSchema.statics.getRemoteEligibleJobs = function(hotelId) {
  return this.find({ hotelId, isActive: true, isRemote: true })
    .sort({ priority: -1, createdAt: -1 })
    .populate('createdBy updatedBy', 'name email')
    .populate('department', 'name code');
};

jobTypeSchema.statics.getJobTypeAnalytics = function(hotelId, dateRange) {
  const pipeline = [
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$category',
        totalJobTypes: { $sum: 1 },
        activeJobTypes: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        remoteEligible: {
          $sum: { $cond: ['$isRemote', 1, 0] }
        },
        avgSalaryMin: { $avg: '$compensation.salaryRange.min' },
        avgSalaryMax: { $avg: '$compensation.salaryRange.max' },
        avgHourlyMin: { $avg: '$compensation.hourlyRate.min' },
        avgHourlyMax: { $avg: '$compensation.hourlyRate.max' }
      }
    },
    { $sort: { _id: 1 } }
  ];

  return this.aggregate(pipeline);
};

jobTypeSchema.statics.searchJobTypes = function(hotelId, searchCriteria) {
  const query = { hotelId, isActive: true };
  
  if (searchCriteria.category) {
    query.category = searchCriteria.category;
  }
  
  if (searchCriteria.level) {
    query.level = searchCriteria.level;
  }
  
  if (searchCriteria.isRemote !== undefined) {
    query.isRemote = searchCriteria.isRemote;
  }
  
  if (searchCriteria.department) {
    query.department = searchCriteria.department;
  }
  
  if (searchCriteria.scheduleType) {
    query['schedule.type'] = searchCriteria.scheduleType;
  }
  
  if (searchCriteria.minSalary) {
    query['compensation.salaryRange.max'] = { $gte: searchCriteria.minSalary };
  }
  
  if (searchCriteria.maxSalary) {
    query['compensation.salaryRange.min'] = { $lte: searchCriteria.maxSalary };
  }
  
  return this.find(query)
    .sort({ priority: -1, createdAt: -1 })
    .populate('createdBy updatedBy', 'name email')
    .populate('department', 'name code');
};

// Pre-save middleware
jobTypeSchema.pre('save', function(next) {
  // Validate salary range
  if (this.compensation.salaryRange) {
    const { min, max } = this.compensation.salaryRange;
    if (min && max && min > max) {
      return next(new Error('Minimum salary cannot be greater than maximum salary'));
    }
  }

  // Validate hourly rate range
  if (this.compensation.hourlyRate) {
    const { min, max } = this.compensation.hourlyRate;
    if (min && max && min > max) {
      return next(new Error('Minimum hourly rate cannot be greater than maximum hourly rate'));
    }
  }

  // Validate hours per week
  if (this.schedule.hoursPerWeek && this.schedule.hoursPerWeek < 1) {
    return next(new Error('Hours per week must be at least 1'));
  }

  if (this.schedule.hoursPerWeek && this.schedule.hoursPerWeek > 80) {
    return next(new Error('Hours per week cannot exceed 80'));
  }

  // Validate commission
  if (this.compensation.commission && (this.compensation.commission < 0 || this.compensation.commission > 100)) {
    return next(new Error('Commission must be between 0 and 100 percent'));
  }

  next();
});

const JobType = mongoose.model('JobType', jobTypeSchema);

export default JobType;
