import Joi from 'joi';

// Corporate Company Validation
export const corporateCompanyValidation = {
  create: Joi.object({
    name: Joi.string().required().trim().max(200),
    email: Joi.string().required().email().lowercase(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/),
    gstNumber: Joi.string().required().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/),
    panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      country: Joi.string().default('India'),
      zipCode: Joi.string().required()
    }).required(),
    creditLimit: Joi.number().min(0).default(100000),
    paymentTerms: Joi.number().valid(15, 30, 45, 60, 90).default(30),
    hrContacts: Joi.array().items(Joi.object({
      name: Joi.string().required().trim(),
      email: Joi.string().required().email().lowercase(),
      phone: Joi.string().pattern(/^\+?[\d\s-()]+$/),
      designation: Joi.string().trim(),
      isPrimary: Joi.boolean().default(false)
    })).min(1).required(),
    contractDetails: Joi.object({
      contractNumber: Joi.string(),
      contractStartDate: Joi.date(),
      contractEndDate: Joi.date(),
      discountPercentage: Joi.number().min(0).max(100).default(0),
      specialTerms: Joi.string()
    }),
    billingCycle: Joi.string().valid('immediate', 'weekly', 'monthly', 'quarterly').default('monthly'),
    metadata: Joi.object({
      notes: Joi.string(),
      tags: Joi.array().items(Joi.string())
    })
  }),
  
  update: Joi.object({
    name: Joi.string().trim().max(200),
    email: Joi.string().email().lowercase(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/),
    gstNumber: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/),
    panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/),
    address: Joi.object({
      street: Joi.string(),
      city: Joi.string(),
      state: Joi.string(),
      country: Joi.string(),
      zipCode: Joi.string()
    }),
    creditLimit: Joi.number().min(0),
    paymentTerms: Joi.number().valid(15, 30, 45, 60, 90),
    hrContacts: Joi.array().items(Joi.object({
      name: Joi.string().trim(),
      email: Joi.string().email().lowercase(),
      phone: Joi.string().pattern(/^\+?[\d\s-()]+$/),
      designation: Joi.string().trim(),
      isPrimary: Joi.boolean()
    })),
    contractDetails: Joi.object({
      contractNumber: Joi.string(),
      contractStartDate: Joi.date(),
      contractEndDate: Joi.date(),
      discountPercentage: Joi.number().min(0).max(100),
      specialTerms: Joi.string()
    }),
    billingCycle: Joi.string().valid('immediate', 'weekly', 'monthly', 'quarterly'),
    isActive: Joi.boolean(),
    metadata: Joi.object({
      notes: Joi.string(),
      tags: Joi.array().items(Joi.string())
    })
  }).min(1)
};

// Group Booking Validation
export const groupBookingValidation = {
  create: Joi.object({
    corporateCompanyId: Joi.string().required().hex().length(24),
    groupName: Joi.string().required().trim().max(200),
    checkIn: Joi.date().required().greater('now'),
    checkOut: Joi.date().required().greater(Joi.ref('checkIn')),
    rooms: Joi.array().items(Joi.object({
      guestName: Joi.string().required().trim(),
      guestEmail: Joi.string().email().lowercase().allow('').optional(),
      guestPhone: Joi.string().pattern(/^\+?[\d\s-()]+$/).allow('').optional(),
      employeeId: Joi.string().trim().allow('').optional(),
      department: Joi.string().trim().allow('').optional(),
      roomType: Joi.string().valid('single', 'double', 'suite', 'deluxe').required(),
      roomId: Joi.alternatives().try(
        Joi.string().hex().length(24),
        Joi.object(),
        Joi.allow(null)
      ).optional(),
      rate: Joi.number().min(0).optional(),
      specialRequests: Joi.string().max(500).allow(''),
      bookingId: Joi.alternatives().try(
        Joi.string().hex().length(24),
        Joi.object(),
        Joi.allow(null)
      ).optional(),
      status: Joi.string().valid('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled').optional(),
      guestPreferences: Joi.object({
        bedType: Joi.string().allow('').optional(),
        floor: Joi.string().allow('').optional(),
        smokingAllowed: Joi.boolean().optional()
      }).optional()
    })).min(1).required(),
    paymentMethod: Joi.string().valid('corporate_credit', 'direct_billing', 'advance_payment').default('corporate_credit'),
    eventDetails: Joi.object({
      eventType: Joi.string().valid('conference', 'training', 'meeting', 'team_building', 'other'),
      eventName: Joi.string(),
      eventDescription: Joi.string(),
      eventStartDate: Joi.date(),
      eventEndDate: Joi.date(),
      meetingRoomRequired: Joi.boolean(),
      cateringRequired: Joi.boolean(),
      transportRequired: Joi.boolean()
    }),
    contactPerson: Joi.object({
      name: Joi.string().required(),
      email: Joi.string().required().email().lowercase(),
      phone: Joi.string().required().pattern(/^\+?[\d\s-()]+$/),
      designation: Joi.string()
    }).required(),
    specialInstructions: Joi.string().max(1000),
    invoiceDetails: Joi.object({
      billingAddress: Joi.object({
        street: Joi.string(),
        city: Joi.string(),
        state: Joi.string(),
        country: Joi.string(),
        zipCode: Joi.string()
      }),
      billingEmail: Joi.string().email().lowercase(),
      purchaseOrderNumber: Joi.string().trim(),
      costCenter: Joi.string().trim()
    })
  }),
  
  update: Joi.object({
    groupName: Joi.string().trim().max(200),
    corporateCompanyId: Joi.alternatives().try(
      Joi.string().hex().length(24),
      Joi.object(),
      Joi.allow(null)
    ).optional(),
    checkIn: Joi.date().greater('now'),
    checkOut: Joi.date(),
    rooms: Joi.array().items(Joi.object({
      _id: Joi.alternatives().try(
        Joi.string().hex().length(24),
        Joi.object(),
        Joi.allow(null)
      ).optional(),
      guestName: Joi.string().trim().optional(),
      guestEmail: Joi.string().email().lowercase().allow('').optional(),
      guestPhone: Joi.string().pattern(/^\+?[\d\s-()]+$/).allow('').optional(),
      employeeId: Joi.string().trim().allow('').optional(),
      department: Joi.string().trim().allow('').optional(),
      roomType: Joi.string().valid('single', 'double', 'suite', 'deluxe').optional(),
      roomId: Joi.alternatives().try(
        Joi.string().hex().length(24),
        Joi.object(),
        Joi.allow(null)
      ).optional(),
      rate: Joi.number().min(0).optional(),
      specialRequests: Joi.string().max(500).allow(''),
      bookingId: Joi.alternatives().try(
        Joi.string().hex().length(24),
        Joi.object(),
        Joi.allow(null)
      ).optional(),
      status: Joi.string().valid('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled').optional(),
      guestPreferences: Joi.object({
        bedType: Joi.string().allow('').optional(),
        floor: Joi.string().allow('').optional(),
        smokingAllowed: Joi.boolean().optional()
      }).optional()
    })),
    paymentMethod: Joi.string().valid('corporate_credit', 'direct_billing', 'advance_payment'),
    eventDetails: Joi.object({
      eventType: Joi.string().valid('conference', 'training', 'meeting', 'team_building', 'other'),
      eventName: Joi.string(),
      eventDescription: Joi.string(),
      eventStartDate: Joi.date(),
      eventEndDate: Joi.date(),
      meetingRoomRequired: Joi.boolean(),
      cateringRequired: Joi.boolean(),
      transportRequired: Joi.boolean()
    }),
    contactPerson: Joi.object({
      name: Joi.string(),
      email: Joi.string().email().lowercase(),
      phone: Joi.string().pattern(/^\+?[\d\s-()]+$/),
      designation: Joi.string()
    }),
    specialInstructions: Joi.string().max(1000),
    invoiceDetails: Joi.object({
      billingAddress: Joi.object({
        street: Joi.string(),
        city: Joi.string(),
        state: Joi.string(),
        country: Joi.string(),
        zipCode: Joi.string()
      }),
      billingEmail: Joi.string().email().lowercase(),
      purchaseOrderNumber: Joi.string().trim(),
      costCenter: Joi.string().trim()
    }),
    status: Joi.string().valid('draft', 'confirmed', 'partially_confirmed', 'checked_in', 'checked_out', 'cancelled')
  }).min(1).custom((value) => {
    if (value.checkIn && value.checkOut && value.checkIn >= value.checkOut) {
      throw new Joi.ValidationError('Check-out date must be after check-in date');
    }
    return value;
  })
};

// Credit Transaction Validation
export const creditTransactionValidation = {
  create: Joi.object({
    corporateCompanyId: Joi.string().required().hex().length(24),
    bookingId: Joi.string().hex().length(24),
    invoiceId: Joi.string().hex().length(24),
    groupBookingId: Joi.string().hex().length(24),
    transactionType: Joi.string().valid('debit', 'credit', 'adjustment', 'refund', 'payment').required(),
    amount: Joi.number().required().min(0),
    description: Joi.string().required().max(500),
    reference: Joi.string().trim(),
    transactionDate: Joi.date().default(Date.now),
    dueDate: Joi.date(),
    category: Joi.string().valid('accommodation', 'services', 'extras', 'taxes', 'fees', 'adjustment').default('accommodation'),
    paymentDetails: Joi.object({
      paymentMethod: Joi.string().valid('bank_transfer', 'cheque', 'cash', 'online', 'adjustment'),
      paymentReference: Joi.string(),
      bankDetails: Joi.object({
        bankName: Joi.string(),
        accountNumber: Joi.string(),
        transactionId: Joi.string()
      })
    }),
    metadata: Joi.object({
      source: Joi.string().valid('booking', 'manual', 'system', 'import').default('manual'),
      tags: Joi.array().items(Joi.string()),
      notes: Joi.string()
    })
  })
};

// GST Validation
export const gstValidation = {
  calculate: Joi.object({
    amount: Joi.number().required().min(0),
    gstRate: Joi.number().min(0).max(100).default(18),
    placeOfSupply: Joi.string().default('Maharashtra'),
    companyState: Joi.string().default('Maharashtra')
  }),
  
  validateNumber: Joi.object({
    gstNumber: Joi.string().required().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
  }),
  
  calculateBooking: Joi.object({
    items: Joi.array().items(Joi.object({
      description: Joi.string().required(),
      quantity: Joi.number().required().min(0),
      unitPrice: Joi.number().required().min(0)
    })).min(1).required(),
    gstDetails: Joi.object({
      gstRate: Joi.number().min(0).max(100).default(18),
      placeOfSupply: Joi.string().default('Maharashtra'),
      companyState: Joi.string().default('Maharashtra'),
      isGstApplicable: Joi.boolean().default(true)
    }).default({})
  }),
  
  reverseCalculate: Joi.object({
    totalAmount: Joi.number().required().min(0),
    gstRate: Joi.number().min(0).max(100).default(18)
  }),
  
  updateBookingGst: Joi.object({
    gstNumber: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/),
    gstRate: Joi.number().min(0).max(100),
    isGstApplicable: Joi.boolean()
  }).min(1)
};

// User Corporate Details Validation
export const corporateUserValidation = {
  create: Joi.object({
    name: Joi.string().required().trim().max(100),
    email: Joi.string().required().email().lowercase(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/),
    password: Joi.string().required().min(6),
    guestType: Joi.string().valid('corporate').default('corporate'),
    corporateDetails: Joi.object({
      corporateCompanyId: Joi.string().required().hex().length(24),
      employeeId: Joi.string().trim().allow('').optional(),
      department: Joi.string().trim().allow('').optional(),
      designation: Joi.string().trim(),
      costCenter: Joi.string().trim(),
      approvalRequired: Joi.boolean().default(false),
      approverEmail: Joi.string().email().lowercase()
    }).required()
  }),
  
  update: Joi.object({
    name: Joi.string().trim().max(100),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/),
    corporateDetails: Joi.object({
      employeeId: Joi.string().trim().allow('').optional(),
      department: Joi.string().trim().allow('').optional(),
      designation: Joi.string().trim(),
      costCenter: Joi.string().trim(),
      approvalRequired: Joi.boolean(),
      approverEmail: Joi.string().email().lowercase()
    })
  }).min(1)
};

// Corporate Booking Validation
export const corporateBookingValidation = {
  create: Joi.object({
    hotelId: Joi.string().required().hex().length(24),
    rooms: Joi.array().items(Joi.object({
      roomId: Joi.alternatives().try(
        Joi.string().hex().length(24),
        Joi.object(),
        Joi.allow(null)
      ).optional(),
      rate: Joi.number().min(0)
    })).min(1).required(),
    checkIn: Joi.date().required().greater('now'),
    checkOut: Joi.date().required().greater(Joi.ref('checkIn')),
    guestDetails: Joi.object({
      adults: Joi.number().min(1).default(1),
      children: Joi.number().min(0).default(0),
      specialRequests: Joi.string()
    }),
    corporateBooking: Joi.object({
      corporateCompanyId: Joi.string().required().hex().length(24),
      groupBookingId: Joi.string().hex().length(24),
      employeeId: Joi.string().trim().allow('').optional(),
      department: Joi.string().trim().allow('').optional(),
      costCenter: Joi.string().trim(),
      purchaseOrderNumber: Joi.string().trim(),
      approverEmail: Joi.string().email().lowercase(),
      paymentMethod: Joi.string().valid('corporate_credit', 'direct_billing', 'advance_payment').default('corporate_credit'),
      billingEmail: Joi.string().email().lowercase()
    }).required(),
    gstDetails: Joi.object({
      gstNumber: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/),
      gstRate: Joi.number().min(0).max(100).default(18),
      isGstApplicable: Joi.boolean().default(true)
    })
  }),
  
  update: Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'),
    paymentStatus: Joi.string().valid('pending', 'paid', 'refunded', 'failed'),
    guestDetails: Joi.object({
      adults: Joi.number().min(1),
      children: Joi.number().min(0),
      specialRequests: Joi.string()
    }),
    corporateBooking: Joi.object({
      employeeId: Joi.string().trim().allow('').optional(),
      department: Joi.string().trim().allow('').optional(),
      costCenter: Joi.string().trim(),
      purchaseOrderNumber: Joi.string().trim(),
      approverEmail: Joi.string().email().lowercase(),
      paymentMethod: Joi.string().valid('corporate_credit', 'direct_billing', 'advance_payment'),
      billingEmail: Joi.string().email().lowercase()
    }),
    gstDetails: Joi.object({
      gstNumber: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/),
      gstRate: Joi.number().min(0).max(100),
      isGstApplicable: Joi.boolean()
    })
  }).min(1)
};