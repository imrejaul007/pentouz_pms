import BookingFormTemplate from '../models/BookingFormTemplate.js';
import bookingFormService from '../services/bookingFormService.js';
import { validationResult } from 'express-validator';

const bookingFormController = {
  async createTemplate(req, res) {
    console.log('📋 BookingForm createTemplate called');
    console.log('🔍 Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User info:', req.user ? {
      id: req.user.id,
      hotelId: req.user.hotelId,
      role: req.user.role,
      name: req.user.name
    } : 'No user');
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      if (!req.user || !req.user.hotelId) {
        console.log('❌ Authentication failed - missing user or hotelId');
        return res.status(401).json({
          success: false,
          error: 'User authentication failed - missing hotel ID'
        });
      }

      const templateData = {
        ...req.body,
        hotelId: req.user.hotelId,
        createdBy: req.user.id,
        updatedBy: req.user.id
      };

      console.log('📝 Template data to save:', JSON.stringify(templateData, null, 2));

      // Test template validation before saving
      const template = new BookingFormTemplate(templateData);
      console.log('✅ BookingFormTemplate instance created');
      
      // Run validation manually to see detailed errors
      const validationError = template.validateSync();
      if (validationError) {
        console.log('🔴 Manual validation failed:', validationError);
        throw validationError;
      }
      console.log('✅ Manual validation passed');
      
      await template.save();
      console.log('💾 Template saved successfully');

      res.status(201).json({
        success: true,
        data: template,
        message: 'Form template created successfully'
      });
    } catch (error) {
      console.error('💥 DETAILED ERROR in createTemplate:');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      if (error.errors) {
        console.error('Validation errors:', error.errors);
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to create form template',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        debug: process.env.NODE_ENV === 'development' ? {
          name: error.name,
          validationErrors: error.errors
        } : undefined
      });
    }
  },

  async getTemplates(req, res) {
    console.log('📋 BookingForm getTemplates called');
    console.log('🔍 Query params:', req.query);
    console.log('👤 User hotelId:', req.user?.hotelId);
    
    try {
      const { 
        page = 1, 
        limit = 10, 
        status, 
        category, 
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const filter = { hotelId: req.user.hotelId };
      
      if (status && status !== 'all') {
        filter.status = status;
      }
      
      if (category && category !== 'all') {
        filter.category = category;
      }
      
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      console.log('🔍 MongoDB filter:', JSON.stringify(filter, null, 2));

      const skip = (page - 1) * limit;
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      console.log('📊 Query options:', { skip, limit: parseInt(limit), sort });

      const templates = await BookingFormTemplate.find(filter)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

      console.log('📋 Found templates count:', templates.length);
      
      if (templates.length > 0) {
        console.log('📋 Sample template:', {
          id: templates[0]._id,
          name: templates[0].name,
          category: templates[0].category,
          hotelId: templates[0].hotelId,
          status: templates[0].status
        });
      }

      const total = await BookingFormTemplate.countDocuments(filter);

      console.log('📊 Total count:', total);
      console.log('📋 Response data:', {
        templatesCount: templates.length,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      });

      res.json({
        success: true,
        data: {
          templates,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            limit: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching form templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch form templates',
        message: error.message
      });
    }
  },

  async getTemplate(req, res) {
    try {
      const { id } = req.params;
      const template = await BookingFormTemplate.findOne({
        _id: id,
        hotelId: req.user.hotelId
      })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Error fetching form template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch form template',
        message: error.message
      });
    }
  },

  async updateTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { id } = req.params;
      const updateData = {
        ...req.body,
        updatedBy: req.user.id,
        updatedAt: new Date()
      };

      const template = await BookingFormTemplate.findOneAndUpdate(
        { _id: id, hotelId: req.user.hotelId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      res.json({
        success: true,
        data: template,
        message: 'Form template updated successfully'
      });
    } catch (error) {
      console.error('Error updating form template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update form template',
        message: error.message
      });
    }
  },

  async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      const template = await BookingFormTemplate.findOneAndDelete({
        _id: id,
        hotelId: req.user.hotelId
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      res.json({
        success: true,
        message: 'Form template deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting form template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete form template',
        message: error.message
      });
    }
  },

  async duplicateTemplate(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      const originalTemplate = await BookingFormTemplate.findOne({
        _id: id,
        hotelId: req.user.hotelId
      });

      if (!originalTemplate) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      const duplicateData = originalTemplate.toObject();
      delete duplicateData._id;
      delete duplicateData.__v;
      
      duplicateData.name = name || `${originalTemplate.name} (Copy)`;
      duplicateData.status = 'draft';
      duplicateData.createdBy = req.user.id;
      duplicateData.updatedBy = req.user.id;
      duplicateData.createdAt = new Date();
      duplicateData.updatedAt = new Date();

      const duplicateTemplate = new BookingFormTemplate(duplicateData);
      await duplicateTemplate.save();

      res.status(201).json({
        success: true,
        data: duplicateTemplate,
        message: 'Form template duplicated successfully'
      });
    } catch (error) {
      console.error('Error duplicating form template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to duplicate form template',
        message: error.message
      });
    }
  },

  async renderForm(req, res) {
    try {
      const { id } = req.params;
      const { preview = false } = req.query;

      const template = await BookingFormTemplate.findOne({
        _id: id,
        hotelId: req.user.hotelId
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      if (!preview && template.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Form template is not active'
        });
      }

      const renderedForm = await bookingFormService.renderForm(template, {
        preview,
        context: req.query
      });

      res.json({
        success: true,
        data: renderedForm
      });
    } catch (error) {
      console.error('Error rendering form:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to render form',
        message: error.message
      });
    }
  },

  async submitForm(req, res) {
    try {
      const { id } = req.params;
      const submissionData = req.body;

      const template = await BookingFormTemplate.findOne({
        _id: id,
        hotelId: req.user.hotelId,
        status: 'active'
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found or inactive'
        });
      }

      const result = await bookingFormService.processSubmission(
        template,
        submissionData,
        {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          referrer: req.get('Referer')
        }
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('Error submitting form:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit form',
        message: error.message
      });
    }
  },

  async validateForm(req, res) {
    try {
      const { id } = req.params;
      const formData = req.body;

      const template = await BookingFormTemplate.findOne({
        _id: id,
        hotelId: req.user.hotelId
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      const validationResult = await bookingFormService.validateSubmission(template, formData);

      res.json({
        success: true,
        data: validationResult
      });
    } catch (error) {
      console.error('Error validating form:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate form',
        message: error.message
      });
    }
  },

  async getAnalytics(req, res) {
    try {
      const { id } = req.params;
      const { 
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        groupBy = 'day'
      } = req.query;

      const template = await BookingFormTemplate.findOne({
        _id: id,
        hotelId: req.user.hotelId
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      const analytics = await bookingFormService.getFormAnalytics(
        template._id,
        {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          groupBy
        }
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error fetching form analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch form analytics',
        message: error.message
      });
    }
  },

  async exportTemplate(req, res) {
    try {
      const { id } = req.params;
      const { format = 'json' } = req.query;

      const template = await BookingFormTemplate.findOne({
        _id: id,
        hotelId: req.user.hotelId
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      const exportData = await bookingFormService.exportTemplate(template, format);

      res.setHeader('Content-Type', 
        format === 'json' ? 'application/json' : 'text/plain'
      );
      res.setHeader('Content-Disposition', 
        `attachment; filename="${template.name}.${format}"`
      );

      res.send(exportData);
    } catch (error) {
      console.error('Error exporting form template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export form template',
        message: error.message
      });
    }
  },

  async importTemplate(req, res) {
    try {
      const { data, overwrite = false } = req.body;

      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Template data is required'
        });
      }

      const importedTemplate = await bookingFormService.importTemplate(
        data,
        {
          hotelId: req.user.hotelId,
          createdBy: req.user.id,
          updatedBy: req.user.id,
          overwrite
        }
      );

      res.status(201).json({
        success: true,
        data: importedTemplate,
        message: 'Form template imported successfully'
      });
    } catch (error) {
      console.error('Error importing form template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to import form template',
        message: error.message
      });
    }
  },

  async testABVariant(req, res) {
    try {
      const { id } = req.params;
      const { variantId, action = 'view' } = req.body;

      const template = await BookingFormTemplate.findOne({
        _id: id,
        hotelId: req.user.hotelId
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      const result = await bookingFormService.recordABTestEvent(
        template._id,
        variantId,
        action,
        {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        }
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error recording A/B test event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record A/B test event',
        message: error.message
      });
    }
  }
};

export default bookingFormController;
