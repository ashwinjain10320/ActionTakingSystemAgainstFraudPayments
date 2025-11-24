import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../lib/redis';
import { metrics } from '../utils/metrics';
import { logger } from '../utils/logger';

/**
 * Token Bucket Rate Limiter using Redis
 * Implements 5 requests per second per client
 */
export class RateLimiter {
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private readonly refillInterval: number; // milliseconds

  constructor() {
    this.maxTokens = parseInt(process.env.RATE_LIMIT_MAX_TOKENS || '5', 10);
    this.refillRate = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_SECOND || '5', 10);
    this.refillInterval = 1000; // 1 second
  }

  /**
   * Middleware function to check rate limit
   * Uses token bucket algorithm stored in Redis
   */
  async checkLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Identify client by IP or API key
      const clientId = this.getClientId(req);
      const key = `rate_limit:${clientId}`;

      // Get current bucket state
      const bucketData = await redisClient.get(key);
      const now = Date.now();

      let tokens: number;
      let lastRefill: number;

      if (bucketData) {
        const bucket = JSON.parse(bucketData);
        tokens = bucket.tokens;
        lastRefill = bucket.lastRefill;

        // Refill tokens based on time elapsed
        const timeElapsed = now - lastRefill;
        const tokensToAdd = (timeElapsed / this.refillInterval) * this.refillRate;
        tokens = Math.min(this.maxTokens, tokens + tokensToAdd);
        lastRefill = now;
      } else {
        // Initialize new bucket
        tokens = this.maxTokens;
        lastRefill = now;
      }

      // Check if request can proceed
      if (tokens >= 1) {
        tokens -= 1;

        // Save updated bucket
        await redisClient.setEx(
          key,
          60, // TTL: 60 seconds
          JSON.stringify({ tokens, lastRefill })
        );

        next();
      } else {
        // Rate limit exceeded
        metrics.rateLimitBlockTotal.inc({ client: clientId });
        
        logger.warn('Rate limit exceeded', {
          clientId,
          requestId: req.headers['x-request-id'],
        });

        // Calculate retry-after based on refill rate
        const retryAfterMs = Math.ceil((1 - tokens) / this.refillRate * this.refillInterval);
        const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

        res.status(429).json({
          error: 'Too many requests',
          retryAfter: retryAfterSeconds,
          message: `Rate limit exceeded. Retry after ${retryAfterSeconds} seconds.`,
        });
      }
    } catch (error) {
      logger.error('Rate limiter error', { error });
      // On error, allow request to proceed
      next();
    }
  }

  /**
   * Get client identifier from request
   * Priority: API key > IP address
   */
  private getClientId(req: Request): string {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && typeof apiKey === 'string') {
      return `key:${apiKey}`;
    }

    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }
}

const rateLimiterInstance = new RateLimiter();

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  return rateLimiterInstance.checkLimit(req, res, next);
};
