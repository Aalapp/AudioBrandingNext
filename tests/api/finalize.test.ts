import { POST as finalizePOST } from '@/app/api/analysis/[id]/finalize/route';
import { GET as artifactsGET } from '@/app/api/analyses/[id]/artifacts/route';
import { jsonRequest, mockUser, readStream } from './test-helpers';
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
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    artifact: {
      findMany: jest.fn(),
    },
  },
}));

describe('Finalize API Routes', () => {
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

  describe('POST /api/analysis/[id]/finalize', () => {
    it('creates a finalize analysis and enqueues job', async () => {
      const mockExploratoryAnalysis = {
        id: 'analysis-1',
        projectId: 'project-1',
        kind: 'exploratory',
        status: 'done',
        project: {
          id: 'project-1',
          ownerId: mockUser.id,
        },
      };

      const mockFinalizeAnalysis = {
        id: 'analysis-2',
        projectId: 'project-1',
        kind: 'rigid_final',
        status: 'pending',
        startedAt: new Date(),
      };

      (prisma.analysis.findUnique as jest.Mock).mockResolvedValue(mockExploratoryAnalysis);
      (prisma.analysis.create as jest.Mock).mockResolvedValue(mockFinalizeAnalysis);

      const request = jsonRequest('/api/analysis/analysis-1/finalize', 'POST', {
        analysisId: 'analysis-1',
        useFindingsDraft: true,
        selectedIdeas: [1, 2, 3],
      });

      const response = await finalizePOST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toMatchObject({
        id: 'analysis-2',
        kind: 'rigid_final',
        status: 'pending',
      });
      expect(prisma.analysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project-1',
          kind: 'rigid_final',
          requestPayload: expect.objectContaining({
            exploratoryAnalysisId: 'analysis-1',
            useFindingsDraft: true,
            selectedIdeas: [1, 2, 3],
          }),
        }),
      });
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'finalize-analysis',
        expect.objectContaining({
          analysisId: 'analysis-2',
          projectId: 'project-1',
          exploratoryAnalysisId: 'analysis-1',
        }),
        expect.objectContaining({
          jobId: 'finalize-analysis-2',
          attempts: 5,
        })
      );
    });

    it('returns 404 when exploratory analysis not found', async () => {
      (prisma.analysis.findUnique as jest.Mock).mockResolvedValue(null);

      const request = jsonRequest('/api/analysis/missing/finalize', 'POST', {
        analysisId: 'missing',
      });

      const response = await finalizePOST(request);

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

      const request = jsonRequest('/api/analysis/analysis-1/finalize', 'POST', {
        analysisId: 'analysis-1',
      });

      const response = await finalizePOST(request);

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: 'Access denied' });
    });

    it('returns 400 for invalid payload', async () => {
      const request = jsonRequest('/api/analysis/analysis-1/finalize', 'POST', {
        useFindingsDraft: 'not-a-boolean',
      });

      const response = await finalizePOST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation error');
    });

    it('returns 401 when auth fails', async () => {
      requireAuthMock.mockRejectedValue(new Error('Unauthorized'));

      const request = jsonRequest('/api/analysis/analysis-1/finalize', 'POST', {
        analysisId: 'analysis-1',
      });

      const response = await finalizePOST(request);

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
    });
  });

  describe('GET /api/analyses/[id]/artifacts', () => {
    it('lists artifacts for an analysis', async () => {
      const mockAnalysis = {
        id: 'analysis-1',
        projectId: 'project-1',
        project: {
          id: 'project-1',
          ownerId: mockUser.id,
        },
      };

      const mockArtifacts = [
        {
          id: 'artifact-1',
          type: 'audio',
          s3Key: 'projects/project-1/artifacts/analysis-1/audio-1.mp3',
          filename: 'jingle-1.mp3',
          createdAt: new Date(),
        },
        {
          id: 'artifact-2',
          type: 'pdf',
          s3Key: 'projects/project-1/artifacts/analysis-1/report.pdf',
          filename: 'report.pdf',
          createdAt: new Date(),
        },
      ];

      (prisma.analysis.findUnique as jest.Mock).mockResolvedValue(mockAnalysis);
      (prisma.artifact.findMany as jest.Mock).mockResolvedValue(mockArtifacts);

      const response = await artifactsGET(
        jsonRequest('/api/analyses/analysis-1/artifacts'),
        { params: { id: 'analysis-1' } }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.artifacts).toHaveLength(2);
      expect(data.artifacts[0].id).toBe('artifact-1');
      expect(data.artifacts[1].id).toBe('artifact-2');
    });

    it('returns empty array when no artifacts exist', async () => {
      const mockAnalysis = {
        id: 'analysis-1',
        projectId: 'project-1',
        project: {
          id: 'project-1',
          ownerId: mockUser.id,
        },
      };

      (prisma.analysis.findUnique as jest.Mock).mockResolvedValue(mockAnalysis);
      (prisma.artifact.findMany as jest.Mock).mockResolvedValue([]);

      const response = await artifactsGET(
        jsonRequest('/api/analyses/analysis-1/artifacts'),
        { params: { id: 'analysis-1' } }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.artifacts).toEqual([]);
    });

    it('returns 404 when analysis not found', async () => {
      (prisma.analysis.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await artifactsGET(
        jsonRequest('/api/analyses/missing/artifacts'),
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

      const response = await artifactsGET(
        jsonRequest('/api/analyses/analysis-1/artifacts'),
        { params: { id: 'analysis-1' } }
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: 'Access denied' });
    });

    it('returns 401 when auth fails', async () => {
      requireAuthMock.mockRejectedValue(new Error('Unauthorized'));

      const response = await artifactsGET(
        jsonRequest('/api/analyses/analysis-1/artifacts'),
        { params: { id: 'analysis-1' } }
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
    });
  });
});

