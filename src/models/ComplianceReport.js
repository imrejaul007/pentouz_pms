import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     ComplianceReport:
 *       type: object
 *       required:
 *         - hotelId
 *         - reportType
 *         - reportDate
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         reportType:
 *           type: string
 *           enum: [fda, health_department, fire_safety, environmental, osha, general]
 *         reportDate:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [compliant, non_compliant, pending_review, needs_attention]
 *         overallScore:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 */

const complianceReportSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  reportType: {
    type: String,
    enum: {
      values: [
        'fda',               // Food and Drug Administration
        'health_department', // Local Health Department
        'fire_safety',       // Fire Safety Compliance
        'environmental',     // Environmental Regulations
        'osha',             // Occupational Safety and Health
        'general',          // General Hotel Compliance
        'iso',              // ISO Standards
        'haccp',            // Hazard Analysis Critical Control Points
        'allergen',         // Allergen Management
        'chemical_safety'   // Chemical Storage and Handling
      ],
      message: 'Invalid report type'
    },
    required: [true, 'Report type is required'],
    index: true
  },
  reportDate: {
    type: Date,
    required: [true, 'Report date is required'],
    default: Date.now,
    index: true
  },
  reportPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'ad_hoc'],
      default: 'monthly'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['compliant', 'non_compliant', 'pending_review', 'needs_attention', 'partial_compliance'],
      message: 'Invalid compliance status'
    },
    default: 'pending_review',
    index: true
  },
  overallScore: {
    type: Number,
    min: 0,
    max: 100,
    description: 'Overall compliance score percentage'
  },
  inspector: {
    name: {
      type: String,
      trim: true
    },
    agency: {
      type: String,
      trim: true
    },
    licenseNumber: {
      type: String,
      trim: true
    },
    contact: {
      email: String,
      phone: String
    },
    isExternal: {
      type: Boolean,
      default: false
    }
  },
  regulatoryFramework: {
    jurisdiction: {
      type: String,
      required: true,
      description: 'Federal, State, County, City'
    },
    regulations: [{
      code: {
        type: String,
        required: true
      },
      title: {
        type: String,
        required: true
      },
      version: String,
      effectiveDate: Date,
      applicableAreas: [String]
    }],
    certifications: [{
      name: {
        type: String,
        required: true
      },
      number: String,
      issuedBy: String,
      issuedDate: Date,
      expiryDate: Date,
      status: {
        type: String,
        enum: ['active', 'expired', 'pending_renewal', 'suspended'],
        default: 'active'
      },
      renewalRequired: Boolean,
      documents: [{
        name: String,
        url: String,
        uploadDate: Date
      }]
    }]
  },
  complianceAreas: [{
    area: {
      type: String,
      required: true,
      enum: [
        'food_safety',
        'chemical_storage',
        'fire_safety',
        'electrical_safety',
        'water_quality',
        'waste_management',
        'allergen_control',
        'temperature_control',
        'hygiene_standards',
        'documentation',
        'staff_training',
        'equipment_maintenance',
        'inventory_tracking',
        'supplier_verification'
      ]
    },
    description: {
      type: String,
      required: true
    },
    requirements: [{
      code: String,
      description: String,
      mandatory: Boolean,
      frequency: String,
      lastChecked: Date,
      nextDue: Date,
      responsible: String
    }],
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    status: {
      type: String,
      enum: ['compliant', 'non_compliant', 'needs_improvement', 'not_applicable'],
      default: 'compliant'
    },
    findings: [{
      type: {
        type: String,
        enum: ['violation', 'observation', 'recommendation', 'best_practice']
      },
      severity: {
        type: String,
        enum: ['critical', 'major', 'minor', 'informational'],
        required: true
      },
      description: {
        type: String,
        required: true
      },
      location: String,
      regulationCode: String,
      correctiveAction: {
        required: Boolean,
        description: String,
        deadline: Date,
        assignedTo: {
          type: mongoose.Schema.ObjectId,
          ref: 'User'
        },
        status: {
          type: String,
          enum: ['pending', 'in_progress', 'completed', 'overdue'],
          default: 'pending'
        },
        completedDate: Date,
        verifiedBy: {
          type: mongoose.Schema.ObjectId,
          ref: 'User'
        }
      },
      evidence: [{
        type: String,
        url: String,
        description: String,
        capturedDate: Date
      }],
      riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      recurrence: {
        isPrevious: Boolean,
        lastOccurrence: Date,
        frequency: Number
      }
    }],
    inventoryItems: [{
      itemId: {
        type: mongoose.Schema.ObjectId,
        ref: 'InventoryItem'
      },
      complianceStatus: String,
      lastInspected: Date,
      certifications: [String],
      issues: [String]
    }]
  }],
  documentation: {
    requiredDocuments: [{
      name: {
        type: String,
        required: true
      },
      description: String,
      category: {
        type: String,
        enum: ['certification', 'policy', 'procedure', 'training', 'inspection', 'maintenance']
      },
      isRequired: Boolean,
      status: {
        type: String,
        enum: ['current', 'expired', 'missing', 'pending_review'],
        default: 'missing'
      },
      document: {
        filename: String,
        url: String,
        uploadDate: Date,
        expiryDate: Date,
        version: String,
        size: Number
      },
      lastReviewed: Date,
      reviewedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    }],
    auditTrail: [{
      action: String,
      performedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      details: String,
      documentAffected: String
    }]
  },
  training: {
    requiredTraining: [{
      name: {
        type: String,
        required: true
      },
      description: String,
      frequency: String,
      applicableRoles: [String],
      certificationRequired: Boolean,
      provider: String,
      duration: Number, // in hours
      expiryPeriod: Number // in days
    }],
    completionStatus: [{
      trainingId: String,
      staffMember: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      completedDate: Date,
      expiryDate: Date,
      certificateNumber: String,
      score: Number,
      status: {
        type: String,
        enum: ['completed', 'expired', 'pending', 'in_progress'],
        default: 'pending'
      }
    }],
    complianceRate: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  riskAssessment: {
    overallRiskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    riskFactors: [{
      factor: String,
      impact: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      probability: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      mitigation: String,
      responsible: String,
      deadline: Date
    }],
    contingencyPlans: [{
      scenario: String,
      response: String,
      contacts: [String],
      resources: [String]
    }]
  },
  recommendations: [{
    category: {
      type: String,
      enum: ['immediate', 'short_term', 'long_term', 'strategic']
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    rationale: String,
    estimatedCost: Number,
    estimatedTimeframe: String,
    expectedBenefit: String,
    assignedTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'in_progress', 'completed', 'rejected'],
      default: 'pending'
    },
    implementationDate: Date,
    completionDate: Date
  }],
  followUp: {
    nextInspectionDate: Date,
    reinspectionRequired: Boolean,
    monitoringSchedule: [{
      area: String,
      frequency: String,
      responsible: String,
      nextCheck: Date
    }],
    reminders: [{
      type: String,
      description: String,
      dueDate: Date,
      completed: Boolean
    }]
  },
  approval: {
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'rejected'],
      default: 'draft'
    },
    submittedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    submittedDate: Date,
    approvedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    approvalDate: Date,
    comments: [String],
    rejectionReason: String
  },
  notifications: {
    stakeholders: [{
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      role: String,
      notificationType: [String],
      emailSent: Boolean,
      readStatus: Boolean
    }],
    externalReporting: [{
      agency: String,
      reportSubmitted: Boolean,
      submissionDate: Date,
      confirmationNumber: String,
      status: String
    }]
  },
  metadata: {
    version: {
      type: String,
      default: '1.0'
    },
    generatedBy: {
      type: String,
      enum: ['system', 'manual', 'inspection'],
      default: 'system'
    },
    dataSource: [String],
    lastModified: {
      type: Date,
      default: Date.now
    },
    modifiedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    exportFormats: [{
      format: String,
      exported: Boolean,
      exportDate: Date,
      exportedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
complianceReportSchema.index({ hotelId: 1, reportDate: -1 });
complianceReportSchema.index({ hotelId: 1, reportType: 1, reportDate: -1 });
complianceReportSchema.index({ hotelId: 1, status: 1 });
complianceReportSchema.index({ 'followUp.nextInspectionDate': 1 });
complianceReportSchema.index({ 'complianceAreas.findings.correctiveAction.deadline': 1 });
complianceReportSchema.index({ 'regulatoryFramework.certifications.expiryDate': 1 });

// Virtual for days until next inspection
complianceReportSchema.virtual('daysUntilNextInspection').get(function() {
  if (!this.followUp?.nextInspectionDate) return null;
  const now = new Date();
  const diffTime = this.followUp.nextInspectionDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for critical findings count
complianceReportSchema.virtual('criticalFindingsCount').get(function() {
  return this.complianceAreas.reduce((count, area) =>
    count + area.findings.filter(finding => finding.severity === 'critical').length, 0
  );
});

// Virtual for pending corrective actions
complianceReportSchema.virtual('pendingCorrectiveActions').get(function() {
  const actions = [];
  this.complianceAreas.forEach(area => {
    area.findings.forEach(finding => {
      if (finding.correctiveAction?.status === 'pending' || finding.correctiveAction?.status === 'in_progress') {
        actions.push({
          area: area.area,
          description: finding.correctiveAction.description,
          deadline: finding.correctiveAction.deadline,
          severity: finding.severity
        });
      }
    });
  });
  return actions;
});

// Pre-save middleware
complianceReportSchema.pre('save', function(next) {
  // Calculate overall score from area scores
  if (this.complianceAreas && this.complianceAreas.length > 0) {
    const totalScore = this.complianceAreas.reduce((sum, area) => sum + (area.score || 0), 0);
    this.overallScore = Math.round(totalScore / this.complianceAreas.length);
  }

  // Determine overall status based on findings
  const criticalFindings = this.complianceAreas.reduce((count, area) =>
    count + area.findings.filter(finding => finding.severity === 'critical').length, 0
  );

  const majorFindings = this.complianceAreas.reduce((count, area) =>
    count + area.findings.filter(finding => finding.severity === 'major').length, 0
  );

  if (criticalFindings > 0) {
    this.status = 'non_compliant';
  } else if (majorFindings > 0) {
    this.status = 'needs_attention';
  } else if (this.overallScore >= 85) {
    this.status = 'compliant';
  } else {
    this.status = 'partial_compliance';
  }

  // Update last modified
  this.metadata.lastModified = new Date();

  next();
});

// Static method to create FDA compliance report
complianceReportSchema.statics.createFDAReport = async function(hotelId) {
  const InventoryItem = mongoose.model('InventoryItem');

  // Get food-related inventory items
  const foodItems = await InventoryItem.find({
    hotelId,
    category: { $in: ['minibar', 'amenities'] },
    isActive: true
  });

  const complianceAreas = [
    {
      area: 'food_safety',
      description: 'Food storage and handling compliance',
      requirements: [
        {
          code: 'FDA-21CFR117',
          description: 'Preventive Controls for Human Food',
          mandatory: true,
          frequency: 'daily'
        }
      ],
      score: 95,
      status: 'compliant',
      findings: [],
      inventoryItems: foodItems.map(item => ({
        itemId: item._id,
        complianceStatus: 'compliant',
        lastInspected: new Date(),
        certifications: ['FDA-approved']
      }))
    },
    {
      area: 'temperature_control',
      description: 'Temperature monitoring for perishables',
      requirements: [
        {
          code: 'HACCP-CCP',
          description: 'Critical Control Points monitoring',
          mandatory: true,
          frequency: 'continuous'
        }
      ],
      score: 90,
      status: 'compliant',
      findings: []
    }
  ];

  return await this.create({
    hotelId,
    reportType: 'fda',
    reportPeriod: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      frequency: 'monthly'
    },
    inspector: {
      name: 'System Generated',
      agency: 'Internal Compliance',
      isExternal: false
    },
    regulatoryFramework: {
      jurisdiction: 'Federal',
      regulations: [
        {
          code: '21 CFR 117',
          title: 'Current Good Manufacturing Practice, Hazard Analysis, and Risk-Based Preventive Controls for Human Food',
          effectiveDate: new Date('2015-09-17')
        }
      ]
    },
    complianceAreas,
    training: {
      requiredTraining: [
        {
          name: 'Food Safety Certification',
          description: 'Basic food safety and handling training',
          frequency: 'annually',
          applicableRoles: ['kitchen_staff', 'housekeeping'],
          certificationRequired: true,
          duration: 8,
          expiryPeriod: 365
        }
      ],
      complianceRate: 95
    },
    followUp: {
      nextInspectionDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      reinspectionRequired: false
    }
  });
};

// Static method to create health department report
complianceReportSchema.statics.createHealthDepartmentReport = async function(hotelId) {
  const complianceAreas = [
    {
      area: 'hygiene_standards',
      description: 'Guest room hygiene and cleanliness standards',
      score: 92,
      status: 'compliant',
      findings: []
    },
    {
      area: 'water_quality',
      description: 'Water quality testing and monitoring',
      score: 88,
      status: 'compliant',
      findings: []
    },
    {
      area: 'waste_management',
      description: 'Proper waste disposal and recycling',
      score: 85,
      status: 'compliant',
      findings: []
    }
  ];

  return await this.create({
    hotelId,
    reportType: 'health_department',
    reportPeriod: {
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      frequency: 'quarterly'
    },
    complianceAreas,
    followUp: {
      nextInspectionDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    }
  });
};

// Static method to get expiring certifications
complianceReportSchema.statics.getExpiringCertifications = async function(hotelId, daysAhead = 30) {
  const cutoffDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

  return await this.find({
    hotelId,
    'regulatoryFramework.certifications.expiryDate': { $lte: cutoffDate },
    'regulatoryFramework.certifications.status': 'active'
  })
  .select('regulatoryFramework.certifications reportType')
  .lean();
};

// Static method to get overdue corrective actions
complianceReportSchema.statics.getOverdueCorrectiveActions = async function(hotelId) {
  const now = new Date();

  return await this.find({
    hotelId,
    'complianceAreas.findings.correctiveAction.deadline': { $lt: now },
    'complianceAreas.findings.correctiveAction.status': { $in: ['pending', 'in_progress'] }
  })
  .populate('complianceAreas.findings.correctiveAction.assignedTo', 'name email')
  .lean();
};

// Instance method to add finding
complianceReportSchema.methods.addFinding = function(areaName, finding) {
  const area = this.complianceAreas.find(a => a.area === areaName);
  if (area) {
    area.findings.push(finding);
    return this.save();
  }
  throw new Error(`Compliance area '${areaName}' not found`);
};

// Instance method to complete corrective action
complianceReportSchema.methods.completeCorrectiveAction = function(findingId, completedBy) {
  this.complianceAreas.forEach(area => {
    const finding = area.findings.id(findingId);
    if (finding && finding.correctiveAction) {
      finding.correctiveAction.status = 'completed';
      finding.correctiveAction.completedDate = new Date();
      finding.correctiveAction.verifiedBy = completedBy;
    }
  });
  return this.save();
};

export default mongoose.model('ComplianceReport', complianceReportSchema);
