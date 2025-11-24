import { createClient } from 'redis';
import { logger } from '../utils/logger';

/**
 * Redis Client singleton for caching and rate limiting
 */
class RedisService {
  private static instance: ReturnType<typeof createClient>;

  /**
   * Get the Redis Client instance
   * Creates a new connection if one doesn't exist
   */
  static getInstance(): ReturnType<typeof createClient> {
    if (!RedisService.instance) {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      RedisService.instance = createClient({
        url: redisUrl,
      });

      RedisService.instance.on('error', (err) => {
        logger.error('Redis Client Error', { error: err });
      });

      RedisService.instance.on('connect', () => {
        logger.info('Redis Client connected');
      });

      RedisService.instance.connect().catch((err) => {
        logger.error('Failed to connect to Redis', { error: err });
      });
    }

    return RedisService.instance;
  }

  /**
   * Disconnect from Redis
   */
  static async disconnect(): Promise<void> {
    if (RedisService.instance) {
      await RedisService.instance.quit();
      logger.info('Redis Client disconnected');
    }
  }
}

export const redisClient = RedisService.getInstance();
