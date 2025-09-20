/**
 * Standardized Event Schemas
 * 
 * Defines the data structure for different types of OTA sync events
 * to ensure consistency across all event processing
 */

export const EventSchemas = {
  /**
   * Rate Update Event Schema
   * Triggered when room rates change and need to be synced to OTA channels
   */
  rate_update: {
    type: 'object',
    required: ['roomTypeId', 'ratePlanId', 'dateRange', 'rates'],
    properties: {
      roomTypeId: {
        type: 'string',
        description: 'ID of the room type being updated'
      },
      ratePlanId: {
        type: 'string', 
        description: 'ID of the rate plan being updated'
      },
      dateRange: {
        type: 'object',
        required: ['startDate', 'endDate'],
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        }
      },
      rates: {
        type: 'array',
        items: {
          type: 'object',
          required: ['date', 'rate'],
          properties: {
            date: { type: 'string', format: 'date' },
            rate: { 
              type: 'number', 
              minimum: 0,
              description: 'Rate amount in base currency'
            },
            currency: { 
              type: 'string', 
              default: 'USD',
              pattern: '^[A-Z]{3}$'
            },
            minStay: { 
              type: 'integer', 
              minimum: 1,
              description: 'Minimum length of stay for this rate'
            },
            maxStay: { 
              type: 'integer', 
              minimum: 1,
              description: 'Maximum length of stay for this rate'
            }
          }
        }
      },
      channelSpecificRates: {
        type: 'object',
        description: 'Channel-specific rate overrides',
        additionalProperties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', format: 'date' },
              rate: { type: 'number', minimum: 0 },
              adjustment: {
                type: 'object',
                properties: {
                  type: { 
                    type: 'string', 
                    enum: ['percentage', 'fixed'] 
                  },
                  value: { type: 'number' }
                }
              }
            }
          }
        }
      },
      source: {
        type: 'string',
        enum: ['manual', 'revenue_management', 'seasonal_rule', 'competitor_analysis'],
        description: 'Source of the rate update'
      },
      reason: {
        type: 'string',
        description: 'Human-readable reason for the rate change'
      }
    }
  },

  /**
   * Availability Update Event Schema
   * Triggered when room inventory/availability changes
   */
  availability_update: {
    type: 'object',
    required: ['roomTypeId', 'dateRange', 'availability'],
    properties: {
      roomTypeId: {
        type: 'string',
        description: 'ID of the room type being updated'
      },
      dateRange: {
        type: 'object',
        required: ['startDate', 'endDate'],
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        }
      },
      availability: {
        type: 'array',
        items: {
          type: 'object',
          required: ['date', 'available'],
          properties: {
            date: { type: 'string', format: 'date' },
            available: { 
              type: 'integer', 
              minimum: 0,
              description: 'Number of rooms available'
            },
            sold: { 
              type: 'integer', 
              minimum: 0,
              description: 'Number of rooms already sold'
            },
            blocked: { 
              type: 'integer', 
              minimum: 0,
              description: 'Number of rooms blocked for maintenance/events'
            },
            channelAllocation: {
              type: 'object',
              description: 'Channel-specific inventory allocation',
              additionalProperties: {
                type: 'integer',
                minimum: 0
              }
            }
          }
        }
      },
      inventoryType: {
        type: 'string',
        enum: ['rooms', 'beds', 'units'],
        default: 'rooms',
        description: 'Type of inventory being updated'
      },
      source: {
        type: 'string',
        enum: ['booking', 'cancellation', 'manual_adjustment', 'maintenance_block', 'overbooking_protection'],
        description: 'Source of the availability change'
      },
      bookingReference: {
        type: 'string',
        description: 'Reference to booking that caused this change'
      }
    }
  },

  /**
   * Restriction Update Event Schema
   * Triggered when booking restrictions change (min stay, closed to arrival, etc.)
   */
  restriction_update: {
    type: 'object',
    required: ['roomTypeId', 'dateRange', 'restrictions'],
    properties: {
      roomTypeId: {
        type: 'string',
        description: 'ID of the room type being updated'
      },
      dateRange: {
        type: 'object',
        required: ['startDate', 'endDate'],
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        }
      },
      restrictions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['date'],
          properties: {
            date: { type: 'string', format: 'date' },
            minStay: { 
              type: 'integer', 
              minimum: 1,
              description: 'Minimum length of stay'
            },
            maxStay: { 
              type: 'integer', 
              minimum: 1,
              description: 'Maximum length of stay'
            },
            closedToArrival: { 
              type: 'boolean',
              default: false,
              description: 'Closed to new arrivals on this date'
            },
            closedToDeparture: { 
              type: 'boolean',
              default: false,
              description: 'Closed to departures on this date'
            },
            stopSell: { 
              type: 'boolean',
              default: false,
              description: 'Stop selling this room type on this date'
            },
            channelSpecificRestrictions: {
              type: 'object',
              description: 'Channel-specific restriction overrides',
              additionalProperties: {
                type: 'object',
                properties: {
                  minStay: { type: 'integer', minimum: 1 },
                  maxStay: { type: 'integer', minimum: 1 },
                  closedToArrival: { type: 'boolean' },
                  closedToDeparture: { type: 'boolean' },
                  stopSell: { type: 'boolean' }
                }
              }
            }
          }
        }
      },
      source: {
        type: 'string',
        enum: ['manual', 'stop_sell_rule', 'revenue_strategy', 'overbooking_protection', 'maintenance'],
        description: 'Source of the restriction change'
      },
      ruleId: {
        type: 'string',
        description: 'ID of the stop sell rule that triggered this restriction'
      }
    }
  },

  /**
   * Room Type Update Event Schema
   * Triggered when room type details change
   */
  room_type_update: {
    type: 'object',
    required: ['roomTypeId', 'updateType'],
    properties: {
      roomTypeId: {
        type: 'string',
        description: 'ID of the room type being updated'
      },
      updateType: {
        type: 'string',
        enum: ['details', 'amenities', 'photos', 'policies', 'mapping'],
        description: 'Type of room type update'
      },
      changes: {
        type: 'object',
        description: 'Object containing the changed fields and their new values',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          maxOccupancy: { type: 'integer', minimum: 1 },
          bedType: { type: 'string' },
          roomSize: { type: 'number', minimum: 0 },
          amenities: {
            type: 'array',
            items: { type: 'string' }
          },
          photos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string', format: 'url' },
                caption: { type: 'string' },
                isPrimary: { type: 'boolean' }
              }
            }
          },
          policies: {
            type: 'object',
            properties: {
              smokingAllowed: { type: 'boolean' },
              petFriendly: { type: 'boolean' },
              extraBedAvailable: { type: 'boolean' },
              checkInTime: { type: 'string' },
              checkOutTime: { type: 'string' }
            }
          }
        }
      },
      channelMappingUpdates: {
        type: 'object',
        description: 'Updates to channel-specific room mappings',
        additionalProperties: {
          type: 'object',
          properties: {
            channelRoomId: { type: 'string' },
            channelRoomName: { type: 'string' },
            channelRoomDescription: { type: 'string' },
            isActive: { type: 'boolean' }
          }
        }
      },
      source: {
        type: 'string',
        enum: ['manual', 'bulk_update', 'integration_sync'],
        description: 'Source of the room type update'
      }
    }
  },

  /**
   * Booking Modification Event Schema  
   * Triggered when existing bookings are modified
   */
  booking_modification: {
    type: 'object',
    required: ['bookingId', 'modificationType'],
    properties: {
      bookingId: {
        type: 'string',
        description: 'ID of the booking being modified'
      },
      modificationType: {
        type: 'string',
        enum: ['dates_changed', 'room_type_changed', 'guest_count_changed', 'status_changed', 'payment_updated'],
        description: 'Type of modification made to the booking'
      },
      changes: {
        type: 'object',
        description: 'Object containing the changed fields',
        properties: {
          originalValues: { type: 'object' },
          newValues: { type: 'object' }
        }
      },
      channelBookingId: {
        type: 'string',
        description: 'Channel-specific booking ID if this was an OTA booking'
      },
      channel: {
        type: 'string',
        description: 'Channel where the booking originated'
      },
      inventoryImpact: {
        type: 'object',
        description: 'Impact on inventory due to this modification',
        properties: {
          dateChanges: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date' },
                roomTypeId: { type: 'string' },
                impact: { 
                  type: 'integer',
                  description: 'Positive for release, negative for booking'
                }
              }
            }
          }
        }
      },
      source: {
        type: 'string',
        enum: ['guest_request', 'hotel_initiated', 'channel_update', 'system_correction'],
        description: 'Source of the booking modification'
      }
    }
  },

  /**
   * Cancellation Event Schema
   * Triggered when bookings are cancelled
   */
  cancellation: {
    type: 'object',
    required: ['bookingId', 'cancellationType'],
    properties: {
      bookingId: {
        type: 'string',
        description: 'ID of the booking being cancelled'
      },
      cancellationType: {
        type: 'string',
        enum: ['guest_initiated', 'hotel_initiated', 'no_show', 'payment_failure', 'force_majeure'],
        description: 'Type/reason for cancellation'
      },
      channelBookingId: {
        type: 'string',
        description: 'Channel-specific booking ID if this was an OTA booking'
      },
      channel: {
        type: 'string',
        description: 'Channel where the booking originated'
      },
      inventoryRelease: {
        type: 'object',
        required: ['roomTypeId', 'dateRange', 'quantity'],
        properties: {
          roomTypeId: { type: 'string' },
          dateRange: {
            type: 'object',
            properties: {
              startDate: { type: 'string', format: 'date' },
              endDate: { type: 'string', format: 'date' }
            }
          },
          quantity: { type: 'integer', minimum: 1 }
        }
      },
      refundInfo: {
        type: 'object',
        properties: {
          refundAmount: { type: 'number', minimum: 0 },
          refundCurrency: { type: 'string', pattern: '^[A-Z]{3}$' },
          refundMethod: { type: 'string' },
          penaltyAmount: { type: 'number', minimum: 0 }
        }
      },
      source: {
        type: 'string',
        enum: ['guest_portal', 'hotel_system', 'channel_manager', 'automated_policy'],
        description: 'Source of the cancellation'
      }
    }
  },

  /**
   * Stop Sell Update Event Schema
   * Triggered when stop sell rules are applied/removed
   */
  stop_sell_update: {
    type: 'object',
    required: ['ruleId', 'action'],
    properties: {
      ruleId: {
        type: 'string',
        description: 'ID of the stop sell rule being applied/removed'
      },
      action: {
        type: 'string',
        enum: ['apply', 'remove', 'modify'],
        description: 'Action being taken on the stop sell rule'
      },
      affectedRoomTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of room type IDs affected by this rule'
      },
      dateRange: {
        type: 'object',
        required: ['startDate', 'endDate'],
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        }
      },
      restrictions: {
        type: 'object',
        properties: {
          stopSell: { type: 'boolean' },
          closedToArrival: { type: 'boolean' },
          closedToDeparture: { type: 'boolean' },
          minLengthOfStay: { type: 'integer', minimum: 1 },
          maxLengthOfStay: { type: 'integer', minimum: 1 }
        }
      },
      channelTargeting: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of channels this rule applies to'
      },
      reason: {
        type: 'string',
        description: 'Reason for applying/removing the stop sell rule'
      },
      source: {
        type: 'string',
        enum: ['manual', 'automated_rule', 'revenue_management', 'maintenance', 'overbooking'],
        description: 'Source of the stop sell update'
      }
    }
  }
};

/**
 * Event Priority Mapping
 * Defines priority levels for different event types
 */
export const EventPriorities = {
  cancellation: 1,              // Highest - immediate inventory impact
  booking_modification: 1,      // Highest - immediate inventory impact
  availability_update: 2,       // High - affects bookability
  stop_sell_update: 2,          // High - affects bookability
  rate_update: 3,              // Medium - affects pricing
  restriction_update: 3,        // Medium - affects booking rules
  room_type_update: 4          // Low - affects descriptions/amenities
};

/**
 * Event Retry Configuration
 * Defines retry behavior for different event types
 */
export const EventRetryConfig = {
  rate_update: {
    maxAttempts: 5,
    initialDelay: 30000,    // 30 seconds
    backoffMultiplier: 2,
    maxDelay: 300000        // 5 minutes
  },
  availability_update: {
    maxAttempts: 3,
    initialDelay: 10000,    // 10 seconds
    backoffMultiplier: 2,
    maxDelay: 60000         // 1 minute
  },
  restriction_update: {
    maxAttempts: 5,
    initialDelay: 30000,    // 30 seconds
    backoffMultiplier: 2,
    maxDelay: 300000        // 5 minutes
  },
  room_type_update: {
    maxAttempts: 3,
    initialDelay: 60000,    // 1 minute
    backoffMultiplier: 2,
    maxDelay: 600000        // 10 minutes
  },
  booking_modification: {
    maxAttempts: 3,
    initialDelay: 5000,     // 5 seconds
    backoffMultiplier: 2,
    maxDelay: 30000         // 30 seconds
  },
  cancellation: {
    maxAttempts: 3,
    initialDelay: 5000,     // 5 seconds
    backoffMultiplier: 2,
    maxDelay: 30000         // 30 seconds
  },
  stop_sell_update: {
    maxAttempts: 3,
    initialDelay: 10000,    // 10 seconds
    backoffMultiplier: 2,
    maxDelay: 60000         // 1 minute
  }
};

/**
 * Validate event payload against schema
 * @param {string} eventType - Type of event
 * @param {Object} payload - Event payload to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
export function validateEventPayload(eventType, payload) {
  const schema = EventSchemas[eventType];
  if (!schema) {
    return {
      isValid: false,
      errors: [`Unknown event type: ${eventType}`]
    };
  }

  // Basic validation - in production, use a proper JSON schema validator
  const errors = [];
  
  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in payload)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
