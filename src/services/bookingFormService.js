import BookingFormTemplate from '../models/BookingFormTemplate.js';
import Booking from '../models/Booking.js';
import AuditLog from '../models/AuditLog.js';
import mongoose from 'mongoose';

class BookingFormService {
  /**
   * Create a new booking form template
   */
  async createTemplate(templateData, userId) {
    try {
      const template = new BookingFormTemplate({
        ...templateData,
        createdBy: userId
      });

      await template.save();

      // Log template creation
      try {
        await AuditLog.logFormAction(template, 'template_created', userId, {
          source: 'booking_form_service',
          templateData: {
            name: template.name,
            category: template.category,
            fieldCount: template.fieldCount
          }
        });
      } catch (auditError) {
        console.warn('Failed to log form action:', auditError.message);
        // Don't fail the main operation if audit logging fails
      }

      return template;
    } catch (error) {
      console.error('Error creating form template:', error);
      throw error;
    }
  }

  /**
   * Update booking form template
   */
  async updateTemplate(templateId, updateData, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const template = await BookingFormTemplate.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Create backup before update
      const backup = {
        templateId: template._id,
        version: template.version,
        data: template.toObject(),
        updatedBy: userId,
        updatedAt: new Date()
      };

      // Update template
      Object.assign(template, updateData);
      template.updatedBy = userId;
      template.updatedAt = new Date();

      await template.save({ session });

      // Log template update
      try {
        await AuditLog.logFormAction(template, 'template_updated', userId, {
          source: 'booking_form_service',
          backup: backup,
          changes: updateData
        });
      } catch (auditError) {
        console.warn('Failed to log form action:', auditError.message);
      }

      await session.commitTransaction();
      return template;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Duplicate template
   */
  async duplicateTemplate(templateId, newName, userId) {
    try {
      const originalTemplate = await BookingFormTemplate.findById(templateId);
      if (!originalTemplate) {
        throw new Error('Template not found');
      }

      const duplicateData = originalTemplate.toObject();
      delete duplicateData._id;
      delete duplicateData.createdAt;
      delete duplicateData.updatedAt;
      delete duplicateData.__v;

      const newTemplate = new BookingFormTemplate({
        ...duplicateData,
        name: newName,
        status: 'draft',
        isPublished: false,
        publishedAt: null,
        version: '1.0.0',
        parentVersion: originalTemplate._id,
        createdBy: userId,
        usage: {
          views: 0,
          submissions: 0,
          conversionRate: 0
        }
      });

      await newTemplate.save();

      try {
        await AuditLog.logFormAction(newTemplate, 'template_duplicated', userId, {
          source: 'booking_form_service',
          originalTemplateId: templateId,
          originalTemplateName: originalTemplate.name
        });
      } catch (auditError) {
        console.warn('Failed to log form action:', auditError.message);
      }

      return newTemplate;
    } catch (error) {
      console.error('Error duplicating template:', error);
      throw error;
    }
  }

  /**
   * Process form submission
   */
  async processSubmission(templateId, submissionData, userInfo = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const template = await BookingFormTemplate.findById(templateId);
      if (!template) {
        throw new Error('Form template not found');
      }

      if (!template.isPublished) {
        throw new Error('Form is not published');
      }

      // Validate submission data against template
      const validationErrors = template.validateForm(submissionData);
      if (validationErrors.length > 0) {
        return {
          success: false,
          errors: validationErrors,
          message: 'Validation failed'
        };
      }

      // Process conditional logic
      const processedData = this.processConditionalLogic(submissionData, template.fields);

      // Create booking from form data
      const bookingData = this.mapFormDataToBooking(processedData, template);
      
      let booking = null;
      if (template.settings.saveToDatabase) {
        booking = new Booking({
          ...bookingData,
          source: 'web_form',
          formTemplateId: templateId,
          status: template.settings.requiresApproval ? 'pending_approval' : 'confirmed'
        });

        await booking.save({ session });
      }

      // Send email notifications
      if (template.settings.emailNotifications.enabled) {
        await this.sendNotificationEmails(template, processedData, booking);
      }

      // Send auto-responder
      if (template.settings.autoResponder.enabled && processedData.email) {
        await this.sendAutoResponder(template, processedData);
      }

      // Update template usage statistics
      await template.incrementSubmissions();

      // Log form submission
      try {
        await AuditLog.logFormAction(template, 'form_submitted', null, {
          source: 'booking_form_service',
          submissionData: processedData,
          bookingId: booking?._id,
          userInfo
        });
      } catch (auditError) {
        console.warn('Failed to log form action:', auditError.message);
      }

      await session.commitTransaction();

      return {
        success: true,
        message: template.settings.successMessage,
        bookingId: booking?._id,
        redirectUrl: template.settings.redirectUrl
      };

    } catch (error) {
      await session.abortTransaction();
      console.error('Error processing form submission:', error);
      return {
        success: false,
        message: 'Failed to process form submission',
        error: error.message
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Process conditional logic in form data
   */
  processConditionalLogic(formData, fields) {
    const processedData = { ...formData };

    fields.forEach(field => {
      if (field.conditionalLogic && field.conditionalLogic.length > 0) {
        field.conditionalLogic.forEach(logic => {
          const conditionMet = this.evaluateCondition(logic.condition, processedData);
          
          if (conditionMet) {
            switch (logic.action.type) {
              case 'set_value':
                processedData[logic.action.target] = logic.action.value;
                break;
              case 'set_required':
                // This would be handled during validation
                break;
            }
          }
        });
      }
    });

    return processedData;
  }

  /**
   * Evaluate conditional logic condition
   */
  evaluateCondition(condition, formData) {
    const fieldValue = formData[condition.field];
    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'not_equals':
        return fieldValue !== conditionValue;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue);
      case 'less_than':
        return Number(fieldValue) < Number(conditionValue);
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
      default:
        return false;
    }
  }

  /**
   * Map form data to booking model
   */
  mapFormDataToBooking(formData, template) {
    const bookingData = {
      hotelId: template.hotelId,
      source: 'web_form'
    };

    // Standard field mappings
    const fieldMappings = {
      check_in: 'checkIn',
      check_out: 'checkOut',
      guests: 'guestCount',
      room_type: 'roomType',
      first_name: 'guestDetails.firstName',
      last_name: 'guestDetails.lastName',
      email: 'guestDetails.email',
      phone: 'guestDetails.phone',
      special_requests: 'specialRequests'
    };

    // Apply field mappings
    Object.keys(fieldMappings).forEach(formField => {
      if (formData[formField]) {
        const bookingPath = fieldMappings[formField];
        this.setNestedValue(bookingData, bookingPath, formData[formField]);
      }
    });

    // Apply custom PMS mappings from template
    if (template.integrations?.pms?.enabled && template.integrations.pms.mapping) {
      template.integrations.pms.mapping.forEach((bookingField, formField) => {
        if (formData[formField]) {
          this.setNestedValue(bookingData, bookingField, formData[formField]);
        }
      });
    }

    return bookingData;
  }

  /**
   * Set nested object value using dot notation
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Send notification emails
   */
  async sendNotificationEmails(template, formData, booking) {
    try {
      // This would integrate with your email service
      const emailData = {
        to: template.settings.emailNotifications.recipientEmails,
        subject: template.settings.emailNotifications.subject || 'New Booking Form Submission',
        template: 'booking_form_notification',
        data: {
          formData,
          booking,
          template: template.name,
          hotelName: template.hotelId // You might want to populate this
        }
      };

      // Send email (integrate with your email service)
      console.log('Sending notification email:', emailData);
    } catch (error) {
      console.error('Error sending notification emails:', error);
    }
  }

  /**
   * Send auto-responder email
   */
  async sendAutoResponder(template, formData) {
    try {
      const emailData = {
        to: formData.email,
        subject: template.settings.autoResponder.subject || 'Thank you for your booking request',
        template: 'booking_form_autoresponder',
        data: {
          formData,
          template: template.name,
          message: template.settings.autoResponder.template
        }
      };

      // Send email (integrate with your email service)
      console.log('Sending auto-responder email:', emailData);
    } catch (error) {
      console.error('Error sending auto-responder:', error);
    }
  }

  /**
   * Generate form HTML/JSON for rendering
   */
  async generateFormStructure(templateId, language = 'en') {
    try {
      const template = await BookingFormTemplate.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      if (!template.isPublished) {
        throw new Error('Template is not published');
      }

      // Increment views
      await template.incrementViews();

      // Generate form structure
      const formStructure = {
        id: template._id,
        name: template.name,
        description: template.description,
        fields: this.processFieldsForLanguage(template.fields, language),
        styling: template.styling,
        settings: {
          submitButtonText: this.getLocalizedText(template.settings.submitButtonText, template.languages, language),
          successMessage: this.getLocalizedText(template.settings.successMessage, template.languages, language),
          errorMessage: this.getLocalizedText(template.settings.errorMessage, template.languages, language),
          requireCaptcha: template.settings.requireCaptcha
        },
        metadata: template.metadata
      };

      return formStructure;
    } catch (error) {
      console.error('Error generating form structure:', error);
      throw error;
    }
  }

  /**
   * Process fields for specific language
   */
  processFieldsForLanguage(fields, language) {
    return fields.map(field => {
      const processedField = { ...field };

      if (field.translations && field.translations.has(language)) {
        const translation = field.translations.get(language);
        if (translation.label) processedField.label = translation.label;
        if (translation.placeholder) processedField.placeholder = translation.placeholder;
        if (translation.helpText) processedField.helpText = translation.helpText;
        if (translation.options) processedField.options = translation.options;
      }

      return processedField;
    });
  }

  /**
   * Get localized text
   */
  getLocalizedText(defaultText, languages, targetLanguage) {
    if (!languages || languages.length === 0) return defaultText;

    const languageConfig = languages.find(lang => lang.code === targetLanguage);
    return languageConfig?.settings?.[defaultText] || defaultText;
  }

  /**
   * Get form analytics
   */
  async getFormAnalytics(templateId, dateRange = {}) {
    try {
      const template = await BookingFormTemplate.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Basic analytics from template
      const basicAnalytics = {
        views: template.usage.views,
        submissions: template.usage.submissions,
        conversionRate: template.calculatedConversionRate,
        lastUsed: template.usage.lastUsed
      };

      // Enhanced analytics from audit logs (if date range specified)
      let detailedAnalytics = {};
      if (dateRange.startDate && dateRange.endDate) {
        const logs = await AuditLog.find({
          'metadata.templateId': templateId,
          action: { $in: ['form_viewed', 'form_submitted'] },
          createdAt: {
            $gte: new Date(dateRange.startDate),
            $lte: new Date(dateRange.endDate)
          }
        }).sort({ createdAt: -1 });

        detailedAnalytics = this.processAnalyticsLogs(logs);
      }

      return {
        ...basicAnalytics,
        ...detailedAnalytics,
        template: {
          id: template._id,
          name: template.name,
          category: template.category,
          status: template.status
        }
      };
    } catch (error) {
      console.error('Error getting form analytics:', error);
      throw error;
    }
  }

  /**
   * Process analytics logs for detailed insights
   */
  processAnalyticsLogs(logs) {
    const analytics = {
      dailyViews: {},
      dailySubmissions: {},
      hourlyDistribution: {},
      deviceTypes: {},
      locations: {},
      abandonmentPoints: {}
    };

    logs.forEach(log => {
      const date = log.createdAt.toISOString().split('T')[0];
      const hour = log.createdAt.getHours();

      if (log.action === 'form_viewed') {
        analytics.dailyViews[date] = (analytics.dailyViews[date] || 0) + 1;
      } else if (log.action === 'form_submitted') {
        analytics.dailySubmissions[date] = (analytics.dailySubmissions[date] || 0) + 1;
      }

      analytics.hourlyDistribution[hour] = (analytics.hourlyDistribution[hour] || 0) + 1;

      // Process additional metadata if available
      if (log.metadata.userInfo) {
        const userInfo = log.metadata.userInfo;
        if (userInfo.deviceType) {
          analytics.deviceTypes[userInfo.deviceType] = (analytics.deviceTypes[userInfo.deviceType] || 0) + 1;
        }
        if (userInfo.location) {
          analytics.locations[userInfo.location] = (analytics.locations[userInfo.location] || 0) + 1;
        }
      }
    });

    return analytics;
  }

  /**
   * A/B test management
   */
  async createABTest(templateId, testConfig, userId) {
    try {
      const template = await BookingFormTemplate.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      template.abTest = {
        isEnabled: true,
        testName: testConfig.testName,
        variants: testConfig.variants,
        startDate: new Date(testConfig.startDate),
        endDate: new Date(testConfig.endDate)
      };

      await template.save();

      try {
        await AuditLog.logFormAction(template, 'ab_test_created', userId, {
          source: 'booking_form_service',
          testConfig
        });
      } catch (auditError) {
        console.warn('Failed to log form action:', auditError.message);
      }

      return template;
    } catch (error) {
      console.error('Error creating A/B test:', error);
      throw error;
    }
  }

  /**
   * Get A/B test variant for user
   */
  getABTestVariant(template, userInfo = {}) {
    if (!template.abTest?.isEnabled || !template.abTest.variants.length) {
      return null; // Use default template
    }

    const now = new Date();
    if (now < template.abTest.startDate || now > template.abTest.endDate) {
      return null; // Test not active
    }

    // Simple random selection based on percentages
    const random = Math.random() * 100;
    let cumulativePercentage = 0;

    for (const variant of template.abTest.variants) {
      cumulativePercentage += variant.percentage;
      if (random <= cumulativePercentage) {
        return variant;
      }
    }

    return null; // Fallback to default
  }

  /**
   * Export form submissions
   */
  async exportSubmissions(templateId, format = 'json', dateRange = {}) {
    try {
      const query = {
        formTemplateId: templateId
      };

      if (dateRange.startDate && dateRange.endDate) {
        query.createdAt = {
          $gte: new Date(dateRange.startDate),
          $lte: new Date(dateRange.endDate)
        };
      }

      const submissions = await Booking.find(query)
        .populate('hotelId', 'name')
        .sort({ createdAt: -1 });

      if (format === 'csv') {
        return this.convertToCSV(submissions);
      }

      return submissions;
    } catch (error) {
      console.error('Error exporting form submissions:', error);
      throw error;
    }
  }

  /**
   * Convert submissions to CSV format
   */
  convertToCSV(submissions) {
    if (!submissions.length) return '';

    const headers = [
      'Submission Date', 'Check-in', 'Check-out', 'Guest Count',
      'First Name', 'Last Name', 'Email', 'Phone', 'Special Requests'
    ];

    const rows = submissions.map(submission => [
      submission.createdAt.toISOString(),
      submission.checkIn?.toISOString().split('T')[0] || '',
      submission.checkOut?.toISOString().split('T')[0] || '',
      submission.guestCount || '',
      submission.guestDetails?.firstName || '',
      submission.guestDetails?.lastName || '',
      submission.guestDetails?.email || '',
      submission.guestDetails?.phone || '',
      submission.specialRequests || ''
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }
}

export default new BookingFormService();