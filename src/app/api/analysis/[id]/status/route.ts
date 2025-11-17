import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { verifyProjectOwnership } from '@/lib/projects';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const analysis = await prisma.analysis.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Verify project ownership
    const hasAccess = await verifyProjectOwnership(analysis.projectId, user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Extract progress from responseJson metadata if available
    let progress = 0;
    if (analysis.responseJson && typeof analysis.responseJson === 'object' && '_metadata' in analysis.responseJson) {
      const metadata = (analysis.responseJson as any)._metadata;
      if (metadata && typeof metadata.progress === 'number') {
        progress = metadata.progress;
      }
    }

    return NextResponse.json({
      id: analysis.id,
      status: analysis.status,
      kind: analysis.kind,
      startedAt: analysis.startedAt,
      finishedAt: analysis.finishedAt,
      failureReason: analysis.failureReason,
      progress, // Include progress percentage (0-100)
      // Include partial results if available
      ...(analysis.responseJson && {
        partialResult: analysis.responseJson,
      }),
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Error getting analysis status:', error);
    return NextResponse.json(
      { error: 'Failed to get analysis status' },
      { status: 500 }
    );
  }
}

