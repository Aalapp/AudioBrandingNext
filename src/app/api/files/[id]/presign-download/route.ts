import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getFileById, generatePresignedDownloadUrl } from '@/lib/s3';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const file = await getFileById(id, user.id);

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Generate presigned download URL
    const result = await generatePresignedDownloadUrl(file.s3Key);

    return NextResponse.json({
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt,
      filename: file.filename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes.toString(),
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Error generating download URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}

