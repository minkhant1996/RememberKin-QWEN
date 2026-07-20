/**
 * Utility Exports
 *
 * Central export point for all utility modules.
 *
 * @module utils
 */

// Logger
export { logger } from './logger.js';

// Error handling
export {
  // Types
  type ErrorSeverity,
  type ErrorCategory,
  type ErrorContext,
  // Base class
  AppError,
  // Specific errors
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalApiError,
  NetworkError,
  // Utilities
  wrapError,
  logError,
  safeAsync,
  ErrorAggregator,
} from './errors.js';

// JWT signing
export { signToken, type TokenPayload } from './jwt.js';

// Retry logic
export {
  // Types
  type RetryOptions,
  type RetryResult,
  type CircuitBreakerOptions,
  // Functions
  withRetry,
  withFallback,
  withCircuitBreaker,
  getCircuitStates,
  resetCircuit,
  // Decorator
  Retryable,
} from './retry.js';
