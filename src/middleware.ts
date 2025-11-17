import { NextRequest, NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE_NAME } from './lib/auth';
import { rateLimit, rateLimitByIP, createRateLimitResponse } from './lib/rate-limit';
import { createLogger } from './lib/logger';
import { nanoid } from 'nanoid';

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

// Routes that require authentication
const protectedRoutes = [
  '/api/projects',
  '/api/files',
  '/api/analysis',
  '/api/artifacts',
  '/api/jobs',
];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/signin', '/welcome'];

// Rate limit configurations
const rateLimitConfigs: Record<string, { windowMs: number; maxRequests: number }> = {
  '/api/files/presign': { windowMs: 60 * 1000, maxRequests: 10 },
  '/api/analysis/start': { windowMs: 60 * 1000, maxRequests: 5 },
  '/api/analysis': { windowMs: 60 * 1000, maxRequests: 2 }, // Finalize endpoint
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Generate request ID for logging
  const requestId = nanoid();
  const logger = createLogger(requestId);

  // Get client IP
  const clientIP = getClientIP(request);
  
  // Log request
  logger.info('Request received', {
    method: request.method,
    pathname,
    ip: clientIP,
  });

  // Apply rate limiting for specific endpoints
  const rateLimitConfig = Object.entries(rateLimitConfigs).find(([path]) =>
    pathname.startsWith(path)
  );

  if (rateLimitConfig) {
    const [path, config] = rateLimitConfig;
    const result = await rateLimit(request, {
      ...config,
      keyGenerator: rateLimitByIP,
    });

    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        pathname,
        ip: clientIP,
        remaining: result.remaining,
      });

      return createRateLimitResponse(result.remaining, result.resetAt);
    }

    // Add rate limit headers
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.resetAt.toISOString());
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSession(sessionCookie);

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Redirect to signin if accessing protected route without session
  if (isProtectedRoute && !session) {
    logger.info('Redirecting to signin', { pathname });
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect to dashboard if accessing auth routes with session
  if (isAuthRoute && session) {
    logger.info('Redirecting to dashboard', { pathname });
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Add request ID to response headers
  const response = NextResponse.next();
  response.headers.set('X-Request-ID', requestId);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

