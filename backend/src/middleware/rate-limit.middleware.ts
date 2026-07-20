/**
 * Lightweight in-memory rate limiter (fixed window per key).
 *
 * Keys on the authenticated user id when available, otherwise the client IP.
 * Suitable for a single-instance deployment (the hackathon setup pins one
 * warm Function Compute instance / one ECS container).
 */
import { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Separate buckets per limiter so /chat and /images don't share counters */
  name: string;
}

const buckets = new Map<string, Bucket>();

// Purge expired buckets periodically so the map never grows unbounded
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref();

export function rateLimit({ windowMs, max, name }: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const who = (req as any).user?.id || req.ip || 'unknown';
    const key = `${name}:${who}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count++;
    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (bucket.count > max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests — try again in ${retryAfterSec}s.`,
        },
      });
    }

    next();
  };
}
