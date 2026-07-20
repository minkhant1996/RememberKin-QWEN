/**
 * Logging Middleware
 *
 * Provides comprehensive request/response logging with:
 * - Request timing and performance metrics
 * - Stage-based logging for tracking operation progress
 * - Error correlation via request IDs
 * - Structured logging for production analysis
 *
 * @module middleware/logging
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

/**
 * Stage tracking for complex operations.
 */
export interface StageTracker {
  /** Unique request ID */
  requestId: string;

  /** Start a new stage */
  start(stageName: string): void;

  /** End the current stage */
  end(stageName: string, metadata?: Record<string, unknown>): void;

  /** Log stage progress */
  progress(stageName: string, message: string, metadata?: Record<string, unknown>): void;

  /** Get timing summary */
  getSummary(): StageSummary;
}

interface StageInfo {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

interface StageSummary {
  requestId: string;
  totalDuration: number;
  stages: StageInfo[];
}

/**
 * Create a stage tracker for a request.
 */
export function createStageTracker(requestId: string): StageTracker {
  const stages: Map<string, StageInfo> = new Map();
  const requestStart = Date.now();

  return {
    requestId,

    start(stageName: string) {
      stages.set(stageName, {
        name: stageName,
        startTime: Date.now(),
      });

      logger.debug({
        requestId,
        stage: stageName,
        event: 'stage_start',
      }, `[${requestId}] Stage started: ${stageName}`);
    },

    end(stageName: string, metadata?: Record<string, unknown>) {
      const stage = stages.get(stageName);
      if (stage) {
        stage.endTime = Date.now();
        stage.duration = stage.endTime - stage.startTime;
        stage.metadata = metadata;

        logger.debug({
          requestId,
          stage: stageName,
          event: 'stage_end',
          duration: stage.duration,
          ...metadata,
        }, `[${requestId}] Stage completed: ${stageName} (${stage.duration}ms)`);
      }
    },

    progress(stageName: string, message: string, metadata?: Record<string, unknown>) {
      logger.debug({
        requestId,
        stage: stageName,
        event: 'stage_progress',
        ...metadata,
      }, `[${requestId}] ${stageName}: ${message}`);
    },

    getSummary(): StageSummary {
      return {
        requestId,
        totalDuration: Date.now() - requestStart,
        stages: Array.from(stages.values()),
      };
    },
  };
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
      stages: StageTracker;
    }
  }
}

/**
 * Request logging middleware.
 * Adds request ID, timing, and stage tracking to each request.
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate unique request ID
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.requestId = requestId;
  req.startTime = Date.now();
  req.stages = createStageTracker(requestId);

  // Add request ID to response headers
  res.setHeader('X-Request-Id', requestId);

  // Log incoming request
  logger.info({
    requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: (req as any).user?.id,
  }, `[${requestId}] ${req.method} ${req.path}`);

  // Start request stage
  req.stages.start('request');

  // Capture response finish
  res.on('finish', () => {
    req.stages.end('request');

    const duration = Date.now() - req.startTime;
    const summary = req.stages.getSummary();

    const logData = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      stages: summary.stages.map((s) => ({
        name: s.name,
        duration: s.duration,
      })),
      userId: (req as any).user?.id,
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error(logData, `[${requestId}] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    } else if (res.statusCode >= 400) {
      logger.warn(logData, `[${requestId}] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    } else {
      logger.info(logData, `[${requestId}] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    }

    // Log slow requests
    if (duration > 3000) {
      logger.warn({
        requestId,
        duration,
        stages: summary.stages,
      }, `[${requestId}] Slow request detected: ${duration}ms`);
    }
  });

  next();
}

/**
 * Operation logging helper for use within routes/services.
 */
export class OperationLogger {
  private requestId: string;
  private operationName: string;
  private startTime: number;
  private stages: { name: string; start: number; end?: number }[] = [];
  private currentStage?: string;

  constructor(requestId: string, operationName: string) {
    this.requestId = requestId;
    this.operationName = operationName;
    this.startTime = Date.now();

    logger.debug({
      requestId,
      operation: operationName,
      event: 'operation_start',
    }, `[${requestId}] Operation started: ${operationName}`);
  }

  /**
   * Start a named stage within the operation.
   */
  stage(name: string): this {
    if (this.currentStage) {
      // End previous stage
      const prev = this.stages.find((s) => s.name === this.currentStage);
      if (prev) prev.end = Date.now();
    }

    this.currentStage = name;
    this.stages.push({ name, start: Date.now() });

    logger.debug({
      requestId: this.requestId,
      operation: this.operationName,
      stage: name,
    }, `[${this.requestId}] ${this.operationName} -> ${name}`);

    return this;
  }

  /**
   * Log progress within current stage.
   */
  log(message: string, data?: Record<string, unknown>): this {
    logger.debug({
      requestId: this.requestId,
      operation: this.operationName,
      stage: this.currentStage,
      ...data,
    }, `[${this.requestId}] ${this.operationName}: ${message}`);

    return this;
  }

  /**
   * Log a warning.
   */
  warn(message: string, data?: Record<string, unknown>): this {
    logger.warn({
      requestId: this.requestId,
      operation: this.operationName,
      stage: this.currentStage,
      ...data,
    }, `[${this.requestId}] ${this.operationName}: ${message}`);

    return this;
  }

  /**
   * Log an error.
   */
  error(message: string, error?: Error, data?: Record<string, unknown>): this {
    logger.error({
      requestId: this.requestId,
      operation: this.operationName,
      stage: this.currentStage,
      error: error?.message,
      stack: error?.stack,
      ...data,
    }, `[${this.requestId}] ${this.operationName}: ${message}`);

    return this;
  }

  /**
   * Complete the operation and log summary.
   */
  complete(metadata?: Record<string, unknown>): void {
    // End current stage if active
    if (this.currentStage) {
      const current = this.stages.find((s) => s.name === this.currentStage);
      if (current) current.end = Date.now();
    }

    const totalDuration = Date.now() - this.startTime;
    const stageTimings = this.stages.map((s) => ({
      name: s.name,
      duration: (s.end || Date.now()) - s.start,
    }));

    logger.info({
      requestId: this.requestId,
      operation: this.operationName,
      event: 'operation_complete',
      duration: totalDuration,
      stages: stageTimings,
      ...metadata,
    }, `[${this.requestId}] Operation completed: ${this.operationName} (${totalDuration}ms)`);
  }

  /**
   * Mark operation as failed.
   */
  fail(error: Error, metadata?: Record<string, unknown>): void {
    const totalDuration = Date.now() - this.startTime;

    logger.error({
      requestId: this.requestId,
      operation: this.operationName,
      event: 'operation_failed',
      duration: totalDuration,
      error: error.message,
      stack: error.stack,
      ...metadata,
    }, `[${this.requestId}] Operation failed: ${this.operationName} (${totalDuration}ms)`);
  }
}

/**
 * Create an operation logger.
 */
export function createOperationLogger(req: Request, operationName: string): OperationLogger {
  return new OperationLogger(req.requestId, operationName);
}

/**
 * Async operation wrapper with automatic logging.
 */
export async function withLogging<T>(
  req: Request,
  operationName: string,
  fn: (logger: OperationLogger) => Promise<T>
): Promise<T> {
  const opLogger = createOperationLogger(req, operationName);

  try {
    const result = await fn(opLogger);
    opLogger.complete();
    return result;
  } catch (error) {
    opLogger.fail(error as Error);
    throw error;
  }
}
