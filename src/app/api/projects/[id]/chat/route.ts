import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { verifyProjectOwnership } from '@/lib/projects';
import { prisma } from '@/lib/db';
import { generateChatResponse } from '@/lib/chat';
import { z } from 'zod';

const chatSchema = z.object({
  message: z.any(), // JSON content
  useFindingsDraft: z.boolean().optional().default(false),
});

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
    const validated = chatSchema.parse(body);

    // Create user message
    const userMessage = await prisma.message.create({
      data: {
        projectId: id,
        senderId: user.id,
        role: 'user',
        content: validated.message,
      },
    });

    // Generate assistant response
    const assistantResponse = await generateChatResponse(
      id,
      {
        role: 'user',
        content: validated.message,
      },
      validated.useFindingsDraft
    );

    // Create assistant message
    const assistantMessage = await prisma.message.create({
      data: {
        projectId: id,
        senderId: null, // System/LLM
        role: 'assistant',
        content: assistantResponse.content,
      },
    });

    // Update project last activity
    await prisma.project.update({
      where: { id },
      data: {
        lastActivityAt: new Date(),
      },
    });

    return NextResponse.json({
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
    });
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

    console.error('Error in chat:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}

