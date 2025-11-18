import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getJobStatus } from '@/lib/jobs';
import { z } from 'zod';

const getJobSchema = z.object({
  queue: z.enum(['analysis', 'finalize']),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const searchParams = request.nextUrl.searchParams;
    const queue = searchParams.get('queue') as 'analysis' | 'finalize' | null;

    if (!queue || (queue !== 'analysis' && queue !== 'finalize')) {
      return NextResponse.json(
        { error: 'Invalid queue parameter. Must be "analysis" or "finalize"' },
        { status: 400 }
      );
    }

    const jobStatus = await getJobStatus(queue, id);

    if (!jobStatus) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(jobStatus);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Error getting job status:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}

