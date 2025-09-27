import Joi from 'joi';
import mongoose from 'mongoose';
import { ApplicationError } from '../middleware/errorHandler.js';

export const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new ApplicationError(message, 400));
    }
    
    next();
  };
};

// Common validation schemas
export const schemas = {
  register: Joi.object({
    name: Joi.string().required().min(2).max(100),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/),
    role: Joi.string().valid('guest', 'staff', 'admin', 'manager', 'travel_agent').default('guest')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  createRoom: Joi.object({
    hotelId: Joi.string().required(),
    roomNumber: Joi.string().required(),
    type: Joi.string().valid('single', 'double', 'suite', 'deluxe').required(),
    baseRate: Joi.number().min(0).required(),
    currentRate: Joi.number().min(0),
    floor: Joi.number().min(1),
    capacity: Joi.number().min(1).default(2),
    amenities: Joi.array().items(Joi.string()),
    images: Joi.array().items(Joi.string().uri()),
    description: Joi.string().max(500)
  }),

  createBooking: Joi.object({
    hotelId: Joi.string().required(),
    userId: Joi.string().optional(), // Allow admin to specify userId for manual bookings
    roomIds: Joi.array().items(Joi.string()).min(0).required(),
    checkIn: Joi.date().iso().custom((value, helpers) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(value) < today) {
        return helpers.error('date.min', { limit: 'today' });
      }
      return value;
    }).required(),
    checkOut: Joi.date().iso().greater(Joi.ref('checkIn')).required(),
    guestDetails: Joi.object({
      adults: Joi.number().min(1).required(),
      children: Joi.number().min(0).default(0),
      specialRequests: Joi.string().allow('')
    }),
    totalAmount: Joi.number().optional(), // Allow admin to specify total amount
    currency: Joi.string().optional(),
    paymentStatus: Joi.string().valid('pending', 'paid', 'partially_paid').optional(),
    status: Joi.string().valid('pending', 'confirmed', 'checked_in').optional(),
    idempotencyKey: Joi.string().required(),
    // Additional fields for room type bookings (optional metadata)
    roomType: Joi.string().valid('single', 'double', 'suite', 'deluxe').optional(),
    nights: Joi.number().min(1).optional(),
    // Payment information for walk-in bookings
    paymentMethod: Joi.string().valid('cash', 'card', 'upi', 'bank_transfer').optional(),
    advanceAmount: Joi.number().min(0).optional(),
    paymentReference: Joi.string().allow('').optional(),
    paymentNotes: Joi.string().allow('').optional(),
    ratePerNight: Joi.number().min(0).optional(),
    guestName: Joi.string().optional(),
    guestEmail: Joi.string().email().optional(),
    guestPhone: Joi.string().optional()
  }),

  createPaymentIntent: Joi.object({
    bookingId: Joi.string().required(),
    amount: Joi.number().min(1).required(),
    currency: Joi.string().length(3).uppercase().default('INR')
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/),
    preferences: Joi.object({
      bedType: Joi.string().valid('single', 'double', 'queen', 'king'),
      floor: Joi.string(),
      smokingAllowed: Joi.boolean(),
      other: Joi.string().max(500)
    })
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required()
  }),

  redeemPoints: Joi.object({
    offerId: Joi.string().required().messages({
      'string.empty': 'Offer ID is required',
      'any.required': 'Offer ID is required'
    })
  }),

  createServiceBooking: Joi.object({
    bookingDate: Joi.date().iso().greater('now').required().messages({
      'date.greater': 'Booking date must be in the future',
      'any.required': 'Booking date is required'
    }),
    numberOfPeople: Joi.number().integer().min(1).required().messages({
      'number.min': 'At least 1 person is required',
      'any.required': 'Number of people is required'
    }),
    specialRequests: Joi.string().max(500).optional().messages({
      'string.max': 'Special requests cannot exceed 500 characters'
    })
  }),

  cancelServiceBooking: Joi.object({
    reason: Joi.string().required().max(200).messages({
      'string.empty': 'Cancellation reason is required',
      'any.required': 'Cancellation reason is required',
      'string.max': 'Cancellation reason cannot exceed 200 characters'
    })
  }),

  // Notification validation schemas
  markNotificationsRead: Joi.object({
    notificationIds: Joi.array().items(Joi.string().required()).min(1).required().messages({
      'array.min': 'At least one notification ID is required',
      'any.required': 'Notification IDs are required'
    })
  }),

  updateNotificationPreferences: Joi.object({
    channel: Joi.string().valid('email', 'sms', 'push', 'inApp').required().messages({
      'any.only': 'Channel must be one of: email, sms, push, inApp',
      'any.required': 'Channel is required'
    }),
    settings: Joi.object({
      enabled: Joi.boolean(),
      address: Joi.string().email().allow(''),
      number: Joi.string().pattern(/^\+?[\d\s-()]+$/).allow(''),
      token: Joi.string().allow(''),
      frequency: Joi.string().valid('immediate', 'hourly', 'daily', 'weekly'),
      quietHours: Joi.object({
        enabled: Joi.boolean(),
        start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
        end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      }),
      sound: Joi.boolean(),
      vibration: Joi.boolean(),
      showBadge: Joi.boolean()
    }).required().messages({
      'any.required': 'Settings are required'
    })
  }),

  updateNotificationType: Joi.object({
    enabled: Joi.boolean().required().messages({
      'any.required': 'Enabled status is required'
    })
  }),

                sendTestNotification: Joi.object({
                channel: Joi.string().valid('email', 'sms', 'push', 'in_app').required().messages({
                  'any.only': 'Channel must be one of: email, sms, push, in_app',
                  'any.required': 'Channel is required'
                }),
                type: Joi.string().valid('booking_confirmation', 'booking_reminder', 'booking_cancellation', 'payment_success', 'payment_failed', 'loyalty_points', 'service_booking', 'service_reminder', 'promotional', 'system_alert', 'welcome', 'check_in', 'check_out', 'review_request', 'special_offer').optional()
              }),

              deleteNotifications: Joi.object({
                notificationIds: Joi.array().items(Joi.string().required()).min(1).required().messages({
                  'array.min': 'At least one notification ID is required',
                  'any.required': 'Notification IDs are required'
                })
              }),
              generateDigitalKey: Joi.object({
                bookingId: Joi.string().required().messages({
                  'string.empty': 'Booking ID is required',
                  'any.required': 'Booking ID is required'
                }),
                type: Joi.string().valid('primary', 'temporary', 'emergency').optional().messages({
                  'any.only': 'Type must be one of: primary, temporary, emergency'
                }),
                maxUses: Joi.number().integer().min(-1).optional().messages({
                  'number.min': 'Max uses cannot be less than -1'
                }),
                securitySettings: Joi.object({
                  requirePin: Joi.boolean().optional(),
                  pin: Joi.string().pattern(/^\d{4,6}$/).optional().messages({
                    'string.pattern.base': 'PIN must be 4-6 digits'
                  }),
                  allowSharing: Joi.boolean().optional(),
                  maxSharedUsers: Joi.number().integer().min(0).optional().messages({
                    'number.min': 'Max shared users cannot be negative'
                  }),
                  requireApproval: Joi.boolean().optional()
                }).optional()
              }),
              shareDigitalKey: Joi.object({
                email: Joi.string().email().required().messages({
                  'string.email': 'Please provide a valid email address',
                  'any.required': 'Email is required'
                }),
                name: Joi.string().required().max(100).messages({
                  'string.empty': 'Name is required',
                  'any.required': 'Name is required',
                  'string.max': 'Name cannot exceed 100 characters'
                }),
                expiresAt: Joi.date().iso().greater('now').optional().messages({
                  'date.greater': 'Expiration date must be in the future'
                })
              }),
              createMeetUpRequest: Joi.object({
                targetUserId: Joi.string().required().messages({
                  'string.empty': 'Target user ID is required',
                  'any.required': 'Target user ID is required'
                }),
                hotelId: Joi.string().required().messages({
                  'string.empty': 'Hotel ID is required',
                  'any.required': 'Hotel ID is required'
                }),
                type: Joi.string().valid('casual', 'business', 'social', 'networking', 'activity').required().messages({
                  'any.only': 'Type must be one of: casual, business, social, networking, activity',
                  'any.required': 'Type is required'
                }),
                title: Joi.string().required().max(100).messages({
                  'string.empty': 'Title is required',
                  'any.required': 'Title is required',
                  'string.max': 'Title cannot exceed 100 characters'
                }),
                description: Joi.string().required().max(500).messages({
                  'string.empty': 'Description is required',
                  'any.required': 'Description is required',
                  'string.max': 'Description cannot exceed 500 characters'
                }),
                proposedDate: Joi.date().iso().greater('now').required().messages({
                  'date.greater': 'Proposed date must be in the future',
                  'any.required': 'Proposed date is required'
                }),
                proposedTime: Joi.object({
                  start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
                    'string.pattern.base': 'Start time must be in HH:MM format',
                    'any.required': 'Start time is required'
                  }),
                  end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
                    'string.pattern.base': 'End time must be in HH:MM format',
                    'any.required': 'End time is required'
                  })
                }).required().messages({
                  'any.required': 'Proposed time is required'
                }),
                location: Joi.object({
                  type: Joi.string().valid('hotel_lobby', 'restaurant', 'bar', 'meeting_room', 'outdoor', 'other').required().messages({
                    'any.only': 'Location type must be one of: hotel_lobby, restaurant, bar, meeting_room, outdoor, other',
                    'any.required': 'Location type is required'
                  }),
                  name: Joi.string().required().max(100).messages({
                    'string.empty': 'Location name is required',
                    'any.required': 'Location name is required',
                    'string.max': 'Location name cannot exceed 100 characters'
                  }),
                  details: Joi.string().max(200).optional().allow('').messages({
                    'string.max': 'Location details cannot exceed 200 characters'
                  })
                }).required().messages({
                  'any.required': 'Location is required'
                }),
                meetingRoomBooking: Joi.object({
                  roomId: Joi.string().optional(),
                  isRequired: Joi.boolean().default(false)
                }).optional(),
                participants: Joi.object({
                  maxParticipants: Joi.number().integer().min(2).max(20).default(2).messages({
                    'number.min': 'Minimum 2 participants required',
                    'number.max': 'Maximum 20 participants allowed'
                  })
                }).optional(),
                preferences: Joi.object({
                  interests: Joi.array().items(Joi.string().max(50)).optional().messages({
                    'string.max': 'Interest cannot exceed 50 characters'
                  }),
                  languages: Joi.array().items(Joi.string().max(20)).optional().messages({
                    'string.max': 'Language cannot exceed 20 characters'
                  }),
                  ageGroup: Joi.string().valid('18-25', '26-35', '36-45', '46-55', '55+', 'any').optional(),
                  gender: Joi.string().valid('male', 'female', 'any').optional()
                }).optional(),
                communication: Joi.object({
                  preferredMethod: Joi.string().valid('in_app', 'email', 'phone', 'whatsapp').default('in_app'),
                  contactInfo: Joi.object({
                    email: Joi.string().email().optional(),
                    phone: Joi.string().optional(),
                    whatsapp: Joi.string().optional()
                  }).optional()
                }).optional(),
                activity: Joi.object({
                  type: Joi.string().valid('coffee', 'lunch', 'dinner', 'drinks', 'walk', 'tour', 'game', 'other').optional(),
                  duration: Joi.number().integer().min(30).max(480).default(60).messages({
                    'number.min': 'Minimum duration is 30 minutes',
                    'number.max': 'Maximum duration is 8 hours'
                  }),
                  cost: Joi.number().min(0).default(0).messages({
                    'number.min': 'Cost cannot be negative'
                  }),
                  costSharing: Joi.boolean().default(false)
                }).optional(),
                safety: Joi.object({
                  verifiedOnly: Joi.boolean().default(false),
                  publicLocation: Joi.boolean().default(true),
                  hotelStaffPresent: Joi.boolean().default(false)
                }).optional(),
                metadata: Joi.object({
                  tags: Joi.array().items(Joi.string()).optional(),
                  category: Joi.string().valid('business', 'leisure', 'cultural', 'sports', 'food', 'entertainment').optional(),
                  difficulty: Joi.string().valid('easy', 'moderate', 'challenging').default('easy')
                }).optional()
              }),
              respondToMeetUpRequest: Joi.object({
                message: Joi.string().max(300).optional().allow('').messages({
                  'string.max': 'Response message cannot exceed 300 characters'
                })
              }),
              addParticipant: Joi.object({
                userId: Joi.string().required().messages({
                  'string.empty': 'User ID is required',
                  'any.required': 'User ID is required'
                }),
                name: Joi.string().required().messages({
                  'string.empty': 'Name is required',
                  'any.required': 'Name is required'
                }),
                email: Joi.string().email().required().messages({
                  'string.email': 'Please provide a valid email address',
                  'any.required': 'Email is required'
                })
              }),
              suggestAlternative: Joi.object({
                date: Joi.date().iso().greater('now').required().messages({
                  'date.greater': 'Alternative date must be in the future',
                  'any.required': 'Alternative date is required'
                }),
                time: Joi.object({
                  start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
                    'string.pattern.base': 'Start time must be in HH:MM format',
                    'any.required': 'Start time is required'
                  }),
                  end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
                    'string.pattern.base': 'End time must be in HH:MM format',
                    'any.required': 'End time is required'
                  })
                }).required().messages({
                  'any.required': 'Alternative time is required'
                })
              }),
              
              // API Management validation schemas
              createAPIKey: Joi.object({
                name: Joi.string().required().trim().max(100).messages({
                  'string.empty': 'API key name is required',
                  'string.max': 'API key name cannot exceed 100 characters',
                  'any.required': 'API key name is required'
                }),
                description: Joi.string().trim().max(500).optional().messages({
                  'string.max': 'Description cannot exceed 500 characters'
                }),
                type: Joi.string().valid('read', 'write', 'admin').default('read').messages({
                  'any.only': 'API key type must be read, write, or admin'
                }),
                permissions: Joi.array().items(
                  Joi.object({
                    resource: Joi.string().required().messages({
                      'string.empty': 'Permission resource is required',
                      'any.required': 'Permission resource is required'
                    }),
                    actions: Joi.array().items(
                      Joi.string().valid('create', 'read', 'update', 'delete')
                    ).required().messages({
                      'any.required': 'Permission actions are required'
                    })
                  })
                ).optional(),
                rateLimit: Joi.object({
                  requestsPerMinute: Joi.number().integer().min(1).max(1000).default(60),
                  requestsPerHour: Joi.number().integer().min(1).max(10000).default(1000),
                  requestsPerDay: Joi.number().integer().min(1).max(100000).default(10000)
                }).optional(),
                allowedIPs: Joi.array().items(
                  Joi.string().pattern(/^(\d{1,3}\.){3}\d{1,3}$|^\*$/).messages({
                    'string.pattern.base': 'Invalid IP address format. Use xxx.xxx.xxx.xxx or * for all'
                  })
                ).optional(),
                allowedDomains: Joi.array().items(Joi.string().domain()).optional(),
                expiresAt: Joi.date().iso().greater('now').optional().messages({
                  'date.greater': 'Expiration date must be in the future'
                })
              }),
              
              updateAPIKey: Joi.object({
                name: Joi.string().trim().max(100).optional().messages({
                  'string.max': 'API key name cannot exceed 100 characters'
                }),
                description: Joi.string().trim().max(500).optional().messages({
                  'string.max': 'Description cannot exceed 500 characters'
                }),
                isActive: Joi.boolean().optional(),
                permissions: Joi.array().items(
                  Joi.object({
                    resource: Joi.string().required(),
                    actions: Joi.array().items(
                      Joi.string().valid('create', 'read', 'update', 'delete')
                    ).required()
                  })
                ).optional(),
                rateLimit: Joi.object({
                  requestsPerMinute: Joi.number().integer().min(1).max(1000),
                  requestsPerHour: Joi.number().integer().min(1).max(10000),
                  requestsPerDay: Joi.number().integer().min(1).max(100000)
                }).optional(),
                allowedIPs: Joi.array().items(
                  Joi.string().pattern(/^(\d{1,3}\.){3}\d{1,3}$|^\*$/)
                ).optional(),
                allowedDomains: Joi.array().items(Joi.string().domain()).optional(),
                expiresAt: Joi.date().iso().greater('now').allow(null).optional()
              }),
              
              createWebhook: Joi.object({
                name: Joi.string().required().trim().max(100).messages({
                  'string.empty': 'Webhook name is required',
                  'string.max': 'Webhook name cannot exceed 100 characters',
                  'any.required': 'Webhook name is required'
                }),
                description: Joi.string().trim().max(500).optional().messages({
                  'string.max': 'Description cannot exceed 500 characters'
                }),
                url: Joi.string().uri({ scheme: ['http', 'https'] }).required().messages({
                  'string.uri': 'Please provide a valid HTTP or HTTPS URL',
                  'any.required': 'Webhook URL is required'
                }),
                events: Joi.array().items(
                  Joi.string().valid(
                    'booking.created', 'booking.updated', 'booking.cancelled', 'booking.confirmed',
                    'booking.checked_in', 'booking.checked_out', 'booking.no_show',
                    'payment.completed', 'payment.failed', 'payment.refunded', 'payment.partial_refund',
                    'room.availability_changed', 'room.status_changed', 'room.maintenance_scheduled', 'room.cleaned',
                    'rate.updated', 'rate.created', 'rate.deleted',
                    'guest.created', 'guest.updated', 'guest.checked_in', 'guest.checked_out',
                    'system.backup_completed', 'system.maintenance_started', 'system.maintenance_completed', 'system.error_occurred'
                  )
                ).min(1).required().messages({
                  'array.min': 'At least one event must be selected',
                  'any.required': 'Event selection is required'
                }),
                httpConfig: Joi.object({
                  method: Joi.string().valid('POST', 'PUT').default('POST'),
                  headers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
                  timeout: Joi.number().integer().min(1000).max(300000).default(30000),
                  contentType: Joi.string().valid('application/json', 'application/x-www-form-urlencoded').default('application/json')
                }).optional(),
                retryPolicy: Joi.object({
                  enabled: Joi.boolean().default(true),
                  maxRetries: Joi.number().integer().min(0).max(10).default(3),
                  initialDelay: Joi.number().integer().min(100).default(1000),
                  maxDelay: Joi.number().integer().min(1000).default(60000),
                  backoffMultiplier: Joi.number().min(1).max(10).default(2),
                  retryOn: Joi.array().items(
                    Joi.string().valid('timeout', 'connection_error', '5xx', '4xx')
                  ).default(['timeout', 'connection_error', '5xx'])
                }).optional(),
                filters: Joi.object({
                  enabled: Joi.boolean().default(false),
                  conditions: Joi.array().items(
                    Joi.object({
                      field: Joi.string().required(),
                      operator: Joi.string().valid('equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'in', 'not_in').required(),
                      value: Joi.any().required()
                    })
                  ).optional()
                }).optional()
              }),
              
              updateWebhook: Joi.object({
                name: Joi.string().trim().max(100).optional().messages({
                  'string.max': 'Webhook name cannot exceed 100 characters'
                }),
                description: Joi.string().trim().max(500).optional().messages({
                  'string.max': 'Description cannot exceed 500 characters'
                }),
                url: Joi.string().uri({ scheme: ['http', 'https'] }).optional().messages({
                  'string.uri': 'Please provide a valid HTTP or HTTPS URL'
                }),
                isActive: Joi.boolean().optional(),
                events: Joi.array().items(
                  Joi.string().valid(
                    'booking.created', 'booking.updated', 'booking.cancelled', 'booking.confirmed',
                    'booking.checked_in', 'booking.checked_out', 'booking.no_show',
                    'payment.completed', 'payment.failed', 'payment.refunded', 'payment.partial_refund',
                    'room.availability_changed', 'room.status_changed', 'room.maintenance_scheduled', 'room.cleaned',
                    'rate.updated', 'rate.created', 'rate.deleted',
                    'guest.created', 'guest.updated', 'guest.checked_in', 'guest.checked_out',
                    'system.backup_completed', 'system.maintenance_started', 'system.maintenance_completed', 'system.error_occurred'
                  )
                ).min(1).optional(),
                httpConfig: Joi.object({
                  method: Joi.string().valid('POST', 'PUT'),
                  headers: Joi.object().pattern(Joi.string(), Joi.string()),
                  timeout: Joi.number().integer().min(1000).max(300000),
                  contentType: Joi.string().valid('application/json', 'application/x-www-form-urlencoded')
                }).optional(),
                retryPolicy: Joi.object({
                  enabled: Joi.boolean(),
                  maxRetries: Joi.number().integer().min(0).max(10),
                  initialDelay: Joi.number().integer().min(100),
                  maxDelay: Joi.number().integer().min(1000),
                  backoffMultiplier: Joi.number().min(1).max(10),
                  retryOn: Joi.array().items(
                    Joi.string().valid('timeout', 'connection_error', '5xx', '4xx')
                  )
                }).optional(),
                filters: Joi.object({
                  enabled: Joi.boolean(),
                  conditions: Joi.array().items(
                    Joi.object({
                      field: Joi.string().required(),
                      operator: Joi.string().valid('equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'in', 'not_in').required(),
                      value: Joi.any().required()
                    })
                  )
                }).optional()
              }),

  // Meet-Up Room Booking validation schemas
  checkRoomAvailability: Joi.object({
    hotelId: Joi.string().required().messages({
      'string.empty': 'Hotel ID is required',
      'any.required': 'Hotel ID is required'
    }),
    date: Joi.date().iso().greater('now').required().messages({
      'date.greater': 'Date must be in the future',
      'any.required': 'Date is required'
    }),
    timeSlot: Joi.object({
      start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
        'string.pattern.base': 'Start time must be in HH:MM format',
        'any.required': 'Start time is required'
      }),
      end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
        'string.pattern.base': 'End time must be in HH:MM format',
        'any.required': 'End time is required'
      })
    }).required().messages({
      'any.required': 'Time slot is required'
    }),
    capacity: Joi.number().integer().min(2).max(20).required().messages({
      'number.min': 'Capacity must be at least 2',
      'number.max': 'Capacity cannot exceed 20',
      'any.required': 'Capacity is required'
    }),
    roomType: Joi.string().optional()
  }),

  bookRoom: Joi.object({
    meetUpId: Joi.string().required().messages({
      'string.empty': 'Meet-up ID is required',
      'any.required': 'Meet-up ID is required'
    }),
    roomId: Joi.string().required().messages({
      'string.empty': 'Room ID is required',
      'any.required': 'Room ID is required'
    }),
    equipment: Joi.array().items(Joi.string()).optional().default([]),
    services: Joi.array().items(Joi.string()).optional().default([])
  }),

  calculateBookingCost: Joi.object({
    hotelId: Joi.string().required().messages({
      'string.empty': 'Hotel ID is required',
      'any.required': 'Hotel ID is required'
    }),
    duration: Joi.number().min(0.5).max(12).required().messages({
      'number.min': 'Duration must be at least 0.5 hours',
      'number.max': 'Duration cannot exceed 12 hours',
      'any.required': 'Duration is required'
    }),
    equipment: Joi.array().items(Joi.string()).optional().default([]),
    services: Joi.array().items(Joi.string()).optional().default([]),
    participants: Joi.number().integer().min(2).max(20).optional().default(2).messages({
      'number.min': 'Participants must be at least 2',
      'number.max': 'Participants cannot exceed 20'
    })
  }),

  // Travel Agent Booking Schemas
  createTravelAgentBooking: Joi.object({
    travelAgentId: Joi.string().required().messages({
      'string.empty': 'Travel agent ID is required',
      'any.required': 'Travel agent ID is required'
    }),
    hotelId: Joi.string().required().messages({
      'string.empty': 'Hotel ID is required',
      'any.required': 'Hotel ID is required'
    }),
    guestDetails: Joi.object({
      primaryGuest: Joi.object({
        name: Joi.string().required().max(100),
        email: Joi.string().email().required(),
        phone: Joi.string().required().pattern(/^\+?[\d\s-()]+$/)
      }).required(),
      totalGuests: Joi.number().integer().min(1).required(),
      totalRooms: Joi.number().integer().min(1).required()
    }).required(),
    bookingDetails: Joi.object({
      checkIn: Joi.date().iso().min('now').required(),
      checkOut: Joi.date().iso().greater(Joi.ref('checkIn')).required(),
      nights: Joi.number().integer().min(1).required(),
      roomTypes: Joi.array().items(Joi.object({
        roomTypeId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
        ratePerNight: Joi.number().min(0).required(),
        specialRate: Joi.number().min(0).optional()
      })).min(1).required()
    }).required(),
    pricing: Joi.object({
      subtotal: Joi.number().min(0).required(),
      taxes: Joi.number().min(0).default(0),
      fees: Joi.number().min(0).default(0),
      discounts: Joi.number().min(0).default(0),
      totalAmount: Joi.number().min(0).required(),
      specialRateDiscount: Joi.number().min(0).default(0)
    }).required(),
    commission: Joi.object({
      rate: Joi.number().min(0).max(50).required(),
      amount: Joi.number().min(0).required(),
      bonusRate: Joi.number().min(0).max(25).default(0),
      bonusAmount: Joi.number().min(0).default(0)
    }).required(),
    paymentDetails: Joi.object({
      method: Joi.string().valid('credit_card', 'bank_transfer', 'cash', 'cheque', 'agent_credit').required(),
      status: Joi.string().valid('pending', 'paid', 'partial', 'failed', 'refunded').default('pending')
    }).required(),
    specialConditions: Joi.object({
      earlyCheckin: Joi.boolean().default(false),
      lateCheckout: Joi.boolean().default(false),
      roomUpgrade: Joi.boolean().default(false),
      specialRequests: Joi.string().max(1000)
    }).optional(),
    notes: Joi.string().max(2000).optional()
  }),

  createTravelAgentRate: Joi.object({
    travelAgentId: Joi.string().required(),
    roomTypeId: Joi.string().required(),
    hotelId: Joi.string().required(),
    rateType: Joi.string().valid('special_rate', 'discount_percentage', 'commission_bonus').required(),
    specialRate: Joi.when('rateType', {
      is: 'special_rate',
      then: Joi.number().min(0).required(),
      otherwise: Joi.number().min(0).optional()
    }),
    discountPercentage: Joi.when('rateType', {
      is: 'discount_percentage',
      then: Joi.number().min(0).max(100).required(),
      otherwise: Joi.number().min(0).max(100).optional()
    }),
    commissionBonus: Joi.when('rateType', {
      is: 'commission_bonus',
      then: Joi.number().min(0).max(50).required(),
      otherwise: Joi.number().min(0).max(50).optional()
    }),
    validFrom: Joi.date().iso().required(),
    validTo: Joi.date().iso().greater(Joi.ref('validFrom')).required(),
    minimumNights: Joi.number().integer().min(1).default(1),
    maximumNights: Joi.number().integer().min(1).default(30),
    conditions: Joi.object({
      advanceBookingDays: Joi.number().integer().min(0).default(0),
      cancellationPolicy: Joi.string().valid('flexible', 'moderate', 'strict', 'non_refundable').default('moderate'),
      paymentTerms: Joi.string().valid('pay_now', 'pay_at_hotel', 'credit_allowed').default('pay_now')
    }).optional(),
    description: Joi.string().max(500).optional()
  }),

  updateCommissionStatus: Joi.object({
    paymentStatus: Joi.string().valid('pending', 'paid', 'processing', 'cancelled').required(),
    paymentReference: Joi.string().when('paymentStatus', {
      is: 'paid',
      then: Joi.string().required(),
      otherwise: Joi.string().optional()
    })
  }),

  // Multi-booking validation schemas
  createMultiBooking: Joi.object({
    travelAgentId: Joi.string().optional().messages({
      'string.empty': 'Travel agent ID is required'
    }),
    hotelId: Joi.string().required().messages({
      'string.empty': 'Hotel ID is required',
      'any.required': 'Hotel ID is required'
    }),
    groupDetails: Joi.object({
      groupName: Joi.string().required().min(2).max(200).messages({
        'string.empty': 'Group name is required',
        'string.min': 'Group name must be at least 2 characters',
        'string.max': 'Group name cannot exceed 200 characters',
        'any.required': 'Group name is required'
      }),
      primaryContact: Joi.object({
        name: Joi.string().required().max(100),
        email: Joi.string().email().required(),
        phone: Joi.string().required().pattern(/^\+?[\d\s-()]+$/)
      }).required(),
      totalGuests: Joi.number().integer().min(1).required(),
      checkIn: Joi.date().iso().required(),
      checkOut: Joi.date().iso().greater(Joi.ref('checkIn')).required(),
      nights: Joi.number().integer().min(1).required()
    }).required(),
    bookings: Joi.array().items(Joi.object({
      roomTypeId: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required(),
      ratePerNight: Joi.number().min(0).required(),
      specialRate: Joi.number().min(0).optional(),
      guestDetails: Joi.object({
        primaryGuest: Joi.object({
          name: Joi.string().required().max(100),
          email: Joi.string().email().required(),
          phone: Joi.string().required()
        }).required(),
        adults: Joi.number().integer().min(1).required(),
        children: Joi.number().integer().min(0).default(0)
      }).required()
    })).min(1).required().messages({
      'array.min': 'At least one booking is required',
      'any.required': 'Bookings array is required'
    }),
    paymentDetails: Joi.object({
      method: Joi.string().valid('credit_card', 'bank_transfer', 'cash', 'cheque', 'agent_credit', 'credit', 'deposit').required(),
      status: Joi.string().valid('pending', 'paid', 'partial', 'failed', 'refunded').default('pending')
    }).required(),
    specialConditions: Joi.object({
      bulkCheckIn: Joi.boolean().default(false),
      groupActivities: Joi.array().items(Joi.string()).optional(),
      specialRequests: Joi.string().max(2000).allow('').optional(),
      priorityHandling: Joi.boolean().default(false)
    }).optional(),
    metadata: Joi.object({
      source: Joi.string().valid('web', 'api', 'phone', 'email').default('api'),
      bookingChannel: Joi.string().optional(),
      corporateAccount: Joi.string().optional(),
      eventType: Joi.string().valid('conference', 'wedding', 'tour_group', 'corporate_event', 'other').default('other'),
      referenceNumber: Joi.string().optional(),
      season: Joi.string().valid('peak', 'high', 'low', 'off', 'regular').default('regular')
    }).optional(),
    notes: Joi.string().max(3000).optional()
  }),

  calculateBulkPricing: Joi.object({
    bookings: Joi.array().items(Joi.object({
      roomTypeId: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required(),
      ratePerNight: Joi.number().min(0).optional(),
      specialRate: Joi.number().min(0).optional(),
      basePrice: Joi.number().min(0).optional(),
      nights: Joi.number().integer().min(1).default(1)
    })).min(1).required().messages({
      'array.min': 'At least one booking is required',
      'any.required': 'Bookings array is required'
    }),
    travelAgentId: Joi.string().optional().messages({
      'string.empty': 'Travel agent ID is required'
    }),
    hotelId: Joi.string().optional(),
    applyBulkDiscount: Joi.boolean().default(true)
  }),

  updateMultiBookingStatus: Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'failed', 'partially_booked', 'cancelled').required().messages({
      'any.only': 'Status must be one of: pending, confirmed, failed, partially_booked, cancelled',
      'any.required': 'Status is required'
    }),
    reason: Joi.string().max(500).optional().messages({
      'string.max': 'Reason cannot exceed 500 characters'
    })
  }),

  rollbackMultiBooking: Joi.object({
    reason: Joi.string().required().max(500).messages({
      'string.empty': 'Rollback reason is required',
      'any.required': 'Rollback reason is required',
      'string.max': 'Reason cannot exceed 500 characters'
    })
  }),

  // Waitlist validation schemas
  createWaitlistEntry: Joi.object({
    hotelId: Joi.string().optional(), // Optional since it can come from req.user
    guestId: Joi.string().required().messages({
      'string.empty': 'Guest ID is required',
      'any.required': 'Guest ID is required'
    }),
    guestInfo: Joi.object({
      name: Joi.string().required().trim().max(100).messages({
        'string.empty': 'Guest name is required',
        'string.max': 'Guest name cannot exceed 100 characters',
        'any.required': 'Guest name is required'
      }),
      email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Guest email is required'
      }),
      phone: Joi.string().required().pattern(/^\+?[\d\s-()]+$/).messages({
        'string.pattern.base': 'Please provide a valid phone number',
        'any.required': 'Guest phone is required'
      }),
      tier: Joi.string().valid('regular', 'vip', 'svip', 'corporate', 'diamond').default('regular').messages({
        'any.only': 'Guest tier must be one of: regular, vip, svip, corporate, diamond'
      })
    }).required().messages({
      'any.required': 'Guest information is required'
    }),
    requestedRoomType: Joi.string().required().trim().max(100).messages({
      'string.empty': 'Requested room type is required',
      'string.max': 'Room type cannot exceed 100 characters',
      'any.required': 'Requested room type is required'
    }),
    checkInDate: Joi.date().iso().min('now').required().messages({
      'date.min': 'Check-in date must be in the future',
      'any.required': 'Check-in date is required'
    }),
    checkOutDate: Joi.date().iso().greater(Joi.ref('checkInDate')).required().messages({
      'date.greater': 'Check-out date must be after check-in date',
      'any.required': 'Check-out date is required'
    }),
    partySize: Joi.number().integer().min(1).max(20).required().messages({
      'number.min': 'Party size must be at least 1',
      'number.max': 'Party size cannot exceed 20',
      'any.required': 'Party size is required'
    }),
    maxPrice: Joi.number().min(0).required().messages({
      'number.min': 'Maximum price cannot be negative',
      'any.required': 'Maximum price is required'
    }),
    urgency: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium').messages({
      'any.only': 'Urgency must be one of: low, medium, high, urgent'
    }),
    preferences: Joi.array().items(Joi.string().trim().max(100)).max(10).optional().messages({
      'string.max': 'Each preference cannot exceed 100 characters',
      'array.max': 'Maximum 10 preferences allowed'
    }),
    specialRequests: Joi.array().items(Joi.string().trim().max(200)).max(5).optional().messages({
      'string.max': 'Each special request cannot exceed 200 characters',
      'array.max': 'Maximum 5 special requests allowed'
    }),
    autoNotify: Joi.boolean().default(true),
    source: Joi.string().valid('web', 'phone', 'email', 'walk_in', 'api').default('web').messages({
      'any.only': 'Source must be one of: web, phone, email, walk_in, api'
    })
  }),

  updateWaitlistEntry: Joi.object({
    status: Joi.string().valid('waiting', 'matched', 'contacted', 'confirmed', 'declined', 'expired', 'cancelled').optional().messages({
      'any.only': 'Status must be one of: waiting, matched, contacted, confirmed, declined, expired, cancelled'
    }),
    notes: Joi.string().max(500).optional().messages({
      'string.max': 'Notes cannot exceed 500 characters'
    }),
    reason: Joi.string().max(500).optional().messages({
      'string.max': 'Reason cannot exceed 500 characters'
    }),
    urgency: Joi.string().valid('low', 'medium', 'high', 'urgent').optional().messages({
      'any.only': 'Urgency must be one of: low, medium, high, urgent'
    }),
    maxPrice: Joi.number().min(0).optional().messages({
      'number.min': 'Maximum price cannot be negative'
    }),
    preferences: Joi.array().items(Joi.string().trim().max(100)).max(10).optional().messages({
      'string.max': 'Each preference cannot exceed 100 characters',
      'array.max': 'Maximum 10 preferences allowed'
    }),
    specialRequests: Joi.array().items(Joi.string().trim().max(200)).max(5).optional().messages({
      'string.max': 'Each special request cannot exceed 200 characters',
      'array.max': 'Maximum 5 special requests allowed'
    }),
    autoNotify: Joi.boolean().optional()
  }),

  addContactHistory: Joi.object({
    method: Joi.string().valid('email', 'phone', 'sms', 'in_person').required().messages({
      'any.only': 'Contact method must be one of: email, phone, sms, in_person',
      'any.required': 'Contact method is required'
    }),
    status: Joi.string().valid('attempted', 'successful', 'failed', 'no_response').required().messages({
      'any.only': 'Contact status must be one of: attempted, successful, failed, no_response',
      'any.required': 'Contact status is required'
    }),
    notes: Joi.string().max(500).optional().messages({
      'string.max': 'Notes cannot exceed 500 characters'
    })
  }),

  handleMatchAction: Joi.object({
    action: Joi.string().valid('confirm', 'decline', 'contact').required().messages({
      'any.only': 'Action must be one of: confirm, decline, contact',
      'any.required': 'Action is required'
    }),
    notes: Joi.string().max(500).optional().messages({
      'string.max': 'Notes cannot exceed 500 characters'
    })
  }),

  findMatchCandidates: Joi.object({
    roomType: Joi.string().trim().max(100).optional().messages({
      'string.max': 'Room type cannot exceed 100 characters'
    }),
    checkInDate: Joi.date().iso().optional(),
    checkOutDate: Joi.date().iso().when('checkInDate', {
      is: Joi.exist(),
      then: Joi.date().iso().greater(Joi.ref('checkInDate')).required(),
      otherwise: Joi.date().iso().optional()
    }).messages({
      'date.greater': 'Check-out date must be after check-in date'
    }),
    maxPrice: Joi.number().min(0).optional().messages({
      'number.min': 'Maximum price cannot be negative'
    }),
    partySize: Joi.number().integer().min(1).max(20).optional().messages({
      'number.min': 'Party size must be at least 1',
      'number.max': 'Party size cannot exceed 20'
    }),
    minimumMatchScore: Joi.number().min(0).max(100).default(50).messages({
      'number.min': 'Minimum match score cannot be negative',
      'number.max': 'Minimum match score cannot exceed 100'
    })
  })
};

// Additional validation middlewares

/**
 * Validate MongoDB ObjectId format
 */
export const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ApplicationError(`Invalid ${paramName} format`, 400));
    }
    
    next();
  };
};

/**
 * Validate booking ID specifically
 */
export const validateBookingId = validateObjectId('bookingId');

/**
 * Validate amendment ID specifically
 */
export const validateAmendmentId = validateObjectId('amendmentId');

/**
 * Validate multiple IDs in request body array
 */
export const validateIdArray = (fieldName) => {
  return (req, res, next) => {
    const ids = req.body[fieldName];

    if (!Array.isArray(ids)) {
      return next(new ApplicationError(`${fieldName} must be an array`, 400));
    }

    for (const id of ids) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new ApplicationError(`Invalid ID format in ${fieldName}: ${id}`, 400));
      }
    }

    next();
  };
};

/**
 * Validate waitlist entry creation
 */
export const validateWaitlistEntry = validate(schemas.createWaitlistEntry);

/**
 * Validate waitlist entry update
 */
export const validateWaitlistUpdate = validate(schemas.updateWaitlistEntry);

/**
 * Validate contact history addition
 */
export const validateContactHistory = validate(schemas.addContactHistory);

/**
 * Validate match action handling
 */
export const validateMatchAction = validate(schemas.handleMatchAction);

/**
 * Validate match candidate search
 */
export const validateMatchCandidates = validate(schemas.findMatchCandidates);

/**
 * Validate waitlist ID specifically
 */
export const validateWaitlistId = validateObjectId('id');

/**
 * Validate analytics request query parameters
 */
export const validateAnalyticsRequest = (req, res, next) => {
  const schema = Joi.object({
    timeRange: Joi.number().integer().min(1).max(365).optional(),
    limit: Joi.number().integer().min(1).max(1000).optional(),
    channel: Joi.string().valid('in_app', 'browser', 'email', 'sms', 'push').optional(),
    category: Joi.string().optional(),
    format: Joi.string().valid('json', 'csv').optional()
  });

  const { error } = schema.validate(req.query);

  if (error) {
    const message = error.details.map(detail => detail.message).join(', ');
    return next(new ApplicationError(message, 400));
  }

  next();
};
