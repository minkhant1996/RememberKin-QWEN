/**
 * Middleware Exports
 *
 * Central export point for all middleware modules.
 *
 * @module middleware
 */

// Authentication
export { authMiddleware } from './auth.middleware.js';

// Error handling
export {
  AppError,
  errorMiddleware,
  notFoundMiddleware,
  asyncHandler,
  errors,
} from './error.middleware.js';

// Logging
export {
  // Types
  type StageTracker,
  // Middleware
  requestLoggingMiddleware,
  // Utilities
  createStageTracker,
  createOperationLogger,
  withLogging,
  OperationLogger,
} from './logging.middleware.js';
