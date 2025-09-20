import { createClient } from 'redis';
import logger from '../utils/logger.js';

let redisClient;

export const connectRedis = async () => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    await redisClient.connect();
    
  } catch (error) {
    logger.error('Redis connection failed:', error.message);
    throw error; // Let the app fail if Redis is required
  }
};

export const getRedisClient = () => redisClient;

export const isRedisConnected = () => redisClient && redisClient.isReady;

export const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.disconnect();
  }
};
