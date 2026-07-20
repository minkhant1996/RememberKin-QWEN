/**
 * Error Middleware
 *
 * Provides centralized error handling with:
 * - Structured error responses
 * - Error logging with context
 * - Different handling for operational vs programmer errors
 * - Request ID correlation
 *
 * @module middleware/error
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import {
  AppError as StructuredAppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  logError,
  wrapError,
} from '../utils/errors.js';

/**
 * Simple AppError for backward compatibility.
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Convert legacy AppError to structured error.
 */
function toStructuredError(error: AppError): StructuredAppError {
  return new StructuredAppError(error.message, {
    code: error.code,
    statusCode: error.statusCode,
    context: {
      metadata: error.details,
    },
  });
}

/**
 * Main error handling middleware.
 */
export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || 'unknown';

  // Log the error with context
  const logContext = {
    requestId,
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id,
    query: req.query,
    body: sanitizeBody(req.body),
  };

  // Handle structured AppError from utils/errors.ts
  if (err instanceof StructuredAppError) {
    // Add request context
    err.context.requestId = requestId;
    err.context.operation = `${req.method} ${req.path}`;
    err.context.userId = (req as any).user?.id;

    // Log using our error logger
    logError(err, logContext);

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        errorId: err.context.errorId,
        ...(process.env.NODE_ENV === 'development' && {
          category: err.category,
          severity: err.severity,
          stack: err.stack,
        }),
      },
    });
    return;
  }

  // Handle legacy AppError
  if (err instanceof AppError) {
    logger.warn({
      ...logContext,
      code: err.code,
      statusCode: err.statusCode,
    }, `[${requestId}] ${err.code}: ${err.message}`);

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const zodErrors = (err as any).errors;
    logger.warn({
      ...logContext,
      validationErrors: zodErrors,
    }, `[${requestId}] Validation error`);

    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: zodErrors,
      },
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    logger.warn({
      ...logContext,
      tokenError: err.message,
    }, `[${requestId}] JWT error: ${err.message}`);

    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: err.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token',
      },
    });
    return;
  }

  // Handle Neo4j errors
  if (err.message?.includes('Neo4j') || err.name?.includes('Neo4j')) {
    const wrappedError = wrapError(err, {
      requestId,
      operation: `${req.method} ${req.path}`,
    });
    logError(wrappedError, logContext);

    res.status(503).json({
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
        errorId: wrappedError.context.errorId,
      },
    });
    return;
  }

  // Handle unknown errors - wrap and log
  const wrappedError = wrapError(err, {
    requestId,
    operation: `${req.method} ${req.path}`,
    userId: (req as any).user?.id,
  });

  // Log the full error for debugging
  logger.error({
    ...logContext,
    errorId: wrappedError.context.errorId,
    error: err.message,
    stack: err.stack,
    name: err.name,
  }, `[${requestId}] Unhandled error: ${err.message}`);

  // Return sanitized error to client
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
      errorId: wrappedError.context.errorId,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
      }),
    },
  });
}

/**
 * Sanitize request body for logging (remove sensitive fields).
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * 404 handler for undefined routes.
 */
export function notFoundMiddleware(req: Request, res: Response): void {
  const requestId = req.requestId || 'unknown';

  logger.info({
    requestId,
    path: req.path,
    method: req.method,
  }, `[${requestId}] Route not found: ${req.method} ${req.path}`);

  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
}

/**
 * Async route wrapper to catch errors.
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Helper functions to throw common errors
export const errors = {
  notFound: (resource: string) =>
    new AppError(404, 'NOT_FOUND', `${resource} not found`),

  unauthorized: (message = 'Unauthorized') =>
    new AppError(401, 'UNAUTHORIZED', message),

  forbidden: (message = 'Access denied') =>
    new AppError(403, 'FORBIDDEN', message),

  badRequest: (message: string, details?: Record<string, unknown>) =>
    new AppError(400, 'BAD_REQUEST', message, details),

  conflict: (message: string) =>
    new AppError(409, 'CONFLICT', message),

  rateLimited: () =>
    new AppError(429, 'RATE_LIMITED', 'Too many requests'),

  internal: (message = 'An internal error occurred') =>
    new AppError(500, 'INTERNAL_ERROR', message),

  // Structured error helpers using new error classes
  validation: (message: string, fields: Record<string, string> = {}) =>
    new ValidationError(message, fields),

  authentication: (message = 'Authentication required') =>
    new AuthenticationError(message),

  authorization: (message = 'Access denied') =>
    new AuthorizationError(message),

  resourceNotFound: (resource: string) =>
    new NotFoundError(resource),

  rateLimit: (retryAfter = 60) =>
    new RateLimitError(retryAfter),
};
