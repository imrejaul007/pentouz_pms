import express from 'express';
import Communication from '../models/Communication.js';
import Hotel from '../models/Hotel.js';
import User from '../models/User.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { body, validationResult } from 'express-validator';
import emailService from '../services/emailService.js';

const router = express.Router();

/**
 * @swagger
 * /contact:
 *   post:
 *     summary: Submit public contact form (no authentication required)
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - subject
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Rajesh Kumar"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "rajesh@example.com"
 *               phone:
 *                 type: string
 *                 example: "+91 98765 43210"
 *               subject:
 *                 type: string
 *                 example: "Room Reservation Inquiry"
 *               message:
 *                 type: string
 *                 example: "I would like to inquire about room availability..."
 *               hotelId:
 *                 type: string
 *                 description: "Optional hotel ID, defaults to main hotel"
 *     responses:
 *       201:
 *         description: Contact form submitted successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('phone')
      .optional()
      .trim()
      .matches(/^[\+]?[0-9\s\-\(\)]{10,20}$/)
      .withMessage('Please provide a valid phone number'),
    body('subject')
      .trim()
      .notEmpty()
      .withMessage('Subject is required')
      .isLength({ min: 5, max: 200 })
      .withMessage('Subject must be between 5 and 200 characters'),
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ min: 10, max: 2000 })
      .withMessage('Message must be between 10 and 2000 characters'),
  ],
  catchAsync(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApplicationError('Validation failed', 400, errors.array());
    }

    const { name, email, phone, subject, message, hotelId } = req.body;

    // Get default hotel if no hotelId provided
    let targetHotelId = hotelId;
    if (!targetHotelId) {
      const defaultHotel = await Hotel.findOne().sort({ createdAt: 1 });
      if (!defaultHotel) {
        throw new ApplicationError('No hotel found to send message to', 500);
      }
      targetHotelId = defaultHotel._id;
    } else {
      // Verify hotel exists
      const hotel = await Hotel.findById(targetHotelId);
      if (!hotel) {
        throw new ApplicationError('Hotel not found', 404);
      }
    }

    // Find hotel admin/staff to send the message to
    const hotelStaff = await User.find({
      hotelId: targetHotelId,
      role: { $in: ['admin', 'staff'] }
    }).select('name email');

    if (hotelStaff.length === 0) {
      throw new ApplicationError('No hotel staff found to receive the message', 500);
    }

    // Create recipients array
    const recipients = hotelStaff.map(staff => ({
      userId: staff._id,
      name: staff.name,
      email: staff.email,
      status: 'pending'
    }));

    // Use first admin/staff as sender for system purposes
    const systemSender = hotelStaff.find(staff => staff.role === 'admin') || hotelStaff[0];

    // Create the communication record
    const communication = await Communication.create({
      hotelId: targetHotelId,
      type: 'email',
      category: 'operational',
      priority: 'normal',
      channel: 'email',
      recipients,
      sentBy: systemSender._id,
      subject: `Contact Form: ${subject}`,
      content: `
New contact form submission from website:

Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Subject: ${subject}

Message:
${message}

---
This is an automated message from The Pentouz contact form.
Please respond directly to the guest at: ${email}
      `.trim(),
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">New Contact Form Submission</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">From The Pentouz Website</p>
          </div>
          
          <div style="background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; padding: 30px;">
            <div style="margin-bottom: 25px;">
              <h3 style="color: #333; margin-bottom: 15px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Guest Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555; width: 100px;">Name:</td>
                  <td style="padding: 8px 0; color: #333;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Email:</td>
                  <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #667eea; text-decoration: none;">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Phone:</td>
                  <td style="padding: 8px 0; color: #333;">${phone || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Subject:</td>
                  <td style="padding: 8px 0; color: #333;">${subject}</td>
                </tr>
              </table>
            </div>
            
            <div>
              <h3 style="color: #333; margin-bottom: 15px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Message</h3>
              <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; border-radius: 0 5px 5px 0; line-height: 1.6; color: #333;">
                ${message.replace(/\n/g, '<br>')}
              </div>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                Please respond directly to the guest at: <strong>${email}</strong>
              </p>
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 5px; display: inline-block;">
                <strong>The Pentouz Contact Form</strong><br>
                <small>Automated notification system</small>
              </div>
            </div>
          </div>
        </div>
      `,
      // Store guest contact info for reference
      guestContact: {
        name,
        email,
        phone,
        subject,
        message,
        submittedAt: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Send real email notification
    try {
      const emailResult = await emailService.sendContactFormNotification(
        { name, email, phone, subject, message },
        recipients
      );

      if (emailResult.success) {
        communication.status = 'sent';
        for (let i = 0; i < communication.recipients.length; i++) {
          await communication.markAsSent(i, { 
            messageId: emailResult.messageId || `contact_${Date.now()}_${i}`,
            timestamp: new Date()
          });
        }
        await communication.save();
      } else {
        communication.status = 'failed';
        communication.failureReason = emailResult.error;
        await communication.save();
      }
    } catch (error) {
      console.error('Error sending contact form email:', error);
      communication.status = 'failed';
      communication.failureReason = error.message;
      await communication.save();
    }

    res.status(201).json({
      status: 'success',
      message: 'Your message has been sent successfully. We will get back to you within 24 hours.',
      data: {
        submissionId: communication._id,
        submittedAt: new Date(),
        expectedResponse: '24 hours'
      }
    });
  })
);

/**
 * @swagger
 * /contact/info:
 *   get:
 *     summary: Get public contact information
 *     tags: [Contact]
 *     responses:
 *       200:
 *         description: Contact information
 */
router.get('/info', catchAsync(async (req, res) => {
  // This could come from a settings/config model in a real app
  const contactInfo = {
    corporateOffice: {
      address: {
        street: '46, 6th Cross, Lavelle Road',
        city: 'Bangalore',
        state: 'Karnataka', 
        country: 'India',
        zipCode: '560001'
      },
      phone: [
        '+91 8884449930',
        '+91 8970298300'
      ],
      email: 'sales@pentouz.com'
    },
    businessHours: {
      weekdays: 'Monday - Friday: 9:00 AM - 8:00 PM',
      weekends: 'Saturday - Sunday: 10:00 AM - 6:00 PM',
      emergency: '24/7 Emergency Support Available'
    },
    socialMedia: {
      facebook: '#',
      twitter: '#',
      instagram: '#',
      youtube: '#',
      pinterest: '#'
    },
    responseTime: '24 hours',
    languages: ['English', 'Hindi', 'Kannada'],
    copyright: '© THE PENTOUZ HOTELS & RESORTS ALL RIGHTS RESERVED, 2024'
  };

  res.json({
    status: 'success',
    data: contactInfo
  });
}));

/**
 * @swagger
 * /contact/hotels:
 *   get:
 *     summary: Get list of hotels with contact info
 *     tags: [Contact]
 *     responses:
 *       200:
 *         description: List of hotels with contact information
 */
router.get('/hotels', catchAsync(async (req, res) => {
  const hotels = await Hotel.find({ isActive: { $ne: false } })
    .select('name description address contact images amenities')
    .lean();

  const hotelsWithContact = hotels.map(hotel => ({
    id: hotel._id,
    name: hotel.name,
    description: hotel.description,
    address: hotel.address,
    contact: hotel.contact,
    images: hotel.images?.[0] || null, // Just first image for contact purposes
    amenities: hotel.amenities?.slice(0, 5) || [] // Top 5 amenities
  }));

  res.json({
    status: 'success',
    data: {
      hotels: hotelsWithContact,
      total: hotels.length
    }
  });
}));

export default router;