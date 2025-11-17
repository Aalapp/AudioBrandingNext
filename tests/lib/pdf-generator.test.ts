import { generateJingleReportPDF } from '@/lib/pdf-generator';
import { RigidJSONResponse } from '@/lib/perplexity-rigid';
import puppeteer from 'puppeteer';

jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

describe('PDF Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate PDF from rigid JSON data', async () => {
    const mockPage = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('fake pdf')),
    };

    const mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };

    (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);

    const data: RigidJSONResponse = {
      brand_findings: {
        positioning: 'Test positioning',
        target_audience: 'Test audience',
        tone_personality: 'Test tone',
        visual_tactile_cues: 'Test cues',
        brand_promise: 'Test promise',
        practical_constraints: 'Test constraints',
      },
      artistic_rationale: '<p>Test rationale</p>',
      jingle: {
        concept_statement: 'Test concept',
        musical_description: '<p>Test description</p>',
        keywords: ['keyword1', 'keyword2'],
        imagery: 'Test imagery',
        why_it_works: ['Reason 1', 'Reason 2'],
      },
    };

    const pdf = await generateJingleReportPDF(data, 'Test Brand');

    expect(pdf).toBeInstanceOf(Buffer);
    expect(mockPage.setContent).toHaveBeenCalled();
    expect(mockPage.pdf).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});

