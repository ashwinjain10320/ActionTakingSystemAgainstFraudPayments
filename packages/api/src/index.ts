import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { logger } from './utils/logger';
import { metricsRegistry } from './utils/metrics';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiRoutes } from './routes';
import { prisma } from './lib/prisma';
import { redisClient } from './lib/redis';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

/**
 * Application class manages the Express server lifecycle
 * Implements SOLID principles with separation of concerns
 */
class Application {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = app;
    this.server = server;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configure Express middleware stack
   * Order matters: security -> logging -> parsing -> rate limiting
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
    }));

    // CORS configuration - allow frontend on multiple ports
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',  // Docker frontend
      'http://localhost:5173',  // Vite dev server default
    ];
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(requestLogger);

    // Rate limiting
    this.app.use(rateLimiter);
  }

  /**
   * Configure API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Metrics endpoint for Prometheus
    this.app.get('/metrics', async (_req, res) => {
      res.set('Content-Type', metricsRegistry.contentType);
      res.end(await metricsRegistry.metrics());
    });

    // API routes
    this.app.use('/api', apiRoutes);

    // 404 handler
    this.app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Configure error handling middleware
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Start the server and initialize connections
   */
  async start(): Promise<void> {
    try {
      // Test database connection
      await prisma.$connect();
      logger.info('Database connected');

      // Test Redis connection
      await redisClient.ping();
      logger.info('Redis connected');

      // Start HTTP server
      this.server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV}`);
      });
    } catch (error) {
      logger.error('Failed to start server', { error });
      process.exit(1);
    }
  }

  /**
   * Gracefully shutdown the server
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down gracefully...');

    // Close server
    this.server.close(() => {
      logger.info('HTTP server closed');
    });

    // Disconnect database
    await prisma.$disconnect();
    logger.info('Database disconnected');

    // Disconnect Redis
    await redisClient.quit();
    logger.info('Redis disconnected');

    process.exit(0);
  }
}

// Initialize application
const application = new Application();

// Start server
application.start();

// Handle graceful shutdown
process.on('SIGTERM', () => application.shutdown());
process.on('SIGINT', () => application.shutdown());

export { app };
