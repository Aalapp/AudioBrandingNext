import { POST as startPOST } from '@/app/api/analysis/start/route';
import { GET as statusGET } from '@/app/api/analysis/[id]/status/route';
import { GET as resultGET } from '@/app/api/analysis/[id]/result/route';
import { jsonRequest, mockUser } from './test-helpers';
import { requireAuth } from '@/lib/auth';
import { verifyProjectOwnership } from '@/lib/projects';
import { prisma } from '@/lib/db';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn(),
  }));
});

// Store mock function reference in a way that works with hoisting
const mockQueueAdd = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
  })),
}));

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/projects', () => ({
  verifyProjectOwnership: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    analysis: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

describe('Analysis API Routes', () => {
  const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;
  const verifyProjectOwnershipMock = verifyProjectOwnership as jest.MockedFunction<
    typeof verifyProjectOwnership
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthMock.mockResolvedValue(mockUser);
    verifyProjectOwnershipMock.mockResolvedValue(true);
    mockQueueAdd.mockResolvedValue({ id: 'job-1' });
  });

  describe('POST /api/analysis/start', () => {
    it('starts an exploratory analysis and enqueues a job', async () => {
      const mockAnalysis = {
        id: 'analysis-1',
        projectId: 'project-1',
        kind: 'exploratory',
        status: 'pending',
        startedAt: new Date(),
      };

      (prisma.analysis.create as jest.Mock).mockResolvedValue(mockAnalysis);

      const request = jsonRequest('/api/analysis/start', 'POST', {
        projectId: 'project-1',
        seedPrompt: 'Analyze this brand',
      });

      const response = await startPOST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toMatchObject({
        id: 'analysis-1',
        status: 'pending',
        kind: 'exploratory',
      });
      expect(prisma.analysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project-1',
          kind: 'exploratory',
        }),
      });
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'exploratory-analysis',
        expect.objectContaining({
          analysisId: 'analysis-1',
          projectId: 'project-1',
          seedPrompt: 'Analyze this brand',
        }),
        expect.objectContaining({
          jobId: 'analysis-analysis-1',
          attempts: 3,
        })
      );
    });

    it('returns 404 when project is not accessible', async () => {
      verifyProjectOwnershipMock.mockResolvedValue(false);

      const request = jsonRequest('/api/analysis/start', 'POST', {
        projectId: 'project-1',
        seedPrompt: 'Test',
      });

      const response = await startPOST(request);

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        error: 'Project not found or access denied',
      });
      expect(prisma.analysis.create).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid payload', async () => {
      const request = jsonRequest('/api/analysis/start', 'POST', {
        seedPrompt: 'missing project id',
      });

      const response = await startPOST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation error');
    });

    it('returns 401 when auth fails', async () => {
      requireAuthMock.mockRejectedValue(new Error('Unauthorized'));

      const request = jsonRequest('/api/analysis/start', 'POST', {
        projectId: 'project-1',
      });

      const response = await startPOST(request);

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
    });
  });

  describe('GET /api/analysis/[id]/status', () => {
    it('returns analysis status including partial result', async () => {
      (prisma.analysis.findUnique as jest.Mock).mockResolvedValue({
        id: 'analysis-1',
        projectId: 'project-1',
        kind: 'exploratory',
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
        failureReason: null,
        responseJson: { progress: 50 },
        project: {
          id: 'project-1',
          ownerId: mockUser.id,
        },
      });

      const response = await statusGET(
        jsonRequest('/api/analysis/analysis-1/status'),
        { params: { id: 'analysis-1' } }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        id: 'analysis-1',
        status: 'running',
        partialResult: { progress: 50 },
      });
    });

    it('returns 404 when analysis does not exist', async () => {
      (prisma.analysis.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await statusGET(
        jsonRequest('/api/analysis/missing/status'),
        { params: { id: 'missing' } }
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: 'Analysis not found' });
    });

    it('returns 403 when user lacks project access', async () => {
      (prisma.analysis.findUnique as jest.Mock).mockResolvedValue({
        id: 'analysis-1',
        projectId: 'project-2',
        project: { id: 'project-2', ownerId: 'other-user' },
      });
      verifyProjectOwnershipMock.mockResolvedValue(false);

      const response = await statusGET(
        jsonRequest('/api/analysis/analysis-1/status'),
        { params: { id: 'analysis-1' } }
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: 'Access denied' });
    });
  });

  describe('GET /api/analysis/[id]/result', () => {
    it('returns completed analysis result', async () => {
      (prisma.analysis.findUnique as jest.Mock).mockResolvedValue({
        id: 'analysis-1',
        projectId: 'project-1',
        kind: 'exploratory',
        status: 'done',
        responseJson: { positioning: 'Test' },
        startedAt: new Date(),
        finishedAt: new Date(),
        project: { id: 'project-1', ownerId: mockUser.id },
      });

      const response = await resultGET(
        jsonRequest('/api/analysis/analysis-1/result'),
        { params: { id: 'analysis-1' } }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        id: 'analysis-1',
        status: 'done',
        responseJson: { positioning: 'Test' },
      });
    });

    it('returns 400 when analysis is not done', async () => {
      (prisma.analysis.findUnique as jest.Mock).mockResolvedValue({
        id: 'analysis-1',
        projectId: 'project-1',
        status: 'running',
        project: { id: 'project-1', ownerId: mockUser.id },
      });

      const response = await resultGET(
        jsonRequest('/api/analysis/analysis-1/result'),
        { params: { id: 'analysis-1' } }
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: 'Analysis not completed',
        status: 'running',
      });
    });

    it('returns 404 when analysis is missing', async () => {
      (prisma.analysis.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await resultGET(
        jsonRequest('/api/analysis/missing/result'),
        { params: { id: 'missing' } }
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: 'Analysis not found' });
    });

    it('returns 403 when user cannot access project', async () => {
      (prisma.analysis.findUnique as jest.Mock).mockResolvedValue({
        id: 'analysis-1',
        projectId: 'project-2',
        status: 'done',
        responseJson: {},
        project: { id: 'project-2', ownerId: 'other' },
      });
      verifyProjectOwnershipMock.mockResolvedValue(false);

      const response = await resultGET(
        jsonRequest('/api/analysis/analysis-1/result'),
        { params: { id: 'analysis-1' } }
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: 'Access denied' });
    });
  });
});

