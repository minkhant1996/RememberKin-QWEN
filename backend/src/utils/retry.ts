/**
 * Retry Utility
 *
 * Provides retry logic with exponential backoff for handling transient failures.
 * Use for external API calls, database operations, and other unreliable operations.
 *
 * @module utils/retry
 */

import { logger } from './logger.js';

/**
 * Configuration options for retry behavior.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;

  /** Initial delay in milliseconds before first retry (default: 1000) */
  initialDelay?: number;

  /** Maximum delay in milliseconds between retries (default: 30000) */
  maxDelay?: number;

  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;

  /** Whether to add random jitter to delay (default: true) */
  jitter?: boolean;

  /** Custom function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;

  /** Operation name for logging */
  operationName?: string;

  /** Callback called before each retry */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * Result of a retry operation including metadata.
 */
export interface RetryResult<T> {
  /** The successful result */
  data: T;

  /** Number of attempts made (1 = succeeded on first try) */
  attempts: number;

  /** Total time spent including retries in milliseconds */
  totalTime: number;
}

/**
 * Default retry options.
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'isRetryable' | 'operationName'>> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Default function to determine if an error is retryable.
 * Retries on network errors, timeouts, and 5xx server errors.
 */
function defaultIsRetryable(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network errors
  if (
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('enotfound') ||
    message.includes('socket hang up') ||
    message.includes('network') ||
    message.includes('timeout')
  ) {
    return true;
  }

  // HTTP 5xx errors (server errors)
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
    return true;
  }

  // Rate limiting
  if (message.includes('429') || message.includes('rate limit')) {
    return true;
  }

  return false;
}

/**
 * Calculate delay with optional jitter.
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  let delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);

  // Cap at maxDelay
  delay = Math.min(delay, maxDelay);

  // Add jitter (±25%)
  if (jitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
    delay = Math.floor(delay * jitterFactor);
  }

  return delay;
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async function with retry logic and exponential backoff.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the result with metadata
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await withRetry(
 *   () => fetchExternalApi(),
 *   { maxAttempts: 5, operationName: 'fetchApi' }
 * );
 *
 * // With custom retry logic
 * const result = await withRetry(
 *   () => callQwenApi(prompt),
 *   {
 *     maxAttempts: 3,
 *     initialDelay: 2000,
 *     isRetryable: (err) => err.message.includes('rate limit'),
 *     onRetry: (attempt, err) => console.log(`Retry ${attempt}: ${err.message}`)
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const isRetryable = options.isRetryable || defaultIsRetryable;
  const operationName = options.operationName || 'operation';
  const startTime = Date.now();

  let lastError: Error = new Error('No attempts made');
  let attempt = 0;

  while (attempt < config.maxAttempts) {
    attempt++;

    try {
      logger.debug({
        operation: operationName,
        attempt,
        maxAttempts: config.maxAttempts,
      }, `Attempting ${operationName}`);

      const data = await fn();

      const totalTime = Date.now() - startTime;

      if (attempt > 1) {
        logger.info({
          operation: operationName,
          attempts: attempt,
          totalTime,
        }, `${operationName} succeeded after ${attempt} attempts`);
      }

      return { data, attempts: attempt, totalTime };
    } catch (error: any) {
      lastError = error;

      logger.warn({
        operation: operationName,
        attempt,
        maxAttempts: config.maxAttempts,
        error: error.message,
        stack: error.stack,
      }, `${operationName} failed on attempt ${attempt}`);

      // Check if we should retry
      if (attempt >= config.maxAttempts) {
        logger.error({
          operation: operationName,
          attempts: attempt,
          error: error.message,
          totalTime: Date.now() - startTime,
        }, `${operationName} failed after ${attempt} attempts, giving up`);
        break;
      }

      if (!isRetryable(error)) {
        logger.error({
          operation: operationName,
          attempt,
          error: error.message,
        }, `${operationName} failed with non-retryable error`);
        break;
      }

      // Calculate delay and wait
      const delay = calculateDelay(
        attempt,
        config.initialDelay,
        config.maxDelay,
        config.backoffMultiplier,
        config.jitter
      );

      logger.debug({
        operation: operationName,
        attempt,
        delay,
      }, `Waiting ${delay}ms before retry`);

      // Call onRetry callback if provided
      if (options.onRetry) {
        options.onRetry(attempt, error, delay);
      }

      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Decorator version of withRetry for class methods.
 *
 * @example
 * ```typescript
 * class ApiService {
 *   @Retryable({ maxAttempts: 3, operationName: 'getEmbedding' })
 *   async getEmbedding(text: string): Promise<number[]> {
 *     return await qwenClient.embeddings.create({ ... });
 *   }
 * }
 * ```
 */
export function Retryable(options: RetryOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await withRetry(
        () => originalMethod.apply(this, args),
        { ...options, operationName: options.operationName || propertyKey }
      );
      return result.data;
    };

    return descriptor;
  };
}

/**
 * Execute multiple async functions with retry, stopping on first success.
 * Useful for fallback strategies.
 *
 * @example
 * ```typescript
 * const result = await withFallback([
 *   () => primaryApi.call(),
 *   () => secondaryApi.call(),
 *   () => tertiaryApi.call(),
 * ], { operationName: 'apiCall' });
 * ```
 */
export async function withFallback<T>(
  fns: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  const errors: Error[] = [];

  for (let i = 0; i < fns.length; i++) {
    try {
      const result = await withRetry(fns[i], {
        ...options,
        operationName: `${options.operationName || 'operation'}_fallback_${i}`,
      });

      return {
        ...result,
        totalTime: Date.now() - startTime,
      };
    } catch (error: any) {
      errors.push(error);
      logger.warn({
        fallbackIndex: i,
        error: error.message,
      }, `Fallback ${i} failed, trying next`);
    }
  }

  // All fallbacks failed
  const combinedError = new Error(
    `All ${fns.length} fallbacks failed: ${errors.map((e) => e.message).join('; ')}`
  );
  throw combinedError;
}

/**
 * Circuit breaker state.
 */
interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuits: Map<string, CircuitState> = new Map();

/**
 * Circuit breaker options.
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;

  /** Time in ms to wait before trying again (default: 60000) */
  resetTimeout?: number;

  /** Circuit name for tracking */
  name: string;
}

/**
 * Execute with circuit breaker pattern to prevent cascading failures.
 *
 * @example
 * ```typescript
 * const result = await withCircuitBreaker(
 *   () => externalService.call(),
 *   { name: 'externalService', failureThreshold: 3, resetTimeout: 30000 }
 * );
 * ```
 */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: CircuitBreakerOptions
): Promise<T> {
  const { name, failureThreshold = 5, resetTimeout = 60000 } = options;

  // Get or create circuit state
  if (!circuits.has(name)) {
    circuits.set(name, { failures: 0, lastFailure: 0, state: 'closed' });
  }
  const circuit = circuits.get(name)!;

  // Check circuit state
  if (circuit.state === 'open') {
    const timeSinceFailure = Date.now() - circuit.lastFailure;
    if (timeSinceFailure < resetTimeout) {
      logger.warn({ circuit: name }, 'Circuit is open, rejecting request');
      throw new Error(`Circuit breaker '${name}' is open`);
    }
    // Transition to half-open
    circuit.state = 'half-open';
    logger.info({ circuit: name }, 'Circuit transitioning to half-open');
  }

  try {
    const result = await fn();

    // Success - reset circuit
    if (circuit.state === 'half-open') {
      logger.info({ circuit: name }, 'Circuit closing after successful request');
    }
    circuit.failures = 0;
    circuit.state = 'closed';

    return result;
  } catch (error: any) {
    circuit.failures++;
    circuit.lastFailure = Date.now();

    if (circuit.failures >= failureThreshold) {
      circuit.state = 'open';
      logger.error({
        circuit: name,
        failures: circuit.failures,
      }, 'Circuit opened after threshold reached');
    }

    throw error;
  }
}

/**
 * Get current circuit breaker states for monitoring.
 */
export function getCircuitStates(): Record<string, CircuitState> {
  const states: Record<string, CircuitState> = {};
  circuits.forEach((state, name) => {
    states[name] = { ...state };
  });
  return states;
}

/**
 * Reset a specific circuit breaker.
 */
export function resetCircuit(name: string): void {
  if (circuits.has(name)) {
    circuits.set(name, { failures: 0, lastFailure: 0, state: 'closed' });
    logger.info({ circuit: name }, 'Circuit manually reset');
  }
}
