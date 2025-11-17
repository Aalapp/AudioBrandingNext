import { POST } from '@/app/api/projects/[id]/chat/stream/route';
import { jsonRequest, mockUser, readStream } from './test-helpers';
import { requireAuth } from '@/lib/auth';
import { verifyProjectOwnership } from '@/lib/projects';
import { streamChatCompletion } from '@/lib/chat';
import { prisma } from '@/lib/db';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/projects', () => ({
  verifyProjectOwnership: jest.fn(),
}));

jest.mock('@/lib/chat', () => ({
  streamChatCompletion: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    message: {
      create: jest.fn(),
    },
    project: {
      update: jest.fn(),
    },
  },
}));

describe('Chat Stream API Routes', () => {
  const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;
  const verifyProjectOwnershipMock = verifyProjectOwnership as jest.MockedFunction<
    typeof verifyProjectOwnership
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthMock.mockResolvedValue(mockUser);
    verifyProjectOwnershipMock.mockResolvedValue(true);
  });

  describe('POST /api/projects/[id]/chat/stream', () => {
    it('streams chat completion with SSE format', async () => {
      const mockUserMessage = {
        id: 'msg-1',
        role: 'user',
        content: { text: 'Hello' },
        createdAt: new Date(),
      };

      const mockAssistantMessage = {
        id: 'msg-2',
        role: 'assistant',
        content: { text: 'Hi there!', type: 'chat_response' },
        createdAt: new Date(),
      };

      // Mock async iterator for streaming
      const mockChunks = [
        { choices: [{ delta: { content: 'Hi' } }] },
        { choices: [{ delta: { content: ' there' } }] },
        { choices: [{ delta: { content: '!' } }] },
      ];

      (prisma.message.create as jest.Mock)
        .mockResolvedValueOnce(mockUserMessage)
        .mockResolvedValueOnce(mockAssistantMessage);
      (prisma.project.update as jest.Mock).mockResolvedValue({});

      async function* mockStream() {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      (streamChatCompletion as jest.Mock).mockReturnValue(mockStream());

      const request = jsonRequest('/api/projects/project-1/chat/stream', 'POST', {
        message: { text: 'Hello' },
        useFindingsDraft: false,
      });

      const response = await POST(request, { params: { id: 'project-1' } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
      expect(response.headers.get('Connection')).toBe('keep-alive');

      const streamText = await readStream(response.body);
      expect(streamText).toContain('"type":"ack"');
      expect(streamText).toContain('"type":"token"');
      expect(streamText).toContain('"type":"done"');
      expect(streamText).toContain('data:[DONE]');
    });

    it('handles streaming errors gracefully', async () => {
      const mockUserMessage = {
        id: 'msg-1',
        role: 'user',
        content: { text: 'Hello' },
        createdAt: new Date(),
      };

      (prisma.message.create as jest.Mock).mockResolvedValueOnce(mockUserMessage);

      async function* errorStream() {
        throw new Error('Stream error');
      }

      (streamChatCompletion as jest.Mock).mockReturnValue(errorStream());

      const request = jsonRequest('/api/projects/project-1/chat/stream', 'POST', {
        message: { text: 'Hello' },
      });

      const response = await POST(request, { params: { id: 'project-1' } });

      expect(response.status).toBe(200);
      const streamText = await readStream(response.body);
      expect(streamText).toContain('"type":"error"');
      expect(streamText).toContain('"error":"Stream error"');
    });

    it('returns 404 when project not accessible', async () => {
      verifyProjectOwnershipMock.mockResolvedValue(false);

      const request = jsonRequest('/api/projects/project-1/chat/stream', 'POST', {
        message: { text: 'Hello' },
      });

      const response = await POST(request, { params: { id: 'project-1' } });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        error: 'Project not found or access denied',
      });
    });

    it('returns 400 for invalid payload', async () => {
      const request = jsonRequest('/api/projects/project-1/chat/stream', 'POST', {
        useFindingsDraft: 'not-a-boolean',
      });

      const response = await POST(request, { params: { id: 'project-1' } });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation error');
    });

    it('returns 401 when auth fails', async () => {
      requireAuthMock.mockRejectedValue(new Error('Unauthorized'));

      const request = jsonRequest('/api/projects/project-1/chat/stream', 'POST', {
        message: { text: 'Hello' },
      });

      const response = await POST(request, { params: { id: 'project-1' } });

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
    });
  });
});

