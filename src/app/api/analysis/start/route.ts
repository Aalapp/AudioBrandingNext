import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { verifyProjectOwnership } from '@/lib/projects';
import { prisma } from '@/lib/db';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { z } from 'zod';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required for BullMQ blocking operations
});
const analysisQueue = new Queue('analysis', { connection: redis });

const startAnalysisSchema = z.object({
  projectId: z.string().uuid(),
  seedPrompt: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate input
    const validated = startAnalysisSchema.parse(body);

    // Verify project ownership
    const hasAccess = await verifyProjectOwnership(validated.projectId, user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Create analysis record
    const analysis = await prisma.analysis.create({
      data: {
        projectId: validated.projectId,
        kind: 'exploratory',
        requestPayload: {
          seedPrompt: validated.seedPrompt,
        },
        status: 'pending',
      },
    });

    // Enqueue analysis job
    await analysisQueue.add(
      'exploratory-analysis',
      {
        analysisId: analysis.id,
        projectId: validated.projectId,
        seedPrompt: validated.seedPrompt,
      },
      {
        jobId: `analysis-${analysis.id}`, // Ensure idempotency
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

    return NextResponse.json(
      {
        id: analysis.id,
        status: analysis.status,
        kind: analysis.kind,
        startedAt: analysis.startedAt,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error },
        { status: 400 }
      );
    }

    console.error('Error starting analysis:', error);
    return NextResponse.json(
      { error: 'Failed to start analysis' },
      { status: 500 }
    );
  }
}

