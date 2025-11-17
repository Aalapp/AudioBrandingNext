import {
  generateConversationSnapshot,
  updateProjectSnapshot,
  shouldUpdateSnapshot,
} from '@/lib/snapshots';
import { prisma } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  prisma: {
    message: {
      findMany: jest.fn(),
    },
    file: {
      findMany: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('Snapshot Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateConversationSnapshot', () => {
    it('should generate a conversation snapshot', async () => {
      const mockProject = {
        id: 'project-1',
        brandName: 'Test Brand',
        brandWebsite: 'https://test.com',
        findingsDraft: { key: 'value' },
      };

      const mockMessages = [
        {
          role: 'user',
          content: { text: 'Hello' },
          createdAt: new Date('2024-01-01'),
        },
        {
          role: 'assistant',
          content: { text: 'Hi there!' },
          createdAt: new Date('2024-01-02'),
        },
      ];

      const mockFiles = [
        {
          id: 'file-1',
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
        },
      ];

      (prisma.message.findMany as jest.Mock).mockResolvedValue(mockMessages);
      (prisma.file.findMany as jest.Mock).mockResolvedValue(mockFiles);
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);

      const snapshot = await generateConversationSnapshot('project-1');

      expect(snapshot).toHaveProperty('recentMessages');
      expect(snapshot).toHaveProperty('fileSummaries');
      expect(snapshot).toHaveProperty('projectMetadata');
      expect(snapshot.recentMessages).toHaveLength(2);
      expect(snapshot.fileSummaries).toHaveLength(1);
    });
  });

  describe('updateProjectSnapshot', () => {
    it('should update project snapshot', async () => {
      const mockSnapshot = {
        recentMessages: [],
        fileSummaries: [],
        projectMetadata: {
          brandName: 'Test Brand',
          brandWebsite: 'https://test.com',
        },
        lastUpdated: new Date().toISOString(),
      };

      (prisma.message.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.file.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: 'project-1',
        brandName: 'Test Brand',
        brandWebsite: 'https://test.com',
        findingsDraft: null,
      });
      (prisma.project.update as jest.Mock).mockResolvedValue({});

      await updateProjectSnapshot('project-1');

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: {
          conversationSnapshot: expect.any(Object),
          lastActivityAt: expect.any(Date),
        },
      });
    });
  });

  describe('shouldUpdateSnapshot', () => {
    it('should return true if message count threshold reached', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: 'project-1',
        conversationSnapshot: {},
        lastActivityAt: new Date(),
        _count: {
          Messages: 10, // Multiple of 5
        },
      });

      const result = await shouldUpdateSnapshot('project-1', 5);
      expect(result).toBe(true);
    });

    it('should return true if time threshold reached', async () => {
      const oldDate = new Date(Date.now() - 60 * 1000); // 1 minute ago

      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: 'project-1',
        conversationSnapshot: {},
        lastActivityAt: oldDate,
        _count: {
          Messages: 3, // Not a multiple of 5
        },
      });

      const result = await shouldUpdateSnapshot('project-1', 5, 30 * 1000);
      expect(result).toBe(true);
    });

    it('should return false if thresholds not met', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: 'project-1',
        conversationSnapshot: {},
        lastActivityAt: new Date(), // Just now
        _count: {
          Messages: 3, // Not a multiple of 5
        },
      });

      const result = await shouldUpdateSnapshot('project-1', 5, 30 * 1000);
      expect(result).toBe(false);
    });
  });
});

