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
        description1: {
          title: 'Description 1',
          musical_elements: '<p>Test description</p>',
        },
        description2: {
          title: 'Description 2',
          musical_elements: '<p>Test description</p>',
        },
        description3: {
          title: 'Description 3',
          musical_elements: '<p>Test description</p>',
        },
        description4: {
          title: 'Description 4',
          musical_elements: '<p>Test description</p>',
        },
        description5: {
          title: 'Description 5',
          musical_elements: '<p>Test description</p>',
        },
        keywords: ['keyword1', 'keyword2'],
        imagery: 'Test imagery',
        why_it_works: ['Reason 1', 'Reason 2'],
      },
      composition_plan: {
        positive_global_styles: [],
        negative_global_styles: [],
        sections: [],
      },
    };

    const pdf = await generateJingleReportPDF(data, 'Test Brand');

    expect(pdf).toBeInstanceOf(Buffer);
    expect(mockPage.setContent).toHaveBeenCalled();
    expect(mockPage.pdf).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});

