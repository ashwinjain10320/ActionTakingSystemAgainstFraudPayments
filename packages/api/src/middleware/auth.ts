import { Request, Response, NextFunction } from 'express';
import { ApiError } from './errorHandler';
import { logger } from '../utils/logger';

/**
 * User roles for RBAC
 */
export enum UserRole {
  AGENT = 'agent',
  LEAD = 'lead',
}

/**
 * Extend Express Request to include user info
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        role: UserRole;
        apiKey: string;
      };
    }
  }
}

/**
 * API Key authentication middleware
 * Validates X-API-Key header
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    throw new ApiError('Missing API key', 401);
  }

  // Validate API key (in production, use database lookup)
  const validApiKey = process.env.API_KEY || 'sentinel-api-key-12345';
  
  if (apiKey !== validApiKey) {
    logger.warn('Invalid API key attempt', {
      requestId: req.headers['x-request-id'],
      ip: req.ip,
    });
    throw new ApiError('Invalid API key', 401);
  }

  // Attach user info to request
  // In production, fetch role from database based on API key
  req.user = {
    role: apiKey.includes('lead') ? UserRole.LEAD : UserRole.AGENT,
    apiKey,
  };

  next();
}

/**
 * Role-based access control middleware
 * Requires specific role to access route
 */
export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError('Authentication required', 401);
    }

    // Lead role has access to all agent routes
    if (req.user.role === UserRole.LEAD) {
      next();
      return;
    }

    if (req.user.role !== role) {
      throw new ApiError('Insufficient permissions', 403);
    }

    next();
  };
}
