import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { verifyProjectOwnership } from '@/lib/projects';
import { prisma } from '@/lib/db';
import { shouldUpdateSnapshot, updateProjectSnapshot } from '@/lib/snapshots';
import { z } from 'zod';

const createMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.any(), // JSON content
});

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

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const cursor = searchParams.get('cursor') || undefined;

    const where: any = {
      projectId: id,
      redacted: false,
    };

    // Cursor-based pagination
    if (cursor) {
      where.id = {
        lt: cursor,
      };
    }

    const messages = await prisma.message.findMany({
      where,
      take: limit + 1, // Fetch one extra to determine if there's a next page
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        role: true,
        content: true,
        senderId: true,
        createdAt: true,
      },
    });

    const hasNextPage = messages.length > limit;
    const items = hasNextPage ? messages.slice(0, limit) : messages;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    // Reverse to chronological order
    items.reverse();

    return NextResponse.json({
      items,
      nextCursor,
      hasNextPage,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Error listing messages:', error);
    return NextResponse.json(
      { error: 'Failed to list messages' },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const body = await request.json();
    const validated = createMessageSchema.parse(body);

    // Create message
    const message = await prisma.message.create({
      data: {
        projectId: id,
        senderId: validated.role === 'user' ? user.id : null,
        role: validated.role,
        content: validated.content,
      },
      select: {
        id: true,
        role: true,
        content: true,
        senderId: true,
        createdAt: true,
      },
    });

    // Update project last activity
    await prisma.project.update({
      where: { id },
      data: {
        lastActivityAt: new Date(),
      },
    });

    // Check if snapshot should be updated (async, don't wait)
    shouldUpdateSnapshot(id)
      .then((shouldUpdate) => {
        if (shouldUpdate) {
          return updateProjectSnapshot(id);
        }
      })
      .catch((error) => {
        console.error('Error updating snapshot:', error);
      });

    return NextResponse.json(message, { status: 201 });
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

    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    );
  }
}

