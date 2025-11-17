import { POST } from '@/app/api/projects/[id]/chat/route';
import { NextRequest } from 'next/server';
import * as authLib from '@/lib/auth';
import * as projectsLib from '@/lib/projects';
import * as chatLib from '@/lib/chat';
import { prisma } from '@/lib/db';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/projects', () => ({
  verifyProjectOwnership: jest.fn(),
}));

jest.mock('@/lib/chat', () => ({
  generateChatResponse: jest.fn(),
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

describe('Chat API Routes', () => {
  const mockUser = {
    id: 'user-1',
    hashid: 'abc123',
    email: 'test@example.com',
    name: 'Test User',
    picture: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (authLib.requireAuth as jest.Mock).mockResolvedValue(mockUser);
    (projectsLib.verifyProjectOwnership as jest.Mock).mockResolvedValue(true);
  });

  describe('POST /api/projects/[id]/chat', () => {
    it('should process chat message and generate response', async () => {
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

      (prisma.message.create as jest.Mock)
        .mockResolvedValueOnce(mockUserMessage)
        .mockResolvedValueOnce(mockAssistantMessage);

      (chatLib.generateChatResponse as jest.Mock).mockResolvedValue({
        role: 'assistant',
        content: { text: 'Hi there!', type: 'chat_response' },
      });

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: { text: 'Hello' },
          useFindingsDraft: false,
        }),
      });

      const response = await POST(request, { params: { id: 'project-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.userMessage).toBeDefined();
      expect(data.assistantMessage).toBeDefined();
    });
  });
});

