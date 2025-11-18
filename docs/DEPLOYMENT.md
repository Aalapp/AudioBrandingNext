# Deployment Guide

This guide covers deploying the Audio Branding Next.js backend to production.

## Prerequisites

- Node.js 20+ installed on server
- PostgreSQL database (AWS RDS or managed service)
- Redis instance (AWS ElastiCache or managed service)
- AWS S3 bucket configured
- Domain name and SSL certificate (for production)

## Environment Variables

Set the following environment variables in your production environment:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis
REDIS_URL=redis://host:6379

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
# Remove S3_ENDPOINT and S3_FORCE_PATH_STYLE for production AWS S3

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/callback

# Session & JWT
SESSION_SECRET=generate-strong-random-secret-min-32-chars
JWT_SECRET=generate-strong-random-secret-min-32-chars

# External APIs
PERPLEXITY_API_KEY=your-perplexity-key
REPLICATE_API_TOKEN=your-replicate-token

# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Database Migration

Run migrations in production:

```bash
npm run db:migrate:deploy
# or
make migrate-deploy
```

**Important:** Always backup your database before running migrations in production.

## Build and Start

1. Install dependencies:
```bash
npm ci
```

2. Generate Prisma Client:
```bash
npm run db:generate
```

3. Build the application:
```bash
npm run build
```

4. Start the production server:
```bash
npm start
```

## Worker Deployment

The background worker must be deployed as a separate process/service:

```bash
npm run worker
```

**Recommended:** Deploy the worker as:
- A separate Docker container
- A systemd service
- A separate process manager (PM2, supervisor, etc.)

## Docker Deployment

### Dockerfile Example

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

### Docker Compose for Production

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      # ... other env vars
    depends_on:
      - redis
    restart: unless-stopped

  worker:
    build: .
    command: npm run worker
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      # ... other env vars
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

## Security Checklist

- [ ] All environment variables are set and secure
- [ ] SESSION_SECRET and JWT_SECRET are strong random strings (32+ chars)
- [ ] Database credentials are secure and not exposed
- [ ] API keys are stored securely (use secrets manager)
- [ ] HTTPS is enabled with valid SSL certificate
- [ ] CORS is configured correctly
- [ ] Rate limiting is enabled
- [ ] Database backups are configured
- [ ] Logging is configured for production
- [ ] Error tracking is set up (Sentry, etc.)

## Monitoring

### Health Checks

Monitor the health endpoint:
- `GET /api/health` - Returns status of all services

### Logging

Structured logs are output as JSON. In production, consider:
- Sending logs to a log aggregation service (Datadog, CloudWatch, etc.)
- Setting up log rotation
- Monitoring error rates

### Metrics to Monitor

- API response times
- Job queue length
- Database connection pool usage
- Redis memory usage
- S3 storage usage
- Error rates by endpoint
- Worker job success/failure rates

## Scaling

### Horizontal Scaling

- Deploy multiple Next.js app instances behind a load balancer
- Ensure session storage is Redis-backed (not in-memory)
- Use sticky sessions or stateless JWT tokens

### Worker Scaling

- Deploy multiple worker instances
- BullMQ handles job distribution automatically
- Monitor queue length and scale workers accordingly

### Database Scaling

- Use connection pooling (Prisma handles this)
- Consider read replicas for read-heavy workloads
- Monitor query performance and optimize slow queries

## Backup Strategy

1. **Database Backups:**
   - Automated daily backups (use RDS automated backups or pg_dump)
   - Test restore procedures regularly

2. **S3 Backups:**
   - Enable S3 versioning
   - Configure lifecycle policies
   - Consider cross-region replication

3. **Configuration Backups:**
   - Version control all configuration
   - Document all environment variables

## Troubleshooting

### Common Issues

1. **Database Connection Errors:**
   - Check DATABASE_URL format
   - Verify network connectivity
   - Check security group/firewall rules

2. **Redis Connection Errors:**
   - Verify REDIS_URL format
   - Check Redis is accessible
   - Monitor Redis memory usage

3. **S3 Upload Failures:**
   - Verify AWS credentials
   - Check bucket permissions
   - Verify CORS configuration

4. **Worker Jobs Failing:**
   - Check worker logs
   - Verify external API keys (Perplexity, Replicate)
   - Check job queue for stuck jobs

### Debugging

Enable debug logging:
```bash
DEBUG=* npm run dev
```

Check worker logs:
```bash
npm run worker
# Monitor output for errors
```

## Rollback Procedure

1. Stop the application
2. Restore database from backup if needed
3. Revert code to previous version
4. Run migrations if needed: `npm run db:migrate:deploy`
5. Restart application and worker

## Performance Optimization

- Enable Next.js production optimizations
- Use CDN for static assets
- Enable database query caching where appropriate
- Optimize Prisma queries (use select, include carefully)
- Monitor and optimize slow API endpoints
- Use Redis caching for frequently accessed data

