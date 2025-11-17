import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required for BullMQ compatibility
});

export async function GET() {
  const health: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = { status: 'ok' };
  } catch (error: any) {
    health.services.database = {
      status: 'error',
      error: error.message,
    };
    health.status = 'degraded';
  }

  // Check Redis
  try {
    await redis.ping();
    health.services.redis = { status: 'ok' };
  } catch (error: any) {
    health.services.redis = {
      status: 'error',
      error: error.message,
    };
    health.status = 'degraded';
  }

  // Check S3 (basic connectivity)
  try {
    const { S3Client, ListBucketsCommand } = await import('@aws-sdk/client-s3');
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      ...(process.env.S3_ENDPOINT && {
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      }),
    });

    await s3Client.send(new ListBucketsCommand({}));
    health.services.s3 = { status: 'ok' };
  } catch (error: any) {
    health.services.s3 = {
      status: 'error',
      error: error.message,
    };
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}

