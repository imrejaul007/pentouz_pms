import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     GuestCustomData:
 *       type: object
 *       required:
 *         - guestId
 *         - fieldId
 *         - value
 *       properties:
 *         _id:
 *           type: string
 *           description: Custom data entry ID
 *         guestId:
 *           type: string
 *           description: Reference to guest user
 *         fieldId:
 *           type: string
 *           description: Reference to custom field
 *         value:
 *           type: string
 *           description: Field value (stored as string, converted based on field type)
 *         rawValue:
 *           type: mixed
 *           description: Raw value for complex data types
 *         isActive:
 *           type: boolean
 *           description: Whether the data entry is active
 *         lastUpdatedBy:
 *           type: string
 *           description: User who last updated the data
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const guestCustomDataSchema = new mongoose.Schema({
  guestId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Guest ID is required']
  },
  fieldId: {
    type: mongoose.Schema.ObjectId,
    ref: 'CustomField',
    required: [true, 'Field ID is required']
  },
  value: {
    type: String,
    required: [true, 'Field value is required'],
    maxlength: [1000, 'Value cannot be more than 1000 characters']
  },
  rawValue: {
    type: mongoose.Schema.Types.Mixed
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
guestCustomDataSchema.index({ guestId: 1, fieldId: 1 }, { unique: true });
guestCustomDataSchema.index({ guestId: 1, hotelId: 1 });
guestCustomDataSchema.index({ fieldId: 1, hotelId: 1 });
guestCustomDataSchema.index({ hotelId: 1, isActive: 1 });

// Pre-save middleware to set updatedBy
guestCustomDataSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastUpdatedBy = this.lastUpdatedBy; // This will be updated by controller
  }
  next();
});

// Virtual for guest details
guestCustomDataSchema.virtual('guest', {
  ref: 'User',
  localField: 'guestId',
  foreignField: '_id',
  justOne: true
});

// Virtual for field details
guestCustomDataSchema.virtual('field', {
  ref: 'CustomField',
  localField: 'fieldId',
  foreignField: '_id',
  justOne: true
});

// Virtual for updater details
guestCustomDataSchema.virtual('updater', {
  ref: 'User',
  localField: 'lastUpdatedBy',
  foreignField: '_id',
  justOne: true
});

// Static method to get guest custom data
guestCustomDataSchema.statics.getGuestCustomData = async function(guestId, hotelId) {
  return await this.find({
    guestId: new mongoose.Types.ObjectId(guestId),
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isActive: true
  }).populate('fieldId', 'name label type category validation defaultValue');
};

// Static method to get field usage statistics
guestCustomDataSchema.statics.getFieldUsageStats = async function(fieldId, hotelId) {
  const stats = await this.aggregate([
    {
      $match: {
        fieldId: new mongoose.Types.ObjectId(fieldId),
        hotelId: new mongoose.Types.ObjectId(hotelId),
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        nonEmptyEntries: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$value', ''] }, { $ne: ['$value', null] }] },
              1,
              0
            ]
          }
        },
        uniqueValues: { $addToSet: '$value' }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalEntries: 0,
      nonEmptyEntries: 0,
      completionRate: 0,
      uniqueValueCount: 0
    };
  }

  const result = stats[0];
  const completionRate = result.totalEntries > 0 
    ? (result.nonEmptyEntries / result.totalEntries) * 100 
    : 0;

  return {
    totalEntries: result.totalEntries,
    nonEmptyEntries: result.nonEmptyEntries,
    completionRate: Math.round(completionRate * 100) / 100,
    uniqueValueCount: result.uniqueValues.length
  };
};

// Static method to get guest data by category
guestCustomDataSchema.statics.getGuestDataByCategory = async function(guestId, hotelId, category) {
  return await this.find({
    guestId: new mongoose.Types.ObjectId(guestId),
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isActive: true
  }).populate({
    path: 'fieldId',
    match: { category: category },
    select: 'name label type category validation defaultValue'
  });
};

// Static method to bulk update guest data
guestCustomDataSchema.statics.bulkUpdateGuestData = async function(guestId, hotelId, dataUpdates, updatedBy) {
  const operations = [];
  
  for (const [fieldId, value] of Object.entries(dataUpdates)) {
    operations.push({
      updateOne: {
        filter: {
          guestId: new mongoose.Types.ObjectId(guestId),
          fieldId: new mongoose.Types.ObjectId(fieldId),
          hotelId: new mongoose.Types.ObjectId(hotelId)
        },
        update: {
          $set: {
            value: value.toString(),
            rawValue: value,
            lastUpdatedBy: updatedBy,
            updatedAt: new Date()
          }
        },
        upsert: true
      }
    });
  }

  if (operations.length > 0) {
    return await this.bulkWrite(operations);
  }
  
  return { modifiedCount: 0, upsertedCount: 0 };
};

// Static method to get data analytics
guestCustomDataSchema.statics.getDataAnalytics = async function(hotelId, options = {}) {
  const { category, fieldType, dateRange } = options;
  
  const matchStage = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isActive: true
  };

  if (dateRange && dateRange.start && dateRange.end) {
    matchStage.createdAt = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end)
    };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'customfields',
        localField: 'fieldId',
        foreignField: '_id',
        as: 'field'
      }
    },
    { $unwind: '$field' }
  ];

  if (category) {
    pipeline.push({ $match: { 'field.category': category } });
  }

  if (fieldType) {
    pipeline.push({ $match: { 'field.type': fieldType } });
  }

  pipeline.push({
    $group: {
      _id: null,
      totalEntries: { $sum: 1 },
      nonEmptyEntries: {
        $sum: {
          $cond: [
            { $and: [{ $ne: ['$value', ''] }, { $ne: ['$value', null] }] },
            1,
            0
          ]
        }
      },
      byCategory: {
        $push: {
          category: '$field.category',
          hasValue: { $and: [{ $ne: ['$value', ''] }, { $ne: ['$value', null] }] }
        }
      },
      byType: {
        $push: {
          type: '$field.type',
          hasValue: { $and: [{ $ne: ['$value', ''] }, { $ne: ['$value', null] }] }
        }
      }
    }
  });

  const stats = await this.aggregate(pipeline);

  if (stats.length === 0) {
    return {
      totalEntries: 0,
      nonEmptyEntries: 0,
      completionRate: 0,
      byCategory: {},
      byType: {}
    };
  }

  const result = stats[0];
  const completionRate = result.totalEntries > 0 
    ? (result.nonEmptyEntries / result.totalEntries) * 100 
    : 0;

  // Calculate category breakdown
  const categoryStats = {};
  result.byCategory.forEach(item => {
    if (!categoryStats[item.category]) {
      categoryStats[item.category] = { total: 0, completed: 0 };
    }
    categoryStats[item.category].total++;
    if (item.hasValue) {
      categoryStats[item.category].completed++;
    }
  });

  // Calculate type breakdown
  const typeStats = {};
  result.byType.forEach(item => {
    if (!typeStats[item.type]) {
      typeStats[item.type] = { total: 0, completed: 0 };
    }
    typeStats[item.type].total++;
    if (item.hasValue) {
      typeStats[item.type].completed++;
    }
  });

  return {
    totalEntries: result.totalEntries,
    nonEmptyEntries: result.nonEmptyEntries,
    completionRate: Math.round(completionRate * 100) / 100,
    byCategory: categoryStats,
    byType: typeStats
  };
};

// Instance method to convert value based on field type
guestCustomDataSchema.methods.convertValue = function(fieldType) {
  if (!this.value) return null;

  switch (fieldType) {
    case 'number':
      return parseFloat(this.value);
    case 'date':
      return new Date(this.value);
    case 'checkbox':
      return this.value === 'true';
    case 'multiselect':
      try {
        return JSON.parse(this.value);
      } catch {
        return this.value.split(',');
      }
    default:
      return this.value;
  }
};

// Instance method to set value with type conversion
guestCustomDataSchema.methods.setValue = function(value, fieldType) {
  let stringValue = '';
  let rawValue = value;

  switch (fieldType) {
    case 'number':
      stringValue = value.toString();
      rawValue = parseFloat(value);
      break;
    case 'date':
      stringValue = new Date(value).toISOString();
      rawValue = new Date(value);
      break;
    case 'checkbox':
      stringValue = value ? 'true' : 'false';
      rawValue = Boolean(value);
      break;
    case 'multiselect':
      if (Array.isArray(value)) {
        stringValue = JSON.stringify(value);
        rawValue = value;
      } else {
        stringValue = value.toString();
        rawValue = value;
      }
      break;
    default:
      stringValue = value.toString();
      rawValue = value;
  }

  this.value = stringValue;
  this.rawValue = rawValue;
};

export default mongoose.model('GuestCustomData', guestCustomDataSchema);
