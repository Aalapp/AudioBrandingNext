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
    
    // Verify project ownership
    const hasAccess = await verifyProjectOwnership(id, user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Get all analyses for the project, ordered by most recent first
    const analyses = await prisma.analysis.findMany({
      where: {
        projectId: id,
      },
      orderBy: {
        startedAt: 'desc',
      },
      select: {
        id: true,
        kind: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        failureReason: true,
      },
    });

    // Find the most recent exploratory and finalize analyses
    const exploratoryAnalysis = analyses.find(a => a.kind === 'exploratory');
    const finalizeAnalysis = analyses.find(a => a.kind === 'rigid_final');

    return NextResponse.json({
      analyses,
      exploratoryAnalysis: exploratoryAnalysis || null,
      finalizeAnalysis: finalizeAnalysis || null,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Error getting project analyses:', error);
    return NextResponse.json(
      { error: 'Failed to get project analyses' },
      { status: 500 }
    );
  }
}

