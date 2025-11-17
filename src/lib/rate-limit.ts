import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

/**
 * Get client IP address from request headers
 */
function getClientIP(request: NextRequest): string {
  // Check x-forwarded-for header (first IP if behind proxy)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  // Check x-real-ip header
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

// Use Upstash Redis for Edge runtime compatibility (used in middleware)
// For local development, rate limiting is optional (disabled if credentials not provided)
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
}

/**
 * Rate limit middleware
 * If Redis is not configured (local dev), allows all requests
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const { windowMs, maxRequests, keyGenerator } = config;

  // If Redis is not configured (local development), allow all requests
  if (!redis) {
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: new Date(Date.now() + windowMs),
    };
  }

  // Generate rate limit key
  const key = keyGenerator
    ? keyGenerator(request)
    : `rate-limit:${getClientIP(request)}`;

  // Get current count
  const current = await redis.get(key);
  const count = current ? (typeof current === 'string' ? parseInt(current, 10) : Number(current)) : 0;

  if (count >= maxRequests) {
    // Get TTL to calculate reset time
    // Upstash TTL returns -1 if no expiry, -2 if key doesn't exist, or seconds remaining
    const ttl = await redis.ttl(key);
    const ttlSeconds = ttl > 0 ? ttl : Math.ceil(windowMs / 1000);
    const resetAt = new Date(Date.now() + ttlSeconds * 1000);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // Increment counter
  if (count === 0) {
    // First request in window, set with expiration
    await redis.setex(key, Math.ceil(windowMs / 1000), '1');
  } else {
    await redis.incr(key);
  }

  const remaining = maxRequests - count - 1;
  // Get TTL for reset time calculation
  const ttl = await redis.ttl(key);
  const ttlSeconds = ttl > 0 ? ttl : Math.ceil(windowMs / 1000);
  const resetAt = new Date(Date.now() + ttlSeconds * 1000);

  return {
    allowed: true,
    remaining,
    resetAt,
  };
}

/**
 * Rate limit by user ID
 */
export function rateLimitByUser(userId: string) {
  return (request: NextRequest) => `rate-limit:user:${userId}`;
}

/**
 * Rate limit by IP
 */
export function rateLimitByIP(request: NextRequest) {
  return `rate-limit:ip:${getClientIP(request)}`;
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(
  remaining: number,
  resetAt: Date
): NextResponse {
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      remaining,
      resetAt: resetAt.toISOString(),
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetAt.toISOString(),
      },
    }
  );
}

