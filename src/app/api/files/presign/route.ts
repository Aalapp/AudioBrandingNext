import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { generatePresignedUploadUrl, PresignUploadOptions } from '@/lib/s3';
import { verifyProjectOwnership } from '@/lib/projects';
import { z } from 'zod';

const presignSchema = z.object({
  projectId: z.string().uuid(),
  filename: z.string().min(1).max(500),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024), // 10MB max
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate input
    const validated = presignSchema.parse(body);

    // Verify project ownership
    const hasAccess = await verifyProjectOwnership(validated.projectId, user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Generate presigned URL
    const result = await generatePresignedUploadUrl({
      projectId: validated.projectId,
      filename: validated.filename,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
    } as PresignUploadOptions);

    return NextResponse.json(result);
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

    if (error.message.includes('MIME type') || error.message.includes('File size')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
}

