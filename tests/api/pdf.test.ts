import { POST } from '@/app/api/pdf/generate/route';
import { jsonRequest, mockUser } from './test-helpers';
import { requireAuth } from '@/lib/auth';
import { generateJingleReportPDF } from '@/lib/pdf-generator';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/pdf-generator', () => ({
  generateJingleReportPDF: jest.fn(),
}));

describe('PDF API Routes', () => {
  const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;

  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthMock.mockResolvedValue(mockUser);
  });

  describe('POST /api/pdf/generate', () => {
    const validPDFPayload = {
      data: {
        brand_findings: {
          positioning: 'Premium positioning',
          target_audience: 'Young professionals',
          tone_personality: 'Energetic and modern',
          visual_tactile_cues: 'Bold colors',
          brand_promise: 'Innovation',
          practical_constraints: 'None',
        },
        artistic_rationale: 'Creative rationale here',
        jingle: {
          concept_statement: 'Modern and upbeat',
          musical_description: 'Electronic with acoustic elements',
          keywords: ['energetic', 'modern', 'innovative'],
          imagery: 'Bright and dynamic',
          why_it_works: ['Resonates with audience', 'Memorable melody'],
        },
      },
      brandName: 'Test Brand',
    };

    it('generates PDF and returns it with correct headers', async () => {
      const mockPDFBuffer = Buffer.from('mock-pdf-content');
      (generateJingleReportPDF as jest.Mock).mockResolvedValue(mockPDFBuffer);

      const request = jsonRequest('/api/pdf/generate', 'POST', validPDFPayload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain(
        'test brand_jingle_report.pdf'
      );

      const arrayBuffer = await response.arrayBuffer();
      expect(Buffer.from(arrayBuffer)).toEqual(mockPDFBuffer);
    });

    it('returns 400 for invalid payload structure', async () => {
      const invalidPayload = {
        data: {
          brand_findings: {
            positioning: 'Missing required fields',
          },
        },
        brandName: 'Test',
      };

      const request = jsonRequest('/api/pdf/generate', 'POST', invalidPayload);
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });

    it('returns 400 for missing brandName', async () => {
      const invalidPayload = {
        data: validPDFPayload.data,
      };

      const request = jsonRequest('/api/pdf/generate', 'POST', invalidPayload);
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });

    it('returns 400 for empty brandName', async () => {
      const invalidPayload = {
        ...validPDFPayload,
        brandName: '',
      };

      const request = jsonRequest('/api/pdf/generate', 'POST', invalidPayload);
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });

    it('returns 401 when auth fails', async () => {
      requireAuthMock.mockRejectedValue(new Error('Unauthorized'));

      const request = jsonRequest('/api/pdf/generate', 'POST', validPDFPayload);
      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
    });

    it('handles PDF generation errors', async () => {
      (generateJingleReportPDF as jest.Mock).mockRejectedValue(
        new Error('PDF generation failed')
      );

      const request = jsonRequest('/api/pdf/generate', 'POST', validPDFPayload);
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to generate PDF');
    });
  });
});

