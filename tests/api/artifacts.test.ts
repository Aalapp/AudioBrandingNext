import { GET } from '@/app/api/artifacts/[id]/presign-download/route';
import { jsonRequest, mockUser } from './test-helpers';
import { requireAuth } from '@/lib/auth';
import { verifyProjectOwnership } from '@/lib/projects';
import { generatePresignedDownloadUrl } from '@/lib/s3';
import { prisma } from '@/lib/db';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/projects', () => ({
  verifyProjectOwnership: jest.fn(),
}));

jest.mock('@/lib/s3', () => ({
  generatePresignedDownloadUrl: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    artifact: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Artifacts API Routes', () => {
  const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;
  const verifyProjectOwnershipMock = verifyProjectOwnership as jest.MockedFunction<
    typeof verifyProjectOwnership
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthMock.mockResolvedValue(mockUser);
    verifyProjectOwnershipMock.mockResolvedValue(true);
  });

  describe('GET /api/artifacts/[id]/presign-download', () => {
    it('generates presigned download URL for artifact', async () => {
      const mockArtifact = {
        id: 'artifact-1',
        s3Key: 'projects/project-1/artifacts/analysis-1/audio.mp3',
        filename: 'jingle.mp3',
        type: 'audio',
        metadata: { sizeBytes: 1024000 },
        analysis: {
          projectId: 'project-1',
          project: {
            id: 'project-1',
            ownerId: mockUser.id,
          },
        },
      };

      (prisma.artifact.findUnique as jest.Mock).mockResolvedValue(mockArtifact);
      (generatePresignedDownloadUrl as jest.Mock).mockResolvedValue({
        downloadUrl: 'https://download-url.example.com',
        expiresAt: new Date(),
      });

      const response = await GET(
        jsonRequest('/api/artifacts/artifact-1/presign-download'),
        { params: { id: 'artifact-1' } }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        downloadUrl: 'https://download-url.example.com',
        filename: 'jingle.mp3',
        type: 'audio',
        sizeBytes: 1024000,
      });
      expect(generatePresignedDownloadUrl).toHaveBeenCalledWith(mockArtifact.s3Key);
    });

    it('handles artifact without sizeBytes in metadata', async () => {
      const mockArtifact = {
        id: 'artifact-1',
        s3Key: 'projects/project-1/artifacts/analysis-1/audio.mp3',
        filename: 'jingle.mp3',
        type: 'audio',
        metadata: null,
        analysis: {
          projectId: 'project-1',
          project: {
            id: 'project-1',
            ownerId: mockUser.id,
          },
        },
      };

      (prisma.artifact.findUnique as jest.Mock).mockResolvedValue(mockArtifact);
      (generatePresignedDownloadUrl as jest.Mock).mockResolvedValue({
        downloadUrl: 'https://download-url.example.com',
        expiresAt: new Date(),
      });

      const response = await GET(
        jsonRequest('/api/artifacts/artifact-1/presign-download'),
        { params: { id: 'artifact-1' } }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sizeBytes).toBeUndefined();
    });

    it('returns 404 when artifact not found', async () => {
      (prisma.artifact.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await GET(
        jsonRequest('/api/artifacts/missing/presign-download'),
        { params: { id: 'missing' } }
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: 'Artifact not found' });
    });

    it('returns 403 when user lacks project access', async () => {
      (prisma.artifact.findUnique as jest.Mock).mockResolvedValue({
        id: 'artifact-1',
        analysis: {
          projectId: 'project-2',
          project: { id: 'project-2', ownerId: 'other-user' },
        },
      });
      verifyProjectOwnershipMock.mockResolvedValue(false);

      const response = await GET(
        jsonRequest('/api/artifacts/artifact-1/presign-download'),
        { params: { id: 'artifact-1' } }
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: 'Access denied' });
    });

    it('returns 401 when auth fails', async () => {
      requireAuthMock.mockRejectedValue(new Error('Unauthorized'));

      const response = await GET(
        jsonRequest('/api/artifacts/artifact-1/presign-download'),
        { params: { id: 'artifact-1' } }
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
    });
  });
});

