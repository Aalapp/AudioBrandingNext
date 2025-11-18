import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { verifyProjectOwnership } from '@/lib/projects';
import { generatePresignedDownloadUrl } from '@/lib/s3';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const artifact = await prisma.artifact.findUnique({
      where: { id },
      include: {
        analysis: {
          include: {
            project: {
              select: {
                id: true,
                ownerId: true,
              },
            },
          },
        },
      },
    });

    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Verify project ownership
    const hasAccess = await verifyProjectOwnership(
      artifact.analysis.projectId,
      user.id
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Generate presigned download URL
    const result = await generatePresignedDownloadUrl(artifact.s3Key);

    const metadata = artifact.metadata as { sizeBytes?: number } | null;
    
    return NextResponse.json({
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt,
      filename: artifact.filename,
      type: artifact.type,
      sizeBytes: metadata?.sizeBytes,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Error generating artifact download URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}

