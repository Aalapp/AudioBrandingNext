import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createProject, listProjects, CreateProjectInput } from '@/lib/projects';
import { z } from 'zod';

const hasProtocol = (value: string) =>
  /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);

const normalizeWebsite = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  return hasProtocol(trimmed) ? trimmed : `https://${trimmed}`;
};

const brandWebsiteSchema = z
  .string()
  .trim()
  .min(1, 'Brand website is required')
  .max(500, 'Brand website must be 500 characters or fewer')
  .transform(normalizeWebsite)
  .refine((value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid website URL');

const createProjectSchema = z.object({
  brandName: z.string().trim().min(1).max(200),
  brandWebsite: brandWebsiteSchema,
  initialMetadata: z.record(z.any()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const cursor = searchParams.get('cursor') || undefined;
    const orderBy = (searchParams.get('orderBy') as 'createdAt' | 'lastActivityAt') || 'lastActivityAt';
    const order = (searchParams.get('order') as 'asc' | 'desc') || 'desc';

    const result = await listProjects(user.id, {
      limit,
      cursor,
      orderBy,
      order,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Error listing projects:', error);
    return NextResponse.json(
      { error: 'Failed to list projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate input
    const validated = createProjectSchema.parse(body);

    const project = await createProject(user, validated as CreateProjectInput);

    return NextResponse.json(project, { status: 201 });
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

    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

