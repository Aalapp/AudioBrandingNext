import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { generateJingleReportPDF } from '@/lib/pdf-generator';
import { RigidJSONResponse } from '@/lib/perplexity-rigid';
import { z } from 'zod';

const generatePDFSchema = z.object({
  data: z.object({
    brand_findings: z.object({
      positioning: z.string(),
      target_audience: z.string(),
      tone_personality: z.string(),
      visual_tactile_cues: z.string(),
      brand_promise: z.string(),
      practical_constraints: z.string(),
    }),
    artistic_rationale: z.string(),
    jingle: z.object({
      concept_statement: z.string(),
      description1: z.object({
        title: z.string(),
        musical_elements: z.string(),
        hook: z.string().optional(),
        feel: z.string().optional(),
        emotional_effect: z.string().optional(),
      }),
      description2: z.object({
        title: z.string(),
        musical_elements: z.string(),
        hook: z.string().optional(),
        feel: z.string().optional(),
        emotional_effect: z.string().optional(),
      }),
      description3: z.object({
        title: z.string(),
        musical_elements: z.string(),
        hook: z.string().optional(),
        feel: z.string().optional(),
        emotional_effect: z.string().optional(),
      }),
      description4: z.object({
        title: z.string(),
        musical_elements: z.string(),
        hook: z.string().optional(),
        feel: z.string().optional(),
        emotional_effect: z.string().optional(),
      }),
      description5: z.object({
        title: z.string(),
        musical_elements: z.string(),
        hook: z.string().optional(),
        feel: z.string().optional(),
        emotional_effect: z.string().optional(),
      }),
      keywords: z.array(z.string()),
      imagery: z.string(),
      why_it_works: z.array(z.string()),
    }),
  }),
  brandName: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  try {
    // Internal endpoint - require auth but allow service-to-service calls
    await requireAuth();

    const body = await request.json();
    const validated = generatePDFSchema.parse(body);

    // Generate PDF
    const pdfBuffer = await generateJingleReportPDF(
      validated.data as RigidJSONResponse,
      validated.brandName
    );

    // Return PDF as response
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${validated.brandName.toLowerCase()}_jingle_report.pdf"`,
      },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

