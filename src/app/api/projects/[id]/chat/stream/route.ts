import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { verifyProjectOwnership } from '@/lib/projects';
import { prisma } from '@/lib/db';
import { streamChatCompletion } from '@/lib/chat';

const chatSchema = z.object({
  message: z.any(),
  useFindingsDraft: z.boolean().optional().default(false),
  rigidResponse: z.any().optional(),
});

function serializeMessage(message: {
  id: string;
  role: string;
  content: any;
  createdAt: Date;
}) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const hasAccess = await verifyProjectOwnership(id, user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validated = chatSchema.parse(body);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const userMessageRecord = await prisma.message.create({
            data: {
              projectId: id,
              senderId: user.id,
              role: 'user',
              content: validated.message,
            },
          });

          controller.enqueue(
            encoder.encode(
              `data:${JSON.stringify({
                type: 'ack',
                message: serializeMessage(userMessageRecord),
              })}\n\n`
            )
          );

          const iterator = await streamChatCompletion(
            id,
            {
              role: 'user',
              content: validated.message,
            },
            validated.useFindingsDraft,
            undefined,
            validated.rigidResponse
          );

          let assistantContent = '';

          for await (const chunk of iterator) {
            const token =
              chunk.choices?.[0]?.delta?.content ||
              chunk.choices?.[0]?.message?.content ||
              '';

            if (!token) {
              continue;
            }

            assistantContent += token;
            controller.enqueue(
              encoder.encode(
                `data:${JSON.stringify({
                  type: 'token',
                  content: token,
                })}\n\n`
              )
            );
          }

          const assistantMessageRecord = await prisma.message.create({
            data: {
              projectId: id,
              senderId: null,
              role: 'assistant',
              content: {
                type: 'chat_response',
                text: assistantContent.trim(),
              },
            },
          });

          await prisma.project.update({
            where: { id },
            data: {
              lastActivityAt: new Date(),
            },
          });

          controller.enqueue(
            encoder.encode(
              `data:${JSON.stringify({
                type: 'done',
                message: serializeMessage(assistantMessageRecord),
              })}\n\n`
            )
          );
          controller.enqueue(encoder.encode('data:[DONE]\n\n'));
          controller.close();
        } catch (error: any) {
          console.error('Streaming chat error:', error);
          controller.enqueue(
            encoder.encode(
              `data:${JSON.stringify({
                type: 'error',
                error: error.message || 'Streaming chat failed',
              })}\n\n`
            )
          );
          controller.close();
        }
      },
      cancel() {
        console.warn('Client disconnected from chat stream');
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error initiating chat stream:', error);
    return NextResponse.json(
      { error: 'Failed to start chat stream' },
      { status: 500 }
    );
  }
}


