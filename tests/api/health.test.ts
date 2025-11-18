import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/db';
import Redis from 'ioredis';

jest.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn(),
  }));
});

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  ListBucketsCommand: jest.fn(),
}));

describe('Health API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return healthy status when all services are up', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
    
    const mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
    };
    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);

    const { S3Client, ListBucketsCommand } = await import('@aws-sdk/client-s3');
    const mockS3Client = {
      send: jest.fn().mockResolvedValue({}),
    };
    (S3Client as jest.Mock).mockImplementation(() => mockS3Client);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.services.database.status).toBe('ok');
    expect(data.services.redis.status).toBe('ok');
  });

  it('should return degraded status when a service is down', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB connection failed'));
    
    const mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
    };
    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.services.database.status).toBe('error');
  });
});

