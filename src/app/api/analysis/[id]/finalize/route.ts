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
const finalizeQueue = new Queue('finalize', { connection: redis });

const finalizeSchema = z.object({
  analysisId: z.string().uuid(),
  useFindingsDraft: z.boolean().optional().default(false),
  selectedIdeas: z.array(z.number()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate input
    const validated = finalizeSchema.parse(body);

    // Get the exploratory analysis
    const exploratoryAnalysis = await prisma.analysis.findUnique({
      where: { id: validated.analysisId },
      include: {
        project: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!exploratoryAnalysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Verify project ownership
    const hasAccess = await verifyProjectOwnership(
      exploratoryAnalysis.projectId,
      user.id
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Create finalize analysis record
    const finalizeAnalysis = await prisma.analysis.create({
      data: {
        projectId: exploratoryAnalysis.projectId,
        kind: 'rigid_final',
        requestPayload: {
          exploratoryAnalysisId: validated.analysisId,
          useFindingsDraft: validated.useFindingsDraft,
          selectedIdeas: validated.selectedIdeas,
        },
        status: 'pending',
      },
    });

    // Enqueue finalize job
    await finalizeQueue.add(
      'finalize-analysis',
      {
        analysisId: finalizeAnalysis.id,
        projectId: exploratoryAnalysis.projectId,
        exploratoryAnalysisId: validated.analysisId,
        useFindingsDraft: validated.useFindingsDraft,
        selectedIdeas: validated.selectedIdeas,
      },
      {
        jobId: `finalize-${finalizeAnalysis.id}`, // Ensure idempotency
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      }
    );

    return NextResponse.json(
      {
        id: finalizeAnalysis.id,
        status: finalizeAnalysis.status,
        kind: finalizeAnalysis.kind,
        startedAt: finalizeAnalysis.startedAt,
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
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error starting finalize:', error);
    return NextResponse.json(
      { error: 'Failed to start finalize' },
      { status: 500 }
    );
  }
}

