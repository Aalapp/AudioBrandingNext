import { rateLimit, rateLimitByIP, createRateLimitResponse } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';

// Create mock redis instance that will be reused
const mockRedisInstance = {
  get: jest.fn(),
  setex: jest.fn(),
  incr: jest.fn(),
  ttl: jest.fn().mockResolvedValue(60),
  ping: jest.fn(),
};

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => mockRedisInstance),
}));

describe('Rate Limit Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisInstance.get = jest.fn();
    mockRedisInstance.setex = jest.fn();
    mockRedisInstance.incr = jest.fn();
    mockRedisInstance.ttl = jest.fn().mockResolvedValue(60);
    mockRedisInstance.ping = jest.fn();
  });

  describe('rateLimit', () => {
    it('should allow request when under limit', async () => {
      mockRedisInstance.get.mockResolvedValue('5'); // 5 requests so far
      mockRedisInstance.incr.mockResolvedValue(6);

      const request = new NextRequest('http://localhost:3000/api/test');
      const result = await rateLimit(request, {
        windowMs: 60000,
        maxRequests: 10,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should block request when over limit', async () => {
      mockRedisInstance.get.mockResolvedValue('10'); // Already at limit
      mockRedisInstance.ttl.mockResolvedValue(30);

      const request = new NextRequest('http://localhost:3000/api/test');
      const result = await rateLimit(request, {
        windowMs: 60000,
        maxRequests: 10,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should set expiration on first request', async () => {
      mockRedisInstance.get.mockResolvedValue(null); // First request
      mockRedisInstance.setex.mockResolvedValue('OK');

      const request = new NextRequest('http://localhost:3000/api/test');
      await rateLimit(request, {
        windowMs: 60000,
        maxRequests: 10,
      });

      expect(mockRedisInstance.setex).toHaveBeenCalled();
    });
  });

  describe('createRateLimitResponse', () => {
    it('should create rate limit response with headers', () => {
      const resetAt = new Date(Date.now() + 60000);
      const response = createRateLimitResponse(0, resetAt);

      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });
  });
});

