import mongoose from 'mongoose';
import EventQueue from '../models/EventQueue.js';
import { getRedisClient } from '../config/redis.js';
import { EventSchemas, EventPriorities, EventRetryConfig, validateEventPayload } from '../models/EventSchema.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Queue Service
 * 
 * Manages event queuing, processing, and retry logic for OTA sync operations
 */
class QueueService {
  constructor() {
    this.redis = null;
    this.isProcessing = false;
    this.processingInterval = null;
    this.workerId = `worker_${process.pid}_${Date.now()}`;
    this.workerInstance = process.env.WORKER_INSTANCE || 'default';
    this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_JOBS) || 5;
    this.processingIntervalMs = parseInt(process.env.PROCESSING_INTERVAL_MS) || 30000; // Reduced frequency to 30 seconds
    this.activeJobs = new Map(); // Track currently processing jobs
  }

  /**
   * Check database connectivity
   */
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Initialize the queue service
   */
  async initialize() {
    try {
      this.redis = getRedisClient();
      if (!this.redis) {
        logger.warn('Redis client not available - queue service will operate in degraded mode');
        return;
      }
      
      // Test Redis connection
      if (!this.redis.isReady) {
        logger.warn('Redis client not ready yet, waiting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Test Redis connection with a simple command
      try {
        await this.redis.ping();
        logger.debug('Redis ping successful');
      } catch (pingError) {
        logger.error('Redis ping failed - queue service will operate in degraded mode', { error: pingError.message });
        this.redis = null;
        return;
      }
      
      logger.info('Queue service initialized', {
        workerId: this.workerId,
        workerInstance: this.workerInstance,
        maxConcurrentJobs: this.maxConcurrentJobs,
        redisReady: this.redis.isReady
      });
    } catch (error) {
      logger.warn('Failed to initialize queue service - operating in degraded mode', { error: error.message });
      this.redis = null;
    }
  }

  /**
   * Add an event to the queue
   * @param {string} eventType - Type of event to queue
   * @param {Object} payload - Event payload
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created event
   */
  async addEvent(eventType, payload, options = {}) {
    try {
      // Skip if database is not connected
      if (!this.isDbConnected()) {
        logger.debug('Database not connected, skipping event queuing', { eventType });
        return null;
      }

      // Validate event type
      if (!EventSchemas[eventType]) {
        throw new Error(`Unknown event type: ${eventType}`);
      }

      // Validate payload
      const validation = validateEventPayload(eventType, payload);
      if (!validation.isValid) {
        throw new Error(`Invalid payload: ${validation.errors.join(', ')}`);
      }

      // Set default priority and retry config
      const priority = options.priority || EventPriorities[eventType] || 3;
      const retryConfig = EventRetryConfig[eventType] || EventRetryConfig.rate_update;

      // Create event
      const eventData = {
        eventType,
        priority,
        payload,
        processing: {
          maxAttempts: retryConfig.maxAttempts
        },
        source: options.source || 'system',
        correlationId: options.correlationId || uuidv4(),
        batchId: options.batchId,
        scheduledFor: options.scheduledFor || new Date(),
        createdBy: options.userId
      };

      const event = await EventQueue.create(eventData);

      // Add to Redis for real-time processing if scheduled for immediate processing
      if (!options.scheduledFor || new Date(options.scheduledFor) <= new Date()) {
        await this.addToRedisQueue(event);
      }

      logger.info('Event added to queue', {
        eventId: event.eventId,
        eventType: event.eventType,
        priority: event.priority,
        scheduledFor: event.scheduledFor,
        correlationId: event.correlationId
      });

      return event;
    } catch (error) {
      logger.error('Failed to add event to queue', {
        eventType,
        error: error.message,
        payload: JSON.stringify(payload).substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Add multiple events as a batch
   * @param {Array} events - Array of event objects
   * @param {Object} options - Batch options
   * @returns {Promise<Array>} Created events
   */
  async addBatch(events, options = {}) {
    const batchId = options.batchId || `batch_${uuidv4()}`;
    const createdEvents = [];

    try {
      for (const eventData of events) {
        const event = await this.addEvent(
          eventData.eventType,
          eventData.payload,
          {
            ...eventData.options,
            batchId,
            source: options.source || 'bulk_operation',
            userId: options.userId
          }
        );
        createdEvents.push(event);
      }

      logger.info('Batch added to queue', {
        batchId,
        eventCount: createdEvents.length,
        eventTypes: [...new Set(events.map(e => e.eventType))]
      });

      return createdEvents;
    } catch (error) {
      logger.error('Failed to add batch to queue', {
        batchId,
        error: error.message,
        processedCount: createdEvents.length
      });
      throw error;
    }
  }

  /**
   * Add event to Redis queue for immediate processing
   * @param {Object} event - Event object
   */
  async addToRedisQueue(event) {
    try {
      if (!this.redis) {
        logger.debug('Redis not available, skipping Redis queue', { eventId: event.eventId });
        return;
      }

      const queueKey = `queue:events:priority_${event.priority}`;
      const eventData = {
        eventId: event.eventId,
        eventType: event.eventType,
        priority: event.priority,
        scheduledFor: event.scheduledFor.toISOString()
      };

      await this.redis.lPush(queueKey, JSON.stringify(eventData));

      // Set expiration for the queue key
      await this.redis.expire(queueKey, 86400); // 24 hours
    } catch (error) {
      logger.error('Failed to add event to Redis queue', {
        eventId: event.eventId,
        error: error.message
      });
    }
  }

  /**
   * Start processing events
   */
  async startProcessing() {
    if (this.isProcessing) {
      logger.warn('Queue processing already started');
      return;
    }

    if (!this.redis) {
      logger.warn('Redis not available - queue processing disabled');
      return;
    }

    this.isProcessing = true;
    
    // Process scheduled events (move from MongoDB to Redis when ready)
    setInterval(() => {
      this.processScheduledEvents().catch(error => {
        logger.error('Error processing scheduled events', { error: error.message });
      });
    }, 30000); // Check every 30 seconds

    // Main processing loop
    this.processingInterval = setInterval(() => {
      this.processEvents().catch(error => {
        logger.error('Error in processing loop', { error: error.message });
      });
    }, this.processingIntervalMs);

    logger.info('Queue processing started', {
      workerId: this.workerId,
      processingIntervalMs: this.processingIntervalMs
    });
  }

  /**
   * Stop processing events
   */
  async stopProcessing() {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Wait for active jobs to complete
    const activeJobIds = Array.from(this.activeJobs.keys());
    if (activeJobIds.length > 0) {
      logger.info('Waiting for active jobs to complete', { 
        activeJobs: activeJobIds.length 
      });
      
      // Wait up to 30 seconds for jobs to complete
      const timeout = setTimeout(() => {
        logger.warn('Timeout waiting for jobs to complete', {
          remainingJobs: this.activeJobs.size
        });
      }, 30000);

      while (this.activeJobs.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      clearTimeout(timeout);
    }

    logger.info('Queue processing stopped', { workerId: this.workerId });
  }

  /**
   * Process scheduled events (move ready events from MongoDB to Redis)
   */
  async processScheduledEvents() {
    try {
      // Skip if database is not connected
      if (!this.isDbConnected()) {
        logger.debug('Database not connected, skipping scheduled events processing');
        return;
      }

      const now = new Date();
      const readyEvents = await EventQueue.find({
        status: 'pending',
        scheduledFor: { $lte: now }
      }).limit(100);

      for (const event of readyEvents) {
        await this.addToRedisQueue(event);
      }

      if (readyEvents.length > 0) {
        logger.debug('Moved scheduled events to processing queue', {
          count: readyEvents.length
        });
      }
    } catch (error) {
      logger.error('Error processing scheduled events', { error: error.message });
    }
  }

  /**
   * Main event processing loop
   */
  async processEvents() {
    try {
      // Don't process if we're at capacity
      if (this.activeJobs.size >= this.maxConcurrentJobs) {
        return;
      }

      // Get events from Redis queues (highest priority first)
      const availableSlots = this.maxConcurrentJobs - this.activeJobs.size;
      const events = await this.getNextEvents(availableSlots);

      for (const eventData of events) {
        // Start processing job without waiting
        this.processEvent(eventData).catch(error => {
          logger.error('Unhandled error in event processing', {
            eventId: eventData.eventId,
            error: error.message
          });
        });
      }
    } catch (error) {
      logger.error('Error in main processing loop', { error: error.message });
    }
  }

  /**
   * Get next events to process from Redis queues
   * @param {number} limit - Maximum number of events to retrieve
   * @returns {Promise<Array>} Array of event data
   */
  async getNextEvents(limit) {
    const events = [];
    
    try {
      // Check if Redis client is ready
      if (!this.redis || !this.redis.isReady) {
        logger.debug('Redis client not ready, skipping event retrieval');
        return events;
      }

      // Test Redis connection before proceeding
      try {
        await this.redis.ping();
      } catch (pingError) {
        logger.debug('Redis not responding, skipping event retrieval');
        return events;
      }
      
      // Check queues by priority (1 = highest)
      for (let priority = 1; priority <= 5 && events.length < limit; priority++) {
        const queueKey = `queue:events:priority_${priority}`;
        const remaining = limit - events.length;
        
        // Get events from this priority queue
        const eventStrings = await this.redis.lRange(queueKey, 0, remaining - 1);
        
        if (eventStrings && eventStrings.length > 0) {
          // Remove these events from the queue
          await this.redis.lTrim(queueKey, eventStrings.length, -1);
          
          // Parse event data
          for (const eventString of eventStrings) {
            try {
              const eventData = JSON.parse(eventString);
              events.push(eventData);
            } catch (parseError) {
              logger.error('Failed to parse event from Redis', { 
                eventString, 
                error: parseError.message 
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error getting next events from Redis', { 
        error: error.message,
        redisReady: this.redis?.isReady,
        redisAvailable: !!this.redis
      });
    }

    return events;
  }

  /**
   * Process a single event
   * @param {Object} eventData - Event data from Redis
   */
  async processEvent(eventData) {
    const { eventId } = eventData;
    
    // Track this job
    this.activeJobs.set(eventId, Date.now());

    try {
      // Skip if database is not connected
      if (!this.isDbConnected()) {
        logger.debug('Database not connected, skipping event processing', { eventId });
        this.activeJobs.delete(eventId);
        return;
      }

      // Get full event from MongoDB
      const event = await EventQueue.findOne({ eventId });
      if (!event) {
        logger.warn('Event not found in database', { eventId });
        return;
      }

      // Check if event is still processable
      if (event.status !== 'pending') {
        logger.debug('Event no longer pending', { 
          eventId, 
          status: event.status 
        });
        return;
      }

      // Mark as processing
      await event.markAsProcessing(this.workerId, this.workerInstance);

      logger.info('Processing event', {
        eventId: event.eventId,
        eventType: event.eventType,
        priority: event.priority,
        attempt: event.processing.attempts + 1
      });

      // Process the event based on its type
      const results = await this.processEventByType(event);

      // Mark as completed
      await event.markAsCompleted(results);

      logger.info('Event processed successfully', {
        eventId: event.eventId,
        eventType: event.eventType,
        processingTime: event.processing.processingDuration,
        results: results.length
      });

    } catch (error) {
      logger.error('Event processing failed', {
        eventId,
        error: error.message,
        stack: error.stack
      });

      try {
        const event = await EventQueue.findOne({ eventId });
        if (event) {
          const retryConfig = EventRetryConfig[event.eventType] || EventRetryConfig.rate_update;
          const retryDelay = retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, event.processing.attempts);
          const actualRetryDelay = Math.min(retryDelay, retryConfig.maxDelay);

          await event.markAsFailed(error, actualRetryDelay);

          // Re-queue for retry if eligible
          if (event.canRetry) {
            logger.info('Event queued for retry', {
              eventId: event.eventId,
              nextRetryAt: event.processing.nextRetryAt,
              attempt: event.processing.attempts
            });
          }
        }
      } catch (markError) {
        logger.error('Failed to mark event as failed', {
          eventId,
          error: markError.message
        });
      }
    } finally {
      // Remove from active jobs
      this.activeJobs.delete(eventId);
    }
  }

  /**
   * Process event based on its type
   * @param {Object} event - Event object
   * @returns {Promise<Array>} Processing results
   */
  async processEventByType(event) {
    const { eventType, payload } = event;
    const results = [];

    try {
      switch (eventType) {
        case 'rate_update':
          return await this.processRateUpdate(event);
          
        case 'availability_update':
          return await this.processAvailabilityUpdate(event);
          
        case 'restriction_update':
          return await this.processRestrictionUpdate(event);
          
        case 'room_type_update':
          return await this.processRoomTypeUpdate(event);
          
        case 'booking_modification':
          return await this.processBookingModification(event);
          
        case 'cancellation':
          return await this.processCancellation(event);
          
        case 'stop_sell_update':
          return await this.processStopSellUpdate(event);
          
        default:
          throw new Error(`Unsupported event type: ${eventType}`);
      }
    } catch (error) {
      logger.error('Event type processing failed', {
        eventId: event.eventId,
        eventType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process rate update event
   * @param {Object} event - Event object
   * @returns {Promise<Array>} Channel sync results
   */
  async processRateUpdate(event) {
    const results = [];
    const { payload } = event;

    // Import channel manager service (lazy load to avoid circular deps)
    const { ChannelManagerService } = await import('./channelManagerService.js');
    const channelManager = new ChannelManagerService();

    for (const channel of payload.channels) {
      if (channel === 'all') continue;

      try {
        const startTime = Date.now();
        
        // Send rate update to specific channel
        const response = await channelManager.updateRates(channel, {
          roomTypeId: payload.roomTypeId,
          ratePlanId: payload.ratePlanId,
          dateRange: payload.dateRange,
          rates: payload.channelSpecificRates?.[channel] || payload.rates
        });

        results.push({
          channel,
          status: 'success',
          response,
          processingTime: Date.now() - startTime
        });

        logger.debug('Rate update sent to channel', {
          eventId: event.eventId,
          channel,
          roomTypeId: payload.roomTypeId,
          ratePlanId: payload.ratePlanId
        });

      } catch (error) {
        results.push({
          channel,
          status: 'failed',
          response: {
            error: error.message,
            code: error.code || 'UNKNOWN_ERROR'
          },
          processingTime: Date.now() - Date.now()
        });

        logger.error('Failed to send rate update to channel', {
          eventId: event.eventId,
          channel,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Process availability update event
   * @param {Object} event - Event object
   * @returns {Promise<Array>} Channel sync results
   */
  async processAvailabilityUpdate(event) {
    const results = [];
    const { payload } = event;

    const { ChannelManagerService } = await import('./channelManagerService.js');
    const channelManager = new ChannelManagerService();

    for (const channel of payload.channels) {
      if (channel === 'all') continue;

      try {
        const startTime = Date.now();
        
        const response = await channelManager.updateAvailability(channel, {
          roomTypeId: payload.roomTypeId,
          dateRange: payload.dateRange,
          availability: payload.availability
        });

        results.push({
          channel,
          status: 'success',
          response,
          processingTime: Date.now() - startTime
        });

      } catch (error) {
        results.push({
          channel,
          status: 'failed',
          response: {
            error: error.message,
            code: error.code || 'UNKNOWN_ERROR'
          },
          processingTime: Date.now() - Date.now()
        });
      }
    }

    return results;
  }

  /**
   * Process restriction update event
   * @param {Object} event - Event object
   * @returns {Promise<Array>} Channel sync results
   */
  async processRestrictionUpdate(event) {
    const results = [];
    const { payload } = event;

    const { ChannelManagerService } = await import('./channelManagerService.js');
    const channelManager = new ChannelManagerService();

    for (const channel of payload.channels) {
      if (channel === 'all') continue;

      try {
        const startTime = Date.now();
        
        const response = await channelManager.updateRestrictions(channel, {
          roomTypeId: payload.roomTypeId,
          dateRange: payload.dateRange,
          restrictions: payload.restrictions
        });

        results.push({
          channel,
          status: 'success',
          response,
          processingTime: Date.now() - startTime
        });

      } catch (error) {
        results.push({
          channel,
          status: 'failed',
          response: {
            error: error.message,
            code: error.code || 'UNKNOWN_ERROR'
          },
          processingTime: Date.now() - Date.now()
        });
      }
    }

    return results;
  }

  /**
   * Process room type update event - placeholder
   */
  async processRoomTypeUpdate(event) {
    // TODO: Implement room type update processing
    return [];
  }

  /**
   * Process booking modification event - placeholder
   */
  async processBookingModification(event) {
    // TODO: Implement booking modification processing
    return [];
  }

  /**
   * Process cancellation event - placeholder
   */
  async processCancellation(event) {
    // TODO: Implement cancellation processing
    return [];
  }

  /**
   * Process stop sell update event - placeholder
   */
  async processStopSellUpdate(event) {
    // TODO: Implement stop sell update processing
    return [];
  }

  /**
   * Get queue statistics
   * @param {string} hotelId - Hotel ID filter
   * @returns {Promise<Object>} Queue statistics
   */
  async getQueueStats(hotelId = null) {
    try {
      let mongoStats = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
      
      if (this.isDbConnected()) {
        mongoStats = await EventQueue.getEventStats(hotelId);
      }
      
      const redisStats = await this.getRedisQueueStats();
      
      const stats = {
        mongodb: mongoStats,
        redis: redisStats,
        activeJobs: this.activeJobs.size,
        maxConcurrentJobs: this.maxConcurrentJobs,
        isProcessing: this.isProcessing
      };

      return stats;

    } catch (error) {
      logger.error('Failed to get queue stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Get Redis queue statistics
   * @returns {Promise<Object>} Redis queue stats
   */
  async getRedisQueueStats() {
    const stats = {};
    
    try {
      for (let priority = 1; priority <= 5; priority++) {
        const queueKey = `queue:events:priority_${priority}`;
        const length = await this.redis.lLen(queueKey);
        stats[`priority_${priority}`] = length;
      }
    } catch (error) {
      logger.error('Failed to get Redis queue stats', { error: error.message });
    }

    return stats;
  }

  /**
   * Cancel event by ID
   * @param {string} eventId - Event ID to cancel
   * @param {string} reason - Cancellation reason
   */
  async cancelEvent(eventId, reason = 'Manually cancelled') {
    try {
      // Skip if database is not connected
      if (!this.isDbConnected()) {
        logger.debug('Database not connected, cannot cancel event', { eventId });
        throw new Error('Database not available');
      }

      const event = await EventQueue.findOne({ eventId });
      if (!event) {
        throw new Error('Event not found');
      }

      if (event.status !== 'pending') {
        throw new Error(`Cannot cancel event with status: ${event.status}`);
      }

      await event.cancel(reason);
      
      logger.info('Event cancelled', { eventId, reason });
      
      return event;
    } catch (error) {
      logger.error('Failed to cancel event', { eventId, error: error.message });
      throw error;
    }
  }

  /**
   * Retry failed event
   * @param {string} eventId - Event ID to retry
   */
  async retryEvent(eventId) {
    try {
      // Skip if database is not connected
      if (!this.isDbConnected()) {
        logger.debug('Database not connected, cannot retry event', { eventId });
        throw new Error('Database not available');
      }

      const event = await EventQueue.findOne({ eventId });
      if (!event) {
        throw new Error('Event not found');
      }

      if (!event.canRetry) {
        throw new Error('Event is not eligible for retry');
      }

      // Reset retry timer and add back to queue
      event.processing.nextRetryAt = new Date();
      event.status = 'pending';
      await event.save();

      // Add to Redis queue for immediate processing
      await this.addToRedisQueue(event);

      logger.info('Event queued for retry', { eventId });
      
      return event;
    } catch (error) {
      logger.error('Failed to retry event', { eventId, error: error.message });
      throw error;
    }
  }
}

// Create singleton instance
const queueService = new QueueService();

export default queueService;