import { GET, POST } from '@/app/api/projects/route';
import { GET as getProject, PATCH, DELETE } from '@/app/api/projects/[id]/route';
import { NextRequest } from 'next/server';
import * as authLib from '@/lib/auth';
import * as projectsLib from '@/lib/projects';

// Mock auth and projects libraries
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/projects', () => ({
  createProject: jest.fn(),
  listProjects: jest.fn(),
  getProjectById: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
}));

describe('Projects API Routes', () => {
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
  });

  describe('GET /api/projects', () => {
    it('should list projects with pagination', async () => {
      const mockProjects = {
        items: [
          {
            id: 'project-1',
            hashid: 'proj123',
            brandName: 'Test Brand',
            brandWebsite: 'https://test.com',
            ownerId: 'user-1',
            createdAt: new Date(),
            lastActivityAt: new Date(),
            deleted: false,
          },
        ],
        nextCursor: null,
        hasNextPage: false,
      };

      (projectsLib.listProjects as jest.Mock).mockResolvedValue(mockProjects);

      const request = new NextRequest('http://localhost:3000/api/projects?limit=20');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.items).toHaveLength(1);
      expect(projectsLib.listProjects).toHaveBeenCalledWith('user-1', {
        limit: 20,
        cursor: undefined,
        orderBy: 'lastActivityAt',
        order: 'desc',
      });
    });

    it('should return 401 if not authenticated', async () => {
      (authLib.requireAuth as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

      const request = new NextRequest('http://localhost:3000/api/projects');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const mockProject = {
        id: 'project-1',
        hashid: 'proj123',
        brandName: 'New Brand',
        brandWebsite: 'https://newbrand.com',
        ownerId: 'user-1',
        createdAt: new Date(),
        lastActivityAt: new Date(),
        deleted: false,
        owner: mockUser,
      };

      (projectsLib.createProject as jest.Mock).mockResolvedValue(mockProject);

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          brandName: 'New Brand',
          brandWebsite: 'https://newbrand.com',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.brandName).toBe('New Brand');
      expect(projectsLib.createProject).toHaveBeenCalled();
    });

    it('should return 400 for invalid input', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          brandName: '', // Invalid: empty
          brandWebsite: 'not-a-url', // Invalid: not a URL
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });
  });

  describe('GET /api/projects/[id]', () => {
    it('should get project by ID', async () => {
      const mockProject = {
        id: 'project-1',
        hashid: 'proj123',
        brandName: 'Test Brand',
        brandWebsite: 'https://test.com',
        owner: mockUser,
      };

      (projectsLib.getProjectById as jest.Mock).mockResolvedValue(mockProject);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1');
      const response = await getProject(request, { params: Promise.resolve({ id: 'project-1' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe('project-1');
    });

    it('should return 404 if project not found', async () => {
      (projectsLib.getProjectById as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1');
      const response = await getProject(request, { params: Promise.resolve({ id: 'project-1' }) });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/projects/[id]', () => {
    it('should update project', async () => {
      const mockProject = {
        id: 'project-1',
        brandName: 'Updated Brand',
        brandWebsite: 'https://updated.com',
        owner: mockUser,
      };

      (projectsLib.updateProject as jest.Mock).mockResolvedValue(mockProject);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1', {
        method: 'PATCH',
        body: JSON.stringify({
          brandName: 'Updated Brand',
        }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'project-1' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.brandName).toBe('Updated Brand');
    });
  });

  describe('DELETE /api/projects/[id]', () => {
    it('should soft delete project', async () => {
      (projectsLib.deleteProject as jest.Mock).mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/projects/project-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'project-1' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});

