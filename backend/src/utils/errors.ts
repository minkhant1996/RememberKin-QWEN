/**
 * Error Handling Utilities
 *
 * Provides structured error classes, error wrapping, and error logging.
 * Use these utilities for consistent error handling across the application.
 *
 * @module utils/errors
 */

import { logger } from './logger.js';

/**
 * Error severity levels for categorization and alerting.
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories for grouping and analysis.
 */
export type ErrorCategory =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'database'
  | 'external_api'
  | 'network'
  | 'business_logic'
  | 'internal'
  | 'unknown';

/**
 * Extended error context for debugging.
 */
export interface ErrorContext {
  /** Unique error ID for tracking */
  errorId: string;

  /** When the error occurred */
  timestamp: string;

  /** Service/module where error occurred */
  service?: string;

  /** Operation being performed */
  operation?: string;

  /** User ID if available */
  userId?: string;

  /** Request ID if available */
  requestId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Stack trace */
  stack?: string;

  /** Original error if wrapped */
  originalError?: Error;
}

/**
 * Base application error with enhanced context.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context: ErrorContext;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    options: {
      code?: string;
      statusCode?: number;
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      context?: Partial<ErrorContext>;
      isOperational?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message);

    this.name = 'AppError';
    this.code = options.code || 'INTERNAL_ERROR';
    this.statusCode = options.statusCode || 500;
    this.severity = options.severity || 'medium';
    this.category = options.category || 'internal';
    this.isOperational = options.isOperational ?? true;

    this.context = {
      errorId: generateErrorId(),
      timestamp: new Date().toISOString(),
      stack: this.stack,
      originalError: options.cause,
      ...options.context,
    };

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for logging/response.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      severity: this.severity,
      category: this.category,
      context: {
        errorId: this.context.errorId,
        timestamp: this.context.timestamp,
        service: this.context.service,
        operation: this.context.operation,
        requestId: this.context.requestId,
      },
    };
  }
}

// ============ SPECIFIC ERROR CLASSES ============

/**
 * Validation error for invalid input data.
 */
export class ValidationError extends AppError {
  public readonly fields: Record<string, string>;

  constructor(
    message: string,
    fields: Record<string, string> = {},
    context?: Partial<ErrorContext>
  ) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      severity: 'low',
      category: 'validation',
      context,
    });
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

/**
 * Authentication error for missing/invalid credentials.
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', context?: Partial<ErrorContext>) {
    super(message, {
      code: 'UNAUTHORIZED',
      statusCode: 401,
      severity: 'medium',
      category: 'authentication',
      context,
    });
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error for forbidden access.
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Access denied', context?: Partial<ErrorContext>) {
    super(message, {
      code: 'FORBIDDEN',
      statusCode: 403,
      severity: 'medium',
      category: 'authorization',
      context,
    });
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error for missing resources.
 */
export class NotFoundError extends AppError {
  public readonly resource: string;

  constructor(resource: string, context?: Partial<ErrorContext>) {
    super(`${resource} not found`, {
      code: 'NOT_FOUND',
      statusCode: 404,
      severity: 'low',
      category: 'business_logic',
      context,
    });
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

/**
 * Conflict error for duplicate resources.
 */
export class ConflictError extends AppError {
  constructor(message: string, context?: Partial<ErrorContext>) {
    super(message, {
      code: 'CONFLICT',
      statusCode: 409,
      severity: 'low',
      category: 'business_logic',
      context,
    });
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error for too many requests.
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter = 60, context?: Partial<ErrorContext>) {
    super('Too many requests', {
      code: 'RATE_LIMITED',
      statusCode: 429,
      severity: 'low',
      category: 'business_logic',
      context,
    });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Database error for database operation failures.
 */
export class DatabaseError extends AppError {
  constructor(message: string, cause?: Error, context?: Partial<ErrorContext>) {
    super(message, {
      code: 'DATABASE_ERROR',
      statusCode: 500,
      severity: 'high',
      category: 'database',
      context,
      cause,
    });
    this.name = 'DatabaseError';
  }
}

/**
 * External API error for third-party service failures.
 */
export class ExternalApiError extends AppError {
  public readonly service: string;
  public readonly originalStatus?: number;

  constructor(
    service: string,
    message: string,
    options: {
      originalStatus?: number;
      cause?: Error;
      context?: Partial<ErrorContext>;
    } = {}
  ) {
    super(`${service} API error: ${message}`, {
      code: 'EXTERNAL_API_ERROR',
      statusCode: 502,
      severity: 'high',
      category: 'external_api',
      context: options.context,
      cause: options.cause,
    });
    this.name = 'ExternalApiError';
    this.service = service;
    this.originalStatus = options.originalStatus;
  }
}

/**
 * Network error for connection failures.
 */
export class NetworkError extends AppError {
  constructor(message: string, cause?: Error, context?: Partial<ErrorContext>) {
    super(message, {
      code: 'NETWORK_ERROR',
      statusCode: 503,
      severity: 'high',
      category: 'network',
      context,
      cause,
    });
    this.name = 'NetworkError';
  }
}

// ============ ERROR UTILITIES ============

/**
 * Generate a unique error ID for tracking.
 */
function generateErrorId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `err_${timestamp}_${random}`;
}

/**
 * Wrap an unknown error in an AppError.
 */
export function wrapError(
  error: unknown,
  context?: Partial<ErrorContext>
): AppError {
  if (error instanceof AppError) {
    // Already an AppError, just add context if provided
    if (context) {
      Object.assign(error.context, context);
    }
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, {
      code: 'WRAPPED_ERROR',
      category: categorizeError(error),
      context: {
        ...context,
        originalError: error,
      },
      cause: error,
    });
  }

  // Handle non-Error objects
  const message = typeof error === 'string' ? error : 'An unknown error occurred';
  return new AppError(message, {
    code: 'UNKNOWN_ERROR',
    category: 'unknown',
    context: {
      ...context,
      metadata: { originalValue: error },
    },
  });
}

/**
 * Categorize an error based on its message/type.
 */
function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();

  if (message.includes('validation') || message.includes('invalid')) {
    return 'validation';
  }
  if (message.includes('auth') || message.includes('token') || message.includes('credential')) {
    return 'authentication';
  }
  if (message.includes('permission') || message.includes('forbidden') || message.includes('access')) {
    return 'authorization';
  }
  if (message.includes('database') || message.includes('neo4j') || message.includes('qdrant')) {
    return 'database';
  }
  if (message.includes('network') || message.includes('econnrefused') || message.includes('timeout')) {
    return 'network';
  }
  if (message.includes('api') || message.includes('qwen') || message.includes('external')) {
    return 'external_api';
  }

  return 'internal';
}

/**
 * Log an error with full context.
 */
export function logError(
  error: Error | AppError,
  additionalContext?: Record<string, unknown>
): void {
  const appError = error instanceof AppError ? error : wrapError(error);

  const logData = {
    errorId: appError.context.errorId,
    code: appError.code,
    message: appError.message,
    statusCode: appError.statusCode,
    severity: appError.severity,
    category: appError.category,
    service: appError.context.service,
    operation: appError.context.operation,
    userId: appError.context.userId,
    requestId: appError.context.requestId,
    metadata: appError.context.metadata,
    stack: appError.stack,
    originalError: appError.context.originalError?.message,
    ...additionalContext,
  };

  // Log based on severity
  switch (appError.severity) {
    case 'critical':
      logger.fatal(logData, `CRITICAL: ${appError.message}`);
      break;
    case 'high':
      logger.error(logData, appError.message);
      break;
    case 'medium':
      logger.warn(logData, appError.message);
      break;
    case 'low':
      logger.info(logData, appError.message);
      break;
  }
}

/**
 * Create a safe async handler that catches and wraps errors.
 */
export function safeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Partial<ErrorContext>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = wrapError(error, context);
      logError(appError);
      throw appError;
    }
  }) as T;
}

/**
 * Error aggregator for collecting multiple errors.
 */
export class ErrorAggregator {
  private errors: AppError[] = [];

  add(error: Error | AppError): void {
    this.errors.push(error instanceof AppError ? error : wrapError(error));
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): AppError[] {
    return [...this.errors];
  }

  clear(): void {
    this.errors = [];
  }

  throw(): void {
    if (this.errors.length === 0) return;

    if (this.errors.length === 1) {
      throw this.errors[0];
    }

    const combined = new AppError(
      `Multiple errors occurred: ${this.errors.map((e) => e.message).join('; ')}`,
      {
        code: 'MULTIPLE_ERRORS',
        severity: this.getHighestSeverity(),
        context: {
          metadata: {
            errorCount: this.errors.length,
            errors: this.errors.map((e) => e.toJSON()),
          },
        },
      }
    );
    throw combined;
  }

  private getHighestSeverity(): ErrorSeverity {
    const severityOrder: ErrorSeverity[] = ['low', 'medium', 'high', 'critical'];
    let highest = 0;
    for (const error of this.errors) {
      const index = severityOrder.indexOf(error.severity);
      if (index > highest) highest = index;
    }
    return severityOrder[highest];
  }
}
