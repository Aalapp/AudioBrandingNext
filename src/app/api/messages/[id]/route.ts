import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { verifyProjectOwnership } from '@/lib/projects';
import { z } from 'zod';

const updateMessageSchema = z.object({
  content: z.any().optional(),
  redacted: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const validated = updateMessageSchema.parse(body);

    // Get message and verify project ownership
    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const hasAccess = await verifyProjectOwnership(message.projectId, user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Update message
    const updated = await prisma.message.update({
      where: { id },
      data: {
        ...(validated.content !== undefined && { content: validated.content }),
        ...(validated.redacted !== undefined && { redacted: validated.redacted }),
      },
      select: {
        id: true,
        role: true,
        content: true,
        senderId: true,
        createdAt: true,
        redacted: true,
      },
    });

    return NextResponse.json(updated);
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

    console.error('Error updating message:', error);
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Get message and verify project ownership
    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const hasAccess = await verifyProjectOwnership(message.projectId, user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Soft delete (redact) message
    await prisma.message.update({
      where: { id },
      data: {
        redacted: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}

