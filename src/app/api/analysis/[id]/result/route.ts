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

    if (analysis.status !== 'done') {
      return NextResponse.json(
        { error: 'Analysis not completed', status: analysis.status },
        { status: 400 }
      );
    }

    return NextResponse.json({
      id: analysis.id,
      status: analysis.status,
      kind: analysis.kind,
      responseJson: analysis.responseJson,
      startedAt: analysis.startedAt,
      finishedAt: analysis.finishedAt,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Error getting analysis result:', error);
    return NextResponse.json(
      { error: 'Failed to get analysis result' },
      { status: 500 }
    );
  }
}

