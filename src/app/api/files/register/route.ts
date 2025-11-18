import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { registerFile, generateS3Key } from '@/lib/s3';
import { z } from 'zod';

const registerSchema = z.object({
  projectId: z.string().uuid(),
  s3Key: z.string(),
  filename: z.string().min(1).max(500),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate input
    const validated = registerSchema.parse(body);

    // Register file in database
    const file = await registerFile(
      validated.projectId,
      user.id,
      validated.s3Key,
      validated.filename,
      validated.mimeType,
      BigInt(validated.sizeBytes),
      validated.metadata
    );

    return NextResponse.json(file, { status: 201 });
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

    if (
      error.message === 'File not found in S3' ||
      error.message === 'Project not found or access denied'
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    console.error('Error registering file:', error);
    return NextResponse.json(
      { error: 'Failed to register file' },
      { status: 500 }
    );
  }
}

