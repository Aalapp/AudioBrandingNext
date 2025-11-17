import {
  createAceStepPrediction,
  getPredictionStatus,
  pollPredictionUntilComplete,
  downloadAudioFile,
} from '@/lib/replicate';

// Mock fetch
global.fetch = jest.fn();

describe('Replicate Utilities', () => {
  const originalReplicateToken = process.env.REPLICATE_API_TOKEN;
  const originalModelVersion = process.env.ACE_STEP_MODEL_VERSION;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REPLICATE_API_TOKEN = 'test-token';
    process.env.ACE_STEP_MODEL_VERSION = 'test-version';
  });

  afterEach(() => {
    // Restore env vars after each test
    if (originalReplicateToken !== undefined) {
      process.env.REPLICATE_API_TOKEN = originalReplicateToken;
    } else {
      delete process.env.REPLICATE_API_TOKEN;
    }
    if (originalModelVersion !== undefined) {
      process.env.ACE_STEP_MODEL_VERSION = originalModelVersion;
    } else {
      delete process.env.ACE_STEP_MODEL_VERSION;
    }
  });

  describe('createAceStepPrediction', () => {
    it('should create a prediction', async () => {
      const mockPrediction = {
        id: 'pred-1',
        status: 'starting',
        urls: {
          get: 'https://api.replicate.com/v1/predictions/pred-1',
          cancel: 'https://api.replicate.com/v1/predictions/pred-1/cancel',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPrediction,
      });

      const result = await createAceStepPrediction({
        tags: 'epic, cinematic',
        duration: 60,
      });

      expect(result.id).toBe('pred-1');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.replicate.com/v1/predictions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Token test-token',
          }),
          body: JSON.stringify({
            version: process.env.ACE_STEP_MODEL_VERSION,
            input: {
              tags: 'epic, cinematic',
              duration: 60,
            },
          }),
        })
      );
    });

    it('should throw error if API token not configured', async () => {
      // The constants are captured at module load time, so we need to reset modules
      // and reload with the env var deleted
      const originalToken = process.env.REPLICATE_API_TOKEN;
      jest.resetModules();
      delete process.env.REPLICATE_API_TOKEN;
      
      // Ensure fetch is still mocked after reset
      global.fetch = jest.fn();
      
      // Re-import after resetting modules
      const { createAceStepPrediction: createAceStepPredictionReloaded } = await import('@/lib/replicate');
      
      await expect(
        createAceStepPredictionReloaded({
          tags: 'test tags',
        })
      ).rejects.toThrow('REPLICATE_API_TOKEN not configured');
      
      // Restore for other tests
      process.env.REPLICATE_API_TOKEN = originalToken || 'test-token';
      jest.resetModules();
      // Re-import the original module
      await import('@/lib/replicate');
    });

    it('should throw error if model version not configured', async () => {
      // The constants are captured at module load time, so we need to reset modules
      // and reload with the env var deleted
      const originalVersion = process.env.ACE_STEP_MODEL_VERSION;
      jest.resetModules();
      delete process.env.ACE_STEP_MODEL_VERSION;
      
      // Ensure fetch is still mocked after reset
      global.fetch = jest.fn();
      
      // Re-import after resetting modules
      const { createAceStepPrediction: createAceStepPredictionReloaded } = await import('@/lib/replicate');
      
      await expect(
        createAceStepPredictionReloaded({
          tags: 'test tags',
        })
      ).rejects.toThrow('ACE_STEP_MODEL_VERSION not configured');
      
      // Restore for other tests
      process.env.ACE_STEP_MODEL_VERSION = originalVersion || 'test-version';
      jest.resetModules();
      // Re-import the original module
      await import('@/lib/replicate');
    });

    it('should enforce tags requirement', async () => {
      await expect(
        createAceStepPrediction({
          tags: '   ',
        })
      ).rejects.toThrow('ACE-Step tags input is required');
    });

    it('should omit undefined optional fields from payload', async () => {
      const mockPrediction = {
        id: 'pred-2',
        status: 'starting',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPrediction,
      });

      await createAceStepPrediction({
        tags: 'ambient, chill',
        lyrics: '[inst]',
      });

      const [, fetchOptions] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchOptions.body);

      expect(body.input).toEqual({
        tags: 'ambient, chill',
        lyrics: '[inst]',
        duration: -1,
      });
    });

    it('should include provided optional guidance parameters', async () => {
      const mockPrediction = {
        id: 'pred-3',
        status: 'starting',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPrediction,
      });

      await createAceStepPrediction({
        tags: 'jazz, lounge',
        guidance_scale: 12,
        number_of_steps: 45,
      });

      const [, fetchOptions] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchOptions.body);

      expect(body.input.guidance_scale).toBe(12);
      expect(body.input.number_of_steps).toBe(45);
    });
  });

  describe('getPredictionStatus', () => {
    it('should get prediction status', async () => {
      const mockPrediction = {
        id: 'pred-1',
        status: 'starting', // Match the actual mock return value
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPrediction,
      });

      const result = await getPredictionStatus('pred-1');

      expect(result.status).toBe('starting');
    });
  });

  describe('pollPredictionUntilComplete', () => {
    it('should poll until completion', async () => {
      const mockPrediction = {
        id: 'pred-1',
        status: 'succeeded',
        output: 'https://example.com/audio.mp3',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockPrediction,
      });

      const result = await pollPredictionUntilComplete('pred-1', 5, 100);

      expect(result.status).toBe('succeeded');
    });

    it('should throw error if prediction fails', async () => {
      const mockPrediction = {
        id: 'pred-1',
        status: 'failed',
        error: 'Generation failed',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockPrediction,
      });

      await expect(
        pollPredictionUntilComplete('pred-1', 5, 100)
      ).rejects.toThrow('failed');
    });
  });

  describe('downloadAudioFile', () => {
    it('should download audio file', async () => {
      const mockAudioBuffer = Buffer.from('fake audio data');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockAudioBuffer.buffer,
      });

      const result = await downloadAudioFile('https://example.com/audio.mp3');

      expect(result).toBeInstanceOf(Buffer);
    });
  });
});

