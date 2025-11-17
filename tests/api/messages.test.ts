import { GET, POST } from '@/app/api/projects/[id]/messages/route';
import { PATCH, DELETE } from '@/app/api/messages/[id]/route';
import { NextRequest } from 'next/server';
import * as authLib from '@/lib/auth';
import * as projectsLib from '@/lib/projects';
import { prisma } from '@/lib/db';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/projects', () => ({
  verifyProjectOwnership: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    message: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    project: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

describe('Messages API Routes', () => {
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

  describe('GET /api/projects/[id]/messages', () => {
    it('should list messages with pagination', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'user',
          content: { text: 'Hello' },
          senderId: 'user-1',
          createdAt: new Date(),
        },
      ];

      (prisma.message.findMany as jest.Mock).mockResolvedValue(mockMessages);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/messages');
      const response = await GET(request, { params: { id: 'project-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.items).toBeDefined();
    });
  });

  describe('POST /api/projects/[id]/messages', () => {
    it('should create a message', async () => {
      const mockMessage = {
        id: 'msg-1',
        role: 'user',
        content: { text: 'Hello' },
        senderId: 'user-1',
        createdAt: new Date(),
      };

      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.project.update as jest.Mock).mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/messages', {
        method: 'POST',
        body: JSON.stringify({
          role: 'user',
          content: { text: 'Hello' },
        }),
      });

      const response = await POST(request, { params: { id: 'project-1' } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBe('msg-1');
    });
  });

  describe('PATCH /api/messages/[id]', () => {
    it('should update a message', async () => {
      const mockMessage = {
        id: 'msg-1',
        projectId: 'project-1',
        project: {
          id: 'project-1',
          ownerId: 'user-1',
        },
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message.update as jest.Mock).mockResolvedValue({
        id: 'msg-1',
        role: 'user',
        content: { text: 'Updated' },
        senderId: 'user-1',
        createdAt: new Date(),
        redacted: false,
      });

      const request = new NextRequest('http://localhost:3000/api/messages/msg-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: { text: 'Updated' },
        }),
      });

      const response = await PATCH(request, { params: { id: 'msg-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.content.text).toBe('Updated');
    });
  });

  describe('DELETE /api/messages/[id]', () => {
    it('should soft delete a message', async () => {
      const mockMessage = {
        id: 'msg-1',
        projectId: 'project-1',
        project: {
          id: 'project-1',
          ownerId: 'user-1',
        },
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message.update as jest.Mock).mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/messages/msg-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: 'msg-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});

