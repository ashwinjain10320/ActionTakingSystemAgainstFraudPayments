import winston from 'winston';
import { redactPII } from './redactor';

/**
 * Structured JSON logger using Winston
 * Automatically redacts PII from logs
 */
class Logger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'sentinel-api' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, ...meta }) => {
              return `${timestamp} [${level}]: ${message} ${
                Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
              }`;
            })
          ),
        }),
      ],
    });

    // Add file transport in production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
      );
      this.logger.add(
        new winston.transports.File({ filename: 'logs/combined.log' })
      );
    }
  }

  /**
   * Log info level message with PII redaction
   */
  info(message: string, meta?: Record<string, any>): void {
    const sanitizedMeta = this.sanitizeMeta(meta);
    this.logger.info(message, sanitizedMeta);
  }

  /**
   * Log warning level message with PII redaction
   */
  warn(message: string, meta?: Record<string, any>): void {
    const sanitizedMeta = this.sanitizeMeta(meta);
    this.logger.warn(message, sanitizedMeta);
  }

  /**
   * Log error level message with PII redaction
   */
  error(message: string, meta?: Record<string, any>): void {
    const sanitizedMeta = this.sanitizeMeta(meta);
    this.logger.error(message, sanitizedMeta);
  }

  /**
   * Log debug level message with PII redaction
   */
  debug(message: string, meta?: Record<string, any>): void {
    const sanitizedMeta = this.sanitizeMeta(meta);
    this.logger.debug(message, sanitizedMeta);
  }

  /**
   * Log structured event with standard fields
   */
  logEvent(event: {
    event: string;
    level?: string;
    requestId?: string;
    runId?: string;
    sessionId?: string;
    customerId?: string;
    [key: string]: any;
  }): void {
    const { level = 'info', ...rest } = event;
    const sanitized = this.sanitizeMeta(rest);
    
    // Add masked flag if PII was redacted
    const hasMasked = JSON.stringify(rest) !== JSON.stringify(sanitized);
    
    this.logger.log(level, 'Event', {
      ...sanitized,
      masked: hasMasked,
      ts: new Date().toISOString(),
    });
  }

  /**
   * Sanitize metadata by redacting PII
   */
  private sanitizeMeta(meta?: Record<string, any>): Record<string, any> | undefined {
    if (!meta) return meta;

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(meta)) {
      if (typeof value === 'string') {
        sanitized[key] = redactPII(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMeta(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

export const logger = new Logger();
