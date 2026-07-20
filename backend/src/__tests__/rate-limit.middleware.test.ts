/**
 * Unit tests for the in-memory fixed-window rate limiter.
 * No network or database required — req/res are lightweight mocks.
 */
import { rateLimit } from '../middleware/rate-limit.middleware.js';

function mockReq(userId?: string, ip = '127.0.0.1'): any {
  return { user: userId ? { id: userId } : undefined, ip };
}

function mockRes() {
  const res: any = { headers: {} as Record<string, unknown> };
  res.setHeader = jest.fn((key: string, value: unknown) => {
    res.headers[key] = value;
    return res;
  });
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('rateLimit middleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows requests up to max and calls next each time', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 3, name: 'allow-test' });
    const next = jest.fn();

    for (let i = 0; i < 3; i++) {
      limiter(mockReq('user-a'), mockRes(), next);
    }

    expect(next).toHaveBeenCalledTimes(3);
  });

  it('returns 429 with RATE_LIMITED code once max is exceeded', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2, name: 'block-test' });
    const next = jest.fn();

    limiter(mockReq('user-b'), mockRes(), next);
    limiter(mockReq('user-b'), mockRes(), next);

    const res = mockRes();
    limiter(mockReq('user-b'), res, next);

    expect(next).toHaveBeenCalledTimes(2); // not called for the 3rd request
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['Retry-After']).toBeGreaterThan(0);
  });

  it('sets X-RateLimit-Limit and a decrementing X-RateLimit-Remaining header', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 5, name: 'header-test' });
    const next = jest.fn();

    const first = mockRes();
    limiter(mockReq('user-c'), first, next);
    expect(first.headers['X-RateLimit-Limit']).toBe(5);
    expect(first.headers['X-RateLimit-Remaining']).toBe(4);

    const second = mockRes();
    limiter(mockReq('user-c'), second, next);
    expect(second.headers['X-RateLimit-Remaining']).toBe(3);
  });

  it('keeps separate buckets per limiter name for the same user', () => {
    const chat = rateLimit({ windowMs: 60_000, max: 1, name: 'bucket-chat' });
    const images = rateLimit({ windowMs: 60_000, max: 1, name: 'bucket-images' });
    const next = jest.fn();

    chat(mockReq('user-d'), mockRes(), next); // exhausts chat bucket
    images(mockReq('user-d'), mockRes(), next); // separate bucket, still allowed

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('keeps separate buckets per user for the same limiter', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1, name: 'per-user-test' });
    const next = jest.fn();

    limiter(mockReq('user-e'), mockRes(), next);
    limiter(mockReq('user-f'), mockRes(), next);

    expect(next).toHaveBeenCalledTimes(2);

    const res = mockRes();
    limiter(mockReq('user-e'), res, next); // user-e is now over the limit
    expect(res.statusCode).toBe(429);
  });

  it('resets the bucket after the window elapses', () => {
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    const limiter = rateLimit({ windowMs: 10_000, max: 1, name: 'window-test' });
    const next = jest.fn();

    limiter(mockReq('user-g'), mockRes(), next);
    const blocked = mockRes();
    limiter(mockReq('user-g'), blocked, next);
    expect(blocked.statusCode).toBe(429);

    now += 10_001; // advance past the window
    limiter(mockReq('user-g'), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('falls back to the client IP when no authenticated user is present', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1, name: 'ip-test' });
    const next = jest.fn();

    limiter(mockReq(undefined, '10.0.0.1'), mockRes(), next);
    limiter(mockReq(undefined, '10.0.0.2'), mockRes(), next); // different IP, own bucket
    expect(next).toHaveBeenCalledTimes(2);

    const res = mockRes();
    limiter(mockReq(undefined, '10.0.0.1'), res, next);
    expect(res.statusCode).toBe(429);
  });
});
