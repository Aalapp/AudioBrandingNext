import { prisma } from './db';

export interface ConversationSnapshot {
  recentMessages: Array<{
    role: string;
    content: any;
    createdAt: string;
  }>;
  fileSummaries: Array<{
    id: string;
    filename: string;
    mimeType: string;
  }>;
  projectMetadata: {
    brandName: string;
    brandWebsite: string;
    findingsDraft?: any;
  };
  lastUpdated: string;
}

/**
 * Generate a conversation snapshot for a project
 */
export async function generateConversationSnapshot(
  projectId: string
): Promise<ConversationSnapshot> {
  // Fetch recent messages (last 20)
  const messages = await prisma.message.findMany({
    where: {
      projectId,
      redacted: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
    select: {
      role: true,
      content: true,
      createdAt: true,
    },
  });

  // Fetch file summaries
  const files = await prisma.file.findMany({
    where: {
      projectId,
      deleted: false,
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
    },
    take: 10,
  });

  // Fetch project metadata
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      brandName: true,
      brandWebsite: true,
      findingsDraft: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return {
    recentMessages: messages
      .reverse() // Reverse to chronological order
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
      })),
    fileSummaries: files.map((file) => ({
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
    })),
    projectMetadata: {
      brandName: project.brandName,
      brandWebsite: project.brandWebsite,
      findingsDraft: project.findingsDraft,
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Update project conversation snapshot
 */
export async function updateProjectSnapshot(projectId: string): Promise<void> {
  const snapshot = await generateConversationSnapshot(projectId);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      conversationSnapshot: snapshot as any,
      lastActivityAt: new Date(),
    },
  });
}

/**
 * Check if snapshot should be updated based on message count and time
 */
export async function shouldUpdateSnapshot(
  projectId: string,
  messageCountThreshold: number = 5,
  timeThresholdMs: number = 30 * 1000 // 30 seconds
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      conversationSnapshot: true,
      lastActivityAt: true,
      _count: {
        select: {
          Messages: {
            where: {
              redacted: false,
            },
          },
        },
      },
    },
  });

  if (!project) {
    return false;
  }

  // Check message count threshold
  const messageCount = project._count.Messages;
  if (messageCount > 0 && messageCount % messageCountThreshold === 0) {
    return true;
  }

  // Check time threshold
  const timeSinceLastUpdate =
    Date.now() - project.lastActivityAt.getTime();
  if (timeSinceLastUpdate >= timeThresholdMs) {
    return true;
  }

  return false;
}

