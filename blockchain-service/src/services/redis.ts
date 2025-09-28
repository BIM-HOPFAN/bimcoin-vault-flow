import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { config } from '../config';

let redisClient: RedisClientType;

/**
 * Initialize Redis connection
 */
export async function initializeRedis(): Promise<void> {
  try {
    redisClient = createClient({
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection attempts exceeded');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    await redisClient.connect();
  } catch (error) {
    logger.error('Redis initialization failed:', error);
    throw error;
  }
}

/**
 * Get Redis client
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  try {
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
}

// Graceful shutdown
process.on('SIGTERM', closeRedis);
process.on('SIGINT', closeRedis);