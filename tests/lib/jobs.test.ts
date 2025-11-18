// Mock before importing
const mockGetJob = jest.fn();
const mockAnalysisQueue = {
  getJob: mockGetJob,
};
const mockFinalizeQueue = {
  getJob: jest.fn(),
};

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((name: string) => {
    if (name === 'analysis') {
      return mockAnalysisQueue;
    }
    return mockFinalizeQueue;
  }),
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({}));
});

import { getJobStatus, isJobIdempotent, retryJob } from '@/lib/jobs';

describe('Job Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getJobStatus', () => {
    it('should get job status', async () => {
      const mockJob = {
        id: 'job-1',
        name: 'test-job',
        getState: jest.fn().mockResolvedValue('completed'),
        progress: 100,
        returnvalue: { result: 'success' },
        failedReason: null,
        data: { test: 'data' },
        timestamp: Date.now(),
        processedOn: Date.now(),
        finishedOn: Date.now(),
        retry: jest.fn(),
      };

      // Mock the queue's getJob method
      mockGetJob.mockResolvedValue(mockJob);

      const status = await getJobStatus('analysis', 'job-1');

      expect(status).toBeDefined();
      expect(status?.id).toBe('job-1');
    });

    it('should return null if job not found', async () => {
      mockGetJob.mockResolvedValue(null);

      const status = await getJobStatus('analysis', 'non-existent');

      expect(status).toBeNull();
    });
  });

  describe('isJobIdempotent', () => {
    it('should return true if job exists', async () => {
      mockGetJob.mockResolvedValue({ id: 'job-1' });

      const result = await isJobIdempotent('analysis', 'job-1');

      expect(result).toBe(true);
    });

    it('should return false if job does not exist', async () => {
      mockGetJob.mockResolvedValue(null);

      const result = await isJobIdempotent('analysis', 'non-existent');

      expect(result).toBe(false);
    });
  });
});

