import { GET } from '@/app/api/jobs/[id]/route';
import { jsonRequest, mockUser } from './test-helpers';
import { requireAuth } from '@/lib/auth';
import { getJobStatus } from '@/lib/jobs';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/jobs', () => ({
  getJobStatus: jest.fn(),
}));

describe('Jobs API Routes', () => {
  const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;

  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthMock.mockResolvedValue(mockUser);
  });

  describe('GET /api/jobs/[id]', () => {
    it('returns job status for analysis queue', async () => {
      const mockJobStatus = {
        id: 'job-1',
        name: 'exploratory-analysis',
        data: { analysisId: 'analysis-1' },
        state: 'completed',
        progress: 100,
        returnvalue: { success: true },
      };

      (getJobStatus as jest.Mock).mockResolvedValue(mockJobStatus);

      const request = jsonRequest('/api/jobs/job-1?queue=analysis');
      const response = await GET(request, { params: Promise.resolve({ id: 'job-1' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        id: 'job-1',
        state: 'completed',
      });
      expect(getJobStatus).toHaveBeenCalledWith('analysis', 'job-1');
    });

    it('returns job status for finalize queue', async () => {
      const mockJobStatus = {
        id: 'job-2',
        name: 'finalize-analysis',
        data: { analysisId: 'analysis-2' },
        state: 'active',
        progress: 50,
      };

      (getJobStatus as jest.Mock).mockResolvedValue(mockJobStatus);

      const request = jsonRequest('/api/jobs/job-2?queue=finalize');
      const response = await GET(request, { params: Promise.resolve({ id: 'job-2' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        id: 'job-2',
        state: 'active',
      });
      expect(getJobStatus).toHaveBeenCalledWith('finalize', 'job-2');
    });

    it('returns 400 when queue parameter is missing', async () => {
      const request = jsonRequest('/api/jobs/job-1');
      const response = await GET(request, { params: Promise.resolve({ id: 'job-1' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid queue parameter');
    });

    it('returns 400 when queue parameter is invalid', async () => {
      const request = jsonRequest('/api/jobs/job-1?queue=invalid');
      const response = await GET(request, { params: Promise.resolve({ id: 'job-1' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid queue parameter');
    });

    it('returns 404 when job not found', async () => {
      (getJobStatus as jest.Mock).mockResolvedValue(null);

      const request = jsonRequest('/api/jobs/missing?queue=analysis');
      const response = await GET(request, { params: Promise.resolve({ id: 'missing' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Job not found');
    });

    it('returns 401 when auth fails', async () => {
      requireAuthMock.mockRejectedValue(new Error('Unauthorized'));

      const request = jsonRequest('/api/jobs/job-1?queue=analysis');
      const response = await GET(request, { params: Promise.resolve({ id: 'job-1' }) });

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
    });
  });
});

