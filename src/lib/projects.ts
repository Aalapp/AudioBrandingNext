import { prisma } from './db';
import { generateHashid } from './auth';
import { SessionUser } from './auth';

export interface CreateProjectInput {
  brandName: string;
  brandWebsite: string;
  initialMetadata?: Record<string, any>;
}

export interface UpdateProjectInput {
  brandName?: string;
  brandWebsite?: string;
  findingsDraft?: Record<string, any>;
  conversationSnapshot?: Record<string, any>;
}

/**
 * Verify that a user owns a project
 */
export async function verifyProjectOwnership(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId: userId,
      deleted: false,
    },
  });

  return !!project;
}

/**
 * Get project by ID (with ownership check)
 */
export async function getProjectById(
  projectId: string,
  userId: string
) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId: userId,
      deleted: false,
    },
    include: {
      owner: {
        select: {
          id: true,
          hashid: true,
          email: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Get project by hashid (with ownership check)
 */
export async function getProjectByHashid(
  hashid: string,
  userId: string
) {
  return prisma.project.findFirst({
    where: {
      hashid,
      ownerId: userId,
      deleted: false,
    },
    include: {
      owner: {
        select: {
          id: true,
          hashid: true,
          email: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Create a new project
 */
export async function createProject(
  user: SessionUser,
  input: CreateProjectInput
) {
  let hashid = generateHashid();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      const project = await prisma.project.create({
        data: {
          hashid,
          ownerId: user.id,
          brandName: input.brandName,
          brandWebsite: input.brandWebsite,
          initialMetadata: input.initialMetadata ?? undefined,
        },
        include: {
          owner: {
            select: {
              id: true,
              hashid: true,
              email: true,
              name: true,
            },
          },
        },
      });

      return project;
    } catch (error: any) {
      // If hashid collision, try again
      if (error.code === 'P2002' && error.meta?.target?.includes('hashid')) {
        hashid = generateHashid();
        attempts++;
        continue;
      }
      throw error;
    }
  }

  throw new Error('Failed to create project after multiple hashid attempts');
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  userId: string,
  input: UpdateProjectInput
) {
  // Verify ownership first
  const exists = await verifyProjectOwnership(projectId, userId);
  if (!exists) {
    throw new Error('Project not found or access denied');
  }

  return prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.brandName && { brandName: input.brandName }),
      ...(input.brandWebsite && { brandWebsite: input.brandWebsite }),
      ...(input.findingsDraft !== undefined && { findingsDraft: input.findingsDraft }),
      ...(input.conversationSnapshot !== undefined && {
        conversationSnapshot: input.conversationSnapshot,
      }),
      lastActivityAt: new Date(),
    },
    include: {
      owner: {
        select: {
          id: true,
          hashid: true,
          email: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Soft delete a project
 */
export async function deleteProject(projectId: string, userId: string) {
  // Verify ownership first
  const exists = await verifyProjectOwnership(projectId, userId);
  if (!exists) {
    throw new Error('Project not found or access denied');
  }

  return prisma.project.update({
    where: { id: projectId },
    data: {
      deleted: true,
      lastActivityAt: new Date(),
    },
  });
}

/**
 * List projects for a user with pagination
 */
export async function listProjects(
  userId: string,
  options: {
    limit?: number;
    cursor?: string;
    orderBy?: 'createdAt' | 'lastActivityAt';
    order?: 'asc' | 'desc';
  } = {}
) {
  const limit = Math.min(options.limit || 20, 100);
  const orderBy = options.orderBy || 'lastActivityAt';
  const order = options.order || 'desc';

  const where: any = {
    ownerId: userId,
    deleted: false,
  };

  // Cursor-based pagination
  if (options.cursor) {
    where.id = {
      lt: options.cursor, // Assuming descending order
    };
  }

  const projects = await prisma.project.findMany({
    where,
    take: limit + 1, // Fetch one extra to determine if there's a next page
    orderBy: {
      [orderBy]: order,
    },
    include: {
      owner: {
        select: {
          id: true,
          hashid: true,
          email: true,
          name: true,
        },
      },
      _count: {
        select: {
          Messages: true,
          Files: true,
          Analyses: true,
        },
      },
    },
  });

  const hasNextPage = projects.length > limit;
  const items = hasNextPage ? projects.slice(0, limit) : projects;
  const nextCursor = hasNextPage ? items[items.length - 1].id : null;

  return {
    items,
    nextCursor,
    hasNextPage,
  };
}

